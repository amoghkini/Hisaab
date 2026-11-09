import { mdiEyeOffOutline, mdiEyeOutline } from "@mdi/js";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import TextField, { type TextFieldProps } from "@mui/material/TextField";
import { useState } from "react";

import { MdiIcon } from "@/components/MdiIcon";

/** A password field with an eye button that shows or hides what was typed. */
export function PasswordField(props: Omit<TextFieldProps, "type">) {
  const [visible, setVisible] = useState(false);
  const label = visible ? "Hide password" : "Show password";
  return (
    <TextField
      {...props}
      type={visible ? "text" : "password"}
      slotProps={{
        ...props.slotProps,
        input: {
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                edge="end"
                size="small"
                aria-label={label}
                title={label}
                disabled={props.disabled}
                // Keep the focus (and the cursor position) in the field.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => setVisible((shown) => !shown)}
              >
                <MdiIcon path={visible ? mdiEyeOffOutline : mdiEyeOutline} sx={{ fontSize: 20 }} />
              </IconButton>
            </InputAdornment>
          ),
        },
      }}
    />
  );
}
