from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy.exc import SQLAlchemyError

from ragpilot_api.application.errors import ResourceConflictError, ResourceNotFoundError
from ragpilot_api.application.identity.access_policy import build_session_capabilities, build_session_capabilities_from_grants
from ragpilot_api.contracts.http.user_contracts import (
    UserAccessEventResponse,
    UserAuthenticatedSessionResponse,
    UserBootstrapRequest,
    UserBootstrapStatusResponse,
    UserCreateRequest,
    UserDirectoryResponse,
    UserInvitationActivationRequest,
    UserLoginAssessmentResponse,
    UserLoginRequest,
    UserMembershipCreateRequest,
    UserMembershipInvitationIssueRequest,
    UserMembershipInvitationRevokeRequest,
    UserMembershipInvitationResponse,
    UserMembershipResponse,
    UserSessionResponse,
    UserMembershipUpdateRequest,
    UserPermissionResponse,
    UserUpdateRequest,
)
from ragpilot_api.infrastructure.database.repositories.role_permission_repository import RolePermissionRepository
from ragpilot_api.infrastructure.database.repositories.tenant_repository import TenantRepository
from ragpilot_api.infrastructure.database.repositories.user_repository import (
    UserAccessEventRecord,
    UserDirectoryRecord,
    UserMembershipDirectoryRecord,
    UserRepository,
)
from ragpilot_api.infrastructure.database.repositories.user_session_repository import UserSessionRepository


