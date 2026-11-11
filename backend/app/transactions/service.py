from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta

from sqlalchemy import case, exists, func, or_, select
from sqlalchemy.orm import Session

from app.accounts.models import Account
from app.auth.models import User
from app.categories.models import Category
from app.errors import ApiError
from app.transactions.models import Transaction, TransactionType
from app.transactions.schemas import DailyTotalsOut, DayTotalOut, TransactionIn, TransactionListOut, TransactionOut

# A list covers at most this many days, so one call stays small. The page asks for a month at a time.
MAX_RANGE_DAYS = 366

# Amount filters, like ezBookkeeping's: "gt:50000" is more than 500.00; "bt:100:900" is between, inclusive.
AMOUNT_FILTER_PATTERN = r"^(gt|lt|eq|ne):\d{1,16}$|^(bt|nb):\d{1,16}:\d{1,16}$"


def _amount_condition(amount: str):  # noqa: ANN202 - an SQL expression
    """The SQL condition for an amount filter that already matched AMOUNT_FILTER_PATTERN."""
    op, *values = amount.split(":")
    first = int(values[0])
    if op == "gt":
        return Transaction.amount > first
    if op == "lt":
        return Transaction.amount < first
    if op == "eq":
        return Transaction.amount == first
    if op == "ne":
        return Transaction.amount != first
    low, high = sorted((first, int(values[1])))
    between = Transaction.amount.between(low, high)
    return between if op == "bt" else ~between


def _invalid(field: str, message: str) -> ApiError:
    return ApiError(422, "validation_failed", message, [{"field": field, "message": message}])


def _own_account(db: Session, user_id: int, account_id: int, field: str) -> Account:
    account = db.get(Account, account_id)
    if account is None or account.user_id != user_id:
        raise _invalid(field, "Choose one of your accounts.")
    return account


def _own_category(db: Session, user_id: int, category_id: int, kind: TransactionType) -> Category:
    category = db.get(Category, category_id)
    if category is None or category.user_id != user_id:
        raise _invalid("category_id", "Choose one of your categories.")
    if category.type != kind:
        article = "a" if kind == TransactionType.TRANSFER else "an"
        raise _invalid("category_id", f"Choose {article} {kind} category.")
    # Like ezBookkeeping: a category with sub-categories is a group; the transaction goes in one of them.
    if db.scalar(select(exists().where(Category.parent_id == category.id))):
        raise _invalid("category_id", "Choose a sub-category.")
    return category


def _apply(db: Session, user_id: int, data: TransactionIn, transaction: Transaction) -> None:
    """Check the input against the user's accounts and categories, and copy it onto the transaction."""
    account = _own_account(db, user_id, data.account_id, "account_id")
    kind = data.type

    if kind == TransactionType.TRANSFER:
        if data.to_account_id is None:
            raise _invalid("to_account_id", "Choose the account the money goes to.")
        if data.to_account_id == data.account_id:
            raise _invalid("to_account_id", "Choose a different account to transfer to.")
        to_account = _own_account(db, user_id, data.to_account_id, "to_account_id")
        if to_account.currency == account.currency:
            to_amount = data.amount  # nothing is lost in a same-currency transfer
        elif data.to_amount is None:
            raise _invalid("to_amount", f"Enter how much arrives in {to_account.currency}.")
        else:
            to_amount = data.to_amount
        category_id = data.category_id
        to_account_id: int | None = to_account.id
    else:
        if data.category_id is None:
            raise _invalid("category_id", "Choose a category.")
        category_id = data.category_id
        to_account_id = None
        to_amount = None

    if category_id is not None:
        _own_category(db, user_id, category_id, kind)

    transaction.type = kind
    transaction.occurred_at = data.occurred_at
    transaction.category_id = category_id
    transaction.account_id = account.id
    transaction.amount = data.amount
    transaction.to_account_id = to_account_id
    transaction.to_amount = to_amount
    transaction.comment = data.comment


def get_transaction(db: Session, user_id: int, transaction_id: int) -> Transaction:
    transaction = db.get(Transaction, transaction_id)
    if transaction is None or transaction.user_id != user_id:
        raise ApiError(404, "transaction_not_found", "This transaction does not exist.")
    return transaction


def create_transaction(db: Session, user_id: int, data: TransactionIn) -> Transaction:
    transaction = Transaction(user_id=user_id)
    _apply(db, user_id, data, transaction)
    db.add(transaction)
    db.commit()
    return transaction


def replace_transaction(db: Session, transaction: Transaction, data: TransactionIn) -> Transaction:
    _apply(db, transaction.user_id, data, transaction)
    db.commit()
    return transaction


def delete_transaction(db: Session, transaction: Transaction) -> None:
    db.delete(transaction)
    db.commit()


