import { mdiArrowRight, mdiBankTransfer, mdiReceiptTextOutline, mdiTextBoxSearchOutline } from "@mdi/js";
import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ButtonBase from "@mui/material/ButtonBase";
import Skeleton from "@mui/material/Skeleton";

import type { Account } from "@/api/accounts";
import type { Category } from "@/api/categories";
import type { Transaction } from "@/api/transactions";
import { CategoryIcon } from "@/components/CategoryIcon";
import { MdiIcon } from "@/components/MdiIcon";
import { addDays, parseIsoDate, toIsoDate, today } from "@/lib/dates";
import { formatAmount, HIDDEN_AMOUNT } from "@/lib/money";
import { useAccounts } from "@/pages/accounts/queries";
import { useOverview } from "@/pages/overview/OverviewContext";
import { WidgetCard, WidgetEmpty, WidgetHeader } from "@/pages/overview/WidgetCard";
import { categoriesById, useCategories, useTransactions } from "@/pages/transactions/queries";

const COUNT = 5;

/** The amount as the transactions page writes it: expenses with a minus, income with a plus, transfers plain. */
function signedAmount(transaction: Transaction, currency: string, showAmounts: boolean): string {
  if (!showAmounts) return HIDDEN_AMOUNT;
  const text = formatAmount(transaction.amount, currency);
  return transaction.type === "expense" ? `−${text}` : transaction.type === "income" ? `+${text}` : text;
}

function RecentRow({ transaction, accounts, categories }: { transaction: Transaction; accounts: Map<number, Account>; categories: Map<number, Category> }) {
  const { showAmounts } = useOverview();
  const navigate = useNavigate();
  const category = transaction.category_id === null ? undefined : categories.get(transaction.category_id);
  const account = accounts.get(transaction.account_id);
  const toAccount = transaction.to_account_id === null ? undefined : accounts.get(transaction.to_account_id);
  const title = category?.name ?? (transaction.type === "transfer" ? "Transfer" : "No category");
  const date = parseIsoDate(transaction.occurred_at.slice(0, 10)).toLocaleDateString(undefined, { day: "numeric", month: "short" });

  return (
    <ButtonBase className="recent-transactions-widget__item" onClick={() => void navigate("/transactions")}>
      <span className="overview-widget__item-icon">
        {category ? <CategoryIcon icon={category.icon} color={category.color} size={20} /> : <MdiIcon path={mdiBankTransfer} sx={{ fontSize: 20 }} />}
      </span>
      <span className="recent-transactions-widget__text">
        <span className="recent-transactions-widget__title" title={title}>
          {title}
        </span>
        <small className="recent-transactions-widget__meta">
          {date} · {account?.name ?? "Unknown account"}
          {toAccount ? (
            <>
              {" "}
              <MdiIcon path={mdiArrowRight} sx={{ fontSize: 12, verticalAlign: "-1px" }} /> {toAccount.name}
            </>
          ) : null}
        </small>
      </span>
      <span className={`overview-widget__amount recent-transactions-widget__amount overview-amount--${transaction.type === "transfer" ? "none" : transaction.type}`}>
        {signedAmount(transaction, account?.currency ?? "INR", showAmounts)}
      </span>
    </ButtonBase>
  );
}

/** The latest transactions, newest first, with a button to the full list. */
export function RecentTransactionsWidget() {
  const navigate = useNavigate();
  // The API takes at most a year at a time; the newest few of the last year are all this tile needs.
  const end = today();
  const transactions = useTransactions({ start: toIsoDate(addDays(end, -365)), end: toIsoDate(end), limit: COUNT });
  const accounts = useAccounts();
  const categories = useCategories();

  const accountMap = new Map((accounts.data ?? []).map((account) => [account.id, account]));
  const categoryMap = categoriesById(categories.data);
  const items = transactions.data?.items ?? [];
  const loading = transactions.isPending || accounts.isPending || categories.isPending;

  return (
    <WidgetCard className="recent-transactions-widget">
      <WidgetHeader icon={mdiReceiptTextOutline} title="Recent Transactions">
        <Button size="small" className="overview-tonal-button" onClick={() => void navigate("/transactions")}>
          View all
        </Button>
      </WidgetHeader>
      <Box className="overview-widget__body">
        {loading && Array.from({ length: COUNT }, (_, index) => <Skeleton key={index} height={44} sx={{ mb: 0.5 }} />)}
        {!loading && !items.length && <WidgetEmpty icon={mdiTextBoxSearchOutline} text="No transactions yet" />}
        {!loading && items.map((item) => <RecentRow key={item.id} transaction={item} accounts={accountMap} categories={categoryMap} />)}
      </Box>
    </WidgetCard>
  );
}
