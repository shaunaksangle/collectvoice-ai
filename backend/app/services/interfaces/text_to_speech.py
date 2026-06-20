from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass(frozen=True)
class TextToSpeechResult:
    audio_uri: str
    format: str
    duration_seconds: float | None = None


class TextToSpeechService(ABC):
    @abstractmethod
    async def synthesize(self, text: str, voice: str | None = None, language: str | None = None) -> TextToSpeechResult:
        """Convert an agent response into playable audio."""
