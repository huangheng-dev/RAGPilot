from __future__ import annotations

from uuid import UUID

from ragpilot_api.contracts.http.runtime_governance_event_contracts import RuntimeGovernanceEventResponse
from ragpilot_api.application.runtime_governance.runtime_governance_follow_up import (
    build_runtime_governance_event_follow_up,
)
from ragpilot_api.infrastructure.database.repositories.runtime_governance_event_repository import (
    RuntimeGovernanceEventRepository,
)


class RuntimeGovernanceEventService:
    def __init__(self, runtime_governance_event_repository: RuntimeGovernanceEventRepository) -> None:
        self.runtime_governance_event_repository = runtime_governance_event_repository

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
        detail: dict[str, object] | None = None,
    ) -> RuntimeGovernanceEventResponse:
        runtime_governance_event = await self.runtime_governance_event_repository.create_runtime_governance_event(
            actor_user_id=actor_user_id,
            actor_role=actor_role,
            resource_type=resource_type,
            resource_id=resource_id,
            resource_name=resource_name,
            resource_slug=resource_slug,
            action_type=action_type,
            detail_json=detail or {},
        )
        response = RuntimeGovernanceEventResponse.model_validate(runtime_governance_event)
        response.follow_up = build_runtime_governance_event_follow_up(response)
        return response

    async def list_runtime_governance_events(
        self,
        *,
        resource_type: str | None = None,
        resource_id: UUID | None = None,
        action_type: str | None = None,
        actor_role: str | None = None,
        query: str | None = None,
        limit: int = 20,
    ) -> list[RuntimeGovernanceEventResponse]:
        runtime_governance_events = await self.runtime_governance_event_repository.list_runtime_governance_events(
            resource_type=resource_type,
            resource_id=resource_id,
            action_type=action_type,
            actor_role=actor_role,
            query=query,
            limit=limit,
        )
        responses = [
            RuntimeGovernanceEventResponse.model_validate(runtime_governance_event)
            for runtime_governance_event in runtime_governance_events
        ]
        for response in responses:
            response.follow_up = build_runtime_governance_event_follow_up(response)
        return responses
