from uuid import uuid4

from fastapi.testclient import TestClient

from ragpilot_api.infrastructure.database.session import get_database_session
from ragpilot_api.main import app
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
            "X-RagPilot-Role": "reviewer",
            "X-RagPilot-Actor-Id": str(uuid4()),
        },
    )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert captured["status"] == "active"
    assert captured["mode"] == "grounded_chat"
    assert captured["query"] == "support"


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
            "X-RagPilot-Role": "operator",
            "X-RagPilot-Actor-Id": str(uuid4()),
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
