from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.followups import (
    PromiseToPayDetailResponse,
    PromiseToPayListResponse,
    PromiseToPaySummaryResponse,
    PromiseToPayUpdateRequest,
)
from app.services.followups.ptp_queries import (
    PromiseToPayNotFoundError,
    get_promise_to_pay_detail,
    list_promise_to_pay,
    summarize_promise_to_pay,
    update_promise_to_pay,
)

router = APIRouter()


@router.get("/summary", response_model=PromiseToPaySummaryResponse)
def get_promise_to_pay_summary(db: Session = Depends(get_db)) -> dict:
    return summarize_promise_to_pay(db)


@router.get("", response_model=PromiseToPayListResponse)
def get_promise_to_pay_records(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    status_filter: str | None = Query(default=None, alias="status"),
    case_id: str | None = Query(default=None),
    customer_id: str | None = Query(default=None),
    assigned_agent: str | None = Query(default=None),
    due_from: date | None = Query(default=None),
    due_to: date | None = Query(default=None),
    overdue_only: bool = Query(default=False),
    db: Session = Depends(get_db),
) -> dict:
    return list_promise_to_pay(
        db,
        page=page,
        page_size=page_size,
        status=status_filter,
        case_id=case_id,
        customer_id=customer_id,
        assigned_agent=assigned_agent,
        due_from=due_from,
        due_to=due_to,
        overdue_only=overdue_only,
    )


@router.get("/{ptp_id}", response_model=PromiseToPayDetailResponse)
def get_promise_to_pay_record(ptp_id: str, db: Session = Depends(get_db)) -> dict:
    record = get_promise_to_pay_detail(db, ptp_id)
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Promise to pay record not found.")
    return record


@router.patch("/{ptp_id}", response_model=PromiseToPayDetailResponse)
def update_promise_to_pay_record(
    ptp_id: str,
    payload: PromiseToPayUpdateRequest,
    db: Session = Depends(get_db),
) -> dict:
    try:
        return update_promise_to_pay(db, ptp_id, payload)
    except PromiseToPayNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
