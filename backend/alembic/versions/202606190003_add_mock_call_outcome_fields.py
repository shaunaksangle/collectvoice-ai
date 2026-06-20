"""Add mock call outcome fields.

Revision ID: 202606190003
Revises: 202606190002
Create Date: 2026-06-19
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "202606190003"
down_revision = "202606190002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("call_outcomes", sa.Column("campaign_id", sa.String(length=36), nullable=True))
    op.add_column("call_outcomes", sa.Column("customer_id", sa.String(length=36), nullable=True))
    op.add_column("call_outcomes", sa.Column("transcript", sa.Text(), nullable=True))
    op.add_column("call_outcomes", sa.Column("detected_intent", sa.String(length=120), nullable=True))
    op.add_column("call_outcomes", sa.Column("promise_date", sa.Date(), nullable=True))
    op.add_column("call_outcomes", sa.Column("promise_amount", sa.Numeric(precision=12, scale=2), nullable=True))
    op.add_column(
        "call_outcomes",
        sa.Column("callback_required", sa.Boolean(), server_default=sa.text("false"), nullable=False),
    )
    op.add_column("call_outcomes", sa.Column("callback_reason", sa.Text(), nullable=True))
    op.add_column(
        "call_outcomes",
        sa.Column("human_review_required", sa.Boolean(), server_default=sa.text("false"), nullable=False),
    )
    op.create_foreign_key(
        "fk_call_outcomes_campaign_id_campaigns",
        "call_outcomes",
        "campaigns",
        ["campaign_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_call_outcomes_customer_id_customers",
        "call_outcomes",
        "customers",
        ["customer_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(op.f("ix_call_outcomes_campaign_id"), "call_outcomes", ["campaign_id"], unique=False)
    op.create_index(op.f("ix_call_outcomes_customer_id"), "call_outcomes", ["customer_id"], unique=False)

    op.add_column("promise_to_pay", sa.Column("customer_id", sa.String(length=36), nullable=True))
    op.add_column(
        "promise_to_pay",
        sa.Column("source", sa.String(length=80), server_default="mock_call", nullable=False),
    )
    op.create_foreign_key(
        "fk_promise_to_pay_customer_id_customers",
        "promise_to_pay",
        "customers",
        ["customer_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(op.f("ix_promise_to_pay_customer_id"), "promise_to_pay", ["customer_id"], unique=False)

    op.add_column("human_callbacks", sa.Column("customer_id", sa.String(length=36), nullable=True))
    op.add_column(
        "human_callbacks",
        sa.Column("priority", sa.String(length=50), server_default="normal", nullable=False),
    )
    op.add_column("human_callbacks", sa.Column("assigned_agent", sa.String(length=255), nullable=True))
    op.add_column("human_callbacks", sa.Column("notes", sa.Text(), nullable=True))
    op.create_foreign_key(
        "fk_human_callbacks_customer_id_customers",
        "human_callbacks",
        "customers",
        ["customer_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(op.f("ix_human_callbacks_customer_id"), "human_callbacks", ["customer_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_human_callbacks_customer_id"), table_name="human_callbacks")
    op.drop_constraint("fk_human_callbacks_customer_id_customers", "human_callbacks", type_="foreignkey")
    op.drop_column("human_callbacks", "notes")
    op.drop_column("human_callbacks", "assigned_agent")
    op.drop_column("human_callbacks", "priority")
    op.drop_column("human_callbacks", "customer_id")

    op.drop_index(op.f("ix_promise_to_pay_customer_id"), table_name="promise_to_pay")
    op.drop_constraint("fk_promise_to_pay_customer_id_customers", "promise_to_pay", type_="foreignkey")
    op.drop_column("promise_to_pay", "source")
    op.drop_column("promise_to_pay", "customer_id")

    op.drop_index(op.f("ix_call_outcomes_customer_id"), table_name="call_outcomes")
    op.drop_index(op.f("ix_call_outcomes_campaign_id"), table_name="call_outcomes")
    op.drop_constraint("fk_call_outcomes_customer_id_customers", "call_outcomes", type_="foreignkey")
    op.drop_constraint("fk_call_outcomes_campaign_id_campaigns", "call_outcomes", type_="foreignkey")
    op.drop_column("call_outcomes", "human_review_required")
    op.drop_column("call_outcomes", "callback_reason")
    op.drop_column("call_outcomes", "callback_required")
    op.drop_column("call_outcomes", "promise_amount")
    op.drop_column("call_outcomes", "promise_date")
    op.drop_column("call_outcomes", "detected_intent")
    op.drop_column("call_outcomes", "transcript")
    op.drop_column("call_outcomes", "customer_id")
    op.drop_column("call_outcomes", "campaign_id")
