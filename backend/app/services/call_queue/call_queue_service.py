from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.models.call_attempt import CallAttempt
from app.models.campaign import Campaign
from app.models.campaign_case import CampaignCase
from app.models.case import Case
from app.models.customer import Customer
from app.schemas.call_queue import CallAttemptUpdateRequest, CallQueueGenerateRequest
from app.services.call_queue.call_queue_queries import _call_attempt_to_response

ACTIVE_QUEUE_STATUSES = ("pending", "scheduled")


class CampaignNotFoundError(ValueError):
    pass


class EmptyCampaignError(ValueError):
    pass


class CallAttemptNotFoundError(ValueError):
    pass


class InvalidCallAttemptStateError(ValueError):
    pass


def generate_call_queue(db: Session, campaign_id: str, payload: CallQueueGenerateRequest) -> dict:
    campaign = _get_campaign_or_raise(db, campaign_id)
    attached_cases = _get_attached_cases(db, campaign.id)

    if not attached_cases:
        raise EmptyCampaignError("Campaign has no attached cases.")

    attached_case_ids = [case.id for _, case, _ in attached_cases]
    duplicate_case_ids = set(
        db.scalars(
            select(CallAttempt.case_id).where(
                CallAttempt.campaign_id == campaign.id,
                CallAttempt.case_id.in_(attached_case_ids),
                func.lower(CallAttempt.status).in_(ACTIVE_QUEUE_STATUSES),
            )
        ).all()
    )

    created_attempts: list[CallAttempt] = []
    skipped_duplicate_count = 0
    skipped_missing_phone_count = 0
    status = "scheduled" if payload.scheduled_at else "pending"

    try:
        for _, case, customer in attached_cases:
            if case.id in duplicate_case_ids:
                skipped_duplicate_count += 1
                continue

            phone_number = _clean_phone(customer.phone_number if customer else None)
            if not phone_number:
                skipped_missing_phone_count += 1
                continue

            call_attempt = CallAttempt(
                campaign_id=campaign.id,
                case_id=case.id,
                customer_id=case.customer_id,
                phone_number=phone_number,
                status=status,
                attempt_number=_next_attempt_number(db, campaign.id, case.id),
                scheduled_at=payload.scheduled_at,
            )
            db.add(call_attempt)
            created_attempts.append(call_attempt)

        db.flush()
        created_call_attempt_ids = [call_attempt.id for call_attempt in created_attempts]
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise

    return {
        "campaign_id": campaign.id,
        "total_campaign_cases": len(attached_cases),
        "created_count": len(created_call_attempt_ids),
        "skipped_duplicate_count": skipped_duplicate_count,
        "skipped_missing_phone_count": skipped_missing_phone_count,
        "created_call_attempt_ids": created_call_attempt_ids,
    }


def update_call_attempt(db: Session, call_attempt_id: str, payload: CallAttemptUpdateRequest) -> dict:
    call_attempt, case, customer, campaign = _get_call_attempt_row_or_raise(db, call_attempt_id)
    updates = payload.model_dump(exclude_unset=True)

    if not updates:
        return _call_attempt_to_response(call_attempt, case, customer, campaign)

    for field_name, value in updates.items():
        setattr(call_attempt, field_name, value)

    if "scheduled_at" in updates and "status" not in updates and call_attempt.status in ACTIVE_QUEUE_STATUSES:
        call_attempt.status = "scheduled" if call_attempt.scheduled_at else "pending"

    _commit_or_rollback(db)
    refreshed = _get_call_attempt_row_or_raise(db, call_attempt_id)
    return _call_attempt_to_response(*refreshed)


def cancel_call_attempt(db: Session, call_attempt_id: str) -> dict:
    call_attempt, _, _, _ = _get_call_attempt_row_or_raise(db, call_attempt_id)

    if call_attempt.status not in ACTIVE_QUEUE_STATUSES:
        raise InvalidCallAttemptStateError("Only pending or scheduled call attempts can be cancelled.")

    call_attempt.status = "cancelled"
    _commit_or_rollback(db)
    refreshed = _get_call_attempt_row_or_raise(db, call_attempt_id)
    return _call_attempt_to_response(*refreshed)


def _get_campaign_or_raise(db: Session, campaign_id: str) -> Campaign:
    campaign = db.get(Campaign, campaign_id)
    if campaign is None:
        raise CampaignNotFoundError("Campaign not found.")
    return campaign


def _get_attached_cases(db: Session, campaign_id: str) -> list[tuple[CampaignCase, Case, Customer]]:
    stmt = (
        select(CampaignCase, Case, Customer)
        .join(Case, CampaignCase.case_id == Case.id)
        .join(Customer, Case.customer_id == Customer.id)
        .where(CampaignCase.campaign_id == campaign_id)
        .order_by(CampaignCase.added_at.asc())
    )
    return list(db.execute(stmt).all())


def _get_call_attempt_row_or_raise(db: Session, call_attempt_id: str) -> tuple[CallAttempt, Case, Customer, Campaign | None]:
    stmt = (
        select(CallAttempt, Case, Customer, Campaign)
        .join(Case, CallAttempt.case_id == Case.id)
        .join(Customer, Case.customer_id == Customer.id)
        .outerjoin(Campaign, CallAttempt.campaign_id == Campaign.id)
        .where(CallAttempt.id == call_attempt_id)
    )
    row = db.execute(stmt).first()
    if row is None:
        raise CallAttemptNotFoundError("Call attempt not found.")
    return row


def _next_attempt_number(db: Session, campaign_id: str, case_id: str) -> int:
    current_max = db.scalar(
        select(func.max(CallAttempt.attempt_number)).where(
            CallAttempt.campaign_id == campaign_id,
            CallAttempt.case_id == case_id,
        )
    )
    return int(current_max or 0) + 1


def _clean_phone(value: str | None) -> str | None:
    if value is None:
        return None

    cleaned = value.strip()
    return cleaned or None


def _commit_or_rollback(db: Session) -> None:
    try:
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise
