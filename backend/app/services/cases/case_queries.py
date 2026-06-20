from __future__ import annotations

from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.models.case import Case
from app.models.customer import Customer

ACTIVE_STATUSES = ("active", "open", "in_progress")
CLOSED_STATUSES = ("closed", "paid", "resolved", "settled")
HIGH_PRIORITIES = ("high", "critical")


def list_cases(
    db: Session,
    *,
    page: int,
    page_size: int,
    search: str | None = None,
    status: str | None = None,
    priority: str | None = None,
    lender_name: str | None = None,
    assigned_agent: str | None = None,
) -> dict:
    conditions = _build_case_filters(
        search=search,
        status=status,
        priority=priority,
        lender_name=lender_name,
        assigned_agent=assigned_agent,
    )

    total_stmt = select(func.count(Case.id)).join(Case.customer)
    if conditions:
        total_stmt = total_stmt.where(*conditions)

    total = db.scalar(total_stmt) or 0

    stmt = (
        select(Case)
        .options(joinedload(Case.customer))
        .join(Case.customer)
        .order_by(Case.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    if conditions:
        stmt = stmt.where(*conditions)

    cases = db.scalars(stmt).all()

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": [_case_to_list_item(case) for case in cases],
    }


def get_case_by_id(db: Session, case_id: str) -> dict | None:
    stmt = select(Case).options(joinedload(Case.customer)).where(Case.id == case_id)
    case = db.scalar(stmt)
    if case is None:
        return None

    item = _case_to_list_item(case)
    item.update(
        {
            "principal_amount": case.principal_amount,
            "currency": case.currency,
            "alternate_phone": case.customer.alternate_phone if case.customer else None,
            "created_at": case.created_at,
            "updated_at": case.updated_at,
        }
    )
    return item


def summarize_cases(db: Session) -> dict:
    today = date.today()

    total_cases = db.scalar(select(func.count(Case.id))) or 0
    total_outstanding = db.scalar(select(func.sum(Case.outstanding_amount)))
    active_cases = db.scalar(
        select(func.count(Case.id)).where(func.lower(Case.status).in_(ACTIVE_STATUSES))
    ) or 0
    overdue_cases = db.scalar(
        select(func.count(Case.id)).where(
            Case.due_date.is_not(None),
            Case.due_date < today,
            func.lower(Case.status).not_in(CLOSED_STATUSES),
        )
    ) or 0
    high_priority_cases = db.scalar(
        select(func.count(Case.id)).where(func.lower(Case.priority).in_(HIGH_PRIORITIES))
    ) or 0
    missing_phone_cases = db.scalar(
        select(func.count(Case.id))
        .join(Case.customer)
        .where(or_(Customer.phone_number.is_(None), func.trim(Customer.phone_number) == ""))
    ) or 0

    return {
        "total_cases": _clean_int(total_cases),
        "total_outstanding": _clean_money(total_outstanding),
        "active_cases": _clean_int(active_cases),
        "overdue_cases": _clean_int(overdue_cases),
        "high_priority_cases": _clean_int(high_priority_cases),
        "missing_phone_cases": _clean_int(missing_phone_cases),
    }


def _clean_int(value: Any) -> int:
    return int(value or 0)


def _clean_money(value: Decimal | int | float | None) -> int | float:
    if value is None:
        return 0

    amount = Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    if amount == Decimal("0.00"):
        return 0

    return float(amount)


def _build_case_filters(
    *,
    search: str | None,
    status: str | None,
    priority: str | None,
    lender_name: str | None,
    assigned_agent: str | None,
) -> list:
    conditions = []

    if search:
        search_text = f"%{search.strip()}%"
        conditions.append(
            or_(
                Case.external_reference.ilike(search_text),
                Case.lender_name.ilike(search_text),
                Customer.full_name.ilike(search_text),
                Customer.phone_number.ilike(search_text),
                Customer.email.ilike(search_text),
            )
        )

    if status:
        conditions.append(func.lower(Case.status) == status.strip().lower())

    if priority:
        conditions.append(func.lower(Case.priority) == priority.strip().lower())

    if lender_name:
        conditions.append(Case.lender_name.ilike(f"%{lender_name.strip()}%"))

    if assigned_agent:
        conditions.append(Case.assigned_agent.ilike(f"%{assigned_agent.strip()}%"))

    return conditions


def _case_to_list_item(case: Case) -> dict:
    customer = case.customer

    return {
        "id": case.id,
        "case_reference": case.external_reference,
        "customer_name": customer.full_name if customer else "",
        "phone_number": customer.phone_number if customer else None,
        "lender_name": case.lender_name,
        "outstanding_amount": case.outstanding_amount,
        "emi_amount": case.emi_amount,
        "due_date": case.due_date,
        "dpd": case.dpd,
        "priority": case.priority,
        "assigned_agent": case.assigned_agent,
        "status": case.status,
        "city": customer.city if customer else None,
        "state": customer.state if customer else None,
        "email": customer.email if customer else None,
    }
