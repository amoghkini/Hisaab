import { mdiTrayArrowUp } from "@mdi/js";
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
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { ApiError, errorMessage } from "@/api/client";
import {
  DOCUMENT_KINDS,
  REVISION_KINDS,
  SALARY_CURRENCY,
  addDocument,
  addRevision,
  financialYearName,
  replaceDocument,
  revisionKindName,
  updateEmployer,
  updateRevision,
  type DocumentInput,
  type DocumentKind,
  type EmployerDetail,
  type EmployerDocument,
  type RevisionKind,
  type SalaryRevision,
} from "@/api/salary";
import { MdiIcon } from "@/components/MdiIcon";
import { today } from "@/lib/dates";
import { amountInputText, parseAmount } from "@/lib/money";
import { useAccounts } from "@/pages/accounts/queries";
import {
  EmploymentFields,
  PayFields,
  PfFields,
  employerChanges,
  employerDraftFrom,
  employmentErrors,
  payErrors,
  pfErrors,
  setEmployerField,
  type EmployerDraft,
} from "@/pages/salary/EmployerForm";
import { storeEmployer } from "@/pages/salary/queries";
import { StructureEditor, rowsFromRevision, rowsToLines, structureProblem, type StructureRow } from "@/pages/salary/StructureEditor";

function asApiError(error: unknown): ApiError {
  return error instanceof ApiError ? error : new ApiError(0, "error", errorMessage(error));
}

function useFullScreen(): boolean {
  const theme = useTheme();
  return useMediaQuery(theme.breakpoints.down("sm"));
}

const dateProps = { inputLabel: { shrink: true } };
const grid = { display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))" }, gap: 2.25 };

/** Edit the employer's details. The designation belongs to the pay revisions, so it is edited there. */
export function EmployerEditDialog({ employer, onClose }: { employer: EmployerDetail; onClose: () => void }) {
  const client = useQueryClient();
  const accounts = useAccounts();
  const fullScreen = useFullScreen();
  const [draft, setDraft] = useState<EmployerDraft>(() => employerDraftFrom(employer));
  const [serverError, setServerError] = useState<ApiError | null>(null);
  const errors = { ...employmentErrors(draft), ...payErrors(draft), ...pfErrors(draft) };
  const invalid = Object.keys(errors).length > 0;

  const save = useMutation({
    mutationFn: () => updateEmployer(employer.id, employerChanges(draft)),
    onSuccess: async (saved) => {
      await storeEmployer(client, saved);
      onClose();
    },
    onError: (error) => setServerError(asApiError(error)),
  });
  const busy = save.isPending;
  const fieldProps = {
    draft,
    onChange: <K extends keyof EmployerDraft>(key: K, value: EmployerDraft[K]) => setDraft((current) => setEmployerField(current, key, value)),
    errors,
    serverFields: serverError?.fields,
    disabled: busy,
  };

  return (
    <Dialog open onClose={busy ? undefined : onClose} maxWidth="md" fullWidth fullScreen={fullScreen}>
      <DialogTitle>Edit employer</DialogTitle>
      <DialogContent>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, pt: 1 }}>
          <EmploymentFields {...fieldProps} withDesignation={false} />
          <Divider />
          <PayFields {...fieldProps} accounts={accounts.data ?? []} />
          <Divider />
          <PfFields {...fieldProps} prefilled={false} />
          {serverError ? <Alert severity="error">{errorMessage(serverError)}</Alert> : null}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button variant="text" color="inherit" disabled={busy} onClick={onClose}>
          Cancel
        </Button>
        <Button disabled={invalid || busy} onClick={() => save.mutate()}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/** What the revision dialog opens on: a new appraisal or promotion, or a revision to edit. */
export type RevisionTarget = { mode: "add" } | { mode: "edit"; revision: SalaryRevision };

/**
 * An appraisal, promotion or restructure: when it was announced, when the new pay applies, the new title, and the
 * whole new yearly structure, which starts from the pay in force.
 */
