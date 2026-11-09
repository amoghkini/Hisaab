import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import InputAdornment from "@mui/material/InputAdornment";
import MenuItem from "@mui/material/MenuItem";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import {
  ACCOUNT_CATEGORIES,
  categoryInfo,
  createAccount,
  updateAccount,
  type Account,
  type AccountCategory,
  type AccountInput,
} from "@/api/accounts";
import { ApiError, errorMessage } from "@/api/client";
import { ACCOUNT_ICON_NAMES } from "@/appearance/accountIcons";
import { useMe } from "@/auth/session";
import { AccountIcon } from "@/components/AccountIcon";
import { IconColorPicker } from "@/components/IconColorPicker";
import { CurrencyField } from "@/components/PreferenceFields";
import { amountInputText, fractionDigits, parseAmount } from "@/lib/money";
import { invalidateAccounts } from "@/pages/accounts/queries";

/** What the dialog opens on: a new account in a category, or an account to edit. */
export type AccountDialogTarget = { mode: "add"; category: AccountCategory } | { mode: "edit"; account: Account };

interface Draft {
  category: AccountCategory;
  name: string;
  icon: string;
  color: string | null;
  currency: string;
  /** As typed. For a liability, the amount owed. */
  balance: string;
  balanceDate: string;
  numberSuffix: string;
  creditLimit: string;
  statementDay: number | "";
  comment: string;
  includeInTotal: boolean;
  visible: boolean;
}

function draftFor(target: AccountDialogTarget, defaultCurrency: string): Draft {
  if (target.mode === "add") {
    return {
      category: target.category,
      name: "",
      icon: categoryInfo(target.category).icon,
      color: null,
      currency: defaultCurrency,
      balance: "",
      balanceDate: "",
      numberSuffix: "",
      creditLimit: "",
      statementDay: "",
      comment: "",
      includeInTotal: true,
      visible: true,
    };
  }
  const { account } = target;
  const shown = account.is_liability ? -account.opening_balance : account.opening_balance;
  return {
    category: account.category,
    name: account.name,
    icon: account.icon,
    color: account.color,
    currency: account.currency,
    balance: shown === 0 ? "" : amountInputText(shown, account.currency),
    balanceDate: account.opening_balance_date ?? "",
    numberSuffix: account.number_suffix ?? "",
    creditLimit: account.credit_limit === null ? "" : amountInputText(account.credit_limit, account.currency),
    statementDay: account.statement_day ?? "",
    comment: account.comment,
    includeInTotal: account.include_in_total,
    visible: !account.hidden,
  };
}

const DAYS = Array.from({ length: 31 }, (_, index) => index + 1);

function ordinal(day: number): string {
  if (day % 100 >= 11 && day % 100 <= 13) return `${day}th`;
  return `${day}${["th", "st", "nd", "rd"][day % 10] ?? "th"}`;
}

