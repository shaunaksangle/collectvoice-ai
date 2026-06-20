from __future__ import annotations

from hashlib import sha1

from app.services.interfaces.text_to_speech import TextToSpeechResult, TextToSpeechService


class MockTextToSpeechService(TextToSpeechService):
    async def synthesize(self, text: str, voice: str | None = None, language: str | None = None) -> TextToSpeechResult:
        audio_id = sha1(f"{voice}:{language}:{text}".encode("utf-8")).hexdigest()[:12]
        return TextToSpeechResult(
            audio_uri=f"mock://tts/{audio_id}.wav",
            format="wav",
            duration_seconds=max(1.0, len(text) / 18),
        )
