from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from ragpilot_api.application.errors import ResourceConflictError
from ragpilot_api.infrastructure.database.models import ToolRegistration


class ToolRegistrationRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create_tool_registration(
        self,
        *,
        name: str,
        slug: str,
        transport_type: str,
        surface_area: str,
        endpoint_url: str | None,
        connector_reference: str | None,
        description: str | None,
        capabilities: list[str],
        requires_admin_approval: bool,
        is_enabled: bool,
    ) -> ToolRegistration:
        tool_registration = ToolRegistration(
            name=name,
            slug=slug,
            transport_type=transport_type,
            surface_area=surface_area,
            endpoint_url=endpoint_url,
            connector_reference=connector_reference,
            description=description,
            capabilities_json=capabilities,
            requires_admin_approval=requires_admin_approval,
            is_enabled=is_enabled,
        )
        self.session.add(tool_registration)

        try:
            await self.session.commit()
        except IntegrityError as error:
            await self.session.rollback()
            raise ResourceConflictError("Tool registration slug already exists.") from error

        await self.session.refresh(tool_registration)
        return tool_registration

    async def list_tool_registrations(
        self,
        *,
        transport_type: str | None = None,
        surface_area: str | None = None,
        is_enabled: bool | None = None,
        requires_admin_approval: bool | None = None,
        query: str | None = None,
    ) -> list[ToolRegistration]:
        statement = select(ToolRegistration).where(ToolRegistration.deleted_at.is_(None)).order_by(
            ToolRegistration.created_at.desc()
        )
        if transport_type is not None:
            statement = statement.where(ToolRegistration.transport_type == transport_type)
        if surface_area is not None:
            statement = statement.where(ToolRegistration.surface_area == surface_area)
        if is_enabled is not None:
            statement = statement.where(ToolRegistration.is_enabled == is_enabled)
        if requires_admin_approval is not None:
            statement = statement.where(ToolRegistration.requires_admin_approval == requires_admin_approval)
        if query is not None and query.strip():
            normalized_query = f"%{query.strip()}%"
            statement = statement.where(
                or_(
                    ToolRegistration.name.ilike(normalized_query),
                    ToolRegistration.slug.ilike(normalized_query),
                    ToolRegistration.transport_type.ilike(normalized_query),
                    ToolRegistration.surface_area.ilike(normalized_query),
                    ToolRegistration.endpoint_url.ilike(normalized_query),
                    ToolRegistration.connector_reference.ilike(normalized_query),
                )
            )

        result = await self.session.scalars(statement)
        return list(result)

    async def get_tool_registration(self, *, tool_registration_id: UUID) -> ToolRegistration | None:
        return await self.session.scalar(
            select(ToolRegistration).where(
                ToolRegistration.id == tool_registration_id,
                ToolRegistration.deleted_at.is_(None),
            )
        )

    async def update_tool_registration(
        self,
        *,
        tool_registration_id: UUID,
        name: str,
        slug: str,
        transport_type: str,
        surface_area: str,
        endpoint_url: str | None,
        connector_reference: str | None,
        description: str | None,
        capabilities: list[str],
        requires_admin_approval: bool,
        is_enabled: bool,
    ) -> ToolRegistration | None:
        tool_registration = await self.get_tool_registration(tool_registration_id=tool_registration_id)
        if tool_registration is None:
            return None

        tool_registration.name = name
        tool_registration.slug = slug
        tool_registration.transport_type = transport_type
        tool_registration.surface_area = surface_area
        tool_registration.endpoint_url = endpoint_url
        tool_registration.connector_reference = connector_reference
        tool_registration.description = description
        tool_registration.capabilities_json = capabilities
        tool_registration.requires_admin_approval = requires_admin_approval
        tool_registration.is_enabled = is_enabled
        tool_registration.updated_at = datetime.now(timezone.utc)

        try:
            await self.session.commit()
        except IntegrityError as error:
            await self.session.rollback()
            raise ResourceConflictError("Tool registration slug already exists.") from error

        await self.session.refresh(tool_registration)
        return tool_registration

    async def delete_tool_registration(self, *, tool_registration_id: UUID) -> bool:
        tool_registration = await self.get_tool_registration(tool_registration_id=tool_registration_id)
        if tool_registration is None:
            return False

        now = datetime.now(timezone.utc)
        tool_registration.deleted_at = now
        tool_registration.updated_at = now
        await self.session.commit()
        return True
