import { useQuery, type QueryClient } from "@tanstack/react-query";

import {
  fetchComponentPresets,
  fetchEmployer,
  fetchEmployers,
  fetchPayslip,
  fetchPayslips,
  type EmployerDetail,
  type PayslipDetail,
  type PayslipStatus,
} from "@/api/salary";

export const SALARY_KEY = "salary";

export function useEmployers() {
  return useQuery({ queryKey: [SALARY_KEY, "employers"], queryFn: fetchEmployers });
}

export function useEmployer(id: number) {
  return useQuery({ queryKey: [SALARY_KEY, "employer", id], queryFn: () => fetchEmployer(id) });
}

export function useComponentPresets() {
  return useQuery({ queryKey: [SALARY_KEY, "presets"], queryFn: fetchComponentPresets, staleTime: Infinity });
}

/** Account ids the salary of a current employer is paid into: the accounts page tags them. */
export function useSalaryAccountIds(): Set<number> {
  const employers = useEmployers();
  return new Set(
    (employers.data ?? []).filter((each) => each.is_current && each.salary_account_ok && each.salary_account_id !== null).map((each) => each.salary_account_id!),
  );
}

/** After a change answered with the whole employer: show it at once, and refresh the list. */
export function storeEmployer(client: QueryClient, employer: EmployerDetail): Promise<void> {
  client.setQueryData([SALARY_KEY, "employer", employer.id], employer);
  return client.invalidateQueries({ queryKey: [SALARY_KEY, "employers"] });
}

export function invalidateSalary(client: QueryClient): Promise<void> {
  return client.invalidateQueries({ queryKey: [SALARY_KEY] });
}

export const NOTIFICATIONS_KEY = "notifications";

export function usePayslips(filters: { employer_id?: number; status?: PayslipStatus }) {
  return useQuery({ queryKey: [SALARY_KEY, "payslips", filters], queryFn: () => fetchPayslips(filters) });
}

export function usePayslip(id: number) {
  return useQuery({ queryKey: [SALARY_KEY, "payslip", id], queryFn: () => fetchPayslip(id) });
}

/**
 * After a payslip changes: it, the lists, and the bell (approving one reads its notification). Approving or
 * deleting one also moves money, so the ledger's queries are refreshed by the caller.
 */
export function storePayslip(client: QueryClient, payslip: PayslipDetail | null, id: number): Promise<void> {
  if (payslip) client.setQueryData([SALARY_KEY, "payslip", id], payslip);
  else client.removeQueries({ queryKey: [SALARY_KEY, "payslip", id] });
  return Promise.all([
    client.invalidateQueries({ queryKey: [SALARY_KEY, "payslips"] }),
    client.invalidateQueries({ queryKey: [NOTIFICATIONS_KEY] }),
  ]).then(() => undefined);
}
