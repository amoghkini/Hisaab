from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response, status

from app.auth.deps import DB, CurrentUser
from app.transactions.models import TransactionType
from app.transactions.schemas import DailyTotalsOut, TransactionIn, TransactionListOut, TransactionOut
from app.transactions.service import (
    AMOUNT_FILTER_PATTERN,
    ListFilters,
    create_transaction,
    daily_totals,
    delete_transaction,
    get_transaction,
    list_transactions,
    replace_transaction,
)

router = APIRouter(prefix="/api/v1/transactions", tags=["transactions"])


def list_filters(
    start: date,
    end: date,
    type: Annotated[  # noqa: A002 - the query parameter's name
        list[TransactionType] | None, Query(max_length=3, description="Repeat for any of several")
    ] = None,
    account_id: Annotated[list[int] | None, Query(max_length=100, description="Repeat for any of several")] = None,
    category_id: Annotated[list[int] | None, Query(max_length=200, description="Repeat for any of several")] = None,
    q: Annotated[str | None, Query(max_length=100, description="Text to find in the description")] = None,
    amount: Annotated[
        str | None,
        Query(
            pattern=AMOUNT_FILTER_PATTERN,
            description="In the smallest unit: gt:N, lt:N, eq:N, ne:N, bt:LOW:HIGH (between), nb:LOW:HIGH (not)",
        ),
    ] = None,
) -> ListFilters:
    """The filters the list and its daily totals share. Dates are inclusive, up to 366 days."""
    return ListFilters(start, end, type, account_id, category_id, q.strip() if q else None, amount)


Filters = Annotated[ListFilters, Depends(list_filters)]


@router.get("")
def list_route(
    user: CurrentUser,
    db: DB,
    filters: Filters,
    limit: Annotated[int | None, Query(ge=1, le=1000, description="Items per page; all of them when left out")] = None,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> TransactionListOut:
    """Matching transactions, newest first, with income and expense totals over every match."""
    return list_transactions(db, user, filters, limit, offset)


@router.get("/daily-totals")
def daily_totals_route(user: CurrentUser, db: DB, filters: Filters) -> DailyTotalsOut:
    """Each day's income, expense and count over every match, for a paged list's day headings."""
    return daily_totals(db, user, filters)


@router.post("", status_code=status.HTTP_201_CREATED)
def create_route(data: TransactionIn, user: CurrentUser, db: DB) -> TransactionOut:
    return TransactionOut.model_validate(create_transaction(db, user.id, data))


@router.get("/{transaction_id}")
def get_route(transaction_id: int, user: CurrentUser, db: DB) -> TransactionOut:
    return TransactionOut.model_validate(get_transaction(db, user.id, transaction_id))


@router.put("/{transaction_id}")
def replace_route(transaction_id: int, data: TransactionIn, user: CurrentUser, db: DB) -> TransactionOut:
    """Replace the whole transaction; its type can change too."""
    transaction = get_transaction(db, user.id, transaction_id)
    return TransactionOut.model_validate(replace_transaction(db, transaction, data))


@router.delete("/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_route(transaction_id: int, user: CurrentUser, db: DB) -> Response:
    delete_transaction(db, get_transaction(db, user.id, transaction_id))
    return Response(status_code=status.HTTP_204_NO_CONTENT)
