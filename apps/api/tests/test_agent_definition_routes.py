from datetime import datetime, timezone
from types import SimpleNamespace
from uuid import uuid4

from fastapi.testclient import TestClient

from ragpilot_api.contracts.http.agent_contracts import AgentRuntimeGovernanceItemResponse
from ragpilot_api.infrastructure.database.session import get_database_session
from ragpilot_api.main import app
from ragpilot_api.presentation.http import request_actor
from ragpilot_api.presentation.http.v1 import agent_routes


async def override_database_session():
    yield None


def test_agent_definition_list_route_forwards_filters(monkeypatch) -> None:
    captured: dict[str, object] = {}

    class FakeAgentService:
        async def list_agent_definitions(self, *, tenant_id, status=None, mode=None, query=None):
            captured.update(
                {
                    "tenant_id": tenant_id,
                    "status": status,
                    "mode": mode,
                    "query": query,
                }
            )
            return []

    monkeypatch.setattr(agent_routes, "build_agent_service", lambda session: FakeAgentService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.get(
        "/api/v1/agents",
        params={
            "tenant_id": str(uuid4()),
            "status": "active",
            "mode": "grounded_chat",
            "query": "support",
        },
        headers={
            "X-RAGPilot-Role": "reviewer",
            "X-RAGPilot-Actor-Id": str(uuid4()),
        },
    )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert captured["status"] == "active"
    assert captured["mode"] == "grounded_chat"
    assert captured["query"] == "support"


def test_agent_definition_list_route_can_include_runtime_governance(monkeypatch) -> None:
    tenant_id = uuid4()
    agent_id = uuid4()
    tool_registration_id = uuid4()
    captured: dict[str, object] = {}

    class FakeAgentService:
        async def list_agent_definitions(self, *, tenant_id, status=None, mode=None, query=None):
            captured["tenant_id"] = tenant_id
            return [
                {
                    "id": agent_id,
                    "tenant_id": tenant_id,
                    "name": "Grounded Support Agent",
                    "slug": "grounded-support-agent",
                    "mode": "grounded_chat",
                    "status": "active",
                    "model_strategy": "hybrid_reserved",
                    "model_endpoint_id": None,
                    "objective": "Answer grounded support questions.",
                    "instructions": "",
                    "knowledge_base_scope": "ragpilot-operations/ragpilot-handbook",
                    "tools": ["chat"],
                    "tool_registration_ids": [tool_registration_id],
                    "created_at": datetime.now(timezone.utc),
                    "updated_at": datetime.now(timezone.utc),
                }
            ]

    class FakeAgentRuntimeGovernanceService:
        async def get_runtime_governance_posture(self, **kwargs):
            captured["runtime_kwargs"] = kwargs
            return SimpleNamespace(
                summary={
                    "total_agents": 1,
                    "active_agents": 1,
                    "paused_agents": 0,
                    "draft_agents": 0,
                    "attention_agents": 1,
                    "ready_agents": 0,
                    "active_agents_without_scope": 0,
                    "agents_missing_model": 0,
                    "agents_using_disabled_model": 0,
                    "agents_using_unconfigured_model": 1,
                    "agents_missing_retrieval_profile": 0,
                    "agents_using_disabled_retrieval_profile": 0,
                    "agents_missing_tool_registration": 0,
                    "agents_using_disabled_tool_registration": 0,
                    "model_endpoints": 1,
                    "enabled_models": 1,
                    "disabled_bound_models": 0,
                    "unbound_enabled_models": 0,
                    "tool_registrations": 1,
                    "enabled_tools": 1,
                    "approval_gated_tools": 1,
                    "disabled_bound_tools": 0,
                    "unbound_enabled_tools": 0,
                    "issue_counts": {
                        "model_missing": 0,
                        "model_disabled": 0,
                        "model_runtime_unconfigured": 1,
                        "retrieval_profile_missing": 0,
                        "retrieval_profile_disabled": 0,
                        "scope_missing": 0,
                        "scope_invalid": 0,
                        "tools_missing": 0,
                        "tool_registration_disabled": 0,
                        "tool_approval_required": 1,
                        "tool_mcp_reserved": 0,
                        "tool_mcp_integration_pending": 0,
                    },
                },
                items=[
                    AgentRuntimeGovernanceItemResponse.model_validate(
                        {
                            "id": agent_id,
                            "tenant_id": tenant_id,
                            "name": "Grounded Support Agent",
                            "slug": "grounded-support-agent",
                            "mode": "grounded_chat",
                            "status": "active",
                            "objective": "Answer grounded support questions.",
                            "knowledge_base_scope": "ragpilot-operations/ragpilot-handbook",
                            "model_endpoint_id": None,
                            "tool_registration_ids": [tool_registration_id],
                            "tools": ["chat"],
                            "created_at": datetime.now(timezone.utc),
                            "updated_at": datetime.now(timezone.utc),
                            "is_ready": False,
                            "issues": ["model_runtime_unconfigured", "tool_approval_required"],
                            "blocking_issues": ["model_runtime_unconfigured"],
                            "has_connected_capabilities": True,
                            "approval_required_tool_count": 1,
                            "disabled_registered_tool_count": 0,
                            "missing_tool_registration_count": 0,
                            "reserved_mcp_tool_count": 0,
                            "integration_pending_mcp_tool_count": 0,
                            "disabled_tool_registration_id": None,
                            "approval_required_tool_registration_id": tool_registration_id,
                            "reserved_mcp_tool_registration_id": None,
                            "integration_pending_mcp_tool_registration_id": None,
                            "integration_pending_mcp_connector_reference": None,
                            "focus_tool_registration": {
                                "id": tool_registration_id,
                                "name": "Approval Tool",
                                "slug": "approval-tool",
                                "transport_type": "native",
                                "surface_area": "chat",
                                "endpoint_url": None,
                                "connector_reference": None,
                                "requires_admin_approval": True,
                                "is_enabled": True,
                                "recent_preview_completed_events": 0,
                                "recent_preview_blocked_events": 0,
                                "recent_preview_failed_events": 0,
                                "last_preview_status": None,
                                "last_preview_at": None,
                            },
                            "focus_mcp_connector": None,
                            "resolved_scope": {
                                "workspace_id": None,
                                "workspace_slug": None,
                                "workspace_name": None,
                                "knowledge_base_id": None,
                                "knowledge_base_slug": None,
                                "knowledge_base_name": None,
                                "scope_issue": None,
                            },
                            "resolved_model_endpoint": {
                                "id": uuid4(),
                                "name": "Ollama Local",
                                "slug": "ollama-local",
                                "provider_type": "ollama_reserved",
                                "model_name": "llama3.1",
                                "base_url": None,
                                "credential_mode": "none",
                                "credential_key_hint": None,
                                "capabilities": ["chat"],
                                "is_enabled": True,
                                "is_default": True,
                                "runtime_ready": False,
                                "runtime_issue": "missing_base_url",
                                "recent_preview_completed_events": 0,
                                "recent_preview_blocked_events": 0,
                                "recent_preview_failed_events": 1,
                                "last_preview_status": "failed",
                                "last_preview_at": datetime.now(timezone.utc),
                            },
                            "resolved_retrieval_profile": None,
                        }
                    )
                ],
            )

    monkeypatch.setattr(agent_routes, "build_agent_service", lambda session: FakeAgentService())
    monkeypatch.setattr(
        agent_routes,
        "build_agent_runtime_governance_service",
        lambda session: FakeAgentRuntimeGovernanceService(),
    )
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.get(
        "/api/v1/agents",
        params={
            "tenant_id": str(tenant_id),
            "include_runtime_governance": "true",
        },
        headers={
            "X-RAGPilot-Role": "operator",
            "X-RAGPilot-Actor-Id": str(uuid4()),
        },
    )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["runtime_governance"]["is_ready"] is False
    assert body[0]["runtime_governance"]["approval_required_tool_registration_id"] == str(tool_registration_id)
    assert body[0]["runtime_governance"]["resolved_model_endpoint"]["runtime_issue"] == "missing_base_url"
    assert captured["runtime_kwargs"] == {
        "tenant_id": tenant_id,
        "status": None,
        "mode": None,
        "query": None,
    }


def test_agent_definition_metrics_route_returns_service_summary(monkeypatch) -> None:
    tenant_id = uuid4()

    class FakeAgentService:
        async def get_agent_definition_metrics(self, *, tenant_id=None):
            assert tenant_id is not None
            return {
                "total_agents": 5,
                "active_agents": 2,
                "paused_agents": 1,
                "draft_agents": 2,
                "tool_enabled_agents": 4,
                "scoped_agents": 3,
            }

    monkeypatch.setattr(agent_routes, "build_agent_service", lambda session: FakeAgentService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.get(
        "/api/v1/agents/metrics",
        params={"tenant_id": str(tenant_id)},
        headers={
            "X-RAGPilot-Role": "operator",
            "X-RAGPilot-Actor-Id": str(uuid4()),
        },
    )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json() == {
        "total_agents": 5,
        "active_agents": 2,
        "paused_agents": 1,
        "draft_agents": 2,
        "tool_enabled_agents": 4,
        "scoped_agents": 3,
    }


def test_agent_definition_list_route_rejects_scoped_actor_outside_active_tenant(monkeypatch) -> None:
    allowed_tenant_id = uuid4()
    requested_tenant_id = uuid4()

    class FakeAgentService:
        async def list_agent_definitions(self, **kwargs):
            raise AssertionError("list_agent_definitions should not run for an out-of-scope tenant.")

    async def override_request_actor():
        return request_actor.RequestActor(
            role="operator",
            user_id=uuid4(),
            active_tenant_ids=(allowed_tenant_id,),
        )

    monkeypatch.setattr(agent_routes, "build_agent_service", lambda session: FakeAgentService())
    app.dependency_overrides[get_database_session] = override_database_session
    app.dependency_overrides[request_actor.get_request_actor] = override_request_actor

    client = TestClient(app)
    response = client.get(
        "/api/v1/agents",
        params={"tenant_id": str(requested_tenant_id)},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 403
    assert response.json()["detail"] == "Actor does not have access to the requested tenant scope."


def test_agent_definition_metrics_route_requires_tenant_scope_for_scoped_actor(monkeypatch) -> None:
    class FakeAgentService:
        async def get_agent_definition_metrics(self, **kwargs):
            raise AssertionError("get_agent_definition_metrics should not run without an explicit tenant scope.")

    async def override_request_actor():
        return request_actor.RequestActor(
            role="operator",
            user_id=uuid4(),
            active_tenant_ids=(uuid4(),),
        )

    monkeypatch.setattr(agent_routes, "build_agent_service", lambda session: FakeAgentService())
    app.dependency_overrides[get_database_session] = override_database_session
    app.dependency_overrides[request_actor.get_request_actor] = override_request_actor

    client = TestClient(app)
    response = client.get("/api/v1/agents/metrics")

    app.dependency_overrides.clear()

    assert response.status_code == 400
    assert response.json()["detail"] == "Tenant scope is required for scoped agent metrics."


def test_agent_definition_list_route_uses_database_policy_when_seeded(monkeypatch) -> None:
    class FakeRolePermissionRepository:
        def __init__(self, session) -> None:
            self.session = session

        async def list_role_permission_slugs(self):
            return {"reviewer": {"access_chat"}}

    class FakeAgentService:
        async def list_agent_definitions(self, **kwargs):
            raise AssertionError("list_agent_definitions should not run when database policy denies agent access.")

    monkeypatch.setattr(agent_routes, "RolePermissionRepository", FakeRolePermissionRepository)
    monkeypatch.setattr(agent_routes, "build_agent_service", lambda session: FakeAgentService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.get(
        "/api/v1/agents",
        params={"tenant_id": str(uuid4())},
        headers={
            "X-RAGPilot-Role": "reviewer",
            "X-RAGPilot-Actor-Id": str(uuid4()),
        },
    )

    app.dependency_overrides.clear()

    assert response.status_code == 403


def test_agent_definition_metrics_route_uses_database_policy_when_seeded(monkeypatch) -> None:
    class FakeRolePermissionRepository:
        def __init__(self, session) -> None:
            self.session = session

        async def list_role_permission_slugs(self):
            return {"operator": {"execute_agents"}}

    class FakeAgentService:
        async def get_agent_definition_metrics(self, **kwargs):
            raise AssertionError("get_agent_definition_metrics should not run when database policy denies agent access.")

    monkeypatch.setattr(agent_routes, "RolePermissionRepository", FakeRolePermissionRepository)
    monkeypatch.setattr(agent_routes, "build_agent_service", lambda session: FakeAgentService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.get(
        "/api/v1/agents/metrics",
        params={"tenant_id": str(uuid4())},
        headers={
            "X-RAGPilot-Role": "operator",
            "X-RAGPilot-Actor-Id": str(uuid4()),
        },
    )

    app.dependency_overrides.clear()

    assert response.status_code == 403


def test_agent_definition_create_route_requires_actor_identity(monkeypatch) -> None:
    class FakeAgentService:
        async def create_agent_definition(self, request):
            raise AssertionError("create_agent_definition should not run without an authenticated actor.")

    monkeypatch.setattr(agent_routes, "build_agent_service", lambda session: FakeAgentService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.post(
        "/api/v1/agents",
        json={
            "tenant_id": str(uuid4()),
            "name": "Grounded Support Agent",
            "slug": "grounded-support-agent",
            "mode": "grounded_chat",
            "status": "active",
            "model_strategy": "hybrid_reserved",
            "objective": "Answer grounded support questions.",
            "instructions": "",
            "tools": ["chat"],
            "tool_registration_ids": [],
        },
        headers={"X-RAGPilot-Role": "super_admin"},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 401
    assert response.json()["detail"] == "Missing actor user header."


def test_agent_definition_update_route_rejects_extra_fields(monkeypatch) -> None:
    class FakeAgentService:
        async def update_agent_definition(self, **kwargs):
            raise AssertionError("update_agent_definition should not run when request validation fails.")

    monkeypatch.setattr(agent_routes, "build_agent_service", lambda session: FakeAgentService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.patch(
        f"/api/v1/agents/{uuid4()}",
        params={"tenant_id": str(uuid4())},
        json={
            "name": "Grounded Support Agent",
            "slug": "grounded-support-agent",
            "mode": "grounded_chat",
            "status": "active",
            "model_strategy": "hybrid_reserved",
            "objective": "Answer grounded support questions.",
            "instructions": "",
            "tools": ["chat"],
            "tool_registration_ids": [],
            "unexpected": "field",
        },
        headers={
            "X-RAGPilot-Role": "super_admin",
            "X-RAGPilot-Actor-Id": str(uuid4()),
        },
    )

    app.dependency_overrides.clear()

    assert response.status_code == 422


def test_agent_definition_delete_route_requires_actor_identity(monkeypatch) -> None:
    class FakeAgentService:
        async def delete_agent_definition(self, **kwargs):
            raise AssertionError("delete_agent_definition should not run without an authenticated actor.")

    monkeypatch.setattr(agent_routes, "build_agent_service", lambda session: FakeAgentService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.delete(
        f"/api/v1/agents/{uuid4()}",
        params={"tenant_id": str(uuid4())},
        headers={"X-RAGPilot-Role": "super_admin"},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 401
    assert response.json()["detail"] == "Missing actor user header."
