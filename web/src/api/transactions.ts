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
  type?: TransactionType;
  account_id?: number;
  category_id?: number;
  q?: string;
}

export interface TransactionList {
  start: string;
  end: string;
  /** Newest first. */
  items: Transaction[];
  /** The user's default currency; the totals count only accounts in it. */
  currency: string;
  total_income: number;
  total_expense: number;
}

export function fetchTransactions(filters: TransactionFilters): Promise<TransactionList> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  return request(`${TRANSACTIONS}?${params.toString()}`);
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
