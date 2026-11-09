import { keepPreviousData, useQuery, type QueryClient } from "@tanstack/react-query";

import { fetchCategories, type Category } from "@/api/categories";
import { fetchTransactions, type TransactionFilters } from "@/api/transactions";
import { ACCOUNTS_KEY } from "@/pages/accounts/queries";
import { OVERVIEW_KEY } from "@/pages/overview/OverviewContext";

export const TRANSACTIONS_KEY = "transactions";
export const CATEGORIES_KEY = "categories";

export function useTransactions(filters: TransactionFilters) {
  // Keep the last month on screen while the next one loads, so the list does not flash empty.
  return useQuery({ queryKey: [TRANSACTIONS_KEY, filters], queryFn: () => fetchTransactions(filters), placeholderData: keepPreviousData });
}

export function useCategories() {
  return useQuery({ queryKey: [CATEGORIES_KEY], queryFn: fetchCategories, staleTime: 5 * 60 * 1000 });
}

/** Every category, top-level and sub, by id. */
export function categoriesById(tree: Category[] | undefined): Map<number, Category> {
  const byId = new Map<number, Category>();
  for (const top of tree ?? []) {
    byId.set(top.id, top);
    for (const sub of top.sub_categories) byId.set(sub.id, sub);
  }
  return byId;
}

/** After a transaction changes: the lists, the account balances and totals, and the dashboard. */
export function invalidateTransactions(client: QueryClient): Promise<void> {
  return Promise.all([
    client.invalidateQueries({ queryKey: [TRANSACTIONS_KEY] }),
    client.invalidateQueries({ queryKey: [ACCOUNTS_KEY] }),
    client.invalidateQueries({ queryKey: [OVERVIEW_KEY] }),
  ]).then(() => undefined);
}

/** After a category changes: the categories, and the dashboard ranking that shows their names and icons. */
export function invalidateCategories(client: QueryClient): Promise<void> {
  return Promise.all([
    client.invalidateQueries({ queryKey: [CATEGORIES_KEY] }),
    client.invalidateQueries({ queryKey: [OVERVIEW_KEY] }),
  ]).then(() => undefined);
}
