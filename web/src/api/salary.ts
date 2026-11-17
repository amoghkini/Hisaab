import { request } from "@/api/client";

const SALARY = "/api/v1/salary";
const EMPLOYERS = `${SALARY}/employers`;

/** Salary amounts are in rupees: the API sends paise. */
export const SALARY_CURRENCY = "INR";

export type ComponentKind = "earning" | "deduction" | "employer_contribution";
export type RevisionKind = "joining" | "appraisal" | "promotion" | "restructure";
export type DocumentKind =
  | "offer_letter"
  | "joining_letter"
  | "appraisal_letter"
  | "promotion_letter"
  | "relieving_letter"
  | "form16"
  | "tax_forecast"
  | "other";

/** In the order the salary structure lists them, the same as the backend's. */
export const COMPONENT_KINDS: { value: ComponentKind; name: string; plural: string; hint: string }[] = [
  { value: "earning", name: "Earning", plural: "Earnings", hint: "Paid to you: basic, HRA, allowances" },
  { value: "deduction", name: "Deduction", plural: "Deductions", hint: "Taken off your pay: employee PF, professional tax, TDS" },
  {
    value: "employer_contribution",
    name: "Employer contribution",
    plural: "Employer contributions",
    hint: "Part of your CTC but not paid out: employer PF, gratuity",
  },
];

export const REVISION_KINDS: { value: RevisionKind; name: string }[] = [
  { value: "joining", name: "Joining offer" },
  { value: "appraisal", name: "Appraisal" },
  { value: "promotion", name: "Promotion" },
  { value: "restructure", name: "Restructure" },
];

export const DOCUMENT_KINDS: { value: DocumentKind; name: string; yearly: boolean }[] = [
  { value: "offer_letter", name: "Offer letter", yearly: false },
  { value: "joining_letter", name: "Joining letter", yearly: false },
  { value: "appraisal_letter", name: "Appraisal letter", yearly: false },
  { value: "promotion_letter", name: "Promotion letter", yearly: false },
  { value: "relieving_letter", name: "Relieving letter", yearly: false },
  { value: "form16", name: "Form 16", yearly: true },
  { value: "tax_forecast", name: "Tax forecast", yearly: true },
  { value: "other", name: "Other", yearly: false },
];

export function componentKindName(kind: ComponentKind): string {
  return COMPONENT_KINDS.find((each) => each.value === kind)?.name ?? kind;
}

export function revisionKindName(kind: RevisionKind): string {
  return REVISION_KINDS.find((each) => each.value === kind)?.name ?? kind;
}

export function documentKindName(kind: DocumentKind): string {
  return DOCUMENT_KINDS.find((each) => each.value === kind)?.name ?? kind;
}

