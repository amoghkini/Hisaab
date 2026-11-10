from fastapi import APIRouter, Response, status

from app.auth.deps import DB, CurrentUser
from app.auth.service import check_password
from app.data.schemas import ClearDataIn, DataStatsOut
from app.data.service import clear_data, data_stats

router = APIRouter(prefix="/api/v1/data", tags=["data"])


@router.get("/stats")
def stats_route(user: CurrentUser, db: DB) -> DataStatsOut:
    """How much the user has stored, and the days their transactions span (for exporting them all)."""
    return data_stats(db, user.id)


@router.post("/clear", status_code=status.HTTP_204_NO_CONTENT)
def clear_route(data: ClearDataIn, user: CurrentUser, db: DB) -> Response:
    """Delete the user's transactions, or all their data. Asks for the password; cannot be undone."""
    check_password(user, data.password)
    clear_data(db, user, everything=data.scope == "all")
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
