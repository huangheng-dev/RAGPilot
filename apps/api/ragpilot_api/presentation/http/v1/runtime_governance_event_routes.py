from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ragpilot_api.application.runtime_governance.runtime_governance_event_service import RuntimeGovernanceEventService
from ragpilot_api.application.runtime_governance.runtime_governance_overview_service import RuntimeGovernanceOverviewService
from ragpilot_api.application.runtime_governance.runtime_governance_worklist_service import RuntimeGovernanceWorklistService
from ragpilot_api.application.mcp_connectors.mcp_connector_registry_service import McpConnectorRegistryService
from ragpilot_api.application.model_registry.model_registry_service import ModelRegistryService
from ragpilot_api.application.tool_registry.tool_registry_service import ToolRegistryService
from ragpilot_api.contracts.http.runtime_governance_event_contracts import (
    RuntimeGovernanceEventResponse,
    RuntimeGovernanceOverviewResponse,
    RuntimeGovernanceWorklistResponse,
)
from ragpilot_api.infrastructure.database.repositories.agent_repository import AgentRepository
from ragpilot_api.infrastructure.database.repositories.mcp_connector_repository import McpConnectorRepository
from ragpilot_api.infrastructure.database.repositories.model_endpoint_repository import ModelEndpointRepository
from ragpilot_api.infrastructure.database.repositories.role_permission_repository import RolePermissionRepository
from ragpilot_api.infrastructure.database.repositories.runtime_governance_event_repository import (
    RuntimeGovernanceEventRepository,
)
from ragpilot_api.infrastructure.database.repositories.tool_registration_repository import ToolRegistrationRepository
from ragpilot_api.infrastructure.database.session import get_database_session
from ragpilot_api.presentation.http.request_actor import (
    RequestActor,
    get_request_actor,
    require_actor_capability_from_policy,
    require_authenticated_actor,
    require_platform_wide_actor_scope,
)
from ragpilot_api.shared.settings import get_settings


router = APIRouter()


def build_runtime_governance_event_service(session: AsyncSession) -> RuntimeGovernanceEventService:
    return RuntimeGovernanceEventService(RuntimeGovernanceEventRepository(session))


def build_runtime_governance_worklist_service(session: AsyncSession) -> RuntimeGovernanceWorklistService:
    return RuntimeGovernanceWorklistService(
        ModelRegistryService(
            ModelEndpointRepository(session),
            AgentRepository(session),
            get_settings(),
        ),
        ToolRegistryService(
            ToolRegistrationRepository(session),
            AgentRepository(session),
            McpConnectorRepository(session),
        ),
        McpConnectorRegistryService(
            McpConnectorRepository(session),
            ToolRegistrationRepository(session),
        ),
    )


def build_runtime_governance_overview_service(session: AsyncSession) -> RuntimeGovernanceOverviewService:
    model_registry_service = ModelRegistryService(
        ModelEndpointRepository(session),
        AgentRepository(session),
        get_settings(),
    )
    tool_registry_service = ToolRegistryService(
        ToolRegistrationRepository(session),
        AgentRepository(session),
        McpConnectorRepository(session),
    )
    mcp_connector_registry_service = McpConnectorRegistryService(
        McpConnectorRepository(session),
        ToolRegistrationRepository(session),
    )
    return RuntimeGovernanceOverviewService(
        model_registry_service,
        tool_registry_service,
        mcp_connector_registry_service,
        build_runtime_governance_event_service(session),
        RuntimeGovernanceWorklistService(
            model_registry_service,
            tool_registry_service,
            mcp_connector_registry_service,
        ),
    )


@router.get("/events", response_model=list[RuntimeGovernanceEventResponse])
async def list_runtime_governance_events(
    resource_type: str | None = Query(
        default=None,
        pattern=r"^(model_endpoint|tool_registration|mcp_connector|retrieval_profile)$",
    ),
    action_type: str | None = Query(default=None, min_length=2, max_length=80),
    actor_role: str | None = Query(default=None, pattern=r"^(super_admin|operator|reviewer)$"),
    query: str | None = Query(default=None, min_length=1, max_length=120),
    limit: int = Query(default=12, ge=1, le=100),
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> list[RuntimeGovernanceEventResponse]:
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(actor, "review_runtime_governance", RolePermissionRepository(session))
    require_platform_wide_actor_scope(
        actor,
        detail="Runtime governance review requires platform-wide access.",
    )
    return await build_runtime_governance_event_service(session).list_runtime_governance_events(
        resource_type=resource_type,
        action_type=action_type,
        actor_role=actor_role,
        query=query,
        limit=limit,
    )


@router.get("/overview", response_model=RuntimeGovernanceOverviewResponse)
async def get_runtime_governance_overview(
    worklist_limit: int = Query(default=24, ge=1, le=50),
    recent_event_limit: int = Query(default=6, ge=1, le=20),
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> RuntimeGovernanceOverviewResponse:
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(actor, "review_runtime_governance", RolePermissionRepository(session))
    require_platform_wide_actor_scope(
        actor,
        detail="Runtime governance review requires platform-wide access.",
    )
    return await build_runtime_governance_overview_service(session).get_runtime_governance_overview(
        worklist_limit=worklist_limit,
        recent_event_limit=recent_event_limit,
    )


@router.get("/worklist", response_model=RuntimeGovernanceWorklistResponse)
async def get_runtime_governance_worklist(
    limit: int = Query(default=12, ge=1, le=50),
    category: str | None = Query(
        default=None,
        pattern=r"^(approval_required_tool|mcp_integration_pending_tool|integration_blocked_connector|unconfigured_model_endpoint|disabled_bound_model_endpoint)$",
    ),
    severity: str | None = Query(default=None, pattern=r"^(review|attention)$"),
    resource_type: str | None = Query(default=None, pattern=r"^(model_endpoint|tool_registration|mcp_connector)$"),
    query: str | None = Query(default=None, min_length=1, max_length=120),
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> RuntimeGovernanceWorklistResponse:
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(actor, "review_runtime_governance", RolePermissionRepository(session))
    require_platform_wide_actor_scope(
        actor,
        detail="Runtime governance review requires platform-wide access.",
    )
    return await build_runtime_governance_worklist_service(session).get_runtime_governance_worklist(
        limit=limit,
        category=category,
        severity=severity,
        resource_type=resource_type,
        query=query,
    )
