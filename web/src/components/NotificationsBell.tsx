import { mdiBellOutline, mdiCheckAll } from "@mdi/js";
import Badge from "@mui/material/Badge";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { fetchNotifications, readAllNotifications, readNotification, type Notification } from "@/api/notifications";
import { MdiIcon } from "@/components/MdiIcon";
import { NOTIFICATIONS_KEY } from "@/pages/salary/queries";

/** "5 min ago", "3 h ago", "2 days ago", or the date. */
function ago(iso: string): string {
  // The API sends UTC without a zone.
  const then = new Date(iso.endsWith("Z") ? iso : `${iso}Z`).getTime();
  const minutes = Math.max(0, Math.round((Date.now() - then) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return days === 1 ? "yesterday" : `${days} days ago`;
  return new Date(then).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/** The bell in the top bar: payslips drafted on pay day, and anything else waiting for the user. */
export function NotificationsBell() {
  const client = useQueryClient();
  const navigate = useNavigate();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  // Drafts are made by a job on the server, so look again every few minutes and when the tab comes back.
  const notifications = useQuery({ queryKey: [NOTIFICATIONS_KEY], queryFn: fetchNotifications, refetchInterval: 5 * 60 * 1000 });
  const refresh = () => client.invalidateQueries({ queryKey: [NOTIFICATIONS_KEY] });
  const readOne = useMutation({ mutationFn: readNotification, onSettled: refresh });
  const readAll = useMutation({ mutationFn: readAllNotifications, onSettled: refresh });

  const unread = notifications.data?.unread_count ?? 0;
  const items = notifications.data?.items ?? [];

  function open(item: Notification): void {
    setAnchor(null);
    if (!item.read) readOne.mutate(item.id);
    navigate(item.link);
  }

  return (
    <>
      <Tooltip title={unread ? `${unread} unread` : "Notifications"}>
        <IconButton aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"} onClick={(event) => setAnchor(event.currentTarget)}>
          <Badge badgeContent={unread} color="error" max={99}>
            <MdiIcon path={mdiBellOutline} />
          </Badge>
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchor}
        open={anchor !== null}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: { width: 380, maxWidth: "calc(100vw - 32px)" } }, list: { sx: { py: 0 } } }}
      >
        <Box sx={{ display: "flex", alignItems: "center", px: 2, py: 1.25 }}>
          <Typography variant="subtitle1" sx={{ flex: 1 }}>
            Notifications
          </Typography>
          <Button size="small" variant="text" startIcon={<MdiIcon path={mdiCheckAll} />} disabled={unread === 0 || readAll.isPending} onClick={() => readAll.mutate()}>
            Mark all read
          </Button>
        </Box>
        <Divider />
        {items.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ px: 2, py: 3, textAlign: "center" }}>
            Nothing yet. When a payslip is drafted on pay day, it shows up here.
          </Typography>
        ) : (
          items.map((item) => (
            <MenuItem key={item.id} onClick={() => open(item)} sx={{ alignItems: "flex-start", gap: 1.25, py: 1.25, whiteSpace: "normal" }}>
              <Box sx={{ width: 8, height: 8, borderRadius: "50%", mt: 0.9, flex: "none", bgcolor: item.read ? "transparent" : "primary.main" }} />
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: item.read ? 400 : 600 }}>
                  {item.title}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {ago(item.created_at)}
                </Typography>
              </Box>
            </MenuItem>
          ))
        )}
      </Menu>
    </>
  );
}
