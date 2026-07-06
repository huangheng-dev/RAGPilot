from uuid import uuid4

from fastapi.testclient import TestClient

from ragpilot_api.application.errors import ResourceConflictError
from ragpilot_api.infrastructure.database.session import get_database_session
from ragpilot_api.main import app
from ragpilot_api.presentation.http import request_actor
from ragpilot_api.presentation.http.v1 import (
    model_endpoint_routes,
    retrieval_profile_routes,
    runtime_governance_event_routes,
    tool_registration_routes,
)


async def override_database_session():
    yield None


def test_model_endpoint_delete_route_returns_conflict_when_binding_exists(monkeypatch) -> None:
    class FakeModelEndpointRepository:
        def __init__(self, session) -> None:
            self.session = session

        async def get_model_endpoint(self, *, model_endpoint_id):
            return type(
                "FakeModelEndpoint",
                (),
                {"id": model_endpoint_id, "name": "Local Ollama", "slug": "local-ollama"},
            )()

    class FakeModelRegistryService:
        async def delete_model_endpoint(self, *, model_endpoint_id):
            raise ResourceConflictError(
                "Model endpoint is still assigned to 2 agents. Remove those agent bindings before deleting it."
            )

    monkeypatch.setattr(model_endpoint_routes, "ModelEndpointRepository", FakeModelEndpointRepository)
    monkeypatch.setattr(
        model_endpoint_routes,
        "build_model_registry_service",
        lambda session: FakeModelRegistryService(),
    )
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.delete(
        f"/api/v1/model-endpoints/{uuid4()}",
        headers={"X-RAGPilot-Role": "super_admin", "X-RAGPilot-Actor-Id": str(uuid4())},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 409
    assert "assigned to 2 agents" in response.json()["detail"]


def test_model_endpoint_delete_route_uses_database_policy_when_seeded(monkeypatch) -> None:
    class FakeRolePermissionRepository:
        def __init__(self, session) -> None:
            self.session = session

        async def list_role_permission_slugs(self):
            return {"super_admin": {"review_runtime_governance"}}

    class FakeModelRegistryService:
        async def delete_model_endpoint(self, *, model_endpoint_id):
            raise AssertionError("delete_model_endpoint should not run when database policy denies management access.")

    class FakeModelEndpointRepository:
        def __init__(self, session) -> None:
            self.session = session

        async def get_model_endpoint(self, *, model_endpoint_id):
            return None

    monkeypatch.setattr(model_endpoint_routes, "RolePermissionRepository", FakeRolePermissionRepository)
    monkeypatch.setattr(model_endpoint_routes, "ModelEndpointRepository", FakeModelEndpointRepository)
    monkeypatch.setattr(
        model_endpoint_routes,
        "build_model_registry_service",
        lambda session: FakeModelRegistryService(),
    )
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.delete(
        f"/api/v1/model-endpoints/{uuid4()}",
        headers={"X-RAGPilot-Role": "super_admin", "X-RAGPilot-Actor-Id": str(uuid4())},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 403


def test_tool_registration_delete_route_returns_conflict_when_binding_exists(monkeypatch) -> None:
    class FakeToolRegistrationRepository:
        def __init__(self, session) -> None:
            self.session = session

        async def get_tool_registration(self, *, tool_registration_id):
            return type(
                "FakeToolRegistration",
                (),
                {"id": tool_registration_id, "name": "Governed Browser Tool", "slug": "governed-browser-tool"},
            )()

    class FakeToolRegistryService:
        async def delete_tool_registration(self, *, tool_registration_id):
            raise ResourceConflictError(
                "Tool registration is still assigned to 1 agent. Remove those agent bindings before deleting it."
            )

    monkeypatch.setattr(tool_registration_routes, "ToolRegistrationRepository", FakeToolRegistrationRepository)
    monkeypatch.setattr(
        tool_registration_routes,
        "build_tool_registry_service",
        lambda session: FakeToolRegistryService(),
    )
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.delete(
        f"/api/v1/tool-registrations/{uuid4()}",
        headers={"X-RAGPilot-Role": "super_admin", "X-RAGPilot-Actor-Id": str(uuid4())},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 409
    assert "assigned to 1 agent" in response.json()["detail"]


def test_tool_registration_delete_route_uses_database_policy_when_seeded(monkeypatch) -> None:
    class FakeRolePermissionRepository:
        def __init__(self, session) -> None:
            self.session = session

        async def list_role_permission_slugs(self):
            return {"super_admin": {"review_runtime_governance"}}

    class FakeToolRegistryService:
        async def delete_tool_registration(self, *, tool_registration_id):
            raise AssertionError("delete_tool_registration should not run when database policy denies management access.")

    class FakeToolRegistrationRepository:
        def __init__(self, session) -> None:
            self.session = session

        async def get_tool_registration(self, *, tool_registration_id):
            return None

    monkeypatch.setattr(tool_registration_routes, "RolePermissionRepository", FakeRolePermissionRepository)
    monkeypatch.setattr(tool_registration_routes, "ToolRegistrationRepository", FakeToolRegistrationRepository)
    monkeypatch.setattr(
        tool_registration_routes,
        "build_tool_registry_service",
        lambda session: FakeToolRegistryService(),
    )
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.delete(
        f"/api/v1/tool-registrations/{uuid4()}",
        headers={"X-RAGPilot-Role": "super_admin", "X-RAGPilot-Actor-Id": str(uuid4())},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 403


def test_retrieval_profile_delete_route_returns_conflict_when_binding_exists(monkeypatch) -> None:
    class FakeRetrievalProfileRepository:
        def __init__(self, session) -> None:
            self.session = session

        async def get_retrieval_profile(self, *, retrieval_profile_id):
            return type(
                "FakeRetrievalProfile",
                (),
                {"id": retrieval_profile_id, "name": "Hybrid Retrieval", "slug": "hybrid-retrieval"},
            )()

    class FakeRetrievalProfileRegistryService:
        async def delete_retrieval_profile(self, *, retrieval_profile_id):
            raise ResourceConflictError(
                "Retrieval profile is still assigned to 1 knowledge base. Reassign those knowledge bases before deleting it."
            )

    monkeypatch.setattr(retrieval_profile_routes, "RetrievalProfileRepository", FakeRetrievalProfileRepository)
    monkeypatch.setattr(
        retrieval_profile_routes,
        "build_retrieval_profile_registry_service",
        lambda session: FakeRetrievalProfileRegistryService(),
    )
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.delete(
        f"/api/v1/retrieval-profiles/{uuid4()}",
        headers={"X-RAGPilot-Role": "super_admin", "X-RAGPilot-Actor-Id": str(uuid4())},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 409
    assert "assigned to 1 knowledge base" in response.json()["detail"]


def test_retrieval_profile_governance_action_route_records_runtime_governance_event(monkeypatch) -> None:
    retrieval_profile_id = uuid4()
    actor_user_id = uuid4()
    captured: dict[str, object] = {}

    class FakeRetrievalProfileRegistryService:
        async def apply_retrieval_profile_governance_action(self, *, retrieval_profile_id, action_type):
            return {
                "action_type": action_type,
                "summary": "Retrieval profile promoted as the governed default.",
                "retrieval_profile": {
                    "id": str(retrieval_profile_id),
                    "name": "Hybrid Retrieval",
                    "slug": "hybrid-retrieval",
                    "retrieval_mode": "hybrid",
                    "top_k": 5,
                    "vector_weight": 0.65,
                    "lexical_weight": 0.35,
                    "hybrid_overlap_bonus": 0.05,
                    "is_enabled": True,
                    "is_default": True,
                    "notes": "Default hybrid profile",
                    "bound_knowledge_base_count": 2,
                    "created_at": "2026-06-21T00:00:00Z",
                    "updated_at": "2026-06-21T00:00:00Z",
                },
            }

    class FakeRuntimeGovernanceEventService:
        async def create_runtime_governance_event(self, **kwargs):
            captured.update(kwargs)
            return {"id": str(uuid4())}

    monkeypatch.setattr(
        retrieval_profile_routes,
        "build_retrieval_profile_registry_service",
        lambda session: FakeRetrievalProfileRegistryService(),
    )
    monkeypatch.setattr(
        retrieval_profile_routes,
        "build_runtime_governance_event_service",
        lambda session: FakeRuntimeGovernanceEventService(),
    )
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.post(
        f"/api/v1/retrieval-profiles/{retrieval_profile_id}/governance-action",
        json={"action_type": "promote_default"},
        headers={"X-RAGPilot-Role": "super_admin", "X-RAGPilot-Actor-Id": str(actor_user_id)},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["retrieval_profile"]["is_default"] is True
    assert captured["resource_type"] == "retrieval_profile"
    assert captured["action_type"] == "promote_default"


def test_model_endpoint_preview_route_returns_payload(monkeypatch) -> None:
    preview_id = uuid4()
    captured: dict[str, object] = {}

    class FakeModelRegistryService:
        async def preview_model_endpoint(self, *, model_endpoint_id):
            return {
                "model_endpoint_id": str(model_endpoint_id),
                "name": "Local Ollama",
                "slug": "local-ollama",
                "provider_type": "ollama",
                "model_name": "gemma3:1b",
                "preview_status": "completed",
                "summary": "Ollama preview completed successfully.",
                "response_excerpt": "READY gemma3:1b",
                "request_metadata": {"provider_type": "ollama"},
                "response_metadata": {"provider": "ollama"},
                "error_message": None,
                "executed_at": "2026-06-21T00:00:00Z",
            }

    class FakeRuntimeGovernanceEventService:
        async def create_runtime_governance_event(self, **kwargs):
            captured.update(kwargs)
            return {"id": str(uuid4())}

    monkeypatch.setattr(
        model_endpoint_routes,
        "build_model_registry_service",
        lambda session: FakeModelRegistryService(),
    )
    monkeypatch.setattr(
        model_endpoint_routes,
        "build_runtime_governance_event_service",
        lambda session: FakeRuntimeGovernanceEventService(),
    )
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.post(
        f"/api/v1/model-endpoints/{preview_id}/preview",
        headers={"X-RAGPilot-Role": "super_admin", "X-RAGPilot-Actor-Id": str(uuid4())},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["preview_status"] == "completed"
    assert response.json()["provider_type"] == "ollama"
    assert captured["resource_type"] == "model_endpoint"
    assert captured["action_type"] == "preview_completed"
    assert captured["detail"]["preview_status"] == "completed"


def test_model_governance_summary_route_returns_payload(monkeypatch) -> None:
    class FakeModelRegistryService:
        async def get_model_governance_summary(self):
            return {
                "total_endpoints": 3,
                "enabled_endpoints": 2,
                "disabled_endpoints": 1,
                "bound_endpoints": 2,
                "default_endpoints": 1,
                "enabled_default_endpoints": 1,
                "runtime_ready_default_endpoints": 1,
                "settings_fallback_exposed": False,
                "disabled_bound_endpoints": 1,
                "runtime_ready_endpoints": 1,
                "missing_base_url_endpoints": 1,
                "environment_credential_endpoints": 0,
                "missing_credential_hint_endpoints": 0,
                "managed_reserved_credential_endpoints": 1,
                "no_credential_endpoints": 2,
                "deterministic_endpoints": 1,
                "ollama_endpoints": 1,
                "openai_compatible_endpoints": 1,
                "vllm_endpoints": 0,
                "provider_breakdown": [
                    {
                        "provider_type": "deterministic",
                        "total_endpoints": 1,
                        "enabled_endpoints": 1,
                        "bound_endpoints": 1,
                        "default_endpoints": 1,
                        "runtime_ready_endpoints": 1,
                    }
                ],
                "credential_breakdown": [
                    {
                        "credential_mode": "none",
                        "total_endpoints": 2,
                        "enabled_endpoints": 2,
                        "configured_endpoints": 1,
                    }
                ],
                "provider_compatibility": [
                    {
                        "provider_type": "deterministic",
                        "routing_style": "builtin",
                        "requires_base_url": False,
                        "supports_no_credential": True,
                        "supports_environment_credential": False,
                        "supports_managed_reserved": False,
                        "preview_available": True,
                        "default_base_url_hint": None,
                    },
                    {
                        "provider_type": "ollama",
                        "routing_style": "native_http",
                        "requires_base_url": True,
                        "supports_no_credential": True,
                        "supports_environment_credential": False,
                        "supports_managed_reserved": False,
                        "preview_available": True,
                        "default_base_url_hint": "http://127.0.0.1:11434",
                    },
                ],
                "provider_runtime_posture": [
                    {
                        "provider_type": "deterministic",
                        "posture_status": "ready",
                        "total_endpoints": 1,
                        "enabled_endpoints": 1,
                        "runtime_ready_endpoints": 1,
                        "default_endpoints": 1,
                        "runtime_ready_default_endpoints": 1,
                        "bound_agent_count": 1,
                        "active_agent_count": 1,
                        "attention_active_agent_count": 0,
                        "missing_base_url_endpoints": 0,
                        "missing_credential_hint_endpoints": 0,
                        "recent_preview_completed_events": 1,
                        "recent_preview_blocked_events": 0,
                        "recent_preview_failed_events": 0,
                        "last_preview_status": "completed",
                        "last_preview_at": "2026-06-21T00:00:00Z",
                    }
                ],
            }

    monkeypatch.setattr(
        model_endpoint_routes,
        "build_model_registry_service",
        lambda session: FakeModelRegistryService(),
    )
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.get(
        "/api/v1/model-endpoints/governance-summary",
        headers={
            "X-RAGPilot-Role": "reviewer",
            "X-RAGPilot-Actor-Id": str(uuid4()),
        },
    )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["runtime_ready_endpoints"] == 1
    assert response.json()["missing_base_url_endpoints"] == 1
    assert response.json()["provider_compatibility"][1]["provider_type"] == "ollama"
    assert response.json()["provider_runtime_posture"][0]["posture_status"] == "ready"
    assert response.json()["provider_runtime_posture"][0]["recent_preview_completed_events"] == 1


def test_model_endpoint_preview_route_uses_database_policy_when_seeded(monkeypatch) -> None:
    class FakeRolePermissionRepository:
        def __init__(self, session) -> None:
            self.session = session

        async def list_role_permission_slugs(self):
            return {"super_admin": {"access_home"}}

    class FakeModelRegistryService:
        async def preview_model_endpoint(self, *, model_endpoint_id):
            raise AssertionError("preview_model_endpoint should not run when database policy denies review access.")

    monkeypatch.setattr(model_endpoint_routes, "RolePermissionRepository", FakeRolePermissionRepository)
    monkeypatch.setattr(
        model_endpoint_routes,
        "build_model_registry_service",
        lambda session: FakeModelRegistryService(),
    )
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.post(
        f"/api/v1/model-endpoints/{uuid4()}/preview",
        headers={"X-RAGPilot-Role": "super_admin", "X-RAGPilot-Actor-Id": str(uuid4())},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 403


def test_model_endpoint_preview_route_returns_vllm_payload(monkeypatch) -> None:
    preview_id = uuid4()
    captured: dict[str, object] = {}

    class FakeModelRegistryService:
        async def preview_model_endpoint(self, *, model_endpoint_id):
            return {
                "model_endpoint_id": str(model_endpoint_id),
                "name": "Local vLLM",
                "slug": "local-vllm",
                "provider_type": "vllm",
                "model_name": "meta-llama/Llama-3.1-8B-Instruct",
                "preview_status": "completed",
                "summary": "vLLM preview completed successfully.",
                "response_excerpt": "READY meta-llama/Llama-3.1-8B-Instruct",
                "request_metadata": {"provider_type": "vllm"},
                "response_metadata": {"provider": "vllm"},
                "error_message": None,
                "executed_at": "2026-06-21T00:00:00Z",
            }

    class FakeRuntimeGovernanceEventService:
        async def create_runtime_governance_event(self, **kwargs):
            captured.update(kwargs)
            return {"id": str(uuid4())}

    monkeypatch.setattr(
        model_endpoint_routes,
        "build_model_registry_service",
        lambda session: FakeModelRegistryService(),
    )
    monkeypatch.setattr(
        model_endpoint_routes,
        "build_runtime_governance_event_service",
        lambda session: FakeRuntimeGovernanceEventService(),
    )
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.post(
        f"/api/v1/model-endpoints/{preview_id}/preview",
        headers={"X-RAGPilot-Role": "super_admin", "X-RAGPilot-Actor-Id": str(uuid4())},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["preview_status"] == "completed"
    assert response.json()["provider_type"] == "vllm"
    assert captured["action_type"] == "preview_completed"
    assert captured["detail"]["provider_type"] == "vllm"


def test_runtime_governance_event_list_route_returns_recent_events(monkeypatch) -> None:
    class FakeRuntimeGovernanceEventService:
        async def list_runtime_governance_events(self, *, resource_type=None, action_type=None, actor_role=None, query=None, limit=20):
            assert resource_type == "tool_registration"
            assert action_type is None
            assert actor_role is None
            assert query is None
            assert limit == 6
            return [
                {
                    "id": str(uuid4()),
                    "actor_user_id": None,
                    "actor_role": "super_admin",
                    "resource_type": "tool_registration",
                    "resource_id": str(uuid4()),
                    "resource_name": "Reserved Browser Tool",
                    "resource_slug": "reserved-browser-tool",
                    "action_type": "ready_mcp_integration",
                    "detail": {"summary": "Reserved MCP boundary marked ready for integration."},
                    "follow_up": {
                        "settings_target": {
                            "runtime_resource": "mcp_connector",
                            "model_endpoint_id": None,
                            "tool_registration_id": None,
                            "tool_list_filter": None,
                            "retrieval_profile_id": None,
                            "mcp_connector_id": None,
                            "mcp_connector_slug": "docs-gateway",
                        },
                        "agents_target": {
                            "issue": "tool_mcp_integration_pending",
                            "model_endpoint_id": None,
                            "tool_registration_id": str(uuid4()),
                            "retrieval_profile_id": None,
                        },
                    },
                    "created_at": "2026-06-23T10:00:00Z",
                }
            ]

    monkeypatch.setattr(
        runtime_governance_event_routes,
        "build_runtime_governance_event_service",
        lambda session: FakeRuntimeGovernanceEventService(),
    )
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.get(
        "/api/v1/runtime-governance/events",
        params={"resource_type": "tool_registration", "limit": 6},
        headers={
            "X-RAGPilot-Role": "reviewer",
            "X-RAGPilot-Actor-Id": str(uuid4()),
        },
    )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()[0]["resource_type"] == "tool_registration"
    assert response.json()[0]["detail"]["summary"].startswith("Reserved MCP boundary")
    assert response.json()[0]["follow_up"]["settings_target"]["runtime_resource"] == "mcp_connector"
    assert response.json()[0]["follow_up"]["agents_target"]["issue"] == "tool_mcp_integration_pending"


def test_runtime_governance_event_list_route_forwards_filters(monkeypatch) -> None:
    captured: dict[str, object] = {}

    class FakeRuntimeGovernanceEventService:
        async def list_runtime_governance_events(self, **kwargs):
            captured.update(kwargs)
            return []

    monkeypatch.setattr(
        runtime_governance_event_routes,
        "build_runtime_governance_event_service",
        lambda session: FakeRuntimeGovernanceEventService(),
    )
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.get(
        "/api/v1/runtime-governance/events",
        params={
            "resource_type": "tool_registration",
            "action_type": "governance_action",
            "actor_role": "super_admin",
            "query": "browser",
            "limit": 5,
        },
        headers={
            "X-RAGPilot-Role": "reviewer",
            "X-RAGPilot-Actor-Id": str(uuid4()),
        },
    )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert captured["resource_type"] == "tool_registration"
    assert captured["action_type"] == "governance_action"
    assert captured["actor_role"] == "super_admin"
    assert captured["query"] == "browser"
    assert captured["limit"] == 5


def test_runtime_governance_event_list_route_rejects_scoped_actor_without_platform_wide_access(monkeypatch) -> None:
    def fake_get_request_actor():
        return request_actor.RequestActor(
            role="operator",
            user_id=uuid4(),
            active_tenant_ids=(uuid4(),),
        )

    class FakeRolePermissionRepository:
        def __init__(self, session) -> None:
            self.session = session

        async def list_role_permission_slugs(self):
            return {"operator": {"review_runtime_governance"}}

    class FakeRuntimeGovernanceEventService:
        async def list_runtime_governance_events(self, **kwargs):
            raise AssertionError("list_runtime_governance_events should not run for tenant-scoped actors.")

    monkeypatch.setattr(runtime_governance_event_routes, "RolePermissionRepository", FakeRolePermissionRepository)
    monkeypatch.setattr(
        runtime_governance_event_routes,
        "build_runtime_governance_event_service",
        lambda session: FakeRuntimeGovernanceEventService(),
    )
    app.dependency_overrides[get_database_session] = override_database_session
    app.dependency_overrides[request_actor.get_request_actor] = fake_get_request_actor

    client = TestClient(app)
    response = client.get("/api/v1/runtime-governance/events")

    app.dependency_overrides.clear()

    assert response.status_code == 403
    assert response.json()["detail"] == "Runtime governance review requires platform-wide access."


def test_runtime_governance_worklist_route_returns_payload(monkeypatch) -> None:
    class FakeRuntimeGovernanceWorklistService:
        async def get_runtime_governance_worklist(self, *, limit, category=None, severity=None, resource_type=None, query=None):
            assert limit == 4
            assert category == "unconfigured_model_endpoint"
            assert severity == "attention"
            assert resource_type == "model_endpoint"
            assert query == "ollama"
            return {
                "total_items": 2,
                "unconfigured_model_endpoints": 1,
                "disabled_bound_model_endpoints": 0,
                "approval_required_tools": 1,
                "mcp_integration_pending_tools": 0,
                "integration_blocked_connectors": 1,
                "items": [
                    {
                        "category": "integration_blocked_connector",
                        "severity": "attention",
                        "resource_type": "mcp_connector",
                        "resource_id": str(uuid4()),
                        "resource_name": "Docs MCP Gateway",
                        "resource_slug": "docs-mcp-gateway",
                        "action_hint": "restore_connector_runtime",
                        "recent_preview_completed_events": 1,
                        "recent_preview_blocked_events": 0,
                        "recent_preview_failed_events": 2,
                        "last_preview_status": "failed",
                        "last_preview_at": "2026-06-30T12:00:00Z",
                        "detail": {"integration_ready_tool_count": 2},
                        "follow_up": {
                            "settings_target": {
                                "runtime_resource": "mcp_connector",
                                "model_endpoint_id": None,
                                "model_provider_type": None,
                                "tool_registration_id": None,
                                "tool_list_filter": None,
                                "retrieval_profile_id": None,
                                "mcp_connector_id": str(uuid4()),
                                "mcp_connector_slug": "docs-mcp-gateway",
                            },
                            "agents_target": None,
                        },
                    }
                ],
            }

    monkeypatch.setattr(
        runtime_governance_event_routes,
        "build_runtime_governance_worklist_service",
        lambda session: FakeRuntimeGovernanceWorklistService(),
    )
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.get(
        "/api/v1/runtime-governance/worklist",
        params={
            "limit": 4,
            "category": "unconfigured_model_endpoint",
            "severity": "attention",
            "resource_type": "model_endpoint",
            "query": "ollama",
        },
        headers={
            "X-RAGPilot-Role": "reviewer",
            "X-RAGPilot-Actor-Id": str(uuid4()),
        },
    )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["total_items"] == 2
    assert response.json()["items"][0]["category"] == "integration_blocked_connector"
    assert response.json()["items"][0]["recent_preview_failed_events"] == 2
    assert response.json()["items"][0]["last_preview_status"] == "failed"
    assert response.json()["items"][0]["follow_up"]["settings_target"]["runtime_resource"] == "mcp_connector"


def test_runtime_governance_worklist_route_rejects_scoped_actor_without_platform_wide_access(monkeypatch) -> None:
    def fake_get_request_actor():
        return request_actor.RequestActor(
            role="operator",
            user_id=uuid4(),
            active_tenant_ids=(uuid4(),),
        )

    class FakeRolePermissionRepository:
        def __init__(self, session) -> None:
            self.session = session

        async def list_role_permission_slugs(self):
            return {"operator": {"review_runtime_governance"}}

    class FakeRuntimeGovernanceWorklistService:
        async def get_runtime_governance_worklist(self, **kwargs):
            raise AssertionError("get_runtime_governance_worklist should not run for tenant-scoped actors.")

    monkeypatch.setattr(runtime_governance_event_routes, "RolePermissionRepository", FakeRolePermissionRepository)
    monkeypatch.setattr(
        runtime_governance_event_routes,
        "build_runtime_governance_worklist_service",
        lambda session: FakeRuntimeGovernanceWorklistService(),
    )
    app.dependency_overrides[get_database_session] = override_database_session
    app.dependency_overrides[request_actor.get_request_actor] = fake_get_request_actor

    client = TestClient(app)
    response = client.get("/api/v1/runtime-governance/worklist")

    app.dependency_overrides.clear()

    assert response.status_code == 403
    assert response.json()["detail"] == "Runtime governance review requires platform-wide access."


def test_runtime_governance_overview_route_returns_payload(monkeypatch) -> None:
    class FakeRuntimeGovernanceOverviewService:
        async def get_runtime_governance_overview(self, *, worklist_limit, recent_event_limit):
            assert worklist_limit == 18
            assert recent_event_limit == 5
            connector_id = str(uuid4())
            connector_follow_up_id = str(uuid4())
            return {
                "status": "attention",
                "reason_code": "integration_blocked_connector",
                "attention_items": 2,
                "review_items": 1,
                "primary_item": {
                    "category": "integration_blocked_connector",
                    "severity": "attention",
                    "resource_type": "mcp_connector",
                    "resource_id": connector_id,
                    "resource_name": "Docs Gateway",
                    "resource_slug": "docs-gateway",
                    "action_hint": "restore_connector_runtime",
                    "recent_preview_completed_events": 0,
                    "recent_preview_blocked_events": 1,
                    "recent_preview_failed_events": 2,
                    "last_preview_status": "failed",
                    "last_preview_at": "2026-06-30T12:00:00Z",
                    "detail": {
                        "integration_ready_tool_count": 2,
                        "is_enabled": False,
                    },
                    "follow_up": {
                        "settings_target": {
                            "runtime_resource": "mcp_connector",
                            "model_endpoint_id": None,
                            "model_provider_type": None,
                            "tool_registration_id": None,
                            "tool_list_filter": None,
                            "retrieval_profile_id": None,
                            "mcp_connector_id": connector_follow_up_id,
                            "mcp_connector_slug": "docs-gateway",
                        },
                        "agents_target": None,
                    },
                },
                "model_summary": {
                    "total_endpoints": 3,
                    "enabled_endpoints": 2,
                    "disabled_endpoints": 1,
                    "bound_endpoints": 2,
                    "default_endpoints": 1,
                    "enabled_default_endpoints": 1,
                    "runtime_ready_default_endpoints": 1,
                    "settings_fallback_exposed": False,
                    "disabled_bound_endpoints": 1,
                    "runtime_ready_endpoints": 1,
                    "missing_base_url_endpoints": 1,
                    "environment_credential_endpoints": 0,
                    "missing_credential_hint_endpoints": 0,
                    "managed_reserved_credential_endpoints": 0,
                    "no_credential_endpoints": 3,
                    "deterministic_endpoints": 1,
                    "ollama_endpoints": 1,
                    "openai_compatible_endpoints": 1,
                    "vllm_endpoints": 0,
                    "provider_breakdown": [],
                    "credential_breakdown": [],
                    "provider_compatibility": [],
                    "provider_runtime_posture": [],
                },
                "tool_summary": {
                    "total_tools": 4,
                    "enabled_tools": 3,
                    "disabled_tools": 1,
                    "bound_tools": 2,
                    "approval_required_tools": 1,
                    "native_tools": 1,
                    "http_tools": 1,
                    "http_tools_missing_endpoint_tools": 0,
                    "mcp_reserved_tools": 2,
                    "mcp_reserved_bound_tools": 1,
                    "mcp_integration_pending_tools": 1,
                    "mcp_connector_configured_tools": 1,
                    "mcp_connector_unhealthy_tools": 1,
                    "runtime_ready_tools": 2,
                    "recent_preview_completed_events": 1,
                    "recent_preview_blocked_events": 1,
                    "recent_preview_failed_events": 1,
                    "last_preview_status": "blocked",
                    "last_preview_at": "2026-06-30T12:00:00Z",
                    "transport_breakdown": [],
                    "surface_breakdown": [],
                },
                "mcp_connector_summary": {
                    "total_connectors": 2,
                    "enabled_connectors": 1,
                    "disabled_connectors": 1,
                    "referenced_connectors": 1,
                    "integration_ready_connectors": 0,
                    "blocked_integration_connectors": 1,
                    "runtime_ready_connectors": 0,
                    "missing_base_url_connectors": 1,
                    "environment_auth_connectors": 0,
                    "missing_credential_hint_connectors": 0,
                    "managed_reserved_connectors": 0,
                    "recent_preview_completed_events": 0,
                    "recent_preview_blocked_events": 1,
                    "recent_preview_failed_events": 1,
                    "last_preview_status": "failed",
                    "last_preview_at": "2026-06-30T12:00:00Z",
                    "type_breakdown": [],
                    "auth_breakdown": [],
                },
                "worklist": {
                    "total_items": 3,
                    "unconfigured_model_endpoints": 1,
                    "disabled_bound_model_endpoints": 0,
                    "approval_required_tools": 1,
                    "mcp_integration_pending_tools": 0,
                    "integration_blocked_connectors": 1,
                    "items": [],
                },
                "recent_events": [
                    {
                        "id": str(uuid4()),
                        "actor_user_id": None,
                        "actor_role": "super_admin",
                        "resource_type": "mcp_connector",
                        "resource_id": connector_id,
                        "resource_name": "Docs Gateway",
                        "resource_slug": "docs-gateway",
                        "action_type": "disable_connector",
                        "detail": {"summary": "Connector disabled after runtime failure."},
                        "follow_up": None,
                        "created_at": "2026-06-30T12:30:00Z",
                    }
                ],
            }

    monkeypatch.setattr(
        runtime_governance_event_routes,
        "build_runtime_governance_overview_service",
        lambda session: FakeRuntimeGovernanceOverviewService(),
    )
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.get(
        "/api/v1/runtime-governance/overview",
        params={"worklist_limit": 18, "recent_event_limit": 5},
        headers={
            "X-RAGPilot-Role": "reviewer",
            "X-RAGPilot-Actor-Id": str(uuid4()),
        },
    )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["status"] == "attention"
    assert response.json()["reason_code"] == "integration_blocked_connector"
    assert response.json()["primary_item"]["resource_type"] == "mcp_connector"
    assert response.json()["tool_summary"]["mcp_connector_unhealthy_tools"] == 1
    assert response.json()["mcp_connector_summary"]["blocked_integration_connectors"] == 1


def test_retrieval_profile_create_route_records_runtime_governance_event(monkeypatch) -> None:
    captured: dict[str, object] = {}

    class FakeRetrievalProfileRegistryService:
        async def create_retrieval_profile(self, request):
            return {
                "id": str(uuid4()),
                "name": request.name,
                "slug": request.slug,
                "retrieval_mode": request.retrieval_mode,
                "top_k": request.top_k,
                "vector_weight": request.vector_weight,
                "lexical_weight": request.lexical_weight,
                "hybrid_overlap_bonus": request.hybrid_overlap_bonus,
                "is_enabled": request.is_enabled,
                "is_default": request.is_default,
                "notes": request.notes,
                "bound_knowledge_base_count": 0,
                "created_at": "2026-06-23T10:00:00Z",
                "updated_at": "2026-06-23T10:00:00Z",
            }

    class FakeRuntimeGovernanceEventService:
        async def create_runtime_governance_event(self, **kwargs):
            captured.update(kwargs)
            return {"id": str(uuid4())}

    monkeypatch.setattr(
        retrieval_profile_routes,
        "build_retrieval_profile_registry_service",
        lambda session: FakeRetrievalProfileRegistryService(),
    )
    monkeypatch.setattr(
        retrieval_profile_routes,
        "build_runtime_governance_event_service",
        lambda session: FakeRuntimeGovernanceEventService(),
    )
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.post(
        "/api/v1/retrieval-profiles",
        json={
            "name": "Standard Hybrid Retrieval",
            "slug": "standard-hybrid-retrieval",
            "retrieval_mode": "hybrid",
            "top_k": 6,
            "vector_weight": 0.7,
            "lexical_weight": 0.3,
            "hybrid_overlap_bonus": 0.05,
            "is_enabled": True,
            "is_default": False,
            "notes": "Primary profile",
        },
        headers={"X-RAGPilot-Role": "super_admin", "X-RAGPilot-Actor-Id": str(uuid4())},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 201
    assert captured["resource_type"] == "retrieval_profile"
    assert captured["action_type"] == "created"
    assert captured["detail"]["top_k"] == 6


def test_retrieval_profile_governance_action_route_rejects_extra_fields(monkeypatch) -> None:
    class FakeRetrievalProfileRegistryService:
        async def apply_retrieval_profile_governance_action(self, **kwargs):
            raise AssertionError(
                "apply_retrieval_profile_governance_action should not run when extra fields are submitted."
            )

    monkeypatch.setattr(
        retrieval_profile_routes,
        "build_retrieval_profile_registry_service",
        lambda session: FakeRetrievalProfileRegistryService(),
    )
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.post(
        f"/api/v1/retrieval-profiles/{uuid4()}/governance-action",
        json={"action_type": "promote_default", "unexpected_field": "blocked"},
        headers={"X-RAGPilot-Role": "super_admin", "X-RAGPilot-Actor-Id": str(uuid4())},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 422
