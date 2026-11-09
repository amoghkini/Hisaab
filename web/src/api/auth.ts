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
}

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

/** Leave a field out to keep it; theme_color null goes back to the default colour. */
export type UpdateMeInput = Partial<Preferences>;

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

/** The signed-in user, or null when nobody is. */
export async function fetchMe(): Promise<User | null> {
  try {
    return await request<User>(`${AUTH}/me`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}
