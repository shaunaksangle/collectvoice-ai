from __future__ import annotations

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.cases import CaseDetail, CaseSummary, CaseUploadCommit, CaseUploadPreview, PaginatedCaseList
from app.services.cases.case_import import commit_case_upload
from app.services.cases.case_queries import get_case_by_id, list_cases, summarize_cases
from app.services.cases.upload_parser import UploadParsingError, parse_case_upload_file
from app.services.cases.upload_validation import build_case_upload_preview

router = APIRouter()


@router.get("/summary", response_model=CaseSummary)
def get_cases_summary(db: Session = Depends(get_db)) -> dict:
    return summarize_cases(db)


@router.get("", response_model=PaginatedCaseList)
def get_cases(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    search: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    priority: str | None = Query(default=None),
    lender_name: str | None = Query(default=None),
    assigned_agent: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> dict:
    return list_cases(
        db,
        page=page,
        page_size=page_size,
        search=search,
        status=status_filter,
        priority=priority,
        lender_name=lender_name,
        assigned_agent=assigned_agent,
    )


@router.get("/{case_id}", response_model=CaseDetail)
def get_case(case_id: str, db: Session = Depends(get_db)) -> dict:
    case = get_case_by_id(db, case_id)
    if case is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found.")
    return case


@router.post("/upload/preview", response_model=CaseUploadPreview)
async def preview_case_upload(file: UploadFile = File(...)) -> dict:
    try:
        parsed_upload = await parse_case_upload_file(file)
    except UploadParsingError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return build_case_upload_preview(parsed_upload)


@router.post("/upload/commit", response_model=CaseUploadCommit)
async def commit_case_upload_endpoint(file: UploadFile = File(...), db: Session = Depends(get_db)) -> dict:
    try:
        parsed_upload = await parse_case_upload_file(file)
    except UploadParsingError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return commit_case_upload(db, parsed_upload)
