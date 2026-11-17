"""Employers, their salary components, and the revisions (joining offer, appraisals, promotions) that set the pay.

The kind columns hold the values of the StrEnums below. They are checked by the API schemas, not by CHECK
constraints, so a new kind needs no migration (see .claude/skills/migrations).
"""

from datetime import date, datetime
from enum import StrEnum

from sqlalchemy import BigInteger, Date, DateTime, ForeignKey, Integer, SmallInteger, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base, utcnow


class ComponentKind(StrEnum):
    """In the order the salary structure lists them."""

    EARNING = "earning"  # on the payslip: basic, HRA, special allowance
    DEDUCTION = "deduction"  # taken off the pay: employee PF, professional tax, TDS
    EMPLOYER_CONTRIBUTION = "employer_contribution"  # part of CTC but not paid out: employer PF, gratuity


class RevisionKind(StrEnum):
    JOINING = "joining"  # the offer the job started with; one per employer
    APPRAISAL = "appraisal"
    PROMOTION = "promotion"
    RESTRUCTURE = "restructure"  # the same pay split differently, or a correction


class DocumentKind(StrEnum):
    OFFER_LETTER = "offer_letter"
    JOINING_LETTER = "joining_letter"
    APPRAISAL_LETTER = "appraisal_letter"
    PROMOTION_LETTER = "promotion_letter"
    RELIEVING_LETTER = "relieving_letter"
    FORM16 = "form16"
    TAX_FORECAST = "tax_forecast"
    OTHER = "other"


# Documents that belong to a financial year, and so need one.
YEARLY_DOCUMENT_KINDS = frozenset({DocumentKind.FORM16, DocumentKind.TAX_FORECAST})


class Employer(Base):
    """A job, current or past. The user can have several, and two at once."""

    __tablename__ = "employers"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(100))
    employee_code: Mapped[str | None] = mapped_column(String(32))
    joined_on: Mapped[date] = mapped_column(Date)
    left_on: Mapped[date | None] = mapped_column(Date)  # None while the user still works here
    # The first salary's date: joining after the month's cut-off pushes it to the next month.
    first_pay_on: Mapped[date] = mapped_column(Date)
    pay_day: Mapped[int] = mapped_column(SmallInteger)  # 1 ... 31; a short month pays on its last day
    # The savings or current account the salary goes into. The ledger does not know about employers, so an account
    # that is deleted or stops being savings or current is not cleared here; the salary section reports it instead.
    salary_account_id: Mapped[int | None] = mapped_column(ForeignKey("accounts.id", ondelete="SET NULL"))
    uan: Mapped[str | None] = mapped_column(String(12))  # EPFO's Universal Account Number, 12 digits
    comment: Mapped[str] = mapped_column(String(255), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)


