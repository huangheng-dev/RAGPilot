from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from ragpilot_api.application.retrieval.retrieval_service import RetrievalService
from ragpilot_api.contracts.http.retrieval_contracts import (
    RetrievalCompareRequest,
    RetrievalCompareResponse,
    RetrievalEvaluationCreateRequest,
    RetrievalEvaluationQueryFollowUpUpdateRequest,
    RetrievalEvaluationQueryFollowUpUpdateResponse,
    RetrievalEvaluationFollowUpUpdateRequest,
    RetrievalEvaluationResponse,
    RetrievalEvaluationSummaryResponse,
    RetrievalRequest,
    RetrievalResponse,
)
from ragpilot_api.infrastructure.database.repositories.knowledge_base_repository import KnowledgeBaseRepository
from ragpilot_api.infrastructure.database.repositories.role_permission_repository import RolePermissionRepository
from ragpilot_api.infrastructure.database.repositories.retrieval_evaluation_repository import RetrievalEvaluationRepository
from ragpilot_api.infrastructure.database.repositories.retrieval_profile_repository import RetrievalProfileRepository
from ragpilot_api.infrastructure.database.repositories.retrieval_repository import RetrievalRepository
from ragpilot_api.infrastructure.database.session import get_database_session
from ragpilot_api.infrastructure.database.repositories.workspace_repository import WorkspaceRepository
from ragpilot_api.presentation.http.request_actor import (
    RequestActor,
    get_request_actor,
    require_authenticated_actor,
    require_actor_capability_from_policy,
    require_actor_knowledge_base_access,
    require_actor_tenant_access,
    require_actor_workspace_access,
)
from ragpilot_api.shared.settings import get_settings


router = APIRouter()


def build_retrieval_service(session: AsyncSession) -> RetrievalService:
    return RetrievalService(
        RetrievalRepository(session),
        settings=get_settings(),
        knowledge_base_repository=KnowledgeBaseRepository(session),
        retrieval_profile_repository=RetrievalProfileRepository(session),
        retrieval_evaluation_repository=RetrievalEvaluationRepository(session),
    )


@router.post("", response_model=RetrievalResponse, status_code=status.HTTP_200_OK)
async def retrieve_chunks(
    request: RetrievalRequest,
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> RetrievalResponse:
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(
        actor,
        "access_chat",
        RolePermissionRepository(session),
    )
    require_actor_tenant_access(actor, request.tenant_id)
    resolved_tenant_id = await require_actor_knowledge_base_access(
        actor,
        request.knowledge_base_id,
        KnowledgeBaseRepository(session),
    )
    if resolved_tenant_id is not None and resolved_tenant_id != request.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Tenant and knowledge base scope do not match.",
        )
    return await build_retrieval_service(session).retrieve_chunks(
        request,
        principal_user_id=actor.user_id,
        acl_bypass=actor.role in {"super_admin", "reviewer"},
    )


@router.post("/compare", response_model=RetrievalCompareResponse, status_code=status.HTTP_200_OK)
async def compare_retrieval_engines(
    request: RetrievalCompareRequest,
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> RetrievalCompareResponse:
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(
        actor,
        "access_chat",
        RolePermissionRepository(session),
    )
    require_actor_tenant_access(actor, request.tenant_id)
    resolved_tenant_id = await require_actor_knowledge_base_access(
        actor,
        request.knowledge_base_id,
        KnowledgeBaseRepository(session),
    )
    if resolved_tenant_id is not None and resolved_tenant_id != request.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Tenant and knowledge base scope do not match.",
        )
    return await build_retrieval_service(session).compare_chunks(
        request,
        principal_user_id=actor.user_id,
        acl_bypass=actor.role in {"super_admin", "reviewer"},
    )


@router.post("/evaluations", response_model=RetrievalEvaluationResponse, status_code=status.HTTP_201_CREATED)
async def record_retrieval_evaluation(
    request: RetrievalEvaluationCreateRequest,
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> RetrievalEvaluationResponse:
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(
        actor,
        "access_chat",
        RolePermissionRepository(session),
    )
    require_actor_tenant_access(actor, request.tenant_id)
    resolved_workspace_tenant_id = await require_actor_workspace_access(
        actor,
        request.workspace_id,
        WorkspaceRepository(session),
    )
    resolved_knowledge_base_tenant_id = await require_actor_knowledge_base_access(
        actor,
        request.knowledge_base_id,
        KnowledgeBaseRepository(session),
    )
    for resolved_tenant_id in (resolved_workspace_tenant_id, resolved_knowledge_base_tenant_id):
        if resolved_tenant_id is not None and resolved_tenant_id != request.tenant_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Tenant scope does not match the selected workspace or knowledge base.",
            )
    return await build_retrieval_service(session).record_evaluation(
        request,
        created_by_user_id=actor.user_id,
    )


