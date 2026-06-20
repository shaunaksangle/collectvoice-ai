from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.mock_calls import (
    MockCallBatchRequest,
    MockCallBatchResponse,
    MockCallOutcomeDetailResponse,
    MockCallOutcomeListResponse,
    MockCallRunRequest,
    MockCallRunResponse,
    MockCallSummaryResponse,
)
from app.services.mock_calls.mock_call_batch import run_mock_call_batch
from app.services.mock_calls.mock_call_queries import (
    get_mock_call_outcome_detail,
    list_mock_call_outcomes,
    summarize_mock_calls,
)
from app.services.mock_calls.mock_call_service import (
    CallAttemptNotFoundError,
    InvalidCallAttemptStateError,
    MockCallAlreadyRecordedError,
    run_mock_call,
)

router = APIRouter()


@router.get("/outcomes", response_model=MockCallOutcomeListResponse)
def get_mock_call_outcomes(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    outcome_type: str | None = Query(default=None),
    campaign_id: str | None = Query(default=None),
    case_id: str | None = Query(default=None),
    customer_id: str | None = Query(default=None),
    callback_required: bool | None = Query(default=None),
    human_review_required: bool | None = Query(default=None),
    db: Session = Depends(get_db),
) -> dict:
    return list_mock_call_outcomes(
        db,
        page=page,
        page_size=page_size,
        outcome_type=outcome_type,
        campaign_id=campaign_id,
        case_id=case_id,
        customer_id=customer_id,
        callback_required=callback_required,
        human_review_required=human_review_required,
    )


@router.get("/outcomes/{outcome_id}", response_model=MockCallOutcomeDetailResponse)
def get_mock_call_outcome(outcome_id: str, db: Session = Depends(get_db)) -> dict:
    outcome = get_mock_call_outcome_detail(db, outcome_id)
    if outcome is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Call outcome not found.")
    return outcome


@router.get("/summary", response_model=MockCallSummaryResponse)
def get_mock_call_summary(db: Session = Depends(get_db)) -> dict:
    return summarize_mock_calls(db)


@router.post("/run-batch", response_model=MockCallBatchResponse)
def run_mock_call_batch_endpoint(payload: MockCallBatchRequest, db: Session = Depends(get_db)) -> dict:
    return run_mock_call_batch(db, payload)


@router.post("/run/{call_attempt_id}", response_model=MockCallRunResponse)
def run_mock_call_endpoint(
    call_attempt_id: str,
    payload: MockCallRunRequest | None = None,
    db: Session = Depends(get_db),
) -> dict:
    try:
        return run_mock_call(db, call_attempt_id, payload or MockCallRunRequest())
    except CallAttemptNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except (InvalidCallAttemptStateError, MockCallAlreadyRecordedError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
