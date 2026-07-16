from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
from uuid import UUID

from sqlalchemy.exc import SQLAlchemyError

from ragpilot_api.application.errors import ResourceConflictError, ResourceNotFoundError
from ragpilot_api.application.identity.access_policy import build_session_capabilities, build_session_capabilities_from_grants
from ragpilot_api.application.identity.passwords import hash_password, password_needs_rehash, verify_password
from ragpilot_api.contracts.http.user_contracts import (
    UserAccessEventResponse,
    UserAccessGovernanceEventCountResponse,
    UserAccessGovernanceReviewFollowUpResponse,
    UserAccessGovernanceReviewItemResponse,
    UserAccessGovernanceSummaryResponse,
    UserCurrentAccessSummaryResponse,
    UserActiveSessionResponse,
    UserAuthenticationModeResponse,
    UserAuthenticatedSessionResponse,
    UserBootstrapRequest,
    UserBootstrapStatusResponse,
    UserCurrentPasswordChangeRequest,
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
    UserPasswordResetRequest,
    UserSessionResponse,
    UserSessionSecurityModeCountResponse,
    UserSessionSecuritySummaryResponse,
    UserMembershipUpdateRequest,
    UserPermissionResponse,
    UserSessionRevokeRequest,
    UserSessionBulkRevocationResponse,
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
from ragpilot_api.shared.settings import Settings, get_settings


@dataclass(slots=True)
class UserSessionTelemetry:
    user_agent: str | None = None
    ip_address: str | None = None
    device_label: str | None = None


class UserService:
    _LOCAL_FORM_AUTH_MODES = {"directory_local", "password_local"}
    _DISPLAY_NAME_INPUT_AUTH_MODES = {"directory_local"}
    _PASSWORD_INPUT_AUTH_MODES = {"password_local"}
    _INVITATION_ACTIVATION_AUTH_MODES = {"directory_local", "password_local"}
    _FAILED_SIGN_IN_EVENT_TYPE = "sign_in_failed"
    _FAILED_INVITATION_ACTIVATION_EVENT_TYPE = "invitation_activation_failed"
    _SENSITIVE_ACCESS_EVENT_TYPES = (
        "session_revoked",
        "password_changed",
        "password_reset",
        "invitation_revoked",
        "membership_suspended",
        "membership_deleted",
    )
    _ACCESS_EVENT_TYPE_ORDER = (
        "sign_in_failed",
        "sign_in_succeeded",
        "invitation_activation_failed",
        "sign_out_succeeded",
        "session_revoked",
        "password_changed",
        "password_reset",
        "invitation_issued",
        "invitation_activated",
        "invitation_revoked",
        "membership_active",
        "membership_suspended",
        "membership_deleted",
    )
    _REVIEW_ITEM_ORDER = (
        "expired_invitations",
        "expiring_invitations",
        "dormant_accounts",
        "suspended_memberships",
        "failed_sign_in_pressure",
        "invitation_activation_pressure",
        "session_spread_pressure",
    )

    def __init__(
        self,
        user_repository: UserRepository,
        user_session_repository: UserSessionRepository | None,
        tenant_repository: TenantRepository,
        role_permission_repository: RolePermissionRepository | None = None,
        settings: Settings | None = None,
    ) -> None:
        self.user_repository = user_repository
        self.user_session_repository = user_session_repository
        self.tenant_repository = tenant_repository
        self.role_permission_repository = role_permission_repository
        self.settings = settings or get_settings()

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
            password_hash=self._resolve_password_hash(
                request.password,
                required=False,
                error_message="Password is required for this authentication mode.",
            ),
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
        self._require_local_form_auth_mode("Bootstrap is unavailable for the current authentication mode.")

        acquire_bootstrap_lock = getattr(self.user_repository, "acquire_bootstrap_lock", None)
        if acquire_bootstrap_lock is not None:
            await acquire_bootstrap_lock()

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
            password_hash=self._resolve_password_hash(
                request.password,
                required=self._is_password_auth_mode(),
                error_message="Password is required to bootstrap the initial administrator.",
            ),
        )
        return await self.get_user_directory_entry(user.id)

    async def get_bootstrap_status(self) -> UserBootstrapStatusResponse:
        has_users = await self.user_repository.count_users() > 0
        return UserBootstrapStatusResponse(
            has_users=has_users,
            allow_initial_super_admin=(not has_users) and self._is_local_form_auth_mode(),
        )

    async def get_authentication_mode(self, *, return_to: str | None = None):
        has_users = await self.user_repository.count_users() > 0
        primary_mode = self.settings.auth_primary_mode
        sign_in_method = "local_form" if primary_mode in self._LOCAL_FORM_AUTH_MODES else "external_redirect"
        return UserAuthenticationModeResponse(
            primary_mode=primary_mode,
            sign_in_method=sign_in_method,
            session_transport="bearer_session",
            supports_display_name_input=primary_mode in self._DISPLAY_NAME_INPUT_AUTH_MODES,
            supports_password_input=primary_mode in self._PASSWORD_INPUT_AUTH_MODES,
            supports_invitation_activation=primary_mode in self._INVITATION_ACTIVATION_AUTH_MODES,
            allow_initial_super_admin=(not has_users) and self._is_local_form_auth_mode(),
            provider_protocol=primary_mode if sign_in_method == "external_redirect" else None,
            provider_display_name=self._resolve_provider_display_name(primary_mode) if sign_in_method == "external_redirect" else None,
            provider_sign_in_url=self._build_provider_sign_in_url(return_to=return_to) if sign_in_method == "external_redirect" else None,
            provider_post_sign_out_url=self._build_provider_post_sign_out_url(return_to=return_to) if sign_in_method == "external_redirect" else None,
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
        if not self._is_local_form_auth_mode():
            return UserLoginAssessmentResponse(
                email=normalized_email,
                has_users=has_users,
                user_exists=False,
                account_state="not_found",
                allow_sign_in=False,
                next_action="contact_admin",
            )

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

    async def login_user(
        self,
        request: UserLoginRequest,
        *,
        session_telemetry: UserSessionTelemetry | None = None,
    ) -> UserAuthenticatedSessionResponse:
        self._require_local_form_auth_mode("Local sign-in is unavailable for the current authentication mode.")

        user = await self.user_repository.get_user_by_email(email=request.email)
        if user is None:
            if await self.user_repository.count_users() > 0:
                raise ResourceConflictError("Email or password is incorrect.")
            try:
                directory_user = await self.bootstrap_user(
                    UserBootstrapRequest(
                        email=request.email,
                        display_name=request.display_name,
                        password=request.password,
                    )
                )
            except ResourceConflictError as error:
                raise ResourceConflictError("Email or password is incorrect.") from error
            return await self._issue_authenticated_session(
                user_id=directory_user.id,
                login_mode="bootstrap",
                session_telemetry=session_telemetry,
            )

        await self._ensure_sign_in_not_rate_limited(user_id=user.id)

        if self._is_password_auth_mode():
            password = self._require_password(
                request.password,
                error_message="Password is required for password sign-in.",
            )
            if not verify_password(password, getattr(user, "password_hash", None)):
                raise ResourceConflictError(
                    await self._record_failed_sign_in_attempt(
                        user_id=user.id,
                        email=user.email,
                        reason_code="invalid_password",
                        fallback_message="Email or password is incorrect.",
                        session_telemetry=session_telemetry,
                    )
                )
            if password_needs_rehash(getattr(user, "password_hash", None)):
                await self.user_repository.set_user_password(user_id=user.id, password_hash=hash_password(password))

        directory_user = await self.get_user_directory_entry(user.id)
        try:
            self.ensure_login_allowed(directory_user)
        except ResourceConflictError as error:
            raise ResourceConflictError(
                await self._record_failed_sign_in_attempt(
                    user_id=user.id,
                    email=user.email,
                    reason_code=self._resolve_sign_in_failure_reason_code(directory_user),
                    fallback_message=str(error),
                    session_telemetry=session_telemetry,
                )
            ) from error
        return await self._issue_authenticated_session(
            user_id=user.id,
            login_mode="password" if self._is_password_auth_mode() else "directory",
            session_telemetry=session_telemetry,
        )

    async def activate_user_invitations(
        self,
        request: UserInvitationActivationRequest,
        *,
        session_telemetry: UserSessionTelemetry | None = None,
    ) -> UserAuthenticatedSessionResponse:
        self._require_invitation_activation_auth_mode(
            "Invitation activation is unavailable for the current authentication mode."
        )

        user = await self.user_repository.get_user_by_email(email=request.email)
        if user is None:
            raise ResourceNotFoundError("User not found.")

        await self._ensure_invitation_activation_not_rate_limited(user_id=user.id)
        memberships = await self.user_repository.list_tenant_memberships_for_user(user_id=user.id)
        available_invited_memberships = [
            membership for membership in memberships if membership.membership_status == "invited"
        ]
        invited_memberships = [
            membership
            for membership in available_invited_memberships
            if UserRepository.invitation_token_matches(membership, request.invitation_token)
        ]
        has_active_membership = any(membership.membership_status == "active" for membership in memberships)

        if not available_invited_memberships and not has_active_membership:
            raise ResourceConflictError(
                await self._record_invitation_activation_failure(
                    user_id=user.id,
                    email=user.email,
                    reason_code="no_invited_memberships",
                    fallback_message="No invited memberships are available to activate.",
                    session_telemetry=session_telemetry,
                )
            )
        if not invited_memberships:
            raise ResourceConflictError(
                await self._record_invitation_activation_failure(
                    user_id=user.id,
                    email=user.email,
                    reason_code="invalid_token",
                    fallback_message="Invitation token is not valid for this member.",
                    session_telemetry=session_telemetry,
                    membership_id=available_invited_memberships[0].id if available_invited_memberships else None,
                    tenant_id=available_invited_memberships[0].tenant_id if available_invited_memberships else None,
                )
            )

        current_time = datetime.now(timezone.utc)
        activatable_memberships = [
            membership
            for membership in invited_memberships
            if membership.invitation_expires_at is None or membership.invitation_expires_at > current_time
        ]
        if not activatable_memberships:
            expired_membership = invited_memberships[0] if invited_memberships else None
            raise ResourceConflictError(
                await self._record_invitation_activation_failure(
                    user_id=user.id,
                    email=user.email,
                    reason_code="expired_token",
                    fallback_message="Invitation token has expired. Ask an administrator to issue a new code.",
                    session_telemetry=session_telemetry,
                    membership_id=expired_membership.id if expired_membership is not None else None,
                    tenant_id=expired_membership.tenant_id if expired_membership is not None else None,
                )
            )

        if self._is_password_auth_mode():
            password_hash = self._resolve_password_hash(
                request.password,
                required=True,
                error_message="Password is required before activating invited access.",
            )
            updated_user = await self.user_repository.set_user_password(
                user_id=user.id,
                password_hash=password_hash,
            )
            if updated_user is None:
                raise ResourceNotFoundError("User not found.")

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
            session_telemetry=session_telemetry,
        )

    async def revoke_current_session(
        self,
        *,
        user_id: UUID,
        session_id: UUID,
        actor_user_id: UUID | None = None,
        reason: str | None = None,
    ) -> None:
        if self.user_session_repository is None:
            raise RuntimeError("User session repository is required for authenticated sign-out.")

        user_session = await self.user_session_repository.get_user_session(session_id=session_id)
        if user_session is None or user_session.user_id != user_id:
            raise ResourceNotFoundError("Session not found.")
        await self.user_session_repository.revoke_user_session(session_id=session_id)
        await self.user_repository.create_user_access_event(
            user_id=user_id,
            actor_user_id=actor_user_id,
            event_type="sign_out_succeeded",
            detail_json=with_governance_reason(
                {
                    "session_id": str(user_session.id),
                    "login_mode": user_session.authentication_mode,
                    "revocation_scope": "self",
                },
                reason,
            ),
        )

    async def list_current_user_sessions(
        self,
        *,
        user_id: UUID,
        current_session_id: UUID | None = None,
    ) -> list[UserActiveSessionResponse]:
        if self.user_session_repository is None:
            raise RuntimeError("User session repository is required for session review.")

        sessions = await self.user_session_repository.list_active_user_sessions(user_id=user_id)
        return [
            UserActiveSessionResponse(
                id=session.id,
                authentication_mode=session.authentication_mode,
                user_agent=session.user_agent,
                ip_address=session.ip_address,
                device_label=session.device_label,
                created_at=session.created_at,
                updated_at=session.updated_at,
                expires_at=session.expires_at,
                is_current=session.id == current_session_id,
            )
            for session in sessions
        ]

    async def revoke_user_session_for_user(
        self,
        *,
        user_id: UUID,
        session_id: UUID,
        actor_user_id: UUID | None = None,
        reason: str | None = None,
    ) -> None:
        if self.user_session_repository is None:
            raise RuntimeError("User session repository is required for session review.")

        user_session = await self.user_session_repository.get_user_session(session_id=session_id)
        if user_session is None or user_session.user_id != user_id:
            raise ResourceNotFoundError("Session not found.")

        await self.user_session_repository.revoke_user_session(session_id=session_id)
        await self.user_repository.create_user_access_event(
            user_id=user_id,
            actor_user_id=actor_user_id,
            event_type="session_revoked",
            detail_json=with_governance_reason(
                {
                    "session_id": str(user_session.id),
                    "login_mode": user_session.authentication_mode,
                    "revocation_scope": "self" if actor_user_id == user_id else "admin",
                },
                reason,
            ),
        )

    async def revoke_other_sessions_for_current_user(
        self,
        *,
        user_id: UUID,
        current_session_id: UUID,
        actor_user_id: UUID | None = None,
        reason: str | None = None,
    ) -> UserSessionBulkRevocationResponse:
        if self.user_session_repository is None:
            raise RuntimeError("User session repository is required for session review.")

        sessions = await self.user_session_repository.list_active_user_sessions(user_id=user_id)
        sessions_to_revoke = [session for session in sessions if session.id != current_session_id]
        for user_session in sessions_to_revoke:
            await self.user_session_repository.revoke_user_session(session_id=user_session.id)
            await self.user_repository.create_user_access_event(
                user_id=user_id,
                actor_user_id=actor_user_id,
                event_type="session_revoked",
                detail_json=with_governance_reason(
                    {
                        "session_id": str(user_session.id),
                        "login_mode": user_session.authentication_mode,
                        "revocation_scope": "self_other",
                    },
                    reason,
                ),
            )

        return UserSessionBulkRevocationResponse(
            user_id=user_id,
            revoked_session_count=len(sessions_to_revoke),
            remaining_active_sessions=max(len(sessions) - len(sessions_to_revoke), 0),
            preserved_current_session=True,
            revocation_scope="other_sessions",
        )

    async def revoke_all_sessions_for_user(
        self,
        *,
        user_id: UUID,
        actor_user_id: UUID | None = None,
        reason: str | None = None,
    ) -> UserSessionBulkRevocationResponse:
        if self.user_session_repository is None:
            raise RuntimeError("User session repository is required for session review.")

        sessions = await self.user_session_repository.list_active_user_sessions(user_id=user_id)
        for user_session in sessions:
            await self.user_session_repository.revoke_user_session(session_id=user_session.id)
            await self.user_repository.create_user_access_event(
                user_id=user_id,
                actor_user_id=actor_user_id,
                event_type="session_revoked",
                detail_json=with_governance_reason(
                    {
                        "session_id": str(user_session.id),
                        "login_mode": user_session.authentication_mode,
                        "revocation_scope": "admin_bulk" if actor_user_id != user_id else "self_all",
                    },
                    reason,
                ),
            )

        return UserSessionBulkRevocationResponse(
            user_id=user_id,
            revoked_session_count=len(sessions),
            remaining_active_sessions=0,
            preserved_current_session=False,
            revocation_scope="all_sessions",
        )

    async def change_current_user_password(
        self,
        *,
        user_id: UUID,
        request: UserCurrentPasswordChangeRequest,
        actor_user_id: UUID | None = None,
        current_session_id: UUID | None = None,
    ) -> UserDirectoryResponse:
        self._require_password_auth_mode("Password changes are unavailable for the current authentication mode.")

        user = await self.user_repository.get_user(user_id=user_id)
        if user is None:
            raise ResourceNotFoundError("User not found.")

        current_password = self._require_password(
            request.current_password,
            error_message="Current password is required.",
        )
        if not verify_password(current_password, getattr(user, "password_hash", None)):
            raise ResourceConflictError("Current password is incorrect.")

        next_password = self._require_password(
            request.new_password,
            error_message="New password is required.",
        )
        if verify_password(next_password, getattr(user, "password_hash", None)):
            raise ResourceConflictError("New password must be different from the current password.")

        updated_user = await self.user_repository.set_user_password(
            user_id=user_id,
            password_hash=hash_password(next_password),
        )
        if updated_user is None:
            raise ResourceNotFoundError("User not found.")

        await self.user_repository.create_user_access_event(
            user_id=user_id,
            actor_user_id=actor_user_id,
            event_type="password_changed",
            detail_json={
                "authentication_mode": self.settings.auth_primary_mode,
                "change_scope": "self",
            },
        )
        await self._revoke_sessions_after_password_change(
            user_id=user_id,
            actor_user_id=actor_user_id,
            current_session_id=current_session_id,
        )
        return await self.get_user_directory_entry(user_id)

    async def reset_user_password(
        self,
        *,
        user_id: UUID,
        request: UserPasswordResetRequest,
        actor_user_id: UUID | None = None,
    ) -> UserDirectoryResponse:
        self._require_password_auth_mode("Password resets are unavailable for the current authentication mode.")

        user = await self.user_repository.get_user(user_id=user_id)
        if user is None:
            raise ResourceNotFoundError("User not found.")

        next_password = self._require_password(
            request.new_password,
            error_message="New password is required.",
        )
        if verify_password(next_password, getattr(user, "password_hash", None)):
            raise ResourceConflictError("Reset password must be different from the current password.")

        updated_user = await self.user_repository.set_user_password(
            user_id=user_id,
            password_hash=hash_password(next_password),
        )
        if updated_user is None:
            raise ResourceNotFoundError("User not found.")

        await self.user_repository.create_user_access_event(
            user_id=user_id,
            actor_user_id=actor_user_id,
            event_type="password_reset",
            detail_json=with_governance_reason(
                {
                    "authentication_mode": self.settings.auth_primary_mode,
                    "change_scope": "admin",
                },
                request.reason,
            ),
        )
        await self.revoke_all_sessions_for_user(
            user_id=user_id,
            actor_user_id=actor_user_id,
            reason=request.reason or "Password reset requires fresh sign-in.",
        )
        return await self.get_user_directory_entry(user_id)

    async def get_user_session_security_summary(
        self,
        *,
        user_id: UUID,
        current_session_id: UUID | None = None,
    ) -> UserSessionSecuritySummaryResponse:
        if self.user_session_repository is None:
            raise RuntimeError("User session repository is required for session review.")

        sessions = await self.user_session_repository.list_active_user_sessions(user_id=user_id)
        now = datetime.now(timezone.utc)
        current_session = next((session for session in sessions if session.id == current_session_id), None)
        mode_counts: dict[str, int] = {}
        distinct_devices = {
            session.device_label.strip()
            for session in sessions
            if isinstance(session.device_label, str) and session.device_label.strip()
        }
        distinct_ips = {
            session.ip_address.strip()
            for session in sessions
            if isinstance(session.ip_address, str) and session.ip_address.strip()
        }
        for session in sessions:
            mode_counts[session.authentication_mode] = mode_counts.get(session.authentication_mode, 0) + 1

        sorted_mode_breakdown = sorted(mode_counts.items(), key=lambda item: (-item[1], item[0]))
        return UserSessionSecuritySummaryResponse(
            total_active_sessions=len(sessions),
            other_active_sessions=max(len(sessions) - (1 if current_session is not None else 0), 0),
            expires_within_24_hours=sum(
                1 for session in sessions if session.expires_at - now <= timedelta(hours=24)
            ),
            distinct_device_count=len(distinct_devices),
            distinct_ip_count=len(distinct_ips),
            oldest_session_started_at=min((session.created_at for session in sessions), default=None),
            latest_session_expires_at=max((session.expires_at for session in sessions), default=None),
            current_session_started_at=current_session.created_at if current_session is not None else None,
            current_session_expires_at=current_session.expires_at if current_session is not None else None,
            mode_breakdown=[
                UserSessionSecurityModeCountResponse(
                    authentication_mode=authentication_mode,
                    session_count=session_count,
                )
                for authentication_mode, session_count in sorted_mode_breakdown
            ],
        )

    async def get_user_access_summary(
        self,
        *,
        user_id: UUID,
    ) -> UserCurrentAccessSummaryResponse:
        directory_user = await self.get_user_directory_entry(user_id)
        now = datetime.now(timezone.utc)
        expiring_threshold = now + timedelta(days=3)

        active_memberships = sum(
            1 for membership in directory_user.memberships if membership.membership_status == "active"
        )
        invited_memberships = sum(
            1 for membership in directory_user.memberships if membership.membership_status == "invited"
        )
        suspended_memberships = sum(
            1 for membership in directory_user.memberships if membership.membership_status == "suspended"
        )
        expiring_invitations = sum(
            1
            for membership in directory_user.memberships
            if membership.membership_status == "invited"
            and membership.invitation_expires_at is not None
            and now <= membership.invitation_expires_at <= expiring_threshold
        )
        expired_invitations = sum(
            1
            for membership in directory_user.memberships
            if membership.membership_status == "invited"
            and membership.invitation_expires_at is not None
            and membership.invitation_expires_at < now
        )

        user_ids = [directory_user.id]
        event_breakdown_counts = await self.user_repository.count_user_access_events_grouped(
            tenant_id=None,
            user_ids=user_ids,
        )
        recent_failed_sign_in_events = len(
            await self._list_recent_failed_sign_in_events_for_scope(
                tenant_id=None,
                user_ids=user_ids,
            )
        )
        recent_failed_invitation_activation_events = len(
            await self._list_recent_failed_invitation_activation_events_for_scope(
                tenant_id=None,
                user_ids=user_ids,
            )
        )
        latest_events = await self.user_repository.list_user_access_events(
            user_id=user_id,
            limit=1,
        )
        latest_event = latest_events[0] if latest_events else None

        active_sessions = 0
        sessions_expiring_within_24_hours = 0
        if self.user_session_repository is not None:
            active_sessions = await self.user_session_repository.count_active_user_sessions(user_ids=[user_id])
            sessions_expiring_within_24_hours = await self.user_session_repository.count_active_user_sessions(
                user_ids=[user_id],
                expires_before=now + timedelta(hours=24),
            )

        total_audit_events = sum(event_breakdown_counts.values())
        sensitive_audit_events = sum(
            event_breakdown_counts.get(event_type, 0)
            for event_type in self._SENSITIVE_ACCESS_EVENT_TYPES
        )
        membership_access_state = "ready" if active_memberships > 0 else "blocked"
        if len(directory_user.memberships) == 0:
            membership_access_state = "bootstrap"

        recent_failed_sign_in_events_for_user = await self._list_recent_failed_sign_in_events(user_id=user_id)
        sign_in_lockout_expires_at = self._resolve_sign_in_lockout_until(recent_failed_sign_in_events_for_user)
        session_spread_detected = False
        if self.user_session_repository is not None:
            session_spread_detected = user_id in await self._resolve_users_with_session_spread(user_ids=[user_id])

        review_items = [
            UserAccessGovernanceReviewItemResponse(
                category="expired_invitations",
                severity="attention" if expired_invitations > 0 else "healthy",
                item_count=expired_invitations,
            ),
            UserAccessGovernanceReviewItemResponse(
                category="expiring_invitations",
                severity="review" if expiring_invitations > 0 else "healthy",
                item_count=expiring_invitations,
            ),
            UserAccessGovernanceReviewItemResponse(
                category="failed_sign_in_pressure",
                severity="attention" if sign_in_lockout_expires_at is not None else "review" if len(recent_failed_sign_in_events_for_user) > 0 else "healthy",
                item_count=len(recent_failed_sign_in_events_for_user),
            ),
            UserAccessGovernanceReviewItemResponse(
                category="invitation_activation_pressure",
                severity="attention" if recent_failed_invitation_activation_events > 0 else "healthy",
                item_count=recent_failed_invitation_activation_events,
            ),
            UserAccessGovernanceReviewItemResponse(
                category="session_spread_pressure",
                severity="attention" if session_spread_detected else "healthy",
                item_count=1 if session_spread_detected else 0,
            ),
        ]

        return UserCurrentAccessSummaryResponse(
            membership_access_state=membership_access_state,
            active_memberships=active_memberships,
            invited_memberships=invited_memberships,
            suspended_memberships=suspended_memberships,
            expiring_invitations=expiring_invitations,
            expired_invitations=expired_invitations,
            recent_failed_sign_in_events=recent_failed_sign_in_events,
            recent_failed_invitation_activation_events=recent_failed_invitation_activation_events,
            total_audit_events=total_audit_events,
            sensitive_audit_events=sensitive_audit_events,
            active_sessions=active_sessions,
            sessions_expiring_within_24_hours=sessions_expiring_within_24_hours,
            recent_sign_in_events=event_breakdown_counts.get("sign_in_succeeded", 0),
            sign_in_lockout_active=sign_in_lockout_expires_at is not None,
            sign_in_lockout_expires_at=sign_in_lockout_expires_at,
            session_spread_detected=session_spread_detected,
            latest_event_type=latest_event.event.event_type if latest_event is not None else None,
            latest_event_at=latest_event.event.created_at if latest_event is not None else None,
            event_breakdown=[
                UserAccessGovernanceEventCountResponse(
                    event_type=event_type,
                    event_count=event_breakdown_counts[event_type],
                )
                for event_type in self._ACCESS_EVENT_TYPE_ORDER
                if event_breakdown_counts.get(event_type, 0) > 0
            ],
            review_items=review_items,
        )

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
        query: str | None = None,
        limit: int = 20,
    ) -> list[UserAccessEventResponse]:
        events = await self.user_repository.list_user_access_events(
            tenant_id=tenant_id,
            user_id=user_id,
            event_type=event_type,
            query=query,
            limit=limit,
        )
        return [build_user_access_event_response(event) for event in events]

    async def get_user_access_governance_summary(
        self,
        *,
        tenant_id: UUID | None = None,
        membership_status: str | None = None,
        query: str | None = None,
        is_active: bool | None = None,
    ) -> UserAccessGovernanceSummaryResponse:
        users = await self.user_repository.list_users(
            tenant_id=tenant_id,
            membership_status=membership_status,
            query=query,
            is_active=is_active,
        )
        now = datetime.now(timezone.utc)
        dormant_threshold = now - timedelta(days=30)
        expiring_threshold = now + timedelta(days=3)

        user_ids = [record.user.id for record in users]
        total_members = len(users)
        active_accounts = sum(1 for record in users if record.user.is_active)
        inactive_accounts = total_members - active_accounts
        active_memberships = sum(
            1
            for record in users
            for membership_record in record.memberships
            if membership_record.membership.membership_status == "active"
        )
        invited_memberships = sum(
            1
            for record in users
            for membership_record in record.memberships
            if membership_record.membership.membership_status == "invited"
        )
        suspended_memberships = sum(
            1
            for record in users
            for membership_record in record.memberships
            if membership_record.membership.membership_status == "suspended"
        )
        dormant_accounts = sum(
            1
            for record in users
            if record.user.is_active
            and (
                record.user.last_signed_in_at is None
                or record.user.last_signed_in_at <= dormant_threshold
            )
        )
        expiring_invitations = sum(
            1
            for record in users
            for membership_record in record.memberships
            if membership_record.membership.membership_status == "invited"
            and membership_record.membership.invitation_expires_at is not None
            and now <= membership_record.membership.invitation_expires_at <= expiring_threshold
        )
        expired_invitations = sum(
            1
            for record in users
            for membership_record in record.memberships
            if membership_record.membership.membership_status == "invited"
            and membership_record.membership.invitation_expires_at is not None
            and membership_record.membership.invitation_expires_at < now
        )

        event_breakdown_counts = await self.user_repository.count_user_access_events_grouped(
            tenant_id=tenant_id,
            user_ids=user_ids,
        )
        recent_failed_sign_in_events = await self._list_recent_failed_sign_in_events_for_scope(
            tenant_id=tenant_id,
            user_ids=user_ids,
        )
        failed_sign_in_counts_by_user = self._group_failed_sign_in_events_by_user(recent_failed_sign_in_events)
        members_under_sign_in_lockout = sum(
            1
            for count in failed_sign_in_counts_by_user.values()
            if count >= max(self.settings.auth_failed_sign_in_max_attempts, 1)
        )
        recent_failed_invitation_activation_events = await self._list_recent_failed_invitation_activation_events_for_scope(
            tenant_id=tenant_id,
            user_ids=user_ids,
        )
        failed_invitation_activation_counts_by_user = self._group_failed_invitation_activation_events_by_user(
            recent_failed_invitation_activation_events
        )
        members_with_failed_invitation_activation = sum(
            1 for count in failed_invitation_activation_counts_by_user.values() if count > 0
        )
        total_audit_events = sum(event_breakdown_counts.values())
        sensitive_audit_events = sum(
            event_breakdown_counts.get(event_type, 0)
            for event_type in self._SENSITIVE_ACCESS_EVENT_TYPES
        )

        active_sessions = 0
        sessions_expiring_within_24_hours = 0
        members_with_session_spread = 0
        users_with_session_spread: set[UUID] = set()
        if self.user_session_repository is not None:
            active_sessions = await self.user_session_repository.count_active_user_sessions(user_ids=user_ids)
            sessions_expiring_within_24_hours = await self.user_session_repository.count_active_user_sessions(
                user_ids=user_ids,
                expires_before=now + timedelta(hours=24),
            )
            users_with_session_spread = await self._resolve_users_with_session_spread(user_ids=user_ids)
            members_with_session_spread = len(users_with_session_spread)

        first_expired_invitation_record = next(
            (
                (record, membership_record)
                for record in users
                for membership_record in record.memberships
                if membership_record.membership.membership_status == "invited"
                and membership_record.membership.invitation_expires_at is not None
                and membership_record.membership.invitation_expires_at < now
            ),
            None,
        )
        first_expiring_invitation_record = next(
            (
                (record, membership_record)
                for record in users
                for membership_record in record.memberships
                if membership_record.membership.membership_status == "invited"
                and membership_record.membership.invitation_expires_at is not None
                and now <= membership_record.membership.invitation_expires_at <= expiring_threshold
            ),
            None,
        )
        first_dormant_user_record = next(
            (
                record
                for record in users
                if record.user.is_active
                and (
                    record.user.last_signed_in_at is None
                    or record.user.last_signed_in_at <= dormant_threshold
                )
            ),
            None,
        )
        first_suspended_membership_record = next(
            (
                (record, membership_record)
                for record in users
                for membership_record in record.memberships
                if membership_record.membership.membership_status == "suspended"
            ),
            None,
        )
        first_failed_sign_in_pressure_user_record = next(
            (
                record
                for record in users
                if failed_sign_in_counts_by_user.get(record.user.id, 0) >= max(self.settings.auth_failed_sign_in_max_attempts, 1)
            ),
            None,
        )
        first_failed_invitation_activation_user_record = next(
            (
                record
                for record in users
                if failed_invitation_activation_counts_by_user.get(record.user.id, 0) > 0
            ),
            None,
        )
        first_session_spread_user_record = next(
            (
                record
                for record in users
                if record.user.id in users_with_session_spread
            ),
            None,
        )

        review_queue_items = (
            int(expired_invitations > 0)
            + int(expiring_invitations > 0)
            + int(dormant_accounts > 0)
            + int(suspended_memberships > 0)
            + int(members_under_sign_in_lockout > 0)
            + int(members_with_failed_invitation_activation > 0)
            + int(members_with_session_spread > 0)
        )

        review_items_by_category: dict[str, UserAccessGovernanceReviewItemResponse] = {
            "expired_invitations": UserAccessGovernanceReviewItemResponse(
                category="expired_invitations",
                severity="attention" if expired_invitations > 0 else "healthy",
                item_count=expired_invitations,
                tenant_id=first_expired_invitation_record[1].membership.tenant_id if first_expired_invitation_record is not None else None,
                user_id=first_expired_invitation_record[0].user.id if first_expired_invitation_record is not None else None,
                membership_id=first_expired_invitation_record[1].membership.id if first_expired_invitation_record is not None else None,
                follow_up=self._build_access_governance_review_follow_up(
                    tenant_id=first_expired_invitation_record[1].membership.tenant_id if first_expired_invitation_record is not None else None,
                    user_id=first_expired_invitation_record[0].user.id if first_expired_invitation_record is not None else None,
                    membership_id=first_expired_invitation_record[1].membership.id if first_expired_invitation_record is not None else None,
                    member_relationship_filter="invited",
                    management_panel="user-edit",
                ),
            ),
            "expiring_invitations": UserAccessGovernanceReviewItemResponse(
                category="expiring_invitations",
                severity="review" if expiring_invitations > 0 else "healthy",
                item_count=expiring_invitations,
                tenant_id=first_expiring_invitation_record[1].membership.tenant_id if first_expiring_invitation_record is not None else None,
                user_id=first_expiring_invitation_record[0].user.id if first_expiring_invitation_record is not None else None,
                membership_id=first_expiring_invitation_record[1].membership.id if first_expiring_invitation_record is not None else None,
                follow_up=self._build_access_governance_review_follow_up(
                    tenant_id=first_expiring_invitation_record[1].membership.tenant_id if first_expiring_invitation_record is not None else None,
                    user_id=first_expiring_invitation_record[0].user.id if first_expiring_invitation_record is not None else None,
                    membership_id=first_expiring_invitation_record[1].membership.id if first_expiring_invitation_record is not None else None,
                    member_relationship_filter="invited",
                    management_panel="user-edit",
                ),
            ),
            "dormant_accounts": UserAccessGovernanceReviewItemResponse(
                category="dormant_accounts",
                severity="review" if dormant_accounts > 0 else "healthy",
                item_count=dormant_accounts,
                tenant_id=None,
                user_id=first_dormant_user_record.user.id if first_dormant_user_record is not None else None,
                membership_id=None,
                follow_up=self._build_access_governance_review_follow_up(
                    user_id=first_dormant_user_record.user.id if first_dormant_user_record is not None else None,
                    member_account_filter="active",
                    management_panel="user-edit",
                ),
            ),
            "suspended_memberships": UserAccessGovernanceReviewItemResponse(
                category="suspended_memberships",
                severity="review" if suspended_memberships > 0 else "healthy",
                item_count=suspended_memberships,
                tenant_id=first_suspended_membership_record[1].membership.tenant_id if first_suspended_membership_record is not None else None,
                user_id=first_suspended_membership_record[0].user.id if first_suspended_membership_record is not None else None,
                membership_id=first_suspended_membership_record[1].membership.id if first_suspended_membership_record is not None else None,
                follow_up=self._build_access_governance_review_follow_up(
                    tenant_id=first_suspended_membership_record[1].membership.tenant_id if first_suspended_membership_record is not None else None,
                    user_id=first_suspended_membership_record[0].user.id if first_suspended_membership_record is not None else None,
                    membership_id=first_suspended_membership_record[1].membership.id if first_suspended_membership_record is not None else None,
                    member_relationship_filter="suspended",
                    management_panel="user-edit",
                ),
            ),
            "failed_sign_in_pressure": UserAccessGovernanceReviewItemResponse(
                category="failed_sign_in_pressure",
                severity="attention" if members_under_sign_in_lockout > 0 else "healthy",
                item_count=members_under_sign_in_lockout,
                tenant_id=None,
                user_id=first_failed_sign_in_pressure_user_record.user.id if first_failed_sign_in_pressure_user_record is not None else None,
                membership_id=None,
                follow_up=self._build_access_governance_review_follow_up(
                    user_id=first_failed_sign_in_pressure_user_record.user.id if first_failed_sign_in_pressure_user_record is not None else None,
                    member_account_filter="active",
                    management_panel="user-edit",
                ),
            ),
            "invitation_activation_pressure": UserAccessGovernanceReviewItemResponse(
                category="invitation_activation_pressure",
                severity="attention" if members_with_failed_invitation_activation > 0 else "healthy",
                item_count=members_with_failed_invitation_activation,
                tenant_id=None,
                user_id=first_failed_invitation_activation_user_record.user.id
                if first_failed_invitation_activation_user_record is not None
                else None,
                membership_id=None,
                follow_up=self._build_access_governance_review_follow_up(
                    user_id=first_failed_invitation_activation_user_record.user.id
                    if first_failed_invitation_activation_user_record is not None
                    else None,
                    member_relationship_filter="invited",
                    management_panel="user-edit",
                ),
            ),
            "session_spread_pressure": UserAccessGovernanceReviewItemResponse(
                category="session_spread_pressure",
                severity="attention" if members_with_session_spread > 0 else "healthy",
                item_count=members_with_session_spread,
                tenant_id=None,
                user_id=first_session_spread_user_record.user.id if first_session_spread_user_record is not None else None,
                membership_id=None,
                follow_up=self._build_access_governance_review_follow_up(
                    user_id=first_session_spread_user_record.user.id if first_session_spread_user_record is not None else None,
                    member_account_filter="active",
                    management_panel="user-edit",
                ),
            ),
        }

        return UserAccessGovernanceSummaryResponse(
            total_members=total_members,
            active_accounts=active_accounts,
            inactive_accounts=inactive_accounts,
            active_memberships=active_memberships,
            invited_memberships=invited_memberships,
            suspended_memberships=suspended_memberships,
            dormant_accounts=dormant_accounts,
            expiring_invitations=expiring_invitations,
            expired_invitations=expired_invitations,
            recent_failed_sign_in_events=len(recent_failed_sign_in_events),
            members_under_sign_in_lockout=members_under_sign_in_lockout,
            recent_failed_invitation_activation_events=len(recent_failed_invitation_activation_events),
            members_with_failed_invitation_activation=members_with_failed_invitation_activation,
            members_with_session_spread=members_with_session_spread,
            total_audit_events=total_audit_events,
            sensitive_audit_events=sensitive_audit_events,
            active_sessions=active_sessions,
            sessions_expiring_within_24_hours=sessions_expiring_within_24_hours,
            review_queue_items=review_queue_items,
            event_breakdown=[
                UserAccessGovernanceEventCountResponse(
                    event_type=event_type,
                    event_count=event_breakdown_counts[event_type],
                )
                for event_type in self._ACCESS_EVENT_TYPE_ORDER
                if event_breakdown_counts.get(event_type, 0) > 0
            ],
            review_items=[
                review_items_by_category[category]
                for category in self._REVIEW_ITEM_ORDER
            ],
        )

    def _build_access_governance_review_follow_up(
        self,
        *,
        tenant_id: UUID | None = None,
        user_id: UUID | None = None,
        membership_id: UUID | None = None,
        member_relationship_filter: str | None = None,
        member_account_filter: str | None = None,
        management_panel: str | None = None,
    ) -> UserAccessGovernanceReviewFollowUpResponse | None:
        if (
            tenant_id is None
            and user_id is None
            and membership_id is None
            and member_relationship_filter is None
            and member_account_filter is None
            and management_panel is None
        ):
            return None

        return UserAccessGovernanceReviewFollowUpResponse(
            tenant_id=tenant_id,
            user_id=user_id,
            membership_id=membership_id,
            member_relationship_filter=member_relationship_filter,
            member_account_filter=member_account_filter,
            management_panel=management_panel,
        )

    async def get_user(self, *, user_id: UUID) -> UserDirectoryResponse:
        return await self.get_user_directory_entry(user_id)

    async def update_user(
        self,
        *,
        user_id: UUID,
        request: UserUpdateRequest,
        actor_user_id: UUID | None = None,
    ) -> UserDirectoryResponse:
        user = await self.user_repository.update_user(
            user_id=user_id,
            email=request.email,
            display_name=request.display_name,
            is_active=request.is_active,
            role=request.role,
            password_hash=None,
        )
        if user is None:
            raise ResourceNotFoundError("User not found.")
        await self._enforce_session_access_boundary(
            user_id=user.id,
            actor_user_id=actor_user_id,
            reason="Account access changed. Sign in again to continue.",
        )
        return await self.get_user_directory_entry(user.id)

    def _is_password_auth_mode(self) -> bool:
        return self.settings.auth_primary_mode in self._PASSWORD_INPUT_AUTH_MODES

    def _is_local_form_auth_mode(self) -> bool:
        return self.settings.auth_primary_mode in self._LOCAL_FORM_AUTH_MODES

    def _is_invitation_activation_auth_mode(self) -> bool:
        return self.settings.auth_primary_mode in self._INVITATION_ACTIVATION_AUTH_MODES

    def _require_local_form_auth_mode(self, error_message: str) -> None:
        if not self._is_local_form_auth_mode():
            raise ResourceConflictError(error_message)

    def _require_invitation_activation_auth_mode(self, error_message: str) -> None:
        if not self._is_invitation_activation_auth_mode():
            raise ResourceConflictError(error_message)

    def _require_password_auth_mode(self, error_message: str) -> None:
        if not self._is_password_auth_mode():
            raise ResourceConflictError(error_message)

    def _resolve_provider_display_name(self, primary_mode: str) -> str:
        configured_name = self.settings.auth_provider_display_name.strip()
        if configured_name:
            return configured_name
        if primary_mode == "oidc":
            return "OIDC"
        if primary_mode == "saml":
            return "SAML"
        return "Identity Provider"

    def _build_provider_sign_in_url(self, *, return_to: str | None = None) -> str | None:
        base_url = (self.settings.auth_provider_sign_in_url or "").strip()
        if not base_url:
            return None

        normalized_return_to = (return_to or "").strip()
        if not normalized_return_to.startswith("/"):
            return base_url

        split_url = urlsplit(base_url)
        existing_query = dict(parse_qsl(split_url.query, keep_blank_values=True))
        existing_query["return_to"] = normalized_return_to
        return urlunsplit(
            (
                split_url.scheme,
                split_url.netloc,
                split_url.path,
                urlencode(existing_query),
                split_url.fragment,
            )
        )

    def _build_provider_post_sign_out_url(self, *, return_to: str | None = None) -> str | None:
        base_url = (self.settings.auth_provider_post_sign_out_url or "").strip()
        if not base_url:
            return None

        normalized_return_to = (return_to or "").strip()
        if not normalized_return_to.startswith("/"):
            return base_url

        split_url = urlsplit(base_url)
        existing_query = dict(parse_qsl(split_url.query, keep_blank_values=True))
        existing_query["return_to"] = normalized_return_to
        return urlunsplit(
            (
                split_url.scheme,
                split_url.netloc,
                split_url.path,
                urlencode(existing_query),
                split_url.fragment,
            )
        )

    def _require_password(self, password: str | None, *, error_message: str) -> str:
        normalized_password = (password or "").strip()
        if not normalized_password:
            raise ResourceConflictError(error_message)
        if len(normalized_password) < 8:
            raise ResourceConflictError("Password must be at least 8 characters.")
        return normalized_password

    def _resolve_password_hash(
        self,
        password: str | None,
        *,
        required: bool,
        error_message: str,
    ) -> str | None:
        normalized_password = (password or "").strip()
        if not normalized_password:
            if required:
                raise ResourceConflictError(error_message)
            return None
        if len(normalized_password) < 8:
            raise ResourceConflictError("Password must be at least 8 characters.")
        return hash_password(normalized_password)

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
        await self._enforce_session_access_boundary(
            user_id=user_id,
            actor_user_id=actor_user_id,
            reason=request.reason or "Tenant access changed. Sign in again to continue.",
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
        await self._enforce_session_access_boundary(
            user_id=user_id,
            actor_user_id=actor_user_id,
            reason="Tenant access was removed. Sign in again to continue.",
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
        await self._enforce_session_access_boundary(
            user_id=user_id,
            actor_user_id=actor_user_id,
            reason=(request.reason if request is not None else None) or "Invitation access was revoked.",
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

        invitation_credential = await self.user_repository.refresh_tenant_membership_invitation(
            membership_id=membership_id,
            invitation_issued_by_user_id=actor_user_id,
        )
        if invitation_credential is None:
            raise ResourceConflictError("Unable to issue invitation credentials for this membership.")
        if hasattr(invitation_credential, "membership"):
            membership = invitation_credential.membership
            invitation_token = invitation_credential.invitation_token
        else:
            membership = invitation_credential
            invitation_token = getattr(membership, "invitation_token", None)
        if not invitation_token:
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
            invitation_token=invitation_token,
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

    @staticmethod
    def _can_use_directory_session(user: UserDirectoryResponse) -> bool:
        has_active_membership = any(membership.membership_status == "active" for membership in user.memberships)
        if has_active_membership:
            return user.is_active
        if len(user.memberships) == 0 and user.role == "super_admin":
            return user.is_active
        return False

    async def _enforce_session_access_boundary(
        self,
        *,
        user_id: UUID,
        actor_user_id: UUID | None = None,
        reason: str,
    ) -> None:
        if self.user_session_repository is None:
            return

        directory_user = await self.get_user_directory_entry(user_id)
        if self._can_use_directory_session(directory_user):
            return

        await self.revoke_all_sessions_for_user(
            user_id=user_id,
            actor_user_id=actor_user_id,
            reason=reason,
        )

    async def _revoke_sessions_after_password_change(
        self,
        *,
        user_id: UUID,
        actor_user_id: UUID | None = None,
        current_session_id: UUID | None = None,
    ) -> None:
        if self.user_session_repository is None:
            return

        if current_session_id is not None:
            await self.revoke_other_sessions_for_current_user(
                user_id=user_id,
                current_session_id=current_session_id,
                actor_user_id=actor_user_id,
                reason="Password changed. Other sessions were signed out.",
            )
            return

        await self.revoke_all_sessions_for_user(
            user_id=user_id,
            actor_user_id=actor_user_id,
            reason="Password changed. Sign in again to continue.",
        )

    async def _issue_authenticated_session(
        self,
        *,
        user_id: UUID,
        login_mode: str,
        session_telemetry: UserSessionTelemetry | None = None,
    ) -> UserAuthenticatedSessionResponse:
        if self.user_session_repository is None:
            raise RuntimeError("User session repository is required for authenticated sign-in.")

        updated_user = await self.user_repository.update_user_last_signed_in_at(user_id=user_id)
        if updated_user is None:
            raise ResourceNotFoundError("User not found.")

        user_session, session_token = await self.user_session_repository.create_user_session(
            user_id=user_id,
            authentication_mode=login_mode,
            user_agent=session_telemetry.user_agent if session_telemetry is not None else None,
            ip_address=session_telemetry.ip_address if session_telemetry is not None else None,
            device_label=session_telemetry.device_label if session_telemetry is not None else None,
        )
        await self.user_repository.create_user_access_event(
            user_id=user_id,
            event_type="sign_in_succeeded",
            detail_json={
                "login_mode": login_mode,
                "session_id": str(user_session.id),
                "session_expires_at": user_session.expires_at.isoformat(),
                "ip_address": user_session.ip_address,
                "device_label": user_session.device_label,
            },
        )
        directory_user = await self.get_user_directory_entry(user_id)
        permissions = await self.build_user_permissions_from_policy(directory_user)
        return UserAuthenticatedSessionResponse(
            user=directory_user,
            session=UserSessionResponse(
                session_token=session_token,
                expires_at=user_session.expires_at,
            ),
            permissions=permissions,
        )

    async def _ensure_sign_in_not_rate_limited(self, *, user_id: UUID) -> None:
        recent_failures = await self._list_recent_failed_sign_in_events(user_id=user_id)
        lockout_until = self._resolve_sign_in_lockout_until(recent_failures)
        if lockout_until is None:
            return

        current_time = datetime.now(timezone.utc)
        remaining_seconds = max(int((lockout_until - current_time).total_seconds()), 1)
        raise ResourceConflictError(self._build_sign_in_rate_limit_message(remaining_seconds))

    async def _ensure_invitation_activation_not_rate_limited(self, *, user_id: UUID) -> None:
        recent_failures = await self._list_recent_failed_invitation_activation_events(user_id=user_id)
        lockout_until = self._resolve_sign_in_lockout_until(recent_failures)
        if lockout_until is None:
            return

        current_time = datetime.now(timezone.utc)
        remaining_seconds = max(int((lockout_until - current_time).total_seconds()), 1)
        raise ResourceConflictError(self._build_invitation_activation_rate_limit_message(remaining_seconds))

    async def _record_failed_sign_in_attempt(
        self,
        *,
        user_id: UUID,
        email: str,
        reason_code: str,
        fallback_message: str,
        session_telemetry: UserSessionTelemetry | None,
    ) -> str:
        recent_failures = await self._list_recent_failed_sign_in_events(user_id=user_id)
        attempt_count = len(recent_failures) + 1
        await self.user_repository.create_user_access_event(
            user_id=user_id,
            event_type=self._FAILED_SIGN_IN_EVENT_TYPE,
            detail_json={
                "email": email.strip().lower(),
                "reason_code": reason_code,
                "authentication_mode": self.settings.auth_primary_mode,
                "failed_window_attempts": attempt_count,
                "failed_window_minutes": max(self.settings.auth_failed_sign_in_window_minutes, 1),
                "lockout_minutes": max(self.settings.auth_failed_sign_in_lockout_minutes, 1),
                "ip_address": session_telemetry.ip_address if session_telemetry is not None else None,
                "device_label": session_telemetry.device_label if session_telemetry is not None else None,
            },
        )
        if attempt_count >= max(self.settings.auth_failed_sign_in_max_attempts, 1):
            return self._build_sign_in_rate_limit_message(max(self.settings.auth_failed_sign_in_lockout_minutes, 1) * 60)
        return fallback_message

    async def _record_invitation_activation_failure(
        self,
        *,
        user_id: UUID,
        email: str,
        reason_code: str,
        fallback_message: str,
        session_telemetry: UserSessionTelemetry | None,
        membership_id: UUID | None = None,
        tenant_id: UUID | None = None,
    ) -> str:
        recent_failures = await self._list_recent_failed_invitation_activation_events(user_id=user_id)
        attempt_count = len(recent_failures) + 1
        await self.user_repository.create_user_access_event(
            user_id=user_id,
            tenant_id=tenant_id,
            membership_id=membership_id,
            event_type=self._FAILED_INVITATION_ACTIVATION_EVENT_TYPE,
            detail_json={
                "email": email.strip().lower(),
                "reason": fallback_message,
                "reason_code": reason_code,
                "authentication_mode": self.settings.auth_primary_mode,
                "failed_window_attempts": attempt_count,
                "failed_window_minutes": max(self.settings.auth_failed_sign_in_window_minutes, 1),
                "lockout_minutes": max(self.settings.auth_failed_sign_in_lockout_minutes, 1),
                "ip_address": session_telemetry.ip_address if session_telemetry is not None else None,
                "device_label": session_telemetry.device_label if session_telemetry is not None else None,
            },
        )
        if attempt_count >= max(self.settings.auth_failed_sign_in_max_attempts, 1):
            return self._build_invitation_activation_rate_limit_message(
                max(self.settings.auth_failed_sign_in_lockout_minutes, 1) * 60
            )
        return fallback_message

    async def _list_recent_failed_sign_in_events(self, *, user_id: UUID) -> list[UserAccessEventRecord]:
        recent_events = await self._list_recent_failed_sign_in_events_for_scope(
            tenant_id=None,
            user_ids=[user_id],
        )
        return [event for event in recent_events if event.event.user_id == user_id]

    async def _list_recent_failed_invitation_activation_events(
        self,
        *,
        user_id: UUID,
    ) -> list[UserAccessEventRecord]:
        recent_events = await self._list_recent_failed_invitation_activation_events_for_scope(
            tenant_id=None,
            user_ids=[user_id],
        )
        return [event for event in recent_events if event.event.user_id == user_id]

    async def _list_recent_failed_sign_in_events_for_scope(
        self,
        *,
        tenant_id: UUID | None,
        user_ids: list[UUID],
    ) -> list[UserAccessEventRecord]:
        if len(user_ids) == 0:
            return []
        window_start = datetime.now(timezone.utc) - timedelta(
            minutes=max(self.settings.auth_failed_sign_in_window_minutes, 1)
        )
        recent_events = await self.user_repository.list_user_access_events(
            tenant_id=tenant_id,
            event_type=self._FAILED_SIGN_IN_EVENT_TYPE,
            created_after=window_start,
            limit=max(len(user_ids) * max(self.settings.auth_failed_sign_in_max_attempts, 1) * 3, 50),
        )
        return [event for event in recent_events if event.event.user_id in user_ids]

    async def _list_recent_failed_invitation_activation_events_for_scope(
        self,
        *,
        tenant_id: UUID | None,
        user_ids: list[UUID],
    ) -> list[UserAccessEventRecord]:
        if len(user_ids) == 0:
            return []
        window_start = datetime.now(timezone.utc) - timedelta(
            minutes=max(self.settings.auth_failed_sign_in_window_minutes, 1)
        )
        recent_events = await self.user_repository.list_user_access_events(
            tenant_id=tenant_id,
            event_type=self._FAILED_INVITATION_ACTIVATION_EVENT_TYPE,
            created_after=window_start,
            limit=max(len(user_ids) * 6, 50),
        )
        return [event for event in recent_events if event.event.user_id in user_ids]

    @staticmethod
    def _group_failed_sign_in_events_by_user(
        events: list[UserAccessEventRecord],
    ) -> dict[UUID, int]:
        counts: dict[UUID, int] = {}
        for event in events:
            counts[event.event.user_id] = counts.get(event.event.user_id, 0) + 1
        return counts

    @staticmethod
    def _group_failed_invitation_activation_events_by_user(
        events: list[UserAccessEventRecord],
    ) -> dict[UUID, int]:
        counts: dict[UUID, int] = {}
        for event in events:
            counts[event.event.user_id] = counts.get(event.event.user_id, 0) + 1
        return counts

    async def _resolve_users_with_session_spread(self, *, user_ids: list[UUID]) -> set[UUID]:
        if self.user_session_repository is None or len(user_ids) == 0:
            return set()
        if hasattr(self.user_session_repository, "list_active_user_sessions_for_users"):
            sessions_by_user = await self.user_session_repository.list_active_user_sessions_for_users(user_ids=user_ids)
            return {
                user_id
                for user_id, sessions in sessions_by_user.items()
                if self._user_has_session_spread(sessions)
            }

        matched_user_ids: set[UUID] = set()
        for user_id in user_ids:
            sessions = await self.user_session_repository.list_active_user_sessions(user_id=user_id)
            if self._user_has_session_spread(sessions):
                matched_user_ids.add(user_id)
        return matched_user_ids

    def _user_has_session_spread(self, sessions: list[object]) -> bool:
        max_active_sessions = max(self.settings.auth_session_review_max_active_sessions_per_user, 1)
        max_distinct_devices = max(self.settings.auth_session_review_max_distinct_devices_per_user, 1)
        distinct_devices = {
            str(getattr(session, "device_label", "")).strip()
            for session in sessions
            if isinstance(getattr(session, "device_label", None), str) and str(getattr(session, "device_label")).strip()
        }
        return len(sessions) >= max_active_sessions or len(distinct_devices) >= max_distinct_devices

    def _resolve_sign_in_lockout_until(
        self,
        recent_failures: list[UserAccessEventRecord],
        *,
        current_time: datetime | None = None,
    ) -> datetime | None:
        max_attempts = max(self.settings.auth_failed_sign_in_max_attempts, 1)
        if len(recent_failures) < max_attempts:
            return None

        now = current_time or datetime.now(timezone.utc)
        latest_failure = recent_failures[0].event.created_at
        lockout_until = latest_failure + timedelta(minutes=max(self.settings.auth_failed_sign_in_lockout_minutes, 1))
        if lockout_until <= now:
            return None

        return lockout_until

    @staticmethod
    def _build_sign_in_rate_limit_message(remaining_seconds: int) -> str:
        remaining_minutes = max(1, (remaining_seconds + 59) // 60)
        return f"Too many failed sign-in attempts. Try again in about {remaining_minutes} minute(s)."

    @staticmethod
    def _build_invitation_activation_rate_limit_message(remaining_seconds: int) -> str:
        remaining_minutes = max(1, (remaining_seconds + 59) // 60)
        return f"Too many failed invitation activation attempts. Try again in about {remaining_minutes} minute(s)."

    @staticmethod
    def _resolve_sign_in_failure_reason_code(user: UserDirectoryResponse) -> str:
        if not user.is_active:
            return "inactive_account"
        if any(membership.membership_status == "invited" for membership in user.memberships):
            return "invited_membership"
        return "inactive_membership"


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
