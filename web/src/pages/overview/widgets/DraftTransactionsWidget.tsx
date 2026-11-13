import { mdiMessageProcessingOutline, mdiTrayFull } from "@mdi/js";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";

import { MdiIcon } from "@/components/MdiIcon";
import { WidgetCard, WidgetHeader } from "@/pages/overview/WidgetCard";

/**
 * A placeholder. The Android app will read bank SMS, send it to the server, and the server will turn it into draft
 * transactions to approve here. None of that exists yet, so this only says so.
 */
export function DraftTransactionsWidget() {
  return (
    <WidgetCard className="draft-transactions-widget">
      <WidgetHeader icon={mdiTrayFull} title="Draft Transactions">
        <Chip label="Coming soon" size="small" color="primary" variant="outlined" />
      </WidgetHeader>
      <Box className="overview-widget__body">
        <Box className="overview-widget__empty draft-transactions-widget__empty">
          <MdiIcon path={mdiMessageProcessingOutline} sx={{ fontSize: 32 }} />
          <strong>Drafts from your bank SMS</strong>
          <span>
            Transactions the Hisaab Android app detects in your messages and sends to the server will wait here for you to approve into your ledger.
          </span>
        </Box>
      </Box>
    </WidgetCard>
  );
}
