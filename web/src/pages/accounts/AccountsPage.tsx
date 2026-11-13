import {
  mdiArrowDown,
  mdiArrowUp,
  mdiBankTransfer,
  mdiCashMinus,
  mdiDeleteOutline,
  mdiDotsVertical,
  mdiEyeOffOutline,
  mdiEyeOutline,
  mdiInformationOutline,
  mdiBriefcaseCheckOutline,
  mdiBriefcaseOutline,
  mdiListBoxOutline,
  mdiPencilOutline,
  mdiPlus,
  mdiStar,
  mdiStarOutline,
  mdiTrayArrowUp,
  mdiViewGridOutline,
  mdiWalletOutline,
} from "@mdi/js";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import Snackbar from "@mui/material/Snackbar";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";
import { Link as RouterLink } from "react-router-dom";

import {
  ACCOUNT_CATEGORIES,
  SALARY_CATEGORIES,
  categoryInfo,
  deleteAccount,
  reorderAccounts,
  updateAccount,
  type Account,
  type AccountCategory,
  type AccountCategoryInfo,
} from "@/api/accounts";
import { updateMe } from "@/api/auth";
import { errorMessage } from "@/api/client";
import { accountIconPath } from "@/appearance/accountIcons";
import { usePrivacyMode } from "@/appearance/PrivacyMode";
import { amountColorCss } from "@/appearance/preferences";
import { useMe, useSetMe } from "@/auth/session";
import { AccountIcon } from "@/components/AccountIcon";
import { MdiIcon } from "@/components/MdiIcon";
import { HIDDEN_AMOUNT, formatAmount } from "@/lib/money";
import { AccountActionDialog, CASH_WITHDRAWAL_CATEGORIES, type AccountActionTarget } from "@/pages/accounts/AccountActionDialog";
import { AccountDialog, type AccountDialogTarget } from "@/pages/accounts/AccountDialog";
import { STATEMENT_UPLOAD_CATEGORIES, StatementUploadDialog } from "@/pages/accounts/StatementUploadDialog";
import { ACCOUNTS_KEY, invalidateAccounts, useAccountSummary, useAccounts } from "@/pages/accounts/queries";

/** "all", or one category. */
type Selection = AccountCategory | "all";

function useMoney() {
  const { hidden } = usePrivacyMode();
  return (minor: number, currency: string) => (hidden ? HIDDEN_AMOUNT : formatAmount(minor, currency));
}

/** What a category adds up to, in the default currency, as shown: a liability's total is what is owed. */
function categoryTotal(accounts: Account[], info: AccountCategoryInfo, currency: string): number {
  const sum = accounts
    .filter((account) => account.category === info.value && account.include_in_total && account.currency === currency)
    .reduce((total, account) => total + account.balance, 0);
  return info.liability ? -sum : sum;
}

/** The ordinal suffix for a day of the month: 1st, 2nd, 15th. */
function ordinal(day: number): string {
  if (day % 100 >= 11 && day % 100 <= 13) return `${day}th`;
  return `${day}${["th", "st", "nd", "rd"][day % 10] ?? "th"}`;
}

function SummaryFigure({ label, value, color, large = false }: { label: string; value: ReactNode; color?: string; large?: boolean }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography
        sx={{ fontSize: large ? "1.375rem" : "1.0625rem", fontWeight: 500, color, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
      >
        {value}
      </Typography>
    </Box>
  );
}

/** Net assets, liabilities and assets; a column on wide screens and a row on narrow ones. */
function Summary() {
  const summary = useAccountSummary();
  const me = useMe();
  const money = useMoney();
  const data = summary.data;
  const show = (value: number | undefined) => (data && value !== undefined ? money(value, data.currency) : <Skeleton width={110} />);

  return (
    <Box>
      {/* Net assets above the other two on narrow screens; one column on wide ones. */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "1fr" }, gap: { xs: 1.5, md: 1.75 } }}>
        <Box sx={{ gridColumn: { xs: "1 / -1", md: "auto" } }}>
          <SummaryFigure label="Net assets" value={show(data?.net_assets)} color="primary.main" large />
        </Box>
        <SummaryFigure
          label="Total liabilities"
          value={show(data?.total_liabilities)}
          color={amountColorCss(me.data?.expense_amount_color ?? "red")}
        />
        <SummaryFigure label="Total assets" value={show(data?.total_assets)} />
      </Box>
      {data && data.other_currencies.length > 0 ? (
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.5 }}>
          Totals are in {data.currency}. Accounts in {data.other_currencies.join(", ")} are not counted yet.
        </Typography>
      ) : null}
    </Box>
  );
}

