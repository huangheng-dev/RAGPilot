from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from ragpilot_api.application.errors import ResourceConflictError
from ragpilot_api.application.runtime_governance.runtime_governance_event_service import RuntimeGovernanceEventService
from ragpilot_api.application.retrieval.retrieval_profile_registry_service import RetrievalProfileRegistryService
from ragpilot_api.contracts.http.retrieval_profile_contracts import (
    RetrievalMode,
    RetrievalProfileGovernanceActionRequest,
    RetrievalProfileGovernanceActionResponse,
    RetrievalProfileCreateRequest,
    RetrievalProfileResponse,
    RetrievalProfileUpdateRequest,
)
from ragpilot_api.infrastructure.database.repositories.role_permission_repository import RolePermissionRepository
from ragpilot_api.infrastructure.database.repositories.runtime_governance_event_repository import (
    RuntimeGovernanceEventRepository,
)
from ragpilot_api.infrastructure.database.repositories.retrieval_profile_repository import RetrievalProfileRepository
from ragpilot_api.infrastructure.database.session import get_database_session
from ragpilot_api.presentation.http.request_actor import (
    RequestActor,
    get_request_actor,
    require_actor_capability_from_policy,
    require_authenticated_actor,
    require_platform_wide_actor_scope,
)


router = APIRouter()


def build_retrieval_profile_registry_service(session: AsyncSession) -> RetrievalProfileRegistryService:
    return RetrievalProfileRegistryService(RetrievalProfileRepository(session))


def build_runtime_governance_event_service(session: AsyncSession) -> RuntimeGovernanceEventService:
    return RuntimeGovernanceEventService(RuntimeGovernanceEventRepository(session))


def read_response_field(payload: object, field_name: str):
    if isinstance(payload, dict):
        return payload.get(field_name)
    return getattr(payload, field_name, None)


@router.post("", response_model=RetrievalProfileResponse, status_code=status.HTTP_201_CREATED)
async def create_retrieval_profile(
    request: RetrievalProfileCreateRequest,
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> RetrievalProfileResponse:
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(actor, "manage_runtime_governance", RolePermissionRepository(session))
    require_platform_wide_actor_scope(actor, detail="Platform retrieval governance requires platform-wide access.")
    try:
        response = await build_retrieval_profile_registry_service(session).create_retrieval_profile(request)
    except ResourceConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    await build_runtime_governance_event_service(session).create_runtime_governance_event(
        actor_user_id=actor.user_id,
        actor_role=actor.role,
        resource_type="retrieval_profile",
        resource_id=read_response_field(response, "id"),
        resource_name=read_response_field(response, "name"),
        resource_slug=read_response_field(response, "slug"),
        action_type="created",
        detail={
            "retrieval_mode": request.retrieval_mode,
            "top_k": request.top_k,
            "is_enabled": request.is_enabled,
            "is_default": request.is_default,
        },
    )
    return response


@router.get("", response_model=list[RetrievalProfileResponse])
async def list_retrieval_profiles(
    retrieval_mode: RetrievalMode | None = Query(default=None),
    is_enabled: bool | None = Query(default=None),
    query: str | None = Query(default=None, min_length=1, max_length=160),
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> list[RetrievalProfileResponse]:
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(actor, "review_runtime_governance", RolePermissionRepository(session))
    require_platform_wide_actor_scope(actor, detail="Platform retrieval governance requires platform-wide access.")
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
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(actor, "manage_runtime_governance", RolePermissionRepository(session))
    require_platform_wide_actor_scope(actor, detail="Platform retrieval governance requires platform-wide access.")
    try:
        retrieval_profile = await build_retrieval_profile_registry_service(session).update_retrieval_profile(
            retrieval_profile_id=retrieval_profile_id,
            request=request,
        )
    except ResourceConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error

    if retrieval_profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Retrieval profile not found.")
    await build_runtime_governance_event_service(session).create_runtime_governance_event(
        actor_user_id=actor.user_id,
        actor_role=actor.role,
        resource_type="retrieval_profile",
        resource_id=read_response_field(retrieval_profile, "id"),
        resource_name=read_response_field(retrieval_profile, "name"),
        resource_slug=read_response_field(retrieval_profile, "slug"),
        action_type="updated",
        detail={
            "retrieval_mode": request.retrieval_mode,
            "top_k": request.top_k,
            "is_enabled": request.is_enabled,
            "is_default": request.is_default,
        },
    )
    return retrieval_profile


@router.post("/{retrieval_profile_id}/governance-action", response_model=RetrievalProfileGovernanceActionResponse)
async def apply_retrieval_profile_governance_action(
    retrieval_profile_id: UUID,
    request: RetrievalProfileGovernanceActionRequest,
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> RetrievalProfileGovernanceActionResponse:
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(actor, "manage_runtime_governance", RolePermissionRepository(session))
    require_platform_wide_actor_scope(actor, detail="Platform retrieval governance requires platform-wide access.")
    try:
        response = await build_retrieval_profile_registry_service(session).apply_retrieval_profile_governance_action(
            retrieval_profile_id=retrieval_profile_id,
            action_type=request.action_type,
        )
    except ResourceConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error

    if response is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Retrieval profile not found.")
    await build_runtime_governance_event_service(session).create_runtime_governance_event(
        actor_user_id=actor.user_id,
        actor_role=actor.role,
        resource_type="retrieval_profile",
        resource_id=read_response_field(read_response_field(response, "retrieval_profile"), "id"),
        resource_name=read_response_field(read_response_field(response, "retrieval_profile"), "name"),
        resource_slug=read_response_field(read_response_field(response, "retrieval_profile"), "slug"),
        action_type=request.action_type,
        detail={
            "summary": read_response_field(response, "summary"),
            "retrieval_mode": read_response_field(read_response_field(response, "retrieval_profile"), "retrieval_mode"),
            "top_k": read_response_field(read_response_field(response, "retrieval_profile"), "top_k"),
            "is_enabled": read_response_field(read_response_field(response, "retrieval_profile"), "is_enabled"),
            "is_default": read_response_field(read_response_field(response, "retrieval_profile"), "is_default"),
        },
    )
    return response


@router.delete("/{retrieval_profile_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_retrieval_profile(
    retrieval_profile_id: UUID,
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> None:
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(actor, "manage_runtime_governance", RolePermissionRepository(session))
    require_platform_wide_actor_scope(actor, detail="Platform retrieval governance requires platform-wide access.")
    existing_retrieval_profile = await RetrievalProfileRepository(session).get_retrieval_profile(
        retrieval_profile_id=retrieval_profile_id
    )
    if existing_retrieval_profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Retrieval profile not found.")
    try:
        deleted = await build_retrieval_profile_registry_service(session).delete_retrieval_profile(
            retrieval_profile_id=retrieval_profile_id
        )
    except ResourceConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Retrieval profile not found.")
    await build_runtime_governance_event_service(session).create_runtime_governance_event(
        actor_user_id=actor.user_id,
        actor_role=actor.role,
        resource_type="retrieval_profile",
        resource_id=existing_retrieval_profile.id,
        resource_name=existing_retrieval_profile.name,
        resource_slug=existing_retrieval_profile.slug,
        action_type="deleted",
        detail={
            "retrieval_mode": existing_retrieval_profile.retrieval_mode,
            "top_k": float(existing_retrieval_profile.top_k),
            "was_enabled": existing_retrieval_profile.is_enabled,
            "was_default": existing_retrieval_profile.is_default,
        },
    )
