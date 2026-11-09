"""Accounts: where money is kept or owed.

Revision ID: 0006
Revises: 0005
"""

import sqlalchemy as sa
from alembic import op

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None

CATEGORIES = (
    "'cash', 'savings', 'current', 'credit_card', 'wallet', 'loan', 'receivable', 'fixed_deposit', 'investment'"
)


def upgrade() -> None:
    op.create_table(
        "accounts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("category", sa.String(16), nullable=False),
        sa.Column("name", sa.String(64), nullable=False),
        sa.Column("icon", sa.String(64), nullable=False),
        sa.Column("color", sa.String(7), nullable=True),
        sa.Column("currency", sa.String(3), nullable=False),
        sa.Column("opening_balance", sa.BigInteger(), nullable=False),
        sa.Column("opening_balance_date", sa.Date(), nullable=True),
        sa.Column("number_suffix", sa.String(6), nullable=True),
        sa.Column("credit_limit", sa.BigInteger(), nullable=True),
        sa.Column("statement_day", sa.SmallInteger(), nullable=True),
        sa.Column("comment", sa.String(255), nullable=False),
        sa.Column("hidden", sa.Boolean(), nullable=False),
        sa.Column("include_in_total", sa.Boolean(), nullable=False),
        sa.Column("display_order", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.CheckConstraint(f"category IN ({CATEGORIES})", name="ck_accounts_category"),
    )
    op.create_index("ix_accounts_user_id", "accounts", ["user_id"])


def downgrade() -> None:
    op.drop_table("accounts")
