import { ApiError, request } from "@/api/client";

const AUTH = "/api/v1/auth";

export interface User {
  id: number;
  name: string;
  email: string;
  /** "#rrggbb", or null for the default colour. */
  theme_color: string | null;
  theme_mode: ThemeMode;
  /** ISO 4217 code, such as "INR". */
  default_currency: string;
  /** 0 is Sunday ... 6 is Saturday. */
  first_day_of_week: number;
  expense_amount_color: AmountColor;
  income_amount_color: AmountColor;
  /** The account new transactions start on, or null. */
  default_account_id: number | null;
  /** The savings or current account the salary is paid into, or null. */
  salary_account_id: number | null;
  /** 1 is January ... 12 is December. India's financial year starts in April (4). */
  fiscal_year_start_month: number;
  digit_grouping: DigitGrouping;
  currency_display: CurrencyDisplay;
  /** When the account was made, as UTC "YYYY-MM-DDTHH:MM:SS". */
  created_at: string;
}

/** 1,00,000 (Indian), 100,000 (international), or 100000. */
export type DigitGrouping = "indian" | "international" | "none";

/** What stands for the currency beside an amount: the sign, the code ("INR"), or nothing. */
export type CurrencyDisplay = "symbol" | "code" | "none";

export type AmountColor = "green" | "red" | "yellow" | "blue" | "black_or_white";

/** Light or dark; "system" follows the device. */
export type ThemeMode = "system" | "light" | "dark";

/** What a user chooses at sign-up and can change on the profile page. */
export interface Preferences {
  theme_color: string | null;
  theme_mode: ThemeMode;
  default_currency: string;
  first_day_of_week: number;
  expense_amount_color: AmountColor;
  income_amount_color: AmountColor;
}

/** Leave a field out to keep it; theme_color, default_account_id or salary_account_id null goes back to none. */
export type UpdateMeInput = Partial<
  Preferences &
    Pick<User, "name" | "default_account_id" | "salary_account_id" | "fiscal_year_start_month" | "digit_grouping" | "currency_display">
>;

export interface SignInInput {
  email: string;
  password: string;
}

export interface SignUpInput extends Preferences {
  name: string;
  email: string;
  password: string;
  /** Start the account with the preset transaction categories. */
  use_preset_categories: boolean;
}

/** Sign-up also signs in: the answer sets the session cookie. */
export function signUp(input: SignUpInput): Promise<User> {
  return request(`${AUTH}/sign-up`, { method: "POST", body: input });
}

export function signIn(input: SignInInput): Promise<User> {
  return request(`${AUTH}/sign-in`, { method: "POST", body: input });
}

export function signOut(): Promise<void> {
  return request(`${AUTH}/sign-out`, { method: "POST" });
}

export function updateMe(input: UpdateMeInput): Promise<User> {
  return request(`${AUTH}/me`, { method: "PATCH", body: input });
}

export function changePassword(input: { current_password: string; new_password: string }): Promise<void> {
  return request(`${AUTH}/me/password`, { method: "POST", body: input });
}

/** A browser or device signed in to the account. */
export interface AuthSession {
  id: number;
  /** The browser's User-Agent when it signed in; empty when unknown. */
  user_agent: string;
  /** UTC, "YYYY-MM-DDTHH:MM:SS". */
  created_at: string;
  last_seen_at: string | null;
  expires_at: string;
  /** The session this browser is using. */
  current: boolean;
}

export function fetchSessions(): Promise<AuthSession[]> {
  return request(`${AUTH}/sessions`);
}

export function endSession(id: number): Promise<void> {
  return request(`${AUTH}/sessions/${id}`, { method: "DELETE" });
}

/** Sign out every device except this one. */
export function endOtherSessions(): Promise<void> {
  return request(`${AUTH}/sessions`, { method: "DELETE" });
}

/** The signed-in user, or null when nobody is. */
export async function fetchMe(): Promise<User | null> {
  try {
    return await request<User>(`${AUTH}/me`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}
