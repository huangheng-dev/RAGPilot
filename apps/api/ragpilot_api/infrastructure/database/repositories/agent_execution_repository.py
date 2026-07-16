import hashlib
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ragpilot_api.infrastructure.database.models import AgentExecution


AGENT_EXECUTION_PROMPT_VERSION_ID = UUID("10000000-0000-0000-0000-000000000002")


class AgentExecutionRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create_agent_execution(
        self,
        *,
        tenant_id: UUID,
        agent_definition_id: UUID,
        workspace_id: UUID | None,
        knowledge_base_id: UUID | None,
        execution_mode: str,
        execution_status: str,
        trigger_source: str,
        knowledge_base_scope: str | None,
        model_endpoint_id: UUID | None,
        tool_registration_ids: list[str],
        execution_input: str | None,
        launched_by_user_id: UUID | None,
        retry_of_execution_id: UUID | None = None,
        replay_of_execution_id: UUID | None = None,
        execution_policy_json: dict | None = None,
        output_schema_json: dict | None = None,
        replay_fingerprint: str | None = None,
    ) -> AgentExecution:
        agent_execution = AgentExecution(
            tenant_id=tenant_id,
            agent_definition_id=agent_definition_id,
            workspace_id=workspace_id,
            knowledge_base_id=knowledge_base_id,
            execution_mode=execution_mode,
            execution_status=execution_status,
            trigger_source=trigger_source,
            knowledge_base_scope=knowledge_base_scope,
            model_endpoint_id=model_endpoint_id,
            tool_registration_ids_json=tool_registration_ids,
            execution_input=execution_input,
            prompt_version_id=AGENT_EXECUTION_PROMPT_VERSION_ID,
            prompt_snapshot_hash=hashlib.sha256((execution_input or "").encode("utf-8")).hexdigest(),
            launched_by_user_id=launched_by_user_id,
            retry_of_execution_id=retry_of_execution_id,
            replay_of_execution_id=replay_of_execution_id,
            execution_policy_json=execution_policy_json or {},
            output_schema_json=output_schema_json,
            replay_fingerprint=replay_fingerprint,
        )
        self.session.add(agent_execution)
        await self.session.commit()
        await self.session.refresh(agent_execution)
        return agent_execution

    async def mark_agent_execution_running(self, *, agent_execution: AgentExecution) -> AgentExecution:
        now = datetime.now(timezone.utc)
        agent_execution.execution_status = "running"
        agent_execution.started_at = now
        agent_execution.updated_at = now
        await self.session.commit()
        await self.session.refresh(agent_execution)
        return agent_execution

    async def mark_agent_execution_awaiting_approval(self, *, agent_execution: AgentExecution,
                                                      result_payload_json: dict) -> AgentExecution:
        agent_execution.execution_status = "awaiting_approval"
        agent_execution.result_payload_json = result_payload_json
        agent_execution.updated_at = datetime.now(timezone.utc)
        await self.session.commit()
        await self.session.refresh(agent_execution)
        return agent_execution

    async def get_agent_execution(self, *, agent_execution_id: UUID, tenant_id: UUID) -> AgentExecution | None:
        return await self.session.scalar(
            select(AgentExecution).where(
                AgentExecution.id == agent_execution_id,
                AgentExecution.tenant_id == tenant_id,
            )
        )

    async def attach_temporal_workflow(
        self,
        *,
        agent_execution: AgentExecution,
        temporal_workflow_id: str,
    ) -> AgentExecution:
        agent_execution.temporal_workflow_id = temporal_workflow_id
        agent_execution.updated_at = datetime.now(timezone.utc)
        await self.session.commit()
        await self.session.refresh(agent_execution)
        return agent_execution

    async def attach_replay_source(
        self, *, agent_execution: AgentExecution, replay_of_execution_id: UUID,
    ) -> AgentExecution:
        agent_execution.replay_of_execution_id = replay_of_execution_id
        agent_execution.updated_at = datetime.now(timezone.utc)
        await self.session.commit()
        await self.session.refresh(agent_execution)
        return agent_execution

    async def request_agent_execution_cancellation(self, *, agent_execution: AgentExecution) -> AgentExecution:
        now = datetime.now(timezone.utc)
        agent_execution.cancellation_requested_at = now
        agent_execution.updated_at = now
        await self.session.commit()
        await self.session.refresh(agent_execution)
        return agent_execution

    async def cancel_agent_execution(self, *, agent_execution: AgentExecution) -> AgentExecution:
        now = datetime.now(timezone.utc)
        agent_execution.execution_status = "cancelled"
        agent_execution.cancelled_at = now
        agent_execution.completed_at = now
        agent_execution.updated_at = now
        await self.session.commit()
        await self.session.refresh(agent_execution)
        return agent_execution

    async def complete_agent_execution(
        self,
        *,
        agent_execution: AgentExecution,
        summary: str,
        result_payload_json: dict,
    ) -> AgentExecution:
        await self.session.refresh(agent_execution)
        if agent_execution.execution_status == "cancelled":
            return agent_execution
        now = datetime.now(timezone.utc)
        agent_execution.execution_status = "completed"
        agent_execution.summary = summary
        agent_execution.result_payload_json = result_payload_json
        agent_execution.error_message = None
        agent_execution.completed_at = now
        agent_execution.updated_at = now
        await self.session.commit()
        await self.session.refresh(agent_execution)
        return agent_execution

    async def fail_agent_execution(
        self,
        *,
        agent_execution: AgentExecution,
        error_message: str,
        result_payload_json: dict | None = None,
    ) -> AgentExecution:
        await self.session.refresh(agent_execution)
        if agent_execution.execution_status == "cancelled":
            return agent_execution
        now = datetime.now(timezone.utc)
        agent_execution.execution_status = "failed"
        agent_execution.error_message = error_message
        if result_payload_json is not None:
            agent_execution.result_payload_json = result_payload_json
        agent_execution.completed_at = now
        agent_execution.updated_at = now
        await self.session.commit()
        await self.session.refresh(agent_execution)
        return agent_execution

    async def list_agent_executions(
        self,
        *,
        tenant_id: UUID,
        agent_definition_id: UUID | None = None,
        execution_mode: str | None = None,
        execution_status: str | None = None,
        limit: int = 20,
    ) -> list[AgentExecution]:
        statement = (
            select(AgentExecution)
            .where(AgentExecution.tenant_id == tenant_id)
            .order_by(AgentExecution.created_at.desc())
            .limit(limit)
        )
        if agent_definition_id is not None:
            statement = statement.where(AgentExecution.agent_definition_id == agent_definition_id)
        if execution_mode is not None:
            statement = statement.where(AgentExecution.execution_mode == execution_mode)
        if execution_status is not None:
            statement = statement.where(AgentExecution.execution_status == execution_status)

        result = await self.session.scalars(statement)
        return list(result)

    async def list_agent_executions_for_metrics(
        self,
        *,
        tenant_id: UUID,
        agent_definition_id: UUID | None = None,
        execution_mode: str | None = None,
        execution_status: str | None = None,
    ) -> list[AgentExecution]:
        statement = select(AgentExecution).where(AgentExecution.tenant_id == tenant_id)
        if agent_definition_id is not None:
            statement = statement.where(AgentExecution.agent_definition_id == agent_definition_id)
        if execution_mode is not None:
            statement = statement.where(AgentExecution.execution_mode == execution_mode)
        if execution_status is not None:
            statement = statement.where(AgentExecution.execution_status == execution_status)

        result = await self.session.scalars(statement)
        return list(result)
