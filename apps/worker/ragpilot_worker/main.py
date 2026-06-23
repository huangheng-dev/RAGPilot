import asyncio

from temporalio.client import Client
from temporalio.worker import Worker

from ragpilot_worker.activities.document_ingestion import ingest_document
from ragpilot_worker.config import get_settings
from ragpilot_worker.workflows.document_ingestion import (
    DocumentIngestionWorkflow,
    LegacyDocumentIngestionWorkflow,
)


async def run_worker() -> None:
    settings = get_settings()
    client = await Client.connect(
        settings.temporal_address,
        namespace=settings.temporal_namespace,
    )

    worker = Worker(
        client,
        task_queue=settings.temporal_task_queue,
        workflows=[DocumentIngestionWorkflow, LegacyDocumentIngestionWorkflow],
        activities=[ingest_document],
    )
    await worker.run()


if __name__ == "__main__":
    asyncio.run(run_worker())
