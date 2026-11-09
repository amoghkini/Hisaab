from alembic import context
from sqlalchemy.engine import Connection

from app.auth import models as _auth_models  # noqa: F401  registers the tables
from app.categories import models as _category_models  # noqa: F401
from app.config import Settings
from app.db import Base, make_engine

target_metadata = Base.metadata


def _run(connection: Connection) -> None:
    # Batch mode lets ALTER TABLE work on SQLite.
    context.configure(connection=connection, target_metadata=target_metadata, render_as_batch=True)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations() -> None:
    # The app passes its own connection (app/migrate.py); the command line opens one from the settings.
    connection = context.config.attributes.get("connection")
    if connection is not None:
        _run(connection)
        return
    engine = make_engine(Settings().database_url)
    with engine.connect() as fresh:
        _run(fresh)
        fresh.commit()


if context.is_offline_mode():
    raise SystemExit("Offline (--sql) migrations are not supported.")
run_migrations()
