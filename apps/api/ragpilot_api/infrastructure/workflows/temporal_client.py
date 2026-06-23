from __future__ import annotations

from temporalio.client import Client

from ragpilot_api.shared.settings import Settings, get_settings


class TemporalWorkflowClient:
    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()

    async def start_document_ingestion_workflow(
        self,
        *,
        workflow_run_id: str,
        document_id: str,
    ) -> str:
        client = await Client.connect(
            self.settings.temporal_address,
            namespace=self.settings.temporal_namespace,
        )
        temporal_workflow_id = f"document-ingestion-{workflow_run_id}"
        await client.start_workflow(
            "DocumentIngestionWorkflow",
            {
                "workflow_run_id": workflow_run_id,
                "document_id": document_id,
            },
            id=temporal_workflow_id,
            task_queue=self.settings.temporal_task_queue,
        )
        return temporal_workflow_id
