from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from ragpilot_api.application.errors import ResourceConflictError
from ragpilot_api.infrastructure.database.models import Tenant


class TenantRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create_tenant(self, *, name: str, slug: str) -> Tenant:
        tenant = Tenant(name=name, slug=slug)
        self.session.add(tenant)

        try:
            await self.session.commit()
        except IntegrityError as error:
            await self.session.rollback()
            raise ResourceConflictError("Tenant slug already exists.") from error

        await self.session.refresh(tenant)
        return tenant

    async def list_tenants(self) -> list[Tenant]:
        result = await self.session.scalars(
            select(Tenant).where(Tenant.deleted_at.is_(None)).order_by(Tenant.created_at.desc())
        )
        return list(result)

    async def get_tenant(self, *, tenant_id: UUID) -> Tenant | None:
        return await self.session.scalar(
            select(Tenant).where(Tenant.id == tenant_id, Tenant.deleted_at.is_(None))
        )

    async def update_tenant(self, *, tenant_id: UUID, name: str, slug: str) -> Tenant | None:
        tenant = await self.get_tenant(tenant_id=tenant_id)
        if tenant is None:
            return None

        tenant.name = name
        tenant.slug = slug

        try:
            await self.session.commit()
        except IntegrityError as error:
            await self.session.rollback()
            raise ResourceConflictError("Tenant slug already exists.") from error

        await self.session.refresh(tenant)
        return tenant
