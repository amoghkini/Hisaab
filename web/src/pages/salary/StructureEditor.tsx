import { mdiClose, mdiPlus } from "@mdi/js";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import Paper from "@mui/material/Paper";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useState } from "react";

import {
  COMPONENT_KINDS,
  SALARY_CURRENCY,
  monthlyAmount,
  type ComponentKind,
  type EmployerDetail,
  type LineInput,
  type SalaryRevision,
  type Totals,
} from "@/api/salary";
import { MdiIcon } from "@/components/MdiIcon";
import { amountInputText, parseAmount } from "@/lib/money";
import { useComponentPresets } from "@/pages/salary/queries";
import { SalaryAmount } from "@/pages/salary/SalaryAmount";

/** One component being edited: an existing one (with its id) or a new one. The amount is yearly, as typed. */
export interface StructureRow {
  key: string;
  componentId: number | null;
  name: string;
  kind: ComponentKind;
  yearly: string;
}

let nextKey = 0;
function newKey(): string {
  nextKey += 1;
  return `row-${nextKey}`;
}

export function newRow(name: string, kind: ComponentKind, yearly = ""): StructureRow {
  return { key: newKey(), componentId: null, name, kind, yearly };
}

/** The structure a new employer starts with: the components almost every Indian payslip has. */
export function starterRows(): StructureRow[] {
  return [
    newRow("Basic", "earning"),
    newRow("House rent allowance", "earning"),
    newRow("Special allowance", "earning"),
    newRow("Employee PF", "deduction"),
    newRow("Professional tax", "deduction"),
    newRow("Employer PF", "employer_contribution"),
  ];
}

/** Every component of the employer, with its amount in the revision (or empty when it has none there). */
export function rowsFromRevision(employer: EmployerDetail, revision: SalaryRevision | undefined): StructureRow[] {
  const amounts = new Map(revision?.lines.map((line) => [line.component_id, line.yearly_amount]) ?? []);
  return employer.components.map((component) => {
    const amount = amounts.get(component.id);
    return {
      key: newKey(),
      componentId: component.id,
      name: component.name,
      kind: component.kind,
      yearly: amount === undefined || amount === 0 ? "" : amountInputText(amount, SALARY_CURRENCY),
    };
  });
}

/** The yearly amount in paise; an empty box is zero. Null when it is not a valid amount. */
export function rowAmount(row: StructureRow): number | null {
  if (row.yearly.trim() === "") return 0;
  const amount = parseAmount(row.yearly, SALARY_CURRENCY);
  return amount === null || amount < 0 ? null : amount;
}

export function structureProblem(rows: StructureRow[]): string | null {
  if (rows.length === 0) return "Add at least one component.";
  if (rows.some((row) => row.name.trim() === "")) return "Every component needs a name.";
  if (rows.some((row) => rowAmount(row) === null)) return "Amounts must be numbers with up to 2 decimals.";
  const names = rows.map((row) => row.name.trim().toLowerCase());
  if (new Set(names).size !== names.length) return "Each component can appear only once.";
  if (!rows.some((row) => row.kind === "earning" && (rowAmount(row) ?? 0) > 0)) return "Enter at least one earning.";
  return null;
}

export function rowsToLines(rows: StructureRow[]): LineInput[] {
  return rows.map((row) => {
    const yearly_amount = rowAmount(row) ?? 0;
    return row.componentId !== null ? { component_id: row.componentId, yearly_amount } : { name: row.name.trim(), kind: row.kind, yearly_amount };
  });
}

/** Monthly totals add up the rounded monthly figures, so they match the lines shown. */
export function rowTotals(rows: StructureRow[], monthly: boolean): Totals {
  const sums: Record<ComponentKind, number> = { earning: 0, deduction: 0, employer_contribution: 0 };
  for (const row of rows) {
    const yearly = rowAmount(row) ?? 0;
    sums[row.kind] += monthly ? monthlyAmount(yearly) : yearly;
  }
  return {
    gross: sums.earning,
    deductions: sums.deduction,
    net: sums.earning - sums.deduction,
    employer_contributions: sums.employer_contribution,
    ctc: sums.earning + sums.employer_contribution,
  };
}

/** Gross, deductions, take-home and CTC, monthly and yearly. */
export function TotalsStrip({ yearly, monthly }: { yearly: Totals; monthly: Totals }) {
  const items: { label: string; month: number; year: number; strong?: boolean }[] = [
    { label: "Gross", month: monthly.gross, year: yearly.gross },
    { label: "Deductions", month: monthly.deductions, year: yearly.deductions },
    { label: "Take-home", month: monthly.net, year: yearly.net, strong: true },
    { label: "CTC", month: monthly.ctc, year: yearly.ctc },
  ];
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "repeat(4, minmax(0, 1fr))" }, gap: 1.5 }}>
      {items.map((item) => (
        <Paper key={item.label} variant="outlined" sx={{ borderRadius: 2, px: 2, py: 1.25, minWidth: 0, ...(item.strong ? { borderColor: "primary.main" } : {}) }}>
          <Typography variant="caption" color="text.secondary">
            {item.label} a month
          </Typography>
          <Typography sx={{ fontWeight: 600, color: item.strong ? "primary.main" : undefined }}>
            <SalaryAmount value={item.month} />
          </Typography>
          <Typography variant="caption" color="text.secondary">
            <SalaryAmount value={item.year} /> a year
          </Typography>
        </Paper>
      ))}
    </Box>
  );
}

