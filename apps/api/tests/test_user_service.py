from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from uuid import uuid4

import pytest

from ragpilot_api.application.errors import ResourceConflictError
from ragpilot_api.application.identity.passwords import hash_password, verify_password
from ragpilot_api.application.identity.user_service import UserService, UserSessionTelemetry
from ragpilot_api.contracts.http.user_contracts import (
    UserBootstrapRequest,
    UserCurrentPasswordChangeRequest,
    UserInvitationActivationRequest,
    UserLoginRequest,
    UserPasswordResetRequest,
)
from ragpilot_api.infrastructure.database.repositories.user_repository import (
    UserRepository,
    UserAccessEventRecord,
    UserDirectoryRecord,
    UserMembershipDirectoryRecord,
)
from ragpilot_api.shared.settings import Settings


def build_tenant(*, tenant_id=None, name: str, slug: str):
    return SimpleNamespace(id=tenant_id or uuid4(), name=name, slug=slug, deleted_at=None)


def build_membership(
    *,
    user_id,
    tenant_id=None,
    status: str,
    invitation_token: str | None = None,
    invited_at=None,
    invitation_expires_at=None,
    activated_at=None,
):
    now = datetime.now(timezone.utc)
    return SimpleNamespace(
        id=uuid4(),
        tenant_id=tenant_id or uuid4(),
        user_id=user_id,
        membership_status=status,
        invitation_token=invitation_token,
        invitation_issue_count=0,
        last_invitation_issued_by_user_id=None,
        invited_at=invited_at,
        invitation_expires_at=invitation_expires_at,
        activated_at=activated_at,
        created_at=now,
        updated_at=now,
    )


class FakeTenantRepository:
    def __init__(self, tenants=None) -> None:
        self.tenants = tenants or {}

    async def get_tenant(self, *, tenant_id):
        return self.tenants.get(tenant_id)


class FakeUserRepository:
    def __init__(self, *, user_count: int = 0, user=None, memberships=None) -> None:
        self.user_count = user_count
        self.user = user
        self.memberships = memberships or []
        self.created_role: str | None = None
        self.created_password_hash: str | None = None
        self.reactivated = False
        self.last_signed_in_user_id = None
        self.access_events: list[SimpleNamespace] = []

    async def count_users(self) -> int:
        return self.user_count

    async def create_user(self, *, email: str, display_name: str, is_active: bool, role: str, password_hash: str | None = None):
        now = datetime.now(timezone.utc)
        self.created_role = role
        self.created_password_hash = password_hash
        self.user = SimpleNamespace(
            id=uuid4(),
            email=email,
            display_name=display_name,
            is_active=is_active,
            role=role,
            last_signed_in_at=None,
            password_hash=password_hash,
            created_at=now,
            updated_at=now,
            deleted_at=None,
        )
        return self.user

    async def get_user(self, *, user_id):
        if self.user and self.user.id == user_id:
            return self.user
        return None

    async def get_user_by_email(self, *, email: str):
        if self.user and self.user.email == email:
            return self.user
        return None

    async def get_tenant_membership(self, *, membership_id):
        for record in self.memberships:
            if record.membership.id == membership_id:
                return record.membership
        return None

    async def list_tenant_memberships_for_user(self, *, user_id):
        return [record.membership for record in self.memberships if record.membership.user_id == user_id]

    async def update_user_active_state(self, *, user_id, is_active: bool):
        if self.user and self.user.id == user_id:
            self.user.is_active = is_active
            self.reactivated = is_active
        return self.user

    async def update_user(
        self,
        *,
        user_id,
        email: str,
        display_name: str,
        is_active: bool,
        role: str | None = None,
        password_hash: str | None = None,
    ):
        if self.user and self.user.id == user_id:
            self.user.email = email
            self.user.display_name = display_name
            self.user.is_active = is_active
            if role is not None:
                self.user.role = role
            if password_hash is not None:
                self.user.password_hash = password_hash
        return self.user

    async def set_user_password(self, *, user_id, password_hash: str):
        if self.user and self.user.id == user_id:
            self.user.password_hash = password_hash
        return self.user

    async def update_user_last_signed_in_at(self, *, user_id):
        if self.user and self.user.id == user_id:
            self.user.last_signed_in_at = datetime.now(timezone.utc)
            self.last_signed_in_user_id = user_id
        return self.user

    async def update_tenant_membership_status(self, *, membership_id, membership_status: str, invitation_issued_by_user_id=None):
        now = datetime.now(timezone.utc)
        for record in self.memberships:
            if record.membership.id == membership_id:
                record.membership.membership_status = membership_status
                if membership_status == "active":
                    record.membership.invitation_token = None
                    record.membership.invitation_expires_at = None
                    record.membership.activated_at = now
                elif membership_status == "invited":
                    record.membership.invitation_token = "RP-REFRESHED"
                    record.membership.invitation_issue_count = int(getattr(record.membership, "invitation_issue_count", 0) or 0) + 1
                    record.membership.last_invitation_issued_by_user_id = invitation_issued_by_user_id
                    record.membership.invited_at = now
                    record.membership.invitation_expires_at = now
                    record.membership.activated_at = None
                else:
                    record.membership.invitation_token = None
                    record.membership.invitation_expires_at = None
                record.membership.updated_at = now
                return record.membership
        return None

    async def refresh_tenant_membership_invitation(self, *, membership_id, invitation_issued_by_user_id=None):
        now = datetime.now(timezone.utc)
        for record in self.memberships:
            if record.membership.id == membership_id:
                record.membership.membership_status = "invited"
                record.membership.invitation_token = "RP-REFRESHED"
                record.membership.invitation_issue_count = int(getattr(record.membership, "invitation_issue_count", 0) or 0) + 1
                record.membership.last_invitation_issued_by_user_id = invitation_issued_by_user_id
                record.membership.invited_at = now
                record.membership.invitation_expires_at = now
                record.membership.activated_at = None
                record.membership.updated_at = now
                return record.membership
        return None

    async def delete_tenant_membership(self, *, membership_id):
        original_count = len(self.memberships)
        self.memberships = [
            record for record in self.memberships if record.membership.id != membership_id
        ]
        return len(self.memberships) != original_count

    async def get_user_directory_record(self, *, user_id):
        if not self.user or self.user.id != user_id:
            return None
        return UserDirectoryRecord(user=self.user, memberships=self.memberships)

    async def list_users(
        self,
        *,
        tenant_id=None,
        membership_status=None,
        query=None,
        email=None,
        is_active=None,
    ):
        if self.user is None:
            return []

        records = [UserDirectoryRecord(user=self.user, memberships=self.memberships)]
        if tenant_id is not None:
            records = [
                UserDirectoryRecord(
                    user=record.user,
                    memberships=[
                        membership_record
                        for membership_record in record.memberships
                        if membership_record.membership.tenant_id == tenant_id
                    ],
                )
                for record in records
            ]
            records = [record for record in records if len(record.memberships) > 0]
        if membership_status is not None:
            records = [
                UserDirectoryRecord(
                    user=record.user,
                    memberships=[
                        membership_record
                        for membership_record in record.memberships
                        if membership_record.membership.membership_status == membership_status
                    ],
                )
                for record in records
            ]
            records = [record for record in records if len(record.memberships) > 0]
        if query is not None and query.strip():
            normalized_query = query.strip().lower()
            records = [
                record
                for record in records
                if normalized_query in record.user.display_name.lower()
                or normalized_query in record.user.email.lower()
            ]
        if email is not None and email.strip():
            records = [record for record in records if record.user.email == email.strip().lower()]
        if is_active is not None:
            records = [record for record in records if bool(record.user.is_active) is bool(is_active)]
        return records

    async def create_user_access_event(
        self,
        *,
        user_id,
        event_type: str,
        tenant_id=None,
        membership_id=None,
        actor_user_id=None,
        detail_json=None,
    ):
        event = SimpleNamespace(
            id=uuid4(),
            tenant_id=tenant_id,
            user_id=user_id,
            membership_id=membership_id,
            actor_user_id=actor_user_id,
            event_type=event_type,
            detail_json=detail_json or {},
            created_at=datetime.now(timezone.utc),
        )
        self.access_events.append(event)
        return event

    async def list_user_access_events(self, *, tenant_id=None, user_id=None, event_type=None, created_after=None, query=None, limit=20):
        events = self.access_events
        if tenant_id is not None:
            events = [event for event in events if event.tenant_id == tenant_id]
        if user_id is not None:
            events = [event for event in events if event.user_id == user_id]
        if event_type is not None:
            events = [event for event in events if event.event_type == event_type]
        if created_after is not None:
            events = [event for event in events if event.created_at >= created_after]
        if query is not None and query.strip():
            normalized_query = query.strip().lower()
            events = [
                event
                for event in events
                if normalized_query in event.event_type.lower()
                or normalized_query in getattr(self.user, "display_name", "").lower()
                or normalized_query in getattr(self.user, "email", "").lower()
                or normalized_query in str(event.detail_json).lower()
            ]
        events = list(reversed(events))[:limit]
        return [
            UserAccessEventRecord(
                event=event,
                user=self.user,
                actor=self.user if event.actor_user_id == getattr(self.user, "id", None) else None,
                tenant=next((record.tenant for record in self.memberships if record.membership.tenant_id == event.tenant_id), None),
            )
            for event in events
        ]

    async def count_user_access_events(self, *, tenant_id=None, user_ids=None, event_types=None):
        events = self.access_events
        if tenant_id is not None:
            events = [event for event in events if event.tenant_id == tenant_id]
        if user_ids is not None:
            events = [event for event in events if event.user_id in user_ids]
        if event_types is not None:
            events = [event for event in events if event.event_type in event_types]
        return len(events)

    async def count_user_access_events_grouped(self, *, tenant_id=None, user_ids=None):
        events = self.access_events
        if tenant_id is not None:
            events = [event for event in events if event.tenant_id == tenant_id]
        if user_ids is not None:
            events = [event for event in events if event.user_id in user_ids]

        grouped: dict[str, int] = {}
        for event in events:
            grouped[event.event_type] = grouped.get(event.event_type, 0) + 1
        return grouped


class FakeRolePermissionRepository:
    def __init__(self, role_permissions=None) -> None:
        self.role_permissions = role_permissions or {}

    async def list_role_permission_slugs(self):
        return self.role_permissions


