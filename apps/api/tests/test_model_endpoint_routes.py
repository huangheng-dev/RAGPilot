from datetime import datetime, timezone
from uuid import uuid4

from fastapi.testclient import TestClient

from ragpilot_api.infrastructure.database.session import get_database_session
from ragpilot_api.main import app
from ragpilot_api.presentation.http.v1 import model_endpoint_routes


async def override_database_session():
    yield None


def test_model_endpoint_list_route_forwards_runtime_state_filter(monkeypatch) -> None:
    captured: dict[str, object] = {}

    class FakeModelRegistryService:
        async def list_model_endpoints(
            self,
            *,
            provider_type=None,
            is_enabled=None,
            runtime_state=None,
            query=None,
        ):
            captured.update(
                {
                    "provider_type": provider_type,
                    "is_enabled": is_enabled,
                    "runtime_state": runtime_state,
                    "query": query,
                }
            )
            return [
                {
                    "id": str(uuid4()),
                    "name": "Local vLLM Chat",
                    "slug": "local-vllm-chat",
                    "provider_type": "vllm",
                    "model_name": "meta-llama/Llama-3.1-8B-Instruct",
                    "base_url": "http://127.0.0.1:8001/v1",
                    "credential_mode": "none",
                    "credential_key_hint": None,
                    "capabilities": ["chat"],
                    "is_enabled": True,
                    "is_default": False,
                    "notes": "Governed local vLLM runtime.",
                    "bound_agent_count": 2,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }
            ]

    monkeypatch.setattr(model_endpoint_routes, "build_model_registry_service", lambda session: FakeModelRegistryService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.get(
        "/api/v1/model-endpoints",
        params={
            "provider_type": "vllm",
            "is_enabled": "true",
            "runtime_state": "runtime_ready",
            "query": "llama",
        },
        headers={"X-RagPilot-Role": "reviewer"},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert captured == {
        "provider_type": "vllm",
        "is_enabled": True,
        "runtime_state": "runtime_ready",
        "query": "llama",
    }
    assert response.json()[0]["provider_type"] == "vllm"
