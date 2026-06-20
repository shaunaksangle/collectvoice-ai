from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.call_attempt import CallAttempt
from app.models.campaign import Campaign
from app.models.case import Case
from app.models.customer import Customer


def list_call_attempts(
    db: Session,
    *,
    page: int,
    page_size: int,
    campaign_id: str | None = None,
    status: str | None = None,
    priority: str | None = None,
    assigned_agent: str | None = None,
    lender_name: str | None = None,
    scheduled_from: datetime | None = None,
    scheduled_to: datetime | None = None,
) -> dict:
    conditions = _build_call_queue_filters(
        campaign_id=campaign_id,
        status=status,
        priority=priority,
        assigned_agent=assigned_agent,
        lender_name=lender_name,
        scheduled_from=scheduled_from,
        scheduled_to=scheduled_to,
    )

    total_stmt = (
        select(func.count(CallAttempt.id))
        .join(Case, CallAttempt.case_id == Case.id)
        .join(Customer, Case.customer_id == Customer.id)
    )
    if conditions:
        total_stmt = total_stmt.where(*conditions)

    total = int(db.scalar(total_stmt) or 0)

    stmt = (
        select(CallAttempt, Case, Customer, Campaign)
        .join(Case, CallAttempt.case_id == Case.id)
        .join(Customer, Case.customer_id == Customer.id)
        .outerjoin(Campaign, CallAttempt.campaign_id == Campaign.id)
        .order_by(CallAttempt.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    if conditions:
        stmt = stmt.where(*conditions)

    items = [
        _call_attempt_to_response(call_attempt, case, customer, campaign)
        for call_attempt, case, customer, campaign in db.execute(stmt).all()
    ]

    return {"total": total, "page": page, "page_size": page_size, "items": items}


def get_call_attempt_detail(db: Session, call_attempt_id: str) -> dict | None:
    stmt = (
        select(CallAttempt, Case, Customer, Campaign)
        .join(Case, CallAttempt.case_id == Case.id)
        .join(Customer, Case.customer_id == Customer.id)
        .outerjoin(Campaign, CallAttempt.campaign_id == Campaign.id)
        .where(CallAttempt.id == call_attempt_id)
    )
    row = db.execute(stmt).first()
    if row is None:
        return None

    call_attempt, case, customer, campaign = row
    return _call_attempt_to_response(call_attempt, case, customer, campaign)


def summarize_call_queue(db: Session) -> dict:
    return {
        "total_queue_items": _count_total(db),
        "pending_calls": _count_by_status(db, "pending"),
        "scheduled_calls": _count_by_status(db, "scheduled"),
        "in_progress_calls": _count_by_status(db, "in_progress"),
        "completed_calls": _count_by_status(db, "completed"),
        "failed_calls": _count_by_status(db, "failed"),
        "cancelled_calls": _count_by_status(db, "cancelled"),
    }


def _count_total(db: Session) -> int:
    return int(db.scalar(select(func.count(CallAttempt.id))) or 0)


def _count_by_status(db: Session, status: str) -> int:
    return int(
        db.scalar(select(func.count(CallAttempt.id)).where(func.lower(CallAttempt.status) == status)) or 0
    )


def _build_call_queue_filters(
    *,
    campaign_id: str | None,
    status: str | None,
    priority: str | None,
    assigned_agent: str | None,
    lender_name: str | None,
    scheduled_from: datetime | None,
    scheduled_to: datetime | None,
) -> list[Any]:
    conditions: list[Any] = []

    if campaign_id:
        conditions.append(CallAttempt.campaign_id == campaign_id.strip())
    if status:
        conditions.append(func.lower(CallAttempt.status) == status.strip().lower())
    if priority:
        conditions.append(func.lower(Case.priority) == priority.strip().lower())
    if assigned_agent:
        conditions.append(Case.assigned_agent.ilike(f"%{assigned_agent.strip()}%"))
    if lender_name:
        conditions.append(Case.lender_name.ilike(f"%{lender_name.strip()}%"))
    if scheduled_from:
        conditions.append(CallAttempt.scheduled_at >= scheduled_from)
    if scheduled_to:
        conditions.append(CallAttempt.scheduled_at <= scheduled_to)

    return conditions


def _call_attempt_to_response(
    call_attempt: CallAttempt,
    case: Case,
    customer: Customer,
    campaign: Campaign | None,
) -> dict:
    return {
        "id": call_attempt.id,
        "campaign_id": call_attempt.campaign_id,
        "campaign_name": campaign.name if campaign else None,
        "case_id": case.id,
        "case_reference": case.external_reference,
        "customer_id": call_attempt.customer_id or case.customer_id,
        "customer_name": customer.full_name,
        "phone_number": call_attempt.phone_number or customer.phone_number,
        "status": call_attempt.status,
        "attempt_number": call_attempt.attempt_number,
        "scheduled_at": call_attempt.scheduled_at,
        "started_at": call_attempt.started_at,
        "ended_at": call_attempt.ended_at,
        "provider_call_id": call_attempt.provider_call_id,
        "failure_reason": call_attempt.failure_reason,
        "last_error": call_attempt.last_error,
        "lender_name": case.lender_name,
        "priority": case.priority,
        "assigned_agent": case.assigned_agent,
        "outstanding_amount": case.outstanding_amount,
        "created_at": call_attempt.created_at,
        "updated_at": call_attempt.updated_at,
    }
