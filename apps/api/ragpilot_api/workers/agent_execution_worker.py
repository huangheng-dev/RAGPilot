from __future__ import annotations

import asyncio
from uuid import UUID

from temporalio import activity
from temporalio.client import Client
from temporalio.worker import Worker

from ragpilot_api.contracts.http.agent_execution_contracts import AgentExecutionCreateRequest
from ragpilot_api.infrastructure.database.repositories.agent_execution_repository import AgentExecutionRepository
from ragpilot_api.infrastructure.database.repositories.agent_approval_repository import AgentApprovalRepository
from ragpilot_api.infrastructure.database.session import async_session_factory
from ragpilot_api.presentation.http.request_actor import RequestActor
from ragpilot_api.presentation.http.v1.agent_routes import build_agent_execution_service
from ragpilot_api.shared.settings import get_settings
from ragpilot_api.workflows.agent_execution import AgentExecutionWorkflow


@activity.defn(name="execute_agent_execution")
async def execute_agent_execution(payload: dict) -> dict[str, str]:
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
            approved_tool_registration_ids={
                UUID(value) for value in (payload.get("approved_tool_registration_ids") or [])
            },
        )
        approval = response.result_payload_json.get("approval_request", {})
        return {
            "agent_execution_id": str(response.id),
            "execution_status": response.execution_status,
            "approval_request_id": str(approval.get("id") or ""),
            "tool_registration_id": str(approval.get("tool_registration_id") or ""),
            "approval_timeout_seconds": str(approval.get("timeout_seconds") or "86400"),
        }


@activity.defn(name="finalize_agent_approval")
async def finalize_agent_approval(payload: dict) -> dict[str, str]:
    execution_id = UUID(str(payload["agent_execution_id"]))
    tenant_id = UUID(str(payload["tenant_id"]))
    decision = str(payload.get("decision") or "rejected")
    async with async_session_factory() as session:
        repository = AgentExecutionRepository(session)
        execution = await repository.get_agent_execution(agent_execution_id=execution_id, tenant_id=tenant_id)
        if execution is None:
            raise RuntimeError("Agent execution not found.")
        approval_request_id = payload.get("approval_request_id")
        if approval_request_id and decision == "expired":
            approval_repository = AgentApprovalRepository(session)
            approval = await approval_repository.get(
                approval_request_id=UUID(str(approval_request_id)), tenant_id=tenant_id,
            )
            if approval is not None and approval.approval_status == "pending":
                await approval_repository.decide(
                    request=approval, status="expired", actor_user_id=None,
                    reason="Approval request expired while the workflow was waiting.",
                )
        execution = await repository.fail_agent_execution(
            agent_execution=execution,
            error_message=f"Agent approval {decision}.",
            result_payload_json={
                **(execution.result_payload_json or {}),
                "approval_decision": decision,
                "failure_classification": {"category": "governance", "retryable": False},
            },
        )
        return {"agent_execution_id": str(execution.id), "execution_status": execution.execution_status}


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
        activities=[execute_agent_execution, finalize_agent_approval],
    )
    await worker.run()


if __name__ == "__main__":
    asyncio.run(run_worker())