/** Add or edit an account. Modelled on ezBookkeeping's account edit dialog (single accounts). */
export function AccountDialog({ target, onClose }: { target: AccountDialogTarget; onClose: () => void }) {
  const me = useMe();
  const client = useQueryClient();
  const [draft, setDraft] = useState<Draft>(() => draftFor(target, me.data?.default_currency ?? "INR"));
  const [serverError, setServerError] = useState<ApiError | null>(null);
  const editing = target.mode === "edit";
  const info = categoryInfo(draft.category);
  const isCard = draft.category === "credit_card";

  function set<K extends keyof Draft>(key: K, value: Draft[K]): void {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function chooseCategory(category: AccountCategory): void {
    setDraft((current) => ({
      ...current,
      category,
      // Follow the category's icon until the person picks their own.
      icon: current.icon === categoryInfo(current.category).icon ? categoryInfo(category).icon : current.icon,
    }));
  }

  const balance = draft.balance.trim() === "" ? 0 : parseAmount(draft.balance, draft.currency);
  const creditLimit = draft.creditLimit.trim() === "" ? null : parseAmount(draft.creditLimit, draft.currency);
  const amountHint = fractionDigits(draft.currency) === 0 ? "Whole numbers only" : `Up to ${fractionDigits(draft.currency)} decimals`;
  const errors = {
    name: draft.name.trim() === "" ? "Enter a name" : null,
    balance: balance === null ? amountHint : null,
    creditLimit: isCard && draft.creditLimit.trim() !== "" && (creditLimit === null || creditLimit < 0) ? amountHint : null,
    numberSuffix: draft.numberSuffix !== "" && !/^\d{2,6}$/.test(draft.numberSuffix) ? "2 to 6 digits" : null,
  };
  const invalid = Object.values(errors).some((error) => error !== null);

  const save = useMutation({
    mutationFn: () => {
      const input: AccountInput = {
        category: draft.category,
        name: draft.name.trim(),
        icon: draft.icon,
        color: draft.color,
        currency: draft.currency,
        opening_balance: info.liability ? -(balance ?? 0) : (balance ?? 0),
        opening_balance_date: draft.balanceDate || null,
        number_suffix: draft.numberSuffix || null,
        credit_limit: isCard ? creditLimit : null,
        statement_day: isCard && draft.statementDay !== "" ? draft.statementDay : null,
        comment: draft.comment.trim(),
        include_in_total: draft.includeInTotal,
      };
      return target.mode === "edit" ? updateAccount(target.account.id, { ...input, hidden: !draft.visible }) : createAccount(input);
    },
    onSuccess: async () => {
      await invalidateAccounts(client);
      onClose();
    },
    onError: (error) => setServerError(error instanceof ApiError ? error : new ApiError(0, "error", errorMessage(error))),
  });

  const busy = save.isPending;
  const fieldError = (field: string) => serverError?.fields[field] ?? null;

  return (
    <Dialog open onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{editing ? "Edit Account" : "Add Account"}</DialogTitle>
      <DialogContent>
        <Box
          component="form"
          id="account-form"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            if (!invalid) save.mutate();
          }}
          sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2.25, pt: 1 }}
        >
          <TextField
            select
            label="Category"
            value={draft.category}
            disabled={busy}
            onChange={(event) => chooseCategory(event.target.value as AccountCategory)}
            sx={{ gridColumn: "1 / -1" }}
          >
            {ACCOUNT_CATEGORIES.map((category) => (
              <MenuItem key={category.value} value={category.value}>
                <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1.25 }}>
                  <AccountIcon icon={category.icon} color={null} size={20} />
                  {category.name}
                </Box>
              </MenuItem>
            ))}
          </TextField>

          <Box sx={{ gridColumn: "1 / -1", display: "flex", gap: 1.5, alignItems: "flex-start" }}>
            <IconColorPicker
              icon={draft.icon}
              color={draft.color}
              disabled={busy}
              iconNames={ACCOUNT_ICON_NAMES}
              renderIcon={(name, color, size) => <AccountIcon icon={name} color={color} size={size} />}
              onChange={(icon, color) => setDraft((current) => ({ ...current, icon, color }))}
            />
            <TextField
              label="Account Name"
              placeholder={info.value === "credit_card" ? "e.g. HDFC Millennia" : info.value === "cash" ? "e.g. Wallet" : "e.g. SBI Savings"}
              value={draft.name}
              disabled={busy}
              autoFocus={!editing}
              error={fieldError("name") !== null}
              helperText={fieldError("name")}
              onChange={(event) => set("name", event.target.value)}
              slotProps={{ htmlInput: { maxLength: 64, autoComplete: "off" } }}
              sx={{ flex: 1 }}
            />
          </Box>

          <CurrencyField label="Currency" value={draft.currency} disabled={busy} onChange={(currency) => set("currency", currency)} />
          <TextField
            label={info.liability ? "Amount Owed" : "Current Balance"}
            value={draft.balance}
            disabled={busy}
            placeholder="0"
            error={errors.balance !== null || fieldError("opening_balance") !== null}
            helperText={errors.balance ?? fieldError("opening_balance") ?? (info.liability ? "What you owe now" : " ")}
            onChange={(event) => set("balance", event.target.value)}
            slotProps={{
              htmlInput: { inputMode: "decimal", autoComplete: "off" },
              input: { endAdornment: <InputAdornment position="end">{draft.currency}</InputAdornment> },
            }}
          />

          {isCard ? (
            <>
              <TextField
                label="Credit Limit"
                value={draft.creditLimit}
                disabled={busy}
                placeholder="Optional"
                error={errors.creditLimit !== null}
                helperText={errors.creditLimit ?? "Shows your available credit"}
                onChange={(event) => set("creditLimit", event.target.value)}
                slotProps={{
                  htmlInput: { inputMode: "decimal", autoComplete: "off" },
                  input: { endAdornment: <InputAdornment position="end">{draft.currency}</InputAdornment> },
                }}
              />
              <TextField
                select
                label="Statement Date"
                value={draft.statementDay}
                disabled={busy}
                helperText="Day of the month the bill is made"
                onChange={(event) => set("statementDay", event.target.value === "" ? "" : Number(event.target.value))}
              >
                <MenuItem value="">
                  <em>Not set</em>
                </MenuItem>
                {DAYS.map((day) => (
                  <MenuItem key={day} value={day}>
                    {ordinal(day)}
                  </MenuItem>
                ))}
              </TextField>
            </>
          ) : null}

          <TextField
            label="Balance As Of"
            type="date"
            value={draft.balanceDate}
            disabled={busy}
            helperText="Optional: the day this balance was true"
            onChange={(event) => set("balanceDate", event.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            label={isCard ? "Card Number Ends With" : "Account Number Ends With"}
            value={draft.numberSuffix}
            disabled={busy || draft.category === "cash"}
            placeholder="e.g. 1234"
            error={errors.numberSuffix !== null || fieldError("number_suffix") !== null}
            helperText={errors.numberSuffix ?? fieldError("number_suffix") ?? "Matches bank SMS to this account"}
            onChange={(event) => set("numberSuffix", event.target.value.replace(/\D/g, "").slice(0, 6))}
            slotProps={{ htmlInput: { inputMode: "numeric", autoComplete: "off" } }}
          />

          <TextField
            label="Description"
            placeholder="Optional"
            value={draft.comment}
            disabled={busy}
            multiline
            minRows={2}
            onChange={(event) => set("comment", event.target.value)}
            slotProps={{ htmlInput: { maxLength: 255 } }}
            sx={{ gridColumn: "1 / -1" }}
          />

          <Box sx={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column" }}>
            <FormControlLabel
              control={<Switch checked={draft.includeInTotal} disabled={busy} onChange={(event) => set("includeInTotal", event.target.checked)} />}
              label="Include in total assets and liabilities"
            />
            {editing ? (
              <FormControlLabel
                control={<Switch checked={draft.visible} disabled={busy} onChange={(event) => set("visible", event.target.checked)} />}
                label="Visible in the account list"
              />
            ) : null}
          </Box>

          {/* Errors for fields that show no message of their own, such as a currency that can no longer change. */}
          {serverError && !["name", "opening_balance", "number_suffix"].some((field) => field in serverError.fields) ? (
            <Typography color="error" variant="body2" sx={{ gridColumn: "1 / -1" }}>
              {errorMessage(serverError)}
            </Typography>
          ) : null}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button variant="text" color="inherit" disabled={busy} onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" form="account-form" disabled={invalid || busy}>
          {editing ? "Save" : "Add"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

