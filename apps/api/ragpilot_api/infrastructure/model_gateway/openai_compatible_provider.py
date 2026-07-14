from __future__ import annotations

import httpx
from ragpilot_api.infrastructure.observability import traced

from ragpilot_api.application.model_gateway.contracts import ChatGenerationResult
from ragpilot_api.infrastructure.runtime_policy import get_outbound_policy


class OpenAICompatibleChatProvider:
    def __init__(
        self,
        *,
        provider_label: str,
        model_name: str,
        api_base_url: str,
        api_key: str | None,
        request_timeout_seconds: int,
        concurrency_limit: int = 8,
        requests_per_minute: int = 120,
        max_attempts: int = 2,
        retryable_status_codes: set[int] | None = None,
        retry_backoff_seconds: float = 0.25,
    ) -> None:
        self.provider_label = provider_label
        self.model_name = model_name
        self.api_base_url = api_base_url.rstrip("/")
        self.api_key = api_key
        self.request_timeout_seconds = request_timeout_seconds
        self.policy = get_outbound_policy(
            lane="model", concurrency_limit=concurrency_limit, requests_per_minute=requests_per_minute,
            max_attempts=max_attempts, retryable_status_codes=retryable_status_codes or {429, 502, 503, 504},
            retry_backoff_seconds=retry_backoff_seconds,
        )

    @traced("model.provider.openai_compatible")
    async def generate_chat_completion(self, *, messages: list[dict[str, str]]) -> ChatGenerationResult:
        headers: dict[str, str] = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        async def request() -> httpx.Response:
            async with httpx.AsyncClient(timeout=self.request_timeout_seconds) as client:
                response = await client.post(
                    f"{self.api_base_url}/chat/completions", headers=headers,
                    json={"model": self.model_name, "messages": messages},
                )
                response.raise_for_status()
                return response

        response, attempts = await self.policy.execute(request)

        payload = response.json()
        choice = payload["choices"][0]
        return ChatGenerationResult(
            content=choice["message"]["content"],
            model_name=payload.get("model", self.model_name),
            usage_json={
                "provider": self.provider_label,
                "usage": payload.get("usage", {}),
                "finish_reason": choice.get("finish_reason"),
                "policy_attempts": attempts,
            },
        )
