import { mdiBriefcaseOutline, mdiChartTimelineVariant, mdiPlus, mdiViewGridOutline } from "@mdi/js";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import { useState } from "react";
import { Link as RouterLink, useSearchParams } from "react-router-dom";

import { errorMessage } from "@/api/client";
import type { Employer } from "@/api/salary";
import { MdiIcon } from "@/components/MdiIcon";
import { useAccounts } from "@/pages/accounts/queries";
import { EmployerOnboardingDialog } from "@/pages/salary/EmployerOnboardingDialog";
import { EmployerTimeline } from "@/pages/salary/EmployerTimeline";
import { useEmployers } from "@/pages/salary/queries";
import { SalaryAmount } from "@/pages/salary/SalaryAmount";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Jun 2023". */
export function monthYear(iso: string): string {
  const [year, month] = iso.split("-");
  return `${MONTHS[Number(month) - 1] ?? ""} ${year}`;
}

/** "Jun 2023 – now", or "Jan 2018 – May 2023". */
export function tenure(employer: Employer): string {
  return `${monthYear(employer.joined_on)} – ${employer.left_on ? monthYear(employer.left_on) : "now"}`;
}

function EmployerCard({ employer, accountName }: { employer: Employer; accountName: string | null }) {
  return (
    <Paper
      variant="outlined"
      component={RouterLink}
      to={`/salary/employers/${employer.id}`}
      sx={{ borderRadius: 3, p: 2.5, display: "flex", flexDirection: "column", gap: 1.5, color: "inherit", textDecoration: "none", minWidth: 0, "&:hover": { borderColor: "primary.main" } }}
    >
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
        <Box sx={{ width: 40, height: 40, borderRadius: 2, display: "grid", placeItems: "center", bgcolor: "rgb(var(--mui-palette-primary-mainChannel) / 0.1)", color: "primary.main", flex: "none" }}>
          <MdiIcon path={mdiBriefcaseOutline} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {employer.name}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {[employer.designation, tenure(employer)].filter(Boolean).join(" · ")}
          </Typography>
        </Box>
        <Chip size="small" label={employer.is_current ? "Current" : "Past"} color={employer.is_current ? "primary" : "default"} variant="outlined" />
      </Box>
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 1.5 }}>
        <Box>
          <Typography variant="caption" color="text.secondary">
            Take-home a month
          </Typography>
          <Typography sx={{ fontWeight: 600 }}>{employer.monthly ? <SalaryAmount value={employer.monthly.net} /> : "—"}</Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">
            CTC a year
          </Typography>
          <Typography sx={{ fontWeight: 600 }}>{employer.yearly ? <SalaryAmount value={employer.yearly.ctc} /> : "—"}</Typography>
        </Box>
      </Box>
      <Typography variant="body2" color={employer.salary_account_ok ? "text.secondary" : "warning.main"}>
        {!employer.salary_account_ok ? "Salary account needs attention" : accountName ? `Paid into ${accountName}` : "No salary account set"}
      </Typography>
    </Paper>
  );
}

/** Every employer, current ones first, and the way in to add one. */
export function EmployersPage() {
  const employers = useEmployers();
  const accounts = useAccounts();
  const [adding, setAdding] = useState(false);
  // The view lives in the URL (`?view=timeline`), so a reload or a shared link keeps it.
  const [params, setParams] = useSearchParams();
  const view = params.get("view") === "timeline" ? "timeline" : "cards";
  const accountName = (id: number | null) => accounts.data?.find((account) => account.id === id)?.name ?? null;

  return (
    <>
      <Box sx={{ display: "flex", alignItems: { xs: "flex-start", sm: "center" }, flexDirection: { xs: "column", sm: "row" }, gap: 1.5, mb: 2.5 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h5" component="h1">
            Employers and salary structure
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Every job you have had, the salary components each one pays, and how your pay has grown.
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1.5, alignItems: "center", flexWrap: "wrap" }}>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={view}
            onChange={(_, next: string | null) => {
              if (next) setParams(next === "timeline" ? { view: "timeline" } : {}, { replace: true });
            }}
            aria-label="View"
          >
            <ToggleButton value="cards" aria-label="Cards">
              <MdiIcon path={mdiViewGridOutline} fontSize="small" />
              <Box component="span" sx={{ ml: 0.75 }}>
                Cards
              </Box>
            </ToggleButton>
            <ToggleButton value="timeline" aria-label="Timeline">
              <MdiIcon path={mdiChartTimelineVariant} fontSize="small" />
              <Box component="span" sx={{ ml: 0.75 }}>
                Timeline
              </Box>
            </ToggleButton>
          </ToggleButtonGroup>
          <Button startIcon={<MdiIcon path={mdiPlus} />} onClick={() => setAdding(true)} disabled={employers.isPending}>
            Add employer
          </Button>
        </Box>
      </Box>

      {employers.isPending ? (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)", xl: "repeat(3, 1fr)" }, gap: 2 }}>
          {[0, 1, 2].map((key) => (
            <Skeleton key={key} variant="rounded" height={170} />
          ))}
        </Box>
      ) : employers.isError ? (
        <Alert severity="error">Could not load your employers. {errorMessage(employers.error)}</Alert>
      ) : employers.data.length === 0 ? (
        <Paper variant="outlined" sx={{ borderRadius: 3, p: { xs: 3, sm: 5 }, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 1.5 }}>
          <MdiIcon path={mdiBriefcaseOutline} sx={{ fontSize: 40, color: "text.secondary" }} />
          <Typography variant="h6">No employers yet</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 520 }}>
            Add your current job with the yearly salary components from your offer letter. Hisaab works out the monthly figures your payslips start from. Past jobs can be added too.
          </Typography>
          <Button startIcon={<MdiIcon path={mdiPlus} />} onClick={() => setAdding(true)}>
            Add employer
          </Button>
        </Paper>
      ) : view === "timeline" ? (
        <EmployerTimeline employers={employers.data} />
      ) : (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(2, minmax(0, 1fr))", xl: "repeat(3, minmax(0, 1fr))" }, gap: 2 }}>
          {employers.data.map((employer) => (
            <EmployerCard key={employer.id} employer={employer} accountName={accountName(employer.salary_account_id)} />
          ))}
        </Box>
      )}

      {adding ? <EmployerOnboardingDialog employers={employers.data ?? []} onClose={() => setAdding(false)} /> : null}
    </>
  );
}
