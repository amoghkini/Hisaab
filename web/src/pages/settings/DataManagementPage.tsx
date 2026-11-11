import { mdiFileDelimitedOutline, mdiFileExportOutline, mdiRefresh } from "@mdi/js";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import Snackbar from "@mui/material/Snackbar";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";

import { ApiError, errorMessage } from "@/api/client";
import { clearData, fetchDataStats } from "@/api/data";
import { fetchTransactions, type Transaction } from "@/api/transactions";
import { Spinner } from "@/components/Loading";
import { MdiIcon } from "@/components/MdiIcon";
import { PasswordField } from "@/components/PasswordField";
import { addDays, parseIsoDate, toIsoDate } from "@/lib/dates";
import { useAccounts } from "@/pages/accounts/queries";
import { SettingRow, SettingsCard, SettingsPageTitle } from "@/pages/settings/SettingsCard";
import { exportTransactions } from "@/pages/transactions/exportTransactions";
import { MAX_RANGE_DAYS } from "@/pages/transactions/dateRanges";
import { categoriesById, useCategories } from "@/pages/transactions/queries";

const STATS_KEY = ["data-stats"];

type Scope = "transactions" | "all";

const CLEAR_TEXT: Record<Scope, { title: string; body: string; button: string; done: string }> = {
  transactions: {
    title: "Clear All Transactions",
    body: "Every transaction will be deleted. Your accounts and categories stay, and each account's balance goes back to its opening balance.",
    button: "Clear All Transactions",
    done: "All transactions cleared",
  },
  all: {
    title: "Clear All Data",
    body: "Every transaction, account and category will be deleted. Your login, profile and preferences stay.",
    button: "Clear All Data",
    done: "All data cleared",
  },
};

/** Every transaction between two days, fetched a year (the API's longest range) at a time. Newest first. */
async function fetchAllTransactions(first: string, last: string): Promise<Transaction[]> {
  const items: Transaction[] = [];
  for (let start = parseIsoDate(first); toIsoDate(start) <= last; start = addDays(start, MAX_RANGE_DAYS)) {
    const end = toIsoDate(addDays(start, MAX_RANGE_DAYS - 1));
    const page = await fetchTransactions({ start: toIsoDate(start), end: end < last ? end : last });
    items.push(...page.items);
  }
  return items.sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
}

function Stat({ label, value }: { label: string; value: number | undefined }) {
  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, px: 2.5, py: 2, flex: "1 1 160px" }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="h5" sx={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
        {value === undefined ? <Skeleton width={60} /> : value.toLocaleString()}
      </Typography>
    </Paper>
  );
}

