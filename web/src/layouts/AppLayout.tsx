import {
  mdiAccountCircleOutline,
  mdiBriefcaseOutline,
  mdiCalculatorVariantOutline,
  mdiChartLine,
  mdiChevronDown,
  mdiCogOutline,
  mdiEyeOffOutline,
  mdiEyeOutline,
  mdiListBoxOutline,
  mdiLogout,
  mdiShapeOutline,
  mdiViewDashboardOutline,
  mdiWalletOutline,
  mdiWeatherNight,
  mdiWeatherSunny,
} from "@mdi/js";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import MenuItem from "@mui/material/MenuItem";
import { useColorScheme } from "@mui/material/styles";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { NavLink, Link as RouterLink, Outlet, useLocation, useNavigate } from "react-router-dom";

import { signOut, updateMe, type User } from "@/api/auth";
import { usePrivacyMode } from "@/appearance/PrivacyMode";
import { useMe, useSetMe } from "@/auth/session";
import { Logo } from "@/components/Logo";
import { HoverMenu } from "@/components/HoverMenu";
import { MarketTicker } from "@/components/MarketTicker";
import { MdiIcon } from "@/components/MdiIcon";
import { NotAvailableDialog } from "@/components/NotAvailableDialog";

const NAV = [
  { to: "/", label: "Overview", icon: mdiViewDashboardOutline, end: true },
  { to: "/transactions", label: "Transactions", icon: mdiListBoxOutline, end: false },
  { to: "/accounts", label: "Accounts", icon: mdiWalletOutline, end: false },
];

/**
 * The planned sections (docs/content/architecture.md). Not built yet: each item says so.
 * When a page is built, give its item a `to` and route it like the links above.
 */
const PLANNED_NAV = [
  {
    label: "Investments",
    icon: mdiChartLine,
    items: ["Portfolio", "EPF", "PPF and NPS", "Fixed and recurring deposits", "Mutual funds and stocks", "Sync from EPFO"],
  },
  {
    label: "Salary",
    icon: mdiBriefcaseOutline,
    items: ["Payslips", "Add a payslip", "Employers and salary structure"],
  },
  {
    label: "Taxes",
    icon: mdiCalculatorVariantOutline,
    items: ["Tax summary", "TDS and taxes paid", "Deductions (80C, 80D and others)", "Old vs new regime"],
  },
];

const navButtonSx = {
  color: "text.secondary",
  flexShrink: 0,
  // Icons only on phones, so the items fit beside the logo and the buttons on the right.
  minWidth: { xs: 34, sm: 64 },
  px: { xs: 0.5, sm: 1 },
  "& .MuiButton-startIcon": { mx: { xs: 0 }, mr: { sm: 1 } },
};

/** The frame of the signed-in pages: a top bar with the navigation, and the page below it. */
export function AppLayout() {
  // The dashboard, accounts and transactions pages use the full width of the screen.
  const path = useLocation().pathname;
  const fullWidth = path === "/" || path.startsWith("/accounts") || path.startsWith("/transactions");
  const maxWidth = fullWidth ? "none" : 1080;

  return (
    <Box sx={{ minHeight: "100dvh" }}>
      <Box
        component="header"
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          gap: { xs: 0.5, sm: 3 },
          px: { xs: 1, sm: 3 },
          height: 56,
          bgcolor: "background.paper",
          borderBottom: 1,
          borderColor: "divider",
        }}
      >
        <Box component={RouterLink} to="/" sx={{ display: "flex", alignItems: "center", gap: 1.25, color: "inherit", textDecoration: "none" }}>
          <Logo />
          <Typography sx={{ fontSize: "1.125rem", fontWeight: 600, letterSpacing: "-0.01em", display: { xs: "none", sm: "block" } }}>
            Hisaab
          </Typography>
        </Box>

        <Box
          component="nav"
          sx={{ display: "flex", gap: { xs: 0, sm: 0.5 }, flex: 1, minWidth: 0, overflowX: "auto", scrollbarWidth: "none" }}
        >
          {NAV.map((item) => (
            <Button
              key={item.to}
              component={NavLink}
              to={item.to}
              end={item.end}
              variant="text"
              color="inherit"
              startIcon={<MdiIcon path={item.icon} />}
              aria-label={item.label}
              sx={{
                ...navButtonSx,
                "&.active": { color: "primary.main", bgcolor: "rgb(var(--mui-palette-primary-mainChannel) / 0.08)" },
              }}
            >
              <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>
                {item.label}
              </Box>
            </Button>
          ))}
          {PLANNED_NAV.map((section) => (
            <PlannedNavMenu key={section.label} {...section} />
          ))}
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <MarketTicker />
          <ThemeModeSwitch />
          <PrivacyModeSwitch />
          <UserMenu />
        </Box>
      </Box>

      <Box component="main" sx={{ maxWidth, mx: "auto", px: { xs: 2, sm: 3 }, py: 3 }}>
        <Outlet />
      </Box>
    </Box>
  );
}

