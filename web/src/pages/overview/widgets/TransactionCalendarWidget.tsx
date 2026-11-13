import { mdiCalendarMonthOutline } from "@mdi/js";
import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Skeleton from "@mui/material/Skeleton";

import { addDays, endOfMonth, startOfMonth, startOfWeek, toIsoDate, today } from "@/lib/dates";
import { useDailyAmounts, useFirstDayOfWeek, useMoney } from "@/pages/overview/OverviewContext";
import { WidgetCard, WidgetHeader } from "@/pages/overview/WidgetCard";

/** This month as a calendar, with each day's income and expense under its date. */
export function TransactionCalendarWidget() {
  const firstDayOfWeek = useFirstDayOfWeek();
  const money = useMoney();
  const navigate = useNavigate();
  const now = today();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const daily = useDailyAmounts(toIsoDate(monthStart), toIsoDate(monthEnd));
  const byDate = new Map((daily.data ?? []).map((day) => [day.date, day]));

  const gridStart = startOfWeek(monthStart, firstDayOfWeek);
  const weeks = Math.ceil((Math.round((monthEnd.getTime() - gridStart.getTime()) / 86_400_000) + 1) / 7);
  const days = Array.from({ length: weeks * 7 }, (_, i) => addDays(gridStart, i));

  return (
    <WidgetCard className="transaction-calendar-widget">
      <WidgetHeader icon={mdiCalendarMonthOutline} title="Transaction Calendar" />
      <div className="transaction-calendar-widget__month">{now.toLocaleDateString(undefined, { year: "numeric", month: "long" })}</div>
      <Box className="transaction-calendar-widget__grid" style={{ gridTemplateRows: `auto repeat(${weeks}, minmax(0, 1fr))` }}>
        {days.slice(0, 7).map((day) => (
          <div key={`name-${day.getDay()}`} className="transaction-calendar-widget__weekday">
            {day.toLocaleDateString(undefined, { weekday: "short" })}
          </div>
        ))}
        {days.map((day) => {
          const key = toIsoDate(day);
          if (day.getMonth() !== now.getMonth()) return <div key={key} />;
          const amounts = byDate.get(key);
          const isToday = day.getTime() === now.getTime();
          return (
            <ButtonBase
              key={key}
              className={`transaction-calendar-widget__day${isToday ? " transaction-calendar-widget__day--today" : ""}`}
              aria-label={day.toLocaleDateString(undefined, { dateStyle: "full" })}
              onClick={() => void navigate(`/transactions?from=${key}&to=${key}`)}
            >
              <span className={amounts ? "transaction-calendar-widget__date transaction-calendar-widget__date--busy" : "transaction-calendar-widget__date"}>
                {day.getDate()}
              </span>
              {daily.isPending && <Skeleton width="70%" height={12} />}
              {amounts?.income ? <span className="transaction-calendar-widget__amount overview-amount--income">{money(amounts.income, { compact: true })}</span> : null}
              {amounts?.expense ? <span className="transaction-calendar-widget__amount overview-amount--expense">{money(amounts.expense, { compact: true })}</span> : null}
            </ButtonBase>
          );
        })}
      </Box>
    </WidgetCard>
  );
}
