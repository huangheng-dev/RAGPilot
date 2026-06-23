from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from fastapi import Depends, Header, HTTPException, status

from ragpilot_api.application.identity.access_policy import SUPPORTED_ACTOR_ROLES, role_has_capability
from ragpilot_api.infrastructure.database.repositories.user_repository import UserRepository
from ragpilot_api.infrastructure.database.repositories.role_permission_repository import RolePermissionRepository
from ragpilot_api.infrastructure.database.repositories.user_session_repository import UserSessionRepository
from ragpilot_api.infrastructure.database.session import get_database_session
from sqlalchemy.ext.asyncio import AsyncSession


@dataclass(slots=True)
class RequestActor:
    role: str | None
    user_id: UUID | None
    session_id: UUID | None = None


async def get_request_actor(
    authorization: str | None = Header(default=None, alias="Authorization"),
    x_ragpilot_role: str | None = Header(default=None, alias="X-RagPilot-Role"),
    x_ragpilot_actor_id: UUID | None = Header(default=None, alias="X-RagPilot-Actor-Id"),
    session: AsyncSession = Depends(get_database_session),
) -> RequestActor:
    if authorization is not None:
        normalized_authorization = authorization.strip()
        if not normalized_authorization.lower().startswith("bearer "):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Unsupported authorization scheme.",
            )

        session_token = normalized_authorization[7:].strip()
        if not session_token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Missing bearer session token.",
            )

        user_session_repository = UserSessionRepository(session)
        user_repository = UserRepository(session)
        user_session_record = await user_session_repository.get_active_user_session_by_token(session_token=session_token)
        if user_session_record is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session is invalid or expired.",
            )

        directory_record = await user_repository.get_user_directory_record(user_id=user_session_record.user.id)
        if directory_record is None or not directory_record.user.is_active:
            await user_session_repository.revoke_user_session(session_id=user_session_record.session.id)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session account is inactive.",
            )

        has_active_membership = any(
            membership.membership.membership_status == "active"
            for membership in directory_record.memberships
        )
        is_bootstrap_super_admin = (
            len(directory_record.memberships) == 0 and directory_record.user.role == "super_admin"
        )
        if not has_active_membership and not is_bootstrap_super_admin:
            await user_session_repository.revoke_user_session(session_id=user_session_record.session.id)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session membership access is inactive.",
            )

        return RequestActor(
            role=directory_record.user.role,
            user_id=directory_record.user.id,
            session_id=user_session_record.session.id,
        )

    normalized_role = x_ragpilot_role.strip() if x_ragpilot_role else None
    if normalized_role is not None and normalized_role not in SUPPORTED_ACTOR_ROLES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported actor role header.",
        )

    return RequestActor(role=normalized_role, user_id=x_ragpilot_actor_id)


def require_actor_capability(actor: RequestActor, capability: str) -> None:
    if actor.role is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing actor role header.",
        )

    if not role_has_capability(actor.role, capability):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Actor does not have the required capability.",
        )


async def require_actor_capability_from_policy(
    actor: RequestActor,
    capability: str,
    role_permission_repository: RolePermissionRepository,
) -> None:
    if actor.role is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing actor role header.",
        )

    try:
        role_capability_grants = await role_permission_repository.list_role_permission_slugs()
    except Exception:
        role_capability_grants = {}

    role_grants = role_capability_grants.get(actor.role)
    has_capability = capability in role_grants if role_grants else role_has_capability(actor.role, capability)
    if not has_capability:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Actor does not have the required capability.",
        )


async def require_actor_self_or_capability_from_policy(
    actor: RequestActor,
    user_id: UUID,
    capability: str,
    role_permission_repository: RolePermissionRepository,
) -> None:
    if actor.role is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing actor role header.",
        )

    if actor.user_id == user_id:
        return

    await require_actor_capability_from_policy(actor, capability, role_permission_repository)


def require_actor_self_or_capability(actor: RequestActor, user_id: UUID, capability: str) -> None:
    if actor.role is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing actor role header.",
        )

    if actor.user_id == user_id:
        return

    require_actor_capability(actor, capability)


def require_authenticated_actor(actor: RequestActor) -> None:
    if actor.role is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing actor role header.",
        )

    if actor.user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing actor user header.",
        )
