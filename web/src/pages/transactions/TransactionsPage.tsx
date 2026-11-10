import {
  mdiArrowRight,
  mdiBankTransfer,
  mdiCalendarMonthOutline,
  mdiCalendarRange,
  mdiChevronLeft,
  mdiChevronRight,
  mdiClose,
  mdiDownload,
  mdiFormatListBulleted,
  mdiMagnify,
  mdiPlus,
  mdiReceiptTextOutline,
  mdiRefresh,
} from "@mdi/js";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import LinearProgress from "@mui/material/LinearProgress";
import ListSubheader from "@mui/material/ListSubheader";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Pagination from "@mui/material/Pagination";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import Snackbar from "@mui/material/Snackbar";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";

import { ACCOUNT_CATEGORIES, type Account } from "@/api/accounts";
import type { Category } from "@/api/categories";
import { errorMessage } from "@/api/client";
import { TRANSACTION_TYPES, fetchTransactions, type Transaction, type TransactionFilters, type TransactionType } from "@/api/transactions";
import { usePrivacyMode } from "@/appearance/PrivacyMode";
import { useMe } from "@/auth/session";
import { AccountIcon } from "@/components/AccountIcon";
import { CategoryIcon } from "@/components/CategoryIcon";
import { MdiIcon } from "@/components/MdiIcon";
import { endOfMonth, parseIsoDate, startOfMonth, toIsoDate } from "@/lib/dates";
import { HIDDEN_AMOUNT, formatAmount } from "@/lib/money";
import { useAccounts } from "@/pages/accounts/queries";
import {
  DATE_RANGE_PRESETS,
  MAX_RANGE_DAYS,
  daysIn,
  isIsoDate,
  matchingPreset,
  presetSpan,
  recentMonths,
  shiftSpan,
  spanLabel,
  type DateSpan,
} from "@/pages/transactions/dateRanges";
import { exportTransactions } from "@/pages/transactions/exportTransactions";
import { TransactionCalendar } from "@/pages/transactions/TransactionCalendar";
import { TransactionDialog, type TransactionDialogTarget } from "@/pages/transactions/TransactionDialog";
import {
  AllItem,
  AmountFilterMenu,
  FilterItem,
  HeaderFilter,
  MultiSelectDialog,
  MultipleItem,
  amountFilterLabel,
  parseAmountFilter,
  type ChoiceGroup,
} from "@/pages/transactions/TransactionFilters";
import { categoriesById, useCategories, useDailyTotals, useTransactions } from "@/pages/transactions/queries";

const DAY_FORMAT = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" });
const WEEKDAY_FORMAT = new Intl.DateTimeFormat(undefined, { weekday: "short" });
const PAGE_SIZES = [15, 25, 50, 100, 200];
const DEFAULT_PAGE_SIZE = 50;

type View = "list" | "calendar";

function useMoney() {
  const { hidden } = usePrivacyMode();
  return (minor: number, currency: string) => (hidden ? HIDDEN_AMOUNT : formatAmount(minor, currency));
}

const TYPE_COLORS: Record<TransactionType, string> = {
  expense: "var(--hk-expense-color)",
  income: "var(--hk-income-color)",
  transfer: "text.primary",
};

/** The amount as the list shows it: expenses with a minus, income with a plus, transfers plain. */
function signedAmount(money: (minor: number, currency: string) => string, transaction: Transaction, currency: string): string {
  const text = money(transaction.amount, currency);
  if (text === HIDDEN_AMOUNT) return text;
  return transaction.type === "expense" ? `−${text}` : transaction.type === "income" ? `+${text}` : text;
}

function ids(values: string[]): number[] {
  return values.map(Number).filter((value) => Number.isInteger(value) && value > 0);
}

function Figure({ label, value, color }: { label: string; value: ReactNode; color?: string }) {
  return (
    <Box sx={{ minWidth: 0, textAlign: { sm: "end" } }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography sx={{ fontSize: "1.125rem", fontWeight: 500, color, whiteSpace: "nowrap" }}>{value}</Typography>
    </Box>
  );
}

/** A sidebar link: a date range, a recent month. */
function NavItem({ selected, disabled, onClick, children }: { selected: boolean; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-current={selected ? "true" : undefined}
      sx={{
        display: "block",
        width: { xs: "auto", md: "100%" },
        flex: { xs: "none", md: "initial" },
        px: 1.5,
        py: 0.75,
        border: 0,
        borderRadius: 1.5,
        cursor: "pointer",
        textAlign: "start",
        whiteSpace: "nowrap",
        font: "inherit",
        fontSize: "0.875rem",
        fontWeight: selected ? 600 : 400,
        color: selected ? "primary.main" : "text.primary",
        bgcolor: selected ? "rgb(var(--mui-palette-primary-mainChannel) / 0.1)" : "transparent",
        "&:hover": { bgcolor: selected ? "rgb(var(--mui-palette-primary-mainChannel) / 0.14)" : "action.hover" },
        "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main" },
        "&:disabled": { opacity: 0.5, cursor: "default" },
      }}
    >
      {children}
    </Box>
  );
}

