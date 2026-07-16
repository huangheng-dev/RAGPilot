from __future__ import annotations

import ipaddress
from unittest.mock import AsyncMock

import httpx
import pytest

from ragpilot_worker.domain.connectors import ConnectorSource
from ragpilot_worker.infrastructure.connectors.public_web import PublicWebConnector, validate_public_destination, validate_public_url
from ragpilot_worker.infrastructure.connectors.registry import resolve_connector


def source(*, cursor: str | None = None) -> ConnectorSource:
    return ConnectorSource(
        data_source_id="source-id", tenant_id="tenant-id", knowledge_base_id="kb-id",
        source_uri="https://example.com/handbook", cursor=cursor,
    )


def test_registry_resolves_versioned_public_web_adapter() -> None:
    assert resolve_connector("PUBLIC_WEB_V1").connector_kind == "public_web_v1"
    with pytest.raises(ValueError, match="Unsupported connector kind"):
        resolve_connector("unknown")


@pytest.mark.parametrize("url", [
    "http://127.0.0.1/admin",
    "http://10.0.0.8/private",
    "http://169.254.169.254/latest/meta-data",
    "http://[::1]/",
    "http://localhost/internal",
    "https://user:password@example.com/",
])
def test_public_web_url_policy_rejects_private_and_credentialed_destinations(url: str) -> None:
    with pytest.raises(ValueError):
        validate_public_url(url)


def test_public_web_url_policy_accepts_public_https_url() -> None:
    assert validate_public_url("https://example.com/handbook") == "https://example.com/handbook"


@pytest.mark.anyio
async def test_destination_policy_rejects_dns_rebinding_to_private_ip(monkeypatch) -> None:
    loop = __import__("asyncio").get_running_loop()
    monkeypatch.setattr(loop, "getaddrinfo", AsyncMock(return_value=[
        (2, 1, 6, "", (str(ipaddress.ip_address("10.0.0.4")), 443)),
    ]))
    with pytest.raises(ValueError, match="private network"):
        await validate_public_destination("https://example.invalid/path")


@pytest.mark.anyio
async def test_public_web_connector_uses_content_hash_cursor_for_incremental_noop(monkeypatch) -> None:
    html = b"<html><head><title>Handbook</title></head><body>Version one</body></html>"

    async def fake_validate(_url: str) -> None:
        return None

    class FakeClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        def stream(self, _method, url, headers):
            response = httpx.Response(
                200, headers={"content-type": "text/html", "etag": '"v1"'}, content=html,
                request=httpx.Request("GET", url, headers=headers),
            )

            class StreamContext:
                async def __aenter__(self):
                    return response

                async def __aexit__(self, *_args):
                    await response.aclose()

            return StreamContext()

    monkeypatch.setattr("ragpilot_worker.infrastructure.connectors.public_web.validate_public_destination", fake_validate)
    monkeypatch.setattr("ragpilot_worker.infrastructure.connectors.public_web.httpx.AsyncClient", lambda **_kwargs: FakeClient())
    connector = PublicWebConnector()
    first = await connector.discover(source())
    second = await connector.discover(source(cursor=first.next_cursor))

    assert len(first.items) == 1
    assert first.items[0].title == "Handbook"
    assert second.items == []
    assert second.authoritative_snapshot is False
    assert second.discovered_count == 1
    assert second.unchanged_count == 1
