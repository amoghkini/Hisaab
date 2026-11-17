import { mdiArrowLeft } from "@mdi/js";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link as RouterLink, useNavigate, useSearchParams } from "react-router-dom";

import { ApiError, errorMessage } from "@/api/client";
import { createPayslip } from "@/api/salary";
import { MdiIcon } from "@/components/MdiIcon";
import { toIsoDate, today } from "@/lib/dates";
import { storePayslip, useEmployers } from "@/pages/salary/queries";

/**
 * Add a month's payslip by hand, such as one paid before the employer was added to Hisaab. It starts as a draft,
 * filled in like the ones made on pay day.
 */
export function AddPayslipPage() {
  const [params] = useSearchParams();
  const employers = useEmployers();
  const navigate = useNavigate();
  const client = useQueryClient();
  const [chosen, setChosen] = useState<number | "">(params.get("employer") ? Number(params.get("employer")) : "");
  const [month, setMonth] = useState(toIsoDate(today()).slice(0, 7));
  const [error, setError] = useState<ApiError | null>(null);

  const list = employers.data ?? [];
  const employerId = chosen === "" ? (list.length === 1 ? list[0]!.id : "") : chosen;
  const employer = list.find((each) => each.id === employerId);

  const create = useMutation({
    mutationFn: () => createPayslip({ employer_id: employerId as number, pay_month: `${month}-01` }),
    onSuccess: async (payslip) => {
      await storePayslip(client, payslip, payslip.id);
      navigate(`/salary/payslips/${payslip.id}`);
    },
    onError: (failure) => setError(failure instanceof ApiError ? failure : new ApiError(0, "error", errorMessage(failure))),
  });

  return (
    <>
      <Button variant="text" color="inherit" startIcon={<MdiIcon path={mdiArrowLeft} />} component={RouterLink} to="/salary/payslips" sx={{ mb: 1.5 }}>
        Payslips
      </Button>
      <Typography variant="h5" component="h1">
        Add a payslip
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
        Choose the employer and the month the salary was paid in. The payslip starts from your salary structure, or from your last approved payslip; you can change every amount before approving it.
      </Typography>

      {employers.data?.length === 0 ? (
        <Alert severity="info">
          Add an employer first, on <RouterLink to="/salary/employers">Employers and salary structure</RouterLink>.
        </Alert>
      ) : (
        <Paper variant="outlined" sx={{ borderRadius: 3, p: { xs: 2, sm: 3 } }}>
          <Box
            component="form"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              if (employerId !== "" && month) create.mutate();
            }}
            sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(0, 1fr) minmax(0, 1fr) auto" }, gap: 2, alignItems: "start" }}
          >
            <TextField
              select
              label="Employer"
              value={employerId}
              disabled={create.isPending || employers.isPending}
              onChange={(event) => {
                setChosen(Number(event.target.value));
                setError(null);
              }}
            >
              {list.map((each) => (
                <MenuItem key={each.id} value={each.id}>
                  {each.name}
                  {each.is_current ? "" : " (past)"}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Paid in"
              type="month"
              value={month}
              disabled={create.isPending}
              error={Boolean(error?.fields.pay_month)}
              helperText={error?.fields.pay_month ?? (employer ? `Pay day: ${employer.pay_day === 31 ? "the last day" : `day ${employer.pay_day}`} of the month` : " ")}
              onChange={(event) => {
                setMonth(event.target.value);
                setError(null);
              }}
              slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: employer?.joined_on.slice(0, 7), max: employer?.left_on?.slice(0, 7) } }}
            />
            <Button type="submit" size="large" disabled={employerId === "" || !month || create.isPending} sx={{ mt: { md: 0.5 } }}>
              Start payslip
            </Button>
          </Box>
          {error && !error.fields.pay_month ? (
            <Alert severity="error" sx={{ mt: 2 }}>
              {errorMessage(error)}
            </Alert>
          ) : null}
        </Paper>
      )}
    </>
  );
}
