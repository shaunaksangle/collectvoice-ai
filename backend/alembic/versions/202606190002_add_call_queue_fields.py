"""Add call queue fields to call attempts.

Revision ID: 202606190002
Revises: 202606190001
Create Date: 2026-06-19
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "202606190002"
down_revision = "202606190001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("call_attempts", sa.Column("phone_number", sa.String(length=32), nullable=True))
    op.add_column("call_attempts", sa.Column("failure_reason", sa.Text(), nullable=True))
    op.add_column("call_attempts", sa.Column("last_error", sa.Text(), nullable=True))

    op.execute("UPDATE call_attempts SET status = 'pending' WHERE status = 'queued'")

    op.create_index(op.f("ix_call_attempts_phone_number"), "call_attempts", ["phone_number"], unique=False)
    op.create_index(op.f("ix_call_attempts_status"), "call_attempts", ["status"], unique=False)
    op.create_index(
        "uq_call_attempts_active_campaign_case",
        "call_attempts",
        ["campaign_id", "case_id"],
        unique=True,
        postgresql_where=sa.text("status IN ('pending', 'scheduled')"),
    )


def downgrade() -> None:
    op.drop_index("uq_call_attempts_active_campaign_case", table_name="call_attempts")
    op.drop_index(op.f("ix_call_attempts_status"), table_name="call_attempts")
    op.drop_index(op.f("ix_call_attempts_phone_number"), table_name="call_attempts")
    op.drop_column("call_attempts", "last_error")
    op.drop_column("call_attempts", "failure_reason")
    op.drop_column("call_attempts", "phone_number")
