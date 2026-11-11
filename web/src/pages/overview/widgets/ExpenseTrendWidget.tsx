import { mdiPoll } from "@mdi/js";
import Box from "@mui/material/Box";
import Skeleton from "@mui/material/Skeleton";
import Tooltip from "@mui/material/Tooltip";
import { useId, useState } from "react";

import { useMoney, useMonthlyAmounts } from "@/pages/overview/OverviewContext";
import { WidgetCard, WidgetHeader } from "@/pages/overview/WidgetCard";
import { parseIsoDate } from "@/lib/dates";

/** Room above the highest point, as a share of the chart height. */
const TOP_ROOM = 0.12;

/**
 * A smooth line through the points that never overshoots them (monotone cubic interpolation), so the area never
 * dips below zero between months.
 */
function smoothLine(points: [number, number][]): string {
  const n = points.length;
  const [first] = points;
  if (!first) return "";
  if (n === 1) return `M${first[0]},${first[1]}`;

  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);
  const slopes = xs.slice(0, -1).map((x, i) => (ys[i + 1]! - ys[i]!) / (xs[i + 1]! - x));
  const tangents = xs.map((_, i) => {
    if (i === 0) return slopes[0]!;
    if (i === n - 1) return slopes[n - 2]!;
    const before = slopes[i - 1]!;
    const after = slopes[i]!;
    return before * after <= 0 ? 0 : (before + after) / 2;
  });
  slopes.forEach((slope, i) => {
    if (slope === 0) {
      tangents[i] = 0;
      tangents[i + 1] = 0;
      return;
    }
    const a = tangents[i]! / slope;
    const b = tangents[i + 1]! / slope;
    const size = a * a + b * b;
    if (size > 9) {
      const scale = 3 / Math.sqrt(size);
      tangents[i] = scale * a * slope;
      tangents[i + 1] = scale * b * slope;
    }
  });

  let path = `M${xs[0]},${ys[0]}`;
  for (let i = 0; i < n - 1; i += 1) {
    const h = xs[i + 1]! - xs[i]!;
    path += ` C${xs[i]! + h / 3},${ys[i]! + (tangents[i]! * h) / 3} ${xs[i + 1]! - h / 3},${ys[i + 1]! - (tangents[i + 1]! * h) / 3} ${xs[i + 1]},${ys[i + 1]}`;
  }
  return path;
}

/** Expense for each of the last months, as a smooth area chart. Hover a month to see its amount. */
export function ExpenseTrendWidget({ months }: { months: number }) {
  const monthly = useMonthlyAmounts(months);
  const money = useMoney();
  const gradientId = useId();
  const [hovered, setHovered] = useState<number | null>(null);
  const data = monthly.data ?? [];

  const max = Math.max(1, ...data.map((month) => month.expense));
  const points: [number, number][] = data.map((month, i) => [
    data.length === 1 ? 50 : (i / (data.length - 1)) * 100,
    100 - (month.expense / max) * (100 * (1 - TOP_ROOM)),
  ]);
  const line = smoothLine(points);
  const hoveredPoint = hovered === null ? undefined : points[hovered];
  const hoverWidth = data.length > 1 ? 100 / (data.length - 1) : 100;

  return (
    <WidgetCard className="expense-trend-widget">
      <WidgetHeader icon={mdiPoll} title="Expense Trends" />
      <Box className="expense-trend-widget__chart" onMouseLeave={() => setHovered(null)}>
        {monthly.isPending ? (
          <Skeleton variant="rounded" sx={{ position: "absolute", inset: 0, height: "auto" }} />
        ) : (
          <>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" style={{ stopColor: "var(--hk-expense-color)", stopOpacity: 0.32 }} />
                  <stop offset="100%" style={{ stopColor: "var(--hk-expense-color)", stopOpacity: 0 }} />
                </linearGradient>
              </defs>
              <path d={`${line} L100,100 L0,100 Z`} fill={`url(#${gradientId})`} />
              <path d={line} fill="none" className="expense-trend-widget__line" vectorEffect="non-scaling-stroke" />
            </svg>

            {hoveredPoint && (
              <>
                <span className="expense-trend-widget__guide" style={{ left: `${hoveredPoint[0]}%` }} />
                <span className="expense-trend-widget__point" style={{ left: `${hoveredPoint[0]}%`, top: `${hoveredPoint[1]}%` }} />
              </>
            )}

            <div className="expense-trend-widget__hover">
              {data.map((month, i) => (
                <Tooltip
                  key={month.month}
                  followCursor
                  title={`${parseIsoDate(`${month.month}-01`).toLocaleDateString(undefined, { year: "numeric", month: "long" })}: ${money(month.expense)}`}
                >
                  {/* A strip centred on the month's point. */}
                  <span
                    onMouseEnter={() => setHovered(i)}
                    style={{ left: `${(points[i]?.[0] ?? 0) - hoverWidth / 2}%`, width: `${hoverWidth}%` }}
                  />
                </Tooltip>
              ))}
            </div>
          </>
        )}
      </Box>
    </WidgetCard>
  );
}
