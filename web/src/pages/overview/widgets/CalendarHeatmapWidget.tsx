import { mdiCalendarMonthOutline } from "@mdi/js";
import Box from "@mui/material/Box";
import Skeleton from "@mui/material/Skeleton";
import Tooltip from "@mui/material/Tooltip";
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { useNavigate } from "react-router-dom";

import { addDays, startOfWeek, toIsoDate, today } from "@/lib/dates";
import { useDailyAmounts, useFirstDayOfWeek, useMoney } from "@/pages/overview/OverviewContext";
import { WidgetCard, WidgetHeader } from "@/pages/overview/WidgetCard";

const CELL = 11;
const STEP = 14;
const LEFT = 30;
const TOP = 16;
/** The smallest the drawing may shrink to. Below it, the oldest weeks are left out instead. */
const MIN_SCALE = 0.85;
/** Opacity of the theme colour for each level of spending; level 0 is a day without expense. */
const LEVEL_OPACITY = [0, 0.25, 0.45, 0.7, 1];

/** The value at a share (0 to 1) of the sorted values. */
function quantile(sorted: number[], share: number): number {
  return sorted[Math.min(sorted.length - 1, Math.floor(share * sorted.length))] ?? 0;
}

/** One square per day over the last months, darker on days with more expense. */
export function CalendarHeatmapWidget({ months }: { months: number }) {
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const bodyWidth = useWidth(bodyRef);
  const firstDayOfWeek = useFirstDayOfWeek();
  const money = useMoney();
  const navigate = useNavigate();
  /** Open the transactions of one day. */
  const openDay = (isoDay: string) => void navigate(`/transactions?from=${isoDay}&to=${isoDay}`);
  const end = today();
  // The day after this date `months` ago, so exactly `months` months show.
  const firstDay = addDays(new Date(end.getFullYear(), end.getMonth() - months, end.getDate()), 1);
  const daily = useDailyAmounts(toIsoDate(firstDay), toIsoDate(end));

  const expenseByDate = new Map((daily.data ?? []).map((day) => [day.date, day.expense]));
  const sorted = [...expenseByDate.values()].filter(Boolean).sort((a, b) => a - b);
  const thresholds = [quantile(sorted, 0.25), quantile(sorted, 0.5), quantile(sorted, 0.75)];
  const levelOf = (amount: number) => (amount ? 1 + thresholds.filter((limit) => amount > limit).length : 0);

  const gridStart = startOfWeek(firstDay, firstDayOfWeek);
  const allWeeks = Math.ceil((Math.round((end.getTime() - gridStart.getTime()) / 86_400_000) + 1) / 7);
  // On narrow screens, show the latest weeks that fit rather than shrinking every square.
  const fittingWeeks = bodyWidth ? Math.floor((bodyWidth / MIN_SCALE - LEFT) / STEP) : allWeeks;
  const weeks = Math.max(1, Math.min(allWeeks, fittingWeeks));
  const firstWeek = allWeeks - weeks;
  const firstShown = new Date(Math.max(firstDay.getTime(), addDays(gridStart, firstWeek * 7).getTime()));
  const width = LEFT + weeks * STEP;
  const height = TOP + 7 * STEP;

  const cells: ReactNode[] = [];
  const monthLabels: { x: number; text: string; key: string }[] = [];
  for (let week = 0; week < weeks; week += 1) {
    for (let row = 0; row < 7; row += 1) {
      const day = addDays(gridStart, (firstWeek + week) * 7 + row);
      if (day < firstShown || day > end) continue;
      // A month's name sits above the column holding its first day.
      if (day.getDate() === 1 || day.getTime() === firstShown.getTime()) {
        monthLabels.push({ x: LEFT + week * STEP, text: day.toLocaleDateString(undefined, { month: "short" }), key: toIsoDate(day) });
      }
      const amount = expenseByDate.get(toIsoDate(day)) ?? 0;
      const level = levelOf(amount);
      const label = day.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
      const isoDay = toIsoDate(day);
      cells.push(
        <Tooltip key={isoDay} followCursor placement="top" title={amount ? `${label}: ${money(amount)} expense` : `${label}: no expense`}>
          <rect
            x={LEFT + week * STEP}
            y={TOP + row * STEP}
            width={CELL}
            height={CELL}
            rx={2.5}
            role="link"
            tabIndex={0}
            aria-label={amount ? `${label}: ${money(amount)} expense` : `${label}: no expense`}
            className={level ? "heatmap__cell" : "heatmap__cell heatmap__cell--empty"}
            style={level ? { opacity: LEVEL_OPACITY[level] } : undefined}
            onClick={() => openDay(isoDay)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                openDay(isoDay);
              }
            }}
          />
        </Tooltip>,
      );
    }
  }
  // A cut-off first month may have no room for its name before the next one.
  const shownLabels = monthLabels.filter((label, i) => {
    const next = monthLabels[i + 1];
    return !next || next.x - label.x >= STEP * 2;
  });

  const weekdayLabels = [1, 3, 5].map((row) => ({
    row,
    text: addDays(gridStart, row).toLocaleDateString(undefined, { weekday: "short" }),
  }));

  return (
    <WidgetCard className="calendar-heatmap-widget">
      <WidgetHeader icon={mdiCalendarMonthOutline} title="Transaction Calendar Heatmap" />
      <Box className="calendar-heatmap-widget__body" ref={bodyRef}>
        {daily.isPending ? (
          <Skeleton variant="rounded" sx={{ width: "100%", height: "100%" }} />
        ) : (
          <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Daily expense">
            {shownLabels.map((label) => (
              <text key={label.key} x={label.x} y={10} className="heatmap__label">
                {label.text}
              </text>
            ))}
            {weekdayLabels.map((label) => (
              <text key={label.row} x={0} y={TOP + label.row * STEP + CELL - 2} className="heatmap__label">
                {label.text}
              </text>
            ))}
            {cells}
          </svg>
        )}
      </Box>
    </WidgetCard>
  );
}

/** The content width of an element, kept up to date as it resizes. 0 until measured. */
function useWidth(ref: RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry?.contentRect.width ?? 0));
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}
