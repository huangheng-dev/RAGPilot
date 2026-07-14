from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from ragpilot_worker.infrastructure.search.elasticsearch_client import ElasticsearchProjectionClient
from ragpilot_worker.infrastructure.search.index_contract import (
    build_chunk_index_contract,
    build_chunk_index_name,
    build_chunk_write_alias,
)


class SearchProjectionEventNotFoundError(LookupError):
    """Raised when a requested projection event does not exist."""


class SearchProjectionSourceStateError(ValueError):
    """Raised when authoritative source rows cannot safely produce a projection."""


class SearchProjectionService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def acquire_projection_runtime_lock(self) -> None:
        await self.session.execute(text("SELECT pg_advisory_lock_shared(hashtext('ragpilot_search_projection'))"))

    async def release_projection_runtime_lock(self) -> None:
        await self.session.execute(text("SELECT pg_advisory_unlock_shared(hashtext('ragpilot_search_projection'))"))

    async def claim_event(self, *, event_id: str) -> dict[str, Any]:
        result = await self.session.execute(
            text(
                """
                SELECT
                    id,
                    tenant_id,
                    document_id,
                    document_version_id,
                    event_type,
                    event_status,
                    attempt_count,
                    payload_json
                FROM search_projection_outbox_events
                WHERE id = :event_id
                FOR UPDATE
                """
            ),
            {"event_id": event_id},
        )
        event = result.mappings().one_or_none()
        if event is None:
            raise SearchProjectionEventNotFoundError(f"Search projection event {event_id} was not found.")
        event_payload = dict(event)
        if event_payload["event_status"] == "completed":
            return event_payload
        if event_payload["event_type"] not in {"document_version_upsert", "document_delete"}:
            raise SearchProjectionSourceStateError(
                f"Search projection event {event_id} has unsupported type {event_payload['event_type']}."
            )
        now = datetime.now(timezone.utc)
        await self.session.execute(
            text(
                """
                UPDATE search_projection_outbox_events
                SET event_status = 'processing',
                    attempt_count = attempt_count + 1,
                    last_error = NULL,
                    updated_at = :updated_at
                WHERE id = :event_id
                """
            ),
            {"event_id": event_id, "updated_at": now},
        )
        event_payload["event_status"] = "processing"
        event_payload["attempt_count"] = int(event_payload["attempt_count"]) + 1
        return event_payload

    async def load_document_version_projection(self, *, event: dict[str, Any]) -> list[dict[str, Any]]:
        result = await self.session.execute(
            text(
                """
                SELECT
                    documents.tenant_id::text AS tenant_id,
                    knowledge_bases.workspace_id::text AS workspace_id,
                    documents.knowledge_base_id::text AS knowledge_base_id,
                    documents.id::text AS document_id,
                    document_versions.id::text AS document_version_id,
                    document_versions.version_number AS document_version_number,
                    document_chunks.id::text AS document_chunk_id,
                    document_chunks.chunk_index,
                    documents.title AS document_title,
                    document_chunks.content,
                    document_versions.content_hash,
                    document_chunks.token_count,
                    documents.source_uri,
                    document_versions.parser_name,
                    document_chunks.metadata_json AS metadata,
                    documents.created_at AS document_created_at,
                    documents.updated_at AS document_updated_at,
                    document_versions.created_at AS version_created_at,
                    document_chunks.created_at AS chunk_created_at
                FROM document_versions
                JOIN documents
                    ON documents.id = document_versions.document_id
                   AND documents.tenant_id = document_versions.tenant_id
                JOIN knowledge_bases
                    ON knowledge_bases.id = documents.knowledge_base_id
                   AND knowledge_bases.tenant_id = documents.tenant_id
                JOIN document_chunks
                    ON document_chunks.document_version_id = document_versions.id
                   AND document_chunks.tenant_id = document_versions.tenant_id
                WHERE document_versions.id = :document_version_id
                  AND document_versions.document_id = :document_id
                  AND document_versions.tenant_id = :tenant_id
                  AND document_versions.ingestion_status = 'completed'
                  AND documents.deleted_at IS NULL
                  AND knowledge_bases.deleted_at IS NULL
                ORDER BY document_chunks.chunk_index ASC
                """
            ),
            {
                "tenant_id": event["tenant_id"],
                "document_id": event["document_id"],
                "document_version_id": event["document_version_id"],
            },
        )
        projected_at = datetime.now(timezone.utc)
        chunks = [{**dict(row), "projected_at": projected_at} for row in result.mappings().all()]
        if not chunks:
            raise SearchProjectionSourceStateError(
                f"Search projection event {event['id']} has no eligible authoritative chunks."
            )
        expected_tenant_id = str(event["tenant_id"])
        expected_document_id = str(event["document_id"])
        expected_version_id = str(event["document_version_id"])
        if any(
            chunk["tenant_id"] != expected_tenant_id
            or chunk["document_id"] != expected_document_id
            or chunk["document_version_id"] != expected_version_id
            for chunk in chunks
        ):
            raise SearchProjectionSourceStateError("Authoritative projection rows crossed the event scope boundary.")
        return chunks

    async def mark_completed(self, *, event_id: str, projected_chunk_count: int) -> None:
        now = datetime.now(timezone.utc)
        await self.session.execute(
            text(
                """
                UPDATE search_projection_outbox_events
                SET event_status = 'completed',
                    processed_at = :processed_at,
                    last_error = NULL,
                    payload_json = payload_json || jsonb_build_object(
                        'projected_chunk_count', CAST(:projected_chunk_count AS integer)
                    ),
                    updated_at = :updated_at
                WHERE id = :event_id
                """
            ),
            {
                "event_id": event_id,
                "projected_chunk_count": projected_chunk_count,
                "processed_at": now,
                "updated_at": now,
            },
        )

    async def mark_failed(self, *, event_id: str, error_message: str) -> None:
        await self.session.execute(
            text(
                """
                UPDATE search_projection_outbox_events
                SET event_status = 'failed',
                    last_error = :last_error,
                    updated_at = :updated_at
                WHERE id = :event_id
                  AND event_status != 'completed'
                """
            ),
            {
                "event_id": event_id,
                "last_error": error_message[:4000],
                "updated_at": datetime.now(timezone.utc),
            },
        )
        await self.session.commit()


