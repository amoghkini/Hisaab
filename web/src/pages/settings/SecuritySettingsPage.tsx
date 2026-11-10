import { mdiCellphone, mdiDevices, mdiLaptop, mdiRefresh, mdiTablet } from "@mdi/js";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Snackbar from "@mui/material/Snackbar";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";

import { changePassword, endOtherSessions, endSession, fetchSessions, type AuthSession } from "@/api/auth";
import { ApiError, errorMessage } from "@/api/client";
import { Loading, Spinner } from "@/components/Loading";
import { MdiIcon } from "@/components/MdiIcon";
import { PasswordField } from "@/components/PasswordField";
import { SettingRow, SettingsCard, SettingsPageTitle } from "@/pages/settings/SettingsCard";

const SESSIONS_KEY = ["sessions"];
const PASSWORD_MIN = 8;

/** A readable name for a browser's User-Agent, such as "Chrome on Windows", and an icon for the kind of device. */
export function describeDevice(userAgent: string): { name: string; icon: string } {
  if (!userAgent) return { name: "Unknown device", icon: mdiDevices };
  const browser = /Edg\//.test(userAgent)
    ? "Edge"
    : /OPR\/|Opera/.test(userAgent)
      ? "Opera"
      : /Firefox\//.test(userAgent)
        ? "Firefox"
        : /Chrome\/|CriOS\//.test(userAgent)
          ? "Chrome"
          : /Safari\//.test(userAgent)
            ? "Safari"
            : null;
  const system = /Android/.test(userAgent)
    ? "Android"
    : /iPhone|iPad|iPod/.test(userAgent)
      ? "iOS"
      : /Windows/.test(userAgent)
        ? "Windows"
        : /Mac OS X|Macintosh/.test(userAgent)
          ? "macOS"
          : /Linux/.test(userAgent)
            ? "Linux"
            : null;
  const icon = /iPad|Tablet/.test(userAgent) ? mdiTablet : /Mobile|Android|iPhone/.test(userAgent) ? mdiCellphone : mdiLaptop;
  if (browser && system) return { name: `${browser} on ${system}`, icon };
  return { name: browser ?? system ?? userAgent.slice(0, 60), icon };
}

const WHEN = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

/** The API's UTC times as local date and time. */
function when(utc: string | null): string {
  return utc ? WHEN.format(new Date(`${utc}Z`)) : "—";
}

function PasswordCard({ onMessage }: { onMessage: (message: string) => void }) {
  const client = useQueryClient();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const save = useMutation({
    mutationFn: changePassword,
    onSuccess: () => {
      setCurrent("");
      setNext("");
      setConfirm("");
      setSubmitted(false);
      onMessage("Password changed. Other devices have been logged out.");
      void client.invalidateQueries({ queryKey: SESSIONS_KEY });
    },
  });

  const serverFields = save.error instanceof ApiError ? save.error.fields : {};
  const errors = {
    current: current === "" ? "Enter your current password." : (serverFields.current_password ?? null),
    next: next.length < PASSWORD_MIN ? `Use at least ${PASSWORD_MIN} characters.` : next === current ? "Choose a password different from the current one." : null,
    confirm: confirm !== next ? "The passwords do not match." : null,
  };
  const valid = !errors.next && !errors.confirm && current !== "";

  function submit(event: FormEvent): void {
    event.preventDefault();
    setSubmitted(true);
    if (valid) save.mutate({ current_password: current, new_password: next });
  }

  const show = (error: string | null, value: string) => (submitted || value !== "" ? error : null);

  return (
    <Box component="form" noValidate onSubmit={submit}>
      <SettingsCard
        title="Modify Password"
        description="After changing the password, other devices will be logged out. Use the new password to log in on them."
        footer={
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? <Spinner size={18} style={{ marginRight: 8 }} /> : null}
            Save Changes
          </Button>
        }
      >
        {/* For password managers: which account this is. */}
        <input type="text" name="username" autoComplete="username" hidden readOnly />
        <SettingRow label="Current Password">
          <PasswordField
            fullWidth
            size="small"
            autoComplete="current-password"
            value={current}
            disabled={save.isPending}
            error={Boolean(submitted ? errors.current : serverFields.current_password)}
            helperText={submitted ? errors.current : serverFields.current_password}
            onChange={(event) => {
              setCurrent(event.target.value);
              if (save.isError) save.reset();
            }}
          />
        </SettingRow>
        <SettingRow label="New Password" hint={`At least ${PASSWORD_MIN} characters.`}>
          <PasswordField
            fullWidth
            size="small"
            autoComplete="new-password"
            value={next}
            disabled={save.isPending}
            error={Boolean(show(errors.next, next))}
            helperText={show(errors.next, next)}
            onChange={(event) => setNext(event.target.value)}
          />
        </SettingRow>
        <SettingRow label="Confirm Password">
          <PasswordField
            fullWidth
            size="small"
            autoComplete="new-password"
            placeholder="Re-enter the password"
            value={confirm}
            disabled={save.isPending}
            error={Boolean(show(errors.confirm, confirm))}
            helperText={show(errors.confirm, confirm)}
            onChange={(event) => setConfirm(event.target.value)}
          />
        </SettingRow>
        {save.error && !(save.error instanceof ApiError && save.error.fields.current_password) ? (
          <Typography variant="body2" color="error" sx={{ pb: 1 }}>
            {errorMessage(save.error)}
          </Typography>
        ) : null}
      </SettingsCard>
    </Box>
  );
}

