from __future__ import annotations

from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.models.call_attempt import CallAttempt
from app.models.case import Case
from app.models.customer import Customer
from app.models.promise_to_pay import PromiseToPay
from app.schemas.followups import PromiseToPayUpdateRequest

PENDING_STATUSES = ("pending",)


class PromiseToPayNotFoundError(ValueError):
    pass


def list_promise_to_pay(
    db: Session,
    *,
    page: int,
    page_size: int,
    status: str | None = None,
    case_id: str | None = None,
    customer_id: str | None = None,
    assigned_agent: str | None = None,
    due_from: date | None = None,
    due_to: date | None = None,
    overdue_only: bool = False,
) -> dict:
    conditions = _build_filters(
        status=status,
        case_id=case_id,
        customer_id=customer_id,
        assigned_agent=assigned_agent,
        due_from=due_from,
        due_to=due_to,
        overdue_only=overdue_only,
    )

    total_stmt = select(func.count(PromiseToPay.id)).join(Case, PromiseToPay.case_id == Case.id).join(Customer, Case.customer_id == Customer.id)
    if conditions:
        total_stmt = total_stmt.where(*conditions)

    total = int(db.scalar(total_stmt) or 0)

    stmt = (
        _base_ptp_select()
        .order_by(PromiseToPay.promised_date.asc(), PromiseToPay.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    if conditions:
        stmt = stmt.where(*conditions)

    items = [_ptp_to_list_item(*row) for row in db.execute(stmt).all()]
    return {"total": total, "page": page, "page_size": page_size, "items": items}


def get_promise_to_pay_detail(db: Session, ptp_id: str) -> dict | None:
    row = db.execute(_base_ptp_select().where(PromiseToPay.id == ptp_id)).first()
    if row is None:
        return None

    ptp, case, customer, call_attempt = row
    item = _ptp_to_list_item(ptp, case, customer, call_attempt)
    item.update(
        {
            "call_attempt_id": ptp.call_attempt_id,
            "call_attempt_status": call_attempt.status if call_attempt else None,
            "scheduled_at": call_attempt.scheduled_at if call_attempt else None,
            "started_at": call_attempt.started_at if call_attempt else None,
            "ended_at": call_attempt.ended_at if call_attempt else None,
        }
    )
    return item


def update_promise_to_pay(db: Session, ptp_id: str, payload: PromiseToPayUpdateRequest) -> dict:
    ptp = db.get(PromiseToPay, ptp_id)
    if ptp is None:
        raise PromiseToPayNotFoundError("Promise to pay record not found.")

    updates = payload.model_dump(exclude_unset=True)
    for field_name, value in updates.items():
        setattr(ptp, field_name, value)

    _commit_or_rollback(db)
    detail = get_promise_to_pay_detail(db, ptp_id)
    if detail is None:
        raise PromiseToPayNotFoundError("Promise to pay record not found.")
    return detail


def summarize_promise_to_pay(db: Session) -> dict:
    today = date.today()

    total_amount = db.scalar(select(func.sum(PromiseToPay.promised_amount)))
    pending_amount = db.scalar(
        select(func.sum(PromiseToPay.promised_amount)).where(func.lower(PromiseToPay.status).in_(PENDING_STATUSES))
    )

    return {
        "total_ptp": _count_all(db),
        "pending_ptp": _count_by_status(db, "pending"),
        "fulfilled_ptp": _count_by_status(db, "fulfilled"),
        "broken_ptp": _count_by_status(db, "broken"),
        "cancelled_ptp": _count_by_status(db, "cancelled"),
        "overdue_ptp": int(
            db.scalar(
                select(func.count(PromiseToPay.id)).where(
                    PromiseToPay.promised_date < today,
                    func.lower(PromiseToPay.status).in_(PENDING_STATUSES),
                )
            )
            or 0
        ),
        "total_promised_amount": _clean_money(total_amount),
        "pending_promised_amount": _clean_money(pending_amount),
    }


def _base_ptp_select():
    return (
        select(PromiseToPay, Case, Customer, CallAttempt)
        .join(Case, PromiseToPay.case_id == Case.id)
        .join(Customer, Case.customer_id == Customer.id)
        .outerjoin(CallAttempt, PromiseToPay.call_attempt_id == CallAttempt.id)
    )


def _build_filters(
    *,
    status: str | None,
    case_id: str | None,
    customer_id: str | None,
    assigned_agent: str | None,
    due_from: date | None,
    due_to: date | None,
    overdue_only: bool,
) -> list[Any]:
    conditions: list[Any] = []

    if status:
        conditions.append(func.lower(PromiseToPay.status) == status.strip().lower())
    if case_id:
        conditions.append(PromiseToPay.case_id == case_id.strip())
    if customer_id:
        cleaned_customer_id = customer_id.strip()
        conditions.append(or_(PromiseToPay.customer_id == cleaned_customer_id, Case.customer_id == cleaned_customer_id))
    if assigned_agent:
        conditions.append(Case.assigned_agent.ilike(f"%{assigned_agent.strip()}%"))
    if due_from:
        conditions.append(PromiseToPay.promised_date >= due_from)
    if due_to:
        conditions.append(PromiseToPay.promised_date <= due_to)
    if overdue_only:
        conditions.append(PromiseToPay.promised_date < date.today())
        conditions.append(func.lower(PromiseToPay.status).in_(PENDING_STATUSES))

    return conditions


def _count_all(db: Session) -> int:
    return int(db.scalar(select(func.count(PromiseToPay.id))) or 0)


def _count_by_status(db: Session, status: str) -> int:
    return int(
        db.scalar(select(func.count(PromiseToPay.id)).where(func.lower(PromiseToPay.status) == status)) or 0
    )


def _clean_money(value: Decimal | int | float | None) -> int | float:
    if value is None:
        return 0

    amount = Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    if amount == Decimal("0.00"):
        return 0

    return float(amount)


def _ptp_to_list_item(
    ptp: PromiseToPay,
    case: Case,
    customer: Customer | None,
    call_attempt: CallAttempt | None,
) -> dict:
    return {
        "id": ptp.id,
        "case_id": ptp.case_id,
        "case_reference": case.external_reference,
        "customer_id": ptp.customer_id or case.customer_id,
        "customer_name": customer.full_name if customer else None,
        "phone_number": customer.phone_number if customer else None,
        "promised_amount": _clean_money(ptp.promised_amount),
        "promised_date": ptp.promised_date,
        "status": ptp.status,
        "source": ptp.source,
        "notes": ptp.notes,
        "lender_name": case.lender_name,
        "assigned_agent": case.assigned_agent,
        "created_at": ptp.created_at,
        "updated_at": ptp.updated_at,
    }


def _commit_or_rollback(db: Session) -> None:
    try:
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise
