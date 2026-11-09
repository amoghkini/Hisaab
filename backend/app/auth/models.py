from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, SmallInteger, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base, utcnow

# Defaults for a new account, chosen for India: rupees, weeks from Sunday, spending in red and earning in green.
DEFAULT_CURRENCY = "INR"
DEFAULT_FIRST_DAY_OF_WEEK = 0  # 0 is Sunday ... 6 is Saturday
DEFAULT_EXPENSE_AMOUNT_COLOR = "red"
DEFAULT_INCOME_AMOUNT_COLOR = "green"
DEFAULT_THEME_MODE = "system"  # follow the device; or "light" / "dark"


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
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class AuthSession(Base):
    """One signed-in browser or device. Only the SHA-256 of its token is stored."""

    __tablename__ = "auth_sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime)
