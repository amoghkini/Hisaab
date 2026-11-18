import { ActionItems } from "@/pages/overview/ActionItems";
import { OverviewDashboard } from "@/pages/overview/OverviewDashboard";

/** The dashboard: anything waiting for the user first, then the widgets. Both are in pages/overview. */
export function HomePage() {
  return (
    <>
      <ActionItems />
      <OverviewDashboard />
    </>
  );
}
