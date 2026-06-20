from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.call_queue import (
    CallAttemptListResponse,
    CallAttemptResponse,
    CallAttemptUpdateRequest,
    CallQueueGenerateRequest,
    CallQueueGenerateResponse,
    CallQueueSummaryResponse,
)
from app.services.call_queue.call_queue_queries import (
    get_call_attempt_detail,
    list_call_attempts,
    summarize_call_queue,
)
from app.services.call_queue.call_queue_service import (
    CallAttemptNotFoundError,
    CampaignNotFoundError,
    EmptyCampaignError,
    InvalidCallAttemptStateError,
    cancel_call_attempt,
    generate_call_queue,
    update_call_attempt,
)

router = APIRouter()


@router.post("/generate/{campaign_id}", response_model=CallQueueGenerateResponse)
def generate_campaign_call_queue(
    campaign_id: str,
    payload: CallQueueGenerateRequest | None = None,
    db: Session = Depends(get_db),
) -> dict:
    try:
        return generate_call_queue(db, campaign_id, payload or CallQueueGenerateRequest())
    except CampaignNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except EmptyCampaignError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/summary", response_model=CallQueueSummaryResponse)
def get_call_queue_summary(db: Session = Depends(get_db)) -> dict:
    return summarize_call_queue(db)


@router.get("", response_model=CallAttemptListResponse)
def get_call_queue(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    campaign_id: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    priority: str | None = Query(default=None),
    assigned_agent: str | None = Query(default=None),
    lender_name: str | None = Query(default=None),
    scheduled_from: datetime | None = Query(default=None),
    scheduled_to: datetime | None = Query(default=None),
    db: Session = Depends(get_db),
) -> dict:
    return list_call_attempts(
        db,
        page=page,
        page_size=page_size,
        campaign_id=campaign_id,
        status=status_filter,
        priority=priority,
        assigned_agent=assigned_agent,
        lender_name=lender_name,
        scheduled_from=scheduled_from,
        scheduled_to=scheduled_to,
    )


@router.get("/{call_attempt_id}", response_model=CallAttemptResponse)
def get_call_queue_item(call_attempt_id: str, db: Session = Depends(get_db)) -> dict:
    call_attempt = get_call_attempt_detail(db, call_attempt_id)
    if call_attempt is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Call attempt not found.")
    return call_attempt


@router.patch("/{call_attempt_id}", response_model=CallAttemptResponse)
def update_call_queue_item(
    call_attempt_id: str,
    payload: CallAttemptUpdateRequest,
    db: Session = Depends(get_db),
) -> dict:
    try:
        return update_call_attempt(db, call_attempt_id, payload)
    except CallAttemptNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post("/{call_attempt_id}/cancel", response_model=CallAttemptResponse)
def cancel_call_queue_item(call_attempt_id: str, db: Session = Depends(get_db)) -> dict:
    try:
        return cancel_call_attempt(db, call_attempt_id)
    except CallAttemptNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except InvalidCallAttemptStateError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
