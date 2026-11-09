from datetime import date
from typing import Annotated

from fastapi import APIRouter, Query, Response, status

from app.auth.deps import DB, CurrentUser
from app.transactions.models import TransactionType
from app.transactions.schemas import TransactionIn, TransactionListOut, TransactionOut
from app.transactions.service import (
    create_transaction,
    delete_transaction,
    get_transaction,
    list_transactions,
    replace_transaction,
)

router = APIRouter(prefix="/api/v1/transactions", tags=["transactions"])


@router.get("")
def list_route(
    user: CurrentUser,
    db: DB,
    start: date,
    end: date,
    type: TransactionType | None = None,  # noqa: A002 - the query parameter's name
    account_id: int | None = None,
    category_id: int | None = None,
    q: Annotated[str | None, Query(max_length=100, description="Text to find in the description")] = None,
) -> TransactionListOut:
    """Transactions from `start` to `end` (inclusive, up to 366 days), newest first, with income and expense totals."""
    return list_transactions(db, user, start, end, type, account_id, category_id, q.strip() if q else None)


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
