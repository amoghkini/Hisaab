import { mdiSwapVertical } from "@mdi/js";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import ListSubheader from "@mui/material/ListSubheader";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState, type ReactNode } from "react";
import { Link as RouterLink } from "react-router-dom";

import { ACCOUNT_CATEGORIES, type Account } from "@/api/accounts";
import { addPresetCategories, type Category } from "@/api/categories";
import { ApiError, errorMessage } from "@/api/client";
import {
  TRANSACTION_TYPES,
  createTransaction,
  deleteTransaction,
  replaceTransaction,
  type Transaction,
  type TransactionInput,
  type TransactionType,
} from "@/api/transactions";
import { AccountIcon } from "@/components/AccountIcon";
import { CategoryIcon } from "@/components/CategoryIcon";
import { MdiIcon } from "@/components/MdiIcon";
import { nowLocalDateTime } from "@/lib/dates";
import { amountInputText, fractionDigits, parseAmount } from "@/lib/money";
import { useAccounts } from "@/pages/accounts/queries";
import { CATEGORIES_KEY, invalidateTransactions, useCategories } from "@/pages/transactions/queries";

/** What the dialog opens on: a new transaction, or one to edit. */
export type TransactionDialogTarget = { mode: "add"; accountId?: number } | { mode: "edit"; transaction: Transaction };

// The type and account last used, so a run of entries starts where the last one left off. This browser only.
const LAST_USED_KEY = "hisaab.lastTransaction";

interface LastUsed {
  type: TransactionType;
  accountId: number | null;
}

function readLastUsed(): LastUsed {
  try {
    const parsed = JSON.parse(localStorage.getItem(LAST_USED_KEY) ?? "null") as Partial<LastUsed> | null;
    const type = TRANSACTION_TYPES.some((option) => option.value === parsed?.type) ? (parsed?.type as TransactionType) : "expense";
    return { type, accountId: typeof parsed?.accountId === "number" ? parsed.accountId : null };
  } catch {
    return { type: "expense", accountId: null };
  }
}

function storeLastUsed(value: LastUsed): void {
  try {
    localStorage.setItem(LAST_USED_KEY, JSON.stringify(value));
  } catch {
    // Not remembered, which is fine.
  }
}

interface Draft {
  type: TransactionType;
  amount: string;
  toAmount: string;
  /** One per type, so switching type and back keeps the choice. */
  categoryIds: Record<TransactionType, number | "">;
  accountId: number | "";
  toAccountId: number | "";
  occurredAt: string;
  comment: string;
}

function emptyDraft(type: TransactionType, accountId: number | ""): Draft {
  return {
    type,
    amount: "",
    toAmount: "",
    categoryIds: { expense: "", income: "", transfer: "" },
    accountId,
    toAccountId: "",
    occurredAt: nowLocalDateTime(),
    comment: "",
  };
}

function draftFor(target: TransactionDialogTarget, accounts: Account[]): Draft {
  if (target.mode === "edit") {
    const { transaction } = target;
    const currencyOf = (id: number | null) => accounts.find((account) => account.id === id)?.currency ?? "INR";
    const draft = emptyDraft(transaction.type, transaction.account_id);
    return {
      ...draft,
      amount: amountInputText(transaction.amount, currencyOf(transaction.account_id)),
      toAmount: transaction.to_amount === null ? "" : amountInputText(transaction.to_amount, currencyOf(transaction.to_account_id)),
      categoryIds: { ...draft.categoryIds, [transaction.type]: transaction.category_id ?? "" },
      toAccountId: transaction.to_account_id ?? "",
      occurredAt: transaction.occurred_at.slice(0, 16),
      comment: transaction.comment,
    };
  }
  const last = readLastUsed();
  const usable = (id: number | null | undefined) => accounts.some((account) => account.id === id && !account.hidden);
  const accountId = usable(target.accountId) ? target.accountId! : usable(last.accountId) ? last.accountId! : (accounts.find((account) => !account.hidden)?.id ?? "");
  return emptyDraft(last.type, accountId);
}

/**
 * The category menu: each group as a heading with its sub-categories under it, as ezBookkeeping's two-level
 * picker shows them. A top-level category without sub-categories can be chosen itself.
 */
