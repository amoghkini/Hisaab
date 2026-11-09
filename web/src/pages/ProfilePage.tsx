import { mdiCheck, mdiEyedropperVariant, mdiThemeLightDark, mdiWeatherNight, mdiWhiteBalanceSunny } from "@mdi/js";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import InputAdornment from "@mui/material/InputAdornment";
import Link from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import Snackbar from "@mui/material/Snackbar";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState, type ChangeEvent, type ReactNode } from "react";

import { updateMe, type Preferences, type ThemeMode } from "@/api/auth";
import { errorMessage } from "@/api/client";
import { DEFAULT_THEME_COLOR, PRESET_COLORS, normalizeHex, textOn } from "@/appearance/color";
import { useThemeColor } from "@/appearance/ThemeColorProvider";
import { AmountColorField, CurrencyField, FirstDayOfWeekField } from "@/components/PreferenceFields";
import { useMe, useSetMe } from "@/auth/session";
import { MdiIcon } from "@/components/MdiIcon";

const SWATCH = 32;

function Section({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <Paper variant="outlined" sx={{ borderRadius: 3, mb: 2.5 }}>
      <Box sx={{ px: 3, pt: 2.5, pb: 2 }}>
        <Typography variant="subtitle1" component="h2">
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
      </Box>
      <Divider />
      <Box sx={{ px: 3, py: 2.5 }}>{children}</Box>
    </Paper>
  );
}

function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Box>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body1" sx={{ fontWeight: 500 }}>
        {value}
      </Typography>
    </Box>
  );
}

/** A round colour button; the chosen one shows a tick in a colour that reads on it. */
function Swatch({ name, color, selected, onPick }: { name: string; color: string; selected: boolean; onPick: () => void }) {
  return (
    <Tooltip title={name}>
      <Box
        component="button"
        type="button"
        aria-label={name}
        aria-pressed={selected}
        onClick={onPick}
        sx={{
          width: SWATCH,
          height: SWATCH,
          p: 0,
          display: "grid",
          placeItems: "center",
          cursor: "pointer",
          border: 0,
          borderRadius: "50%",
          bgcolor: color,
          color: textOn(color),
          outline: selected ? `2px solid ${color}` : "none",
          outlineOffset: 2,
          transition: "transform 120ms ease",
          "&:hover": { transform: "scale(1.08)" },
          "&:focus-visible": { outline: "2px solid", outlineColor: "text.primary", outlineOffset: 2 },
        }}
      >
        {selected ? <MdiIcon path={mdiCheck} sx={{ fontSize: 18 }} /> : null}
      </Box>
    </Tooltip>
  );
}

