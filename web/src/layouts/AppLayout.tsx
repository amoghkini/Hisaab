import {
  mdiAccountCircleOutline,
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
import Menu from "@mui/material/Menu";
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
import { MdiIcon } from "@/components/MdiIcon";

const NAV = [
  { to: "/", label: "Overview", icon: mdiViewDashboardOutline, end: true },
  { to: "/transactions", label: "Transactions", icon: mdiListBoxOutline, end: false },
  { to: "/accounts", label: "Accounts", icon: mdiWalletOutline, end: false },
];

/** The frame of the signed-in pages: a top bar with the navigation, and the page below it. */
export function AppLayout() {
  // The dashboard's 12-column grid uses the full width of the screen; the accounts page has two columns.
  const path = useLocation().pathname;
  const maxWidth = path === "/" ? "none" : path.startsWith("/accounts") ? 1280 : 1080;

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

        <Box component="nav" sx={{ display: "flex", gap: 0.5, flex: 1, minWidth: 0 }}>
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
                color: "text.secondary",
                "&.active": { color: "primary.main", bgcolor: "rgb(var(--mui-palette-primary-mainChannel) / 0.08)" },
                // Icons only on phones, so the items fit beside the logo and the buttons on the right.
                minWidth: { xs: 36, sm: 64 },
                px: { xs: 0.75, sm: 1 },
                "& .MuiButton-startIcon": { mx: { xs: 0 }, mr: { sm: 1 } },
              }}
            >
              <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>
                {item.label}
              </Box>
            </Button>
          ))}
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
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
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  // Forget the user here even if the call fails, so the button always logs out.
  const logout = useMutation({ mutationFn: signOut, onSettled: () => setMe(null) });
  const name = me.data?.name ?? "";
  const firstName = name.trim().split(/\s+/)[0] ?? "";

  return (
    <>
      <Button
        variant="text"
        color="inherit"
        endIcon={<MdiIcon path={mdiChevronDown} />}
        onClick={(event) => setAnchor(event.currentTarget)}
        aria-haspopup="menu"
        aria-expanded={anchor !== null}
        aria-label={`Account menu for ${firstName}`}
        sx={{ ml: { xs: 0, sm: 0.5 }, maxWidth: 160, minWidth: { xs: 40, sm: 64 }, px: { xs: 0.5, sm: 1 }, "& .MuiButton-endIcon": { ml: { xs: 0, sm: 1 } } }}
      >
        {/* On phones, an icon instead of the name, so the navigation fits. */}
        <MdiIcon path={mdiAccountCircleOutline} sx={{ display: { xs: "block", sm: "none" } }} />
        <Box component="span" sx={{ display: { xs: "none", sm: "block" }, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {firstName}
        </Box>
      </Button>
      <Menu
        anchorEl={anchor}
        open={anchor !== null}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: { minWidth: 220, mt: 0.5 } } }}
      >
        <Box sx={{ px: 2, py: 1 }}>
          <Typography sx={{ fontWeight: 600 }}>{name}</Typography>
          <Typography variant="body2" color="text.secondary">
            {me.data?.email}
          </Typography>
        </Box>
        <Divider />
        <MenuItem
          onClick={() => {
            setAnchor(null);
            void navigate("/profile");
          }}
        >
          <ListItemIcon>
            <MdiIcon path={mdiCogOutline} fontSize="small" />
          </ListItemIcon>
          Settings
        </MenuItem>
        <MenuItem
          onClick={() => {
            setAnchor(null);
            void navigate("/categories");
          }}
        >
          <ListItemIcon>
            <MdiIcon path={mdiShapeOutline} fontSize="small" />
          </ListItemIcon>
          Categories
        </MenuItem>
        <MenuItem disabled={logout.isPending} onClick={() => logout.mutate()}>
          <ListItemIcon>
            <MdiIcon path={mdiLogout} fontSize="small" />
          </ListItemIcon>
          Log Out
        </MenuItem>
      </Menu>
    </>
  );
}
