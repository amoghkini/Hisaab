"""Settings page: default account, financial year start, number display, and each session's device and last use.

Revision ID: 0010
Revises: 0009
"""

import sqlalchemy as sa
from alembic import op

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("users") as batch:
        batch.add_column(sa.Column("default_account_id", sa.Integer(), nullable=True))
        batch.add_column(sa.Column("fiscal_year_start_month", sa.SmallInteger(), nullable=False, server_default="4"))
        batch.add_column(sa.Column("digit_grouping", sa.String(16), nullable=False, server_default="indian"))
        batch.add_column(sa.Column("currency_display", sa.String(8), nullable=False, server_default="symbol"))
    with op.batch_alter_table("auth_sessions") as batch:
        batch.add_column(sa.Column("user_agent", sa.String(255), nullable=False, server_default=""))
        batch.add_column(sa.Column("last_seen_at", sa.DateTime(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("auth_sessions") as batch:
        batch.drop_column("last_seen_at")
        batch.drop_column("user_agent")
    with op.batch_alter_table("users") as batch:
        batch.drop_column("currency_display")
        batch.drop_column("digit_grouping")
        batch.drop_column("fiscal_year_start_month")
        batch.drop_column("default_account_id")