/** Any colour, through the browser's own picker, drawn as a rainbow swatch. */
function CustomSwatch({ color, selected, onPick }: { color: string; selected: boolean; onPick: (color: string) => void }) {
  return (
    <Tooltip title="Custom color">
      <Box
        component="label"
        sx={{
          position: "relative",
          width: SWATCH,
          height: SWATCH,
          display: "grid",
          placeItems: "center",
          cursor: "pointer",
          borderRadius: "50%",
          color: "#fff",
          background: "conic-gradient(#f44336, #ff9800, #ffeb3b, #4caf50, #2196f3, #3f51b5, #9c27b0, #f44336)",
          outline: selected ? `2px solid ${color}` : "none",
          outlineOffset: 2,
          "&:focus-within": { outline: "2px solid", outlineColor: "text.primary", outlineOffset: 2 },
        }}
      >
        <MdiIcon path={selected ? mdiCheck : mdiEyedropperVariant} sx={{ fontSize: 16, filter: "drop-shadow(0 0 1px rgb(0 0 0 / 0.6))" }} />
        <Box
          component="input"
          type="color"
          aria-label="Custom color"
          value={color}
          onChange={(event: ChangeEvent<HTMLInputElement>) => onPick(event.target.value)}
          sx={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%", height: "100%", p: 0, border: 0 }}
        />
      </Box>
    </Tooltip>
  );
}

const MODE_BUTTONS: { value: ThemeMode; label: string; icon: string }[] = [
  { value: "light", label: "Light", icon: mdiWhiteBalanceSunny },
  { value: "dark", label: "Dark", icon: mdiWeatherNight },
  { value: "system", label: "System", icon: mdiThemeLightDark },
];

/** Light or dark, and the theme colour: both preview at once and are saved together. */
function AppearanceSection() {
  const me = useMe();
  const setMe = useSetMe();
  const { setPreview, setModePreview } = useThemeColor();
  const saved = me.data?.theme_color ?? DEFAULT_THEME_COLOR;
  const savedMode: ThemeMode = me.data?.theme_mode ?? "system";
  const [draft, setDraft] = useState(saved);
  const [draftMode, setDraftMode] = useState<ThemeMode>(savedMode);
  const [hexText, setHexText] = useState(saved);
  const [message, setMessage] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: updateMe,
    onSuccess: (user) => {
      setMe(user);
      setPreview(null);
      setModePreview(null);
      setMessage("Appearance saved");
    },
    onError: (error) => setMessage(errorMessage(error)),
  });

  // Leaving the page without saving puts the saved colour and mode back.
  useEffect(
    () => () => {
      setPreview(null);
      setModePreview(null);
    },
    [setPreview, setModePreview],
  );

  function chooseMode(mode: ThemeMode | null): void {
    if (!mode) return; // clicking the selected button again keeps it
    setDraftMode(mode);
    setModePreview(mode === savedMode ? null : mode);
  }

  function choose(color: string): void {
    setDraft(color);
    setHexText(color);
    setPreview(color === saved ? null : color);
  }

  function typeHex(text: string): void {
    setHexText(text);
    const color = normalizeHex(text);
    if (color) {
      setDraft(color);
      setPreview(color === saved ? null : color);
    }
  }

  function resetToDefault(): void {
    choose(DEFAULT_THEME_COLOR);
    chooseMode("system");
  }

  const changed = draft !== saved || draftMode !== savedMode;
  const isPreset = PRESET_COLORS.some((preset) => preset.value === draft);
  const hexInvalid = normalizeHex(hexText) === null;

  return (
    <Section title="Appearance" description="Light or dark, and the main color of buttons, links and highlights. Changes show right away; save to keep them.">
      <Typography variant="body2" sx={{ fontWeight: 500, mb: 1 }}>
        Theme
      </Typography>
      <ToggleButtonGroup exclusive size="small" color="primary" value={draftMode} onChange={(_, mode: ThemeMode | null) => chooseMode(mode)} sx={{ mb: 2.5 }}>
        {MODE_BUTTONS.map((option) => (
          <ToggleButton key={option.value} value={option.value} sx={{ gap: 0.75, px: 1.75, textTransform: "none" }}>
            <MdiIcon path={option.icon} sx={{ fontSize: 18 }} />
            {option.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      <Typography variant="body2" sx={{ fontWeight: 500, mb: 1 }}>
        Theme Color
      </Typography>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, mb: 2.5 }}>
        {PRESET_COLORS.map((preset) => (
          <Swatch key={preset.value} name={preset.name} color={preset.value} selected={draft === preset.value} onPick={() => choose(preset.value)} />
        ))}
        <CustomSwatch color={draft} selected={!isPreset} onPick={choose} />
      </Box>

      <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: 2 }}>
        <TextField
          label="Hex color"
          value={hexText}
          error={hexInvalid}
          helperText={hexInvalid ? "Use six hex digits, like #c67e48" : " "}
          onChange={(event) => typeHex(event.target.value)}
          sx={{ width: 200 }}
          slotProps={{
            htmlInput: { spellCheck: false, maxLength: 7 },
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Box sx={{ width: 16, height: 16, borderRadius: "4px", bgcolor: draft, border: 1, borderColor: "divider" }} />
                </InputAdornment>
              ),
            },
          }}
        />
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, height: 40 }}>
          <Typography variant="body2" color="text.secondary">
            Preview:
          </Typography>
          <Button size="small">Button</Button>
          <Button size="small" variant="outlined">
            Outlined
          </Button>
          <Link component="button" type="button" variant="body2">
            Link
          </Link>
        </Box>
      </Box>

      <Divider sx={{ my: 2 }} />

      <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1 }}>
        <Button
          variant="text"
          color="inherit"
          disabled={(draft === DEFAULT_THEME_COLOR && draftMode === "system") || save.isPending}
          onClick={resetToDefault}
        >
          Reset to Default
        </Button>
        <Button
          disabled={!changed || save.isPending}
          onClick={() => save.mutate({ theme_color: draft === DEFAULT_THEME_COLOR ? null : draft, theme_mode: draftMode })}
        >
          Save
        </Button>
      </Box>

      <Snackbar open={message !== null} message={message} onClose={() => setMessage(null)} />
    </Section>
  );
}

