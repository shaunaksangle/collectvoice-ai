from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.call_attempt import CallAttempt
from app.models.call_outcome import CallOutcome
from app.schemas.mock_calls import MockCallBatchRequest, MockCallRunRequest
from app.services.mock_calls.mock_call_service import (
    CallAttemptNotFoundError,
    InvalidCallAttemptStateError,
    MockCallAlreadyRecordedError,
    run_mock_call,
)

RUNNABLE_STATUSES = ("pending", "scheduled")


def run_mock_call_batch(db: Session, payload: MockCallBatchRequest) -> dict:
    selected_ids = _select_call_attempt_ids(db, payload)

    if payload.dry_run:
        return {
            "dry_run": True,
            "selected_count": len(selected_ids),
            "processed_count": 0,
            "completed_count": 0,
            "failed_count": 0,
            "promise_to_pay_count": 0,
            "callback_required_count": 0,
            "skipped_count": 0,
            "processed_call_attempt_ids": selected_ids,
            "skipped_call_attempt_ids": [],
            "errors": [],
        }

    processed_call_attempt_ids: list[str] = []
    skipped_call_attempt_ids: list[str] = []
    errors: list[dict] = []
    completed_count = 0
    failed_count = 0
    promise_to_pay_count = 0
    callback_required_count = 0

    request = MockCallRunRequest(outcome_type=payload.outcome_type or "promise_to_pay")

    for call_attempt_id in selected_ids:
        try:
            result = run_mock_call(db, call_attempt_id, request)
        except (CallAttemptNotFoundError, InvalidCallAttemptStateError, MockCallAlreadyRecordedError) as exc:
            skipped_call_attempt_ids.append(call_attempt_id)
            errors.append({"call_attempt_id": call_attempt_id, "issue": str(exc)})
            continue
        except Exception as exc:
            skipped_call_attempt_ids.append(call_attempt_id)
            errors.append({"call_attempt_id": call_attempt_id, "issue": f"Unexpected error: {exc}"})
            continue

        processed_call_attempt_ids.append(call_attempt_id)
        if result["final_status"] == "completed":
            completed_count += 1
        if result["final_status"] == "failed":
            failed_count += 1
        if result["outcome"]["outcome_type"] == "promise_to_pay":
            promise_to_pay_count += 1
        if result["outcome"]["callback_required"]:
            callback_required_count += 1

    return {
        "dry_run": False,
        "selected_count": len(selected_ids),
        "processed_count": len(processed_call_attempt_ids),
        "completed_count": completed_count,
        "failed_count": failed_count,
        "promise_to_pay_count": promise_to_pay_count,
        "callback_required_count": callback_required_count,
        "skipped_count": len(skipped_call_attempt_ids),
        "processed_call_attempt_ids": processed_call_attempt_ids,
        "skipped_call_attempt_ids": skipped_call_attempt_ids,
        "errors": errors,
    }


def _select_call_attempt_ids(db: Session, payload: MockCallBatchRequest) -> list[str]:
    status = payload.status.strip().lower() if payload.status else None

    conditions = [CallOutcome.id.is_(None)]
    if status:
        conditions.append(CallAttempt.status == status)
    else:
        conditions.append(CallAttempt.status.in_(RUNNABLE_STATUSES))

    if payload.campaign_id:
        conditions.append(CallAttempt.campaign_id == payload.campaign_id.strip())

    stmt = (
        select(CallAttempt.id)
        .outerjoin(CallOutcome, CallOutcome.call_attempt_id == CallAttempt.id)
        .where(*conditions)
        .order_by(CallAttempt.created_at.asc())
        .limit(payload.limit)
    )
    return list(db.scalars(stmt).all())
