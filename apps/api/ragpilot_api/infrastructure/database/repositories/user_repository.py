from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone
from dataclasses import dataclass
from typing import Any
from uuid import UUID

from sqlalchemy import and_, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from ragpilot_api.application.errors import ResourceConflictError
from ragpilot_api.infrastructure.database.models import Tenant, TenantMembership, User, UserAccessEvent


@dataclass(slots=True)
class UserMembershipDirectoryRecord:
    membership: TenantMembership
    tenant: Tenant
    invitation_issuer: User | None = None


@dataclass(slots=True)
class UserDirectoryRecord:
    user: User
    memberships: list[UserMembershipDirectoryRecord]


@dataclass(slots=True)
class UserAccessEventRecord:
    event: UserAccessEvent
    user: User
    actor: User | None
    tenant: Tenant | None


class UserRepository:
    INVITATION_EXPIRATION_DAYS = 7

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    @staticmethod
    def generate_invitation_token() -> str:
        return f"RP-{secrets.token_hex(4).upper()}"

    @classmethod
    def generate_invitation_expiration(cls) -> datetime:
        return datetime.now(timezone.utc) + timedelta(days=cls.INVITATION_EXPIRATION_DAYS)

    async def count_users(self) -> int:
        statement = select(func.count()).select_from(User).where(User.deleted_at.is_(None))
        return int(await self.session.scalar(statement) or 0)

    async def create_user(self, *, email: str, display_name: str, is_active: bool, role: str) -> User:
        user = User(
            email=email.strip().lower(),
            display_name=display_name.strip(),
            is_active=is_active,
            role=role,
        )
        self.session.add(user)

        try:
            await self.session.commit()
        except IntegrityError as error:
            await self.session.rollback()
            raise ResourceConflictError("User email already exists.") from error

        await self.session.refresh(user)
        return user

    async def get_user(self, *, user_id: UUID) -> User | None:
        return await self.session.scalar(select(User).where(User.id == user_id, User.deleted_at.is_(None)))

    async def get_user_by_email(self, *, email: str) -> User | None:
        return await self.session.scalar(
            select(User).where(
                User.email == email.strip().lower(),
                User.deleted_at.is_(None),
            )
        )

    async def get_user_directory_record(self, *, user_id: UUID) -> UserDirectoryRecord | None:
        user = await self.get_user(user_id=user_id)
        if user is None:
            return None

        invitation_issuer = aliased(User)
        membership_statement = (
            select(TenantMembership, Tenant, invitation_issuer)
            .join(Tenant, and_(Tenant.id == TenantMembership.tenant_id, Tenant.deleted_at.is_(None)))
            .outerjoin(invitation_issuer, invitation_issuer.id == TenantMembership.last_invitation_issued_by_user_id)
            .where(TenantMembership.user_id == user_id)
            .order_by(TenantMembership.created_at.desc())
        )
        membership_rows = await self.session.execute(membership_statement)
        memberships = [
            UserMembershipDirectoryRecord(membership=membership, tenant=tenant, invitation_issuer=issuer)
            for membership, tenant, issuer in membership_rows.all()
        ]
        return UserDirectoryRecord(user=user, memberships=memberships)

    async def list_users(
        self,
        *,
        tenant_id: UUID | None = None,
        membership_status: str | None = None,
        query: str | None = None,
        email: str | None = None,
        is_active: bool | None = None,
    ) -> list[UserDirectoryRecord]:
        statement = select(User).where(User.deleted_at.is_(None))

        if tenant_id is not None or membership_status is not None:
            statement = statement.join(TenantMembership, TenantMembership.user_id == User.id)

        if tenant_id is not None:
            statement = statement.where(TenantMembership.tenant_id == tenant_id)
        if membership_status is not None:
            statement = statement.where(TenantMembership.membership_status == membership_status)
        if query and query.strip():
            pattern = f"%{query.strip()}%"
            statement = statement.where(
                or_(
                    User.display_name.ilike(pattern),
                    User.email.ilike(pattern),
                )
            )
        if email and email.strip():
            statement = statement.where(User.email == email.strip().lower())
        if is_active is not None:
            statement = statement.where(User.is_active.is_(is_active))

        statement = statement.distinct().order_by(User.created_at.desc())
        users = list(await self.session.scalars(statement))
        if not users:
            return []

        user_ids = [user.id for user in users]
        invitation_issuer = aliased(User)
        membership_statement = (
            select(TenantMembership, Tenant, invitation_issuer)
            .join(Tenant, and_(Tenant.id == TenantMembership.tenant_id, Tenant.deleted_at.is_(None)))
            .outerjoin(invitation_issuer, invitation_issuer.id == TenantMembership.last_invitation_issued_by_user_id)
            .where(TenantMembership.user_id.in_(user_ids))
            .order_by(TenantMembership.created_at.desc())
        )
        if tenant_id is not None:
            membership_statement = membership_statement.where(TenantMembership.tenant_id == tenant_id)
        if membership_status is not None:
            membership_statement = membership_statement.where(TenantMembership.membership_status == membership_status)

        membership_rows = await self.session.execute(membership_statement)
        memberships_by_user_id: dict[UUID, list[UserMembershipDirectoryRecord]] = {}
        for membership, tenant, issuer in membership_rows.all():
            memberships_by_user_id.setdefault(membership.user_id, []).append(
                UserMembershipDirectoryRecord(membership=membership, tenant=tenant, invitation_issuer=issuer)
            )

        return [
            UserDirectoryRecord(
                user=user,
                memberships=memberships_by_user_id.get(user.id, []),
            )
            for user in users
        ]

    async def update_user(
        self,
        *,
        user_id: UUID,
        email: str,
        display_name: str,
        is_active: bool,
        role: str | None = None,
    ) -> User | None:
        user = await self.get_user(user_id=user_id)
        if user is None:
            return None

        user.email = email.strip().lower()
        user.display_name = display_name.strip()
        user.is_active = is_active
        if role is not None:
            user.role = role

        try:
            await self.session.commit()
        except IntegrityError as error:
            await self.session.rollback()
            raise ResourceConflictError("User email already exists.") from error

        await self.session.refresh(user)
        return user

    async def update_user_active_state(self, *, user_id: UUID, is_active: bool) -> User | None:
        user = await self.get_user(user_id=user_id)
        if user is None:
            return None

        user.is_active = is_active
        await self.session.commit()
        await self.session.refresh(user)
        return user

    async def update_user_last_signed_in_at(self, *, user_id: UUID) -> User | None:
        user = await self.get_user(user_id=user_id)
        if user is None:
            return None

        user.last_signed_in_at = datetime.now(timezone.utc)
        await self.session.commit()
        await self.session.refresh(user)
        return user

    async def create_tenant_membership(
        self,
        *,
        tenant_id: UUID,
        user_id: UUID,
        membership_status: str,
        invitation_issued_by_user_id: UUID | None = None,
    ) -> TenantMembership:
        is_invited = membership_status == "invited"
        is_active = membership_status == "active"
        membership = TenantMembership(
            tenant_id=tenant_id,
            user_id=user_id,
            membership_status=membership_status,
            invitation_token=self.generate_invitation_token() if is_invited else None,
            invitation_issue_count=1 if is_invited else 0,
            last_invitation_issued_by_user_id=invitation_issued_by_user_id if is_invited else None,
            invited_at=datetime.now(timezone.utc) if is_invited else None,
            invitation_expires_at=self.generate_invitation_expiration() if is_invited else None,
            activated_at=datetime.now(timezone.utc) if is_active else None,
        )
        self.session.add(membership)

        try:
            await self.session.commit()
        except IntegrityError as error:
            await self.session.rollback()
            raise ResourceConflictError("Tenant membership already exists for this user.") from error

        await self.session.refresh(membership)
        return membership

    async def get_tenant_membership(self, *, membership_id: UUID) -> TenantMembership | None:
        return await self.session.scalar(select(TenantMembership).where(TenantMembership.id == membership_id))

    async def list_tenant_memberships_for_user(self, *, user_id: UUID) -> list[TenantMembership]:
        statement = select(TenantMembership).where(TenantMembership.user_id == user_id).order_by(TenantMembership.created_at.desc())
        return list(await self.session.scalars(statement))

    async def update_tenant_membership_status(
        self,
        *,
        membership_id: UUID,
        membership_status: str,
        invitation_issued_by_user_id: UUID | None = None,
    ) -> TenantMembership | None:
        membership = await self.get_tenant_membership(membership_id=membership_id)
        if membership is None:
            return None

        membership.membership_status = membership_status
        if membership_status == "invited":
            membership.invitation_token = self.generate_invitation_token()
            membership.invitation_issue_count = int(membership.invitation_issue_count or 0) + 1
            membership.last_invitation_issued_by_user_id = invitation_issued_by_user_id
            membership.invited_at = datetime.now(timezone.utc)
            membership.invitation_expires_at = self.generate_invitation_expiration()
            membership.activated_at = None
        elif membership_status == "active":
            membership.invitation_token = None
            membership.invitation_expires_at = None
            membership.activated_at = datetime.now(timezone.utc)
        else:
            membership.invitation_token = None
            membership.invitation_expires_at = None
        await self.session.commit()
        await self.session.refresh(membership)
        return membership

    async def refresh_tenant_membership_invitation(
        self,
        *,
        membership_id: UUID,
        invitation_issued_by_user_id: UUID | None = None,
    ) -> TenantMembership | None:
        membership = await self.get_tenant_membership(membership_id=membership_id)
        if membership is None:
            return None

        membership.membership_status = "invited"
        membership.invitation_token = self.generate_invitation_token()
        membership.invitation_issue_count = int(membership.invitation_issue_count or 0) + 1
        membership.last_invitation_issued_by_user_id = invitation_issued_by_user_id
        membership.invited_at = datetime.now(timezone.utc)
        membership.invitation_expires_at = self.generate_invitation_expiration()
        membership.activated_at = None
        await self.session.commit()
        await self.session.refresh(membership)
        return membership

    async def delete_tenant_membership(self, *, membership_id: UUID) -> bool:
        membership = await self.get_tenant_membership(membership_id=membership_id)
        if membership is None:
            return False

        await self.session.delete(membership)
        await self.session.commit()
        return True

    async def create_user_access_event(
        self,
        *,
        user_id: UUID,
        event_type: str,
        tenant_id: UUID | None = None,
        membership_id: UUID | None = None,
        actor_user_id: UUID | None = None,
        detail_json: dict[str, Any] | None = None,
    ) -> UserAccessEvent:
        event = UserAccessEvent(
            tenant_id=tenant_id,
            user_id=user_id,
            membership_id=membership_id,
            actor_user_id=actor_user_id,
            event_type=event_type,
            detail_json=detail_json or {},
        )
        self.session.add(event)
        await self.session.commit()
        await self.session.refresh(event)
        return event

    async def list_user_access_events(
        self,
        *,
        tenant_id: UUID | None = None,
        user_id: UUID | None = None,
        event_type: str | None = None,
        limit: int = 20,
    ) -> list[UserAccessEventRecord]:
        actor = aliased(User)
        statement = (
            select(UserAccessEvent, User, actor, Tenant)
            .join(User, User.id == UserAccessEvent.user_id)
            .outerjoin(actor, actor.id == UserAccessEvent.actor_user_id)
            .outerjoin(Tenant, Tenant.id == UserAccessEvent.tenant_id)
            .order_by(UserAccessEvent.created_at.desc())
            .limit(limit)
        )
        if tenant_id is not None:
            statement = statement.where(UserAccessEvent.tenant_id == tenant_id)
        if user_id is not None:
            statement = statement.where(UserAccessEvent.user_id == user_id)
        if event_type is not None:
            statement = statement.where(UserAccessEvent.event_type == event_type)

        rows = await self.session.execute(statement)
        return [
            UserAccessEventRecord(event=event, user=user, actor=event_actor, tenant=tenant)
            for event, user, event_actor, tenant in rows.all()
        ]
