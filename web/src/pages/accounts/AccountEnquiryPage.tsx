import { mdiArrowLeft, mdiBankTransfer, mdiCashMinus, mdiListBoxOutline, mdiPencilOutline, mdiTrayArrowUp } from "@mdi/js";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useState, type ReactNode } from "react";
import { Link as RouterLink, useParams } from "react-router-dom";

import { categoryInfo, type Account, type AccountCategory } from "@/api/accounts";
import { errorMessage } from "@/api/client";
import { usePrivacyMode } from "@/appearance/PrivacyMode";
import { AccountIcon } from "@/components/AccountIcon";
import { MdiIcon } from "@/components/MdiIcon";
import { HIDDEN_AMOUNT, formatAmount } from "@/lib/money";
import { AccountActionDialog, CASH_WITHDRAWAL_CATEGORIES, type AccountActionTarget } from "@/pages/accounts/AccountActionDialog";
import { AccountDialog } from "@/pages/accounts/AccountDialog";
import { STATEMENT_UPLOAD_CATEGORIES, StatementUploadDialog } from "@/pages/accounts/StatementUploadDialog";
import { useAccounts } from "@/pages/accounts/queries";

/** Accounts held with a bank or card issuer, which have a CIF and branch details. */
const BANK_CATEGORIES: ReadonlyArray<AccountCategory> = ["savings", "current", "credit_card", "loan", "fixed_deposit"];

/**
 * The bank's details for an account, kept for reference. None are stored yet.
 * TODO: store these on the account and let them be edited here.
 */
const BANK_DETAILS = [
  { label: "CIF number", hint: "Customer Information File number from the bank" },
  { label: "Account holder", hint: "Name as on the account" },
  { label: "Full account number", hint: "Shown masked except the last digits" },
  { label: "IFSC code", hint: "For transfers to this account" },
  { label: "Branch", hint: "Home branch name and address" },
  { label: "MICR code", hint: "As printed on the cheque book" },
  { label: "Opened on", hint: "Date the account was opened" },
  { label: "Nominee", hint: "Nominee name and relationship" },
  { label: "Registered mobile", hint: "For OTPs and SMS alerts" },
  { label: "Registered email", hint: "For statements" },
  { label: "Customer care", hint: "Bank helpline number" },
  { label: "Relationship manager", hint: "Name and contact" },
];

function Field({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography sx={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis" }}>{value}</Typography>
      {hint ? (
        <Typography variant="caption" color="text.disabled">
          {hint}
        </Typography>
      ) : null}
    </Box>
  );
}

function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <Paper variant="outlined" sx={{ borderRadius: 3 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, px: { xs: 2, sm: 3 }, py: 2 }}>
        <Typography variant="h6" component="h2">
          {title}
        </Typography>
        <Box sx={{ flex: 1 }} />
        {action}
      </Box>
      <Divider />
      <Box sx={{ px: { xs: 2, sm: 3 }, py: 2.5 }}>{children}</Box>
    </Paper>
  );
}

