from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from ragpilot_api.application.errors import ResourceConflictError, ResourceNotFoundError
from ragpilot_api.application.mcp_connectors.mcp_connector_registry_service import McpConnectorRegistryService
from ragpilot_api.application.runtime_governance.runtime_governance_event_service import RuntimeGovernanceEventService
from ragpilot_api.contracts.http.mcp_connector_contracts import (
    McpConnectorCreateRequest,
    McpConnectorGovernanceActionRequest,
    McpConnectorGovernanceActionResponse,
    McpConnectorPreviewResponse,
    McpConnectorResponse,
    McpConnectorUpdateRequest,
    McpConnectorGovernanceSummaryResponse,
    McpRemoteToolCatalogResponse,
)
from ragpilot_api.infrastructure.database.repositories.mcp_connector_repository import McpConnectorRepository
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


router = APIRouter()


def build_mcp_connector_registry_service(session: AsyncSession) -> McpConnectorRegistryService:
    return McpConnectorRegistryService(
        McpConnectorRepository(session),
        ToolRegistrationRepository(session),
        RuntimeGovernanceEventRepository(session),
    )

def build_runtime_governance_event_service(session: AsyncSession) -> RuntimeGovernanceEventService:
    return RuntimeGovernanceEventService(RuntimeGovernanceEventRepository(session))


def read_response_field(payload: object, field_name: str):
    if isinstance(payload, dict):
        return payload.get(field_name)
    return getattr(payload, field_name, None)


