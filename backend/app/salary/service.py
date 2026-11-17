"""Employers, salary components, revisions and documents.

The salary section calls the ledger (accounts) and never the other way round, so the ledger does not clear an
employer's link when an account is deleted or changes kind. Reading the employer reports it instead.

SQLite here does not enforce foreign keys, so the rows that hang off an employer or a revision are deleted in code.
"""

import calendar
from collections.abc import Iterable
from datetime import date

from sqlalchemy import delete, exists, func, select, update
from sqlalchemy.orm import Session

from app.accounts.models import SALARY_CATEGORIES, Account
from app.errors import ApiError
from app.notifications.service import delete_about
from app.salary.models import (
    ComponentKind,
    DocumentKind,
    Employer,
    EmployerDocument,
    Payslip,
    PayslipLine,
    PayslipStatus,
    RevisionKind,
    SalaryComponent,
    SalaryRevision,
    SalaryRevisionLine,
)
from app.salary.schemas import (
    ComponentIn,
    ComponentOut,
    ComponentUpdate,
    DocumentIn,
    DocumentOut,
    EmployerDetailOut,
    EmployerIn,
    EmployerOut,
    EmployerUpdate,
    LineIn,
    LineOut,
    RevisionIn,
    RevisionOut,
    RevisionUpdate,
    TotalsOut,
)

KIND_ORDER = list(ComponentKind)


def _field_error(status: int, code: str, field: str, message: str) -> ApiError:
    return ApiError(status, code, message, [{"field": field, "message": message}])


# Dates and amounts


def pay_date(year: int, month: int, pay_day: int) -> date:
    """The pay day in that month; a month too short for it pays on its last day."""
    return date(year, month, min(pay_day, calendar.monthrange(year, month)[1]))


def first_pay_date(joined_on: date, pay_day: int) -> date:
    """The first pay day on or after the joining date."""
    candidate = pay_date(joined_on.year, joined_on.month, pay_day)
    if candidate >= joined_on:
        return candidate
    year, month = (joined_on.year + 1, 1) if joined_on.month == 12 else (joined_on.year, joined_on.month + 1)
    return pay_date(year, month, pay_day)


def monthly_amount(yearly: int) -> int:
    """A twelfth of a yearly amount in paise, rounded to the rupee."""
    return (yearly + 600) // 1200 * 100


def _totals(amounts: Iterable[tuple[str, int]]) -> TotalsOut:
    sums = dict.fromkeys(ComponentKind, 0)
    for kind, amount in amounts:
        sums[ComponentKind(kind)] += amount
    gross = sums[ComponentKind.EARNING]
    deductions = sums[ComponentKind.DEDUCTION]
    contributions = sums[ComponentKind.EMPLOYER_CONTRIBUTION]
    return TotalsOut(
        gross=gross,
        deductions=deductions,
        net=gross - deductions,
        employer_contributions=contributions,
        ctc=gross + contributions,
    )


# Reading


def get_employer(db: Session, user_id: int, employer_id: int) -> Employer:
    employer = db.get(Employer, employer_id)
    if employer is None or employer.user_id != user_id:
        raise ApiError(404, "employer_not_found", "This employer does not exist.")
    return employer


def _components(db: Session, employer_id: int) -> list[SalaryComponent]:
    found = db.scalars(select(SalaryComponent).where(SalaryComponent.employer_id == employer_id)).all()
    return sorted(found, key=lambda c: (KIND_ORDER.index(ComponentKind(c.kind)), c.display_order, c.id))


def _revisions(db: Session, employer_id: int) -> list[SalaryRevision]:
    """Oldest effective date first."""
    return list(
        db.scalars(
            select(SalaryRevision)
            .where(SalaryRevision.employer_id == employer_id)
            .order_by(SalaryRevision.effective_from)
        ).all()
    )


def _lines_by_revision(db: Session, revision_ids: list[int]) -> dict[int, list[SalaryRevisionLine]]:
    by_revision: dict[int, list[SalaryRevisionLine]] = {revision_id: [] for revision_id in revision_ids}
    if revision_ids:
        for line in db.scalars(select(SalaryRevisionLine).where(SalaryRevisionLine.revision_id.in_(revision_ids))):
            by_revision[line.revision_id].append(line)
    return by_revision


def _current_revision(revisions: list[SalaryRevision], employer: Employer, today: date) -> SalaryRevision | None:
    """The revision in force today, or on the last day for a past job; before the job starts, the joining one."""
    as_of = min(today, employer.left_on) if employer.left_on else today
    in_force = [revision for revision in revisions if revision.effective_from <= as_of]
    if in_force:
        return in_force[-1]
    return revisions[0] if revisions else None


