from datetime import timedelta

from temporalio import workflow


async def execute_document_ingestion_activity(payload: dict[str, str]) -> dict[str, str]:
    return await workflow.execute_activity(
        "ingest_document",
        payload,
        schedule_to_close_timeout=timedelta(minutes=10),
    )


@workflow.defn(name="DocumentIngestionWorkflow")
class DocumentIngestionWorkflow:
    @workflow.run
    async def run(self, payload: dict[str, str]) -> dict[str, str]:
        return await execute_document_ingestion_activity(payload)


@workflow.defn(name="DocumentIngestionWorkflow.run")
class LegacyDocumentIngestionWorkflow:
    @workflow.run
    async def run(self, payload: dict[str, str]) -> dict[str, str]:
        return await execute_document_ingestion_activity(payload)
