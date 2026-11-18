import { mdiFileDocumentEditOutline } from "@mdi/js";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import type { ReactNode } from "react";
import { Link as RouterLink } from "react-router-dom";

import { payMonthName } from "@/api/salary";
import { MdiIcon } from "@/components/MdiIcon";
import { usePayslips } from "@/pages/salary/queries";

type ActionItem = { key: string; icon: string; message: ReactNode; action: string; to: string };

/** Payslips drafted on pay day that are still waiting to be checked and approved. */
function usePayslipActions(): ActionItem[] {
  const drafts = usePayslips({ status: "draft" });
  const list = drafts.data ?? [];
  if (list.length === 0) return [];
  if (list.length === 1) {
    const payslip = list[0]!;
    return [
      {
        key: "payslips",
        icon: mdiFileDocumentEditOutline,
        message: `Your ${payMonthName(payslip.pay_month)} payslip from ${payslip.employer_name} is waiting for your review.`,
        action: "Review",
        to: `/salary/payslips/${payslip.id}`,
      },
    ];
  }
  return [
    {
      key: "payslips",
      icon: mdiFileDocumentEditOutline,
      message: `${list.length} payslips are waiting for your review.`,
      action: "Review them",
      to: "/salary/payslips?status=draft",
    },
  ];
}

/**
 * Things waiting for the user, at the top of the dashboard. Shows nothing when there is nothing to do, and stays
 * quiet while loading or if a source fails: the page each item links to reports its own errors.
 */
export function ActionItems() {
  const items = [...usePayslipActions()];
  if (items.length === 0) return null;

  return (
    <Box component="section" aria-label="Needs your attention" sx={{ display: "flex", flexDirection: "column", gap: 1, mb: 2 }}>
      {items.map((item) => (
        <Alert
          key={item.key}
          severity="warning"
          icon={<MdiIcon path={item.icon} />}
          sx={{ alignItems: "center" }}
          action={
            <Button color="inherit" size="small" component={RouterLink} to={item.to}>
              {item.action}
            </Button>
          }
        >
          {item.message}
        </Alert>
      ))}
    </Box>
  );
}