@router.get("/evaluations", response_model=list[RetrievalEvaluationResponse], status_code=status.HTTP_200_OK)
async def list_retrieval_evaluations(
    tenant_id: UUID = Query(...),
    workspace_id: UUID = Query(...),
    knowledge_base_id: UUID | None = Query(default=None),
    evaluation_mode: str | None = Query(default=None),
    validation_status: str | None = Query(default=None),
    follow_up_status: str | None = Query(default=None),
    query: str | None = Query(default=None),
    limit: int = Query(default=10, ge=1, le=50),
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> list[RetrievalEvaluationResponse]:
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(
        actor,
        "access_chat",
        RolePermissionRepository(session),
    )
    require_actor_tenant_access(actor, tenant_id)
    resolved_workspace_tenant_id = await require_actor_workspace_access(
        actor,
        workspace_id,
        WorkspaceRepository(session),
    )
    if resolved_workspace_tenant_id is not None and resolved_workspace_tenant_id != tenant_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Tenant and workspace scope do not match.",
        )
    if knowledge_base_id is not None:
        resolved_knowledge_base_tenant_id = await require_actor_knowledge_base_access(
            actor,
            knowledge_base_id,
            KnowledgeBaseRepository(session),
        )
        if resolved_knowledge_base_tenant_id is not None and resolved_knowledge_base_tenant_id != tenant_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Tenant and knowledge base scope do not match.",
            )
    return await build_retrieval_service(session).list_evaluations(
        tenant_id=tenant_id,
        workspace_id=workspace_id,
        knowledge_base_id=knowledge_base_id,
        evaluation_mode=evaluation_mode,
        validation_status=validation_status,
        follow_up_status=follow_up_status,
        query=query,
        limit=limit,
    )


@router.get("/evaluations/summary", response_model=RetrievalEvaluationSummaryResponse, status_code=status.HTTP_200_OK)
async def summarize_retrieval_evaluations(
    tenant_id: UUID = Query(...),
    workspace_id: UUID = Query(...),
    knowledge_base_id: UUID | None = Query(default=None),
    evaluation_mode: str | None = Query(default=None),
    validation_status: str | None = Query(default=None),
    follow_up_status: str | None = Query(default=None),
    query: str | None = Query(default=None),
    limit: int = Query(default=5, ge=1, le=12),
    sample_size: int = Query(default=120, ge=10, le=200),
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> RetrievalEvaluationSummaryResponse:
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(
        actor,
        "access_chat",
        RolePermissionRepository(session),
    )
    require_actor_tenant_access(actor, tenant_id)
    resolved_workspace_tenant_id = await require_actor_workspace_access(
        actor,
        workspace_id,
        WorkspaceRepository(session),
    )
    if resolved_workspace_tenant_id is not None and resolved_workspace_tenant_id != tenant_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Tenant and workspace scope do not match.",
        )
    if knowledge_base_id is not None:
        resolved_knowledge_base_tenant_id = await require_actor_knowledge_base_access(
            actor,
            knowledge_base_id,
            KnowledgeBaseRepository(session),
        )
        if resolved_knowledge_base_tenant_id is not None and resolved_knowledge_base_tenant_id != tenant_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Tenant and knowledge base scope do not match.",
            )
    return await build_retrieval_service(session).summarize_evaluations(
        tenant_id=tenant_id,
        workspace_id=workspace_id,
        knowledge_base_id=knowledge_base_id,
        evaluation_mode=evaluation_mode,
        validation_status=validation_status,
        follow_up_status=follow_up_status,
        query=query,
        limit=limit,
        sample_size=sample_size,
    )


@router.patch("/evaluations/{retrieval_evaluation_id}/follow-up", response_model=RetrievalEvaluationResponse, status_code=status.HTTP_200_OK)
async def update_retrieval_evaluation_follow_up(
    retrieval_evaluation_id: UUID,
    request: RetrievalEvaluationFollowUpUpdateRequest,
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> RetrievalEvaluationResponse:
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(
        actor,
        "access_chat",
        RolePermissionRepository(session),
    )
    try:
        return await build_retrieval_service(session).update_evaluation_follow_up(
            retrieval_evaluation_id=retrieval_evaluation_id,
            request=request,
            actor_user_id=actor.user_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.patch("/evaluations/follow-up/query", response_model=RetrievalEvaluationQueryFollowUpUpdateResponse, status_code=status.HTTP_200_OK)
async def update_retrieval_query_follow_up(
    request: RetrievalEvaluationQueryFollowUpUpdateRequest,
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> RetrievalEvaluationQueryFollowUpUpdateResponse:
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(
        actor,
        "access_chat",
        RolePermissionRepository(session),
    )
    require_actor_tenant_access(actor, request.tenant_id)
    resolved_workspace_tenant_id = await require_actor_workspace_access(
        actor,
        request.workspace_id,
        WorkspaceRepository(session),
    )
    if resolved_workspace_tenant_id is not None and resolved_workspace_tenant_id != request.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Tenant and workspace scope do not match.",
        )
    if request.knowledge_base_id is not None:
        resolved_knowledge_base_tenant_id = await require_actor_knowledge_base_access(
            actor,
            request.knowledge_base_id,
            KnowledgeBaseRepository(session),
        )
        if resolved_knowledge_base_tenant_id is not None and resolved_knowledge_base_tenant_id != request.tenant_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Tenant and knowledge base scope do not match.",
            )
    try:
        return await build_retrieval_service(session).update_query_follow_up(
            request=request,
            actor_user_id=actor.user_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
