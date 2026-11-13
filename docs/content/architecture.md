# Architecture: investments, salary, taxes, cards, budgets and net worth

Status: **planned**. Only the foundations marked *built* exist today. This page records the design so each section can be added later without reshaping the ledger.

## The rule: one ledger

Accounts and transactions are the only place money lives. EPF, PPF, NPS, an FD, an RD, a home loan, a credit card, a flat and a car are all **accounts**. They appear on the Accounts page and count in net worth.

The new sections are workflows and views on top of the ledger. They write money movements as ordinary transactions, so the dashboard, balances and net worth stay right with no syncing.

| Section | Owns | Writes to the ledger |
|---|---|---|
| Accounts (built) | balances, every kind of account | — |
| Investments | EPF/PPF/NPS/FD/RD/fund details, market values, EPFO sync | contributions, interest, maturity payouts |
| Salary | employers, salary structures, payslips | net pay to the bank, PF into the EPF account |
| Taxes | financial years, TDS, deductions | nothing; reads only |
| Loans and cards (under Accounts) | loan details, cards, card statements | EMIs, bill payments |
| Planning | budgets, subscriptions, upcoming bills | scheduled transactions (subscriptions, bills) |
| Wealth | net worth history, physical assets, insurance policies | premiums; valuations are not transactions |
| Markets | index quotes, movers, sector trends | nothing; market data only |

Dependencies point one way: `salary`, `investments`, `tax`, `schedules`, `budgets`, `cards`, `assets`, `insurance` and `sync` call the ledger (`accounts`, `transactions`). The ledger never imports them. Each gets its own backend package under `backend/app/`.

## Navigation

Transactions · **Accounts ▾** · **Planning ▾** · **Wealth ▾** · **Salary ▾** · **Taxes ▾** · **Stats ▾** · Markets (*built*)

| Item | Entries |
|---|---|
| Accounts | All accounts (*built*), Credit cards, Debit cards, Loans |
| Planning | Budgets, Subscriptions, Upcoming bills |
| Wealth | Net worth; Investments (Portfolio, EPF, PPF and NPS, FDs and RDs, mutual funds and stocks, Sync from EPFO); Property and vehicles; Insurance |
| Salary | Payslips, Add a payslip, Employers and salary structure |
| Taxes | Tax summary, TDS and taxes paid, Deductions, Old vs new regime |
| Stats | Spending by category, Income vs expense, Trends, Monthly report |

- There is no Overview item: the logo goes to the dashboard at `/`.
- The dropdowns open on hover (`HoverMenu`). Entries not built yet say "not available yet".
- The items live in `NAV` in `web/src/layouts/AppLayout.tsx`. When a page is built, give its entry a `to` and add the route.
- The top level stays at seven items; new pages go into a dropdown.

Loans and cards stay under Accounts, with a detail page per account (the enquiry page, *built* as a placeholder) for EMI schedules, statements and bank details such as the CIF number.

## Transaction provenance (*built*, migration 0009)

| Column | Meaning |
|---|---|
| `source` | What made it: `manual`, `sms`, `salary`, `epfo`, `schedule`. Defaults to `manual`. |
| `source_ref` | The entry's id in its source, such as an EPFO passbook line. Unique per `(user_id, source)`, so an import can run again without duplicates. |
| `group_id` | Shared by transactions made together (a payslip's lines, a loan EMI's principal and interest), so they are edited or deleted together. |

Transactions with a `source` other than `manual` should be edited through the section that made them. The API does not enforce this yet.

## Account kinds: details in their own tables

New kinds go in `AccountCategory`: `epf`, `ppf`, `nps`, `recurring_deposit`, `mutual_fund`, `stocks`, and for things owned, `property`, `vehicle`, `gold`, `other_asset` and `insurance` (policies with a surrender value). Each is a small migration of the CHECK constraint.

Kind-specific fields do **not** go on `accounts`. Each kind that needs them gets an optional one-to-one table keyed by `account_id`:

