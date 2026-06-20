from app.services.interfaces.llm import LLMResponse, LLMService
from app.services.interfaces.speech_to_text import SpeechToTextResult, SpeechToTextService
from app.services.interfaces.telephony import TelephonyCall, TelephonyService
from app.services.interfaces.text_to_speech import TextToSpeechResult, TextToSpeechService

__all__ = [
    "LLMResponse",
    "LLMService",
    "SpeechToTextResult",
    "SpeechToTextService",
    "TelephonyCall",
    "TelephonyService",
    "TextToSpeechResult",
    "TextToSpeechService",
]
