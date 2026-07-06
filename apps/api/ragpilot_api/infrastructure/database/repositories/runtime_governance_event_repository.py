from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import String, cast, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ragpilot_api.infrastructure.database.models import RuntimeGovernanceEvent


class RuntimeGovernanceEventRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create_runtime_governance_event(
        self,
        *,
        actor_user_id: UUID | None,
        actor_role: str | None,
        resource_type: str,
        resource_id: UUID | None,
        resource_name: str | None,
        resource_slug: str | None,
        action_type: str,
        detail_json: dict[str, object],
    ) -> RuntimeGovernanceEvent:
        runtime_governance_event = RuntimeGovernanceEvent(
            actor_user_id=actor_user_id,
            actor_role=actor_role,
            resource_type=resource_type,
            resource_id=resource_id,
            resource_name=resource_name,
            resource_slug=resource_slug,
            action_type=action_type,
            detail_json=detail_json,
        )
        self.session.add(runtime_governance_event)
        await self.session.commit()
        await self.session.refresh(runtime_governance_event)
        return runtime_governance_event

    async def list_runtime_governance_events(
        self,
        *,
        resource_type: str | None = None,
        resource_id: UUID | None = None,
        action_type: str | None = None,
        action_types: list[str] | None = None,
        actor_role: str | None = None,
        query: str | None = None,
        created_after: datetime | None = None,
        limit: int = 20,
    ) -> list[RuntimeGovernanceEvent]:
        statement = select(RuntimeGovernanceEvent).order_by(RuntimeGovernanceEvent.created_at.desc())
        if resource_type is not None:
            statement = statement.where(RuntimeGovernanceEvent.resource_type == resource_type)
        if resource_id is not None:
            statement = statement.where(RuntimeGovernanceEvent.resource_id == resource_id)
        if action_type is not None:
            statement = statement.where(RuntimeGovernanceEvent.action_type == action_type)
        if action_types:
            statement = statement.where(RuntimeGovernanceEvent.action_type.in_(action_types))
        if actor_role is not None:
            statement = statement.where(RuntimeGovernanceEvent.actor_role == actor_role)
        if created_after is not None:
            statement = statement.where(RuntimeGovernanceEvent.created_at >= created_after)
        if query is not None and query.strip():
            normalized_query = f"%{query.strip()}%"
            statement = statement.where(
                or_(
                    RuntimeGovernanceEvent.resource_name.ilike(normalized_query),
                    RuntimeGovernanceEvent.resource_slug.ilike(normalized_query),
                    RuntimeGovernanceEvent.action_type.ilike(normalized_query),
                    RuntimeGovernanceEvent.actor_role.ilike(normalized_query),
                    cast(RuntimeGovernanceEvent.detail_json, String).ilike(normalized_query),
                )
            )
        statement = statement.limit(limit)
        result = await self.session.scalars(statement)
        return list(result)
