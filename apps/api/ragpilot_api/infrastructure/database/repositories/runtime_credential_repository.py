from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ragpilot_api.infrastructure.database.models import RuntimeCredential


class RuntimeCredentialRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get(self, *, resource_type: str, resource_id: UUID) -> RuntimeCredential | None:
        return await self.session.scalar(select(RuntimeCredential).where(
            RuntimeCredential.resource_type == resource_type, RuntimeCredential.resource_id == resource_id,
        ))

    async def rotate(self, *, resource_type: str, resource_id: UUID, ciphertext: str, nonce: str,
                     secret_hint: str, actor_user_id: UUID | None) -> RuntimeCredential:
        now = datetime.now(timezone.utc)
        credential = await self.get(resource_type=resource_type, resource_id=resource_id)
        if credential is None:
            credential = RuntimeCredential(
                resource_type=resource_type, resource_id=resource_id, ciphertext=ciphertext, nonce=nonce,
                secret_hint=secret_hint, key_version=1, rotated_by_user_id=actor_user_id, rotated_at=now,
            )
            self.session.add(credential)
        else:
            credential.ciphertext = ciphertext
            credential.nonce = nonce
            credential.secret_hint = secret_hint
            credential.key_version += 1
            credential.rotated_by_user_id = actor_user_id
            credential.rotated_at = now
            credential.updated_at = now
        await self.session.commit()
        await self.session.refresh(credential)
        return credential