class UserService:
    def __init__(
        self,
        user_repository: UserRepository,
        user_session_repository: UserSessionRepository | None,
        tenant_repository: TenantRepository,
        role_permission_repository: RolePermissionRepository | None = None,
    ) -> None:
        self.user_repository = user_repository
        self.user_session_repository = user_session_repository
        self.tenant_repository = tenant_repository
        self.role_permission_repository = role_permission_repository

    async def create_user(self, request: UserCreateRequest, *, actor_user_id: UUID | None = None) -> UserDirectoryResponse:
        if request.tenant_id is not None:
            tenant = await self.tenant_repository.get_tenant(tenant_id=request.tenant_id)
            if tenant is None:
                raise ResourceNotFoundError("Tenant not found.")

        user = await self.user_repository.create_user(
            email=request.email,
            display_name=request.display_name,
            is_active=request.is_active,
            role=request.role,
        )
        if request.tenant_id is not None:
            membership = await self.user_repository.create_tenant_membership(
                tenant_id=request.tenant_id,
                user_id=user.id,
                membership_status=request.membership_status,
                invitation_issued_by_user_id=actor_user_id,
            )
            if request.membership_status == "invited":
                await self.user_repository.create_user_access_event(
                    user_id=user.id,
                    tenant_id=membership.tenant_id,
                    membership_id=membership.id,
                    actor_user_id=actor_user_id,
                    event_type="invitation_issued",
                    detail_json={"membership_status": "invited", "invitation_issue_count": membership.invitation_issue_count},
                )

        return await self.get_user_directory_entry(user.id)

    async def bootstrap_user(self, request: UserBootstrapRequest) -> UserDirectoryResponse:
        existing_user = await self.user_repository.get_user_by_email(email=request.email)
        if existing_user is not None:
            return await self.get_user_directory_entry(existing_user.id)

        is_first_user = await self.user_repository.count_users() == 0
        if not is_first_user:
            raise ResourceConflictError(
                "Directory bootstrap is closed. Ask an administrator to invite this member before signing in."
            )

        user = await self.user_repository.create_user(
            email=request.email,
            display_name=request.display_name,
            is_active=True,
            role="super_admin",
        )
        return await self.get_user_directory_entry(user.id)

    async def get_bootstrap_status(self) -> UserBootstrapStatusResponse:
        has_users = await self.user_repository.count_users() > 0
        return UserBootstrapStatusResponse(
            has_users=has_users,
            allow_initial_super_admin=not has_users,
        )

    def build_user_permissions(self, user: UserDirectoryResponse) -> UserPermissionResponse:
        active_tenant_ids, has_active_membership, can_use_session = self._resolve_permission_context(user)
        return UserPermissionResponse(
            user_id=user.id,
            role=user.role,
            has_active_membership=has_active_membership,
            active_tenant_ids=active_tenant_ids,
            capabilities=build_session_capabilities(role=user.role, can_use_session=can_use_session),
        )

    async def build_user_permissions_from_policy(self, user: UserDirectoryResponse) -> UserPermissionResponse:
        active_tenant_ids, has_active_membership, can_use_session = self._resolve_permission_context(user)
        if self.role_permission_repository is None:
            return self.build_user_permissions(user)

        try:
            role_capability_grants = await self.role_permission_repository.list_role_permission_slugs()
        except SQLAlchemyError:
            return self.build_user_permissions(user)

        if not role_capability_grants.get(user.role):
            return self.build_user_permissions(user)

        return UserPermissionResponse(
            user_id=user.id,
            role=user.role,
            has_active_membership=has_active_membership,
            active_tenant_ids=active_tenant_ids,
            capabilities=build_session_capabilities_from_grants(
                role=user.role,
                can_use_session=can_use_session,
                role_capability_grants=role_capability_grants,
            ),
        )

    def _resolve_permission_context(self, user: UserDirectoryResponse) -> tuple[list[UUID], bool, bool]:
        active_tenant_ids = [
            membership.tenant_id for membership in user.memberships if membership.membership_status == "active"
        ]
        has_active_membership = len(active_tenant_ids) > 0
        is_bootstrap_super_admin = len(user.memberships) == 0 and user.role == "super_admin"
        can_use_session = user.is_active and (has_active_membership or is_bootstrap_super_admin)
        return active_tenant_ids, has_active_membership, can_use_session

    async def assess_login_user(self, *, email: str) -> UserLoginAssessmentResponse:
        normalized_email = email.strip().lower()
        has_users = await self.user_repository.count_users() > 0
        user = await self.user_repository.get_user_by_email(email=normalized_email)

        if user is None:
            return UserLoginAssessmentResponse(
                email=normalized_email,
                has_users=has_users,
                user_exists=False,
                account_state="bootstrap_available" if not has_users else "not_found",
                allow_sign_in=not has_users,
                next_action="bootstrap" if not has_users else "contact_admin",
            )

        directory_user = await self.get_user_directory_entry(user.id)
        current_time = datetime.now(timezone.utc)
        active_membership_count = sum(
            1 for membership in directory_user.memberships if membership.membership_status == "active"
        )
        invited_membership_count = sum(
            1 for membership in directory_user.memberships if membership.membership_status == "invited"
        )
        suspended_membership_count = sum(
            1 for membership in directory_user.memberships if membership.membership_status == "suspended"
        )
        expired_invitation_count = sum(
            1
            for membership in directory_user.memberships
            if membership.membership_status == "invited"
            and membership.invitation_expires_at is not None
            and membership.invitation_expires_at <= current_time
        )
        expiring_threshold = current_time + timedelta(days=3)
        expiring_invitation_count = sum(
            1
            for membership in directory_user.memberships
            if membership.membership_status == "invited"
            and membership.invitation_expires_at is not None
            and current_time < membership.invitation_expires_at <= expiring_threshold
        )

        if not directory_user.is_active:
            account_state = "inactive_account"
            allow_sign_in = False
            next_action = "contact_admin"
        elif active_membership_count > 0 or (len(directory_user.memberships) == 0 and directory_user.role == "super_admin"):
            account_state = "ready"
            allow_sign_in = True
            next_action = "sign_in"
        elif invited_membership_count > 0:
            account_state = "invited"
            allow_sign_in = False
            next_action = "activate_invitation"
        else:
            account_state = "inactive_membership"
            allow_sign_in = False
            next_action = "contact_admin"

        return UserLoginAssessmentResponse(
            email=directory_user.email,
            has_users=has_users,
            user_exists=True,
            is_active=directory_user.is_active,
            role=directory_user.role,
            account_state=account_state,
            allow_sign_in=allow_sign_in,
            next_action=next_action,
            active_membership_count=active_membership_count,
            invited_membership_count=invited_membership_count,
            suspended_membership_count=suspended_membership_count,
            expired_invitation_count=expired_invitation_count,
            expiring_invitation_count=expiring_invitation_count,
            memberships=directory_user.memberships,
        )

    async def login_user(self, request: UserLoginRequest) -> UserAuthenticatedSessionResponse:
        user = await self.user_repository.get_user_by_email(email=request.email)
        if user is None:
            directory_user = await self.bootstrap_user(
                UserBootstrapRequest(email=request.email, display_name=request.display_name)
            )
            return await self._issue_authenticated_session(
                user_id=directory_user.id,
                login_mode="bootstrap",
            )

        directory_user = await self.get_user_directory_entry(user.id)
        self.ensure_login_allowed(directory_user)
        return await self._issue_authenticated_session(
            user_id=user.id,
            login_mode="directory",
        )

    async def activate_user_invitations(self, request: UserInvitationActivationRequest) -> UserAuthenticatedSessionResponse:
        user = await self.user_repository.get_user_by_email(email=request.email)
        if user is None:
            raise ResourceNotFoundError("User not found.")

        memberships = await self.user_repository.list_tenant_memberships_for_user(user_id=user.id)
        normalized_token = request.invitation_token.strip().upper()
        available_invited_memberships = [
            membership for membership in memberships if membership.membership_status == "invited"
        ]
        invited_memberships = [
            membership
            for membership in available_invited_memberships
            if (membership.invitation_token or "").strip().upper() == normalized_token
        ]
        has_active_membership = any(membership.membership_status == "active" for membership in memberships)

        if not available_invited_memberships and not has_active_membership:
            raise ResourceConflictError("No invited memberships are available to activate.")
        if not invited_memberships:
            raise ResourceConflictError("Invitation token is not valid for this member.")

        current_time = datetime.now(timezone.utc)
        activatable_memberships = [
            membership
            for membership in invited_memberships
            if membership.invitation_expires_at is None or membership.invitation_expires_at > current_time
        ]
        if not activatable_memberships:
            raise ResourceConflictError("Invitation token has expired. Ask an administrator to issue a new code.")

        if not user.is_active:
            await self.user_repository.update_user_active_state(user_id=user.id, is_active=True)

        for membership in activatable_memberships:
            await self.user_repository.update_tenant_membership_status(
                membership_id=membership.id,
                membership_status="active",
            )
            await self.user_repository.create_user_access_event(
                user_id=user.id,
                tenant_id=membership.tenant_id,
                membership_id=membership.id,
                event_type="invitation_activated",
                detail_json={"membership_status": "active"},
            )

        return await self._issue_authenticated_session(
            user_id=user.id,
            login_mode="invitation_activation",
        )

    async def revoke_current_session(
        self,
        *,
        user_id: UUID,
        session_id: UUID,
    ) -> None:
        if self.user_session_repository is None:
            raise RuntimeError("User session repository is required for authenticated sign-out.")

        user_session = await self.user_session_repository.revoke_user_session(session_id=session_id)
        if user_session is None or user_session.user_id != user_id:
            raise ResourceNotFoundError("Session not found.")

    async def list_users(
        self,
        *,
        tenant_id: UUID | None = None,
        membership_status: str | None = None,
        query: str | None = None,
        email: str | None = None,
        is_active: bool | None = None,
    ) -> list[UserDirectoryResponse]:
        users = await self.user_repository.list_users(
            tenant_id=tenant_id,
            membership_status=membership_status,
            query=query,
            email=email,
            is_active=is_active,
        )
        return [build_user_directory_response(user) for user in users]

    async def list_user_access_events(
        self,
        *,
        tenant_id: UUID | None = None,
        user_id: UUID | None = None,
        event_type: str | None = None,
        limit: int = 20,
    ) -> list[UserAccessEventResponse]:
        events = await self.user_repository.list_user_access_events(
            tenant_id=tenant_id,
            user_id=user_id,
            event_type=event_type,
            limit=limit,
        )
        return [build_user_access_event_response(event) for event in events]

    async def get_user(self, *, user_id: UUID) -> UserDirectoryResponse:
        return await self.get_user_directory_entry(user_id)

    async def update_user(self, *, user_id: UUID, request: UserUpdateRequest) -> UserDirectoryResponse:
        user = await self.user_repository.update_user(
            user_id=user_id,
            email=request.email,
            display_name=request.display_name,
            is_active=request.is_active,
            role=request.role,
        )
        if user is None:
            raise ResourceNotFoundError("User not found.")
        return await self.get_user_directory_entry(user.id)

    async def create_user_membership(
        self,
        *,
        user_id: UUID,
        request: UserMembershipCreateRequest,
        actor_user_id: UUID | None = None,
    ) -> UserDirectoryResponse:
        user = await self.user_repository.get_user(user_id=user_id)
        if user is None:
            raise ResourceNotFoundError("User not found.")

        tenant = await self.tenant_repository.get_tenant(tenant_id=request.tenant_id)
        if tenant is None:
            raise ResourceNotFoundError("Tenant not found.")

        membership = await self.user_repository.create_tenant_membership(
            tenant_id=request.tenant_id,
            user_id=user_id,
            membership_status=request.membership_status,
            invitation_issued_by_user_id=actor_user_id,
        )
        if request.membership_status == "invited":
            await self.user_repository.create_user_access_event(
                user_id=user_id,
                tenant_id=membership.tenant_id,
                membership_id=membership.id,
                actor_user_id=actor_user_id,
                event_type="invitation_issued",
                detail_json={"membership_status": "invited", "invitation_issue_count": membership.invitation_issue_count},
            )
        else:
            await self.user_repository.create_user_access_event(
                user_id=user_id,
                tenant_id=membership.tenant_id,
                membership_id=membership.id,
                actor_user_id=actor_user_id,
                event_type=f"membership_{request.membership_status}",
                detail_json={"membership_status": request.membership_status},
            )
        return await self.get_user_directory_entry(user_id)

    async def update_user_membership(
        self,
        *,
        user_id: UUID,
        membership_id: UUID,
        request: UserMembershipUpdateRequest,
        actor_user_id: UUID | None = None,
    ) -> UserDirectoryResponse:
        user = await self.user_repository.get_user(user_id=user_id)
        if user is None:
            raise ResourceNotFoundError("User not found.")

        membership = await self.user_repository.get_tenant_membership(membership_id=membership_id)
        if membership is None or membership.user_id != user_id:
            raise ResourceNotFoundError("Tenant membership not found.")

        updated_membership = await self.user_repository.update_tenant_membership_status(
            membership_id=membership_id,
            membership_status=request.membership_status,
            invitation_issued_by_user_id=actor_user_id,
        )
        if updated_membership is not None:
            event_type = "invitation_issued" if request.membership_status == "invited" else f"membership_{request.membership_status}"
            detail_json = {"membership_status": request.membership_status}
            if request.membership_status == "invited":
                detail_json["invitation_issue_count"] = updated_membership.invitation_issue_count
            await self.user_repository.create_user_access_event(
                user_id=user_id,
                tenant_id=updated_membership.tenant_id,
                membership_id=updated_membership.id,
                actor_user_id=actor_user_id,
                event_type=event_type,
                detail_json=with_governance_reason(detail_json, request.reason),
            )
        return await self.get_user_directory_entry(user_id)

    async def delete_user_membership(
        self,
        *,
        user_id: UUID,
        membership_id: UUID,
        actor_user_id: UUID | None = None,
    ) -> UserDirectoryResponse:
        user = await self.user_repository.get_user(user_id=user_id)
        if user is None:
            raise ResourceNotFoundError("User not found.")

        membership = await self.user_repository.get_tenant_membership(membership_id=membership_id)
        if membership is None or membership.user_id != user_id:
            raise ResourceNotFoundError("Tenant membership not found.")

        await self.user_repository.delete_tenant_membership(membership_id=membership_id)
        await self.user_repository.create_user_access_event(
            user_id=user_id,
            tenant_id=membership.tenant_id,
            membership_id=membership.id,
            actor_user_id=actor_user_id,
            event_type="membership_deleted",
            detail_json={"membership_status": membership.membership_status},
        )
        return await self.get_user_directory_entry(user_id)

    async def revoke_user_membership_invitation(
        self,
        *,
        user_id: UUID,
        membership_id: UUID,
        request: UserMembershipInvitationRevokeRequest | None = None,
        actor_user_id: UUID | None = None,
    ) -> UserDirectoryResponse:
        user = await self.user_repository.get_user(user_id=user_id)
        if user is None:
            raise ResourceNotFoundError("User not found.")

        membership = await self.user_repository.get_tenant_membership(membership_id=membership_id)
        if membership is None or membership.user_id != user_id:
            raise ResourceNotFoundError("Tenant membership not found.")
        if membership.membership_status != "invited":
            raise ResourceConflictError("Only invited memberships can have invitation credentials revoked.")

        await self.user_repository.update_tenant_membership_status(
            membership_id=membership_id,
            membership_status="suspended",
        )
        await self.user_repository.create_user_access_event(
            user_id=user_id,
            tenant_id=membership.tenant_id,
            membership_id=membership.id,
            actor_user_id=actor_user_id,
            event_type="invitation_revoked",
            detail_json=with_governance_reason({"membership_status": "suspended"}, request.reason if request is not None else None),
        )
        return await self.get_user_directory_entry(user_id)

    async def issue_user_membership_invitation(
        self,
        *,
        user_id: UUID,
        membership_id: UUID,
        request: UserMembershipInvitationIssueRequest | None = None,
        actor_user_id: UUID | None = None,
    ) -> UserMembershipInvitationResponse:
        user = await self.user_repository.get_user(user_id=user_id)
        if user is None:
            raise ResourceNotFoundError("User not found.")

        membership = await self.user_repository.get_tenant_membership(membership_id=membership_id)
        if membership is None or membership.user_id != user_id:
            raise ResourceNotFoundError("Tenant membership not found.")

        tenant = await self.tenant_repository.get_tenant(tenant_id=membership.tenant_id)
        if tenant is None:
            raise ResourceNotFoundError("Tenant not found.")

        membership = await self.user_repository.refresh_tenant_membership_invitation(
            membership_id=membership_id,
            invitation_issued_by_user_id=actor_user_id,
        )
        if membership is None or membership.invitation_token is None:
            raise ResourceConflictError("Unable to issue invitation credentials for this membership.")

        invitation_issuer = (
            await self.user_repository.get_user(user_id=membership.last_invitation_issued_by_user_id)
            if membership.last_invitation_issued_by_user_id
            else None
        )
        await self.user_repository.create_user_access_event(
            user_id=user_id,
            tenant_id=membership.tenant_id,
            membership_id=membership.id,
            actor_user_id=actor_user_id,
            event_type="invitation_issued",
            detail_json=with_governance_reason(
                {
                    "membership_status": membership.membership_status,
                    "invitation_issue_count": membership.invitation_issue_count,
                },
                request.reason if request is not None else None,
            ),
        )
        return UserMembershipInvitationResponse(
            membership_id=membership.id,
            tenant_id=tenant.id,
            tenant_name=tenant.name,
            tenant_slug=tenant.slug,
            membership_status=membership.membership_status,
            invitation_token=membership.invitation_token,
            invitation_issue_count=membership.invitation_issue_count,
            last_invitation_issued_by_user_id=membership.last_invitation_issued_by_user_id,
            last_invitation_issued_by_display_name=invitation_issuer.display_name if invitation_issuer is not None else None,
            invited_at=membership.invited_at,
            invitation_expires_at=membership.invitation_expires_at,
            activated_at=membership.activated_at,
        )

    async def get_user_directory_entry(self, user_id: UUID) -> UserDirectoryResponse:
        user = await self.user_repository.get_user_directory_record(user_id=user_id)
        if user is not None:
            return build_user_directory_response(user)
        raise ResourceNotFoundError("User not found.")

    @staticmethod
    def ensure_login_allowed(user: UserDirectoryResponse) -> None:
        if not user.is_active:
            raise ResourceConflictError(
                "This member account is inactive. Ask an administrator to reactivate it before signing in."
            )

        has_active_membership = any(membership.membership_status == "active" for membership in user.memberships)
        has_invited_membership = any(membership.membership_status == "invited" for membership in user.memberships)
        if has_active_membership:
            return
        if len(user.memberships) == 0 and user.role == "super_admin":
            return
        if has_invited_membership:
            raise ResourceConflictError(
                "This member only has invited tenant access right now. Activate the invitation to continue."
            )
        raise ResourceConflictError(
            "This member does not currently have an active tenant membership. Ask an administrator to activate a tenant assignment before signing in."
        )

    async def _issue_authenticated_session(
        self,
        *,
        user_id: UUID,
        login_mode: str,
    ) -> UserAuthenticatedSessionResponse:
        if self.user_session_repository is None:
            raise RuntimeError("User session repository is required for authenticated sign-in.")

        updated_user = await self.user_repository.update_user_last_signed_in_at(user_id=user_id)
        if updated_user is None:
            raise ResourceNotFoundError("User not found.")

        user_session, session_token = await self.user_session_repository.create_user_session(
            user_id=user_id,
            authentication_mode=login_mode,
        )
        await self.user_repository.create_user_access_event(
            user_id=user_id,
            event_type="sign_in_succeeded",
            detail_json={"login_mode": login_mode},
        )
        directory_user = await self.get_user_directory_entry(user_id)
        return UserAuthenticatedSessionResponse(
            user=directory_user,
            session=UserSessionResponse(
                session_token=session_token,
                expires_at=user_session.expires_at,
            ),
        )


