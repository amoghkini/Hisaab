from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.accounts.models import CATEGORY_ORDER, LIABILITY_CATEGORIES, Account, AccountCategory
from app.accounts.schemas import AccountIn, AccountOrderIn, AccountOut, AccountSummaryOut, AccountUpdate
from app.auth.models import User
from app.errors import ApiError
from app.transactions.service import account_has_transactions, balance_changes


def account_out(account: Account, change: int = 0) -> AccountOut:
    """`change` is how much the account's transactions have moved it from its opening balance."""
    return AccountOut(
        id=account.id,
        category=AccountCategory(account.category),
        is_liability=account.category in LIABILITY_CATEGORIES,
        name=account.name,
        icon=account.icon,
        color=account.color,
        currency=account.currency,
        balance=account.opening_balance + change,
        opening_balance=account.opening_balance,
        opening_balance_date=account.opening_balance_date,
        number_suffix=account.number_suffix,
        credit_limit=account.credit_limit,
        statement_day=account.statement_day,
        comment=account.comment,
        hidden=account.hidden,
        include_in_total=account.include_in_total,
        display_order=account.display_order,
    )


def _sort_key(account: Account) -> tuple[int, int, int]:
    return CATEGORY_ORDER.index(AccountCategory(account.category)), account.display_order, account.id


def list_accounts(db: Session, user_id: int) -> list[Account]:
    """Every account of the user, by category and then by the user's order."""
    accounts = db.scalars(select(Account).where(Account.user_id == user_id)).all()
    return sorted(accounts, key=_sort_key)


def get_account(db: Session, user_id: int, account_id: int) -> Account:
    account = db.get(Account, account_id)
    if account is None or account.user_id != user_id:
        raise ApiError(404, "account_not_found", "This account does not exist.")
    return account


def _keep_card_fields_for_cards(account: Account) -> None:
    if account.category != AccountCategory.CREDIT_CARD:
        account.credit_limit = None
        account.statement_day = None


def _next_order(db: Session, user_id: int, category: str) -> int:
    last = db.scalar(
        select(func.max(Account.display_order)).where(Account.user_id == user_id, Account.category == category)
    )
    return 0 if last is None else last + 1


def create_account(db: Session, user_id: int, data: AccountIn) -> Account:
    account = Account(user_id=user_id, **data.model_dump(), display_order=_next_order(db, user_id, data.category))
    _keep_card_fields_for_cards(account)
    db.add(account)
    db.commit()
    return account


def accounts_out(db: Session, user_id: int, accounts: list[Account]) -> list[AccountOut]:
    changes = balance_changes(db, user_id)
    return [account_out(account, changes.get(account.id, 0)) for account in accounts]


def one_account_out(db: Session, account: Account) -> AccountOut:
    return account_out(account, balance_changes(db, account.user_id).get(account.id, 0))


def update_account(db: Session, account: Account, data: AccountUpdate) -> Account:
    changes = data.changes()
    new_currency = changes.get("currency")
    if new_currency is not None and new_currency != account.currency and account_has_transactions(db, account.id):
        message = "The currency cannot change once the account has transactions."
        raise ApiError(409, "currency_locked", message, [{"field": "currency", "message": message}])
    new_category = changes.get("category")
    if new_category is not None and new_category != account.category:
        account.display_order = _next_order(db, account.user_id, str(new_category))  # goes last in its new category
    for name, value in changes.items():
        setattr(account, name, value)
    _keep_card_fields_for_cards(account)
    db.commit()
    return account


def delete_account(db: Session, account: Account) -> None:
    if account_has_transactions(db, account.id):
        raise ApiError(
            409,
            "account_in_use",
            "This account has transactions, so it cannot be deleted. Delete them first, or hide the account.",
        )
    db.execute(update(User).where(User.default_account_id == account.id).values(default_account_id=None))
    db.delete(account)
    db.commit()


def reorder_accounts(db: Session, user_id: int, category: AccountCategory, data: AccountOrderIn) -> list[Account]:
    """Set the order of one category's accounts. The list must hold each of them exactly once."""
    accounts = db.scalars(select(Account).where(Account.user_id == user_id, Account.category == category)).all()
    by_id = {account.id: account for account in accounts}
    if len(data.ids) != len(set(data.ids)) or set(data.ids) != set(by_id):
        raise ApiError(
            422,
            "order_mismatch",
            "The order must list every account of this category once. Reload the page and try again.",
        )
    for order, account_id in enumerate(data.ids):
        by_id[account_id].display_order = order
    db.commit()
    return list_accounts(db, user_id)


def account_summary(db: Session, user: User) -> AccountSummaryOut:
    total_assets = 0
    total_liabilities = 0
    count = 0
    other_currencies: set[str] = set()
    changes = balance_changes(db, user.id)
    for account in list_accounts(db, user.id):
        if not account.hidden:
            count += 1
        if not account.include_in_total:
            continue
        if account.currency != user.default_currency:
            other_currencies.add(account.currency)
            continue
        balance = account.opening_balance + changes.get(account.id, 0)
        # By sign, not category: a card paid too much holds money; a savings account in overdraft owes it.
        # Hidden accounts still count: hiding tidies the list, it does not make the money go away.
        if balance >= 0:
            total_assets += balance
        else:
            total_liabilities -= balance
    return AccountSummaryOut(
        currency=user.default_currency,
        account_count=count,
        total_assets=total_assets,
        total_liabilities=total_liabilities,
        net_assets=total_assets - total_liabilities,
        other_currencies=sorted(other_currencies),
    )
