from __future__ import annotations

from app.services.interfaces.speech_to_text import SpeechToTextResult, SpeechToTextService


class MockSpeechToTextService(SpeechToTextService):
    async def transcribe(self, audio_uri: str, language: str | None = None) -> SpeechToTextResult:
        return SpeechToTextResult(
            transcript="Mock transcript: customer acknowledged the balance and requested a callback.",
            language=language or "en-IN",
            confidence=0.98,
        )
