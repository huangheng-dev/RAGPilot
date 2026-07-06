import asyncio

from temporalio.client import Client
from temporalio.worker import Worker

from ragpilot_worker.activities.document_ingestion import ingest_document
from ragpilot_worker.config import get_settings
from ragpilot_worker.workflows.document_ingestion import (
    DocumentIngestionWorkflow,
    LegacyDocumentIngestionWorkflow,
)


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
    client = await connect_temporal_client()

    worker = Worker(
        client,
        task_queue=settings.temporal_task_queue,
        workflows=[DocumentIngestionWorkflow, LegacyDocumentIngestionWorkflow],
        activities=[ingest_document],
    )
    await worker.run()


if __name__ == "__main__":
    asyncio.run(run_worker())
