import type { PeriodRange } from "@/api/overview";

/**
 * Where each widget sits on the dashboard's 12-column grid, in grid cells (one row is 60px). This is
 * ezBookkeeping's default desktop layout (DEFAULT_DESKTOP_OVERVIEW_LAYOUT in src/consts/overview_layout.ts, MIT).
 * Later the user could rearrange it and the layout could be saved with the account.
 */
export type WidgetConfig =
  | { type: "month-overview" }
  | { type: "asset-summary" }
  | { type: "calendar-heatmap"; months: number }
  | { type: "transaction-calendar" }
  | { type: "expense-ranking"; range: PeriodRange; itemCount: number }
  | { type: "expense-trend"; months: number }
  | { type: "period-income-expense"; range: PeriodRange };

export type WidgetLayout = WidgetConfig & { id: string; x: number; y: number; w: number; h: number };

export const GRID_COLUMNS = 12;
export const ROW_HEIGHT = 60;
export const GAP = 16;

export const DEFAULT_LAYOUT: WidgetLayout[] = [
  { id: "month-overview", type: "month-overview", x: 0, y: 0, w: 4, h: 3 },
  { id: "asset-summary", type: "asset-summary", x: 4, y: 0, w: 8, h: 3 },
  { id: "calendar-heatmap", type: "calendar-heatmap", months: 12, x: 0, y: 3, w: 8, h: 3 },
  { id: "transaction-calendar", type: "transaction-calendar", x: 8, y: 3, w: 4, h: 6 },
  { id: "expense-ranking", type: "expense-ranking", range: "this_month", itemCount: 3, x: 0, y: 6, w: 4, h: 3 },
  { id: "expense-trend", type: "expense-trend", months: 12, x: 4, y: 6, w: 4, h: 3 },
  { id: "today", type: "period-income-expense", range: "today", x: 0, y: 9, w: 3, h: 3 },
  { id: "this-week", type: "period-income-expense", range: "this_week", x: 3, y: 9, w: 3, h: 3 },
  { id: "this-month", type: "period-income-expense", range: "this_month", x: 6, y: 9, w: 3, h: 3 },
  { id: "this-year", type: "period-income-expense", range: "this_year", x: 9, y: 9, w: 3, h: 3 },
];

/** Widgets whose content needs their full grid height even when the dashboard stacks on small screens. */
export const FIXED_HEIGHT_TYPES: WidgetConfig["type"][] = ["expense-trend", "transaction-calendar", "calendar-heatmap"];
