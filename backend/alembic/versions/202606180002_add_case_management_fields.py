"""Add case management fields.

Revision ID: 202606180002
Revises: 202606180001
Create Date: 2026-06-18
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "202606180002"
down_revision = "202606180001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("customers", sa.Column("alternate_phone", sa.String(length=32), nullable=True))
    op.add_column("customers", sa.Column("city", sa.String(length=120), nullable=True))
    op.add_column("customers", sa.Column("state", sa.String(length=120), nullable=True))

    op.add_column("cases", sa.Column("emi_amount", sa.Numeric(precision=12, scale=2), nullable=True))
    op.add_column("cases", sa.Column("lender_name", sa.String(length=255), nullable=True))
    op.add_column("cases", sa.Column("dpd", sa.Integer(), nullable=True))
    op.add_column("cases", sa.Column("priority", sa.String(length=50), server_default="normal", nullable=False))
    op.add_column("cases", sa.Column("assigned_agent", sa.String(length=255), nullable=True))

    op.create_index(op.f("ix_cases_lender_name"), "cases", ["lender_name"], unique=False)
    op.create_index(op.f("ix_cases_priority"), "cases", ["priority"], unique=False)
    op.create_index(op.f("ix_cases_assigned_agent"), "cases", ["assigned_agent"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_cases_assigned_agent"), table_name="cases")
    op.drop_index(op.f("ix_cases_priority"), table_name="cases")
    op.drop_index(op.f("ix_cases_lender_name"), table_name="cases")

    op.drop_column("cases", "assigned_agent")
    op.drop_column("cases", "priority")
    op.drop_column("cases", "dpd")
    op.drop_column("cases", "lender_name")
    op.drop_column("cases", "emi_amount")

    op.drop_column("customers", "state")
    op.drop_column("customers", "city")
    op.drop_column("customers", "alternate_phone")
