from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from ragpilot_api.application.errors import ResourceConflictError, ResourceNotFoundError
from ragpilot_api.application.model_registry.model_registry_service import ModelRegistryService
from ragpilot_api.application.runtime_governance.runtime_governance_event_service import RuntimeGovernanceEventService
from ragpilot_api.contracts.http.model_endpoint_contracts import (
    ModelEndpointCreateRequest,
    ModelEndpointGovernanceActionRequest,
    ModelEndpointGovernanceActionResponse,
    ModelEndpointPreviewResponse,
    ModelEndpointResponse,
    ModelEndpointUpdateRequest,
    ModelGovernanceSummaryResponse,
)
from ragpilot_api.infrastructure.database.repositories.agent_repository import AgentRepository
from ragpilot_api.infrastructure.database.repositories.model_endpoint_repository import ModelEndpointRepository
from ragpilot_api.infrastructure.database.repositories.role_permission_repository import RolePermissionRepository
from ragpilot_api.infrastructure.database.repositories.runtime_governance_event_repository import (
    RuntimeGovernanceEventRepository,
)
from ragpilot_api.infrastructure.database.session import get_database_session
from ragpilot_api.presentation.http.request_actor import (
    RequestActor,
    get_request_actor,
    require_actor_capability_from_policy,
    require_authenticated_actor,
    require_platform_wide_actor_scope,
)
from ragpilot_api.shared.settings import get_settings


router = APIRouter()


def build_model_registry_service(session: AsyncSession) -> ModelRegistryService:
    return ModelRegistryService(
        ModelEndpointRepository(session),
        AgentRepository(session),
        get_settings(),
        RuntimeGovernanceEventRepository(session),
    )


def build_runtime_governance_event_service(session: AsyncSession) -> RuntimeGovernanceEventService:
    return RuntimeGovernanceEventService(RuntimeGovernanceEventRepository(session))


def read_response_field(payload: object, field_name: str):
    if isinstance(payload, dict):
        return payload.get(field_name)
    return getattr(payload, field_name, None)


