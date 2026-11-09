import { categoryIconPath } from "@/appearance/categoryIcons";
import { MdiIcon } from "@/components/MdiIcon";

/** A category's icon in its own colour. No colour draws in the text colour, so it shows in light and dark. */
export function CategoryIcon({ icon, color, size = 22 }: { icon: string; color: string | null; size?: number }) {
  return <MdiIcon path={categoryIconPath(icon)} sx={{ fontSize: size, color: color ?? "text.primary", flex: "none" }} />;
}
