from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, SmallInteger, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base, utcnow

# Defaults for a new account, chosen for India: rupees, weeks from Sunday, spending in red and earning in green.
DEFAULT_CURRENCY = "INR"
DEFAULT_FIRST_DAY_OF_WEEK = 0  # 0 is Sunday ... 6 is Saturday
DEFAULT_EXPENSE_AMOUNT_COLOR = "red"
DEFAULT_INCOME_AMOUNT_COLOR = "green"
DEFAULT_THEME_MODE = "system"  # follow the device; or "light" / "dark"
DEFAULT_FISCAL_YEAR_START_MONTH = 4  # India's financial year starts in April
DEFAULT_DIGIT_GROUPING = "indian"  # 1,00,000; or "international" (100,000) / "none"
DEFAULT_CURRENCY_DISPLAY = "symbol"  # the rupee sign; or "code" (INR) / "none"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(254), unique=True, index=True)  # stored in lower case
    password_hash: Mapped[str] = mapped_column(String(255))
    theme_color: Mapped[str | None] = mapped_column(String(7), default=None)  # "#rrggbb"; None is the default
    theme_mode: Mapped[str] = mapped_column(String(8), default=DEFAULT_THEME_MODE, server_default=DEFAULT_THEME_MODE)
    default_currency: Mapped[str] = mapped_column(String(3), default=DEFAULT_CURRENCY, server_default=DEFAULT_CURRENCY)
    first_day_of_week: Mapped[int] = mapped_column(
        SmallInteger, default=DEFAULT_FIRST_DAY_OF_WEEK, server_default=str(DEFAULT_FIRST_DAY_OF_WEEK)
    )
    expense_amount_color: Mapped[str] = mapped_column(
        String(16), default=DEFAULT_EXPENSE_AMOUNT_COLOR, server_default=DEFAULT_EXPENSE_AMOUNT_COLOR
    )
    income_amount_color: Mapped[str] = mapped_column(
        String(16), default=DEFAULT_INCOME_AMOUNT_COLOR, server_default=DEFAULT_INCOME_AMOUNT_COLOR
    )
    # The account new transactions start on. No foreign key: SQLite here does not enforce them, so deleting an
    # account clears it in code (app.accounts.service.delete_account).
    default_account_id: Mapped[int | None] = mapped_column(Integer, default=None)
    # The savings or current account the salary is paid into. Cleared in code like default_account_id, and also
    # when the account stops being a savings or current account.
    salary_account_id: Mapped[int | None] = mapped_column(Integer, default=None)
    fiscal_year_start_month: Mapped[int] = mapped_column(
        SmallInteger, default=DEFAULT_FISCAL_YEAR_START_MONTH, server_default=str(DEFAULT_FISCAL_YEAR_START_MONTH)
    )  # 1 is January ... 12 is December
    digit_grouping: Mapped[str] = mapped_column(
        String(16), default=DEFAULT_DIGIT_GROUPING, server_default=DEFAULT_DIGIT_GROUPING
    )
    currency_display: Mapped[str] = mapped_column(
        String(8), default=DEFAULT_CURRENCY_DISPLAY, server_default=DEFAULT_CURRENCY_DISPLAY
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class AuthSession(Base):
    """One signed-in browser or device. Only the SHA-256 of its token is stored."""

    __tablename__ = "auth_sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    # What signed in (the browser's User-Agent) and when it was last used, for the security settings page.
    user_agent: Mapped[str] = mapped_column(String(255), default="", server_default="")
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime, default=utcnow)