/** A navigation item with a dropdown of pages that are not built yet. */
function PlannedNavMenu({ label, icon, items }: (typeof PLANNED_NAV)[number]) {
  const [notAvailable, setNotAvailable] = useState<string | null>(null);

  return (
    <>
      <HoverMenu
        trigger={(open) => (
          <Button
            aria-haspopup="menu"
            aria-expanded={open}
            variant="text"
            color="inherit"
            startIcon={<MdiIcon path={icon} />}
            endIcon={<MdiIcon path={mdiChevronDown} />}
            aria-label={label}
            sx={{ ...navButtonSx, "& .MuiButton-endIcon": { display: { xs: "none", sm: "inherit" }, ml: 0.25 } }}
          >
            <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>
              {label}
            </Box>
          </Button>
        )}
      >
        {(close) =>
          items.map((item) => (
            <MenuItem
              key={item}
              onClick={() => {
                close();
                setNotAvailable(`${label}: ${item}`);
              }}
            >
              {item}
            </MenuItem>
          ))
        }
      </HoverMenu>
      <NotAvailableDialog feature={notAvailable} onClose={() => setNotAvailable(null)} />
    </>
  );
}

/** Switches between light and dark, and saves the choice with the account like the profile page does. */
function ThemeModeSwitch() {
  const me = useMe();
  const setMe = useSetMe();
  const { mode, systemMode } = useColorScheme();
  const dark = (mode === "system" ? systemMode : mode) === "dark";
  const next = dark ? "light" : "dark";

  const save = useMutation({
    mutationFn: (user: User) => updateMe({ theme_mode: next }).catch((error: unknown) => {
      setMe(user); // put the old choice back
      throw error;
    }),
    onSuccess: setMe,
  });

  const label = dark ? "Switch to light mode" : "Switch to dark mode";
  return (
    <Tooltip title={label}>
      <IconButton
        aria-label={label}
        disabled={!me.data}
        onClick={() => {
          if (!me.data) return;
          setMe({ ...me.data, theme_mode: next }); // switch at once; the save follows
          save.mutate(me.data);
        }}
      >
        <MdiIcon path={dark ? mdiWeatherSunny : mdiWeatherNight} />
      </IconButton>
    </Tooltip>
  );
}

/** Hides or shows every amount. The dashboard's eye button is the same switch. */
function PrivacyModeSwitch() {
  const { hidden, toggle } = usePrivacyMode();
  const label = hidden ? "Show amounts" : "Hide amounts";
  return (
    <Tooltip title={label}>
      <IconButton aria-label={label} aria-pressed={hidden} onClick={toggle} color={hidden ? "primary" : "default"}>
        <MdiIcon path={hidden ? mdiEyeOutline : mdiEyeOffOutline} />
      </IconButton>
    </Tooltip>
  );
}

/** The user's first name; it opens a menu with the settings and log out. */
function UserMenu() {
  const me = useMe();
  const setMe = useSetMe();
  const navigate = useNavigate();
  // Forget the user here even if the call fails, so the button always logs out.
  const logout = useMutation({ mutationFn: signOut, onSettled: () => setMe(null) });
  const name = me.data?.name ?? "";
  const firstName = name.trim().split(/\s+/)[0] ?? "";

  return (
    <HoverMenu
      placement="bottom-end"
      trigger={(open) => (
        <Button
          aria-haspopup="menu"
          aria-expanded={open}
          variant="text"
          color="inherit"
          endIcon={<MdiIcon path={mdiChevronDown} />}
          aria-label={`Account menu for ${firstName}`}
          sx={{ ml: { xs: 0, sm: 0.5 }, maxWidth: 160, minWidth: { xs: 40, sm: 64 }, px: { xs: 0.5, sm: 1 }, "& .MuiButton-endIcon": { ml: { xs: 0, sm: 1 } } }}
        >
          {/* On phones, an icon instead of the name, so the navigation fits. */}
          <MdiIcon path={mdiAccountCircleOutline} sx={{ display: { xs: "block", sm: "none" } }} />
          <Box component="span" sx={{ display: { xs: "none", sm: "block" }, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {firstName}
          </Box>
        </Button>
      )}
    >
      {(close) => [
        <Box key="who" sx={{ px: 2, py: 1 }}>
          <Typography sx={{ fontWeight: 600 }}>{name}</Typography>
          <Typography variant="body2" color="text.secondary">
            {me.data?.email}
          </Typography>
        </Box>,
        <Divider key="divider" />,
        <MenuItem
          key="settings"
          onClick={() => {
            close();
            void navigate("/profile");
          }}
        >
          <ListItemIcon>
            <MdiIcon path={mdiCogOutline} fontSize="small" />
          </ListItemIcon>
          Settings
        </MenuItem>,
        <MenuItem
          key="categories"
          onClick={() => {
            close();
            void navigate("/categories");
          }}
        >
          <ListItemIcon>
            <MdiIcon path={mdiShapeOutline} fontSize="small" />
          </ListItemIcon>
          Categories
        </MenuItem>,
        <MenuItem key="logout" disabled={logout.isPending} onClick={() => logout.mutate()}>
          <ListItemIcon>
            <MdiIcon path={mdiLogout} fontSize="small" />
          </ListItemIcon>
          Log Out
        </MenuItem>,
      ]}
    </HoverMenu>
  );
}
