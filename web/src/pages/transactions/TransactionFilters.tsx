import { mdiCheck, mdiMenuDown, mdiVectorArrangeBelow, mdiViewGridOutline } from "@mdi/js";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ButtonBase from "@mui/material/ButtonBase";
import Checkbox from "@mui/material/Checkbox";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListSubheader from "@mui/material/ListSubheader";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useState, type ReactNode } from "react";

import { MdiIcon } from "@/components/MdiIcon";
import { amountInputText, formatAmount, parseAmount } from "@/lib/money";

/** A column heading that opens a menu of filters, like ezBookkeeping's table headings. */
export function HeaderFilter({
  label,
  active,
  children,
}: {
  label: string;
  /** A filter is set: the heading is coloured. */
  active: boolean;
  children: (close: () => void) => ReactNode;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const close = () => setAnchor(null);
  return (
    <>
      <ButtonBase
        onClick={(event) => setAnchor(event.currentTarget)}
        aria-haspopup="menu"
        sx={{ font: "inherit", fontWeight: 600, color: active ? "primary.main" : "inherit", borderRadius: 1, px: 0.5, mx: -0.5 }}
      >
        {label}
        <MdiIcon path={mdiMenuDown} sx={{ fontSize: 20 }} />
      </ButtonBase>
      <Menu anchorEl={anchor} open={anchor !== null} onClose={close} slotProps={{ paper: { sx: { maxHeight: 480, minWidth: 220 } } }}>
        {children(close)}
      </Menu>
    </>
  );
}

/** One menu row, ticked when chosen. */
export function FilterItem({ selected, icon, indent = false, onClick, children }: { selected: boolean; icon?: ReactNode; indent?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <MenuItem selected={selected} onClick={onClick} dense sx={{ pl: indent ? 4 : 2 }}>
      {icon ? <ListItemIcon>{icon}</ListItemIcon> : null}
      <Box component="span" sx={{ flex: 1 }}>
        {children}
      </Box>
      {selected ? <MdiIcon path={mdiCheck} fontSize="small" sx={{ ml: 2, color: "primary.main" }} /> : null}
    </MenuItem>
  );
}

export function AllItem({ selected, onClick }: { selected: boolean; onClick: () => void }) {
  return (
    <FilterItem selected={selected} icon={<MdiIcon path={mdiViewGridOutline} fontSize="small" />} onClick={onClick}>
      All
    </FilterItem>
  );
}

export function MultipleItem({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <FilterItem selected={selected} icon={<MdiIcon path={mdiVectorArrangeBelow} fontSize="small" />} onClick={onClick}>
      {label}
    </FilterItem>
  );
}

export interface ChoiceGroup {
  label: string;
  items: { id: number; name: string; icon?: ReactNode; indent?: boolean }[];
}

/** Tick several accounts or categories at once. */
export function MultiSelectDialog({
  open,
  title,
  groups,
  selected,
  onApply,
  onClose,
}: {
  open: boolean;
  title: string;
  groups: ChoiceGroup[];
  selected: number[];
  onApply: (ids: number[]) => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      {/* Remounted on each open, so the ticks start from the current filter. */}
      {open ? <MultiSelectBody title={title} groups={groups} selected={selected} onApply={onApply} onClose={onClose} /> : null}
    </Dialog>
  );
}

function MultiSelectBody({ title, groups, selected, onApply, onClose }: Omit<Parameters<typeof MultiSelectDialog>[0], "open">) {
  const [ticked, setTicked] = useState(() => new Set(selected));
  const toggle = (id: number) =>
    setTicked((was) => {
      const next = new Set(was);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent dividers sx={{ px: 1, py: 0 }}>
        {groups.map((group) => (
          <Box key={group.label}>
            <ListSubheader disableSticky sx={{ lineHeight: "36px" }}>
              {group.label}
            </ListSubheader>
            {group.items.map((item) => (
              <FormControlLabel
                key={item.id}
                sx={{ display: "flex", mx: 0, pl: item.indent ? 4 : 1 }}
                control={<Checkbox size="small" checked={ticked.has(item.id)} onChange={() => toggle(item.id)} />}
                label={
                  <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}>
                    {item.icon}
                    {item.name}
                  </Box>
                }
              />
            ))}
          </Box>
        ))}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button variant="text" color="inherit" onClick={() => setTicked(new Set())} sx={{ mr: "auto" }}>
          Clear
        </Button>
        <Button variant="text" color="inherit" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={() => onApply([...ticked])}>Apply</Button>
      </DialogActions>
    </>
  );
}

type AmountOp = "gt" | "lt" | "eq" | "ne" | "bt" | "nb";

const AMOUNT_OPS: { value: AmountOp; name: string; two: boolean }[] = [
  { value: "gt", name: "Greater than", two: false },
  { value: "lt", name: "Less than", two: false },
  { value: "eq", name: "Equal to", two: false },
  { value: "ne", name: "Not equal to", two: false },
  { value: "bt", name: "Between", two: true },
  { value: "nb", name: "Not between", two: true },
];

/** "gt:50000" and the like, as the API takes it; undefined when the text is not one. */
export function parseAmountFilter(text: string | null): { op: AmountOp; values: number[] } | undefined {
  const match = /^(gt|lt|eq|ne|bt|nb):(\d{1,16})(?::(\d{1,16}))?$/.exec(text ?? "");
  if (!match) return undefined;
  const op = match[1] as AmountOp;
  const two = AMOUNT_OPS.find((each) => each.value === op)!.two;
  if (two !== (match[3] !== undefined)) return undefined;
  return { op, values: [Number(match[2]), ...(match[3] ? [Number(match[3])] : [])] };
}

/** "> ₹500.00", for the heading's tooltip and the filter chips. */
export function amountFilterLabel(text: string, currency: string): string {
  const filter = parseAmountFilter(text);
  if (!filter) return "";
  const [a = 0, b = 0] = filter.values.map((value) => formatAmount(value, currency));
  const symbol = { gt: ">", lt: "<", eq: "=", ne: "≠" } as const;
  if (filter.op === "bt") return `${a} – ${b}`;
  if (filter.op === "nb") return `not ${a} – ${b}`;
  return `${symbol[filter.op]} ${a}`;
}

/** The amount column's menu: no filter, or a comparison with one or two amounts. */
export function AmountFilterMenu({ value, currency, onChange, close }: { value: string | undefined; currency: string; onChange: (value: string | undefined) => void; close: () => void }) {
  const current = parseAmountFilter(value ?? null);
  const [op, setOp] = useState<AmountOp | null>(current?.op ?? null);
  const [first, setFirst] = useState(current?.values[0] !== undefined ? amountInputText(current.values[0], currency) : "");
  const [second, setSecond] = useState(current?.values[1] !== undefined ? amountInputText(current.values[1], currency) : "");
  const chosen = AMOUNT_OPS.find((each) => each.value === op);
  const a = parseAmount(first, currency);
  const b = parseAmount(second, currency);
  const valid = chosen !== undefined && a !== null && a >= 0 && (!chosen.two || (b !== null && b >= 0));

  const apply = () => {
    if (!valid || !chosen) return;
    onChange(chosen.two ? `${chosen.value}:${a}:${b}` : `${chosen.value}:${a}`);
    close();
  };

  return (
    <Box sx={{ minWidth: 260 }}>
      <AllItem
        selected={!current}
        onClick={() => {
          onChange(undefined);
          close();
        }}
      />
      <Divider />
      {AMOUNT_OPS.map((each) => (
        <Box key={each.value}>
          <FilterItem selected={current?.op === each.value} onClick={() => setOp(each.value)}>
            {each.name}
          </FilterItem>
          {op === each.value ? (
            <Box
              component="form"
              onSubmit={(event) => {
                event.preventDefault();
                apply();
              }}
              onKeyDown={(event) => event.stopPropagation()}
              sx={{ display: "flex", alignItems: "center", gap: 1, px: 2, pb: 1.5 }}
            >
              <TextField size="small" autoFocus placeholder="0" value={first} onChange={(event) => setFirst(event.target.value)} slotProps={{ htmlInput: { inputMode: "decimal", "aria-label": "Amount" } }} sx={{ width: 100 }} />
              {each.two ? (
                <>
                  <Typography variant="body2">–</Typography>
                  <TextField size="small" placeholder="0" value={second} onChange={(event) => setSecond(event.target.value)} slotProps={{ htmlInput: { inputMode: "decimal", "aria-label": "Second amount" } }} sx={{ width: 100 }} />
                </>
              ) : null}
              <Button type="submit" size="small" variant="contained" disabled={!valid}>
                Apply
              </Button>
            </Box>
          ) : null}
        </Box>
      ))}
    </Box>
  );
}
