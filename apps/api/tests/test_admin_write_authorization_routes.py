from uuid import uuid4

from fastapi.testclient import TestClient

from ragpilot_api.infrastructure.database.session import get_database_session
from ragpilot_api.main import app
from ragpilot_api.presentation.http.v1 import knowledge_base_routes, tenant_routes, workspace_routes


async def override_database_session():
    yield None


def test_tenant_create_route_rejects_reviewer_role(monkeypatch) -> None:
    class FakeTenantService:
        async def create_tenant(self, request):
            raise AssertionError("create_tenant should not be called for reviewer role.")

    monkeypatch.setattr(tenant_routes, "build_tenant_service", lambda session: FakeTenantService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.post(
        "/api/v1/tenants",
        json={"name": "RAGPilot Demo", "slug": "ragpilot-demo"},
        headers={"X-RAGPilot-Role": "reviewer", "X-RAGPilot-Actor-Id": str(uuid4())},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 403


def test_tenant_create_route_uses_database_policy_when_seeded(monkeypatch) -> None:
    class FakeRolePermissionRepository:
        def __init__(self, session) -> None:
            self.session = session

        async def list_role_permission_slugs(self):
            return {"super_admin": {"access_admin_console"}}

    class FakeTenantService:
        async def create_tenant(self, request):
            raise AssertionError("create_tenant should not be called when database policy denies admin-resource management.")

    monkeypatch.setattr(tenant_routes, "RolePermissionRepository", FakeRolePermissionRepository)
    monkeypatch.setattr(tenant_routes, "build_tenant_service", lambda session: FakeTenantService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.post(
        "/api/v1/tenants",
        json={"name": "RAGPilot Demo", "slug": "ragpilot-demo"},
        headers={"X-RAGPilot-Role": "super_admin", "X-RAGPilot-Actor-Id": str(uuid4())},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 403


def test_tenant_update_route_rejects_missing_actor_role(monkeypatch) -> None:
    class FakeTenantService:
        async def update_tenant(self, *, tenant_id, request):
            raise AssertionError("update_tenant should not be called without an actor role.")

    monkeypatch.setattr(tenant_routes, "build_tenant_service", lambda session: FakeTenantService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.patch(
        f"/api/v1/tenants/{uuid4()}",
        json={"name": "RAGPilot Demo", "slug": "ragpilot-demo"},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 401


def test_workspace_create_route_rejects_operator_role(monkeypatch) -> None:
    class FakeWorkspaceService:
        async def create_workspace(self, request):
            raise AssertionError("create_workspace should not be called for operator role.")

    tenant_id = uuid4()
    monkeypatch.setattr(workspace_routes, "build_workspace_service", lambda session: FakeWorkspaceService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.post(
        "/api/v1/workspaces",
        json={
            "tenant_id": str(tenant_id),
            "name": "RAGPilot Operations",
            "slug": "ragpilot-operations",
            "description": "Operator workspace",
        },
        headers={"X-RAGPilot-Role": "operator", "X-RAGPilot-Actor-Id": str(uuid4())},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 403


def test_workspace_update_route_rejects_operator_role(monkeypatch) -> None:
    class FakeWorkspaceService:
        async def update_workspace(self, *, workspace_id, tenant_id, request):
            raise AssertionError("update_workspace should not be called for operator role.")

    monkeypatch.setattr(workspace_routes, "build_workspace_service", lambda session: FakeWorkspaceService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.patch(
        f"/api/v1/workspaces/{uuid4()}",
        params={"tenant_id": str(uuid4())},
        json={
            "name": "RAGPilot Operations",
            "slug": "ragpilot-operations",
            "description": "Operator workspace",
        },
        headers={"X-RAGPilot-Role": "operator", "X-RAGPilot-Actor-Id": str(uuid4())},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 403


def test_workspace_lifecycle_route_rejects_reviewer_role(monkeypatch) -> None:
    class FakeWorkspaceService:
        async def set_workspace_archive_state(self, *, workspace_id, tenant_id, request):
            raise AssertionError("set_workspace_archive_state should not be called for reviewer role.")

    monkeypatch.setattr(workspace_routes, "build_workspace_service", lambda session: FakeWorkspaceService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.post(
        f"/api/v1/workspaces/{uuid4()}/lifecycle",
        params={"tenant_id": str(uuid4())},
        json={"is_archived": True},
        headers={"X-RAGPilot-Role": "reviewer", "X-RAGPilot-Actor-Id": str(uuid4())},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 403


def test_workspace_lifecycle_route_uses_database_policy_when_seeded(monkeypatch) -> None:
    class FakeRolePermissionRepository:
        def __init__(self, session) -> None:
            self.session = session

        async def list_role_permission_slugs(self):
            return {"super_admin": {"review_runtime_governance"}}

    class FakeWorkspaceService:
        async def set_workspace_archive_state(self, *, workspace_id, tenant_id, request):
            raise AssertionError("set_workspace_archive_state should not be called when database policy denies admin-resource management.")

    monkeypatch.setattr(workspace_routes, "RolePermissionRepository", FakeRolePermissionRepository)
    monkeypatch.setattr(workspace_routes, "build_workspace_service", lambda session: FakeWorkspaceService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.post(
        f"/api/v1/workspaces/{uuid4()}/lifecycle",
        params={"tenant_id": str(uuid4())},
        json={"is_archived": True},
        headers={"X-RAGPilot-Role": "super_admin", "X-RAGPilot-Actor-Id": str(uuid4())},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 403


def test_knowledge_base_create_route_rejects_operator_role(monkeypatch) -> None:
    class FakeKnowledgeBaseService:
        async def create_knowledge_base(self, request):
            raise AssertionError("create_knowledge_base should not be called for operator role.")

    tenant_id = uuid4()
    workspace_id = uuid4()
    monkeypatch.setattr(knowledge_base_routes, "build_knowledge_base_service", lambda session: FakeKnowledgeBaseService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.post(
        "/api/v1/knowledge-bases",
        json={
            "tenant_id": str(tenant_id),
            "workspace_id": str(workspace_id),
            "name": "RAGPilot Handbook",
            "slug": "ragpilot-handbook",
            "description": "Default knowledge base",
        },
        headers={"X-RAGPilot-Role": "operator", "X-RAGPilot-Actor-Id": str(uuid4())},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 403


def test_knowledge_base_update_route_rejects_operator_role(monkeypatch) -> None:
    class FakeKnowledgeBaseService:
        async def update_knowledge_base(self, *, knowledge_base_id, workspace_id, request):
            raise AssertionError("update_knowledge_base should not be called for operator role.")

    monkeypatch.setattr(knowledge_base_routes, "build_knowledge_base_service", lambda session: FakeKnowledgeBaseService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.patch(
        f"/api/v1/knowledge-bases/{uuid4()}",
        params={"workspace_id": str(uuid4())},
        json={
            "name": "RAGPilot Handbook",
            "slug": "ragpilot-handbook",
            "description": "Default knowledge base",
        },
        headers={"X-RAGPilot-Role": "operator", "X-RAGPilot-Actor-Id": str(uuid4())},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 403


def test_knowledge_base_publication_route_rejects_reviewer_role(monkeypatch) -> None:
    class FakeKnowledgeBaseService:
        async def set_publication_status(self, *, knowledge_base_id, workspace_id, request):
            raise AssertionError("set_publication_status should not be called for reviewer role.")

    monkeypatch.setattr(knowledge_base_routes, "build_knowledge_base_service", lambda session: FakeKnowledgeBaseService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.post(
        f"/api/v1/knowledge-bases/{uuid4()}/publication",
        params={"workspace_id": str(uuid4())},
        json={"publication_status": "published"},
        headers={"X-RAGPilot-Role": "reviewer", "X-RAGPilot-Actor-Id": str(uuid4())},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 403


def test_knowledge_base_publication_route_uses_database_policy_when_seeded(monkeypatch) -> None:
    class FakeRolePermissionRepository:
        def __init__(self, session) -> None:
            self.session = session

        async def list_role_permission_slugs(self):
            return {"super_admin": {"review_runtime_governance"}}

    class FakeKnowledgeBaseService:
        async def set_publication_status(self, *, knowledge_base_id, workspace_id, request):
            raise AssertionError("set_publication_status should not be called when database policy denies admin-resource management.")

    monkeypatch.setattr(knowledge_base_routes, "RolePermissionRepository", FakeRolePermissionRepository)
    monkeypatch.setattr(knowledge_base_routes, "build_knowledge_base_service", lambda session: FakeKnowledgeBaseService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.post(
        f"/api/v1/knowledge-bases/{uuid4()}/publication",
        params={"workspace_id": str(uuid4())},
        json={"publication_status": "published"},
        headers={"X-RAGPilot-Role": "super_admin", "X-RAGPilot-Actor-Id": str(uuid4())},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 403


def test_tenant_create_route_rejects_missing_actor_identity(monkeypatch) -> None:
    class FakeTenantService:
        async def create_tenant(self, request):
            raise AssertionError("create_tenant should not be called without actor identity.")

    monkeypatch.setattr(tenant_routes, "build_tenant_service", lambda session: FakeTenantService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.post(
        "/api/v1/tenants",
        json={"name": "RAGPilot Demo", "slug": "ragpilot-demo"},
        headers={"X-RAGPilot-Role": "super_admin"},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 401


def test_workspace_lifecycle_route_rejects_extra_fields(monkeypatch) -> None:
    class FakeWorkspaceService:
        async def set_workspace_archive_state(self, *, workspace_id, tenant_id, request):
            raise AssertionError("set_workspace_archive_state should not run when extra fields are submitted.")

    monkeypatch.setattr(workspace_routes, "build_workspace_service", lambda session: FakeWorkspaceService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.post(
        f"/api/v1/workspaces/{uuid4()}/lifecycle",
        params={"tenant_id": str(uuid4())},
        json={"is_archived": True, "unexpected_field": "blocked"},
        headers={"X-RAGPilot-Role": "super_admin", "X-RAGPilot-Actor-Id": str(uuid4())},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 422


def test_knowledge_base_create_route_rejects_extra_fields(monkeypatch) -> None:
    class FakeKnowledgeBaseService:
        async def create_knowledge_base(self, request):
            raise AssertionError("create_knowledge_base should not run when extra fields are submitted.")

    monkeypatch.setattr(knowledge_base_routes, "build_knowledge_base_service", lambda session: FakeKnowledgeBaseService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.post(
        "/api/v1/knowledge-bases",
        json={
            "tenant_id": str(uuid4()),
            "workspace_id": str(uuid4()),
            "name": "RAGPilot Handbook",
            "slug": "ragpilot-handbook",
            "description": "Default knowledge base",
            "unexpected_field": "blocked",
        },
        headers={"X-RAGPilot-Role": "super_admin", "X-RAGPilot-Actor-Id": str(uuid4())},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 422
