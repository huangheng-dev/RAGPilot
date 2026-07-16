from __future__ import annotations

from typing import Any

import httpx
import pytest

from ragpilot_api.infrastructure.model_gateway.openai_compatible_provider import OpenAICompatibleChatProvider


class _StreamingResponse:
    def raise_for_status(self) -> None:
        return None

    async def aiter_lines(self):
        yield 'data: {"model":"test-model","choices":[{"delta":{"content":"Native "},"finish_reason":null}]}'
        yield 'data: {"choices":[{"delta":{"content":"stream"},"finish_reason":"stop"}]}'
        yield "data: [DONE]"


class _StreamContext:
    async def __aenter__(self) -> _StreamingResponse:
        return _StreamingResponse()

    async def __aexit__(self, exc_type, exc, tb) -> None:
        return None


class _StreamingClient:
    request: dict[str, Any] | None = None

    def __init__(self, *, timeout: int) -> None:
        self.timeout = timeout

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:
        return None

    def stream(self, method: str, url: str, *, headers: dict, json: dict) -> _StreamContext:
        _StreamingClient.request = {"method": method, "url": url, "headers": headers, "json": json}
        return _StreamContext()


@pytest.mark.anyio
async def test_openai_compatible_provider_emits_native_stream_deltas(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(httpx, "AsyncClient", _StreamingClient)
    provider = OpenAICompatibleChatProvider(
        provider_label="openai_compatible",
        model_name="test-model",
        api_base_url="http://127.0.0.1:8001/v1",
        api_key="secret",
        request_timeout_seconds=30,
    )
    deltas: list[str] = []

    result = await provider.generate_chat_completion_stream(
        messages=[{"role": "user", "content": "Stream"}],
        on_delta=lambda delta: _append_delta(deltas, delta),
    )

    assert deltas == ["Native ", "stream"]
    assert result.content == "Native stream"
    assert result.usage_json["streaming_mode"] == "provider_native"
    assert _StreamingClient.request is not None
    assert _StreamingClient.request["json"]["stream"] is True


async def _append_delta(target: list[str], delta: str) -> None:
    target.append(delta)
