import { mdiChevronRight, mdiFileDocumentEditOutline, mdiPlus } from "@mdi/js";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { Link as RouterLink, useSearchParams } from "react-router-dom";

import { errorMessage } from "@/api/client";
import { payMonthName, type Payslip, type PayslipStatus } from "@/api/salary";
import { MdiIcon } from "@/components/MdiIcon";
import { useEmployers, usePayslips } from "@/pages/salary/queries";
import { SalaryAmount } from "@/pages/salary/SalaryAmount";

export const STATUS_CHIP: Record<PayslipStatus, { label: string; color: "warning" | "success" }> = {
  draft: { label: "To review", color: "warning" },
  posted: { label: "Approved", color: "success" },
};

function Figure({ label, value, strong = false }: { label: string; value: number; strong?: boolean }) {
  return (
    <Box sx={{ minWidth: 0, textAlign: { md: "right" } }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: { md: "none" } }}>
        {label}
      </Typography>
      <Typography sx={{ fontWeight: strong ? 600 : 400, whiteSpace: "nowrap" }}>
        <SalaryAmount value={value} />
      </Typography>
    </Box>
  );
}

const rowColumns = { xs: "repeat(3, minmax(0, 1fr))", md: "minmax(0, 2fr) 104px repeat(3, minmax(96px, 1fr)) 20px" };

/** The payslip list reads as a ledger, so it keeps to a compact, centred column rather than stretching across wide screens. */
const PAGE_WIDTH = 960;

function PayslipRow({ payslip }: { payslip: Payslip }) {
  const chip = STATUS_CHIP[payslip.status];
  return (
    <Paper
      variant="outlined"
      component={RouterLink}
      to={`/salary/payslips/${payslip.id}`}
      sx={{
        display: "grid",
        gridTemplateColumns: rowColumns,
        alignItems: "center",
        columnGap: 2,
        rowGap: 0.5,
        px: 2,
        py: 1,
        borderRadius: 2,
        color: "inherit",
        textDecoration: "none",
        "&:hover": { borderColor: "primary.main" },
      }}
    >
      <Box sx={{ gridColumn: { xs: "1 / -1", md: "auto" }, minWidth: 0, display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontWeight: 600 }}>{payMonthName(payslip.pay_month)}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {payslip.employer_name} · paid {payslip.pay_date}
          </Typography>
        </Box>
        <Chip size="small" label={chip.label} color={chip.color} variant="outlined" sx={{ display: { md: "none" }, ml: "auto" }} />
      </Box>
      <Box sx={{ display: { xs: "none", md: "block" } }}>
        <Chip size="small" label={chip.label} color={chip.color} variant="outlined" />
      </Box>
      <Figure label="Gross" value={payslip.totals.gross} />
      <Figure label="Deductions" value={payslip.totals.deductions} />
      <Figure label="Take-home" value={payslip.totals.net} strong />
      <Box sx={{ display: { xs: "none", md: "flex" }, color: "text.secondary" }}>
        <MdiIcon path={mdiChevronRight} />
      </Box>
    </Paper>
  );
}

/** Every payslip, newest month first: drafts made on pay day wait here for review and approval. */
export function PayslipsPage() {
  const [params, setParams] = useSearchParams();
  const employerParam = params.get("employer");
  const statusParam = params.get("status");
  const employerId = employerParam ? Number(employerParam) : undefined;
  const status = statusParam === "draft" || statusParam === "posted" ? statusParam : undefined;
  const employers = useEmployers();
  const payslips = usePayslips({ employer_id: employerId, status });
  const drafts = usePayslips({ status: "draft" });
  const draftCount = drafts.data?.length ?? 0;

  function setFilter(key: string, value: string): void {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  }

  return (
    <Box sx={{ maxWidth: PAGE_WIDTH, mx: "auto" }}>
      <Box sx={{ display: "flex", alignItems: { xs: "flex-start", sm: "center" }, flexDirection: { xs: "column", sm: "row" }, gap: 1.5, mb: 2 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h5" component="h1">
            Payslips
          </Typography>
          <Typography variant="body2" color="text.secondary">
            On each pay day Hisaab drafts the month&apos;s payslip from your salary structure. Check it, change what differs, and approve it to add the take-home pay to your salary account.
          </Typography>
        </Box>
        <Button startIcon={<MdiIcon path={mdiPlus} />} component={RouterLink} to="/salary/payslips/new">
          Add a payslip
        </Button>
      </Box>

      {draftCount > 0 && status !== "draft" ? (
        <Alert
          severity="warning"
          icon={<MdiIcon path={mdiFileDocumentEditOutline} />}
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={() => setFilter("status", "draft")}>
              Show them
            </Button>
          }
        >
          {draftCount === 1 ? "1 payslip is waiting for your review." : `${draftCount} payslips are waiting for your review.`}
        </Alert>
      ) : null}

      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 1.5, maxWidth: { sm: 440 }, mb: 2 }}>
        <TextField select size="small" label="Employer" value={employerId ?? ""} onChange={(event) => setFilter("employer", event.target.value)}>
          <MenuItem value="">All employers</MenuItem>
          {(employers.data ?? []).map((employer) => (
            <MenuItem key={employer.id} value={employer.id}>
              {employer.name}
            </MenuItem>
          ))}
        </TextField>
        <TextField select size="small" label="Status" value={status ?? ""} onChange={(event) => setFilter("status", event.target.value)}>
          <MenuItem value="">All</MenuItem>
          <MenuItem value="draft">To review</MenuItem>
          <MenuItem value="posted">Approved</MenuItem>
        </TextField>
      </Box>

      {payslips.isPending ? (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {[0, 1, 2, 3].map((key) => (
            <Skeleton key={key} variant="rounded" height={56} />
          ))}
        </Box>
      ) : payslips.isError ? (
        <Alert severity="error">Could not load your payslips. {errorMessage(payslips.error)}</Alert>
      ) : payslips.data.length === 0 ? (
        <Paper variant="outlined" sx={{ borderRadius: 3, p: { xs: 3, sm: 5 }, textAlign: "center" }}>
          <Typography variant="h6">No payslips {status || employerId ? "match" : "yet"}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {employers.data?.length === 0 ? (
              <>
                Add your employer first, on{" "}
                <RouterLink to="/salary/employers">Employers and salary structure</RouterLink>.
              </>
            ) : (
              "Drafts appear on each pay day. Months from before you added the employer can be added by hand."
            )}
          </Typography>
        </Paper>
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <Box sx={{ display: { xs: "none", md: "grid" }, gridTemplateColumns: rowColumns, columnGap: 2, px: 2, color: "text.secondary" }}>
            <Typography variant="caption">Month</Typography>
            <Typography variant="caption">Status</Typography>
            <Typography variant="caption" sx={{ textAlign: "right" }}>
              Gross
            </Typography>
            <Typography variant="caption" sx={{ textAlign: "right" }}>
              Deductions
            </Typography>
            <Typography variant="caption" sx={{ textAlign: "right" }}>
              Take-home
            </Typography>
          </Box>
          {payslips.data.map((payslip) => (
            <PayslipRow key={payslip.id} payslip={payslip} />
          ))}
        </Box>
      )}
    </Box>
  );
}
