import SvgIcon, { type SvgIconProps } from "@mui/material/SvgIcon";

/** A Material Design Icons path from @mdi/js, drawn as an MUI icon (ezBookkeeping uses the same icon set). */
export function MdiIcon({ path, ...props }: SvgIconProps & { path: string }) {
  return (
    <SvgIcon {...props}>
      <path d={path} />
    </SvgIcon>
  );
}