function CategoryNavItem({
  icon,
  name,
  total,
  count,
  selected,
  onSelect,
}: {
  icon: string;
  name: string;
  total: string | null;
  count: number;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <Box
      component="button"
      type="button"
      onClick={onSelect}
      aria-current={selected ? "page" : undefined}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        width: "100%",
        px: 1.5,
        py: 1,
        border: 0,
        borderRadius: 1.5,
        cursor: "pointer",
        textAlign: "start",
        font: "inherit",
        color: selected ? "primary.main" : "text.primary",
        bgcolor: selected ? "rgb(var(--mui-palette-primary-mainChannel) / 0.1)" : "transparent",
        opacity: count === 0 && !selected ? 0.6 : 1,
        "&:hover": { bgcolor: selected ? "rgb(var(--mui-palette-primary-mainChannel) / 0.14)" : "action.hover" },
        "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main" },
      }}
    >
      <MdiIcon path={icon} sx={{ fontSize: 22, flex: "none" }} />
      <Box sx={{ minWidth: 0, display: "flex", flexDirection: "column" }}>
        {total !== null ? (
          <Typography variant="caption" sx={{ color: "text.secondary", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {total}
          </Typography>
        ) : null}
        <Typography variant="body2" sx={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {name}
        </Typography>
      </Box>
    </Box>
  );
}

interface CardActions {
  onEdit: (account: Account) => void;
  onDelete: (account: Account) => void;
  onToggleHidden: (account: Account) => void;
  onTogglePrimary: (account: Account) => void;
  onToggleSalary: (account: Account) => void;
  onMove: (account: Account, step: -1 | 1) => void;
  onUploadStatement: (account: Account) => void;
  onAction: (target: AccountActionTarget) => void;
}

/** One account: its icon, name and balance, with its actions. Like ezBookkeeping's account card. */
function AccountCard({
  account,
  first,
  last,
  busy,
  isPrimary,
  isSalary,
  actions,
}: {
  account: Account;
  first: boolean;
  last: boolean;
  busy: boolean;
  isPrimary: boolean;
  isSalary: boolean;
  actions: CardActions;
}) {
  const money = useMoney();
  const owed = -account.balance;
  const available = account.credit_limit !== null ? account.credit_limit - owed : null;
  const canBePrimaryOrSalary = SALARY_CATEGORIES.includes(account.category);
  const hasCardDetails = available !== null || (account.category === "credit_card" && account.statement_day !== null);
  const canWithdraw = CASH_WITHDRAWAL_CATEGORIES.includes(account.category);
  const canUploadStatement = STATEMENT_UPLOAD_CATEGORIES.includes(account.category);
  // On phones the less-used actions live in a ⋮ menu instead of a long row of buttons; from `sm` up they are buttons.
  // Withdraw stays a button on phones, since it is the quick one for cash.
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const fromMenu = (run: () => void) => () => {
    setMenuAnchor(null);
    run();
  };
  const wideOnly = { display: { xs: "none", sm: "inline-flex" } };

  return (
    <Paper
      variant="outlined"
      sx={{
        borderRadius: 2,
        overflow: "hidden",
        // Pointer devices show the actions on hover, like ezBookkeeping; touch screens always show them.
        "@media (hover: hover)": {
          "& .account-card__actions": { opacity: 0, transition: "opacity 120ms ease" },
          "&:hover .account-card__actions, &:focus-within .account-card__actions": { opacity: 1 },
        },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, px: 2, py: 1.5, bgcolor: "action.hover" }}>
        <AccountIcon icon={account.icon} color={account.color} faded={account.hidden} />
        {/* The name, then the currency and badges: on one line when there is room, wrapped under the name on phones. */}
        <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexWrap: "wrap", alignItems: "center", columnGap: 1.25, rowGap: 0.5 }}>
          <Typography
            component={RouterLink}
            to={`/accounts/${account.id}`}
            sx={{
              maxWidth: "100%",
              fontSize: "1rem",
              fontWeight: 500,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              opacity: account.hidden ? 0.6 : 1,
              color: "inherit",
              textDecoration: "none",
              "&:hover": { textDecoration: "underline" },
            }}
          >
            {account.name}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ flex: "none" }}>
            {account.currency}
            {account.number_suffix ? ` · ••${account.number_suffix}` : ""}
          </Typography>
          {isPrimary ? (
            <Tooltip title="New transactions start on this account">
              <Chip size="small" label="Primary" color="primary" variant="outlined" />
            </Tooltip>
          ) : null}
          {isSalary ? (
            <Tooltip title="Your salary is paid into this account">
              <Chip size="small" label="Salary" color="primary" variant="outlined" />
            </Tooltip>
          ) : null}
          {account.hidden ? <Chip size="small" label="Hidden" variant="outlined" /> : null}
          {!account.include_in_total ? (
            <Tooltip title="Not counted in total assets and liabilities">
              <Chip size="small" label="Not in totals" variant="outlined" />
            </Tooltip>
          ) : null}
        </Box>
        <Box className="account-card__actions" sx={{ display: { xs: "none", sm: "flex" }, flex: "none" }}>
          <Tooltip title="Move up">
            <span>
              <IconButton size="small" aria-label={`Move ${account.name} up`} disabled={first || busy} onClick={() => actions.onMove(account, -1)}>
                <MdiIcon path={mdiArrowUp} fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Move down">
            <span>
              <IconButton size="small" aria-label={`Move ${account.name} down`} disabled={last || busy} onClick={() => actions.onMove(account, 1)}>
                <MdiIcon path={mdiArrowDown} fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
        {/* The balance, on the name's line. What is owed on a card or loan says so above the figure. */}
        <Box sx={{ flex: "none", display: "flex", flexDirection: "column", alignItems: "flex-end", textAlign: "end" }}>
          {account.is_liability ? (
            <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.2 }}>
              Outstanding
            </Typography>
          ) : null}
          <Typography sx={{ fontSize: "1.125rem", fontWeight: 500, lineHeight: 1.3, whiteSpace: "nowrap" }}>
            {money(account.is_liability ? owed : account.balance, account.currency)}
          </Typography>
        </Box>
      </Box>
      <Divider />
      {account.comment ? (
        <Typography variant="body2" color="text.secondary" sx={{ px: 2, pt: 1.5, whiteSpace: "pre-line" }}>
          {account.comment}
        </Typography>
      ) : null}
      <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1, px: 1, py: 1 }}>
        <Box sx={{ display: "flex", gap: 0.25, flexWrap: "wrap" }}>
          <Button size="small" variant="text" color="inherit" startIcon={<MdiIcon path={mdiListBoxOutline} />} component={RouterLink} to={`/transactions?account=${account.id}`}>
            Transactions
          </Button>
          <Button size="small" variant="text" color="inherit" startIcon={<MdiIcon path={mdiInformationOutline} />} component={RouterLink} to={`/accounts/${account.id}`}>
            Enquiry
          </Button>
          {canWithdraw ? (
            <Button size="small" variant="text" color="inherit" startIcon={<MdiIcon path={mdiCashMinus} />} onClick={() => actions.onAction({ kind: "withdraw", account })}>
              Withdraw
            </Button>
          ) : null}
          <Button size="small" variant="text" color="inherit" sx={wideOnly} startIcon={<MdiIcon path={mdiBankTransfer} />} onClick={() => actions.onAction({ kind: "transfer", account })}>
            Transfer
          </Button>
          {canUploadStatement ? (
            <Button size="small" variant="text" color="inherit" sx={wideOnly} startIcon={<MdiIcon path={mdiTrayArrowUp} />} onClick={() => actions.onUploadStatement(account)}>
              Upload Statement
            </Button>
          ) : null}
          <Tooltip title="More">
            <IconButton
              size="small"
              aria-label={`More actions for ${account.name}`}
              sx={{ display: { xs: "inline-flex", sm: "none" } }}
              onClick={(event) => setMenuAnchor(event.currentTarget)}
            >
              <MdiIcon path={mdiDotsVertical} fontSize="small" />
            </IconButton>
          </Tooltip>
          <Menu
            anchorEl={menuAnchor}
            open={menuAnchor !== null}
            onClose={() => setMenuAnchor(null)}
            anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
            transformOrigin={{ vertical: "top", horizontal: "left" }}
          >
            <MenuItem disabled={first || busy} onClick={fromMenu(() => actions.onMove(account, -1))}>
              <ListItemIcon>
                <MdiIcon path={mdiArrowUp} fontSize="small" />
              </ListItemIcon>
              Move Up
            </MenuItem>
            <MenuItem disabled={last || busy} onClick={fromMenu(() => actions.onMove(account, 1))}>
              <ListItemIcon>
                <MdiIcon path={mdiArrowDown} fontSize="small" />
              </ListItemIcon>
              Move Down
            </MenuItem>
            <Divider />
            <MenuItem onClick={fromMenu(() => actions.onAction({ kind: "transfer", account }))}>
              <ListItemIcon>
                <MdiIcon path={mdiBankTransfer} fontSize="small" />
              </ListItemIcon>
              Transfer
            </MenuItem>
            {canUploadStatement ? (
              <MenuItem onClick={fromMenu(() => actions.onUploadStatement(account))}>
                <ListItemIcon>
                  <MdiIcon path={mdiTrayArrowUp} fontSize="small" />
                </ListItemIcon>
                Upload Statement
              </MenuItem>
            ) : null}
            {canBePrimaryOrSalary ? (
              <MenuItem disabled={busy} onClick={fromMenu(() => actions.onTogglePrimary(account))}>
                <ListItemIcon>
                  <MdiIcon path={isPrimary ? mdiStar : mdiStarOutline} fontSize="small" />
                </ListItemIcon>
                {isPrimary ? "Unset Primary" : "Set as Primary"}
              </MenuItem>
            ) : null}
            {canBePrimaryOrSalary ? (
              <MenuItem disabled={busy} onClick={fromMenu(() => actions.onToggleSalary(account))}>
                <ListItemIcon>
                  <MdiIcon path={isSalary ? mdiBriefcaseCheckOutline : mdiBriefcaseOutline} fontSize="small" />
                </ListItemIcon>
                {isSalary ? "Unset Salary Account" : "Set as Salary Account"}
              </MenuItem>
            ) : null}
            <MenuItem disabled={busy} onClick={fromMenu(() => actions.onToggleHidden(account))}>
              <ListItemIcon>
                <MdiIcon path={account.hidden ? mdiEyeOutline : mdiEyeOffOutline} fontSize="small" />
              </ListItemIcon>
              {account.hidden ? "Show" : "Hide"}
            </MenuItem>
            <MenuItem disabled={busy} onClick={fromMenu(() => actions.onEdit(account))}>
              <ListItemIcon>
                <MdiIcon path={mdiPencilOutline} fontSize="small" />
              </ListItemIcon>
              Edit
            </MenuItem>
            <MenuItem disabled={busy} sx={{ color: "error.main" }} onClick={fromMenu(() => actions.onDelete(account))}>
              <ListItemIcon sx={{ color: "inherit" }}>
                <MdiIcon path={mdiDeleteOutline} fontSize="small" />
              </ListItemIcon>
              Delete
            </MenuItem>
          </Menu>
          <Box className="account-card__actions" sx={{ display: { xs: "none", sm: "flex" }, gap: 0.25 }}>
          {canBePrimaryOrSalary ? (
            <>
              <Button
                size="small"
                variant="text"
                color="inherit"
                disabled={busy}
                startIcon={<MdiIcon path={isPrimary ? mdiStar : mdiStarOutline} />}
                onClick={() => actions.onTogglePrimary(account)}
              >
                {isPrimary ? "Unset Primary" : "Set as Primary"}
              </Button>
              <Button
                size="small"
                variant="text"
                color="inherit"
                disabled={busy}
                startIcon={<MdiIcon path={isSalary ? mdiBriefcaseCheckOutline : mdiBriefcaseOutline} />}
                onClick={() => actions.onToggleSalary(account)}
              >
                {isSalary ? "Unset Salary Account" : "Set as Salary Account"}
              </Button>
            </>
          ) : null}
          <Button
            size="small"
            variant="text"
            color="inherit"
            disabled={busy}
            startIcon={<MdiIcon path={account.hidden ? mdiEyeOutline : mdiEyeOffOutline} />}
            onClick={() => actions.onToggleHidden(account)}
          >
            {account.hidden ? "Show" : "Hide"}
          </Button>
          <Button size="small" variant="text" color="inherit" disabled={busy} startIcon={<MdiIcon path={mdiPencilOutline} />} onClick={() => actions.onEdit(account)}>
            Edit
          </Button>
          <Button size="small" variant="text" color="inherit" disabled={busy} startIcon={<MdiIcon path={mdiDeleteOutline} />} onClick={() => actions.onDelete(account)}>
            Delete
          </Button>
          </Box>
        </Box>
        {hasCardDetails ? (
          <>
            <Box sx={{ flex: 1 }} />
            <Box sx={{ display: "flex", alignItems: "center", gap: 2, px: 1, flexWrap: "wrap", justifyContent: "flex-end" }}>
              {account.category === "credit_card" && account.statement_day ? (
                <Typography variant="caption" color="text.secondary">
                  Statement on the {ordinal(account.statement_day)}
                </Typography>
              ) : null}
              {available !== null ? <BalanceFigure label="Available credit" value={money(available, account.currency)} /> : null}
            </Box>
          </>
        ) : null}
      </Box>
    </Paper>
  );
}

