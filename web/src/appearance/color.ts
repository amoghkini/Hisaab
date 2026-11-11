import { getContrastRatio } from "@mui/material/styles";

/** ezBookkeeping's brown: the colour until a user picks another. */
export const DEFAULT_THEME_COLOR = "#c67e48";

export const PRESET_COLORS: { name: string; value: string }[] = [
  { name: "Hisaab Brown", value: DEFAULT_THEME_COLOR },
  { name: "Teal", value: "#009688" },
  { name: "Green", value: "#43a047" },
  { name: "Blue", value: "#1e88e5" },
  { name: "Indigo", value: "#3f51b5" },
  { name: "Purple", value: "#8e24aa" },
  { name: "Pink", value: "#d81b60" },
  { name: "Red", value: "#e53935" },
  { name: "Orange", value: "#f57c00" },
  { name: "Slate", value: "#546e7a" },
];

const HEX = /^#[0-9a-f]{6}$/;

/** "#AbC123" or "abc123" becomes "#abc123"; anything else is null. */
export function normalizeHex(value: string): string | null {
  const text = value.trim().toLowerCase();
  const hex = text.startsWith("#") ? text : `#${text}`;
  return HEX.test(hex) ? hex : null;
}

/** White text on the colour when it reads well enough (the MUI threshold), otherwise near-black. */
export function textOn(color: string): string {
  return getContrastRatio(color, "#ffffff") >= 3 ? "#ffffff" : "#1b1b19";
}

// The last colour this browser showed, so pages before sign-in (and the first paint after) use it too.
const STORAGE_KEY = "hisaab-theme-color";

export function readStoredColor(): string {
  try {
    return normalizeHex(localStorage.getItem(STORAGE_KEY) ?? "") ?? DEFAULT_THEME_COLOR;
  } catch {
    return DEFAULT_THEME_COLOR;
  }
}

export function storeColor(color: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, color);
  } catch {
    // Storage can be blocked; the colour then comes from the account alone.
  }
}
