import { mdiEyeOffOutline, mdiEyeOutline, mdiRefresh } from "@mdi/js";
import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Skeleton from "@mui/material/Skeleton";
import Tooltip from "@mui/material/Tooltip";
import { useIsFetching, useQueryClient } from "@tanstack/react-query";

import { MdiIcon } from "@/components/MdiIcon";
import { OVERVIEW_KEY, useMoney, useOverview, usePeriodSummary } from "@/pages/overview/OverviewContext";
import { WidgetCard } from "@/pages/overview/WidgetCard";

/** This month's expense, big, with the income below it. Its refresh button reloads the whole dashboard. */
export function MonthOverviewWidget() {
  const summary = usePeriodSummary("this_month");
  const money = useMoney();
  const { showAmounts, toggleShowAmounts } = useOverview();
  const navigate = useNavigate();
  const client = useQueryClient();
  const refreshing = useIsFetching({ queryKey: [OVERVIEW_KEY] }) > 0;
  const monthName = new Date().toLocaleDateString(undefined, { month: "long" });

  return (
    <WidgetCard className="monthly-expense-widget">
      <Box className="monthly-expense-widget__title">
        <span className="monthly-expense-widget__month">{monthName}</span>
        <span className="monthly-expense-widget__dot">·</span>
        <span className="monthly-expense-widget__label">Expense</span>
        <Tooltip title="Refresh">
          <IconButton
            size="small"
            aria-label="Refresh"
            disabled={refreshing}
            onClick={() => void client.invalidateQueries({ queryKey: [OVERVIEW_KEY] })}
            sx={{ ml: 1 }}
          >
            {refreshing ? <CircularProgress size={20} /> : <MdiIcon path={mdiRefresh} />}
          </IconButton>
        </Tooltip>
      </Box>

      <Box className="monthly-expense-widget__content">
        <Box sx={{ display: "flex", alignItems: "center", mt: 1 }}>
          <span className="monthly-expense-widget__amount overview-widget__amount">
            {summary.data ? money(summary.data.expense) : <Skeleton width={140} />}
          </span>
          <IconButton size="small" color="primary" aria-label={showAmounts ? "Hide amounts" : "Show amounts"} onClick={toggleShowAmounts} sx={{ ml: 0.5 }}>
            <MdiIcon path={showAmounts ? mdiEyeOffOutline : mdiEyeOutline} sx={{ fontSize: 20 }} />
          </IconButton>
        </Box>

        <Box className="monthly-expense-widget__income">
          <span className="monthly-expense-widget__income-dot" />
          <span className="monthly-expense-widget__income-label">Monthly income</span>
          <strong className="overview-widget__amount">{summary.data ? money(summary.data.income) : <Skeleton width={90} />}</strong>
        </Box>

        <Button className="overview-tonal-button" sx={{ mt: 2 }} onClick={() => void navigate("/transactions")}>
          View Details
        </Button>
      </Box>

      <MonthIllustration />
    </WidgetCard>
  );
}

/** A bill, a ring chart and coins. From ezBookkeeping's MonthlyExpenseOverviewWidget.vue (MIT). */
function MonthIllustration() {
  return (
    <div className="monthly-expense-widget__illustration" aria-hidden="true">
      <svg viewBox="0 0 168 132" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle className="mei-halo" cx="112" cy="73" r="52" />
        <circle className="mei-dot" cx="151" cy="25" r="4" />
        <circle className="mei-dot mei-dot--muted" cx="18" cy="108" r="3" />
        <g className="mei-paper">
          <rect x="28" y="16" width="78" height="101" rx="12" />
          <path d="M85 16H94C100.627 16 106 21.3726 106 28V38L85 16Z" />
          <rect className="mei-line" x="43" y="39" width="34" height="6" rx="3" />
          <rect className="mei-line mei-line--short" x="43" y="53" width="49" height="4" rx="2" />
          <rect className="mei-line mei-line--short" x="43" y="64" width="39" height="4" rx="2" />
          <rect className="mei-total" x="42" y="84" width="49" height="18" rx="6" />
          <path className="mei-total-line" d="M50 93H68" />
        </g>
        <g className="mei-chart">
          <circle cx="117" cy="82" r="29" />
          <circle className="mei-chart-track" cx="117" cy="82" r="18" />
          <circle className="mei-chart-value" cx="117" cy="82" r="18" pathLength="100" />
          <circle className="mei-chart-center" cx="117" cy="82" r="8" />
        </g>
        <g className="mei-coins">
          <ellipse cx="139" cy="111" rx="15" ry="5" />
          <path d="M124 104V111C124 113.761 130.716 116 139 116C147.284 116 154 113.761 154 111V104" />
          <ellipse cx="139" cy="104" rx="15" ry="5" />
        </g>
      </svg>
    </div>
  );
}
