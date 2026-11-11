import { useQuery } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";

import { usePrivacyMode } from "@/appearance/PrivacyMode";

import {
  fetchAssetSummary,
  fetchDailyAmounts,
  fetchExpenseRanking,
  fetchMonthlyAmounts,
  fetchPeriodSummary,
  type PeriodRange,
} from "@/api/overview";
import { useMe } from "@/auth/session";
import { DEFAULT_PREFERENCES } from "@/appearance/preferences";
import { formatAmount, HIDDEN_AMOUNT } from "@/lib/money";

/** Every overview query key starts with this, so the refresh button can reload them all. */
export const OVERVIEW_KEY = "overview";

interface OverviewContextValue {
  showAmounts: boolean;
  toggleShowAmounts: () => void;
}

const OverviewContext = createContext<OverviewContextValue | null>(null);

/**
 * State the dashboard's widgets share: whether amounts are shown (the app-wide private mode, also switched from
 * the navbar).
 */
export function OverviewProvider({ children }: { children: ReactNode }) {
  const privacy = usePrivacyMode();
  const showAmounts = !privacy.hidden;
  const toggleShowAmounts = privacy.toggle;

  const value = useMemo(() => ({ showAmounts, toggleShowAmounts,  }), [showAmounts, toggleShowAmounts]);

  return (
    <OverviewContext.Provider value={value}>
      {children}
    </OverviewContext.Provider>
  );
}

export function useOverview(): OverviewContextValue {
  const value = useContext(OverviewContext);
  if (!value) throw new Error("useOverview needs an OverviewProvider above it");
  return value;
}

function usePreferences() {
  const me = useMe();
  return {
    currency: me.data?.default_currency ?? DEFAULT_PREFERENCES.default_currency,
    firstDayOfWeek: me.data?.first_day_of_week ?? DEFAULT_PREFERENCES.first_day_of_week,
  };
}

/** Formats amounts in the user's currency, or hides them when the user chose to. */
export function useMoney() {
  const { showAmounts } = useOverview();
  const { currency } = usePreferences();
  return useCallback(
    (minor: number, options: { compact?: boolean } = {}) => (showAmounts ? formatAmount(minor, currency, options) : HIDDEN_AMOUNT),
    [showAmounts, currency],
  );
}

export function useFirstDayOfWeek(): number {
  return usePreferences().firstDayOfWeek;
}

// One hook per overview call. Widgets that ask for the same thing share one request.

export function usePeriodSummary(range: PeriodRange) {
  const { firstDayOfWeek } = usePreferences();
  return useQuery({
    queryKey: [OVERVIEW_KEY, "period-summary", range, firstDayOfWeek],
    queryFn: () => fetchPeriodSummary(range, firstDayOfWeek),
  });
}

export function useAssetSummary() {
  return useQuery({ queryKey: [OVERVIEW_KEY, "asset-summary"], queryFn: fetchAssetSummary });
}

export function useDailyAmounts(start: string, end: string) {
  return useQuery({ queryKey: [OVERVIEW_KEY, "daily-amounts", start, end], queryFn: () => fetchDailyAmounts(start, end) });
}

export function useMonthlyAmounts(months: number) {
  return useQuery({ queryKey: [OVERVIEW_KEY, "monthly-amounts", months], queryFn: () => fetchMonthlyAmounts(months) });
}

export function useExpenseRanking(range: PeriodRange, limit: number) {
  const { firstDayOfWeek } = usePreferences();
  return useQuery({
    queryKey: [OVERVIEW_KEY, "expense-ranking", range, limit, firstDayOfWeek],
    queryFn: () => fetchExpenseRanking(range, limit, firstDayOfWeek),
  });
}
