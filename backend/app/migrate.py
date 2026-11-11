from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import inspect
from sqlalchemy.engine import Engine

MIGRATIONS = Path(__file__).resolve().parent.parent / "migrations"

# Databases made before migrations existed already have the tables of this revision.
FIRST_REVISION = "0001"


def upgrade_database(engine: Engine) -> None:
    """Bring the database schema up to date. Runs on every start; it does nothing when already current."""
    config = Config()
    config.set_main_option("script_location", str(MIGRATIONS))
    with engine.begin() as connection:
        config.attributes["connection"] = connection
        tables = set(inspect(connection).get_table_names())
        if "users" in tables and "alembic_version" not in tables:
            command.stamp(config, FIRST_REVISION)
        command.upgrade(config, "head")
