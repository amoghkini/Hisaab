"""Payslips: drafted on each employer's pay day, checked by the user, and posted to the ledger when approved.

A draft for a month starts from:
- the last posted payslip, when one was posted since the pay revision in force took effect, so the monthly numbers
  the user entered carry on; otherwise
- a twelfth of that revision's yearly amounts, which covers the first salary and the first one after an appraisal.

Posting makes one income transaction of the take-home pay in the employer's salary account, with source "salary"
and its own group, so editing or deleting the payslip replaces or removes it. EPF and TDS are posted once EPF
accounts and the Taxes section exist.
"""

import calendar
from collections.abc import Iterator
from datetime import date, datetime, time
from uuid import uuid4

from sqlalchemy import delete, exists, func, select, update
from sqlalchemy.orm import Session

from app.categories.models import Category, CategoryType
from app.errors import ApiError
from app.notifications.models import NotificationKind
from app.notifications.service import mark_read_about, notify
from app.salary.models import (
    ComponentKind,
    Employer,
    Payslip,
    PayslipLine,
    PayslipStatus,
    PrefillSource,
    SalaryComponent,
    SalaryRevision,
    SalaryRevisionLine,
)
from app.salary.schemas import (
    PayslipCreateIn,
    PayslipDetailOut,
    PayslipLineIn,
    PayslipLineOut,
    PayslipOut,
    PayslipUpdate,
)
from app.salary.service import (
    _components,
    _field_error,
    _revisions,
    _totals,
    get_employer,
    monthly_amount,
    pay_date,
    salary_account_ok,
)
from app.transactions.models import TransactionSource, TransactionType
from app.transactions.schemas import TransactionIn
from app.transactions.service import delete_group, group_transactions, replace_group

# The names of the income category the take-home pay starts in, as the preset categories call it.
SALARY_CATEGORY_NAMES = ("salary income", "salary")


def month_name(month: date) -> str:
    return f"{calendar.month_name[month.month]} {month.year}"


def _ref(payslip: Payslip) -> str:
    return f"payslip:{payslip.id}"


def _months(first: date, last: date) -> Iterator[date]:
    """The first day of each month from `first`'s month to `last`'s, inclusive."""
    year, month = first.year, first.month
    while (year, month) <= (last.year, last.month):
        yield date(year, month, 1)
        year, month = (year + 1, 1) if month == 12 else (year, month + 1)


def pay_date_in(employer: Employer, month: date) -> date:
    """The employer's pay date in a month. The first salary's month pays on the date given for it."""
    if (month.year, month.month) == (employer.first_pay_on.year, employer.first_pay_on.month):
        return employer.first_pay_on
    return pay_date(month.year, month.month, employer.pay_day)


# Drafting


def _revision_in_force(db: Session, employer: Employer, on: date) -> SalaryRevision | None:
    revisions = _revisions(db, employer.id)
    in_force = [revision for revision in revisions if revision.effective_from <= on]
    if in_force:
        return in_force[-1]
    return revisions[0] if revisions else None


Prefill = tuple[SalaryRevision | None, PrefillSource, dict[int, int]]


def _prefill(db: Session, employer: Employer, paid_on: date) -> Prefill:
    """The revision in force, where the amounts come from, and each component's amount."""
    revision = _revision_in_force(db, employer, paid_on)
    last = db.scalar(
        select(Payslip)
        .where(
            Payslip.employer_id == employer.id,
            Payslip.status == PayslipStatus.POSTED,
            Payslip.pay_date < paid_on,
        )
        .order_by(Payslip.pay_date.desc())
        .limit(1)
    )
    if last is not None and (revision is None or last.pay_date >= revision.effective_from):
        lines = db.scalars(select(PayslipLine).where(PayslipLine.payslip_id == last.id)).all()
        return revision, PrefillSource.PREVIOUS, {line.component_id: line.amount for line in lines}
    amounts: dict[int, int] = {}
    if revision is not None:
        for line in db.scalars(select(SalaryRevisionLine).where(SalaryRevisionLine.revision_id == revision.id)):
            if monthly_amount(line.yearly_amount) > 0:
                amounts[line.component_id] = monthly_amount(line.yearly_amount)
    return revision, PrefillSource.REVISION, amounts


