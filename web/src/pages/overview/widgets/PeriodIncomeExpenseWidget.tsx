import {
  mdiCalendarMonthOutline,
  mdiCalendarTodayOutline,
  mdiCalendarWeekOutline,
  mdiDotsVertical,
  mdiLayersTripleOutline,
  mdiListBoxOutline,
} from "@mdi/js";
import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Skeleton from "@mui/material/Skeleton";
import { useState } from "react";

import type { PeriodRange, PeriodSummary } from "@/api/overview";
import { MdiIcon } from "@/components/MdiIcon";
import { parseIsoDate } from "@/lib/dates";
import { useMoney, usePeriodSummary } from "@/pages/overview/OverviewContext";
import { WidgetCard, WidgetHeader } from "@/pages/overview/WidgetCard";

const PERIODS: Record<PeriodRange, { title: string; icon: string }> = {
  today: { title: "Today", icon: mdiCalendarTodayOutline },
  this_week: { title: "This Week", icon: mdiCalendarWeekOutline },
  this_month: { title: "This Month", icon: mdiCalendarMonthOutline },
  this_year: { title: "This Year", icon: mdiLayersTripleOutline },
};

function describeDates(summary: PeriodSummary): string {
  const start = parseIsoDate(summary.start);
  const end = parseIsoDate(summary.end);
  switch (summary.range) {
    case "today":
      return start.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    case "this_month":
      return start.toLocaleDateString(undefined, { year: "numeric", month: "long" });
    case "this_year":
      return String(start.getFullYear());
    case "this_week":
      return new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "numeric" }).formatRange(start, end);
  }
}

/** Income and expense over one period: today, this week, this month or this year. */
export function PeriodIncomeExpenseWidget({ range }: { range: PeriodRange }) {
  const summary = usePeriodSummary(range);
  const money = useMoney();
  const navigate = useNavigate();
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const period = PERIODS[range];
  const data = summary.data;

  return (
    <WidgetCard className="period-income-expense-widget">
      <WidgetHeader icon={period.icon} title={period.title}>
        <IconButton size="small" aria-label="More" onClick={(event) => setMenuAnchor(event.currentTarget)}>
          <MdiIcon path={mdiDotsVertical} />
        </IconButton>
        <Menu anchorEl={menuAnchor} open={menuAnchor !== null} onClose={() => setMenuAnchor(null)}>
          <MenuItem
            onClick={() => {
              setMenuAnchor(null);
              void navigate("/transactions");
            }}
          >
            <ListItemIcon>
              <MdiIcon path={mdiListBoxOutline} fontSize="small" />
            </ListItemIcon>
            View Details
          </MenuItem>
        </Menu>
      </WidgetHeader>

      <Box className="overview-widget__body period-income-expense-widget__body">
        <div className="period-income-expense-widget__content">
          <div className="period-income-expense-widget__metrics">
            <Stat label="Income" kind="income" value={data?.income} format={money} />
            <Stat label="Expense" kind="expense" value={data?.expense} format={money} />
          </div>
          <PeriodIllustration />
        </div>
        <div className="overview-widget__footer">{data ? describeDates(data) : <Skeleton width={120} />}</div>
      </Box>
    </WidgetCard>
  );
}

function Stat({ label, kind, value, format }: { label: string; kind: "income" | "expense"; value: number | undefined; format: (minor: number) => string }) {
  return (
    <div className="overview-widget__stat">
      <span className="overview-widget__caption">
        <span className={`overview-widget__dot overview-widget__dot--${kind}`} />
        {label}
      </span>
      {value === undefined ? (
        <Skeleton width={120} height={30} />
      ) : (
        <div className={`overview-widget__amount period-income-expense-widget__amount ${value ? `overview-amount--${kind}` : "overview-amount--none"}`}>
          {value ? format(value) : "No data"}
        </div>
      )}
    </div>
  );
}

/** Shown when the widget is wide enough. From ezBookkeeping's PeriodIncomeExpenseWidget.vue (MIT). */
function PeriodIllustration() {
  return (
    <svg className="period-income-expense-widget__illustration" viewBox="0 0 144 112" fill="none" aria-hidden="true" focusable="false">
      <circle cx="78" cy="57" r="45" fill="currentColor" opacity="0.055" />
      <circle cx="124" cy="20" r="3" fill="currentColor" opacity="0.2" />
      <circle cx="18" cy="89" r="2" fill="currentColor" opacity="0.2" />
      <rect className="piei-paper" x="40" y="17" width="65" height="80" rx="10" />
      <path d="M54 34H76M54 44H90M54 54H80" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.18" />
      <rect x="53" y="69" width="39" height="14" rx="5" fill="currentColor" opacity="0.08" />
      <path d="M60 76H76" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.3" />
      <g className="piei-flow">
        <circle cx="34" cy="44" r="17" />
        <path d="M26 44H42M36 38L42 44L36 50" />
        <circle cx="108" cy="79" r="17" />
        <path d="M100 79H116M106 73L100 79L106 85" />
      </g>
    </svg>
  );
}