function categoryMenu(categories: Category[], keepId: number | ""): ReactNode[] {
  const items: ReactNode[] = [];
  // Hidden categories (and the sub-categories of a hidden group) are left out, unless already chosen.
  const offered = (category: Category, group: Category) => (!category.hidden && !group.hidden) || category.id === keepId;
  for (const top of categories) {
    const subs = top.sub_categories.filter((sub) => offered(sub, top));
    if (top.sub_categories.length === 0) {
      if (!offered(top, top)) continue;
      items.push(
        <MenuItem key={top.id} value={top.id}>
          <CategoryLabel category={top} />
        </MenuItem>,
      );
      continue;
    }
    if (subs.length === 0) continue;
    items.push(
      <ListSubheader key={`group-${top.id}`} sx={{ display: "flex", alignItems: "center", gap: 1, lineHeight: "36px" }}>
        <CategoryIcon icon={top.icon} color={top.color} size={18} />
        {top.name}
      </ListSubheader>,
    );
    for (const sub of subs) {
      items.push(
        <MenuItem key={sub.id} value={sub.id} sx={{ pl: 4 }}>
          <CategoryLabel category={sub} />
        </MenuItem>,
      );
    }
  }
  return items;
}

function CategoryLabel({ category }: { category: Category }) {
  return (
    <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 1.25, minWidth: 0 }}>
      <CategoryIcon icon={category.icon} color={category.color} size={20} />
      <Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis" }}>
        {category.name}
      </Box>
    </Box>
  );
}

/** The account menu, grouped by account category. Hidden accounts are left out unless already chosen. */
function accountMenu(accounts: Account[], keepId: number | ""): ReactNode[] {
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
          <AccountLabel account={account} />
        </MenuItem>,
      );
    }
  }
  return items;
}

function AccountLabel({ account }: { account: Account }) {
  return (
    <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 1.25, minWidth: 0 }}>
      <AccountIcon icon={account.icon} color={account.color} size={20} faded={account.hidden} />
      <Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis" }}>
        {account.name}
      </Box>
      <Typography component="span" variant="caption" color="text.secondary">
        {account.currency}
      </Typography>
    </Box>
  );
}

const AMOUNT_COLORS: Record<TransactionType, string> = {
  expense: "var(--hk-expense-color)",
  income: "var(--hk-income-color)",
  transfer: "var(--mui-palette-primary-main)",
};