/** Asks for the password before deleting; the delete itself happens here. */
function ClearDialog({ scope, onClose, onDone }: { scope: Scope | null; onClose: () => void; onDone: (message: string) => void }) {
  const client = useQueryClient();
  const [password, setPassword] = useState("");
  const clear = useMutation({
    mutationFn: clearData,
    onSuccess: async (_, input) => {
      setPassword("");
      onDone(CLEAR_TEXT[input.scope].done);
      // Accounts, categories, transactions, the dashboard and the default account all change.
      await client.invalidateQueries();
    },
  });
  const text = scope ? CLEAR_TEXT[scope] : null;
  const fieldError = clear.error instanceof ApiError ? clear.error.fields.password : undefined;

  function close(): void {
    if (clear.isPending) return;
    setPassword("");
    clear.reset();
    onClose();
  }

  function submit(event: FormEvent): void {
    event.preventDefault();
    if (scope && password) clear.mutate({ scope, password });
  }

  return (
    <Dialog open={scope !== null} onClose={close} maxWidth="xs" fullWidth slotProps={{ paper: { component: "form", onSubmit: submit } }}>
      <DialogTitle>{text?.title}</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>{text?.body}</DialogContentText>
        <Alert severity="error" sx={{ mb: 2 }}>
          You cannot undo this. Export your data first if you may want it back.
        </Alert>
        <PasswordField
          autoFocus
          fullWidth
          label="Current Password"
          autoComplete="current-password"
          value={password}
          disabled={clear.isPending}
          error={Boolean(fieldError)}
          helperText={fieldError ?? "Enter your password to confirm."}
          onChange={(event) => {
            setPassword(event.target.value);
            if (clear.isError) clear.reset();
          }}
        />
        {clear.error && !fieldError ? (
          <Typography variant="body2" color="error" sx={{ mt: 1 }}>
            {errorMessage(clear.error)}
          </Typography>
        ) : null}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button variant="text" color="inherit" disabled={clear.isPending} onClick={close}>
          Cancel
        </Button>
        <Button type="submit" color="error" disabled={!password || clear.isPending}>
          {clear.isPending ? <Spinner size={18} style={{ marginRight: 8 }} /> : null}
          {text?.button}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/** ezBookkeeping's "Data Management" page: what is stored, export it all, or clear it. */
export function DataManagementPage() {
  const client = useQueryClient();
  const stats = useQuery({ queryKey: STATS_KEY, queryFn: fetchDataStats });
  const accounts = useAccounts();
  const categories = useCategories();
  const [exporting, setExporting] = useState<"csv" | "tsv" | null>(null);
  const [clearing, setClearing] = useState<Scope | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const first = stats.data?.first_transaction_on ?? null;
  const last = stats.data?.last_transaction_on ?? null;
  const span =
    first && last
      ? `${parseIsoDate(first).toLocaleDateString(undefined, { dateStyle: "medium" })} to ${parseIsoDate(last).toLocaleDateString(undefined, { dateStyle: "medium" })}`
      : null;

  async function runExport(format: "csv" | "tsv"): Promise<void> {
    if (!first || !last) return;
    setExporting(format);
    try {
      const items = await fetchAllTransactions(first, last);
      const accountMap = new Map((accounts.data ?? []).map((account) => [account.id, account]));
      exportTransactions(items, accountMap, categoriesById(categories.data), format, `hisaab-all-transactions-${first}-to-${last}`);
      setMessage(`Exported ${items.length.toLocaleString()} transactions`);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setExporting(null);
    }
  }

  const noTransactions = stats.data?.transactions === 0;
  const exportDisabled = exporting !== null || !stats.data || noTransactions || accounts.isPending || categories.isPending;

  return (
    <>
      <SettingsPageTitle title="Data Management" description="See what Hisaab stores for you, take a copy, or start over." />

      <SettingsCard
        title="Your Data"
        action={
          <Tooltip title="Refresh">
            <span>
              <IconButton aria-label="Refresh" disabled={stats.isFetching} onClick={() => void client.invalidateQueries({ queryKey: STATS_KEY })}>
                <MdiIcon path={mdiRefresh} />
              </IconButton>
            </span>
          </Tooltip>
        }
      >
        {stats.isError ? (
          <Typography color="error" sx={{ py: 2 }}>
            {errorMessage(stats.error)}
          </Typography>
        ) : (
          <Box sx={{ py: 1.5 }}>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
              <Stat label="Accounts" value={stats.data?.accounts} />
              <Stat label="Transaction Categories" value={stats.data?.categories} />
              <Stat label="Transactions" value={stats.data?.transactions} />
            </Box>
            {span ? (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
                Transactions from {span}.
              </Typography>
            ) : null}
          </Box>
        )}
      </SettingsCard>

      <SettingsCard title="Export Data" description="Save every transaction to a file you can open in Excel or Google Sheets.">
        <SettingRow label="Export All Transactions" hint={noTransactions ? "There are no transactions to export yet." : "It may take a moment when there are many."}>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
            <Button
              variant="outlined"
              disabled={exportDisabled}
              startIcon={exporting === "csv" ? <Spinner size={16} /> : <MdiIcon path={mdiFileExportOutline} />}
              onClick={() => void runExport("csv")}
            >
              CSV File
            </Button>
            <Button
              variant="outlined"
              disabled={exportDisabled}
              startIcon={exporting === "tsv" ? <Spinner size={16} /> : <MdiIcon path={mdiFileDelimitedOutline} />}
              onClick={() => void runExport("tsv")}
            >
              TSV File
            </Button>
          </Box>
        </SettingRow>
      </SettingsCard>

      <SettingsCard
        danger
        title="Danger Zone"
        description="You cannot undo these. Clear All Transactions deletes your transactions; Clear All Data also deletes your accounts and categories."
      >
        <SettingRow label="Clear All Transactions" hint="Accounts and categories stay.">
          <Button color="error" variant="outlined" disabled={!stats.data || noTransactions} onClick={() => setClearing("transactions")}>
            Clear All Transactions
          </Button>
        </SettingRow>
        <SettingRow label="Clear All Data" hint="Transactions, accounts and categories.">
          <Button color="error" disabled={!stats.data} onClick={() => setClearing("all")}>
            Clear All Data
          </Button>
        </SettingRow>
      </SettingsCard>

      <ClearDialog
        scope={clearing}
        onClose={() => setClearing(null)}
        onDone={(done) => {
          setClearing(null);
          setMessage(done);
        }}
      />
      <Snackbar open={message !== null} autoHideDuration={4000} message={message} onClose={() => setMessage(null)} />
    </>
  );
}
