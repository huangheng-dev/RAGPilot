from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

DOCUMENT_VERSION_REWRITE_CONFLICT_MESSAGE = (
    "Document reindex is blocked because chunks from this processing version are already referenced by grounded chat citations."
)


class DocumentVersionRewriteConflictError(ValueError):
    """Raised when a document version cannot be safely rewritten in place."""


class DocumentIngestionService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def mark_ingestion_running(self, *, workflow_run_id: str, document_id: str) -> str:
        step_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc)

        await self.session.execute(
            text(
                """
                UPDATE workflow_runs
                SET workflow_status = 'running',
                    started_at = COALESCE(started_at, :started_at),
                    updated_at = :updated_at,
                    error_message = NULL
                WHERE id = :workflow_run_id
                """
            ),
            {
                "workflow_run_id": workflow_run_id,
                "started_at": now,
                "updated_at": now,
            },
        )
        await self.session.execute(
            text(
                """
                INSERT INTO workflow_steps (
                    id,
                    tenant_id,
                    workflow_run_id,
                    step_name,
                    step_status,
                    attempt_count,
                    started_at,
                    created_at,
                    updated_at
                )
                SELECT
                    :step_id,
                    workflow_runs.tenant_id,
                    workflow_runs.id,
                    'ingest_document',
                    'running',
                    1,
                    :started_at,
                    :created_at,
                    :updated_at
                FROM workflow_runs
                WHERE workflow_runs.id = :workflow_run_id
                """
            ),
            {
                "step_id": step_id,
                "workflow_run_id": workflow_run_id,
                "started_at": now,
                "created_at": now,
                "updated_at": now,
            },
        )
        await self.session.execute(
            text(
                """
                UPDATE documents
                SET ingestion_status = 'running',
                    indexing_status = 'running',
                    updated_at = :updated_at
                WHERE id = :document_id
                """
            ),
            {
                "document_id": document_id,
                "updated_at": now,
            },
        )
        await self.session.commit()
        return step_id

    async def load_document_ingestion_context(self, *, workflow_run_id: str, document_id: str) -> dict[str, Any]:
        result = await self.session.execute(
            text(
                """
                SELECT
                    workflow_runs.input_json,
                    document_versions.id AS document_version_id,
                    document_versions.parser_name,
                    document_assets.storage_bucket,
                    document_assets.storage_key,
                    document_assets.file_name,
                    document_assets.content_type
                FROM workflow_runs
                JOIN document_versions
                    ON document_versions.id = CAST(workflow_runs.input_json->>'document_version_id' AS uuid)
                JOIN document_assets
                    ON document_assets.id = CAST(workflow_runs.input_json->>'document_asset_id' AS uuid)
                WHERE workflow_runs.id = :workflow_run_id
                  AND CAST(workflow_runs.input_json->>'document_id' AS uuid) = :document_id
                """
            ),
            {
                "workflow_run_id": workflow_run_id,
                "document_id": document_id,
            },
        )
        row = result.mappings().one_or_none()
        if row is None:
            raise LookupError("Document ingestion context could not be found for the workflow run.")
        return dict(row)

    async def replace_document_chunks(
        self,
        *,
        tenant_id: str,
        document_version_id: str,
        chunks: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        await self._ensure_document_version_is_rewritable(document_version_id=document_version_id)
        try:
            await self.session.execute(
                text(
                    """
                    DELETE FROM document_chunk_embeddings
                    WHERE document_chunk_id IN (
                        SELECT id
                        FROM document_chunks
                        WHERE document_version_id = :document_version_id
                    )
                    """
                ),
                {"document_version_id": document_version_id},
            )
            await self.session.execute(
                text("DELETE FROM document_chunks WHERE document_version_id = :document_version_id"),
                {"document_version_id": document_version_id},
            )
        except IntegrityError as error:
            await self.session.rollback()
            if _is_message_citation_chunk_reference_error(error):
                raise DocumentVersionRewriteConflictError(DOCUMENT_VERSION_REWRITE_CONFLICT_MESSAGE) from error
            raise
        inserted_chunks: list[dict[str, Any]] = []
        for chunk in chunks:
            result = await self.session.execute(
                text(
                    """
                    INSERT INTO document_chunks (
                        id,
                        tenant_id,
                        document_version_id,
                        chunk_index,
                        content,
                        token_count,
                        metadata_json,
                        created_at
                    ) VALUES (
                        gen_random_uuid(),
                        :tenant_id,
                        :document_version_id,
                        :chunk_index,
                        :content,
                        :token_count,
                        CAST(:metadata_json AS jsonb),
                        now()
                    )
                    RETURNING id, chunk_index, content
                    """
                ),
                {
                    "tenant_id": tenant_id,
                    "document_version_id": document_version_id,
                    "chunk_index": chunk["chunk_index"],
                    "content": chunk["content"],
                    "token_count": chunk["token_count"],
                    "metadata_json": json.dumps(chunk["metadata_json"]),
                },
            )
            inserted_chunks.append(dict(result.mappings().one()))
        await self.session.commit()
        return inserted_chunks

    async def _ensure_document_version_is_rewritable(self, *, document_version_id: str) -> None:
        existing_chunks_result = await self.session.execute(
            text(
                """
                SELECT COUNT(*) AS chunk_count
                FROM document_chunks
                WHERE document_version_id = :document_version_id
                """
            ),
            {"document_version_id": document_version_id},
        )
        existing_chunk_count = int(existing_chunks_result.mappings().one()["chunk_count"])
        if existing_chunk_count == 0:
            return

        # Lock the existing chunk rows before checking citations so a concurrent
        # message-citation insert cannot slip in between the safety check and delete.
        await self.session.execute(
            text(
                """
                SELECT id
                FROM document_chunks
                WHERE document_version_id = :document_version_id
                FOR UPDATE
                """
            ),
            {"document_version_id": document_version_id},
        )

        citation_result = await self.session.execute(
            text(
                """
                SELECT COUNT(*) AS citation_count
                FROM message_citations
                WHERE document_chunk_id IN (
                    SELECT id
                    FROM document_chunks
                    WHERE document_version_id = :document_version_id
                )
                """
            ),
            {"document_version_id": document_version_id},
        )
        citation_count = int(citation_result.mappings().one()["citation_count"])
        if citation_count > 0:
            raise DocumentVersionRewriteConflictError(DOCUMENT_VERSION_REWRITE_CONFLICT_MESSAGE)

    async def replace_document_chunk_embeddings(
        self,
        *,
        tenant_id: str,
        embedding_model: str,
        embedding_dimension: int,
        chunk_embeddings: list[dict[str, Any]],
    ) -> None:
        for chunk_embedding in chunk_embeddings:
            await self.session.execute(
                text(
                    """
                    INSERT INTO document_chunk_embeddings (
                        id,
                        tenant_id,
                        document_chunk_id,
                        embedding_model,
                        embedding_dimension,
                        embedding,
                        created_at
                    ) VALUES (
                        gen_random_uuid(),
                        :tenant_id,
                        :document_chunk_id,
                        :embedding_model,
                        :embedding_dimension,
                        CAST(:embedding AS vector),
                        now()
                    )
                    """
                ),
                {
                    "tenant_id": tenant_id,
                    "document_chunk_id": chunk_embedding["document_chunk_id"],
                    "embedding_model": embedding_model,
                    "embedding_dimension": embedding_dimension,
                    "embedding": _format_vector(chunk_embedding["embedding"]),
                },
            )
        await self.session.commit()

    async def mark_ingestion_completed(
        self,
        *,
        workflow_run_id: str,
        document_id: str,
        workflow_step_id: str,
        document_version_id: str,
        parser_name: str,
        chunk_count: int,
        embedding_model: str,
        embedding_count: int,
    ) -> str:
        now = datetime.now(timezone.utc)
        await self.session.execute(
            text(
                """
                UPDATE workflow_steps
                SET step_status = 'completed',
                    completed_at = :completed_at,
                    updated_at = :updated_at
                WHERE id = :workflow_step_id
                """
            ),
            {
                "workflow_step_id": workflow_step_id,
                "completed_at": now,
                "updated_at": now,
            },
        )
        await self.session.execute(
            text(
                """
                UPDATE workflow_runs
                SET workflow_status = 'completed',
                    completed_at = :completed_at,
                    updated_at = :updated_at
                WHERE id = :workflow_run_id
                """
            ),
            {
                "workflow_run_id": workflow_run_id,
                "completed_at": now,
                "updated_at": now,
            },
        )
        await self.session.execute(
            text(
                """
                UPDATE documents
                SET ingestion_status = 'completed',
                    indexing_status = 'completed',
                    updated_at = :updated_at
                WHERE id = :document_id
                """
            ),
            {
                "document_id": document_id,
                "updated_at": now,
            },
        )
        await self.session.execute(
            text(
                """
                UPDATE document_versions
                SET ingestion_status = 'completed',
                    parser_name = :parser_name,
                    updated_at = :updated_at
                WHERE id = :document_version_id
                """
            ),
            {
                "document_version_id": document_version_id,
                "parser_name": parser_name,
                "updated_at": now,
            },
        )
        await self.session.execute(
            text(
                """
                UPDATE workflow_runs
                SET input_json = input_json || jsonb_build_object(
                    'chunk_count', CAST(:chunk_count AS integer),
                    'embedding_count', CAST(:embedding_count AS integer),
                    'embedding_model', CAST(:embedding_model AS text)
                )
                WHERE id = :workflow_run_id
                """
            ),
            {
                "workflow_run_id": workflow_run_id,
                "chunk_count": chunk_count,
                "embedding_count": embedding_count,
                "embedding_model": embedding_model,
            },
        )
        projection_event_result = await self.session.execute(
            text(
                """
                INSERT INTO search_projection_outbox_events (
                    id,
                    tenant_id,
                    aggregate_type,
                    aggregate_id,
                    document_id,
                    document_version_id,
                    event_type,
                    event_key,
                    payload_json,
                    event_status,
                    attempt_count,
                    available_at,
                    created_at,
                    updated_at
                )
                SELECT
                    gen_random_uuid(),
                    document_versions.tenant_id,
                    'document_version',
                    document_versions.id,
                    document_versions.document_id,
                    document_versions.id,
                    'document_version_upsert',
                    'document-version:' || document_versions.id::text || ':upsert:' || document_versions.content_hash,
                    jsonb_build_object(
                        'workflow_run_id', CAST(:workflow_run_id AS text),
                        'document_id', document_versions.document_id::text,
                        'document_version_id', document_versions.id::text,
                        'content_hash', document_versions.content_hash
                    ),
                    'pending',
                    0,
                    :available_at,
                    :created_at,
                    :updated_at
                FROM document_versions
                WHERE document_versions.id = :document_version_id
                  AND document_versions.document_id = :document_id
                  AND document_versions.ingestion_status = 'completed'
                ON CONFLICT (event_key) DO UPDATE
                SET payload_json = EXCLUDED.payload_json,
                    updated_at = EXCLUDED.updated_at
                RETURNING id
                """
            ),
            {
                "workflow_run_id": workflow_run_id,
                "document_id": document_id,
                "document_version_id": document_version_id,
                "available_at": now,
                "created_at": now,
                "updated_at": now,
            },
        )
        projection_event_id = projection_event_result.scalar_one()
        await self.session.commit()
        return str(projection_event_id)

    async def mark_ingestion_failed(
        self,
        *,
        workflow_run_id: str,
        document_id: str,
        workflow_step_id: str | None,
        error_message: str,
    ) -> None:
        now = datetime.now(timezone.utc)
        if workflow_step_id is not None:
            await self.session.execute(
                text(
                    """
                    UPDATE workflow_steps
                    SET step_status = 'failed',
                        error_message = :error_message,
                        completed_at = :completed_at,
                        updated_at = :updated_at
                    WHERE id = :workflow_step_id
                    """
                ),
                {
                    "workflow_step_id": workflow_step_id,
                    "error_message": error_message,
                    "completed_at": now,
                    "updated_at": now,
                },
            )
        await self.session.execute(
            text(
                """
                UPDATE workflow_runs
                SET workflow_status = 'failed',
                    error_message = :error_message,
                    completed_at = :completed_at,
                    updated_at = :updated_at
                WHERE id = :workflow_run_id
                """
            ),
            {
                "workflow_run_id": workflow_run_id,
                "error_message": error_message,
                "completed_at": now,
                "updated_at": now,
            },
        )
        await self.session.execute(
            text(
                """
                UPDATE documents
                SET ingestion_status = 'failed',
                    indexing_status = 'failed',
                    updated_at = :updated_at
                WHERE id = :document_id
                """
            ),
            {
                "document_id": document_id,
                "updated_at": now,
            },
        )
        await self.session.execute(
            text(
                """
                UPDATE document_versions
                SET ingestion_status = 'failed',
                    updated_at = :updated_at
                WHERE id = (
                    SELECT CAST(input_json->>'document_version_id' AS uuid)
                    FROM workflow_runs
                    WHERE id = :workflow_run_id
                )
                """
            ),
            {
                "workflow_run_id": workflow_run_id,
                "updated_at": now,
            },
        )
        await self.session.commit()


def _format_vector(values: list[float]) -> str:
    return "[" + ",".join(f"{value:.12f}" for value in values) + "]"


def _is_message_citation_chunk_reference_error(error: IntegrityError) -> bool:
    error_text = str(error.orig or error)
    normalized_error_text = error_text.lower()
    return (
        "message_citations" in normalized_error_text
        and "document_chunks" in normalized_error_text
        and ("foreignkeyviolation" in normalized_error_text or "foreign key constraint" in normalized_error_text)
    )
