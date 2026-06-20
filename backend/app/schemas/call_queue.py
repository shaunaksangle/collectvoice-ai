from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator

CALL_ATTEMPT_STATUSES = {"pending", "scheduled", "in_progress", "completed", "failed", "skipped", "cancelled"}


class CallQueueGenerateRequest(BaseModel):
    scheduled_at: datetime | None = None

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {},
                {"scheduled_at": "2026-06-20T10:00:00+05:30"},
            ]
        }
    )


class CallQueueGenerateResponse(BaseModel):
    campaign_id: str
    total_campaign_cases: int
    created_count: int
    skipped_duplicate_count: int
    skipped_missing_phone_count: int
    created_call_attempt_ids: list[str]


class CallAttemptResponse(BaseModel):
    id: str
    campaign_id: str | None
    campaign_name: str | None
    case_id: str
    case_reference: str | None
    customer_id: str | None
    customer_name: str
    phone_number: str | None
    status: str
    attempt_number: int
    scheduled_at: datetime | None
    started_at: datetime | None
    ended_at: datetime | None
    provider_call_id: str | None
    failure_reason: str | None
    last_error: str | None
    lender_name: str | None
    priority: str
    assigned_agent: str | None
    outstanding_amount: Decimal
    created_at: datetime
    updated_at: datetime


class CallAttemptListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: list[CallAttemptResponse]


class CallAttemptUpdateRequest(BaseModel):
    status: str | None = None
    scheduled_at: datetime | None = None
    failure_reason: str | None = None
    last_error: str | None = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str | None) -> str | None:
        if value is None:
            return value

        cleaned = value.strip().lower()
        if cleaned not in CALL_ATTEMPT_STATUSES:
            raise ValueError(f"status must be one of: {', '.join(sorted(CALL_ATTEMPT_STATUSES))}")
        return cleaned


class CallQueueSummaryResponse(BaseModel):
    total_queue_items: int
    pending_calls: int
    scheduled_calls: int
    in_progress_calls: int
    completed_calls: int
    failed_calls: int
    cancelled_calls: int

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "total_queue_items": 0,
                "pending_calls": 0,
                "scheduled_calls": 0,
                "in_progress_calls": 0,
                "completed_calls": 0,
                "failed_calls": 0,
                "cancelled_calls": 0,
            }
        }
    )