def salary_account_ok(db: Session, employer: Employer) -> bool:
    """No account set, or one of the user's savings or current accounts."""
    if employer.salary_account_id is None:
        return True
    account = db.get(Account, employer.salary_account_id)
    return account is not None and account.user_id == employer.user_id and account.category in SALARY_CATEGORIES


def is_current(employer: Employer, today: date) -> bool:
    return employer.left_on is None or employer.left_on >= today


def _employer_detail(db: Session, employer: Employer, today: date) -> EmployerDetailOut:
    components = _components(db, employer.id)
    kind_of = {component.id: component.kind for component in components}
    revisions = _revisions(db, employer.id)
    lines = _lines_by_revision(db, [revision.id for revision in revisions])
    current = _current_revision(revisions, employer, today)

    revisions_out: list[RevisionOut] = []
    designation: str | None = None
    for revision in revisions:
        designation = revision.designation or designation
        revision_lines = [line for line in lines[revision.id] if line.component_id in kind_of]
        if current is not None and revision.id == current.id:
            status = "current"
        elif revision.effective_from > today:
            status = "upcoming"
        else:
            status = "past"
        revisions_out.append(
            RevisionOut(
                id=revision.id,
                kind=RevisionKind(revision.kind),
                announced_on=revision.announced_on,
                effective_from=revision.effective_from,
                designation=revision.designation,
                designation_in_effect=designation,
                comment=revision.comment,
                status=status,
                lines=[
                    LineOut(
                        component_id=line.component_id,
                        yearly_amount=line.yearly_amount,
                        monthly_amount=monthly_amount(line.yearly_amount),
                    )
                    for line in revision_lines
                ],
                yearly=_totals((kind_of[line.component_id], line.yearly_amount) for line in revision_lines),
                monthly=_totals(
                    (kind_of[line.component_id], monthly_amount(line.yearly_amount)) for line in revision_lines
                ),
            )
        )
    revisions_out.reverse()
    current_out = next((r for r in revisions_out if current is not None and r.id == current.id), None)

    documents = db.scalars(select(EmployerDocument).where(EmployerDocument.employer_id == employer.id)).all()
    documents = sorted(
        documents,
        key=lambda d: (-(d.financial_year or 0), -(d.issued_on or date.min).toordinal(), -d.id),
    )
    return EmployerDetailOut(
        id=employer.id,
        name=employer.name,
        employee_code=employer.employee_code,
        joined_on=employer.joined_on,
        left_on=employer.left_on,
        first_pay_on=employer.first_pay_on,
        pay_day=employer.pay_day,
        salary_account_id=employer.salary_account_id,
        salary_account_ok=salary_account_ok(db, employer),
        uan=employer.uan,
        comment=employer.comment,
        is_current=is_current(employer, today),
        designation=current_out.designation_in_effect if current_out else None,
        yearly=current_out.yearly if current_out else None,
        monthly=current_out.monthly if current_out else None,
        components=[
            ComponentOut(id=c.id, name=c.name, kind=ComponentKind(c.kind), display_order=c.display_order)
            for c in components
        ],
        revisions=revisions_out,
        current_revision_id=current.id if current else None,
        documents=[
            DocumentOut(
                id=d.id,
                kind=DocumentKind(d.kind),
                financial_year=d.financial_year,
                revision_id=d.revision_id,
                title=d.title,
                issued_on=d.issued_on,
                gross_salary=d.gross_salary,
                taxable_income=d.taxable_income,
                tds=d.tds,
                comment=d.comment,
            )
            for d in documents
        ],
    )


def employer_detail(db: Session, employer: Employer, today: date | None = None) -> EmployerDetailOut:
    return _employer_detail(db, employer, today or date.today())


def list_employers(db: Session, user_id: int, today: date | None = None) -> list[EmployerOut]:
    """Current employers first, then past ones; each group by the latest joining date first."""
    today = today or date.today()
    employers = db.scalars(select(Employer).where(Employer.user_id == user_id)).all()
    ordered = sorted(employers, key=lambda e: (not is_current(e, today), -e.joined_on.toordinal(), -e.id))
    out: list[EmployerOut] = []
    for employer in ordered:
        detail = _employer_detail(db, employer, today)
        out.append(EmployerOut(**detail.model_dump(include=set(EmployerOut.model_fields))))
    return out


# Checks


def _check_account(db: Session, user_id: int, account_id: int | None) -> None:
    if account_id is None:
        return
    account = db.get(Account, account_id)
    if account is None or account.user_id != user_id or account.category not in SALARY_CATEGORIES:
        message = "Choose one of your savings or current accounts."
        raise _field_error(422, "validation_failed", "salary_account_id", message)


