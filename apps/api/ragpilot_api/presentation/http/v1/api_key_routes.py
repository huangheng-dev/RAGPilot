from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from ragpilot_api.application.errors import ResourceConflictError, ResourceNotFoundError
from ragpilot_api.application.identity.api_key_service import ApiKeyService
from ragpilot_api.contracts.http.api_key_contracts import ApiKeyCreateRequest, ApiKeyCreatedResponse, ApiKeyResponse, ApiKeyRevokeRequest
from ragpilot_api.infrastructure.database.repositories.api_key_repository import ApiKeyRepository
from ragpilot_api.infrastructure.database.repositories.role_permission_repository import RolePermissionRepository
from ragpilot_api.infrastructure.database.session import get_database_session
from ragpilot_api.presentation.http.request_actor import (
    RequestActor, get_request_actor, require_actor_capability_from_policy,
    require_actor_tenant_access, require_current_session_actor,
)


router = APIRouter()


def build_service(session: AsyncSession) -> ApiKeyService:
    return ApiKeyService(ApiKeyRepository(session))


@router.post("", response_model=ApiKeyCreatedResponse, status_code=status.HTTP_201_CREATED)
async def create_api_key(
    request: ApiKeyCreateRequest,
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> ApiKeyCreatedResponse:
    require_current_session_actor(actor, detail="API keys can only be created from an interactive session.")
    await require_actor_capability_from_policy(actor, "manage_admin_resources", RolePermissionRepository(session))
    require_actor_tenant_access(actor, request.tenant_id)
    try:
        return await build_service(session).create(request, actor_user_id=actor.user_id)
    except ResourceConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error


@router.get("", response_model=list[ApiKeyResponse])
async def list_api_keys(
    tenant_id: UUID = Query(...),
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> list[ApiKeyResponse]:
    require_current_session_actor(actor, detail="API keys can only be listed from an interactive session.")
    await require_actor_capability_from_policy(actor, "manage_admin_resources", RolePermissionRepository(session))
    require_actor_tenant_access(actor, tenant_id)
    return await build_service(session).list(tenant_id=tenant_id)


@router.post("/{api_key_id}/revoke", response_model=ApiKeyResponse)
async def revoke_api_key(
    api_key_id: UUID,
    request: ApiKeyRevokeRequest,
    tenant_id: UUID = Query(...),
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> ApiKeyResponse:
    require_current_session_actor(actor, detail="API keys can only be revoked from an interactive session.")
    await require_actor_capability_from_policy(actor, "manage_admin_resources", RolePermissionRepository(session))
    require_actor_tenant_access(actor, tenant_id)
    try:
        return await build_service(session).revoke(
            api_key_id=api_key_id, tenant_id=tenant_id, actor_user_id=actor.user_id, reason=request.reason,
        )
    except ResourceNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