class FakeUserSessionRepository:
    def __init__(self) -> None:
        self.created_sessions: list[SimpleNamespace] = []
        self.revoked_session_ids: list[object] = []
        self.batch_list_calls = 0

    async def create_user_session(
        self,
        *,
        user_id,
        authentication_mode: str,
        user_agent: str | None = None,
        ip_address: str | None = None,
        device_label: str | None = None,
    ):
        now = datetime.now(timezone.utc)
        session = SimpleNamespace(
            id=uuid4(),
            user_id=user_id,
            authentication_mode=authentication_mode,
            user_agent=user_agent,
            ip_address=ip_address,
            device_label=device_label,
            created_at=now,
            updated_at=now,
            expires_at=now + timedelta(days=14),
            revoked_at=None,
        )
        self.created_sessions.append(session)
        return session, "rp_sess_test_token"

    async def revoke_user_session(self, *, session_id):
        self.revoked_session_ids.append(session_id)
        return next((session for session in self.created_sessions if session.id == session_id), None)

    async def get_user_session(self, *, session_id):
        return next((session for session in self.created_sessions if session.id == session_id), None)

    async def list_active_user_sessions(self, *, user_id):
        return [session for session in self.created_sessions if session.user_id == user_id and getattr(session, "revoked_at", None) is None]

    async def list_active_user_sessions_for_users(self, *, user_ids):
        self.batch_list_calls += 1
        grouped_sessions: dict[object, list[SimpleNamespace]] = {}
        for user_id in user_ids:
            sessions = [
                session
                for session in self.created_sessions
                if session.user_id == user_id and getattr(session, "revoked_at", None) is None
            ]
            if sessions:
                grouped_sessions[user_id] = sessions
        return grouped_sessions

    async def count_active_user_sessions(self, *, user_ids=None, expires_before=None):
        sessions = [session for session in self.created_sessions if getattr(session, "revoked_at", None) is None]
        if user_ids is not None:
            sessions = [session for session in sessions if session.user_id in user_ids]
        if expires_before is not None:
            sessions = [session for session in sessions if session.expires_at <= expires_before]
        return len(sessions)


@pytest.mark.anyio
async def test_bootstrap_user_assigns_super_admin_to_first_directory_user() -> None:
    user_repository = FakeUserRepository(user_count=0)
    service = UserService(
        user_repository=user_repository,
        user_session_repository=None,
        tenant_repository=FakeTenantRepository(),
    )

    response = await service.bootstrap_user(
        UserBootstrapRequest(email="owner@ragpilot.local", display_name="Platform Owner")
    )

    assert user_repository.created_role == "super_admin"
    assert response.role == "super_admin"


@pytest.mark.anyio
async def test_bootstrap_user_rejects_open_signup_after_first_directory_user_exists() -> None:
    existing_user = SimpleNamespace(
        id=uuid4(),
        email="owner@ragpilot.local",
        display_name="Platform Owner",
        is_active=True,
        role="super_admin",
        last_signed_in_at=None,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
        deleted_at=None,
    )
    user_repository = FakeUserRepository(user_count=1, user=existing_user)
    service = UserService(
        user_repository=user_repository,
        user_session_repository=None,
        tenant_repository=FakeTenantRepository(),
    )

    with pytest.raises(
        ResourceConflictError,
        match="Directory bootstrap is closed. Ask an administrator to invite this member before signing in.",
    ):
        await service.bootstrap_user(
            UserBootstrapRequest(email="new-member@ragpilot.local", display_name="New Member")
        )


@pytest.mark.anyio
async def test_get_bootstrap_status_allows_initial_super_admin_when_directory_is_empty() -> None:
    user_repository = FakeUserRepository(user_count=0)
    service = UserService(
        user_repository=user_repository,
        user_session_repository=None,
        tenant_repository=FakeTenantRepository(),
    )

    response = await service.get_bootstrap_status()

    assert response.has_users is False
    assert response.allow_initial_super_admin is True


@pytest.mark.anyio
async def test_get_bootstrap_status_closes_initial_super_admin_when_provider_managed() -> None:
    user_repository = FakeUserRepository(user_count=0)
    service = UserService(
        user_repository=user_repository,
        user_session_repository=FakeUserSessionRepository(),
        tenant_repository=FakeTenantRepository(),
        settings=Settings(auth_primary_mode="oidc"),
    )

    response = await service.get_bootstrap_status()

    assert response.has_users is False
    assert response.allow_initial_super_admin is False


@pytest.mark.anyio
async def test_get_authentication_mode_returns_directory_local_boundary() -> None:
    user_repository = FakeUserRepository(user_count=0)
    service = UserService(
        user_repository=user_repository,
        user_session_repository=None,
        tenant_repository=FakeTenantRepository(),
        settings=Settings(auth_primary_mode="directory_local"),
    )

    response = await service.get_authentication_mode()

    assert response.primary_mode == "directory_local"
    assert response.sign_in_method == "local_form"
    assert response.session_transport == "bearer_session"
    assert response.supports_display_name_input is True
    assert response.supports_password_input is False
    assert response.supports_invitation_activation is True
    assert response.allow_initial_super_admin is True
    assert response.provider_protocol is None


@pytest.mark.anyio
async def test_get_authentication_mode_returns_password_local_boundary() -> None:
    user_repository = FakeUserRepository(user_count=1)
    service = UserService(
        user_repository=user_repository,
        user_session_repository=None,
        tenant_repository=FakeTenantRepository(),
        settings=Settings(auth_primary_mode="password_local"),
    )

    response = await service.get_authentication_mode()

    assert response.primary_mode == "password_local"
    assert response.sign_in_method == "local_form"
    assert response.supports_display_name_input is False
    assert response.supports_password_input is True
    assert response.supports_invitation_activation is True
    assert response.allow_initial_super_admin is False


@pytest.mark.anyio
async def test_get_authentication_mode_returns_provider_redirect_boundary() -> None:
    user_repository = FakeUserRepository(user_count=1)
    service = UserService(
        user_repository=user_repository,
        user_session_repository=None,
        tenant_repository=FakeTenantRepository(),
        settings=Settings(
            auth_primary_mode="oidc",
            auth_provider_display_name="Company SSO",
            auth_provider_sign_in_url="https://login.example.com/authorize?client=RAGPilot",
            auth_provider_post_sign_out_url="https://login.example.com/logout?client=RAGPilot",
        ),
    )

    response = await service.get_authentication_mode(return_to="/chat?kb=demo")

    assert response.primary_mode == "oidc"
    assert response.sign_in_method == "external_redirect"
    assert response.supports_display_name_input is False
    assert response.supports_password_input is False
    assert response.supports_invitation_activation is False
    assert response.allow_initial_super_admin is False
    assert response.provider_protocol == "oidc"
    assert response.provider_display_name == "Company SSO"
    assert response.provider_sign_in_url == "https://login.example.com/authorize?client=RAGPilot&return_to=%2Fchat%3Fkb%3Ddemo"
    assert response.provider_post_sign_out_url == "https://login.example.com/logout?client=RAGPilot&return_to=%2Fchat%3Fkb%3Ddemo"


@pytest.mark.anyio
async def test_bootstrap_user_rejects_provider_managed_authentication_modes() -> None:
    user_repository = FakeUserRepository(user_count=0)
    service = UserService(
        user_repository=user_repository,
        user_session_repository=None,
        tenant_repository=FakeTenantRepository(),
        settings=Settings(auth_primary_mode="oidc"),
    )

    with pytest.raises(ResourceConflictError, match="Bootstrap is unavailable for the current authentication mode."):
        await service.bootstrap_user(
            UserBootstrapRequest(email="owner@ragpilot.local", display_name="Platform Owner")
        )


@pytest.mark.anyio
async def test_assess_login_user_returns_invitation_activation_state() -> None:
    now = datetime.now(timezone.utc)
    user = SimpleNamespace(
        id=uuid4(),
        email="operator@ragpilot.local",
        display_name="RAGPilot Operator",
        is_active=True,
        role="operator",
        last_signed_in_at=None,
        created_at=now,
        updated_at=now,
        deleted_at=None,
    )
    invited_membership = build_membership(
        user_id=user.id,
        status="invited",
        invitation_token="RP-AB12CD34",
        invited_at=now - timedelta(days=1),
        invitation_expires_at=now + timedelta(days=2),
    )
    memberships = [
        UserMembershipDirectoryRecord(
            membership=invited_membership,
            tenant=build_tenant(tenant_id=invited_membership.tenant_id, name="RAGPilot Demo", slug="ragpilot-demo"),
        )
    ]
    user_repository = FakeUserRepository(user_count=1, user=user, memberships=memberships)
    service = UserService(
        user_repository=user_repository,
        user_session_repository=None,
        tenant_repository=FakeTenantRepository(),
    )

    response = await service.assess_login_user(email="operator@ragpilot.local")

    assert response.account_state == "invited"
    assert response.next_action == "activate_invitation"
    assert response.allow_sign_in is False
    assert response.invited_membership_count == 1
    assert response.expiring_invitation_count == 1


@pytest.mark.anyio
async def test_assess_login_user_returns_bootstrap_state_for_first_directory_entry() -> None:
    user_repository = FakeUserRepository(user_count=0)
    service = UserService(
        user_repository=user_repository,
        user_session_repository=None,
        tenant_repository=FakeTenantRepository(),
    )

    response = await service.assess_login_user(email="owner@ragpilot.local")

    assert response.account_state == "bootstrap_available"
    assert response.allow_sign_in is True
    assert response.next_action == "bootstrap"


@pytest.mark.anyio
async def test_assess_login_user_respects_provider_managed_boundary() -> None:
    service = UserService(
        user_repository=FakeUserRepository(user_count=0),
        user_session_repository=FakeUserSessionRepository(),
        tenant_repository=FakeTenantRepository(),
        settings=Settings(auth_primary_mode="oidc"),
    )

    response = await service.assess_login_user(email="owner@example.com")

    assert response.account_state == "not_found"
    assert response.allow_sign_in is False
    assert response.next_action == "contact_admin"


