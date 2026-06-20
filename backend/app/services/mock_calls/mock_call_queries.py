from __future__ import annotations

from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.call_attempt import CallAttempt
from app.models.call_outcome import CallOutcome
from app.models.campaign import Campaign
from app.models.case import Case
from app.models.customer import Customer


def list_mock_call_outcomes(
    db: Session,
    *,
    page: int,
    page_size: int,
    outcome_type: str | None = None,
    campaign_id: str | None = None,
    case_id: str | None = None,
    customer_id: str | None = None,
    callback_required: bool | None = None,
    human_review_required: bool | None = None,
) -> dict:
    conditions = _build_outcome_filters(
        outcome_type=outcome_type,
        campaign_id=campaign_id,
        case_id=case_id,
        customer_id=customer_id,
        callback_required=callback_required,
        human_review_required=human_review_required,
    )

    total_stmt = (
        select(func.count(CallOutcome.id))
        .join(CallAttempt, CallOutcome.call_attempt_id == CallAttempt.id)
        .join(Case, CallOutcome.case_id == Case.id)
        .outerjoin(Customer, CallOutcome.customer_id == Customer.id)
        .outerjoin(Campaign, CallOutcome.campaign_id == Campaign.id)
    )
    if conditions:
        total_stmt = total_stmt.where(*conditions)

    total = int(db.scalar(total_stmt) or 0)

    stmt = (
        _base_outcome_select()
        .order_by(CallOutcome.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    if conditions:
        stmt = stmt.where(*conditions)

    items = [_outcome_to_list_item(*row) for row in db.execute(stmt).all()]
    return {"total": total, "page": page, "page_size": page_size, "items": items}


def get_mock_call_outcome_detail(db: Session, outcome_id: str) -> dict | None:
    stmt = _base_outcome_select().where(CallOutcome.id == outcome_id)
    row = db.execute(stmt).first()
    if row is None:
        return None

    outcome, call_attempt, case, customer, campaign = row
    item = _outcome_to_list_item(outcome, call_attempt, case, customer, campaign)
    item.update(
        {
            "transcript": outcome.transcript,
            "next_action": outcome.next_action,
            "call_attempt_status": call_attempt.status if call_attempt else None,
            "scheduled_at": call_attempt.scheduled_at if call_attempt else None,
            "started_at": call_attempt.started_at if call_attempt else None,
            "ended_at": call_attempt.ended_at if call_attempt else None,
            "updated_at": outcome.updated_at,
        }
    )
    return item


def summarize_mock_calls(db: Session) -> dict:
    return {
        "total_outcomes": _count_total_outcomes(db),
        "completed_calls": _count_attempt_status(db, "completed"),
        "failed_calls": _count_attempt_status(db, "failed"),
        "promise_to_pay_count": _count_outcome_type(db, "promise_to_pay"),
        "already_paid_count": _count_outcome_type(db, "already_paid"),
        "callback_required_count": _count_callback_required(db),
        "no_answer_count": _count_outcome_type(db, "no_answer"),
        "wrong_number_count": _count_outcome_type(db, "wrong_number"),
        "dispute_count": _count_outcome_type(db, "dispute"),
        "refused_to_pay_count": _count_outcome_type(db, "refused_to_pay"),
        "unreachable_count": _count_outcome_type(db, "unreachable"),
    }


def _base_outcome_select():
    return (
        select(CallOutcome, CallAttempt, Case, Customer, Campaign)
        .join(CallAttempt, CallOutcome.call_attempt_id == CallAttempt.id)
        .join(Case, CallOutcome.case_id == Case.id)
        .outerjoin(Customer, CallOutcome.customer_id == Customer.id)
        .outerjoin(Campaign, CallOutcome.campaign_id == Campaign.id)
    )


def _build_outcome_filters(
    *,
    outcome_type: str | None,
    campaign_id: str | None,
    case_id: str | None,
    customer_id: str | None,
    callback_required: bool | None,
    human_review_required: bool | None,
) -> list[Any]:
    conditions: list[Any] = []

    if outcome_type:
        conditions.append(func.lower(CallOutcome.outcome_type) == outcome_type.strip().lower())
    if campaign_id:
        conditions.append(CallOutcome.campaign_id == campaign_id.strip())
    if case_id:
        conditions.append(CallOutcome.case_id == case_id.strip())
    if customer_id:
        conditions.append(CallOutcome.customer_id == customer_id.strip())
    if callback_required is not None:
        conditions.append(CallOutcome.callback_required.is_(callback_required))
    if human_review_required is not None:
        conditions.append(CallOutcome.human_review_required.is_(human_review_required))

    return conditions


def _count_total_outcomes(db: Session) -> int:
    return int(db.scalar(select(func.count(CallOutcome.id))) or 0)


def _count_attempt_status(db: Session, status: str) -> int:
    return int(
        db.scalar(
            select(func.count(CallOutcome.id))
            .join(CallAttempt, CallOutcome.call_attempt_id == CallAttempt.id)
            .where(func.lower(CallAttempt.status) == status)
        )
        or 0
    )


def _count_outcome_type(db: Session, outcome_type: str) -> int:
    return int(
        db.scalar(select(func.count(CallOutcome.id)).where(func.lower(CallOutcome.outcome_type) == outcome_type)) or 0
    )


def _count_callback_required(db: Session) -> int:
    return int(db.scalar(select(func.count(CallOutcome.id)).where(CallOutcome.callback_required.is_(True))) or 0)


def _outcome_to_list_item(
    outcome: CallOutcome,
    call_attempt: CallAttempt,
    case: Case,
    customer: Customer | None,
    campaign: Campaign | None,
) -> dict:
    return {
        "id": outcome.id,
        "call_attempt_id": outcome.call_attempt_id,
        "campaign_id": outcome.campaign_id,
        "campaign_name": campaign.name if campaign else None,
        "case_id": outcome.case_id,
        "case_reference": case.external_reference,
        "customer_id": outcome.customer_id,
        "customer_name": customer.full_name if customer else None,
        "phone_number": call_attempt.phone_number or (customer.phone_number if customer else None),
        "outcome_type": outcome.outcome_type,
        "disposition": outcome.disposition,
        "summary": outcome.summary,
        "detected_intent": outcome.detected_intent,
        "sentiment": outcome.sentiment,
        "promise_date": outcome.promise_date,
        "promise_amount": outcome.promise_amount,
        "callback_required": outcome.callback_required,
        "callback_reason": outcome.callback_reason,
        "human_review_required": outcome.human_review_required,
        "created_at": outcome.created_at,
    }
