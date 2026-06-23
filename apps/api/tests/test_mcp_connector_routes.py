from datetime import datetime, timezone
from uuid import uuid4

from fastapi.testclient import TestClient

from ragpilot_api.infrastructure.database.session import get_database_session
from ragpilot_api.main import app
from ragpilot_api.presentation.http.v1 import mcp_connector_routes


async def override_database_session():
    yield None


def test_mcp_connector_list_route_forwards_runtime_state(monkeypatch) -> None:
    captured: dict[str, object] = {}

    class FakeMcpConnectorRegistryService:
        async def list_mcp_connectors(self, *, connector_type=None, is_enabled=None, runtime_state=None, query=None):
            captured.update(
                {
                    "connector_type": connector_type,
                    "is_enabled": is_enabled,
                    "runtime_state": runtime_state,
                    "query": query,
                }
            )
            return [
                {
                    "id": str(uuid4()),
                    "name": "Primary Browser Bridge",
                    "slug": "mcp-browser-primary",
                    "connector_type": "streamable_http",
                    "base_url": "http://127.0.0.1:8899/mcp",
                    "auth_mode": "none",
                    "credential_key_hint": None,
                    "notes": "Primary browser connector.",
                    "is_enabled": True,
                    "referenced_tool_count": 2,
                    "integration_ready_tool_count": 1,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }
            ]

    monkeypatch.setattr(
        mcp_connector_routes,
        "build_mcp_connector_registry_service",
        lambda session: FakeMcpConnectorRegistryService(),
    )
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.get(
        "/api/v1/mcp-connectors",
        params={
            "connector_type": "streamable_http",
            "is_enabled": "true",
            "runtime_state": "runtime_ready",
            "query": "browser",
        },
        headers={"X-RagPilot-Role": "reviewer"},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert captured == {
        "connector_type": "streamable_http",
        "is_enabled": True,
        "runtime_state": "runtime_ready",
        "query": "browser",
    }
    assert response.json()[0]["referenced_tool_count"] == 2


def test_mcp_connector_governance_summary_route_returns_payload(monkeypatch) -> None:
    class FakeMcpConnectorRegistryService:
        async def get_mcp_connector_governance_summary(self):
            return {
                "total_connectors": 2,
                "enabled_connectors": 1,
                "disabled_connectors": 1,
                "referenced_connectors": 1,
                "integration_ready_connectors": 1,
                "runtime_ready_connectors": 1,
                "missing_base_url_connectors": 0,
                "environment_auth_connectors": 0,
                "missing_credential_hint_connectors": 0,
                "managed_reserved_connectors": 1,
                "type_breakdown": [],
                "auth_breakdown": [],
            }

    monkeypatch.setattr(
        mcp_connector_routes,
        "build_mcp_connector_registry_service",
        lambda session: FakeMcpConnectorRegistryService(),
    )
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.get(
        "/api/v1/mcp-connectors/governance-summary",
        headers={"X-RagPilot-Role": "reviewer"},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["integration_ready_connectors"] == 1


def test_mcp_connector_preview_route_returns_payload(monkeypatch) -> None:
    mcp_connector_id = uuid4()

    class FakeMcpConnectorRegistryService:
        async def preview_mcp_connector(self, *, mcp_connector_id):
            return {
                "mcp_connector_id": str(mcp_connector_id),
                "name": "Primary Browser Bridge",
                "slug": "mcp-browser-primary",
                "connector_type": "streamable_http",
                "preview_status": "completed",
                "summary": "MCP connector endpoint responded with HTTP 200.",
                "request_metadata": {"base_url": "http://127.0.0.1:8899/mcp"},
                "response_metadata": {"status_code": 200},
                "error_message": None,
                "executed_at": datetime.now(timezone.utc).isoformat(),
            }

    monkeypatch.setattr(
        mcp_connector_routes,
        "build_mcp_connector_registry_service",
        lambda session: FakeMcpConnectorRegistryService(),
    )
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.post(
        f"/api/v1/mcp-connectors/{mcp_connector_id}/preview",
        headers={"X-RagPilot-Role": "reviewer"},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["preview_status"] == "completed"
