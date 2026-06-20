from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.models.call_attempt import CallAttempt
from app.models.call_outcome import CallOutcome
from app.models.case import Case
from app.models.customer import Customer
from app.models.human_callback import HumanCallback
from app.models.promise_to_pay import PromiseToPay
from app.schemas.mock_calls import MockCallRunRequest
from app.services.mock_calls.mock_call_scenarios import build_mock_call_scenario

RUNNABLE_STATUSES = {"pending", "scheduled"}
FAILED_OUTCOMES = {"no_answer", "unreachable"}


class CallAttemptNotFoundError(ValueError):
    pass


class InvalidCallAttemptStateError(ValueError):
    pass


class MockCallAlreadyRecordedError(ValueError):
    pass


def run_mock_call(db: Session, call_attempt_id: str, payload: MockCallRunRequest) -> dict:
    call_attempt, case, customer = _get_call_attempt_context_or_raise(db, call_attempt_id)

    if call_attempt.status not in RUNNABLE_STATUSES:
        raise InvalidCallAttemptStateError("Only pending or scheduled call attempts can be run in mock mode.")

    existing_outcome = db.scalar(select(CallOutcome.id).where(CallOutcome.call_attempt_id == call_attempt.id))
    if existing_outcome is not None:
        raise MockCallAlreadyRecordedError("A call outcome already exists for this call attempt.")

    started_at = _now()
    call_attempt.status = "in_progress"
    call_attempt.started_at = started_at
    call_attempt.last_error = None
    call_attempt.failure_reason = None

    promise_date = payload.promise_date
    promise_amount = payload.promise_amount
    if payload.outcome_type == "promise_to_pay":
        promise_date = promise_date or date.today() + timedelta(days=7)
        promise_amount = promise_amount or case.outstanding_amount

    scenario = build_mock_call_scenario(
        outcome_type=payload.outcome_type,
        customer_name=customer.full_name,
        lender_name=case.lender_name,
        outstanding_amount=case.outstanding_amount,
        promise_date=promise_date,
        promise_amount=promise_amount,
        callback_reason=payload.callback_reason,
    )

    final_status = "failed" if payload.outcome_type in FAILED_OUTCOMES else "completed"
    ended_at = _now()

    outcome = CallOutcome(
        call_attempt_id=call_attempt.id,
        campaign_id=call_attempt.campaign_id,
        case_id=case.id,
        customer_id=customer.id,
        outcome_type=scenario.outcome_type,
        disposition=scenario.disposition,
        summary=_append_notes(scenario.summary, payload.notes),
        transcript=scenario.transcript,
        detected_intent=scenario.detected_intent,
        sentiment=scenario.sentiment,
        promise_date=promise_date if payload.outcome_type == "promise_to_pay" else None,
        promise_amount=promise_amount if payload.outcome_type == "promise_to_pay" else None,
        callback_required=scenario.callback_required,
        callback_reason=scenario.callback_reason,
        human_review_required=scenario.human_review_required,
        next_action=scenario.next_action,
    )

    call_attempt.status = final_status
    call_attempt.ended_at = ended_at
    call_attempt.transcript = scenario.transcript
    if final_status == "failed":
        call_attempt.failure_reason = scenario.summary

    promise_to_pay: PromiseToPay | None = None
    if payload.outcome_type == "promise_to_pay" and promise_date is not None and promise_amount is not None:
        promise_to_pay = PromiseToPay(
            case_id=case.id,
            customer_id=customer.id,
            call_attempt_id=call_attempt.id,
            promised_amount=promise_amount,
            promised_date=promise_date,
            status="pending",
            source="mock_call",
            notes=payload.notes or scenario.summary,
        )
        db.add(promise_to_pay)

    human_callback: HumanCallback | None = None
    if payload.outcome_type in {"callback_requested", "dispute"}:
        human_callback = HumanCallback(
            case_id=case.id,
            customer_id=customer.id,
            call_attempt_id=call_attempt.id,
            reason=scenario.callback_reason or payload.callback_reason,
            priority="high" if payload.outcome_type == "dispute" else "normal",
            status="open",
            assigned_agent=case.assigned_agent,
            notes=payload.notes or scenario.summary,
        )
        db.add(human_callback)

    db.add(outcome)

    try:
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise

    db.refresh(call_attempt)
    db.refresh(outcome)
    if promise_to_pay is not None:
        db.refresh(promise_to_pay)
    if human_callback is not None:
        db.refresh(human_callback)

    return {
        "call_attempt_id": call_attempt.id,
        "final_status": call_attempt.status,
        "outcome": _outcome_to_response(outcome),
        "promise_to_pay_id": promise_to_pay.id if promise_to_pay else None,
        "human_callback_id": human_callback.id if human_callback else None,
        "transcript": scenario.transcript,
    }


def _get_call_attempt_context_or_raise(db: Session, call_attempt_id: str) -> tuple[CallAttempt, Case, Customer]:
    stmt = (
        select(CallAttempt, Case, Customer)
        .join(Case, CallAttempt.case_id == Case.id)
        .join(Customer, Case.customer_id == Customer.id)
        .where(CallAttempt.id == call_attempt_id)
    )
    row = db.execute(stmt).first()
    if row is None:
        raise CallAttemptNotFoundError("Call attempt not found.")
    return row


def _outcome_to_response(outcome: CallOutcome) -> dict:
    return {
        "id": outcome.id,
        "outcome_type": outcome.outcome_type,
        "disposition": outcome.disposition,
        "summary": outcome.summary,
        "transcript": outcome.transcript,
        "detected_intent": outcome.detected_intent,
        "sentiment": outcome.sentiment,
        "promise_date": outcome.promise_date,
        "promise_amount": outcome.promise_amount,
        "callback_required": outcome.callback_required,
        "callback_reason": outcome.callback_reason,
        "human_review_required": outcome.human_review_required,
        "created_at": outcome.created_at,
        "updated_at": outcome.updated_at,
    }


def _append_notes(summary: str, notes: str | None) -> str:
    if not notes:
        return summary
    return f"{summary}\nManager notes: {notes.strip()}"


def _now() -> datetime:
    return datetime.now(timezone.utc)
