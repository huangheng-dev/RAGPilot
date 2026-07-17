from __future__ import annotations

from datetime import timedelta
from typing import Any

from temporalio import workflow
from temporalio.common import RetryPolicy


@workflow.defn(name="DataSourceSyncWorkflow")
class DataSourceSyncWorkflow:
    @workflow.run
    async def run(self, payload: dict[str, Any]) -> dict[str, Any]:
        try:
            prepared = await workflow.execute_activity(
                "prepare_data_source_sync",
                payload,
                start_to_close_timeout=timedelta(minutes=10),
                retry_policy=RetryPolicy(maximum_attempts=3),
            )
            ingestion_results: list[dict[str, str]] = []
            for ingestion_payload in prepared["ingestion_payloads"]:
                workflow_run_id = ingestion_payload["workflow_run_id"]
                ingestion_results.append(await workflow.execute_child_workflow(
                    "DocumentIngestionWorkflow",
                    ingestion_payload,
                    id=f"document-ingestion-{workflow_run_id}",
                ))
            deletion_results: list[dict[str, object]] = []
            for event_id in prepared["deletion_projection_event_ids"]:
                deletion_results.append(await workflow.execute_activity(
                    "project_document_version_to_elasticsearch",
                    {"projection_event_id": event_id},
                    start_to_close_timeout=timedelta(minutes=10),
                    retry_policy=RetryPolicy(maximum_attempts=3),
                ))
            await workflow.execute_activity(
                "finalize_data_source_sync",
                {**payload, **prepared},
                start_to_close_timeout=timedelta(minutes=2),
                retry_policy=RetryPolicy(maximum_attempts=5),
            )
            return {
                "sync_run_id": payload["sync_run_id"],
                "status": "completed",
                "documents_changed": prepared["documents_changed"],
                "documents_unchanged": prepared["documents_unchanged"],
                "documents_deleted": prepared["documents_deleted"],
                "ingestion_results": ingestion_results,
                "deletion_results": deletion_results,
            }
        except Exception as error:
            await workflow.execute_activity(
                "fail_data_source_sync",
                {**payload, "error_message": str(error)},
                start_to_close_timeout=timedelta(minutes=2),
                retry_policy=RetryPolicy(maximum_attempts=5),
            )
            raise
