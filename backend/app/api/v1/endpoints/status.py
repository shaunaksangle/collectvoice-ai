from fastapi import APIRouter

from app.core.config import settings
from app.schemas.status import StatusResponse

router = APIRouter()


@router.get("/status", response_model=StatusResponse)
async def get_status() -> StatusResponse:
    return StatusResponse(
        app_name=settings.app_name,
        version=settings.app_version,
        voice_mode=settings.voice_mode,
        telephony_provider=settings.telephony_provider,
    )
