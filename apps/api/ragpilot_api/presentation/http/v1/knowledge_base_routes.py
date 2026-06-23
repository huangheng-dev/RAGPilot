from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from ragpilot_api.application.errors import ResourceConflictError, ResourceNotFoundError
from ragpilot_api.application.knowledge.knowledge_base_service import KnowledgeBaseService
from ragpilot_api.contracts.http.knowledge_base_contracts import (
    KnowledgeBaseCreateRequest,
    KnowledgeBasePublicationRequest,
    KnowledgeBaseResponse,
    KnowledgeBaseUpdateRequest,
)
from ragpilot_api.infrastructure.database.repositories.knowledge_base_repository import KnowledgeBaseRepository
from ragpilot_api.infrastructure.database.repositories.role_permission_repository import RolePermissionRepository
from ragpilot_api.infrastructure.database.repositories.retrieval_profile_repository import RetrievalProfileRepository
from ragpilot_api.infrastructure.database.session import get_database_session
from ragpilot_api.presentation.http.request_actor import (
    RequestActor,
    get_request_actor,
    require_actor_capability,
    require_actor_capability_from_policy,
)


router = APIRouter()


def build_knowledge_base_service(session: AsyncSession) -> KnowledgeBaseService:
    return KnowledgeBaseService(
        KnowledgeBaseRepository(session),
        RetrievalProfileRepository(session),
    )


@router.post("", response_model=KnowledgeBaseResponse, status_code=status.HTTP_201_CREATED)
async def create_knowledge_base(
    request: KnowledgeBaseCreateRequest,
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> KnowledgeBaseResponse:
    await require_actor_capability_from_policy(actor, "manage_admin_resources", RolePermissionRepository(session))
    try:
        return await build_knowledge_base_service(session).create_knowledge_base(request)
    except ResourceConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    except ResourceNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error


@router.get("", response_model=list[KnowledgeBaseResponse])
async def list_knowledge_bases(
    workspace_id: UUID = Query(...),
    publication_status: str | None = Query(default=None, pattern=r"^(draft|published)$"),
    session: AsyncSession = Depends(get_database_session),
) -> list[KnowledgeBaseResponse]:
    return await build_knowledge_base_service(session).list_knowledge_bases(
        workspace_id=workspace_id,
        publication_status=publication_status,
    )


@router.patch("/{knowledge_base_id}", response_model=KnowledgeBaseResponse)
async def update_knowledge_base(
    knowledge_base_id: UUID,
    request: KnowledgeBaseUpdateRequest,
    workspace_id: UUID = Query(...),
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> KnowledgeBaseResponse:
    await require_actor_capability_from_policy(actor, "manage_admin_resources", RolePermissionRepository(session))
    try:
        knowledge_base = await build_knowledge_base_service(session).update_knowledge_base(
            knowledge_base_id=knowledge_base_id,
            workspace_id=workspace_id,
            request=request,
        )
    except ResourceConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    except ResourceNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error

    if knowledge_base is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Knowledge base not found.")

    return knowledge_base


@router.post("/{knowledge_base_id}/publication", response_model=KnowledgeBaseResponse)
async def set_knowledge_base_publication(
    knowledge_base_id: UUID,
    request: KnowledgeBasePublicationRequest,
    workspace_id: UUID = Query(...),
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> KnowledgeBaseResponse:
    await require_actor_capability_from_policy(actor, "manage_admin_resources", RolePermissionRepository(session))
    knowledge_base = await build_knowledge_base_service(session).set_publication_status(
        knowledge_base_id=knowledge_base_id,
        workspace_id=workspace_id,
        request=request,
    )

    if knowledge_base is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Knowledge base not found.")

    return knowledge_base
