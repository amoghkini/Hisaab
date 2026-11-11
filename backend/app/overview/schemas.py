from datetime import date

from pydantic import BaseModel, Field


class PeriodTotalsOut(BaseModel):
    start: date
    end: date
    income: int
    expense: int


class DailyAmountOut(BaseModel):
    date: date
    income: int
    expense: int


class MonthlyAmountOut(BaseModel):
    month: str = Field(description='"YYYY-MM"')
    income: int
    expense: int


class RankedCategoryOut(BaseModel):
    category_id: int = Field(description="A top-level category; 0 for expenses whose category is gone.")
    name: str
    icon: str
    color: str | None
    amount: int
    percent: float = Field(description="Share of the period's total expense, 0 to 100.")


class ExpenseRankingOut(BaseModel):
    start: date
    end: date
    total: int
    items: list[RankedCategoryOut]
