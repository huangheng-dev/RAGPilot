from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession

from ragpilot_api.application.workflows.workflow_service import WorkflowService
from ragpilot_api.application.errors import ResourceConflictError, ResourceNotFoundError
from ragpilot_api.contracts.http.workflow_contracts import (
    WorkflowRunActionResponse,
    WorkflowRunDetailResponse,
    WorkflowRunEventResponse,
    WorkflowMetricsResponse,
    WorkflowRunNotesUpdateRequest,
    WorkflowRunResponse,
    WorkflowStepResponse,
)
from ragpilot_api.infrastructure.database.repositories.document_repository import DocumentRepository
from ragpilot_api.infrastructure.database.repositories.role_permission_repository import RolePermissionRepository
from ragpilot_api.infrastructure.database.repositories.workflow_event_repository import WorkflowEventRepository
from ragpilot_api.infrastructure.database.repositories.workflow_repository import WorkflowRepository
from ragpilot_api.infrastructure.database.session import get_database_session
from ragpilot_api.presentation.http.request_actor import (
    RequestActor,
    get_request_actor,
    require_actor_capability_from_policy,
    require_authenticated_actor,
    require_actor_tenant_access,
)


router = APIRouter()


def build_workflow_service(session: AsyncSession) -> WorkflowService:
    return WorkflowService(
        WorkflowRepository(session),
        document_repository=DocumentRepository(session),
        workflow_event_repository=WorkflowEventRepository(session),
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
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(
        actor,
        "access_operations",
        RolePermissionRepository(session),
    )
    require_actor_tenant_access(actor, tenant_id)
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
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(
        actor,
        "access_operations",
        RolePermissionRepository(session),
    )
    require_actor_tenant_access(actor, tenant_id)
    return await build_workflow_service(session).get_workflow_metrics(tenant_id=tenant_id)


@router.get("/{workflow_run_id}", response_model=WorkflowRunDetailResponse)
async def get_workflow_run_detail(
    workflow_run_id: UUID,
    tenant_id: UUID = Query(...),
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> WorkflowRunDetailResponse:
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(
        actor,
        "access_operations",
        RolePermissionRepository(session),
    )
    require_actor_tenant_access(actor, tenant_id)
    detail = await build_workflow_service(session).get_workflow_run_detail(
        workflow_run_id=workflow_run_id,
        tenant_id=tenant_id,
    )
    if detail is None:
        raise HTTPException(status_code=404, detail="Workflow run not found.")
    return detail


@router.get("/{workflow_run_id}/steps", response_model=list[WorkflowStepResponse])
async def list_workflow_run_steps(
    workflow_run_id: UUID,
    tenant_id: UUID = Query(...),
    status_filter: str | None = Query(default=None, alias="status"),
    min_attempt_count: int | None = Query(default=None, ge=1),
    limit: int = Query(default=50, ge=1, le=200),
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> list[WorkflowStepResponse]:
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(
        actor,
        "access_operations",
        RolePermissionRepository(session),
    )
    require_actor_tenant_access(actor, tenant_id)
    try:
        return await build_workflow_service(session).list_workflow_run_steps(
            workflow_run_id=workflow_run_id,
            tenant_id=tenant_id,
            status_filter=status_filter,
            min_attempt_count=min_attempt_count,
            limit=limit,
        )
    except ResourceNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@router.get("/{workflow_run_id}/events", response_model=list[WorkflowRunEventResponse])
async def list_workflow_run_events(
    workflow_run_id: UUID,
    tenant_id: UUID = Query(...),
    action_type: str | None = Query(default=None),
    actor_role: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> list[WorkflowRunEventResponse]:
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(
        actor,
        "access_operations",
        RolePermissionRepository(session),
    )
    require_actor_tenant_access(actor, tenant_id)
    try:
        return await build_workflow_service(session).list_workflow_run_events(
            workflow_run_id=workflow_run_id,
            tenant_id=tenant_id,
            action_type=action_type,
            actor_role=actor_role,
            limit=limit,
        )
    except ResourceNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@router.post("/{workflow_run_id}/retry", response_model=WorkflowRunActionResponse)
async def retry_workflow_run(
    workflow_run_id: UUID,
    tenant_id: UUID = Query(...),
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> WorkflowRunActionResponse:
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(
        actor,
        "retry_workflow_runs",
        RolePermissionRepository(session),
    )
    require_actor_tenant_access(actor, tenant_id)
    try:
        return await build_workflow_service(session).retry_workflow_run(
            workflow_run_id=workflow_run_id,
            tenant_id=tenant_id,
            actor_user_id=actor.user_id,
            actor_role=actor.role,
        )
    except ResourceNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except ResourceConflictError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error


@router.post("/{workflow_run_id}/cancel", response_model=WorkflowRunActionResponse)
async def cancel_workflow_run(
    workflow_run_id: UUID,
    tenant_id: UUID = Query(...),
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> WorkflowRunActionResponse:
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(
        actor,
        "retry_workflow_runs",
        RolePermissionRepository(session),
    )
    require_actor_tenant_access(actor, tenant_id)
    try:
        return await build_workflow_service(session).cancel_workflow_run(
            workflow_run_id=workflow_run_id,
            tenant_id=tenant_id,
            actor_user_id=actor.user_id,
            actor_role=actor.role,
        )
    except ResourceNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except ResourceConflictError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error


@router.patch("/{workflow_run_id}/notes", response_model=WorkflowRunDetailResponse)
async def update_workflow_run_operator_notes(
    workflow_run_id: UUID,
    request: WorkflowRunNotesUpdateRequest,
    tenant_id: UUID = Query(...),
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> WorkflowRunDetailResponse:
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(
        actor,
        "retry_workflow_runs",
        RolePermissionRepository(session),
    )
    require_actor_tenant_access(actor, tenant_id)
    try:
        return await build_workflow_service(session).update_workflow_run_operator_notes(
            workflow_run_id=workflow_run_id,
            tenant_id=tenant_id,
            operator_notes=request.operator_notes,
            actor_user_id=actor.user_id,
            actor_role=actor.role,
        )
    except ResourceNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
