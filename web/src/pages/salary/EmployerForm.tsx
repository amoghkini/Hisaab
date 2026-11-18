import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Link from "@mui/material/Link";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import { Link as RouterLink } from "react-router-dom";

import { SALARY_CATEGORIES, type Account } from "@/api/accounts";
import type { Employer, EmployerUpdate } from "@/api/salary";
import { AccountIcon } from "@/components/AccountIcon";
import { parseIsoDate, toIsoDate } from "@/lib/dates";

/** The employer's own fields as typed. Dates are "YYYY-MM-DD" or "". */
export interface EmployerDraft {
  name: string;
  employeeCode: string;
  designation: string;
  joinedOn: string;
  leftOn: string;
  payDay: number;
  firstPayOn: string;
  /** False until the person edits the first pay date; until then it follows the joining date and pay day. */
  firstPayTouched: boolean;
  salaryAccountId: number | "";
  uan: string;
  comment: string;
}

export function newEmployerDraft(previousUan: string | null): EmployerDraft {
  return {
    name: "",
    employeeCode: "",
    designation: "",
    joinedOn: "",
    leftOn: "",
    payDay: 31,
    firstPayOn: "",
    firstPayTouched: false,
    salaryAccountId: "",
    uan: previousUan ?? "",
    comment: "",
  };
}

export function employerDraftFrom(employer: Employer): EmployerDraft {
  return {
    name: employer.name,
    employeeCode: employer.employee_code ?? "",
    designation: employer.designation ?? "",
    joinedOn: employer.joined_on,
    leftOn: employer.left_on ?? "",
    payDay: employer.pay_day,
    firstPayOn: employer.first_pay_on,
    firstPayTouched: true,
    salaryAccountId: employer.salary_account_id ?? "",
    uan: employer.uan ?? "",
    comment: employer.comment,
  };
}

/** The pay day in a month; a month too short for it pays on its last day. */
function payDate(year: number, month: number, payDay: number): Date {
  const last = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(payDay, last));
}

/** The first pay day on or after the joining date, as the backend suggests it. */
export function suggestedFirstPay(joinedOn: string, payDay: number): string {
  if (!joinedOn) return "";
  const joined = parseIsoDate(joinedOn);
  const candidate = payDate(joined.getFullYear(), joined.getMonth(), payDay);
  return toIsoDate(candidate >= joined ? candidate : payDate(joined.getFullYear(), joined.getMonth() + 1, payDay));
}

/** Set a field, keeping the first pay date in step with the joining date and pay day until it is edited. */
export function setEmployerField<K extends keyof EmployerDraft>(draft: EmployerDraft, key: K, value: EmployerDraft[K]): EmployerDraft {
  const next = { ...draft, [key]: value };
  if (key === "firstPayOn") next.firstPayTouched = true;
  if (!next.firstPayTouched && (key === "joinedOn" || key === "payDay")) next.firstPayOn = suggestedFirstPay(next.joinedOn, next.payDay);
  return next;
}

export type EmployerErrors = Partial<Record<"name" | "joinedOn" | "leftOn" | "firstPayOn" | "salaryAccountId" | "uan", string>>;

export function employmentErrors(draft: EmployerDraft): EmployerErrors {
  const errors: EmployerErrors = {};
  if (draft.name.trim() === "") errors.name = "Enter the employer's name";
  if (!draft.joinedOn) errors.joinedOn = "Enter the date you joined";
  if (draft.leftOn && draft.joinedOn && draft.leftOn < draft.joinedOn) errors.leftOn = "Cannot be before the joining date";
  return errors;
}

export function payErrors(draft: EmployerDraft): EmployerErrors {
  const errors: EmployerErrors = {};
  if (!draft.firstPayOn) errors.firstPayOn = "Enter the date of your first salary";
  else if (draft.joinedOn && draft.firstPayOn < draft.joinedOn) errors.firstPayOn = "Cannot be before the joining date";
  // A past job's account may be closed by now; a current one needs somewhere for the salary to go.
  if (draft.salaryAccountId === "" && !draft.leftOn) errors.salaryAccountId = "Choose the account your salary is paid into";
  return errors;
}

export function pfErrors(draft: EmployerDraft): EmployerErrors {
  return draft.uan !== "" && !/^\d{12}$/.test(draft.uan) ? { uan: "A UAN has 12 digits" } : {};
}

export function employerChanges(draft: EmployerDraft): Required<EmployerUpdate> {
  return {
    name: draft.name.trim(),
    employee_code: draft.employeeCode.trim() || null,
    joined_on: draft.joinedOn,
    left_on: draft.leftOn || null,
    first_pay_on: draft.firstPayOn || null,
    pay_day: draft.payDay,
    salary_account_id: draft.salaryAccountId === "" ? null : draft.salaryAccountId,
    uan: draft.uan || null,
    comment: draft.comment.trim(),
  };
}

function ordinal(day: number): string {
  if (day % 100 >= 11 && day % 100 <= 13) return `${day}th`;
  return `${day}${["th", "st", "nd", "rd"][day % 10] ?? "th"}`;
}

const PAY_DAYS = Array.from({ length: 31 }, (_, index) => index + 1);
const grid = { display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))" }, gap: 2.25 };
const dateProps = { inputLabel: { shrink: true } };

interface FieldsProps {
  draft: EmployerDraft;
  onChange: <K extends keyof EmployerDraft>(key: K, value: EmployerDraft[K]) => void;
  errors: EmployerErrors;
  /** Problems the server found, by API field name. */
  serverFields?: Record<string, string>;
  disabled?: boolean;
}

