from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field, field_validator

PTP_STATUSES = {"pending", "fulfilled", "broken", "cancelled"}
CALLBACK_STATUSES = {"pending", "assigned", "completed", "cancelled"}
CALLBACK_PRIORITIES = {"low", "normal", "high", "critical"}


class PromiseToPayListItem(BaseModel):
    id: str
    case_id: str
    case_reference: str | None
    customer_id: str | None
    customer_name: str | None
    phone_number: str | None
    promised_amount: int | float
    promised_date: date
    status: str
    source: str
    notes: str | None
    lender_name: str | None
    assigned_agent: str | None
    created_at: datetime
    updated_at: datetime


class PromiseToPayDetailResponse(PromiseToPayListItem):
    call_attempt_id: str | None
    call_attempt_status: str | None
    scheduled_at: datetime | None
    started_at: datetime | None
    ended_at: datetime | None


class PromiseToPayListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: list[PromiseToPayListItem]


class PromiseToPayUpdateRequest(BaseModel):
    status: str | None = None
    promised_amount: Decimal | None = Field(default=None, ge=0)
    promised_date: date | None = None
    notes: str | None = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str | None) -> str | None:
        if value is None:
            return value

        cleaned = value.strip().lower()
        if cleaned not in PTP_STATUSES:
            raise ValueError(f"status must be one of: {', '.join(sorted(PTP_STATUSES))}")
        return cleaned


class PromiseToPaySummaryResponse(BaseModel):
    total_ptp: int
    pending_ptp: int
    fulfilled_ptp: int
    broken_ptp: int
    cancelled_ptp: int
    overdue_ptp: int
    total_promised_amount: int | float
    pending_promised_amount: int | float

    model_config = {
        "json_schema_extra": {
            "example": {
                "total_ptp": 0,
                "pending_ptp": 0,
                "fulfilled_ptp": 0,
                "broken_ptp": 0,
                "cancelled_ptp": 0,
                "overdue_ptp": 0,
                "total_promised_amount": 0,
                "pending_promised_amount": 0,
            }
        }
    }


class HumanCallbackListItem(BaseModel):
    id: str
    case_id: str
    case_reference: str | None
    customer_id: str | None
    customer_name: str | None
    phone_number: str | None
    reason: str | None
    priority: str
    status: str
    assigned_agent: str | None
    notes: str | None
    lender_name: str | None
    created_at: datetime
    updated_at: datetime


class HumanCallbackDetailResponse(HumanCallbackListItem):
    call_attempt_id: str | None
    call_attempt_status: str | None
    requested_at: datetime | None
    preferred_time: datetime | None
    scheduled_at: datetime | None
    started_at: datetime | None
    ended_at: datetime | None


class HumanCallbackListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: list[HumanCallbackListItem]


class HumanCallbackUpdateRequest(BaseModel):
    status: str | None = None
    priority: str | None = None
    assigned_agent: str | None = None
    notes: str | None = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str | None) -> str | None:
        if value is None:
            return value

        cleaned = value.strip().lower()
        if cleaned not in CALLBACK_STATUSES:
            raise ValueError(f"status must be one of: {', '.join(sorted(CALLBACK_STATUSES))}")
        return cleaned

    @field_validator("priority")
    @classmethod
    def validate_priority(cls, value: str | None) -> str | None:
        if value is None:
            return value

        cleaned = value.strip().lower()
        if cleaned not in CALLBACK_PRIORITIES:
            raise ValueError(f"priority must be one of: {', '.join(sorted(CALLBACK_PRIORITIES))}")
        return cleaned


class HumanCallbackSummaryResponse(BaseModel):
    total_callbacks: int
    pending_callbacks: int
    assigned_callbacks: int
    completed_callbacks: int
    cancelled_callbacks: int
    high_priority_callbacks: int

    model_config = {
        "json_schema_extra": {
            "example": {
                "total_callbacks": 0,
                "pending_callbacks": 0,
                "assigned_callbacks": 0,
                "completed_callbacks": 0,
                "cancelled_callbacks": 0,
                "high_priority_callbacks": 0,
            }
        }
    }
