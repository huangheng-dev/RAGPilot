from uuid import uuid4

from fastapi.testclient import TestClient

from ragpilot_api.infrastructure.database.session import get_database_session
from ragpilot_api.main import app
from ragpilot_api.presentation.http.v1 import agent_routes


async def override_database_session():
    yield None


def test_agent_execution_list_route_forwards_filters(monkeypatch) -> None:
    captured: dict[str, object] = {}

    class FakeAgentExecutionService:
        async def list_agent_executions(
            self,
            *,
            tenant_id,
            agent_definition_id=None,
            execution_mode=None,
            execution_status=None,
            limit=8,
        ):
            captured.update(
                {
                    "tenant_id": tenant_id,
                    "agent_definition_id": agent_definition_id,
                    "execution_mode": execution_mode,
                    "execution_status": execution_status,
                    "limit": limit,
                }
            )
            return []

    monkeypatch.setattr(agent_routes, "build_agent_execution_service", lambda session: FakeAgentExecutionService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.get(
        "/api/v1/agents/executions",
        params={
            "tenant_id": str(uuid4()),
            "agent_definition_id": str(uuid4()),
            "execution_mode": "workflow_recovery",
            "execution_status": "completed",
            "limit": "5",
        },
        headers={
            "X-RagPilot-Role": "operator",
            "X-RagPilot-Actor-Id": str(uuid4()),
        },
    )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert captured["execution_mode"] == "workflow_recovery"
    assert captured["execution_status"] == "completed"
    assert captured["limit"] == 5
