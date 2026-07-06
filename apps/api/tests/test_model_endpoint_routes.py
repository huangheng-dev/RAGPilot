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
        headers={
            "X-RAGPilot-Role": "reviewer",
            "X-RAGPilot-Actor-Id": str(uuid4()),
        },
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


def test_model_endpoint_create_route_records_runtime_governance_event(monkeypatch) -> None:
    captured: dict[str, object] = {}

    class FakeModelRegistryService:
        async def create_model_endpoint(self, request):
            return {
                "id": str(uuid4()),
                "name": request.name,
                "slug": request.slug,
                "provider_type": request.provider_type,
                "model_name": request.model_name,
                "base_url": request.base_url,
                "credential_mode": request.credential_mode,
                "credential_key_hint": request.credential_key_hint,
                "capabilities": request.capabilities,
                "is_enabled": request.is_enabled,
                "is_default": request.is_default,
                "notes": request.notes,
                "bound_agent_count": 0,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }

    class FakeRuntimeGovernanceEventService:
        async def create_runtime_governance_event(self, **kwargs):
            captured.update(kwargs)
            return {"id": str(uuid4())}

    monkeypatch.setattr(model_endpoint_routes, "build_model_registry_service", lambda session: FakeModelRegistryService())
    monkeypatch.setattr(
        model_endpoint_routes,
        "build_runtime_governance_event_service",
        lambda session: FakeRuntimeGovernanceEventService(),
    )
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.post(
        "/api/v1/model-endpoints",
        json={
            "name": "Primary Chat",
            "slug": "primary-chat",
            "provider_type": "ollama",
            "model_name": "gemma3:1b",
            "base_url": "http://127.0.0.1:11434",
            "credential_mode": "none",
            "credential_key_hint": None,
            "capabilities": ["chat"],
            "is_enabled": True,
            "is_default": True,
            "notes": "Local model",
        },
        headers={"X-RAGPilot-Role": "super_admin", "X-RAGPilot-Actor-Id": str(uuid4())},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 201
    assert captured["resource_type"] == "model_endpoint"
    assert captured["action_type"] == "created"
    assert captured["detail"]["provider_type"] == "ollama"


def test_model_endpoint_governance_action_route_records_runtime_governance_event(monkeypatch) -> None:
    model_endpoint_id = uuid4()
    actor_user_id = uuid4()
    captured: dict[str, object] = {}

    class FakeModelRegistryService:
        async def apply_model_endpoint_governance_action(self, *, model_endpoint_id, action_type):
            return {
                "action_type": action_type,
                "summary": "Model endpoint promoted as the governed default runtime.",
                "model_endpoint": {
                    "id": str(model_endpoint_id),
                    "name": "Local vLLM Chat",
                    "slug": "local-vllm-chat",
                    "provider_type": "vllm",
                    "model_name": "meta-llama/Llama-3.1-8B-Instruct",
                    "base_url": "http://127.0.0.1:8001/v1",
                    "credential_mode": "none",
                    "credential_key_hint": None,
                    "capabilities": ["chat"],
                    "is_enabled": True,
                    "is_default": True,
                    "notes": "Governed local vLLM runtime.",
                    "bound_agent_count": 2,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                },
            }

    class FakeRuntimeGovernanceEventService:
        async def create_runtime_governance_event(self, **kwargs):
            captured.update(kwargs)
            return {"id": str(uuid4())}

    monkeypatch.setattr(model_endpoint_routes, "build_model_registry_service", lambda session: FakeModelRegistryService())
    monkeypatch.setattr(
        model_endpoint_routes,
        "build_runtime_governance_event_service",
        lambda session: FakeRuntimeGovernanceEventService(),
    )
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.post(
        f"/api/v1/model-endpoints/{model_endpoint_id}/governance-action",
        json={"action_type": "promote_default"},
        headers={"X-RAGPilot-Role": "super_admin", "X-RAGPilot-Actor-Id": str(actor_user_id)},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["model_endpoint"]["is_default"] is True
    assert captured["resource_type"] == "model_endpoint"
    assert captured["action_type"] == "promote_default"


def test_model_endpoint_create_route_rejects_extra_fields(monkeypatch) -> None:
    class FakeModelRegistryService:
        async def create_model_endpoint(self, request):
            raise AssertionError("create_model_endpoint should not run when extra fields are submitted.")

    monkeypatch.setattr(model_endpoint_routes, "build_model_registry_service", lambda session: FakeModelRegistryService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.post(
        "/api/v1/model-endpoints",
        json={
            "name": "Primary Chat",
            "slug": "primary-chat",
            "provider_type": "ollama",
            "model_name": "gemma3:1b",
            "base_url": "http://127.0.0.1:11434",
            "credential_mode": "none",
            "capabilities": ["chat"],
            "is_enabled": True,
            "is_default": False,
            "notes": "Local model",
            "unexpected_field": "blocked",
        },
        headers={"X-RAGPilot-Role": "super_admin", "X-RAGPilot-Actor-Id": str(uuid4())},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 422
