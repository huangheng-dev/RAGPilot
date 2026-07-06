from uuid import uuid4

from fastapi.testclient import TestClient

from ragpilot_api.infrastructure.database.session import get_database_session
from ragpilot_api.main import app
from ragpilot_api.presentation.http import request_actor
from ragpilot_api.presentation.http.v1 import (
    knowledge_base_routes,
    mcp_connector_routes,
    model_endpoint_routes,
    retrieval_profile_routes,
    tool_registration_routes,
    user_routes,
    workspace_routes,
)


async def override_database_session():
    yield None


def test_workspace_create_route_rejects_scoped_actor_outside_active_tenant(monkeypatch) -> None:
    tenant_id = uuid4()

    class FakeRolePermissionRepository:
        def __init__(self, session) -> None:
            self.session = session

        async def list_role_permission_slugs(self):
            return {"operator": {"manage_admin_resources"}}

    class FakeWorkspaceService:
        async def create_workspace(self, request):
            raise AssertionError("create_workspace should not run for an out-of-scope tenant.")

    async def override_request_actor():
        return request_actor.RequestActor(
            role="operator",
            user_id=uuid4(),
            active_tenant_ids=(uuid4(),),
        )

    monkeypatch.setattr(workspace_routes, "RolePermissionRepository", FakeRolePermissionRepository)
    monkeypatch.setattr(workspace_routes, "build_workspace_service", lambda session: FakeWorkspaceService())
    app.dependency_overrides[get_database_session] = override_database_session
    app.dependency_overrides[request_actor.get_request_actor] = override_request_actor

    client = TestClient(app)
    response = client.post(
        "/api/v1/workspaces",
        json={
            "tenant_id": str(tenant_id),
            "name": "RAGPilot Operations",
            "slug": "ragpilot-operations",
            "description": "Operator workspace",
        },
    )

    app.dependency_overrides.clear()

    assert response.status_code == 403
    assert response.json()["detail"] == "Actor does not have access to the requested tenant scope."


def test_knowledge_base_create_route_rejects_tenant_workspace_mismatch(monkeypatch) -> None:
    tenant_id = uuid4()
    workspace_id = uuid4()
    other_tenant_id = uuid4()

    class FakeRolePermissionRepository:
        def __init__(self, session) -> None:
            self.session = session

        async def list_role_permission_slugs(self):
            return {"operator": {"manage_admin_resources"}}

    class FakeKnowledgeBaseService:
        async def create_knowledge_base(self, request):
            raise AssertionError("create_knowledge_base should not run when tenant and workspace scope mismatch.")

    class FakeWorkspaceRepository:
        def __init__(self, session) -> None:
            self.session = session

        async def get_workspace_by_id(self, *, workspace_id):
            return type("Workspace", (), {"tenant_id": other_tenant_id})()

    async def override_request_actor():
        return request_actor.RequestActor(
            role="operator",
            user_id=uuid4(),
            active_tenant_ids=(tenant_id, other_tenant_id),
        )

    monkeypatch.setattr(knowledge_base_routes, "RolePermissionRepository", FakeRolePermissionRepository)
    monkeypatch.setattr(
        knowledge_base_routes,
        "build_knowledge_base_service",
        lambda session: FakeKnowledgeBaseService(),
    )
    monkeypatch.setattr(knowledge_base_routes, "WorkspaceRepository", FakeWorkspaceRepository)
    app.dependency_overrides[get_database_session] = override_database_session
    app.dependency_overrides[request_actor.get_request_actor] = override_request_actor

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
    )

    app.dependency_overrides.clear()

    assert response.status_code == 409
    assert response.json()["detail"] == "Tenant and workspace scope do not match."


def test_tool_preview_route_rejects_tenant_workspace_mismatch(monkeypatch) -> None:
    tenant_id = uuid4()
    workspace_id = uuid4()
    other_tenant_id = uuid4()

    class FakeToolRuntimeService:
        async def preview_tool_invocation(self, **kwargs):
            raise AssertionError("preview_tool_invocation should not run when tenant and workspace scope mismatch.")

    class FakeRolePermissionRepository:
        def __init__(self, session) -> None:
            self.session = session

        async def list_role_permission_slugs(self):
            return {"operator": {"review_runtime_governance"}}

    async def override_request_actor():
        return request_actor.RequestActor(
            role="operator",
            user_id=uuid4(),
            active_tenant_ids=(tenant_id, other_tenant_id),
        )

    async def fake_require_actor_workspace_access(actor, workspace_id, workspace_repository):
        return other_tenant_id

    monkeypatch.setattr(tool_registration_routes, "RolePermissionRepository", FakeRolePermissionRepository)
    monkeypatch.setattr(
        tool_registration_routes,
        "build_tool_runtime_service",
        lambda session: FakeToolRuntimeService(),
    )
    monkeypatch.setattr(tool_registration_routes, "require_actor_workspace_access", fake_require_actor_workspace_access)
    app.dependency_overrides[get_database_session] = override_database_session
    app.dependency_overrides[request_actor.get_request_actor] = override_request_actor

    client = TestClient(app)
    response = client.post(
        f"/api/v1/tool-registrations/{uuid4()}/preview",
        json={
            "tenant_id": str(tenant_id),
            "workspace_id": str(workspace_id),
            "execution_input": "Run health check",
        },
    )

    app.dependency_overrides.clear()

    assert response.status_code == 409
    assert response.json()["detail"] == "Tenant scope does not match the selected workspace or knowledge base."


