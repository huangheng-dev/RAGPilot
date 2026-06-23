from uuid import uuid4

from fastapi.testclient import TestClient

from ragpilot_api.infrastructure.database.session import get_database_session
from ragpilot_api.main import app
from ragpilot_api.presentation.http.v1 import agent_routes


async def override_database_session():
    yield None


def test_agent_run_list_route_forwards_runtime_filters(monkeypatch) -> None:
    captured: dict[str, object] = {}

    class FakeAgentRunService:
        async def list_agent_runs(
            self,
            *,
            tenant_id,
            agent_definition_id=None,
            target_surface=None,
            trigger_source=None,
            run_status=None,
            limit=8,
        ):
            captured.update(
                {
                    "tenant_id": tenant_id,
                    "agent_definition_id": agent_definition_id,
                    "target_surface": target_surface,
                    "trigger_source": trigger_source,
                    "run_status": run_status,
                    "limit": limit,
                }
            )
            return []

    monkeypatch.setattr(agent_routes, "build_agent_run_service", lambda session: FakeAgentRunService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.get(
        "/api/v1/agents/runs",
        params={
            "tenant_id": str(uuid4()),
            "agent_definition_id": str(uuid4()),
            "target_surface": "operations",
            "trigger_source": "operations",
            "run_status": "launched",
            "limit": "5",
        },
        headers={
            "X-RagPilot-Role": "operator",
            "X-RagPilot-Actor-Id": str(uuid4()),
        },
    )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert captured["target_surface"] == "operations"
    assert captured["trigger_source"] == "operations"
    assert captured["run_status"] == "launched"
    assert captured["limit"] == 5

