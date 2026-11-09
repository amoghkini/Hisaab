# Backend

Python + FastAPI + SQLAlchemy. Uses SQLite by default (`hisaab.db` in this folder, created on first start).

Will hold the ingest API, raw SMS store, message classifier, per-bank parser templates, categorization, and the core ledger (accounts, categories, transactions, drafts).

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
