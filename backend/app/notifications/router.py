from fastapi import APIRouter, Response, status

from app.auth.deps import DB, CurrentUser
from app.notifications.schemas import NotificationListOut
from app.notifications.service import list_notifications, read_all, read_one

router = APIRouter(prefix="/api/v1/notifications", tags=["notifications"])


@router.get("")
def list_route(user: CurrentUser, db: DB) -> NotificationListOut:
    return list_notifications(db, user.id)


@router.post("/read", status_code=status.HTTP_204_NO_CONTENT)
def read_all_route(user: CurrentUser, db: DB) -> Response:
    read_all(db, user.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{notification_id}/read", status_code=status.HTTP_204_NO_CONTENT)
def read_route(notification_id: int, user: CurrentUser, db: DB) -> Response:
    read_one(db, user.id, notification_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