function AddComponent({ kind, taken, disabled, onAdd }: { kind: ComponentKind; taken: Set<string>; disabled: boolean; onAdd: (name: string) => void }) {
  const presets = useComponentPresets();
  const [text, setText] = useState("");
  const options = (presets.data ?? []).filter((preset) => preset.kind === kind && !taken.has(preset.name.toLowerCase())).map((preset) => preset.name);

  function add(name: string | null): void {
    const trimmed = (name ?? "").trim();
    if (trimmed === "" || taken.has(trimmed.toLowerCase())) return;
    onAdd(trimmed);
    setText("");
  }

  return (
    <Autocomplete
      freeSolo
      size="small"
      disabled={disabled}
      options={options}
      value={null}
      inputValue={text}
      onInputChange={(_, value, reason) => {
        if (reason !== "reset") setText(value);
      }}
      onChange={(_, value) => add(value)}
      blurOnSelect
      renderInput={(params) => (
        <TextField
          {...params}
          placeholder="Add a component: pick one or type a name"
          slotProps={{
            ...params.slotProps,
            htmlInput: { ...params.slotProps.htmlInput, maxLength: 64 },
            input: {
              ...params.slotProps.input,
              startAdornment: (
                <InputAdornment position="start">
                  <MdiIcon path={mdiPlus} fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
        />
      )}
      sx={{ maxWidth: { sm: 420 } }}
    />
  );
}

/**
 * The components of a salary, by kind, with a yearly amount each and the monthly figure beside it. Used when
 * setting up an employer and for each appraisal or promotion.
 */
export function StructureEditor({ rows, onChange, disabled = false }: { rows: StructureRow[]; onChange: (rows: StructureRow[]) => void; disabled?: boolean }) {
  const taken = new Set(rows.map((row) => row.name.trim().toLowerCase()));

  function update(key: string, change: Partial<StructureRow>): void {
    onChange(rows.map((row) => (row.key === key ? { ...row, ...change } : row)));
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
      {COMPONENT_KINDS.map((kind) => {
        const ofKind = rows.filter((row) => row.kind === kind.value);
        return (
          <Box key={kind.value}>
            <Typography variant="subtitle2">{kind.plural}</Typography>
            <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 1 }}>
              {kind.hint}
            </Typography>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {ofKind.map((row) => {
                const amount = rowAmount(row);
                return (
                  <Box
                    key={row.key}
                    sx={{
                      display: "grid",
                      gap: 1,
                      alignItems: "center",
                      gridTemplateColumns: { xs: "minmax(0, 1fr) auto", sm: "minmax(0, 1.4fr) minmax(0, 1fr) 140px auto" },
                      gridTemplateAreas: { xs: '"name remove" "amount amount" "monthly monthly"', sm: '"name amount monthly remove"' },
                    }}
                  >
                    <TextField
                      size="small"
                      label="Component"
                      value={row.name}
                      disabled={disabled || row.componentId !== null}
                      onChange={(event) => update(row.key, { name: event.target.value })}
                      slotProps={{ htmlInput: { maxLength: 64 } }}
                      sx={{ gridArea: "name" }}
                    />
                    <TextField
                      size="small"
                      label="Yearly amount"
                      value={row.yearly}
                      disabled={disabled}
                      placeholder="0"
                      error={amount === null}
                      onChange={(event) => update(row.key, { yearly: event.target.value })}
                      slotProps={{
                        htmlInput: { inputMode: "decimal", autoComplete: "off" },
                        input: { startAdornment: <InputAdornment position="start">₹</InputAdornment> },
                      }}
                      sx={{ gridArea: "amount" }}
                    />
                    <Typography variant="body2" color="text.secondary" sx={{ gridArea: "monthly", textAlign: { sm: "right" }, whiteSpace: "nowrap" }}>
                      <SalaryAmount value={monthlyAmount(amount ?? 0)} /> / month
                    </Typography>
                    <Tooltip title={row.componentId !== null ? "Remove: zero from this revision on" : "Remove"}>
                      <IconButton size="small" aria-label={`Remove ${row.name}`} disabled={disabled} onClick={() => onChange(rows.filter((each) => each.key !== row.key))} sx={{ gridArea: "remove" }}>
                        <MdiIcon path={mdiClose} fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                );
              })}
              <AddComponent kind={kind.value} taken={taken} disabled={disabled} onAdd={(name) => onChange([...rows, newRow(name, kind.value)])} />
            </Box>
          </Box>
        );
      })}
      <TotalsStrip yearly={rowTotals(rows, false)} monthly={rowTotals(rows, true)} />
    </Box>
  );
}
