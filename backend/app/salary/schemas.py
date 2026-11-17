from collections.abc import Callable
from datetime import date
from typing import Annotated, Literal

from pydantic import AfterValidator, BaseModel, Field, field_validator, model_validator

from app.accounts.schemas import MAX_AMOUNT, Comment
from app.salary.models import (
    YEARLY_DOCUMENT_KINDS,
    ComponentKind,
    DocumentKind,
    PayslipStatus,
    PrefillSource,
    RevisionKind,
)

YearlyAmount = Annotated[int, Field(ge=0, le=MAX_AMOUNT, description="A yearly amount, in paise.")]
DocumentAmount = Annotated[int, Field(ge=0, le=MAX_AMOUNT, description="In paise.")]
PayDay = Annotated[int, Field(ge=1, le=31, description="Day of the month the salary is paid; 31 is the last day.")]
Uan = Annotated[str, Field(pattern=r"^[0-9]{12}$", description="EPFO's Universal Account Number: 12 digits.")]
FinancialYear = Annotated[int, Field(ge=1950, le=2100, description="The year it starts in: 2025 is FY 2025-26.")]


def _required(message: str) -> Callable[[str], str]:
    def check(value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError(message)
        return value

    return check


def _optional(value: str | None) -> str | None:
    return (value.strip() or None) if value is not None else None


EmployerName = Annotated[str, Field(max_length=100), AfterValidator(_required("Enter the employer's name."))]
ComponentName = Annotated[str, Field(max_length=64), AfterValidator(_required("Enter a name for the component."))]
DocumentTitle = Annotated[str, Field(max_length=100), AfterValidator(_required("Enter a title for the document."))]
EmployeeCode = Annotated[str | None, Field(max_length=32), AfterValidator(_optional)]
Designation = Annotated[str | None, Field(max_length=100), AfterValidator(_optional)]


# Requests


class LineIn(BaseModel):
    """A component's yearly amount: an existing component by id, or a new one by name and kind."""

    component_id: int | None = None
    name: ComponentName | None = None
    kind: ComponentKind | None = None
    yearly_amount: YearlyAmount

    @model_validator(mode="after")
    def component_or_new(self) -> "LineIn":
        if self.component_id is None and (self.name is None or self.kind is None):
            raise ValueError("Give a component id, or a name and kind for a new component.")
        return self


def _no_repeats(lines: list[LineIn]) -> list[LineIn]:
    ids = [line.component_id for line in lines if line.component_id is not None]
    names = [line.name.casefold() for line in lines if line.component_id is None and line.name]
    if len(ids) != len(set(ids)) or len(names) != len(set(names)):
        raise ValueError("Each component can appear only once.")
    return lines


Lines = Annotated[list[LineIn], Field(max_length=100), AfterValidator(_no_repeats)]


class _EmploymentFields(BaseModel):
    employee_code: EmployeeCode = None
    left_on: date | None = None
    salary_account_id: int | None = None
    uan: Uan | None = None
    comment: Comment = ""


class EmployerIn(_EmploymentFields):
    """A new employer, with the salary it was joined on: the onboarding form."""

    name: EmployerName
    joined_on: date
    first_pay_on: date | None = Field(
        default=None, description="Defaults to the first pay day on or after the joining date."
    )
    pay_day: PayDay
    designation: Designation = None
    lines: Lines = Field(min_length=1, description="The joining offer's components and their yearly amounts.")


class EmployerUpdate(BaseModel):
    """Only the fields sent are changed. Null clears the fields that may be empty."""

    name: EmployerName | None = None
    employee_code: EmployeeCode = None
    joined_on: date | None = None
    left_on: date | None = None
    first_pay_on: date | None = None
    pay_day: PayDay | None = None
    salary_account_id: int | None = None
    uan: Uan | None = None
    comment: Comment | None = None

    @field_validator("name", "joined_on", "first_pay_on", "pay_day", "comment")
    @classmethod
    def not_null(cls, value: object) -> object:
        if value is None:
            raise ValueError("Cannot be null.")
        return value

    def changes(self) -> dict[str, object]:
        return {name: getattr(self, name) for name in self.model_fields_set}


class ComponentIn(BaseModel):
    name: ComponentName
    kind: ComponentKind


class ComponentUpdate(BaseModel):
    name: ComponentName | None = None
    kind: ComponentKind | None = None


class RevisionIn(BaseModel):
    """An appraisal, promotion or restructure. `lines` is the whole new structure; components left out are zero."""

    kind: Literal[RevisionKind.APPRAISAL, RevisionKind.PROMOTION, RevisionKind.RESTRUCTURE]
    announced_on: date | None = None
    effective_from: date
    designation: Designation = None
    comment: Comment = ""
    lines: Lines = Field(min_length=1)


class RevisionUpdate(BaseModel):
    """Only the fields sent are changed. `lines`, when sent, replaces the whole structure."""

    announced_on: date | None = None
    effective_from: date | None = None
    designation: Designation = None
    comment: Comment | None = None
    lines: Lines | None = None

    @field_validator("effective_from", "comment", "lines")
    @classmethod
    def not_null(cls, value: object) -> object:
        if value is None:
            raise ValueError("Cannot be null.")
        return value

    def changes(self) -> dict[str, object]:
        return {name: getattr(self, name) for name in self.model_fields_set}


class DocumentIn(BaseModel):
    kind: DocumentKind
    financial_year: FinancialYear | None = None
    revision_id: int | None = None
    title: DocumentTitle
    issued_on: date | None = None
    gross_salary: DocumentAmount | None = None
    taxable_income: DocumentAmount | None = None
    tds: DocumentAmount | None = None
    comment: Comment = ""

    @model_validator(mode="after")
    def year_when_needed(self) -> "DocumentIn":
        if self.kind in YEARLY_DOCUMENT_KINDS and self.financial_year is None:
            raise ValueError("Choose the financial year this document is for.")
        return self


# Answers


class TotalsOut(BaseModel):
    gross: int = Field(description="Earnings.")
    deductions: int
    net: int = Field(description="Earnings less deductions: the take-home pay.")
    employer_contributions: int
    ctc: int = Field(description="Cost to company: earnings plus employer contributions.")


class LineOut(BaseModel):
    component_id: int
    yearly_amount: int
    monthly_amount: int = Field(description="The yearly amount / 12, rounded to the rupee.")


class ComponentOut(BaseModel):
    id: int
    name: str
    kind: ComponentKind
    display_order: int


class RevisionOut(BaseModel):
    id: int
    kind: RevisionKind
    announced_on: date | None
    effective_from: date
    designation: str | None = Field(description="The title this revision set, or null if it kept the last one.")
    designation_in_effect: str | None = Field(description="The title from this revision on, carried forward.")
    comment: str
    status: Literal["past", "current", "upcoming"]
    lines: list[LineOut]
    yearly: TotalsOut
    monthly: TotalsOut


class DocumentOut(BaseModel):
    id: int
    kind: DocumentKind
    financial_year: int | None
    revision_id: int | None
    title: str
    issued_on: date | None
    gross_salary: int | None
    taxable_income: int | None
    tds: int | None
    comment: str


class EmployerOut(BaseModel):
    id: int
    name: str
    employee_code: str | None
    joined_on: date
    left_on: date | None
    first_pay_on: date
    pay_day: int
    salary_account_id: int | None
    salary_account_ok: bool = Field(
        description="False when the linked account is gone or is no longer a savings or current account."
    )
    uan: str | None
    comment: str
    is_current: bool = Field(description="Not left yet, or leaving on a later date.")
    designation: str | None = Field(description="The title in the current revision.")
    yearly: TotalsOut | None = Field(description="Totals of the current revision.")
    monthly: TotalsOut | None


class EmployerDetailOut(EmployerOut):
    components: list[ComponentOut]
    revisions: list[RevisionOut] = Field(description="Newest effective date first.")
    current_revision_id: int | None
    documents: list[DocumentOut] = Field(description="Newest financial year first, then by issue date.")


class ComponentPresetOut(BaseModel):
    name: str
    kind: ComponentKind


# Payslips

PayslipAmount = Annotated[int, Field(ge=0, le=MAX_AMOUNT, description="This month's amount, in paise.")]


class PayslipCreateIn(BaseModel):
    """A month added by hand, such as one from before the employer was added. It starts as a pre-filled draft."""

    employer_id: int
    pay_month: date = Field(description="Any day of the month the salary was paid in.")


class PayslipLineIn(BaseModel):
    component_id: int
    amount: PayslipAmount


def _one_line_each(lines: list[PayslipLineIn]) -> list[PayslipLineIn]:
    ids = [line.component_id for line in lines]
    if len(ids) != len(set(ids)):
        raise ValueError("Each component can appear only once.")
    return lines


class PayslipUpdate(BaseModel):
    """Only the fields sent are changed. `lines`, when sent, is every amount of the month; components left out are
    zero. Editing a posted payslip posts it again."""

    pay_date: date | None = None
    category_id: int | None = None
    comment: Comment | None = None
    lines: Annotated[list[PayslipLineIn], Field(max_length=100), AfterValidator(_one_line_each)] | None = None

    @field_validator("pay_date", "comment", "lines")
    @classmethod
    def not_null(cls, value: object) -> object:
        if value is None:
            raise ValueError("Cannot be null.")
        return value

    def changes(self) -> dict[str, object]:
        return {name: getattr(self, name) for name in self.model_fields_set}


class PayslipLineOut(BaseModel):
    component_id: int
    name: str
    kind: ComponentKind
    amount: int


class PayslipOut(BaseModel):
    id: int
    employer_id: int
    employer_name: str
    pay_month: date = Field(description="The first of the month the salary is paid in.")
    pay_date: date
    status: PayslipStatus
    prefill_source: PrefillSource
    revision_id: int | None
    category_id: int | None
    comment: str
    totals: TotalsOut = Field(description="This month's gross, deductions, take-home and CTC.")


class PayslipDetailOut(PayslipOut):
    lines: list[PayslipLineOut] = Field(description="Every component of the employer; zero when not paid this month.")
    salary_account_id: int | None
    post_problem: str | None = Field(description="Why it cannot be approved yet, or null.")
    transaction_ids: list[int] = Field(description="The transactions posting made.")
