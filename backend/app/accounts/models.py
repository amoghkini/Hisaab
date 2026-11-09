from datetime import date, datetime
from enum import StrEnum

from sqlalchemy import BigInteger, Boolean, CheckConstraint, Date, DateTime, ForeignKey, Integer, SmallInteger, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base, utcnow


class AccountCategory(StrEnum):
    """The kinds of account, in the order the accounts page lists them. Based on ezBookkeeping's, named for India."""

    CASH = "cash"
    SAVINGS = "savings"
    CURRENT = "current"  # ezBookkeeping's "Checking Account"
    CREDIT_CARD = "credit_card"
    WALLET = "wallet"  # ezBookkeeping's "Virtual Account": Paytm, Amazon Pay, UPI Lite and the like
    LOAN = "loan"  # ezBookkeeping's "Debt Account"
    RECEIVABLE = "receivable"
    FIXED_DEPOSIT = "fixed_deposit"  # ezBookkeeping's "Certificate of Deposit"
    INVESTMENT = "investment"


CATEGORY_ORDER = list(AccountCategory)

# What the user owes, rather than owns. Their balances are negative when money is owed.
LIABILITY_CATEGORIES = frozenset({AccountCategory.CREDIT_CARD, AccountCategory.LOAN})

_CATEGORY_VALUES = ", ".join(f"'{category}'" for category in AccountCategory)


class Account(Base):
    """Somewhere money is kept or owed: a bank account, a card, a wallet, cash in hand."""

    __tablename__ = "accounts"
    __table_args__ = (CheckConstraint(f"category IN ({_CATEGORY_VALUES})", name="ck_accounts_category"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    category: Mapped[str] = mapped_column(String(16))
    name: Mapped[str] = mapped_column(String(64))
    icon: Mapped[str] = mapped_column(String(64))  # a Material Design Icons name, such as "bank"
    color: Mapped[str | None] = mapped_column(String(7))  # "#rrggbb"; None draws in the text colour
    currency: Mapped[str] = mapped_column(String(3))  # ISO 4217
    # The balance before any transaction in Hisaab, in the currency's smallest unit. Negative is money owed.
    opening_balance: Mapped[int] = mapped_column(BigInteger, default=0)
    opening_balance_date: Mapped[date | None] = mapped_column(Date)
    # The last digits of the account or card number, as bank SMS show them ("A/c XX1234"), to match SMS to it.
    number_suffix: Mapped[str | None] = mapped_column(String(6))
    credit_limit: Mapped[int | None] = mapped_column(BigInteger)  # credit cards only
    statement_day: Mapped[int | None] = mapped_column(SmallInteger)  # credit cards only: 1 ... 31
    comment: Mapped[str] = mapped_column(String(255), default="")
    hidden: Mapped[bool] = mapped_column(Boolean, default=False)
    include_in_total: Mapped[bool] = mapped_column(Boolean, default=True)
    display_order: Mapped[int] = mapped_column(Integer)  # within its category
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)
