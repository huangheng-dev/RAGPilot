from uuid import uuid4

from fastapi.testclient import TestClient

from ragpilot_api.application.errors import ResourceConflictError
from ragpilot_api.infrastructure.database.session import get_database_session
from ragpilot_api.main import app
from ragpilot_api.presentation.http.v1 import model_endpoint_routes, retrieval_profile_routes, tool_registration_routes


async def override_database_session():
    yield None


def test_model_endpoint_delete_route_returns_conflict_when_binding_exists(monkeypatch) -> None:
    class FakeModelRegistryService:
        async def delete_model_endpoint(self, *, model_endpoint_id):
            raise ResourceConflictError(
                "Model endpoint is still assigned to 2 agents. Remove those agent bindings before deleting it."
            )

    monkeypatch.setattr(
        model_endpoint_routes,
        "build_model_registry_service",
        lambda session: FakeModelRegistryService(),
    )
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.delete(
        f"/api/v1/model-endpoints/{uuid4()}",
        headers={"X-RagPilot-Role": "super_admin"},
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

    monkeypatch.setattr(model_endpoint_routes, "RolePermissionRepository", FakeRolePermissionRepository)
    monkeypatch.setattr(
        model_endpoint_routes,
        "build_model_registry_service",
        lambda session: FakeModelRegistryService(),
    )
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.delete(
        f"/api/v1/model-endpoints/{uuid4()}",
        headers={"X-RagPilot-Role": "super_admin"},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 403


def test_tool_registration_delete_route_returns_conflict_when_binding_exists(monkeypatch) -> None:
    class FakeToolRegistryService:
        async def delete_tool_registration(self, *, tool_registration_id):
            raise ResourceConflictError(
                "Tool registration is still assigned to 1 agent. Remove those agent bindings before deleting it."
            )

    monkeypatch.setattr(
        tool_registration_routes,
        "build_tool_registry_service",
        lambda session: FakeToolRegistryService(),
    )
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.delete(
        f"/api/v1/tool-registrations/{uuid4()}",
        headers={"X-RagPilot-Role": "super_admin"},
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

    monkeypatch.setattr(tool_registration_routes, "RolePermissionRepository", FakeRolePermissionRepository)
    monkeypatch.setattr(
        tool_registration_routes,
        "build_tool_registry_service",
        lambda session: FakeToolRegistryService(),
    )
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.delete(
        f"/api/v1/tool-registrations/{uuid4()}",
        headers={"X-RagPilot-Role": "super_admin"},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 403


def test_retrieval_profile_delete_route_returns_conflict_when_binding_exists(monkeypatch) -> None:
    class FakeRetrievalProfileRegistryService:
        async def delete_retrieval_profile(self, *, retrieval_profile_id):
            raise ResourceConflictError(
                "Retrieval profile is still assigned to 1 knowledge base. Reassign those knowledge bases before deleting it."
            )

    monkeypatch.setattr(
        retrieval_profile_routes,
        "build_retrieval_profile_registry_service",
        lambda session: FakeRetrievalProfileRegistryService(),
    )
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.delete(
        f"/api/v1/retrieval-profiles/{uuid4()}",
        headers={"X-RagPilot-Role": "super_admin"},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 409
    assert "assigned to 1 knowledge base" in response.json()["detail"]


def test_model_endpoint_preview_route_returns_payload(monkeypatch) -> None:
    preview_id = uuid4()

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

    monkeypatch.setattr(
        model_endpoint_routes,
        "build_model_registry_service",
        lambda session: FakeModelRegistryService(),
    )
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.post(
        f"/api/v1/model-endpoints/{preview_id}/preview",
        headers={"X-RagPilot-Role": "super_admin"},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["preview_status"] == "completed"
    assert response.json()["provider_type"] == "ollama"


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
        headers={"X-RagPilot-Role": "reviewer"},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["runtime_ready_endpoints"] == 1
    assert response.json()["missing_base_url_endpoints"] == 1


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
        headers={"X-RagPilot-Role": "super_admin"},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 403


def test_model_endpoint_preview_route_returns_vllm_payload(monkeypatch) -> None:
    preview_id = uuid4()

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

    monkeypatch.setattr(
        model_endpoint_routes,
        "build_model_registry_service",
        lambda session: FakeModelRegistryService(),
    )
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.post(
        f"/api/v1/model-endpoints/{preview_id}/preview",
        headers={"X-RagPilot-Role": "super_admin"},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["preview_status"] == "completed"
    assert response.json()["provider_type"] == "vllm"
