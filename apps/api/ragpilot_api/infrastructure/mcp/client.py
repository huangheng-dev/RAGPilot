from __future__ import annotations

from dataclasses import dataclass
from typing import Any
import asyncio

import httpx
from opentelemetry import trace
from ragpilot_api.infrastructure.observability import inject_trace_headers, traced
from ragpilot_api.infrastructure.runtime_policy import get_outbound_policy


class McpProtocolError(RuntimeError):
    pass


@dataclass(frozen=True)
class McpInitializeResult:
    protocol_version: str
    server_info: dict[str, Any]
    capabilities: dict[str, Any]
    session_id: str | None


class McpStreamableHttpClient:
    def __init__(self, *, base_url: str, bearer_token: str | None = None, timeout_seconds: float = 10.0,
                 concurrency_limit: int = 16, requests_per_minute: int = 240, max_attempts: int = 2,
                 retryable_status_codes: set[int] | None = None, retry_backoff_seconds: float = 0.25,
                 redis_url: str | None = None, redis_failure_mode: str = "local_fallback",
                 concurrency_lease_seconds: float = 300.0) -> None:
        self.base_url = base_url
        self.bearer_token = bearer_token
        self.timeout_seconds = timeout_seconds
        self.session_id: str | None = None
        self._request_id = 0
        self.supported_protocol_versions = {"2025-03-26", "2024-11-05"}
        self._policy_options = {
            "concurrency_limit": concurrency_limit, "requests_per_minute": requests_per_minute,
            "max_attempts": max_attempts, "retryable_status_codes": retryable_status_codes or {429, 502, 503, 504},
            "retry_backoff_seconds": retry_backoff_seconds,
            "redis_url": redis_url, "redis_failure_mode": redis_failure_mode,
            "concurrency_lease_seconds": concurrency_lease_seconds,
        }

    def _policy(self, *, retry_safe: bool = True):
        options = {**self._policy_options}
        if not retry_safe:
            options["max_attempts"] = 1
        return get_outbound_policy(lane=f"mcp:{'safe' if retry_safe else 'side_effect'}", **options)

    def _headers(self) -> dict[str, str]:
        headers = {
            "Accept": "application/json, text/event-stream",
            "Content-Type": "application/json",
        }
        if self.bearer_token:
            headers["Authorization"] = f"Bearer {self.bearer_token}"
        if self.session_id:
            headers["Mcp-Session-Id"] = self.session_id
        return inject_trace_headers(headers)

    @traced("mcp.jsonrpc.request")
    async def _request(self, method: str, params: dict[str, Any] | None = None) -> tuple[dict[str, Any], httpx.Headers]:
        trace.get_current_span().set_attribute("mcp.method", method)
        self._request_id += 1
        payload = {
            "jsonrpc": "2.0",
            "id": self._request_id,
            "method": method,
            "params": params or {},
        }
        async def request() -> httpx.Response:
            async with httpx.AsyncClient(timeout=self.timeout_seconds, follow_redirects=True) as client:
                response = await client.post(self.base_url, headers=self._headers(), json=payload)
                response.raise_for_status()
                return response
        request_id = self._request_id
        try:
            response, attempts = await self._policy(retry_safe=method != "tools/call").execute(request)
        except asyncio.CancelledError:
            await self._notify_cancellation(request_id=request_id, reason="Caller cancelled the in-flight MCP request.")
            raise
        trace.get_current_span().set_attribute("runtime.policy_attempts", attempts)
        try:
            body = response.json()
        except ValueError as error:
            raise McpProtocolError("MCP endpoint returned a non-JSON response.") from error
        if not isinstance(body, dict) or body.get("jsonrpc") != "2.0":
            raise McpProtocolError("MCP endpoint returned an invalid JSON-RPC envelope.")
        if isinstance(body.get("error"), dict):
            error_payload = body["error"]
            raise McpProtocolError(str(error_payload.get("message") or "MCP request failed."))
        result = body.get("result")
        if not isinstance(result, dict):
            raise McpProtocolError("MCP response did not contain an object result.")
        return result, response.headers

    async def _notify_cancellation(self, *, request_id: int, reason: str) -> None:
        payload = {
            "jsonrpc": "2.0", "method": "notifications/cancelled",
            "params": {"requestId": request_id, "reason": reason},
        }
        try:
            async with httpx.AsyncClient(timeout=min(self.timeout_seconds, 2.0), follow_redirects=True) as client:
                await client.post(self.base_url, headers=self._headers(), json=payload)
        except (httpx.HTTPError, asyncio.CancelledError):
            return

    async def _notify(self, method: str, params: dict[str, Any] | None = None) -> None:
        payload = {"jsonrpc": "2.0", "method": method, "params": params or {}}
        async def request() -> httpx.Response:
            async with httpx.AsyncClient(timeout=self.timeout_seconds, follow_redirects=True) as client:
                response = await client.post(self.base_url, headers=self._headers(), json=payload)
                response.raise_for_status()
                return response
        await self._policy().execute(request)

    @traced("mcp.initialize")
    async def initialize(self) -> McpInitializeResult:
        result, headers = await self._request(
            "initialize",
            {
                "protocolVersion": "2025-03-26",
                "capabilities": {},
                "clientInfo": {"name": "RagPilot", "version": "0.1.0"},
            },
        )
        protocol_version = result.get("protocolVersion")
        server_info = result.get("serverInfo")
        capabilities = result.get("capabilities")
        if not isinstance(protocol_version, str) or not isinstance(server_info, dict):
            raise McpProtocolError("MCP initialize result is missing protocolVersion or serverInfo.")
        if protocol_version not in self.supported_protocol_versions:
            raise McpProtocolError(f"MCP server selected unsupported protocol version: {protocol_version}.")
        self.session_id = headers.get("mcp-session-id")
        await self._notify("notifications/initialized")
        return McpInitializeResult(
            protocol_version=protocol_version,
            server_info=server_info,
            capabilities=capabilities if isinstance(capabilities, dict) else {},
            session_id=self.session_id,
        )

    @traced("mcp.tools.list")
    async def list_tools(self) -> list[dict[str, Any]]:
        discovered_tools: list[dict[str, Any]] = []
        cursor: str | None = None
        seen_cursors: set[str] = set()
        for _ in range(100):
            result, _ = await self._request("tools/list", {"cursor": cursor} if cursor else {})
            tools = result.get("tools")
            if not isinstance(tools, list):
                raise McpProtocolError("MCP tools/list result is missing the tools array.")
            discovered_tools.extend(tool for tool in tools if isinstance(tool, dict))
            next_cursor = result.get("nextCursor")
            if not isinstance(next_cursor, str) or not next_cursor:
                return discovered_tools
            if next_cursor in seen_cursors:
                raise McpProtocolError("MCP tools/list returned a repeated pagination cursor.")
            seen_cursors.add(next_cursor)
            cursor = next_cursor
        raise McpProtocolError("MCP tools/list exceeded the pagination safety limit.")

    @traced("mcp.tools.call")
    async def call_tool(self, *, name: str, arguments: dict[str, Any]) -> dict[str, Any]:
        result, _ = await self._request("tools/call", {"name": name, "arguments": arguments})
        return result

    async def close(self) -> None:
        if not self.session_id:
            return
        async def request() -> httpx.Response:
            async with httpx.AsyncClient(timeout=self.timeout_seconds, follow_redirects=True) as client:
                return await client.delete(self.base_url, headers=self._headers())
        response, _ = await self._policy().execute(request)
        if response.status_code not in {200, 202, 204, 404, 405}:
            response.raise_for_status()
        self.session_id = None