@router.post("", response_model=McpConnectorResponse, status_code=status.HTTP_201_CREATED)
async def create_mcp_connector(
    request: McpConnectorCreateRequest,
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> McpConnectorResponse:
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(actor, "manage_runtime_governance", RolePermissionRepository(session))
    require_platform_wide_actor_scope(actor, detail="Platform MCP governance requires platform-wide access.")
    try:
        response = await build_mcp_connector_registry_service(session).create_mcp_connector(request)
    except ResourceConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    await build_runtime_governance_event_service(session).create_runtime_governance_event(
        actor_user_id=actor.user_id,
        actor_role=actor.role,
        resource_type="mcp_connector",
        resource_id=read_response_field(response, "id"),
        resource_name=read_response_field(response, "name"),
        resource_slug=read_response_field(response, "slug"),
        action_type="created",
        detail={
            "connector_type": request.connector_type,
            "auth_mode": request.auth_mode,
            "is_enabled": request.is_enabled,
            "base_url": request.base_url,
        },
    )
    return response


@router.get("", response_model=list[McpConnectorResponse])
async def list_mcp_connectors(
    connector_type: str | None = Query(default=None, pattern=r"^(streamable_http|sse|managed_reserved)$"),
    is_enabled: bool | None = Query(default=None),
    runtime_state: str | None = Query(
        default=None,
        pattern=r"^(disabled|missing_base_url|missing_credential_hint|managed_reserved|referenced|runtime_ready)$",
    ),
    query: str | None = Query(default=None, min_length=1, max_length=160),
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> list[McpConnectorResponse]:
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(actor, "review_runtime_governance", RolePermissionRepository(session))
    require_platform_wide_actor_scope(actor, detail="Platform MCP governance requires platform-wide access.")
    return await build_mcp_connector_registry_service(session).list_mcp_connectors(
        connector_type=connector_type,
        is_enabled=is_enabled,
        runtime_state=runtime_state,
        query=query,
    )


@router.get("/governance-summary", response_model=McpConnectorGovernanceSummaryResponse)
async def get_mcp_connector_governance_summary(
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> McpConnectorGovernanceSummaryResponse:
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(actor, "review_runtime_governance", RolePermissionRepository(session))
    require_platform_wide_actor_scope(actor, detail="Platform MCP governance requires platform-wide access.")
    return await build_mcp_connector_registry_service(session).get_mcp_connector_governance_summary()


@router.post("/{mcp_connector_id}/preview", response_model=McpConnectorPreviewResponse)
async def preview_mcp_connector(
    mcp_connector_id: UUID,
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> McpConnectorPreviewResponse:
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(actor, "review_runtime_governance", RolePermissionRepository(session))
    require_platform_wide_actor_scope(actor, detail="Platform MCP governance requires platform-wide access.")
    try:
        response = await build_mcp_connector_registry_service(session).preview_mcp_connector(
            mcp_connector_id=mcp_connector_id
        )
    except ResourceNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    await build_runtime_governance_event_service(session).create_runtime_governance_event(
        actor_user_id=actor.user_id,
        actor_role=actor.role,
        resource_type="mcp_connector",
        resource_id=read_response_field(response, "mcp_connector_id"),
        resource_name=read_response_field(response, "name"),
        resource_slug=read_response_field(response, "slug"),
        action_type=f"preview_{read_response_field(response, 'preview_status')}",
        detail={
            "connector_type": read_response_field(response, "connector_type"),
            "preview_status": read_response_field(response, "preview_status"),
            "summary": read_response_field(response, "summary"),
            "error_message": read_response_field(response, "error_message"),
            "request_metadata": read_response_field(response, "request_metadata"),
            "response_metadata": read_response_field(response, "response_metadata"),
        },
    )
    return response


@router.patch("/{mcp_connector_id}", response_model=McpConnectorResponse)
async def update_mcp_connector(
    mcp_connector_id: UUID,
    request: McpConnectorUpdateRequest,
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> McpConnectorResponse:
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(actor, "manage_runtime_governance", RolePermissionRepository(session))
    require_platform_wide_actor_scope(actor, detail="Platform MCP governance requires platform-wide access.")
    try:
        response = await build_mcp_connector_registry_service(session).update_mcp_connector(
            mcp_connector_id=mcp_connector_id,
            request=request,
        )
    except ResourceConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    if response is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="MCP connector not found.")
    await build_runtime_governance_event_service(session).create_runtime_governance_event(
        actor_user_id=actor.user_id,
        actor_role=actor.role,
        resource_type="mcp_connector",
        resource_id=read_response_field(response, "id"),
        resource_name=read_response_field(response, "name"),
        resource_slug=read_response_field(response, "slug"),
        action_type="updated",
        detail={
            "connector_type": request.connector_type,
            "auth_mode": request.auth_mode,
            "is_enabled": request.is_enabled,
            "base_url": request.base_url,
        },
    )
    return response


@router.post("/{mcp_connector_id}/governance-action", response_model=McpConnectorGovernanceActionResponse)
async def apply_mcp_connector_governance_action(
    mcp_connector_id: UUID,
    request: McpConnectorGovernanceActionRequest,
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> McpConnectorGovernanceActionResponse:
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(actor, "manage_runtime_governance", RolePermissionRepository(session))
    require_platform_wide_actor_scope(actor, detail="Platform MCP governance requires platform-wide access.")
    try:
        response = await build_mcp_connector_registry_service(session).apply_mcp_connector_governance_action(
            mcp_connector_id=mcp_connector_id,
            action_type=request.action_type,
        )
    except ResourceConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    if response is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="MCP connector not found.")
    await build_runtime_governance_event_service(session).create_runtime_governance_event(
        actor_user_id=actor.user_id,
        actor_role=actor.role,
        resource_type="mcp_connector",
        resource_id=read_response_field(read_response_field(response, "mcp_connector"), "id"),
        resource_name=read_response_field(read_response_field(response, "mcp_connector"), "name"),
        resource_slug=read_response_field(read_response_field(response, "mcp_connector"), "slug"),
        action_type=request.action_type,
        detail={
            "summary": read_response_field(response, "summary"),
            "connector_type": read_response_field(read_response_field(response, "mcp_connector"), "connector_type"),
            "auth_mode": read_response_field(read_response_field(response, "mcp_connector"), "auth_mode"),
            "is_enabled": read_response_field(read_response_field(response, "mcp_connector"), "is_enabled"),
            "base_url": read_response_field(read_response_field(response, "mcp_connector"), "base_url"),
        },
    )
    return response


@router.delete("/{mcp_connector_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_mcp_connector(
    mcp_connector_id: UUID,
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> None:
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(actor, "manage_runtime_governance", RolePermissionRepository(session))
    require_platform_wide_actor_scope(actor, detail="Platform MCP governance requires platform-wide access.")
    existing_mcp_connector = await McpConnectorRepository(session).get_mcp_connector(mcp_connector_id=mcp_connector_id)
    if existing_mcp_connector is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="MCP connector not found.")
    try:
        deleted = await build_mcp_connector_registry_service(session).delete_mcp_connector(
            mcp_connector_id=mcp_connector_id
        )
    except ResourceConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="MCP connector not found.")
    await build_runtime_governance_event_service(session).create_runtime_governance_event(
        actor_user_id=actor.user_id,
        actor_role=actor.role,
        resource_type="mcp_connector",
        resource_id=existing_mcp_connector.id,
        resource_name=existing_mcp_connector.name,
        resource_slug=existing_mcp_connector.slug,
        action_type="deleted",
        detail={
            "connector_type": existing_mcp_connector.connector_type,
            "auth_mode": existing_mcp_connector.auth_mode,
            "was_enabled": existing_mcp_connector.is_enabled,
            "base_url": existing_mcp_connector.base_url,
        },
    )
@router.get("/{mcp_connector_id}/tools", response_model=McpRemoteToolCatalogResponse)
async def list_mcp_connector_tools(
    mcp_connector_id: UUID,
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> McpRemoteToolCatalogResponse:
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(actor, "review_runtime_governance", RolePermissionRepository(session))
    require_platform_wide_actor_scope(actor, detail="Platform MCP governance requires platform-wide access.")
    try:
        return await build_mcp_connector_registry_service(session).list_remote_tools(
            mcp_connector_id=mcp_connector_id,
        )
    except ResourceNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except ResourceConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
