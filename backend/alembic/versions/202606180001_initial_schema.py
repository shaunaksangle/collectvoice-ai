"""Initial CollectVoice AI schema.

Revision ID: 202606180001
Revises:
Create Date: 2026-06-18
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "202606180001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("full_name", sa.String(length=255), nullable=False),
        sa.Column("role", sa.String(length=50), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=False)

    op.create_table(
        "customers",
        sa.Column("external_id", sa.String(length=100), nullable=True),
        sa.Column("full_name", sa.String(length=255), nullable=False),
        sa.Column("phone_number", sa.String(length=32), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("preferred_language", sa.String(length=20), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("external_id"),
    )
    op.create_index(op.f("ix_customers_external_id"), "customers", ["external_id"], unique=False)
    op.create_index(op.f("ix_customers_phone_number"), "customers", ["phone_number"], unique=False)

    op.create_table(
        "audit_logs",
        sa.Column("actor_user_id", sa.String(length=36), nullable=True),
        sa.Column("entity_type", sa.String(length=80), nullable=False),
        sa.Column("entity_id", sa.String(length=36), nullable=True),
        sa.Column("action", sa.String(length=100), nullable=False),
        sa.Column("details", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_audit_logs_entity_id"), "audit_logs", ["entity_id"], unique=False)
    op.create_index(op.f("ix_audit_logs_entity_type"), "audit_logs", ["entity_type"], unique=False)

    op.create_table(
        "campaigns",
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=50), nullable=False),
        sa.Column("scheduled_start", sa.DateTime(timezone=True), nullable=True),
        sa.Column("scheduled_end", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by_user_id", sa.String(length=36), nullable=True),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "cases",
        sa.Column("customer_id", sa.String(length=36), nullable=False),
        sa.Column("external_reference", sa.String(length=100), nullable=True),
        sa.Column("principal_amount", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("outstanding_amount", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("status", sa.String(length=50), nullable=False),
        sa.Column("metadata", sa.JSON(), nullable=False),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["customer_id"], ["customers.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("external_reference"),
    )
    op.create_index(op.f("ix_cases_customer_id"), "cases", ["customer_id"], unique=False)
    op.create_index(op.f("ix_cases_external_reference"), "cases", ["external_reference"], unique=False)

    op.create_table(
        "call_attempts",
        sa.Column("case_id", sa.String(length=36), nullable=False),
        sa.Column("customer_id", sa.String(length=36), nullable=False),
        sa.Column("campaign_id", sa.String(length=36), nullable=True),
        sa.Column("provider", sa.String(length=50), nullable=False),
        sa.Column("provider_call_id", sa.String(length=255), nullable=True),
        sa.Column("status", sa.String(length=50), nullable=False),
        sa.Column("attempt_number", sa.Integer(), nullable=False),
        sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("transcript", sa.Text(), nullable=True),
        sa.Column("recording_url", sa.String(length=500), nullable=True),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["campaign_id"], ["campaigns.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["case_id"], ["cases.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["customer_id"], ["customers.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_call_attempts_campaign_id"), "call_attempts", ["campaign_id"], unique=False)
    op.create_index(op.f("ix_call_attempts_case_id"), "call_attempts", ["case_id"], unique=False)
    op.create_index(op.f("ix_call_attempts_customer_id"), "call_attempts", ["customer_id"], unique=False)
    op.create_index(op.f("ix_call_attempts_provider_call_id"), "call_attempts", ["provider_call_id"], unique=False)

    op.create_table(
        "call_outcomes",
        sa.Column("call_attempt_id", sa.String(length=36), nullable=False),
        sa.Column("case_id", sa.String(length=36), nullable=False),
        sa.Column("outcome_type", sa.String(length=80), nullable=False),
        sa.Column("disposition", sa.String(length=80), nullable=True),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("sentiment", sa.String(length=50), nullable=True),
        sa.Column("next_action", sa.String(length=120), nullable=True),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["call_attempt_id"], ["call_attempts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["case_id"], ["cases.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("call_attempt_id"),
    )
    op.create_index(op.f("ix_call_outcomes_case_id"), "call_outcomes", ["case_id"], unique=False)

    op.create_table(
        "human_callbacks",
        sa.Column("case_id", sa.String(length=36), nullable=False),
        sa.Column("call_attempt_id", sa.String(length=36), nullable=True),
        sa.Column("assigned_user_id", sa.String(length=36), nullable=True),
        sa.Column("requested_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("preferred_time", sa.DateTime(timezone=True), nullable=True),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=50), nullable=False),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["assigned_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["call_attempt_id"], ["call_attempts.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["case_id"], ["cases.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_human_callbacks_case_id"), "human_callbacks", ["case_id"], unique=False)

    op.create_table(
        "promise_to_pay",
        sa.Column("case_id", sa.String(length=36), nullable=False),
        sa.Column("call_attempt_id", sa.String(length=36), nullable=True),
        sa.Column("promised_amount", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("promised_date", sa.Date(), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["call_attempt_id"], ["call_attempts.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["case_id"], ["cases.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_promise_to_pay_case_id"), "promise_to_pay", ["case_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_promise_to_pay_case_id"), table_name="promise_to_pay")
    op.drop_table("promise_to_pay")
    op.drop_index(op.f("ix_human_callbacks_case_id"), table_name="human_callbacks")
    op.drop_table("human_callbacks")
    op.drop_index(op.f("ix_call_outcomes_case_id"), table_name="call_outcomes")
    op.drop_table("call_outcomes")
    op.drop_index(op.f("ix_call_attempts_provider_call_id"), table_name="call_attempts")
    op.drop_index(op.f("ix_call_attempts_customer_id"), table_name="call_attempts")
    op.drop_index(op.f("ix_call_attempts_case_id"), table_name="call_attempts")
    op.drop_index(op.f("ix_call_attempts_campaign_id"), table_name="call_attempts")
    op.drop_table("call_attempts")
    op.drop_index(op.f("ix_cases_external_reference"), table_name="cases")
    op.drop_index(op.f("ix_cases_customer_id"), table_name="cases")
    op.drop_table("cases")
    op.drop_table("campaigns")
    op.drop_index(op.f("ix_audit_logs_entity_type"), table_name="audit_logs")
    op.drop_index(op.f("ix_audit_logs_entity_id"), table_name="audit_logs")
    op.drop_table("audit_logs")
    op.drop_index(op.f("ix_customers_phone_number"), table_name="customers")
    op.drop_index(op.f("ix_customers_external_id"), table_name="customers")
    op.drop_table("customers")
    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_table("users")
