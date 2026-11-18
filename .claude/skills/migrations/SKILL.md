---
name: migrations
description: Use whenever a backend model (backend/app/*/models.py) changes, or a database migration is needed or mentioned. Migrations are never written or edited by hand; they are generated with Alembic autogenerate from the models.
---

# Database migrations are generated, never written

Every file in `backend/migrations/versions/` is produced by `alembic revision --autogenerate`. Nobody edits one by hand: not an old migration, and not the file autogenerate has just written.

## To change the schema

1. Change the SQLAlchemy models in `backend/app/<section>/models.py`.
2. If the models are in a new module, import it in `backend/migrations/env.py` next to the others. A module missing there makes autogenerate think its tables should be dropped.
3. From `backend/`, check that the database is current and that nothing else has drifted:

   ```sh
   uv run alembic upgrade head
   uv run alembic check          # "No new upgrade operations detected." before you change anything
   ```

4. Generate the revision. Keep the four-digit numbering: the next number after the newest file in `migrations/versions/`.

   ```sh
   uv run alembic revision --autogenerate --rev-id 0013 -m "payslips and notifications"
   ```

5. Read the generated file. It must contain only the change you meant.
6. Apply it and check again: `uv run alembic upgrade head`, then `uv run alembic check` must say "No new upgrade operations detected."
7. Run `uv run pytest`. The app also upgrades the database on every start (`app/migrate.py`).

## When the generated file is wrong

Do not edit it. Delete the uncommitted file, fix the cause (the models, a missing import in `env.py`, a type autogenerate cannot compare), and generate it again. If autogenerate truly cannot express the change, stop and ask the user. Do not hand-write the migration.

A migration that is already committed is never changed or deleted. To undo it, change the models back and generate a new revision.

## Design models so autogenerate can follow them

- Autogenerate does not detect changes to CHECK constraints. For a "kind" or "status" column whose values may grow, check the allowed values in the Pydantic schema (a `StrEnum`), not with a `CheckConstraint`. Existing CHECK constraints stay as they are.
- Give new columns on existing tables a `server_default`, or make them nullable, so existing rows can be upgraded.
- SQLite is used, and `env.py` sets `render_as_batch=True`, so column changes come out as batch operations. That is expected.