@dataclass(frozen=True)
class ListFilters:
    """What a list or its daily totals match: dates (inclusive) and every filter given."""

    start: date
    end: date
    # Several types, accounts or categories match any of them.
    kinds: list[TransactionType] | None = None
    account_ids: list[int] | None = None
    category_ids: list[int] | None = None
    query: str | None = None
    amount: str | None = None


def _matching(db: Session, user: User, filters: ListFilters) -> Sequence[Transaction]:
    """Every transaction that matches, newest first."""
    start, end = filters.start, filters.end
    if end < start:
        raise _invalid("end", "The end date must not be before the start date.")
    if (end - start).days >= MAX_RANGE_DAYS:
        raise _invalid("end", f"Choose at most {MAX_RANGE_DAYS} days.")

    statement = select(Transaction).where(
        Transaction.user_id == user.id,
        Transaction.occurred_at >= datetime.combine(start, time.min),
        Transaction.occurred_at < datetime.combine(end + timedelta(days=1), time.min),
    )
    if filters.kinds:
        statement = statement.where(Transaction.type.in_(filters.kinds))
    if filters.account_ids:
        ids = filters.account_ids
        statement = statement.where(or_(Transaction.account_id.in_(ids), Transaction.to_account_id.in_(ids)))
    if filters.category_ids:
        ids = filters.category_ids
        # A top-level category also matches its sub-categories.
        subs = select(Category.id).where(Category.parent_id.in_(ids), Category.user_id == user.id)
        statement = statement.where(or_(Transaction.category_id.in_(ids), Transaction.category_id.in_(subs)))
    if filters.amount:
        statement = statement.where(_amount_condition(filters.amount))
    if filters.query:
        query = filters.query
        pattern = "%" + query.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
        statement = statement.where(Transaction.comment.ilike(pattern, escape="\\"))

    return db.scalars(statement.order_by(Transaction.occurred_at.desc(), Transaction.id.desc())).all()


def _in_default_currency(db: Session, user: User) -> set[int]:
    """The user's accounts in their default currency: only these are added up, until exchange rates exist."""
    return set(
        db.scalars(select(Account.id).where(Account.user_id == user.id, Account.currency == user.default_currency))
    )


def list_transactions(
    db: Session, user: User, filters: ListFilters, limit: int | None = None, offset: int = 0
) -> TransactionListOut:
    """The matching transactions, newest first. `limit` and `offset` page the items; the count and the totals
    cover every match."""
    rows = _matching(db, user, filters)
    counted = _in_default_currency(db, user)
    income = sum(row.amount for row in rows if row.type == TransactionType.INCOME and row.account_id in counted)
    expense = sum(row.amount for row in rows if row.type == TransactionType.EXPENSE and row.account_id in counted)
    return TransactionListOut(
        start=filters.start,
        end=filters.end,
        items=[TransactionOut.model_validate(row) for row in rows[offset : None if limit is None else offset + limit]],
        total_count=len(rows),
        currency=user.default_currency,
        total_income=income,
        total_expense=expense,
    )


def daily_totals(db: Session, user: User, filters: ListFilters) -> DailyTotalsOut:
    """Each day's income, expense and number of matching transactions, newest day first, over every match.

    A paged list asks for these, so a day split across two pages still shows its whole total.
    """
    counted = _in_default_currency(db, user)
    days: dict[date, DayTotalOut] = {}
    for row in _matching(db, user, filters):
        day = days.setdefault(row.occurred_at.date(), DayTotalOut(day=row.occurred_at.date()))
        day.count += 1
        if row.account_id in counted:
            if row.type == TransactionType.INCOME:
                day.income += row.amount
            elif row.type == TransactionType.EXPENSE:
                day.expense += row.amount
    return DailyTotalsOut(currency=user.default_currency, days=list(days.values()))


def account_has_transactions(db: Session, account_id: int) -> bool:
    return bool(
        db.scalar(
            select(exists().where(or_(Transaction.account_id == account_id, Transaction.to_account_id == account_id)))
        )
    )


def balance_changes(db: Session, user_id: int) -> dict[int, int]:
    """How much each account's balance has moved from its opening balance, by account id."""
    signed = case((Transaction.type == TransactionType.INCOME, Transaction.amount), else_=-Transaction.amount)
    outgoing = db.execute(
        select(Transaction.account_id, func.sum(signed))
        .where(Transaction.user_id == user_id)
        .group_by(Transaction.account_id)
    )
    incoming = db.execute(
        select(Transaction.to_account_id, func.sum(Transaction.to_amount))
        .where(Transaction.user_id == user_id, Transaction.type == TransactionType.TRANSFER)
        .group_by(Transaction.to_account_id)
    )
    changes: dict[int, int] = {}
    for account_id, total in [*outgoing, *incoming]:
        if account_id is not None:
            changes[account_id] = changes.get(account_id, 0) + int(total or 0)
    return changes
