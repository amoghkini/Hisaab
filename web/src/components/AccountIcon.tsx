import { accountIconPath } from "@/appearance/accountIcons";
import { MdiIcon } from "@/components/MdiIcon";

/** An account's icon in its own colour. No colour draws in the text colour; a hidden account is faded. */
export function AccountIcon({ icon, color, size = 24, faded = false }: { icon: string; color: string | null; size?: number; faded?: boolean }) {
  return <MdiIcon path={accountIconPath(icon)} sx={{ fontSize: size, color: color ?? "text.primary", flex: "none", opacity: faded ? 0.45 : 1 }} />;
}
