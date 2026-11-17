"""Salary components common in Indian payslips, offered when setting up an employer. The user can add others."""

from app.salary.models import ComponentKind

PRESET_COMPONENTS: tuple[tuple[str, ComponentKind], ...] = (
    ("Basic", ComponentKind.EARNING),
    ("House rent allowance", ComponentKind.EARNING),
    ("Special allowance", ComponentKind.EARNING),
    ("Leave travel allowance", ComponentKind.EARNING),
    ("Conveyance allowance", ComponentKind.EARNING),
    ("Medical allowance", ComponentKind.EARNING),
    ("Meal allowance", ComponentKind.EARNING),
    ("Phone and internet", ComponentKind.EARNING),
    ("Performance bonus", ComponentKind.EARNING),
    ("Employee PF", ComponentKind.DEDUCTION),
    ("Voluntary PF", ComponentKind.DEDUCTION),
    ("Professional tax", ComponentKind.DEDUCTION),
    ("Income tax (TDS)", ComponentKind.DEDUCTION),
    ("Employee NPS", ComponentKind.DEDUCTION),
    ("Group health insurance", ComponentKind.DEDUCTION),
    ("Labour welfare fund", ComponentKind.DEDUCTION),
    ("Employer PF", ComponentKind.EMPLOYER_CONTRIBUTION),
    ("Employer NPS", ComponentKind.EMPLOYER_CONTRIBUTION),
    ("Gratuity", ComponentKind.EMPLOYER_CONTRIBUTION),
    ("Employer health insurance", ComponentKind.EMPLOYER_CONTRIBUTION),
)