function SidebarLabel({ children }: { children: ReactNode }) {
  return (
    <Typography variant="body2" color="text.secondary" sx={{ px: 1.5, mb: 0.75 }}>
      {children}
    </Typography>
  );
}

/** Pick any start and end date, up to the most days one list can show. */
function CustomRangeDialog({ open, initial, onApply, onClose }: { open: boolean; initial: DateSpan; onApply: (range: DateSpan) => void; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      {/* Remounted on each open, so it starts from the range on screen. */}
      {open ? <CustomRangeBody initial={initial} onApply={onApply} onClose={onClose} /> : null}
    </Dialog>
  );
}

function CustomRangeBody({ initial, onApply, onClose }: { initial: DateSpan; onApply: (range: DateSpan) => void; onClose: () => void }) {
  const [start, setStart] = useState(initial.start);
  const [end, setEnd] = useState(initial.end);
  const valid = isIsoDate(start) && isIsoDate(end) && start <= end;
  const tooLong = valid && daysIn({ start, end }) > MAX_RANGE_DAYS;

  return (
    <>
      <DialogTitle>Custom date range</DialogTitle>
      <DialogContent>
        <Box sx={{ display: "flex", gap: 2, pt: 1 }}>
          <TextField label="From" type="date" value={start} onChange={(event) => setStart(event.target.value)} fullWidth slotProps={{ inputLabel: { shrink: true } }} />
          <TextField label="To" type="date" value={end} onChange={(event) => setEnd(event.target.value)} fullWidth slotProps={{ inputLabel: { shrink: true } }} />
        </Box>
        {valid && !tooLong ? null : (
          <Typography variant="body2" color="error" sx={{ mt: 1.5 }}>
            {tooLong ? `Choose at most ${MAX_RANGE_DAYS} days.` : "The end date must not be before the start date."}
          </Typography>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button variant="text" color="inherit" onClick={onClose}>
          Cancel
        </Button>
        <Button disabled={!valid || tooLong} onClick={() => onApply({ start, end })}>
          Apply
        </Button>
      </DialogActions>
    </>
  );
}

/** One transaction as a table row: time, category, amount, account, description. Like ezBookkeeping's table. */
function TransactionRow({
  transaction,
  accounts,
  categories,
  onOpen,
}: {
  transaction: Transaction;
  accounts: Map<number, Account>;
  categories: Map<number, Category>;
  onOpen: () => void;
}) {
  const money = useMoney();
  const category = transaction.category_id === null ? undefined : categories.get(transaction.category_id);
  const parent = category?.parent_id ? categories.get(category.parent_id) : undefined;
  const account = accounts.get(transaction.account_id);
  const toAccount = transaction.to_account_id === null ? undefined : accounts.get(transaction.to_account_id);
  const currency = account?.currency ?? "INR";
  const crossCurrency = transaction.type === "transfer" && toAccount && toAccount.currency !== currency;

  return (
    <TableRow
      hover
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
      sx={{ cursor: "pointer", "& td": { py: 1.25 }, "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: -2 } }}
    >
      <TableCell sx={{ color: "text.secondary", whiteSpace: "nowrap" }}>{transaction.occurred_at.slice(11, 16)}</TableCell>
      <TableCell>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, minWidth: 0 }}>
          {category ? <CategoryIcon icon={category.icon} color={category.color} size={22} /> : <MdiIcon path={mdiBankTransfer} sx={{ fontSize: 22 }} />}
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {category?.name ?? (transaction.type === "transfer" ? "Transfer" : "No category")}
            </Typography>
            {parent ? (
              <Typography variant="caption" color="text.secondary">
                {parent.name}
              </Typography>
            ) : null}
          </Box>
        </Box>
      </TableCell>
      <TableCell sx={{ whiteSpace: "nowrap" }}>
        <Typography variant="body2" sx={{ fontWeight: 600, color: TYPE_COLORS[transaction.type] }}>
          {signedAmount(money, transaction, currency)}
        </Typography>
        {crossCurrency && transaction.to_amount !== null ? (
          <Typography variant="caption" color="text.secondary">
            → {money(transaction.to_amount, toAccount.currency)}
          </Typography>
        ) : null}
      </TableCell>
      <TableCell>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, color: "text.secondary", fontSize: "0.875rem", whiteSpace: "nowrap" }}>
          {account?.name ?? "Unknown account"}
          {toAccount ? (
            <>
              <MdiIcon path={mdiArrowRight} sx={{ fontSize: 15 }} />
              {toAccount.name}
            </>
          ) : null}
        </Box>
      </TableCell>
      <TableCell sx={{ color: "text.secondary", maxWidth: 360, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{transaction.comment}</TableCell>
    </TableRow>
  );
}

/**
 * The transaction list, like ezBookkeeping's: a sidebar of views, types and date ranges; a table whose headings
 * filter by date, category, amount and account; a calendar view; paging; and export.
 */
export function TransactionsPage() {
  const me = useMe();
  const money = useMoney();
  const accounts = useAccounts();
  const categories = useCategories();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get("q") ?? "");
  const [dialog, setDialog] = useState<TransactionDialogTarget | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [multiOpen, setMultiOpen] = useState<"account" | "category" | null>(null);
  const [exportAnchor, setExportAnchor] = useState<HTMLElement | null>(null);
  const [exporting, setExporting] = useState(false);
  const currency = me.data?.default_currency ?? "INR";
  const firstDayOfWeek = me.data?.first_day_of_week ?? 0;

  // Every filter lives in the address, so a link (such as an account's "Transactions" button) can open a view.
  const view: View = params.get("view") === "calendar" ? "calendar" : "list";
  const thisMonth = presetSpan("this_month", firstDayOfWeek);
  const from = params.get("from");
  const to = params.get("to");
  const chosenRange: DateSpan = isIsoDate(from) && isIsoDate(to) && from <= to && daysIn({ start: from, end: to }) <= MAX_RANGE_DAYS ? { start: from, end: to } : thisMonth;
  // The calendar shows the whole month the range starts in.
  const calendarMonth = parseIsoDate(chosenRange.start);
  const range: DateSpan = view === "calendar" ? { start: toIsoDate(startOfMonth(calendarMonth)), end: toIsoDate(endOfMonth(calendarMonth)) } : chosenRange;
  const preset = matchingPreset(range, firstDayOfWeek);
  const types = TRANSACTION_TYPES.map((option) => option.value).filter((value) => params.getAll("type").includes(value));
  const accountIds = ids(params.getAll("account"));
  const categoryIds = ids(params.getAll("category"));
  const query = params.get("q") ?? "";
  const amount = parseAmountFilter(params.get("amount")) ? params.get("amount")! : undefined;
  const pageSize = PAGE_SIZES.includes(Number(params.get("per"))) ? Number(params.get("per")) : DEFAULT_PAGE_SIZE;
  const page = Math.max(1, Number(params.get("page")) || 1);

  /** Change some filters; any change but the page goes back to page one. */
  function update(changes: Record<string, string | string[] | undefined>): void {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        for (const [key, value] of Object.entries(changes)) {
          next.delete(key);
          for (const each of Array.isArray(value) ? value : value ? [value] : []) next.append(key, each);
        }
        if (!("page" in changes)) next.delete("page");
        return next;
      },
      { replace: true },
    );
  }
  const setRange = (next: DateSpan) => update({ from: next.start, to: next.end });

  // Search as the person types, after a short pause.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (search.trim() !== query) update({ q: search.trim() || undefined });
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the text matters
  }, [search]);

  const baseFilters: TransactionFilters = {
    start: range.start,
    end: range.end,
    types: types.length > 0 ? types : undefined,
    account_ids: accountIds.length > 0 ? accountIds : undefined,
    category_ids: categoryIds.length > 0 ? categoryIds : undefined,
    q: query || undefined,
    amount,
  };
  const filters: TransactionFilters = view === "list" ? { ...baseFilters, limit: pageSize, offset: (page - 1) * pageSize } : baseFilters;
  const transactions = useTransactions(filters);
  const dailyTotals = useDailyTotals(baseFilters, view === "list");
  const totalsByDay = useMemo(() => new Map((dailyTotals.data?.days ?? []).map((total) => [total.day, total])), [dailyTotals.data]);

  const allAccounts = useMemo(() => accounts.data ?? [], [accounts.data]);
  const accountsById = useMemo(() => new Map(allAccounts.map((account) => [account.id, account])), [allAccounts]);
  const categoryMap = useMemo(() => categoriesById(categories.data), [categories.data]);
  const data = transactions.data;
  const pageCount = data ? Math.max(1, Math.ceil(data.total_count / pageSize)) : 1;
  const filtered = Boolean(types.length || accountIds.length || categoryIds.length || query || amount);
  const ready = accounts.isSuccess;

  // A page past the end (after deleting, or a narrower filter) shows the last one instead.
  useEffect(() => {
    if (view === "list" && data && page > pageCount) update({ page: pageCount > 1 ? String(pageCount) : undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the count changes
  }, [data?.total_count, page, pageCount, view]);

  const topCategories = (categories.data ?? []).filter((top) => types.length === 0 || types.includes(top.type));

  const accountGroups: ChoiceGroup[] = ACCOUNT_CATEGORIES.flatMap((info) => {
    const items = allAccounts.filter((account) => account.category === info.value && (!account.hidden || accountIds.includes(account.id)));
    return items.length === 0
      ? []
      : [{ label: info.name, items: items.map((account) => ({ id: account.id, name: account.name, icon: <AccountIcon icon={account.icon} color={account.color} size={18} /> })) }];
  });
  const categoryGroups: ChoiceGroup[] = TRANSACTION_TYPES.filter((option) => types.length === 0 || types.includes(option.value)).flatMap((option) => {
    const tops = topCategories.filter((top) => top.type === option.value);
    if (tops.length === 0) return [];
    return [
      {
        label: option.name,
        items: tops.flatMap((top) => [
          { id: top.id, name: top.name, icon: <CategoryIcon icon={top.icon} color={top.color} size={18} /> },
          ...top.sub_categories
            .filter((sub) => !sub.hidden || categoryIds.includes(sub.id))
            .map((sub) => ({ id: sub.id, name: sub.name, icon: <CategoryIcon icon={sub.icon} color={sub.color} size={18} />, indent: true })),
        ]),
      },
    ];
  });

  // What is filtered, as chips that can be removed one at a time.
  const chips: { key: string; label: string; onDelete: () => void }[] = [
    ...accountIds.map((id) => ({
      key: `account-${id}`,
      label: accountsById.get(id)?.name ?? "Unknown account",
      onDelete: () => update({ account: accountIds.filter((other) => other !== id).map(String) }),
    })),
    ...categoryIds.map((id) => ({
      key: `category-${id}`,
      label: categoryMap.get(id)?.name ?? "Unknown category",
      onDelete: () => update({ category: categoryIds.filter((other) => other !== id).map(String) }),
    })),
    ...(amount ? [{ key: "amount", label: `Amount ${amountFilterLabel(amount, currency)}`, onDelete: () => update({ amount: undefined }) }] : []),
    ...(query ? [{ key: "q", label: `“${query}”`, onDelete: () => setSearch("") }] : []),
  ];

  function clearFilters(): void {
    setSearch("");
    update({ type: undefined, account: undefined, category: undefined, q: undefined, amount: undefined });
  }

  async function runExport(format: "csv" | "tsv"): Promise<void> {
    setExportAnchor(null);
    setExporting(true);
    try {
      // Every match, not just this page.
      const all = await fetchTransactions(baseFilters);
      exportTransactions(all.items, accountsById, categoryMap, format, `hisaab-transactions-${range.start}-to-${range.end}`);
      setMessage(`Exported ${all.items.length} transaction${all.items.length === 1 ? "" : "s"}`);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setExporting(false);
    }
  }

  const rows: ReactNode[] = [];
  (data?.items ?? []).forEach((item, index, items) => {
    const day = item.occurred_at.slice(0, 10);
    if (index === 0 || items[index - 1]!.occurred_at.slice(0, 10) !== day) {
      const date = parseIsoDate(day);
      const dayTotal = totalsByDay.get(day);
      rows.push(
        <TableRow key={`day-${day}`}>
          <TableCell colSpan={5} sx={{ bgcolor: "action.hover", py: 0.75 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {DAY_FORMAT.format(date)}
              </Typography>
              <Chip size="small" label={WEEKDAY_FORMAT.format(date)} sx={{ height: 20, fontSize: "0.75rem" }} />
              <Box sx={{ flex: 1 }} />
              {/* The whole day's totals, even when the day carries on to another page. */}
              {dayTotal ? (
                <>
                  {dayTotal.count > 0 ? (
                    <Typography variant="caption" color="text.secondary">
                      {dayTotal.count} {dayTotal.count === 1 ? "item" : "items"}
                    </Typography>
                  ) : null}
                  {dayTotal.income > 0 ? (
                    <Typography variant="body2" sx={{ color: "var(--hk-income-color)", fontWeight: 500 }}>
                      +{money(dayTotal.income, dailyTotals.data?.currency ?? currency)}
                    </Typography>
                  ) : null}
                  {dayTotal.expense > 0 ? (
                    <Typography variant="body2" sx={{ color: "var(--hk-expense-color)", fontWeight: 500 }}>
                      −{money(dayTotal.expense, dailyTotals.data?.currency ?? currency)}
                    </Typography>
                  ) : null}
                </>
              ) : dailyTotals.isPending ? (
                <Skeleton width={120} />
              ) : null}
            </Box>
          </TableCell>
        </TableRow>,
      );
    }
    rows.push(<TransactionRow key={item.id} transaction={item} accounts={accountsById} categories={categoryMap} onOpen={() => setDialog({ mode: "edit", transaction: item })} />);
  });

  const onlyAccount = accountIds.length === 1 ? accountIds[0] : undefined;

  return (
    <>
      <Box sx={{ mb: 2.5 }}>
        <Typography variant="h5" component="h1">
          Transactions
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Your expenses, income and transfers.
        </Typography>
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "232px minmax(0, 1fr)" }, gap: 2.5, alignItems: "start" }}>
        {/* The sidebar: view, type, page size and date ranges. */}
        <Paper variant="outlined" sx={{ borderRadius: 3, p: 2, position: { md: "sticky" }, top: { md: 80 }, display: "flex", flexDirection: "column", gap: 2 }}>
          <ToggleButtonGroup
            exclusive
            fullWidth
            size="small"
            value={view}
            onChange={(_, next: View | null) => next && update({ view: next === "list" ? undefined : next })}
            aria-label="View"
          >
            <ToggleButton value="list" sx={{ gap: 0.75 }}>
              <MdiIcon path={mdiFormatListBulleted} fontSize="small" />
              List
            </ToggleButton>
            <ToggleButton value="calendar" sx={{ gap: 0.75 }}>
              <MdiIcon path={mdiCalendarMonthOutline} fontSize="small" />
              Calendar
            </ToggleButton>
          </ToggleButtonGroup>

          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "1fr" }, gap: 2 }}>
            <TextField
              select
              size="small"
              label="Transaction type"
              value={types}
              onChange={(event) => {
                const value = event.target.value as unknown as string[] | string;
                const next = (typeof value === "string" ? value.split(",") : value) as TransactionType[];
                // Keep only the chosen categories that still fit one of the types.
                const keep = categoryIds.filter((id) => {
                  const kind = categoryMap.get(id)?.type;
                  return next.length === 0 || (kind !== undefined && next.includes(kind));
                });
                update({ type: next, category: keep.map(String) });
              }}
              slotProps={{
                inputLabel: { shrink: true },
                select: {
                  multiple: true,
                  displayEmpty: true,
                  renderValue: (selected) => {
                    const chosen = selected as unknown as TransactionType[];
                    return chosen.length === 0 || chosen.length === TRANSACTION_TYPES.length
                      ? "All types"
                      : TRANSACTION_TYPES.filter((option) => chosen.includes(option.value))
                          .map((option) => option.name)
                          .join(", ");
                  },
                },
              }}
            >
              {TRANSACTION_TYPES.map((option) => (
                <MenuItem key={option.value} value={option.value} dense>
                  <Checkbox size="small" checked={types.includes(option.value)} sx={{ p: 0.5, mr: 1 }} />
                  {option.name}
                </MenuItem>
              ))}
            </TextField>
            {view === "list" ? (
              <TextField select size="small" label="Transactions per page" value={pageSize} onChange={(event) => update({ per: Number(event.target.value) === DEFAULT_PAGE_SIZE ? undefined : String(event.target.value) })}>
                {PAGE_SIZES.map((size) => (
                  <MenuItem key={size} value={size}>
                    {size}
                  </MenuItem>
                ))}
              </TextField>
            ) : null}
          </Box>

          <Divider />

          {/* A column of ranges on wide screens; a row that scrolls sideways on narrow ones. */}
          <Box component="nav" aria-label="Date ranges">
            {view === "list" ? (
              <>
                <SidebarLabel>Date range</SidebarLabel>
                <Box sx={{ display: "flex", flexDirection: { xs: "row", md: "column" }, gap: 0.25, overflowX: { xs: "auto", md: "visible" }, mb: 2 }}>
                  {DATE_RANGE_PRESETS.map((option) => (
                    <NavItem key={option.value} selected={preset === option.value} onClick={() => setRange(presetSpan(option.value, firstDayOfWeek))}>
                      {option.name}
                    </NavItem>
                  ))}
                  <NavItem selected={!preset} onClick={() => setCustomOpen(true)}>
                    Custom…
                  </NavItem>
                </Box>
              </>
            ) : null}
            <SidebarLabel>Recent months</SidebarLabel>
            <Box sx={{ display: "flex", flexDirection: { xs: "row", md: "column" }, gap: 0.25, overflowX: { xs: "auto", md: "visible" } }}>
              {recentMonths(view === "calendar" ? 12 : 6).map((month) => (
                <NavItem key={month.start} selected={range.start === month.start && range.end === month.end} onClick={() => setRange(month)}>
                  {month.name}
                </NavItem>
              ))}
            </Box>
          </Box>
        </Paper>

        <Paper variant="outlined" sx={{ borderRadius: 3, overflow: "hidden", minHeight: 480 }}>
          {/* Title, actions and search. */}
          <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1.5, px: { xs: 2, sm: 3 }, pt: 2.5, pb: 1.5 }}>
            <Typography variant="h6" component="h2">
              {view === "calendar" ? "Calendar" : "Transaction List"}
            </Typography>
            <Button variant="outlined" color="inherit" size="small" startIcon={<MdiIcon path={mdiPlus} />} disabled={!ready} onClick={() => setDialog({ mode: "add", accountId: onlyAccount })}>
              Add
            </Button>
            <Button
              variant="outlined"
              color="inherit"
              size="small"
              startIcon={exporting ? <CircularProgress size={16} color="inherit" /> : <MdiIcon path={mdiDownload} />}
              disabled={exporting || !data || data.total_count === 0}
              onClick={(event) => setExportAnchor(event.currentTarget)}
            >
              Export
            </Button>
            <Menu anchorEl={exportAnchor} open={exportAnchor !== null} onClose={() => setExportAnchor(null)}>
              <MenuItem onClick={() => void runExport("csv")}>Export to CSV (comma-separated) file</MenuItem>
              <MenuItem onClick={() => void runExport("tsv")}>Export to TSV (tab-separated) file</MenuItem>
            </Menu>
            <Tooltip title="Refresh">
              <span>
                <IconButton aria-label="Refresh" disabled={transactions.isFetching} onClick={() => void transactions.refetch()}>
                  {transactions.isFetching ? <CircularProgress size={20} color="inherit" /> : <MdiIcon path={mdiRefresh} />}
                </IconButton>
              </span>
            </Tooltip>
            <Box sx={{ flex: 1 }} />
            <TextField
              size="small"
              placeholder="Search description"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              sx={{ width: { xs: "100%", sm: 260 } }}
              slotProps={{
                htmlInput: { "aria-label": "Search description", maxLength: 100 },
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <MdiIcon path={mdiMagnify} fontSize="small" />
                    </InputAdornment>
                  ),
                },
              }}
            />
          </Box>

          {/* The date range with its arrows, and the period's totals. */}
          <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 2, px: { xs: 2, sm: 3 }, pb: 2 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <Tooltip title="Previous period">
                <IconButton size="small" aria-label="Previous period" onClick={() => setRange(shiftSpan(range, -1))}>
                  <MdiIcon path={mdiChevronLeft} />
                </IconButton>
              </Tooltip>
              <Button variant="text" color="inherit" startIcon={<MdiIcon path={mdiCalendarRange} />} onClick={() => setCustomOpen(true)} sx={{ fontWeight: 600, fontSize: "1rem" }}>
                {spanLabel(range)}
              </Button>
              <Tooltip title="Next period">
                <IconButton size="small" aria-label="Next period" onClick={() => setRange(shiftSpan(range, 1))}>
                  <MdiIcon path={mdiChevronRight} />
                </IconButton>
              </Tooltip>
              {range.start !== thisMonth.start || range.end !== thisMonth.end ? (
                <Button size="small" variant="text" onClick={() => update({ from: undefined, to: undefined })}>
                  This Month
                </Button>
              ) : null}
            </Box>
            <Box sx={{ flex: 1 }} />
            <Box sx={{ display: "flex", gap: 3 }}>
              <Figure label="Total income" value={data ? money(data.total_income, data.currency) : <Skeleton width={80} />} color="var(--hk-income-color)" />
              <Figure label="Total expense" value={data ? money(data.total_expense, data.currency) : <Skeleton width={80} />} color="var(--hk-expense-color)" />
              <Figure label="Net" value={data ? money(data.total_income - data.total_expense, data.currency) : <Skeleton width={80} />} />
            </Box>
          </Box>

          {chips.length > 0 ? (
            <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1, px: { xs: 2, sm: 3 }, pb: 2 }}>
              {chips.map((chip) => (
                <Chip key={chip.key} size="small" label={chip.label} onDelete={chip.onDelete} />
              ))}
              <Button size="small" variant="text" startIcon={<MdiIcon path={mdiClose} />} onClick={clearFilters}>
                Clear all
              </Button>
            </Box>
          ) : null}

          <Divider />
          <Box sx={{ height: 2 }}>{transactions.isFetching && data ? <LinearProgress sx={{ height: 2 }} /> : null}</Box>

          {transactions.isError ? (
            <Box sx={{ p: 3 }}>
              <Alert
                severity="error"
                action={
                  <Button color="inherit" size="small" onClick={() => void transactions.refetch()}>
                    Retry
                  </Button>
                }
              >
                Could not load your transactions. {errorMessage(transactions.error)}
              </Alert>
            </Box>
          ) : view === "calendar" ? (
            <Box sx={{ p: { xs: 2, sm: 3 } }}>
              {data ? (
                <TransactionCalendar
                  month={calendarMonth}
                  items={data.items}
                  accounts={accountsById}
                  currency={currency}
                  firstDayOfWeek={firstDayOfWeek}
                  money={money}
                  onDay={(day) => update({ view: undefined, from: day, to: day })}
                />
              ) : (
                <Skeleton variant="rounded" height={520} />
              )}
            </Box>
          ) : (
            <>
              <Box sx={{ overflowX: "auto" }}>
                <Table size="small" sx={{ minWidth: 760, "& th": { fontWeight: 600, whiteSpace: "nowrap", py: 1.25 }, "& td, & th": { px: { xs: 2, sm: 3 } } }}>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ width: 90 }}>
                        <HeaderFilter label="Time" active={Boolean(preset !== "this_month")}>
                          {(close) => [
                            ...DATE_RANGE_PRESETS.map((option) => (
                              <FilterItem
                                key={option.value}
                                selected={preset === option.value}
                                onClick={() => {
                                  setRange(presetSpan(option.value, firstDayOfWeek));
                                  close();
                                }}
                              >
                                {option.name}
                              </FilterItem>
                            )),
                            <Divider key="divider" />,
                            <FilterItem
                              key="custom"
                              selected={!preset}
                              onClick={() => {
                                setCustomOpen(true);
                                close();
                              }}
                            >
                              Custom date…
                            </FilterItem>,
                          ]}
                        </HeaderFilter>
                      </TableCell>
                      <TableCell sx={{ width: "24%" }}>
                        <HeaderFilter label="Category" active={categoryIds.length > 0}>
                          {(close) => [
                            <AllItem
                              key="all"
                              selected={categoryIds.length === 0}
                              onClick={() => {
                                update({ category: undefined });
                                close();
                              }}
                            />,
                            <MultipleItem
                              key="multiple"
                              label="Multiple categories…"
                              selected={categoryIds.length > 1}
                              onClick={() => {
                                setMultiOpen("category");
                                close();
                              }}
                            />,
                            ...categoryGroups.flatMap((group) => [
                              <ListSubheader key={`group-${group.label}`} sx={{ lineHeight: "32px" }}>
                                {group.label}
                              </ListSubheader>,
                              ...group.items.map((item) => (
                                <FilterItem
                                  key={item.id}
                                  indent={item.indent}
                                  icon={item.icon}
                                  selected={categoryIds.length === 1 && categoryIds[0] === item.id}
                                  onClick={() => {
                                    update({ category: String(item.id) });
                                    close();
                                  }}
                                >
                                  {item.name}
                                </FilterItem>
                              )),
                            ]),
                          ]}
                        </HeaderFilter>
                      </TableCell>
                      <TableCell sx={{ width: "16%" }}>
                        <HeaderFilter label="Amount" active={Boolean(amount)}>
                          {(close) => <AmountFilterMenu value={amount} currency={currency} onChange={(value) => update({ amount: value })} close={close} />}
                        </HeaderFilter>
                      </TableCell>
                      <TableCell sx={{ width: "22%" }}>
                        <HeaderFilter label="Account" active={accountIds.length > 0}>
                          {(close) => [
                            <AllItem
                              key="all"
                              selected={accountIds.length === 0}
                              onClick={() => {
                                update({ account: undefined });
                                close();
                              }}
                            />,
                            <MultipleItem
                              key="multiple"
                              label="Multiple accounts…"
                              selected={accountIds.length > 1}
                              onClick={() => {
                                setMultiOpen("account");
                                close();
                              }}
                            />,
                            ...accountGroups.flatMap((group) => [
                              <ListSubheader key={`group-${group.label}`} sx={{ lineHeight: "32px" }}>
                                {group.label}
                              </ListSubheader>,
                              ...group.items.map((item) => (
                                <FilterItem
                                  key={item.id}
                                  icon={item.icon}
                                  selected={accountIds.length === 1 && accountIds[0] === item.id}
                                  onClick={() => {
                                    update({ account: String(item.id) });
                                    close();
                                  }}
                                >
                                  {item.name}
                                </FilterItem>
                              )),
                            ]),
                          ]}
                        </HeaderFilter>
                      </TableCell>
                      <TableCell>Description</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {transactions.isPending
                      ? [0, 1, 2, 3, 4].map((index) => (
                          <TableRow key={index}>
                            <TableCell colSpan={5}>
                              <Skeleton height={32} />
                            </TableCell>
                          </TableRow>
                        ))
                      : rows}
                  </TableBody>
                </Table>
              </Box>

              {data && data.total_count === 0 ? (
                <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 1.5, py: 8, px: 2, color: "text.secondary" }}>
                  <MdiIcon path={mdiReceiptTextOutline} sx={{ fontSize: 44 }} />
                  <Typography>{filtered ? "No transactions match these filters in this period." : `No transactions in ${spanLabel(range)}.`}</Typography>
                  {filtered ? (
                    <Button variant="text" startIcon={<MdiIcon path={mdiClose} />} onClick={clearFilters}>
                      Clear Filters
                    </Button>
                  ) : (
                    <Button startIcon={<MdiIcon path={mdiPlus} />} disabled={!ready} onClick={() => setDialog({ mode: "add", accountId: onlyAccount })}>
                      Add Transaction
                    </Button>
                  )}
                </Box>
              ) : null}

              {data && data.total_count > 0 ? (
                <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 1.5, px: { xs: 2, sm: 3 }, py: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, data.total_count)} of {data.total_count}
                  </Typography>
                  {pageCount > 1 ? <Pagination count={pageCount} page={Math.min(page, pageCount)} onChange={(_, next) => update({ page: next > 1 ? String(next) : undefined })} shape="rounded" /> : null}
                </Box>
              ) : null}
            </>
          )}
        </Paper>
      </Box>

      {data && accountsById.size > 0 && data.items.some((item) => accountsById.get(item.account_id)?.currency !== data.currency) ? (
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.5 }}>
          Totals are in {data.currency}. Transactions in other currencies are listed but not added up yet.
        </Typography>
      ) : null}

      <CustomRangeDialog
        open={customOpen}
        initial={range}
        onApply={(next) => {
          setCustomOpen(false);
          update({ view: undefined, from: next.start, to: next.end });
        }}
        onClose={() => setCustomOpen(false)}
      />
      <MultiSelectDialog
        open={multiOpen === "account"}
        title="Filter accounts"
        groups={accountGroups}
        selected={accountIds}
        onApply={(chosen) => {
          setMultiOpen(null);
          update({ account: chosen.map(String) });
        }}
        onClose={() => setMultiOpen(null)}
      />
      <MultiSelectDialog
        open={multiOpen === "category"}
        title="Filter categories"
        groups={categoryGroups}
        selected={categoryIds}
        onApply={(chosen) => {
          setMultiOpen(null);
          update({ category: chosen.map(String) });
        }}
        onClose={() => setMultiOpen(null)}
      />
      {dialog ? <TransactionDialog target={dialog} onClose={() => setDialog(null)} onSaved={setMessage} /> : null}
      <Snackbar open={message !== null} message={message} autoHideDuration={3000} onClose={() => setMessage(null)} />
    </>
  );
}