def _check_dates(joined_on: date, left_on: date | None, first_pay_on: date) -> None:
    if left_on is not None and left_on < joined_on:
        raise _field_error(422, "validation_failed", "left_on", "The leaving date cannot be before the joining date.")
    if first_pay_on < joined_on:
        message = "The first salary cannot be paid before the joining date."
        raise _field_error(422, "validation_failed", "first_pay_on", message)


def _check_effective_from(db: Session, employer: Employer, effective_from: date, revision_id: int | None) -> None:
    if effective_from < employer.joined_on:
        message = "The new pay cannot start before the joining date."
        raise _field_error(422, "validation_failed", "effective_from", message)
    if employer.left_on is not None and effective_from > employer.left_on:
        message = "The new pay cannot start after the leaving date."
        raise _field_error(422, "validation_failed", "effective_from", message)
    clash = db.scalar(
        select(SalaryRevision.id).where(
            SalaryRevision.employer_id == employer.id,
            SalaryRevision.effective_from == effective_from,
            SalaryRevision.id != (revision_id or 0),
        )
    )
    if clash is not None:
        message = "Another pay revision starts on this date. Edit that one instead."
        raise _field_error(409, "revision_date_taken", "effective_from", message)


# Components and lines


def _next_order(db: Session, employer_id: int, kind: str) -> int:
    last = db.scalar(
        select(func.max(SalaryComponent.display_order)).where(
            SalaryComponent.employer_id == employer_id, SalaryComponent.kind == kind
        )
    )
    return 0 if last is None else last + 1


def _component_by_name(db: Session, employer_id: int, name: str) -> SalaryComponent | None:
    return db.scalar(
        select(SalaryComponent).where(
            SalaryComponent.employer_id == employer_id, func.lower(SalaryComponent.name) == name.lower()
        )
    )


def _add_component(db: Session, employer: Employer, name: str, kind: ComponentKind) -> SalaryComponent:
    component = SalaryComponent(
        user_id=employer.user_id,
        employer_id=employer.id,
        name=name,
        kind=kind,
        display_order=_next_order(db, employer.id, kind),
    )
    db.add(component)
    db.flush()
    return component


def _set_lines(db: Session, employer: Employer, revision: SalaryRevision, lines: list[LineIn]) -> None:
    """Replace the revision's amounts. New components are added to the employer; a known name is reused."""
    resolved: dict[int, int] = {}
    for line in lines:
        if line.component_id is not None:
            component = db.get(SalaryComponent, line.component_id)
            if component is None or component.employer_id != employer.id:
                raise _field_error(422, "validation_failed", "lines", "A component does not belong to this employer.")
        else:
            assert line.name is not None and line.kind is not None  # noqa: S101 - checked by LineIn
            component = _component_by_name(db, employer.id, line.name) or _add_component(
                db, employer, line.name, line.kind
            )
        if component.id in resolved:
            raise _field_error(422, "validation_failed", "lines", "Each component can appear only once.")
        resolved[component.id] = line.yearly_amount
    db.execute(delete(SalaryRevisionLine).where(SalaryRevisionLine.revision_id == revision.id))
    for component_id, amount in resolved.items():
        db.add(SalaryRevisionLine(revision_id=revision.id, component_id=component_id, yearly_amount=amount))


# Employers


def create_employer(db: Session, user_id: int, data: EmployerIn) -> Employer:
    """The onboarding form: the employer, its components and the joining revision, together."""
    first_pay_on = data.first_pay_on or first_pay_date(data.joined_on, data.pay_day)
    _check_dates(data.joined_on, data.left_on, first_pay_on)
    _check_account(db, user_id, data.salary_account_id)
    employer = Employer(
        user_id=user_id,
        name=data.name,
        employee_code=data.employee_code,
        joined_on=data.joined_on,
        left_on=data.left_on,
        first_pay_on=first_pay_on,
        pay_day=data.pay_day,
        salary_account_id=data.salary_account_id,
        uan=data.uan,
        comment=data.comment,
    )
    db.add(employer)
    db.flush()
    revision = SalaryRevision(
        user_id=user_id,
        employer_id=employer.id,
        kind=RevisionKind.JOINING,
        effective_from=data.joined_on,
        designation=data.designation,
        comment="",
    )
    db.add(revision)
    db.flush()
    _set_lines(db, employer, revision, data.lines)
    db.commit()
    return employer


def _joining_revision(db: Session, employer_id: int) -> SalaryRevision | None:
    return db.scalar(
        select(SalaryRevision).where(
            SalaryRevision.employer_id == employer_id, SalaryRevision.kind == RevisionKind.JOINING
        )
    )


