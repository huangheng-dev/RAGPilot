from __future__ import annotations

import json
from collections.abc import Awaitable, Callable

import httpx
from ragpilot_api.infrastructure.observability import inject_trace_headers, traced

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
        redis_url: str | None = None,
        redis_failure_mode: str = "local_fallback",
        concurrency_lease_seconds: float = 300.0,
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
            redis_url=redis_url, redis_failure_mode=redis_failure_mode,
            concurrency_lease_seconds=concurrency_lease_seconds,
        )

    @traced("model.provider.openai_compatible")
    async def generate_chat_completion(self, *, messages: list[dict[str, str]]) -> ChatGenerationResult:
        headers: dict[str, str] = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        headers = inject_trace_headers(headers)

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

    @traced("model.provider.openai_compatible.stream")
    async def generate_chat_completion_stream(
        self,
        *,
        messages: list[dict[str, str]],
        on_delta: Callable[[str], Awaitable[None]],
    ) -> ChatGenerationResult:
        headers: dict[str, str] = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        headers = inject_trace_headers(headers)

        async def request() -> ChatGenerationResult:
            chunks: list[str] = []
            finish_reason: str | None = None
            model_name = self.model_name
            usage: dict = {}
            async with httpx.AsyncClient(timeout=self.request_timeout_seconds) as client:
                async with client.stream(
                    "POST",
                    f"{self.api_base_url}/chat/completions",
                    headers=headers,
                    json={"model": self.model_name, "messages": messages, "stream": True},
                ) as response:
                    response.raise_for_status()
                    async for line in response.aiter_lines():
                        if not line.startswith("data:"):
                            continue
                        data = line[5:].strip()
                        if not data or data == "[DONE]":
                            continue
                        payload = json.loads(data)
                        model_name = payload.get("model", model_name)
                        if isinstance(payload.get("usage"), dict):
                            usage = payload["usage"]
                        choices = payload.get("choices") or []
                        if not choices:
                            continue
                        choice = choices[0]
                        finish_reason = choice.get("finish_reason") or finish_reason
                        delta = choice.get("delta") or {}
                        content = delta.get("content")
                        if isinstance(content, str) and content:
                            chunks.append(content)
                            await on_delta(content)
            return ChatGenerationResult(
                content="".join(chunks),
                model_name=model_name,
                usage_json={
                    "provider": self.provider_label,
                    "usage": usage,
                    "finish_reason": finish_reason,
                    "policy_attempts": 1,
                    "streaming_mode": "provider_native",
                },
            )

        try:
            result, _ = await self.policy.execute_once(request)
            return result
        except httpx.HTTPStatusError as error:
            if error.response.status_code not in {400, 404, 405, 422, 501}:
                raise
            fallback = await self.generate_chat_completion(messages=messages)
            for offset in range(0, len(fallback.content), 24):
                await on_delta(fallback.content[offset:offset + 24])
            return ChatGenerationResult(
                content=fallback.content,
                model_name=fallback.model_name,
                usage_json={**fallback.usage_json, "streaming_mode": "completion_chunked_fallback"},
            )