/** Add or edit an expense, income or transfer. Modelled on ezBookkeeping's transaction edit dialog. */
export function TransactionDialog({ target, onClose, onSaved }: { target: TransactionDialogTarget; onClose: () => void; onSaved: (message: string) => void }) {
  const client = useQueryClient();
  const accounts = useAccounts();
  const categories = useCategories();
  const allAccounts = accounts.data ?? [];
  const [draft, setDraft] = useState<Draft>(() => draftFor(target, allAccounts));
  const [serverError, setServerError] = useState<ApiError | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);
  const editing = target.mode === "edit";
  const isTransfer = draft.type === "transfer";

  const account = allAccounts.find((item) => item.id === draft.accountId);
  const toAccount = allAccounts.find((item) => item.id === draft.toAccountId);
  const currency = account?.currency ?? "INR";
  const toCurrency = toAccount?.currency ?? currency;
  const crossCurrency = isTransfer && toAccount !== undefined && toCurrency !== currency;
  const typeCategories = (categories.data ?? []).filter((category) => category.type === draft.type);
  const categoryId = draft.categoryIds[draft.type];

  function set<K extends keyof Draft>(key: K, value: Draft[K]): void {
    setDraft((current) => ({ ...current, [key]: value }));
    setServerError(null);
  }

  const amount = parseAmount(draft.amount, currency);
  const toAmount = parseAmount(draft.toAmount, toCurrency);
  const hint = (code: string) => (fractionDigits(code) === 0 ? "Whole numbers only" : `A number, up to ${fractionDigits(code)} decimals`);
  const errors = {
    amount: draft.amount.trim() !== "" && (amount === null || amount <= 0) ? hint(currency) : null,
    toAmount: crossCurrency && draft.toAmount.trim() !== "" && (toAmount === null || toAmount <= 0) ? hint(toCurrency) : null,
    toAccount: isTransfer && draft.toAccountId !== "" && draft.toAccountId === draft.accountId ? "Choose a different account" : null,
  };
  const complete =
    amount !== null &&
    amount > 0 &&
    draft.accountId !== "" &&
    draft.occurredAt !== "" &&
    (isTransfer ? draft.toAccountId !== "" && (!crossCurrency || (toAmount !== null && toAmount > 0)) : categoryId !== "");
  const canSave = complete && Object.values(errors).every((error) => error === null);

  // The variable says whether to stay open for the next entry ("Save and Add Another").
  const save = useMutation<Transaction, Error, boolean>({
    mutationFn: () => {
      const input: TransactionInput = {
        type: draft.type,
        occurred_at: draft.occurredAt,
        category_id: categoryId === "" ? null : categoryId,
        account_id: draft.accountId as number,
        amount: amount ?? 0,
        to_account_id: isTransfer && draft.toAccountId !== "" ? draft.toAccountId : null,
        to_amount: crossCurrency ? toAmount : null,
        comment: draft.comment.trim(),
      };
      return target.mode === "edit" ? replaceTransaction(target.transaction.id, input) : createTransaction(input);
    },
    onSuccess: async (_, again) => {
      storeLastUsed({ type: draft.type, accountId: draft.accountId === "" ? null : draft.accountId });
      await invalidateTransactions(client);
      if (again) {
        // Keep the type, accounts, category and time; clear what changes from one entry to the next.
        setDraft((current) => ({ ...current, amount: "", toAmount: "", comment: "" }));
        onSaved("Saved. Add the next one.");
        amountRef.current?.focus();
      } else {
        onSaved(editing ? "Transaction saved" : "Transaction added");
        onClose();
      }
    },
    onError: (error) => setServerError(error instanceof ApiError ? error : new ApiError(0, "error", errorMessage(error))),
  });

  const remove = useMutation({
    mutationFn: () => deleteTransaction((target as { transaction: Transaction }).transaction.id),
    onSuccess: async () => {
      await invalidateTransactions(client);
      onSaved("Transaction deleted");
      onClose();
    },
    onError: (error) => setServerError(error instanceof ApiError ? error : new ApiError(0, "error", errorMessage(error))),
  });

  const presets = useMutation({
    mutationFn: addPresetCategories,
    onSuccess: (tree) => client.setQueryData([CATEGORIES_KEY], tree),
    onError: (error) => setServerError(error instanceof ApiError ? error : new ApiError(0, "error", errorMessage(error))),
  });

  const busy = save.isPending || remove.isPending;
  const fieldError = (field: string) => serverError?.fields[field] ?? null;
  const visibleAccounts = allAccounts.filter((item) => !item.hidden);

  function swapAccounts(): void {
    setDraft((current) => ({ ...current, accountId: current.toAccountId, toAccountId: current.accountId, amount: current.toAmount || current.amount, toAmount: current.toAmount ? current.amount : "" }));
  }

  if (accounts.isSuccess && visibleAccounts.length === 0 && !editing) {
    return (
      <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
        <DialogTitle>Add an account first</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Every transaction belongs to an account, such as your wallet or a bank account. Add one on the Accounts page, then come back.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="text" color="inherit" onClick={onClose}>
            Close
          </Button>
          <Button component={RouterLink} to="/accounts">
            Go to Accounts
          </Button>
        </DialogActions>
      </Dialog>
    );
  }

  return (
    <Dialog open onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{editing ? "Edit Transaction" : "Add Transaction"}</DialogTitle>
      <DialogContent>
        <Box
          component="form"
          id="transaction-form"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            if (canSave && !busy) save.mutate(false);
          }}
          sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))" }, gap: 2.25, pt: 1 }}
        >
          <ToggleButtonGroup
            exclusive
            fullWidth
            size="small"
            color="primary"
            value={draft.type}
            disabled={busy}
            onChange={(_, type: TransactionType | null) => type && set("type", type)}
            sx={{ gridColumn: "1 / -1" }}
          >
            {TRANSACTION_TYPES.map((option) => (
              <ToggleButton key={option.value} value={option.value} sx={{ textTransform: "none", fontWeight: 500 }}>
                {option.name}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>

          <TextField
            label={isTransfer ? "Transfer Out Amount" : draft.type === "income" ? "Income Amount" : "Expense Amount"}
            value={draft.amount}
            disabled={busy}
            autoFocus
            inputRef={amountRef}
            placeholder="0"
            error={errors.amount !== null || fieldError("amount") !== null}
            helperText={errors.amount ?? fieldError("amount")}
            onChange={(event) => set("amount", event.target.value)}
            sx={{ gridColumn: crossCurrency ? "auto" : "1 / -1" }}
            slotProps={{
              htmlInput: { inputMode: "decimal", autoComplete: "off", style: { fontSize: "1.5rem", fontWeight: 600, color: AMOUNT_COLORS[draft.type] } },
              input: { endAdornment: <InputAdornment position="end">{currency}</InputAdornment> },
            }}
          />
          {crossCurrency ? (
            <TextField
              label="Transfer In Amount"
              value={draft.toAmount}
              disabled={busy}
              placeholder="0"
              error={errors.toAmount !== null || fieldError("to_amount") !== null}
              helperText={errors.toAmount ?? fieldError("to_amount") ?? `What arrives in ${toAccount?.name}`}
              onChange={(event) => set("toAmount", event.target.value)}
              slotProps={{
                htmlInput: { inputMode: "decimal", autoComplete: "off", style: { fontSize: "1.5rem", fontWeight: 600, color: AMOUNT_COLORS.transfer } },
                input: { endAdornment: <InputAdornment position="end">{toCurrency}</InputAdornment> },
              }}
            />
          ) : null}

          {typeCategories.length === 0 && categories.isSuccess ? (
            <Alert
              severity="info"
              sx={{ gridColumn: "1 / -1" }}
              action={
                (categories.data ?? []).length === 0 ? (
                  <Button color="inherit" size="small" disabled={presets.isPending} onClick={() => presets.mutate()}>
                    Add Preset Categories
                  </Button>
                ) : undefined
              }
            >
              {(categories.data ?? []).length === 0
                ? "You have no categories yet. Start with the preset ones (Food, Transport, Salary and more)."
                : `You have no ${draft.type} categories.`}
            </Alert>
          ) : (
            <TextField
              select
              label={isTransfer ? "Category (optional)" : "Category"}
              value={categoryId}
              disabled={busy || categories.isPending}
              error={fieldError("category_id") !== null}
              helperText={fieldError("category_id")}
              onChange={(event) => set("categoryIds", { ...draft.categoryIds, [draft.type]: event.target.value === "" ? "" : Number(event.target.value) })}
              sx={{ gridColumn: "1 / -1" }}
              slotProps={{ select: { MenuProps: { slotProps: { paper: { sx: { maxHeight: 420 } } } } } }}
            >
              {isTransfer ? (
                <MenuItem value="">
                  <em>None</em>
                </MenuItem>
              ) : null}
              {categoryMenu(typeCategories, categoryId)}
            </TextField>
          )}

          <Box sx={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: isTransfer ? { xs: "minmax(0, 1fr)", sm: "minmax(0, 1fr) auto minmax(0, 1fr)" } : "minmax(0, 1fr)", gap: 1.5, alignItems: "start" }}>
            <TextField
              select
              label={isTransfer ? "From Account" : draft.type === "income" ? "To Account" : "From Account"}
              value={draft.accountId}
              disabled={busy}
              error={fieldError("account_id") !== null}
              helperText={fieldError("account_id")}
              onChange={(event) => set("accountId", Number(event.target.value))}
            >
              {accountMenu(allAccounts, draft.accountId)}
            </TextField>
            {isTransfer ? (
              <>
                <Tooltip title="Swap accounts">
                  <span>
                    <IconButton aria-label="Swap accounts" disabled={busy} onClick={swapAccounts} sx={{ mt: 0.25, transform: { sm: "rotate(90deg)" } }}>
                      <MdiIcon path={mdiSwapVertical} />
                    </IconButton>
                  </span>
                </Tooltip>
                <TextField
                  select
                  label="To Account"
                  value={draft.toAccountId}
                  disabled={busy}
                  error={errors.toAccount !== null || fieldError("to_account_id") !== null}
                  helperText={errors.toAccount ?? fieldError("to_account_id")}
                  onChange={(event) => set("toAccountId", Number(event.target.value))}
                >
                  {accountMenu(allAccounts, draft.toAccountId)}
                </TextField>
              </>
            ) : null}
          </Box>

          <TextField
            label="Date and Time"
            type="datetime-local"
            value={draft.occurredAt}
            disabled={busy}
            error={fieldError("occurred_at") !== null}
            helperText={fieldError("occurred_at")}
            onChange={(event) => set("occurredAt", event.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ gridColumn: "1 / -1" }}
          />

          <TextField
            label="Description"
            placeholder="Optional, such as where or what for"
            value={draft.comment}
            disabled={busy}
            multiline
            minRows={2}
            onChange={(event) => set("comment", event.target.value)}
            slotProps={{ htmlInput: { maxLength: 255 } }}
            sx={{ gridColumn: "1 / -1" }}
          />

          {serverError && Object.keys(serverError.fields).length === 0 ? (
            <Typography color="error" variant="body2" sx={{ gridColumn: "1 / -1" }}>
              {errorMessage(serverError)}
            </Typography>
          ) : null}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, gap: 1, flexWrap: "wrap" }}>
        {editing ? (
          confirmDelete ? (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mr: "auto" }}>
              <Typography variant="body2">Delete it?</Typography>
              <Button size="small" color="error" disabled={busy} onClick={() => remove.mutate()}>
                Delete
              </Button>
              <Button size="small" variant="text" color="inherit" disabled={busy} onClick={() => setConfirmDelete(false)}>
                Keep
              </Button>
            </Box>
          ) : (
            <Button variant="text" color="error" disabled={busy} onClick={() => setConfirmDelete(true)} sx={{ mr: "auto" }}>
              Delete
            </Button>
          )
        ) : null}
        <Button variant="text" color="inherit" disabled={busy} onClick={onClose}>
          Cancel
        </Button>
        {!editing ? (
          <Button variant="outlined" disabled={!canSave || busy} onClick={() => save.mutate(true)}>
            Save and Add Another
          </Button>
        ) : null}
        <Button type="submit" form="transaction-form" disabled={!canSave || busy}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
