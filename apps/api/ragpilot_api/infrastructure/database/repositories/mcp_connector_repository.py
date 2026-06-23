from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from ragpilot_api.application.errors import ResourceConflictError
from ragpilot_api.infrastructure.database.models import McpConnector


class McpConnectorRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create_mcp_connector(
        self,
        *,
        name: str,
        slug: str,
        connector_type: str,
        base_url: str | None,
        auth_mode: str,
        credential_key_hint: str | None,
        notes: str | None,
        is_enabled: bool,
    ) -> McpConnector:
        mcp_connector = McpConnector(
            name=name,
            slug=slug,
            connector_type=connector_type,
            base_url=base_url,
            auth_mode=auth_mode,
            credential_key_hint=credential_key_hint,
            notes=notes,
            is_enabled=is_enabled,
        )
        self.session.add(mcp_connector)

        try:
            await self.session.commit()
        except IntegrityError as error:
            await self.session.rollback()
            raise ResourceConflictError("MCP connector slug already exists.") from error

        await self.session.refresh(mcp_connector)
        return mcp_connector

    async def list_mcp_connectors(
        self,
        *,
        connector_type: str | None = None,
        is_enabled: bool | None = None,
        query: str | None = None,
    ) -> list[McpConnector]:
        statement = select(McpConnector).where(McpConnector.deleted_at.is_(None)).order_by(
            McpConnector.created_at.desc(),
        )
        if connector_type is not None:
            statement = statement.where(McpConnector.connector_type == connector_type)
        if is_enabled is not None:
            statement = statement.where(McpConnector.is_enabled == is_enabled)
        if query is not None and query.strip():
            normalized_query = f"%{query.strip()}%"
            statement = statement.where(
                or_(
                    McpConnector.name.ilike(normalized_query),
                    McpConnector.slug.ilike(normalized_query),
                    McpConnector.base_url.ilike(normalized_query),
                    McpConnector.credential_key_hint.ilike(normalized_query),
                )
            )

        result = await self.session.scalars(statement)
        return list(result)

    async def get_mcp_connector(self, *, mcp_connector_id: UUID) -> McpConnector | None:
        return await self.session.scalar(
            select(McpConnector).where(
                McpConnector.id == mcp_connector_id,
                McpConnector.deleted_at.is_(None),
            )
        )

    async def get_mcp_connector_by_slug(self, *, connector_slug: str) -> McpConnector | None:
        return await self.session.scalar(
            select(McpConnector).where(
                McpConnector.slug == connector_slug,
                McpConnector.deleted_at.is_(None),
            )
        )

    async def update_mcp_connector(
        self,
        *,
        mcp_connector_id: UUID,
        name: str,
        slug: str,
        connector_type: str,
        base_url: str | None,
        auth_mode: str,
        credential_key_hint: str | None,
        notes: str | None,
        is_enabled: bool,
    ) -> McpConnector | None:
        mcp_connector = await self.get_mcp_connector(mcp_connector_id=mcp_connector_id)
        if mcp_connector is None:
            return None

        mcp_connector.name = name
        mcp_connector.slug = slug
        mcp_connector.connector_type = connector_type
        mcp_connector.base_url = base_url
        mcp_connector.auth_mode = auth_mode
        mcp_connector.credential_key_hint = credential_key_hint
        mcp_connector.notes = notes
        mcp_connector.is_enabled = is_enabled
        mcp_connector.updated_at = datetime.now(timezone.utc)

        try:
            await self.session.commit()
        except IntegrityError as error:
            await self.session.rollback()
            raise ResourceConflictError("MCP connector slug already exists.") from error

        await self.session.refresh(mcp_connector)
        return mcp_connector

    async def delete_mcp_connector(self, *, mcp_connector_id: UUID) -> bool:
        mcp_connector = await self.get_mcp_connector(mcp_connector_id=mcp_connector_id)
        if mcp_connector is None:
            return False

        now = datetime.now(timezone.utc)
        mcp_connector.deleted_at = now
        mcp_connector.updated_at = now
        await self.session.commit()
        return True
