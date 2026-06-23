from __future__ import annotations

import httpx

from ragpilot_api.application.model_gateway.contracts import ChatGenerationResult


class OpenAICompatibleChatProvider:
    def __init__(
        self,
        *,
        provider_label: str,
        model_name: str,
        api_base_url: str,
        api_key: str | None,
        request_timeout_seconds: int,
    ) -> None:
        self.provider_label = provider_label
        self.model_name = model_name
        self.api_base_url = api_base_url.rstrip("/")
        self.api_key = api_key
        self.request_timeout_seconds = request_timeout_seconds

    async def generate_chat_completion(self, *, messages: list[dict[str, str]]) -> ChatGenerationResult:
        headers: dict[str, str] = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        async with httpx.AsyncClient(timeout=self.request_timeout_seconds) as client:
            response = await client.post(
                f"{self.api_base_url}/chat/completions",
                headers=headers,
                json={
                    "model": self.model_name,
                    "messages": messages,
                },
            )
            response.raise_for_status()

        payload = response.json()
        choice = payload["choices"][0]
        return ChatGenerationResult(
            content=choice["message"]["content"],
            model_name=payload.get("model", self.model_name),
            usage_json={
                "provider": self.provider_label,
                "usage": payload.get("usage", {}),
                "finish_reason": choice.get("finish_reason"),
            },
        )
