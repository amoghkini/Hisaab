import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";

interface NotAvailableDialogProps {
  /** The feature that was clicked, such as "Sign in with Google". Null keeps the dialog closed. */
  feature: string | null;
  onClose: () => void;
}

/** Shown for buttons whose feature is not built yet. */
export function NotAvailableDialog({ feature, onClose }: NotAvailableDialogProps) {
  return (
    <Dialog open={feature !== null} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Not available yet</DialogTitle>
      <DialogContent>
        <DialogContentText>{feature} is not functional yet. It is coming in a later version of Hisaab.</DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} autoFocus>
          OK
        </Button>
      </DialogActions>
    </Dialog>
  );
}
