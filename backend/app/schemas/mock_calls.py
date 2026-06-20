from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator

MOCK_CALL_OUTCOME_TYPES = {
    "promise_to_pay",
    "already_paid",
    "callback_requested",
    "no_answer",
    "wrong_number",
    "dispute",
    "refused_to_pay",
    "unreachable",
}


class MockCallRunRequest(BaseModel):
    outcome_type: str = "promise_to_pay"
    promise_date: date | None = None
    promise_amount: Decimal | None = Field(default=None, ge=0)
    callback_reason: str | None = None
    notes: str | None = None

    @field_validator("outcome_type")
    @classmethod
    def validate_outcome_type(cls, value: str) -> str:
        cleaned = value.strip().lower()
        if cleaned not in MOCK_CALL_OUTCOME_TYPES:
            raise ValueError(f"outcome_type must be one of: {', '.join(sorted(MOCK_CALL_OUTCOME_TYPES))}")
        return cleaned

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "outcome_type": "promise_to_pay",
                    "promise_date": "2026-06-25",
                    "promise_amount": 2500,
                    "notes": "Customer requested a reminder before payment date.",
                },
                {
                    "outcome_type": "callback_requested",
                    "callback_reason": "Customer asked for a manager callback in the evening.",
                },
            ]
        }
    )


class MockCallOutcomeResponse(BaseModel):
    id: str
    outcome_type: str
    disposition: str | None
    summary: str | None
    transcript: str | None
    detected_intent: str | None
    sentiment: str | None
    promise_date: date | None
    promise_amount: Decimal | None
    callback_required: bool
    callback_reason: str | None
    human_review_required: bool
    created_at: datetime
    updated_at: datetime


class MockCallRunResponse(BaseModel):
    call_attempt_id: str
    final_status: str
    outcome: MockCallOutcomeResponse
    promise_to_pay_id: str | None = None
    human_callback_id: str | None = None
    transcript: str


class MockCallOutcomeListItem(BaseModel):
    id: str
    call_attempt_id: str
    campaign_id: str | None
    campaign_name: str | None
    case_id: str
    case_reference: str | None
    customer_id: str | None
    customer_name: str | None
    phone_number: str | None
    outcome_type: str
    disposition: str | None
    summary: str | None
    detected_intent: str | None
    sentiment: str | None
    promise_date: date | None
    promise_amount: Decimal | None
    callback_required: bool
    callback_reason: str | None
    human_review_required: bool
    created_at: datetime


class MockCallOutcomeListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: list[MockCallOutcomeListItem]


class MockCallOutcomeDetailResponse(MockCallOutcomeListItem):
    transcript: str | None
    next_action: str | None
    call_attempt_status: str | None
    scheduled_at: datetime | None
    started_at: datetime | None
    ended_at: datetime | None
    updated_at: datetime


class MockCallSummaryResponse(BaseModel):
    total_outcomes: int
    completed_calls: int
    failed_calls: int
    promise_to_pay_count: int
    already_paid_count: int
    callback_required_count: int
    no_answer_count: int
    wrong_number_count: int
    dispute_count: int
    refused_to_pay_count: int
    unreachable_count: int

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "total_outcomes": 0,
                "completed_calls": 0,
                "failed_calls": 0,
                "promise_to_pay_count": 0,
                "already_paid_count": 0,
                "callback_required_count": 0,
                "no_answer_count": 0,
                "wrong_number_count": 0,
                "dispute_count": 0,
                "refused_to_pay_count": 0,
                "unreachable_count": 0,
            }
        }
    )


class MockCallBatchRequest(BaseModel):
    limit: int = Field(default=5, ge=1, le=50)
    campaign_id: str | None = None
    status: str | None = "pending"
    outcome_type: str | None = None
    dry_run: bool = False

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str | None) -> str | None:
        if value is None:
            return value

        cleaned = value.strip().lower()
        if cleaned not in {"pending", "scheduled"}:
            raise ValueError("status must be pending or scheduled")
        return cleaned

    @field_validator("outcome_type")
    @classmethod
    def validate_optional_outcome_type(cls, value: str | None) -> str | None:
        if value is None:
            return value

        cleaned = value.strip().lower()
        if cleaned not in MOCK_CALL_OUTCOME_TYPES:
            raise ValueError(f"outcome_type must be one of: {', '.join(sorted(MOCK_CALL_OUTCOME_TYPES))}")
        return cleaned

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {"limit": 5, "status": "pending", "dry_run": True},
                {"limit": 10, "campaign_id": "campaign-id", "status": "scheduled", "outcome_type": "no_answer"},
            ]
        }
    )


class MockCallBatchError(BaseModel):
    call_attempt_id: str
    issue: str


class MockCallBatchResponse(BaseModel):
    dry_run: bool
    selected_count: int
    processed_count: int
    completed_count: int
    failed_count: int
    promise_to_pay_count: int
    callback_required_count: int
    skipped_count: int
    processed_call_attempt_ids: list[str]
    skipped_call_attempt_ids: list[str]
    errors: list[MockCallBatchError]
