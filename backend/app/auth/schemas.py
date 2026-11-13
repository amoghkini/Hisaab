from datetime import datetime
from typing import Annotated, Literal

from pydantic import AfterValidator, BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.auth.models import (
    DEFAULT_CURRENCY,
    DEFAULT_EXPENSE_AMOUNT_COLOR,
    DEFAULT_FIRST_DAY_OF_WEEK,
    DEFAULT_INCOME_AMOUNT_COLOR,
    DEFAULT_THEME_MODE,
)

PASSWORD_MIN = 8
PASSWORD_MAX = 128

# The preferences a user sets at sign-up and changes on the profile page.
ThemeColor = Annotated[str, Field(pattern=r"^#[0-9a-fA-F]{6}$"), AfterValidator(str.lower)]
Currency = Annotated[str, Field(pattern=r"^[A-Za-z]{3}$", description="ISO 4217 code"), AfterValidator(str.upper)]
FirstDayOfWeek = Annotated[int, Field(ge=0, le=6, description="0 is Sunday ... 6 is Saturday")]
# ezBookkeeping's amount colours; black_or_white follows the text colour of the theme.
AmountColor = Literal["green", "red", "yellow", "blue", "black_or_white"]
# Light or dark; "system" follows the device.
ThemeMode = Literal["system", "light", "dark"]
FiscalYearStartMonth = Annotated[int, Field(ge=1, le=12, description="1 is January ... 12 is December")]
# How amounts group their digits: 1,00,000 (Indian), 100,000 (international), or 100000.
DigitGrouping = Literal["indian", "international", "none"]
# What stands for the currency beside an amount: the rupee sign, "INR", or nothing.
CurrencyDisplay = Literal["symbol", "code", "none"]


def _name_not_blank(value: str) -> str:
    value = value.strip()
    if not value:
        raise ValueError("Enter your name.")
    return value


Name = Annotated[str, Field(max_length=100), AfterValidator(_name_not_blank)]


class SignUpIn(BaseModel):
    name: Name
    email: EmailStr
    password: str = Field(min_length=PASSWORD_MIN, max_length=PASSWORD_MAX)
    use_preset_categories: bool = Field(default=False, description="Start the account with the preset categories.")
    theme_color: ThemeColor | None = None
    theme_mode: ThemeMode = DEFAULT_THEME_MODE
    default_currency: Currency = DEFAULT_CURRENCY
    first_day_of_week: FirstDayOfWeek = DEFAULT_FIRST_DAY_OF_WEEK
    expense_amount_color: AmountColor = DEFAULT_EXPENSE_AMOUNT_COLOR
    income_amount_color: AmountColor = DEFAULT_INCOME_AMOUNT_COLOR


class SignInIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=PASSWORD_MAX)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: str
    theme_color: str | None = Field(description="The chosen theme colour as #rrggbb, or null for the default.")
    theme_mode: ThemeMode
    default_currency: str
    first_day_of_week: int
    expense_amount_color: AmountColor
    income_amount_color: AmountColor
    default_account_id: int | None = Field(description="The account new transactions start on, or null.")
    salary_account_id: int | None = Field(
        description="The savings or current account the salary is paid into, or null."
    )
    fiscal_year_start_month: int
    digit_grouping: DigitGrouping
    currency_display: CurrencyDisplay
    created_at: datetime


class UpdateMeIn(BaseModel):
    """Only the fields sent are changed. Null `theme_color`, `default_account_id` or `salary_account_id` clears it."""

    name: Name | None = None
    # The e-mail is the login and cannot be changed; sending it is refused rather than ignored.
    email: str | None = Field(default=None, description="Cannot be changed; sending it is refused.")
    default_account_id: int | None = None
    salary_account_id: int | None = None
    fiscal_year_start_month: FiscalYearStartMonth | None = None
    digit_grouping: DigitGrouping | None = None
    currency_display: CurrencyDisplay | None = None
    theme_color: ThemeColor | None = None
    theme_mode: ThemeMode | None = None
    default_currency: Currency | None = None
    first_day_of_week: FirstDayOfWeek | None = None
    expense_amount_color: AmountColor | None = None
    income_amount_color: AmountColor | None = None

    # Runs only for values that were sent, so a field left out stays out; an explicit null is refused.
    @field_validator(
        "name",
        "theme_mode",
        "default_currency",
        "first_day_of_week",
        "expense_amount_color",
        "income_amount_color",
        "fiscal_year_start_month",
        "digit_grouping",
        "currency_display",
    )
    @classmethod
    def not_null(cls, value: object) -> object:
        if value is None:
            raise ValueError("Cannot be null.")
        return value

    @field_validator("email")
    @classmethod
    def email_fixed(cls, _: object) -> object:
        raise ValueError("The e-mail address cannot be changed.")

    def changes(self) -> dict[str, object]:
        return {name: getattr(self, name) for name in self.model_fields_set}


class PasswordChangeIn(BaseModel):
    current_password: str = Field(min_length=1, max_length=PASSWORD_MAX)
    new_password: str = Field(min_length=PASSWORD_MIN, max_length=PASSWORD_MAX)


class PasswordConfirmIn(BaseModel):
    """The current password, asked again before something that cannot be undone."""

    password: str = Field(min_length=1, max_length=PASSWORD_MAX)


class SessionOut(BaseModel):
    """A signed-in browser or device. The token itself is never shown."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    user_agent: str = Field(description="The browser's User-Agent when it signed in; empty when unknown.")
    created_at: datetime
    last_seen_at: datetime | None
    expires_at: datetime
    current: bool = Field(default=False, description="True for the session making this request.")
