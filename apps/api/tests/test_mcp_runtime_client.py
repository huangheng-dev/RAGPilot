import json

import httpx
import pytest

from ragpilot_api.infrastructure.mcp.client import McpProtocolError, McpStreamableHttpClient


def install_mock_client(monkeypatch, handler):
    transport = httpx.MockTransport(handler)
    original_async_client = httpx.AsyncClient
    monkeypatch.setattr(
        "ragpilot_api.infrastructure.mcp.client.httpx.AsyncClient",
        lambda **kwargs: original_async_client(transport=transport, **kwargs),
    )


@pytest.mark.asyncio
async def test_initialize_sends_initialized_notification_and_preserves_session(monkeypatch):
    methods = []

    def handler(request: httpx.Request) -> httpx.Response:
        payload = json.loads(request.content)
        methods.append(payload["method"])
        if payload["method"] == "initialize":
            return httpx.Response(
                200,
                headers={"mcp-session-id": "session-1"},
                json={
                    "jsonrpc": "2.0",
                    "id": payload["id"],
                    "result": {
                        "protocolVersion": "2025-03-26",
                        "serverInfo": {"name": "test", "version": "1"},
                        "capabilities": {"tools": {}},
                    },
                },
            )
        assert request.headers["mcp-session-id"] == "session-1"
        return httpx.Response(202)

    install_mock_client(monkeypatch, handler)
    result = await McpStreamableHttpClient(base_url="https://mcp.example").initialize()

    assert result.session_id == "session-1"
    assert methods == ["initialize", "notifications/initialized"]


@pytest.mark.asyncio
async def test_list_tools_follows_pagination(monkeypatch):
    def handler(request: httpx.Request) -> httpx.Response:
        payload = json.loads(request.content)
        if payload["method"] == "tools/list" and not payload["params"].get("cursor"):
            result = {"tools": [{"name": "first"}], "nextCursor": "next"}
        else:
            result = {"tools": [{"name": "second"}]}
        return httpx.Response(200, json={"jsonrpc": "2.0", "id": payload["id"], "result": result})

    install_mock_client(monkeypatch, handler)
    tools = await McpStreamableHttpClient(base_url="https://mcp.example").list_tools()

    assert [tool["name"] for tool in tools] == ["first", "second"]


@pytest.mark.asyncio
async def test_invalid_json_rpc_response_is_rejected(monkeypatch):
    install_mock_client(monkeypatch, lambda request: httpx.Response(200, json={"result": {}}))

    with pytest.raises(McpProtocolError):
        await McpStreamableHttpClient(base_url="https://mcp.example").list_tools()
