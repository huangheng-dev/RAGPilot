from __future__ import annotations

import asyncio
from typing import Any

from temporalio import activity
from temporalio.exceptions import ApplicationError

from ragpilot_worker.application.data_source_sync_service import (
    DataSourceSyncService,
    DataSourceSyncStateError,
    content_sha256,
)
from ragpilot_worker.config import get_settings
from ragpilot_worker.domain.connectors import ConnectorSource
from ragpilot_worker.infrastructure.connectors.registry import resolve_connector
from ragpilot_worker.infrastructure.database import async_session_factory
from ragpilot_worker.infrastructure.object_storage import DocumentObjectStorage
from ragpilot_worker.infrastructure.observability import traced_activity


@activity.defn(name="prepare_data_source_sync")
@traced_activity("worker.data_source_sync.prepare")
async def prepare_data_source_sync(payload: dict[str, Any]) -> dict[str, Any]:
    try:
        async with async_session_factory() as session:
            service = DataSourceSyncService(session)
            context = await service.load_context(
                data_source_id=payload["data_source_id"],
                sync_run_id=payload["sync_run_id"],
                lease_token=payload["lease_token"],
            )

        metadata = dict(context.get("metadata_json") or {})
        connector_kind = str(metadata.get("connector_kind") or (
            "public_web_v1" if context["source_type"] == "web" else context["source_type"]
        ))
        connector = resolve_connector(connector_kind)
        page = await connector.discover(ConnectorSource(
            data_source_id=context["data_source_id"],
            tenant_id=context["tenant_id"],
            knowledge_base_id=context["knowledge_base_id"],
            source_uri=context["source_uri"],
            cursor=context["sync_cursor"],
            metadata=metadata,
        ))

        storage = DocumentObjectStorage(get_settings())
        ingestion_payloads: list[dict[str, str]] = []
        unchanged = page.unchanged_count
        for item in page.items:
            item_hash = content_sha256(item.content)
            async with async_session_factory() as session:
                service = DataSourceSyncService(session)
                existing = await service.find_item(
                    data_source_id=context["data_source_id"], external_id=item.external_id,
                )
                if existing and existing.get("last_changed_sync_run_id") == context["sync_run_id"]:
                    recovered = await service.recover_ingestion_payload(
                        data_source_id=context["data_source_id"],
                        sync_run_id=context["sync_run_id"],
                        external_id=item.external_id,
                    )
                    if recovered is not None:
                        ingestion_payloads.append(recovered)
                        continue
                if existing and existing["item_status"] == "active" and (
                    existing["version_token"] == item.version_token or existing["content_hash"] == item_hash
                ):
                    await service.mark_unchanged(
                        item_id=existing["id"], sync_run_id=context["sync_run_id"],
                        version_token=item.version_token, content_hash=item_hash,
                        source_uri=item.source_uri, title=item.title, metadata=item.metadata,
                    )
                    unchanged += 1
                    continue

            storage_key = (
                f"connectors/{context['tenant_id']}/{context['data_source_id']}/"
                f"{item_hash}/{item.file_name}"
            )
            storage_bucket, stored_key = await asyncio.to_thread(
                storage.store_document_object,
                storage_key=storage_key,
                content=item.content,
                content_type=item.content_type,
            )
            async with async_session_factory() as session:
                service = DataSourceSyncService(session)
                ingestion_payloads.append(await service.materialize_changed_item(
                    context=context, external_id=item.external_id, version_token=item.version_token,
                    title=item.title, source_uri=item.source_uri, content_hash=item_hash,
                    storage_bucket=storage_bucket, storage_key=stored_key, file_name=item.file_name,
                    content_type=item.content_type, file_size_bytes=len(item.content), metadata=item.metadata,
                ))

        deletion_event_ids: list[str] = []
        if page.authoritative_snapshot:
            async with async_session_factory() as session:
                deletion_event_ids = await DataSourceSyncService(session).mark_snapshot_deletions(context=context)

        return {
            "cursor": page.next_cursor,
            "documents_discovered": page.discovered_count if page.discovered_count is not None else len(page.items),
            "documents_changed": len(ingestion_payloads),
            "documents_unchanged": unchanged,
            "documents_deleted": len(deletion_event_ids),
            "ingestion_payloads": ingestion_payloads,
            "deletion_projection_event_ids": deletion_event_ids,
        }
    except (DataSourceSyncStateError, ValueError) as error:
        raise ApplicationError(str(error), non_retryable=True) from error


@activity.defn(name="finalize_data_source_sync")
@traced_activity("worker.data_source_sync.finalize")
async def finalize_data_source_sync(payload: dict[str, Any]) -> dict[str, str]:
    async with async_session_factory() as session:
        await DataSourceSyncService(session).finalize(
            data_source_id=payload["data_source_id"], sync_run_id=payload["sync_run_id"],
            lease_token=payload["lease_token"], cursor=payload["cursor"],
            discovered=int(payload["documents_discovered"]), changed=int(payload["documents_changed"]),
            unchanged=int(payload["documents_unchanged"]), deleted=int(payload["documents_deleted"]),
        )
    return {"sync_run_id": payload["sync_run_id"], "status": "completed"}


@activity.defn(name="fail_data_source_sync")
@traced_activity("worker.data_source_sync.fail")
async def fail_data_source_sync(payload: dict[str, Any]) -> dict[str, str]:
    async with async_session_factory() as session:
        await DataSourceSyncService(session).fail(
            data_source_id=payload["data_source_id"], sync_run_id=payload["sync_run_id"],
            lease_token=payload["lease_token"], error_message=payload["error_message"],
        )
    return {"sync_run_id": payload["sync_run_id"], "status": "failed"}
