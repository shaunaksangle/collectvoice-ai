from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

CAMPAIGN_STATUSES = {"draft", "ready", "paused", "completed", "archived"}
CAMPAIGN_TYPES = {"payment_follow_up", "reminder", "verification", "custom"}


class CampaignFilters(BaseModel):
    lender_name: str | None = None
    priority_filter: str | None = None
    status_filter: str | None = None
    assigned_agent_filter: str | None = None
    min_dpd: int | None = Field(default=None, ge=0)
    max_dpd: int | None = Field(default=None, ge=0)

    @model_validator(mode="after")
    def validate_dpd_range(self) -> "CampaignFilters":
        if self.min_dpd is not None and self.max_dpd is not None and self.min_dpd > self.max_dpd:
            raise ValueError("min_dpd cannot be greater than max_dpd")
        return self


class CampaignCreate(CampaignFilters):
    name: str
    description: str | None = None
    status: str = "draft"
    campaign_type: str = "custom"

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Campaign name is required")
        return cleaned

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str) -> str:
        cleaned = value.strip().lower()
        if cleaned not in CAMPAIGN_STATUSES:
            raise ValueError(f"status must be one of: {', '.join(sorted(CAMPAIGN_STATUSES))}")
        return cleaned

    @field_validator("campaign_type")
    @classmethod
    def validate_campaign_type(cls, value: str) -> str:
        cleaned = value.strip().lower()
        if cleaned not in CAMPAIGN_TYPES:
            raise ValueError(f"campaign_type must be one of: {', '.join(sorted(CAMPAIGN_TYPES))}")
        return cleaned


class CampaignUpdate(CampaignFilters):
    name: str | None = None
    description: str | None = None
    status: str | None = None
    campaign_type: str | None = None

    @field_validator("name")
    @classmethod
    def validate_optional_name(cls, value: str | None) -> str | None:
        if value is None:
            return value
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Campaign name cannot be blank")
        return cleaned

    @field_validator("status")
    @classmethod
    def validate_optional_status(cls, value: str | None) -> str | None:
        if value is None:
            return value
        cleaned = value.strip().lower()
        if cleaned not in CAMPAIGN_STATUSES:
            raise ValueError(f"status must be one of: {', '.join(sorted(CAMPAIGN_STATUSES))}")
        return cleaned

    @field_validator("campaign_type")
    @classmethod
    def validate_optional_campaign_type(cls, value: str | None) -> str | None:
        if value is None:
            return value
        cleaned = value.strip().lower()
        if cleaned not in CAMPAIGN_TYPES:
            raise ValueError(f"campaign_type must be one of: {', '.join(sorted(CAMPAIGN_TYPES))}")
        return cleaned


class CampaignResponse(BaseModel):
    id: str
    name: str
    description: str | None
    status: str
    campaign_type: str
    lender_name: str | None
    priority_filter: str | None
    status_filter: str | None
    assigned_agent_filter: str | None
    min_dpd: int | None
    max_dpd: int | None
    case_count: int
    created_at: datetime
    updated_at: datetime


class CampaignAttachedCase(BaseModel):
    id: str
    case_reference: str | None
    customer_name: str
    phone_number: str | None
    lender_name: str | None
    outstanding_amount: Decimal
    dpd: int | None
    priority: str
    status: str
    assigned_agent: str | None
    added_at: datetime | None = None


class CampaignDetailResponse(CampaignResponse):
    attached_cases: list[CampaignAttachedCase]


class CampaignListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: list[CampaignResponse]


class CampaignCaseAttachRequest(CampaignFilters):
    case_ids: list[str] | None = None

    model_config = ConfigDict(json_schema_extra={
        "examples": [
            {"case_ids": ["case-id-1", "case-id-2"]},
            {"lender_name": "Demo Bank", "priority_filter": "high", "min_dpd": 1},
        ]
    })


class CampaignCaseAttachResponse(BaseModel):
    added_count: int
    skipped_count: int
    missing_case_ids: list[str]
    duplicate_case_ids: list[str]
    added_case_ids: list[str]


class CampaignEligibleCasesResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: list[CampaignAttachedCase]


class CampaignSummaryResponse(BaseModel):
    total_campaigns: int
    draft_campaigns: int
    ready_campaigns: int
    paused_campaigns: int
    completed_campaigns: int
    total_cases_in_campaigns: int
