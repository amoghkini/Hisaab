from datetime import date
from typing import Annotated

from fastapi import APIRouter, Query

from app.auth.deps import DB, CurrentUser
from app.overview.schemas import DailyAmountOut, ExpenseRankingOut, MonthlyAmountOut, PeriodTotalsOut
from app.overview.service import daily_amounts, expense_ranking, monthly_amounts, period_totals

# The dashboard's data. The page works out the dates (today, this week, ...) in the user's time zone and sends them.
router = APIRouter(prefix="/api/v1/overview", tags=["overview"])

Month = Annotated[str, Query(pattern=r"^\d{4}-\d{2}$", description='"YYYY-MM"')]


@router.get("/totals")
def totals_route(user: CurrentUser, db: DB, start: date, end: date) -> PeriodTotalsOut:
    """Income and expense from `start` to `end` (inclusive), in the default currency."""
    return period_totals(db, user, start, end)


@router.get("/daily-amounts")
def daily_route(user: CurrentUser, db: DB, start: date, end: date) -> list[DailyAmountOut]:
    """Income and expense for each day that has any, oldest first."""
    return daily_amounts(db, user, start, end)


@router.get("/monthly-amounts")
def monthly_route(user: CurrentUser, db: DB, start_month: Month, end_month: Month) -> list[MonthlyAmountOut]:
    """Income and expense for every month in the range, oldest first, empty months included."""
    return monthly_amounts(db, user, start_month, end_month)


@router.get("/expense-ranking")
def ranking_route(
    user: CurrentUser, db: DB, start: date, end: date, limit: Annotated[int, Query(ge=1, le=50)] = 10
) -> ExpenseRankingOut:
    """The top-level expense categories by amount, largest first, with each one's share of all expense."""
    return expense_ranking(db, user, start, end, limit)
