from __future__ import annotations

import json
from collections.abc import Awaitable, Callable

import httpx
from ragpilot_api.infrastructure.observability import inject_trace_headers, traced

from ragpilot_api.application.model_gateway.contracts import ChatGenerationResult
from ragpilot_api.infrastructure.runtime_policy import get_outbound_policy


class OllamaChatProvider:
    def __init__(
        self,
        *,
        provider_label: str,
        model_name: str,
        api_base_url: str,
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
        normalized_base_url = api_base_url.rstrip("/")
        if normalized_base_url.endswith("/v1"):
            normalized_base_url = normalized_base_url[:-3].rstrip("/")

        self.provider_label = provider_label
        self.model_name = model_name
        self.api_base_url = normalized_base_url
        self.request_timeout_seconds = request_timeout_seconds
        self.policy = get_outbound_policy(
            lane="model", concurrency_limit=concurrency_limit, requests_per_minute=requests_per_minute,
            max_attempts=max_attempts, retryable_status_codes=retryable_status_codes or {429, 502, 503, 504},
            retry_backoff_seconds=retry_backoff_seconds,
            redis_url=redis_url, redis_failure_mode=redis_failure_mode,
            concurrency_lease_seconds=concurrency_lease_seconds,
        )

    @traced("model.provider.ollama")
    async def generate_chat_completion(self, *, messages: list[dict[str, str]]) -> ChatGenerationResult:
        async def request() -> httpx.Response:
            async with httpx.AsyncClient(
                timeout=self.request_timeout_seconds,
                headers=inject_trace_headers(),
            ) as client:
                response = await client.post(
                    f"{self.api_base_url}/api/chat",
                    json={"model": self.model_name, "messages": messages, "stream": False, "think": False},
                )
                response.raise_for_status()
                return response

        response, attempts = await self.policy.execute(request)

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
                "policy_attempts": attempts,
            },
        )

    @traced("model.provider.ollama.stream")
    async def generate_chat_completion_stream(
        self,
        *,
        messages: list[dict[str, str]],
        on_delta: Callable[[str], Awaitable[None]],
    ) -> ChatGenerationResult:
        async def request() -> ChatGenerationResult:
            chunks: list[str] = []
            final_payload: dict = {}
            async with httpx.AsyncClient(
                timeout=self.request_timeout_seconds,
                headers=inject_trace_headers(),
            ) as client:
                async with client.stream(
                    "POST",
                    f"{self.api_base_url}/api/chat",
                    json={"model": self.model_name, "messages": messages, "stream": True, "think": False},
                ) as response:
                    response.raise_for_status()
                    async for line in response.aiter_lines():
                        if not line.strip():
                            continue
                        payload = json.loads(line)
                        if payload.get("done"):
                            final_payload = payload
                        message = payload.get("message") or {}
                        content = message.get("content")
                        if isinstance(content, str) and content:
                            chunks.append(content)
                            await on_delta(content)
            return ChatGenerationResult(
                content="".join(chunks),
                model_name=final_payload.get("model", self.model_name),
                usage_json={
                    "provider": self.provider_label,
                    "finish_reason": final_payload.get("done_reason"),
                    "usage": {
                        "prompt_eval_count": final_payload.get("prompt_eval_count"),
                        "eval_count": final_payload.get("eval_count"),
                        "total_duration": final_payload.get("total_duration"),
                        "load_duration": final_payload.get("load_duration"),
                        "prompt_eval_duration": final_payload.get("prompt_eval_duration"),
                        "eval_duration": final_payload.get("eval_duration"),
                    },
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
