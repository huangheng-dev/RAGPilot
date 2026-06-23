from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession

from ragpilot_api.application.workflows.workflow_service import WorkflowService
from ragpilot_api.application.errors import ResourceConflictError, ResourceNotFoundError
from ragpilot_api.contracts.http.workflow_contracts import (
    WorkflowRunActionResponse,
    WorkflowRunDetailResponse,
    WorkflowMetricsResponse,
    WorkflowRunResponse,
)
from ragpilot_api.infrastructure.database.repositories.document_repository import DocumentRepository
from ragpilot_api.infrastructure.database.repositories.role_permission_repository import RolePermissionRepository
from ragpilot_api.infrastructure.database.repositories.workflow_repository import WorkflowRepository
from ragpilot_api.infrastructure.database.session import get_database_session
from ragpilot_api.presentation.http.request_actor import (
    RequestActor,
    get_request_actor,
    require_actor_capability_from_policy,
)


router = APIRouter()


def build_workflow_service(session: AsyncSession) -> WorkflowService:
    return WorkflowService(
        WorkflowRepository(session),
        document_repository=DocumentRepository(session),
    )


@router.get("", response_model=list[WorkflowRunResponse])
async def list_workflow_runs(
    response: Response,
    tenant_id: UUID = Query(...),
    query: str | None = Query(default=None, min_length=1, max_length=240),
    status_filter: str | None = Query(default=None, alias="status"),
    workflow_type: str | None = Query(default=None),
    retry_mode: str | None = Query(default=None),
    subject_id: UUID | None = Query(default=None),
    sort_order: Literal[
        "updated-desc",
        "created-desc",
        "created-asc",
        "status-priority",
        "type-asc",
    ] = Query(default="created-desc", alias="sort"),
    limit: int = Query(default=100, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> list[WorkflowRunResponse]:
    await require_actor_capability_from_policy(
        actor,
        "access_operations",
        RolePermissionRepository(session),
    )
    workflow_runs, total_count = await build_workflow_service(session).list_workflow_runs(
        tenant_id=tenant_id,
        query=query,
        status_filter=status_filter,
        workflow_type=workflow_type,
        retry_mode=retry_mode,
        subject_id=subject_id,
        sort_order=sort_order,
        limit=limit,
        offset=offset,
    )
    response.headers["X-Total-Count"] = str(total_count)
    response.headers["X-Limit"] = str(limit)
    response.headers["X-Offset"] = str(offset)
    response.headers["X-Result-Count"] = str(len(workflow_runs))
    return workflow_runs


@router.get("/metrics", response_model=WorkflowMetricsResponse)
async def get_workflow_metrics(
    tenant_id: UUID = Query(...),
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> WorkflowMetricsResponse:
    await require_actor_capability_from_policy(
        actor,
        "access_operations",
        RolePermissionRepository(session),
    )
    return await build_workflow_service(session).get_workflow_metrics(tenant_id=tenant_id)


@router.get("/{workflow_run_id}", response_model=WorkflowRunDetailResponse)
async def get_workflow_run_detail(
    workflow_run_id: UUID,
    tenant_id: UUID = Query(...),
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> WorkflowRunDetailResponse:
    await require_actor_capability_from_policy(
        actor,
        "access_operations",
        RolePermissionRepository(session),
    )
    detail = await build_workflow_service(session).get_workflow_run_detail(
        workflow_run_id=workflow_run_id,
        tenant_id=tenant_id,
    )
    if detail is None:
        raise HTTPException(status_code=404, detail="Workflow run not found.")
    return detail


@router.post("/{workflow_run_id}/retry", response_model=WorkflowRunActionResponse)
async def retry_workflow_run(
    workflow_run_id: UUID,
    tenant_id: UUID = Query(...),
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> WorkflowRunActionResponse:
    await require_actor_capability_from_policy(
        actor,
        "retry_workflow_runs",
        RolePermissionRepository(session),
    )
    try:
        return await build_workflow_service(session).retry_workflow_run(
            workflow_run_id=workflow_run_id,
            tenant_id=tenant_id,
        )
    except ResourceNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except ResourceConflictError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
