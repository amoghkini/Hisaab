/**
 * The data behind the dashboard. Each widget asks for its own piece with one call, so a slow or failing piece only
 * affects its widget.
 *
 * The page works out the dates (today, this week, ...) from the browser's clock and the user's first day of the
 * week, and the backend adds up the transactions in them. Amounts are whole numbers of the currency's smallest unit
 * (see lib/money.ts), in the user's default currency; accounts in other currencies are left out until exchange
 * rates exist. Transfers are neither income nor expense. Dates are "YYYY-MM-DD" in the user's time zone.
 */
import { fetchAccountSummary } from "@/api/accounts";
import { request } from "@/api/client";
import { addDays, addMonths, startOfMonth, startOfWeek, toIsoDate, today } from "@/lib/dates";

const OVERVIEW = "/api/v1/overview";

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
  /** A top-level category; 0 for expenses whose category is gone. */
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

/** The first and last day of a period that contains today, inclusive. */
export function periodBounds(range: PeriodRange, firstDayOfWeek: number): { start: string; end: string } {
  const now = today();
  switch (range) {
    case "today":
      return { start: toIsoDate(now), end: toIsoDate(now) };
    case "this_week": {
      const first = startOfWeek(now, firstDayOfWeek);
      return { start: toIsoDate(first), end: toIsoDate(addDays(first, 6)) };
    }
    case "this_month":
      return { start: toIsoDate(startOfMonth(now)), end: toIsoDate(addDays(addMonths(now, 1), -1)) };
    case "this_year":
      return { start: `${now.getFullYear()}-01-01`, end: `${now.getFullYear()}-12-31` };
  }
}

function query(params: Record<string, string | number>): string {
  return new URLSearchParams(Object.entries(params).map(([key, value]) => [key, String(value)])).toString();
}

/** Income and expense over a period. */
export async function fetchPeriodSummary(range: PeriodRange, firstDayOfWeek: number): Promise<PeriodSummary> {
  const bounds = periodBounds(range, firstDayOfWeek);
  const totals = await request<{ income: number; expense: number }>(`${OVERVIEW}/totals?${query(bounds)}`);
  return { range, ...bounds, income: totals.income, expense: totals.expense };
}

/** Totals over all accounts, from the accounts API. */
export async function fetchAssetSummary(): Promise<AssetSummary> {
  const { account_count, total_assets, total_liabilities, net_assets } = await fetchAccountSummary();
  return { account_count, total_assets, total_liabilities, net_assets };
}

/** Income and expense for each day from `start` to `end` that has any. */
export function fetchDailyAmounts(start: string, end: string): Promise<DailyAmount[]> {
  return request(`${OVERVIEW}/daily-amounts?${query({ start, end })}`);
}

/** Income and expense for each of the last `months` months, this one included, oldest first. */
export function fetchMonthlyAmounts(months: number): Promise<MonthlyAmount[]> {
  const now = today();
  const startMonth = toIsoDate(addMonths(now, -(months - 1))).slice(0, 7);
  const endMonth = toIsoDate(now).slice(0, 7);
  return request(`${OVERVIEW}/monthly-amounts?${query({ start_month: startMonth, end_month: endMonth })}`);
}

/** The top expense categories over a period; sub-categories add up into their group. */
export async function fetchExpenseRanking(range: PeriodRange, limit: number, firstDayOfWeek: number): Promise<ExpenseRanking> {
  const bounds = periodBounds(range, firstDayOfWeek);
  const ranking = await request<{ total: number; items: RankedCategory[] }>(`${OVERVIEW}/expense-ranking?${query({ ...bounds, limit })}`);
  return { range, total: ranking.total, items: ranking.items };
}