@router.post("", response_model=ModelEndpointResponse, status_code=status.HTTP_201_CREATED)
async def create_model_endpoint(
    request: ModelEndpointCreateRequest,
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> ModelEndpointResponse:
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(actor, "manage_runtime_governance", RolePermissionRepository(session))
    require_platform_wide_actor_scope(actor, detail="Platform model governance requires platform-wide access.")
    try:
        response = await build_model_registry_service(session).create_model_endpoint(request)
    except ResourceConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    await build_runtime_governance_event_service(session).create_runtime_governance_event(
        actor_user_id=actor.user_id,
        actor_role=actor.role,
        resource_type="model_endpoint",
        resource_id=read_response_field(response, "id"),
        resource_name=read_response_field(response, "name"),
        resource_slug=read_response_field(response, "slug"),
        action_type="created",
        detail={
            "provider_type": request.provider_type,
            "model_name": request.model_name,
            "credential_mode": request.credential_mode,
            "is_enabled": request.is_enabled,
            "is_default": request.is_default,
        },
    )
    return response


@router.get("", response_model=list[ModelEndpointResponse])
async def list_model_endpoints(
    provider_type: str | None = Query(default=None, pattern=r"^(deterministic|openai_compatible|ollama|ollama_reserved|vllm|vllm_reserved)$"),
    is_enabled: bool | None = Query(default=None),
    runtime_state: str | None = Query(
        default=None,
        pattern=r"^(disabled_bound|managed_reserved|missing_base_url|missing_credential_hint|runtime_ready)$",
    ),
    query: str | None = Query(default=None, min_length=1, max_length=160),
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> list[ModelEndpointResponse]:
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(actor, "review_runtime_governance", RolePermissionRepository(session))
    require_platform_wide_actor_scope(actor, detail="Platform model governance requires platform-wide access.")
    return await build_model_registry_service(session).list_model_endpoints(
        provider_type=provider_type,
        is_enabled=is_enabled,
        runtime_state=runtime_state,
        query=query,
    )


@router.get("/governance-summary", response_model=ModelGovernanceSummaryResponse)
async def get_model_governance_summary(
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> ModelGovernanceSummaryResponse:
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(actor, "review_runtime_governance", RolePermissionRepository(session))
    require_platform_wide_actor_scope(actor, detail="Platform model governance requires platform-wide access.")
    return await build_model_registry_service(session).get_model_governance_summary()


@router.post("/{model_endpoint_id}/preview", response_model=ModelEndpointPreviewResponse)
async def preview_model_endpoint(
    model_endpoint_id: UUID,
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> ModelEndpointPreviewResponse:
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(actor, "review_runtime_governance", RolePermissionRepository(session))
    require_platform_wide_actor_scope(actor, detail="Platform model governance requires platform-wide access.")
    try:
        response = await build_model_registry_service(session).preview_model_endpoint(model_endpoint_id=model_endpoint_id)
    except ResourceNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    await build_runtime_governance_event_service(session).create_runtime_governance_event(
        actor_user_id=actor.user_id,
        actor_role=actor.role,
        resource_type="model_endpoint",
        resource_id=read_response_field(response, "model_endpoint_id"),
        resource_name=read_response_field(response, "name"),
        resource_slug=read_response_field(response, "slug"),
        action_type=f"preview_{read_response_field(response, 'preview_status')}",
        detail={
            "provider_type": read_response_field(response, "provider_type"),
            "model_name": read_response_field(response, "model_name"),
            "preview_status": read_response_field(response, "preview_status"),
            "summary": read_response_field(response, "summary"),
            "error_message": read_response_field(response, "error_message"),
        },
    )
    return response


@router.patch("/{model_endpoint_id}", response_model=ModelEndpointResponse)
async def update_model_endpoint(
    model_endpoint_id: UUID,
    request: ModelEndpointUpdateRequest,
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> ModelEndpointResponse:
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(actor, "manage_runtime_governance", RolePermissionRepository(session))
    require_platform_wide_actor_scope(actor, detail="Platform model governance requires platform-wide access.")
    try:
        model_endpoint = await build_model_registry_service(session).update_model_endpoint(
            model_endpoint_id=model_endpoint_id,
            request=request,
        )
    except ResourceConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error

    if model_endpoint is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Model endpoint not found.")
    await build_runtime_governance_event_service(session).create_runtime_governance_event(
        actor_user_id=actor.user_id,
        actor_role=actor.role,
        resource_type="model_endpoint",
        resource_id=read_response_field(model_endpoint, "id"),
        resource_name=read_response_field(model_endpoint, "name"),
        resource_slug=read_response_field(model_endpoint, "slug"),
        action_type="updated",
        detail={
            "provider_type": request.provider_type,
            "model_name": request.model_name,
            "credential_mode": request.credential_mode,
            "is_enabled": request.is_enabled,
            "is_default": request.is_default,
        },
    )
    return model_endpoint


@router.post("/{model_endpoint_id}/governance-action", response_model=ModelEndpointGovernanceActionResponse)
async def apply_model_endpoint_governance_action(
    model_endpoint_id: UUID,
    request: ModelEndpointGovernanceActionRequest,
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> ModelEndpointGovernanceActionResponse:
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(actor, "manage_runtime_governance", RolePermissionRepository(session))
    require_platform_wide_actor_scope(actor, detail="Platform model governance requires platform-wide access.")
    try:
        response = await build_model_registry_service(session).apply_model_endpoint_governance_action(
            model_endpoint_id=model_endpoint_id,
            action_type=request.action_type,
        )
    except ResourceConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    if response is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Model endpoint not found.")
    await build_runtime_governance_event_service(session).create_runtime_governance_event(
        actor_user_id=actor.user_id,
        actor_role=actor.role,
        resource_type="model_endpoint",
        resource_id=read_response_field(read_response_field(response, "model_endpoint"), "id"),
        resource_name=read_response_field(read_response_field(response, "model_endpoint"), "name"),
        resource_slug=read_response_field(read_response_field(response, "model_endpoint"), "slug"),
        action_type=request.action_type,
        detail={
            "summary": read_response_field(response, "summary"),
            "provider_type": read_response_field(read_response_field(response, "model_endpoint"), "provider_type"),
            "model_name": read_response_field(read_response_field(response, "model_endpoint"), "model_name"),
            "credential_mode": read_response_field(read_response_field(response, "model_endpoint"), "credential_mode"),
            "is_enabled": read_response_field(read_response_field(response, "model_endpoint"), "is_enabled"),
            "is_default": read_response_field(read_response_field(response, "model_endpoint"), "is_default"),
        },
    )
    return response


@router.delete("/{model_endpoint_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_model_endpoint(
    model_endpoint_id: UUID,
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> None:
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(actor, "manage_runtime_governance", RolePermissionRepository(session))
    require_platform_wide_actor_scope(actor, detail="Platform model governance requires platform-wide access.")
    existing_model_endpoint = await ModelEndpointRepository(session).get_model_endpoint(model_endpoint_id=model_endpoint_id)
    if existing_model_endpoint is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Model endpoint not found.")
    try:
        deleted = await build_model_registry_service(session).delete_model_endpoint(model_endpoint_id=model_endpoint_id)
    except ResourceConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Model endpoint not found.")
    await build_runtime_governance_event_service(session).create_runtime_governance_event(
        actor_user_id=actor.user_id,
        actor_role=actor.role,
        resource_type="model_endpoint",
        resource_id=existing_model_endpoint.id,
        resource_name=existing_model_endpoint.name,
        resource_slug=existing_model_endpoint.slug,
        action_type="deleted",
        detail={
            "provider_type": existing_model_endpoint.provider_type,
            "model_name": existing_model_endpoint.model_name,
            "credential_mode": existing_model_endpoint.credential_mode,
            "was_enabled": existing_model_endpoint.is_enabled,
            "was_default": existing_model_endpoint.is_default,
        },
    )
