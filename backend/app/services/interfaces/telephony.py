from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class TelephonyCall:
    provider_call_id: str
    status: str
    metadata: dict[str, Any] = field(default_factory=dict)


class TelephonyService(ABC):
    @abstractmethod
    async def place_call(
        self,
        destination_number: str,
        callback_url: str,
        metadata: dict[str, Any] | None = None,
    ) -> TelephonyCall:
        """Queue or place an outbound call through a telephony provider."""

    @abstractmethod
    async def end_call(self, provider_call_id: str) -> TelephonyCall:
        """End an active provider call."""
