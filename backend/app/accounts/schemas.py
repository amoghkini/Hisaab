from datetime import date
from typing import Annotated

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, field_validator

from app.accounts.models import AccountCategory
from app.auth.schemas import Currency, ThemeColor

# Amounts are whole numbers of the currency's smallest unit. The bound keeps them exact in JavaScript.
MAX_AMOUNT = 10**15

Amount = Annotated[int, Field(ge=-MAX_AMOUNT, le=MAX_AMOUNT)]
CreditLimit = Annotated[int, Field(ge=0, le=MAX_AMOUNT)]
StatementDay = Annotated[int, Field(ge=1, le=31, description="Day of the month the card's statement is made")]
IconName = Annotated[str, Field(pattern=r"^[a-z0-9-]{1,64}$", description="A Material Design Icons name")]
NumberSuffix = Annotated[
    str, Field(pattern=r"^[0-9]{2,6}$", description="Last digits of the account or card number, as SMS show them")
]
Comment = Annotated[str, Field(max_length=255), AfterValidator(str.strip)]


def _name(value: str) -> str:
    value = value.strip()
    if not value:
        raise ValueError("Enter a name for the account.")
    return value


Name = Annotated[str, Field(max_length=64), AfterValidator(_name)]


class AccountIn(BaseModel):
    """A new account. Credit limit and statement day are kept for credit cards only."""

    category: AccountCategory
    name: Name
    icon: IconName
    color: ThemeColor | None = None
    currency: Currency
    opening_balance: Amount = 0
    opening_balance_date: date | None = None
    number_suffix: NumberSuffix | None = None
    credit_limit: CreditLimit | None = None
    statement_day: StatementDay | None = None
    comment: Comment = ""
    include_in_total: bool = True


class AccountUpdate(BaseModel):
    """Only the fields sent are changed. Null clears the fields that may be empty."""

    category: AccountCategory | None = None
    name: Name | None = None
    icon: IconName | None = None
    color: ThemeColor | None = None
    currency: Currency | None = None
    opening_balance: Amount | None = None
    opening_balance_date: date | None = None
    number_suffix: NumberSuffix | None = None
    credit_limit: CreditLimit | None = None
    statement_day: StatementDay | None = None
    comment: Comment | None = None
    hidden: bool | None = None
    include_in_total: bool | None = None

    # Runs only for values that were sent; these fields always have a value, so null is refused.
    @field_validator("category", "name", "icon", "currency", "opening_balance", "comment", "hidden", "include_in_total")
    @classmethod
    def not_null(cls, value: object) -> object:
        if value is None:
            raise ValueError("Cannot be null.")
        return value

    def changes(self) -> dict[str, object]:
        return {name: getattr(self, name) for name in self.model_fields_set}


class AccountOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    category: AccountCategory
    is_liability: bool
    name: str
    icon: str
    color: str | None
    currency: str
    balance: int = Field(description="The opening balance plus the transactions. Negative is money owed.")
    opening_balance: int
    opening_balance_date: date | None
    number_suffix: str | None
    credit_limit: int | None
    statement_day: int | None
    comment: str
    hidden: bool
    include_in_total: bool
    display_order: int


class AccountOrderIn(BaseModel):
    """Every account of one category, in the new order."""

    ids: list[int] = Field(min_length=1, max_length=1000)


class AccountSummaryOut(BaseModel):
    """Totals over the accounts counted in totals that are in the user's default currency."""

    currency: str
    account_count: int = Field(description="Accounts that are not hidden.")
    total_assets: int
    total_liabilities: int = Field(description="Money owed, as a positive number.")
    net_assets: int
    other_currencies: list[str] = Field(
        description="Currencies of accounts left out of the totals, until exchange rates exist."
    )