const fieldGrid = { display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(3, minmax(0, 1fr))" }, gap: 2.5 };

/** One account's details: its balance, what Hisaab knows about it, and the bank's details such as the CIF. */
export function AccountEnquiryPage() {
  const { accountId } = useParams();
  const accounts = useAccounts();
  const { hidden } = usePrivacyMode();
  const [editing, setEditing] = useState(false);
  const [action, setAction] = useState<AccountActionTarget | null>(null);
  const [uploadFor, setUploadFor] = useState<Account | null>(null);

  const money = (minor: number, currency: string) => (hidden ? HIDDEN_AMOUNT : formatAmount(minor, currency));
  const account = accounts.data?.find((each) => String(each.id) === accountId);

  const back = (
    <Button variant="text" color="inherit" startIcon={<MdiIcon path={mdiArrowLeft} />} component={RouterLink} to="/accounts" sx={{ mb: 1.5 }}>
      Accounts
    </Button>
  );

  if (accounts.isPending) {
    return (
      <>
        {back}
        <Skeleton variant="rounded" height={140} sx={{ mb: 2.5 }} />
        <Skeleton variant="rounded" height={260} />
      </>
    );
  }
  if (accounts.isError) {
    return (
      <>
        {back}
        <Alert severity="error">Could not load the account. {errorMessage(accounts.error)}</Alert>
      </>
    );
  }
  if (!account) {
    return (
      <>
        {back}
        <Alert severity="warning">This account does not exist, or was deleted.</Alert>
      </>
    );
  }

  const info = categoryInfo(account.category);
  const owed = -account.balance;
  const isBank = BANK_CATEGORIES.includes(account.category);

  return (
    <>
      {back}

      <Paper variant="outlined" sx={{ borderRadius: 3, p: { xs: 2, sm: 3 }, mb: 2.5 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
          <AccountIcon icon={account.icon} color={account.color} size={36} faded={account.hidden} />
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h5" component="h1" sx={{ overflow: "hidden", textOverflow: "ellipsis" }}>
              {account.name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {info.name} · {account.currency}
              {account.number_suffix ? ` · ••${account.number_suffix}` : ""}
            </Typography>
          </Box>
          {account.hidden ? <Chip size="small" label="Hidden" variant="outlined" /> : null}
          <Box sx={{ flex: 1 }} />
          <Box sx={{ textAlign: "end" }}>
            <Typography variant="body2" color="text.secondary">
              {account.is_liability ? "Outstanding" : "Balance"}
            </Typography>
            <Typography sx={{ fontSize: "1.75rem", fontWeight: 500 }}>{money(account.is_liability ? owed : account.balance, account.currency)}</Typography>
          </Box>
        </Box>

        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 2.5 }}>
          {CASH_WITHDRAWAL_CATEGORIES.includes(account.category) ? (
            <Button variant="outlined" startIcon={<MdiIcon path={mdiCashMinus} />} onClick={() => setAction({ kind: "withdraw", account })}>
              Cash Withdrawal
            </Button>
          ) : null}
          <Button variant="outlined" startIcon={<MdiIcon path={mdiBankTransfer} />} onClick={() => setAction({ kind: "transfer", account })}>
            Transfer
          </Button>
          <Button variant="text" color="inherit" startIcon={<MdiIcon path={mdiListBoxOutline} />} component={RouterLink} to={`/transactions?account=${account.id}`}>
            Transactions
          </Button>
          {STATEMENT_UPLOAD_CATEGORIES.includes(account.category) ? (
            <Button variant="text" color="inherit" startIcon={<MdiIcon path={mdiTrayArrowUp} />} onClick={() => setUploadFor(account)}>
              Upload Statement
            </Button>
          ) : null}
        </Box>
      </Paper>

      <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
        <Section
          title="Account"
          action={
            <Tooltip title="Edit account">
              <IconButton aria-label="Edit account" onClick={() => setEditing(true)}>
                <MdiIcon path={mdiPencilOutline} />
              </IconButton>
            </Tooltip>
          }
        >
          <Box sx={fieldGrid}>
            <Field label="Type" value={info.name} />
            <Field label="Currency" value={account.currency} />
            <Field label="Account number ends in" value={account.number_suffix ? `••${account.number_suffix}` : "—"} />
            <Field label="Opening balance" value={money(account.opening_balance, account.currency)} />
            <Field label="Opening balance date" value={account.opening_balance_date ?? "—"} />
            {account.category === "credit_card" ? (
              <>
                <Field label="Credit limit" value={account.credit_limit !== null ? money(account.credit_limit, account.currency) : "—"} />
                <Field label="Statement day" value={account.statement_day ?? "—"} />
              </>
            ) : null}
            <Field label="Counted in totals" value={account.include_in_total ? "Yes" : "No"} />
          </Box>
          {account.comment ? (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2.5, whiteSpace: "pre-line" }}>
              {account.comment}
            </Typography>
          ) : null}
        </Section>

        {isBank ? (
          <Section
            title="Bank details"
            action={
              <Button variant="outlined" color="inherit" size="small" startIcon={<MdiIcon path={mdiPencilOutline} />} disabled>
                Edit
              </Button>
            }
          >
            <Alert severity="info" sx={{ mb: 2.5 }}>
              Keeping the CIF number and other bank details is not available yet. It is coming in a later version of Hisaab.
            </Alert>
            <Box sx={fieldGrid}>
              {BANK_DETAILS.map((detail) => (
                <Field key={detail.label} label={detail.label} value={<Box component="span" sx={{ color: "text.disabled" }}>Not set</Box>} hint={detail.hint} />
              ))}
            </Box>
          </Section>
        ) : null}
      </Box>

      {editing ? <AccountDialog target={{ mode: "edit", account }} onClose={() => setEditing(false)} /> : null}
      <AccountActionDialog target={action} accounts={accounts.data} onClose={() => setAction(null)} />
      <StatementUploadDialog account={uploadFor} onClose={() => setUploadFor(null)} />
    </>
  );
}
