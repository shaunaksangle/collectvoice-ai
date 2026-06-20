from __future__ import annotations

from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.models.call_attempt import CallAttempt
from app.models.case import Case
from app.models.customer import Customer
from app.models.human_callback import HumanCallback
from app.schemas.followups import HumanCallbackUpdateRequest

PENDING_CALLBACK_STATUSES = ("pending", "open")
HIGH_CALLBACK_PRIORITIES = ("high", "critical")


class HumanCallbackNotFoundError(ValueError):
    pass


def list_human_callbacks(
    db: Session,
    *,
    page: int,
    page_size: int,
    status: str | None = None,
    priority: str | None = None,
    assigned_agent: str | None = None,
    case_id: str | None = None,
    customer_id: str | None = None,
) -> dict:
    conditions = _build_filters(
        status=status,
        priority=priority,
        assigned_agent=assigned_agent,
        case_id=case_id,
        customer_id=customer_id,
    )

    total_stmt = select(func.count(HumanCallback.id)).join(Case, HumanCallback.case_id == Case.id).join(Customer, Case.customer_id == Customer.id)
    if conditions:
        total_stmt = total_stmt.where(*conditions)

    total = int(db.scalar(total_stmt) or 0)

    stmt = (
        _base_callback_select()
        .order_by(HumanCallback.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    if conditions:
        stmt = stmt.where(*conditions)

    items = [_callback_to_list_item(*row) for row in db.execute(stmt).all()]
    return {"total": total, "page": page, "page_size": page_size, "items": items}


def get_human_callback_detail(db: Session, callback_id: str) -> dict | None:
    row = db.execute(_base_callback_select().where(HumanCallback.id == callback_id)).first()
    if row is None:
        return None

    callback, case, customer, call_attempt = row
    item = _callback_to_list_item(callback, case, customer, call_attempt)
    item.update(
        {
            "call_attempt_id": callback.call_attempt_id,
            "call_attempt_status": call_attempt.status if call_attempt else None,
            "requested_at": callback.requested_at,
            "preferred_time": callback.preferred_time,
            "scheduled_at": call_attempt.scheduled_at if call_attempt else None,
            "started_at": call_attempt.started_at if call_attempt else None,
            "ended_at": call_attempt.ended_at if call_attempt else None,
        }
    )
    return item


def update_human_callback(db: Session, callback_id: str, payload: HumanCallbackUpdateRequest) -> dict:
    callback = db.get(HumanCallback, callback_id)
    if callback is None:
        raise HumanCallbackNotFoundError("Human callback record not found.")

    updates = payload.model_dump(exclude_unset=True)
    for field_name, value in updates.items():
        setattr(callback, field_name, value)

    _commit_or_rollback(db)
    detail = get_human_callback_detail(db, callback_id)
    if detail is None:
        raise HumanCallbackNotFoundError("Human callback record not found.")
    return detail


def summarize_human_callbacks(db: Session) -> dict:
    return {
        "total_callbacks": _count_all(db),
        "pending_callbacks": int(
            db.scalar(
                select(func.count(HumanCallback.id)).where(
                    func.lower(HumanCallback.status).in_(PENDING_CALLBACK_STATUSES)
                )
            )
            or 0
        ),
        "assigned_callbacks": _count_by_status(db, "assigned"),
        "completed_callbacks": _count_by_status(db, "completed"),
        "cancelled_callbacks": _count_by_status(db, "cancelled"),
        "high_priority_callbacks": int(
            db.scalar(
                select(func.count(HumanCallback.id)).where(
                    func.lower(HumanCallback.priority).in_(HIGH_CALLBACK_PRIORITIES)
                )
            )
            or 0
        ),
    }


def _base_callback_select():
    return (
        select(HumanCallback, Case, Customer, CallAttempt)
        .join(Case, HumanCallback.case_id == Case.id)
        .join(Customer, Case.customer_id == Customer.id)
        .outerjoin(CallAttempt, HumanCallback.call_attempt_id == CallAttempt.id)
    )


def _build_filters(
    *,
    status: str | None,
    priority: str | None,
    assigned_agent: str | None,
    case_id: str | None,
    customer_id: str | None,
) -> list[Any]:
    conditions: list[Any] = []

    if status:
        cleaned_status = status.strip().lower()
        if cleaned_status == "pending":
            conditions.append(func.lower(HumanCallback.status).in_(PENDING_CALLBACK_STATUSES))
        else:
            conditions.append(func.lower(HumanCallback.status) == cleaned_status)
    if priority:
        conditions.append(func.lower(HumanCallback.priority) == priority.strip().lower())
    if assigned_agent:
        search_text = f"%{assigned_agent.strip()}%"
        conditions.append(or_(HumanCallback.assigned_agent.ilike(search_text), Case.assigned_agent.ilike(search_text)))
    if case_id:
        conditions.append(HumanCallback.case_id == case_id.strip())
    if customer_id:
        cleaned_customer_id = customer_id.strip()
        conditions.append(or_(HumanCallback.customer_id == cleaned_customer_id, Case.customer_id == cleaned_customer_id))

    return conditions


def _count_all(db: Session) -> int:
    return int(db.scalar(select(func.count(HumanCallback.id))) or 0)


def _count_by_status(db: Session, status: str) -> int:
    return int(
        db.scalar(select(func.count(HumanCallback.id)).where(func.lower(HumanCallback.status) == status)) or 0
    )


def _callback_to_list_item(
    callback: HumanCallback,
    case: Case,
    customer: Customer | None,
    call_attempt: CallAttempt | None,
) -> dict:
    return {
        "id": callback.id,
        "case_id": callback.case_id,
        "case_reference": case.external_reference,
        "customer_id": callback.customer_id or case.customer_id,
        "customer_name": customer.full_name if customer else None,
        "phone_number": customer.phone_number if customer else None,
        "reason": callback.reason,
        "priority": callback.priority,
        "status": _callback_status_for_response(callback.status),
        "assigned_agent": callback.assigned_agent or case.assigned_agent,
        "notes": callback.notes,
        "lender_name": case.lender_name,
        "created_at": callback.created_at,
        "updated_at": callback.updated_at,
    }


def _commit_or_rollback(db: Session) -> None:
    try:
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise


def _callback_status_for_response(status: str) -> str:
    if status.lower() == "open":
        return "pending"
    return status
