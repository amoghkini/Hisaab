import { mdiBankOutline, mdiCreditCardOutline, mdiPiggyBankOutline } from "@mdi/js";
import Box from "@mui/material/Box";
import Skeleton from "@mui/material/Skeleton";

import { MdiIcon } from "@/components/MdiIcon";
import { useAssetSummary, useMoney } from "@/pages/overview/OverviewContext";
import { WidgetCard, WidgetHeader } from "@/pages/overview/WidgetCard";

/** Total assets, liabilities and net assets over all accounts. */
export function AssetSummaryWidget() {
  const summary = useAssetSummary();
  const money = useMoney();
  const data = summary.data;

  const metrics = [
    { title: "Total assets", value: data?.total_assets, icon: mdiBankOutline, tone: "neutral" },
    { title: "Total liabilities", value: data?.total_liabilities, icon: mdiCreditCardOutline, tone: "expense" },
    { title: "Net assets", value: data?.net_assets, icon: mdiPiggyBankOutline, tone: "primary" },
  ] as const;

  return (
    <WidgetCard className="asset-summary-widget">
      <WidgetHeader icon={mdiBankOutline} title="Asset Summary" />
      <Box className="overview-widget__body">
        <div className="overview-widget__caption">
          {data ? `You have ${data.account_count} ${data.account_count === 1 ? "account" : "accounts"}` : <Skeleton width={160} />}
        </div>
        <div className="asset-summary-widget__metrics">
          {metrics.map((metric) => (
            <div key={metric.title} className={`asset-summary-widget__metric asset-summary-widget__metric--${metric.tone}`}>
              <span className="asset-summary-widget__avatar">
                <MdiIcon path={metric.icon} sx={{ fontSize: 24 }} />
              </span>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25, minWidth: 0 }}>
                <span className="overview-widget__caption">{metric.title}</span>
                <span className="overview-widget__amount asset-summary-widget__value">
                  {metric.value === undefined ? <Skeleton width={110} /> : money(metric.value)}
                </span>
              </Box>
            </div>
          ))}
        </div>
      </Box>
    </WidgetCard>
  );
}
