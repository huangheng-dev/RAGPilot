from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol


@dataclass(frozen=True)
class ConnectorSource:
    data_source_id: str
    tenant_id: str
    knowledge_base_id: str
    source_uri: str | None
    cursor: str | None
    metadata: dict[str, object] = field(default_factory=dict)


@dataclass(frozen=True)
class ConnectorItem:
    external_id: str
    version_token: str
    title: str
    source_uri: str
    content: bytes
    content_type: str
    file_name: str
    metadata: dict[str, object] = field(default_factory=dict)


@dataclass(frozen=True)
class ConnectorPage:
    items: list[ConnectorItem]
    next_cursor: str
    authoritative_snapshot: bool = False
    discovered_count: int | None = None
    unchanged_count: int = 0


class ConnectorAdapter(Protocol):
    connector_kind: str

    async def discover(self, source: ConnectorSource) -> ConnectorPage: ...
