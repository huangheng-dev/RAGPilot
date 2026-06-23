from uuid import uuid4

from fastapi.testclient import TestClient

from ragpilot_api.infrastructure.database.session import get_database_session
from ragpilot_api.main import app
from ragpilot_api.presentation.http.v1 import agent_routes, document_routes, workflow_routes


async def override_database_session():
    yield None


def test_agent_create_route_rejects_reviewer_role(monkeypatch) -> None:
    class FakeAgentService:
        async def create_agent_definition(self, request):
            raise AssertionError("create_agent_definition should not be called for reviewer role.")

    monkeypatch.setattr(agent_routes, "build_agent_service", lambda session: FakeAgentService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.post(
        "/api/v1/agents",
        json={
            "tenant_id": str(uuid4()),
            "name": "Knowledge Assistant",
            "slug": "knowledge-assistant",
            "mode": "grounded_chat",
            "status": "draft",
            "model_strategy": "remote_reserved",
            "objective": "Answer scoped knowledge questions.",
            "instructions": "Use grounded retrieval only.",
            "knowledge_base_scope": None,
            "tools": ["chat"],
        },
        headers={"X-RagPilot-Role": "reviewer"},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 403


def test_agent_create_route_uses_database_policy_when_seeded(monkeypatch) -> None:
    class FakeRolePermissionRepository:
        def __init__(self, session) -> None:
            self.session = session

        async def list_role_permission_slugs(self):
            return {"operator": {"execute_agents"}}

    class FakeAgentService:
        async def create_agent_definition(self, request):
            raise AssertionError("create_agent_definition should not run when database policy denies agent management.")

    monkeypatch.setattr(agent_routes, "RolePermissionRepository", FakeRolePermissionRepository)
    monkeypatch.setattr(agent_routes, "build_agent_service", lambda session: FakeAgentService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.post(
        "/api/v1/agents",
        json={
            "tenant_id": str(uuid4()),
            "name": "Knowledge Assistant",
            "slug": "knowledge-assistant",
            "mode": "grounded_chat",
            "status": "draft",
            "model_strategy": "remote_reserved",
            "objective": "Answer scoped knowledge questions.",
            "instructions": "Use grounded retrieval only.",
            "knowledge_base_scope": None,
            "tools": ["chat"],
        },
        headers={"X-RagPilot-Role": "operator"},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 403


def test_agent_definition_list_route_rejects_missing_actor_identity(monkeypatch) -> None:
    class FakeAgentService:
        async def list_agent_definitions(self, *, tenant_id, status=None, mode=None, query=None):
            raise AssertionError("list_agent_definitions should not be called without actor identity.")

    monkeypatch.setattr(agent_routes, "build_agent_service", lambda session: FakeAgentService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.get(
        "/api/v1/agents",
        params={"tenant_id": str(uuid4())},
        headers={"X-RagPilot-Role": "operator"},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 401


def test_agent_definition_metrics_route_rejects_missing_actor_identity(monkeypatch) -> None:
    class FakeAgentService:
        async def get_agent_definition_metrics(self, *, tenant_id=None):
            raise AssertionError("get_agent_definition_metrics should not be called without actor identity.")

    monkeypatch.setattr(agent_routes, "build_agent_service", lambda session: FakeAgentService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.get(
        "/api/v1/agents/metrics",
        params={"tenant_id": str(uuid4())},
        headers={"X-RagPilot-Role": "operator"},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 401


def test_workflow_retry_route_rejects_reviewer_role(monkeypatch) -> None:
    class FakeWorkflowService:
        async def retry_workflow_run(self, *, workflow_run_id, tenant_id):
            raise AssertionError("retry_workflow_run should not be called for reviewer role.")

    monkeypatch.setattr(workflow_routes, "build_workflow_service", lambda session: FakeWorkflowService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.post(
        f"/api/v1/workflow-runs/{uuid4()}/retry",
        params={"tenant_id": str(uuid4())},
        headers={"X-RagPilot-Role": "reviewer"},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 403


def test_workflow_retry_route_uses_database_policy_when_seeded(monkeypatch) -> None:
    class FakeRolePermissionRepository:
        def __init__(self, session) -> None:
            self.session = session

        async def list_role_permission_slugs(self):
            return {"operator": {"manage_documents"}}

    class FakeWorkflowService:
        async def retry_workflow_run(self, *, workflow_run_id, tenant_id):
            raise AssertionError("retry_workflow_run should not run when database policy denies workflow retries.")

    monkeypatch.setattr(workflow_routes, "RolePermissionRepository", FakeRolePermissionRepository)
    monkeypatch.setattr(workflow_routes, "build_workflow_service", lambda session: FakeWorkflowService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.post(
        f"/api/v1/workflow-runs/{uuid4()}/retry",
        params={"tenant_id": str(uuid4())},
        headers={"X-RagPilot-Role": "operator"},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 403


def test_document_reindex_route_rejects_reviewer_role(monkeypatch) -> None:
    class FakeDocumentService:
        async def reindex_document(self, *, document_id, knowledge_base_id):
            raise AssertionError("reindex_document should not be called for reviewer role.")

    monkeypatch.setattr(document_routes, "build_document_service", lambda session: FakeDocumentService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.post(
        f"/api/v1/documents/{uuid4()}/reindex",
        params={"knowledge_base_id": str(uuid4())},
        headers={"X-RagPilot-Role": "reviewer"},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 403


def test_document_reindex_route_uses_database_policy_when_seeded(monkeypatch) -> None:
    class FakeRolePermissionRepository:
        def __init__(self, session) -> None:
            self.session = session

        async def list_role_permission_slugs(self):
            return {"operator": {"send_chat_messages"}}

    class FakeDocumentService:
        async def reindex_document(self, *, document_id, knowledge_base_id):
            raise AssertionError("reindex_document should not run when database policy denies document management.")

    monkeypatch.setattr(document_routes, "RolePermissionRepository", FakeRolePermissionRepository)
    monkeypatch.setattr(document_routes, "build_document_service", lambda session: FakeDocumentService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.post(
        f"/api/v1/documents/{uuid4()}/reindex",
        params={"knowledge_base_id": str(uuid4())},
        headers={"X-RagPilot-Role": "operator"},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 403


def test_document_delete_route_rejects_reviewer_role(monkeypatch) -> None:
    class FakeDocumentService:
        async def delete_document(self, *, document_id, knowledge_base_id):
            raise AssertionError("delete_document should not be called for reviewer role.")

    monkeypatch.setattr(document_routes, "build_document_service", lambda session: FakeDocumentService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.delete(
        f"/api/v1/documents/{uuid4()}",
        params={"knowledge_base_id": str(uuid4())},
        headers={"X-RagPilot-Role": "reviewer"},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 403


def test_document_restore_route_rejects_reviewer_role(monkeypatch) -> None:
    class FakeDocumentService:
        async def restore_document(self, *, document_id, knowledge_base_id):
            raise AssertionError("restore_document should not be called for reviewer role.")

    monkeypatch.setattr(document_routes, "build_document_service", lambda session: FakeDocumentService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.post(
        f"/api/v1/documents/{uuid4()}/restore",
        params={"knowledge_base_id": str(uuid4())},
        headers={"X-RagPilot-Role": "reviewer"},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 403


def test_document_upload_route_rejects_reviewer_role(monkeypatch) -> None:
    class FakeDocumentService:
        async def upload_document(self, *, tenant_id, knowledge_base_id, title, file_name, content_type, content):
            raise AssertionError("upload_document should not be called for reviewer role.")

    monkeypatch.setattr(document_routes, "build_document_service", lambda session: FakeDocumentService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.post(
        "/api/v1/documents/upload",
        data={
            "tenant_id": str(uuid4()),
            "knowledge_base_id": str(uuid4()),
            "title": "Policy Handbook",
        },
        files={"file": ("policy.md", b"# Policy", "text/markdown")},
        headers={"X-RagPilot-Role": "reviewer"},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 403
