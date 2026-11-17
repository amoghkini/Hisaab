import { mdiBriefcaseOutline, mdiFlagCheckered, mdiRocketLaunchOutline, mdiStarFourPointsOutline, mdiSwapHorizontal, mdiTrendingUp } from "@mdi/js";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import Typography from "@mui/material/Typography";
import { useQueries } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link as RouterLink } from "react-router-dom";

import { errorMessage } from "@/api/client";
import { fetchEmployer, type Employer, type EmployerDetail, type SalaryRevision } from "@/api/salary";
import { MdiIcon } from "@/components/MdiIcon";
import { toIsoDate, today } from "@/lib/dates";
import { SALARY_KEY } from "@/pages/salary/queries";
import { SalaryAmount } from "@/pages/salary/SalaryAmount";

/** A colour per employer, in the order they were joined. Theme colours, so they suit light and dark. */
const EMPLOYER_COLORS = ["primary", "secondary", "success", "warning", "info", "error"] as const;

type EventKind = "joined" | "appraisal" | "promotion" | "restructure" | "left";

interface TimelineEvent {
  key: string;
  /** "YYYY-MM-DD". */
  date: string;
  kind: EventKind;
  employer: EmployerDetail;
  revision: SalaryRevision | null;
  /** The revision before this one at the same employer, for the change in pay. */
  previous: SalaryRevision | null;
  /** 0 is the left side; 1 and up go on the right, beside a job running at the same time. */
  lane: number;
  color: (typeof EMPLOYER_COLORS)[number];
  /** The other jobs running on that date. */
  alongside: EmployerDetail[];
}

const KIND: Record<EventKind, { label: string; icon: string }> = {
  joined: { label: "Joined", icon: mdiRocketLaunchOutline },
  appraisal: { label: "Appraisal", icon: mdiTrendingUp },
  promotion: { label: "Promotion", icon: mdiStarFourPointsOutline },
  restructure: { label: "Restructure", icon: mdiSwapHorizontal },
  left: { label: "Moved on", icon: mdiFlagCheckered },
};

function longDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year!, month! - 1, day!).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/** "2 yrs 5 mos". */
function tenureText(from: string, to: string): string {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  let months = (ty! - fy!) * 12 + (tm! - fm!) - (td! < fd! ? 1 : 0);
  months = Math.max(0, months);
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const parts = [years ? `${years} yr${years === 1 ? "" : "s"}` : "", rest ? `${rest} mo${rest === 1 ? "" : "s"}` : ""].filter(Boolean);
  return parts.join(" ") || "less than a month";
}

function workingOn(employer: Employer, date: string): boolean {
  return employer.joined_on <= date && (employer.left_on === null || employer.left_on >= date);
}

/**
 * Lanes like seats: each job takes the first lane free when it starts. One job at a time stays in lane 0 (left);
 * a second job running alongside takes lane 1 (right).
 */
function assignLanes(employers: EmployerDetail[]): Map<number, number> {
  const ends: (string | null)[] = []; // the leaving date of the job in each lane; null while it runs on
  const lanes = new Map<number, number>();
  for (const employer of [...employers].sort((a, b) => a.joined_on.localeCompare(b.joined_on) || a.id - b.id)) {
    let lane = ends.findIndex((end) => end !== null && end < employer.joined_on);
    if (lane === -1) lane = ends.length;
    ends[lane] = employer.left_on;
    lanes.set(employer.id, lane);
  }
  return lanes;
}

function buildEvents(employers: EmployerDetail[]): TimelineEvent[] {
  const lanes = assignLanes(employers);
  const byJoining = [...employers].sort((a, b) => a.joined_on.localeCompare(b.joined_on) || a.id - b.id);
  const events: TimelineEvent[] = [];
  byJoining.forEach((employer, index) => {
    const color = EMPLOYER_COLORS[index % EMPLOYER_COLORS.length]!;
    const lane = lanes.get(employer.id) ?? 0;
    const alongside = (date: string) => employers.filter((other) => other.id !== employer.id && workingOn(other, date));
    const revisions = [...employer.revisions].sort((a, b) => a.effective_from.localeCompare(b.effective_from));
    revisions.forEach((revision, at) => {
      const kind: EventKind = revision.kind === "joining" ? "joined" : revision.kind;
      const date = revision.kind === "joining" ? employer.joined_on : revision.effective_from;
      events.push({ key: `r${revision.id}`, date, kind, employer, revision, previous: revisions[at - 1] ?? null, lane, color, alongside: alongside(date) });
    });
    if (employer.left_on) {
      events.push({ key: `l${employer.id}`, date: employer.left_on, kind: "left", employer, revision: revisions.at(-1) ?? null, previous: null, lane, color, alongside: alongside(employer.left_on) });
    }
  });
  // Newest first, so the current job is at the top and scrolling down goes back in time. On one day, the
  // joining sits above the leaving (it happened after it).
  return events.sort((a, b) => b.date.localeCompare(a.date) || Number(a.kind === "left") - Number(b.kind === "left"));
}