@pytest.mark.anyio
async def test_activate_user_invitations_reactivates_account_and_promotes_matching_invite() -> None:
    now = datetime.now(timezone.utc)
    user = SimpleNamespace(
        id=uuid4(),
        email="operator@ragpilot.local",
        display_name="RAGPilot Operator",
        is_active=False,
        role="operator",
        last_signed_in_at=None,
        created_at=now,
        updated_at=now,
        deleted_at=None,
    )
    matching_membership = build_membership(
        user_id=user.id,
        status="invited",
        invitation_token="RP-AB12CD34",
        invited_at=now,
        invitation_expires_at=now + timedelta(days=2),
    )
    other_invited_membership = build_membership(
        user_id=user.id,
        status="invited",
        invitation_token="RP-OTHER999",
        invited_at=now,
        invitation_expires_at=None,
    )
    suspended_membership = build_membership(user_id=user.id, status="suspended")
    memberships = [
        UserMembershipDirectoryRecord(
            membership=matching_membership,
            tenant=build_tenant(tenant_id=matching_membership.tenant_id, name="RAGPilot Demo", slug="ragpilot-demo"),
        ),
        UserMembershipDirectoryRecord(
            membership=other_invited_membership,
            tenant=build_tenant(
                tenant_id=other_invited_membership.tenant_id,
                name="Sandbox Tenant",
                slug="sandbox-tenant",
            ),
        ),
        UserMembershipDirectoryRecord(
            membership=suspended_membership,
            tenant=build_tenant(tenant_id=suspended_membership.tenant_id, name="Archive Tenant", slug="archive-tenant"),
        ),
    ]
    user_repository = FakeUserRepository(user_count=2, user=user, memberships=memberships)
    service = UserService(
        user_repository=user_repository,
        user_session_repository=FakeUserSessionRepository(),
        tenant_repository=FakeTenantRepository(),
    )

    response = await service.activate_user_invitations(
        UserInvitationActivationRequest(email="operator@ragpilot.local", invitation_token="rp-ab12cd34")
    )

    assert user_repository.reactivated is True
    assert response.user.is_active is True
    assert {membership.tenant_slug: membership.membership_status for membership in response.user.memberships} == {
        "ragpilot-demo": "active",
        "sandbox-tenant": "invited",
        "archive-tenant": "suspended",
    }
    activated_membership = next(
        membership for membership in response.user.memberships if membership.tenant_slug == "ragpilot-demo"
    )
    assert activated_membership.activated_at is not None
    assert user_repository.last_signed_in_user_id == user.id


@pytest.mark.anyio
async def test_activate_user_invitations_sets_password_when_password_local_is_enabled() -> None:
    now = datetime.now(timezone.utc)
    user = SimpleNamespace(
        id=uuid4(),
        email="operator@ragpilot.local",
        display_name="RAGPilot Operator",
        is_active=False,
        role="operator",
        password_hash=None,
        last_signed_in_at=None,
        created_at=now,
        updated_at=now,
        deleted_at=None,
    )
    matching_membership = build_membership(
        user_id=user.id,
        status="invited",
        invitation_token="RP-AB12CD34",
        invited_at=now,
        invitation_expires_at=now + timedelta(days=2),
    )
    memberships = [
        UserMembershipDirectoryRecord(
            membership=matching_membership,
            tenant=build_tenant(tenant_id=matching_membership.tenant_id, name="RAGPilot Demo", slug="ragpilot-demo"),
        )
    ]
    user_repository = FakeUserRepository(user_count=1, user=user, memberships=memberships)
    service = UserService(
        user_repository=user_repository,
        user_session_repository=FakeUserSessionRepository(),
        tenant_repository=FakeTenantRepository(),
        settings=Settings(auth_primary_mode="password_local"),
    )

    response = await service.activate_user_invitations(
        UserInvitationActivationRequest(
            email="operator@ragpilot.local",
            invitation_token="rp-ab12cd34",
            password="InvitePass123",
        )
    )

    assert response.user.is_active is True
    assert verify_password("InvitePass123", user_repository.user.password_hash) is True


@pytest.mark.anyio
async def test_activate_user_invitations_rejects_invalid_token_when_no_active_membership_exists() -> None:
    now = datetime.now(timezone.utc)
    user = SimpleNamespace(
        id=uuid4(),
        email="operator@ragpilot.local",
        display_name="RAGPilot Operator",
        is_active=False,
        role="operator",
        last_signed_in_at=None,
        created_at=now,
        updated_at=now,
        deleted_at=None,
    )
    invited_membership = build_membership(
        user_id=user.id,
        status="invited",
        invitation_token="RP-VALID123",
        invited_at=now,
    )
    memberships = [
        UserMembershipDirectoryRecord(
            membership=invited_membership,
            tenant=build_tenant(tenant_id=invited_membership.tenant_id, name="RAGPilot Demo", slug="ragpilot-demo"),
        )
    ]
    user_repository = FakeUserRepository(user_count=1, user=user, memberships=memberships)
    service = UserService(
        user_repository=user_repository,
        user_session_repository=FakeUserSessionRepository(),
        tenant_repository=FakeTenantRepository(),
    )

    with pytest.raises(ResourceConflictError, match="Invitation token is not valid for this member."):
        await service.activate_user_invitations(
            UserInvitationActivationRequest(email="operator@ragpilot.local", invitation_token="RP-WRONG999")
        )

    assert user_repository.access_events[-1].event_type == "invitation_activation_failed"
    assert user_repository.access_events[-1].detail_json["reason_code"] == "invalid_token"


def test_invitation_tokens_are_high_entropy_and_only_match_their_hash() -> None:
    token = UserRepository.generate_invitation_token()
    membership = SimpleNamespace(
        invitation_token=None,
        invitation_token_hash=UserRepository.hash_invitation_token(token),
    )
    different_token = f"{token[:-1]}{'0' if token[-1] != '0' else '1'}"

    assert token.startswith("RP-")
    assert len(token) == 67
    assert UserRepository.invitation_token_matches(membership, token.lower()) is True
    assert UserRepository.invitation_token_matches(membership, different_token) is False


@pytest.mark.anyio
async def test_activate_user_invitations_rate_limits_repeated_invalid_tokens() -> None:
    now = datetime.now(timezone.utc)
    user = SimpleNamespace(
        id=uuid4(),
        email="operator@ragpilot.local",
        display_name="RAGPilot Operator",
        is_active=False,
        role="operator",
        last_signed_in_at=None,
        created_at=now,
        updated_at=now,
        deleted_at=None,
    )
    invited_membership = build_membership(
        user_id=user.id,
        status="invited",
        invitation_token="RP-VALID123",
        invited_at=now,
    )
    user_repository = FakeUserRepository(
        user_count=1,
        user=user,
        memberships=[
            UserMembershipDirectoryRecord(
                membership=invited_membership,
                tenant=build_tenant(
                    tenant_id=invited_membership.tenant_id,
                    name="RAGPilot Demo",
                    slug="ragpilot-demo",
                ),
            )
        ],
    )
    service = UserService(
        user_repository=user_repository,
        user_session_repository=FakeUserSessionRepository(),
        tenant_repository=FakeTenantRepository(),
        settings=Settings(
            auth_failed_sign_in_max_attempts=2,
            auth_failed_sign_in_window_minutes=15,
            auth_failed_sign_in_lockout_minutes=5,
        ),
    )

    with pytest.raises(ResourceConflictError, match="Invitation token is not valid"):
        await service.activate_user_invitations(
            UserInvitationActivationRequest(email=user.email, invitation_token="RP-WRONG001")
        )
    with pytest.raises(ResourceConflictError, match="Too many failed invitation activation attempts"):
        await service.activate_user_invitations(
            UserInvitationActivationRequest(email=user.email, invitation_token="RP-WRONG002")
        )
    with pytest.raises(ResourceConflictError, match="Too many failed invitation activation attempts"):
        await service.activate_user_invitations(
            UserInvitationActivationRequest(email=user.email, invitation_token="RP-WRONG003")
        )

    assert len(user_repository.access_events) == 2


@pytest.mark.anyio
async def test_activate_user_invitations_rejects_expired_token() -> None:
    now = datetime.now(timezone.utc)
    user = SimpleNamespace(
        id=uuid4(),
        email="operator@ragpilot.local",
        display_name="RAGPilot Operator",
        is_active=False,
        role="operator",
        last_signed_in_at=None,
        created_at=now,
        updated_at=now,
        deleted_at=None,
    )
    invited_membership = build_membership(
        user_id=user.id,
        status="invited",
        invitation_token="RP-VALID123",
        invited_at=now - timedelta(days=10),
        invitation_expires_at=now - timedelta(days=3),
    )
    memberships = [
        UserMembershipDirectoryRecord(
            membership=invited_membership,
            tenant=build_tenant(tenant_id=invited_membership.tenant_id, name="RAGPilot Demo", slug="ragpilot-demo"),
        )
    ]
    user_repository = FakeUserRepository(user_count=1, user=user, memberships=memberships)
    service = UserService(
        user_repository=user_repository,
        user_session_repository=FakeUserSessionRepository(),
        tenant_repository=FakeTenantRepository(),
    )

    with pytest.raises(
        ResourceConflictError,
        match="Invitation token has expired. Ask an administrator to issue a new code.",
    ):
        await service.activate_user_invitations(
            UserInvitationActivationRequest(email="operator@ragpilot.local", invitation_token="RP-VALID123")
        )

    assert user_repository.access_events[-1].event_type == "invitation_activation_failed"
    assert user_repository.access_events[-1].detail_json["reason_code"] == "expired_token"


@pytest.mark.anyio
async def test_activate_user_invitations_rejects_missing_invited_memberships_and_logs_failure() -> None:
    now = datetime.now(timezone.utc)
    user = SimpleNamespace(
        id=uuid4(),
        email="operator@ragpilot.local",
        display_name="RAGPilot Operator",
        is_active=True,
        role="operator",
        last_signed_in_at=None,
        created_at=now,
        updated_at=now,
        deleted_at=None,
    )
    user_repository = FakeUserRepository(user_count=1, user=user, memberships=[])
    service = UserService(
        user_repository=user_repository,
        user_session_repository=FakeUserSessionRepository(),
        tenant_repository=FakeTenantRepository(),
    )

    with pytest.raises(ResourceConflictError, match="No invited memberships are available to activate."):
        await service.activate_user_invitations(
            UserInvitationActivationRequest(email="operator@ragpilot.local", invitation_token="RP-AB12CD34")
        )

    assert user_repository.access_events[-1].event_type == "invitation_activation_failed"
    assert user_repository.access_events[-1].detail_json["reason_code"] == "no_invited_memberships"


