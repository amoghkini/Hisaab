# Backend

Python + FastAPI + SQLAlchemy. Uses SQLite by default (`hisaab.db` in this folder, created on first start).

Will hold the ingest API, raw SMS store, message classifier, per-bank parser templates, categorization, and the core ledger (accounts, categories, transactions, drafts).

Database settings are read from `HISAAB_*` environment variables (for example `HISAAB_DATABASE_URL`) or `backend/.env`.

## Run

```sh
cd backend
uv sync
uv run uvicorn app.main:app --reload --reload-dir app --reload-dir migrations --timeout-graceful-shutdown 1 --port 8000
```

API docs: http://localhost:8000/docs. Settings are in `.env.example`.

## Auth

| Endpoint                     | What it does                                  |
|------------------------------|-----------------------------------------------|
| `POST /api/v1/auth/sign-up`  | Create an account (name, email, password, `use_preset_categories`, and optional preferences) and sign in |
| `POST /api/v1/auth/sign-in`  | Sign in with email and password               |
| `POST /api/v1/auth/sign-out` | End this session                              |
| `GET /api/v1/auth/me`        | The signed-in user                            |
| `GET /api/v1/categories/presets` | The preset categories offered at sign-up (public) |
| `PATCH /api/v1/auth/me`      | Change preferences; send only what changes |
| `GET /api/v1/accounts`       | Every account, hidden ones too, by category and then the user's order |
| `POST /api/v1/accounts`      | Add an account |
| `GET /api/v1/accounts/summary` | Total assets, liabilities and net assets in the default currency |
| `GET/PATCH/DELETE /api/v1/accounts/{id}` | Read, change (send only what changes) or delete one account |
| `PUT /api/v1/accounts/order/{category}` | Reorder one category's accounts (`{"ids": [...]}`) |
| `GET /api/v1/categories`     | The user's categories as a tree (expense, income, transfer) |
| `POST /api/v1/categories/presets` | Add the preset categories, for a user who has none |
| `POST /api/v1/categories`    | Add a top-level category, or a sub-category with `parent_id` |
| `PATCH /api/v1/categories/{id}` | Rename, change icon or colour, hide or show, or move a sub-category to another group |
| `DELETE /api/v1/categories/{id}` | Delete a category and its sub-categories; refused while any has transactions |
| `PUT /api/v1/categories/order` | Reorder one type's top-level categories, or one group's sub-categories |
| `GET /api/v1/transactions?start=&end=` | Transactions in a date range (up to 366 days), newest first, with income and expense totals. Optional filters: `type`, `account_id`, `category_id`, `q` |
| `POST /api/v1/transactions`  | Add an expense, income or transfer |
| `GET/PUT/DELETE /api/v1/transactions/{id}` | Read, replace or delete one transaction |
| `GET /api/v1/overview/totals?start=&end=` | Income and expense in a date range (dashboard) |
| `GET /api/v1/overview/daily-amounts?start=&end=` | Income and expense for each day that has any |
| `GET /api/v1/overview/monthly-amounts?start_month=&end_month=` | Income and expense for each month, empty months included |
| `GET /api/v1/overview/expense-ranking?start=&end=&limit=` | Top-level expense categories by amount, with their share |

Preferences, with their defaults: `theme_color` (`#rrggbb`, or `null` for the default brown), `theme_mode` (`light`, `dark` or `system`; `system`), `default_currency` (ISO code, `INR`), `first_day_of_week` (0 = Sunday ... 6 = Saturday, `0`), `expense_amount_color` and `income_amount_color` (`green`, `red`, `yellow`, `blue` or `black_or_white`; `red` and `green`).

Signing in creates a session: a random token sent as an HttpOnly cookie, with only its SHA-256 hash stored. The Android app will send the same token as `Authorization: Bearer <token>`. Passwords are hashed with Argon2.

## Database migrations

Alembic, in `migrations/`. The app upgrades the database to the latest revision every time it starts, so there is nothing to run by hand. After changing a model, add a revision:

```sh
uv run alembic revision --autogenerate -m "what changed"
```

Review the generated file, then restart the app. A test (`tests/test_profile.py`) fails if the models and the migrations disagree.

## Checks

```sh
uv run pytest
uv run ruff check . && uv run ruff format --check .
```
