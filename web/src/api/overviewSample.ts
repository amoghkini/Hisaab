/**
 * Made-up dashboard data, until the backend serves the overview calls (see overview.ts). Every answer comes from
 * one generated set of days, so the widgets agree with each other, and the same days come back on every load.
 * Delete this file once all calls in overview.ts use the backend.
 */
import type {
  AssetSummary,
  DailyAmount,
  ExpenseRanking,
  MonthlyAmount,
  PeriodRange,
  PeriodSummary,
} from "@/api/overview";
import { addDays, addMonths, parseIsoDate, startOfMonth, startOfWeek, toIsoDate, today } from "@/lib/dates";

/** Enough history for the 12-month heatmap and trend. */
const HISTORY_MONTHS = 13;
/** A short wait, so the loading placeholders can be seen. */
const DELAY_MS = 350;

function later<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), DELAY_MS));
}

/** A small seeded random number generator (mulberry32). */
function random(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Whole rupees between `low` and `high`, in paise. */
function rupees(next: () => number, low: number, high: number): number {
  return Math.round(low + next() * (high - low)) * 100;
}

let days: Map<string, DailyAmount> | null = null;

function allDays(): Map<string, DailyAmount> {
  if (days) return days;
  days = new Map();
  const next = random(20210101);
  const last = today();
  for (let day = addMonths(last, -HISTORY_MONTHS); day <= last; day = addDays(day, 1)) {
    let expense = 0;
    let income = 0;
    if (day.getDate() === 1) {
      income += 8500000; // salary
      expense += 1800000; // rent
    }
    if (day.getDate() === 5) expense += rupees(next, 1800, 3200); // bills
    if (next() < 0.78) {
      const purchases = 1 + Math.floor(next() * 3);
      for (let i = 0; i < purchases; i += 1) expense += rupees(next, 60, 1400);
    }
    if (next() < 0.04) expense += rupees(next, 3000, 12000); // something big
    if (next() < 0.05) income += rupees(next, 500, 6000); // a refund or side income
    days.set(toIsoDate(day), { date: toIsoDate(day), income, expense });
  }
  return days;
}

function sumDays(start: Date, end: Date): { income: number; expense: number } {
  const all = allDays();
  let income = 0;
  let expense = 0;
  for (let day = start; day <= end; day = addDays(day, 1)) {
    const found = all.get(toIsoDate(day));
    income += found?.income ?? 0;
    expense += found?.expense ?? 0;
  }
  return { income, expense };
}

function periodBounds(range: PeriodRange, firstDayOfWeek: number): { start: Date; end: Date } {
  const end = today();
  switch (range) {
    case "today":
      return { start: end, end };
    case "this_week":
      return { start: startOfWeek(end, firstDayOfWeek), end: addDays(startOfWeek(end, firstDayOfWeek), 6) };
    case "this_month":
      return { start: startOfMonth(end), end: addDays(addMonths(end, 1), -1) };
    case "this_year":
      return { start: new Date(end.getFullYear(), 0, 1), end: new Date(end.getFullYear(), 11, 31) };
  }
}

export function samplePeriodSummary(range: PeriodRange, firstDayOfWeek: number): Promise<PeriodSummary> {
  const { start, end } = periodBounds(range, firstDayOfWeek);
  return later({ range, start: toIsoDate(start), end: toIsoDate(end), ...sumDays(start, end) });
}

export function sampleAssetSummary(): Promise<AssetSummary> {
  const totalAssets = 48235000;
  const totalLiabilities = 3642050;
  return later({
    account_count: 5,
    total_assets: totalAssets,
    total_liabilities: totalLiabilities,
    net_assets: totalAssets - totalLiabilities,
  });
}

export function sampleDailyAmounts(start: string, end: string): Promise<DailyAmount[]> {
  const all = allDays();
  const result: DailyAmount[] = [];
  for (let day = parseIsoDate(start); day <= parseIsoDate(end); day = addDays(day, 1)) {
    const found = all.get(toIsoDate(day));
    if (found && (found.income || found.expense)) result.push(found);
  }
  return later(result);
}

export function sampleMonthlyAmounts(months: number): Promise<MonthlyAmount[]> {
  const result: MonthlyAmount[] = [];
  for (let offset = months - 1; offset >= 0; offset -= 1) {
    const start = addMonths(today(), -offset);
    const totals = sumDays(start, addDays(addMonths(start, 1), -1));
    result.push({ month: toIsoDate(start).slice(0, 7), ...totals });
  }
  return later(result);
}

/** The preset expense categories (backend/app/categories/presets.py), with each one's usual share of spending. */
const CATEGORY_SHARES = [
  { category_id: 3, name: "Housing & Houseware", icon: "home", color: null, share: 0.42 },
  { category_id: 1, name: "Food & Drink", icon: "silverware-fork-knife", color: "#ff6b22", share: 0.24 },
  { category_id: 4, name: "Transportation", icon: "car", color: "#009688", share: 0.11 },
  { category_id: 6, name: "Entertainment", icon: "party-popper", color: "#ff2d55", share: 0.08 },
  { category_id: 2, name: "Clothing & Appearance", icon: "hanger", color: "#673ab7", share: 0.07 },
  { category_id: 5, name: "Communication", icon: "phone", color: "#2196f3", share: 0.05 },
  { category_id: 9, name: "Medical & Healthcare", icon: "medical-bag", color: "#ff3b30", share: 0.03 },
];

export function sampleExpenseRanking(range: PeriodRange, limit: number, firstDayOfWeek: number): Promise<ExpenseRanking> {
  const { start, end } = periodBounds(range, firstDayOfWeek);
  const { expense: total } = sumDays(start, end);
  const items = CATEGORY_SHARES.slice(0, limit).map(({ share, ...category }) => {
    const amount = Math.round(total * share);
    return { ...category, amount, percent: total ? (amount / total) * 100 : 0 };
  });
  return later({ range, total, items: total ? items : [] });
}
