import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider, useColorScheme } from "@mui/material/styles";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import type { ThemeMode } from "@/api/auth";
import { DEFAULT_THEME_COLOR, readStoredColor, storeColor } from "@/appearance/color";
import { DEFAULT_PREFERENCES, amountColorCss } from "@/appearance/preferences";
import { useMe } from "@/auth/session";
import { createAppTheme } from "@/theme";

interface ThemeColorContextValue {
  /** The colour on screen now. */
  color: string;
  /** Show a colour without saving it (the profile page while choosing); null goes back to the saved one. */
  setPreview: (color: string | null) => void;
  /** Show light, dark or system without saving it; null goes back to the saved one. */
  setModePreview: (mode: ThemeMode | null) => void;
}

const ThemeColorContext = createContext<ThemeColorContextValue | null>(null);

/**
 * Applies a light/dark/system choice through MUI, which puts a "light" or "dark" class on <html> (see the
 * script in index.html for the first paint). Null leaves the mode this browser last used.
 */
function ModeSync({ mode }: { mode: ThemeMode | null }) {
  const { mode: current, setMode } = useColorScheme();
  useEffect(() => {
    if (mode && mode !== current) setMode(mode);
  }, [mode, current, setMode]);
  return null;
}

/**
 * The one place the theme is decided: its colour and whether it is light or dark. Everything coloured reads
 * it from the theme: MUI components through the palette, and styles.css through the --mui-palette-* variables
 * MUI writes and the .dark class on <html>. So nothing else in the app should name a colour for "primary".
 *
 * Which colour and mode: a preview if one is showing, else the signed-in user's choice (or the default), else
 * what this browser last showed.
 */
export function ThemeColorProvider({ children }: { children: ReactNode }) {
  const me = useMe();
  const [preview, setPreview] = useState<string | null>(null);
  const [modePreview, setModePreview] = useState<ThemeMode | null>(null);
  const accountColor = me.data ? (me.data.theme_color ?? DEFAULT_THEME_COLOR) : null;
  const color = preview ?? accountColor ?? readStoredColor();
  const mode = modePreview ?? me.data?.theme_mode ?? null;

  useEffect(() => {
    if (accountColor) storeColor(accountColor);
  }, [accountColor]);

  useEffect(() => {
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", color);
  }, [color]);

  // Amounts are coloured by the user's choice: use var(--hk-expense-color) and var(--hk-income-color).
  const expense = amountColorCss(me.data?.expense_amount_color ?? DEFAULT_PREFERENCES.expense_amount_color);
  const income = amountColorCss(me.data?.income_amount_color ?? DEFAULT_PREFERENCES.income_amount_color);
  useEffect(() => {
    document.documentElement.style.setProperty("--hk-expense-color", expense);
    document.documentElement.style.setProperty("--hk-income-color", income);
  }, [expense, income]);

  const theme = useMemo(() => createAppTheme(color), [color]);
  const value = useMemo(() => ({ color, setPreview, setModePreview }), [color]);

  return (
    <ThemeColorContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        <ModeSync mode={mode} />
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeColorContext.Provider>
  );
}

export function useThemeColor(): ThemeColorContextValue {
  const value = useContext(ThemeColorContext);
  if (!value) throw new Error("useThemeColor needs ThemeColorProvider");
  return value;
}
