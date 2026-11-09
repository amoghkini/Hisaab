import { useQuery, type QueryClient } from "@tanstack/react-query";

import { fetchAccounts, fetchAccountSummary } from "@/api/accounts";
import { OVERVIEW_KEY } from "@/pages/overview/OverviewContext";

export const ACCOUNTS_KEY = "accounts";

export function useAccounts() {
  return useQuery({ queryKey: [ACCOUNTS_KEY, "list"], queryFn: fetchAccounts });
}

export function useAccountSummary() {
  return useQuery({ queryKey: [ACCOUNTS_KEY, "summary"], queryFn: fetchAccountSummary });
}

/** After an account changes: the list, the totals, and the dashboard's asset summary. */
export function invalidateAccounts(client: QueryClient): Promise<void> {
  return Promise.all([
    client.invalidateQueries({ queryKey: [ACCOUNTS_KEY] }),
    client.invalidateQueries({ queryKey: [OVERVIEW_KEY, "asset-summary"] }),
  ]).then(() => undefined);
}
