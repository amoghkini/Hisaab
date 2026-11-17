import { mdiArrowLeft, mdiDeleteOutline, mdiFileDocumentOutline, mdiPencilOutline, mdiPlus, mdiReceiptTextOutline, mdiTrendingUp, mdiTrayArrowUp } from "@mdi/js";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Link as RouterLink, useNavigate, useParams } from "react-router-dom";

import { errorMessage } from "@/api/client";
import {
  COMPONENT_KINDS,
  deleteDocument,
  deleteEmployer,
  deleteRevision,
  documentKindName,
  financialYearName,
  revisionKindName,
  type EmployerDetail,
  type EmployerDocument,
  type SalaryRevision,
} from "@/api/salary";
import { MdiIcon } from "@/components/MdiIcon";
import { useAccounts } from "@/pages/accounts/queries";
import { DocumentDialog, EmployerEditDialog, RevisionDialog, type RevisionTarget } from "@/pages/salary/EmployerDialogs";
import { tenure } from "@/pages/salary/EmployersPage";
import { invalidateSalary, storeEmployer, useEmployer } from "@/pages/salary/queries";
import { SalaryAmount } from "@/pages/salary/SalaryAmount";
import { TotalsStrip } from "@/pages/salary/StructureEditor";

function Section({ title, description, action, children }: { title: string; description?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <Paper variant="outlined" sx={{ borderRadius: 3, minWidth: 0 }}>
      <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1.5, px: { xs: 2, sm: 3 }, py: 2 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h6" component="h2">
            {title}
          </Typography>
          {description ? (
            <Typography variant="body2" color="text.secondary">
              {description}
            </Typography>
          ) : null}
        </Box>
        {action}
      </Box>
      <Divider />
      <Box sx={{ px: { xs: 2, sm: 3 }, py: 2.5 }}>{children}</Box>
    </Paper>
  );
}

function Field({ label, value, warning = false }: { label: string; value: ReactNode; warning?: boolean }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography sx={{ fontWeight: 500, overflowWrap: "anywhere", color: warning ? "warning.main" : undefined }}>{value}</Typography>
    </Box>
  );
}

const fieldGrid = { display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(4, minmax(0, 1fr))" }, gap: 2.5 };

/** The components of one revision with their yearly and monthly amounts, by kind, with a subtotal each. */
function StructureTable({ employer, revision }: { employer: EmployerDetail; revision: SalaryRevision }) {
  const lines = new Map(revision.lines.map((line) => [line.component_id, line]));
  const subtotal = { earning: revision.yearly.gross, deduction: revision.yearly.deductions, employer_contribution: revision.yearly.employer_contributions };
  const monthlySubtotal = { earning: revision.monthly.gross, deduction: revision.monthly.deductions, employer_contribution: revision.monthly.employer_contributions };
  const row = { display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(90px, auto) minmax(90px, auto)", columnGap: 2, py: 0.75, alignItems: "baseline" };
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "repeat(3, minmax(0, 1fr))" }, gap: 3 }}>
      {COMPONENT_KINDS.map((kind) => {
        const components = employer.components.filter((component) => component.kind === kind.value && (lines.get(component.id)?.yearly_amount ?? 0) > 0);
        return (
          <Box key={kind.value} sx={{ minWidth: 0 }}>
            <Box sx={{ ...row, borderBottom: 1, borderColor: "divider" }}>
              <Typography variant="subtitle2">{kind.plural}</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ textAlign: "right" }}>
                Yearly
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ textAlign: "right" }}>
                Monthly
              </Typography>
            </Box>
            {components.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
                None
              </Typography>
            ) : (
              components.map((component) => {
                const line = lines.get(component.id)!;
                return (
                  <Box key={component.id} sx={row}>
                    <Typography variant="body2" sx={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                      {component.name}
                    </Typography>
                    <Typography variant="body2" sx={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <SalaryAmount value={line.yearly_amount} />
                    </Typography>
                    <Typography variant="body2" sx={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <SalaryAmount value={line.monthly_amount} />
                    </Typography>
                  </Box>
                );
              })
            )}
            <Box sx={{ ...row, borderTop: 1, borderColor: "divider" }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Total
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600, textAlign: "right", whiteSpace: "nowrap" }}>
                <SalaryAmount value={subtotal[kind.value]} />
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600, textAlign: "right", whiteSpace: "nowrap" }}>
                <SalaryAmount value={monthlySubtotal[kind.value]} />
              </Typography>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

