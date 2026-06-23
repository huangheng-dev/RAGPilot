from __future__ import annotations

import hashlib
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ragpilot_api.infrastructure.database.models import User, UserSession


@dataclass(slots=True)
class UserSessionRecord:
    session: UserSession
    user: User


class UserSessionRepository:
    SESSION_EXPIRATION_DAYS = 14

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    @staticmethod
    def hash_session_token(token: str) -> str:
        return hashlib.sha256(token.encode("utf-8")).hexdigest()

    @staticmethod
    def generate_session_token() -> str:
        return f"rp_sess_{secrets.token_urlsafe(32)}"

    @classmethod
    def generate_session_expiration(cls) -> datetime:
        return datetime.now(timezone.utc) + timedelta(days=cls.SESSION_EXPIRATION_DAYS)

    async def create_user_session(
        self,
        *,
        user_id: UUID,
        authentication_mode: str,
    ) -> tuple[UserSession, str]:
        session_token = self.generate_session_token()
        user_session = UserSession(
            user_id=user_id,
            session_token_hash=self.hash_session_token(session_token),
            authentication_mode=authentication_mode,
            expires_at=self.generate_session_expiration(),
        )
        self.session.add(user_session)
        await self.session.commit()
        await self.session.refresh(user_session)
        return user_session, session_token

    async def get_active_user_session_by_token(self, *, session_token: str) -> UserSessionRecord | None:
        statement = (
            select(UserSession, User)
            .join(User, User.id == UserSession.user_id)
            .where(
                UserSession.session_token_hash == self.hash_session_token(session_token),
                UserSession.revoked_at.is_(None),
                UserSession.expires_at > datetime.now(timezone.utc),
                User.deleted_at.is_(None),
            )
        )
        row = (await self.session.execute(statement)).first()
        if row is None:
            return None

        user_session, user = row
        return UserSessionRecord(session=user_session, user=user)

    async def revoke_user_session(self, *, session_id: UUID) -> UserSession | None:
        user_session = await self.session.scalar(select(UserSession).where(UserSession.id == session_id))
        if user_session is None:
            return None

        if user_session.revoked_at is None:
            user_session.revoked_at = datetime.now(timezone.utc)
            await self.session.commit()
            await self.session.refresh(user_session)
        return user_session
