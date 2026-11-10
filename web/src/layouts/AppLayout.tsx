import {
  mdiAccountCircleOutline,
  mdiBriefcaseOutline,
  mdiCalculatorVariantOutline,
  mdiCalendarCheckOutline,
  mdiChevronDown,
  mdiCogOutline,
  mdiEyeOffOutline,
  mdiEyeOutline,
  mdiFinance,
  mdiListBoxOutline,
  mdiLogout,
  mdiPiggyBankOutline,
  mdiShapeOutline,
  mdiWalletOutline,
  mdiWeatherNight,
  mdiWeatherSunny,
} from "@mdi/js";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListSubheader from "@mui/material/ListSubheader";
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

/** One entry in a dropdown: a built page (`to`), or a planned one that says "not available yet". */
interface NavMenuEntry {
  label: string;
  to?: string;
  /** A heading the entry sits under, within the dropdown. */
  group?: string;
}

interface NavLinkItem {
  kind: "link";
  label: string;
  icon: string;
  to: string;
}

interface NavMenuItem {
  kind: "menu";
  label: string;
  icon: string;
  /** The button is highlighted while the address starts with one of these. */
  activePaths?: string[];
  entries: NavMenuEntry[];
}

/**
 * The top bar, in order. The logo goes to the dashboard, so it has no item of its own.
 * Entries without a `to` are planned (docs/content/architecture.md); give one a `to` and a route when it is built.
 */
const NAV: (NavLinkItem | NavMenuItem)[] = [
  { kind: "link", label: "Transactions", icon: mdiListBoxOutline, to: "/transactions" },
  {
    kind: "menu",
    label: "Accounts",
    icon: mdiWalletOutline,
    activePaths: ["/accounts"],
    entries: [{ label: "All accounts", to: "/accounts" }, { label: "Credit cards" }, { label: "Debit cards" }, { label: "Loans" }],
  },
  {
    kind: "menu",
    label: "Planning",
    icon: mdiCalendarCheckOutline,
    entries: [{ label: "Budgets" }, { label: "Subscriptions" }, { label: "Upcoming bills" }],
  },
  {
    kind: "menu",
    label: "Wealth",
    icon: mdiPiggyBankOutline,
    entries: [
      { label: "Net worth" },
      { label: "Portfolio", group: "Investments" },
      { label: "EPF", group: "Investments" },
      { label: "PPF and NPS", group: "Investments" },
      { label: "Fixed and recurring deposits", group: "Investments" },
      { label: "Mutual funds and stocks", group: "Investments" },
      { label: "Sync from EPFO", group: "Investments" },
      { label: "Property and vehicles", group: "Assets and protection" },
      { label: "Insurance", group: "Assets and protection" },
    ],
  },
  {
    kind: "menu",
    label: "Salary",
    icon: mdiBriefcaseOutline,
    entries: [{ label: "Payslips" }, { label: "Add a payslip" }, { label: "Employers and salary structure" }],
  },
  {
    kind: "menu",
    label: "Taxes",
    icon: mdiCalculatorVariantOutline,
    entries: [{ label: "Tax summary" }, { label: "TDS and taxes paid" }, { label: "Deductions (80C, 80D and others)" }, { label: "Old vs new regime" }],
  },
  { kind: "link", label: "Markets", icon: mdiFinance, to: "/markets" },
];

const activeSx = { color: "primary.main", bgcolor: "rgb(var(--mui-palette-primary-mainChannel) / 0.08)" };

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
  // The dashboard, accounts, transactions and markets pages use the full width of the screen.
  const path = useLocation().pathname;
  const fullWidth = path === "/" || ["/accounts", "/transactions", "/markets"].some((prefix) => path.startsWith(prefix));
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
          {NAV.map((item) =>
            item.kind === "link" ? (
              <Button
                key={item.label}
                component={NavLink}
                to={item.to}
                variant="text"
                color="inherit"
                startIcon={<MdiIcon path={item.icon} />}
                aria-label={item.label}
                sx={{ ...navButtonSx, "&.active": activeSx }}
              >
                <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>
                  {item.label}
                </Box>
              </Button>
            ) : (
              <NavMenu key={item.label} item={item} active={(item.activePaths ?? []).some((prefix) => path.startsWith(prefix))} />
            ),
          )}
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

/** A navigation item with a dropdown: built pages open, planned ones say "not available yet". */
function NavMenu({ item, active }: { item: NavMenuItem; active: boolean }) {
  const navigate = useNavigate();
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
            startIcon={<MdiIcon path={item.icon} />}
            endIcon={<MdiIcon path={mdiChevronDown} />}
            aria-label={item.label}
            sx={{ ...navButtonSx, ...(active ? activeSx : {}), "& .MuiButton-endIcon": { display: { xs: "none", sm: "inherit" }, ml: 0.25 } }}
          >
            <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>
              {item.label}
            </Box>
          </Button>
        )}
      >
        {(close) =>
          item.entries.flatMap((entry, index) => {
            const startsGroup = entry.group !== undefined && entry.group !== item.entries[index - 1]?.group;
            return [
              ...(startsGroup
                ? [
                    ...(index > 0 ? [<Divider key={`divider-${entry.group}`} />] : []),
                    <ListSubheader key={`group-${entry.group}`} sx={{ lineHeight: "32px", bgcolor: "transparent" }}>
                      {entry.group}
                    </ListSubheader>,
                  ]
                : []),
              <MenuItem
                key={entry.label}
                onClick={() => {
                  close();
                  if (entry.to) void navigate(entry.to);
                  else setNotAvailable(`${item.label}: ${entry.label}`);
                }}
              >
                {entry.label}
              </MenuItem>,
            ];
          })
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
