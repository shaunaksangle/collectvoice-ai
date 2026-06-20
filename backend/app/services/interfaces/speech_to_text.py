from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass(frozen=True)
class SpeechToTextResult:
    transcript: str
    language: str | None = None
    confidence: float | None = None


class SpeechToTextService(ABC):
    @abstractmethod
    async def transcribe(self, audio_uri: str, language: str | None = None) -> SpeechToTextResult:
        """Convert a call audio asset into text."""
