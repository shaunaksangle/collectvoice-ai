from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.followups import (
    HumanCallbackDetailResponse,
    HumanCallbackListResponse,
    HumanCallbackSummaryResponse,
    HumanCallbackUpdateRequest,
)
from app.services.followups.callback_queries import (
    HumanCallbackNotFoundError,
    get_human_callback_detail,
    list_human_callbacks,
    summarize_human_callbacks,
    update_human_callback,
)

router = APIRouter()


@router.get("/summary", response_model=HumanCallbackSummaryResponse)
def get_human_callback_summary(db: Session = Depends(get_db)) -> dict:
    return summarize_human_callbacks(db)


@router.get("", response_model=HumanCallbackListResponse)
def get_human_callback_records(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    status_filter: str | None = Query(default=None, alias="status"),
    priority: str | None = Query(default=None),
    assigned_agent: str | None = Query(default=None),
    case_id: str | None = Query(default=None),
    customer_id: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> dict:
    return list_human_callbacks(
        db,
        page=page,
        page_size=page_size,
        status=status_filter,
        priority=priority,
        assigned_agent=assigned_agent,
        case_id=case_id,
        customer_id=customer_id,
    )


@router.get("/{callback_id}", response_model=HumanCallbackDetailResponse)
def get_human_callback_record(callback_id: str, db: Session = Depends(get_db)) -> dict:
    record = get_human_callback_detail(db, callback_id)
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Human callback record not found.")
    return record


@router.patch("/{callback_id}", response_model=HumanCallbackDetailResponse)
def update_human_callback_record(
    callback_id: str,
    payload: HumanCallbackUpdateRequest,
    db: Session = Depends(get_db),
) -> dict:
    try:
        return update_human_callback(db, callback_id, payload)
    except HumanCallbackNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
