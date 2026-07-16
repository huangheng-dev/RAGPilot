from __future__ import annotations

import asyncio
import hashlib
import ipaddress
import json
import re
import socket
from html import unescape
from urllib.parse import urljoin, urlparse

import httpx

from ragpilot_worker.domain.connectors import ConnectorItem, ConnectorPage, ConnectorSource


MAX_BYTES = 10 * 1024 * 1024
MAX_REDIRECTS = 5
SUPPORTED_CONTENT_TYPES = {"text/html", "application/xhtml+xml", "text/plain"}


class PublicWebConnector:
    connector_kind = "public_web_v1"

    async def discover(self, source: ConnectorSource) -> ConnectorPage:
        if not source.source_uri:
            raise ValueError("The public web connector requires source_uri.")
        prior = _decode_cursor(source.cursor)
        headers = {"Accept": "text/html,application/xhtml+xml,text/plain;q=0.9"}
        if prior.get("etag"):
            headers["If-None-Match"] = str(prior["etag"])
        if prior.get("last_modified"):
            headers["If-Modified-Since"] = str(prior["last_modified"])

        current_url = validate_public_url(source.source_uri)
        async with httpx.AsyncClient(timeout=20.0, follow_redirects=False, trust_env=False) as client:
            for redirect_count in range(MAX_REDIRECTS + 1):
                await validate_public_destination(current_url)
                async with client.stream("GET", current_url, headers=headers) as response:
                    if response.status_code == 304:
                        return ConnectorPage(
                            items=[], next_cursor=source.cursor or "{}", authoritative_snapshot=False,
                            discovered_count=1, unchanged_count=1,
                        )
                    if response.is_redirect:
                        if redirect_count >= MAX_REDIRECTS:
                            raise ValueError("Connector redirect safety limit exceeded.")
                        location = response.headers.get("location")
                        if not location:
                            raise ValueError("Connector received an invalid redirect.")
                        current_url = validate_public_url(urljoin(str(response.url), location))
                        continue
                    response.raise_for_status()
                    content_type = response.headers.get("content-type", "").split(";", 1)[0].strip().lower()
                    if content_type not in SUPPORTED_CONTENT_TYPES:
                        raise ValueError("Public web connector accepts only HTML or plain-text content.")
                    content = bytearray()
                    async for chunk in response.aiter_bytes():
                        if len(content) + len(chunk) > MAX_BYTES:
                            raise ValueError("Connector response exceeds the 10 MB safety limit.")
                        content.extend(chunk)
                    if not content:
                        raise ValueError("Connector response was empty.")
                    payload = bytes(content)
                    content_hash = hashlib.sha256(payload).hexdigest()
                    cursor = json.dumps({
                        "etag": response.headers.get("etag"),
                        "last_modified": response.headers.get("last-modified"),
                        "content_hash": content_hash,
                    }, separators=(",", ":"))
                    if prior.get("content_hash") == content_hash:
                        return ConnectorPage(
                            items=[], next_cursor=cursor, authoritative_snapshot=False,
                            discovered_count=1, unchanged_count=1,
                        )
                    final_url = str(response.url)
                    text = payload.decode(response.encoding or "utf-8", errors="replace")
                    title = _extract_title(text) or (urlparse(final_url).hostname or "Imported web page")
                    suffix = ".html" if content_type in {"text/html", "application/xhtml+xml"} else ".txt"
                    return ConnectorPage(items=[ConnectorItem(
                        external_id=final_url,
                        version_token=response.headers.get("etag") or response.headers.get("last-modified") or content_hash,
                        title=title[:240],
                        source_uri=final_url,
                        content=payload,
                        content_type=content_type,
                        file_name=f"web-{content_hash[:12]}{suffix}",
                        metadata={"connector_kind": self.connector_kind},
                    )], next_cursor=cursor, authoritative_snapshot=True)
        raise ValueError("Unable to fetch connector source.")


def _decode_cursor(cursor: str | None) -> dict[str, object]:
    if not cursor:
        return {}
    try:
        value = json.loads(cursor)
    except json.JSONDecodeError:
        return {"content_hash": cursor}
    return value if isinstance(value, dict) else {}


def _extract_title(text: str) -> str | None:
    match = re.search(r"<title[^>]*>(.*?)</title>", text, flags=re.IGNORECASE | re.DOTALL)
    return re.sub(r"\s+", " ", unescape(match.group(1))).strip() if match else None


def validate_public_url(url: str) -> str:
    normalized = url.strip()
    parsed = urlparse(normalized)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError("Connector URL must be an absolute public HTTP(S) URL without embedded credentials.")
    host = parsed.hostname.rstrip(".").lower()
    if host == "localhost" or host.endswith((".localhost", ".local")):
        raise ValueError("Connector cannot access local or private network destinations.")
    try:
        literal_address = ipaddress.ip_address(host)
    except ValueError:
        literal_address = None
    if literal_address is not None:
        _require_public_ip(literal_address)
    return normalized


async def validate_public_destination(url: str) -> None:
    parsed = urlparse(validate_public_url(url))
    host = parsed.hostname or ""
    try:
        literal_address = ipaddress.ip_address(host)
    except ValueError:
        literal_address = None
    if literal_address is not None:
        _require_public_ip(literal_address)
        return
    try:
        addresses = await asyncio.get_running_loop().getaddrinfo(
            host, parsed.port or (443 if parsed.scheme == "https" else 80), type=socket.SOCK_STREAM
        )
    except OSError as error:
        raise ValueError("Unable to resolve connector destination.") from error
    for address in {entry[4][0] for entry in addresses}:
        _require_public_ip(ipaddress.ip_address(address))


def _require_public_ip(address) -> None:
    if not address.is_global:
        raise ValueError("Connector cannot access local or private network destinations.")