@pytest.mark.anyio
async def test_issue_user_membership_invitation_refreshes_membership_credentials() -> None:
    now = datetime.now(timezone.utc)
    user = SimpleNamespace(
        id=uuid4(),
        email="operator@ragpilot.local",
        display_name="RAGPilot Operator",
        is_active=True,
        role="operator",
        last_signed_in_at=None,
        created_at=now,
        updated_at=now,
        deleted_at=None,
    )
    active_membership = build_membership(
        user_id=user.id,
        status="active",
        activated_at=now,
    )
    tenant = build_tenant(tenant_id=active_membership.tenant_id, name="RAGPilot Demo", slug="ragpilot-demo")
    memberships = [
        UserMembershipDirectoryRecord(
            membership=active_membership,
            tenant=tenant,
        )
    ]
    user_repository = FakeUserRepository(user_count=1, user=user, memberships=memberships)
    service = UserService(
        user_repository=user_repository,
        user_session_repository=None,
        tenant_repository=FakeTenantRepository(tenants={tenant.id: tenant}),
    )

    response = await service.issue_user_membership_invitation(
        user_id=user.id,
        membership_id=active_membership.id,
        request=SimpleNamespace(reason="Issued from admin console"),
    )

    assert response.membership_status == "invited"
    assert response.invitation_token == "RP-REFRESHED"
    assert response.activated_at is None
    assert response.invited_at is not None
    assert response.invitation_expires_at is not None
    assert user_repository.access_events[-1].event_type == "invitation_issued"
    assert user_repository.access_events[-1].detail_json["reason"] == "Issued from admin console"


@pytest.mark.anyio
async def test_build_user_permissions_from_policy_prefers_database_grants() -> None:
    now = datetime.now(timezone.utc)
    tenant_id = uuid4()
    user = SimpleNamespace(
        id=uuid4(),
        email="operator@ragpilot.local",
        display_name="RAGPilot Operator",
        is_active=True,
        role="operator",
        memberships=[
            SimpleNamespace(
                tenant_id=tenant_id,
                membership_status="active",
            )
        ],
    )
    service = UserService(
        user_repository=FakeUserRepository(),
        user_session_repository=None,
        tenant_repository=FakeTenantRepository(),
        role_permission_repository=FakeRolePermissionRepository(
            {
                "operator": {
                    "access_home",
                    "access_chat",
                    "send_chat_messages",
                }
            }
        ),
    )

    response = await service.build_user_permissions_from_policy(user)

    assert response.active_tenant_ids == [tenant_id]
    assert response.capabilities["access_chat"] is True
    assert response.capabilities["send_chat_messages"] is True
    assert response.capabilities["manage_documents"] is False
    assert response.capabilities["retry_workflow_runs"] is False


@pytest.mark.anyio
async def test_build_user_permissions_from_policy_falls_back_when_role_is_unseeded() -> None:
    tenant_id = uuid4()
    user = SimpleNamespace(
        id=uuid4(),
        email="operator@ragpilot.local",
        display_name="RAGPilot Operator",
        is_active=True,
        role="operator",
        memberships=[
            SimpleNamespace(
                tenant_id=tenant_id,
                membership_status="active",
            )
        ],
    )
    service = UserService(
        user_repository=FakeUserRepository(),
        user_session_repository=None,
        tenant_repository=FakeTenantRepository(),
        role_permission_repository=FakeRolePermissionRepository({}),
    )

    response = await service.build_user_permissions_from_policy(user)

    assert response.capabilities["manage_documents"] is True
    assert response.capabilities["retry_workflow_runs"] is True
    assert response.capabilities["manage_members"] is False


@pytest.mark.anyio
async def test_login_user_updates_last_signed_in_at_for_active_member() -> None:
    now = datetime.now(timezone.utc)
    user = SimpleNamespace(
        id=uuid4(),
        email="operator@ragpilot.local",
        display_name="RAGPilot Operator",
        is_active=True,
        role="operator",
        last_signed_in_at=None,
        created_at=now,
        updated_at=now,
        deleted_at=None,
    )
    active_membership = build_membership(
        user_id=user.id,
        status="active",
        activated_at=now,
    )
    memberships = [
        UserMembershipDirectoryRecord(
            membership=active_membership,
            tenant=build_tenant(tenant_id=active_membership.tenant_id, name="RAGPilot Demo", slug="ragpilot-demo"),
        )
    ]
    user_repository = FakeUserRepository(user_count=1, user=user, memberships=memberships)
    session_repository = FakeUserSessionRepository()
    service = UserService(
        user_repository=user_repository,
        user_session_repository=session_repository,
        tenant_repository=FakeTenantRepository(),
    )

    response = await service.login_user(
        UserLoginRequest(email="operator@ragpilot.local", display_name="RAGPilot Operator")
    )

    assert response.user.last_signed_in_at is not None
    assert response.session.session_token == "rp_sess_test_token"
    assert response.permissions.capabilities["access_chat"] is True
    assert user_repository.last_signed_in_user_id == user.id
    assert user_repository.access_events[-1].event_type == "sign_in_succeeded"
    assert session_repository.created_sessions[-1].authentication_mode == "directory"


@pytest.mark.anyio
async def test_login_user_rejects_provider_managed_authentication_modes() -> None:
    service = UserService(
        user_repository=FakeUserRepository(user_count=0),
        user_session_repository=FakeUserSessionRepository(),
        tenant_repository=FakeTenantRepository(),
        settings=Settings(auth_primary_mode="oidc"),
    )

    with pytest.raises(ResourceConflictError, match="Local sign-in is unavailable for the current authentication mode."):
        await service.login_user(
            UserLoginRequest(
                email="operator@ragpilot.local",
                display_name="RAGPilot Operator",
            )
        )


@pytest.mark.anyio
async def test_bootstrap_user_hashes_password_when_password_local_is_enabled() -> None:
    user_repository = FakeUserRepository(user_count=0)
    service = UserService(
        user_repository=user_repository,
        user_session_repository=None,
        tenant_repository=FakeTenantRepository(),
        settings=Settings(auth_primary_mode="password_local"),
    )

    response = await service.bootstrap_user(
        UserBootstrapRequest(
            email="owner@ragpilot.local",
            display_name="Platform Owner",
            password="TopSecret123",
        )
    )

    assert response.role == "super_admin"
    assert user_repository.created_password_hash is not None
    assert verify_password("TopSecret123", user_repository.created_password_hash) is True


@pytest.mark.anyio
async def test_login_user_requires_matching_password_when_password_local_is_enabled() -> None:
    now = datetime.now(timezone.utc)
    user = SimpleNamespace(
        id=uuid4(),
        email="operator@ragpilot.local",
        display_name="RAGPilot Operator",
        is_active=True,
        role="operator",
        password_hash=hash_password("Operator123"),
        last_signed_in_at=None,
        created_at=now,
        updated_at=now,
        deleted_at=None,
    )
    active_membership = build_membership(
        user_id=user.id,
        status="active",
        activated_at=now,
    )
    memberships = [
        UserMembershipDirectoryRecord(
            membership=active_membership,
            tenant=build_tenant(tenant_id=active_membership.tenant_id, name="RAGPilot Demo", slug="ragpilot-demo"),
        )
    ]
    user_repository = FakeUserRepository(user_count=1, user=user, memberships=memberships)
    session_repository = FakeUserSessionRepository()
    service = UserService(
        user_repository=user_repository,
        user_session_repository=session_repository,
        tenant_repository=FakeTenantRepository(),
        settings=Settings(auth_primary_mode="password_local"),
    )

    response = await service.login_user(
        UserLoginRequest(
            email="operator@ragpilot.local",
            display_name="RAGPilot Operator",
            password="Operator123",
        )
    )

    assert response.session.session_token == "rp_sess_test_token"
    assert response.permissions.capabilities["access_chat"] is True
    assert session_repository.created_sessions[-1].authentication_mode == "password"


@pytest.mark.anyio
async def test_login_user_rejects_invalid_password_when_password_local_is_enabled() -> None:
    now = datetime.now(timezone.utc)
    user = SimpleNamespace(
        id=uuid4(),
        email="operator@ragpilot.local",
        display_name="RAGPilot Operator",
        is_active=True,
        role="operator",
        password_hash=hash_password("Operator123"),
        last_signed_in_at=None,
        created_at=now,
        updated_at=now,
        deleted_at=None,
    )
    active_membership = build_membership(
        user_id=user.id,
        status="active",
        activated_at=now,
    )
    memberships = [
        UserMembershipDirectoryRecord(
            membership=active_membership,
            tenant=build_tenant(tenant_id=active_membership.tenant_id, name="RAGPilot Demo", slug="ragpilot-demo"),
        )
    ]
    user_repository = FakeUserRepository(user_count=1, user=user, memberships=memberships)
    session_repository = FakeUserSessionRepository()
    service = UserService(
        user_repository=user_repository,
        user_session_repository=session_repository,
        tenant_repository=FakeTenantRepository(),
        settings=Settings(auth_primary_mode="password_local"),
    )

    with pytest.raises(ResourceConflictError, match="Email or password is incorrect."):
        await service.login_user(
            UserLoginRequest(
                email="operator@ragpilot.local",
                display_name="RAGPilot Operator",
                password="WrongPass456",
            )
        )

    assert user_repository.access_events[-1].event_type == "sign_in_failed"
    assert user_repository.access_events[-1].detail_json["reason_code"] == "invalid_password"
    assert user_repository.access_events[-1].detail_json["failed_window_attempts"] == 1


