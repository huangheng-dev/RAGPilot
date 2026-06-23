from uuid import uuid4

from fastapi.testclient import TestClient

from ragpilot_api.infrastructure.database.session import get_database_session
from ragpilot_api.main import app
from ragpilot_api.presentation.http.v1 import agent_routes


async def override_database_session():
    yield None


def test_agent_runtime_governance_route_forwards_filters(monkeypatch) -> None:
    captured: dict[str, object] = {}

    class FakeAgentRuntimeGovernanceService:
        async def get_runtime_governance_posture(
            self,
            *,
            tenant_id=None,
            status=None,
            mode=None,
            readiness=None,
            issue=None,
            model_endpoint_id=None,
            tool_registration_id=None,
            retrieval_profile_id=None,
            query=None,
        ):
            captured["tenant_id"] = tenant_id
            captured["status"] = status
            captured["mode"] = mode
            captured["readiness"] = readiness
            captured["issue"] = issue
            captured["model_endpoint_id"] = model_endpoint_id
            captured["tool_registration_id"] = tool_registration_id
            captured["retrieval_profile_id"] = retrieval_profile_id
            captured["query"] = query
            return {
                "summary": {
                    "total_agents": 0,
                    "active_agents": 0,
                    "paused_agents": 0,
                    "draft_agents": 0,
                    "attention_agents": 0,
                    "ready_agents": 0,
                    "active_agents_without_scope": 0,
                    "agents_missing_model": 0,
                    "agents_using_disabled_model": 0,
                    "agents_missing_retrieval_profile": 0,
                    "agents_using_disabled_retrieval_profile": 0,
                    "agents_missing_tool_registration": 0,
                    "agents_using_disabled_tool_registration": 0,
                    "model_endpoints": 0,
                    "enabled_models": 0,
                    "disabled_bound_models": 0,
                    "unbound_enabled_models": 0,
                    "tool_registrations": 0,
                    "enabled_tools": 0,
                    "approval_gated_tools": 0,
                    "disabled_bound_tools": 0,
                    "unbound_enabled_tools": 0,
                    "issue_counts": {
                        "model_missing": 0,
                        "model_disabled": 0,
                        "retrieval_profile_missing": 0,
                        "retrieval_profile_disabled": 0,
                        "scope_missing": 0,
                        "scope_invalid": 0,
                        "tools_missing": 0,
                        "tool_registration_disabled": 0,
                        "tool_approval_required": 0,
                        "tool_mcp_reserved": 0,
                        "tool_mcp_integration_pending": 0,
                    },
                },
                "items": [],
            }

    monkeypatch.setattr(
        agent_routes,
        "build_agent_runtime_governance_service",
        lambda session: FakeAgentRuntimeGovernanceService(),
    )
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    tenant_id = uuid4()
    model_endpoint_id = uuid4()
    tool_registration_id = uuid4()
    retrieval_profile_id = uuid4()
    response = client.get(
        "/api/v1/agents/runtime-governance",
        params={
            "tenant_id": str(tenant_id),
            "status": "active",
            "mode": "grounded_chat",
            "readiness": "attention",
            "issue": "tool_mcp_integration_pending",
            "model_endpoint_id": str(model_endpoint_id),
            "tool_registration_id": str(tool_registration_id),
            "retrieval_profile_id": str(retrieval_profile_id),
            "query": "support",
        },
        headers={"X-RagPilot-Actor-Id": str(uuid4()), "X-RagPilot-Role": "operator"},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert captured == {
        "tenant_id": tenant_id,
        "status": "active",
        "mode": "grounded_chat",
        "readiness": "attention",
        "issue": "tool_mcp_integration_pending",
        "model_endpoint_id": model_endpoint_id,
        "tool_registration_id": tool_registration_id,
        "retrieval_profile_id": retrieval_profile_id,
        "query": "support",
    }