async def project_document_version(
    *,
    service: SearchProjectionService,
    client: ElasticsearchProjectionClient,
    event_id: str,
    index_prefix: str,
    index_version: int,
) -> dict[str, Any]:
    await service.acquire_projection_runtime_lock()
    try:
        result = await _project_document_version(
            service=service,
            client=client,
            event_id=event_id,
            index_prefix=index_prefix,
            index_version=index_version,
        )
        await service.release_projection_runtime_lock()
        await service.session.commit()
        return result
    except Exception:
        await service.release_projection_runtime_lock()
        await service.session.rollback()
        raise


async def _project_document_version(
    *,
    service: SearchProjectionService,
    client: ElasticsearchProjectionClient,
    event_id: str,
    index_prefix: str,
    index_version: int,
) -> dict[str, Any]:
    event = await service.claim_event(event_id=event_id)
    if event["event_status"] == "completed":
        return {"event_id": event_id, "status": "completed", "idempotent_replay": True}

    event_payload = event.get("payload_json") or {}
    target_index_version = event_payload.get("index_version")
    if target_index_version is not None:
        resolved_index_version = int(target_index_version)
        index_name = build_chunk_index_name(prefix=index_prefix, version=resolved_index_version)
        contract = build_chunk_index_contract(
            prefix=index_prefix,
            version=resolved_index_version,
            include_aliases=False,
        )
        await client.ensure_index(index_name=index_name, contract=contract)
    else:
        bootstrap_index_name = build_chunk_index_name(prefix=index_prefix, version=index_version)
        contract = build_chunk_index_contract(prefix=index_prefix, version=index_version)
        index_name = await client.resolve_write_alias(
            bootstrap_index_name=bootstrap_index_name,
            contract=contract,
            write_alias=build_chunk_write_alias(prefix=index_prefix),
        )
    if event["event_type"] == "document_delete":
        deleted_chunk_count = await client.delete_document(
            index_name=index_name,
            tenant_id=str(event["tenant_id"]),
            document_id=str(event["document_id"]),
        )
        await service.mark_completed(event_id=event_id, projected_chunk_count=0)
        return {
            "event_id": event_id,
            "status": "completed",
            "index_name": index_name,
            "deleted_chunk_count": deleted_chunk_count,
            "idempotent_replay": False,
        }

    chunks = await service.load_document_version_projection(event=event)
    projected_chunk_count = await client.replace_document(
        index_name=index_name,
        tenant_id=str(event["tenant_id"]),
        document_id=str(event["document_id"]),
        document_version_id=str(event["document_version_id"]),
        chunks=chunks,
    )
    await service.mark_completed(event_id=event_id, projected_chunk_count=projected_chunk_count)
    return {
        "event_id": event_id,
        "status": "completed",
        "index_name": index_name,
        "projected_chunk_count": projected_chunk_count,
        "idempotent_replay": False,
    }
