import { mdiGithub, mdiGoogle } from "@mdi/js";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Link from "@mui/material/Link";
import Snackbar from "@mui/material/Snackbar";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useMutation } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link as RouterLink } from "react-router-dom";

import { signIn } from "@/api/auth";
import { errorMessage } from "@/api/client";
import { useSetMe } from "@/auth/session";
import { AuthLayout } from "@/components/AuthLayout";
import { Spinner } from "@/components/Loading";
import { MdiIcon } from "@/components/MdiIcon";
import { NotAvailableDialog } from "@/components/NotAvailableDialog";
import { PasswordField } from "@/components/PasswordField";

const VERSION = "0.1.0";

/** A link-looking button for a feature that is not built yet. */
function SoonLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Link component="button" type="button" variant="body2" onClick={onClick}>
      {label}
    </Link>
  );
}

export function LoginPage() {
  const setMe = useSetMe();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [notAvailable, setNotAvailable] = useState<string | null>(null);
  // A successful login updates who is signed in, and GuestOnly then moves on to the dashboard.
  const login = useMutation({ mutationFn: signIn, onSuccess: setMe, onError: (error) => setMessage(errorMessage(error)) });
  const empty = !email.trim() || !password;

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (empty || login.isPending) return;
    login.mutate({ email: email.trim(), password });
  }

  return (
    <AuthLayout variant="login">
      <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Box sx={{ width: "100%", maxWidth: 420, px: 3, pt: 6 }}>
          <Typography variant="h5" component="h1" sx={{ mb: 1 }}>
            Welcome to Hisaab
          </Typography>
          <Typography className="auth-message" variant="body1" sx={{ mt: 0.5 }}>
            Please log in with your Hisaab account
          </Typography>

          <Box component="form" noValidate onSubmit={submit} sx={{ display: "grid", gap: 2.25, mt: 3, mb: 3 }}>
            <TextField
              type="email"
              name="email"
              autoComplete="email"
              autoFocus
              label="E-mail"
              placeholder="Your email address"
              value={email}
              disabled={login.isPending}
              onChange={(event) => setEmail(event.target.value)}
              slotProps={{ htmlInput: { autoCapitalize: "none", autoCorrect: "off", spellCheck: false } }}
            />
            <PasswordField
              name="password"
              autoComplete="current-password"
              label="Password"
              placeholder="Your password"
              value={password}
              disabled={login.isPending}
              onChange={(event) => setPassword(event.target.value)}
            />
            <Box className="auth-links" sx={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 1, mt: -0.75 }}>
              <SoonLink label="Sign in via OTP" onClick={() => setNotAvailable("Sign in via OTP")} />
              <SoonLink label="Forgot Password?" onClick={() => setNotAvailable("Password reset")} />
            </Box>
            <Button type="submit" fullWidth disabled={empty || login.isPending}>
              Log In
              {login.isPending ? <Spinner size={22} style={{ marginLeft: 8 }} /> : null}
            </Button>
            <Divider className="auth-message">
              <Typography variant="body2">or</Typography>
            </Divider>
            <Box sx={{ display: "grid", gap: 1.5 }}>
              <Button
                fullWidth
                startIcon={<MdiIcon path={mdiGoogle} />}
                onClick={() => setNotAvailable("Sign in with Google")}
              >
                Log in with Google
              </Button>
              <Button
                fullWidth
                startIcon={<MdiIcon path={mdiGithub} />}
                onClick={() => setNotAvailable("Sign in with GitHub")}
              >
                Log in with GitHub
              </Button>
            </Box>
            <Typography className="auth-links" variant="body2" sx={{ textAlign: "center", mt: 0.5 }}>
              <Box component="span" sx={{ mr: 0.5 }}>
                Don&apos;t have an account?
              </Box>
              <Link component={RouterLink} to="/signup">
                Create an account
              </Link>
            </Typography>
          </Box>
        </Box>
      </Box>

      <Box sx={{ display: "flex", justifyContent: "center" }}>
        <Box sx={{ width: "100%", maxWidth: 420, px: 3, pb: 2.5 }}>
          <Divider sx={{ mt: 1, mb: 1.5 }} />
          <Typography className="auth-footer" variant="body2" sx={{ textAlign: "center" }}>
            Hisaab {VERSION}
          </Typography>
        </Box>
      </Box>

      <Snackbar open={message !== null} message={message} onClose={() => setMessage(null)} />
      <NotAvailableDialog feature={notAvailable} onClose={() => setNotAvailable(null)} />
    </AuthLayout>
  );
}
