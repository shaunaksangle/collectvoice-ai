from __future__ import annotations

from typing import Any

from sqlalchemy import and_, func, not_, or_, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.models.campaign import Campaign
from app.models.campaign_case import CampaignCase
from app.models.case import Case
from app.models.customer import Customer
from app.schemas.campaigns import CampaignCaseAttachRequest, CampaignCreate, CampaignUpdate
from app.services.campaigns.campaign_queries import _campaign_to_response, _case_to_campaign_case


class CampaignNotFoundError(ValueError):
    pass


def create_campaign(db: Session, payload: CampaignCreate) -> dict:
    campaign = Campaign(**payload.model_dump())
    db.add(campaign)
    _commit_or_rollback(db)
    db.refresh(campaign)
    return _campaign_to_response(campaign, 0)


def update_campaign(db: Session, campaign_id: str, payload: CampaignUpdate) -> dict:
    campaign = _get_campaign_or_raise(db, campaign_id)
    updates = payload.model_dump(exclude_unset=True)

    for field_name, value in updates.items():
        setattr(campaign, field_name, value)

    _commit_or_rollback(db)
    db.refresh(campaign)
    case_count = int(db.scalar(select(func.count(CampaignCase.id)).where(CampaignCase.campaign_id == campaign.id)) or 0)
    return _campaign_to_response(campaign, case_count)


def archive_campaign(db: Session, campaign_id: str) -> dict:
    campaign = _get_campaign_or_raise(db, campaign_id)
    campaign.status = "archived"
    _commit_or_rollback(db)
    db.refresh(campaign)
    case_count = int(db.scalar(select(func.count(CampaignCase.id)).where(CampaignCase.campaign_id == campaign.id)) or 0)
    return _campaign_to_response(campaign, case_count)


def attach_cases_to_campaign(db: Session, campaign_id: str, payload: CampaignCaseAttachRequest) -> dict:
    campaign = _get_campaign_or_raise(db, campaign_id)

    if payload.case_ids:
        return _attach_explicit_case_ids(db, campaign, payload.case_ids)

    case_ids = _matching_case_ids_for_filters(db, _request_or_campaign_filters(payload, campaign))
    return _attach_case_ids(db, campaign, case_ids, missing_case_ids=[])


def remove_case_from_campaign(db: Session, campaign_id: str, case_id: str) -> bool:
    _get_campaign_or_raise(db, campaign_id)
    link = db.scalar(
        select(CampaignCase).where(
            CampaignCase.campaign_id == campaign_id,
            CampaignCase.case_id == case_id,
        )
    )
    if link is None:
        return False

    db.delete(link)
    _commit_or_rollback(db)
    return True


