import { request } from "@/api/client";

export type CategoryType = "expense" | "income" | "transfer";

export interface PresetCategory {
  name: string;
  /** A Material Design Icons name, drawn with categoryIconPath(). */
  icon: string;
  /** "#rrggbb", or null for the text colour. */
  color: string | null;
  sub_categories: PresetCategory[];
}

export interface PresetGroup {
  type: CategoryType;
  categories: PresetCategory[];
}

export const CATEGORY_TYPE_NAMES: Record<CategoryType, string> = {
  expense: "Expense Categories",
  income: "Income Categories",
  transfer: "Transfer Categories",
};

export function fetchPresetCategories(): Promise<PresetGroup[]> {
  return request("/api/v1/categories/presets");
}
