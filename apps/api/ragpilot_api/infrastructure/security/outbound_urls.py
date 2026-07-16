from __future__ import annotations

import asyncio
import ipaddress
import socket
from urllib.parse import urlparse

import httpx


class OutboundUrlPolicyError(ValueError):
    """Raised when an untrusted outbound URL crosses the public-network boundary."""


def validate_public_http_url(url: str) -> str:
    normalized_url = url.strip()
    parsed_url = urlparse(normalized_url)
    if parsed_url.scheme not in {"http", "https"} or not parsed_url.netloc or not parsed_url.hostname:
        raise OutboundUrlPolicyError("Web import only accepts absolute http or https URLs.")
    if parsed_url.username is not None or parsed_url.password is not None:
        raise OutboundUrlPolicyError("Web import URLs cannot include embedded credentials.")

    normalized_host = parsed_url.hostname.rstrip(".").lower()
    if normalized_host == "localhost" or normalized_host.endswith((".localhost", ".local")):
        raise OutboundUrlPolicyError("Web import cannot access local or private network addresses.")

    try:
        literal_ip = ipaddress.ip_address(normalized_host)
    except ValueError:
        literal_ip = None
    if literal_ip is not None:
        _require_public_ip(literal_ip)
    return normalized_url


async def validate_public_http_destination(url: str) -> None:
    normalized_url = validate_public_http_url(url)
    parsed_url = urlparse(normalized_url)
    host = parsed_url.hostname
    if host is None:
        raise OutboundUrlPolicyError("Web import URL is missing a destination host.")

    try:
        ip_address = ipaddress.ip_address(host)
    except ValueError:
        port = parsed_url.port or (443 if parsed_url.scheme == "https" else 80)
        try:
            address_info = await asyncio.get_running_loop().getaddrinfo(
                host,
                port,
                type=socket.SOCK_STREAM,
            )
        except OSError as error:
            raise OutboundUrlPolicyError("Unable to resolve the web import destination.") from error
        if not address_info:
            raise OutboundUrlPolicyError("Unable to resolve the web import destination.")
        for resolved_address in {entry[4][0] for entry in address_info}:
            _require_public_ip(ipaddress.ip_address(resolved_address))
        return

    _require_public_ip(ip_address)


def validate_response_peer(response: httpx.Response) -> None:
    network_stream = response.extensions.get("network_stream")
    if network_stream is None or not hasattr(network_stream, "get_extra_info"):
        return
    server_address = network_stream.get_extra_info("server_addr")
    if not server_address:
        return
    peer_host = server_address[0] if isinstance(server_address, tuple) else str(server_address)
    _require_public_ip(ipaddress.ip_address(peer_host))


def _require_public_ip(ip_address: ipaddress.IPv4Address | ipaddress.IPv6Address) -> None:
    if not ip_address.is_global:
        raise OutboundUrlPolicyError("Web import cannot access local or private network addresses.")
