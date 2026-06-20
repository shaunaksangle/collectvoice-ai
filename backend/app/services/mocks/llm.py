from __future__ import annotations

from typing import Any

from app.services.interfaces.llm import LLMResponse, LLMService


class MockLLMService(LLMService):
    async def generate_reply(self, context: dict[str, Any], customer_message: str) -> LLMResponse:
        return LLMResponse(
            message="I understand. I can note your response and arrange a human callback if needed.",
            intent="mock_collection_response",
            metadata={
                "mode": "mock",
                "case_id": context.get("case_id"),
                "detected_customer_message": customer_message,
            },
        )