def _default_category(db: Session, user_id: int) -> int | None:
    """The user's "Salary Income" category, if they have one that can hold a transaction."""
    candidates = db.scalars(
        select(Category)
        .where(
            Category.user_id == user_id,
            Category.type == CategoryType.INCOME,
            Category.hidden.is_(False),
            func.lower(Category.name).in_(SALARY_CATEGORY_NAMES),
        )
        .order_by(Category.parent_id.is_(None), Category.id)  # a sub-category first: groups cannot hold one
    ).all()
    for category in candidates:
        if not db.scalar(select(exists().where(Category.parent_id == category.id))):
            return category.id
    return None


def _set_lines(db: Session, payslip: Payslip, amounts: dict[int, int]) -> None:
    db.execute(delete(PayslipLine).where(PayslipLine.payslip_id == payslip.id))
    for component_id, amount in amounts.items():
        if amount > 0:
            db.add(PayslipLine(payslip_id=payslip.id, component_id=component_id, amount=amount))


def _fill(db: Session, employer: Employer, payslip: Payslip) -> None:
    revision, source, amounts = _prefill(db, employer, payslip.pay_date)
    payslip.revision_id = revision.id if revision else None
    payslip.prefill_source = source
    _set_lines(db, payslip, amounts)


def _new_draft(db: Session, employer: Employer, month: date) -> Payslip:
    payslip = Payslip(
        user_id=employer.user_id,
        employer_id=employer.id,
        pay_month=month,
        pay_date=pay_date_in(employer, month),
        status=PayslipStatus.DRAFT,
        prefill_source=PrefillSource.REVISION,
        category_id=_default_category(db, employer.user_id),
        comment="",
    )
    db.add(payslip)
    db.flush()
    _fill(db, employer, payslip)
    return payslip


def generate_due_payslips(db: Session, user_id: int, today: date) -> int:
    """Draft each month whose pay day has come, and say so with a notification. Months already drafted, posted or
    dismissed are left alone, and so are pay days before the employer was added: those are added by hand.
    Returns how many were drafted."""
    made = 0
    for employer in db.scalars(select(Employer).where(Employer.user_id == user_id)).all():
        added_on = employer.created_at.date()
        last = min(today, employer.left_on) if employer.left_on else today
        have = set(db.scalars(select(Payslip.pay_month).where(Payslip.employer_id == employer.id)).all())
        for month in _months(employer.first_pay_on, last):
            paid_on = pay_date_in(employer, month)
            if month in have or paid_on > today or paid_on < added_on:
                continue
            payslip = _new_draft(db, employer, month)
            notify(
                db,
                user_id,
                NotificationKind.PAYSLIP_DRAFT,
                f"{employer.name}: your payslip for {month_name(month)} is ready to review",
                f"/salary/payslips/{payslip.id}",
                _ref(payslip),
            )
            made += 1
    db.commit()
    return made


def generate_for_everyone(db: Session, today: date) -> int:
    """The pay-day job: every user with an employer."""
    user_ids = db.scalars(select(Employer.user_id).distinct()).all()
    return sum(generate_due_payslips(db, user_id, today) for user_id in user_ids)


# Reading


def get_payslip(db: Session, user_id: int, payslip_id: int) -> Payslip:
    payslip = db.get(Payslip, payslip_id)
    if payslip is None or payslip.user_id != user_id or payslip.status == PayslipStatus.DISMISSED:
        raise ApiError(404, "payslip_not_found", "This payslip does not exist.")
    return payslip


def _line_amounts(db: Session, payslip_ids: list[int]) -> dict[int, dict[int, int]]:
    found: dict[int, dict[int, int]] = {payslip_id: {} for payslip_id in payslip_ids}
    if payslip_ids:
        for line in db.scalars(select(PayslipLine).where(PayslipLine.payslip_id.in_(payslip_ids))):
            found[line.payslip_id][line.component_id] = line.amount
    return found


