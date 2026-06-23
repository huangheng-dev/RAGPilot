from uuid import UUID

from ragpilot_api.application.errors import ResourceNotFoundError
from ragpilot_api.contracts.http.agent_run_contracts import (
    AgentRunCreateRequest,
    AgentRunMetricsResponse,
    AgentRunResponse,
)
from ragpilot_api.infrastructure.database.models import AgentRun
from ragpilot_api.infrastructure.database.repositories.agent_repository import AgentRepository
from ragpilot_api.infrastructure.database.repositories.agent_run_repository import AgentRunRepository
from ragpilot_api.presentation.http.request_actor import RequestActor


class AgentRunService:
    def __init__(self, agent_repository: AgentRepository, agent_run_repository: AgentRunRepository) -> None:
        self.agent_repository = agent_repository
        self.agent_run_repository = agent_run_repository

    async def create_agent_run(
        self,
        request: AgentRunCreateRequest,
        *,
        actor: RequestActor,
    ) -> AgentRunResponse:
        agent_definition = await self.agent_repository.get_agent_definition(
            agent_definition_id=request.agent_definition_id,
            tenant_id=request.tenant_id,
        )
        if agent_definition is None:
            raise ResourceNotFoundError("Agent definition not found in the current tenant scope.")

        agent_run = await self.agent_run_repository.create_agent_run(
            tenant_id=request.tenant_id,
            agent_definition_id=request.agent_definition_id,
            workspace_id=request.workspace_id,
            knowledge_base_id=request.knowledge_base_id,
            target_surface=request.target_surface,
            handoff_intent=request.handoff_intent.strip() if request.handoff_intent else None,
            run_status=request.run_status,
            trigger_source=request.trigger_source,
            launch_prompt=request.launch_prompt.strip() if request.launch_prompt else None,
            navigation_href=request.navigation_href.strip() if request.navigation_href else None,
            launched_by_user_id=actor.user_id,
        )
        return build_agent_run_response(agent_run)

    async def list_agent_runs(
        self,
        *,
        tenant_id: UUID,
        agent_definition_id: UUID | None = None,
        target_surface: str | None = None,
        trigger_source: str | None = None,
        run_status: str | None = None,
        limit: int = 20,
    ) -> list[AgentRunResponse]:
        agent_runs = await self.agent_run_repository.list_agent_runs(
            tenant_id=tenant_id,
            agent_definition_id=agent_definition_id,
            target_surface=target_surface,
            trigger_source=trigger_source,
            run_status=run_status,
            limit=limit,
        )
        return [build_agent_run_response(agent_run) for agent_run in agent_runs]

    async def get_agent_run_metrics(
        self,
        *,
        tenant_id: UUID,
        agent_definition_id: UUID | None = None,
        target_surface: str | None = None,
        trigger_source: str | None = None,
        run_status: str | None = None,
    ) -> AgentRunMetricsResponse:
        agent_runs = await self.agent_run_repository.list_agent_runs_for_metrics(
            tenant_id=tenant_id,
            agent_definition_id=agent_definition_id,
            target_surface=target_surface,
            trigger_source=trigger_source,
            run_status=run_status,
        )

        latest_launched_at = agent_runs[0].created_at if agent_runs else None
        if len(agent_runs) > 1:
            latest_launched_at = max(agent_run.created_at for agent_run in agent_runs)

        return AgentRunMetricsResponse(
            total_runs=len(agent_runs),
            chat_runs=sum(1 for agent_run in agent_runs if agent_run.target_surface == "chat"),
            document_runs=sum(1 for agent_run in agent_runs if agent_run.target_surface == "documents"),
            operations_runs=sum(1 for agent_run in agent_runs if agent_run.target_surface == "operations"),
            admin_runs=sum(1 for agent_run in agent_runs if agent_run.target_surface == "admin"),
            latest_launched_at=latest_launched_at,
        )


def build_agent_run_response(agent_run: AgentRun) -> AgentRunResponse:
    return AgentRunResponse(
        id=agent_run.id,
        tenant_id=agent_run.tenant_id,
        agent_definition_id=agent_run.agent_definition_id,
        workspace_id=agent_run.workspace_id,
        knowledge_base_id=agent_run.knowledge_base_id,
        target_surface=agent_run.target_surface,
        handoff_intent=agent_run.handoff_intent,
        run_status=agent_run.run_status,
        trigger_source=agent_run.trigger_source,
        launch_prompt=agent_run.launch_prompt,
        navigation_href=agent_run.navigation_href,
        launched_by_user_id=agent_run.launched_by_user_id,
        completed_at=agent_run.completed_at,
        created_at=agent_run.created_at,
        updated_at=agent_run.updated_at,
    )
