from datetime import datetime
from enum import StrEnum

from sqlalchemy import BigInteger, CheckConstraint, DateTime, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base, utcnow


class TransactionType(StrEnum):
    """ezBookkeeping's transaction types, less "modify balance": an account's opening balance does that job."""

    EXPENSE = "expense"
    INCOME = "income"
    TRANSFER = "transfer"


class Transaction(Base):
    """Money out of an account (expense), into one (income), or from one account to another (transfer)."""

    __tablename__ = "transactions"
    __table_args__ = (
        CheckConstraint("type IN ('expense', 'income', 'transfer')", name="ck_transactions_type"),
        CheckConstraint("amount > 0", name="ck_transactions_amount_positive"),
        Index("ix_transactions_user_id_occurred_at", "user_id", "occurred_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    type: Mapped[str] = mapped_column(String(10))
    # The user's local date and time, as they entered it; the dashboard counts days in the user's time zone.
    occurred_at: Mapped[datetime] = mapped_column(DateTime)
    # Required for expense and income; optional for a transfer.
    category_id: Mapped[int | None] = mapped_column(ForeignKey("categories.id", ondelete="SET NULL"), index=True)
    # The account money leaves (expense, transfer) or enters (income). Accounts with transactions cannot be deleted.
    account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id", ondelete="RESTRICT"), index=True)
    # In the smallest unit of the account's currency. Always positive; the type gives the direction.
    amount: Mapped[int] = mapped_column(BigInteger)
    # Transfers only: where the money goes, and how much arrives there (different when the currencies differ).
    to_account_id: Mapped[int | None] = mapped_column(ForeignKey("accounts.id", ondelete="RESTRICT"), index=True)
    to_amount: Mapped[int | None] = mapped_column(BigInteger)
    comment: Mapped[str] = mapped_column(String(255), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)
