from __future__ import annotations

from temporalio import activity
from temporalio.exceptions import ApplicationError

from ragpilot_worker.application.search_projection_service import (
    SearchProjectionEventNotFoundError,
    SearchProjectionService,
    SearchProjectionSourceStateError,
    project_document_version,
)
from ragpilot_worker.config import get_settings
from ragpilot_worker.infrastructure.database import async_session_factory
from ragpilot_worker.infrastructure.search.elasticsearch_client import ElasticsearchProjectionClient
from ragpilot_worker.infrastructure.observability import traced_activity


@activity.defn(name="project_document_version_to_elasticsearch")
@traced_activity("worker.elasticsearch_projection")
async def project_document_version_to_elasticsearch(payload: dict[str, str]) -> dict[str, object]:
    event_id = payload["projection_event_id"]
    settings = get_settings()
    if not settings.elasticsearch_projection_enabled:
        activity.logger.info("Elasticsearch projection is disabled; leaving event_id=%s pending", event_id)
        return {"event_id": event_id, "status": "deferred", "reason": "projection_disabled"}

    client = ElasticsearchProjectionClient(
        base_url=settings.elasticsearch_url,
        request_timeout_seconds=settings.elasticsearch_request_timeout_seconds,
    )
    try:
        async with async_session_factory() as session:
            service = SearchProjectionService(session)
            return await project_document_version(
                service=service,
                client=client,
                event_id=event_id,
                index_prefix=settings.elasticsearch_index_prefix,
                index_version=settings.elasticsearch_index_version,
            )
    except (SearchProjectionEventNotFoundError, SearchProjectionSourceStateError) as error:
        async with async_session_factory() as session:
            await SearchProjectionService(session).mark_failed(event_id=event_id, error_message=str(error))
        raise ApplicationError(str(error), non_retryable=True) from error
    except Exception as error:
        async with async_session_factory() as session:
            await SearchProjectionService(session).mark_failed(event_id=event_id, error_message=str(error))
        raise
