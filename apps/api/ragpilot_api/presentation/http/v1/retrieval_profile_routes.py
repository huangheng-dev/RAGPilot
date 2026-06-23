from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from ragpilot_api.application.errors import ResourceConflictError
from ragpilot_api.application.retrieval.retrieval_profile_registry_service import RetrievalProfileRegistryService
from ragpilot_api.contracts.http.retrieval_profile_contracts import (
    RetrievalMode,
    RetrievalProfileCreateRequest,
    RetrievalProfileResponse,
    RetrievalProfileUpdateRequest,
)
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


def build_retrieval_profile_registry_service(session: AsyncSession) -> RetrievalProfileRegistryService:
    return RetrievalProfileRegistryService(RetrievalProfileRepository(session))


@router.post("", response_model=RetrievalProfileResponse, status_code=status.HTTP_201_CREATED)
async def create_retrieval_profile(
    request: RetrievalProfileCreateRequest,
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> RetrievalProfileResponse:
    await require_actor_capability_from_policy(actor, "manage_runtime_governance", RolePermissionRepository(session))
    try:
        return await build_retrieval_profile_registry_service(session).create_retrieval_profile(request)
    except ResourceConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error


@router.get("", response_model=list[RetrievalProfileResponse])
async def list_retrieval_profiles(
    retrieval_mode: RetrievalMode | None = Query(default=None),
    is_enabled: bool | None = Query(default=None),
    query: str | None = Query(default=None, min_length=1, max_length=160),
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> list[RetrievalProfileResponse]:
    await require_actor_capability_from_policy(actor, "review_runtime_governance", RolePermissionRepository(session))
    return await build_retrieval_profile_registry_service(session).list_retrieval_profiles(
        retrieval_mode=retrieval_mode,
        is_enabled=is_enabled,
        query=query,
    )


@router.patch("/{retrieval_profile_id}", response_model=RetrievalProfileResponse)
async def update_retrieval_profile(
    retrieval_profile_id: UUID,
    request: RetrievalProfileUpdateRequest,
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> RetrievalProfileResponse:
    await require_actor_capability_from_policy(actor, "manage_runtime_governance", RolePermissionRepository(session))
    try:
        retrieval_profile = await build_retrieval_profile_registry_service(session).update_retrieval_profile(
            retrieval_profile_id=retrieval_profile_id,
            request=request,
        )
    except ResourceConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error

    if retrieval_profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Retrieval profile not found.")

    return retrieval_profile


@router.delete("/{retrieval_profile_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_retrieval_profile(
    retrieval_profile_id: UUID,
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> None:
    await require_actor_capability_from_policy(actor, "manage_runtime_governance", RolePermissionRepository(session))
    try:
        deleted = await build_retrieval_profile_registry_service(session).delete_retrieval_profile(
            retrieval_profile_id=retrieval_profile_id
        )
    except ResourceConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Retrieval profile not found.")
