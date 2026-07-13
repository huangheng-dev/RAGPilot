from __future__ import annotations

import httpx

from ragpilot_api.application.model_gateway.contracts import ChatGenerationResult


class OllamaChatProvider:
    def __init__(
        self,
        *,
        provider_label: str,
        model_name: str,
        api_base_url: str,
        request_timeout_seconds: int,
    ) -> None:
        normalized_base_url = api_base_url.rstrip("/")
        if normalized_base_url.endswith("/v1"):
            normalized_base_url = normalized_base_url[:-3].rstrip("/")

        self.provider_label = provider_label
        self.model_name = model_name
        self.api_base_url = normalized_base_url
        self.request_timeout_seconds = request_timeout_seconds

    async def generate_chat_completion(self, *, messages: list[dict[str, str]]) -> ChatGenerationResult:
        async with httpx.AsyncClient(timeout=self.request_timeout_seconds) as client:
            response = await client.post(
                f"{self.api_base_url}/api/chat",
                json={
                    "model": self.model_name,
                    "messages": messages,
                    "stream": False,
                    "think": False,
                },
            )
            response.raise_for_status()

        payload = response.json()
        message = payload.get("message", {}) or {}
        content = message.get("content", "")

        return ChatGenerationResult(
            content=content,
            model_name=payload.get("model", self.model_name),
            usage_json={
                "provider": self.provider_label,
                "finish_reason": payload.get("done_reason"),
                "usage": {
                    "prompt_eval_count": payload.get("prompt_eval_count"),
                    "eval_count": payload.get("eval_count"),
                    "total_duration": payload.get("total_duration"),
                    "load_duration": payload.get("load_duration"),
                    "prompt_eval_duration": payload.get("prompt_eval_duration"),
                    "eval_duration": payload.get("eval_duration"),
                },
            },
        )
