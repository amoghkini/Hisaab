"""The dashboard's numbers, added up from the user's transactions.

Only income and expense count; a transfer moves money between the user's own accounts, so it is neither. Amounts
are in the user's default currency: transactions in accounts of other currencies are left out until exchange
rates exist, the same rule as the account totals. Dates are the user's local dates, as transactions store them.
"""

from collections import defaultdict
from datetime import date, datetime, time, timedelta

from sqlalchemy import Select, select
from sqlalchemy.orm import Session

from app.accounts.models import Account
from app.auth.models import User
from app.categories.models import Category
from app.errors import ApiError
from app.overview.schemas import (
    DailyAmountOut,
    ExpenseRankingOut,
    MonthlyAmountOut,
    PeriodTotalsOut,
    RankedCategoryOut,
)
from app.transactions.models import Transaction, TransactionType

# Enough for the 12-month heatmap (53 whole weeks) and a calendar year.
MAX_DAYS = 400
MAX_MONTHS = 60

UNCATEGORIZED_ICON = "shape-outline"


def _invalid(field: str, message: str) -> ApiError:
    return ApiError(422, "validation_failed", message, [{"field": field, "message": message}])


def check_range(start: date, end: date) -> None:
    if end < start:
        raise _invalid("end", "The end date must not be before the start date.")
    if (end - start).days >= MAX_DAYS:
        raise _invalid("end", f"Choose at most {MAX_DAYS} days.")


def _counted(user: User, start: date, end: date) -> Select:
    """Income and expense from `start` to `end` (inclusive), in accounts of the user's default currency."""
    return (
        select(Transaction.type, Transaction.occurred_at, Transaction.amount, Transaction.category_id)
        .join(Account, Account.id == Transaction.account_id)
        .where(
            Transaction.user_id == user.id,
            Transaction.type.in_([TransactionType.INCOME, TransactionType.EXPENSE]),
            Account.currency == user.default_currency,
            Transaction.occurred_at >= datetime.combine(start, time.min),
            Transaction.occurred_at < datetime.combine(end + timedelta(days=1), time.min),
        )
    )


def period_totals(db: Session, user: User, start: date, end: date) -> PeriodTotalsOut:
    check_range(start, end)
    totals = {TransactionType.INCOME: 0, TransactionType.EXPENSE: 0}
    for kind, _, amount, _ in db.execute(_counted(user, start, end)).all():
        totals[TransactionType(kind)] += amount
    return PeriodTotalsOut(
        start=start, end=end, income=totals[TransactionType.INCOME], expense=totals[TransactionType.EXPENSE]
    )


def _add(totals: dict[str, list[int]], key: str, kind: str, amount: int) -> None:
    pair = totals[key]
    pair[0 if kind == TransactionType.INCOME else 1] += amount


def daily_amounts(db: Session, user: User, start: date, end: date) -> list[DailyAmountOut]:
    """Each day with any income or expense, oldest first. Days with neither are left out."""
    check_range(start, end)
    totals: dict[str, list[int]] = defaultdict(lambda: [0, 0])
    for kind, occurred_at, amount, _ in db.execute(_counted(user, start, end)).all():
        _add(totals, occurred_at.date().isoformat(), kind, amount)
    return [
        DailyAmountOut(date=date.fromisoformat(day), income=income, expense=expense)
        for day, (income, expense) in sorted(totals.items())
    ]


def _parse_month(text: str, field: str) -> date:
    try:
        return date.fromisoformat(f"{text}-01")
    except ValueError:
        raise _invalid(field, 'Use a month like "2026-11".') from None


def _next_month(day: date) -> date:
    return date(day.year + (day.month == 12), day.month % 12 + 1, 1)


def monthly_amounts(db: Session, user: User, start_month: str, end_month: str) -> list[MonthlyAmountOut]:
    """Every month from `start_month` to `end_month` ("YYYY-MM", inclusive), oldest first, empty months too."""
    first = _parse_month(start_month, "start_month")
    last = _parse_month(end_month, "end_month")
    if last < first:
        raise _invalid("end_month", "The end month must not be before the start month.")
    months: list[date] = []
    day = first
    while day <= last:
        months.append(day)
        day = _next_month(day)
    if len(months) > MAX_MONTHS:
        raise _invalid("end_month", f"Choose at most {MAX_MONTHS} months.")

    totals: dict[str, list[int]] = defaultdict(lambda: [0, 0])
    for kind, occurred_at, amount, _ in db.execute(_counted(user, first, _next_month(last) - timedelta(days=1))).all():
        _add(totals, occurred_at.strftime("%Y-%m"), kind, amount)
    return [
        MonthlyAmountOut(month=month.strftime("%Y-%m"), income=totals[key][0], expense=totals[key][1])
        for month in months
        for key in [month.strftime("%Y-%m")]
    ]


def _top_level(categories: dict[int, Category], category_id: int | None) -> Category | None:
    category = categories.get(category_id) if category_id is not None else None
    if category is not None and category.parent_id is not None:
        return categories.get(category.parent_id, category)
    return category


def expense_ranking(db: Session, user: User, start: date, end: date, limit: int) -> ExpenseRankingOut:
    """The top-level expense categories by amount spent (sub-categories add up into their group), largest first."""
    check_range(start, end)
    rows = db.execute(_counted(user, start, end).where(Transaction.type == TransactionType.EXPENSE)).all()
    categories = {category.id: category for category in db.scalars(select(Category).where(Category.user_id == user.id))}

    by_group: dict[int, int] = defaultdict(int)
    for _, _, amount, category_id in rows:
        group = _top_level(categories, category_id)
        by_group[group.id if group else 0] += amount
    total = sum(by_group.values())

    items: list[RankedCategoryOut] = []
    for group_id, amount in sorted(by_group.items(), key=lambda item: (-item[1], item[0]))[:limit]:
        group = categories.get(group_id)
        items.append(
            RankedCategoryOut(
                category_id=group_id,
                name=group.name if group else "Uncategorized",
                icon=group.icon if group else UNCATEGORIZED_ICON,
                color=group.color if group else None,
                amount=amount,
                percent=amount * 100 / total if total else 0,
            )
        )
    return ExpenseRankingOut(start=start, end=end, total=total, items=items)
