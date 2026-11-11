import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ListSubheader from "@mui/material/ListSubheader";
import MenuItem from "@mui/material/MenuItem";
import Snackbar from "@mui/material/Snackbar";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useMutation } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

import { ACCOUNT_CATEGORIES, type Account } from "@/api/accounts";
import { updateMe, type AmountColor, type User } from "@/api/auth";
import { ApiError, errorMessage } from "@/api/client";
import { useMe, useSetMe } from "@/auth/session";
import { AccountIcon } from "@/components/AccountIcon";
import { AmountColorField, CurrencyField, FirstDayOfWeekField } from "@/components/PreferenceFields";
import { useAccounts } from "@/pages/accounts/queries";
import { SettingRow, SettingsCard, SettingsPageTitle } from "@/pages/settings/SettingsCard";

const MONTHS = Array.from({ length: 12 }, (_, index) => new Date(2000, index, 1).toLocaleDateString("en", { month: "long" }));

const NO_ACCOUNT = "none";

interface ProfileDraft {
  name: string;
  default_account_id: number | null;
  default_currency: string;
  first_day_of_week: number;
  fiscal_year_start_month: number;
  expense_amount_color: AmountColor;
  income_amount_color: AmountColor;
}

function draftOf(user: User | null | undefined): ProfileDraft {
  return {
    name: user?.name ?? "",
    default_account_id: user?.default_account_id ?? null,
    default_currency: user?.default_currency ?? "INR",
    first_day_of_week: user?.first_day_of_week ?? 0,
    fiscal_year_start_month: user?.fiscal_year_start_month ?? 4,
    expense_amount_color: user?.expense_amount_color ?? "red",
    income_amount_color: user?.income_amount_color ?? "green",
  };
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] ?? "") + (words.length > 1 ? (words.at(-1)?.[0] ?? "") : "")).toUpperCase() || "?";
}

/** The visible accounts by category, as the transaction dialog lists them. Keeps the chosen one even if hidden. */
function accountItems(accounts: Account[], keepId: number | null): ReactNode[] {
  const items: ReactNode[] = [];
  for (const info of ACCOUNT_CATEGORIES) {
    const inCategory = accounts.filter((account) => account.category === info.value && (!account.hidden || account.id === keepId));
    if (inCategory.length === 0) continue;
    items.push(
      <ListSubheader key={`group-${info.value}`} sx={{ lineHeight: "32px" }}>
        {info.name}
      </ListSubheader>,
    );
    for (const account of inCategory) {
      items.push(
        <MenuItem key={account.id} value={account.id} sx={{ pl: 3 }}>
          <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 1.25 }}>
            <AccountIcon icon={account.icon} color={account.color} size={20} faded={account.hidden} />
            {account.name}
          </Box>
        </MenuItem>,
      );
    }
  }
  return items;
}

