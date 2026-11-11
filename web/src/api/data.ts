import { request } from "@/api/client";

const DATA = "/api/v1/data";

export interface DataStats {
  accounts: number;
  categories: number;
  transactions: number;
  /** "YYYY-MM-DD" of the oldest and newest transaction; null when there are none. */
  first_transaction_on: string | null;
  last_transaction_on: string | null;
}

export function fetchDataStats(): Promise<DataStats> {
  return request(`${DATA}/stats`);
}

/** "transactions" deletes every transaction; "all" also deletes the accounts and categories. Cannot be undone. */
export function clearData(input: { scope: "transactions" | "all"; password: string }): Promise<void> {
  return request(`${DATA}/clear`, { method: "POST", body: input });
}
