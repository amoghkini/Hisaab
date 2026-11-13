from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.accounts.models import Account
from app.auth.models import User
from app.categories.models import Category
from app.data.schemas import DataStatsOut
from app.transactions.models import Transaction


def _count(db: Session, model: type[Account] | type[Category] | type[Transaction], user_id: int) -> int:
    return db.scalar(select(func.count()).select_from(model).where(model.user_id == user_id)) or 0


def data_stats(db: Session, user_id: int) -> DataStatsOut:
    first, last = db.execute(
        select(func.min(Transaction.occurred_at), func.max(Transaction.occurred_at)).where(
            Transaction.user_id == user_id
        )
    ).one()
    return DataStatsOut(
        accounts=_count(db, Account, user_id),
        categories=_count(db, Category, user_id),
        transactions=_count(db, Transaction, user_id),
        first_transaction_on=first.date() if first else None,
        last_transaction_on=last.date() if last else None,
    )


def clear_data(db: Session, user: User, everything: bool) -> None:
    """Delete every transaction, and with `everything` the accounts and categories too. The caller commits."""
    db.execute(delete(Transaction).where(Transaction.user_id == user.id))
    if everything:
        db.execute(delete(Account).where(Account.user_id == user.id))
        # Sub-categories first, so a database that enforces the parent link never sees an orphan.
        db.execute(delete(Category).where(Category.user_id == user.id, Category.parent_id.is_not(None)))
        db.execute(delete(Category).where(Category.user_id == user.id))
        user.default_account_id = None
        user.salary_account_id = None
