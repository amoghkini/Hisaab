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


class TransactionSource(StrEnum):
    """What created a transaction. Only "manual" exists today; the others are for the planned sections
    (see docs/content/architecture.md) and are allowed now so adding them needs no migration."""

    MANUAL = "manual"
    SMS = "sms"  # approved from a parsed bank SMS
    SALARY = "salary"  # posted from a payslip
    EPFO = "epfo"  # imported from the EPFO passbook
    SCHEDULE = "schedule"  # made by a recurring schedule: RD instalment, SIP, loan EMI


_SOURCE_VALUES = ", ".join(f"'{source}'" for source in TransactionSource)


class Transaction(Base):
    """Money out of an account (expense), into one (income), or from one account to another (transfer)."""

    __tablename__ = "transactions"
    __table_args__ = (
        CheckConstraint("type IN ('expense', 'income', 'transfer')", name="ck_transactions_type"),
        CheckConstraint("amount > 0", name="ck_transactions_amount_positive"),
        CheckConstraint(f"source IN ({_SOURCE_VALUES})", name="ck_transactions_source"),
        Index("ix_transactions_user_id_occurred_at", "user_id", "occurred_at"),
        # An import can run again without adding the same entry twice. NULL source_refs never clash.
        Index("ux_transactions_user_id_source_source_ref", "user_id", "source", "source_ref", unique=True),
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
    source: Mapped[str] = mapped_column(String(16), default=TransactionSource.MANUAL)
    # The entry's id in the source it came from, such as an EPFO passbook line. None for manual entries.
    source_ref: Mapped[str | None] = mapped_column(String(128))
    # Shared by transactions made together, such as the lines of one payslip, so they change or go together.
    group_id: Mapped[str | None] = mapped_column(String(36), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)