/** ezBookkeeping's "User Profile" page: who you are and the defaults the app starts from. */
export function ProfileSettingsPage() {
  const me = useMe();
  const setMe = useSetMe();
  const accounts = useAccounts();
  const saved = draftOf(me.data);
  const [draft, setDraft] = useState<ProfileDraft>(saved);
  const [message, setMessage] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: (changes: Partial<ProfileDraft>) => updateMe(changes),
    onSuccess: (user) => {
      setMe(user);
      setDraft(draftOf(user));
      setMessage("Profile saved");
    },
    onError: (error) => setMessage(errorMessage(error)),
  });

  const changes = Object.fromEntries(
    (Object.keys(saved) as (keyof ProfileDraft)[]).filter((key) => saved[key] !== draft[key]).map((key) => [key, draft[key]]),
  ) as Partial<ProfileDraft>;
  const changed = Object.keys(changes).length > 0;
  const nameError = draft.name.trim() === "" ? "Enter your name." : null;
  const serverFields = save.error instanceof ApiError ? save.error.fields : {};
  const busy = save.isPending || me.isPending;

  function set<K extends keyof ProfileDraft>(key: K) {
    return (value: ProfileDraft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  }

  const memberSince = me.data?.created_at
    ? new Date(`${me.data.created_at}Z`).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })
    : null;
  const allAccounts = accounts.data ?? [];

  return (
    <>
      <SettingsPageTitle title="User Profile" description="Your name, and the defaults Hisaab starts from." />

      <SettingsCard
        title="Basic Settings"
        footer={
          <>
            <Button variant="text" color="inherit" disabled={!changed || busy} onClick={() => setDraft(saved)}>
              Reset
            </Button>
            <Button disabled={!changed || busy || nameError !== null} onClick={() => save.mutate(changes)}>
              Save Changes
            </Button>
          </>
        }
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 2.5, py: 2 }}>
          <Avatar variant="rounded" sx={{ width: 72, height: 72, borderRadius: 3, bgcolor: "primary.main", color: "primary.contrastText", fontSize: 28, fontWeight: 600 }}>
            {initials(me.data?.name ?? "")}
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h6" noWrap>
              {me.data?.name}
            </Typography>
            <Typography variant="body2" color="text.secondary" noWrap>
              {me.data?.email}
            </Typography>
            {memberSince ? (
              <Typography variant="caption" color="text.secondary">
                Member since {memberSince}
              </Typography>
            ) : null}
          </Box>
        </Box>

        <Box sx={{ borderTop: 1, borderColor: "divider" }} />

        <SettingRow label="Name" hint="Shown in the top bar and on this page.">
          <TextField
            fullWidth
            size="small"
            autoComplete="name"
            value={draft.name}
            disabled={busy}
            error={nameError !== null || "name" in serverFields}
            helperText={nameError ?? serverFields.name}
            slotProps={{ htmlInput: { maxLength: 100 } }}
            onChange={(event) => set("name")(event.target.value)}
          />
        </SettingRow>
        <SettingRow label="E-mail" hint="You log in with it, so it cannot be changed.">
          <TextField
            fullWidth
            size="small"
            type="email"
            value={me.data?.email ?? ""}
            slotProps={{ input: { readOnly: true }, htmlInput: { "aria-label": "E-mail", "aria-readonly": true } }}
            sx={{ "& .MuiInputBase-root": { bgcolor: "action.hover" } }}
          />
        </SettingRow>
        <SettingRow label="Default Account" hint="New transactions start on this account.">
          <TextField
            select
            fullWidth
            size="small"
            value={draft.default_account_id ?? NO_ACCOUNT}
            disabled={busy || accounts.isPending}
            error={"default_account_id" in serverFields}
            helperText={serverFields.default_account_id}
            onChange={(event) => set("default_account_id")(event.target.value === NO_ACCOUNT ? null : Number(event.target.value))}
          >
            <MenuItem value={NO_ACCOUNT}>
              <em>Unspecified (the last one used)</em>
            </MenuItem>
            {accountItems(allAccounts, draft.default_account_id)}
          </TextField>
        </SettingRow>
        <SettingRow label="Default Currency" hint="Totals on the dashboard and lists are in this currency.">
          <CurrencyField compact value={draft.default_currency} disabled={busy} onChange={set("default_currency")} />
        </SettingRow>
        <SettingRow label="First Day of Week" hint="Where weeks start in calendars and the “This week” range.">
          <FirstDayOfWeekField compact value={draft.first_day_of_week} disabled={busy} onChange={set("first_day_of_week")} />
        </SettingRow>
        <SettingRow label="Financial Year Start" hint="For the “This financial year” range. India's starts in April.">
          <TextField
            select
            fullWidth
            size="small"
            value={draft.fiscal_year_start_month}
            disabled={busy}
            onChange={(event) => set("fiscal_year_start_month")(Number(event.target.value))}
          >
            {MONTHS.map((month, index) => (
              <MenuItem key={month} value={index + 1}>
                1 {month}
              </MenuItem>
            ))}
          </TextField>
        </SettingRow>
        <SettingRow label="Expense Amount Color">
          <AmountColorField compact label="Expense Amount Color" value={draft.expense_amount_color} disabled={busy} onChange={set("expense_amount_color")} />
        </SettingRow>
        <SettingRow label="Income Amount Color">
          <AmountColorField compact label="Income Amount Color" value={draft.income_amount_color} disabled={busy} onChange={set("income_amount_color")} />
        </SettingRow>
      </SettingsCard>

      <Snackbar open={message !== null} autoHideDuration={4000} message={message} onClose={() => setMessage(null)} />
    </>
  );
}
