from sqlalchemy import delete, func, select, update
from sqlalchemy.orm import Session

from app.db import utcnow
from app.errors import ApiError
from app.notifications.models import Notification, NotificationKind
from app.notifications.schemas import NotificationListOut, NotificationOut

LIST_LIMIT = 50


def notify(db: Session, user_id: int, kind: NotificationKind, title: str, link: str, payload_ref: str | None) -> None:
    """Add a notification. The caller commits."""
    db.add(Notification(user_id=user_id, kind=kind, title=title, link=link, payload_ref=payload_ref))


def mark_read_about(db: Session, user_id: int, payload_ref: str) -> None:
    """The thing was dealt with: its notifications are read. The caller commits."""
    db.execute(
        update(Notification)
        .where(Notification.user_id == user_id, Notification.payload_ref == payload_ref, Notification.read_at.is_(None))
        .values(read_at=utcnow())
    )


def delete_about(db: Session, user_id: int, payload_ref: str) -> None:
    """The thing is gone. The caller commits."""
    db.execute(delete(Notification).where(Notification.user_id == user_id, Notification.payload_ref == payload_ref))


def delete_all(db: Session, user_id: int) -> None:
    db.execute(delete(Notification).where(Notification.user_id == user_id))


def list_notifications(db: Session, user_id: int) -> NotificationListOut:
    items = db.scalars(
        select(Notification)
        .where(Notification.user_id == user_id)
        .order_by(Notification.created_at.desc(), Notification.id.desc())
        .limit(LIST_LIMIT)
    ).all()
    unread = db.scalar(select(func.count()).where(Notification.user_id == user_id, Notification.read_at.is_(None)))
    return NotificationListOut(
        items=[
            NotificationOut(
                id=item.id,
                kind=NotificationKind(item.kind),
                title=item.title,
                link=item.link,
                read=item.read_at is not None,
                created_at=item.created_at,
            )
            for item in items
        ],
        unread_count=unread or 0,
    )


def read_one(db: Session, user_id: int, notification_id: int) -> None:
    item = db.get(Notification, notification_id)
    if item is None or item.user_id != user_id:
        raise ApiError(404, "notification_not_found", "This notification does not exist.")
    if item.read_at is None:
        item.read_at = utcnow()
    db.commit()


def read_all(db: Session, user_id: int) -> None:
    db.execute(
        update(Notification)
        .where(Notification.user_id == user_id, Notification.read_at.is_(None))
        .values(read_at=utcnow())
    )
    db.commit()
