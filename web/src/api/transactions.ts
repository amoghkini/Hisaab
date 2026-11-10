import { request } from "@/api/client";

const TRANSACTIONS = "/api/v1/transactions";

export type TransactionType = "expense" | "income" | "transfer";

export const TRANSACTION_TYPES: { value: TransactionType; name: string }[] = [
  { value: "expense", name: "Expense" },
  { value: "income", name: "Income" },
  { value: "transfer", name: "Transfer" },
];

export interface Transaction {
  id: number;
  type: TransactionType;
  /** The user's local date and time, "YYYY-MM-DDTHH:MM:SS". */
  occurred_at: string;
  category_id: number | null;
  /** Where money leaves (expense, transfer) or arrives (income). */
  account_id: number;
  /** In the smallest unit of the account's currency; always positive. */
  amount: number;
  /** Transfers only. */
  to_account_id: number | null;
  to_amount: number | null;
  comment: string;
  /** What made it. Only "manual" for now; the others come with salary, EPFO import, SMS and schedules. */
  source: "manual" | "sms" | "salary" | "epfo" | "schedule";
  /** Shared by transactions made together, such as one payslip's lines. */
  group_id: string | null;
}

export interface TransactionInput {
  type: TransactionType;
  /** "YYYY-MM-DDTHH:MM", local time. */
  occurred_at: string;
  category_id: number | null;
  account_id: number;
  amount: number;
  to_account_id: number | null;
  /** Needed only for a transfer between currencies. */
  to_amount: number | null;
  comment: string;
}

export interface TransactionFilters {
  /** "YYYY-MM-DD", inclusive. */
  start: string;
  end: string;
  /** Any of these types. */
  types?: TransactionType[];
  /** Any of these accounts, as either side of a transfer. */
  account_ids?: number[];
  /** Any of these categories; a top-level one includes its sub-categories. */
  category_ids?: number[];
  q?: string;
  /** In minor units: "gt:N", "lt:N", "eq:N", "ne:N", "bt:LOW:HIGH" or "nb:LOW:HIGH". */
  amount?: string;
  /** Items per page; every match when left out. */
  limit?: number;
  offset?: number;
}

export interface TransactionList {
  start: string;
  end: string;
  /** Newest first: the page asked for, or every match without a limit. */
  items: Transaction[];
  /** Every match, on all pages. */
  total_count: number;
  /** The user's default currency; the totals count only accounts in it. */
  currency: string;
  total_income: number;
  total_expense: number;
}

function transactionQuery(filters: TransactionFilters): string {
  const { types, account_ids, category_ids, ...rest } = filters;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(rest)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  for (const type of types ?? []) params.append("type", type);
  for (const id of account_ids ?? []) params.append("account_id", String(id));
  for (const id of category_ids ?? []) params.append("category_id", String(id));
  return params.toString();
}

export function fetchTransactions(filters: TransactionFilters): Promise<TransactionList> {
  return request(`${TRANSACTIONS}?${transactionQuery(filters)}`);
}

export interface DayTotal {
  /** "YYYY-MM-DD". */
  day: string;
  /** In the default currency's smallest unit; only accounts in that currency are added up. */
  income: number;
  expense: number;
  /** Every matching transaction that day. */
  count: number;
}

export interface DailyTotals {
  currency: string;
  /** Days with at least one match, newest first. */
  days: DayTotal[];
}

/** Each day's totals over every match, for a paged list's day headings. Paging fields are ignored. */
export function fetchDailyTotals(filters: TransactionFilters): Promise<DailyTotals> {
  return request(`${TRANSACTIONS}/daily-totals?${transactionQuery({ ...filters, limit: undefined, offset: undefined })}`);
}

export function createTransaction(input: TransactionInput): Promise<Transaction> {
  return request(TRANSACTIONS, { method: "POST", body: input });
}

export function replaceTransaction(id: number, input: TransactionInput): Promise<Transaction> {
  return request(`${TRANSACTIONS}/${id}`, { method: "PUT", body: input });
}

export function deleteTransaction(id: number): Promise<void> {
  return request(`${TRANSACTIONS}/${id}`, { method: "DELETE" });
}
