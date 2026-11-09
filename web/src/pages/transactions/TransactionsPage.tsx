import { mdiArrowRight, mdiBankTransfer, mdiChevronLeft, mdiChevronRight, mdiClose, mdiMagnify, mdiPlus, mdiReceiptTextOutline } from "@mdi/js";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ButtonBase from "@mui/material/ButtonBase";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import LinearProgress from "@mui/material/LinearProgress";
import ListSubheader from "@mui/material/ListSubheader";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import Snackbar from "@mui/material/Snackbar";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";

import { ACCOUNT_CATEGORIES, type Account } from "@/api/accounts";
import type { Category } from "@/api/categories";
import { errorMessage } from "@/api/client";
import { TRANSACTION_TYPES, type Transaction, type TransactionFilters, type TransactionType } from "@/api/transactions";
import { usePrivacyMode } from "@/appearance/PrivacyMode";
import { useMe } from "@/auth/session";
import { CategoryIcon } from "@/components/CategoryIcon";
import { MdiIcon } from "@/components/MdiIcon";
import { addMonths, endOfMonth, parseIsoDate, startOfMonth, toIsoDate, today } from "@/lib/dates";
import { HIDDEN_AMOUNT, formatAmount } from "@/lib/money";
import { useAccounts } from "@/pages/accounts/queries";
import { TransactionDialog, type TransactionDialogTarget } from "@/pages/transactions/TransactionDialog";
import { categoriesById, useCategories, useTransactions } from "@/pages/transactions/queries";

const MONTH_FORMAT = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" });
const DAY_FORMAT = new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short" });

/** "2026-11" for the month a date is in. */
function monthKey(date: Date): string {
  return toIsoDate(date).slice(0, 7);
}

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

function Figure({ label, value, color }: { label: string; value: ReactNode; color?: string }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography sx={{ fontSize: { xs: "1rem", sm: "1.25rem" }, fontWeight: 500, color, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</Typography>
    </Box>
  );
}

/** One transaction: category, description and account on the left, the amount on the right. */
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
  const title = category?.name ?? (transaction.type === "transfer" ? "Transfer" : "No category");
  const crossCurrency = transaction.type === "transfer" && toAccount && toAccount.currency !== currency;

  return (
    <ButtonBase
      onClick={onOpen}
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "auto minmax(0, 1fr) auto", md: "52px auto minmax(0, 1.4fr) minmax(0, 1fr) auto" },
        alignItems: "center",
        columnGap: 1.5,
        width: "100%",
        px: { xs: 2, sm: 3 },
        py: 1.25,
        textAlign: "start",
        "&:hover": { bgcolor: "action.hover" },
        "&:focus-visible": { bgcolor: "action.focus" },
      }}
    >
      <Typography variant="body2" color="text.secondary" sx={{ display: { xs: "none", md: "block" } }}>
        {transaction.occurred_at.slice(11, 16)}
      </Typography>
      <Box sx={{ width: 36, height: 36, display: "grid", placeItems: "center", borderRadius: "50%", bgcolor: "action.hover" }}>
        {category ? <CategoryIcon icon={category.icon} color={category.color} size={20} /> : <MdiIcon path={mdiBankTransfer} sx={{ fontSize: 20 }} />}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {title}
          {parent ? (
            <Typography component="span" variant="body2" color="text.secondary">
              {" "}
              · {parent.name}
            </Typography>
          ) : null}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {transaction.comment || <Box component="span" sx={{ display: { md: "none" } }}>{accountText(account, toAccount)}</Box>}
          {transaction.comment ? <Box component="span" sx={{ display: { md: "none" } }}> · {accountText(account, toAccount)}</Box> : null}
        </Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ display: { xs: "none", md: "flex" }, alignItems: "center", gap: 0.5, minWidth: 0 }}>
        <Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {account?.name ?? "Unknown account"}
        </Box>
        {toAccount ? (
          <>
            <MdiIcon path={mdiArrowRight} sx={{ fontSize: 16, flex: "none" }} />
            <Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {toAccount.name}
            </Box>
          </>
        ) : null}
      </Typography>
      <Box sx={{ textAlign: "end" }}>
        <Typography sx={{ fontWeight: 600, color: TYPE_COLORS[transaction.type], whiteSpace: "nowrap" }}>{signedAmount(money, transaction, currency)}</Typography>
        {crossCurrency && transaction.to_amount !== null ? (
          <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
            → {money(transaction.to_amount, toAccount.currency)}
          </Typography>
        ) : null}
      </Box>
    </ButtonBase>
  );
}

function accountText(account: Account | undefined, toAccount: Account | undefined): string {
  const name = account?.name ?? "Unknown account";
  return toAccount ? `${name} → ${toAccount.name}` : name;
}

/** Each day's transactions under a heading with the day's income and expense. */
function groupByDay(items: Transaction[]): { day: string; items: Transaction[] }[] {
  const groups: { day: string; items: Transaction[] }[] = [];
  for (const item of items) {
    const day = item.occurred_at.slice(0, 10);
    const last = groups[groups.length - 1];
    if (last?.day === day) last.items.push(item);
    else groups.push({ day, items: [item] });
  }
  return groups;
}

