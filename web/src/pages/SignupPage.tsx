import { mdiArrowLeft, mdiArrowRight, mdiCheck, mdiChevronDown } from "@mdi/js";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import Link from "@mui/material/Link";
import Snackbar from "@mui/material/Snackbar";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Fragment, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link as RouterLink } from "react-router-dom";

import { signUp, type Preferences, type ThemeMode } from "@/api/auth";
import { CATEGORY_TYPE_NAMES, fetchPresetCategories, type PresetCategory } from "@/api/categories";
import { ApiError, errorMessage } from "@/api/client";
import { DEFAULT_THEME_COLOR } from "@/appearance/color";
import { DEFAULT_PREFERENCES } from "@/appearance/preferences";
import { useThemeColor } from "@/appearance/ThemeColorProvider";
import { useSetMe } from "@/auth/session";
import { AuthLayout } from "@/components/AuthLayout";
import { CategoryIcon } from "@/components/CategoryIcon";
import { Loading, Spinner } from "@/components/Loading";
import { MdiIcon } from "@/components/MdiIcon";
import { PasswordField } from "@/components/PasswordField";
import { AmountColorField, CurrencyField, FirstDayOfWeekField, ThemeColorField, ThemeModeField } from "@/components/PreferenceFields";
import { StepsBar, type StepItem } from "@/components/StepsBar";

const PASSWORD_MIN = 8;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Step = "basicSetting" | "presetCategories";

const STEPS: StepItem[] = [
  { name: "basicSetting", title: "User Information", subTitle: "Basic Information" },
  { name: "presetCategories", title: "Transaction Categories", subTitle: "Preset Categories" },
];

interface Form {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

const EMPTY: Form = { name: "", email: "", password: "", confirmPassword: "" };

/** The first thing wrong with the first step, said the way ezBookkeeping says it, or null when it is complete. */
function problemWith(form: Form): string | null {
  if (!form.name.trim()) return "Name cannot be blank";
  if (!form.email.trim()) return "E-mail cannot be blank";
  if (!form.password) return "Password cannot be blank";
  if (!form.confirmPassword) return "Password confirmation cannot be blank";
  if (!EMAIL.test(form.email.trim())) return "E-mail address is invalid";
  if (form.password.length < PASSWORD_MIN) return `Password must be at least ${PASSWORD_MIN} characters`;
  if (form.password !== form.confirmPassword) return "Password and password confirmation do not match";
  return null;
}

function StepHeading({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <Typography variant="h5" component="h1" sx={{ mb: 0.5 }}>
        {title}
      </Typography>
      <Typography className="auth-message" variant="body2" component="div" sx={{ my: 1.5 }}>
        {children}
      </Typography>
    </>
  );
}

/** One preset category, opening to show its sub-categories (ezBookkeeping's compacted expansion panel). */
function PresetCategoryPanel({ category }: { category: PresetCategory }) {
  return (
    <Accordion disableGutters square elevation={0} sx={{ "&::before": { display: "none" }, "& + &": { borderTop: 1, borderColor: "divider" } }}>
      <AccordionSummary expandIcon={<MdiIcon path={mdiChevronDown} />} sx={{ minHeight: 44, px: 2, "& .MuiAccordionSummary-content": { my: 1, alignItems: "center", gap: 1.25 } }}>
        <CategoryIcon icon={category.icon} color={category.color} />
        <Typography variant="body2">{category.name}</Typography>
      </AccordionSummary>
      {category.sub_categories.length ? (
        <AccordionDetails sx={{ p: 0, pl: 2.5 }}>
          {category.sub_categories.map((sub, index) => (
            <Fragment key={sub.name}>
              {index > 0 ? <Divider /> : null}
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, px: 2, py: 1.25 }}>
                <CategoryIcon icon={sub.icon} color={sub.color} />
                <Typography variant="body2">{sub.name}</Typography>
              </Box>
            </Fragment>
          ))}
        </AccordionDetails>
      ) : null}
    </Accordion>
  );
}

