from __future__ import annotations

from typing import Any
from uuid import uuid4

from app.services.interfaces.telephony import TelephonyCall, TelephonyService


class MockTelephonyService(TelephonyService):
    async def place_call(
        self,
        destination_number: str,
        callback_url: str,
        metadata: dict[str, Any] | None = None,
    ) -> TelephonyCall:
        return TelephonyCall(
            provider_call_id=f"mock-call-{uuid4()}",
            status="queued",
            metadata={
                "destination_number": destination_number,
                "callback_url": callback_url,
                "mode": "mock",
                **(metadata or {}),
            },
        )

    async def end_call(self, provider_call_id: str) -> TelephonyCall:
        return TelephonyCall(
            provider_call_id=provider_call_id,
            status="completed",
            metadata={"mode": "mock"},
        )