function message(errors: EmployerErrors, serverFields: Record<string, string> | undefined, key: keyof EmployerErrors, apiField: string): string | undefined {
  return errors[key] ?? serverFields?.[apiField];
}

export function EmploymentFields({ draft, onChange, errors, serverFields, disabled, withDesignation = true }: FieldsProps & { withDesignation?: boolean }) {
  const nameError = message(errors, serverFields, "name", "name");
  const joinedError = message(errors, serverFields, "joinedOn", "joined_on");
  const leftError = message(errors, serverFields, "leftOn", "left_on");
  return (
    <Box sx={grid}>
      <TextField
        label="Employer"
        placeholder="e.g. Infosys Limited"
        value={draft.name}
        disabled={disabled}
        autoFocus
        error={Boolean(nameError)}
        helperText={nameError ?? " "}
        onChange={(event) => onChange("name", event.target.value)}
        slotProps={{ htmlInput: { maxLength: 100, autoComplete: "off" } }}
        sx={{ gridColumn: "1 / -1" }}
      />
      {withDesignation ? (
        <TextField
          label="Designation"
          placeholder="e.g. Software Engineer"
          value={draft.designation}
          disabled={disabled}
          helperText="Your title when you joined"
          onChange={(event) => onChange("designation", event.target.value)}
          slotProps={{ htmlInput: { maxLength: 100 } }}
        />
      ) : null}
      <TextField
        label="Employee ID"
        placeholder="Optional"
        value={draft.employeeCode}
        disabled={disabled}
        helperText=" "
        onChange={(event) => onChange("employeeCode", event.target.value)}
        slotProps={{ htmlInput: { maxLength: 32, autoComplete: "off" } }}
      />
      <TextField
        label="Joined on"
        type="date"
        value={draft.joinedOn}
        disabled={disabled}
        error={Boolean(joinedError)}
        helperText={joinedError ?? " "}
        onChange={(event) => onChange("joinedOn", event.target.value)}
        slotProps={dateProps}
      />
      <TextField
        label="Left on"
        type="date"
        value={draft.leftOn}
        disabled={disabled}
        error={Boolean(leftError)}
        helperText={leftError ?? "Leave empty if you still work here"}
        onChange={(event) => onChange("leftOn", event.target.value)}
        slotProps={dateProps}
      />
    </Box>
  );
}

export function PayFields({ draft, onChange, errors, serverFields, disabled, accounts }: FieldsProps & { accounts: Account[] }) {
  const firstPayError = message(errors, serverFields, "firstPayOn", "first_pay_on");
  const accountError = message(errors, serverFields, "salaryAccountId", "salary_account_id");
  const choices = accounts.filter((account) => SALARY_CATEGORIES.includes(account.category) && (!account.hidden || account.id === draft.salaryAccountId));
  return (
    <Box sx={grid}>
      <TextField
        select
        label="Pay day"
        value={draft.payDay}
        disabled={disabled}
        helperText="The day of the month the salary is credited"
        onChange={(event) => onChange("payDay", Number(event.target.value))}
      >
        {PAY_DAYS.map((day) => (
          <MenuItem key={day} value={day}>
            {day === 31 ? "Last day of the month" : ordinal(day)}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        label="First salary on"
        type="date"
        value={draft.firstPayOn}
        disabled={disabled}
        error={Boolean(firstPayError)}
        helperText={firstPayError ?? "Joined after the month's cut-off? Your first salary may come a month later."}
        onChange={(event) => onChange("firstPayOn", event.target.value)}
        slotProps={dateProps}
      />
      <TextField
        select
        label="Salary account"
        value={draft.salaryAccountId}
        disabled={disabled}
        error={Boolean(accountError)}
        helperText={accountError ?? "A savings or current account"}
        onChange={(event) => onChange("salaryAccountId", event.target.value === "" ? "" : Number(event.target.value))}
        sx={{ gridColumn: "1 / -1" }}
      >
        <MenuItem value="">
          <em>Not set</em>
        </MenuItem>
        {choices.map((account) => (
          <MenuItem key={account.id} value={account.id}>
            <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1.25 }}>
              <AccountIcon icon={account.icon} color={account.color} size={20} />
              {account.name}
            </Box>
          </MenuItem>
        ))}
      </TextField>
      {choices.length === 0 ? (
        <Alert severity="info" sx={{ gridColumn: "1 / -1" }}>
          You have no savings or current account yet.{" "}
          <Link component={RouterLink} to="/accounts">
            Add one on the Accounts page
          </Link>
          , then come back.
        </Alert>
      ) : null}
    </Box>
  );
}

export function PfFields({ draft, onChange, errors, serverFields, disabled, prefilled }: FieldsProps & { prefilled: boolean }) {
  const uanError = message(errors, serverFields, "uan", "uan");
  return (
    <Box sx={grid}>
      <TextField
        label="UAN"
        placeholder="12 digits"
        value={draft.uan}
        disabled={disabled}
        error={Boolean(uanError)}
        helperText={uanError ?? (prefilled ? "From your previous employer: a UAN stays the same when you change jobs" : "Universal Account Number, on your payslip")}
        onChange={(event) => onChange("uan", event.target.value.replace(/\D/g, "").slice(0, 12))}
        slotProps={{ htmlInput: { inputMode: "numeric", autoComplete: "off" } }}
      />
      <TextField
        label="Notes"
        placeholder="Optional"
        value={draft.comment}
        disabled={disabled}
        helperText=" "
        onChange={(event) => onChange("comment", event.target.value)}
        slotProps={{ htmlInput: { maxLength: 255 } }}
      />
    </Box>
  );
}
