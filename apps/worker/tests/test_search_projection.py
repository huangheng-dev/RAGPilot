from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock

import pytest

from ragpilot_worker.application.search_projection_service import project_document_version
from ragpilot_worker.infrastructure.search.elasticsearch_client import (
    ElasticsearchProjectionClient,
    ElasticsearchProjectionError,
    _json_default,
)
from ragpilot_worker.infrastructure.search.index_contract import (
    build_chunk_index_contract,
    build_chunk_index_name,
    build_chunk_read_alias,
    build_chunk_write_alias,
)


def test_chunk_index_contract_is_versioned_strict_and_aliased() -> None:
    assert build_chunk_index_name(prefix="ragpilot-document-chunks", version=1) == "ragpilot-document-chunks-v1"
    assert build_chunk_read_alias(prefix="ragpilot-document-chunks") == "ragpilot-document-chunks-read"
    assert build_chunk_write_alias(prefix="ragpilot-document-chunks") == "ragpilot-document-chunks-write"

    contract = build_chunk_index_contract(prefix="ragpilot-document-chunks", version=1)

    assert contract["mappings"]["dynamic"] == "strict"
    assert contract["mappings"]["properties"]["tenant_id"] == {"type": "keyword"}
    assert contract["mappings"]["properties"]["content"]["type"] == "text"
    assert contract["aliases"] == {
        "ragpilot-document-chunks-read": {},
        "ragpilot-document-chunks-write": {"is_write_index": True},
    }
    assert contract["mappings"]["_meta"]["source_of_truth"] == "postgresql"
    staging_contract = build_chunk_index_contract(
        prefix="ragpilot-document-chunks",
        version=2,
        include_aliases=False,
    )
    assert "aliases" not in staging_contract


def test_elasticsearch_json_dates_use_iso_8601_separator() -> None:
    value = datetime(2026, 7, 14, 12, 30, tzinfo=timezone.utc)

    assert _json_default(value) == "2026-07-14T12:30:00+00:00"


@pytest.mark.anyio
async def test_projection_client_rejects_cross_tenant_payload_before_network_access() -> None:
    client = ElasticsearchProjectionClient(base_url="http://127.0.0.1:1")

    with pytest.raises(ElasticsearchProjectionError, match="crossed its tenant"):
        await client.replace_document(
            index_name="ragpilot-document-chunks-v1",
            tenant_id="tenant-1",
            document_id="document-1",
            document_version_id="version-1",
            chunks=[
                {
                    "tenant_id": "tenant-2",
                    "document_id": "document-1",
                    "document_version_id": "version-1",
                    "document_chunk_id": "chunk-1",
                }
            ],
        )


@pytest.mark.anyio
async def test_project_document_version_is_idempotent_for_completed_event() -> None:
    service = AsyncMock()
    service.claim_event.return_value = {"event_status": "completed"}
    client = AsyncMock()

    result = await project_document_version(
        service=service,
        client=client,
        event_id="event-1",
        index_prefix="ragpilot-document-chunks",
        index_version=1,
    )

    assert result == {"event_id": "event-1", "status": "completed", "idempotent_replay": True}
    service.load_document_version_projection.assert_not_awaited()
    client.ensure_index.assert_not_awaited()


@pytest.mark.anyio
async def test_project_document_version_replaces_scoped_projection_and_completes_event() -> None:
    chunks = [
        {
            "tenant_id": "tenant-1",
            "document_version_id": "version-1",
            "document_chunk_id": "chunk-1",
            "content": "Grounded content",
        }
    ]
    service = AsyncMock()
    service.claim_event.return_value = {
        "id": "event-1",
        "tenant_id": "tenant-1",
        "document_id": "document-1",
        "document_version_id": "version-1",
        "event_type": "document_version_upsert",
        "event_status": "processing",
    }
    service.load_document_version_projection.return_value = chunks
    client = AsyncMock()
    client.resolve_write_alias.return_value = "ragpilot-document-chunks-write"
    client.replace_document.return_value = 1

    result = await project_document_version(
        service=service,
        client=client,
        event_id="event-1",
        index_prefix="ragpilot-document-chunks",
        index_version=1,
    )

    client.resolve_write_alias.assert_awaited_once()
    client.replace_document.assert_awaited_once_with(
        index_name="ragpilot-document-chunks-write",
        tenant_id="tenant-1",
        document_id="document-1",
        document_version_id="version-1",
        chunks=chunks,
    )
    service.mark_completed.assert_awaited_once_with(event_id="event-1", projected_chunk_count=1)
    assert result["projected_chunk_count"] == 1
    assert result["idempotent_replay"] is False


@pytest.mark.anyio
async def test_project_document_delete_removes_all_projected_versions() -> None:
    service = AsyncMock()
    service.claim_event.return_value = {
        "id": "event-1",
        "tenant_id": "tenant-1",
        "document_id": "document-1",
        "document_version_id": None,
        "event_type": "document_delete",
        "event_status": "processing",
    }
    client = AsyncMock()
    client.resolve_write_alias.return_value = "ragpilot-document-chunks-write"
    client.delete_document.return_value = 3

    result = await project_document_version(
        service=service,
        client=client,
        event_id="event-1",
        index_prefix="ragpilot-document-chunks",
        index_version=1,
    )

    client.delete_document.assert_awaited_once_with(
        index_name="ragpilot-document-chunks-write",
        tenant_id="tenant-1",
        document_id="document-1",
    )
    service.load_document_version_projection.assert_not_awaited()
    service.mark_completed.assert_awaited_once_with(event_id="event-1", projected_chunk_count=0)
    assert result["deleted_chunk_count"] == 3


@pytest.mark.anyio
async def test_rebuild_event_targets_concrete_version_without_moving_live_aliases() -> None:
    chunks = [
        {
            "tenant_id": "tenant-1",
            "document_id": "document-1",
            "document_version_id": "version-1",
            "document_chunk_id": "chunk-1",
            "content": "Grounded content",
        }
    ]
    service = AsyncMock()
    service.claim_event.return_value = {
        "id": "event-1",
        "tenant_id": "tenant-1",
        "document_id": "document-1",
        "document_version_id": "version-1",
        "event_type": "document_version_upsert",
        "event_status": "processing",
        "payload_json": {"reason": "atomic_rebuild", "index_version": 2},
    }
    service.load_document_version_projection.return_value = chunks
    client = AsyncMock()
    client.replace_document.return_value = 1

    result = await project_document_version(
        service=service,
        client=client,
        event_id="event-1",
        index_prefix="ragpilot-document-chunks",
        index_version=1,
    )

    client.ensure_index.assert_awaited_once()
    client.resolve_write_alias.assert_not_awaited()
    client.replace_document.assert_awaited_once_with(
        index_name="ragpilot-document-chunks-v2",
        tenant_id="tenant-1",
        document_id="document-1",
        document_version_id="version-1",
        chunks=chunks,
    )
    assert result["index_name"] == "ragpilot-document-chunks-v2"
    service.release_projection_runtime_lock.assert_awaited_once()
