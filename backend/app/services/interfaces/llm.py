from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class LLMResponse:
    message: str
    intent: str = "unknown"
    metadata: dict[str, Any] = field(default_factory=dict)


class LLMService(ABC):
    @abstractmethod
    async def generate_reply(self, context: dict[str, Any], customer_message: str) -> LLMResponse:
        """Generate the next compliant collection-agent response."""
