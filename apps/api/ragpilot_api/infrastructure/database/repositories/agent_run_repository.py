import hashlib
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ragpilot_api.infrastructure.database.models import AgentRun


AGENT_RUN_PROMPT_VERSION_ID = UUID("10000000-0000-0000-0000-000000000002")


class AgentRunRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create_agent_run(
        self,
        *,
        tenant_id: UUID,
        agent_definition_id: UUID,
        workspace_id: UUID | None,
        knowledge_base_id: UUID | None,
        target_surface: str,
        handoff_intent: str | None,
        run_status: str,
        trigger_source: str,
        launch_prompt: str | None,
        navigation_href: str | None,
        launched_by_user_id: UUID | None,
    ) -> AgentRun:
        agent_run = AgentRun(
            tenant_id=tenant_id,
            agent_definition_id=agent_definition_id,
            workspace_id=workspace_id,
            knowledge_base_id=knowledge_base_id,
            target_surface=target_surface,
            handoff_intent=handoff_intent,
            run_status=run_status,
            trigger_source=trigger_source,
            launch_prompt=launch_prompt,
            prompt_version_id=AGENT_RUN_PROMPT_VERSION_ID,
            prompt_snapshot_hash=hashlib.sha256((launch_prompt or "").encode("utf-8")).hexdigest(),
            navigation_href=navigation_href,
            launched_by_user_id=launched_by_user_id,
        )
        self.session.add(agent_run)
        await self.session.commit()
        await self.session.refresh(agent_run)
        return agent_run

    async def list_agent_runs(
        self,
        *,
        tenant_id: UUID,
        agent_definition_id: UUID | None = None,
        target_surface: str | None = None,
        trigger_source: str | None = None,
        run_status: str | None = None,
        limit: int = 20,
    ) -> list[AgentRun]:
        statement = (
            select(AgentRun)
            .where(AgentRun.tenant_id == tenant_id)
            .order_by(AgentRun.created_at.desc())
            .limit(limit)
        )
        if agent_definition_id is not None:
            statement = statement.where(AgentRun.agent_definition_id == agent_definition_id)
        if target_surface is not None:
            statement = statement.where(AgentRun.target_surface == target_surface)
        if trigger_source is not None:
            statement = statement.where(AgentRun.trigger_source == trigger_source)
        if run_status is not None:
            statement = statement.where(AgentRun.run_status == run_status)

        result = await self.session.scalars(statement)
        return list(result)

    async def list_agent_runs_for_metrics(
        self,
        *,
        tenant_id: UUID,
        agent_definition_id: UUID | None = None,
        target_surface: str | None = None,
        trigger_source: str | None = None,
        run_status: str | None = None,
    ) -> list[AgentRun]:
        statement = select(AgentRun).where(AgentRun.tenant_id == tenant_id)
        if agent_definition_id is not None:
            statement = statement.where(AgentRun.agent_definition_id == agent_definition_id)
        if target_surface is not None:
            statement = statement.where(AgentRun.target_surface == target_surface)
        if trigger_source is not None:
            statement = statement.where(AgentRun.trigger_source == trigger_source)
        if run_status is not None:
            statement = statement.where(AgentRun.run_status == run_status)

        result = await self.session.scalars(statement)
        return list(result)
