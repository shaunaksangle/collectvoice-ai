"""Add campaign management fields and campaign cases.

Revision ID: 202606190001
Revises: 202606180002
Create Date: 2026-06-19
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "202606190001"
down_revision = "202606180002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("campaigns", sa.Column("campaign_type", sa.String(length=80), server_default="custom", nullable=False))
    op.add_column("campaigns", sa.Column("lender_name", sa.String(length=255), nullable=True))
    op.add_column("campaigns", sa.Column("priority_filter", sa.String(length=50), nullable=True))
    op.add_column("campaigns", sa.Column("status_filter", sa.String(length=50), nullable=True))
    op.add_column("campaigns", sa.Column("assigned_agent_filter", sa.String(length=255), nullable=True))
    op.add_column("campaigns", sa.Column("min_dpd", sa.Integer(), nullable=True))
    op.add_column("campaigns", sa.Column("max_dpd", sa.Integer(), nullable=True))
    op.create_index(op.f("ix_campaigns_lender_name"), "campaigns", ["lender_name"], unique=False)

    op.create_table(
        "campaign_cases",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("campaign_id", sa.String(length=36), nullable=False),
        sa.Column("case_id", sa.String(length=36), nullable=False),
        sa.Column("added_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["campaign_id"], ["campaigns.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["case_id"], ["cases.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("campaign_id", "case_id", name="uq_campaign_cases_campaign_id_case_id"),
    )
    op.create_index(op.f("ix_campaign_cases_campaign_id"), "campaign_cases", ["campaign_id"], unique=False)
    op.create_index(op.f("ix_campaign_cases_case_id"), "campaign_cases", ["case_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_campaign_cases_case_id"), table_name="campaign_cases")
    op.drop_index(op.f("ix_campaign_cases_campaign_id"), table_name="campaign_cases")
    op.drop_table("campaign_cases")

    op.drop_index(op.f("ix_campaigns_lender_name"), table_name="campaigns")
    op.drop_column("campaigns", "max_dpd")
    op.drop_column("campaigns", "min_dpd")
    op.drop_column("campaigns", "assigned_agent_filter")
    op.drop_column("campaigns", "status_filter")
    op.drop_column("campaigns", "priority_filter")
    op.drop_column("campaigns", "lender_name")
    op.drop_column("campaigns", "campaign_type")
