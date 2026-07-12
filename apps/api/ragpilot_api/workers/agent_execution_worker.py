from __future__ import annotations

import asyncio
from uuid import UUID

from temporalio import activity
from temporalio.client import Client
from temporalio.worker import Worker

from ragpilot_api.contracts.http.agent_execution_contracts import AgentExecutionCreateRequest
from ragpilot_api.infrastructure.database.repositories.agent_execution_repository import AgentExecutionRepository
from ragpilot_api.infrastructure.database.session import async_session_factory
from ragpilot_api.presentation.http.request_actor import RequestActor
from ragpilot_api.presentation.http.v1.agent_routes import build_agent_execution_service
from ragpilot_api.shared.settings import get_settings
from ragpilot_api.workflows.agent_execution import AgentExecutionWorkflow


@activity.defn(name="execute_agent_execution")
async def execute_agent_execution(payload: dict[str, str | None]) -> dict[str, str]:
    execution_id = UUID(str(payload["agent_execution_id"]))
    tenant_id = UUID(str(payload["tenant_id"]))
    async with async_session_factory() as session:
        execution = await AgentExecutionRepository(session).get_agent_execution(
            agent_execution_id=execution_id, tenant_id=tenant_id,
        )
        if execution is None:
            raise RuntimeError("Agent execution not found.")
        actor = RequestActor(
            role=str(payload.get("actor_role") or "member"),
            user_id=UUID(str(payload["actor_user_id"])) if payload.get("actor_user_id") else None,
            active_tenant_ids=(tenant_id,),
        )
        response = await build_agent_execution_service(session).create_agent_execution(
            AgentExecutionCreateRequest(
                tenant_id=tenant_id,
                agent_definition_id=execution.agent_definition_id,
                execution_input=execution.execution_input,
                trigger_source=execution.trigger_source,
            ),
            actor=actor,
            existing_execution_id=execution_id,
        )
        return {"agent_execution_id": str(response.id), "execution_status": response.execution_status}


async def run_worker() -> None:
    settings = get_settings()
    while True:
        try:
            client = await Client.connect(
                settings.temporal_address,
                namespace=settings.temporal_namespace,
            )
            break
        except Exception:
            await asyncio.sleep(2)
    worker = Worker(
        client,
        task_queue=settings.agent_temporal_task_queue,
        workflows=[AgentExecutionWorkflow],
        activities=[execute_agent_execution],
    )
    await worker.run()


if __name__ == "__main__":
    asyncio.run(run_worker())
