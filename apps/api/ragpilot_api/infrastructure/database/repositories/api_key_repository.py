from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ragpilot_api.infrastructure.database.models import ApiKey, ApiKeyEvent


class ApiKeyRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(
        self, *, tenant_id: UUID, name: str, key_prefix: str, key_hash: str, role: str,
        scopes: list[str], created_by_user_id: UUID | None, expires_at: datetime | None,
    ) -> ApiKey:
        item = ApiKey(
            tenant_id=tenant_id, name=name, key_prefix=key_prefix, key_hash=key_hash,
            role=role, scopes_json=scopes, created_by_user_id=created_by_user_id, expires_at=expires_at,
        )
        self.session.add(item)
        await self.session.flush()
        self.session.add(ApiKeyEvent(
            api_key_id=item.id, tenant_id=tenant_id, event_type="created",
            actor_user_id=created_by_user_id, metadata_json={"role": role, "scopes": scopes},
        ))
        await self.session.commit()
        await self.session.refresh(item)
        return item

    async def list(self, *, tenant_id: UUID) -> list[ApiKey]:
        result = await self.session.scalars(
            select(ApiKey).where(ApiKey.tenant_id == tenant_id).order_by(ApiKey.created_at.desc())
        )
        return list(result)

    async def get(self, *, api_key_id: UUID, tenant_id: UUID) -> ApiKey | None:
        return await self.session.scalar(select(ApiKey).where(ApiKey.id == api_key_id, ApiKey.tenant_id == tenant_id))

    async def get_by_prefix(self, *, key_prefix: str) -> ApiKey | None:
        return await self.session.scalar(select(ApiKey).where(ApiKey.key_prefix == key_prefix))

    async def mark_used(self, *, item: ApiKey) -> None:
        item.last_used_at = datetime.now(timezone.utc)
        item.updated_at = item.last_used_at
        await self.session.commit()

    async def revoke(self, *, item: ApiKey, actor_user_id: UUID | None, reason: str | None) -> ApiKey:
        if item.revoked_at is None:
            item.revoked_at = datetime.now(timezone.utc)
            item.updated_at = item.revoked_at
            self.session.add(ApiKeyEvent(
                api_key_id=item.id, tenant_id=item.tenant_id, event_type="revoked",
                actor_user_id=actor_user_id, metadata_json={"reason": reason} if reason else {},
            ))
            await self.session.commit()
            await self.session.refresh(item)
        return item
