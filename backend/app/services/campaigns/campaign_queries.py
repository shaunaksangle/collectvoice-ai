from __future__ import annotations

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models.campaign import Campaign
from app.models.campaign_case import CampaignCase
from app.models.case import Case
from app.models.customer import Customer


def list_campaigns(db: Session, *, page: int, page_size: int, search: str | None = None) -> dict:
    conditions = []
    if search:
        search_text = f"%{search.strip()}%"
        conditions.append(or_(Campaign.name.ilike(search_text), Campaign.description.ilike(search_text)))

    total_stmt = select(func.count(Campaign.id))
    if conditions:
        total_stmt = total_stmt.where(*conditions)

    total = db.scalar(total_stmt) or 0

    case_count_subquery = (
        select(CampaignCase.campaign_id, func.count(CampaignCase.case_id).label("case_count"))
        .group_by(CampaignCase.campaign_id)
        .subquery()
    )

    stmt = (
        select(Campaign, func.coalesce(case_count_subquery.c.case_count, 0))
        .outerjoin(case_count_subquery, Campaign.id == case_count_subquery.c.campaign_id)
        .order_by(Campaign.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    if conditions:
        stmt = stmt.where(*conditions)

    items = [_campaign_to_response(campaign, int(case_count or 0)) for campaign, case_count in db.execute(stmt).all()]
    return {"total": int(total), "page": page, "page_size": page_size, "items": items}


def get_campaign_detail(db: Session, campaign_id: str) -> dict | None:
    campaign = db.get(Campaign, campaign_id)
    if campaign is None:
        return None

    attached_stmt = (
        select(CampaignCase, Case, Customer)
        .join(Case, CampaignCase.case_id == Case.id)
        .join(Customer, Case.customer_id == Customer.id)
        .where(CampaignCase.campaign_id == campaign_id)
        .order_by(CampaignCase.added_at.desc())
    )
    attached_cases = [
        _case_to_campaign_case(case, customer, link.added_at)
        for link, case, customer in db.execute(attached_stmt).all()
    ]

    detail = _campaign_to_response(campaign, len(attached_cases))
    detail["attached_cases"] = attached_cases
    return detail


def summarize_campaigns(db: Session) -> dict:
    return {
        "total_campaigns": int(db.scalar(select(func.count(Campaign.id))) or 0),
        "draft_campaigns": _count_by_status(db, "draft"),
        "ready_campaigns": _count_by_status(db, "ready"),
        "paused_campaigns": _count_by_status(db, "paused"),
        "completed_campaigns": _count_by_status(db, "completed"),
        "total_cases_in_campaigns": int(db.scalar(select(func.count(CampaignCase.id))) or 0),
    }


def _count_by_status(db: Session, status: str) -> int:
    return int(db.scalar(select(func.count(Campaign.id)).where(Campaign.status == status)) or 0)


def _campaign_to_response(campaign: Campaign, case_count: int) -> dict:
    return {
        "id": campaign.id,
        "name": campaign.name,
        "description": campaign.description,
        "status": campaign.status,
        "campaign_type": campaign.campaign_type,
        "lender_name": campaign.lender_name,
        "priority_filter": campaign.priority_filter,
        "status_filter": campaign.status_filter,
        "assigned_agent_filter": campaign.assigned_agent_filter,
        "min_dpd": campaign.min_dpd,
        "max_dpd": campaign.max_dpd,
        "case_count": case_count,
        "created_at": campaign.created_at,
        "updated_at": campaign.updated_at,
    }


def _case_to_campaign_case(case: Case, customer: Customer, added_at=None) -> dict:
    return {
        "id": case.id,
        "case_reference": case.external_reference,
        "customer_name": customer.full_name,
        "phone_number": customer.phone_number,
        "lender_name": case.lender_name,
        "outstanding_amount": case.outstanding_amount,
        "dpd": case.dpd,
        "priority": case.priority,
        "status": case.status,
        "assigned_agent": case.assigned_agent,
        "added_at": added_at,
    }
