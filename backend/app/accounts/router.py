from fastapi import APIRouter, Response, status

from app.accounts.models import AccountCategory
from app.accounts.schemas import AccountIn, AccountOrderIn, AccountOut, AccountSummaryOut, AccountUpdate
from app.accounts.service import (
    account_summary,
    accounts_out,
    create_account,
    delete_account,
    get_account,
    list_accounts,
    one_account_out,
    reorder_accounts,
    update_account,
)
from app.auth.deps import DB, CurrentUser

router = APIRouter(prefix="/api/v1/accounts", tags=["accounts"])


@router.get("")
def list_route(user: CurrentUser, db: DB) -> list[AccountOut]:
    """Every account, hidden ones too, by category and then by the user's order."""
    return accounts_out(db, user.id, list_accounts(db, user.id))


@router.post("", status_code=status.HTTP_201_CREATED)
def create_route(data: AccountIn, user: CurrentUser, db: DB) -> AccountOut:
    return one_account_out(db, create_account(db, user.id, data))


# Before /{account_id}, so "summary" is not read as an id.
@router.get("/summary")
def summary_route(user: CurrentUser, db: DB) -> AccountSummaryOut:
    """Total assets, liabilities and net assets, for the accounts page and the dashboard."""
    return account_summary(db, user)


@router.put("/order/{category}")
def order_route(category: AccountCategory, data: AccountOrderIn, user: CurrentUser, db: DB) -> list[AccountOut]:
    """Reorder one category's accounts. Answers with every account, in the new order."""
    return accounts_out(db, user.id, reorder_accounts(db, user.id, category, data))


@router.get("/{account_id}")
def get_route(account_id: int, user: CurrentUser, db: DB) -> AccountOut:
    return one_account_out(db, get_account(db, user.id, account_id))


@router.patch("/{account_id}")
def update_route(account_id: int, data: AccountUpdate, user: CurrentUser, db: DB) -> AccountOut:
    return one_account_out(db, update_account(db, get_account(db, user.id, account_id), data))


@router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_route(account_id: int, user: CurrentUser, db: DB) -> Response:
    delete_account(db, get_account(db, user.id, account_id))
    return Response(status_code=status.HTTP_204_NO_CONTENT)
