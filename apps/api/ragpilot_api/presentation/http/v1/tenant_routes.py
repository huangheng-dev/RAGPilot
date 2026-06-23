from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from ragpilot_api.application.errors import ResourceConflictError
from ragpilot_api.application.identity.tenant_service import TenantService
from ragpilot_api.contracts.http.tenant_contracts import TenantCreateRequest, TenantResponse, TenantUpdateRequest
from ragpilot_api.infrastructure.database.repositories.role_permission_repository import RolePermissionRepository
from ragpilot_api.infrastructure.database.repositories.tenant_repository import TenantRepository
from ragpilot_api.infrastructure.database.session import get_database_session
from ragpilot_api.presentation.http.request_actor import (
    RequestActor,
    get_request_actor,
    require_actor_capability,
    require_actor_capability_from_policy,
)


router = APIRouter()


def build_tenant_service(session: AsyncSession) -> TenantService:
    return TenantService(TenantRepository(session))


@router.post("", response_model=TenantResponse, status_code=status.HTTP_201_CREATED)
async def create_tenant(
    request: TenantCreateRequest,
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> TenantResponse:
    await require_actor_capability_from_policy(actor, "manage_admin_resources", RolePermissionRepository(session))
    try:
        return await build_tenant_service(session).create_tenant(request)
    except ResourceConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error


@router.get("", response_model=list[TenantResponse])
async def list_tenants(session: AsyncSession = Depends(get_database_session)) -> list[TenantResponse]:
    return await build_tenant_service(session).list_tenants()


@router.patch("/{tenant_id}", response_model=TenantResponse)
async def update_tenant(
    tenant_id: UUID,
    request: TenantUpdateRequest,
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> TenantResponse:
    await require_actor_capability_from_policy(actor, "manage_admin_resources", RolePermissionRepository(session))
    try:
        tenant = await build_tenant_service(session).update_tenant(tenant_id=tenant_id, request=request)
    except ResourceConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error

    if tenant is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found.")

    return tenant
