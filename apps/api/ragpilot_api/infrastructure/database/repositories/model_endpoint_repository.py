from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from ragpilot_api.application.errors import ResourceConflictError
from ragpilot_api.infrastructure.database.models import ModelEndpoint


class ModelEndpointRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create_model_endpoint(
        self,
        *,
        name: str,
        slug: str,
        provider_type: str,
        model_name: str,
        base_url: str | None,
        credential_mode: str,
        credential_key_hint: str | None,
        capabilities: list[str],
        is_enabled: bool,
        is_default: bool,
        notes: str | None,
    ) -> ModelEndpoint:
        if is_default:
            await self.clear_default_model_endpoint()

        model_endpoint = ModelEndpoint(
            name=name,
            slug=slug,
            provider_type=provider_type,
            model_name=model_name,
            base_url=base_url,
            credential_mode=credential_mode,
            credential_key_hint=credential_key_hint,
            capabilities_json=capabilities,
            is_enabled=is_enabled,
            is_default=is_default,
            notes=notes,
        )
        self.session.add(model_endpoint)

        try:
            await self.session.commit()
        except IntegrityError as error:
            await self.session.rollback()
            raise ResourceConflictError("Model endpoint slug already exists.") from error

        await self.session.refresh(model_endpoint)
        return model_endpoint

    async def list_model_endpoints(
        self,
        *,
        provider_type: str | None = None,
        is_enabled: bool | None = None,
        query: str | None = None,
    ) -> list[ModelEndpoint]:
        statement = select(ModelEndpoint).where(ModelEndpoint.deleted_at.is_(None)).order_by(
            ModelEndpoint.is_default.desc(),
            ModelEndpoint.created_at.desc(),
        )
        if provider_type is not None:
            statement = statement.where(ModelEndpoint.provider_type == provider_type)
        if is_enabled is not None:
            statement = statement.where(ModelEndpoint.is_enabled == is_enabled)
        if query is not None and query.strip():
            normalized_query = f"%{query.strip()}%"
            statement = statement.where(
                or_(
                    ModelEndpoint.name.ilike(normalized_query),
                    ModelEndpoint.slug.ilike(normalized_query),
                    ModelEndpoint.model_name.ilike(normalized_query),
                    ModelEndpoint.provider_type.ilike(normalized_query),
                    ModelEndpoint.base_url.ilike(normalized_query),
                )
            )

        result = await self.session.scalars(statement)
        return list(result)

    async def get_model_endpoint(self, *, model_endpoint_id: UUID) -> ModelEndpoint | None:
        return await self.session.scalar(
            select(ModelEndpoint).where(
                ModelEndpoint.id == model_endpoint_id,
                ModelEndpoint.deleted_at.is_(None),
            )
        )

    async def get_default_model_endpoint(self) -> ModelEndpoint | None:
        return await self.session.scalar(
            select(ModelEndpoint)
            .where(
                ModelEndpoint.deleted_at.is_(None),
                ModelEndpoint.is_default.is_(True),
            )
            .order_by(ModelEndpoint.updated_at.desc(), ModelEndpoint.created_at.desc())
        )

    async def update_model_endpoint(
        self,
        *,
        model_endpoint_id: UUID,
        name: str,
        slug: str,
        provider_type: str,
        model_name: str,
        base_url: str | None,
        credential_mode: str,
        credential_key_hint: str | None,
        capabilities: list[str],
        is_enabled: bool,
        is_default: bool,
        notes: str | None,
    ) -> ModelEndpoint | None:
        model_endpoint = await self.get_model_endpoint(model_endpoint_id=model_endpoint_id)
        if model_endpoint is None:
            return None

        if is_default and not model_endpoint.is_default:
            await self.clear_default_model_endpoint()

        model_endpoint.name = name
        model_endpoint.slug = slug
        model_endpoint.provider_type = provider_type
        model_endpoint.model_name = model_name
        model_endpoint.base_url = base_url
        model_endpoint.credential_mode = credential_mode
        model_endpoint.credential_key_hint = credential_key_hint
        model_endpoint.capabilities_json = capabilities
        model_endpoint.is_enabled = is_enabled
        model_endpoint.is_default = is_default
        model_endpoint.notes = notes
        model_endpoint.updated_at = datetime.now(timezone.utc)

        try:
            await self.session.commit()
        except IntegrityError as error:
            await self.session.rollback()
            raise ResourceConflictError("Model endpoint slug already exists.") from error

        await self.session.refresh(model_endpoint)
        return model_endpoint

    async def delete_model_endpoint(self, *, model_endpoint_id: UUID) -> bool:
        model_endpoint = await self.get_model_endpoint(model_endpoint_id=model_endpoint_id)
        if model_endpoint is None:
            return False

        now = datetime.now(timezone.utc)
        model_endpoint.deleted_at = now
        model_endpoint.updated_at = now
        await self.session.commit()
        return True

    async def clear_default_model_endpoint(self) -> None:
        await self.session.execute(
            update(ModelEndpoint)
            .where(ModelEndpoint.deleted_at.is_(None), ModelEndpoint.is_default.is_(True))
            .values(is_default=False, updated_at=datetime.now(timezone.utc))
        )
        await self.session.flush()