@pytest.mark.anyio
async def test_login_user_rate_limits_repeated_failed_password_sign_ins() -> None:
    now = datetime.now(timezone.utc)
    user = SimpleNamespace(
        id=uuid4(),
        email="operator@ragpilot.local",
        display_name="RAGPilot Operator",
        is_active=True,
        role="operator",
        password_hash=hash_password("Operator123"),
        last_signed_in_at=None,
        created_at=now,
        updated_at=now,
        deleted_at=None,
    )
    active_membership = build_membership(
        user_id=user.id,
        status="active",
        activated_at=now,
    )
    memberships = [
        UserMembershipDirectoryRecord(
            membership=active_membership,
            tenant=build_tenant(tenant_id=active_membership.tenant_id, name="RAGPilot Demo", slug="ragpilot-demo"),
        )
    ]
    user_repository = FakeUserRepository(user_count=1, user=user, memberships=memberships)
    session_repository = FakeUserSessionRepository()
    service = UserService(
        user_repository=user_repository,
        user_session_repository=session_repository,
        tenant_repository=FakeTenantRepository(),
        settings=Settings(
            auth_primary_mode="password_local",
            auth_failed_sign_in_max_attempts=3,
            auth_failed_sign_in_window_minutes=15,
            auth_failed_sign_in_lockout_minutes=15,
        ),
    )

    for _ in range(2):
        with pytest.raises(ResourceConflictError, match="Email or password is incorrect."):
            await service.login_user(
                UserLoginRequest(
                    email="operator@ragpilot.local",
                    display_name="RAGPilot Operator",
                    password="WrongPass456",
                )
            )

    with pytest.raises(ResourceConflictError, match="Too many failed sign-in attempts."):
        await service.login_user(
            UserLoginRequest(
                email="operator@ragpilot.local",
                display_name="RAGPilot Operator",
                password="WrongPass456",
            )
        )

    assert len(user_repository.access_events) == 3
    assert all(event.event_type == "sign_in_failed" for event in user_repository.access_events)
    assert user_repository.access_events[-1].detail_json["failed_window_attempts"] == 3

    with pytest.raises(ResourceConflictError, match="Too many failed sign-in attempts."):
        await service.login_user(
            UserLoginRequest(
                email="operator@ragpilot.local",
                display_name="RAGPilot Operator",
                password="Operator123",
            )
        )

    assert session_repository.created_sessions == []


@pytest.mark.anyio
async def test_activate_user_invitations_rejects_provider_managed_authentication_modes() -> None:
    service = UserService(
        user_repository=FakeUserRepository(user_count=1),
        user_session_repository=FakeUserSessionRepository(),
        tenant_repository=FakeTenantRepository(),
        settings=Settings(auth_primary_mode="oidc"),
    )

    with pytest.raises(
        ResourceConflictError,
        match="Invitation activation is unavailable for the current authentication mode.",
    ):
        await service.activate_user_invitations(
            UserInvitationActivationRequest(
                email="operator@ragpilot.local",
                invitation_token="RP-AB12CD34",
            )
        )


@pytest.mark.anyio
async def test_change_current_user_password_updates_hash_and_logs_event() -> None:
    now = datetime.now(timezone.utc)
    user = SimpleNamespace(
        id=uuid4(),
        email="operator@ragpilot.local",
        display_name="RAGPilot Operator",
        is_active=True,
        role="operator",
        password_hash=hash_password("CurrentPass123"),
        last_signed_in_at=None,
        created_at=now,
        updated_at=now,
        deleted_at=None,
    )
    active_membership = build_membership(user_id=user.id, status="active", activated_at=now)
    memberships = [
        UserMembershipDirectoryRecord(
            membership=active_membership,
            tenant=build_tenant(tenant_id=active_membership.tenant_id, name="RAGPilot Demo", slug="ragpilot-demo"),
        )
    ]
    user_repository = FakeUserRepository(user_count=1, user=user, memberships=memberships)
    user_session_repository = FakeUserSessionRepository()
    current_session, _ = await user_session_repository.create_user_session(
        user_id=user.id,
        authentication_mode="password",
    )
    other_session, _ = await user_session_repository.create_user_session(
        user_id=user.id,
        authentication_mode="password",
    )
    service = UserService(
        user_repository=user_repository,
        user_session_repository=user_session_repository,
        tenant_repository=FakeTenantRepository(),
        settings=Settings(auth_primary_mode="password_local"),
    )

    response = await service.change_current_user_password(
        user_id=user.id,
        request=UserCurrentPasswordChangeRequest(
            current_password="CurrentPass123",
            new_password="UpdatedPass123",
        ),
        actor_user_id=user.id,
        current_session_id=current_session.id,
    )

    assert response.id == user.id
    assert verify_password("UpdatedPass123", user.password_hash)
    assert other_session.id in user_session_repository.revoked_session_ids
    assert current_session.id not in user_session_repository.revoked_session_ids
    assert user_repository.access_events[0].event_type == "password_changed"
    assert user_repository.access_events[0].detail_json["change_scope"] == "self"
    assert user_repository.access_events[-1].event_type == "session_revoked"
    assert user_repository.access_events[-1].detail_json["revocation_scope"] == "self_other"


@pytest.mark.anyio
async def test_change_current_user_password_rejects_wrong_current_password() -> None:
    now = datetime.now(timezone.utc)
    user = SimpleNamespace(
        id=uuid4(),
        email="operator@ragpilot.local",
        display_name="RAGPilot Operator",
        is_active=True,
        role="operator",
        password_hash=hash_password("CurrentPass123"),
        last_signed_in_at=None,
        created_at=now,
        updated_at=now,
        deleted_at=None,
    )
    active_membership = build_membership(user_id=user.id, status="active", activated_at=now)
    memberships = [
        UserMembershipDirectoryRecord(
            membership=active_membership,
            tenant=build_tenant(tenant_id=active_membership.tenant_id, name="RAGPilot Demo", slug="ragpilot-demo"),
        )
    ]
    user_repository = FakeUserRepository(user_count=1, user=user, memberships=memberships)
    service = UserService(
        user_repository=user_repository,
        user_session_repository=None,
        tenant_repository=FakeTenantRepository(),
        settings=Settings(auth_primary_mode="password_local"),
    )

    with pytest.raises(ResourceConflictError, match="Current password is incorrect."):
        await service.change_current_user_password(
            user_id=user.id,
            request=UserCurrentPasswordChangeRequest(
                current_password="WrongPass123",
                new_password="UpdatedPass123",
            ),
            actor_user_id=user.id,
        )


@pytest.mark.anyio
async def test_reset_user_password_updates_hash_and_logs_event() -> None:
    now = datetime.now(timezone.utc)
    admin_user_id = uuid4()
    user = SimpleNamespace(
        id=uuid4(),
        email="operator@ragpilot.local",
        display_name="RAGPilot Operator",
        is_active=True,
        role="operator",
        password_hash=hash_password("CurrentPass123"),
        last_signed_in_at=None,
        created_at=now,
        updated_at=now,
        deleted_at=None,
    )
    active_membership = build_membership(user_id=user.id, status="active", activated_at=now)
    memberships = [
        UserMembershipDirectoryRecord(
            membership=active_membership,
            tenant=build_tenant(tenant_id=active_membership.tenant_id, name="RAGPilot Demo", slug="ragpilot-demo"),
        )
    ]
    user_repository = FakeUserRepository(user_count=1, user=user, memberships=memberships)
    user_session_repository = FakeUserSessionRepository()
    first_session, _ = await user_session_repository.create_user_session(
        user_id=user.id,
        authentication_mode="password",
    )
    second_session, _ = await user_session_repository.create_user_session(
        user_id=user.id,
        authentication_mode="password",
    )
    service = UserService(
        user_repository=user_repository,
        user_session_repository=user_session_repository,
        tenant_repository=FakeTenantRepository(),
        settings=Settings(auth_primary_mode="password_local"),
    )

    response = await service.reset_user_password(
        user_id=user.id,
        request=UserPasswordResetRequest(
            new_password="ResetPass123",
            reason="Credential rotation",
        ),
        actor_user_id=admin_user_id,
    )

    assert response.id == user.id
    assert verify_password("ResetPass123", user.password_hash)
    assert first_session.id in user_session_repository.revoked_session_ids
    assert second_session.id in user_session_repository.revoked_session_ids
    assert user_repository.access_events[0].event_type == "password_reset"
    assert user_repository.access_events[0].detail_json["change_scope"] == "admin"
    assert user_repository.access_events[0].detail_json["reason"] == "Credential rotation"
    assert user_repository.access_events[-1].event_type == "session_revoked"
    assert user_repository.access_events[-1].detail_json["reason"] == "Credential rotation"


@pytest.mark.anyio
async def test_revoke_current_session_revokes_owned_session() -> None:
    now = datetime.now(timezone.utc)
    user = SimpleNamespace(
        id=uuid4(),
        email="operator@ragpilot.local",
        display_name="RAGPilot Operator",
        is_active=True,
        role="operator",
        last_signed_in_at=None,
        created_at=now,
        updated_at=now,
        deleted_at=None,
    )
    active_membership = build_membership(user_id=user.id, status="active", activated_at=now)
    memberships = [
        UserMembershipDirectoryRecord(
            membership=active_membership,
            tenant=build_tenant(tenant_id=active_membership.tenant_id, name="RAGPilot Demo", slug="ragpilot-demo"),
        )
    ]
    user_repository = FakeUserRepository(user_count=1, user=user, memberships=memberships)
    session_repository = FakeUserSessionRepository()
    created_session, _ = await session_repository.create_user_session(
        user_id=user.id,
        authentication_mode="directory",
    )
    service = UserService(
        user_repository=user_repository,
        user_session_repository=session_repository,
        tenant_repository=FakeTenantRepository(),
    )

    await service.revoke_current_session(
        user_id=user.id,
        session_id=created_session.id,
        actor_user_id=user.id,
        reason="Signed out from Settings",
    )

    assert session_repository.revoked_session_ids == [created_session.id]
    assert user_repository.access_events[-1].event_type == "sign_out_succeeded"
    assert user_repository.access_events[-1].detail_json["revocation_scope"] == "self"
    assert user_repository.access_events[-1].detail_json["reason"] == "Signed out from Settings"


@pytest.mark.anyio
async def test_revoke_other_sessions_for_current_user_preserves_current_session() -> None:
    now = datetime.now(timezone.utc)
    user = SimpleNamespace(
        id=uuid4(),
        email="operator@ragpilot.local",
        display_name="RAGPilot Operator",
        is_active=True,
        role="operator",
        last_signed_in_at=None,
        created_at=now,
        updated_at=now,
        deleted_at=None,
    )
    active_membership = build_membership(user_id=user.id, status="active", activated_at=now)
    memberships = [
        UserMembershipDirectoryRecord(
            membership=active_membership,
            tenant=build_tenant(tenant_id=active_membership.tenant_id, name="RAGPilot Demo", slug="ragpilot-demo"),
        )
    ]
    user_repository = FakeUserRepository(user_count=1, user=user, memberships=memberships)
    session_repository = FakeUserSessionRepository()
    current_session, _ = await session_repository.create_user_session(user_id=user.id, authentication_mode="directory")
    other_session, _ = await session_repository.create_user_session(user_id=user.id, authentication_mode="bootstrap")
    third_session, _ = await session_repository.create_user_session(user_id=user.id, authentication_mode="password")
    service = UserService(
        user_repository=user_repository,
        user_session_repository=session_repository,
        tenant_repository=FakeTenantRepository(),
    )

    response = await service.revoke_other_sessions_for_current_user(
        user_id=user.id,
        current_session_id=current_session.id,
        actor_user_id=user.id,
        reason="Closed other devices",
    )

    assert set(session_repository.revoked_session_ids) == {other_session.id, third_session.id}
    assert response.revoked_session_count == 2
    assert response.remaining_active_sessions == 1
    assert response.preserved_current_session is True
    assert response.revocation_scope == "other_sessions"
    assert user_repository.access_events[-1].event_type == "session_revoked"
    assert user_repository.access_events[-1].detail_json["revocation_scope"] == "self_other"
    assert user_repository.access_events[-1].detail_json["reason"] == "Closed other devices"


