/**
 * Amounts travel as whole numbers of the currency's smallest unit (paise for INR, cents for USD), so they add up
 * exactly. These helpers turn them into text.
 */

const formatters = new Map<string, Intl.NumberFormat>();

function formatter(currency: string, compact: boolean): Intl.NumberFormat {
  const key = `${currency}:${compact}`;
  let found = formatters.get(key);
  if (!found) {
    found = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
      ...(compact ? { notation: "compact", maximumFractionDigits: 1 } : {}),
    });
    formatters.set(key, found);
  }
  return found;
}

/** How many minor units make one major unit: 100 for INR, 1 for JPY. */
export function minorUnitsPerMajor(currency: string): number {
  return 10 ** (formatter(currency, false).resolvedOptions().maximumFractionDigits ?? 2);
}

export function formatAmount(minor: number, currency: string, options: { compact?: boolean } = {}): string {
  return formatter(currency, options.compact ?? false).format(minor / minorUnitsPerMajor(currency));
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
