import { mdiBankTransfer, mdiCashMinus } from "@mdi/js";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";

import type { Account } from "@/api/accounts";
import { MdiIcon } from "@/components/MdiIcon";

/** Accounts cash can be withdrawn from: bank accounts at an ATM or branch, and cards as a cash advance. */
export const CASH_WITHDRAWAL_CATEGORIES: ReadonlyArray<Account["category"]> = ["savings", "current", "credit_card"];

export type AccountActionKind = "withdraw" | "transfer";

export interface AccountActionTarget {
  kind: AccountActionKind;
  account: Account;
}

const ACTIONS = {
  withdraw: { title: "Cash Withdrawal", icon: mdiCashMinus, submit: "Withdraw" },
  transfer: { title: "Transfer", icon: mdiBankTransfer, submit: "Transfer" },
} as const;

interface AccountActionDialogProps {
  /** The action and the account it starts from. Null keeps the dialog closed. */
  target: AccountActionTarget | null;
  /** Every account, to choose where the money goes. */
  accounts: Account[];
  onClose: () => void;
}

/**
 * Placeholder for a cash withdrawal or a transfer from one account.
 * TODO: save it as a transfer transaction: out of this account, into cash in hand or the chosen account.
 */
export function AccountActionDialog({ target, accounts, onClose }: AccountActionDialogProps) {
  const action = target ? ACTIONS[target.kind] : null;
  const from = target?.account;
  const destinations = target?.kind === "withdraw"
    ? accounts.filter((account) => account.category === "cash")
    : accounts.filter((account) => account.id !== from?.id && !account.hidden);

  return (
    <Dialog open={target !== null} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        {action ? <MdiIcon path={action.icon} /> : null}
        {action?.title}
      </DialogTitle>
      <DialogContent>
        <Alert severity="info" sx={{ mb: 2.5 }}>
          {action?.title} is not available yet. It is coming in a later version of Hisaab.
        </Alert>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <TextField label="From" value={from ? `${from.name} (${from.currency})` : ""} disabled fullWidth />
          <TextField select label={target?.kind === "withdraw" ? "Into cash account" : "To"} value="" disabled fullWidth>
            {destinations.map((account) => (
              <MenuItem key={account.id} value={account.id}>
                {account.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField label={`Amount${from ? ` (${from.currency})` : ""}`} disabled fullWidth />
          <TextField label="Date" type="date" disabled fullWidth slotProps={{ inputLabel: { shrink: true } }} />
          <TextField label="Note" disabled fullWidth />
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button variant="text" color="inherit" onClick={onClose}>
          Close
        </Button>
        <Button disabled>{action?.submit}</Button>
      </DialogActions>
    </Dialog>
  );
}
