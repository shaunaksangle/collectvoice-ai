from pydantic import BaseModel


class StatusResponse(BaseModel):
    app_name: str
    version: str
    voice_mode: str
    telephony_provider: str
