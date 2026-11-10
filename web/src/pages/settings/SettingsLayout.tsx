import {
  mdiAccountOutline,
  mdiClipboardTextOutline,
  mdiCogOutline,
  mdiDatabaseCogOutline,
  mdiLockOpenOutline,
  mdiOnepassword,
  mdiPoundBoxOutline,
  mdiRhombusSplitOutline,
  mdiShieldAccountOutline,
  mdiSwapHorizontal,
} from "@mdi/js";
import Box from "@mui/material/Box";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import ListSubheader from "@mui/material/ListSubheader";
import Paper from "@mui/material/Paper";
import { Fragment, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";

import { MdiIcon } from "@/components/MdiIcon";
import { NotAvailableDialog } from "@/components/NotAvailableDialog";

interface SettingsNavItem {
  label: string;
  icon: string;
  /** A built page; without it the item says "not available yet". */
  to?: string;
}

/** ezBookkeeping's settings menu (SettingsPageLayout.vue), with the pages Hisaab does not have yet marked as planned. */
const SECTIONS: { title: string; items: SettingsNavItem[] }[] = [
  {
    title: "User Settings",
    items: [
      { label: "User Profile", icon: mdiAccountOutline, to: "/settings/profile" },
      { label: "Security", icon: mdiShieldAccountOutline, to: "/settings/security" },
      { label: "Two-Factor Authentication", icon: mdiOnepassword },
    ],
  },
  {
    title: "Basis Data",
    items: [
      { label: "Transaction Categories", icon: mdiRhombusSplitOutline, to: "/settings/categories" },
      { label: "Transaction Tags", icon: mdiPoundBoxOutline },
      { label: "Transaction Templates", icon: mdiClipboardTextOutline },
      { label: "Data Management", icon: mdiDatabaseCogOutline, to: "/settings/data" },
    ],
  },
  {
    title: "Application Settings",
    items: [
      { label: "Preferences", icon: mdiCogOutline, to: "/settings/preferences" },
      { label: "Application Lock", icon: mdiLockOpenOutline },
      { label: "Exchange Rates Data", icon: mdiSwapHorizontal },
    ],
  },
];

const itemSx = {
  borderRadius: 2,
  mb: 0.25,
  py: 0.75,
  color: "text.secondary",
  "& .MuiListItemIcon-root": { minWidth: 34, color: "inherit" },
  "&.active": { color: "primary.main", bgcolor: "rgb(var(--mui-palette-primary-mainChannel) / 0.1)" },
};

/** The settings area: a menu on the left (on top on phones) and the chosen page beside it, across the whole screen. */
export function SettingsLayout() {
  const [notAvailable, setNotAvailable] = useState<string | null>(null);

  return (
    <Box sx={{ display: "flex", flexDirection: { xs: "column", md: "row" }, alignItems: "flex-start", gap: 3 }}>
      <Paper
        component="nav"
        aria-label="Settings"
        variant="outlined"
        sx={{
          width: { xs: "100%", md: 300 },
          flex: "none",
          borderRadius: 3,
          p: 1,
          position: { md: "sticky" },
          top: { md: 56 + 24 },
          maxHeight: { md: "calc(100dvh - 104px)" },
          overflowY: { md: "auto" },
        }}
      >
        <Box
          component="ul"
          sx={{
            listStyle: "none",
            m: 0,
            p: 0,
            // A row that scrolls sideways on phones, a column from tablets up.
            display: { xs: "flex", md: "block" },
            overflowX: { xs: "auto", md: "visible" },
            gap: 0.5,
            scrollbarWidth: "none",
          }}
        >
          {SECTIONS.map((section) => (
            <Fragment key={section.title}>
              <ListSubheader component="li" sx={{ display: { xs: "none", md: "block" }, bgcolor: "transparent", lineHeight: "36px", fontWeight: 600 }}>
                {section.title}
              </ListSubheader>
              {section.items.map((item) => (
                <Box component="li" key={item.label} sx={{ flex: "none" }}>
                  {item.to ? (
                    <ListItemButton component={NavLink} to={item.to} sx={itemSx}>
                      <ListItemIcon>
                        <MdiIcon path={item.icon} sx={{ fontSize: 20 }} />
                      </ListItemIcon>
                      <ListItemText primary={item.label} slotProps={{ primary: { variant: "body2", noWrap: true } }} />
                    </ListItemButton>
                  ) : (
                    <ListItemButton sx={{ ...itemSx, display: { xs: "none", md: "flex" }, opacity: 0.7 }} onClick={() => setNotAvailable(item.label)}>
                      <ListItemIcon>
                        <MdiIcon path={item.icon} sx={{ fontSize: 20 }} />
                      </ListItemIcon>
                      <ListItemText primary={item.label} slotProps={{ primary: { variant: "body2", noWrap: true } }} />
                      <Box component="span" sx={{ typography: "caption", color: "text.disabled", ml: 1 }}>
                        Soon
                      </Box>
                    </ListItemButton>
                  )}
                </Box>
              ))}
            </Fragment>
          ))}
        </Box>
      </Paper>

      <Box sx={{ flex: 1, minWidth: 0, width: "100%" }}>
        <Outlet />
      </Box>

      <NotAvailableDialog feature={notAvailable} onClose={() => setNotAvailable(null)} />
    </Box>
  );
}
