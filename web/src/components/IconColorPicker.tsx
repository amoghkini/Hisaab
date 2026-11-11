import { mdiCheck } from "@mdi/js";
import Box from "@mui/material/Box";
import Popover from "@mui/material/Popover";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useState, type ReactNode } from "react";

import { ACCOUNT_COLORS as ICON_COLORS } from "@/appearance/accountIcons";
import { MdiIcon } from "@/components/MdiIcon";

interface IconColorPickerProps {
  icon: string;
  color: string | null;
  disabled: boolean;
  /** The icon names to offer, in order. */
  iconNames: string[];
  /** Draws one icon name in a colour (null is the text colour). */
  renderIcon: (name: string, color: string | null, size: number) => ReactNode;
  onChange: (icon: string, color: string | null) => void;
}

/**
 * An icon as a button; it opens a row of colours and a grid of icons. Used for accounts and categories, which
 * share ezBookkeeping's colour list.
 */
export function IconColorPicker({ icon, color, disabled, iconNames, renderIcon, onChange }: IconColorPickerProps) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return (
    <>
      <Tooltip title="Icon and color">
        <Box
          component="button"
          type="button"
          aria-label="Choose icon and color"
          disabled={disabled}
          onClick={(event) => setAnchor(event.currentTarget)}
          sx={{
            width: 40,
            height: 40,
            flex: "none",
            display: "grid",
            placeItems: "center",
            cursor: "pointer",
            bgcolor: "transparent",
            border: 1,
            borderColor: "divider",
            borderRadius: 1,
            "&:hover": { borderColor: "text.primary" },
            "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main" },
          }}
        >
          {renderIcon(icon, color, 24)}
        </Box>
      </Tooltip>
      <Popover
        open={anchor !== null}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        slotProps={{ paper: { sx: { p: 2, width: 320, maxWidth: "calc(100vw - 32px)" } } }}
      >
        <Typography variant="body2" sx={{ fontWeight: 500, mb: 1 }}>
          Color
        </Typography>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 2 }}>
          {ICON_COLORS.map((option) => (
            <Tooltip key={option.name} title={option.name}>
              <Box
                component="button"
                type="button"
                aria-label={option.name}
                aria-pressed={option.value === color}
                onClick={() => onChange(icon, option.value)}
                sx={{
                  width: 26,
                  height: 26,
                  p: 0,
                  display: "grid",
                  placeItems: "center",
                  cursor: "pointer",
                  borderRadius: "50%",
                  border: option.value ? 0 : 1,
                  borderColor: "divider",
                  bgcolor: option.value ?? "text.primary",
                  color: "background.paper",
                }}
              >
                {option.value === color ? <MdiIcon path={mdiCheck} sx={{ fontSize: 16 }} /> : null}
              </Box>
            </Tooltip>
          ))}
        </Box>
        <Typography variant="body2" sx={{ fontWeight: 500, mb: 1 }}>
          Icon
        </Typography>
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(40px, 1fr))", gap: 0.5 }}>
          {iconNames.map((name) => (
            <Box
              key={name}
              component="button"
              type="button"
              aria-label={name.replaceAll("-", " ")}
              aria-pressed={name === icon}
              onClick={() => {
                onChange(name, color);
                setAnchor(null);
              }}
              sx={{
                height: 40,
                display: "grid",
                placeItems: "center",
                cursor: "pointer",
                bgcolor: name === icon ? "rgb(var(--mui-palette-primary-mainChannel) / 0.12)" : "transparent",
                border: 1,
                borderColor: name === icon ? "primary.main" : "transparent",
                borderRadius: 1,
                "&:hover": { bgcolor: "action.hover" },
              }}
            >
              {renderIcon(name, color, 22)}
            </Box>
          ))}
        </Box>
      </Popover>
    </>
  );
}