def _out(payslip: Payslip, employer: Employer, kinds: dict[int, str], amounts: dict[int, int]) -> PayslipOut:
    return PayslipOut(
        id=payslip.id,
        employer_id=employer.id,
        employer_name=employer.name,
        pay_month=payslip.pay_month,
        pay_date=payslip.pay_date,
        status=PayslipStatus(payslip.status),
        prefill_source=PrefillSource(payslip.prefill_source),
        revision_id=payslip.revision_id,
        category_id=payslip.category_id,
        comment=payslip.comment,
        totals=_totals((kinds[id_], amount) for id_, amount in amounts.items() if id_ in kinds),
    )


def list_payslips(
    db: Session, user_id: int, employer_id: int | None = None, status: PayslipStatus | None = None
) -> list[PayslipOut]:
    """Newest month first. Dismissed payslips are left out."""
    query = select(Payslip).where(Payslip.user_id == user_id, Payslip.status != PayslipStatus.DISMISSED)
    if employer_id is not None:
        query = query.where(Payslip.employer_id == employer_id)
    if status is not None:
        query = query.where(Payslip.status == status)
    payslips = db.scalars(query.order_by(Payslip.pay_month.desc(), Payslip.pay_date.desc(), Payslip.id.desc())).all()
    employers = {e.id: e for e in db.scalars(select(Employer).where(Employer.user_id == user_id))}
    kinds = {c.id: c.kind for c in db.scalars(select(SalaryComponent).where(SalaryComponent.user_id == user_id))}
    amounts = _line_amounts(db, [payslip.id for payslip in payslips])
    return [_out(payslip, employers[payslip.employer_id], kinds, amounts[payslip.id]) for payslip in payslips]


def _post_problem(db: Session, payslip: Payslip, employer: Employer, net: int) -> str | None:
    if employer.salary_account_id is None:
        return "Choose the account your salary is paid into, on the employer's page."
    if not salary_account_ok(db, employer):
        return "The employer's salary account is gone, or is no longer a savings or current account."
    if payslip.category_id is None:
        return "Choose the income category for the take-home pay."
    if net <= 0:
        return "The take-home pay must be more than zero."
    return None


def payslip_detail(db: Session, payslip: Payslip) -> PayslipDetailOut:
    employer = db.get(Employer, payslip.employer_id)
    assert employer is not None  # noqa: S101 - payslips go with their employer
    components = _components(db, employer.id)
    kinds = {component.id: component.kind for component in components}
    amounts = _line_amounts(db, [payslip.id])[payslip.id]
    summary = _out(payslip, employer, kinds, amounts)
    group = payslip.transaction_group_id
    return PayslipDetailOut(
        **summary.model_dump(),
        lines=[
            PayslipLineOut(
                component_id=component.id,
                name=component.name,
                kind=ComponentKind(component.kind),
                amount=amounts.get(component.id, 0),
            )
            for component in components
        ],
        salary_account_id=employer.salary_account_id,
        post_problem=_post_problem(db, payslip, employer, summary.totals.net),
        transaction_ids=[t.id for t in group_transactions(db, payslip.user_id, group)] if group else [],
    )


# Changing


def create_payslip(db: Session, user_id: int, data: PayslipCreateIn) -> Payslip:
    employer = get_employer(db, user_id, data.employer_id)
    month = data.pay_month.replace(day=1)
    if month < employer.joined_on.replace(day=1):
        raise _field_error(422, "validation_failed", "pay_month", "This month is before you joined.")
    if employer.left_on is not None and month > employer.left_on.replace(day=1):
        raise _field_error(422, "validation_failed", "pay_month", "This month is after you left.")
    existing = db.scalar(select(Payslip).where(Payslip.employer_id == employer.id, Payslip.pay_month == month))
    if existing is not None and existing.status != PayslipStatus.DISMISSED:
        message = f"There is already a payslip for {month_name(month)}. Open it from the payslips list."
        raise _field_error(409, "payslip_exists", "pay_month", message)
    if existing is not None:  # dismissed before: start it again
        existing.status = PayslipStatus.DRAFT
        existing.pay_date = pay_date_in(employer, month)
        existing.category_id = existing.category_id or _default_category(db, user_id)
        existing.comment = ""
        _fill(db, employer, existing)
        payslip = existing
    else:
        payslip = _new_draft(db, employer, month)
    db.commit()
    return payslip


