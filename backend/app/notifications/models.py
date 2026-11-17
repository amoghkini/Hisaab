from datetime import datetime
from enum import StrEnum

from sqlalchemy import DateTime, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base, utcnow


class NotificationKind(StrEnum):
    """Checked by the API, not a CHECK constraint, so a new kind needs no migration."""

    PAYSLIP_DRAFT = "payslip_draft"  # a payslip was drafted on its pay day and waits for approval


class Notification(Base):
    """Something in the app that wants the user's attention, shown under the bell in the top bar."""

    __tablename__ = "notifications"
    __table_args__ = (Index("ix_notifications_user_id_created_at", "user_id", "created_at"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    kind: Mapped[str] = mapped_column(String(32))  # a NotificationKind
    title: Mapped[str] = mapped_column(String(200))
    link: Mapped[str] = mapped_column(String(255))  # the page that deals with it, such as "/salary/payslips/12"
    # What it is about, such as "payslip:12", so dealing with that thing elsewhere marks it read.
    payload_ref: Mapped[str | None] = mapped_column(String(64), index=True)
    read_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
