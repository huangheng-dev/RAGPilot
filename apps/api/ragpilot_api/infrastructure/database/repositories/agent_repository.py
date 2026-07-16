from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from ragpilot_api.application.errors import ResourceConflictError
from ragpilot_api.infrastructure.database.models import AgentDefinition


class AgentRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create_agent_definition(
        self,
        *,
        tenant_id: UUID,
        name: str,
        slug: str,
        mode: str,
        status: str,
        runtime_engine: str,
        runtime_version: str,
        model_strategy: str,
        model_endpoint_id: UUID | None,
        objective: str,
        instructions: str,
        knowledge_base_scope: str | None,
        tools: list[str],
        tool_registration_ids: list[str],
    ) -> AgentDefinition:
        agent_definition = AgentDefinition(
            tenant_id=tenant_id,
            name=name,
            slug=slug,
            agent_mode=mode,
            agent_status=status,
            runtime_engine=runtime_engine,
            runtime_version=runtime_version,
            model_strategy=model_strategy,
            model_endpoint_id=model_endpoint_id,
            objective=objective,
            instructions=instructions,
            knowledge_base_scope=knowledge_base_scope,
            tool_bindings_json=tools,
            tool_registration_ids_json=tool_registration_ids,
        )
        self.session.add(agent_definition)

        try:
            await self.session.commit()
        except IntegrityError as error:
            await self.session.rollback()
            raise ResourceConflictError("Agent slug already exists for this tenant.") from error

        await self.session.refresh(agent_definition)
        return agent_definition

    async def list_agent_definitions(
        self,
        *,
        tenant_id: UUID,
        status: str | None = None,
        mode: str | None = None,
        query: str | None = None,
    ) -> list[AgentDefinition]:
        statement = (
            select(AgentDefinition)
            .where(AgentDefinition.tenant_id == tenant_id, AgentDefinition.deleted_at.is_(None))
            .order_by(AgentDefinition.created_at.desc())
        )
        if status is not None:
            statement = statement.where(AgentDefinition.agent_status == status)
        if mode is not None:
            statement = statement.where(AgentDefinition.agent_mode == mode)
        if query is not None and query.strip():
            normalized_query = f"%{query.strip()}%"
            statement = statement.where(
                or_(
                    AgentDefinition.name.ilike(normalized_query),
                    AgentDefinition.slug.ilike(normalized_query),
                    AgentDefinition.objective.ilike(normalized_query),
                    AgentDefinition.instructions.ilike(normalized_query),
                    AgentDefinition.knowledge_base_scope.ilike(normalized_query),
                )
            )

        result = await self.session.scalars(statement)
        return list(result)

    async def list_agent_definitions_for_metrics(self, *, tenant_id: UUID | None = None) -> list[AgentDefinition]:
        statement = select(AgentDefinition).where(AgentDefinition.deleted_at.is_(None))
        if tenant_id is not None:
            statement = statement.where(AgentDefinition.tenant_id == tenant_id)

        result = await self.session.scalars(statement)
        return list(result)

    async def list_agent_definitions_for_governance(
        self,
        *,
        tenant_id: UUID | None = None,
        status: str | None = None,
        mode: str | None = None,
        query: str | None = None,
    ) -> list[AgentDefinition]:
        statement = select(AgentDefinition).where(AgentDefinition.deleted_at.is_(None)).order_by(
            AgentDefinition.created_at.desc()
        )
        if tenant_id is not None:
            statement = statement.where(AgentDefinition.tenant_id == tenant_id)
        if status is not None:
            statement = statement.where(AgentDefinition.agent_status == status)
        if mode is not None:
            statement = statement.where(AgentDefinition.agent_mode == mode)
        if query is not None and query.strip():
            normalized_query = f"%{query.strip()}%"
            statement = statement.where(
                or_(
                    AgentDefinition.name.ilike(normalized_query),
                    AgentDefinition.slug.ilike(normalized_query),
                    AgentDefinition.objective.ilike(normalized_query),
                    AgentDefinition.instructions.ilike(normalized_query),
                    AgentDefinition.knowledge_base_scope.ilike(normalized_query),
                )
            )

        result = await self.session.scalars(statement)
        return list(result)

    async def list_model_endpoint_binding_counts(self) -> dict[str, int]:
        model_counts, _tool_counts = await self._build_governance_binding_counts()
        return model_counts

    async def list_tool_registration_binding_counts(self) -> dict[str, int]:
        _model_counts, tool_counts = await self._build_governance_binding_counts()
        return tool_counts

    async def count_agents_using_model_endpoint(self, *, model_endpoint_id: UUID) -> int:
        model_counts = await self.list_model_endpoint_binding_counts()
        return model_counts.get(str(model_endpoint_id), 0)

    async def count_agents_using_tool_registration(self, *, tool_registration_id: UUID) -> int:
        tool_counts = await self.list_tool_registration_binding_counts()
        return tool_counts.get(str(tool_registration_id), 0)

    async def get_agent_definition(self, *, agent_definition_id: UUID, tenant_id: UUID) -> AgentDefinition | None:
        return await self.session.scalar(
            select(AgentDefinition).where(
                AgentDefinition.id == agent_definition_id,
                AgentDefinition.tenant_id == tenant_id,
                AgentDefinition.deleted_at.is_(None),
            )
        )

    async def update_agent_definition(
        self,
        *,
        agent_definition_id: UUID,
        tenant_id: UUID,
        name: str,
        slug: str,
        mode: str,
        status: str,
        runtime_engine: str,
        runtime_version: str,
        model_strategy: str,
        model_endpoint_id: UUID | None,
        objective: str,
        instructions: str,
        knowledge_base_scope: str | None,
        tools: list[str],
        tool_registration_ids: list[str],
    ) -> AgentDefinition | None:
        agent_definition = await self.get_agent_definition(
            agent_definition_id=agent_definition_id,
            tenant_id=tenant_id,
        )
        if agent_definition is None:
            return None

        agent_definition.name = name
        agent_definition.slug = slug
        agent_definition.agent_mode = mode
        agent_definition.agent_status = status
        agent_definition.runtime_engine = runtime_engine
        agent_definition.runtime_version = runtime_version
        agent_definition.model_strategy = model_strategy
        agent_definition.model_endpoint_id = model_endpoint_id
        agent_definition.objective = objective
        agent_definition.instructions = instructions
        agent_definition.knowledge_base_scope = knowledge_base_scope
        agent_definition.tool_bindings_json = tools
        agent_definition.tool_registration_ids_json = tool_registration_ids
        agent_definition.updated_at = datetime.now(timezone.utc)

        try:
            await self.session.commit()
        except IntegrityError as error:
            await self.session.rollback()
            raise ResourceConflictError("Agent slug already exists for this tenant.") from error

        await self.session.refresh(agent_definition)
        return agent_definition

    async def delete_agent_definition(self, *, agent_definition_id: UUID, tenant_id: UUID) -> bool:
        agent_definition = await self.get_agent_definition(
            agent_definition_id=agent_definition_id,
            tenant_id=tenant_id,
        )
        if agent_definition is None:
            return False

        now = datetime.now(timezone.utc)
        agent_definition.deleted_at = now
        agent_definition.updated_at = now
        await self.session.commit()
        return True

    async def _build_governance_binding_counts(self) -> tuple[dict[str, int], dict[str, int]]:
        result = await self.session.scalars(select(AgentDefinition).where(AgentDefinition.deleted_at.is_(None)))
        agent_definitions = list(result)
        model_counts: dict[str, int] = {}
        tool_counts: dict[str, int] = {}

        for agent_definition in agent_definitions:
            if agent_definition.model_endpoint_id is not None:
                model_key = str(agent_definition.model_endpoint_id)
                model_counts[model_key] = model_counts.get(model_key, 0) + 1

            for tool_registration_id in set(agent_definition.tool_registration_ids_json or []):
                tool_counts[tool_registration_id] = tool_counts.get(tool_registration_id, 0) + 1

        return model_counts, tool_counts
