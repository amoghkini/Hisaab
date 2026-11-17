import { mdiArrowLeft, mdiCheckDecagramOutline, mdiDeleteOutline, mdiRefresh } from "@mdi/js";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import InputAdornment from "@mui/material/InputAdornment";
import Link from "@mui/material/Link";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Link as RouterLink, useNavigate, useParams } from "react-router-dom";

import type { Category } from "@/api/categories";
import { errorMessage } from "@/api/client";
import {
  COMPONENT_KINDS,
  PREFILL_SOURCE_TEXT,
  SALARY_CURRENCY,
  deletePayslip,
  payMonthName,
  postPayslip,
  refillPayslip,
  updatePayslip,
  type ComponentKind,
  type PayslipDetail,
  type PayslipUpdate,
  type Totals,
} from "@/api/salary";
import { MdiIcon } from "@/components/MdiIcon";
import { amountInputText, parseAmount } from "@/lib/money";
import { useAccounts } from "@/pages/accounts/queries";
import { STATUS_CHIP } from "@/pages/salary/PayslipsPage";
import { storePayslip, usePayslip } from "@/pages/salary/queries";
import { SalaryAmount } from "@/pages/salary/SalaryAmount";
import { invalidateTransactions, useCategories } from "@/pages/transactions/queries";

/** What the person has typed, by component id; and the other fields. */
interface Draft {
  amounts: Record<number, string>;
  payDate: string;
  categoryId: number | "";
  comment: string;
}

function draftFrom(payslip: PayslipDetail): Draft {
  return {
    amounts: Object.fromEntries(payslip.lines.map((line) => [line.component_id, line.amount === 0 ? "" : amountInputText(line.amount, SALARY_CURRENCY)])),
    payDate: payslip.pay_date,
    categoryId: payslip.category_id ?? "",
    comment: payslip.comment,
  };
}

function parsed(text: string | undefined): number | null {
  if (!text || text.trim() === "") return 0;
  const amount = parseAmount(text, SALARY_CURRENCY);
  return amount === null || amount < 0 ? null : amount;
}

function totalsOf(payslip: PayslipDetail, draft: Draft): Totals {
  const sums: Record<ComponentKind, number> = { earning: 0, deduction: 0, employer_contribution: 0 };
  for (const line of payslip.lines) sums[line.kind] += parsed(draft.amounts[line.component_id]) ?? 0;
  return {
    gross: sums.earning,
    deductions: sums.deduction,
    net: sums.earning - sums.deduction,
    employer_contributions: sums.employer_contribution,
    ctc: sums.earning + sums.employer_contribution,
  };
}

/** Only what differs from the saved payslip. */
function changesOf(payslip: PayslipDetail, draft: Draft): PayslipUpdate {
  const saved = draftFrom(payslip);
  const changes: PayslipUpdate = {};
  const amountsChanged = payslip.lines.some((line) => (parsed(draft.amounts[line.component_id]) ?? -1) !== line.amount);
  if (amountsChanged) changes.lines = payslip.lines.map((line) => ({ component_id: line.component_id, amount: parsed(draft.amounts[line.component_id]) ?? 0 }));
  if (draft.payDate !== saved.payDate) changes.pay_date = draft.payDate;
  if (draft.categoryId !== saved.categoryId) changes.category_id = draft.categoryId === "" ? null : draft.categoryId;
  if (draft.comment.trim() !== saved.comment) changes.comment = draft.comment.trim();
  return changes;
}

/** Income categories a transaction can go in: sub-categories, and top-level ones without any. */
function incomeChoices(tree: Category[] | undefined, keep: number | ""): { id: number; name: string }[] {
  const choices: { id: number; name: string }[] = [];
  for (const top of tree ?? []) {
    if (top.type !== "income") continue;
    if (top.sub_categories.length === 0) {
      if (!top.hidden || top.id === keep) choices.push({ id: top.id, name: top.name });
      continue;
    }
    for (const sub of top.sub_categories) if (!sub.hidden || sub.id === keep) choices.push({ id: sub.id, name: `${top.name} › ${sub.name}` });
  }
  return choices;
}

