from __future__ import annotations

import argparse
import asyncio
import uuid
from time import monotonic
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from temporalio.client import Client
from temporalio.exceptions import WorkflowAlreadyStartedError

from ragpilot_worker.config import get_settings
from ragpilot_worker.infrastructure.database import async_session_factory
from ragpilot_worker.infrastructure.search.elasticsearch_client import ElasticsearchProjectionClient
from ragpilot_worker.infrastructure.search.index_contract import (
    build_chunk_index_contract,
    build_chunk_index_name,
    build_chunk_read_alias,
    build_chunk_write_alias,
)


async def enqueue_backfill_events(
    *,
    tenant_id: str | None,
    knowledge_base_id: str | None,
    document_id: str | None,
    run_id: str,
    index_version: int | None = None,
) -> list[str]:
    filters = [
        "documents.deleted_at IS NULL",
        "knowledge_bases.deleted_at IS NULL",
        "document_versions.ingestion_status = 'completed'",
        "EXISTS (SELECT 1 FROM document_chunks WHERE document_chunks.document_version_id = document_versions.id)",
    ]
    parameters: dict[str, Any] = {
        "backfill_marker": ":backfill:",
        "run_id": run_id,
        "index_version": index_version,
        "reason": "atomic_rebuild" if index_version is not None else "scoped_backfill",
    }
    if tenant_id is not None:
        filters.append("documents.tenant_id = CAST(:tenant_id AS uuid)")
        parameters["tenant_id"] = tenant_id
    if knowledge_base_id is not None:
        filters.append("documents.knowledge_base_id = CAST(:knowledge_base_id AS uuid)")
        parameters["knowledge_base_id"] = knowledge_base_id
    if document_id is not None:
        filters.append("documents.id = CAST(:document_id AS uuid)")
        parameters["document_id"] = document_id
    where_clause = " AND ".join(filters)
    statement = text(
        f"""
        WITH latest_versions AS (
            SELECT DISTINCT ON (documents.id)
                documents.tenant_id,
                documents.id AS document_id,
                document_versions.id AS document_version_id,
                document_versions.content_hash
            FROM documents
            JOIN knowledge_bases
                ON knowledge_bases.id = documents.knowledge_base_id
               AND knowledge_bases.tenant_id = documents.tenant_id
            JOIN document_versions
                ON document_versions.document_id = documents.id
               AND document_versions.tenant_id = documents.tenant_id
            WHERE {where_clause}
            ORDER BY documents.id, document_versions.version_number DESC, document_versions.created_at DESC
        )
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
            latest_versions.tenant_id,
            'document_version',
            latest_versions.document_version_id,
            latest_versions.document_id,
            latest_versions.document_version_id,
            'document_version_upsert',
            'document-version:' || latest_versions.document_version_id::text || CAST(:backfill_marker AS text) || CAST(:run_id AS text) || ':' || latest_versions.content_hash,
            jsonb_strip_nulls(jsonb_build_object(
                'reason', CAST(:reason AS text),
                'run_id', CAST(:run_id AS text),
                'index_version', CAST(:index_version AS integer),
                'document_id', latest_versions.document_id::text,
                'document_version_id', latest_versions.document_version_id::text
            )),
            'pending',
            0,
            now(),
            now(),
            now()
        FROM latest_versions
        ON CONFLICT (event_key) DO NOTHING
        RETURNING id::text
        """
    )
    async with async_session_factory() as session:
        result = await session.execute(statement, parameters)
        event_ids = list(result.scalars().all())
        await session.commit()
    return event_ids


async def load_dispatchable_events(*, limit: int) -> list[dict[str, Any]]:
    async with async_session_factory() as session:
        result = await session.execute(
            text(
                """
                SELECT id::text AS id, event_status, attempt_count
                FROM search_projection_outbox_events
                WHERE event_status IN ('pending', 'failed')
                  AND available_at <= now()
                ORDER BY created_at ASC
                LIMIT :limit
                """
            ),
            {"limit": limit},
        )
        return [dict(row) for row in result.mappings().all()]


