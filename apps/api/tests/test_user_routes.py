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
        "display_name": "RagPilot Operator",
        "is_active": True,
        "role": "operator",
        "last_signed_in_at": now,
        "memberships": [
            {
                "id": str(uuid4()),
                "tenant_id": str(uuid4()),
                "tenant_name": "RagPilot Demo",
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
        "user_display_name": "RagPilot Operator",
        "tenant_name": "RagPilot Demo",
        "event_type": "invitation_issued",
        "detail_json": {"membership_status": "invited", "invitation_issue_count": 2},
        "created_at": now,
    }


def build_authenticated_user_payload() -> dict[str, object]:
    return {
        "user": build_user_directory_payload(),
        "session": {
            "session_token": "rp_sess_test_token",
            "expires_at": datetime.now(timezone.utc).isoformat(),
        },
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
        headers={"X-RagPilot-Role": "super_admin"},
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
        headers={"X-RagPilot-Role": "super_admin"},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 403


def test_create_user_route_returns_created_directory_entry(monkeypatch) -> None:
    captured: dict[str, object] = {}
    payload = build_user_directory_payload()

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
            "display_name": "RagPilot Operator",
            "role": "reviewer",
            "tenant_id": payload["memberships"][0]["tenant_id"],
            "membership_status": "active",
        },
        headers={"X-RagPilot-Role": "super_admin"},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 201
    assert response.json()["email"] == "operator@ragpilot.local"
    assert captured["request"].display_name == "RagPilot Operator"
    assert captured["request"].role == "reviewer"
    assert captured["actor_user_id"] is None


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
            "display_name": "RagPilot Operator",
            "role": "reviewer",
            "membership_status": "active",
        },
        headers={"X-RagPilot-Role": "super_admin"},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 403


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
            "display_name": "RagPilot Operator",
        },
    )

    app.dependency_overrides.clear()

    assert response.status_code == 201
    assert response.json()["email"] == "operator@ragpilot.local"
    assert captured["request"].display_name == "RagPilot Operator"


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