@pytest.mark.anyio
async def test_revoke_all_sessions_for_user_revokes_every_active_session() -> None:
    now = datetime.now(timezone.utc)
    admin_user_id = uuid4()
    user = SimpleNamespace(
        id=uuid4(),
        email="operator@ragpilot.local",
        display_name="RAGPilot Operator",
        is_active=True,
        role="operator",
        last_signed_in_at=None,
        created_at=now,
        updated_at=now,
        deleted_at=None,
    )
    active_membership = build_membership(user_id=user.id, status="active", activated_at=now)
    memberships = [
        UserMembershipDirectoryRecord(
            membership=active_membership,
            tenant=build_tenant(tenant_id=active_membership.tenant_id, name="RAGPilot Demo", slug="ragpilot-demo"),
        )
    ]
    user_repository = FakeUserRepository(user_count=1, user=user, memberships=memberships)
    session_repository = FakeUserSessionRepository()
    first_session, _ = await session_repository.create_user_session(user_id=user.id, authentication_mode="directory")
    second_session, _ = await session_repository.create_user_session(user_id=user.id, authentication_mode="password")
    service = UserService(
        user_repository=user_repository,
        user_session_repository=session_repository,
        tenant_repository=FakeTenantRepository(),
    )

    response = await service.revoke_all_sessions_for_user(
        user_id=user.id,
        actor_user_id=admin_user_id,
        reason="Security cleanup",
    )

    assert set(session_repository.revoked_session_ids) == {first_session.id, second_session.id}
    assert response.revoked_session_count == 2
    assert response.remaining_active_sessions == 0
    assert response.preserved_current_session is False
    assert response.revocation_scope == "all_sessions"
    assert user_repository.access_events[-1].event_type == "session_revoked"
    assert user_repository.access_events[-1].detail_json["revocation_scope"] == "admin_bulk"
    assert user_repository.access_events[-1].detail_json["reason"] == "Security cleanup"


@pytest.mark.anyio
async def test_list_current_user_sessions_marks_current_session() -> None:
    now = datetime.now(timezone.utc)
    user = SimpleNamespace(
        id=uuid4(),
        email="operator@ragpilot.local",
        display_name="RAGPilot Operator",
        is_active=True,
        role="operator",
        last_signed_in_at=None,
        created_at=now,
        updated_at=now,
        deleted_at=None,
    )
    active_membership = build_membership(user_id=user.id, status="active", activated_at=now)
    memberships = [
        UserMembershipDirectoryRecord(
            membership=active_membership,
            tenant=build_tenant(tenant_id=active_membership.tenant_id, name="RAGPilot Demo", slug="ragpilot-demo"),
        )
    ]
    user_repository = FakeUserRepository(user_count=1, user=user, memberships=memberships)
    session_repository = FakeUserSessionRepository()
    current_session, _ = await session_repository.create_user_session(user_id=user.id, authentication_mode="directory")
    other_session, _ = await session_repository.create_user_session(user_id=user.id, authentication_mode="bootstrap")
    service = UserService(
        user_repository=user_repository,
        user_session_repository=session_repository,
        tenant_repository=FakeTenantRepository(),
    )

    response = await service.list_current_user_sessions(
        user_id=user.id,
        current_session_id=current_session.id,
    )

    assert len(response) == 2
    assert any(session.id == current_session.id and session.is_current for session in response)
    assert any(session.id == other_session.id and not session.is_current for session in response)


@pytest.mark.anyio
async def test_get_user_session_security_summary_counts_sessions() -> None:
    now = datetime.now(timezone.utc)
    user = SimpleNamespace(
        id=uuid4(),
        email="operator@ragpilot.local",
        display_name="RAGPilot Operator",
        is_active=True,
        role="operator",
        last_signed_in_at=None,
        created_at=now,
        updated_at=now,
        deleted_at=None,
    )
    active_membership = build_membership(user_id=user.id, status="active", activated_at=now)
    memberships = [
        UserMembershipDirectoryRecord(
            membership=active_membership,
            tenant=build_tenant(tenant_id=active_membership.tenant_id, name="RAGPilot Demo", slug="ragpilot-demo"),
        )
    ]
    user_repository = FakeUserRepository(user_count=1, user=user, memberships=memberships)
    session_repository = FakeUserSessionRepository()
    current_session, _ = await session_repository.create_user_session(user_id=user.id, authentication_mode="directory")
    current_session.expires_at = now + timedelta(hours=8)
    other_session, _ = await session_repository.create_user_session(user_id=user.id, authentication_mode="bootstrap")
    other_session.expires_at = now + timedelta(days=3)
    service = UserService(
        user_repository=user_repository,
        user_session_repository=session_repository,
        tenant_repository=FakeTenantRepository(),
    )

    response = await service.get_user_session_security_summary(
        user_id=user.id,
        current_session_id=current_session.id,
    )

    assert response.total_active_sessions == 2
    assert response.other_active_sessions == 1
    assert response.expires_within_24_hours == 1
    assert response.distinct_device_count == 0
    assert response.distinct_ip_count == 0
    assert response.current_session_expires_at == current_session.expires_at
    assert response.mode_breakdown[0].authentication_mode == "bootstrap" or response.mode_breakdown[0].authentication_mode == "directory"
    assert sum(mode.session_count for mode in response.mode_breakdown) == 2


@pytest.mark.anyio
async def test_get_user_access_summary_counts_self_service_posture() -> None:
    now = datetime.now(timezone.utc)
    user = SimpleNamespace(
        id=uuid4(),
        email="operator@ragpilot.local",
        display_name="RAGPilot Operator",
        is_active=True,
        role="operator",
        last_signed_in_at=now - timedelta(days=2),
        created_at=now,
        updated_at=now,
        deleted_at=None,
    )
    active_membership = build_membership(user_id=user.id, status="active", activated_at=now - timedelta(days=5))
    invited_membership = build_membership(
        user_id=user.id,
        status="invited",
        invitation_token="RP-ACTIVE",
        invited_at=now - timedelta(hours=12),
        invitation_expires_at=now + timedelta(days=1),
    )
    expired_invited_membership = build_membership(
        user_id=user.id,
        status="invited",
        invitation_token="RP-EXPIRED",
        invited_at=now - timedelta(days=5),
        invitation_expires_at=now - timedelta(hours=4),
    )
    suspended_membership = build_membership(user_id=user.id, status="suspended")
    memberships = [
        UserMembershipDirectoryRecord(
            membership=active_membership,
            tenant=build_tenant(tenant_id=active_membership.tenant_id, name="RAGPilot Demo", slug="ragpilot-demo"),
        ),
        UserMembershipDirectoryRecord(
            membership=invited_membership,
            tenant=build_tenant(tenant_id=invited_membership.tenant_id, name="Customer Alpha", slug="customer-alpha"),
        ),
        UserMembershipDirectoryRecord(
            membership=expired_invited_membership,
            tenant=build_tenant(
                tenant_id=expired_invited_membership.tenant_id,
                name="Customer Beta",
                slug="customer-beta",
            ),
        ),
        UserMembershipDirectoryRecord(
            membership=suspended_membership,
            tenant=build_tenant(tenant_id=suspended_membership.tenant_id, name="Customer Gamma", slug="customer-gamma"),
        ),
    ]
    user_repository = FakeUserRepository(user_count=1, user=user, memberships=memberships)
    session_repository = FakeUserSessionRepository()
    current_session, _ = await session_repository.create_user_session(user_id=user.id, authentication_mode="directory")
    current_session.expires_at = now + timedelta(hours=6)
    other_session, _ = await session_repository.create_user_session(user_id=user.id, authentication_mode="bootstrap")
    other_session.expires_at = now + timedelta(days=2)
    service = UserService(
        user_repository=user_repository,
        user_session_repository=session_repository,
        tenant_repository=FakeTenantRepository(),
    )

    await user_repository.create_user_access_event(
        user_id=user.id,
        tenant_id=active_membership.tenant_id,
        membership_id=active_membership.id,
        event_type="sign_in_succeeded",
        detail_json={"login_mode": "directory"},
    )
    await user_repository.create_user_access_event(
        user_id=user.id,
        tenant_id=invited_membership.tenant_id,
        membership_id=invited_membership.id,
        actor_user_id=user.id,
        event_type="invitation_revoked",
        detail_json={"membership_status": "suspended"},
    )
    await user_repository.create_user_access_event(
        user_id=user.id,
        tenant_id=active_membership.tenant_id,
        membership_id=active_membership.id,
        event_type="sign_in_failed",
        detail_json={"reason_code": "invalid_password"},
    )
    await user_repository.create_user_access_event(
        user_id=user.id,
        tenant_id=invited_membership.tenant_id,
        membership_id=invited_membership.id,
        event_type="invitation_activation_failed",
        detail_json={"reason_code": "invalid_token"},
    )

    response = await service.get_user_access_summary(user_id=user.id)

    assert response.membership_access_state == "ready"
    assert response.active_memberships == 1
    assert response.invited_memberships == 2
    assert response.suspended_memberships == 1
    assert response.expiring_invitations == 1
    assert response.expired_invitations == 1
    assert response.recent_failed_sign_in_events == 1
    assert response.recent_failed_invitation_activation_events == 1
    assert response.total_audit_events == 4
    assert response.sensitive_audit_events == 1
    assert response.active_sessions == 2
    assert response.sessions_expiring_within_24_hours == 1
    assert response.recent_sign_in_events == 1
    assert response.sign_in_lockout_active is False
    assert response.sign_in_lockout_expires_at is None
    assert response.session_spread_detected is False
    assert response.latest_event_type == "invitation_activation_failed"
    assert response.latest_event_at is not None
    assert response.event_breakdown[0].event_type == "sign_in_failed"
    assert response.event_breakdown[0].event_count == 1
    assert response.event_breakdown[1].event_type == "sign_in_succeeded"
    assert response.event_breakdown[1].event_count == 1
    assert response.event_breakdown[2].event_type == "invitation_activation_failed"
    assert response.event_breakdown[2].event_count == 1
    assert response.event_breakdown[3].event_type == "invitation_revoked"
    assert response.event_breakdown[3].event_count == 1
    assert response.review_items[0].category == "expired_invitations"
    assert response.review_items[0].item_count == 1
    assert response.review_items[2].category == "failed_sign_in_pressure"
    assert response.review_items[2].severity == "review"


