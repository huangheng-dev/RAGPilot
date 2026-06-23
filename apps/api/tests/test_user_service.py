from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from uuid import uuid4

import pytest

from ragpilot_api.application.errors import ResourceConflictError
from ragpilot_api.application.identity.user_service import UserService
from ragpilot_api.contracts.http.user_contracts import (
    UserBootstrapRequest,
    UserInvitationActivationRequest,
    UserLoginRequest,
)
from ragpilot_api.infrastructure.database.repositories.user_repository import (
    UserAccessEventRecord,
    UserDirectoryRecord,
    UserMembershipDirectoryRecord,
)


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
        self.reactivated = False
        self.last_signed_in_user_id = None
        self.access_events: list[SimpleNamespace] = []

    async def count_users(self) -> int:
        return self.user_count

    async def create_user(self, *, email: str, display_name: str, is_active: bool, role: str):
        now = datetime.now(timezone.utc)
        self.created_role = role
        self.user = SimpleNamespace(
            id=uuid4(),
            email=email,
            display_name=display_name,
            is_active=is_active,
            role=role,
            last_signed_in_at=None,
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

    async def get_user_directory_record(self, *, user_id):
        if not self.user or self.user.id != user_id:
            return None
        return UserDirectoryRecord(user=self.user, memberships=self.memberships)

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

    async def list_user_access_events(self, *, tenant_id=None, user_id=None, event_type=None, limit=20):
        events = self.access_events
        if tenant_id is not None:
            events = [event for event in events if event.tenant_id == tenant_id]
        if user_id is not None:
            events = [event for event in events if event.user_id == user_id]
        if event_type is not None:
            events = [event for event in events if event.event_type == event_type]
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


class FakeRolePermissionRepository:
    def __init__(self, role_permissions=None) -> None:
        self.role_permissions = role_permissions or {}

    async def list_role_permission_slugs(self):
        return self.role_permissions


class FakeUserSessionRepository:
    def __init__(self) -> None:
        self.created_sessions: list[SimpleNamespace] = []
        self.revoked_session_ids: list[object] = []

    async def create_user_session(self, *, user_id, authentication_mode: str):
        session = SimpleNamespace(
            id=uuid4(),
            user_id=user_id,
            authentication_mode=authentication_mode,
            expires_at=datetime.now(timezone.utc) + timedelta(days=14),
        )
        self.created_sessions.append(session)
        return session, "rp_sess_test_token"

    async def revoke_user_session(self, *, session_id):
        self.revoked_session_ids.append(session_id)
        return next((session for session in self.created_sessions if session.id == session_id), None)


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
async def test_assess_login_user_returns_invitation_activation_state() -> None:
    now = datetime.now(timezone.utc)
    user = SimpleNamespace(
        id=uuid4(),
        email="operator@ragpilot.local",
        display_name="RagPilot Operator",
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
            tenant=build_tenant(tenant_id=invited_membership.tenant_id, name="RagPilot Demo", slug="ragpilot-demo"),
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
async def test_activate_user_invitations_reactivates_account_and_promotes_matching_invite() -> None:
    now = datetime.now(timezone.utc)
    user = SimpleNamespace(
        id=uuid4(),
        email="operator@ragpilot.local",
        display_name="RagPilot Operator",
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
            tenant=build_tenant(tenant_id=matching_membership.tenant_id, name="RagPilot Demo", slug="ragpilot-demo"),
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
async def test_activate_user_invitations_rejects_invalid_token_when_no_active_membership_exists() -> None:
    now = datetime.now(timezone.utc)
    user = SimpleNamespace(
        id=uuid4(),
        email="operator@ragpilot.local",
        display_name="RagPilot Operator",
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
            tenant=build_tenant(tenant_id=invited_membership.tenant_id, name="RagPilot Demo", slug="ragpilot-demo"),
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


@pytest.mark.anyio
async def test_activate_user_invitations_rejects_expired_token() -> None:
    now = datetime.now(timezone.utc)
    user = SimpleNamespace(
        id=uuid4(),
        email="operator@ragpilot.local",
        display_name="RagPilot Operator",
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
            tenant=build_tenant(tenant_id=invited_membership.tenant_id, name="RagPilot Demo", slug="ragpilot-demo"),
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


@pytest.mark.anyio
async def test_issue_user_membership_invitation_refreshes_membership_credentials() -> None:
    now = datetime.now(timezone.utc)
    user = SimpleNamespace(
        id=uuid4(),
        email="operator@ragpilot.local",
        display_name="RagPilot Operator",
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
    tenant = build_tenant(tenant_id=active_membership.tenant_id, name="RagPilot Demo", slug="ragpilot-demo")
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
        display_name="RagPilot Operator",
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
        display_name="RagPilot Operator",
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
        display_name="RagPilot Operator",
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
            tenant=build_tenant(tenant_id=active_membership.tenant_id, name="RagPilot Demo", slug="ragpilot-demo"),
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
        UserLoginRequest(email="operator@ragpilot.local", display_name="RagPilot Operator")
    )

    assert response.user.last_signed_in_at is not None
    assert response.session.session_token == "rp_sess_test_token"
    assert user_repository.last_signed_in_user_id == user.id
    assert user_repository.access_events[-1].event_type == "sign_in_succeeded"
    assert session_repository.created_sessions[-1].authentication_mode == "directory"


@pytest.mark.anyio
async def test_revoke_current_session_revokes_owned_session() -> None:
    now = datetime.now(timezone.utc)
    user = SimpleNamespace(
        id=uuid4(),
        email="operator@ragpilot.local",
        display_name="RagPilot Operator",
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
            tenant=build_tenant(tenant_id=active_membership.tenant_id, name="RagPilot Demo", slug="ragpilot-demo"),
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
    )

    assert session_repository.revoked_session_ids == [created_session.id]


@pytest.mark.anyio
async def test_revoke_user_membership_invitation_suspends_membership_and_logs_event() -> None:
    now = datetime.now(timezone.utc)
    user = SimpleNamespace(
        id=uuid4(),
        email="operator@ragpilot.local",
        display_name="RagPilot Operator",
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
            tenant=build_tenant(tenant_id=invited_membership.tenant_id, name="RagPilot Demo", slug="ragpilot-demo"),
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
        display_name="RagPilot Operator",
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
            tenant=build_tenant(tenant_id=active_membership.tenant_id, name="RagPilot Demo", slug="ragpilot-demo"),
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
async def test_list_user_access_events_applies_event_type_filter() -> None:
    now = datetime.now(timezone.utc)
    user = SimpleNamespace(
        id=uuid4(),
        email="operator@ragpilot.local",
        display_name="RagPilot Operator",
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
            tenant=build_tenant(tenant_id=membership.tenant_id, name="RagPilot Demo", slug="ragpilot-demo"),
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
