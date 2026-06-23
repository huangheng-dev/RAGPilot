from uuid import UUID

from ragpilot_api.contracts.http.workspace_contracts import (
    WorkspaceCreateRequest,
    WorkspaceLifecycleRequest,
    WorkspaceResponse,
    WorkspaceUpdateRequest,
)
from ragpilot_api.infrastructure.database.models import Workspace
from ragpilot_api.infrastructure.database.repositories.workspace_repository import WorkspaceRepository


class WorkspaceService:
    def __init__(self, workspace_repository: WorkspaceRepository) -> None:
        self.workspace_repository = workspace_repository

    async def create_workspace(self, request: WorkspaceCreateRequest) -> WorkspaceResponse:
        workspace = await self.workspace_repository.create_workspace(
            tenant_id=request.tenant_id,
            name=request.name,
            slug=request.slug,
            description=request.description,
        )
        return build_workspace_response(workspace)

    async def list_workspaces(
        self,
        tenant_id: UUID,
        *,
        is_archived: bool | None = None,
    ) -> list[WorkspaceResponse]:
        workspaces = await self.workspace_repository.list_workspaces_with_filters(
            tenant_id=tenant_id,
            is_archived=is_archived,
        )
        return [build_workspace_response(workspace) for workspace in workspaces]

    async def update_workspace(
        self,
        *,
        workspace_id: UUID,
        tenant_id: UUID,
        request: WorkspaceUpdateRequest,
    ) -> WorkspaceResponse | None:
        workspace = await self.workspace_repository.update_workspace(
            workspace_id=workspace_id,
            tenant_id=tenant_id,
            name=request.name,
            slug=request.slug,
            description=request.description,
        )
        if workspace is None:
            return None
        return build_workspace_response(workspace)

    async def set_workspace_archive_state(
        self,
        *,
        workspace_id: UUID,
        tenant_id: UUID,
        request: WorkspaceLifecycleRequest,
    ) -> WorkspaceResponse | None:
        workspace = await self.workspace_repository.set_workspace_archive_state(
            workspace_id=workspace_id,
            tenant_id=tenant_id,
            is_archived=request.is_archived,
        )
        if workspace is None:
            return None
        return build_workspace_response(workspace)


def build_workspace_response(workspace: Workspace) -> WorkspaceResponse:
    return WorkspaceResponse(
        id=workspace.id,
        tenant_id=workspace.tenant_id,
        name=workspace.name,
        slug=workspace.slug,
        description=workspace.description,
        is_archived=workspace.is_archived,
        created_at=workspace.created_at,
        updated_at=workspace.updated_at,
    )