function Card({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <Paper variant="outlined" sx={{ borderRadius: 3, minWidth: 0 }}>
      <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1, px: { xs: 2, sm: 3 }, py: 1.75 }}>
        <Typography variant="h6" component="h2" sx={{ flex: 1 }}>
          {title}
        </Typography>
        {action}
      </Box>
      <Divider />
      <Box sx={{ px: { xs: 2, sm: 3 }, py: 2.5 }}>{children}</Box>
    </Paper>
  );
}

function SumRow({ label, value, strong = false }: { label: string; value: number; strong?: boolean }) {
  return (
    <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2, py: 0.75, "& + &": { borderTop: 1, borderColor: "divider" } }}>
      <Typography variant="body2" sx={{ fontWeight: strong ? 600 : 400 }}>
        {label}
      </Typography>
      <Typography sx={{ fontWeight: strong ? 700 : 500, color: strong ? "primary.main" : undefined, whiteSpace: "nowrap" }}>
        <SalaryAmount value={value} />
      </Typography>
    </Box>
  );
}

function PayslipEditor({ payslip }: { payslip: PayslipDetail }) {
  const client = useQueryClient();
  const navigate = useNavigate();
  const accounts = useAccounts();
  const categories = useCategories();
  const [draft, setDraft] = useState<Draft>(() => draftFrom(payslip));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const posted = payslip.status === "posted";
  const totals = totalsOf(payslip, draft);
  const changes = changesOf(payslip, draft);
  const dirty = Object.keys(changes).length > 0;
  const badAmount = payslip.lines.some((line) => parsed(draft.amounts[line.component_id]) === null);
  const [year, month] = payslip.pay_month.split("-").map(Number);
  const lastDay = new Date(year!, month!, 0).getDate();
  const monthRange = { min: payslip.pay_month, max: `${payslip.pay_month.slice(0, 8)}${String(lastDay).padStart(2, "0")}` };
  const account = accounts.data?.find((each) => each.id === payslip.salary_account_id);
  const chip = STATUS_CHIP[payslip.status];

  async function saved(next: PayslipDetail, text: string): Promise<void> {
    setDraft(draftFrom(next));
    setMessage(text);
    await storePayslip(client, next, next.id);
    if (next.status === "posted" || posted) await invalidateTransactions(client);
  }

  const save = useMutation({
    mutationFn: () => updatePayslip(payslip.id, changes),
    onSuccess: (next) => saved(next, posted ? "Saved. Its transaction was updated too." : "Saved"),
  });
  const approve = useMutation({
    mutationFn: async () => {
      if (dirty) await updatePayslip(payslip.id, changes);
      return postPayslip(payslip.id);
    },
    onSuccess: (next) => saved(next, "Approved. The take-home pay is now in your salary account."),
  });
  const refill = useMutation({
    mutationFn: () => refillPayslip(payslip.id),
    onSuccess: (next) => saved(next, "Filled in again"),
  });
  const remove = useMutation({
    mutationFn: () => deletePayslip(payslip.id),
    onSuccess: async () => {
      await storePayslip(client, null, payslip.id);
      if (posted) await invalidateTransactions(client);
      navigate("/salary/payslips");
    },
  });
  const busy = save.isPending || approve.isPending || refill.isPending || remove.isPending;
  const failure = save.error ?? approve.error ?? refill.error;

  return (
    <>
      <Paper variant="outlined" sx={{ borderRadius: 3, p: { xs: 2, sm: 3 }, mb: 2.5 }}>
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, flexWrap: "wrap" }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
              <Typography variant="h5" component="h1">
                {payMonthName(payslip.pay_month)} payslip
              </Typography>
              <Chip size="small" label={chip.label} color={chip.color} variant="outlined" />
            </Box>
            <Typography color="text.secondary">
              <Link component={RouterLink} to={`/salary/employers/${payslip.employer_id}`} color="inherit">
                {payslip.employer_name}
              </Link>{" "}
              · {PREFILL_SOURCE_TEXT[payslip.prefill_source]}
            </Typography>
          </Box>
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            <Button variant="text" color="inherit" startIcon={<MdiIcon path={mdiDeleteOutline} />} disabled={busy} onClick={() => setConfirmDelete(true)}>
              Delete
            </Button>
            {posted ? (
              <Button disabled={!dirty || badAmount || busy} onClick={() => save.mutate()}>
                Save changes
              </Button>
            ) : (
              <>
                <Button variant="outlined" disabled={!dirty || badAmount || busy} onClick={() => save.mutate()}>
                  Save draft
                </Button>
                <Button
                  startIcon={<MdiIcon path={mdiCheckDecagramOutline} />}
                  disabled={badAmount || busy || totals.net <= 0 || draft.categoryId === "" || payslip.salary_account_id === null}
                  onClick={() => approve.mutate()}
                >
                  Approve
                </Button>
              </>
            )}
          </Box>
        </Box>

        {posted ? (
          <Alert severity="success" sx={{ mt: 2 }}>
            Take-home pay of <SalaryAmount value={payslip.totals.net} /> was added to {account?.name ?? "your salary account"} on {payslip.pay_date}.{" "}
            <Link component={RouterLink} to={`/transactions?account=${payslip.salary_account_id ?? ""}`}>
              See the transaction
            </Link>
            . Saving changes here updates it.
          </Alert>
        ) : payslip.post_problem ? (
          <Alert severity="warning" sx={{ mt: 2 }}>
            {payslip.post_problem}
            {payslip.post_problem.includes("account") ? (
              <>
                {" "}
                <Link component={RouterLink} to={`/salary/employers/${payslip.employer_id}`}>
                  Open the employer
                </Link>
              </>
            ) : null}
          </Alert>
        ) : null}
        {failure ? (
          <Alert severity="error" sx={{ mt: 2 }}>
            {errorMessage(failure)}
          </Alert>
        ) : null}
        {message && !failure ? (
          <Alert severity="info" sx={{ mt: 2 }} onClose={() => setMessage(null)}>
            {message}
          </Alert>
        ) : null}
      </Paper>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "minmax(0, 2fr) minmax(320px, 1fr)" }, gap: 2.5, alignItems: "start" }}>
        <Card
          title="This month's amounts"
          action={
            posted ? null : (
              <Button variant="text" startIcon={<MdiIcon path={mdiRefresh} />} disabled={busy} onClick={() => refill.mutate()}>
                Fill in again
              </Button>
            )
          }
        >
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(3, minmax(0, 1fr))" }, gap: 3 }}>
            {COMPONENT_KINDS.map((kind) => {
              const lines = payslip.lines.filter((line) => line.kind === kind.value);
              return (
                <Box key={kind.value} sx={{ minWidth: 0 }}>
                  <Typography variant="subtitle2">{kind.plural}</Typography>
                  <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 1.5 }}>
                    {kind.hint}
                  </Typography>
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                    {lines.length === 0 ? (
                      <Typography variant="body2" color="text.secondary">
                        None
                      </Typography>
                    ) : (
                      lines.map((line) => (
                        <TextField
                          key={line.component_id}
                          size="small"
                          label={line.name}
                          value={draft.amounts[line.component_id] ?? ""}
                          placeholder="0"
                          disabled={busy}
                          error={parsed(draft.amounts[line.component_id]) === null}
                          onChange={(event) => setDraft((current) => ({ ...current, amounts: { ...current.amounts, [line.component_id]: event.target.value } }))}
                          slotProps={{
                            htmlInput: { inputMode: "decimal", autoComplete: "off" },
                            input: { startAdornment: <InputAdornment position="start">₹</InputAdornment> },
                          }}
                        />
                      ))
                    )}
                  </Box>
                </Box>
              );
            })}
          </Box>
          <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 2.5 }}>
            A component missing here? Add it on the{" "}
            <Link component={RouterLink} to={`/salary/employers/${payslip.employer_id}`}>
              employer&apos;s salary structure
            </Link>
            , then fill this payslip in again.
          </Typography>
        </Card>

        <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, minWidth: 0 }}>
          <Card title="Summary">
            <SumRow label="Gross pay" value={totals.gross} />
            <SumRow label="Deductions" value={totals.deductions} />
            <SumRow label="Take-home pay" value={totals.net} strong />
            <SumRow label="Employer contributions" value={totals.employer_contributions} />
            <SumRow label="Cost to company" value={totals.ctc} />
          </Card>
          <Card title="Posting">
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <TextField
                label="Paid on"
                type="date"
                value={draft.payDate}
                disabled={busy}
                onChange={(event) => setDraft((current) => ({ ...current, payDate: event.target.value }))}
                slotProps={{ inputLabel: { shrink: true }, htmlInput: monthRange }}
                helperText={`Credited to ${account?.name ?? "the employer's salary account"}`}
              />
              <TextField
                select
                label="Income category"
                value={draft.categoryId}
                disabled={busy}
                error={draft.categoryId === ""}
                helperText={draft.categoryId === "" ? "Choose where the take-home pay is counted" : " "}
                onChange={(event) => setDraft((current) => ({ ...current, categoryId: event.target.value === "" ? "" : Number(event.target.value) }))}
              >
                {incomeChoices(categories.data, draft.categoryId).map((choice) => (
                  <MenuItem key={choice.id} value={choice.id}>
                    {choice.name}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="Note"
                placeholder="Optional, e.g. arrears or a one-off bonus"
                value={draft.comment}
                disabled={busy}
                multiline
                minRows={2}
                onChange={(event) => setDraft((current) => ({ ...current, comment: event.target.value }))}
                slotProps={{ htmlInput: { maxLength: 255 } }}
              />
            </Box>
          </Card>
        </Box>
      </Box>

      <Dialog open={confirmDelete} onClose={remove.isPending ? undefined : () => setConfirmDelete(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete the {payMonthName(payslip.pay_month)} payslip?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            {posted ? "Its transaction is removed from your salary account too. " : ""}
            The month will not be drafted again; you can add it back from &ldquo;Add a payslip&rdquo;.
          </Typography>
          {remove.isError ? (
            <Alert severity="error" sx={{ mt: 2 }}>
              {errorMessage(remove.error)}
            </Alert>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="text" color="inherit" disabled={remove.isPending} onClick={() => setConfirmDelete(false)}>
            Cancel
          </Button>
          <Button color="error" disabled={remove.isPending} onClick={() => remove.mutate()}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

/** One month's payslip: check the amounts, change what differs, and approve it into the ledger. */
export function PayslipPage() {
  const { payslipId } = useParams();
  const payslip = usePayslip(Number(payslipId));
  const back = (
    <Button variant="text" color="inherit" startIcon={<MdiIcon path={mdiArrowLeft} />} component={RouterLink} to="/salary/payslips" sx={{ mb: 1.5 }}>
      Payslips
    </Button>
  );
  return (
    <>
      {back}
      {payslip.isPending ? (
        <>
          <Skeleton variant="rounded" height={130} sx={{ mb: 2.5 }} />
          <Skeleton variant="rounded" height={320} />
        </>
      ) : payslip.isError ? (
        <Alert severity="warning">{errorMessage(payslip.error)}</Alert>
      ) : (
        // Keyed by the payslip, so moving to another one starts a fresh form.
        <PayslipEditor key={payslip.data.id} payslip={payslip.data} />
      )}
    </>
  );
}
