import type { AmountColor, Preferences, ThemeMode } from "@/api/auth";

/** A new account's preferences, the same as the backend's defaults (chosen for India). */
export const DEFAULT_PREFERENCES: Preferences = {
  theme_color: null,
  theme_mode: "system",
  default_currency: "INR",
  first_day_of_week: 0,
  expense_amount_color: "red",
  income_amount_color: "green",
};

/**
 * ezBookkeeping's amount colours (src/core/color.ts, MIT). "Black or White" is the theme's text colour, so it
 * reads in light and dark themes.
 */
export const AMOUNT_COLORS: { value: AmountColor; name: string; css: string }[] = [
  { value: "green", name: "Green", css: "#009688" },
  { value: "red", name: "Red", css: "#d43f3f" },
  { value: "yellow", name: "Yellow", css: "#e2b60a" },
  { value: "blue", name: "Blue", css: "#3873bf" },
  { value: "black_or_white", name: "Black or White", css: "var(--mui-palette-text-primary)" },
];

export function amountColorCss(color: AmountColor): string {
  return AMOUNT_COLORS.find((option) => option.value === color)?.css ?? AMOUNT_COLORS[0]!.css;
}

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export interface CurrencyOption {
  code: string;
  name: string;
}

let currencies: CurrencyOption[] | null = null;

/** Every currency this browser knows, by code, with its English name. Built once. */
export function allCurrencies(): CurrencyOption[] {
  if (currencies) return currencies;
  const names = new Intl.DisplayNames(["en"], { type: "currency" });
  currencies = Intl.supportedValuesOf("currency").map((code) => ({ code, name: names.of(code) ?? code }));
  return currencies;
}

export const THEME_MODES: { value: ThemeMode; name: string }[] = [
  { value: "system", name: "System" },
  { value: "light", name: "Light" },
  { value: "dark", name: "Dark" },
];
