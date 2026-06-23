from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from ragpilot_api.application.errors import ResourceConflictError
from ragpilot_api.application.workspaces.workspace_service import WorkspaceService
from ragpilot_api.contracts.http.workspace_contracts import (
    WorkspaceCreateRequest,
    WorkspaceLifecycleRequest,
    WorkspaceResponse,
    WorkspaceUpdateRequest,
)
from ragpilot_api.infrastructure.database.repositories.role_permission_repository import RolePermissionRepository
from ragpilot_api.infrastructure.database.repositories.workspace_repository import WorkspaceRepository
from ragpilot_api.infrastructure.database.session import get_database_session
from ragpilot_api.presentation.http.request_actor import (
    RequestActor,
    get_request_actor,
    require_actor_capability,
    require_actor_capability_from_policy,
)


router = APIRouter()


def build_workspace_service(session: AsyncSession) -> WorkspaceService:
    return WorkspaceService(WorkspaceRepository(session))


@router.post("", response_model=WorkspaceResponse, status_code=status.HTTP_201_CREATED)
async def create_workspace(
    request: WorkspaceCreateRequest,
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> WorkspaceResponse:
    await require_actor_capability_from_policy(actor, "manage_admin_resources", RolePermissionRepository(session))
    try:
        return await build_workspace_service(session).create_workspace(request)
    except ResourceConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error


@router.get("", response_model=list[WorkspaceResponse])
async def list_workspaces(
    tenant_id: UUID = Query(...),
    is_archived: bool | None = Query(default=None),
    session: AsyncSession = Depends(get_database_session),
) -> list[WorkspaceResponse]:
    return await build_workspace_service(session).list_workspaces(
        tenant_id=tenant_id,
        is_archived=is_archived,
    )


@router.patch("/{workspace_id}", response_model=WorkspaceResponse)
async def update_workspace(
    workspace_id: UUID,
    request: WorkspaceUpdateRequest,
    tenant_id: UUID = Query(...),
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> WorkspaceResponse:
    await require_actor_capability_from_policy(actor, "manage_admin_resources", RolePermissionRepository(session))
    try:
        workspace = await build_workspace_service(session).update_workspace(
            workspace_id=workspace_id,
            tenant_id=tenant_id,
            request=request,
        )
    except ResourceConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error

    if workspace is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found.")

    return workspace


@router.post("/{workspace_id}/lifecycle", response_model=WorkspaceResponse)
async def set_workspace_lifecycle(
    workspace_id: UUID,
    request: WorkspaceLifecycleRequest,
    tenant_id: UUID = Query(...),
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> WorkspaceResponse:
    await require_actor_capability_from_policy(actor, "manage_admin_resources", RolePermissionRepository(session))
    workspace = await build_workspace_service(session).set_workspace_archive_state(
        workspace_id=workspace_id,
        tenant_id=tenant_id,
        request=request,
    )

    if workspace is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found.")

    return workspace