class SalaryComponent(Base):
    """One line of an employer's salary structure, such as Basic or Employee PF. Amounts are in the revisions."""

    __tablename__ = "salary_components"
    __table_args__ = (UniqueConstraint("employer_id", "name", name="uq_salary_components_employer_id_name"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    employer_id: Mapped[int] = mapped_column(ForeignKey("employers.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(64))
    kind: Mapped[str] = mapped_column(String(32))  # a ComponentKind
    display_order: Mapped[int] = mapped_column(Integer)  # within its kind
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)


class SalaryRevision(Base):
    """The yearly pay from a date onward: the joining offer, then one per appraisal, promotion or restructure."""

    __tablename__ = "salary_revisions"
    __table_args__ = (
        UniqueConstraint("employer_id", "effective_from", name="uq_salary_revisions_employer_id_effective_from"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    employer_id: Mapped[int] = mapped_column(ForeignKey("employers.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(32))  # a RevisionKind
    # When the user was told, which can be before the new pay applies: promoted in February, paid more from March.
    announced_on: Mapped[date | None] = mapped_column(Date)
    effective_from: Mapped[date] = mapped_column(Date)
    designation: Mapped[str | None] = mapped_column(String(100))  # the job title from here on; None keeps the last
    comment: Mapped[str] = mapped_column(String(255), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)


class SalaryRevisionLine(Base):
    """A component's yearly amount in one revision. A component with no line is zero in that revision."""

    __tablename__ = "salary_revision_lines"
    __table_args__ = (
        UniqueConstraint("revision_id", "component_id", name="uq_salary_revision_lines_revision_id_component_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    revision_id: Mapped[int] = mapped_column(ForeignKey("salary_revisions.id", ondelete="CASCADE"), index=True)
    component_id: Mapped[int] = mapped_column(ForeignKey("salary_components.id", ondelete="CASCADE"), index=True)
    yearly_amount: Mapped[int] = mapped_column(BigInteger)  # in paise


class EmployerDocument(Base):
    """An offer letter, Form 16, tax forecast and the like, with its figures entered by hand.

    Uploading the file itself comes later; it will add a column here.
    """

    __tablename__ = "employer_documents"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    employer_id: Mapped[int] = mapped_column(ForeignKey("employers.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(32))  # a DocumentKind
    # The year the financial year starts in: 2025 is FY 2025-26. Required for Form 16 and tax forecasts.
    financial_year: Mapped[int | None] = mapped_column(SmallInteger)
    # The revision an offer, appraisal or promotion letter announced.
    revision_id: Mapped[int | None] = mapped_column(ForeignKey("salary_revisions.id", ondelete="SET NULL"))
    title: Mapped[str] = mapped_column(String(100))
    issued_on: Mapped[date | None] = mapped_column(Date)
    # Form 16 and tax forecast figures, in paise.
    gross_salary: Mapped[int | None] = mapped_column(BigInteger)
    taxable_income: Mapped[int | None] = mapped_column(BigInteger)
    tds: Mapped[int | None] = mapped_column(BigInteger)
    comment: Mapped[str] = mapped_column(String(255), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)


class PayslipStatus(StrEnum):
    DRAFT = "draft"  # made on the pay day, or added by hand; waiting for the user to check and approve it
    POSTED = "posted"  # approved: the take-home pay is a transaction in the salary account
    # Deleted by the user. The row stays so the pay-day job does not draft the month again; adding the month by
    # hand brings it back as a draft.
    DISMISSED = "dismissed"


class PrefillSource(StrEnum):
    """Where a payslip's amounts came from."""

    REVISION = "revision"  # a twelfth of the yearly amounts of the pay revision in force
    PREVIOUS = "previous"  # the last approved payslip, posted since that revision took effect
    MANUAL = "manual"  # the user changed them


class Payslip(Base):
    """One month's salary from one employer: the amount of each component, and once approved, the transaction."""

    __tablename__ = "payslips"
    __table_args__ = (UniqueConstraint("employer_id", "pay_month", name="uq_payslips_employer_id_pay_month"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    employer_id: Mapped[int] = mapped_column(ForeignKey("employers.id", ondelete="CASCADE"), index=True)
    pay_month: Mapped[date] = mapped_column(Date)  # the first of the month the salary is paid in
    pay_date: Mapped[date] = mapped_column(Date)  # within pay_month
    status: Mapped[str] = mapped_column(String(16))  # a PayslipStatus
    # The pay revision in force on the pay date, which the amounts were drafted from.
    revision_id: Mapped[int | None] = mapped_column(ForeignKey("salary_revisions.id", ondelete="SET NULL"))
    prefill_source: Mapped[str] = mapped_column(String(16))  # a PrefillSource
    # The income category of the take-home pay. Starts as the user's "Salary Income" category when there is one.
    category_id: Mapped[int | None] = mapped_column(ForeignKey("categories.id", ondelete="SET NULL"))
    # The transactions posting made (source "salary"); replaced when a posted payslip is edited.
    transaction_group_id: Mapped[str | None] = mapped_column(String(36))
    comment: Mapped[str] = mapped_column(String(255), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)


class PayslipLine(Base):
    """A component's amount in one month's payslip, in paise. A component with no line is zero that month."""

    __tablename__ = "payslip_lines"
    __table_args__ = (UniqueConstraint("payslip_id", "component_id", name="uq_payslip_lines_payslip_id_component_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    payslip_id: Mapped[int] = mapped_column(ForeignKey("payslips.id", ondelete="CASCADE"), index=True)
    component_id: Mapped[int] = mapped_column(ForeignKey("salary_components.id", ondelete="CASCADE"), index=True)
    amount: Mapped[int] = mapped_column(BigInteger)
