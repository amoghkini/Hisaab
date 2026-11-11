"""User preferences: default currency, first day of week, expense and income amount colours.

Revision ID: 0004
Revises: 0003
"""

import sqlalchemy as sa
from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Existing users get the same defaults as new ones.
    with op.batch_alter_table("users") as batch:
        batch.add_column(sa.Column("default_currency", sa.String(3), nullable=False, server_default="INR"))
        batch.add_column(sa.Column("first_day_of_week", sa.SmallInteger(), nullable=False, server_default="0"))
        batch.add_column(sa.Column("expense_amount_color", sa.String(16), nullable=False, server_default="red"))
        batch.add_column(sa.Column("income_amount_color", sa.String(16), nullable=False, server_default="green"))


def downgrade() -> None:
    with op.batch_alter_table("users") as batch:
        batch.drop_column("income_amount_color")
        batch.drop_column("expense_amount_color")
        batch.drop_column("first_day_of_week")
        batch.drop_column("default_currency")
