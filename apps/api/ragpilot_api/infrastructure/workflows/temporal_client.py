from __future__ import annotations

from datetime import timedelta

from temporalio.client import Client

from ragpilot_api.shared.settings import Settings, get_settings
from opentelemetry.propagate import inject


def current_trace_context() -> dict[str, str]:
    carrier: dict[str, str] = {}
    inject(carrier)
    return carrier


def with_current_trace_context(payload: dict) -> dict:
    carrier = current_trace_context()
    return {**payload, **({"trace_context": carrier} if carrier else {})}


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
            with_current_trace_context({
                "workflow_run_id": workflow_run_id,
                "document_id": document_id,
            }),
            id=temporal_workflow_id,
            task_queue=self.settings.temporal_task_queue,
        )
        return temporal_workflow_id

    async def start_search_projection_workflow(self, *, projection_event_id: str) -> str:
        client = await Client.connect(
            self.settings.temporal_address,
            namespace=self.settings.temporal_namespace,
        )
        temporal_workflow_id = f"search-projection-{projection_event_id}"
        await client.start_workflow(
            "SearchProjectionWorkflow",
            with_current_trace_context({"projection_event_id": projection_event_id}),
            id=temporal_workflow_id,
            task_queue=self.settings.temporal_task_queue,
        )
        return temporal_workflow_id

    async def start_data_source_sync_workflow(
        self,
        *,
        temporal_workflow_id: str,
        data_source_id: str,
        sync_run_id: str,
        lease_token: str,
    ) -> str:
        client = await Client.connect(
            self.settings.temporal_address,
            namespace=self.settings.temporal_namespace,
        )
        await client.start_workflow(
            "DataSourceSyncWorkflow",
            with_current_trace_context({
                "data_source_id": data_source_id,
                "sync_run_id": sync_run_id,
                "lease_token": lease_token,
            }),
            id=temporal_workflow_id,
            task_queue=self.settings.temporal_task_queue,
        )
        return temporal_workflow_id

    async def cancel_workflow(
        self,
        *,
        temporal_workflow_id: str,
        reason: str,
    ) -> None:
        client = await Client.connect(
            self.settings.temporal_address,
            namespace=self.settings.temporal_namespace,
        )
        workflow_handle = client.get_workflow_handle(temporal_workflow_id)
        await workflow_handle.terminate(
            reason=reason,
            rpc_timeout=timedelta(seconds=10),
        )

    async def start_agent_execution_workflow(
        self,
        *,
        agent_execution_id: str,
        tenant_id: str,
        actor_user_id: str | None,
        actor_role: str,
        max_runtime_seconds: int = 900,
    ) -> str:
        client = await Client.connect(
            self.settings.temporal_address,
            namespace=self.settings.temporal_namespace,
        )
        temporal_workflow_id = f"agent-execution-{agent_execution_id}"
        await client.start_workflow(
            "AgentExecutionWorkflow",
            with_current_trace_context({
                "agent_execution_id": agent_execution_id,
                "tenant_id": tenant_id,
                "actor_user_id": actor_user_id,
                "actor_role": actor_role,
                "max_runtime_seconds": str(max_runtime_seconds),
            }),
            id=temporal_workflow_id,
            task_queue=self.settings.agent_temporal_task_queue,
        )
        return temporal_workflow_id

    async def signal_agent_approval(self, *, temporal_workflow_id: str, decision: str, reason: str) -> None:
        client = await Client.connect(
            self.settings.temporal_address,
            namespace=self.settings.temporal_namespace,
        )
        await client.get_workflow_handle(temporal_workflow_id).signal(
            "decide_approval",
            {"decision": decision, "reason": reason},
            rpc_timeout=timedelta(seconds=10),
        )
