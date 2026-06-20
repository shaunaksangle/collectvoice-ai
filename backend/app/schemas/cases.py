from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, Field


class CaseListItem(BaseModel):
    id: str
    case_reference: str | None
    customer_name: str
    phone_number: str | None
    lender_name: str | None
    outstanding_amount: Decimal
    emi_amount: Decimal | None
    due_date: date | None
    dpd: int | None
    priority: str
    assigned_agent: str | None
    status: str
    city: str | None
    state: str | None
    email: str | None


class CaseDetail(CaseListItem):
    principal_amount: Decimal
    currency: str
    alternate_phone: str | None
    created_at: datetime
    updated_at: datetime


class PaginatedCaseList(BaseModel):
    total: int
    page: int
    page_size: int
    items: list[CaseListItem]


class CaseSummary(BaseModel):
    total_cases: int
    total_outstanding: int | float
    active_cases: int
    overdue_cases: int
    high_priority_cases: int
    missing_phone_cases: int

    model_config = {
        "json_schema_extra": {
            "example": {
                "total_cases": 0,
                "total_outstanding": 0,
                "active_cases": 0,
                "overdue_cases": 0,
                "high_priority_cases": 0,
                "missing_phone_cases": 0,
            }
        }
    }


class UploadValidationError(BaseModel):
    row_number: int
    field: str
    issue: str
    original_value: Any = None


class CaseUploadPreview(BaseModel):
    total_rows: int
    valid_rows: int
    invalid_rows: int
    duplicate_rows: int
    errors: list[UploadValidationError]
    normalized_columns: dict[str, str] = Field(
        description="Mapping from uploaded column names to CollectVoice AI canonical fields."
    )
    preview_data: list[dict[str, Any]]


class SavedCaseReference(BaseModel):
    id: str
    case_reference: str


class CaseUploadCommit(BaseModel):
    total_rows: int
    saved_rows: int
    skipped_rows: int
    invalid_rows: int
    duplicate_rows: int
    errors: list[UploadValidationError]
    saved_cases: list[SavedCaseReference]
    existing_case_references: list[str]
    message: str
