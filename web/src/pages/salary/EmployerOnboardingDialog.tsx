import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import { ApiError, errorMessage } from "@/api/client";
import { COMPONENT_KINDS, createEmployer, type Employer } from "@/api/salary";
import { StepsBar, type StepItem } from "@/components/StepsBar";
import { useAccounts } from "@/pages/accounts/queries";
import {
  EmploymentFields,
  PayFields,
  PfFields,
  employerChanges,
  employmentErrors,
  newEmployerDraft,
  payErrors,
  pfErrors,
  setEmployerField,
  type EmployerDraft,
  type EmployerErrors,
} from "@/pages/salary/EmployerForm";
import { storeEmployer } from "@/pages/salary/queries";
import { SalaryAmount } from "@/pages/salary/SalaryAmount";
import { StructureEditor, TotalsStrip, rowAmount, rowTotals, rowsToLines, starterRows, structureProblem, type StructureRow } from "@/pages/salary/StructureEditor";

const STEPS: StepItem[] = [
  { name: "employment", title: "Employment", subTitle: "Who and when" },
  { name: "pay", title: "Pay", subTitle: "Pay day and account" },
  { name: "pf", title: "Provident fund", subTitle: "UAN" },
  { name: "structure", title: "Salary", subTitle: "Yearly components" },
  { name: "review", title: "Review", subTitle: "Check and save" },
];

/** Which step a server error belongs on, so the person is taken to the field. */
const FIELD_STEP: Record<string, string> = {
  name: "employment",
  employee_code: "employment",
  joined_on: "employment",
  left_on: "employment",
  designation: "employment",
  pay_day: "pay",
  first_pay_on: "pay",
  salary_account_id: "pay",
  uan: "pf",
  comment: "pf",
  lines: "structure",
  yearly_amount: "structure",
};

function ReviewRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Box sx={{ display: "flex", gap: 2, py: 0.75, "& + &": { borderTop: 1, borderColor: "divider" } }}>
      <Typography variant="body2" color="text.secondary" sx={{ width: 150, flex: "none" }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 500, minWidth: 0, overflowWrap: "anywhere" }}>
        {children}
      </Typography>
    </Box>
  );
}

/**
 * Setting up an employer, one step at a time: the job, how it pays, the UAN, and the yearly salary components of
 * the offer. The yearly amounts make the monthly figures a payslip starts from.
 */