@pytest.mark.anyio
async def test_login_user_persists_session_telemetry() -> None:
    now = datetime.now(timezone.utc)
    user = SimpleNamespace(
        id=uuid4(),
        email="operator@ragpilot.local",
        display_name="RAGPilot Operator",
        is_active=True,
        role="operator",
        last_signed_in_at=None,
        created_at=now,
        updated_at=now,
        deleted_at=None,
    )
    active_membership = build_membership(user_id=user.id, status="active", activated_at=now)
    memberships = [
        UserMembershipDirectoryRecord(
            membership=active_membership,
            tenant=build_tenant(tenant_id=active_membership.tenant_id, name="RAGPilot Demo", slug="ragpilot-demo"),
        )
    ]
    user_repository = FakeUserRepository(user_count=1, user=user, memberships=memberships)
    session_repository = FakeUserSessionRepository()
    service = UserService(
        user_repository=user_repository,
        user_session_repository=session_repository,
        tenant_repository=FakeTenantRepository(),
    )

    response = await service.login_user(
        UserLoginRequest(email=user.email, display_name=user.display_name),
        session_telemetry=UserSessionTelemetry(
            user_agent="Mozilla/5.0",
            ip_address="127.0.0.1",
            device_label="Windows · Chrome",
        ),
    )

    assert response.session.session_token == "rp_sess_test_token"
    assert session_repository.created_sessions[0].device_label == "Windows · Chrome"
    assert session_repository.created_sessions[0].ip_address == "127.0.0.1"
    assert user_repository.access_events[-1].detail_json["device_label"] == "Windows · Chrome"


@pytest.mark.anyio
async def test_revoke_user_session_for_user_revokes_owned_session() -> None:
    now = datetime.now(timezone.utc)
    user = SimpleNamespace(
        id=uuid4(),
        email="operator@ragpilot.local",
        display_name="RAGPilot Operator",
        is_active=True,
        role="operator",
        last_signed_in_at=None,
        created_at=now,
        updated_at=now,
        deleted_at=None,
    )
    active_membership = build_membership(user_id=user.id, status="active", activated_at=now)
    memberships = [
        UserMembershipDirectoryRecord(
            membership=active_membership,
            tenant=build_tenant(tenant_id=active_membership.tenant_id, name="RAGPilot Demo", slug="ragpilot-demo"),
        )
    ]
    user_repository = FakeUserRepository(user_count=1, user=user, memberships=memberships)
    session_repository = FakeUserSessionRepository()
    other_session, _ = await session_repository.create_user_session(user_id=user.id, authentication_mode="directory")
    service = UserService(
        user_repository=user_repository,
        user_session_repository=session_repository,
        tenant_repository=FakeTenantRepository(),
    )

    await service.revoke_user_session_for_user(
        user_id=user.id,
        session_id=other_session.id,
        actor_user_id=user.id,
        reason="Revoked from Settings",
    )

    assert session_repository.revoked_session_ids == [other_session.id]
    assert user_repository.access_events[-1].event_type == "session_revoked"
    assert user_repository.access_events[-1].detail_json["revocation_scope"] == "self"
    assert user_repository.access_events[-1].detail_json["reason"] == "Revoked from Settings"


@pytest.mark.anyio
async def test_revoke_user_session_for_user_logs_admin_revocation_scope() -> None:
    now = datetime.now(timezone.utc)
    user = SimpleNamespace(
        id=uuid4(),
        email="operator@ragpilot.local",
        display_name="RAGPilot Operator",
        is_active=True,
        role="operator",
        last_signed_in_at=None,
        created_at=now,
        updated_at=now,
        deleted_at=None,
    )
    active_membership = build_membership(user_id=user.id, status="active", activated_at=now)
    memberships = [
        UserMembershipDirectoryRecord(
            membership=active_membership,
            tenant=build_tenant(tenant_id=active_membership.tenant_id, name="RAGPilot Demo", slug="ragpilot-demo"),
        )
    ]
    user_repository = FakeUserRepository(user_count=1, user=user, memberships=memberships)
    session_repository = FakeUserSessionRepository()
    other_session, _ = await session_repository.create_user_session(user_id=user.id, authentication_mode="directory")
    service = UserService(
        user_repository=user_repository,
        user_session_repository=session_repository,
        tenant_repository=FakeTenantRepository(),
    )

    await service.revoke_user_session_for_user(
        user_id=user.id,
        session_id=other_session.id,
        actor_user_id=uuid4(),
        reason="Revoked from Admin Console",
    )

    assert session_repository.revoked_session_ids == [other_session.id]
    assert user_repository.access_events[-1].event_type == "session_revoked"
    assert user_repository.access_events[-1].detail_json["revocation_scope"] == "admin"
    assert user_repository.access_events[-1].detail_json["reason"] == "Revoked from Admin Console"


@pytest.mark.anyio
async def test_revoke_user_membership_invitation_suspends_membership_and_logs_event() -> None:
    now = datetime.now(timezone.utc)
    user = SimpleNamespace(
        id=uuid4(),
        email="operator@ragpilot.local",
        display_name="RAGPilot Operator",
        is_active=True,
        role="operator",
        last_signed_in_at=None,
        created_at=now,
        updated_at=now,
        deleted_at=None,
    )
    invited_membership = build_membership(
        user_id=user.id,
        status="invited",
        invitation_token="RP-VALID123",
        invited_at=now,
        invitation_expires_at=now + timedelta(days=3),
    )
    memberships = [
        UserMembershipDirectoryRecord(
            membership=invited_membership,
            tenant=build_tenant(tenant_id=invited_membership.tenant_id, name="RAGPilot Demo", slug="ragpilot-demo"),
        )
    ]
    user_repository = FakeUserRepository(user_count=1, user=user, memberships=memberships)
    service = UserService(
        user_repository=user_repository,
        user_session_repository=None,
        tenant_repository=FakeTenantRepository(),
    )

    response = await service.revoke_user_membership_invitation(
        user_id=user.id,
        membership_id=invited_membership.id,
        request=SimpleNamespace(reason="Invite revoked after review"),
        actor_user_id=user.id,
    )

    assert response.memberships[0].membership_status == "suspended"
    assert user_repository.access_events[-1].event_type == "invitation_revoked"
    assert user_repository.access_events[-1].detail_json["reason"] == "Invite revoked after review"


@pytest.mark.anyio
async def test_update_user_membership_logs_governance_reason() -> None:
    now = datetime.now(timezone.utc)
    user = SimpleNamespace(
        id=uuid4(),
        email="operator@ragpilot.local",
        display_name="RAGPilot Operator",
        is_active=True,
        role="operator",
        last_signed_in_at=None,
        created_at=now,
        updated_at=now,
        deleted_at=None,
    )
    active_membership = build_membership(user_id=user.id, status="active", activated_at=now)
    memberships = [
        UserMembershipDirectoryRecord(
            membership=active_membership,
            tenant=build_tenant(tenant_id=active_membership.tenant_id, name="RAGPilot Demo", slug="ragpilot-demo"),
        )
    ]
    user_repository = FakeUserRepository(user_count=1, user=user, memberships=memberships)
    service = UserService(
        user_repository=user_repository,
        user_session_repository=None,
        tenant_repository=FakeTenantRepository(),
    )

    response = await service.update_user_membership(
        user_id=user.id,
        membership_id=active_membership.id,
        request=SimpleNamespace(membership_status="suspended", reason="Manual governance hold"),
        actor_user_id=user.id,
    )

    assert response.memberships[0].membership_status == "suspended"
    assert user_repository.access_events[-1].event_type == "membership_suspended"
    assert user_repository.access_events[-1].detail_json["reason"] == "Manual governance hold"


@pytest.mark.anyio
async def test_update_user_deactivation_revokes_active_sessions() -> None:
    now = datetime.now(timezone.utc)
    admin_user_id = uuid4()
    user = SimpleNamespace(
        id=uuid4(),
        email="operator@ragpilot.local",
        display_name="RAGPilot Operator",
        is_active=True,
        role="operator",
        last_signed_in_at=None,
        created_at=now,
        updated_at=now,
        deleted_at=None,
    )
    active_membership = build_membership(user_id=user.id, status="active", activated_at=now)
    memberships = [
        UserMembershipDirectoryRecord(
            membership=active_membership,
            tenant=build_tenant(tenant_id=active_membership.tenant_id, name="RAGPilot Demo", slug="ragpilot-demo"),
        )
    ]
    user_repository = FakeUserRepository(user_count=1, user=user, memberships=memberships)
    user_session_repository = FakeUserSessionRepository()
    active_session, _ = await user_session_repository.create_user_session(
        user_id=user.id,
        authentication_mode="password",
    )
    service = UserService(
        user_repository=user_repository,
        user_session_repository=user_session_repository,
        tenant_repository=FakeTenantRepository(),
    )

    response = await service.update_user(
        user_id=user.id,
        request=SimpleNamespace(
            email="operator@ragpilot.local",
            display_name="RAGPilot Operator",
            is_active=False,
            role=None,
        ),
        actor_user_id=admin_user_id,
    )

    assert response.is_active is False
    assert active_session.id in user_session_repository.revoked_session_ids
    assert user_repository.access_events[-1].event_type == "session_revoked"
    assert user_repository.access_events[-1].detail_json["reason"] == "Account access changed. Sign in again to continue."