function SessionsCard({ onMessage }: { onMessage: (message: string) => void }) {
  const client = useQueryClient();
  const sessions = useQuery({ queryKey: SESSIONS_KEY, queryFn: fetchSessions });
  const refresh = () => client.invalidateQueries({ queryKey: SESSIONS_KEY });

  const endOne = useMutation({
    mutationFn: (session: AuthSession) => endSession(session.id),
    onSuccess: () => onMessage("Device logged out"),
    onError: (error) => onMessage(errorMessage(error)),
    onSettled: refresh,
  });
  const endOthers = useMutation({
    mutationFn: endOtherSessions,
    onSuccess: () => onMessage("All other devices logged out"),
    onError: (error) => onMessage(errorMessage(error)),
    onSettled: refresh,
  });

  const list = sessions.data ?? [];
  const others = list.filter((session) => !session.current).length;

  return (
    <SettingsCard
      title="Devices & Sessions"
      description="Every browser and device logged in to your account."
      action={
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Tooltip title="Refresh">
            <span>
              <IconButton aria-label="Refresh" disabled={sessions.isFetching} onClick={() => void refresh()}>
                <MdiIcon path={mdiRefresh} />
              </IconButton>
            </span>
          </Tooltip>
          <Button variant="outlined" color="error" size="small" disabled={others === 0 || endOthers.isPending} onClick={() => endOthers.mutate()}>
            Log Out All Others
          </Button>
        </Box>
      }
    >
      {sessions.isPending ? (
        <Loading size="small" label="Loading sessions…" />
      ) : sessions.isError ? (
        <Typography color="error" sx={{ py: 2 }}>
          {errorMessage(sessions.error)}
        </Typography>
      ) : (
        <TableContainer sx={{ mx: -3, width: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ pl: 3 }}>Device</TableCell>
                <TableCell>Logged In</TableCell>
                <TableCell>Last Activity</TableCell>
                <TableCell align="right" sx={{ pr: 3 }}>
                  Operation
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {list.map((session) => {
                const device = describeDevice(session.user_agent);
                return (
                  <TableRow key={session.id} hover>
                    <TableCell sx={{ pl: 3 }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                        <MdiIcon path={device.icon} sx={{ color: "text.secondary" }} />
                        <Tooltip title={session.user_agent || "No browser details were sent"}>
                          <span>{device.name}</span>
                        </Tooltip>
                        {session.current ? <Chip size="small" color="primary" variant="outlined" label="This device" /> : null}
                      </Box>
                    </TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>{when(session.created_at)}</TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>{session.current ? "Now" : when(session.last_seen_at)}</TableCell>
                    <TableCell align="right" sx={{ pr: 3 }}>
                      {session.current ? null : (
                        <Button
                          size="small"
                          color="error"
                          variant="text"
                          disabled={endOne.isPending && endOne.variables?.id === session.id}
                          onClick={() => endOne.mutate(session)}
                        >
                          Log Out
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </SettingsCard>
  );
}

/** ezBookkeeping's "Security" page: the password, and the devices logged in. */
export function SecuritySettingsPage() {
  const [message, setMessage] = useState<string | null>(null);
  return (
    <>
      <SettingsPageTitle title="Security" description="Change your password and see where your account is logged in." />
      <PasswordCard onMessage={setMessage} />
      <SessionsCard onMessage={setMessage} />
      <Snackbar open={message !== null} autoHideDuration={4000} message={message} onClose={() => setMessage(null)} />
    </>
  );
}
