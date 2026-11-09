from datetime import date, datetime
from typing import Annotated

from pydantic import AfterValidator, BaseModel, ConfigDict, Field

from app.accounts.schemas import MAX_AMOUNT
from app.transactions.models import TransactionType

PositiveAmount = Annotated[int, Field(gt=0, le=MAX_AMOUNT, description="In the currency's smallest unit")]


def _whole_minute(value: datetime) -> datetime:
    """Local wall time to the minute; a time zone, if sent, is dropped (the time is kept as written)."""
    return value.replace(second=0, microsecond=0, tzinfo=None)


class TransactionIn(BaseModel):
    """A whole transaction, for adding or replacing one. Fields that do not apply to the type are ignored."""

    type: TransactionType
    occurred_at: Annotated[datetime, AfterValidator(_whole_minute)] = Field(
        description="The user's local date and time, such as 2026-11-10T09:30"
    )
    category_id: int | None = None
    account_id: int
    amount: PositiveAmount
    to_account_id: int | None = None
    to_amount: PositiveAmount | None = Field(
        default=None, description="Transfers: the amount that arrives. Needed only when the currencies differ."
    )
    comment: Annotated[str, Field(max_length=255), AfterValidator(str.strip)] = ""


class TransactionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    type: TransactionType
    occurred_at: datetime
    category_id: int | None
    account_id: int
    amount: int
    to_account_id: int | None
    to_amount: int | None
    comment: str


class TransactionListOut(BaseModel):
    """The transactions between two dates, newest first, with the period's totals."""

    start: date
    end: date
    items: list[TransactionOut]
    currency: str = Field(description="The user's default currency, which the totals are in.")
    total_income: int = Field(description="Income into accounts in the default currency.")
    total_expense: int = Field(description="Expense from accounts in the default currency.")