export function EmployerOnboardingDialog({ employers, onClose }: { employers: Employer[]; onClose: () => void }) {
  const theme = useTheme();
  const phone = useMediaQuery(theme.breakpoints.down("sm"));
  const navigate = useNavigate();
  const client = useQueryClient();
  const accounts = useAccounts();
  // The latest employer's UAN: it carries over between jobs.
  const previousUan = employers.find((employer) => employer.uan)?.uan ?? null;
  const [draft, setDraft] = useState<EmployerDraft>(() => newEmployerDraft(previousUan));
  const [rows, setRows] = useState<StructureRow[]>(starterRows);
  const [step, setStep] = useState(STEPS[0]!.name);
  const [serverError, setServerError] = useState<ApiError | null>(null);

  const stepErrors: Record<string, EmployerErrors> = {
    employment: employmentErrors(draft),
    pay: payErrors(draft),
    pf: pfErrors(draft),
  };
  const structureError = structureProblem(rows);
  const index = STEPS.findIndex((each) => each.name === step);
  const stepBlocked = (name: string) => (name === "structure" ? structureError !== null : Object.keys(stepErrors[name] ?? {}).length > 0);
  // Errors show once the person tries to move on, not while they are still typing.
  const [tried, setTried] = useState<Set<string>>(new Set());

  function change<K extends keyof EmployerDraft>(key: K, value: EmployerDraft[K]): void {
    setDraft((current) => setEmployerField(current, key, value));
    setServerError(null);
  }

  /** Go to a step; moving forward needs every step before it to be complete. */
  function goTo(name: string): void {
    const target = STEPS.findIndex((each) => each.name === name);
    for (let at = 0; at < target; at += 1) {
      const blocked = STEPS[at]!.name;
      if (stepBlocked(blocked)) {
        setTried((current) => new Set(current).add(blocked));
        setStep(blocked);
        return;
      }
    }
    setStep(name);
  }

  const save = useMutation({
    mutationFn: () => {
      const { first_pay_on, ...fields } = employerChanges(draft);
      return createEmployer({ ...fields, first_pay_on, designation: draft.designation.trim() || null, lines: rowsToLines(rows) });
    },
    onSuccess: async (employer) => {
      await storeEmployer(client, employer);
      onClose();
      navigate(`/salary/employers/${employer.id}`);
    },
    onError: (error) => {
      const apiError = error instanceof ApiError ? error : new ApiError(0, "error", errorMessage(error));
      setServerError(apiError);
      const field = Object.keys(apiError.fields)[0];
      if (field && FIELD_STEP[field]) setStep(FIELD_STEP[field]!);
    },
  });

  const busy = save.isPending;
  const shownErrors = (name: string) => (tried.has(name) ? (stepErrors[name] ?? {}) : {});
  const fieldProps = { draft, onChange: change, serverFields: serverError?.fields, disabled: busy };
  const account = accounts.data?.find((each) => each.id === draft.salaryAccountId);
  const last = index === STEPS.length - 1;

  return (
    <Dialog open onClose={busy ? undefined : onClose} maxWidth="md" fullWidth fullScreen={phone}>
      <DialogTitle>Add employer</DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 3 }}>
          <StepsBar steps={STEPS} currentStep={step} onStepChange={busy ? undefined : goTo} />
        </Box>

        {step === "employment" ? <EmploymentFields {...fieldProps} errors={shownErrors("employment")} /> : null}
        {step === "pay" ? <PayFields {...fieldProps} errors={shownErrors("pay")} accounts={accounts.data ?? []} /> : null}
        {step === "pf" ? <PfFields {...fieldProps} errors={shownErrors("pf")} prefilled={previousUan !== null && draft.uan === previousUan} /> : null}
        {step === "structure" ? (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Enter the yearly amounts from your offer letter. Each month&apos;s payslip will start from a twelfth of them; you can change any month before you approve it.
            </Typography>
            <StructureEditor rows={rows} onChange={setRows} disabled={busy} />
            {tried.has("structure") && structureError ? (
              <Alert severity="warning" sx={{ mt: 2 }}>
                {structureError}
              </Alert>
            ) : null}
          </>
        ) : null}
        {step === "review" ? (
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(2, minmax(0, 1fr))" }, gap: 3 }}>
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Employment
              </Typography>
              <ReviewRow label="Employer">{draft.name}</ReviewRow>
              <ReviewRow label="Designation">{draft.designation || "—"}</ReviewRow>
              <ReviewRow label="Employee ID">{draft.employeeCode || "—"}</ReviewRow>
              <ReviewRow label="Joined on">{draft.joinedOn}</ReviewRow>
              <ReviewRow label="Left on">{draft.leftOn || "Still working here"}</ReviewRow>
              <ReviewRow label="Pay day">{draft.payDay === 31 ? "Last day of the month" : `Day ${draft.payDay}`}</ReviewRow>
              <ReviewRow label="First salary on">{draft.firstPayOn}</ReviewRow>
              <ReviewRow label="Salary account">{account?.name ?? "Not set"}</ReviewRow>
              <ReviewRow label="UAN">{draft.uan || "—"}</ReviewRow>
            </Box>
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Salary components (yearly)
              </Typography>
              {COMPONENT_KINDS.map((kind) =>
                rows
                  .filter((row) => row.kind === kind.value)
                  .map((row) => (
                    <ReviewRow key={row.key} label={row.name}>
                      <SalaryAmount value={rowAmount(row) ?? 0} />
                    </ReviewRow>
                  )),
              )}
            </Box>
            <Box sx={{ gridColumn: "1 / -1" }}>
              <TotalsStrip yearly={rowTotals(rows, false)} monthly={rowTotals(rows, true)} />
            </Box>
          </Box>
        ) : null}

        {serverError ? (
          <Alert severity="error" sx={{ mt: 2 }}>
            {errorMessage(serverError)}
          </Alert>
        ) : null}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button variant="text" color="inherit" disabled={busy} onClick={onClose}>
          Cancel
        </Button>
        <Box sx={{ flex: 1 }} />
        {index > 0 ? (
          <Button variant="outlined" disabled={busy} onClick={() => setStep(STEPS[index - 1]!.name)}>
            Back
          </Button>
        ) : null}
        {last ? (
          <Button disabled={busy} onClick={() => save.mutate()}>
            Save employer
          </Button>
        ) : (
          <Button
            disabled={busy}
            onClick={() => {
              if (stepBlocked(step)) setTried((current) => new Set(current).add(step));
              else goTo(STEPS[index + 1]!.name);
            }}
          >
            Next
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
