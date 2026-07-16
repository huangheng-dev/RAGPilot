from datetime import datetime, timezone
from types import SimpleNamespace
from uuid import uuid4

from fastapi.testclient import TestClient

from ragpilot_api.infrastructure.database.session import get_database_session
from ragpilot_api.main import app
from ragpilot_api.presentation.http import request_actor
from ragpilot_api.presentation.http.v1 import user_routes


async def override_database_session():
    yield None


def build_user_directory_payload() -> dict[str, object]:
    now = datetime.now(timezone.utc).isoformat()
    return {
        "id": str(uuid4()),
        "email": "operator@ragpilot.local",
        "display_name": "RAGPilot Operator",
        "is_active": True,
        "role": "operator",
        "last_signed_in_at": now,
        "memberships": [
            {
                "id": str(uuid4()),
                "tenant_id": str(uuid4()),
                "tenant_name": "RAGPilot Demo",
                "tenant_slug": "ragpilot-demo",
                "membership_status": "active",
                "invitation_issue_count": 0,
                "last_invitation_issued_by_user_id": None,
                "last_invitation_issued_by_display_name": None,
                "invited_at": None,
                "invitation_expires_at": None,
                "activated_at": now,
                "created_at": now,
                "updated_at": now,
            }
        ],
        "created_at": now,
        "updated_at": now,
    }


def build_user_access_event_payload() -> dict[str, object]:
    now = datetime.now(timezone.utc).isoformat()
    return {
        "id": str(uuid4()),
        "tenant_id": str(uuid4()),
        "user_id": str(uuid4()),
        "membership_id": str(uuid4()),
        "actor_user_id": str(uuid4()),
        "actor_display_name": "Platform Owner",
        "user_display_name": "RAGPilot Operator",
        "tenant_name": "RAGPilot Demo",
        "event_type": "invitation_issued",
        "detail_json": {"membership_status": "invited", "invitation_issue_count": 2},
        "created_at": now,
    }


def build_authenticated_user_payload() -> dict[str, object]:
    user_payload = build_user_directory_payload()
    return {
        "user": user_payload,
        "session": {
            "session_token": "rp_sess_test_token",
            "expires_at": datetime.now(timezone.utc).isoformat(),
        },
        "permissions": {
            "user_id": user_payload["id"],
            "role": user_payload["role"],
            "has_active_membership": True,
            "active_tenant_ids": [user_payload["memberships"][0]["tenant_id"]],
            "capabilities": {
                "access_home": True,
                "access_chat": True,
                "access_documents": True,
                "access_agents": True,
                "access_operations": True,
                "access_settings": True,
                "access_admin_console": False,
                "manage_admin_resources": False,
                "manage_members": False,
                "manage_runtime_governance": False,
                "review_runtime_governance": False,
                "manage_agent_definitions": True,
                "execute_agents": True,
                "manage_documents": True,
                "send_chat_messages": True,
                "retry_workflow_runs": True,
                "view_audit_events": False,
                "manage_local_session_role": False,
            },
        },
    }


def build_auth_mode_payload() -> dict[str, object]:
    return {
        "primary_mode": "directory_local",
        "sign_in_method": "local_form",
        "session_transport": "bearer_session",
        "supports_display_name_input": True,
        "supports_password_input": False,
        "supports_invitation_activation": True,
        "allow_initial_super_admin": False,
        "provider_protocol": None,
        "provider_display_name": None,
        "provider_sign_in_url": None,
        "provider_post_sign_out_url": None,
    }


def build_active_session_payload() -> dict[str, object]:
    now = datetime.now(timezone.utc).isoformat()
    return {
        "id": str(uuid4()),
        "authentication_mode": "directory",
        "user_agent": "Mozilla/5.0",
        "ip_address": "127.0.0.1",
        "device_label": "Windows · Chrome",
        "created_at": now,
        "updated_at": now,
        "expires_at": now,
        "is_current": True,
    }


def build_session_security_summary_payload() -> dict[str, object]:
    now = datetime.now(timezone.utc).isoformat()
    return {
        "total_active_sessions": 3,
        "other_active_sessions": 2,
        "expires_within_24_hours": 1,
        "distinct_device_count": 2,
        "distinct_ip_count": 1,
        "oldest_session_started_at": now,
        "latest_session_expires_at": now,
        "current_session_started_at": now,
        "current_session_expires_at": now,
        "mode_breakdown": [
            {"authentication_mode": "directory", "session_count": 2},
            {"authentication_mode": "bootstrap", "session_count": 1},
        ],
    }


def build_session_bulk_revocation_payload() -> dict[str, object]:
    return {
        "user_id": str(uuid4()),
        "revoked_session_count": 2,
        "remaining_active_sessions": 1,
        "preserved_current_session": True,
        "revocation_scope": "other_sessions",
    }


def build_current_user_access_summary_payload() -> dict[str, object]:
    return {
        "membership_access_state": "ready",
        "active_memberships": 2,
        "invited_memberships": 1,
        "suspended_memberships": 1,
        "expiring_invitations": 1,
        "expired_invitations": 1,
        "recent_failed_sign_in_events": 2,
        "recent_failed_invitation_activation_events": 1,
        "total_audit_events": 12,
        "sensitive_audit_events": 3,
        "active_sessions": 4,
        "sessions_expiring_within_24_hours": 1,
        "recent_sign_in_events": 5,
        "sign_in_lockout_active": True,
        "sign_in_lockout_expires_at": datetime.now(timezone.utc).isoformat(),
        "session_spread_detected": True,
        "latest_event_type": "session_revoked",
        "latest_event_at": datetime.now(timezone.utc).isoformat(),
        "event_breakdown": [
            {"event_type": "sign_in_succeeded", "event_count": 5},
            {"event_type": "session_revoked", "event_count": 2},
        ],
        "review_items": [
            {
                "category": "failed_sign_in_pressure",
                "severity": "attention",
                "item_count": 2,
                "tenant_id": None,
                "user_id": None,
                "membership_id": None,
                "follow_up": None,
            },
            {
                "category": "session_spread_pressure",
                "severity": "attention",
                "item_count": 1,
                "tenant_id": None,
                "user_id": None,
                "membership_id": None,
                "follow_up": None,
            },
        ],
    }


def build_access_governance_summary_payload() -> dict[str, object]:
    return {
        "total_members": 4,
        "active_accounts": 3,
        "inactive_accounts": 1,
        "active_memberships": 3,
        "invited_memberships": 2,
        "suspended_memberships": 1,
        "dormant_accounts": 1,
        "expiring_invitations": 1,
        "expired_invitations": 1,
        "recent_failed_sign_in_events": 3,
        "members_under_sign_in_lockout": 1,
        "recent_failed_invitation_activation_events": 1,
        "members_with_failed_invitation_activation": 1,
        "members_with_session_spread": 1,
        "total_audit_events": 14,
        "sensitive_audit_events": 3,
        "active_sessions": 5,
        "sessions_expiring_within_24_hours": 2,
        "review_queue_items": 6,
        "event_breakdown": [
            {"event_type": "sign_in_succeeded", "event_count": 6},
            {"event_type": "invitation_issued", "event_count": 4},
            {"event_type": "session_revoked", "event_count": 2},
        ],
        "review_items": [
            {
                "category": "expired_invitations",
                "severity": "attention",
                "item_count": 1,
                "tenant_id": str(uuid4()),
                "user_id": str(uuid4()),
                "membership_id": str(uuid4()),
                "follow_up": {
                    "tenant_id": str(uuid4()),
                    "user_id": str(uuid4()),
                    "membership_id": str(uuid4()),
                    "member_relationship_filter": "invited",
                    "member_account_filter": None,
                    "management_panel": "user-edit",
                },
            },
            {
                "category": "expiring_invitations",
                "severity": "review",
                "item_count": 1,
                "tenant_id": str(uuid4()),
                "user_id": str(uuid4()),
                "membership_id": str(uuid4()),
                "follow_up": {
                    "tenant_id": str(uuid4()),
                    "user_id": str(uuid4()),
                    "membership_id": str(uuid4()),
                    "member_relationship_filter": "invited",
                    "member_account_filter": None,
                    "management_panel": "user-edit",
                },
            },
            {
                "category": "dormant_accounts",
                "severity": "review",
                "item_count": 1,
                "tenant_id": None,
                "user_id": str(uuid4()),
                "membership_id": None,
                "follow_up": {
                    "tenant_id": None,
                    "user_id": str(uuid4()),
                    "membership_id": None,
                    "member_relationship_filter": None,
                    "member_account_filter": "active",
                    "management_panel": "user-edit",
                },
            },
            {
                "category": "failed_sign_in_pressure",
                "severity": "attention",
                "item_count": 1,
                "tenant_id": None,
                "user_id": str(uuid4()),
                "membership_id": None,
                "follow_up": {
                    "tenant_id": None,
                    "user_id": str(uuid4()),
                    "membership_id": None,
                    "member_relationship_filter": None,
                    "member_account_filter": "active",
                    "management_panel": "user-edit",
                },
            },
            {
                "category": "invitation_activation_pressure",
                "severity": "attention",
                "item_count": 1,
                "tenant_id": None,
                "user_id": str(uuid4()),
                "membership_id": None,
                "follow_up": {
                    "tenant_id": None,
                    "user_id": str(uuid4()),
                    "membership_id": None,
                    "member_relationship_filter": "invited",
                    "member_account_filter": None,
                    "management_panel": "user-edit",
                },
            },
            {
                "category": "session_spread_pressure",
                "severity": "attention",
                "item_count": 1,
                "tenant_id": None,
                "user_id": str(uuid4()),
                "membership_id": None,
                "follow_up": {
                    "tenant_id": None,
                    "user_id": str(uuid4()),
                    "membership_id": None,
                    "member_relationship_filter": None,
                    "member_account_filter": "active",
                    "management_panel": "user-edit",
                },
            },
            {
                "category": "suspended_memberships",
                "severity": "review",
                "item_count": 1,
                "tenant_id": str(uuid4()),
                "user_id": str(uuid4()),
                "membership_id": str(uuid4()),
                "follow_up": {
                    "tenant_id": str(uuid4()),
                    "user_id": str(uuid4()),
                    "membership_id": str(uuid4()),
                    "member_relationship_filter": "suspended",
                    "member_account_filter": None,
                    "management_panel": "user-edit",
                },
            },
        ],
    }