def build_user_membership_response(record: UserMembershipDirectoryRecord) -> UserMembershipResponse:
    membership = record.membership
    tenant = record.tenant
    return UserMembershipResponse(
        id=membership.id,
        tenant_id=tenant.id,
        tenant_name=tenant.name,
        tenant_slug=tenant.slug,
        membership_status=membership.membership_status,
        invitation_issue_count=membership.invitation_issue_count,
        last_invitation_issued_by_user_id=membership.last_invitation_issued_by_user_id,
        last_invitation_issued_by_display_name=record.invitation_issuer.display_name if record.invitation_issuer is not None else None,
        invited_at=membership.invited_at,
        invitation_expires_at=membership.invitation_expires_at,
        activated_at=membership.activated_at,
        created_at=membership.created_at,
        updated_at=membership.updated_at,
    )


def build_user_directory_response(record: UserDirectoryRecord) -> UserDirectoryResponse:
    user = record.user
    return UserDirectoryResponse(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        is_active=user.is_active,
        role=user.role,
        last_signed_in_at=user.last_signed_in_at,
        memberships=[build_user_membership_response(membership) for membership in record.memberships],
        created_at=user.created_at,
        updated_at=user.updated_at,
    )


def build_user_access_event_response(record: UserAccessEventRecord) -> UserAccessEventResponse:
    event = record.event
    return UserAccessEventResponse(
        id=event.id,
        tenant_id=event.tenant_id,
        user_id=event.user_id,
        membership_id=event.membership_id,
        actor_user_id=event.actor_user_id,
        actor_display_name=record.actor.display_name if record.actor is not None else None,
        user_display_name=record.user.display_name,
        tenant_name=record.tenant.name if record.tenant is not None else None,
        event_type=event.event_type,
        detail_json=event.detail_json,
        created_at=event.created_at,
    )


def with_governance_reason(detail_json: dict[str, object], reason: str | None) -> dict[str, object]:
    normalized_reason = reason.strip() if reason is not None else ""
    if not normalized_reason:
        return detail_json

    return {
        **detail_json,
        "reason": normalized_reason,
    }
