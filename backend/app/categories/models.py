from datetime import datetime
from enum import StrEnum

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Integer, String, false
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base, utcnow


class CategoryType(StrEnum):
    EXPENSE = "expense"
    INCOME = "income"
    TRANSFER = "transfer"


class Category(Base):
    """A transaction category. Top-level categories have no parent; sub-categories have one, of the same type."""

    __tablename__ = "categories"
    __table_args__ = (CheckConstraint("type IN ('expense', 'income', 'transfer')", name="ck_categories_type"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    type: Mapped[str] = mapped_column(String(10))
    parent_id: Mapped[int | None] = mapped_column(ForeignKey("categories.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(64))
    icon: Mapped[str] = mapped_column(String(64))  # a Material Design Icons name, such as "silverware-fork-knife"
    color: Mapped[str | None] = mapped_column(String(7))  # "#rrggbb"; None draws in the text colour
    display_order: Mapped[int] = mapped_column(Integer)
    # Hidden categories stay on their transactions but are not offered for new ones.
    hidden: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