- `epf_details`: UAN, member id, establishment, employee/employer/pension split
- `loan_details`: principal, interest rate, tenure, EMI, start date, lender
- `deposit_details` (FD and RD): principal or instalment, rate, compounding, start and maturity dates, payout account
- `card_details`: credit limit, statement day, due day. `credit_limit` and `statement_day` move here from `accounts` later. See [Cards](#cards).
- `bank_details`: CIF number, account holder, full account number (stored encrypted, shown masked), IFSC, branch, MICR, nominee, registered mobile and email. Shown on the account enquiry page.
- `asset_details`: see [Physical assets](#physical-assets).

## Salary

- `employers` → `salary_structures` (each with an effective-from date, since pay changes) → `salary_components`.
- A component is an **earning**, a **deduction** or an **employer contribution**. Its destination is an account (salary bank, EPF, NPS) or a tax head (TDS, professional tax).
- `payslips` (one per month per employer) → `payslip_lines` (amount per component). The form fills from the structure in force that month; the user adjusts and posts.
- Posting creates one transaction group (`source='salary'`):
    - income of the net pay into the salary account
    - income into the EPF account for employee and employer PF
    - `tax_entries` for TDS and professional tax
- Editing a payslip replaces its group; deleting it removes the group.

## Taxes

- `tax_entries`: financial year (April–March), kind (`tds`, `advance`, `self_assessment`), amount, and a link to the payslip or transaction that made it.
- Deductions are **computed**, not entered twice: for example 80C = employee EPF + PPF + ELSS + home-loan principal in the year, read from transactions by account kind. A rule table maps account kinds and categories to sections (80C, 80D, 24(b), 80CCD(1B)).
- Pages: yearly summary, TDS and taxes paid, deductions, old vs new regime.

## Investments

- Balance-based assets (EPF, PPF, FD, RD): the transactions give the balance; interest is one more credit.
- Market-value assets (mutual funds, stocks, NPS): `account_valuations` (account, date, value). The page shows invested vs current value; net worth uses the latest valuation.

## Recurring schedules

One engine for RD instalments, SIPs, loan EMIs and recurring bills: `schedules` holds a rule (monthly on day N, from/until) and a transaction template. Each run makes transactions with `source='schedule'`. An EMI makes two in one group: a transfer of the principal to the loan account and an interest expense.

## EPFO sync

- `connections` (provider, encrypted credentials) and `sync_runs` (when, result, counts).
- Imported passbook lines become **draft** transactions with `source='epfo'` and `source_ref` set. The user approves them into the ledger, the same flow as bank SMS.
- The EPFO portal uses captcha and OTP, so unattended fetching will be fragile. Uploading the passbook PDF is the fallback and should be built first.

## Cards

Credit and debit cards are different things:

- A **credit card is an account** (a liability) and already exists. A **debit card is not an account**: it is a way to pay from a bank account.
- `cards`: kind (`credit`, `debit`), `account_id` (the card's own account for credit; the bank account for debit), name on card, last four digits, network (Visa, Mastercard, RuPay, Amex), expiry month and year, and limits (daily ATM, POS, online, international on or off). An account can have several cards, such as add-on cards.
- `card_details` (credit cards): credit limit, statement day, due day, annual fee and the spend that waives it, reward programme and points balance.
- `card_statements`: one per billing cycle per credit card: period, statement date, total due, minimum due, due date, amount paid, status (`unpaid`, `partly_paid`, `paid`). A bill payment is an ordinary transfer from a bank account to the card account, linked to its statement.
- Transactions get an optional `card_id`: which card paid. It matches bank SMS ("card XX1234") and shows which card pays each subscription.
- **Never store** the full card number, the CVV or the PIN. The last four digits and the expiry are enough.
- Pages: **Credit cards** (utilisation, upcoming due dates, unpaid statements, fee waiver progress, rewards) and **Debit cards** (cards per bank account, expiry, limits).

## Subscriptions and upcoming bills

The engine in [Recurring schedules](#recurring-schedules) also runs subscriptions, bills and premiums.

- A **subscription** is a schedule with `kind='subscription'` and its own fields: service name, billing cycle (monthly, quarterly, yearly), next renewal date, the account or card that pays, free-trial end, and a cancel-by reminder.
- **Upcoming bills** lists every schedule due in the next 7 or 30 days: subscriptions, EMIs, insurance premiums, rent, utilities and card due dates.
- The **Subscriptions** page shows the monthly and yearly cost in total and per service, renewals coming up, and trials ending soon.
- Later: suggest subscriptions found in the transactions (the same description and amount every month).

## Budgets

Budgets only read the ledger; spending is never entered twice.

- `budgets`: category (top-level or sub), period (`monthly` or `yearly`), amount, start month, optional end, and whether unspent money rolls over into the next period.
- Spent = expense transactions in the category (and its sub-categories) in the period. Transfers are not spending.
- The **Budgets** page: a progress bar per category with spent, left and the share of the period gone; warnings at 80% and 100%. A dashboard widget shows the same in brief.
- Yearly budgets are for costs that come once a year: insurance premiums, school fees, vehicle service.
- Later: **savings goals**: a target amount and date for an account (such as a car down payment), with the monthly saving needed to reach it.

## Net worth

Net worth is computed, not stored: assets minus liabilities over the accounts counted in totals.

- `net_worth_snapshots`: one row per user per month (and on demand): date, total assets, total liabilities, and the totals per account kind. A monthly job makes them and they are kept, so the history survives later edits to old transactions.
- Market-value accounts (funds, stocks, NPS, property, vehicles, gold) use their latest `account_valuations` row; the others use their ledger balance.
- The **Net worth** page: the trend over time, assets and liabilities by group (bank, investments, property and vehicles, loans, cards), and the change since last month.

## Physical assets

Property, vehicles, gold and other valuables are **accounts** of the new kinds, so they count in net worth.

- `asset_details`: purchase date, purchase price, co-owners and their share, and per kind:
    - property: address, type (flat, house, plot, commercial), area, registration number
    - vehicle: make, model, year, registration number, fuel, PUC expiry, last service date
    - gold: form (jewellery, coins, sovereign gold bonds), weight, purity
- Value over time is `account_valuations`, so a car depreciates and a flat appreciates. Buying the asset is a transfer from the bank (and the loan) into the asset account.
- `loan_details.asset_account_id` links a loan to what it paid for (home loan → flat, car loan → car). The asset's page shows its **equity**: value minus the loan outstanding.
- The **Property and vehicles** page lists the assets with value, equity, linked loan and linked insurance, and reminders (PUC expiry, service due, property tax).

## Insurance

Most policies are **not assets**, so they get their own table, linked to the ledger and to what they cover.

- `insurance_policies`: type (`term`, `health`, `motor`, `home`, `life_savings`, `other`), insurer, policy number, plan name, insured people, sum assured, premium amount and frequency, start, renewal and maturity dates, nominees, and uploaded documents.
- Links:
    - `covers_account_id`: what the policy covers (motor → the vehicle, home → the property).
    - `paid_from_account_id`: where premiums come from. Each premium is a schedule, so it appears in Upcoming bills and posts an expense transaction.
- Policies with a **surrender or maturity value** (endowment, ULIP, money-back) also get an account of kind `insurance`, valued with `account_valuations`, so the value counts in net worth.
- Taxes read premiums for deductions: health → 80D, life → 80C, through the rule table in [Taxes](#taxes).
- The **Insurance** page: policies by type, total cover, premiums due, renewals in the next 30 days, and assets with no cover.

## Build order

1. **Cards**: `cards`, `card_details`, `card_statements` and `card_id` on transactions. The credit card accounts already exist.
2. **Recurring schedules**: one engine for subscriptions, EMIs, premiums, SIPs and bills. Upcoming bills comes with it.
3. **Budgets**: read-only over transactions, so they are cheap to build.
4. **Physical assets and valuations**, then **Net worth** with its monthly snapshots.
5. **Insurance**, linked to assets, accounts and taxes.
