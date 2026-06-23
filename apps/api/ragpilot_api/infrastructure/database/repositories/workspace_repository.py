from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from ragpilot_api.application.errors import ResourceConflictError
from ragpilot_api.infrastructure.database.models import Workspace


class WorkspaceRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create_workspace(
        self,
        *,
        tenant_id: UUID,
        name: str,
        slug: str,
        description: str | None,
    ) -> Workspace:
        workspace = Workspace(
            tenant_id=tenant_id,
            name=name,
            slug=slug,
            description=description,
        )
        self.session.add(workspace)

        try:
            await self.session.commit()
        except IntegrityError as error:
            await self.session.rollback()
            raise ResourceConflictError("Workspace slug already exists for this tenant.") from error

        await self.session.refresh(workspace)
        return workspace

    async def list_workspaces(self, *, tenant_id: UUID) -> list[Workspace]:
        result = await self.list_workspaces_with_filters(tenant_id=tenant_id)
        return result

    async def list_workspaces_with_filters(
        self,
        *,
        tenant_id: UUID,
        is_archived: bool | None = None,
    ) -> list[Workspace]:
        statement = (
            select(Workspace)
            .where(Workspace.tenant_id == tenant_id, Workspace.deleted_at.is_(None))
            .order_by(Workspace.created_at.desc())
        )
        if is_archived is not None:
            statement = statement.where(Workspace.is_archived == is_archived)

        result = await self.session.scalars(
            statement
        )
        return list(result)

    async def get_workspace(self, *, workspace_id: UUID, tenant_id: UUID) -> Workspace | None:
        return await self.session.scalar(
            select(Workspace).where(
                Workspace.id == workspace_id,
                Workspace.tenant_id == tenant_id,
                Workspace.deleted_at.is_(None),
            )
        )

    async def get_workspace_by_slug(self, *, tenant_id: UUID, slug: str) -> Workspace | None:
        return await self.session.scalar(
            select(Workspace).where(
                Workspace.tenant_id == tenant_id,
                Workspace.slug == slug,
                Workspace.deleted_at.is_(None),
            )
        )

    async def update_workspace(
        self,
        *,
        workspace_id: UUID,
        tenant_id: UUID,
        name: str,
        slug: str,
        description: str | None,
    ) -> Workspace | None:
        workspace = await self.get_workspace(workspace_id=workspace_id, tenant_id=tenant_id)
        if workspace is None:
            return None

        workspace.name = name
        workspace.slug = slug
        workspace.description = description

        try:
            await self.session.commit()
        except IntegrityError as error:
            await self.session.rollback()
            raise ResourceConflictError("Workspace slug already exists for this tenant.") from error

        await self.session.refresh(workspace)
        return workspace

    async def set_workspace_archive_state(
        self,
        *,
        workspace_id: UUID,
        tenant_id: UUID,
        is_archived: bool,
    ) -> Workspace | None:
        workspace = await self.get_workspace(workspace_id=workspace_id, tenant_id=tenant_id)
        if workspace is None:
            return None

        workspace.is_archived = is_archived
        await self.session.commit()
        await self.session.refresh(workspace)
        return workspace