function EventCard({ event, active }: { event: TimelineEvent; active: boolean }) {
  const { employer, revision, previous, kind } = event;
  const change = revision && previous && previous.yearly.ctc > 0 ? ((revision.yearly.ctc - previous.yearly.ctc) / previous.yearly.ctc) * 100 : null;
  const info = KIND[kind];
  return (
    <Paper
      variant="outlined"
      sx={{
        borderRadius: 3,
        p: 2,
        borderLeftWidth: 4,
        borderLeftColor: `${event.color}.main`,
        boxShadow: active ? 6 : 0,
        transition: "box-shadow 450ms ease",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", mb: 0.75 }}>
        <Chip size="small" icon={<MdiIcon path={info.icon} fontSize="small" />} label={info.label} color={event.color} variant={active ? "filled" : "outlined"} />
        <Typography variant="body2" color="text.secondary">
          {longDate(event.date)}
        </Typography>
      </Box>
      <Typography
        component={RouterLink}
        to={`/salary/employers/${employer.id}`}
        variant="subtitle1"
        sx={{ fontWeight: 700, color: "inherit", textDecoration: "none", "&:hover": { textDecoration: "underline" }, display: "block", overflowWrap: "anywhere" }}
      >
        {employer.name}
      </Typography>
      {revision?.designation_in_effect ? (
        <Typography variant="body2" sx={{ fontWeight: 500 }}>
          {kind === "promotion" && previous?.designation_in_effect && previous.designation_in_effect !== revision.designation_in_effect
            ? `${previous.designation_in_effect} → ${revision.designation_in_effect}`
            : revision.designation_in_effect}
        </Typography>
      ) : null}

      {kind === "left" ? (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          After {tenureText(employer.joined_on, event.date)}
          {revision ? (
            <>
              {" "}
              · last CTC <SalaryAmount value={revision.yearly.ctc} /> a year
            </>
          ) : null}
        </Typography>
      ) : revision ? (
        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mt: 1 }}>
          <Box>
            <Typography variant="caption" color="text.secondary">
              CTC a year
            </Typography>
            <Typography sx={{ fontWeight: 600 }}>
              <SalaryAmount value={revision.yearly.ctc} />
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Take-home a month
            </Typography>
            <Typography sx={{ fontWeight: 600 }}>
              <SalaryAmount value={revision.monthly.net} />
            </Typography>
          </Box>
          {change !== null ? (
            <Box sx={{ alignSelf: "flex-end" }}>
              <Chip size="small" label={`${change >= 0 ? "+" : ""}${change.toFixed(1)}%`} color={change >= 0 ? "success" : "warning"} variant="outlined" />
            </Box>
          ) : null}
        </Box>
      ) : null}

      {revision?.announced_on && revision.announced_on !== event.date && kind !== "left" ? (
        <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 1 }}>
          Announced {longDate(revision.announced_on)}
        </Typography>
      ) : null}
      {event.alongside.length > 0 ? (
        <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.5 }}>
          Alongside {event.alongside.map((other) => other.name).join(", ")}
        </Typography>
      ) : null}
    </Paper>
  );
}

/** Where a card sits across the line: the left side, the right side, or on the line itself. */
type Place = "left" | "right" | "center";

const GAP = 36; // between the line and a card beside it, in px

/**
 * Every employer on one vertical line through time, today at the top and the oldest at the bottom. Each job keeps a side: one job at a time on the
 * left, a second job running alongside on the right. The event in the middle of the screen is the active one; when
 * only one job was running then, it slides onto the line.
 */
