"""Transactions record what made them (source, source_ref) and which others were made with them (group_id).

Revision ID: 0009
Revises: 0008
"""

import sqlalchemy as sa
from alembic import op

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("transactions") as batch:
        batch.add_column(sa.Column("source", sa.String(16), nullable=False, server_default="manual"))
        batch.add_column(sa.Column("source_ref", sa.String(128), nullable=True))
        batch.add_column(sa.Column("group_id", sa.String(36), nullable=True))
        batch.create_check_constraint(
            "ck_transactions_source", "source IN ('manual', 'sms', 'salary', 'epfo', 'schedule')"
        )
    op.create_index("ix_transactions_group_id", "transactions", ["group_id"])
    op.create_index(
        "ux_transactions_user_id_source_source_ref", "transactions", ["user_id", "source", "source_ref"], unique=True
    )


def downgrade() -> None:
    op.drop_index("ux_transactions_user_id_source_source_ref", "transactions")
    op.drop_index("ix_transactions_group_id", "transactions")
    with op.batch_alter_table("transactions") as batch:
        batch.drop_constraint("ck_transactions_source", type_="check")
        batch.drop_column("group_id")
        batch.drop_column("source_ref")
        batch.drop_column("source")
