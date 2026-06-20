from __future__ import annotations

from app.core.config import settings
from app.services.interfaces.llm import LLMService
from app.services.interfaces.speech_to_text import SpeechToTextService
from app.services.interfaces.telephony import TelephonyService
from app.services.interfaces.text_to_speech import TextToSpeechService
from app.services.mocks.llm import MockLLMService
from app.services.mocks.speech_to_text import MockSpeechToTextService
from app.services.mocks.telephony import MockTelephonyService
from app.services.mocks.text_to_speech import MockTextToSpeechService


def get_speech_to_text_service() -> SpeechToTextService:
    if settings.voice_mode == "mock":
        return MockSpeechToTextService()
    raise NotImplementedError("Real speech-to-text providers are not wired yet.")


def get_text_to_speech_service() -> TextToSpeechService:
    if settings.voice_mode == "mock":
        return MockTextToSpeechService()
    raise NotImplementedError("Real text-to-speech providers are not wired yet.")


def get_llm_service() -> LLMService:
    if settings.voice_mode == "mock":
        return MockLLMService()
    raise NotImplementedError("Real LLM providers are not wired yet.")


def get_telephony_service() -> TelephonyService:
    if settings.telephony_provider == "mock":
        return MockTelephonyService()
    raise NotImplementedError("Real telephony providers are not wired yet.")