export function EmployerTimeline({ employers }: { employers: Employer[] }) {
  const results = useQueries({
    queries: employers.map((employer) => ({ queryKey: [SALARY_KEY, "employer", employer.id], queryFn: () => fetchEmployer(employer.id) })),
  });
  const details = results.map((result) => result.data).filter((detail): detail is EmployerDetail => detail !== undefined);
  const loading = results.some((result) => result.isPending);
  const failed = results.find((result) => result.isError);
  const ready = !loading && details.length === employers.length;

  const detailsKey = details.map((detail) => `${detail.id}:${detail.revisions.map((r) => r.id).join(",")}:${detail.left_on}`).join("|");
  // eslint-disable-next-line react-hooks/exhaustive-deps -- rebuilt when the employers' dates or revisions change
  const events = useMemo(() => (ready ? buildEvents(details) : []), [ready, detailsKey]);
  const lanes = Math.max(1, ...events.map((event) => event.lane + 1));
  const todayIso = toIsoDate(today());
  const currentJobs = employers.filter((employer) => workingOn(employer, todayIso));

  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [active, setActive] = useState(0);
  const [seen, setSeen] = useState(0); // events revealed so far: they fade in as they first come into view

  const measure = useCallback(() => {
    const focus = window.innerHeight * 0.45;
    let best = 0;
    let bestDistance = Infinity;
    let revealed = 0;
    itemRefs.current.forEach((element, index) => {
      if (!element) return;
      const rect = element.getBoundingClientRect();
      const distance = Math.abs(rect.top + rect.height / 2 - focus);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = index;
      }
      if (rect.top < window.innerHeight * 0.92) revealed = index + 1;
    });
    setActive((current) => (current === best ? current : best));
    setSeen((current) => Math.max(current, revealed));
  }, []);

  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    onScroll(); // once the events are laid out, before any scrolling
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [measure, events]);

  if (failed) return <Alert severity="error">Could not load the timeline. {errorMessage(failed.error)}</Alert>;
  if (!ready) {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2, alignItems: "center" }}>
        {[0, 1, 2].map((key) => (
          <Skeleton key={key} variant="rounded" height={150} sx={{ width: { xs: "100%", md: 440 } }} />
        ))}
      </Box>
    );
  }

  const place = (event: TimelineEvent, isActive: boolean): Place => {
    if (isActive && event.alongside.length === 0) return "center";
    return event.lane === 0 ? "left" : "right";
  };
  // The card is laid out centred on the line, then moved to its side, so every move is one smooth transform.
  const shift: Record<Place, string> = {
    left: `translateX(calc(-0.5 * var(--card-w) - ${GAP}px))`,
    right: `translateX(calc(0.5 * var(--card-w) + ${GAP}px))`,
    center: "translateX(0)",
  };

  return (
    <Box
      sx={{
        position: "relative",
        // In container units, so the same width works in margins and in transforms (where % means the card itself).
        containerType: "inline-size",
        "--card-w": "min(440px, calc(50cqw - 56px))",
        pb: 4,
        "@media (prefers-reduced-motion: reduce)": { "& *": { transition: "none !important" } },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap", mb: 3, justifyContent: { md: "center" } }}>
        <Typography variant="body2" color="text.secondary">
          {lanes > 1 ? "Jobs held at the same time sit on either side of the line." : "One job at a time, newest first."} Scroll down to go back through your career.
        </Typography>
      </Box>

      {/* The line through time: down the middle on wide screens, along the left edge on phones. */}
      <Box sx={{ position: "absolute", top: 56, bottom: 0, width: 2, bgcolor: "divider", left: { xs: 15, md: "calc(50% - 1px)" } }} />

      {/* Now. */}
      <Box sx={{ position: "relative", display: "flex", justifyContent: { xs: "flex-start", md: "center" }, pl: { xs: "40px", md: 0 }, pt: 2, pb: 1 }}>
        <Box sx={{ position: "absolute", top: 22, left: { xs: 8, md: "calc(50% - 8px)" }, width: 16, height: 16, borderRadius: "50%", bgcolor: "primary.main", zIndex: 2 }} />
        <Paper variant="outlined" sx={{ borderRadius: 3, px: 2.5, py: 1.5, mt: { md: 5 }, textAlign: { md: "center" }, bgcolor: "background.paper" }}>
          <Typography sx={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 1, justifyContent: { md: "center" } }}>
            <MdiIcon path={mdiBriefcaseOutline} fontSize="small" />
            Today
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {currentJobs.length === 0 ? "No current job" : `Working at ${currentJobs.map((employer) => employer.name).join(" and ")}`}
          </Typography>
        </Paper>
      </Box>

      {events.map((event, index) => {
        const isActive = index === active;
        const where = place(event, isActive);
        const year = event.date.slice(0, 4);
        const showYear = index === 0 || events[index - 1]!.date.slice(0, 4) !== year;
        const visible = index < seen;
        return (
          <Box key={event.key}>
            {showYear ? (
              <Box sx={{ position: "relative", display: "flex", justifyContent: { xs: "flex-start", md: "center" }, my: 2, pl: { xs: 0, md: 0 } }}>
                <Chip label={year} size="small" sx={{ fontWeight: 700, bgcolor: "background.paper", border: 1, borderColor: "divider" }} />
              </Box>
            ) : null}
            <Box
              ref={(element: HTMLDivElement | null) => {
                itemRefs.current[index] = element;
              }}
              sx={{ position: "relative", py: 1.5 }}
            >
              {/* The event's dot on the line. */}
              <Box
                sx={{
                  position: "absolute",
                  top: 30,
                  left: { xs: 9, md: "calc(50% - 7px)" },
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  bgcolor: isActive ? `${event.color}.main` : "background.paper",
                  border: 3,
                  borderColor: `${event.color}.main`,
                  transform: isActive ? "scale(1.35)" : "scale(1)",
                  transition: "transform 450ms ease, background-color 450ms ease",
                  zIndex: 2,
                }}
              />
              <Box
                sx={{
                  ml: { xs: "40px", md: "calc(50% - var(--card-w) / 2)" },
                  width: { xs: "calc(100% - 40px)", md: "var(--card-w)" },
                  transform: { xs: "none", md: shift[where] },
                  opacity: visible ? (isActive ? 1 : 0.62) : 0,
                  translate: visible ? "0 0" : "0 24px",
                  scale: isActive ? "1.02" : "1",
                  transition: "transform 650ms cubic-bezier(0.22, 1, 0.36, 1), opacity 500ms ease, translate 600ms ease, scale 450ms ease",
                  position: "relative",
                  zIndex: isActive ? 3 : 1,
                }}
              >
                <EventCard event={event} active={isActive} />
              </Box>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
