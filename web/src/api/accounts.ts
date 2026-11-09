import { request } from "@/api/client";

const ACCOUNTS = "/api/v1/accounts";

export type AccountCategory =
  | "cash"
  | "savings"
  | "current"
  | "credit_card"
  | "wallet"
  | "loan"
  | "receivable"
  | "fixed_deposit"
  | "investment";

export interface AccountCategoryInfo {
  value: AccountCategory;
  name: string;
  /** The icon a new account of this category starts with, and the category's own icon. */
  icon: string;
  /** Money owed rather than owned: the balance is entered as a positive amount owed. */
  liability: boolean;
}

/** In the order the accounts page lists them, the same as the backend's. */
export const ACCOUNT_CATEGORIES: AccountCategoryInfo[] = [
  { value: "cash", name: "Cash", icon: "wallet", liability: false },
  { value: "savings", name: "Savings Account", icon: "bank", liability: false },
  { value: "current", name: "Current Account", icon: "briefcase", liability: false },
  { value: "credit_card", name: "Credit Card", icon: "credit-card", liability: true },
  { value: "wallet", name: "Digital Wallet", icon: "cellphone", liability: false },
  { value: "loan", name: "Loan", icon: "cash-clock", liability: true },
  { value: "receivable", name: "Receivable", icon: "hand-coin", liability: false },
  { value: "fixed_deposit", name: "Fixed Deposit", icon: "certificate", liability: false },
  { value: "investment", name: "Investment", icon: "chart-line", liability: false },
];

export function categoryInfo(category: AccountCategory): AccountCategoryInfo {
  return ACCOUNT_CATEGORIES.find((info) => info.value === category) ?? ACCOUNT_CATEGORIES[0]!;
}

export interface Account {
  id: number;
  category: AccountCategory;
  is_liability: boolean;
  name: string;
  /** A Material Design Icons name, drawn with AccountIcon. */
  icon: string;
  /** "#rrggbb", or null for the text colour. */
  color: string | null;
  /** ISO 4217 code. */
  currency: string;
  /** The balance now, in the currency's smallest unit. Negative is money owed. */
  balance: number;
  opening_balance: number;
  /** "YYYY-MM-DD", or null. */
  opening_balance_date: string | null;
  /** Last digits of the account or card number, as bank SMS show them. */
  number_suffix: string | null;
  credit_limit: number | null;
  statement_day: number | null;
  comment: string;
  hidden: boolean;
  include_in_total: boolean;
  display_order: number;
}

export interface AccountInput {
  category: AccountCategory;
  name: string;
  icon: string;
  color: string | null;
  currency: string;
  opening_balance: number;
  opening_balance_date: string | null;
  number_suffix: string | null;
  credit_limit: number | null;
  statement_day: number | null;
  comment: string;
  include_in_total: boolean;
  hidden?: boolean;
}

export interface AccountSummary {
  /** The user's default currency: the totals are in it. */
  currency: string;
  /** Accounts that are not hidden. */
  account_count: number;
  total_assets: number;
  /** Money owed, as a positive number. */
  total_liabilities: number;
  net_assets: number;
  /** Currencies of accounts left out of the totals, until exchange rates exist. */
  other_currencies: string[];
}

export function fetchAccounts(): Promise<Account[]> {
  return request(ACCOUNTS);
}

export function fetchAccountSummary(): Promise<AccountSummary> {
  return request(`${ACCOUNTS}/summary`);
}

export function createAccount(input: AccountInput): Promise<Account> {
  return request(ACCOUNTS, { method: "POST", body: input });
}

export function updateAccount(id: number, input: Partial<AccountInput>): Promise<Account> {
  return request(`${ACCOUNTS}/${id}`, { method: "PATCH", body: input });
}

export function deleteAccount(id: number): Promise<void> {
  return request(`${ACCOUNTS}/${id}`, { method: "DELETE" });
}

/** Every account of one category, in the new order. Answers with all accounts. */
export function reorderAccounts(category: AccountCategory, ids: number[]): Promise<Account[]> {
  return request(`${ACCOUNTS}/order/${category}`, { method: "PUT", body: { ids } });
}
