from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from ragpilot_api.application.documents.data_source_service import DataSourceService
from ragpilot_api.application.errors import ResourceConflictError, ResourceNotFoundError
from ragpilot_api.contracts.http.data_source_contracts import DataSourceCreateRequest, DataSourceResponse, DataSourceSyncRequest, DataSourceSyncRunResponse
from ragpilot_api.infrastructure.database.repositories.data_source_repository import DataSourceRepository
from ragpilot_api.infrastructure.database.repositories.knowledge_base_repository import KnowledgeBaseRepository
from ragpilot_api.infrastructure.database.repositories.role_permission_repository import RolePermissionRepository
from ragpilot_api.infrastructure.database.session import get_database_session
from ragpilot_api.infrastructure.workflows.temporal_client import TemporalWorkflowClient
from ragpilot_api.shared.settings import get_settings
from ragpilot_api.presentation.http.request_actor import (
    RequestActor, get_request_actor, require_actor_capability_from_policy,
    require_actor_knowledge_base_access, require_actor_tenant_access, require_authenticated_actor,
)


router = APIRouter()


@router.post("/{data_source_id}/sync", response_model=DataSourceSyncRunResponse, status_code=status.HTTP_202_ACCEPTED)
async def start_data_source_sync(
    data_source_id: UUID,
    request: DataSourceSyncRequest,
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> DataSourceSyncRunResponse:
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(actor, "manage_documents", RolePermissionRepository(session))
    require_actor_tenant_access(actor, request.tenant_id)
    try:
        return await DataSourceService(DataSourceRepository(session)).start_sync(
            data_source_id=data_source_id,
            tenant_id=request.tenant_id,
            workflow_client=TemporalWorkflowClient(get_settings()),
        )
    except ResourceNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except ResourceConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error


@router.post("", response_model=DataSourceResponse, status_code=status.HTTP_201_CREATED)
async def create_data_source(
    request: DataSourceCreateRequest,
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> DataSourceResponse:
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(actor, "manage_documents", RolePermissionRepository(session))
    resolved_tenant = await require_actor_knowledge_base_access(actor, request.knowledge_base_id, KnowledgeBaseRepository(session))
    if resolved_tenant is not None:
        require_actor_tenant_access(actor, request.tenant_id)
    return await DataSourceService(DataSourceRepository(session)).create(request)


@router.get("", response_model=list[DataSourceResponse])
async def list_data_sources(
    knowledge_base_id: UUID = Query(...),
    include_deleted: bool = Query(False),
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> list[DataSourceResponse]:
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(actor, "access_documents", RolePermissionRepository(session))
    await require_actor_knowledge_base_access(actor, knowledge_base_id, KnowledgeBaseRepository(session))
    return await DataSourceService(DataSourceRepository(session)).list(
        knowledge_base_id=knowledge_base_id, include_deleted=include_deleted,
    )


@router.get("/{data_source_id}/sync-runs", response_model=list[DataSourceSyncRunResponse])
async def list_data_source_sync_runs(
    data_source_id: UUID,
    tenant_id: UUID = Query(...),
    limit: int = Query(50, ge=1, le=200),
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> list[DataSourceSyncRunResponse]:
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(actor, "access_documents", RolePermissionRepository(session))
    require_actor_tenant_access(actor, tenant_id)
    return await DataSourceService(DataSourceRepository(session)).list_runs(
        data_source_id=data_source_id, tenant_id=tenant_id, limit=limit,
    )
