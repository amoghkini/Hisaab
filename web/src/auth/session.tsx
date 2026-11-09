import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Navigate, Outlet, useLocation } from "react-router-dom";

import { fetchMe, type User } from "@/api/auth";

const ME = ["me"];
const HOME = "/";

/** Who is signed in: undefined while the first check runs, then a user or null. */
export function useMe() {
  return useQuery({ queryKey: ME, queryFn: fetchMe, staleTime: Infinity, retry: false });
}

/** Record the result of a sign-in, sign-up or sign-out, so the routes below react at once. */
export function useSetMe(): (user: User | null) => void {
  const client = useQueryClient();
  return (user) => client.setQueryData(ME, user);
}

/** Where to go after logging in: the page the person was sent away from, if it is inside this app. */
function afterLoginPath(state: unknown): string {
  const from = (state as { from?: { pathname?: unknown; search?: unknown } } | null)?.from;
  if (typeof from?.pathname !== "string" || !from.pathname.startsWith("/") || from.pathname.startsWith("//")) {
    return HOME;
  }
  return `${from.pathname}${typeof from.search === "string" ? from.search : ""}`;
}

function FullScreenSpinner() {
  return (
    <Box sx={{ display: "grid", placeItems: "center", minHeight: "100dvh" }}>
      <CircularProgress size={40} />
    </Box>
  );
}

/** Pages that need a signed-in user. Everyone else goes to the login page and comes back afterwards. */
export function RequireAuth() {
  const me = useMe();
  const location = useLocation();
  if (me.isPending) return <FullScreenSpinner />;
  if (!me.data) return <Navigate to="/login" replace state={{ from: location }} />;
  return <Outlet />;
}

/** The login and sign-up pages. A signed-in user is sent on, which is also how a successful login leaves the page. */
export function GuestOnly() {
  const me = useMe();
  const location = useLocation();
  if (me.isPending) return <FullScreenSpinner />;
  if (me.data) return <Navigate to={afterLoginPath(location.state)} replace />;
  return <Outlet />;
}
