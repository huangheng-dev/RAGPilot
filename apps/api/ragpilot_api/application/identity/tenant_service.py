from uuid import UUID

from ragpilot_api.contracts.http.tenant_contracts import TenantCreateRequest, TenantResponse, TenantUpdateRequest
from ragpilot_api.infrastructure.database.models import Tenant
from ragpilot_api.infrastructure.database.repositories.tenant_repository import TenantRepository


class TenantService:
    def __init__(self, tenant_repository: TenantRepository) -> None:
        self.tenant_repository = tenant_repository

    async def create_tenant(self, request: TenantCreateRequest) -> TenantResponse:
        tenant = await self.tenant_repository.create_tenant(name=request.name, slug=request.slug)
        return build_tenant_response(tenant)

    async def list_tenants(self) -> list[TenantResponse]:
        tenants = await self.tenant_repository.list_tenants()
        return [build_tenant_response(tenant) for tenant in tenants]

    async def update_tenant(self, *, tenant_id: UUID, request: TenantUpdateRequest) -> TenantResponse | None:
        tenant = await self.tenant_repository.update_tenant(
            tenant_id=tenant_id,
            name=request.name,
            slug=request.slug,
        )
        if tenant is None:
            return None
        return build_tenant_response(tenant)


def build_tenant_response(tenant: Tenant) -> TenantResponse:
    return TenantResponse(
        id=tenant.id,
        name=tenant.name,
        slug=tenant.slug,
        is_active=tenant.is_active,
        created_at=tenant.created_at,
        updated_at=tenant.updated_at,
    )