def _post(db: Session, payslip: Payslip, employer: Employer) -> None:
    """Make (or remake) the payslip's transaction. The caller commits."""
    kinds = {component.id: component.kind for component in _components(db, employer.id)}
    amounts = _line_amounts(db, [payslip.id])[payslip.id]
    net = _totals((kinds[id_], amount) for id_, amount in amounts.items() if id_ in kinds).net
    problem = _post_problem(db, payslip, employer, net)
    if problem is not None:
        raise ApiError(422, "payslip_not_ready", problem)
    assert employer.salary_account_id is not None and payslip.category_id is not None  # noqa: S101 - checked above
    payslip.transaction_group_id = payslip.transaction_group_id or str(uuid4())
    entry = TransactionIn(
        type=TransactionType.INCOME,
        occurred_at=datetime.combine(payslip.pay_date, time()),
        category_id=payslip.category_id,
        account_id=employer.salary_account_id,
        amount=net,
        comment=f"Salary for {month_name(payslip.pay_month)} from {employer.name}"[:255],
    )
    replace_group(db, payslip.user_id, payslip.transaction_group_id, TransactionSource.SALARY, [(entry, _ref(payslip))])
    payslip.status = PayslipStatus.POSTED
    mark_read_about(db, payslip.user_id, _ref(payslip))


def _check_lines(db: Session, employer: Employer, lines: list[PayslipLineIn]) -> dict[int, int]:
    own = {component.id for component in _components(db, employer.id)}
    if any(line.component_id not in own for line in lines):
        raise _field_error(422, "validation_failed", "lines", "A component does not belong to this employer.")
    return {line.component_id: line.amount for line in lines}


def update_payslip(db: Session, payslip: Payslip, data: PayslipUpdate) -> Payslip:
    employer = db.get(Employer, payslip.employer_id)
    assert employer is not None  # noqa: S101
    changes = data.changes()
    new_date = changes.get("pay_date")
    if isinstance(new_date, date):
        if new_date.replace(day=1) != payslip.pay_month:
            message = f"The pay date must be in {month_name(payslip.pay_month)}."
            raise _field_error(422, "validation_failed", "pay_date", message)
        payslip.pay_date = new_date
    if "category_id" in changes:
        payslip.category_id = data.category_id
    if "comment" in changes:
        payslip.comment = str(changes["comment"])
    if data.lines is not None:
        _set_lines(db, payslip, _check_lines(db, employer, data.lines))
        payslip.prefill_source = PrefillSource.MANUAL
    db.flush()
    if payslip.status == PayslipStatus.POSTED:
        _post(db, payslip, employer)
    db.commit()
    return payslip


def refill_payslip(db: Session, payslip: Payslip) -> Payslip:
    """Start a draft's amounts again from the revision in force or the last posted payslip."""
    if payslip.status != PayslipStatus.DRAFT:
        raise ApiError(409, "payslip_posted", "Only a draft can be filled again.")
    employer = db.get(Employer, payslip.employer_id)
    assert employer is not None  # noqa: S101
    _fill(db, employer, payslip)
    db.commit()
    return payslip


def post_payslip(db: Session, payslip: Payslip) -> Payslip:
    """Approve the payslip: its take-home pay becomes an income transaction in the salary account."""
    if payslip.status == PayslipStatus.POSTED:
        raise ApiError(409, "payslip_posted", "This payslip is already approved.")
    employer = db.get(Employer, payslip.employer_id)
    assert employer is not None  # noqa: S101
    _post(db, payslip, employer)
    db.commit()
    return payslip


def dismiss_payslip(db: Session, payslip: Payslip) -> None:
    """Delete the payslip and its transaction. The month is not drafted again unless added by hand."""
    if payslip.transaction_group_id:
        delete_group(db, payslip.user_id, payslip.transaction_group_id)
    payslip.transaction_group_id = None
    payslip.status = PayslipStatus.DISMISSED
    mark_read_about(db, payslip.user_id, _ref(payslip))
    db.commit()


# Used when other salary data or the ledger changes


def forget_postings(db: Session, user_id: int) -> None:
    """The user's transactions were cleared: posted payslips go back to drafts to approve again. The caller
    commits."""
    db.execute(
        update(Payslip)
        .where(Payslip.user_id == user_id, Payslip.status == PayslipStatus.POSTED)
        .values(status=PayslipStatus.DRAFT, transaction_group_id=None)
    )
