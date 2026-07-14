from __future__ import annotations

from typing import Any

import httpx
from opentelemetry import metrics
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


_meter = metrics.get_meter("ragpilot.api.search_projection")
_queue_depth = _meter.create_histogram("ragpilot.projection.queue.depth", unit="{event}")
_projection_lag = _meter.create_histogram("ragpilot.projection.lag", unit="s")
_failed_events = _meter.create_histogram("ragpilot.projection.failed", unit="{event}")
_stale_documents = _meter.create_histogram("ragpilot.projection.stale_documents", unit="{document}")


async def build_search_projection_diagnostics(
    *,
    session: AsyncSession,
    enabled: bool,
    base_url: str,
    read_alias: str,
    timeout_seconds: float,
) -> dict[str, Any]:
    counts_result = await session.execute(
        text(
            """
            SELECT
                COUNT(*) FILTER (WHERE event_status = 'pending')::integer AS pending_count,
                COUNT(*) FILTER (WHERE event_status = 'processing')::integer AS processing_count,
                COUNT(*) FILTER (WHERE event_status = 'failed')::integer AS failed_count,
                EXTRACT(EPOCH FROM (now() - MIN(created_at) FILTER (
                    WHERE event_status IN ('pending', 'processing', 'failed')
                )))::float AS oldest_unprocessed_age_seconds
            FROM search_projection_outbox_events
            """
        )
    )
    counts = dict(counts_result.mappings().one())
    stale_result = await session.execute(
        text(
            """
            WITH latest_completed_versions AS (
                SELECT DISTINCT ON (document_id) document_id, id AS document_version_id
                FROM document_versions
                WHERE ingestion_status = 'completed'
                ORDER BY document_id, version_number DESC
            ), latest_projection_events AS (
                SELECT DISTINCT ON (document_id)
                    document_id, document_version_id, event_type, event_status
                FROM search_projection_outbox_events
                WHERE event_status = 'completed'
                ORDER BY document_id, processed_at DESC NULLS LAST, created_at DESC
            )
            SELECT COUNT(*)::integer
            FROM documents
            JOIN latest_completed_versions
              ON latest_completed_versions.document_id = documents.id
            LEFT JOIN latest_projection_events
              ON latest_projection_events.document_id = documents.id
            WHERE documents.deleted_at IS NULL
              AND (
                  latest_projection_events.document_id IS NULL
                  OR latest_projection_events.event_type <> 'document_version_upsert'
                  OR latest_projection_events.document_version_id <> latest_completed_versions.document_version_id
              )
            """
        )
    )

    diagnostics: dict[str, Any] = {
        "enabled": enabled,
        "reachable": False,
        "read_alias": read_alias,
        "active_indices": [],
        "pending_count": counts["pending_count"],
        "processing_count": counts["processing_count"],
        "failed_count": counts["failed_count"],
        "oldest_unprocessed_age_seconds": counts["oldest_unprocessed_age_seconds"],
        "stale_document_count": stale_result.scalar_one(),
    }
    _queue_depth.record(
        int(diagnostics["pending_count"]) + int(diagnostics["processing_count"])
    )
    _projection_lag.record(
        float(diagnostics["oldest_unprocessed_age_seconds"] or 0)
    )
    _failed_events.record(
        int(diagnostics["failed_count"])
    )
    _stale_documents.record(
        int(diagnostics["stale_document_count"])
    )
    if not enabled:
        return diagnostics

    try:
        async with httpx.AsyncClient(timeout=timeout_seconds) as client:
            response = await client.get(f"{base_url.rstrip('/')}/_alias/{read_alias}")
            response.raise_for_status()
            diagnostics["active_indices"] = sorted(response.json().keys())
            diagnostics["reachable"] = True
    except (httpx.HTTPError, ValueError):
        pass
    return diagnostics