async def dispatch_projection_events(*, events: list[dict[str, Any]]) -> tuple[int, int]:
    if not events:
        return 0, 0
    settings = get_settings()
    client = await Client.connect(settings.temporal_address, namespace=settings.temporal_namespace)
    dispatched_count = 0
    existing_count = 0
    for event in events:
        workflow_id = f"search-projection-{event['id']}-reconcile-{int(event['attempt_count']) + 1}"
        try:
            await client.start_workflow(
                "SearchProjectionWorkflow",
                {"projection_event_id": event["id"]},
                id=workflow_id,
                task_queue=settings.temporal_task_queue,
            )
            dispatched_count += 1
        except WorkflowAlreadyStartedError:
            existing_count += 1
    return dispatched_count, existing_count


async def wait_for_projection_events(*, event_ids: list[str], timeout_seconds: int) -> None:
    if not event_ids:
        return
    deadline = monotonic() + timeout_seconds
    while monotonic() < deadline:
        async with async_session_factory() as session:
            result = await session.execute(
                text(
                    """
                    SELECT id::text AS id, event_status, last_error
                    FROM search_projection_outbox_events
                    WHERE id::text = ANY(CAST(:event_ids AS text[]))
                    """
                ),
                {"event_ids": event_ids},
            )
            rows = [dict(row) for row in result.mappings().all()]
        failed_rows = [row for row in rows if row["event_status"] == "failed"]
        if failed_rows:
            raise RuntimeError(f"Projection rebuild event failed: {failed_rows[0]}")
        if len(rows) == len(event_ids) and all(row["event_status"] == "completed" for row in rows):
            return
        await asyncio.sleep(0.5)
    raise TimeoutError(f"Projection events did not complete within {timeout_seconds} seconds.")


async def load_expected_chunk_ids(*, session: AsyncSession) -> set[str]:
    result = await session.execute(
        text(
            """
            WITH latest_versions AS (
                SELECT DISTINCT ON (documents.id)
                    document_versions.id AS document_version_id
                FROM documents
                JOIN knowledge_bases
                    ON knowledge_bases.id = documents.knowledge_base_id
                   AND knowledge_bases.tenant_id = documents.tenant_id
                JOIN document_versions
                    ON document_versions.document_id = documents.id
                   AND document_versions.tenant_id = documents.tenant_id
                WHERE documents.deleted_at IS NULL
                  AND knowledge_bases.deleted_at IS NULL
                  AND document_versions.ingestion_status = 'completed'
                  AND EXISTS (
                      SELECT 1
                      FROM document_chunks
                      WHERE document_chunks.document_version_id = document_versions.id
                  )
                ORDER BY documents.id, document_versions.version_number DESC, document_versions.created_at DESC
            )
            SELECT document_chunks.id::text
            FROM latest_versions
            JOIN document_chunks
                ON document_chunks.document_version_id = latest_versions.document_version_id
            ORDER BY document_chunks.id
            """
        )
    )
    return set(result.scalars().all())


async def validate_and_promote_rebuild(
    *,
    client: ElasticsearchProjectionClient,
    target_index_name: str,
    read_alias: str,
    write_alias: str,
) -> int:
    async with async_session_factory() as session:
        await session.execute(text("SELECT pg_advisory_lock(hashtext('ragpilot_search_projection'))"))
        try:
            await session.execute(
                text(
                    "LOCK TABLE documents, document_versions, document_chunks, knowledge_bases "
                    "IN SHARE MODE"
                )
            )
            expected_chunk_ids = await load_expected_chunk_ids(session=session)
            actual_chunk_ids = await client.list_index_document_ids(index_name=target_index_name)
            missing_ids = expected_chunk_ids - actual_chunk_ids
            unexpected_ids = actual_chunk_ids - expected_chunk_ids
            if missing_ids or unexpected_ids:
                raise RuntimeError(
                    "Rebuild validation failed before alias cutover: "
                    f"expected={len(expected_chunk_ids)} actual={len(actual_chunk_ids)} "
                    f"missing={len(missing_ids)} unexpected={len(unexpected_ids)}"
                )
            await client.promote_aliases(
                target_index_name=target_index_name,
                read_alias=read_alias,
                write_alias=write_alias,
            )
            await session.execute(text("SELECT pg_advisory_unlock(hashtext('ragpilot_search_projection'))"))
            await session.commit()
            return len(expected_chunk_ids)
        except Exception:
            await session.execute(text("SELECT pg_advisory_unlock(hashtext('ragpilot_search_projection'))"))
            await session.rollback()
            raise


