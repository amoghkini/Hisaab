/** Calendar dates in the browser's time zone. A date travels as "YYYY-MM-DD" text, as the API sends it. */

export function toIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function parseIsoDate(text: string): Date {
  const [year, month, day] = text.split("-").map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1);
}

export function today(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/** The first day of the month `months` away from the date's month. */
export function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

/** The day the date's week starts, given the first day of the week (0 is Sunday). */
export function startOfWeek(date: Date, firstDayOfWeek: number): Date {
  return addDays(date, -((date.getDay() - firstDayOfWeek + 7) % 7));
}

/** The local date and time to the minute, "YYYY-MM-DDTHH:MM", as a datetime-local input takes it. */
export function nowLocalDateTime(): string {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  return `${toIsoDate(now)}T${hours}:${minutes}`;
}
