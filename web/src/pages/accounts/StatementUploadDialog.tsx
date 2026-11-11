import { mdiCheckCircleOutline, mdiPlusCircleOutline, mdiAlertCircleOutline, mdiTrayArrowUp } from "@mdi/js";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Typography from "@mui/material/Typography";

import type { Account } from "@/api/accounts";
import { MdiIcon } from "@/components/MdiIcon";

/** Account categories that can take a bank statement upload. */
export const STATEMENT_UPLOAD_CATEGORIES: ReadonlyArray<Account["category"]> = ["savings", "current"];

interface StatementUploadDialogProps {
  /** The account to upload a statement for. Null keeps the dialog closed. */
  account: Account | null;
  onClose: () => void;
}

/** What the upload will do with each statement line, once it is built. */
const OUTCOMES = [
  { icon: mdiPlusCircleOutline, title: "Missing transactions are added", text: "and flagged for you to categorize." },
  { icon: mdiCheckCircleOutline, title: "Matching transactions are skipped", text: "when the date and amount already agree." },
  { icon: mdiAlertCircleOutline, title: "Near matches are flagged", text: "when an amount is close but not equal, so you can check it." },
];

/**
 * Placeholder for uploading a bank statement to a savings or current account.
 * TODO: accept a statement file, match its lines against the account's transactions, and show the results.
 */
export function StatementUploadDialog({ account, onClose }: StatementUploadDialogProps) {
  return (
    <Dialog open={account !== null} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Upload statement{account ? ` · ${account.name}` : ""}</DialogTitle>
      <DialogContent>
        <Alert severity="info" sx={{ mb: 2 }}>
          Statement upload is not available yet. It is coming in a later version of Hisaab.
        </Alert>
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 1,
            py: 4,
            mb: 2.5,
            border: "2px dashed",
            borderColor: "divider",
            borderRadius: 2,
            color: "text.disabled",
          }}
        >
          <MdiIcon path={mdiTrayArrowUp} sx={{ fontSize: 40 }} />
          <Typography variant="body2">Drop a bank statement here, or choose a file</Typography>
        </Box>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          What will happen
        </Typography>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
          {OUTCOMES.map((outcome) => (
            <Box key={outcome.title} sx={{ display: "flex", gap: 1.25, alignItems: "flex-start" }}>
              <MdiIcon path={outcome.icon} sx={{ fontSize: 20, color: "text.secondary", mt: "1px" }} />
              <Typography variant="body2">
                <strong>{outcome.title}</strong> {outcome.text}
              </Typography>
            </Box>
          ))}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button variant="text" color="inherit" onClick={onClose}>
          Close
        </Button>
        <Button disabled startIcon={<MdiIcon path={mdiTrayArrowUp} />}>
          Upload
        </Button>
      </DialogActions>
    </Dialog>
  );
}
