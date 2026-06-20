from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.campaigns import (
    CampaignCaseAttachRequest,
    CampaignCaseAttachResponse,
    CampaignCreate,
    CampaignDetailResponse,
    CampaignEligibleCasesResponse,
    CampaignListResponse,
    CampaignResponse,
    CampaignSummaryResponse,
    CampaignUpdate,
)
from app.services.campaigns.campaign_queries import get_campaign_detail, list_campaigns, summarize_campaigns
from app.services.campaigns.campaign_service import (
    CampaignNotFoundError,
    archive_campaign,
    attach_cases_to_campaign,
    create_campaign,
    list_eligible_cases,
    remove_case_from_campaign,
    update_campaign,
)

router = APIRouter()


@router.get("/summary", response_model=CampaignSummaryResponse)
def get_campaign_summary(db: Session = Depends(get_db)) -> dict:
    return summarize_campaigns(db)


@router.post("", response_model=CampaignResponse, status_code=status.HTTP_201_CREATED)
def create_campaign_endpoint(payload: CampaignCreate, db: Session = Depends(get_db)) -> dict:
    return create_campaign(db, payload)


@router.get("", response_model=CampaignListResponse)
def list_campaigns_endpoint(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    search: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> dict:
    return list_campaigns(db, page=page, page_size=page_size, search=search)


@router.get("/{campaign_id}/eligible-cases", response_model=CampaignEligibleCasesResponse)
def get_eligible_cases(
    campaign_id: str,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    db: Session = Depends(get_db),
) -> dict:
    try:
        return list_eligible_cases(db, campaign_id, page=page, page_size=page_size)
    except CampaignNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post("/{campaign_id}/cases", response_model=CampaignCaseAttachResponse)
def attach_campaign_cases(campaign_id: str, payload: CampaignCaseAttachRequest, db: Session = Depends(get_db)) -> dict:
    try:
        return attach_cases_to_campaign(db, campaign_id, payload)
    except CampaignNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.delete("/{campaign_id}/cases/{case_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_campaign_case(campaign_id: str, case_id: str, db: Session = Depends(get_db)) -> Response:
    try:
        removed = remove_case_from_campaign(db, campaign_id, case_id)
    except CampaignNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    if not removed:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign case link not found.")

    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{campaign_id}", response_model=CampaignDetailResponse)
def get_campaign(campaign_id: str, db: Session = Depends(get_db)) -> dict:
    campaign = get_campaign_detail(db, campaign_id)
    if campaign is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found.")
    return campaign


@router.patch("/{campaign_id}", response_model=CampaignResponse)
def update_campaign_endpoint(campaign_id: str, payload: CampaignUpdate, db: Session = Depends(get_db)) -> dict:
    try:
        return update_campaign(db, campaign_id, payload)
    except CampaignNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.delete("/{campaign_id}", response_model=CampaignResponse)
def archive_campaign_endpoint(campaign_id: str, db: Session = Depends(get_db)) -> dict:
    try:
        return archive_campaign(db, campaign_id)
    except CampaignNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
