from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from ragpilot_api.application.retrieval.retrieval_service import RetrievalService
from ragpilot_api.contracts.http.retrieval_contracts import (
    RetrievalCompareRequest,
    RetrievalCompareResponse,
    RetrievalEvaluationCreateRequest,
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
from ragpilot_api.presentation.http.request_actor import (
    RequestActor,
    get_request_actor,
    require_authenticated_actor,
    require_actor_capability_from_policy,
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
    session: AsyncSession = Depends(get_database_session),
) -> RetrievalResponse:
    return await build_retrieval_service(session).retrieve_chunks(request)


@router.post("/compare", response_model=RetrievalCompareResponse, status_code=status.HTTP_200_OK)
async def compare_retrieval_engines(
    request: RetrievalCompareRequest,
    session: AsyncSession = Depends(get_database_session),
) -> RetrievalCompareResponse:
    return await build_retrieval_service(session).compare_chunks(request)


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
    return await build_retrieval_service(session).record_evaluation(
        request,
        created_by_user_id=actor.user_id,
    )


@router.get("/evaluations", response_model=list[RetrievalEvaluationResponse], status_code=status.HTTP_200_OK)
async def list_retrieval_evaluations(
    tenant_id: UUID = Query(...),
    workspace_id: UUID = Query(...),
    knowledge_base_id: UUID | None = Query(default=None),
    limit: int = Query(default=10, ge=1, le=50),
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> list[RetrievalEvaluationResponse]:
    await require_actor_capability_from_policy(
        actor,
        "access_chat",
        RolePermissionRepository(session),
    )
    return await build_retrieval_service(session).list_evaluations(
        tenant_id=tenant_id,
        workspace_id=workspace_id,
        knowledge_base_id=knowledge_base_id,
        limit=limit,
    )


@router.get("/evaluations/summary", response_model=RetrievalEvaluationSummaryResponse, status_code=status.HTTP_200_OK)
async def summarize_retrieval_evaluations(
    tenant_id: UUID = Query(...),
    workspace_id: UUID = Query(...),
    knowledge_base_id: UUID | None = Query(default=None),
    limit: int = Query(default=5, ge=1, le=12),
    sample_size: int = Query(default=120, ge=10, le=200),
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> RetrievalEvaluationSummaryResponse:
    await require_actor_capability_from_policy(
        actor,
        "access_chat",
        RolePermissionRepository(session),
    )
    return await build_retrieval_service(session).summarize_evaluations(
        tenant_id=tenant_id,
        workspace_id=workspace_id,
        knowledge_base_id=knowledge_base_id,
        limit=limit,
        sample_size=sample_size,
    )