/** "FY 2025-26" for 2025. */
export function financialYearName(startYear: number): string {
  return `FY ${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}

/** A twelfth of a yearly amount in paise, rounded to the rupee, as the backend does. */
export function monthlyAmount(yearly: number): number {
  return Math.floor((yearly + 600) / 1200) * 100;
}

export interface Totals {
  /** Earnings. */
  gross: number;
  deductions: number;
  /** Earnings less deductions: the take-home pay. */
  net: number;
  employer_contributions: number;
  /** Earnings plus employer contributions. */
  ctc: number;
}

export interface ComponentPreset {
  name: string;
  kind: ComponentKind;
}

export interface SalaryComponent {
  id: number;
  name: string;
  kind: ComponentKind;
  display_order: number;
}

export interface RevisionLine {
  component_id: number;
  yearly_amount: number;
  monthly_amount: number;
}

export interface SalaryRevision {
  id: number;
  kind: RevisionKind;
  /** "YYYY-MM-DD": when the user was told. */
  announced_on: string | null;
  /** "YYYY-MM-DD": when the new pay applies. */
  effective_from: string;
  /** The title this revision set, or null if it kept the last one. */
  designation: string | null;
  /** The title from this revision on. */
  designation_in_effect: string | null;
  comment: string;
  status: "past" | "current" | "upcoming";
  lines: RevisionLine[];
  yearly: Totals;
  monthly: Totals;
}

export interface EmployerDocument {
  id: number;
  kind: DocumentKind;
  /** The year the financial year starts in: 2025 is FY 2025-26. */
  financial_year: number | null;
  revision_id: number | null;
  title: string;
  issued_on: string | null;
  gross_salary: number | null;
  taxable_income: number | null;
  tds: number | null;
  comment: string;
}

export interface Employer {
  id: number;
  name: string;
  employee_code: string | null;
  joined_on: string;
  left_on: string | null;
  first_pay_on: string;
  /** 1 ... 31; a short month pays on its last day. */
  pay_day: number;
  salary_account_id: number | null;
  /** False when the linked account is gone or is no longer a savings or current account. */
  salary_account_ok: boolean;
  uan: string | null;
  comment: string;
  is_current: boolean;
  designation: string | null;
  /** Totals of the pay in force. */
  yearly: Totals | null;
  monthly: Totals | null;
}

export interface EmployerDetail extends Employer {
  components: SalaryComponent[];
  /** Newest effective date first. */
  revisions: SalaryRevision[];
  current_revision_id: number | null;
  documents: EmployerDocument[];
}

/** An existing component by id, or a new one by name and kind. */
export type LineInput = { component_id: number; yearly_amount: number } | { name: string; kind: ComponentKind; yearly_amount: number };

export interface EmployerInput {
  name: string;
  employee_code: string | null;
  joined_on: string;
  left_on: string | null;
  first_pay_on: string | null;
  pay_day: number;
  salary_account_id: number | null;
  uan: string | null;
  comment: string;
  designation: string | null;
  lines: LineInput[];
}

export type EmployerUpdate = Partial<Omit<EmployerInput, "designation" | "lines">>;

export interface RevisionInput {
  kind: Exclude<RevisionKind, "joining">;
  announced_on: string | null;
  effective_from: string;
  designation: string | null;
  comment: string;
  lines: LineInput[];
}

export type RevisionUpdate = Partial<Omit<RevisionInput, "kind">>;

export type DocumentInput = Omit<EmployerDocument, "id">;

export function fetchComponentPresets(): Promise<ComponentPreset[]> {
  return request(`${SALARY}/component-presets`);
}

export function fetchEmployers(): Promise<Employer[]> {
  return request(EMPLOYERS);
}

export function fetchEmployer(id: number): Promise<EmployerDetail> {
  return request(`${EMPLOYERS}/${id}`);
}

export function createEmployer(input: EmployerInput): Promise<EmployerDetail> {
  return request(EMPLOYERS, { method: "POST", body: input });
}

export function updateEmployer(id: number, input: EmployerUpdate): Promise<EmployerDetail> {
  return request(`${EMPLOYERS}/${id}`, { method: "PATCH", body: input });
}

export function deleteEmployer(id: number): Promise<void> {
  return request(`${EMPLOYERS}/${id}`, { method: "DELETE" });
}

export function addComponent(employerId: number, input: { name: string; kind: ComponentKind }): Promise<EmployerDetail> {
  return request(`${EMPLOYERS}/${employerId}/components`, { method: "POST", body: input });
}

export function updateComponent(employerId: number, componentId: number, input: { name?: string; kind?: ComponentKind }): Promise<EmployerDetail> {
  return request(`${EMPLOYERS}/${employerId}/components/${componentId}`, { method: "PATCH", body: input });
}

export function deleteComponent(employerId: number, componentId: number): Promise<EmployerDetail> {
  return request(`${EMPLOYERS}/${employerId}/components/${componentId}`, { method: "DELETE" });
}

export function addRevision(employerId: number, input: RevisionInput): Promise<EmployerDetail> {
  return request(`${EMPLOYERS}/${employerId}/revisions`, { method: "POST", body: input });
}

export function updateRevision(employerId: number, revisionId: number, input: RevisionUpdate): Promise<EmployerDetail> {
  return request(`${EMPLOYERS}/${employerId}/revisions/${revisionId}`, { method: "PATCH", body: input });
}

export function deleteRevision(employerId: number, revisionId: number): Promise<EmployerDetail> {
  return request(`${EMPLOYERS}/${employerId}/revisions/${revisionId}`, { method: "DELETE" });
}

export function addDocument(employerId: number, input: DocumentInput): Promise<EmployerDetail> {
  return request(`${EMPLOYERS}/${employerId}/documents`, { method: "POST", body: input });
}

export function replaceDocument(employerId: number, documentId: number, input: DocumentInput): Promise<EmployerDetail> {
  return request(`${EMPLOYERS}/${employerId}/documents/${documentId}`, { method: "PUT", body: input });
}

export function deleteDocument(employerId: number, documentId: number): Promise<EmployerDetail> {
  return request(`${EMPLOYERS}/${employerId}/documents/${documentId}`, { method: "DELETE" });
}

// Payslips

export type PayslipStatus = "draft" | "posted";
/** Where the amounts came from: the revision's yearly / 12, the last approved payslip, or the user's own edits. */
export type PrefillSource = "revision" | "previous" | "manual";

export const PREFILL_SOURCE_TEXT: Record<PrefillSource, string> = {
  revision: "Started from a twelfth of the yearly pay in force",
  previous: "Started from your last approved payslip",
  manual: "Edited by you",
};

export interface Payslip {
  id: number;
  employer_id: number;
  employer_name: string;
  /** "YYYY-MM-01": the month the salary is paid in. */
  pay_month: string;
  pay_date: string;
  status: PayslipStatus;
  prefill_source: PrefillSource;
  revision_id: number | null;
  category_id: number | null;
  comment: string;
  totals: Totals;
}

export interface PayslipLine {
  component_id: number;
  name: string;
  kind: ComponentKind;
  /** This month, in paise. */
  amount: number;
}

export interface PayslipDetail extends Payslip {
  /** Every component of the employer; zero when not paid this month. */
  lines: PayslipLine[];
  salary_account_id: number | null;
  /** Why it cannot be approved yet, or null. */
  post_problem: string | null;
  transaction_ids: number[];
}

export interface PayslipUpdate {
  pay_date?: string;
  category_id?: number | null;
  comment?: string;
  lines?: { component_id: number; amount: number }[];
}

/** "July 2026" for "2026-07-01". */
export function payMonthName(payMonth: string): string {
  const [year, month] = payMonth.split("-").map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

export function fetchPayslips(filters: { employer_id?: number; status?: PayslipStatus } = {}): Promise<Payslip[]> {
  const params = new URLSearchParams();
  if (filters.employer_id !== undefined) params.set("employer_id", String(filters.employer_id));
  if (filters.status) params.set("status", filters.status);
  const query = params.toString();
  return request(`${SALARY}/payslips${query ? `?${query}` : ""}`);
}

export function fetchPayslip(id: number): Promise<PayslipDetail> {
  return request(`${SALARY}/payslips/${id}`);
}

export function createPayslip(input: { employer_id: number; pay_month: string }): Promise<PayslipDetail> {
  return request(`${SALARY}/payslips`, { method: "POST", body: input });
}

export function updatePayslip(id: number, input: PayslipUpdate): Promise<PayslipDetail> {
  return request(`${SALARY}/payslips/${id}`, { method: "PATCH", body: input });
}

export function refillPayslip(id: number): Promise<PayslipDetail> {
  return request(`${SALARY}/payslips/${id}/refill`, { method: "POST" });
}

export function postPayslip(id: number): Promise<PayslipDetail> {
  return request(`${SALARY}/payslips/${id}/post`, { method: "POST" });
}

export function deletePayslip(id: number): Promise<void> {
  return request(`${SALARY}/payslips/${id}`, { method: "DELETE" });
}