@pytest.mark.anyio
async def test_membership_suspension_revokes_active_sessions_when_no_access_remains() -> None:
    now = datetime.now(timezone.utc)
    user = SimpleNamespace(
        id=uuid4(),
        email="operator@ragpilot.local",
        display_name="RAGPilot Operator",
        is_active=True,
        role="operator",
        last_signed_in_at=None,
        created_at=now,
        updated_at=now,
        deleted_at=None,
    )
    active_membership = build_membership(user_id=user.id, status="active", activated_at=now)
    memberships = [
        UserMembershipDirectoryRecord(
            membership=active_membership,
            tenant=build_tenant(tenant_id=active_membership.tenant_id, name="RAGPilot Demo", slug="ragpilot-demo"),
        )
    ]
    user_repository = FakeUserRepository(user_count=1, user=user, memberships=memberships)
    user_session_repository = FakeUserSessionRepository()
    active_session, _ = await user_session_repository.create_user_session(
        user_id=user.id,
        authentication_mode="password",
    )
    service = UserService(
        user_repository=user_repository,
        user_session_repository=user_session_repository,
        tenant_repository=FakeTenantRepository(),
    )

    response = await service.update_user_membership(
        user_id=user.id,
        membership_id=active_membership.id,
        request=SimpleNamespace(membership_status="suspended", reason="Manual governance hold"),
        actor_user_id=user.id,
    )

    assert response.memberships[0].membership_status == "suspended"
    assert active_session.id in user_session_repository.revoked_session_ids
    assert user_repository.access_events[-1].event_type == "session_revoked"
    assert user_repository.access_events[-1].detail_json["reason"] == "Manual governance hold"


@pytest.mark.anyio
async def test_list_user_access_events_applies_event_type_filter() -> None:
    now = datetime.now(timezone.utc)
    user = SimpleNamespace(
        id=uuid4(),
        email="operator@ragpilot.local",
        display_name="RAGPilot Operator",
        is_active=True,
        role="operator",
        last_signed_in_at=None,
        created_at=now,
        updated_at=now,
        deleted_at=None,
    )
    membership = build_membership(user_id=user.id, status="active", activated_at=now)
    memberships = [
        UserMembershipDirectoryRecord(
            membership=membership,
            tenant=build_tenant(tenant_id=membership.tenant_id, name="RAGPilot Demo", slug="ragpilot-demo"),
        )
    ]
    user_repository = FakeUserRepository(user_count=1, user=user, memberships=memberships)
    await user_repository.create_user_access_event(user_id=user.id, event_type="sign_in_succeeded")
    await user_repository.create_user_access_event(
        user_id=user.id,
        tenant_id=membership.tenant_id,
        membership_id=membership.id,
        event_type="invitation_issued",
    )
    service = UserService(
        user_repository=user_repository,
        user_session_repository=None,
        tenant_repository=FakeTenantRepository(),
    )

    response = await service.list_user_access_events(event_type="invitation_issued")

    assert len(response) == 1
    assert response[0].event_type == "invitation_issued"


@pytest.mark.anyio
async def test_get_user_access_governance_summary_returns_scoped_counts() -> None:
    now = datetime.now(timezone.utc)
    tenant_id = uuid4()
    user = SimpleNamespace(
        id=uuid4(),
        email="operator@ragpilot.local",
        display_name="RAGPilot Operator",
        is_active=True,
        role="operator",
        last_signed_in_at=now - timedelta(days=45),
        created_at=now,
        updated_at=now,
        deleted_at=None,
    )
    active_membership = build_membership(user_id=user.id, tenant_id=tenant_id, status="active", activated_at=now)
    invited_membership = build_membership(
        user_id=user.id,
        tenant_id=tenant_id,
        status="invited",
        invitation_token="RP-ABCD1234",
        invited_at=now - timedelta(days=1),
        invitation_expires_at=now + timedelta(hours=12),
    )
    suspended_membership = build_membership(user_id=user.id, tenant_id=tenant_id, status="suspended")
    memberships = [
        UserMembershipDirectoryRecord(
            membership=active_membership,
            tenant=build_tenant(tenant_id=tenant_id, name="RAGPilot Demo", slug="ragpilot-demo"),
        ),
        UserMembershipDirectoryRecord(
            membership=invited_membership,
            tenant=build_tenant(tenant_id=tenant_id, name="RAGPilot Demo", slug="ragpilot-demo"),
        ),
        UserMembershipDirectoryRecord(
            membership=suspended_membership,
            tenant=build_tenant(tenant_id=tenant_id, name="RAGPilot Demo", slug="ragpilot-demo"),
        ),
    ]
    user_repository = FakeUserRepository(user_count=1, user=user, memberships=memberships)
    await user_repository.create_user_access_event(user_id=user.id, tenant_id=tenant_id, event_type="sign_in_succeeded")
    await user_repository.create_user_access_event(user_id=user.id, tenant_id=tenant_id, event_type="session_revoked")
    for _ in range(3):
        await user_repository.create_user_access_event(
            user_id=user.id,
            tenant_id=tenant_id,
            event_type="sign_in_failed",
            detail_json={"reason_code": "invalid_password"},
        )
    await user_repository.create_user_access_event(
        user_id=user.id,
        tenant_id=invited_membership.tenant_id,
        membership_id=invited_membership.id,
        event_type="invitation_activation_failed",
        detail_json={"reason_code": "expired_token"},
    )

    user_session_repository = FakeUserSessionRepository()
    session, _ = await user_session_repository.create_user_session(user_id=user.id, authentication_mode="directory")
    session.expires_at = now + timedelta(hours=8)
    session.device_label = "Windows · Chrome"
    second_session, _ = await user_session_repository.create_user_session(
        user_id=user.id,
        authentication_mode="directory",
        device_label="MacBook · Safari",
    )
    second_session.expires_at = now + timedelta(hours=12)
    third_session, _ = await user_session_repository.create_user_session(
        user_id=user.id,
        authentication_mode="directory",
        device_label="iPhone · Safari",
    )
    third_session.expires_at = now + timedelta(days=2)

    service = UserService(
        user_repository=user_repository,
        user_session_repository=user_session_repository,
        tenant_repository=FakeTenantRepository(),
        settings=Settings(
            auth_primary_mode="directory_local",
            auth_failed_sign_in_max_attempts=3,
            auth_failed_sign_in_window_minutes=15,
            auth_failed_sign_in_lockout_minutes=15,
            auth_session_review_max_active_sessions_per_user=3,
            auth_session_review_max_distinct_devices_per_user=3,
        ),
    )

    response = await service.get_user_access_governance_summary(tenant_id=tenant_id)

    assert response.total_members == 1
    assert response.active_accounts == 1
    assert response.active_memberships == 1
    assert response.invited_memberships == 1
    assert response.suspended_memberships == 1
    assert response.dormant_accounts == 1
    assert response.expiring_invitations == 1
    assert response.expired_invitations == 0
    assert response.recent_failed_sign_in_events == 3
    assert response.members_under_sign_in_lockout == 1
    assert response.recent_failed_invitation_activation_events == 1
    assert response.members_with_failed_invitation_activation == 1
    assert response.members_with_session_spread == 1
    assert response.total_audit_events == 6
    assert response.sensitive_audit_events == 1
    assert response.active_sessions == 3
    assert response.sessions_expiring_within_24_hours == 2
    assert response.review_queue_items == 6
    assert response.event_breakdown[0].event_type == "sign_in_failed"
    assert response.event_breakdown[0].event_count == 3
    assert response.event_breakdown[1].event_type == "sign_in_succeeded"
    assert response.event_breakdown[1].event_count == 1
    assert response.event_breakdown[2].event_type == "invitation_activation_failed"
    assert response.event_breakdown[2].event_count == 1
    assert response.event_breakdown[3].event_type == "session_revoked"
    assert response.review_items[0].category == "expired_invitations"
    assert response.review_items[0].severity == "healthy"
    assert response.review_items[1].category == "expiring_invitations"
    assert response.review_items[1].item_count == 1
    assert response.review_items[1].follow_up is not None
    assert response.review_items[1].follow_up.member_relationship_filter == "invited"
    assert response.review_items[2].category == "dormant_accounts"
    assert response.review_items[2].user_id == user.id
    assert response.review_items[2].follow_up is not None
    assert response.review_items[2].follow_up.management_panel == "user-edit"
    assert response.review_items[3].category == "suspended_memberships"
    assert response.review_items[3].membership_id == suspended_membership.id
    assert response.review_items[3].follow_up is not None
    assert response.review_items[3].follow_up.member_relationship_filter == "suspended"
    assert response.review_items[4].category == "failed_sign_in_pressure"
    assert response.review_items[4].item_count == 1
    assert response.review_items[4].follow_up is not None
    assert response.review_items[4].follow_up.management_panel == "user-edit"
    assert response.review_items[5].category == "invitation_activation_pressure"
    assert response.review_items[5].item_count == 1
    assert response.review_items[5].follow_up is not None
    assert response.review_items[5].follow_up.member_relationship_filter == "invited"
    assert response.review_items[6].category == "session_spread_pressure"
    assert response.review_items[6].item_count == 1
    assert response.review_items[6].follow_up is not None
    assert response.review_items[6].follow_up.management_panel == "user-edit"
    assert user_session_repository.batch_list_calls == 1


@pytest.mark.anyio
async def test_list_user_access_events_applies_query_filter() -> None:
    now = datetime.now(timezone.utc)
    user = SimpleNamespace(
        id=uuid4(),
        email="operator@ragpilot.local",
        display_name="RAGPilot Operator",
        is_active=True,
        role="operator",
        last_signed_in_at=None,
        created_at=now,
        updated_at=now,
        deleted_at=None,
    )
    membership = build_membership(user_id=user.id, status="active", activated_at=now)
    memberships = [
        UserMembershipDirectoryRecord(
            membership=membership,
            tenant=build_tenant(tenant_id=membership.tenant_id, name="RAGPilot Demo", slug="ragpilot-demo"),
        )
    ]
    user_repository = FakeUserRepository(user_count=1, user=user, memberships=memberships)
    await user_repository.create_user_access_event(
        user_id=user.id,
        tenant_id=membership.tenant_id,
        event_type="session_revoked",
        detail_json={"reason": "Revoked from Admin Console"},
    )
    await user_repository.create_user_access_event(
        user_id=user.id,
        tenant_id=membership.tenant_id,
        event_type="sign_in_succeeded",
        detail_json={"login_mode": "directory"},
    )
    service = UserService(
        user_repository=user_repository,
        user_session_repository=None,
        tenant_repository=FakeTenantRepository(),
    )

    response = await service.list_user_access_events(query="Revoked from Admin Console")

    assert len(response) == 1
    assert response[0].event_type == "session_revoked"