def list_eligible_cases(db: Session, campaign_id: str, *, page: int, page_size: int) -> dict:
    campaign = _get_campaign_or_raise(db, campaign_id)
    filters = _campaign_filters(campaign)
    conditions = _build_case_conditions(filters)

    attached_case_ids = select(CampaignCase.case_id).where(CampaignCase.campaign_id == campaign.id)

    total_stmt = (
        select(func.count(Case.id))
        .join(Customer, Case.customer_id == Customer.id)
        .where(Case.id.not_in(attached_case_ids))
    )
    if conditions:
        total_stmt = total_stmt.where(*conditions)

    total = int(db.scalar(total_stmt) or 0)

    stmt = (
        select(Case, Customer)
        .join(Customer, Case.customer_id == Customer.id)
        .where(Case.id.not_in(attached_case_ids))
        .order_by(Case.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    if conditions:
        stmt = stmt.where(*conditions)

    items = [_case_to_campaign_case(case, customer) for case, customer in db.execute(stmt).all()]
    return {"total": total, "page": page, "page_size": page_size, "items": items}


def _attach_explicit_case_ids(db: Session, campaign: Campaign, requested_case_ids: list[str]) -> dict:
    cleaned_case_ids = [case_id.strip() for case_id in requested_case_ids if case_id and case_id.strip()]
    if not cleaned_case_ids:
        return _empty_attach_response()

    existing_case_ids = set(db.scalars(select(Case.id).where(Case.id.in_(cleaned_case_ids))).all())
    missing_case_ids = [case_id for case_id in cleaned_case_ids if case_id not in existing_case_ids]
    return _attach_case_ids(db, campaign, list(existing_case_ids), missing_case_ids=missing_case_ids)


def _attach_case_ids(db: Session, campaign: Campaign, case_ids: list[str], *, missing_case_ids: list[str]) -> dict:
    if not case_ids:
        return {
            "added_count": 0,
            "skipped_count": len(missing_case_ids),
            "missing_case_ids": missing_case_ids,
            "duplicate_case_ids": [],
            "added_case_ids": [],
        }

    existing_links = set(
        db.scalars(
            select(CampaignCase.case_id).where(
                CampaignCase.campaign_id == campaign.id,
                CampaignCase.case_id.in_(case_ids),
            )
        ).all()
    )

    added_case_ids: list[str] = []
    duplicate_case_ids = [case_id for case_id in case_ids if case_id in existing_links]

    try:
        for case_id in case_ids:
            if case_id in existing_links:
                continue
            db.add(CampaignCase(campaign_id=campaign.id, case_id=case_id))
            added_case_ids.append(case_id)

        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise

    skipped_count = len(missing_case_ids) + len(duplicate_case_ids)
    return {
        "added_count": len(added_case_ids),
        "skipped_count": skipped_count,
        "missing_case_ids": missing_case_ids,
        "duplicate_case_ids": duplicate_case_ids,
        "added_case_ids": added_case_ids,
    }


def _matching_case_ids_for_filters(db: Session, filters: dict[str, Any]) -> list[str]:
    conditions = _build_case_conditions(filters)
    stmt = select(Case.id)
    if conditions:
        stmt = stmt.where(*conditions)
    return list(db.scalars(stmt).all())


def _build_case_conditions(filters: dict[str, Any]) -> list:
    conditions = []

    if filters.get("lender_name"):
        conditions.append(Case.lender_name.ilike(f"%{filters['lender_name']}%"))
    if filters.get("priority_filter"):
        conditions.append(func.lower(Case.priority) == str(filters["priority_filter"]).lower())
    if filters.get("status_filter"):
        conditions.append(func.lower(Case.status) == str(filters["status_filter"]).lower())
    if filters.get("assigned_agent_filter"):
        conditions.append(Case.assigned_agent.ilike(f"%{filters['assigned_agent_filter']}%"))
    if filters.get("min_dpd") is not None:
        conditions.append(Case.dpd >= int(filters["min_dpd"]))
    if filters.get("max_dpd") is not None:
        conditions.append(Case.dpd <= int(filters["max_dpd"]))

    return conditions


def _request_or_campaign_filters(payload: CampaignCaseAttachRequest, campaign: Campaign) -> dict[str, Any]:
    request_filters = payload.model_dump(exclude={"case_ids"}, exclude_none=True)
    return request_filters if request_filters else _campaign_filters(campaign)


def _campaign_filters(campaign: Campaign) -> dict[str, Any]:
    return {
        "lender_name": campaign.lender_name,
        "priority_filter": campaign.priority_filter,
        "status_filter": campaign.status_filter,
        "assigned_agent_filter": campaign.assigned_agent_filter,
        "min_dpd": campaign.min_dpd,
        "max_dpd": campaign.max_dpd,
    }


def _get_campaign_or_raise(db: Session, campaign_id: str) -> Campaign:
    campaign = db.get(Campaign, campaign_id)
    if campaign is None:
        raise CampaignNotFoundError("Campaign not found.")
    return campaign


def _commit_or_rollback(db: Session) -> None:
    try:
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise


def _empty_attach_response() -> dict:
    return {
        "added_count": 0,
        "skipped_count": 0,
        "missing_case_ids": [],
        "duplicate_case_ids": [],
        "added_case_ids": [],
    }
