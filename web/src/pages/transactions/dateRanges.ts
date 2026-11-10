import { addDays, addMonths, endOfMonth, parseIsoDate, startOfMonth, startOfWeek, toIsoDate, today } from "@/lib/dates";

/** A span of days, both ends included, as "YYYY-MM-DD". */
export interface DateSpan {
  start: string;
  end: string;
}

/** The most days one list can cover; the API refuses more. */
export const MAX_RANGE_DAYS = 366;

/** India's financial year starts in April. */
const FISCAL_YEAR_START_MONTH = 3;

export type DateRangePreset =
  | "today"
  | "yesterday"
  | "last7"
  | "last30"
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month"
  | "this_year"
  | "last_year"
  | "this_fy"
  | "last_fy";

/** Like ezBookkeeping's date ranges, with India's financial year in place of a configurable one. */
export const DATE_RANGE_PRESETS: { value: DateRangePreset; name: string }[] = [
  { value: "today", name: "Today" },
  { value: "yesterday", name: "Yesterday" },
  { value: "last7", name: "Recent 7 days" },
  { value: "last30", name: "Recent 30 days" },
  { value: "this_week", name: "This week" },
  { value: "last_week", name: "Last week" },
  { value: "this_month", name: "This month" },
  { value: "last_month", name: "Last month" },
  { value: "this_year", name: "This year" },
  { value: "last_year", name: "Last year" },
  { value: "this_fy", name: "This financial year" },
  { value: "last_fy", name: "Last financial year" },
];

function span(start: Date, end: Date): DateSpan {
  return { start: toIsoDate(start), end: toIsoDate(end) };
}

function fiscalYearStart(date: Date): Date {
  const year = date.getMonth() >= FISCAL_YEAR_START_MONTH ? date.getFullYear() : date.getFullYear() - 1;
  return new Date(year, FISCAL_YEAR_START_MONTH, 1);
}

/** The days a preset covers today. */
export function presetSpan(preset: DateRangePreset, firstDayOfWeek: number): DateSpan {
  const now = today();
  switch (preset) {
    case "today":
      return span(now, now);
    case "yesterday":
      return span(addDays(now, -1), addDays(now, -1));
    case "last7":
      return span(addDays(now, -6), now);
    case "last30":
      return span(addDays(now, -29), now);
    case "this_week": {
      const start = startOfWeek(now, firstDayOfWeek);
      return span(start, addDays(start, 6));
    }
    case "last_week": {
      const start = addDays(startOfWeek(now, firstDayOfWeek), -7);
      return span(start, addDays(start, 6));
    }
    case "this_month":
      return span(startOfMonth(now), endOfMonth(now));
    case "last_month": {
      const start = addMonths(now, -1);
      return span(start, endOfMonth(start));
    }
    case "this_year":
      return span(new Date(now.getFullYear(), 0, 1), new Date(now.getFullYear(), 11, 31));
    case "last_year":
      return span(new Date(now.getFullYear() - 1, 0, 1), new Date(now.getFullYear() - 1, 11, 31));
    case "this_fy": {
      const start = fiscalYearStart(now);
      return span(start, addDays(addMonths(start, 12), -1));
    }
    case "last_fy": {
      const start = addMonths(fiscalYearStart(now), -12);
      return span(start, addDays(addMonths(start, 12), -1));
    }
  }
}

/** The preset that covers exactly these days today, if one does. */
export function matchingPreset(range: DateSpan, firstDayOfWeek: number): DateRangePreset | undefined {
  return DATE_RANGE_PRESETS.find(({ value }) => {
    const preset = presetSpan(value, firstDayOfWeek);
    return preset.start === range.start && preset.end === range.end;
  })?.value;
}

/** The last few months, newest first, for one-click picks. */
export function recentMonths(count: number): (DateSpan & { name: string })[] {
  const format = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" });
  return Array.from({ length: count }, (_, index) => {
    const start = addMonths(today(), -index);
    return { ...span(start, endOfMonth(start)), name: format.format(start) };
  });
}

export function daysIn(range: DateSpan): number {
  return Math.round((parseIsoDate(range.end).getTime() - parseIsoDate(range.start).getTime()) / 86_400_000) + 1;
}

function wholeMonths(range: DateSpan): number {
  const start = parseIsoDate(range.start);
  const end = parseIsoDate(range.end);
  if (start.getDate() !== 1 || toIsoDate(end) !== toIsoDate(endOfMonth(end))) return 0;
  return (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth() + 1;
}

/** The span just before (-1) or after (1): whole months move by months, anything else by its number of days. */
export function shiftSpan(range: DateSpan, step: -1 | 1): DateSpan {
  const months = wholeMonths(range);
  const start = parseIsoDate(range.start);
  if (months > 0) {
    const nextStart = addMonths(start, step * months);
    return span(nextStart, endOfMonth(addMonths(nextStart, months - 1)));
  }
  const days = daysIn(range);
  return span(addDays(start, step * days), addDays(parseIsoDate(range.end), step * days));
}

const DAY = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" });
const MONTH = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" });

/** "November 2026", "5 Nov 2026", or "1 Apr 2026 – 31 Mar 2027". */
export function spanLabel(range: DateSpan): string {
  const start = parseIsoDate(range.start);
  const end = parseIsoDate(range.end);
  if (wholeMonths(range) === 1) return MONTH.format(start);
  if (range.start === range.end) return DAY.format(start);
  return `${DAY.format(start)} – ${DAY.format(end)}`;
}

export function isIsoDate(text: string | null): text is string {
  return text !== null && /^\d{4}-\d{2}-\d{2}$/.test(text) && toIsoDate(parseIsoDate(text)) === text;
}
