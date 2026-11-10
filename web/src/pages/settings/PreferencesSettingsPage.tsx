import { mdiCheck, mdiEyedropperVariant, mdiThemeLightDark, mdiWeatherNight, mdiWhiteBalanceSunny } from "@mdi/js";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import InputAdornment from "@mui/material/InputAdornment";
import Link from "@mui/material/Link";
import MenuItem from "@mui/material/MenuItem";
import Snackbar from "@mui/material/Snackbar";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState, type ChangeEvent } from "react";

import { updateMe, type CurrencyDisplay, type DigitGrouping, type ThemeMode } from "@/api/auth";
import { errorMessage } from "@/api/client";
import { DEFAULT_THEME_COLOR, PRESET_COLORS, normalizeHex, textOn } from "@/appearance/color";
import { useThemeColor } from "@/appearance/ThemeColorProvider";
import { useMe, useSetMe } from "@/auth/session";
import { MdiIcon } from "@/components/MdiIcon";
import { formatAmount, type AmountFormat } from "@/lib/money";
import { SettingRow, SettingsCard, SettingsPageTitle } from "@/pages/settings/SettingsCard";

const SWATCH = 32;

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
function AppearanceCard({ onMessage }: { onMessage: (message: string) => void }) {
  const me = useMe();
  const setMe = useSetMe();
  const { setPreview, setModePreview } = useThemeColor();
  const saved = me.data?.theme_color ?? DEFAULT_THEME_COLOR;
  const savedMode: ThemeMode = me.data?.theme_mode ?? "system";
  const [draft, setDraft] = useState(saved);
  const [draftMode, setDraftMode] = useState<ThemeMode>(savedMode);
  const [hexText, setHexText] = useState(saved);

  const save = useMutation({
    mutationFn: updateMe,
    onSuccess: (user) => {
      setMe(user);
      setPreview(null);
      setModePreview(null);
      onMessage("Appearance saved");
    },
    onError: (error) => onMessage(errorMessage(error)),
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
    <SettingsCard
      title="Appearance"
      description="Light or dark, and the main color of buttons, links and highlights. Changes show right away; save to keep them."
      footer={
        <>
          <Button variant="text" color="inherit" disabled={(draft === DEFAULT_THEME_COLOR && draftMode === "system") || save.isPending} onClick={resetToDefault}>
            Reset to Default
          </Button>
          <Button
            disabled={!changed || save.isPending}
            onClick={() => save.mutate({ theme_color: draft === DEFAULT_THEME_COLOR ? null : draft, theme_mode: draftMode })}
          >
            Save
          </Button>
        </>
      }
    >
      <SettingRow label="Theme" hint="System follows your device's setting.">
        <ToggleButtonGroup exclusive size="small" color="primary" value={draftMode} onChange={(_, mode: ThemeMode | null) => chooseMode(mode)}>
          {MODE_BUTTONS.map((option) => (
            <ToggleButton key={option.value} value={option.value} sx={{ gap: 0.75, px: 1.75, textTransform: "none" }}>
              <MdiIcon path={option.icon} sx={{ fontSize: 18 }} />
              {option.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </SettingRow>

      <SettingRow label="Theme Color">
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5 }}>
          {PRESET_COLORS.map((preset) => (
            <Swatch key={preset.value} name={preset.name} color={preset.value} selected={draft === preset.value} onPick={() => choose(preset.value)} />
          ))}
          <CustomSwatch color={draft} selected={!isPreset} onPick={choose} />
        </Box>
      </SettingRow>

      <SettingRow label="Hex Color" hint="Or type any color.">
        <TextField
          fullWidth
          size="small"
          value={hexText}
          error={hexInvalid}
          helperText={hexInvalid ? "Use six hex digits, like #c67e48" : undefined}
          onChange={(event) => typeHex(event.target.value)}
          slotProps={{
            htmlInput: { spellCheck: false, maxLength: 7, "aria-label": "Hex color" },
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Box sx={{ width: 16, height: 16, borderRadius: "4px", bgcolor: draft, border: 1, borderColor: "divider" }} />
                </InputAdornment>
              ),
            },
          }}
        />
      </SettingRow>

      <SettingRow label="Preview">
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Button size="small">Button</Button>
          <Button size="small" variant="outlined">
            Outlined
          </Button>
          <Link component="button" type="button" variant="body2">
            Link
          </Link>
        </Box>
      </SettingRow>
    </SettingsCard>
  );
}

const DIGIT_GROUPINGS: { value: DigitGrouping; name: string }[] = [
  { value: "indian", name: "Indian (lakhs and crores)" },
  { value: "international", name: "International (thousands and millions)" },
  { value: "none", name: "None" },
];

const CURRENCY_DISPLAYS: { value: CurrencyDisplay; name: string }[] = [
  { value: "symbol", name: "Symbol" },
  { value: "code", name: "Currency code" },
  { value: "none", name: "None" },
];

/** A sample amount: 12,34,567.89 in the default currency. */
const SAMPLE = 123456789;

/** How every amount in the app is written. ezBookkeeping keeps these with the profile; here they sit with the theme. */
function NumberFormatCard({ onMessage }: { onMessage: (message: string) => void }) {
  const me = useMe();
  const setMe = useSetMe();
  const currency = me.data?.default_currency ?? "INR";
  const saved: AmountFormat = { digitGrouping: me.data?.digit_grouping ?? "indian", currencyDisplay: me.data?.currency_display ?? "symbol" };
  const [draft, setDraft] = useState<AmountFormat>(saved);

  const save = useMutation({
    mutationFn: updateMe,
    onSuccess: (user) => {
      setMe(user);
      onMessage("Number format saved");
    },
    onError: (error) => onMessage(errorMessage(error)),
  });
  const changed = draft.digitGrouping !== saved.digitGrouping || draft.currencyDisplay !== saved.currencyDisplay;

  return (
    <SettingsCard
      title="Numbers and Currency"
      description="How amounts are written everywhere in Hisaab."
      footer={
        <>
          <Button variant="text" color="inherit" disabled={!changed || save.isPending} onClick={() => setDraft(saved)}>
            Cancel
          </Button>
          <Button
            disabled={!changed || save.isPending}
            onClick={() => save.mutate({ digit_grouping: draft.digitGrouping, currency_display: draft.currencyDisplay })}
          >
            Save
          </Button>
        </>
      }
    >
      <SettingRow label="Digit Grouping">
        <TextField
          select
          fullWidth
          size="small"
          value={draft.digitGrouping}
          disabled={save.isPending}
          slotProps={{ htmlInput: { "aria-label": "Digit Grouping" } }}
          onChange={(event) => setDraft((current) => ({ ...current, digitGrouping: event.target.value as DigitGrouping }))}
        >
          {DIGIT_GROUPINGS.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.name}
              <Box component="span" sx={{ ml: "auto", pl: 2, color: "text.secondary", fontVariantNumeric: "tabular-nums" }}>
                {formatAmount(SAMPLE, currency, { format: { digitGrouping: option.value, currencyDisplay: "none" } })}
              </Box>
            </MenuItem>
          ))}
        </TextField>
      </SettingRow>
      <SettingRow label="Currency Display" hint="What stands beside an amount.">
        <TextField
          select
          fullWidth
          size="small"
          value={draft.currencyDisplay}
          disabled={save.isPending}
          slotProps={{ htmlInput: { "aria-label": "Currency Display" } }}
          onChange={(event) => setDraft((current) => ({ ...current, currencyDisplay: event.target.value as CurrencyDisplay }))}
        >
          {CURRENCY_DISPLAYS.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.name}
              <Box component="span" sx={{ ml: "auto", pl: 2, color: "text.secondary" }}>
                {formatAmount(100, currency, { format: { digitGrouping: "none", currencyDisplay: option.value } })}
              </Box>
            </MenuItem>
          ))}
        </TextField>
      </SettingRow>
      <SettingRow label="Preview">
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "baseline" }}>
          <Typography sx={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{formatAmount(SAMPLE, currency, { format: draft })}</Typography>
          <Typography variant="body2" color="text.secondary">
            Short: {formatAmount(SAMPLE, currency, { format: draft, compact: true })}
          </Typography>
        </Box>
      </SettingRow>
    </SettingsCard>
  );
}

/** ezBookkeeping's "Preferences" page: how the app looks for you. */
export function PreferencesSettingsPage() {
  const [message, setMessage] = useState<string | null>(null);
  return (
    <>
      <SettingsPageTitle title="Preferences" description="How Hisaab looks for you, and how it writes amounts." />
      <AppearanceCard onMessage={setMessage} />
      <NumberFormatCard onMessage={setMessage} />
      <Snackbar open={message !== null} autoHideDuration={4000} message={message} onClose={() => setMessage(null)} />
    </>
  );
}
