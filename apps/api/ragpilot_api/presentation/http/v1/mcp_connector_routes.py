from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from ragpilot_api.application.errors import ResourceConflictError, ResourceNotFoundError
from ragpilot_api.application.mcp_connectors.mcp_connector_registry_service import McpConnectorRegistryService
from ragpilot_api.contracts.http.mcp_connector_contracts import (
    McpConnectorCreateRequest,
    McpConnectorGovernanceSummaryResponse,
    McpConnectorPreviewResponse,
    McpConnectorResponse,
    McpConnectorUpdateRequest,
)
from ragpilot_api.infrastructure.database.repositories.role_permission_repository import RolePermissionRepository
from ragpilot_api.infrastructure.database.repositories.mcp_connector_repository import McpConnectorRepository
from ragpilot_api.infrastructure.database.repositories.tool_registration_repository import ToolRegistrationRepository
from ragpilot_api.infrastructure.database.session import get_database_session
from ragpilot_api.presentation.http.request_actor import (
    RequestActor,
    get_request_actor,
    require_actor_capability_from_policy,
)


router = APIRouter()


def build_mcp_connector_registry_service(session: AsyncSession) -> McpConnectorRegistryService:
    return McpConnectorRegistryService(
        McpConnectorRepository(session),
        ToolRegistrationRepository(session),
    )


@router.post("", response_model=McpConnectorResponse, status_code=status.HTTP_201_CREATED)
async def create_mcp_connector(
    request: McpConnectorCreateRequest,
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> McpConnectorResponse:
    await require_actor_capability_from_policy(actor, "manage_runtime_governance", RolePermissionRepository(session))
    try:
        return await build_mcp_connector_registry_service(session).create_mcp_connector(request)
    except ResourceConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error


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
    await require_actor_capability_from_policy(actor, "review_runtime_governance", RolePermissionRepository(session))
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
    await require_actor_capability_from_policy(actor, "review_runtime_governance", RolePermissionRepository(session))
    return await build_mcp_connector_registry_service(session).get_mcp_connector_governance_summary()


@router.post("/{mcp_connector_id}/preview", response_model=McpConnectorPreviewResponse)
async def preview_mcp_connector(
    mcp_connector_id: UUID,
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> McpConnectorPreviewResponse:
    await require_actor_capability_from_policy(actor, "review_runtime_governance", RolePermissionRepository(session))
    try:
        return await build_mcp_connector_registry_service(session).preview_mcp_connector(mcp_connector_id=mcp_connector_id)
    except ResourceNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error


@router.patch("/{mcp_connector_id}", response_model=McpConnectorResponse)
async def update_mcp_connector(
    mcp_connector_id: UUID,
    request: McpConnectorUpdateRequest,
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> McpConnectorResponse:
    await require_actor_capability_from_policy(actor, "manage_runtime_governance", RolePermissionRepository(session))
    try:
        response = await build_mcp_connector_registry_service(session).update_mcp_connector(
            mcp_connector_id=mcp_connector_id,
            request=request,
        )
    except ResourceConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    if response is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="MCP connector not found.")
    return response


@router.delete("/{mcp_connector_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_mcp_connector(
    mcp_connector_id: UUID,
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> None:
    await require_actor_capability_from_policy(actor, "manage_runtime_governance", RolePermissionRepository(session))
    try:
        deleted = await build_mcp_connector_registry_service(session).delete_mcp_connector(
            mcp_connector_id=mcp_connector_id
        )
    except ResourceConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="MCP connector not found.")