def test_user_list_route_forwards_scope_filters(monkeypatch) -> None:
    captured: dict[str, object] = {}

    class FakeUserService:
        async def list_users(self, *, tenant_id, membership_status, query, email, is_active):
            captured.update(
                {
                    "tenant_id": tenant_id,
                    "membership_status": membership_status,
                    "query": query,
                    "email": email,
                    "is_active": is_active,
                }
            )
            return [build_user_directory_payload()]

    monkeypatch.setattr(user_routes, "build_user_service", lambda session: FakeUserService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.get(
        "/api/v1/users",
        params={
            "tenant_id": str(uuid4()),
            "membership_status": "active",
            "query": "operator",
            "is_active": "true",
        },
        headers={"X-RAGPilot-Role": "super_admin", "X-RAGPilot-Actor-Id": str(uuid4())},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert captured["membership_status"] == "active"
    assert captured["query"] == "operator"
    assert captured["email"] is None
    assert captured["is_active"] is True
    assert len(response.json()) == 1


def test_user_list_route_requires_super_admin(monkeypatch) -> None:
    class FakeUserService:
        async def list_users(self, **kwargs):
            raise AssertionError("list_users should not be called without super admin access.")

    monkeypatch.setattr(user_routes, "build_user_service", lambda session: FakeUserService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.get("/api/v1/users")

    app.dependency_overrides.clear()

    assert response.status_code == 401


def test_user_list_route_uses_database_policy_when_seeded(monkeypatch) -> None:
    class FakeRolePermissionRepository:
        def __init__(self, session) -> None:
            self.session = session

        async def list_role_permission_slugs(self):
            return {"super_admin": {"manage_members"}}

    class FakeUserService:
        async def list_users(self, **kwargs):
            raise AssertionError("list_users should not run when database policy denies admin console access.")

    monkeypatch.setattr(user_routes, "RolePermissionRepository", FakeRolePermissionRepository)
    monkeypatch.setattr(user_routes, "build_user_service", lambda session: FakeUserService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.get(
        "/api/v1/users",
        headers={"X-RAGPilot-Role": "super_admin", "X-RAGPilot-Actor-Id": str(uuid4())},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 403


def test_create_user_route_returns_created_directory_entry(monkeypatch) -> None:
    captured: dict[str, object] = {}
    payload = build_user_directory_payload()
    actor_user_id = uuid4()

    class FakeUserService:
        async def create_user(self, request, *, actor_user_id=None):
            captured["request"] = request
            captured["actor_user_id"] = actor_user_id
            return payload

    monkeypatch.setattr(user_routes, "build_user_service", lambda session: FakeUserService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.post(
        "/api/v1/users",
        json={
            "email": "operator@ragpilot.local",
            "display_name": "RAGPilot Operator",
            "role": "reviewer",
            "tenant_id": payload["memberships"][0]["tenant_id"],
            "membership_status": "active",
        },
        headers={"X-RAGPilot-Role": "super_admin", "X-RAGPilot-Actor-Id": str(actor_user_id)},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 201
    assert response.json()["email"] == "operator@ragpilot.local"
    assert captured["request"].display_name == "RAGPilot Operator"
    assert captured["request"].role == "reviewer"
    assert captured["actor_user_id"] == actor_user_id


def test_create_user_route_uses_database_policy_when_seeded(monkeypatch) -> None:
    class FakeRolePermissionRepository:
        def __init__(self, session) -> None:
            self.session = session

        async def list_role_permission_slugs(self):
            return {"super_admin": {"access_admin_console"}}

    class FakeUserService:
        async def create_user(self, request, *, actor_user_id=None):
            raise AssertionError("create_user should not run when database policy denies member management.")

    monkeypatch.setattr(user_routes, "RolePermissionRepository", FakeRolePermissionRepository)
    monkeypatch.setattr(user_routes, "build_user_service", lambda session: FakeUserService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.post(
        "/api/v1/users",
        json={
            "email": "operator@ragpilot.local",
            "display_name": "RAGPilot Operator",
            "role": "reviewer",
            "membership_status": "active",
        },
        headers={"X-RAGPilot-Role": "super_admin", "X-RAGPilot-Actor-Id": str(uuid4())},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 403


def test_create_user_route_requires_actor_identity(monkeypatch) -> None:
    class FakeUserService:
        async def create_user(self, request, *, actor_user_id=None):
            raise AssertionError("create_user should not run without an authenticated actor.")

    monkeypatch.setattr(user_routes, "build_user_service", lambda session: FakeUserService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.post(
        "/api/v1/users",
        json={
            "email": "operator@ragpilot.local",
            "display_name": "RAGPilot Operator",
            "role": "reviewer",
            "membership_status": "active",
        },
        headers={"X-RAGPilot-Role": "super_admin"},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 401
    assert response.json()["detail"] == "Missing actor user header."


def test_bootstrap_user_route_returns_created_directory_entry(monkeypatch) -> None:
    captured: dict[str, object] = {}
    payload = build_user_directory_payload()

    class FakeUserService:
        async def bootstrap_user(self, request):
            captured["request"] = request
            return payload

    monkeypatch.setattr(user_routes, "build_user_service", lambda session: FakeUserService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.post(
        "/api/v1/users/bootstrap",
        json={
            "email": "operator@ragpilot.local",
            "display_name": "RAGPilot Operator",
        },
    )

    app.dependency_overrides.clear()

    assert response.status_code == 201
    assert response.json()["email"] == "operator@ragpilot.local"
    assert captured["request"].display_name == "RAGPilot Operator"


def test_bootstrap_user_route_rejects_unexpected_fields(monkeypatch) -> None:
    class FakeUserService:
        async def bootstrap_user(self, request):
            raise AssertionError("bootstrap_user should not be called when unexpected fields are submitted.")

    monkeypatch.setattr(user_routes, "build_user_service", lambda session: FakeUserService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.post(
        "/api/v1/users/bootstrap",
        json={
            "email": "operator@ragpilot.local",
            "display_name": "RAGPilot Operator",
            "role": "super_admin",
        },
    )

    app.dependency_overrides.clear()

    assert response.status_code == 422


def test_bootstrap_status_route_returns_directory_state(monkeypatch) -> None:
    class FakeUserService:
        async def get_bootstrap_status(self):
            return {
                "has_users": False,
                "allow_initial_super_admin": True,
            }

    monkeypatch.setattr(user_routes, "build_user_service", lambda session: FakeUserService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.get("/api/v1/users/bootstrap/status")

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["allow_initial_super_admin"] is True


def test_bootstrap_status_route_can_reflect_provider_managed_boundary(monkeypatch) -> None:
    class FakeUserService:
        async def get_bootstrap_status(self):
            return {
                "has_users": False,
                "allow_initial_super_admin": False,
            }

    monkeypatch.setattr(user_routes, "build_user_service", lambda session: FakeUserService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.get("/api/v1/users/bootstrap/status")

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["allow_initial_super_admin"] is False


def test_login_user_route_returns_directory_entry(monkeypatch) -> None:
    captured: dict[str, object] = {}
    payload = build_authenticated_user_payload()

    class FakeUserService:
        async def login_user(self, request, *, session_telemetry=None):
            captured["request"] = request
            captured["session_telemetry"] = session_telemetry
            return payload

    monkeypatch.setattr(user_routes, "build_user_service", lambda session: FakeUserService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.post(
        "/api/v1/users/login",
        json={
            "email": "operator@ragpilot.local",
            "display_name": "RAGPilot Operator",
            "password": "Operator123",
        },
    )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["user"]["last_signed_in_at"] is not None
    assert response.json()["session"]["session_token"] == "rp_sess_test_token"
    assert "ragpilot_session=rp_sess_test_token" in response.headers["set-cookie"]
    assert "HttpOnly" in response.headers["set-cookie"]
    assert captured["request"].email == "operator@ragpilot.local"
    assert captured["request"].password == "Operator123"
    assert captured["session_telemetry"].ip_address == "testclient"


def test_login_user_route_rejects_unexpected_fields(monkeypatch) -> None:
    class FakeUserService:
        async def login_user(self, request, *, session_telemetry=None):
            raise AssertionError("login_user should not be called when unexpected fields are submitted.")

    monkeypatch.setattr(user_routes, "build_user_service", lambda session: FakeUserService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.post(
        "/api/v1/users/login",
        json={
            "email": "operator@ragpilot.local",
            "display_name": "RAGPilot Operator",
            "password": "Operator123",
            "role": "super_admin",
        },
    )

    app.dependency_overrides.clear()

    assert response.status_code == 422


def test_auth_mode_route_returns_authentication_boundary(monkeypatch) -> None:
    class FakeUserService:
        async def get_authentication_mode(self, *, return_to=None):
            return build_auth_mode_payload()

    monkeypatch.setattr(user_routes, "build_user_service", lambda session: FakeUserService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.get("/api/v1/users/auth-mode")

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["primary_mode"] == "directory_local"
    assert response.json()["sign_in_method"] == "local_form"
    assert response.json()["supports_password_input"] is False
    assert response.json()["supports_invitation_activation"] is True


def test_auth_mode_route_forwards_return_target_for_provider_login(monkeypatch) -> None:
    captured: dict[str, object] = {}

    class FakeUserService:
        async def get_authentication_mode(self, *, return_to=None):
            captured["return_to"] = return_to
            payload = build_auth_mode_payload()
            payload["primary_mode"] = "oidc"
            payload["sign_in_method"] = "external_redirect"
            payload["provider_protocol"] = "oidc"
            payload["provider_display_name"] = "Company SSO"
            payload["provider_sign_in_url"] = "https://login.example.com/authorize?return_to=%2Fchat"
            payload["provider_post_sign_out_url"] = "https://login.example.com/logout?return_to=%2Fchat"
            return payload

    monkeypatch.setattr(user_routes, "build_user_service", lambda session: FakeUserService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.get("/api/v1/users/auth-mode", params={"return_to": "/chat"})

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert captured["return_to"] == "/chat"
    assert response.json()["provider_protocol"] == "oidc"
    assert response.json()["provider_display_name"] == "Company SSO"
    assert response.json()["provider_sign_in_url"] == "https://login.example.com/authorize?return_to=%2Fchat"
    assert response.json()["provider_post_sign_out_url"] == "https://login.example.com/logout?return_to=%2Fchat"


def test_login_assessment_route_returns_directory_state(monkeypatch) -> None:
    captured: dict[str, object] = {}
    payload = {
        "email": "operator@ragpilot.local",
        "has_users": True,
        "user_exists": True,
        "is_active": True,
        "role": "operator",
        "account_state": "invited",
        "allow_sign_in": False,
        "next_action": "activate_invitation",
        "active_membership_count": 0,
        "invited_membership_count": 1,
        "suspended_membership_count": 0,
        "expired_invitation_count": 0,
        "expiring_invitation_count": 1,
        "memberships": build_user_directory_payload()["memberships"],
    }

    class FakeUserService:
        async def assess_login_user(self, *, email):
            captured["email"] = email
            return payload

    monkeypatch.setattr(user_routes, "build_user_service", lambda session: FakeUserService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.get(
        "/api/v1/users/login-assessment",
        params={"email": "operator@ragpilot.local"},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["account_state"] == "invited"
    assert response.json()["next_action"] == "activate_invitation"
    assert captured["email"] == "operator@ragpilot.local"


def test_login_assessment_route_can_return_provider_managed_contact_admin_state(monkeypatch) -> None:
    class FakeUserService:
        async def assess_login_user(self, *, email):
            return {
                "email": email,
                "has_users": True,
                "user_exists": False,
                "is_active": None,
                "role": None,
                "account_state": "not_found",
                "allow_sign_in": False,
                "next_action": "contact_admin",
                "active_membership_count": 0,
                "invited_membership_count": 0,
                "suspended_membership_count": 0,
                "expired_invitation_count": 0,
                "expiring_invitation_count": 0,
                "memberships": [],
            }

    monkeypatch.setattr(user_routes, "build_user_service", lambda session: FakeUserService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.get(
        "/api/v1/users/login-assessment",
        params={"email": "owner@example.com"},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["allow_sign_in"] is False
    assert response.json()["next_action"] == "contact_admin"


def test_user_access_event_list_route_returns_audit_events(monkeypatch) -> None:
    captured: dict[str, object] = {}
    payload = build_user_access_event_payload()

    class FakeUserService:
        async def list_user_access_events(self, *, tenant_id=None, user_id=None, event_type=None, query=None, limit=20):
            captured["tenant_id"] = tenant_id
            captured["user_id"] = user_id
            captured["event_type"] = event_type
            captured["query"] = query
            captured["limit"] = limit
            return [payload]

    monkeypatch.setattr(user_routes, "build_user_service", lambda session: FakeUserService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.get(
        "/api/v1/users/audit-events",
        params={"limit": 10, "event_type": "invitation_issued", "query": "operator"},
        headers={"X-RAGPilot-Role": "super_admin", "X-RAGPilot-Actor-Id": str(uuid4())},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()[0]["event_type"] == "invitation_issued"
    assert captured["event_type"] == "invitation_issued"
    assert captured["query"] == "operator"
    assert captured["limit"] == 10


def test_user_access_event_list_route_rejects_reviewer_role(monkeypatch) -> None:
    class FakeUserService:
        async def list_user_access_events(self, **kwargs):
            raise AssertionError("list_user_access_events should not be called without audit capability.")

    monkeypatch.setattr(user_routes, "build_user_service", lambda session: FakeUserService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.get(
        "/api/v1/users/audit-events",
        headers={"X-RAGPilot-Role": "reviewer", "X-RAGPilot-Actor-Id": str(uuid4())},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 403


def test_user_access_event_list_route_uses_database_policy_when_seeded(monkeypatch) -> None:
    class FakeRolePermissionRepository:
        def __init__(self, session) -> None:
            self.session = session

        async def list_role_permission_slugs(self):
            return {"super_admin": {"access_admin_console"}}

    class FakeUserService:
        async def list_user_access_events(self, **kwargs):
            raise AssertionError("list_user_access_events should not run when database policy denies audit access.")

    monkeypatch.setattr(user_routes, "RolePermissionRepository", FakeRolePermissionRepository)
    monkeypatch.setattr(user_routes, "build_user_service", lambda session: FakeUserService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.get(
        "/api/v1/users/audit-events",
        headers={"X-RAGPilot-Role": "super_admin", "X-RAGPilot-Actor-Id": str(uuid4())},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 403


def test_user_access_governance_summary_route_returns_scoped_summary(monkeypatch) -> None:
    captured: dict[str, object] = {}
    payload = build_access_governance_summary_payload()

    class FakeUserService:
        async def get_user_access_governance_summary(self, *, tenant_id=None, membership_status=None, query=None, is_active=None):
            captured["tenant_id"] = tenant_id
            captured["membership_status"] = membership_status
            captured["query"] = query
            captured["is_active"] = is_active
            return payload

    monkeypatch.setattr(user_routes, "build_user_service", lambda session: FakeUserService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.get(
        "/api/v1/users/access-governance-summary",
        params={
            "tenant_id": str(uuid4()),
            "membership_status": "invited",
            "query": "operator",
            "is_active": "true",
        },
        headers={"X-RAGPilot-Role": "super_admin", "X-RAGPilot-Actor-Id": str(uuid4())},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["total_members"] == 4
    assert response.json()["total_audit_events"] == 14
    assert captured["membership_status"] == "invited"
    assert captured["query"] == "operator"
    assert captured["is_active"] is True


def test_user_access_governance_summary_route_uses_database_policy_when_seeded(monkeypatch) -> None:
    class FakeRolePermissionRepository:
        def __init__(self, session) -> None:
            self.session = session

        async def list_role_permission_slugs(self):
            return {"super_admin": {"view_audit_events"}}

    class FakeUserService:
        async def get_user_access_governance_summary(self, **kwargs):
            raise AssertionError("get_user_access_governance_summary should not run when database policy denies admin console access.")

    monkeypatch.setattr(user_routes, "RolePermissionRepository", FakeRolePermissionRepository)
    monkeypatch.setattr(user_routes, "build_user_service", lambda session: FakeUserService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.get(
        "/api/v1/users/access-governance-summary",
        headers={"X-RAGPilot-Role": "super_admin", "X-RAGPilot-Actor-Id": str(uuid4())},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 403


def test_activate_user_invitations_route_returns_directory_entry(monkeypatch) -> None:
    captured: dict[str, object] = {}
    payload = build_authenticated_user_payload()

    class FakeUserService:
        async def activate_user_invitations(self, request, *, session_telemetry=None):
            captured["request"] = request
            captured["session_telemetry"] = session_telemetry
            return payload

    monkeypatch.setattr(user_routes, "build_user_service", lambda session: FakeUserService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.post(
        "/api/v1/users/activate-invitations",
        json={
            "email": "operator@ragpilot.local",
            "invitation_token": "RP-AB12CD34",
        },
    )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert captured["session_telemetry"].ip_address == "testclient"
    assert response.json()["user"]["email"] == "operator@ragpilot.local"
    assert "ragpilot_session=rp_sess_test_token" in response.headers["set-cookie"]
    assert captured["request"].email == "operator@ragpilot.local"
    assert captured["request"].invitation_token == "RP-AB12CD34"


def test_get_current_user_route_accepts_bearer_session(monkeypatch) -> None:
    captured: dict[str, object] = {}
    user_id = uuid4()

    class FakeUserSessionRepository:
        def __init__(self, session) -> None:
            self.session = session

        async def get_active_user_session_by_token(self, *, session_token):
            assert session_token == "rp_sess_test_token"
            return SimpleNamespace(
                session=SimpleNamespace(id=uuid4()),
                user=SimpleNamespace(id=user_id),
            )

        async def revoke_user_session(self, *, session_id):
            return None

    class FakeUserRepository:
        def __init__(self, session) -> None:
            self.session = session

        async def get_user_directory_record(self, *, user_id):
            membership = SimpleNamespace(
                membership=SimpleNamespace(
                    membership_status="active",
                    tenant_id=uuid4(),
                )
            )
            return SimpleNamespace(
                user=SimpleNamespace(id=user_id, role="operator", is_active=True),
                memberships=[membership],
            )

    class FakeUserService:
        async def get_user(self, *, user_id):
            captured["user_id"] = user_id
            return build_user_directory_payload()

    monkeypatch.setattr(request_actor, "UserSessionRepository", FakeUserSessionRepository)
    monkeypatch.setattr(request_actor, "UserRepository", FakeUserRepository)
    monkeypatch.setattr(user_routes, "build_user_service", lambda session: FakeUserService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.get(
        "/api/v1/users/me",
        headers={"Authorization": "Bearer rp_sess_test_token"},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert captured["user_id"] == user_id


def test_sign_out_current_user_route_revokes_bearer_session(monkeypatch) -> None:
    captured: dict[str, object] = {}
    user_id = uuid4()
    session_id = uuid4()

    class FakeUserSessionRepository:
        def __init__(self, session) -> None:
            self.session = session

        async def get_active_user_session_by_token(self, *, session_token):
            assert session_token == "rp_sess_test_token"
            return SimpleNamespace(
                session=SimpleNamespace(id=session_id),
                user=SimpleNamespace(id=user_id),
            )

        async def revoke_user_session(self, *, session_id):
            return None

    class FakeUserRepository:
        def __init__(self, session) -> None:
            self.session = session

        async def get_user_directory_record(self, *, user_id):
            membership = SimpleNamespace(
                membership=SimpleNamespace(
                    membership_status="active",
                    tenant_id=uuid4(),
                )
            )
            return SimpleNamespace(
                user=SimpleNamespace(id=user_id, role="operator", is_active=True),
                memberships=[membership],
            )

    class FakeUserService:
        async def revoke_current_session(self, *, user_id, session_id, actor_user_id=None, reason=None):
            captured["user_id"] = user_id
            captured["session_id"] = session_id
            captured["actor_user_id"] = actor_user_id
            captured["reason"] = reason

    monkeypatch.setattr(request_actor, "UserSessionRepository", FakeUserSessionRepository)
    monkeypatch.setattr(request_actor, "UserRepository", FakeUserRepository)
    monkeypatch.setattr(user_routes, "build_user_service", lambda session: FakeUserService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.post(
        "/api/v1/users/me/sign-out",
        json={"reason": "Signed out from Settings"},
        headers={"Authorization": "Bearer rp_sess_test_token"},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 204
    assert captured == {
        "user_id": user_id,
        "session_id": session_id,
        "actor_user_id": user_id,
        "reason": "Signed out from Settings",
    }


def test_sign_out_current_user_route_requires_bearer_session(monkeypatch) -> None:
    class FakeUserService:
        async def revoke_current_session(self, **kwargs):
            raise AssertionError("revoke_current_session should not be called without a bearer session.")

    monkeypatch.setattr(user_routes, "build_user_service", lambda session: FakeUserService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.post(
        "/api/v1/users/me/sign-out",
        headers={"X-RAGPilot-Role": "operator", "X-RAGPilot-Actor-Id": str(uuid4())},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 401
    assert response.json()["detail"] == "Current bearer session is required to sign out."


def test_issue_user_membership_invitation_route_returns_token(monkeypatch) -> None:
    captured: dict[str, object] = {}
    user_id = uuid4()
    membership_id = uuid4()
    actor_user_id = uuid4()
    now = datetime.now(timezone.utc).isoformat()

    class FakeUserService:
        async def issue_user_membership_invitation(self, *, user_id, membership_id, request, actor_user_id=None):
            captured["user_id"] = user_id
            captured["membership_id"] = membership_id
            captured["reason"] = request.reason
            captured["actor_user_id"] = actor_user_id
            return {
                "membership_id": membership_id,
                "tenant_id": uuid4(),
                "tenant_name": "RAGPilot Demo",
                "tenant_slug": "ragpilot-demo",
                "membership_status": "invited",
                "invitation_token": "RP-AB12CD34",
                "invitation_issue_count": 2,
                "last_invitation_issued_by_user_id": user_id,
                "last_invitation_issued_by_display_name": "Platform Owner",
                "invited_at": now,
                "invitation_expires_at": now,
                "activated_at": None,
            }

    monkeypatch.setattr(user_routes, "build_user_service", lambda session: FakeUserService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.post(
        f"/api/v1/users/{user_id}/memberships/{membership_id}/invitation",
        json={"reason": "Issued from admin console"},
        headers={"X-RAGPilot-Role": "super_admin", "X-RAGPilot-Actor-Id": str(actor_user_id)},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["invitation_token"] == "RP-AB12CD34"
    assert captured["user_id"] == user_id
    assert captured["membership_id"] == membership_id
    assert captured["reason"] == "Issued from admin console"
    assert captured["actor_user_id"] == actor_user_id


def test_issue_user_membership_invitation_route_requires_actor_identity(monkeypatch) -> None:
    class FakeUserService:
        async def issue_user_membership_invitation(self, **kwargs):
            raise AssertionError("issue_user_membership_invitation should not run without an authenticated actor.")

    monkeypatch.setattr(user_routes, "build_user_service", lambda session: FakeUserService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.post(
        f"/api/v1/users/{uuid4()}/memberships/{uuid4()}/invitation",
        json={"reason": "Issued from admin console"},
        headers={"X-RAGPilot-Role": "super_admin"},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 401
    assert response.json()["detail"] == "Missing actor user header."


def test_revoke_user_membership_invitation_route_returns_directory_entry(monkeypatch) -> None:
    captured: dict[str, object] = {}
    user_id = uuid4()
    membership_id = uuid4()
    actor_user_id = uuid4()

    class FakeUserService:
        async def revoke_user_membership_invitation(self, *, user_id, membership_id, request, actor_user_id=None):
            captured["user_id"] = user_id
            captured["membership_id"] = membership_id
            captured["reason"] = request.reason
            captured["actor_user_id"] = actor_user_id
            return build_user_directory_payload()

    monkeypatch.setattr(user_routes, "build_user_service", lambda session: FakeUserService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.post(
        f"/api/v1/users/{user_id}/memberships/{membership_id}/revoke-invitation",
        json={"reason": "Invite replaced by direct activation"},
        headers={"X-RAGPilot-Role": "super_admin", "X-RAGPilot-Actor-Id": str(actor_user_id)},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert captured["user_id"] == user_id
    assert captured["membership_id"] == membership_id
    assert captured["reason"] == "Invite replaced by direct activation"
    assert captured["actor_user_id"] == actor_user_id


def test_update_user_membership_route_returns_directory_entry(monkeypatch) -> None:
    captured: dict[str, object] = {}
    user_id = uuid4()
    membership_id = uuid4()
    actor_user_id = uuid4()

    class FakeUserService:
        async def update_user_membership(self, *, user_id, membership_id, request, actor_user_id=None):
            captured.update(
                {
                    "user_id": user_id,
                    "membership_id": membership_id,
                    "membership_status": request.membership_status,
                    "reason": request.reason,
                    "actor_user_id": actor_user_id,
                }
            )
            return build_user_directory_payload()

    monkeypatch.setattr(user_routes, "build_user_service", lambda session: FakeUserService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.patch(
        f"/api/v1/users/{user_id}/memberships/{membership_id}",
        json={"membership_status": "suspended", "reason": "Manual governance hold"},
        headers={"X-RAGPilot-Role": "super_admin", "X-RAGPilot-Actor-Id": str(actor_user_id)},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert captured["user_id"] == user_id
    assert captured["membership_id"] == membership_id
    assert captured["membership_status"] == "suspended"
    assert captured["reason"] == "Manual governance hold"
    assert captured["actor_user_id"] == actor_user_id


def test_update_user_membership_route_rejects_operator_role(monkeypatch) -> None:
    class FakeUserService:
        async def update_user_membership(self, **kwargs):
            raise AssertionError("update_user_membership should not be called without member-management capability.")

    monkeypatch.setattr(user_routes, "build_user_service", lambda session: FakeUserService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.patch(
        f"/api/v1/users/{uuid4()}/memberships/{uuid4()}",
        json={"membership_status": "suspended", "reason": "Manual governance hold"},
        headers={"X-RAGPilot-Role": "operator", "X-RAGPilot-Actor-Id": str(uuid4())},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 403


def test_get_user_route_returns_directory_entry(monkeypatch) -> None:
    captured: dict[str, object] = {}
    user_id = uuid4()

    class FakeUserService:
        async def get_user(self, *, user_id):
            captured["user_id"] = user_id
            return build_user_directory_payload()

    monkeypatch.setattr(user_routes, "build_user_service", lambda session: FakeUserService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.get(
        f"/api/v1/users/{user_id}",
        headers={
            "X-RAGPilot-Role": "operator",
            "X-RAGPilot-Actor-Id": str(user_id),
        },
    )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert captured["user_id"] == user_id
    assert response.json()["email"] == "operator@ragpilot.local"


def test_get_user_route_requires_actor_identity(monkeypatch) -> None:
    class FakeUserService:
        async def get_user(self, *, user_id):
            raise AssertionError("get_user should not run without an authenticated actor.")

    monkeypatch.setattr(user_routes, "build_user_service", lambda session: FakeUserService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.get(
        f"/api/v1/users/{uuid4()}",
        headers={"X-RAGPilot-Role": "reviewer"},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 401
    assert response.json()["detail"] == "Missing actor user header."


def test_get_user_route_rejects_non_self_non_admin(monkeypatch) -> None:
    user_id = uuid4()

    class FakeUserService:
        async def get_user(self, *, user_id):
            raise AssertionError("get_user should not be called for an unauthorized actor.")

    monkeypatch.setattr(user_routes, "build_user_service", lambda session: FakeUserService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.get(
        f"/api/v1/users/{user_id}",
        headers={
            "X-RAGPilot-Role": "operator",
            "X-RAGPilot-Actor-Id": str(uuid4()),
        },
    )

    app.dependency_overrides.clear()

    assert response.status_code == 403


def test_get_user_route_uses_database_policy_when_seeded(monkeypatch) -> None:
    user_id = uuid4()

    class FakeRolePermissionRepository:
        def __init__(self, session) -> None:
            self.session = session

        async def list_role_permission_slugs(self):
            return {"reviewer": {"access_home"}}

    class FakeUserService:
        async def get_user(self, *, user_id):
            raise AssertionError("get_user should not run when database policy denies directory access.")

    monkeypatch.setattr(user_routes, "RolePermissionRepository", FakeRolePermissionRepository)
    monkeypatch.setattr(user_routes, "build_user_service", lambda session: FakeUserService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.get(
        f"/api/v1/users/{user_id}",
        headers={
            "X-RAGPilot-Role": "reviewer",
            "X-RAGPilot-Actor-Id": str(uuid4()),
        },
    )

    app.dependency_overrides.clear()

    assert response.status_code == 403


def test_get_user_route_allows_admin_console_reviewer(monkeypatch) -> None:
    captured: dict[str, object] = {}
    user_id = uuid4()

    class FakeUserService:
        async def get_user(self, *, user_id):
            captured["user_id"] = user_id
            return build_user_directory_payload()

    monkeypatch.setattr(user_routes, "build_user_service", lambda session: FakeUserService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.get(
        f"/api/v1/users/{user_id}",
        headers={"X-RAGPilot-Role": "reviewer", "X-RAGPilot-Actor-Id": str(uuid4())},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert captured["user_id"] == user_id


def test_get_current_user_route_returns_directory_entry(monkeypatch) -> None:
    captured: dict[str, object] = {}
    user_id = uuid4()

    class FakeUserService:
        async def get_user(self, *, user_id):
            captured["user_id"] = user_id
            return build_user_directory_payload()

    monkeypatch.setattr(user_routes, "build_user_service", lambda session: FakeUserService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.get(
        "/api/v1/users/me",
        headers={
            "X-RAGPilot-Role": "operator",
            "X-RAGPilot-Actor-Id": str(user_id),
        },
    )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert captured["user_id"] == user_id


def test_get_current_user_route_requires_actor_headers(monkeypatch) -> None:
    class FakeUserService:
        async def get_user(self, *, user_id):
            raise AssertionError("get_user should not be called without actor headers.")

    monkeypatch.setattr(user_routes, "build_user_service", lambda session: FakeUserService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.get("/api/v1/users/me")

    app.dependency_overrides.clear()

    assert response.status_code == 401


def test_get_current_user_permissions_route_returns_capability_snapshot(monkeypatch) -> None:
    captured: dict[str, object] = {}
    user_id = uuid4()
    payload = build_user_directory_payload()

    class FakeUserService:
        async def get_user(self, *, user_id):
            captured["user_id"] = user_id
            return payload

        async def build_user_permissions_from_policy(self, user):
            captured["permission_user_email"] = user["email"]
            return {
                "user_id": user_id,
                "role": "operator",
                "has_active_membership": True,
                "active_tenant_ids": [payload["memberships"][0]["tenant_id"]],
                "capabilities": {
                    "access_chat": True,
                    "manage_admin_resources": False,
                    "retry_workflow_runs": True,
                },
            }

    monkeypatch.setattr(user_routes, "build_user_service", lambda session: FakeUserService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.get(
        "/api/v1/users/me/permissions",
        headers={
            "X-RAGPilot-Role": "operator",
            "X-RAGPilot-Actor-Id": str(user_id),
        },
    )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["role"] == "operator"
    assert response.json()["capabilities"]["access_chat"] is True
    assert response.json()["capabilities"]["manage_admin_resources"] is False
    assert captured["user_id"] == user_id
    assert captured["permission_user_email"] == "operator@ragpilot.local"


def test_get_current_user_permissions_route_requires_actor_headers(monkeypatch) -> None:
    class FakeUserService:
        async def get_user(self, *, user_id):
            raise AssertionError("get_user should not be called without actor headers.")

    monkeypatch.setattr(user_routes, "build_user_service", lambda session: FakeUserService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.get("/api/v1/users/me/permissions")

    app.dependency_overrides.clear()

    assert response.status_code == 401


def test_list_current_user_access_events_route_returns_scoped_events(monkeypatch) -> None:
    captured: dict[str, object] = {}
    payload = build_user_access_event_payload()
    user_id = uuid4()

    class FakeUserService:
        async def list_user_access_events(self, *, tenant_id=None, user_id=None, event_type=None, query=None, limit=20):
            captured["tenant_id"] = tenant_id
            captured["user_id"] = user_id
            captured["event_type"] = event_type
            captured["query"] = query
            captured["limit"] = limit
            return [payload]

    monkeypatch.setattr(user_routes, "build_user_service", lambda session: FakeUserService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.get(
        "/api/v1/users/me/access-events",
        params={"limit": 6, "event_type": "sign_in_succeeded", "query": "sign-in"},
        headers={
            "X-RAGPilot-Role": "operator",
            "X-RAGPilot-Actor-Id": str(user_id),
        },
    )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()[0]["event_type"] == payload["event_type"]
    assert captured["tenant_id"] is None
    assert captured["user_id"] == user_id
    assert captured["event_type"] == "sign_in_succeeded"
    assert captured["query"] == "sign-in"
    assert captured["limit"] == 6


def test_get_current_user_access_summary_route_returns_summary(monkeypatch) -> None:
    captured: dict[str, object] = {}
    payload = build_current_user_access_summary_payload()
    user_id = uuid4()

    class FakeUserService:
        async def get_user_access_summary(self, *, user_id=None):
            captured["user_id"] = user_id
            return payload

    monkeypatch.setattr(user_routes, "build_user_service", lambda session: FakeUserService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.get(
        "/api/v1/users/me/access-summary",
        headers={
            "X-RAGPilot-Role": "operator",
            "X-RAGPilot-Actor-Id": str(user_id),
        },
    )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["active_memberships"] == 2
    assert response.json()["latest_event_type"] == "session_revoked"
    assert captured["user_id"] == user_id


def test_list_current_user_sessions_route_returns_active_sessions(monkeypatch) -> None:
    captured: dict[str, object] = {}
    payload = build_active_session_payload()
    user_id = uuid4()
    session_id = uuid4()

    class FakeUserService:
        async def list_current_user_sessions(self, *, user_id=None, current_session_id=None):
            captured["user_id"] = user_id
            captured["current_session_id"] = current_session_id
            return [payload]

    async def override_request_actor():
        return request_actor.RequestActor(role="operator", user_id=user_id, session_id=session_id)

    monkeypatch.setattr(user_routes, "build_user_service", lambda session: FakeUserService())
    app.dependency_overrides[get_database_session] = override_database_session
    app.dependency_overrides[request_actor.get_request_actor] = override_request_actor

    client = TestClient(app)
    response = client.get("/api/v1/users/me/sessions")

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()[0]["authentication_mode"] == "directory"
    assert response.json()[0]["device_label"] == "Windows · Chrome"
    assert captured["user_id"] == user_id
    assert captured["current_session_id"] == session_id


def test_get_current_user_session_security_summary_route_returns_summary(monkeypatch) -> None:
    captured: dict[str, object] = {}
    payload = build_session_security_summary_payload()
    user_id = uuid4()
    session_id = uuid4()

    class FakeUserService:
        async def get_user_session_security_summary(self, *, user_id=None, current_session_id=None):
            captured["user_id"] = user_id
            captured["current_session_id"] = current_session_id
            return payload

    async def override_request_actor():
        return request_actor.RequestActor(role="operator", user_id=user_id, session_id=session_id)

    monkeypatch.setattr(user_routes, "build_user_service", lambda session: FakeUserService())
    app.dependency_overrides[get_database_session] = override_database_session
    app.dependency_overrides[request_actor.get_request_actor] = override_request_actor

    client = TestClient(app)
    response = client.get("/api/v1/users/me/session-security")

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["total_active_sessions"] == 3
    assert response.json()["distinct_device_count"] == 2
    assert captured["user_id"] == user_id
    assert captured["current_session_id"] == session_id


def test_revoke_current_user_session_route_revokes_owned_session(monkeypatch) -> None:
    captured: dict[str, object] = {}
    user_id = uuid4()
    session_id = uuid4()

    class FakeUserService:
        async def revoke_user_session_for_user(self, *, user_id=None, session_id=None, actor_user_id=None, reason=None):
            captured["user_id"] = user_id
            captured["session_id"] = session_id
            captured["actor_user_id"] = actor_user_id
            captured["reason"] = reason

    async def override_request_actor():
        return request_actor.RequestActor(role="operator", user_id=user_id, session_id=uuid4())

    monkeypatch.setattr(user_routes, "build_user_service", lambda session: FakeUserService())
    app.dependency_overrides[get_database_session] = override_database_session
    app.dependency_overrides[request_actor.get_request_actor] = override_request_actor

    client = TestClient(app)
    response = client.request("DELETE", f"/api/v1/users/me/sessions/{session_id}", json={"reason": "Revoked from Settings"})

    app.dependency_overrides.clear()

    assert response.status_code == 204
    assert captured["user_id"] == user_id
    assert captured["session_id"] == session_id
    assert captured["actor_user_id"] == user_id
    assert captured["reason"] == "Revoked from Settings"


def test_revoke_other_current_user_sessions_route_revokes_non_current_sessions(monkeypatch) -> None:
    captured: dict[str, object] = {}
    user_id = uuid4()
    session_id = uuid4()
    payload = build_session_bulk_revocation_payload()
    payload["user_id"] = str(user_id)

    class FakeUserService:
        async def revoke_other_sessions_for_current_user(
            self,
            *,
            user_id=None,
            current_session_id=None,
            actor_user_id=None,
            reason=None,
        ):
            captured["user_id"] = user_id
            captured["current_session_id"] = current_session_id
            captured["actor_user_id"] = actor_user_id
            captured["reason"] = reason
            return payload

    async def override_request_actor():
        return request_actor.RequestActor(role="operator", user_id=user_id, session_id=session_id)

    monkeypatch.setattr(user_routes, "build_user_service", lambda session: FakeUserService())
    app.dependency_overrides[get_database_session] = override_database_session
    app.dependency_overrides[request_actor.get_request_actor] = override_request_actor

    client = TestClient(app)
    response = client.request("POST", "/api/v1/users/me/sessions/revoke-others", json={"reason": "Closed other devices"})

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["revoked_session_count"] == 2
    assert captured["user_id"] == user_id
    assert captured["current_session_id"] == session_id
    assert captured["actor_user_id"] == user_id
    assert captured["reason"] == "Closed other devices"


def test_revoke_other_current_user_sessions_route_requires_bearer_session(monkeypatch) -> None:
    class FakeUserService:
        async def revoke_other_sessions_for_current_user(self, **kwargs):
            raise AssertionError("revoke_other_sessions_for_current_user should not run without a bearer session.")

    async def override_request_actor():
        return request_actor.RequestActor(role="operator", user_id=uuid4(), session_id=None)

    monkeypatch.setattr(user_routes, "build_user_service", lambda session: FakeUserService())
    app.dependency_overrides[get_database_session] = override_database_session
    app.dependency_overrides[request_actor.get_request_actor] = override_request_actor

    client = TestClient(app)
    response = client.post("/api/v1/users/me/sessions/revoke-others")

    app.dependency_overrides.clear()

    assert response.status_code == 401


def test_list_user_sessions_route_returns_active_sessions(monkeypatch) -> None:
    payload = build_active_session_payload()
    target_user_id = uuid4()

    class FakeUserService:
        async def list_current_user_sessions(self, *, user_id=None, current_session_id=None):
            return [payload]

    monkeypatch.setattr(user_routes, "build_user_service", lambda session: FakeUserService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.get(
        f"/api/v1/users/{target_user_id}/sessions",
        headers={"X-RAGPilot-Role": "super_admin", "X-RAGPilot-Actor-Id": str(uuid4())},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()[0]["authentication_mode"] == "directory"


def test_get_user_session_security_summary_route_returns_summary(monkeypatch) -> None:
    captured: dict[str, object] = {}
    payload = build_session_security_summary_payload()
    target_user_id = uuid4()

    class FakeUserService:
        async def get_user_session_security_summary(self, *, user_id=None, current_session_id=None):
            captured["user_id"] = user_id
            captured["current_session_id"] = current_session_id
            return payload

    monkeypatch.setattr(user_routes, "build_user_service", lambda session: FakeUserService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.get(
        f"/api/v1/users/{target_user_id}/session-security",
        headers={"X-RAGPilot-Role": "super_admin", "X-RAGPilot-Actor-Id": str(uuid4())},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["other_active_sessions"] == 2
    assert captured["user_id"] == target_user_id
    assert captured["current_session_id"] is None


def test_revoke_user_session_route_revokes_target_session(monkeypatch) -> None:
    captured: dict[str, object] = {}
    target_user_id = uuid4()
    session_id = uuid4()
    actor_user_id = uuid4()

    class FakeUserService:
        async def revoke_user_session_for_user(self, *, user_id=None, session_id=None, actor_user_id=None, reason=None):
            captured["user_id"] = user_id
            captured["session_id"] = session_id
            captured["actor_user_id"] = actor_user_id
            captured["reason"] = reason

    async def override_request_actor():
        return request_actor.RequestActor(role="super_admin", user_id=actor_user_id, session_id=uuid4())

    monkeypatch.setattr(user_routes, "build_user_service", lambda session: FakeUserService())
    app.dependency_overrides[get_database_session] = override_database_session
    app.dependency_overrides[request_actor.get_request_actor] = override_request_actor

    client = TestClient(app)
    response = client.request(
        "DELETE",
        f"/api/v1/users/{target_user_id}/sessions/{session_id}",
        json={"reason": "Revoked from Admin Console"},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 204
    assert captured["user_id"] == target_user_id
    assert captured["session_id"] == session_id
    assert captured["actor_user_id"] == actor_user_id
    assert captured["reason"] == "Revoked from Admin Console"


def test_revoke_all_user_sessions_route_revokes_target_member_sessions(monkeypatch) -> None:
    captured: dict[str, object] = {}
    target_user_id = uuid4()
    actor_user_id = uuid4()
    payload = {
        "user_id": str(target_user_id),
        "revoked_session_count": 3,
        "remaining_active_sessions": 0,
        "preserved_current_session": False,
        "revocation_scope": "all_sessions",
    }

    class FakeUserService:
        async def revoke_all_sessions_for_user(self, *, user_id=None, actor_user_id=None, reason=None):
            captured["user_id"] = user_id
            captured["actor_user_id"] = actor_user_id
            captured["reason"] = reason
            return payload

    async def override_request_actor():
        return request_actor.RequestActor(role="super_admin", user_id=actor_user_id, session_id=uuid4())

    monkeypatch.setattr(user_routes, "build_user_service", lambda session: FakeUserService())
    app.dependency_overrides[get_database_session] = override_database_session
    app.dependency_overrides[request_actor.get_request_actor] = override_request_actor

    client = TestClient(app)
    response = client.request(
        "POST",
        f"/api/v1/users/{target_user_id}/sessions/revoke-all",
        json={"reason": "Security cleanup"},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["revoked_session_count"] == 3
    assert captured["user_id"] == target_user_id
    assert captured["actor_user_id"] == actor_user_id
    assert captured["reason"] == "Security cleanup"


def test_list_user_sessions_route_uses_database_policy_when_seeded(monkeypatch) -> None:
    class FakeRolePermissionRepository:
        def __init__(self, session) -> None:
            self.session = session

        async def list_role_permission_slugs(self):
            return {"super_admin": {"access_admin_console"}}

    class FakeUserService:
        async def list_current_user_sessions(self, **kwargs):
            raise AssertionError("list_current_user_sessions should not run when database policy denies member management.")

    monkeypatch.setattr(user_routes, "RolePermissionRepository", FakeRolePermissionRepository)
    monkeypatch.setattr(user_routes, "build_user_service", lambda session: FakeUserService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.get(
        f"/api/v1/users/{uuid4()}/sessions",
        headers={"X-RAGPilot-Role": "super_admin", "X-RAGPilot-Actor-Id": str(uuid4())},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 403


def test_revoke_user_session_route_uses_database_policy_when_seeded(monkeypatch) -> None:
    class FakeRolePermissionRepository:
        def __init__(self, session) -> None:
            self.session = session

        async def list_role_permission_slugs(self):
            return {"super_admin": {"access_admin_console"}}

    class FakeUserService:
        async def revoke_user_session_for_user(self, **kwargs):
            raise AssertionError("revoke_user_session_for_user should not run when database policy denies member management.")

    monkeypatch.setattr(user_routes, "RolePermissionRepository", FakeRolePermissionRepository)
    monkeypatch.setattr(user_routes, "build_user_service", lambda session: FakeUserService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.delete(
        f"/api/v1/users/{uuid4()}/sessions/{uuid4()}",
        headers={"X-RAGPilot-Role": "super_admin", "X-RAGPilot-Actor-Id": str(uuid4())},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 403


def test_revoke_all_user_sessions_route_uses_database_policy_when_seeded(monkeypatch) -> None:
    class FakeRolePermissionRepository:
        def __init__(self, session) -> None:
            self.session = session

        async def list_role_permission_slugs(self):
            return {"super_admin": {"access_admin_console"}}

    class FakeUserService:
        async def revoke_all_sessions_for_user(self, **kwargs):
            raise AssertionError("revoke_all_sessions_for_user should not run when database policy denies member management.")

    monkeypatch.setattr(user_routes, "RolePermissionRepository", FakeRolePermissionRepository)
    monkeypatch.setattr(user_routes, "build_user_service", lambda session: FakeUserService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.post(
        f"/api/v1/users/{uuid4()}/sessions/revoke-all",
        headers={"X-RAGPilot-Role": "super_admin", "X-RAGPilot-Actor-Id": str(uuid4())},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 403


def test_list_current_user_access_events_route_requires_actor_headers(monkeypatch) -> None:
    class FakeUserService:
        async def list_user_access_events(self, **kwargs):
            raise AssertionError("list_user_access_events should not be called without actor headers.")

    monkeypatch.setattr(user_routes, "build_user_service", lambda session: FakeUserService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.get("/api/v1/users/me/access-events")

    app.dependency_overrides.clear()

    assert response.status_code == 401


def test_get_current_user_access_summary_route_requires_actor_headers(monkeypatch) -> None:
    class FakeUserService:
        async def get_user_access_summary(self, **kwargs):
            raise AssertionError("get_user_access_summary should not be called without actor headers.")

    monkeypatch.setattr(user_routes, "build_user_service", lambda session: FakeUserService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.get("/api/v1/users/me/access-summary")

    app.dependency_overrides.clear()

    assert response.status_code == 401


def test_change_current_user_password_route_forwards_request(monkeypatch) -> None:
    captured: dict[str, object] = {}
    user_id = uuid4()
    session_id = uuid4()

    class FakeUserService:
        async def change_current_user_password(self, *, user_id=None, request=None, actor_user_id=None, current_session_id=None):
            captured["user_id"] = user_id
            captured["request"] = request
            captured["actor_user_id"] = actor_user_id
            captured["current_session_id"] = current_session_id
            return build_user_directory_payload()

    async def override_request_actor():
        return request_actor.RequestActor(role="operator", user_id=user_id, session_id=session_id)

    monkeypatch.setattr(user_routes, "build_user_service", lambda session: FakeUserService())
    app.dependency_overrides[get_database_session] = override_database_session
    app.dependency_overrides[request_actor.get_request_actor] = override_request_actor

    client = TestClient(app)
    response = client.post(
        "/api/v1/users/me/change-password",
        json={
            "current_password": "CurrentPass123",
            "new_password": "UpdatedPass123",
        },
    )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert captured["user_id"] == user_id
    assert captured["actor_user_id"] == user_id
    assert captured["current_session_id"] == session_id
    assert captured["request"].current_password == "CurrentPass123"
    assert captured["request"].new_password == "UpdatedPass123"


def test_get_user_access_summary_route_returns_target_summary(monkeypatch) -> None:
    captured: dict[str, object] = {}
    payload = build_current_user_access_summary_payload()
    target_user_id = uuid4()

    class FakeUserService:
        async def get_user_access_summary(self, *, user_id=None):
            captured["user_id"] = user_id
            return payload

    monkeypatch.setattr(user_routes, "build_user_service", lambda session: FakeUserService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.get(
        f"/api/v1/users/{target_user_id}/access-summary",
        headers={"X-RAGPilot-Role": "super_admin", "X-RAGPilot-Actor-Id": str(uuid4())},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["active_sessions"] == 4
    assert captured["user_id"] == target_user_id


def test_list_user_member_access_events_route_returns_target_events(monkeypatch) -> None:
    captured: dict[str, object] = {}
    payload = build_user_access_event_payload()
    target_user_id = uuid4()

    class FakeUserService:
        async def list_user_access_events(self, *, tenant_id=None, user_id=None, event_type=None, query=None, limit=20):
            captured["tenant_id"] = tenant_id
            captured["user_id"] = user_id
            captured["event_type"] = event_type
            captured["query"] = query
            captured["limit"] = limit
            return [payload]

    monkeypatch.setattr(user_routes, "build_user_service", lambda session: FakeUserService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.get(
        f"/api/v1/users/{target_user_id}/access-events",
        params={"limit": 8, "event_type": "session_revoked", "query": "revoked"},
        headers={"X-RAGPilot-Role": "super_admin", "X-RAGPilot-Actor-Id": str(uuid4())},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()[0]["event_type"] == payload["event_type"]
    assert captured["tenant_id"] is None
    assert captured["user_id"] == target_user_id
    assert captured["event_type"] == "session_revoked"
    assert captured["query"] == "revoked"
    assert captured["limit"] == 8


def test_get_user_access_summary_route_uses_database_policy_when_seeded(monkeypatch) -> None:
    class FakeRolePermissionRepository:
        def __init__(self, session) -> None:
            self.session = session

        async def list_role_permission_slugs(self):
            return {"super_admin": {"access_admin_console"}}

    class FakeUserService:
        async def get_user_access_summary(self, **kwargs):
            raise AssertionError("get_user_access_summary should not run when database policy denies member management.")

    monkeypatch.setattr(user_routes, "RolePermissionRepository", FakeRolePermissionRepository)
    monkeypatch.setattr(user_routes, "build_user_service", lambda session: FakeUserService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.get(
        f"/api/v1/users/{uuid4()}/access-summary",
        headers={"X-RAGPilot-Role": "super_admin", "X-RAGPilot-Actor-Id": str(uuid4())},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 403


def test_list_user_member_access_events_route_uses_database_policy_when_seeded(monkeypatch) -> None:
    class FakeRolePermissionRepository:
        def __init__(self, session) -> None:
            self.session = session

        async def list_role_permission_slugs(self):
            return {"super_admin": {"access_admin_console"}}

    class FakeUserService:
        async def list_user_access_events(self, **kwargs):
            raise AssertionError("list_user_access_events should not run when database policy denies member management.")

    monkeypatch.setattr(user_routes, "RolePermissionRepository", FakeRolePermissionRepository)
    monkeypatch.setattr(user_routes, "build_user_service", lambda session: FakeUserService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.get(
        f"/api/v1/users/{uuid4()}/access-events",
        headers={"X-RAGPilot-Role": "super_admin", "X-RAGPilot-Actor-Id": str(uuid4())},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 403


def test_update_user_route_returns_directory_entry(monkeypatch) -> None:
    captured: dict[str, object] = {}
    user_id = uuid4()

    class FakeUserService:
        async def update_user(self, *, user_id, request, actor_user_id=None):
            captured.update(
                {
                    "user_id": user_id,
                    "email": request.email,
                    "display_name": request.display_name,
                    "is_active": request.is_active,
                    "role": request.role,
                    "actor_user_id": actor_user_id,
                }
            )
            return build_user_directory_payload()

    monkeypatch.setattr(user_routes, "build_user_service", lambda session: FakeUserService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.patch(
        f"/api/v1/users/{user_id}",
        json={
            "email": "updated@ragpilot.local",
            "display_name": "Updated Operator",
            "is_active": True,
        },
        headers={
            "X-RAGPilot-Role": "operator",
            "X-RAGPilot-Actor-Id": str(user_id),
        },
    )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert captured["user_id"] == user_id
    assert captured["email"] == "updated@ragpilot.local"
    assert captured["display_name"] == "Updated Operator"
    assert captured["role"] is None
    assert captured["actor_user_id"] == user_id


def test_update_user_route_rejects_password_field(monkeypatch) -> None:
    user_id = uuid4()

    class FakeUserService:
        async def update_user(self, *, user_id, request, actor_user_id=None):
            raise AssertionError("update_user should not be called when password is submitted through the generic profile route.")

    monkeypatch.setattr(user_routes, "build_user_service", lambda session: FakeUserService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.patch(
        f"/api/v1/users/{user_id}",
        json={
            "email": "updated@ragpilot.local",
            "display_name": "Updated Operator",
            "is_active": True,
            "password": "BypassPass123",
        },
        headers={
            "X-RAGPilot-Role": "operator",
            "X-RAGPilot-Actor-Id": str(user_id),
        },
    )

    app.dependency_overrides.clear()

    assert response.status_code == 422


def test_reset_user_password_route_forwards_request(monkeypatch) -> None:
    captured: dict[str, object] = {}
    user_id = uuid4()
    actor_user_id = uuid4()

    class FakeUserService:
        async def reset_user_password(self, *, user_id=None, request=None, actor_user_id=None):
            captured["user_id"] = user_id
            captured["request"] = request
            captured["actor_user_id"] = actor_user_id
            return build_user_directory_payload()

    async def override_request_actor():
        return request_actor.RequestActor(role="super_admin", user_id=actor_user_id, session_id=uuid4())

    monkeypatch.setattr(user_routes, "build_user_service", lambda session: FakeUserService())
    app.dependency_overrides[get_database_session] = override_database_session
    app.dependency_overrides[request_actor.get_request_actor] = override_request_actor

    client = TestClient(app)
    response = client.post(
        f"/api/v1/users/{user_id}/reset-password",
        json={
            "new_password": "ResetPass123",
            "reason": "Credential rotation",
        },
    )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert captured["user_id"] == user_id
    assert captured["actor_user_id"] == actor_user_id
    assert captured["request"].new_password == "ResetPass123"
    assert captured["request"].reason == "Credential rotation"


def test_delete_user_membership_route_returns_directory_entry(monkeypatch) -> None:
    captured: dict[str, object] = {}
    user_id = uuid4()
    membership_id = uuid4()
    actor_user_id = uuid4()

    class FakeUserService:
        async def delete_user_membership(self, *, user_id, membership_id, actor_user_id=None):
            captured.update(
                {
                    "user_id": user_id,
                    "membership_id": membership_id,
                    "actor_user_id": actor_user_id,
                }
            )
            return build_user_directory_payload()

    monkeypatch.setattr(user_routes, "build_user_service", lambda session: FakeUserService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.delete(
        f"/api/v1/users/{user_id}/memberships/{membership_id}",
        headers={"X-RAGPilot-Role": "super_admin", "X-RAGPilot-Actor-Id": str(actor_user_id)},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert captured["user_id"] == user_id
    assert captured["membership_id"] == membership_id
    assert captured["actor_user_id"] == actor_user_id
    assert response.json()["email"] == "operator@ragpilot.local"


def test_create_user_membership_route_rejects_extra_fields(monkeypatch) -> None:
    class FakeUserService:
        async def create_user_membership(self, **kwargs):
            raise AssertionError("create_user_membership should not run when request validation fails.")

    monkeypatch.setattr(user_routes, "build_user_service", lambda session: FakeUserService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.post(
        f"/api/v1/users/{uuid4()}/memberships",
        json={
            "tenant_id": str(uuid4()),
            "membership_status": "active",
            "unexpected": "field",
        },
        headers={
            "X-RAGPilot-Role": "super_admin",
            "X-RAGPilot-Actor-Id": str(uuid4()),
        },
    )

    app.dependency_overrides.clear()

    assert response.status_code == 422


def test_update_user_route_rejects_non_self_non_admin(monkeypatch) -> None:
    user_id = uuid4()

    class FakeUserService:
        async def update_user(self, *, user_id, request, actor_user_id=None):
            raise AssertionError("update_user should not be called for an unauthorized actor.")

    monkeypatch.setattr(user_routes, "build_user_service", lambda session: FakeUserService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.patch(
        f"/api/v1/users/{user_id}",
        json={
            "email": "updated@ragpilot.local",
            "display_name": "Updated Operator",
            "is_active": True,
        },
        headers={
            "X-RAGPilot-Role": "reviewer",
            "X-RAGPilot-Actor-Id": str(uuid4()),
        },
    )

    app.dependency_overrides.clear()

    assert response.status_code == 403


def test_update_user_route_rejects_role_change_for_non_admin(monkeypatch) -> None:
    user_id = uuid4()

    class FakeUserService:
        async def update_user(self, *, user_id, request, actor_user_id=None):
            raise AssertionError("update_user should not be called for non-admin role changes.")

    monkeypatch.setattr(user_routes, "build_user_service", lambda session: FakeUserService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.patch(
        f"/api/v1/users/{user_id}",
        json={
            "email": "updated@ragpilot.local",
            "display_name": "Updated Operator",
            "is_active": True,
            "role": "reviewer",
        },
        headers={
            "X-RAGPilot-Role": "operator",
            "X-RAGPilot-Actor-Id": str(user_id),
        },
    )

    app.dependency_overrides.clear()

    assert response.status_code == 403


def test_update_user_route_rejects_self_service_activity_change(monkeypatch) -> None:
    user_id = uuid4()

    class FakeUserService:
        async def get_user(self, *, user_id):
            payload = build_user_directory_payload()
            payload["id"] = str(user_id)
            payload["is_active"] = True
            return payload

        async def update_user(self, *, user_id, request, actor_user_id=None):
            raise AssertionError("update_user should not be called when self-service tries to change account activity.")

    monkeypatch.setattr(user_routes, "build_user_service", lambda session: FakeUserService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.patch(
        f"/api/v1/users/{user_id}",
        json={
            "email": "updated@ragpilot.local",
            "display_name": "Updated Operator",
            "is_active": False,
        },
        headers={
            "X-RAGPilot-Role": "operator",
            "X-RAGPilot-Actor-Id": str(user_id),
        },
    )

    app.dependency_overrides.clear()

    assert response.status_code == 403
    assert response.json()["detail"] == "Self-service profile updates cannot change account activity."


def test_create_user_route_rejects_reviewer_role(monkeypatch) -> None:
    class FakeUserService:
        async def create_user(self, request):
            raise AssertionError("create_user should not be called for reviewer role.")

    monkeypatch.setattr(user_routes, "build_user_service", lambda session: FakeUserService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.post(
        "/api/v1/users",
        json={
            "email": "operator@ragpilot.local",
            "display_name": "RAGPilot Operator",
            "membership_status": "active",
        },
        headers={"X-RAGPilot-Role": "reviewer", "X-RAGPilot-Actor-Id": str(uuid4())},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 403
