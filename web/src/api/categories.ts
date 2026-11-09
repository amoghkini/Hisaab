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

/** One of the user's categories; a top-level one carries its sub-categories. */
export interface Category {
  id: number;
  type: CategoryType;
  parent_id: number | null;
  name: string;
  icon: string;
  color: string | null;
  /** Hidden categories stay on their transactions but are not offered for new ones. */
  hidden: boolean;
  display_order: number;
  /** Transactions in this category itself, not counting its sub-categories. */
  transaction_count: number;
  sub_categories: Category[];
}

/** The user's categories as a tree: expense, then income, then transfer. */
export function fetchCategories(): Promise<Category[]> {
  return request("/api/v1/categories");
}

/** Give a user who has no categories the preset ones. */
export function addPresetCategories(): Promise<Category[]> {
  return request("/api/v1/categories/presets", { method: "POST" });
}

export interface CategoryInput {
  type: CategoryType;
  /** Set for a sub-category: the top-level category it goes in. */
  parent_id: number | null;
  name: string;
  icon: string;
  color: string | null;
}

export interface CategoryUpdate {
  /** Moves a sub-category to another group of the same type. */
  parent_id?: number;
  name?: string;
  icon?: string;
  color?: string | null;
  hidden?: boolean;
}

export function createCategory(input: CategoryInput): Promise<Category> {
  return request("/api/v1/categories", { method: "POST", body: input });
}

export function updateCategory(id: number, input: CategoryUpdate): Promise<Category> {
  return request(`/api/v1/categories/${id}`, { method: "PATCH", body: input });
}

/** Deletes its sub-categories too. Refused while any of them has transactions. */
export function deleteCategory(id: number): Promise<void> {
  return request(`/api/v1/categories/${id}`, { method: "DELETE" });
}

/** Every top-level category of a type (parentId null), or every sub-category of a group, in the new order. */
export function reorderCategories(type: CategoryType, parentId: number | null, ids: number[]): Promise<Category[]> {
  return request("/api/v1/categories/order", { method: "PUT", body: { type, parent_id: parentId, ids } });
}
