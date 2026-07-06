from datetime import datetime, timezone
from uuid import uuid4

from fastapi.testclient import TestClient

from ragpilot_api.infrastructure.database.session import get_database_session
from ragpilot_api.main import app
from ragpilot_api.presentation.http.v1 import tool_registration_routes


async def override_database_session():
    yield None


def test_tool_registration_list_route_forwards_approval_filter(monkeypatch) -> None:
    captured: dict[str, object] = {}

    class FakeToolRegistryService:
        async def list_tool_registrations(
            self,
            *,
            transport_type=None,
            surface_area=None,
            is_enabled=None,
            requires_admin_approval=None,
            runtime_state=None,
            query=None,
        ):
            captured.update(
                {
                    "transport_type": transport_type,
                    "surface_area": surface_area,
                    "is_enabled": is_enabled,
                    "requires_admin_approval": requires_admin_approval,
                    "runtime_state": runtime_state,
                    "query": query,
                }
            )
            return [
                {
                    "id": str(uuid4()),
                    "name": "Governed Browser Tool",
                    "slug": "governed-browser-tool",
                    "transport_type": "http",
                    "surface_area": "agents",
                    "endpoint_url": "http://127.0.0.1:9010/invoke",
                    "description": "Approval-gated browser automation.",
                    "capabilities": ["browser.navigate"],
                    "requires_admin_approval": True,
                    "is_enabled": True,
                    "bound_agent_count": 1,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }
            ]

    monkeypatch.setattr(tool_registration_routes, "build_tool_registry_service", lambda session: FakeToolRegistryService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.get(
        "/api/v1/tool-registrations",
        params={
            "transport_type": "http",
            "surface_area": "agents",
            "is_enabled": "true",
            "requires_admin_approval": "true",
            "runtime_state": "mcp_integration_pending",
            "query": "browser",
        },
        headers={
            "X-RAGPilot-Role": "reviewer",
            "X-RAGPilot-Actor-Id": str(uuid4()),
        },
    )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert captured == {
        "transport_type": "http",
        "surface_area": "agents",
        "is_enabled": True,
        "requires_admin_approval": True,
        "runtime_state": "mcp_integration_pending",
        "query": "browser",
    }
    assert response.json()[0]["requires_admin_approval"] is True


def test_tool_governance_summary_route_returns_summary(monkeypatch) -> None:
    class FakeToolRegistryService:
        async def get_tool_governance_summary(self):
            return {
                "total_tools": 3,
                "enabled_tools": 2,
                "disabled_tools": 1,
                "bound_tools": 2,
                "approval_required_tools": 1,
                "native_tools": 1,
                "http_tools": 1,
                "http_tools_missing_endpoint_tools": 1,
                "mcp_reserved_tools": 1,
                "mcp_reserved_bound_tools": 0,
                "mcp_integration_pending_tools": 1,
                "mcp_connector_configured_tools": 1,
                "mcp_connector_unhealthy_tools": 1,
                "runtime_ready_tools": 1,
                "transport_breakdown": [
                    {
                        "transport_type": "native",
                        "total_tools": 1,
                        "enabled_tools": 1,
                        "bound_tools": 1,
                        "approval_required_tools": 0,
                        "missing_endpoint_tools": 0,
                        "connector_configured_tools": 0,
                        "runtime_ready_tools": 1,
                    }
                ],
                "surface_breakdown": [
                    {
                        "surface_area": "agents",
                        "total_tools": 1,
                        "enabled_tools": 1,
                        "bound_tools": 1,
                        "approval_required_tools": 1,
                    }
                ],
            }

    monkeypatch.setattr(tool_registration_routes, "build_tool_registry_service", lambda session: FakeToolRegistryService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.get(
        "/api/v1/tool-registrations/governance-summary",
        headers={
            "X-RAGPilot-Role": "reviewer",
            "X-RAGPilot-Actor-Id": str(uuid4()),
        },
    )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["mcp_reserved_tools"] == 1
    assert response.json()["mcp_integration_pending_tools"] == 1
    assert response.json()["mcp_connector_unhealthy_tools"] == 1
    assert response.json()["http_tools_missing_endpoint_tools"] == 1


def test_tool_runtime_audit_route_returns_filtered_runtime_traces(monkeypatch) -> None:
    tool_registration_id = uuid4()
    tenant_id = uuid4()

    class FakeToolRuntimeAuditService:
        async def list_tool_runtime_audit_records(
            self,
            *,
            tenant_id,
            tool_registration_id=None,
            invocation_status=None,
            limit=20,
        ):
            assert tenant_id is not None
            return {
                "summary": {
                    "total_traces": 1,
                    "completed_traces": 0,
                    "blocked_traces": 0,
                    "reserved_traces": 0,
                "unavailable_traces": 0,
                "failed_traces": 1,
                "skipped_traces": 0,
                "approval_required_traces": 0,
                "disabled_traces": 0,
                "mcp_reserved_traces": 0,
                "endpoint_failure_traces": 1,
                "runtime_failure_traces": 0,
            },
            "items": [
                {
                        "agent_execution_id": str(uuid4()),
                        "agent_definition_id": str(uuid4()),
                        "execution_mode": "grounded_chat",
                        "execution_status": "completed",
                        "trigger_source": "agents_console",
                        "tool_registration_id": str(tool_registration_id),
                        "name": "Governed Search Tool",
                        "slug": "governed-search-tool",
                    "transport_type": "http",
                    "surface_area": "agents",
                    "invocation_status": "failed",
                    "governance_issue": "endpoint_failure",
                    "endpoint_url": "http://127.0.0.1:9010/invoke",
                    "summary": "Search tool failed.",
                        "capability_results": {"match_count": 0},
                        "request_metadata": {"attempt_count": 2},
                        "response_metadata": {"status_code": 503},
                        "error_message": "Upstream unavailable",
                        "executed_at": datetime.now(timezone.utc).isoformat(),
                    }
                ],
            }

    monkeypatch.setattr(
        tool_registration_routes,
        "build_tool_runtime_audit_service",
        lambda session: FakeToolRuntimeAuditService(),
    )
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.get(
        "/api/v1/tool-registrations/runtime-audit",
        params={
            "tenant_id": str(tenant_id),
            "tool_registration_id": str(tool_registration_id),
            "invocation_status": "failed",
            "limit": 10,
        },
        headers={
            "X-RAGPilot-Role": "reviewer",
            "X-RAGPilot-Actor-Id": str(uuid4()),
        },
    )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["summary"]["failed_traces"] == 1
    assert response.json()["summary"]["endpoint_failure_traces"] == 1
    assert response.json()["items"][0]["tool_registration_id"] == str(tool_registration_id)
    assert response.json()["items"][0]["invocation_status"] == "failed"
    assert response.json()["items"][0]["governance_issue"] == "endpoint_failure"


def test_tool_mcp_boundary_worklist_route_returns_reserved_queue(monkeypatch) -> None:
    tenant_id = uuid4()
    tool_registration_id = uuid4()

    class FakeToolBoundaryGovernanceService:
        async def list_mcp_boundary_worklist(self, *, tenant_id, limit=12):
            assert limit == 8
            return {
                "total_reserved_tools": 1,
                "bound_reserved_tools": 1,
                "reserved_trace_count": 2,
                "reviewing_tools": 1,
                "quarantined_tools": 0,
                "ready_for_integration_tools": 0,
                "items": [
                    {
                        "tool_registration_id": str(tool_registration_id),
                        "name": "Reserved MCP Browser",
                        "slug": "reserved-mcp-browser",
                        "surface_area": "agents",
                        "boundary_status": "reviewing",
                        "requires_admin_approval": True,
                        "is_enabled": True,
                        "bound_agent_count": 2,
                        "reserved_trace_count": 2,
                        "connector_reference": "mcp.browser.primary",
                        "available_actions": ["ready_mcp_integration", "quarantine_mcp_boundary"],
                        "latest_invocation_status": "reserved",
                        "latest_governance_issue": "mcp_reserved",
                        "latest_summary": "Reserved MCP boundary invoked.",
                        "latest_executed_at": datetime.now(timezone.utc).isoformat(),
                    }
                ],
            }

    monkeypatch.setattr(
        tool_registration_routes,
        "build_tool_boundary_governance_service",
        lambda session: FakeToolBoundaryGovernanceService(),
    )
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.get(
        "/api/v1/tool-registrations/mcp-boundary-worklist",
        params={"tenant_id": str(tenant_id), "limit": 8},
        headers={
            "X-RAGPilot-Role": "reviewer",
            "X-RAGPilot-Actor-Id": str(uuid4()),
        },
    )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["bound_reserved_tools"] == 1
    assert response.json()["items"][0]["boundary_status"] == "reviewing"
    assert response.json()["items"][0]["latest_governance_issue"] == "mcp_reserved"


def test_tool_governance_action_route_forwards_action(monkeypatch) -> None:
    tool_registration_id = uuid4()
    captured: dict[str, object] = {}

    class FakeToolRegistryService:
        async def apply_tool_governance_action(self, *, tool_registration_id, action_type):
            captured["tool_registration_id"] = tool_registration_id
            captured["action_type"] = action_type
            return {
                "action_type": action_type,
                "summary": "Tool registration quarantined. Invocation is blocked until governance review re-enables it.",
                "tool_registration": {
                    "id": str(tool_registration_id),
                    "name": "Governed Browser Tool",
                    "slug": "governed-browser-tool",
                    "transport_type": "http",
                    "surface_area": "agents",
                    "endpoint_url": "http://127.0.0.1:9010/invoke",
                    "description": "Approval-gated browser automation.",
                    "capabilities": ["browser.navigate"],
                    "requires_admin_approval": True,
                    "is_enabled": False,
                    "bound_agent_count": 2,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                },
            }

    class FakeRuntimeGovernanceEventService:
        async def create_runtime_governance_event(self, **kwargs):
            return {"id": str(uuid4())}

    monkeypatch.setattr(tool_registration_routes, "build_tool_registry_service", lambda session: FakeToolRegistryService())
    monkeypatch.setattr(
        tool_registration_routes,
        "build_runtime_governance_event_service",
        lambda session: FakeRuntimeGovernanceEventService(),
    )
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.post(
        f"/api/v1/tool-registrations/{tool_registration_id}/governance-action",
        json={"action_type": "quarantine_tool"},
        headers={"X-RAGPilot-Role": "super_admin", "X-RAGPilot-Actor-Id": str(uuid4())},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert captured == {
        "tool_registration_id": tool_registration_id,
        "action_type": "quarantine_tool",
    }
    assert response.json()["tool_registration"]["is_enabled"] is False
    assert response.json()["tool_registration"]["requires_admin_approval"] is True


def test_tool_governance_action_route_records_runtime_governance_event(monkeypatch) -> None:
    tool_registration_id = uuid4()
    captured: dict[str, object] = {}

    class FakeToolRegistryService:
        async def apply_tool_governance_action(self, *, tool_registration_id, action_type):
            return {
                "action_type": action_type,
                "summary": "Reserved MCP boundary marked ready for integration.",
                "tool_registration": {
                    "id": str(tool_registration_id),
                    "name": "Reserved Browser Tool",
                    "slug": "reserved-browser-tool",
                    "transport_type": "mcp_reserved",
                    "surface_area": "agents",
                    "endpoint_url": None,
                    "connector_reference": "mcp.browser.primary",
                    "description": "Reserved browser tool",
                    "capabilities": ["browser.navigate"],
                    "requires_admin_approval": True,
                    "is_enabled": True,
                    "bound_agent_count": 2,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                },
            }

    class FakeRuntimeGovernanceEventService:
        async def create_runtime_governance_event(self, **kwargs):
            captured.update(kwargs)
            return {"id": str(uuid4())}

    monkeypatch.setattr(tool_registration_routes, "build_tool_registry_service", lambda session: FakeToolRegistryService())
    monkeypatch.setattr(
        tool_registration_routes,
        "build_runtime_governance_event_service",
        lambda session: FakeRuntimeGovernanceEventService(),
    )
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.post(
        f"/api/v1/tool-registrations/{tool_registration_id}/governance-action",
        json={"action_type": "ready_mcp_integration"},
        headers={"X-RAGPilot-Role": "super_admin", "X-RAGPilot-Actor-Id": str(uuid4())},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert captured["resource_type"] == "tool_registration"
    assert captured["action_type"] == "ready_mcp_integration"
    assert captured["detail"]["connector_reference"] == "mcp.browser.primary"


def test_tool_preview_route_forwards_scope(monkeypatch) -> None:
    captured: dict[str, object] = {}
    event_captured: dict[str, object] = {}
    tool_registration_id = uuid4()
    tenant_id = uuid4()
    workspace_id = uuid4()
    knowledge_base_id = uuid4()

    class FakeToolRuntimeService:
        async def preview_tool_invocation(
            self,
            *,
            tool_registration_id,
            tenant_id,
            workspace_id,
            knowledge_base_id,
            execution_input,
            actor,
        ):
            captured.update(
                {
                    "tool_registration_id": tool_registration_id,
                    "tenant_id": tenant_id,
                    "workspace_id": workspace_id,
                    "knowledge_base_id": knowledge_base_id,
                    "execution_input": execution_input,
                    "actor_role": actor.role,
                }
            )
            return {
                "tool_registration_id": str(tool_registration_id),
                "name": "Scope Summary",
                "slug": "scope-summary",
                "transport_type": "native",
                "surface_area": "agents",
                "invocation_status": "completed",
                "endpoint_url": None,
                "summary": "Executed 1 native capability checks.",
                "capability_results": {
                    "scope_summary": {
                        "tenant_id": str(tenant_id),
                    }
                },
                "error_message": None,
                "executed_at": datetime.now(timezone.utc).isoformat(),
            }

    class FakeRuntimeGovernanceEventService:
        async def create_runtime_governance_event(self, **kwargs):
            event_captured.update(kwargs)
            return {"id": str(uuid4())}

    monkeypatch.setattr(tool_registration_routes, "build_tool_runtime_service", lambda session: FakeToolRuntimeService())
    monkeypatch.setattr(
        tool_registration_routes,
        "build_runtime_governance_event_service",
        lambda session: FakeRuntimeGovernanceEventService(),
    )
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.post(
        f"/api/v1/tool-registrations/{tool_registration_id}/preview",
        json={
            "tenant_id": str(tenant_id),
            "workspace_id": str(workspace_id),
            "knowledge_base_id": str(knowledge_base_id),
            "execution_input": "Inspect current scope.",
        },
        headers={"X-RAGPilot-Role": "operator", "X-RAGPilot-Actor-Id": str(uuid4())},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert captured == {
        "tool_registration_id": tool_registration_id,
        "tenant_id": tenant_id,
        "workspace_id": workspace_id,
        "knowledge_base_id": knowledge_base_id,
        "execution_input": "Inspect current scope.",
        "actor_role": "operator",
    }
    assert response.json()["invocation_status"] == "completed"
    assert event_captured["resource_type"] == "tool_registration"
    assert event_captured["action_type"] == "preview_completed"
    assert event_captured["detail"]["invocation_status"] == "completed"


def test_tool_preview_route_requires_authenticated_role(monkeypatch) -> None:
    class FakeToolRuntimeService:
        async def preview_tool_invocation(self, **kwargs):
            raise AssertionError("preview_tool_invocation should not run without a role header.")

    monkeypatch.setattr(tool_registration_routes, "build_tool_runtime_service", lambda session: FakeToolRuntimeService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.post(
        f"/api/v1/tool-registrations/{uuid4()}/preview",
        json={"tenant_id": str(uuid4())},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 401


def test_tool_preview_route_rejects_extra_fields(monkeypatch) -> None:
    class FakeToolRuntimeService:
        async def preview_tool_invocation(self, **kwargs):
            raise AssertionError("preview_tool_invocation should not run when extra fields are submitted.")

    monkeypatch.setattr(tool_registration_routes, "build_tool_runtime_service", lambda session: FakeToolRuntimeService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.post(
        f"/api/v1/tool-registrations/{uuid4()}/preview",
        json={
            "tenant_id": str(uuid4()),
            "execution_input": "Inspect current scope.",
            "unexpected_field": "blocked",
        },
        headers={"X-RAGPilot-Role": "operator", "X-RAGPilot-Actor-Id": str(uuid4())},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 422
