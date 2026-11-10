import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Typography from "@mui/material/Typography";
import { useMemo } from "react";

import type { Account } from "@/api/accounts";
import type { Transaction } from "@/api/transactions";
import { addDays, endOfMonth, startOfMonth, startOfWeek, toIsoDate, today } from "@/lib/dates";

const WEEKDAY = new Intl.DateTimeFormat(undefined, { weekday: "short" });

interface DayTotals {
  income: number;
  expense: number;
  count: number;
}

/**
 * A month as a grid of days, each with its income, expense and number of transactions. Like ezBookkeeping's
 * calendar view. Choosing a day lists its transactions.
 */
export function TransactionCalendar({
  month,
  items,
  accounts,
  currency,
  firstDayOfWeek,
  money,
  onDay,
}: {
  /** Any day in the month to show. */
  month: Date;
  items: Transaction[];
  accounts: Map<number, Account>;
  currency: string;
  firstDayOfWeek: number;
  money: (minor: number, currency: string) => string;
  onDay: (day: string) => void;
}) {
  const totals = useMemo(() => {
    const byDay = new Map<string, DayTotals>();
    for (const item of items) {
      const day = item.occurred_at.slice(0, 10);
      const entry = byDay.get(day) ?? { income: 0, expense: 0, count: 0 };
      entry.count += 1;
      // Only the default currency is added up, as in the totals above.
      if (accounts.get(item.account_id)?.currency === currency) {
        if (item.type === "income") entry.income += item.amount;
        if (item.type === "expense") entry.expense += item.amount;
      }
      byDay.set(day, entry);
    }
    return byDay;
  }, [items, accounts, currency]);

  const first = startOfMonth(month);
  const last = endOfMonth(month);
  const gridStart = startOfWeek(first, firstDayOfWeek);
  const weeks = Math.ceil(((last.getTime() - gridStart.getTime()) / 86_400_000 + 1) / 7);
  const days = Array.from({ length: weeks * 7 }, (_, index) => addDays(gridStart, index));
  const todayText = toIsoDate(today());

  return (
    <Box sx={{ overflowX: "auto" }}>
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(96px, 1fr))", minWidth: 680, borderTop: 1, borderLeft: 1, borderColor: "divider" }}>
        {days.slice(0, 7).map((day) => (
          <Typography key={`head-${day.getDay()}`} variant="body2" color="text.secondary" sx={{ px: 1, py: 0.75, fontWeight: 600, borderRight: 1, borderBottom: 1, borderColor: "divider" }}>
            {WEEKDAY.format(day)}
          </Typography>
        ))}
        {days.map((day) => {
          const text = toIsoDate(day);
          const inMonth = day.getMonth() === first.getMonth();
          const entry = totals.get(text);
          return (
            <ButtonBase
              key={text}
              disabled={!inMonth}
              onClick={() => onDay(text)}
              aria-label={`${text}${entry ? `, ${entry.count} transactions` : ""}`}
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "stretch",
                justifyContent: "flex-start",
                minHeight: 96,
                p: 1,
                textAlign: "start",
                borderRight: 1,
                borderBottom: 1,
                borderColor: "divider",
                opacity: inMonth ? 1 : 0.35,
                "&:hover": { bgcolor: "action.hover" },
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: 600,
                    ...(text === todayText ? { bgcolor: "primary.main", color: "primary.contrastText", borderRadius: "50%", width: 24, height: 24, display: "grid", placeItems: "center" } : {}),
                  }}
                >
                  {day.getDate()}
                </Typography>
                {entry ? (
                  <Typography variant="caption" color="text.secondary" sx={{ ml: "auto" }}>
                    {entry.count} {entry.count === 1 ? "item" : "items"}
                  </Typography>
                ) : null}
              </Box>
              {entry && entry.income > 0 ? (
                <Typography variant="caption" sx={{ color: "var(--hk-income-color)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  +{money(entry.income, currency)}
                </Typography>
              ) : null}
              {entry && entry.expense > 0 ? (
                <Typography variant="caption" sx={{ color: "var(--hk-expense-color)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  −{money(entry.expense, currency)}
                </Typography>
              ) : null}
            </ButtonBase>
          );
        })}
      </Box>
    </Box>
  );
}