function BalanceFigure({ label, value }: { label?: string; value: string }) {
  return (
    <Box sx={{ display: "flex", alignItems: "baseline", gap: 1 }}>
      {label ? (
        <Typography variant="body2" color="text.secondary">
          {label}
        </Typography>
      ) : null}
      <Typography sx={{ fontSize: "1.25rem", fontWeight: 500 }}>{value}</Typography>
    </Box>
  );
}

/** One category's accounts, with its total above them. */
function CategorySection({
  info,
  accounts,
  currency,
  heading,
  busy,
  primaryId,
  salaryId,
  actions,
}: {
  info: AccountCategoryInfo;
  accounts: Account[];
  currency: string;
  heading: boolean;
  busy: boolean;
  primaryId: number | null;
  salaryId: number | null;
  actions: CardActions;
}) {
  const money = useMoney();
  return (
    <Box component="section" sx={{ mb: heading ? 3 : 0 }}>
      <Box sx={{ display: "flex", alignItems: "baseline", gap: 1.5, mb: 1.5 }}>
        {heading ? (
          <Typography variant="subtitle1" component="h3" sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <MdiIcon path={accountIconPath(info.icon)} sx={{ fontSize: 20 }} />
            {info.name}
          </Typography>
        ) : null}
        <Typography variant="body2" color="text.secondary">
          {info.liability ? "Outstanding" : "Balance"}
        </Typography>
        <Typography sx={{ fontSize: heading ? "1rem" : "1.5rem", fontWeight: 500 }}>{money(categoryTotal(accounts, info, currency), currency)}</Typography>
      </Box>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
        {accounts.map((account, index) => (
          <AccountCard
            key={account.id}
            account={account}
            first={index === 0}
            last={index === accounts.length - 1}
            busy={busy}
            isPrimary={account.id === primaryId}
            isSalary={account.id === salaryId}
            actions={actions}
          />
        ))}
      </Box>
    </Box>
  );
}

