from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from fastapi import Depends, Header, HTTPException, status

from ragpilot_api.application.identity.access_policy import SUPPORTED_ACTOR_ROLES, role_has_capability
from ragpilot_api.infrastructure.database.repositories.knowledge_base_repository import KnowledgeBaseRepository
from ragpilot_api.infrastructure.database.repositories.user_repository import UserRepository
from ragpilot_api.infrastructure.database.repositories.role_permission_repository import RolePermissionRepository
from ragpilot_api.infrastructure.database.repositories.user_session_repository import UserSessionRepository
from ragpilot_api.infrastructure.database.repositories.workspace_repository import WorkspaceRepository
from ragpilot_api.infrastructure.database.session import get_database_session
from ragpilot_api.shared.settings import get_settings
from sqlalchemy.ext.asyncio import AsyncSession


@dataclass(slots=True)
class RequestActor:
    role: str | None
    user_id: UUID | None
    session_id: UUID | None = None
    active_tenant_ids: tuple[UUID, ...] | None = None


async def get_request_actor(
    authorization: str | None = Header(default=None, alias="Authorization"),
    x_ragpilot_role: str | None = Header(default=None, alias="X-RAGPilot-Role"),
    x_ragpilot_actor_id: UUID | None = Header(default=None, alias="X-RAGPilot-Actor-Id"),
    session: AsyncSession = Depends(get_database_session),
) -> RequestActor:
    settings = get_settings()

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
        active_tenant_ids = tuple(
            membership.membership.tenant_id
            for membership in directory_record.memberships
            if membership.membership.membership_status == "active"
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
            active_tenant_ids=active_tenant_ids,
        )

    normalized_role = x_ragpilot_role.strip() if x_ragpilot_role else None
    if (normalized_role is not None or x_ragpilot_actor_id is not None) and not settings.allow_legacy_actor_headers:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Legacy actor headers are disabled. Use a bearer session token.",
        )

    if normalized_role is not None and normalized_role not in SUPPORTED_ACTOR_ROLES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported actor role header.",
        )

    return RequestActor(role=normalized_role, user_id=x_ragpilot_actor_id, active_tenant_ids=None)


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


def require_current_session_actor(actor: RequestActor, *, detail: str) -> None:
    require_authenticated_actor(actor)

    if actor.session_id is not None:
        return

    if get_settings().allow_legacy_actor_headers:
        return

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
    )


def require_actor_tenant_access(actor: RequestActor, tenant_id: UUID) -> None:
    require_authenticated_actor(actor)

    if actor.role in {"super_admin", "reviewer"}:
        return

    if actor.active_tenant_ids is None:
        return

    if tenant_id not in actor.active_tenant_ids:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Actor does not have access to the requested tenant scope.",
        )


def require_explicit_tenant_scope_for_scoped_actor(actor: RequestActor, *, detail: str) -> None:
    require_authenticated_actor(actor)

    if actor.role in {"super_admin", "reviewer"} or actor.active_tenant_ids is None:
        return

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=detail,
    )


def require_platform_wide_actor_scope(actor: RequestActor, *, detail: str) -> None:
    require_authenticated_actor(actor)

    if actor.role in {"super_admin", "reviewer"} or actor.active_tenant_ids is None:
        return

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail=detail,
    )


async def require_actor_workspace_access(
    actor: RequestActor,
    workspace_id: UUID,
    workspace_repository: WorkspaceRepository,
) -> UUID | None:
    require_authenticated_actor(actor)

    if actor.role in {"super_admin", "reviewer"} or actor.active_tenant_ids is None:
        return None

    workspace = await workspace_repository.get_workspace_by_id(workspace_id=workspace_id)
    if workspace is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found.",
        )

    require_actor_tenant_access(actor, workspace.tenant_id)
    return workspace.tenant_id


async def require_actor_knowledge_base_access(
    actor: RequestActor,
    knowledge_base_id: UUID,
    knowledge_base_repository: KnowledgeBaseRepository,
) -> UUID | None:
    require_authenticated_actor(actor)

    if actor.role in {"super_admin", "reviewer"} or actor.active_tenant_ids is None:
        return None

    knowledge_base = await knowledge_base_repository.get_knowledge_base_by_id(knowledge_base_id=knowledge_base_id)
    if knowledge_base is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Knowledge base not found.",
        )

    require_actor_tenant_access(actor, knowledge_base.tenant_id)
    return knowledge_base.tenant_id


async def require_actor_user_directory_access(
    actor: RequestActor,
    user_id: UUID,
    user_repository: UserRepository,
) -> None:
    require_authenticated_actor(actor)

    if actor.user_id == user_id:
        return

    if actor.role in {"super_admin", "reviewer"} or actor.active_tenant_ids is None:
        return

    directory_record = await user_repository.get_user_directory_record(user_id=user_id)
    if directory_record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    membership_tenant_ids = {
        membership.membership.tenant_id
        for membership in directory_record.memberships
    }
    if not membership_tenant_ids.intersection(actor.active_tenant_ids):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Actor does not have access to the requested member scope.",
        )


async def require_actor_membership_access(
    actor: RequestActor,
    membership_id: UUID,
    user_repository: UserRepository,
) -> UUID | None:
    require_authenticated_actor(actor)

    if actor.role in {"super_admin", "reviewer"} or actor.active_tenant_ids is None:
        return None

    membership = await user_repository.get_tenant_membership(membership_id=membership_id)
    if membership is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Membership not found.",
        )

    require_actor_tenant_access(actor, membership.tenant_id)
    return membership.tenant_id
