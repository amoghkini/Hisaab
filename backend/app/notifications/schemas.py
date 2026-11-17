from datetime import datetime

from pydantic import BaseModel, Field

from app.notifications.models import NotificationKind


class NotificationOut(BaseModel):
    id: int
    kind: NotificationKind
    title: str
    link: str = Field(description="The page that deals with it.")
    read: bool
    created_at: datetime


class NotificationListOut(BaseModel):
    items: list[NotificationOut] = Field(description="The latest 50, newest first.")
    unread_count: int = Field(description="Unread notifications, including any not in `items`.")