function EmptyState({ onAdd, text }: { onAdd: () => void; text: string }) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 1.5, py: 8, color: "text.secondary" }}>
      <MdiIcon path={mdiWalletOutline} sx={{ fontSize: 44 }} />
      <Typography>{text}</Typography>
      <Button startIcon={<MdiIcon path={mdiPlus} />} onClick={onAdd}>
        Add Account
      </Button>
    </Box>
  );
}

/** The accounts page: totals and categories on the left, the chosen category's accounts on the right. */
export function AccountsPage() {
  const me = useMe();
  const setMe = useSetMe();
  const client = useQueryClient();
  const accounts = useAccounts();
  const money = useMoney();
  const [selection, setSelection] = useState<Selection>("all");
  const [showHidden, setShowHidden] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [dialog, setDialog] = useState<AccountDialogTarget | null>(null);
  const [toDelete, setToDelete] = useState<Account | null>(null);
  const [uploadFor, setUploadFor] = useState<Account | null>(null);
  const [action, setAction] = useState<AccountActionTarget | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const currency = me.data?.default_currency ?? "INR";

  const all = useMemo(() => accounts.data ?? [], [accounts.data]);
  const hiddenCount = all.filter((account) => account.hidden).length;
  const visible = showHidden ? all : all.filter((account) => !account.hidden);

  const onError = (error: unknown) => setMessage(errorMessage(error));

  const toggleHidden = useMutation({
    mutationFn: (account: Account) => updateAccount(account.id, { hidden: !account.hidden }),
    onSuccess: async (account) => {
      await invalidateAccounts(client);
      setMessage(account.hidden ? `${account.name} is hidden` : `${account.name} is shown`);
    },
    onError,
  });

  // The primary account is the one new transactions start on (the profile's "default account"); asking again clears it.
  const togglePrimary = useMutation({
    mutationFn: (account: Account) => updateMe({ default_account_id: me.data?.default_account_id === account.id ? null : account.id }),
    onSuccess: (user, account) => {
      setMe(user);
      setMessage(user.default_account_id === account.id ? `${account.name} is now your primary account` : `${account.name} is no longer your primary account`);
    },
    onError,
  });

  const toggleSalary = useMutation({
    mutationFn: (account: Account) => updateMe({ salary_account_id: me.data?.salary_account_id === account.id ? null : account.id }),
    onSuccess: (user, account) => {
      setMe(user);
      setMessage(user.salary_account_id === account.id ? `${account.name} is now your salary account` : `${account.name} is no longer your salary account`);
    },
    onError,
  });

  const remove = useMutation({
    mutationFn: (account: Account) => deleteAccount(account.id),
    onSuccess: async () => {
      setToDelete(null);
      await invalidateAccounts(client);
      setMessage("Account deleted");
    },
    onError: (error) => {
      setToDelete(null);
      onError(error);
    },
  });

  const move = useMutation({
    mutationFn: ({ account, step }: { account: Account; step: -1 | 1 }) => {
      // The full order of the category, hidden accounts included, with this one moved past its visible neighbour.
      const inCategory = all.filter((other) => other.category === account.category);
      const shown = inCategory.filter((other) => showHidden || !other.hidden);
      const neighbour = shown[shown.findIndex((other) => other.id === account.id) + step];
      const ids = inCategory.map((other) => other.id);
      if (!neighbour) return Promise.resolve(all);
      const from = ids.indexOf(account.id);
      const to = ids.indexOf(neighbour.id);
      ids.splice(from, 1);
      ids.splice(to, 0, account.id);
      return reorderAccounts(account.category, ids);
    },
    onSuccess: (updated) => client.setQueryData([ACCOUNTS_KEY, "list"], updated),
    onError,
  });

  const busy = toggleHidden.isPending || togglePrimary.isPending || toggleSalary.isPending || remove.isPending || move.isPending;
  const actions: CardActions = {
    onEdit: (account) => setDialog({ mode: "edit", account }),
    onDelete: setToDelete,
    onToggleHidden: (account) => toggleHidden.mutate(account),
    onTogglePrimary: (account) => togglePrimary.mutate(account),
    onToggleSalary: (account) => toggleSalary.mutate(account),
    onMove: (account, step) => move.mutate({ account, step }),
    onUploadStatement: setUploadFor,
    onAction: setAction,
  };

  const addIn = selection === "all" ? "savings" : selection;
  const openAdd = () => setDialog({ mode: "add", category: addIn });
  const selectedInfo = selection === "all" ? null : categoryInfo(selection);
  const shownCategories = selectedInfo ? [selectedInfo] : ACCOUNT_CATEGORIES;
  const sections = shownCategories
    .map((info) => ({ info, accounts: visible.filter((account) => account.category === info.value) }))
    .filter((section) => section.accounts.length > 0);

  const navItems = [
    { key: "all" as const, icon: mdiViewGridOutline, name: "All Accounts", total: null, count: visible.length },
    ...ACCOUNT_CATEGORIES.map((info) => {
      const inCategory = all.filter((account) => account.category === info.value);
      return {
        key: info.value,
        icon: accountIconPath(info.icon),
        name: info.name,
        total: inCategory.length > 0 ? money(categoryTotal(inCategory, info, currency), currency) : null,
        count: inCategory.length,
      };
    }),
  ];

  return (
    <>
      <Box sx={{ mb: 2.5 }}>
        <Typography variant="h5" component="h1">
          Accounts
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Your bank accounts, cards, wallets and loans, and what they add up to.
        </Typography>
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "248px minmax(0, 1fr)" }, gap: 2.5, alignItems: "start" }}>
        <Paper variant="outlined" sx={{ borderRadius: 3, p: 2, position: { md: "sticky" }, top: { md: 80 } }}>
          <Summary />
          <Divider sx={{ my: 2 }} />
          {/* A column of categories on wide screens; a row that scrolls sideways on narrow ones. */}
          <Box
            component="nav"
            aria-label="Account categories"
            sx={{
              display: "flex",
              flexDirection: { xs: "row", md: "column" },
              gap: 0.5,
              overflowX: { xs: "auto", md: "visible" },
              mx: { xs: -1, md: 0 },
              px: { xs: 1, md: 0 },
              "& > button": { width: { xs: "auto", md: "100%" }, flex: { xs: "none", md: "initial" } },
            }}
          >
            {navItems.map((item) => (
              <CategoryNavItem
                key={item.key}
                icon={item.icon}
                name={item.name}
                total={item.total}
                count={item.count}
                selected={selection === item.key}
                onSelect={() => setSelection(item.key)}
              />
            ))}
          </Box>
        </Paper>

        <Paper variant="outlined" sx={{ borderRadius: 3, minHeight: 400 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, px: { xs: 2, sm: 3 }, pt: 2.5, pb: 2 }}>
            <Typography variant="h6" component="h2" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {selectedInfo?.name ?? "All Accounts"}
            </Typography>
            <Button variant="outlined" color="inherit" size="small" startIcon={<MdiIcon path={mdiPlus} />} disabled={accounts.isPending} onClick={openAdd}>
              Add
            </Button>
            <Box sx={{ flex: 1 }} />
            <Tooltip title="More">
              <IconButton aria-label="More" onClick={(event) => setMenuAnchor(event.currentTarget)}>
                <MdiIcon path={mdiDotsVertical} />
              </IconButton>
            </Tooltip>
            <Menu
              anchorEl={menuAnchor}
              open={menuAnchor !== null}
              onClose={() => setMenuAnchor(null)}
              anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
              transformOrigin={{ vertical: "top", horizontal: "right" }}
            >
              <MenuItem
                disabled={hiddenCount === 0}
                onClick={() => {
                  setShowHidden((was) => !was);
                  setMenuAnchor(null);
                }}
              >
                <ListItemIcon>
                  <MdiIcon path={showHidden ? mdiEyeOffOutline : mdiEyeOutline} fontSize="small" />
                </ListItemIcon>
                {showHidden ? "Hide Hidden Accounts" : `Show Hidden Accounts (${hiddenCount})`}
              </MenuItem>
            </Menu>
          </Box>
          <Divider />

          <Box sx={{ px: { xs: 2, sm: 3 }, py: 2.5 }}>
            {accounts.isPending ? (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                {[0, 1, 2].map((index) => (
                  <Skeleton key={index} variant="rounded" height={104} />
                ))}
              </Box>
            ) : accounts.isError ? (
              <Alert
                severity="error"
                action={
                  <Button color="inherit" size="small" onClick={() => void accounts.refetch()}>
                    Retry
                  </Button>
                }
              >
                Could not load your accounts. {errorMessage(accounts.error)}
              </Alert>
            ) : sections.length === 0 ? (
              <EmptyState
                onAdd={openAdd}
                text={
                  all.length === 0
                    ? "No accounts yet. Add the places your money is kept, and what you owe."
                    : selectedInfo
                      ? `No ${selectedInfo.name.toLowerCase()} accounts${hiddenCount > 0 && !showHidden ? " shown" : ""}.`
                      : "Every account is hidden."
                }
              />
            ) : (
              sections.map((section) => (
                <CategorySection
                  key={section.info.value}
                  info={section.info}
                  accounts={section.accounts}
                  currency={currency}
                  heading={selection === "all"}
                  busy={busy}
                  primaryId={me.data?.default_account_id ?? null}
                  salaryId={me.data?.salary_account_id ?? null}
                  actions={actions}
                />
              ))
            )}
          </Box>
        </Paper>
      </Box>

      <StatementUploadDialog account={uploadFor} onClose={() => setUploadFor(null)} />
      <AccountActionDialog target={action} accounts={all} onClose={() => setAction(null)} />

      {dialog ? <AccountDialog target={dialog} onClose={() => setDialog(null)} /> : null}

      <Dialog open={toDelete !== null} onClose={remove.isPending ? undefined : () => setToDelete(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete account?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {toDelete?.name} will be deleted. This cannot be undone. An account with transactions cannot be deleted; hide it instead to take it out of the list.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="text" color="inherit" disabled={remove.isPending} onClick={() => setToDelete(null)}>
            Cancel
          </Button>
          <Button color="error" disabled={remove.isPending} onClick={() => toDelete && remove.mutate(toDelete)}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={message !== null} message={message} autoHideDuration={4000} onClose={() => setMessage(null)} />
    </>
  );
}