type PreferenceDraft = Omit<Preferences, "theme_color" | "theme_mode">;

/** Currency, week start and amount colours, saved together. */
function PreferencesSection() {
  const me = useMe();
  const setMe = useSetMe();
  const saved: PreferenceDraft = {
    default_currency: me.data?.default_currency ?? "INR",
    first_day_of_week: me.data?.first_day_of_week ?? 0,
    expense_amount_color: me.data?.expense_amount_color ?? "red",
    income_amount_color: me.data?.income_amount_color ?? "green",
  };
  const [draft, setDraft] = useState<PreferenceDraft>(saved);
  const [message, setMessage] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: updateMe,
    onSuccess: (user) => {
      setMe(user);
      setMessage("Preferences saved");
    },
    onError: (error) => setMessage(errorMessage(error)),
  });
  const changed = (Object.keys(saved) as (keyof PreferenceDraft)[]).some((key) => saved[key] !== draft[key]);

  function set<K extends keyof PreferenceDraft>(key: K) {
    return (value: PreferenceDraft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  }

  return (
    <Section title="Preferences" description="Your default currency, the first day of your week, and the colours of amounts.">
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2.25 }}>
        <CurrencyField value={draft.default_currency} disabled={save.isPending} onChange={set("default_currency")} />
        <FirstDayOfWeekField value={draft.first_day_of_week} disabled={save.isPending} onChange={set("first_day_of_week")} />
        <AmountColorField
          label="Expense Amount Color"
          value={draft.expense_amount_color}
          disabled={save.isPending}
          onChange={set("expense_amount_color")}
        />
        <AmountColorField
          label="Income Amount Color"
          value={draft.income_amount_color}
          disabled={save.isPending}
          onChange={set("income_amount_color")}
        />
      </Box>

      <Divider sx={{ my: 2 }} />

      <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1 }}>
        <Button variant="text" color="inherit" disabled={!changed || save.isPending} onClick={() => setDraft(saved)}>
          Cancel
        </Button>
        <Button disabled={!changed || save.isPending} onClick={() => save.mutate(draft)}>
          Save
        </Button>
      </Box>

      <Snackbar open={message !== null} message={message} onClose={() => setMessage(null)} />
    </Section>
  );
}

export function ProfilePage() {
  const me = useMe();
  return (
    <>
      <Box sx={{ mb: 2.5 }}>
        <Typography variant="h5" component="h1">
          Profile
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Your account and how Hisaab looks for you.
        </Typography>
      </Box>

      <Section title="Account" description="The details you signed up with.">
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
          <Fact label="Name" value={me.data?.name} />
          <Fact label="E-mail" value={me.data?.email} />
        </Box>
      </Section>

      <PreferencesSection />

      <AppearanceSection />
    </>
  );
}
