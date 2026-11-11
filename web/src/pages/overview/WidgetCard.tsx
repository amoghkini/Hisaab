import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { ReactNode } from "react";

import { MdiIcon } from "@/components/MdiIcon";

/** The frame every dashboard widget sits in. Styles are in overview.css. */
export function WidgetCard({ className, children }: { className?: string; children: ReactNode }) {
  return <Box className={className ? `overview-widget ${className}` : "overview-widget"}>{children}</Box>;
}

/** A widget's title row: an icon, the title, and optional buttons at the end. */
export function WidgetHeader({ icon, title, children }: { icon: string; title: string; children?: ReactNode }) {
  return (
    <Box className="overview-widget__header">
      <MdiIcon path={icon} color="primary" sx={{ fontSize: 20 }} />
      <Typography component="h2" className="overview-widget__title" title={title}>
        {title}
      </Typography>
      {children}
    </Box>
  );
}

/** Shown in place of a widget's content when there is nothing to show. */
export function WidgetEmpty({ icon, text = "No data" }: { icon: string; text?: string }) {
  return (
    <Box className="overview-widget__empty">
      <MdiIcon path={icon} sx={{ fontSize: 32 }} />
      <span>{text}</span>
    </Box>
  );
}