def test_login_user_route_returns_directory_entry(monkeypatch) -> None:
    captured: dict[str, object] = {}
    payload = build_authenticated_user_payload()

    class FakeUserService:
        async def login_user(self, request):
            captured["request"] = request
            return payload

    monkeypatch.setattr(user_routes, "build_user_service", lambda session: FakeUserService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.post(
        "/api/v1/users/login",
        json={
            "email": "operator@ragpilot.local",
            "display_name": "RagPilot Operator",
        },
    )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["user"]["last_signed_in_at"] is not None
    assert response.json()["session"]["session_token"] == "rp_sess_test_token"
    assert captured["request"].email == "operator@ragpilot.local"


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


def test_user_access_event_list_route_returns_audit_events(monkeypatch) -> None:
    captured: dict[str, object] = {}
    payload = build_user_access_event_payload()

    class FakeUserService:
        async def list_user_access_events(self, *, tenant_id=None, user_id=None, event_type=None, limit=20):
            captured["tenant_id"] = tenant_id
            captured["user_id"] = user_id
            captured["event_type"] = event_type
            captured["limit"] = limit
            return [payload]

    monkeypatch.setattr(user_routes, "build_user_service", lambda session: FakeUserService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.get(
        "/api/v1/users/audit-events",
        params={"limit": 10, "event_type": "invitation_issued"},
        headers={"X-RagPilot-Role": "super_admin"},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()[0]["event_type"] == "invitation_issued"
    assert captured["event_type"] == "invitation_issued"
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
        headers={"X-RagPilot-Role": "reviewer"},
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
        headers={"X-RagPilot-Role": "super_admin"},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 403


def test_activate_user_invitations_route_returns_directory_entry(monkeypatch) -> None:
    captured: dict[str, object] = {}
    payload = build_authenticated_user_payload()

    class FakeUserService:
        async def activate_user_invitations(self, request):
            captured["request"] = request
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
    assert response.json()["user"]["email"] == "operator@ragpilot.local"
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
            membership = SimpleNamespace(membership=SimpleNamespace(membership_status="active"))
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
            membership = SimpleNamespace(membership=SimpleNamespace(membership_status="active"))
            return SimpleNamespace(
                user=SimpleNamespace(id=user_id, role="operator", is_active=True),
                memberships=[membership],
            )

    class FakeUserService:
        async def revoke_current_session(self, *, user_id, session_id):
            captured["user_id"] = user_id
            captured["session_id"] = session_id

    monkeypatch.setattr(request_actor, "UserSessionRepository", FakeUserSessionRepository)
    monkeypatch.setattr(request_actor, "UserRepository", FakeUserRepository)
    monkeypatch.setattr(user_routes, "build_user_service", lambda session: FakeUserService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.post(
        "/api/v1/users/me/sign-out",
        headers={"Authorization": "Bearer rp_sess_test_token"},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 204
    assert captured == {
        "user_id": user_id,
        "session_id": session_id,
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
        headers={"X-RagPilot-Role": "operator", "X-RagPilot-Actor-Id": str(uuid4())},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 401
    assert response.json()["detail"] == "Current bearer session is required to sign out."


def test_issue_user_membership_invitation_route_returns_token(monkeypatch) -> None:
    captured: dict[str, object] = {}
    user_id = uuid4()
    membership_id = uuid4()
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
                "tenant_name": "RagPilot Demo",
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
        headers={"X-RagPilot-Role": "super_admin"},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["invitation_token"] == "RP-AB12CD34"
    assert captured["user_id"] == user_id
    assert captured["membership_id"] == membership_id
    assert captured["reason"] == "Issued from admin console"
    assert captured["actor_user_id"] is None


def test_revoke_user_membership_invitation_route_returns_directory_entry(monkeypatch) -> None:
    captured: dict[str, object] = {}
    user_id = uuid4()
    membership_id = uuid4()

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
        headers={"X-RagPilot-Role": "super_admin"},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert captured["user_id"] == user_id
    assert captured["membership_id"] == membership_id
    assert captured["reason"] == "Invite replaced by direct activation"


def test_update_user_membership_route_returns_directory_entry(monkeypatch) -> None:
    captured: dict[str, object] = {}
    user_id = uuid4()
    membership_id = uuid4()

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
        headers={"X-RagPilot-Role": "super_admin"},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert captured["user_id"] == user_id
    assert captured["membership_id"] == membership_id
    assert captured["membership_status"] == "suspended"
    assert captured["reason"] == "Manual governance hold"
    assert captured["actor_user_id"] is None


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
        headers={"X-RagPilot-Role": "operator"},
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
            "X-RagPilot-Role": "operator",
            "X-RagPilot-Actor-Id": str(user_id),
        },
    )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert captured["user_id"] == user_id
    assert response.json()["email"] == "operator@ragpilot.local"


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
            "X-RagPilot-Role": "operator",
            "X-RagPilot-Actor-Id": str(uuid4()),
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
            "X-RagPilot-Role": "reviewer",
            "X-RagPilot-Actor-Id": str(uuid4()),
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
        headers={"X-RagPilot-Role": "reviewer"},
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
            "X-RagPilot-Role": "operator",
            "X-RagPilot-Actor-Id": str(user_id),
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
            "X-RagPilot-Role": "operator",
            "X-RagPilot-Actor-Id": str(user_id),
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
        async def list_user_access_events(self, *, tenant_id=None, user_id=None, event_type=None, limit=20):
            captured["tenant_id"] = tenant_id
            captured["user_id"] = user_id
            captured["event_type"] = event_type
            captured["limit"] = limit
            return [payload]

    monkeypatch.setattr(user_routes, "build_user_service", lambda session: FakeUserService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.get(
        "/api/v1/users/me/access-events",
        params={"limit": 6, "event_type": "sign_in_succeeded"},
        headers={
            "X-RagPilot-Role": "operator",
            "X-RagPilot-Actor-Id": str(user_id),
        },
    )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()[0]["event_type"] == payload["event_type"]
    assert captured["tenant_id"] is None
    assert captured["user_id"] == user_id
    assert captured["event_type"] == "sign_in_succeeded"
    assert captured["limit"] == 6


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


def test_update_user_route_returns_directory_entry(monkeypatch) -> None:
    captured: dict[str, object] = {}
    user_id = uuid4()

    class FakeUserService:
        async def update_user(self, *, user_id, request):
            captured.update(
                {
                    "user_id": user_id,
                    "email": request.email,
                    "display_name": request.display_name,
                    "is_active": request.is_active,
                    "role": request.role,
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
            "X-RagPilot-Role": "operator",
            "X-RagPilot-Actor-Id": str(user_id),
        },
    )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert captured["user_id"] == user_id
    assert captured["email"] == "updated@ragpilot.local"
    assert captured["display_name"] == "Updated Operator"
    assert captured["role"] is None


def test_delete_user_membership_route_returns_directory_entry(monkeypatch) -> None:
    captured: dict[str, object] = {}
    user_id = uuid4()
    membership_id = uuid4()

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
        headers={"X-RagPilot-Role": "super_admin"},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert captured["user_id"] == user_id
    assert captured["membership_id"] == membership_id
    assert captured["actor_user_id"] is None
    assert response.json()["email"] == "operator@ragpilot.local"


def test_update_user_route_rejects_non_self_non_admin(monkeypatch) -> None:
    user_id = uuid4()

    class FakeUserService:
        async def update_user(self, *, user_id, request):
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
            "X-RagPilot-Role": "reviewer",
            "X-RagPilot-Actor-Id": str(uuid4()),
        },
    )

    app.dependency_overrides.clear()

    assert response.status_code == 403


def test_update_user_route_rejects_role_change_for_non_admin(monkeypatch) -> None:
    user_id = uuid4()

    class FakeUserService:
        async def update_user(self, *, user_id, request):
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
            "X-RagPilot-Role": "operator",
            "X-RagPilot-Actor-Id": str(user_id),
        },
    )

    app.dependency_overrides.clear()

    assert response.status_code == 403


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
            "display_name": "RagPilot Operator",
            "membership_status": "active",
        },
        headers={"X-RagPilot-Role": "reviewer"},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 403
