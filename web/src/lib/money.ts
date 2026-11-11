/**
 * Amounts travel as whole numbers of the currency's smallest unit (paise for INR, cents for USD), so they add up
 * exactly. These helpers turn them into text.
 */

import type { CurrencyDisplay, DigitGrouping } from "@/api/auth";

/** How amounts are written: the user's choices on the settings page. */
export interface AmountFormat {
  digitGrouping: DigitGrouping;
  currencyDisplay: CurrencyDisplay;
}

export const DEFAULT_AMOUNT_FORMAT: AmountFormat = { digitGrouping: "indian", currencyDisplay: "symbol" };

let amountFormat = DEFAULT_AMOUNT_FORMAT;
const formatters = new Map<string, Intl.NumberFormat>();

/**
 * Use these choices for every amount from now on. Returns a key that changes with them, so pages can be redrawn.
 * The app frame calls it with the signed-in user's settings.
 */
export function setAmountFormat(format: AmountFormat): string {
  if (format.digitGrouping !== amountFormat.digitGrouping || format.currencyDisplay !== amountFormat.currencyDisplay) {
    amountFormat = format;
    formatters.clear();
  }
  return `${format.digitGrouping}:${format.currencyDisplay}`;
}

function numberFormat(currency: string, compact: boolean, format: AmountFormat): Intl.NumberFormat {
  // en-IN groups as 1,00,000 and en-US as 100,000; both write the decimal point as ".".
  const locale = format.digitGrouping === "international" ? "en-US" : "en-IN";
  const digits = fractionDigits(currency);
  return new Intl.NumberFormat(locale, {
    useGrouping: format.digitGrouping !== "none",
    signDisplay: "negative", // no minus sign on a zero, such as a paid-off card's -0
    ...(format.currencyDisplay === "none"
      ? { style: "decimal", minimumFractionDigits: digits, maximumFractionDigits: digits }
      : { style: "currency", currency, currencyDisplay: format.currencyDisplay === "code" ? "code" : "narrowSymbol" }),
    ...(compact ? { notation: "compact", minimumFractionDigits: 0, maximumFractionDigits: 1 } : {}),
  });
}

function formatter(currency: string, compact: boolean): Intl.NumberFormat {
  const key = `${currency}:${compact}`;
  let found = formatters.get(key);
  if (!found) {
    found = numberFormat(currency, compact, amountFormat);
    formatters.set(key, found);
  }
  return found;
}

const minorUnits = new Map<string, number>();

/** How many minor units make one major unit: 100 for INR, 1 for JPY. */
export function minorUnitsPerMajor(currency: string): number {
  let found = minorUnits.get(currency);
  if (found === undefined) {
    const digits = new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
    found = 10 ** digits;
    minorUnits.set(currency, found);
  }
  return found;
}

/** Pass `format` to preview choices that are not saved yet; otherwise the user's are used. */
export function formatAmount(minor: number, currency: string, options: { compact?: boolean; format?: AmountFormat } = {}): string {
  const compact = options.compact ?? false;
  const found = options.format ? numberFormat(currency, compact, options.format) : formatter(currency, compact);
  return found.format(minor / minorUnitsPerMajor(currency));
}

/** What a hidden amount shows, as ezBookkeeping does. */
export const HIDDEN_AMOUNT = "***";

/** How many digits a currency has after the decimal point: 2 for INR, 0 for JPY. */
export function fractionDigits(currency: string): number {
  return Math.round(Math.log10(minorUnitsPerMajor(currency)));
}

/**
 * What a person typed, such as "1,25,000.50", as minor units. Grouping commas and spaces are ignored. Null when it
 * is not a number or has more decimals than the currency allows.
 */
export function parseAmount(text: string, currency: string): number | null {
  const plain = text.replace(/[,\s]/g, "");
  const digits = fractionDigits(currency);
  const pattern = digits > 0 ? new RegExp(`^-?\\d+(\\.\\d{0,${digits}})?$`) : /^-?\d+$/;
  if (!pattern.test(plain)) return null;
  const [whole = "0", fraction = ""] = plain.replace("-", "").split(".");
  const minor = Number(whole) * minorUnitsPerMajor(currency) + Number(fraction.padEnd(digits, "0") || "0");
  if (!Number.isSafeInteger(minor)) return null;
  return plain.startsWith("-") ? -minor : minor;
}

/** Minor units as plain text for an input box, such as "125000.5"; no grouping, no symbol. */
export function amountInputText(minor: number, currency: string): string {
  const digits = fractionDigits(currency);
  const sign = minor < 0 ? "-" : "";
  const absolute = Math.abs(minor);
  const per = minorUnitsPerMajor(currency);
  const whole = Math.floor(absolute / per);
  const fraction = String(absolute % per).padStart(digits, "0").replace(/0+$/, "");
  return `${sign}${whole}${fraction ? `.${fraction}` : ""}`;
}