def test_list_users_route_requires_explicit_tenant_scope_for_scoped_actor(monkeypatch) -> None:
    class FakeRolePermissionRepository:
        def __init__(self, session) -> None:
            self.session = session

        async def list_role_permission_slugs(self):
            return {"operator": {"access_admin_console"}}

    class FakeUserService:
        async def list_users(self, **kwargs):
            raise AssertionError("list_users should not run without an explicit tenant scope.")

    async def override_request_actor():
        return request_actor.RequestActor(
            role="operator",
            user_id=uuid4(),
            active_tenant_ids=(uuid4(),),
        )

    monkeypatch.setattr(user_routes, "RolePermissionRepository", FakeRolePermissionRepository)
    monkeypatch.setattr(user_routes, "build_user_service", lambda session: FakeUserService())
    app.dependency_overrides[get_database_session] = override_database_session
    app.dependency_overrides[request_actor.get_request_actor] = override_request_actor

    client = TestClient(app)
    response = client.get("/api/v1/users")

    app.dependency_overrides.clear()

    assert response.status_code == 400
    assert response.json()["detail"] == "Tenant scope is required for scoped member directory queries."


def test_get_user_route_rejects_member_outside_scoped_actor_tenants(monkeypatch) -> None:
    target_user_id = uuid4()

    class FakeRolePermissionRepository:
        def __init__(self, session) -> None:
            self.session = session

        async def list_role_permission_slugs(self):
            return {"operator": {"access_admin_console"}}

    class FakeUserService:
        async def get_user(self, *, user_id):
            raise AssertionError("get_user should not run for a member outside the actor tenant scope.")

    class FakeUserRepository:
        def __init__(self, session) -> None:
            self.session = session

        async def get_user_directory_record(self, *, user_id):
            membership = type("MembershipRecord", (), {"membership": type("Membership", (), {"tenant_id": uuid4()})()})()
            return type("DirectoryRecord", (), {"memberships": [membership]})()

    async def override_request_actor():
        return request_actor.RequestActor(
            role="operator",
            user_id=uuid4(),
            active_tenant_ids=(uuid4(),),
        )

    monkeypatch.setattr(user_routes, "RolePermissionRepository", FakeRolePermissionRepository)
    monkeypatch.setattr(user_routes, "build_user_service", lambda session: FakeUserService())
    monkeypatch.setattr(user_routes, "UserRepository", FakeUserRepository)
    app.dependency_overrides[get_database_session] = override_database_session
    app.dependency_overrides[request_actor.get_request_actor] = override_request_actor

    client = TestClient(app)
    response = client.get(f"/api/v1/users/{target_user_id}")

    app.dependency_overrides.clear()

    assert response.status_code == 403
    assert response.json()["detail"] == "Actor does not have access to the requested member scope."


def test_create_user_membership_route_rejects_out_of_scope_tenant(monkeypatch) -> None:
    target_user_id = uuid4()
    tenant_id = uuid4()

    class FakeRolePermissionRepository:
        def __init__(self, session) -> None:
            self.session = session

        async def list_role_permission_slugs(self):
            return {"operator": {"manage_members"}}

    class FakeUserService:
        async def create_user_membership(self, **kwargs):
            raise AssertionError("create_user_membership should not run for an out-of-scope tenant.")

    async def override_request_actor():
        return request_actor.RequestActor(
            role="operator",
            user_id=uuid4(),
            active_tenant_ids=(uuid4(),),
        )

    monkeypatch.setattr(user_routes, "RolePermissionRepository", FakeRolePermissionRepository)
    monkeypatch.setattr(user_routes, "build_user_service", lambda session: FakeUserService())
    app.dependency_overrides[get_database_session] = override_database_session
    app.dependency_overrides[request_actor.get_request_actor] = override_request_actor

    client = TestClient(app)
    response = client.post(
        f"/api/v1/users/{target_user_id}/memberships",
        json={
            "tenant_id": str(tenant_id),
            "membership_status": "active",
        },
    )

    app.dependency_overrides.clear()

    assert response.status_code == 403
    assert response.json()["detail"] == "Actor does not have access to the requested tenant scope."