async def run_atomic_rebuild(*, target_index_version: int, timeout_seconds: int) -> None:
    settings = get_settings()
    client = ElasticsearchProjectionClient(
        base_url=settings.elasticsearch_url,
        request_timeout_seconds=settings.elasticsearch_request_timeout_seconds,
    )
    target_index_name = build_chunk_index_name(
        prefix=settings.elasticsearch_index_prefix,
        version=target_index_version,
    )
    read_alias = build_chunk_read_alias(prefix=settings.elasticsearch_index_prefix)
    write_alias = build_chunk_write_alias(prefix=settings.elasticsearch_index_prefix)
    active_indices = await client.get_alias_indices(alias=read_alias) | await client.get_alias_indices(alias=write_alias)
    if target_index_name in active_indices:
        raise ValueError(f"Target index {target_index_name} is already active and cannot be rebuilt in place.")

    await client.delete_index(index_name=target_index_name)
    await client.ensure_index(
        index_name=target_index_name,
        contract=build_chunk_index_contract(
            prefix=settings.elasticsearch_index_prefix,
            version=target_index_version,
            include_aliases=False,
        ),
    )
    run_id = str(uuid.uuid4())
    event_ids = await enqueue_backfill_events(
        tenant_id=None,
        knowledge_base_id=None,
        document_id=None,
        run_id=run_id,
        index_version=target_index_version,
    )
    events = [{"id": event_id, "attempt_count": 0} for event_id in event_ids]
    dispatched_count, existing_count = await dispatch_projection_events(events=events)
    print(
        f"rebuild_run_id={run_id} target={target_index_name} enqueued={len(event_ids)} "
        f"dispatched={dispatched_count} already_started={existing_count}"
    )
    await wait_for_projection_events(event_ids=event_ids, timeout_seconds=timeout_seconds)
    validated_chunk_count = await validate_and_promote_rebuild(
        client=client,
        target_index_name=target_index_name,
        read_alias=read_alias,
        write_alias=write_alias,
    )
    print(
        f"promoted={target_index_name} validated_chunk_count={validated_chunk_count} "
        f"read_alias={read_alias} write_alias={write_alias}"
    )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Backfill or atomically rebuild the Elasticsearch document projection.")
    parser.add_argument("--tenant-id")
    parser.add_argument("--knowledge-base-id")
    parser.add_argument("--document-id")
    parser.add_argument("--dispatch-only", action="store_true")
    parser.add_argument("--rebuild-to-version", type=int)
    parser.add_argument("--timeout-seconds", type=int, default=300)
    parser.add_argument("--limit", type=int, default=500)
    return parser


async def run(args: argparse.Namespace) -> None:
    if args.rebuild_to_version is not None:
        if args.dispatch_only or args.tenant_id or args.knowledge_base_id or args.document_id:
            raise ValueError("Atomic rebuild cannot be combined with dispatch-only or scoped Backfill options.")
        if args.rebuild_to_version < 1:
            raise ValueError("Rebuild target index version must be at least 1.")
        await run_atomic_rebuild(
            target_index_version=args.rebuild_to_version,
            timeout_seconds=max(args.timeout_seconds, 1),
        )
        return

    if not args.dispatch_only:
        enqueued_ids = await enqueue_backfill_events(
            tenant_id=args.tenant_id,
            knowledge_base_id=args.knowledge_base_id,
            document_id=args.document_id,
            run_id=str(uuid.uuid4()),
        )
        print(f"enqueued={len(enqueued_ids)}")
    events = await load_dispatchable_events(limit=max(args.limit, 1))
    dispatched_count, existing_count = await dispatch_projection_events(events=events)
    print(f"dispatchable={len(events)} dispatched={dispatched_count} already_started={existing_count}")


def main() -> None:
    asyncio.run(run(build_parser().parse_args()))


if __name__ == "__main__":
    main()
