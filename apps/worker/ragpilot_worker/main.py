import asyncio

from temporalio.client import Client
from temporalio.worker import Worker

from ragpilot_worker.activities.document_ingestion import ingest_document
from ragpilot_worker.activities.data_source_sync import fail_data_source_sync, finalize_data_source_sync, prepare_data_source_sync
from ragpilot_worker.activities.search_projection import project_document_version_to_elasticsearch
from ragpilot_worker.config import get_settings
from ragpilot_worker.workflows.document_ingestion import (
    DocumentIngestionWorkflow,
    LegacyDocumentIngestionWorkflow,
)
from ragpilot_worker.workflows.data_source_sync import DataSourceSyncWorkflow
from ragpilot_worker.workflows.search_projection import SearchProjectionWorkflow
from ragpilot_worker.infrastructure.observability import configure_worker_observability


async def connect_temporal_client() -> Client:
    settings = get_settings()
    last_error: Exception | None = None

    for attempt in range(1, max(int(settings.temporal_connect_max_attempts), 1) + 1):
        try:
            return await Client.connect(
                settings.temporal_address,
                namespace=settings.temporal_namespace,
            )
        except Exception as exc:  # pragma: no cover - runtime connectivity guard
            last_error = exc
            if attempt >= settings.temporal_connect_max_attempts:
                break
            await asyncio.sleep(max(float(settings.temporal_connect_retry_seconds), 0.1))

    if last_error is not None:
        raise last_error
    raise RuntimeError("Temporal client connection failed before a concrete error was captured.")


async def run_worker() -> None:
    settings = get_settings()
    configure_worker_observability(settings)
    client = await connect_temporal_client()

    worker = Worker(
        client,
        task_queue=settings.temporal_task_queue,
        workflows=[
            DocumentIngestionWorkflow,
            LegacyDocumentIngestionWorkflow,
            SearchProjectionWorkflow,
            DataSourceSyncWorkflow,
        ],
        activities=[
            ingest_document,
            project_document_version_to_elasticsearch,
            prepare_data_source_sync,
            finalize_data_source_sync,
            fail_data_source_sync,
        ],
    )
    await worker.run()


if __name__ == "__main__":
    asyncio.run(run_worker())
