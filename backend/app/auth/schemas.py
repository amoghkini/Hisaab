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


class SignUpIn(BaseModel):
    name: str = Field(max_length=100)
    email: EmailStr
    password: str = Field(min_length=PASSWORD_MIN, max_length=PASSWORD_MAX)
    use_preset_categories: bool = Field(default=False, description="Start the account with the preset categories.")
    theme_color: ThemeColor | None = None
    theme_mode: ThemeMode = DEFAULT_THEME_MODE
    default_currency: Currency = DEFAULT_CURRENCY
    first_day_of_week: FirstDayOfWeek = DEFAULT_FIRST_DAY_OF_WEEK
    expense_amount_color: AmountColor = DEFAULT_EXPENSE_AMOUNT_COLOR
    income_amount_color: AmountColor = DEFAULT_INCOME_AMOUNT_COLOR

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Enter your name.")
        return value


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


class UpdateMeIn(BaseModel):
    """Only the fields sent are changed. `theme_color: null` goes back to the default colour."""

    theme_color: ThemeColor | None = None
    theme_mode: ThemeMode | None = None
    default_currency: Currency | None = None
    first_day_of_week: FirstDayOfWeek | None = None
    expense_amount_color: AmountColor | None = None
    income_amount_color: AmountColor | None = None

    # Runs only for values that were sent, so a field left out stays out; an explicit null is refused.
    @field_validator(
        "theme_mode", "default_currency", "first_day_of_week", "expense_amount_color", "income_amount_color"
    )
    @classmethod
    def not_null(cls, value: object) -> object:
        if value is None:
            raise ValueError("Cannot be null.")
        return value

    def changes(self) -> dict[str, object]:
        return {name: getattr(self, name) for name in self.model_fields_set}
