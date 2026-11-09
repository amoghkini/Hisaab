import { mdiRhombusSplitOutline, mdiSortVariant } from "@mdi/js";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import LinearProgress from "@mui/material/LinearProgress";
import Skeleton from "@mui/material/Skeleton";

import type { PeriodRange } from "@/api/overview";
import { CategoryIcon } from "@/components/CategoryIcon";
import { useExpenseRanking, useMoney, useOverview } from "@/pages/overview/OverviewContext";
import { WidgetCard, WidgetEmpty, WidgetHeader } from "@/pages/overview/WidgetCard";

function formatPercent(percent: number): string {
  if (percent > 0 && percent < 0.01) return "<0.01%";
  return `${percent.toFixed(2)}%`;
}

/** The categories with the most expense in a period, with their share of it. */
export function ExpenseRankingWidget({ range, itemCount }: { range: PeriodRange; itemCount: number }) {
  const ranking = useExpenseRanking(range, itemCount);
  const money = useMoney();
  const { notAvailable } = useOverview();
  const items = ranking.data?.items ?? [];

  return (
    <WidgetCard className="expense-ranking-widget">
      <WidgetHeader icon={mdiSortVariant} title="Expense Category Ranking" />
      <Box className="overview-widget__body">
        {ranking.isPending &&
          Array.from({ length: itemCount }, (_, index) => <Skeleton key={index} height={36} sx={{ mb: 0.5 }} />)}

        {ranking.data && !items.length && <WidgetEmpty icon={mdiRhombusSplitOutline} />}

        {items.map((item) => {
          const color = item.color ?? "var(--mui-palette-text-primary)";
          return (
            <ButtonBase key={item.category_id} className="expense-ranking-widget__item" onClick={() => notAvailable("The transaction list")}>
              <span className="overview-widget__item-icon">
                <CategoryIcon icon={item.icon} color={item.color} size={20} />
              </span>
              <span className="expense-ranking-widget__text">
                <span className="expense-ranking-widget__label-row">
                  <span className="expense-ranking-widget__name" title={item.name}>
                    {item.name}
                  </span>
                  <span className="overview-widget__amount expense-ranking-widget__amount">{money(item.amount)}</span>
                </span>
                <span className="expense-ranking-widget__progress">
                  <LinearProgress
                    variant="determinate"
                    value={item.percent}
                    aria-label={item.name}
                    sx={{
                      flex: 1,
                      height: 5,
                      borderRadius: 3,
                      bgcolor: `color-mix(in srgb, ${color} 12%, transparent)`,
                      "& .MuiLinearProgress-bar": { bgcolor: color, borderRadius: 3 },
                    }}
                  />
                  <small className="expense-ranking-widget__percent">{formatPercent(item.percent)}</small>
                </span>
              </span>
            </ButtonBase>
          );
        })}
      </Box>
    </WidgetCard>
  );
}