const STATUS_CHIP: Record<SalaryRevision["status"], { label: string; color: "primary" | "default" | "secondary" }> = {
  current: { label: "In force", color: "primary" },
  upcoming: { label: "Upcoming", color: "secondary" },
  past: { label: "Past", color: "default" },
};

/** The pay revisions, newest first: the career at this employer, with the change in CTC each time. */
function CareerTimeline({ employer, onEdit, onDelete }: { employer: EmployerDetail; onEdit: (revision: SalaryRevision) => void; onDelete: (revision: SalaryRevision) => void }) {
  return (
    <Box component="ol" sx={{ listStyle: "none", m: 0, p: 0 }}>
      {employer.revisions.map((revision, index) => {
        const previous = employer.revisions[index + 1];
        const change = previous && previous.yearly.ctc > 0 ? ((revision.yearly.ctc - previous.yearly.ctc) / previous.yearly.ctc) * 100 : null;
        const chip = STATUS_CHIP[revision.status];
        return (
          <Box component="li" key={revision.id} sx={{ display: "flex", gap: 2, position: "relative", pb: index === employer.revisions.length - 1 ? 0 : 2.5 }}>
            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", flex: "none", pt: 0.5 }}>
              <Box sx={{ width: 12, height: 12, borderRadius: "50%", bgcolor: revision.status === "current" ? "primary.main" : "action.disabled" }} />
              {index === employer.revisions.length - 1 ? null : <Box sx={{ flex: 1, width: 2, bgcolor: "divider", mt: 0.5 }} />}
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
                <Typography sx={{ fontWeight: 600 }}>{revisionKindName(revision.kind)}</Typography>
                <Chip size="small" label={chip.label} color={chip.color} variant="outlined" />
                {change !== null ? (
                  <Chip size="small" icon={<MdiIcon path={mdiTrendingUp} fontSize="small" />} label={`${change >= 0 ? "+" : ""}${change.toFixed(1)}% CTC`} variant="outlined" color={change >= 0 ? "success" : "warning"} />
                ) : null}
                <Box sx={{ flex: 1 }} />
                <Tooltip title="Edit">
                  <IconButton size="small" aria-label="Edit revision" onClick={() => onEdit(revision)}>
                    <MdiIcon path={mdiPencilOutline} fontSize="small" />
                  </IconButton>
                </Tooltip>
                {revision.kind === "joining" ? null : (
                  <Tooltip title="Delete">
                    <IconButton size="small" aria-label="Delete revision" onClick={() => onDelete(revision)}>
                      <MdiIcon path={mdiDeleteOutline} fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
              <Typography variant="body2" color="text.secondary">
                {[
                  revision.designation_in_effect,
                  `effective ${revision.effective_from}`,
                  revision.announced_on && revision.announced_on !== revision.effective_from ? `announced ${revision.announced_on}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.5 }}>
                CTC <SalaryAmount value={revision.yearly.ctc} /> a year · take-home <SalaryAmount value={revision.monthly.net} /> a month
              </Typography>
              {revision.comment ? (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {revision.comment}
                </Typography>
              ) : null}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

/** Documents by financial year; letters without one come last, under "Employment". */
function DocumentList({ employer, onEdit, onDelete }: { employer: EmployerDetail; onEdit: (document: EmployerDocument) => void; onDelete: (document: EmployerDocument) => void }) {
  if (employer.documents.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        No documents yet. Add your offer letter, appraisal letters, Form 16 and tax forecasts here, with their figures.
      </Typography>
    );
  }
  const groups = new Map<string, EmployerDocument[]>();
  for (const document of employer.documents) {
    const key = document.financial_year === null ? "Employment" : financialYearName(document.financial_year);
    groups.set(key, [...(groups.get(key) ?? []), document]);
  }
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {[...groups.entries()].map(([group, documents]) => (
        <Box key={group}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            {group}
          </Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(2, minmax(0, 1fr))", xl: "repeat(3, minmax(0, 1fr))" }, gap: 1.5 }}>
            {documents.map((document) => (
              <Paper key={document.id} variant="outlined" sx={{ borderRadius: 2, p: 1.5, display: "flex", gap: 1.5, minWidth: 0 }}>
                <MdiIcon path={mdiFileDocumentOutline} sx={{ color: "text.secondary", mt: 0.25 }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis" }}>
                    {document.title}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" component="div">
                    {[documentKindName(document.kind), document.issued_on ? `issued ${document.issued_on}` : null, "file not uploaded"].filter(Boolean).join(" · ")}
                  </Typography>
                  {document.gross_salary !== null || document.tds !== null || document.taxable_income !== null ? (
                    <Typography variant="caption" component="div" sx={{ mt: 0.5 }}>
                      {document.gross_salary !== null ? (
                        <>
                          Gross <SalaryAmount value={document.gross_salary} />{" "}
                        </>
                      ) : null}
                      {document.taxable_income !== null ? (
                        <>
                          · Taxable <SalaryAmount value={document.taxable_income} />{" "}
                        </>
                      ) : null}
                      {document.tds !== null ? (
                        <>
                          · TDS <SalaryAmount value={document.tds} />
                        </>
                      ) : null}
                    </Typography>
                  ) : null}
                </Box>
                <Box sx={{ display: "flex", alignItems: "flex-start" }}>
                  <IconButton size="small" aria-label="Edit document" onClick={() => onEdit(document)}>
                    <MdiIcon path={mdiPencilOutline} fontSize="small" />
                  </IconButton>
                  <IconButton size="small" aria-label="Delete document" onClick={() => onDelete(document)}>
                    <MdiIcon path={mdiDeleteOutline} fontSize="small" />
                  </IconButton>
                </Box>
              </Paper>
            ))}
          </Box>
        </Box>
      ))}
    </Box>
  );
}

type Confirm = { kind: "employer" } | { kind: "revision"; revision: SalaryRevision } | { kind: "document"; document: EmployerDocument };

/** One employer: its details, the salary structure in force, the career at it, and its documents. */
export function EmployerPage() {
  const { employerId } = useParams();
  const id = Number(employerId);
  const employer = useEmployer(id);
  const accounts = useAccounts();
  const client = useQueryClient();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [revisionTarget, setRevisionTarget] = useState<RevisionTarget | null>(null);
  const [documentTarget, setDocumentTarget] = useState<EmployerDocument | "new" | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);

  const remove = useMutation({
    mutationFn: async (what: Confirm) => {
      if (what.kind === "employer") {
        await deleteEmployer(id);
        return null;
      }
      return what.kind === "revision" ? deleteRevision(id, what.revision.id) : deleteDocument(id, what.document.id);
    },
    onSuccess: async (saved) => {
      setConfirm(null);
      if (saved) {
        await storeEmployer(client, saved);
      } else {
        navigate("/salary/employers");
        client.removeQueries({ queryKey: ["salary", "employer", id] });
        await invalidateSalary(client);
      }
    },
  });

  const back = (
    <Button variant="text" color="inherit" startIcon={<MdiIcon path={mdiArrowLeft} />} component={RouterLink} to="/salary/employers" sx={{ mb: 1.5 }}>
      Employers
    </Button>
  );

  if (employer.isPending) {
    return (
      <>
        {back}
        <Skeleton variant="rounded" height={150} sx={{ mb: 2.5 }} />
        <Skeleton variant="rounded" height={300} />
      </>
    );
  }
  if (employer.isError) {
    return (
      <>
        {back}
        <Alert severity={employer.error && "status" in employer.error && employer.error.status === 404 ? "warning" : "error"}>
          {errorMessage(employer.error)}
        </Alert>
      </>
    );
  }

  const data = employer.data;
  const current = data.revisions.find((revision) => revision.id === data.current_revision_id);
  const account = accounts.data?.find((each) => each.id === data.salary_account_id);
  const confirmText =
    confirm?.kind === "employer"
      ? { title: `Delete ${data.name}?`, body: "Its salary structure, pay revisions and documents are deleted too. Your transactions stay." }
      : confirm?.kind === "revision"
        ? { title: `Delete this ${revisionKindName(confirm.revision.kind).toLowerCase()}?`, body: `The pay from ${confirm.revision.effective_from} goes back to the revision before it.` }
        : confirm?.kind === "document"
          ? { title: `Delete ${confirm.document.title}?`, body: "Only the details entered here are deleted." }
          : null;

  return (
    <>
      {back}

      <Paper variant="outlined" sx={{ borderRadius: 3, p: { xs: 2, sm: 3 }, mb: 2.5 }}>
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, flexWrap: "wrap" }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
              <Typography variant="h5" component="h1" sx={{ overflowWrap: "anywhere" }}>
                {data.name}
              </Typography>
              <Chip size="small" label={data.is_current ? "Current" : "Past"} color={data.is_current ? "primary" : "default"} variant="outlined" />
            </Box>
            <Typography color="text.secondary">{[data.designation, tenure(data)].filter(Boolean).join(" · ")}</Typography>
          </Box>
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button variant="outlined" startIcon={<MdiIcon path={mdiReceiptTextOutline} />} component={RouterLink} to={`/salary/payslips?employer=${data.id}`}>
              Payslips
            </Button>
            <Button variant="outlined" startIcon={<MdiIcon path={mdiPencilOutline} />} onClick={() => setEditing(true)}>
              Edit
            </Button>
            <Tooltip title="Delete employer">
              <IconButton aria-label="Delete employer" onClick={() => setConfirm({ kind: "employer" })}>
                <MdiIcon path={mdiDeleteOutline} />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
        {data.yearly && data.monthly ? (
          <Box sx={{ mt: 2.5 }}>
            <TotalsStrip yearly={data.yearly} monthly={data.monthly} />
          </Box>
        ) : null}
      </Paper>

      <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
        <Section title="Details" action={<Button variant="text" startIcon={<MdiIcon path={mdiPencilOutline} />} onClick={() => setEditing(true)}>Edit</Button>}>
          <Box sx={fieldGrid}>
            <Field label="Employee ID" value={data.employee_code ?? "—"} />
            <Field label="Joined on" value={data.joined_on} />
            <Field label="Left on" value={data.left_on ?? "Still working here"} />
            <Field label="First salary on" value={data.first_pay_on} />
            <Field label="Pay day" value={data.pay_day === 31 ? "Last day of the month" : `Day ${data.pay_day} of the month`} />
            <Field
              label="Salary account"
              value={!data.salary_account_ok ? "Missing, or no longer a savings or current account" : (account?.name ?? "Not set")}
              warning={!data.salary_account_ok}
            />
            <Field label="UAN" value={data.uan ?? "—"} />
            <Field label="Notes" value={data.comment || "—"} />
          </Box>
        </Section>

        <Section
          title="Salary structure"
          description={current ? `In force from ${current.effective_from}. Monthly figures are a twelfth of the yearly ones; payslips start from them.` : undefined}
          action={
            current ? (
              <Button variant="text" startIcon={<MdiIcon path={mdiPencilOutline} />} onClick={() => setRevisionTarget({ mode: "edit", revision: current })}>
                Edit amounts
              </Button>
            ) : null
          }
        >
          {current ? <StructureTable employer={data} revision={current} /> : <Typography color="text.secondary">No salary entered yet.</Typography>}
        </Section>

        <Section
          title="Career"
          description="Your joining offer, then each appraisal and promotion. Payslips use the new pay from its effective date, not when it was announced."
          action={
            <Button startIcon={<MdiIcon path={mdiPlus} />} onClick={() => setRevisionTarget({ mode: "add" })}>
              Add appraisal or promotion
            </Button>
          }
        >
          <CareerTimeline employer={data} onEdit={(revision) => setRevisionTarget({ mode: "edit", revision })} onDelete={(revision) => setConfirm({ kind: "revision", revision })} />
        </Section>

        <Section
          title="Documents"
          description="Offer and joining letters, appraisal letters, Form 16 and tax forecasts, by financial year."
          action={
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
              <Tooltip title="Uploading files is coming soon">
                <span>
                  <Button variant="outlined" startIcon={<MdiIcon path={mdiTrayArrowUp} />} disabled>
                    Upload
                  </Button>
                </span>
              </Tooltip>
              <Button startIcon={<MdiIcon path={mdiPlus} />} onClick={() => setDocumentTarget("new")}>
                Add document
              </Button>
            </Box>
          }
        >
          <DocumentList employer={data} onEdit={setDocumentTarget} onDelete={(document) => setConfirm({ kind: "document", document })} />
        </Section>
      </Box>

      {editing ? <EmployerEditDialog employer={data} onClose={() => setEditing(false)} /> : null}
      {revisionTarget ? <RevisionDialog employer={data} target={revisionTarget} onClose={() => setRevisionTarget(null)} /> : null}
      {documentTarget ? <DocumentDialog employer={data} document={documentTarget === "new" ? null : documentTarget} onClose={() => setDocumentTarget(null)} /> : null}

      <Dialog open={confirm !== null} onClose={remove.isPending ? undefined : () => setConfirm(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{confirmText?.title}</DialogTitle>
        <DialogContent>
          <Typography variant="body2">{confirmText?.body}</Typography>
          {remove.isError ? (
            <Alert severity="error" sx={{ mt: 2 }}>
              {errorMessage(remove.error)}
            </Alert>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="text" color="inherit" disabled={remove.isPending} onClick={() => setConfirm(null)}>
            Cancel
          </Button>
          <Button color="error" disabled={remove.isPending} onClick={() => confirm && remove.mutate(confirm)}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
