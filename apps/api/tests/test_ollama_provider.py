from __future__ import annotations

from typing import Any

import httpx
import pytest

from ragpilot_api.infrastructure.model_gateway.ollama_provider import OllamaChatProvider


class _MockResponse:
    def __init__(self, payload: dict[str, Any]) -> None:
        self._payload = payload

    def raise_for_status(self) -> None:
        return None

    def json(self) -> dict[str, Any]:
        return self._payload


class _MockAsyncClient:
    last_request: dict[str, Any] | None = None

    def __init__(self, *, timeout: int, headers: dict[str, str] | None = None) -> None:
        self.timeout = timeout
        self.headers = headers or {}

    async def __aenter__(self) -> "_MockAsyncClient":
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:
        return None

    async def post(self, url: str, json: dict[str, Any]) -> _MockResponse:
        _MockAsyncClient.last_request = {
            "url": url,
            "json": json,
            "timeout": self.timeout,
            "headers": self.headers,
        }
        return _MockResponse(
            {
                "model": "llama3.1",
                "message": {
                    "role": "assistant",
                    "content": "Temporal handles durable ingestion workflows."
                },
                "done_reason": "stop",
                "prompt_eval_count": 18,
                "eval_count": 42,
            }
        )


@pytest.mark.anyio
async def test_ollama_provider_posts_native_chat_request(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(httpx, "AsyncClient", _MockAsyncClient)
    provider = OllamaChatProvider(
        provider_label="ollama",
        model_name="llama3.1",
        api_base_url="http://127.0.0.1:11434/v1",
        request_timeout_seconds=45,
    )

    result = await provider.generate_chat_completion(
        messages=[
            {"role": "system", "content": "Stay grounded."},
            {"role": "user", "content": "Which system handles durable ingestion workflows?"},
        ]
    )

    assert _MockAsyncClient.last_request is not None
    assert _MockAsyncClient.last_request["url"] == "http://127.0.0.1:11434/api/chat"
    assert _MockAsyncClient.last_request["json"]["model"] == "llama3.1"
    assert _MockAsyncClient.last_request["json"]["stream"] is False
    assert _MockAsyncClient.last_request["json"]["think"] is False
    assert result.model_name == "llama3.1"
    assert result.content == "Temporal handles durable ingestion workflows."
    assert result.usage_json["provider"] == "ollama"
    assert result.usage_json["finish_reason"] == "stop"


@pytest.mark.anyio
async def test_ollama_provider_emits_native_stream_deltas(monkeypatch: pytest.MonkeyPatch) -> None:
    original_async_client = httpx.AsyncClient

    def handler(request: httpx.Request) -> httpx.Response:
        payload = __import__("json").loads(request.content)
        assert payload["stream"] is True
        return httpx.Response(
            200,
            text=(
                '{"model":"llama3.1","message":{"content":"Durable "},"done":false}\n'
                '{"model":"llama3.1","message":{"content":"stream"},"done":false}\n'
                '{"model":"llama3.1","message":{"content":""},"done":true,"done_reason":"stop","eval_count":2}\n'
            ),
            headers={"content-type": "application/x-ndjson"},
        )

    monkeypatch.setattr(
        "ragpilot_api.infrastructure.model_gateway.ollama_provider.httpx.AsyncClient",
        lambda **kwargs: original_async_client(transport=httpx.MockTransport(handler), **kwargs),
    )
    provider = OllamaChatProvider(
        provider_label="ollama",
        model_name="llama3.1",
        api_base_url="http://127.0.0.1:11434",
        request_timeout_seconds=45,
    )
    deltas: list[str] = []

    async def collect(delta: str) -> None:
        deltas.append(delta)

    result = await provider.generate_chat_completion_stream(
        messages=[{"role": "user", "content": "Stream"}],
        on_delta=collect,
    )

    assert deltas == ["Durable ", "stream"]
    assert result.content == "Durable stream"
    assert result.usage_json["streaming_mode"] == "provider_native"
    assert result.usage_json["usage"]["eval_count"] == 2
