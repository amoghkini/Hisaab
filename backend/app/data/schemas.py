from datetime import date
from typing import Literal

from pydantic import BaseModel, Field

from app.auth.schemas import PasswordConfirmIn


class DataStatsOut(BaseModel):
    accounts: int
    categories: int
    transactions: int
    first_transaction_on: date | None = Field(description="The day of the oldest transaction, or null when none.")
    last_transaction_on: date | None = Field(description="The day of the newest transaction, or null when none.")


class ClearDataIn(PasswordConfirmIn):
    """`transactions` deletes every transaction; `all` also deletes the accounts and categories."""

    scope: Literal["transactions", "all"]
