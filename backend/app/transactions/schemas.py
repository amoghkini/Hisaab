from datetime import date, datetime
from typing import Annotated

from pydantic import AfterValidator, BaseModel, ConfigDict, Field

from app.accounts.schemas import MAX_AMOUNT
from app.transactions.models import TransactionSource, TransactionType

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
    source: TransactionSource
    group_id: str | None


class TransactionListOut(BaseModel):
    """The transactions between two dates, newest first, with the period's totals."""

    start: date
    end: date
    items: list[TransactionOut] = Field(description="The page asked for, or every match when no limit is given.")
    total_count: int = Field(description="Every match, on all pages.")
    currency: str = Field(description="The user's default currency, which the totals are in.")
    total_income: int = Field(description="Income into accounts in the default currency.")
    total_expense: int = Field(description="Expense from accounts in the default currency.")


class DayTotalOut(BaseModel):
    """One day's matching transactions, added up. Only accounts in the default currency are counted in the sums."""

    day: date
    income: int = 0
    expense: int = 0
    count: int = Field(0, description="Every matching transaction that day, in any currency.")


class DailyTotalsOut(BaseModel):
    currency: str = Field(description="The user's default currency, which the sums are in.")
    days: list[DayTotalOut] = Field(description="Days with at least one match, newest first.")
