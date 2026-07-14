from datetime import timedelta

from temporalio import workflow


async def execute_document_ingestion_activity(payload: dict[str, str]) -> dict[str, str]:
    ingestion_result = await workflow.execute_activity(
        "ingest_document",
        payload,
        schedule_to_close_timeout=timedelta(minutes=10),
    )
    projection_event_id = ingestion_result.get("projection_event_id")
    if projection_event_id:
        projection_payload = {"projection_event_id": projection_event_id}
        if payload.get("trace_context"):
            projection_payload["trace_context"] = payload["trace_context"]
        projection_result = await workflow.execute_activity(
            "project_document_version_to_elasticsearch",
            projection_payload,
            schedule_to_close_timeout=timedelta(minutes=10),
        )
        ingestion_result["search_projection_status"] = str(projection_result.get("status", "unknown"))
    return ingestion_result


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
