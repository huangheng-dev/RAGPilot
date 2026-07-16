from __future__ import annotations

import hashlib
import json
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


class DataSourceSyncStateError(ValueError):
    """Raised when a sync run no longer owns its durable source lease."""


class DataSourceSyncService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def load_context(self, *, data_source_id: str, sync_run_id: str, lease_token: str) -> dict[str, Any]:
        result = await self.session.execute(
            text(
                """
                SELECT
                    data_sources.id::text AS data_source_id,
                    data_sources.tenant_id::text AS tenant_id,
                    data_sources.knowledge_base_id::text AS knowledge_base_id,
                    data_sources.source_type,
                    data_sources.source_uri,
                    data_sources.sync_cursor,
                    data_sources.metadata_json,
                    data_source_sync_runs.id::text AS sync_run_id
                FROM data_sources
                JOIN data_source_sync_runs
                  ON data_source_sync_runs.data_source_id = data_sources.id
                WHERE data_sources.id = CAST(:data_source_id AS uuid)
                  AND data_source_sync_runs.id = CAST(:sync_run_id AS uuid)
                  AND data_sources.sync_lease_token = CAST(:lease_token AS uuid)
                  AND data_source_sync_runs.run_status = 'running'
                  AND data_sources.deleted_at IS NULL
                FOR UPDATE OF data_sources, data_source_sync_runs
                """
            ),
            {"data_source_id": data_source_id, "sync_run_id": sync_run_id, "lease_token": lease_token},
        )
        row = result.mappings().one_or_none()
        if row is None:
            raise DataSourceSyncStateError("The data-source sync lease is missing, expired, or no longer active.")
        now = datetime.now(timezone.utc)
        await self.session.execute(
            text("UPDATE data_source_sync_runs SET heartbeat_at = :now WHERE id = CAST(:sync_run_id AS uuid)"),
            {"now": now, "sync_run_id": sync_run_id},
        )
        await self.session.commit()
        return dict(row)

    async def find_item(self, *, data_source_id: str, external_id: str) -> dict[str, Any] | None:
        result = await self.session.execute(
            text(
                """
                SELECT id::text, document_id::text, version_token, content_hash, item_status,
                       last_seen_sync_run_id::text, last_changed_sync_run_id::text
                FROM data_source_items
                WHERE data_source_id = CAST(:data_source_id AS uuid)
                  AND external_id = :external_id
                """
            ),
            {"data_source_id": data_source_id, "external_id": external_id},
        )
        row = result.mappings().one_or_none()
        return dict(row) if row is not None else None

    async def mark_unchanged(
        self, *, item_id: str, sync_run_id: str, version_token: str, content_hash: str, source_uri: str,
        title: str, metadata: dict[str, object],
    ) -> None:
        await self.session.execute(
            text(
                """
                UPDATE data_source_items
                SET version_token = :version_token,
                    content_hash = :content_hash,
                    source_uri = :source_uri,
                    title = :title,
                    item_status = 'active',
                    last_seen_sync_run_id = CAST(:sync_run_id AS uuid),
                    last_synced_at = :now,
                    metadata_json = CAST(:metadata_json AS jsonb),
                    updated_at = :now
                WHERE id = CAST(:item_id AS uuid)
                """
            ),
            {
                "item_id": item_id, "sync_run_id": sync_run_id, "version_token": version_token,
                "content_hash": content_hash, "source_uri": source_uri, "title": title,
                "metadata_json": json.dumps(metadata), "now": datetime.now(timezone.utc),
            },
        )
        await self.session.commit()

    async def recover_ingestion_payload(
        self, *, data_source_id: str, sync_run_id: str, external_id: str,
    ) -> dict[str, str] | None:
        result = await self.session.execute(
            text(
                """
                SELECT workflow_runs.id::text AS workflow_run_id,
                       workflow_runs.subject_id::text AS document_id,
                       workflow_runs.input_json
                FROM data_source_items
                JOIN workflow_runs ON workflow_runs.subject_id = data_source_items.document_id
                WHERE data_source_items.data_source_id = CAST(:data_source_id AS uuid)
                  AND data_source_items.external_id = :external_id
                  AND data_source_items.last_changed_sync_run_id = CAST(:sync_run_id AS uuid)
                  AND workflow_runs.input_json->>'data_source_sync_run_id' = :sync_run_id
                ORDER BY workflow_runs.created_at DESC
                LIMIT 1
                """
            ),
            {"data_source_id": data_source_id, "external_id": external_id, "sync_run_id": sync_run_id},
        )
        row = result.mappings().one_or_none()
        if row is None:
            return None
        return {
            "workflow_run_id": row["workflow_run_id"],
            "document_id": row["document_id"],
            "tenant_id": str(row["input_json"]["tenant_id"]),
        }

    async def materialize_changed_item(
        self, *, context: dict[str, Any], external_id: str, version_token: str, title: str,
        source_uri: str, content_hash: str, storage_bucket: str, storage_key: str,
        file_name: str, content_type: str, file_size_bytes: int, metadata: dict[str, object],
    ) -> dict[str, str]:
        now = datetime.now(timezone.utc)
        document_id = str(uuid.uuid4())
        document_version_id = str(uuid.uuid4())
        document_asset_id = str(uuid.uuid4())
        workflow_run_id = str(uuid.uuid4())
        data_source_item_id = str(uuid.uuid4())
        temporal_workflow_id = f"document-ingestion-{workflow_run_id}"

        existing = await self.session.execute(
            text(
                """
                SELECT id::text, document_id::text
                FROM data_source_items
                WHERE data_source_id = CAST(:data_source_id AS uuid)
                  AND external_id = :external_id
                FOR UPDATE
                """
            ),
            {"data_source_id": context["data_source_id"], "external_id": external_id},
        )
        existing_row = existing.mappings().one_or_none()
        if existing_row is not None:
            data_source_item_id = existing_row["id"]
            if existing_row["document_id"]:
                document_id = existing_row["document_id"]
                await self.session.execute(
                    text(
                        """
                        UPDATE documents
                        SET title = :title, source_uri = :source_uri, data_source_id = CAST(:data_source_id AS uuid),
                            ingestion_status = 'pending', indexing_status = 'pending', deleted_at = NULL, updated_at = :now
                        WHERE id = CAST(:document_id AS uuid)
                        """
                    ),
                    {
                        "title": title, "source_uri": source_uri, "data_source_id": context["data_source_id"],
                        "document_id": document_id, "now": now,
                    },
                )
        if existing_row is None or not existing_row["document_id"]:
            await self.session.execute(
                text(
                    """
                    INSERT INTO documents (
                        id, tenant_id, knowledge_base_id, data_source_id, title, source_uri,
                        ingestion_status, indexing_status, created_at, updated_at
                    ) VALUES (
                        CAST(:id AS uuid), CAST(:tenant_id AS uuid), CAST(:knowledge_base_id AS uuid),
                        CAST(:data_source_id AS uuid), :title, :source_uri, 'pending', 'pending', :now, :now
                    )
                    """
                ),
                {
                    "id": document_id, "tenant_id": context["tenant_id"],
                    "knowledge_base_id": context["knowledge_base_id"], "data_source_id": context["data_source_id"],
                    "title": title, "source_uri": source_uri, "now": now,
                },
            )

        version_number = int((await self.session.scalar(
            text("SELECT COALESCE(MAX(version_number), 0) + 1 FROM document_versions WHERE document_id = CAST(:id AS uuid)"),
            {"id": document_id},
        )) or 1)
        await self.session.execute(
            text(
                """
                INSERT INTO document_versions (
                    id, tenant_id, document_id, version_number, content_hash, ingestion_status, created_at, updated_at
                ) VALUES (
                    CAST(:id AS uuid), CAST(:tenant_id AS uuid), CAST(:document_id AS uuid),
                    :version_number, :content_hash, 'pending', :now, :now
                )
                """
            ),
            {
                "id": document_version_id, "tenant_id": context["tenant_id"], "document_id": document_id,
                "version_number": version_number, "content_hash": content_hash, "now": now,
            },
        )
        await self.session.execute(
            text(
                """
                INSERT INTO document_assets (
                    id, tenant_id, document_version_id, storage_bucket, storage_key,
                    file_name, content_type, file_size_bytes, created_at
                ) VALUES (
                    CAST(:id AS uuid), CAST(:tenant_id AS uuid), CAST(:document_version_id AS uuid),
                    :storage_bucket, :storage_key, :file_name, :content_type, :file_size_bytes, :now
                )
                """
            ),
            {
                "id": document_asset_id, "tenant_id": context["tenant_id"],
                "document_version_id": document_version_id, "storage_bucket": storage_bucket,
                "storage_key": storage_key, "file_name": file_name, "content_type": content_type,
                "file_size_bytes": file_size_bytes, "now": now,
            },
        )
        input_json = {
            "tenant_id": context["tenant_id"], "document_id": document_id,
            "document_version_id": document_version_id, "document_asset_id": document_asset_id,
            "storage_bucket": storage_bucket, "storage_key": storage_key,
            "data_source_id": context["data_source_id"], "data_source_sync_run_id": context["sync_run_id"],
            "external_id": external_id,
        }
        await self.session.execute(
            text(
                """
                INSERT INTO workflow_runs (
                    id, tenant_id, workflow_type, workflow_status, temporal_workflow_id,
                    subject_type, subject_id, input_json, created_at, updated_at
                ) VALUES (
                    CAST(:id AS uuid), CAST(:tenant_id AS uuid), 'document_ingestion', 'pending',
                    :temporal_workflow_id, 'document', CAST(:document_id AS uuid), CAST(:input_json AS jsonb), :now, :now
                )
                """
            ),
            {
                "id": workflow_run_id, "tenant_id": context["tenant_id"],
                "temporal_workflow_id": temporal_workflow_id, "document_id": document_id,
                "input_json": json.dumps(input_json), "now": now,
            },
        )
        await self.session.execute(
            text(
                """
                INSERT INTO data_source_items (
                    id, tenant_id, data_source_id, external_id, document_id, version_token, content_hash,
                    source_uri, title, item_status, last_seen_sync_run_id, last_changed_sync_run_id,
                    last_synced_at, metadata_json, created_at, updated_at
                ) VALUES (
                    CAST(:id AS uuid), CAST(:tenant_id AS uuid), CAST(:data_source_id AS uuid), :external_id,
                    CAST(:document_id AS uuid), :version_token, :content_hash, :source_uri, :title, 'active',
                    CAST(:sync_run_id AS uuid), CAST(:sync_run_id AS uuid), :now, CAST(:metadata_json AS jsonb), :now, :now
                )
                ON CONFLICT (data_source_id, external_id) DO UPDATE SET
                    document_id = EXCLUDED.document_id, version_token = EXCLUDED.version_token,
                    content_hash = EXCLUDED.content_hash, source_uri = EXCLUDED.source_uri,
                    title = EXCLUDED.title, item_status = 'active',
                    last_seen_sync_run_id = EXCLUDED.last_seen_sync_run_id,
                    last_changed_sync_run_id = EXCLUDED.last_changed_sync_run_id,
                    last_synced_at = EXCLUDED.last_synced_at, metadata_json = EXCLUDED.metadata_json,
                    updated_at = EXCLUDED.updated_at
                """
            ),
            {
                "id": data_source_item_id, "tenant_id": context["tenant_id"],
                "data_source_id": context["data_source_id"], "external_id": external_id,
                "document_id": document_id, "version_token": version_token, "content_hash": content_hash,
                "source_uri": source_uri, "title": title, "sync_run_id": context["sync_run_id"],
                "metadata_json": json.dumps(metadata), "now": now,
            },
        )
        await self.session.commit()
        return {"workflow_run_id": workflow_run_id, "document_id": document_id, "tenant_id": context["tenant_id"]}

    async def mark_snapshot_deletions(self, *, context: dict[str, Any]) -> list[str]:
        now = datetime.now(timezone.utc)
        existing_events = await self.session.execute(
            text(
                """
                SELECT id::text
                FROM search_projection_outbox_events
                WHERE event_type = 'document_delete'
                  AND payload_json->>'data_source_sync_run_id' = :sync_run_id
                ORDER BY created_at
                """
            ),
            {"sync_run_id": context["sync_run_id"]},
        )
        event_ids = [row[0] for row in existing_events.all()]
        result = await self.session.execute(
            text(
                """
                SELECT document_id::text
                FROM data_source_items
                WHERE data_source_id = CAST(:data_source_id AS uuid)
                  AND item_status = 'active'
                  AND document_id IS NOT NULL
                  AND last_seen_sync_run_id IS DISTINCT FROM CAST(:sync_run_id AS uuid)
                FOR UPDATE
                """
            ),
            {"data_source_id": context["data_source_id"], "sync_run_id": context["sync_run_id"]},
        )
        document_ids = [row[0] for row in result.all()]
        for document_id in document_ids:
            event_id = str(uuid.uuid4())
            event_key = f"source-sync:{context['sync_run_id']}:document-delete:{document_id}"
            await self.session.execute(
                text("UPDATE documents SET deleted_at = :now, updated_at = :now WHERE id = CAST(:id AS uuid)"),
                {"id": document_id, "now": now},
            )
            inserted = await self.session.execute(
                text(
                    """
                    INSERT INTO search_projection_outbox_events (
                        id, tenant_id, aggregate_type, aggregate_id, document_id, document_version_id,
                        event_type, event_key, payload_json, event_status, available_at, created_at, updated_at
                    ) VALUES (
                        CAST(:id AS uuid), CAST(:tenant_id AS uuid), 'document', CAST(:document_id AS uuid),
                        CAST(:document_id AS uuid), NULL, 'document_delete', :event_key,
                        jsonb_build_object('data_source_sync_run_id', :sync_run_id), 'pending', :now, :now, :now
                    )
                    ON CONFLICT (event_key) DO UPDATE SET event_key = EXCLUDED.event_key
                    RETURNING id::text
                    """
                ),
                {
                    "id": event_id, "tenant_id": context["tenant_id"], "document_id": document_id,
                    "event_key": event_key, "sync_run_id": context["sync_run_id"], "now": now,
                },
            )
            event_ids.append(inserted.scalar_one())
        await self.session.execute(
            text(
                """
                UPDATE data_source_items
                SET item_status = 'deleted', updated_at = :now
                WHERE data_source_id = CAST(:data_source_id AS uuid)
                  AND item_status = 'active'
                  AND last_seen_sync_run_id IS DISTINCT FROM CAST(:sync_run_id AS uuid)
                """
            ),
            {"data_source_id": context["data_source_id"], "sync_run_id": context["sync_run_id"], "now": now},
        )
        await self.session.commit()
        return event_ids

    async def finalize(
        self, *, data_source_id: str, sync_run_id: str, lease_token: str, cursor: str,
        discovered: int, changed: int, unchanged: int, deleted: int,
    ) -> None:
        now = datetime.now(timezone.utc)
        source_update = await self.session.execute(
            text(
                """
                UPDATE data_sources
                SET sync_status = 'completed', sync_cursor = :cursor, last_synced_at = :now,
                    last_sync_error = NULL, sync_lease_token = NULL, sync_lease_expires_at = NULL, updated_at = :now
                WHERE id = CAST(:data_source_id AS uuid)
                  AND sync_lease_token = CAST(:lease_token AS uuid)
                """
            ),
            {"data_source_id": data_source_id, "lease_token": lease_token, "cursor": cursor, "now": now},
        )
        if source_update.rowcount != 1:
            raise DataSourceSyncStateError("The data-source sync lease was lost before finalization.")
        await self.session.execute(
            text(
                """
                UPDATE data_source_sync_runs
                SET run_status = 'completed', cursor_after = :cursor,
                    documents_discovered = :discovered, documents_changed = :changed,
                    documents_unchanged = :unchanged, documents_deleted = :deleted,
                    heartbeat_at = :now, completed_at = :now
                WHERE id = CAST(:sync_run_id AS uuid)
                """
            ),
            {
                "sync_run_id": sync_run_id, "cursor": cursor, "discovered": discovered,
                "changed": changed, "unchanged": unchanged, "deleted": deleted, "now": now,
            },
        )
        await self.session.commit()

    async def fail(
        self, *, data_source_id: str, sync_run_id: str, lease_token: str, error_message: str,
    ) -> None:
        now = datetime.now(timezone.utc)
        message = error_message[:2000]
        await self.session.execute(
            text(
                """
                UPDATE data_sources
                SET sync_status = 'failed', last_sync_error = :error_message,
                    sync_lease_token = NULL, sync_lease_expires_at = NULL, updated_at = :now
                WHERE id = CAST(:data_source_id AS uuid)
                  AND sync_lease_token = CAST(:lease_token AS uuid)
                """
            ),
            {"data_source_id": data_source_id, "lease_token": lease_token, "error_message": message, "now": now},
        )
        await self.session.execute(
            text(
                """
                UPDATE data_source_sync_runs
                SET run_status = 'failed', error_message = :error_message, heartbeat_at = :now, completed_at = :now
                WHERE id = CAST(:sync_run_id AS uuid) AND run_status = 'running'
                """
            ),
            {"sync_run_id": sync_run_id, "error_message": message, "now": now},
        )
        await self.session.commit()


def content_sha256(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()
