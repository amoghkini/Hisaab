import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";

import type { AmountColor, ThemeMode } from "@/api/auth";
import { DEFAULT_THEME_COLOR, PRESET_COLORS } from "@/appearance/color";
import { AMOUNT_COLORS, THEME_MODES, WEEKDAYS, allCurrencies } from "@/appearance/preferences";

/** The form fields for a user's preferences, shared by the sign-up and profile pages. */

interface FieldProps<T> {
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}

function Dot({ color }: { color: string }) {
  return <Box component="span" sx={{ width: 12, height: 12, borderRadius: "50%", bgcolor: color, flex: "none", border: 1, borderColor: "divider" }} />;
}

function DotLabel({ color, label }: { color: string; label: string }) {
  return (
    <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}>
      <Dot color={color} />
      {label}
    </Box>
  );
}

/** Searchable list of every currency, shown as "INR - Indian Rupee". */
export function CurrencyField({ value, onChange, disabled }: FieldProps<string>) {
  const options = allCurrencies();
  const selected = options.find((option) => option.code === value) ?? { code: value, name: value };
  return (
    <Autocomplete
      options={options}
      value={selected}
      disabled={disabled}
      disableClearable
      autoHighlight
      getOptionLabel={(option) => `${option.code} - ${option.name}`}
      isOptionEqualToValue={(option, current) => option.code === current.code}
      onChange={(_, option) => onChange(option.code)}
      renderInput={(params) => <TextField {...params} label="Default Currency" placeholder="Default Currency" />}
    />
  );
}

export function FirstDayOfWeekField({ value, onChange, disabled }: FieldProps<number>) {
  return (
    <TextField select label="First Day of Week" value={value} disabled={disabled} onChange={(event) => onChange(Number(event.target.value))}>
      {WEEKDAYS.map((day, index) => (
        <MenuItem key={day} value={index}>
          {day}
        </MenuItem>
      ))}
    </TextField>
  );
}

export function AmountColorField({ label, value, onChange, disabled }: FieldProps<AmountColor> & { label: string }) {
  return (
    <TextField select label={label} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value as AmountColor)}>
      {AMOUNT_COLORS.map((option) => (
        <MenuItem key={option.value} value={option.value}>
          <DotLabel color={option.css} label={option.name} />
        </MenuItem>
      ))}
    </TextField>
  );
}

const CUSTOM = "custom";

/**
 * The theme colour as a list of the presets. A colour picked elsewhere (the profile page's custom picker) shows
 * as "Custom" and is kept unless another is chosen. Null is the default colour.
 */
export function ThemeColorField({ value, onChange, disabled }: FieldProps<string | null>) {
  const color = value ?? DEFAULT_THEME_COLOR;
  const isPreset = PRESET_COLORS.some((preset) => preset.value === color);
  return (
    <TextField
      select
      label="Theme Color"
      value={isPreset ? color : CUSTOM}
      disabled={disabled}
      onChange={(event) => {
        const picked = event.target.value;
        if (picked !== CUSTOM) onChange(picked === DEFAULT_THEME_COLOR ? null : picked);
      }}
    >
      {PRESET_COLORS.map((preset) => (
        <MenuItem key={preset.value} value={preset.value}>
          <DotLabel color={preset.value} label={preset.value === DEFAULT_THEME_COLOR ? `${preset.name} (Default)` : preset.name} />
        </MenuItem>
      ))}
      {isPreset ? null : (
        <MenuItem value={CUSTOM}>
          <DotLabel color={color} label={`Custom (${color})`} />
        </MenuItem>
      )}
    </TextField>
  );
}

/** Light, dark, or follow the device. */
export function ThemeModeField({ value, onChange, disabled }: FieldProps<ThemeMode>) {
  return (
    <TextField select label="Theme" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value as ThemeMode)}>
      {THEME_MODES.map((option) => (
        <MenuItem key={option.value} value={option.value}>
          {option.value === "system" ? "System (follow device)" : option.name}
        </MenuItem>
      ))}
    </TextField>
  );
}
