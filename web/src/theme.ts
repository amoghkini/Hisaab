import { createTheme, type Theme } from "@mui/material/styles";

import { DEFAULT_THEME_COLOR, textOn } from "@/appearance/color";

/**
 * The MUI theme for a given primary colour. Everything else (surfaces, text, status colours, sizes) is fixed
 * and follows ezBookkeeping's desktop theme (MIT, see THIRD_PARTY_NOTICES.md). Light or dark follows the
 * user's choice (ThemeColorProvider), which MUI applies as a "light" or "dark" class on <html>.
 *
 * Sizes are compact: 14px body text, 40px fields, 36px buttons.
 */
export function createAppTheme(primaryColor: string): Theme {
  // The default keeps ezBookkeeping's hand-picked hover shade; other colours get MUI's computed one.
  const primary =
    primaryColor === DEFAULT_THEME_COLOR
      ? { main: DEFAULT_THEME_COLOR, dark: "#b67443", contrastText: "#ffffff" }
      : { main: primaryColor, contrastText: textOn(primaryColor) };

  const status = {
    secondary: { main: "#8c8c8c", dark: "#595754", contrastText: "#ffffff" },
    success: { main: "#4cd964", dark: "#40b654", contrastText: "#ffffff" },
    info: { main: "#2196f3", dark: "#1e85d7", contrastText: "#ffffff" },
    warning: { main: "#ff9500", dark: "#de8201", contrastText: "#ffffff" },
    error: { main: "#ff3b30", dark: "#e1342b", contrastText: "#ffffff" },
  };

  return createTheme({
    cssVariables: { colorSchemeSelector: "class" },
    colorSchemes: {
      light: {
        palette: {
          primary,
          ...status,
          background: { default: "#faf8f4", paper: "#ffffff" },
          text: { primary: "rgba(65, 57, 53, 0.9)", secondary: "rgba(65, 57, 53, 0.7)" },
          divider: "rgba(65, 63, 59, 0.12)",
        },
      },
      dark: {
        palette: {
          primary,
          ...status,
          secondary: { main: "#9d9b99", dark: "#3e3d3c", contrastText: "#ffffff" },
          background: { default: "#060504", paper: "#1a1a1a" },
          text: { primary: "rgba(252, 240, 227, 0.9)", secondary: "rgba(252, 240, 227, 0.7)" },
          divider: "rgba(237, 236, 233, 0.12)",
        },
      },
    },
    shape: { borderRadius: 6 },
    typography: {
      fontFamily:
        '"Inter Variable", Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      fontSize: 13,
      h5: { fontSize: "1.25rem", lineHeight: "1.75rem", fontWeight: 500, letterSpacing: "-0.01em" },
      h6: { fontSize: "1rem", lineHeight: "1.5rem", fontWeight: 600 },
      subtitle1: { fontSize: "0.9375rem", lineHeight: "1.375rem", fontWeight: 600 },
      body1: { fontSize: "0.875rem", lineHeight: "1.375rem" },
      body2: { fontSize: "0.8125rem", lineHeight: "1.25rem" },
      button: { fontSize: "0.8125rem", textTransform: "none", fontWeight: 500, letterSpacing: "0.01em" },
    },
    components: {
      MuiButton: {
        defaultProps: { variant: "contained", disableElevation: true },
        styleOverrides: { root: { minHeight: 36, paddingInline: 16 } },
      },
      MuiTextField: {
        defaultProps: { variant: "outlined", fullWidth: true, size: "small" },
      },
      MuiInputBase: {
        styleOverrides: { root: { fontSize: "0.875rem" } },
      },
      MuiInputLabel: {
        styleOverrides: { root: { fontSize: "0.875rem" } },
      },
      MuiSnackbar: {
        // At the top, so on small screens a message never covers the form's buttons.
        defaultProps: { anchorOrigin: { vertical: "top", horizontal: "center" }, autoHideDuration: 3000 },
      },
      MuiLink: {
        defaultProps: { underline: "hover" },
      },
      MuiTooltip: {
        defaultProps: { arrow: true },
      },
    },
  });
}