/** The transaction list: a month at a time, filtered by type, account, category and text. Like ezBookkeeping's. */
export function TransactionsPage() {
  const me = useMe();
  const money = useMoney();
  const accounts = useAccounts();
  const categories = useCategories();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get("q") ?? "");
  const [dialog, setDialog] = useState<TransactionDialogTarget | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const currency = me.data?.default_currency ?? "INR";

  // The filters live in the address, so a link (such as an account's "Transactions" button) can open a view.
  const month = /^\d{4}-\d{2}$/.test(params.get("month") ?? "") ? params.get("month")! : monthKey(today());
  const monthStart = parseIsoDate(`${month}-01`);
  const type = TRANSACTION_TYPES.some((option) => option.value === params.get("type")) ? (params.get("type") as TransactionType) : undefined;
  const accountId = Number(params.get("account")) || undefined;
  const categoryId = Number(params.get("category")) || undefined;
  const query = params.get("q") ?? "";

  function setParam(key: string, value: string | undefined): void {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );
  }

  // Search as the person types, after a short pause.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (search.trim() !== query) setParam("q", search.trim() || undefined);
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setParam is stable enough; only the text matters
  }, [search]);

  const filters: TransactionFilters = {
    start: toIsoDate(startOfMonth(monthStart)),
    end: toIsoDate(endOfMonth(monthStart)),
    type,
    account_id: accountId,
    category_id: categoryId,
    q: query || undefined,
  };
  const transactions = useTransactions(filters);

  const accountsById = useMemo(() => new Map((accounts.data ?? []).map((account) => [account.id, account])), [accounts.data]);
  const categoryMap = useMemo(() => categoriesById(categories.data), [categories.data]);
  const data = transactions.data;
  const groups = useMemo(() => groupByDay(data?.items ?? []), [data]);
  const filtered = Boolean(type || accountId || categoryId || query);
  const isThisMonth = month === monthKey(today());

  function dayTotals(items: Transaction[]): { income: number; expense: number } {
    let income = 0;
    let expense = 0;
    for (const item of items) {
      if (accountsById.get(item.account_id)?.currency !== currency) continue;
      if (item.type === "income") income += item.amount;
      if (item.type === "expense") expense += item.amount;
    }
    return { income, expense };
  }

  const ready = accounts.isSuccess;

  return (
    <>
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2.5, flexWrap: "wrap" }}>
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Typography variant="h5" component="h1">
            Transactions
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Your expenses, income and transfers, a month at a time.
          </Typography>
        </Box>
        <Button startIcon={<MdiIcon path={mdiPlus} />} disabled={!ready} onClick={() => setDialog({ mode: "add", accountId })}>
          Add Transaction
        </Button>
      </Box>

      <Paper variant="outlined" sx={{ borderRadius: 3, overflow: "hidden" }}>
        {/* The month, and the filters. */}
        <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1.5, px: { xs: 2, sm: 3 }, pt: 2, pb: 1.5 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <Tooltip title="Previous month">
              <IconButton aria-label="Previous month" onClick={() => setParam("month", monthKey(addMonths(monthStart, -1)))}>
                <MdiIcon path={mdiChevronLeft} />
              </IconButton>
            </Tooltip>
            <Typography component="h2" sx={{ fontSize: "1.0625rem", fontWeight: 600, minWidth: 140, textAlign: "center" }}>
              {MONTH_FORMAT.format(monthStart)}
            </Typography>
            <Tooltip title="Next month">
              <IconButton aria-label="Next month" onClick={() => setParam("month", monthKey(addMonths(monthStart, 1)))}>
                <MdiIcon path={mdiChevronRight} />
              </IconButton>
            </Tooltip>
            {!isThisMonth ? (
              <Button size="small" variant="text" onClick={() => setParam("month", undefined)}>
                This Month
              </Button>
            ) : null}
          </Box>
          <Box sx={{ flex: 1 }} />
          <TextField
            size="small"
            placeholder="Search descriptions"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            sx={{ width: { xs: "100%", sm: 220 } }}
            slotProps={{
              htmlInput: { "aria-label": "Search descriptions", maxLength: 100 },
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
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", sm: "repeat(3, minmax(0, 1fr))" }, gap: 1.5, px: { xs: 2, sm: 3 }, pb: 2 }}>
          <TextField select size="small" label="Type" value={type ?? ""} onChange={(event) => setParam("type", event.target.value || undefined)}>
            <MenuItem value="">All Types</MenuItem>
            {TRANSACTION_TYPES.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField select size="small" label="Account" value={accountId ?? ""} onChange={(event) => setParam("account", event.target.value ? String(event.target.value) : undefined)}>
            <MenuItem value="">All Accounts</MenuItem>
            {ACCOUNT_CATEGORIES.flatMap((info) => {
              const inCategory = (accounts.data ?? []).filter((account) => account.category === info.value);
              if (inCategory.length === 0) return [];
              return [
                <ListSubheader key={`group-${info.value}`} sx={{ lineHeight: "32px" }}>
                  {info.name}
                </ListSubheader>,
                ...inCategory.map((account) => (
                  <MenuItem key={account.id} value={account.id} sx={{ pl: 3 }}>
                    {account.name}
                  </MenuItem>
                )),
              ];
            })}
          </TextField>
          <TextField
            select
            size="small"
            label="Category"
            value={categoryId ?? ""}
            onChange={(event) => setParam("category", event.target.value ? String(event.target.value) : undefined)}
            sx={{ gridColumn: { xs: "1 / -1", sm: "auto" } }}
            slotProps={{ select: { MenuProps: { slotProps: { paper: { sx: { maxHeight: 420 } } } } } }}
          >
            <MenuItem value="">All Categories</MenuItem>
            {(categories.data ?? [])
              .filter((top) => !type || top.type === type)
              .flatMap((top) => [
                <MenuItem key={top.id} value={top.id} sx={{ fontWeight: 600 }}>
                  <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}>
                    <CategoryIcon icon={top.icon} color={top.color} size={18} />
                    {top.name}
                  </Box>
                </MenuItem>,
                ...top.sub_categories.map((sub) => (
                  <MenuItem key={sub.id} value={sub.id} sx={{ pl: 4 }}>
                    <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}>
                      <CategoryIcon icon={sub.icon} color={sub.color} size={18} />
                      {sub.name}
                    </Box>
                  </MenuItem>
                )),
              ])}
          </TextField>
        </Box>

        <Divider />
        {/* The month's totals. */}
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 1.5, px: { xs: 2, sm: 3 }, py: 2 }}>
          <Figure label="Income" value={data ? money(data.total_income, data.currency) : <Skeleton width={90} />} color="var(--hk-income-color)" />
          <Figure label="Expense" value={data ? money(data.total_expense, data.currency) : <Skeleton width={90} />} color="var(--hk-expense-color)" />
          <Figure label="Net" value={data ? money(data.total_income - data.total_expense, data.currency) : <Skeleton width={90} />} />
        </Box>
        <Divider />
        <Box sx={{ height: 2 }}>{transactions.isFetching && data ? <LinearProgress sx={{ height: 2 }} /> : null}</Box>

        {transactions.isPending ? (
          <Box sx={{ px: 3, py: 2, display: "flex", flexDirection: "column", gap: 1.5 }}>
            {[0, 1, 2, 3].map((index) => (
              <Skeleton key={index} variant="rounded" height={48} />
            ))}
          </Box>
        ) : transactions.isError ? (
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
        ) : groups.length === 0 ? (
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 1.5, py: 8, px: 2, color: "text.secondary" }}>
            <MdiIcon path={mdiReceiptTextOutline} sx={{ fontSize: 44 }} />
            <Typography>{filtered ? "No transactions match these filters this month." : `No transactions in ${MONTH_FORMAT.format(monthStart)}.`}</Typography>
            {filtered ? (
              <Button
                variant="text"
                startIcon={<MdiIcon path={mdiClose} />}
                onClick={() => {
                  setSearch("");
                  setParams(month === monthKey(today()) ? {} : { month }, { replace: true });
                }}
              >
                Clear Filters
              </Button>
            ) : (
              <Button startIcon={<MdiIcon path={mdiPlus} />} disabled={!ready} onClick={() => setDialog({ mode: "add", accountId })}>
                Add Transaction
              </Button>
            )}
          </Box>
        ) : (
          groups.map((group) => {
            const totals = dayTotals(group.items);
            return (
              <Box key={group.day} component="section">
                <Box sx={{ display: "flex", alignItems: "center", gap: 2, px: { xs: 2, sm: 3 }, py: 1, bgcolor: "action.hover" }}>
                  <Typography variant="body2" component="h3" sx={{ fontWeight: 600, flex: 1 }}>
                    {DAY_FORMAT.format(parseIsoDate(group.day))}
                  </Typography>
                  {totals.income > 0 ? (
                    <Typography variant="body2" sx={{ color: "var(--hk-income-color)" }}>
                      +{money(totals.income, currency)}
                    </Typography>
                  ) : null}
                  {totals.expense > 0 ? (
                    <Typography variant="body2" sx={{ color: "var(--hk-expense-color)" }}>
                      −{money(totals.expense, currency)}
                    </Typography>
                  ) : null}
                </Box>
                {group.items.map((item) => (
                  <TransactionRow
                    key={item.id}
                    transaction={item}
                    accounts={accountsById}
                    categories={categoryMap}
                    onOpen={() => setDialog({ mode: "edit", transaction: item })}
                  />
                ))}
              </Box>
            );
          })
        )}
      </Paper>

      {data && accountsById.size > 0 && data.items.some((item) => accountsById.get(item.account_id)?.currency !== data.currency) ? (
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.5 }}>
          Totals are in {data.currency}. Transactions in other currencies are listed but not added up yet.
        </Typography>
      ) : null}

      {dialog ? <TransactionDialog target={dialog} onClose={() => setDialog(null)} onSaved={setMessage} /> : null}
      <Snackbar open={message !== null} message={message} autoHideDuration={3000} onClose={() => setMessage(null)} />
    </>
  );
}
