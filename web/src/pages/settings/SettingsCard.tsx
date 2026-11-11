import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import type { ReactNode } from "react";

/** The heading of a settings page. */
export function SettingsPageTitle({ title, description }: { title: string; description: string }) {
  return (
    <Box sx={{ mb: 2.5 }}>
      <Typography variant="h5" component="h1">
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {description}
      </Typography>
    </Box>
  );
}

/** One card of settings, with a title, an optional line under it, and its rows or content. */
export function SettingsCard({
  title,
  description,
  action,
  children,
  footer,
  danger = false,
}: {
  title: string;
  description?: string;
  /** Beside the title, such as a refresh button. */
  action?: ReactNode;
  children: ReactNode;
  /** Below a divider, such as the Save button. */
  footer?: ReactNode;
  danger?: boolean;
}) {
  return (
    <Paper variant="outlined" sx={{ borderRadius: 3, mb: 2.5, ...(danger ? { borderColor: "error.main" } : {}) }}>
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2, px: 3, pt: 2.5, pb: 2 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle1" component="h2" sx={danger ? { color: "error.main" } : undefined}>
            {title}
          </Typography>
          {description ? (
            <Typography variant="body2" color="text.secondary">
              {description}
            </Typography>
          ) : null}
        </Box>
        {action}
      </Box>
      <Divider />
      <Box sx={{ px: 3, py: 1 }}>{children}</Box>
      {footer ? (
        <>
          <Divider />
          <Box sx={{ display: "flex", justifyContent: "flex-end", flexWrap: "wrap", gap: 1, px: 3, py: 1.5 }}>{footer}</Box>
        </>
      ) : null}
    </Paper>
  );
}

/**
 * A setting as ezBookkeeping lays it out: the name (and a hint) on the left, the control on the right. On phones the
 * control goes under the name.
 */
export function SettingRow({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: { xs: "column", sm: "row" },
        alignItems: { xs: "stretch", sm: "center" },
        gap: { xs: 1, sm: 3 },
        py: 1.5,
        "& + &": { borderTop: 1, borderColor: "divider" },
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: 500 }}>
          {label}
        </Typography>
        {hint ? (
          <Typography variant="caption" color="text.secondary" component="div">
            {hint}
          </Typography>
        ) : null}
      </Box>
      <Box sx={{ width: { xs: "100%", sm: 400 }, maxWidth: "100%", flex: "none" }}>{children}</Box>
    </Box>
  );
}
