from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from ragpilot_api.application.errors import ResourceConflictError, ResourceNotFoundError
from ragpilot_api.application.model_registry.model_registry_service import ModelRegistryService
from ragpilot_api.contracts.http.model_endpoint_contracts import (
    ModelEndpointCreateRequest,
    ModelGovernanceSummaryResponse,
    ModelEndpointPreviewResponse,
    ModelEndpointResponse,
    ModelEndpointUpdateRequest,
)
from ragpilot_api.infrastructure.database.repositories.agent_repository import AgentRepository
from ragpilot_api.infrastructure.database.repositories.model_endpoint_repository import ModelEndpointRepository
from ragpilot_api.infrastructure.database.repositories.role_permission_repository import RolePermissionRepository
from ragpilot_api.infrastructure.database.session import get_database_session
from ragpilot_api.presentation.http.request_actor import (
    RequestActor,
    get_request_actor,
    require_actor_capability,
    require_actor_capability_from_policy,
)
from ragpilot_api.shared.settings import get_settings


router = APIRouter()


def build_model_registry_service(session: AsyncSession) -> ModelRegistryService:
    return ModelRegistryService(
        ModelEndpointRepository(session),
        AgentRepository(session),
        get_settings(),
    )


@router.post("", response_model=ModelEndpointResponse, status_code=status.HTTP_201_CREATED)
async def create_model_endpoint(
    request: ModelEndpointCreateRequest,
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> ModelEndpointResponse:
    await require_actor_capability_from_policy(actor, "manage_runtime_governance", RolePermissionRepository(session))
    try:
        return await build_model_registry_service(session).create_model_endpoint(request)
    except ResourceConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error


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
    await require_actor_capability_from_policy(actor, "review_runtime_governance", RolePermissionRepository(session))
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
    await require_actor_capability_from_policy(actor, "review_runtime_governance", RolePermissionRepository(session))
    return await build_model_registry_service(session).get_model_governance_summary()


@router.post("/{model_endpoint_id}/preview", response_model=ModelEndpointPreviewResponse)
async def preview_model_endpoint(
    model_endpoint_id: UUID,
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> ModelEndpointPreviewResponse:
    await require_actor_capability_from_policy(actor, "review_runtime_governance", RolePermissionRepository(session))
    try:
        return await build_model_registry_service(session).preview_model_endpoint(model_endpoint_id=model_endpoint_id)
    except ResourceNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error


@router.patch("/{model_endpoint_id}", response_model=ModelEndpointResponse)
async def update_model_endpoint(
    model_endpoint_id: UUID,
    request: ModelEndpointUpdateRequest,
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> ModelEndpointResponse:
    await require_actor_capability_from_policy(actor, "manage_runtime_governance", RolePermissionRepository(session))
    try:
        model_endpoint = await build_model_registry_service(session).update_model_endpoint(
            model_endpoint_id=model_endpoint_id,
            request=request,
        )
    except ResourceConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error

    if model_endpoint is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Model endpoint not found.")

    return model_endpoint


@router.delete("/{model_endpoint_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_model_endpoint(
    model_endpoint_id: UUID,
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> None:
    await require_actor_capability_from_policy(actor, "manage_runtime_governance", RolePermissionRepository(session))
    try:
        deleted = await build_model_registry_service(session).delete_model_endpoint(model_endpoint_id=model_endpoint_id)
    except ResourceConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Model endpoint not found.")