def update_employer(db: Session, employer: Employer, data: EmployerUpdate) -> Employer:
    changes = data.changes()
    if "salary_account_id" in changes:
        _check_account(db, employer.user_id, data.salary_account_id)
    joined_on = changes.get("joined_on", employer.joined_on)
    left_on = changes.get("left_on", employer.left_on)
    first_pay_on = changes.get("first_pay_on", employer.first_pay_on)
    assert isinstance(joined_on, date) and isinstance(first_pay_on, date)  # noqa: S101 - not_null
    _check_dates(joined_on, left_on if isinstance(left_on, date) else None, first_pay_on)

    # The joining offer starts on the joining date, so it moves with it.
    joining = _joining_revision(db, employer.id)
    if joining is not None and joined_on != employer.joined_on:
        joining.effective_from = joined_on
    for revision in _revisions(db, employer.id):
        if revision is joining:
            continue
        if revision.effective_from <= joined_on or (isinstance(left_on, date) and revision.effective_from > left_on):
            message = "A pay revision falls outside these dates. Change or delete it first."
            field = "joined_on" if revision.effective_from <= joined_on else "left_on"
            raise _field_error(422, "validation_failed", field, message)
    for name, value in changes.items():
        setattr(employer, name, value)
    db.commit()
    return employer


def _delete_payslips(db: Session, user_id: int, payslip_ids: list[int]) -> None:
    for payslip_id in payslip_ids:
        delete_about(db, user_id, f"payslip:{payslip_id}")
    if payslip_ids:
        db.execute(delete(PayslipLine).where(PayslipLine.payslip_id.in_(payslip_ids)))
        db.execute(delete(Payslip).where(Payslip.id.in_(payslip_ids)))


def delete_employer(db: Session, employer: Employer) -> None:
    """Refused while it has approved payslips: their transactions are in the ledger."""
    posted = db.scalar(
        select(exists().where(Payslip.employer_id == employer.id, Payslip.status == PayslipStatus.POSTED))
    )
    if posted:
        message = "This employer has approved payslips. Delete them first; that removes their transactions too."
        raise ApiError(409, "employer_in_use", message)
    payslip_ids = list(db.scalars(select(Payslip.id).where(Payslip.employer_id == employer.id)).all())
    _delete_payslips(db, employer.user_id, payslip_ids)
    revision_ids = select(SalaryRevision.id).where(SalaryRevision.employer_id == employer.id)
    db.execute(delete(SalaryRevisionLine).where(SalaryRevisionLine.revision_id.in_(revision_ids)))
    db.execute(delete(EmployerDocument).where(EmployerDocument.employer_id == employer.id))
    db.execute(delete(SalaryRevision).where(SalaryRevision.employer_id == employer.id))
    db.execute(delete(SalaryComponent).where(SalaryComponent.employer_id == employer.id))
    db.delete(employer)
    db.commit()


def delete_salary_data(db: Session, user_id: int) -> None:
    """Every employer of the user and all that hangs off them. The caller commits."""
    _delete_payslips(db, user_id, list(db.scalars(select(Payslip.id).where(Payslip.user_id == user_id)).all()))
    revision_ids = select(SalaryRevision.id).where(SalaryRevision.user_id == user_id)
    db.execute(delete(SalaryRevisionLine).where(SalaryRevisionLine.revision_id.in_(revision_ids)))
    for model in (EmployerDocument, SalaryRevision, SalaryComponent, Employer):
        db.execute(delete(model).where(model.user_id == user_id))


# Components


def _get_component(db: Session, employer: Employer, component_id: int) -> SalaryComponent:
    component = db.get(SalaryComponent, component_id)
    if component is None or component.employer_id != employer.id:
        raise ApiError(404, "component_not_found", "This salary component does not exist.")
    return component


def _check_name_free(db: Session, employer: Employer, name: str, component_id: int | None = None) -> None:
    found = _component_by_name(db, employer.id, name)
    if found is not None and found.id != component_id:
        raise _field_error(409, "component_exists", "name", "This employer already has a component with this name.")


def add_component(db: Session, employer: Employer, data: ComponentIn) -> None:
    _check_name_free(db, employer, data.name)
    _add_component(db, employer, data.name, data.kind)
    db.commit()


def update_component(db: Session, employer: Employer, component_id: int, data: ComponentUpdate) -> None:
    component = _get_component(db, employer, component_id)
    if data.name is not None:
        _check_name_free(db, employer, data.name, component.id)
        component.name = data.name
    if data.kind is not None and data.kind != component.kind:
        component.display_order = _next_order(db, employer.id, data.kind)
        component.kind = data.kind
    db.commit()