def test_list_model_endpoints_route_rejects_scoped_actor_without_platform_wide_access(monkeypatch) -> None:
    class FakeRolePermissionRepository:
        def __init__(self, session) -> None:
            self.session = session

        async def list_role_permission_slugs(self):
            return {"operator": {"review_runtime_governance"}}

    class FakeModelRegistryService:
        async def list_model_endpoints(self, **kwargs):
            raise AssertionError("list_model_endpoints should not run for a tenant-scoped actor.")

    async def override_request_actor():
        return request_actor.RequestActor(
            role="operator",
            user_id=uuid4(),
            active_tenant_ids=(uuid4(),),
        )

    monkeypatch.setattr(model_endpoint_routes, "RolePermissionRepository", FakeRolePermissionRepository)
    monkeypatch.setattr(model_endpoint_routes, "build_model_registry_service", lambda session: FakeModelRegistryService())
    app.dependency_overrides[get_database_session] = override_database_session
    app.dependency_overrides[request_actor.get_request_actor] = override_request_actor

    client = TestClient(app)
    response = client.get("/api/v1/model-endpoints")

    app.dependency_overrides.clear()

    assert response.status_code == 403
    assert response.json()["detail"] == "Platform model governance requires platform-wide access."


def test_list_mcp_connectors_route_rejects_scoped_actor_without_platform_wide_access(monkeypatch) -> None:
    class FakeRolePermissionRepository:
        def __init__(self, session) -> None:
            self.session = session

        async def list_role_permission_slugs(self):
            return {"operator": {"review_runtime_governance"}}

    class FakeMcpConnectorRegistryService:
        async def list_mcp_connectors(self, **kwargs):
            raise AssertionError("list_mcp_connectors should not run for a tenant-scoped actor.")

    async def override_request_actor():
        return request_actor.RequestActor(
            role="operator",
            user_id=uuid4(),
            active_tenant_ids=(uuid4(),),
        )

    monkeypatch.setattr(mcp_connector_routes, "RolePermissionRepository", FakeRolePermissionRepository)
    monkeypatch.setattr(
        mcp_connector_routes,
        "build_mcp_connector_registry_service",
        lambda session: FakeMcpConnectorRegistryService(),
    )
    app.dependency_overrides[get_database_session] = override_database_session
    app.dependency_overrides[request_actor.get_request_actor] = override_request_actor

    client = TestClient(app)
    response = client.get("/api/v1/mcp-connectors")

    app.dependency_overrides.clear()

    assert response.status_code == 403
    assert response.json()["detail"] == "Platform MCP governance requires platform-wide access."


def test_list_retrieval_profiles_route_rejects_scoped_actor_without_platform_wide_access(monkeypatch) -> None:
    class FakeRolePermissionRepository:
        def __init__(self, session) -> None:
            self.session = session

        async def list_role_permission_slugs(self):
            return {"operator": {"review_runtime_governance"}}

    class FakeRetrievalProfileRegistryService:
        async def list_retrieval_profiles(self, **kwargs):
            raise AssertionError("list_retrieval_profiles should not run for a tenant-scoped actor.")

    async def override_request_actor():
        return request_actor.RequestActor(
            role="operator",
            user_id=uuid4(),
            active_tenant_ids=(uuid4(),),
        )

    monkeypatch.setattr(retrieval_profile_routes, "RolePermissionRepository", FakeRolePermissionRepository)
    monkeypatch.setattr(
        retrieval_profile_routes,
        "build_retrieval_profile_registry_service",
        lambda session: FakeRetrievalProfileRegistryService(),
    )
    app.dependency_overrides[get_database_session] = override_database_session
    app.dependency_overrides[request_actor.get_request_actor] = override_request_actor

    client = TestClient(app)
    response = client.get("/api/v1/retrieval-profiles")

    app.dependency_overrides.clear()

    assert response.status_code == 403
    assert response.json()["detail"] == "Platform retrieval governance requires platform-wide access."


def test_create_tool_registration_route_rejects_scoped_actor_without_platform_wide_access(monkeypatch) -> None:
    class FakeRolePermissionRepository:
        def __init__(self, session) -> None:
            self.session = session

        async def list_role_permission_slugs(self):
            return {"operator": {"manage_runtime_governance"}}

    class FakeToolRegistryService:
        async def create_tool_registration(self, request):
            raise AssertionError("create_tool_registration should not run for a tenant-scoped actor.")

    async def override_request_actor():
        return request_actor.RequestActor(
            role="operator",
            user_id=uuid4(),
            active_tenant_ids=(uuid4(),),
        )

    monkeypatch.setattr(tool_registration_routes, "RolePermissionRepository", FakeRolePermissionRepository)
    monkeypatch.setattr(tool_registration_routes, "build_tool_registry_service", lambda session: FakeToolRegistryService())
    app.dependency_overrides[get_database_session] = override_database_session
    app.dependency_overrides[request_actor.get_request_actor] = override_request_actor

    client = TestClient(app)
    response = client.post(
        "/api/v1/tool-registrations",
        json={
            "name": "Browser Tool",
            "slug": "browser-tool",
            "transport_type": "native",
            "surface_area": "agents",
            "endpoint_url": None,
            "connector_reference": None,
            "description": "Controlled tool",
            "capabilities": ["navigate"],
            "requires_admin_approval": False,
            "is_enabled": True,
        },
    )

    app.dependency_overrides.clear()

    assert response.status_code == 403
    assert response.json()["detail"] == "Platform tool governance requires platform-wide access."