/** Every preset category, grouped by type, in a scrolling list. Dimmed while the switch is off. */
function PresetCategories({ enabled }: { enabled: boolean }) {
  const presets = useQuery({ queryKey: ["category-presets"], queryFn: fetchPresetCategories, staleTime: Infinity });

  if (presets.isPending) {
    return <Loading size="small" label="Loading categories…" />;
  }
  if (presets.isError) {
    return (
      <Typography variant="body2" color="error" sx={{ py: 2 }}>
        {errorMessage(presets.error)}
      </Typography>
    );
  }

  return (
    <Box
      aria-disabled={!enabled}
      sx={{
        maxHeight: 323,
        overflowY: "auto",
        pr: 0.5,
        opacity: enabled ? 1 : 0.45,
        pointerEvents: enabled ? "auto" : "none",
        transition: "opacity 150ms ease",
      }}
    >
      {presets.data.map((group) => (
        <Box key={group.type} sx={{ "& + &": { mt: 2.5 } }}>
          <Typography variant="body1" sx={{ fontWeight: 500 }}>
            {CATEGORY_TYPE_NAMES[group.type]}
          </Typography>
          <Box sx={{ mt: 1, border: 1, borderColor: "divider", borderRadius: 1.5, overflow: "hidden" }}>
            {group.categories.map((category) => (
              <PresetCategoryPanel key={category.name} category={category} />
            ))}
          </Box>
        </Box>
      ))}
    </Box>
  );
}