export function RevisionDialog({ employer, target, onClose }: { employer: EmployerDetail; target: RevisionTarget; onClose: () => void }) {
  const client = useQueryClient();
  const fullScreen = useFullScreen();
  const editing = target.mode === "edit" ? target.revision : null;
  const joining = editing?.kind === "joining";
  const base = editing ?? employer.revisions.find((revision) => revision.id === employer.current_revision_id) ?? employer.revisions[0];
  const [kind, setKind] = useState<RevisionKind>(editing?.kind ?? "appraisal");
  const [announcedOn, setAnnouncedOn] = useState(editing?.announced_on ?? "");
  const [effectiveFrom, setEffectiveFrom] = useState(editing?.effective_from ?? "");
  const [designation, setDesignation] = useState(editing?.designation ?? "");
  const [comment, setComment] = useState(editing?.comment ?? "");
  const [rows, setRows] = useState<StructureRow[]>(() => rowsFromRevision(employer, base));
  const [serverError, setServerError] = useState<ApiError | null>(null);

  const dateError = !effectiveFrom ? "Enter the date the new pay applies from" : effectiveFrom < employer.joined_on ? "Cannot be before the joining date" : null;
  const problem = structureProblem(rows);
  const invalid = dateError !== null || problem !== null;

  const save = useMutation({
    mutationFn: () => {
      const common = { announced_on: announcedOn || null, designation: designation.trim() || null, comment: comment.trim(), lines: rowsToLines(rows) };
      if (editing) return updateRevision(employer.id, editing.id, joining ? common : { ...common, effective_from: effectiveFrom });
      return addRevision(employer.id, { ...common, kind: kind as Exclude<RevisionKind, "joining">, effective_from: effectiveFrom });
    },
    onSuccess: async (saved) => {
      await storeEmployer(client, saved);
      onClose();
    },
    onError: (error) => setServerError(asApiError(error)),
  });
  const busy = save.isPending;
  const effectiveError = (effectiveFrom ? dateError : null) ?? serverError?.fields.effective_from ?? null;

  return (
    <Dialog open onClose={busy ? undefined : onClose} maxWidth="md" fullWidth fullScreen={fullScreen}>
      <DialogTitle>{editing ? `Edit ${revisionKindName(editing.kind).toLowerCase()}` : "Add appraisal or promotion"}</DialogTitle>
      <DialogContent>
        <Box sx={{ ...grid, pt: 1, mb: 3 }}>
          <TextField select label="Kind" value={kind} disabled={busy || editing !== null} onChange={(event) => setKind(event.target.value as RevisionKind)}>
            {REVISION_KINDS.filter((each) => each.value !== "joining" || joining).map((each) => (
              <MenuItem key={each.value} value={each.value}>
                {each.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label={kind === "promotion" ? "New designation" : "Designation"}
            placeholder={kind === "promotion" ? "e.g. Senior Engineer" : "Leave empty to keep the current one"}
            value={designation}
            disabled={busy}
            onChange={(event) => setDesignation(event.target.value)}
            slotProps={{ htmlInput: { maxLength: 100 } }}
          />
          <TextField
            label="Announced on"
            type="date"
            value={announcedOn}
            disabled={busy || joining}
            helperText="When you were told, e.g. the appraisal letter's date"
            onChange={(event) => setAnnouncedOn(event.target.value)}
            slotProps={dateProps}
          />
          <TextField
            label="Effective from"
            type="date"
            value={effectiveFrom}
            disabled={busy || joining}
            error={effectiveError !== null}
            helperText={effectiveError ?? (joining ? "The joining date; change it on the employer" : "Payslips use the new pay from this date")}
            onChange={(event) => setEffectiveFrom(event.target.value)}
            slotProps={dateProps}
          />
          <TextField
            label="Notes"
            placeholder="Optional, e.g. rating or hike percentage"
            value={comment}
            disabled={busy}
            onChange={(event) => setComment(event.target.value)}
            slotProps={{ htmlInput: { maxLength: 255 } }}
            sx={{ gridColumn: "1 / -1" }}
          />
        </Box>
        <Typography variant="subtitle1" sx={{ mb: 0.5 }}>
          New yearly salary
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {editing ? "The yearly amounts of this revision." : "Starts from your current pay. Enter the new yearly amounts from the letter."}
        </Typography>
        <StructureEditor rows={rows} onChange={setRows} disabled={busy} />
        {problem ? (
          <Alert severity="warning" sx={{ mt: 2 }}>
            {problem}
          </Alert>
        ) : null}
        {serverError && !serverError.fields.effective_from ? (
          <Alert severity="error" sx={{ mt: 2 }}>
            {errorMessage(serverError)}
          </Alert>
        ) : null}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button variant="text" color="inherit" disabled={busy} onClick={onClose}>
          Cancel
        </Button>
        <Button disabled={invalid || busy} onClick={() => save.mutate()}>
          {editing ? "Save" : "Add"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/** The financial year a date falls in, by the year it starts: April 2025 to March 2026 is 2025. */
function financialYearOf(date: Date): number {
  return date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1;
}

function amountText(value: number | null): string {
  return value === null ? "" : amountInputText(value, SALARY_CURRENCY);
}

function parseOptional(text: string): number | null | undefined {
  if (text.trim() === "") return null;
  const parsed = parseAmount(text, SALARY_CURRENCY);
  return parsed === null || parsed < 0 ? undefined : parsed;
}

/** A document's details, entered by hand. The file itself can be uploaded later. */
export function DocumentDialog({ employer, document, onClose }: { employer: EmployerDetail; document: EmployerDocument | null; onClose: () => void }) {
  const client = useQueryClient();
  const fullScreen = useFullScreen();
  const currentYear = financialYearOf(today());
  const [kind, setKind] = useState<DocumentKind>(document?.kind ?? "form16");
  const [title, setTitle] = useState(document?.title ?? "");
  const [financialYear, setFinancialYear] = useState<number | "">(document?.financial_year ?? (document ? "" : currentYear - 1));
  const [revisionId, setRevisionId] = useState<number | "">(document?.revision_id ?? "");
  const [issuedOn, setIssuedOn] = useState(document?.issued_on ?? "");
  const [gross, setGross] = useState(amountText(document?.gross_salary ?? null));
  const [taxable, setTaxable] = useState(amountText(document?.taxable_income ?? null));
  const [tds, setTds] = useState(amountText(document?.tds ?? null));
  const [comment, setComment] = useState(document?.comment ?? "");
  const [serverError, setServerError] = useState<ApiError | null>(null);

  const info = DOCUMENT_KINDS.find((each) => each.value === kind)!;
  const years = Array.from({ length: currentYear - Number(employer.joined_on.slice(0, 4)) + 3 }, (_, index) => currentYear + 1 - index);
  const amounts = { gross: parseOptional(gross), taxable: parseOptional(taxable), tds: parseOptional(tds) };
  const titleShown = title.trim() || (info.yearly && financialYear !== "" ? `${info.name} ${financialYearName(financialYear)}` : info.name);
  const errors = {
    financialYear: info.yearly && financialYear === "" ? "Choose the financial year" : null,
    amounts: Object.values(amounts).some((value) => value === undefined) ? "Amounts must be numbers with up to 2 decimals" : null,
  };
  const invalid = Object.values(errors).some((error) => error !== null);

  const save = useMutation({
    mutationFn: () => {
      const input: DocumentInput = {
        kind,
        title: titleShown,
        financial_year: financialYear === "" ? null : financialYear,
        revision_id: revisionId === "" ? null : revisionId,
        issued_on: issuedOn || null,
        gross_salary: info.yearly ? (amounts.gross ?? null) : null,
        taxable_income: info.yearly ? (amounts.taxable ?? null) : null,
        tds: info.yearly ? (amounts.tds ?? null) : null,
        comment: comment.trim(),
      };
      return document ? replaceDocument(employer.id, document.id, input) : addDocument(employer.id, input);
    },
    onSuccess: async (saved) => {
      await storeEmployer(client, saved);
      onClose();
    },
    onError: (error) => setServerError(asApiError(error)),
  });
  const busy = save.isPending;
  const amountField = (label: string, value: string, set: (text: string) => void, helper: string) => (
    <TextField
      label={label}
      value={value}
      disabled={busy}
      placeholder="Optional"
      helperText={helper}
      onChange={(event) => set(event.target.value)}
      slotProps={{ htmlInput: { inputMode: "decimal", autoComplete: "off" }, input: { startAdornment: <InputAdornment position="start">₹</InputAdornment> } }}
    />
  );

  return (
    <Dialog open onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth fullScreen={fullScreen}>
      <DialogTitle>{document ? "Edit document" : "Add document"}</DialogTitle>
      <DialogContent>
        <Box sx={{ ...grid, pt: 1 }}>
          <TextField select label="Document" value={kind} disabled={busy} onChange={(event) => setKind(event.target.value as DocumentKind)}>
            {DOCUMENT_KINDS.map((each) => (
              <MenuItem key={each.value} value={each.value}>
                {each.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Financial year"
            value={financialYear}
            disabled={busy}
            error={errors.financialYear !== null}
            helperText={errors.financialYear ?? (info.yearly ? " " : "Optional")}
            onChange={(event) => setFinancialYear(event.target.value === "" ? "" : Number(event.target.value))}
          >
            {info.yearly ? null : (
              <MenuItem value="">
                <em>None</em>
              </MenuItem>
            )}
            {years.map((year) => (
              <MenuItem key={year} value={year}>
                {financialYearName(year)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Title"
            placeholder={titleShown}
            value={title}
            disabled={busy}
            helperText="Optional"
            onChange={(event) => setTitle(event.target.value)}
            slotProps={{ htmlInput: { maxLength: 100 } }}
          />
          <TextField label="Issued on" type="date" value={issuedOn} disabled={busy} helperText="Optional" onChange={(event) => setIssuedOn(event.target.value)} slotProps={dateProps} />
          {info.yearly ? (
            <>
              {amountField("Gross salary", gross, setGross, "Yearly, as on the document")}
              {amountField("Taxable income", taxable, setTaxable, "After exemptions and deductions")}
              {amountField("Tax deducted (TDS)", tds, setTds, " ")}
            </>
          ) : (
            <TextField
              select
              label="Pay revision"
              value={revisionId}
              disabled={busy}
              helperText="The offer, appraisal or promotion it announced"
              onChange={(event) => setRevisionId(event.target.value === "" ? "" : Number(event.target.value))}
            >
              <MenuItem value="">
                <em>None</em>
              </MenuItem>
              {employer.revisions.map((revision) => (
                <MenuItem key={revision.id} value={revision.id}>
                  {revisionKindName(revision.kind)} from {revision.effective_from}
                </MenuItem>
              ))}
            </TextField>
          )}
          <TextField
            label="Notes"
            placeholder="Optional"
            value={comment}
            disabled={busy}
            onChange={(event) => setComment(event.target.value)}
            slotProps={{ htmlInput: { maxLength: 255 } }}
            sx={{ gridColumn: "1 / -1" }}
          />
          <Box sx={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
            <Button variant="outlined" startIcon={<MdiIcon path={mdiTrayArrowUp} />} disabled>
              Upload file
            </Button>
            <Chip label="Coming soon" size="small" color="primary" variant="outlined" />
            <Typography variant="caption" color="text.secondary">
              For now, enter the figures by hand.
            </Typography>
          </Box>
          {errors.amounts ? (
            <Alert severity="warning" sx={{ gridColumn: "1 / -1" }}>
              {errors.amounts}
            </Alert>
          ) : null}
          {serverError ? (
            <Alert severity="error" sx={{ gridColumn: "1 / -1" }}>
              {errorMessage(serverError)}
            </Alert>
          ) : null}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button variant="text" color="inherit" disabled={busy} onClick={onClose}>
          Cancel
        </Button>
        <Button disabled={invalid || busy} onClick={() => save.mutate()}>
          {document ? "Save" : "Add"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
