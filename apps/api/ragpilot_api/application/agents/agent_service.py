from uuid import UUID

from ragpilot_api.application.errors import ResourceNotFoundError
from ragpilot_api.contracts.http.agent_contracts import (
    AgentDefinitionCreateRequest,
    AgentDefinitionMetricsResponse,
    AgentDefinitionResponse,
    AgentDefinitionUpdateRequest,
)
from ragpilot_api.infrastructure.database.models import AgentDefinition
from ragpilot_api.infrastructure.database.repositories.agent_repository import AgentRepository
from ragpilot_api.infrastructure.database.repositories.model_endpoint_repository import ModelEndpointRepository
from ragpilot_api.infrastructure.database.repositories.tool_registration_repository import ToolRegistrationRepository


class AgentService:
    def __init__(
        self,
        agent_repository: AgentRepository,
        model_endpoint_repository: ModelEndpointRepository,
        tool_registration_repository: ToolRegistrationRepository,
    ) -> None:
        self.agent_repository = agent_repository
        self.model_endpoint_repository = model_endpoint_repository
        self.tool_registration_repository = tool_registration_repository

    async def create_agent_definition(self, request: AgentDefinitionCreateRequest) -> AgentDefinitionResponse:
        await self._validate_governance_bindings(
            model_endpoint_id=request.model_endpoint_id,
            tool_registration_ids=request.tool_registration_ids,
        )
        agent_definition = await self.agent_repository.create_agent_definition(
            tenant_id=request.tenant_id,
            name=request.name,
            slug=request.slug,
            mode=request.mode,
            status=request.status,
            model_strategy=request.model_strategy,
            model_endpoint_id=request.model_endpoint_id,
            objective=request.objective,
            instructions=request.instructions,
            knowledge_base_scope=request.knowledge_base_scope,
            tools=list(request.tools),
            tool_registration_ids=[str(tool_registration_id) for tool_registration_id in request.tool_registration_ids],
        )
        return build_agent_definition_response(agent_definition)

    async def list_agent_definitions(
        self,
        *,
        tenant_id: UUID,
        status: str | None = None,
        mode: str | None = None,
        query: str | None = None,
    ) -> list[AgentDefinitionResponse]:
        agent_definitions = await self.agent_repository.list_agent_definitions(
            tenant_id=tenant_id,
            status=status,
            mode=mode,
            query=query,
        )
        return [build_agent_definition_response(agent_definition) for agent_definition in agent_definitions]

    async def update_agent_definition(
        self,
        *,
        agent_definition_id: UUID,
        tenant_id: UUID,
        request: AgentDefinitionUpdateRequest,
    ) -> AgentDefinitionResponse | None:
        await self._validate_governance_bindings(
            model_endpoint_id=request.model_endpoint_id,
            tool_registration_ids=request.tool_registration_ids,
        )
        agent_definition = await self.agent_repository.update_agent_definition(
            agent_definition_id=agent_definition_id,
            tenant_id=tenant_id,
            name=request.name,
            slug=request.slug,
            mode=request.mode,
            status=request.status,
            model_strategy=request.model_strategy,
            model_endpoint_id=request.model_endpoint_id,
            objective=request.objective,
            instructions=request.instructions,
            knowledge_base_scope=request.knowledge_base_scope,
            tools=list(request.tools),
            tool_registration_ids=[str(tool_registration_id) for tool_registration_id in request.tool_registration_ids],
        )
        if agent_definition is None:
            return None

        return build_agent_definition_response(agent_definition)

    async def delete_agent_definition(self, *, agent_definition_id: UUID, tenant_id: UUID) -> bool:
        return await self.agent_repository.delete_agent_definition(
            agent_definition_id=agent_definition_id,
            tenant_id=tenant_id,
        )

    async def get_agent_definition_metrics(self, *, tenant_id: UUID | None = None) -> AgentDefinitionMetricsResponse:
        agent_definitions = await self.agent_repository.list_agent_definitions_for_metrics(tenant_id=tenant_id)

        return AgentDefinitionMetricsResponse(
            total_agents=len(agent_definitions),
            active_agents=sum(1 for agent_definition in agent_definitions if agent_definition.agent_status == "active"),
            paused_agents=sum(1 for agent_definition in agent_definitions if agent_definition.agent_status == "paused"),
            draft_agents=sum(1 for agent_definition in agent_definitions if agent_definition.agent_status == "draft"),
            tool_enabled_agents=sum(
                1
                for agent_definition in agent_definitions
                if len(agent_definition.tool_bindings_json or []) > 0
                or len(agent_definition.tool_registration_ids_json or []) > 0
            ),
            scoped_agents=sum(
                1 for agent_definition in agent_definitions if (agent_definition.knowledge_base_scope or "").strip()
            ),
        )

    async def _validate_governance_bindings(
        self,
        *,
        model_endpoint_id: UUID | None,
        tool_registration_ids: list[UUID],
    ) -> None:
        if model_endpoint_id is not None:
            model_endpoint = await self.model_endpoint_repository.get_model_endpoint(
                model_endpoint_id=model_endpoint_id
            )
            if model_endpoint is None:
                raise ResourceNotFoundError("Model endpoint not found.")

        for tool_registration_id in set(tool_registration_ids):
            tool_registration = await self.tool_registration_repository.get_tool_registration(
                tool_registration_id=tool_registration_id
            )
            if tool_registration is None:
                raise ResourceNotFoundError("Tool registration not found.")


def build_agent_definition_response(agent_definition: AgentDefinition) -> AgentDefinitionResponse:
    return AgentDefinitionResponse(
        id=agent_definition.id,
        tenant_id=agent_definition.tenant_id,
        name=agent_definition.name,
        slug=agent_definition.slug,
        mode=agent_definition.agent_mode,
        status=agent_definition.agent_status,
        model_strategy=agent_definition.model_strategy,
        model_endpoint_id=agent_definition.model_endpoint_id,
        objective=agent_definition.objective,
        instructions=agent_definition.instructions,
        knowledge_base_scope=agent_definition.knowledge_base_scope,
        tools=list(agent_definition.tool_bindings_json or []),
        tool_registration_ids=[UUID(tool_registration_id) for tool_registration_id in list(agent_definition.tool_registration_ids_json or [])],
        created_at=agent_definition.created_at,
        updated_at=agent_definition.updated_at,
    )