def delete_component(db: Session, employer: Employer, component_id: int) -> None:
    """Removes the component from every revision and draft payslip too. Refused while an approved payslip has it."""
    component = _get_component(db, employer, component_id)
    on_posted = db.scalar(
        select(
            exists().where(
                PayslipLine.component_id == component.id,
                PayslipLine.payslip_id == Payslip.id,
                Payslip.status == PayslipStatus.POSTED,
            )
        )
    )
    if on_posted:
        message = "Approved payslips have this component, so it cannot be deleted. Rename it, or leave it at zero."
        raise ApiError(409, "component_in_use", message)
    db.execute(delete(PayslipLine).where(PayslipLine.component_id == component.id))
    db.execute(delete(SalaryRevisionLine).where(SalaryRevisionLine.component_id == component.id))
    db.delete(component)
    db.commit()


# Revisions


def _get_revision(db: Session, employer: Employer, revision_id: int) -> SalaryRevision:
    revision = db.get(SalaryRevision, revision_id)
    if revision is None or revision.employer_id != employer.id:
        raise ApiError(404, "revision_not_found", "This pay revision does not exist.")
    return revision


def add_revision(db: Session, employer: Employer, data: RevisionIn) -> None:
    _check_effective_from(db, employer, data.effective_from, None)
    if data.effective_from == employer.joined_on:
        message = "The joining offer starts on the joining date. Edit it instead."
        raise _field_error(409, "revision_date_taken", "effective_from", message)
    revision = SalaryRevision(
        user_id=employer.user_id,
        employer_id=employer.id,
        kind=data.kind,
        announced_on=data.announced_on,
        effective_from=data.effective_from,
        designation=data.designation,
        comment=data.comment,
    )
    db.add(revision)
    db.flush()
    _set_lines(db, employer, revision, data.lines)
    db.commit()


def update_revision(db: Session, employer: Employer, revision_id: int, data: RevisionUpdate) -> None:
    revision = _get_revision(db, employer, revision_id)
    changes = data.changes()
    new_date = changes.get("effective_from")
    if isinstance(new_date, date) and new_date != revision.effective_from:
        if revision.kind == RevisionKind.JOINING:
            message = "The joining offer starts on the joining date. Change the joining date instead."
            raise _field_error(422, "validation_failed", "effective_from", message)
        _check_effective_from(db, employer, new_date, revision.id)
        if new_date == employer.joined_on:
            message = "The joining offer starts on the joining date. Edit it instead."
            raise _field_error(409, "revision_date_taken", "effective_from", message)
        revision.effective_from = new_date
    for name in ("announced_on", "designation", "comment"):
        if name in changes:
            setattr(revision, name, changes[name])
    if data.lines is not None:
        _set_lines(db, employer, revision, data.lines)
    db.commit()


def delete_revision(db: Session, employer: Employer, revision_id: int) -> None:
    revision = _get_revision(db, employer, revision_id)
    if revision.kind == RevisionKind.JOINING:
        raise ApiError(409, "revision_in_use", "The joining offer cannot be deleted. Edit it, or delete the employer.")
    db.execute(delete(SalaryRevisionLine).where(SalaryRevisionLine.revision_id == revision.id))
    db.execute(update(EmployerDocument).where(EmployerDocument.revision_id == revision.id).values(revision_id=None))
    db.execute(update(Payslip).where(Payslip.revision_id == revision.id).values(revision_id=None))
    db.delete(revision)
    db.commit()


# Documents


def _check_document(db: Session, employer: Employer, data: DocumentIn) -> None:
    if data.revision_id is not None:
        _get_revision(db, employer, data.revision_id)


def add_document(db: Session, employer: Employer, data: DocumentIn) -> None:
    _check_document(db, employer, data)
    db.add(EmployerDocument(user_id=employer.user_id, employer_id=employer.id, **data.model_dump()))
    db.commit()


def replace_document(db: Session, employer: Employer, document_id: int, data: DocumentIn) -> None:
    document = _get_document(db, employer, document_id)
    _check_document(db, employer, data)
    for name, value in data.model_dump().items():
        setattr(document, name, value)
    db.commit()


def _get_document(db: Session, employer: Employer, document_id: int) -> EmployerDocument:
    document = db.get(EmployerDocument, document_id)
    if document is None or document.employer_id != employer.id:
        raise ApiError(404, "document_not_found", "This document does not exist.")
    return document


def delete_document(db: Session, employer: Employer, document_id: int) -> None:
    db.delete(_get_document(db, employer, document_id))
    db.commit()
