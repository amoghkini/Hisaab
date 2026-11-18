import { SALARY_CURRENCY } from "@/api/salary";
import { usePrivacyMode } from "@/appearance/PrivacyMode";
import { HIDDEN_AMOUNT, formatAmount } from "@/lib/money";

/** A salary amount in paise, as rupees; hidden with the other amounts in privacy mode. */
export function SalaryAmount({ value }: { value: number }) {
  const { hidden } = usePrivacyMode();
  return <>{hidden ? HIDDEN_AMOUNT : formatAmount(value, SALARY_CURRENCY)}</>;
}
