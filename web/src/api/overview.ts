/**
 * The data behind the dashboard. Each widget asks for its own piece with one call, so a slow or failing piece only
 * affects its widget.
 *
 * The backend does not serve these yet: every call answers with sample data from overviewSample.ts. To connect a
 * call, replace its body with the `request(...)` shown in its comment. The response shapes below are what the
 * backend should send. Amounts are whole numbers of the currency's smallest unit (see lib/money.ts), in the
 * user's default currency. Dates are "YYYY-MM-DD" in the user's time zone.
 */
import {
  sampleAssetSummary,
  sampleDailyAmounts,
  sampleExpenseRanking,
  sampleMonthlyAmounts,
  samplePeriodSummary,
} from "@/api/overviewSample";

export type PeriodRange = "today" | "this_week" | "this_month" | "this_year";

export interface PeriodSummary {
  range: PeriodRange;
  /** First and last day of the period, inclusive. */
  start: string;
  end: string;
  income: number;
  expense: number;
}

export interface AssetSummary {
  account_count: number;
  total_assets: number;
  total_liabilities: number;
  net_assets: number;
}

export interface DailyAmount {
  date: string;
  income: number;
  expense: number;
}

export interface MonthlyAmount {
  /** "YYYY-MM". */
  month: string;
  income: number;
  expense: number;
}

export interface RankedCategory {
  category_id: number;
  name: string;
  /** A Material Design Icons name, drawn with CategoryIcon. */
  icon: string;
  /** "#rrggbb", or null for the text colour. */
  color: string | null;
  amount: number;
  /** Share of the period's total expense, 0 to 100. */
  percent: number;
}

export interface ExpenseRanking {
  range: PeriodRange;
  total: number;
  items: RankedCategory[];
}

/** Income and expense over a period. GET /api/v1/overview/period-summary?range=… */
export function fetchPeriodSummary(range: PeriodRange, firstDayOfWeek: number): Promise<PeriodSummary> {
  // The real backend knows the user's first day of the week; the sample needs to be told.
  return samplePeriodSummary(range, firstDayOfWeek);
}

/** Totals over all accounts. GET /api/v1/overview/asset-summary */
export function fetchAssetSummary(): Promise<AssetSummary> {
  return sampleAssetSummary();
}

/** Income and expense for each day from `start` to `end`. GET /api/v1/overview/daily-amounts?start=…&end=… */
export function fetchDailyAmounts(start: string, end: string): Promise<DailyAmount[]> {
  return sampleDailyAmounts(start, end);
}

/** Income and expense for each of the last `months` months, oldest first. GET /api/v1/overview/monthly-amounts?months=… */
export function fetchMonthlyAmounts(months: number): Promise<MonthlyAmount[]> {
  return sampleMonthlyAmounts(months);
}

/** The top expense categories over a period. GET /api/v1/overview/expense-ranking?range=…&limit=… */
export function fetchExpenseRanking(range: PeriodRange, limit: number, firstDayOfWeek: number): Promise<ExpenseRanking> {
  return sampleExpenseRanking(range, limit, firstDayOfWeek);
}