export function SignupPage() {
  const setMe = useSetMe();
  const [step, setStep] = useState<Step>("basicSetting");
  const [form, setForm] = useState<Form>(EMPTY);
  const [usePresetCategories, setUsePresetCategories] = useState(false);
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [message, setMessage] = useState<string | null>(null);
  const { setPreview, setModePreview } = useThemeColor();

  // A new account starts with the default colour and mode, so the page shows them to match its fields.
  // Leaving sign-up without an account puts the browser's colour back.
  useEffect(() => {
    setPreview(DEFAULT_THEME_COLOR);
    setModePreview(DEFAULT_PREFERENCES.theme_mode);
    return () => {
      setPreview(null);
      setModePreview(null);
    };
  }, [setPreview, setModePreview]);

  function setPreference<K extends keyof Preferences>(key: K) {
    return (value: Preferences[K]) => setPreferences((current) => ({ ...current, [key]: value }));
  }

  /** The chosen theme colour shows on the page straight away, as on the profile page. */
  function setThemeColor(color: string | null): void {
    setPreference("theme_color")(color);
    setPreview(color ?? DEFAULT_THEME_COLOR);
  }

  function setThemeMode(mode: ThemeMode): void {
    setPreference("theme_mode")(mode);
    setModePreview(mode);
  }
  // A successful sign-up is also a login, and GuestOnly then moves on to the dashboard.
  const register = useMutation({
    mutationFn: signUp,
    onSuccess: setMe,
    onError: (error) => {
      setMessage(errorMessage(error));
      // A problem with a field (such as an email already in use) is fixed on the first step.
      if (error instanceof ApiError && Object.keys(error.fields).length) setStep("basicSetting");
    },
  });
  const fieldErrors = register.error instanceof ApiError ? register.error.fields : {};
  const busy = register.isPending;

  function change(field: keyof Form) {
    return (event: { target: { value: string } }) => setForm((current) => ({ ...current, [field]: event.target.value }));
  }

  /** Move to a step. Leaving the first step needs it complete, as in ezBookkeeping. */
  function goTo(target: string): void {
    if (busy || target === step) return;
    if (target === "presetCategories") {
      const problem = problemWith(form);
      if (problem) {
        setMessage(problem);
        return;
      }
    }
    setStep(target as Step);
  }

  function submit(): void {
    const problem = problemWith(form);
    if (problem) {
      setMessage(problem);
      setStep("basicSetting");
      return;
    }
    register.mutate({
      name: form.name.trim(),
      email: form.email.trim(),
      password: form.password,
      use_preset_categories: usePresetCategories,
      ...preferences,
    });
  }

  /** Enter moves on from the first step and sends the form from the second. */
  function onFormSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (busy) return;
    if (step === "basicSetting") goTo("presetCategories");
    else submit();
  }

  return (
    <AuthLayout variant="signup">
      <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", p: { xs: 3, sm: 5 } }}>
        <Box component="form" noValidate onSubmit={onFormSubmit} sx={{ width: "100%", maxWidth: 640, mt: { xs: 10, md: 0 } }}>
          <StepsBar steps={STEPS} currentStep={step} onStepChange={goTo} />

          <Box sx={{ mt: 3 }}>
            {step === "basicSetting" ? (
              <>
                <StepHeading title="Basic Information">
                  <Box component="span" sx={{ mr: 0.5 }}>
                    Already have an account?
                  </Box>
                  <Link component={RouterLink} to="/login">
                    Click here to log in
                  </Link>
                </StepHeading>

                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2.25, mt: 2.5 }}>
                  <TextField
                    name="name"
                    autoComplete="name"
                    autoFocus
                    label="Name"
                    placeholder="Your name"
                    value={form.name}
                    disabled={busy}
                    error={Boolean(fieldErrors.name)}
                    helperText={fieldErrors.name}
                    onChange={change("name")}
                  />
                  <TextField
                    type="email"
                    name="email"
                    autoComplete="email"
                    label="E-mail"
                    placeholder="Your email address"
                    value={form.email}
                    disabled={busy}
                    error={Boolean(fieldErrors.email)}
                    helperText={fieldErrors.email}
                    onChange={change("email")}
                    slotProps={{ htmlInput: { autoCapitalize: "none", autoCorrect: "off", spellCheck: false } }}
                  />
                  <PasswordField
                    name="password"
                    autoComplete="new-password"
                    label="Password"
                    placeholder={`Your password, at least ${PASSWORD_MIN} characters`}
                    value={form.password}
                    disabled={busy}
                    error={Boolean(fieldErrors.password)}
                    helperText={fieldErrors.password}
                    onChange={change("password")}
                  />
                  <PasswordField
                    name="confirmPassword"
                    autoComplete="new-password"
                    label="Confirm Password"
                    placeholder="Re-enter the password"
                    value={form.confirmPassword}
                    disabled={busy}
                    onChange={change("confirmPassword")}
                  />
                  <CurrencyField value={preferences.default_currency} disabled={busy} onChange={setPreference("default_currency")} />
                  <FirstDayOfWeekField value={preferences.first_day_of_week} disabled={busy} onChange={setPreference("first_day_of_week")} />
                  <AmountColorField
                    label="Expense Amount Color"
                    value={preferences.expense_amount_color}
                    disabled={busy}
                    onChange={setPreference("expense_amount_color")}
                  />
                  <AmountColorField
                    label="Income Amount Color"
                    value={preferences.income_amount_color}
                    disabled={busy}
                    onChange={setPreference("income_amount_color")}
                  />
                  <ThemeModeField value={preferences.theme_mode} disabled={busy} onChange={setThemeMode} />
                  <ThemeColorField value={preferences.theme_color} disabled={busy} onChange={setThemeColor} />
                </Box>
              </>
            ) : (
              <>
                <StepHeading title="Preset Categories">Set whether to use preset transaction categories</StepHeading>
                <FormControlLabel
                  sx={{ mb: 1.5, ml: 0, gap: 1 }}
                  control={<Switch checked={usePresetCategories} disabled={busy} onChange={(event) => setUsePresetCategories(event.target.checked)} />}
                  label={<Typography variant="body2">Use Preset Transaction Categories</Typography>}
                />
                <PresetCategories enabled={usePresetCategories && !busy} />
              </>
            )}
          </Box>

          <Box sx={{ display: "flex", flexWrap: "wrap", justifyContent: { xs: "center", sm: "space-between" }, gap: 2, mt: 3 }}>
            <Button
              disabled={step === "basicSetting" || busy}
              startIcon={<MdiIcon path={mdiArrowLeft} />}
              onClick={() => goTo("basicSetting")}
            >
              Previous
            </Button>
            {step === "basicSetting" ? (
              <Button type="submit" disabled={busy} endIcon={<MdiIcon path={mdiArrowRight} />}>
                Next
              </Button>
            ) : (
              <Button type="submit" disabled={busy} endIcon={busy ? undefined : <MdiIcon path={mdiCheck} />}>
                Submit
                {busy ? <Spinner size={20} style={{ marginLeft: 8 }} /> : null}
              </Button>
            )}
          </Box>
        </Box>
      </Box>

      <Snackbar open={message !== null} message={message} onClose={() => setMessage(null)} />
    </AuthLayout>
  );
}
