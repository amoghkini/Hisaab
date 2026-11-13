import Box from "@mui/material/Box";
import type { CSSProperties } from "react";

import { DEFAULT_LAYOUT, FIXED_HEIGHT_TYPES, GAP, ROW_HEIGHT, type WidgetLayout } from "@/pages/overview/layout";
import { OverviewProvider } from "@/pages/overview/OverviewContext";
import { AssetSummaryWidget } from "@/pages/overview/widgets/AssetSummaryWidget";
import { CalendarHeatmapWidget } from "@/pages/overview/widgets/CalendarHeatmapWidget";
import { DraftTransactionsWidget } from "@/pages/overview/widgets/DraftTransactionsWidget";
import { ExpenseRankingWidget } from "@/pages/overview/widgets/ExpenseRankingWidget";
import { ExpenseTrendWidget } from "@/pages/overview/widgets/ExpenseTrendWidget";
import { MonthOverviewWidget } from "@/pages/overview/widgets/MonthOverviewWidget";
import { PeriodIncomeExpenseWidget } from "@/pages/overview/widgets/PeriodIncomeExpenseWidget";
import { RecentTransactionsWidget } from "@/pages/overview/widgets/RecentTransactionsWidget";
import { TransactionCalendarWidget } from "@/pages/overview/widgets/TransactionCalendarWidget";
import "@/pages/overview/overview.css";

function Widget({ widget }: { widget: WidgetLayout }) {
  switch (widget.type) {
    case "month-overview":
      return <MonthOverviewWidget />;
    case "asset-summary":
      return <AssetSummaryWidget />;
    case "calendar-heatmap":
      return <CalendarHeatmapWidget months={widget.months} />;
    case "transaction-calendar":
      return <TransactionCalendarWidget />;
    case "expense-ranking":
      return <ExpenseRankingWidget range={widget.range} itemCount={widget.itemCount} />;
    case "expense-trend":
      return <ExpenseTrendWidget months={widget.months} />;
    case "period-income-expense":
      return <PeriodIncomeExpenseWidget range={widget.range} />;
    case "recent-transactions":
      return <RecentTransactionsWidget />;
    case "draft-transactions":
      return <DraftTransactionsWidget />;
  }
}

/** The dashboard: widgets on a 12-column grid, after ezBookkeeping's overview page. Stacks on small screens. */
export function OverviewDashboard({ layout = DEFAULT_LAYOUT }: { layout?: WidgetLayout[] }) {
  const rows = Math.max(1, ...layout.map((widget) => widget.y + widget.h));
  const sorted = [...layout].sort((a, b) => a.y - b.y || a.x - b.x);

  return (
    <OverviewProvider>
      <Box
        className="overview-dashboard"
        style={
          {
            "--overview-row-height": `${ROW_HEIGHT}px`,
            "--overview-gap": `${GAP}px`,
            minHeight: rows * ROW_HEIGHT + (rows - 1) * GAP,
          } as CSSProperties
        }
      >
        {sorted.map((widget) => (
          <Box
            key={widget.id}
            className={`overview-dashboard__item${FIXED_HEIGHT_TYPES.includes(widget.type) ? " overview-dashboard__item--fixed" : ""}`}
            style={
              {
                gridColumn: `${widget.x + 1} / span ${widget.w}`,
                gridRow: `${widget.y + 1} / span ${widget.h}`,
                "--overview-item-height": `${widget.h * ROW_HEIGHT + (widget.h - 1) * GAP}px`,
              } as CSSProperties
            }
          >
            <Widget widget={widget} />
          </Box>
        ))}
      </Box>
    </OverviewProvider>
  );
}
