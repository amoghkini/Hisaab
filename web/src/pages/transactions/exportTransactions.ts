import type { Account } from "@/api/accounts";
import type { Category } from "@/api/categories";
import type { Transaction } from "@/api/transactions";
import { amountInputText } from "@/lib/money";

const HEADINGS = ["Date", "Time", "Type", "Category", "Sub-category", "Account", "Amount", "Currency", "To account", "To amount", "To currency", "Description"];

/** One field: tabs and line breaks become spaces in TSV; CSV quotes what needs it. */
function field(value: string, separator: "," | "\t"): string {
  if (separator === "\t") return value.replace(/[\t\r\n]+/g, " ");
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Save the transactions as a CSV or TSV file, like ezBookkeeping's export. */
export function exportTransactions(
  items: Transaction[],
  accounts: Map<number, Account>,
  categories: Map<number, Category>,
  format: "csv" | "tsv",
  fileName: string,
): void {
  const separator = format === "csv" ? "," : "\t";
  const rows = items.map((item) => {
    const category = item.category_id === null ? undefined : categories.get(item.category_id);
    const parent = category?.parent_id ? categories.get(category.parent_id) : undefined;
    const account = accounts.get(item.account_id);
    const toAccount = item.to_account_id === null ? undefined : accounts.get(item.to_account_id);
    const currency = account?.currency ?? "";
    return [
      item.occurred_at.slice(0, 10),
      item.occurred_at.slice(11, 16),
      item.type,
      parent?.name ?? category?.name ?? "",
      parent ? (category?.name ?? "") : "",
      account?.name ?? "",
      currency ? amountInputText(item.amount, currency) : String(item.amount),
      currency,
      toAccount?.name ?? "",
      toAccount && item.to_amount !== null ? amountInputText(item.to_amount, toAccount.currency) : "",
      toAccount?.currency ?? "",
      item.comment,
    ];
  });
  const text = [HEADINGS, ...rows].map((row) => row.map((value) => field(value, separator)).join(separator)).join("\r\n");
  // A byte order mark, so Excel reads the file as UTF-8 (₹ and names in Indian scripts).
  const blob = new Blob(["﻿", text], { type: format === "csv" ? "text/csv;charset=utf-8" : "text/tab-separated-values;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${fileName}.${format}`;
  link.click();
  URL.revokeObjectURL(url);
}
