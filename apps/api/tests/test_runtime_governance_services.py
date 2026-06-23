from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from ragpilot_api.application.errors import ResourceConflictError
from ragpilot_api.application.model_registry.model_registry_service import ModelRegistryService
from ragpilot_api.application.retrieval.retrieval_profile_registry_service import RetrievalProfileRegistryService
from ragpilot_api.application.tool_registry.tool_registry_service import ToolRegistryService


def build_model_endpoint(**overrides):
    defaults = {
        "id": uuid4(),
        "name": "Primary Chat",
        "slug": "primary-chat",
        "provider_type": "openai_compatible",
        "model_name": "gpt-4.1-mini",
        "base_url": "http://localhost:11434/v1",
        "credential_mode": "environment",
        "credential_key_hint": "OPENAI_API_KEY",
        "capabilities_json": ["chat"],
        "is_enabled": True,
        "is_default": True,
        "notes": "Default model endpoint",
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    return SimpleNamespace(**{**defaults, **overrides})


def build_tool_registration(**overrides):
    defaults = {
        "id": uuid4(),
        "name": "Search Tool",
        "slug": "search-tool",
        "transport_type": "http",
        "surface_area": "agents",
        "endpoint_url": "http://localhost:18000/tools/search",
        "connector_reference": None,
        "description": "Search tool",
        "capabilities_json": ["search"],
        "requires_admin_approval": False,
        "is_enabled": True,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    return SimpleNamespace(**{**defaults, **overrides})


def build_retrieval_profile(**overrides):
    defaults = {
        "id": uuid4(),
        "name": "Standard Hybrid Retrieval",
        "slug": "standard-hybrid-retrieval",
        "retrieval_mode": "hybrid",
        "top_k": 5,
        "vector_weight": 0.65,
        "lexical_weight": 0.35,
        "hybrid_overlap_bonus": 0.05,
        "is_enabled": True,
        "is_default": True,
        "notes": "Default hybrid profile",
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    return SimpleNamespace(**{**defaults, **overrides})


@pytest.mark.anyio
async def test_model_registry_service_includes_bound_agent_counts_in_list_responses() -> None:
    model_endpoint = build_model_endpoint()
    model_repository = SimpleNamespace(
        list_model_endpoints=AsyncMock(return_value=[model_endpoint]),
    )
    agent_repository = SimpleNamespace(
        list_model_endpoint_binding_counts=AsyncMock(return_value={str(model_endpoint.id): 3}),
        count_agents_using_model_endpoint=AsyncMock(return_value=0),
    )

    service = ModelRegistryService(
        model_repository,
        agent_repository,
        settings=SimpleNamespace(chat_model_request_timeout_seconds=30),
    )

    response = await service.list_model_endpoints()

    assert len(response) == 1
    assert response[0].bound_agent_count == 3


@pytest.mark.anyio
async def test_model_registry_service_blocks_delete_when_endpoint_is_still_bound() -> None:
    model_endpoint_id = uuid4()
    model_repository = SimpleNamespace(delete_model_endpoint=AsyncMock(return_value=True))
    agent_repository = SimpleNamespace(
        count_agents_using_model_endpoint=AsyncMock(return_value=2),
    )

    service = ModelRegistryService(
        model_repository,
        agent_repository,
        settings=SimpleNamespace(chat_model_request_timeout_seconds=30),
    )

    with pytest.raises(ResourceConflictError):
        await service.delete_model_endpoint(model_endpoint_id=model_endpoint_id)

    model_repository.delete_model_endpoint.assert_not_called()


@pytest.mark.anyio
async def test_model_registry_service_builds_model_governance_summary() -> None:
    deterministic_endpoint = build_model_endpoint(
        provider_type="deterministic",
        base_url=None,
        credential_mode="none",
        credential_key_hint=None,
        is_default=True,
        is_enabled=True,
    )
    missing_base_url_endpoint = build_model_endpoint(
        provider_type="ollama",
        base_url=None,
        credential_mode="none",
        credential_key_hint=None,
        is_enabled=True,
        is_default=False,
    )
    managed_reserved_endpoint = build_model_endpoint(
        provider_type="openai_compatible",
        base_url="http://localhost:11434/v1",
        credential_mode="managed_reserved",
        is_enabled=False,
        is_default=False,
    )
    model_repository = SimpleNamespace(
        list_model_endpoints=AsyncMock(
            return_value=[deterministic_endpoint, missing_base_url_endpoint, managed_reserved_endpoint]
        ),
    )
    agent_repository = SimpleNamespace(
        list_model_endpoint_binding_counts=AsyncMock(
            return_value={
                str(deterministic_endpoint.id): 1,
                str(missing_base_url_endpoint.id): 2,
                str(managed_reserved_endpoint.id): 1,
            }
        ),
        count_agents_using_model_endpoint=AsyncMock(return_value=0),
    )

    service = ModelRegistryService(
        model_repository,
        agent_repository,
        settings=SimpleNamespace(chat_model_request_timeout_seconds=30),
    )
    summary = await service.get_model_governance_summary()

    assert summary.total_endpoints == 3
    assert summary.enabled_endpoints == 2
    assert summary.disabled_endpoints == 1
    assert summary.bound_endpoints == 3
    assert summary.default_endpoints == 1
    assert summary.enabled_default_endpoints == 1
    assert summary.disabled_bound_endpoints == 1
    assert summary.runtime_ready_endpoints == 1
    assert summary.missing_base_url_endpoints == 1
    assert summary.managed_reserved_credential_endpoints == 1
    assert summary.no_credential_endpoints == 2
    assert summary.deterministic_endpoints == 1
    assert summary.ollama_endpoints == 1
    assert summary.openai_compatible_endpoints == 1


@pytest.mark.anyio
async def test_model_registry_service_filters_runtime_state_for_disabled_and_missing_base_url() -> None:
    runtime_ready_endpoint = build_model_endpoint(
        provider_type="deterministic",
        base_url=None,
        credential_mode="none",
        credential_key_hint=None,
        is_enabled=True,
    )
    missing_base_url_endpoint = build_model_endpoint(
        provider_type="vllm",
        base_url=None,
        credential_mode="none",
        credential_key_hint=None,
        is_enabled=True,
    )
    disabled_bound_endpoint = build_model_endpoint(
        provider_type="openai_compatible",
        base_url="http://127.0.0.1:8000/v1",
        credential_mode="environment",
        credential_key_hint="OPENAI_API_KEY",
        is_enabled=False,
    )
    model_repository = SimpleNamespace(
        list_model_endpoints=AsyncMock(
            return_value=[runtime_ready_endpoint, missing_base_url_endpoint, disabled_bound_endpoint]
        ),
    )
    agent_repository = SimpleNamespace(
        list_model_endpoint_binding_counts=AsyncMock(
            return_value={
                str(runtime_ready_endpoint.id): 0,
                str(missing_base_url_endpoint.id): 0,
                str(disabled_bound_endpoint.id): 2,
            }
        ),
        count_agents_using_model_endpoint=AsyncMock(return_value=0),
    )

    service = ModelRegistryService(
        model_repository,
        agent_repository,
        settings=SimpleNamespace(chat_model_request_timeout_seconds=30),
    )

    missing_base_url_response = await service.list_model_endpoints(runtime_state="missing_base_url")
    disabled_bound_response = await service.list_model_endpoints(runtime_state="disabled_bound")
    runtime_ready_response = await service.list_model_endpoints(runtime_state="runtime_ready")

    assert len(missing_base_url_response) == 1
    assert missing_base_url_response[0].id == missing_base_url_endpoint.id
    assert len(disabled_bound_response) == 1
    assert disabled_bound_response[0].id == disabled_bound_endpoint.id
    assert len(runtime_ready_response) == 1
    assert runtime_ready_response[0].id == runtime_ready_endpoint.id


@pytest.mark.anyio
async def test_model_registry_service_previews_deterministic_endpoint_without_network() -> None:
    model_endpoint = build_model_endpoint(
        provider_type="deterministic",
        model_name="ragpilot-grounded-template",
        base_url=None,
        credential_mode="none",
        credential_key_hint=None,
        capabilities_json=["chat"],
        is_enabled=True,
    )
    model_repository = SimpleNamespace(
        get_model_endpoint=AsyncMock(return_value=model_endpoint),
    )
    agent_repository = SimpleNamespace()

    service = ModelRegistryService(
        model_repository,
        agent_repository,
        settings=SimpleNamespace(chat_model_request_timeout_seconds=30),
    )

    response = await service.preview_model_endpoint(model_endpoint_id=model_endpoint.id)

    assert response.preview_status == "completed"
    assert response.response_excerpt == "READY ragpilot-grounded-template"
    assert response.response_metadata["provider"] == "deterministic"


@pytest.mark.anyio
async def test_model_registry_service_blocks_preview_for_disabled_endpoint() -> None:
    model_endpoint = build_model_endpoint(
        provider_type="ollama",
        model_name="gemma3:1b",
        base_url="http://127.0.0.1:11434",
        credential_mode="none",
        credential_key_hint=None,
        capabilities_json=["chat"],
        is_enabled=False,
    )
    model_repository = SimpleNamespace(
        get_model_endpoint=AsyncMock(return_value=model_endpoint),
    )
    agent_repository = SimpleNamespace()

    service = ModelRegistryService(
        model_repository,
        agent_repository,
        settings=SimpleNamespace(chat_model_request_timeout_seconds=30),
    )

    response = await service.preview_model_endpoint(model_endpoint_id=model_endpoint.id)

    assert response.preview_status == "blocked"
    assert "disabled" in response.summary.lower()


@pytest.mark.anyio
async def test_model_registry_service_previews_vllm_endpoint_through_openai_compatible_transport(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    model_endpoint = build_model_endpoint(
        provider_type="vllm",
        model_name="meta-llama/Llama-3.1-8B-Instruct",
        base_url="http://127.0.0.1:8001/v1",
        credential_mode="none",
        credential_key_hint=None,
        capabilities_json=["chat"],
        is_enabled=True,
    )
    model_repository = SimpleNamespace(
        get_model_endpoint=AsyncMock(return_value=model_endpoint),
    )
    agent_repository = SimpleNamespace()
    service = ModelRegistryService(
        model_repository,
        agent_repository,
        settings=SimpleNamespace(chat_model_request_timeout_seconds=30),
    )

    async def fake_generate_chat_completion(self, *, messages):
        return SimpleNamespace(
            content="READY meta-llama/Llama-3.1-8B-Instruct",
            model_name="meta-llama/Llama-3.1-8B-Instruct",
            usage_json={"provider": "vllm", "usage": {"prompt_tokens": 12}, "finish_reason": "stop"},
        )

    monkeypatch.setattr(
        "ragpilot_api.application.model_registry.model_registry_service.OpenAICompatibleChatProvider.generate_chat_completion",
        fake_generate_chat_completion,
    )

    response = await service.preview_model_endpoint(model_endpoint_id=model_endpoint.id)

    assert response.preview_status == "completed"
    assert response.provider_type == "vllm"
    assert response.response_metadata["provider"] == "vllm"
    assert "vllm preview completed successfully" in response.summary.lower()


@pytest.mark.anyio
async def test_tool_registry_service_includes_bound_agent_counts_in_list_responses() -> None:
    tool_registration = build_tool_registration()
    tool_repository = SimpleNamespace(
        list_tool_registrations=AsyncMock(return_value=[tool_registration]),
    )
    agent_repository = SimpleNamespace(
        list_tool_registration_binding_counts=AsyncMock(return_value={str(tool_registration.id): 4}),
        count_agents_using_tool_registration=AsyncMock(return_value=0),
    )

    service = ToolRegistryService(tool_repository, agent_repository)

    response = await service.list_tool_registrations()

    assert len(response) == 1
    assert response[0].bound_agent_count == 4


@pytest.mark.anyio
async def test_tool_registry_service_blocks_delete_when_registration_is_still_bound() -> None:
    tool_registration_id = uuid4()
    tool_repository = SimpleNamespace(delete_tool_registration=AsyncMock(return_value=True))
    agent_repository = SimpleNamespace(
        count_agents_using_tool_registration=AsyncMock(return_value=1),
    )

    service = ToolRegistryService(tool_repository, agent_repository)

    with pytest.raises(ResourceConflictError):
        await service.delete_tool_registration(tool_registration_id=tool_registration_id)

    tool_repository.delete_tool_registration.assert_not_called()


@pytest.mark.anyio
async def test_tool_registry_service_builds_tool_governance_summary() -> None:
    native_tool = build_tool_registration(
        transport_type="native",
        surface_area="chat",
        endpoint_url=None,
        requires_admin_approval=False,
        is_enabled=True,
    )
    http_tool_missing_endpoint = build_tool_registration(
        transport_type="http",
        surface_area="agents",
        endpoint_url=None,
        requires_admin_approval=True,
        is_enabled=True,
    )
    mcp_reserved_tool = build_tool_registration(
        transport_type="mcp_reserved",
        surface_area="operations",
        endpoint_url=None,
        connector_reference="mcp.browser.primary",
        requires_admin_approval=False,
        is_enabled=False,
    )
    tool_repository = SimpleNamespace(
        list_tool_registrations=AsyncMock(
            return_value=[native_tool, http_tool_missing_endpoint, mcp_reserved_tool]
        ),
    )
    agent_repository = SimpleNamespace(
        list_tool_registration_binding_counts=AsyncMock(
            return_value={
                str(native_tool.id): 1,
                str(http_tool_missing_endpoint.id): 2,
                str(mcp_reserved_tool.id): 1,
            }
        ),
        count_agents_using_tool_registration=AsyncMock(return_value=0),
    )

    service = ToolRegistryService(tool_repository, agent_repository)
    summary = await service.get_tool_governance_summary()

    assert summary.total_tools == 3
    assert summary.enabled_tools == 2
    assert summary.disabled_tools == 1
    assert summary.bound_tools == 3
    assert summary.approval_required_tools == 1
    assert summary.native_tools == 1
    assert summary.http_tools == 1
    assert summary.http_tools_missing_endpoint_tools == 1
    assert summary.mcp_reserved_tools == 1
    assert summary.mcp_reserved_bound_tools == 1
    assert summary.mcp_integration_pending_tools == 0
    assert summary.mcp_connector_configured_tools == 1
    assert summary.runtime_ready_tools == 1


@pytest.mark.anyio
async def test_tool_registry_service_filters_runtime_state_for_mcp_and_missing_endpoint() -> None:
    runtime_ready_tool = build_tool_registration(
        transport_type="native",
        endpoint_url=None,
        is_enabled=True,
    )
    missing_endpoint_tool = build_tool_registration(
        transport_type="http",
        endpoint_url=None,
        is_enabled=True,
    )
    reserved_bound_tool = build_tool_registration(
        transport_type="mcp_reserved",
        endpoint_url=None,
        connector_reference="mcp.browser.primary",
        is_enabled=True,
        requires_admin_approval=False,
    )
    tool_repository = SimpleNamespace(
        list_tool_registrations=AsyncMock(
            return_value=[runtime_ready_tool, missing_endpoint_tool, reserved_bound_tool]
        ),
    )
    agent_repository = SimpleNamespace(
        list_tool_registration_binding_counts=AsyncMock(
            return_value={
                str(runtime_ready_tool.id): 0,
                str(missing_endpoint_tool.id): 0,
                str(reserved_bound_tool.id): 2,
            }
        ),
        count_agents_using_tool_registration=AsyncMock(return_value=0),
    )

    service = ToolRegistryService(tool_repository, agent_repository)

    missing_endpoint_response = await service.list_tool_registrations(runtime_state="missing_endpoint")
    reserved_bound_response = await service.list_tool_registrations(runtime_state="mcp_reserved_bound")
    integration_pending_response = await service.list_tool_registrations(runtime_state="mcp_integration_pending")
    connector_configured_response = await service.list_tool_registrations(runtime_state="mcp_connector_configured")

    assert len(missing_endpoint_response) == 1
    assert missing_endpoint_response[0].id == missing_endpoint_tool.id
    assert len(reserved_bound_response) == 1
    assert reserved_bound_response[0].id == reserved_bound_tool.id
    assert len(integration_pending_response) == 1
    assert integration_pending_response[0].id == reserved_bound_tool.id
    assert len(connector_configured_response) == 1
    assert connector_configured_response[0].id == reserved_bound_tool.id


@pytest.mark.anyio
async def test_retrieval_profile_registry_service_includes_bound_knowledge_base_counts() -> None:
    retrieval_profile = build_retrieval_profile()
    retrieval_profile_repository = SimpleNamespace(
        list_retrieval_profiles=AsyncMock(return_value=[retrieval_profile]),
        list_retrieval_profile_binding_counts=AsyncMock(return_value={str(retrieval_profile.id): 2}),
        count_knowledge_bases_using_retrieval_profile=AsyncMock(return_value=0),
    )

    service = RetrievalProfileRegistryService(retrieval_profile_repository)

    response = await service.list_retrieval_profiles()

    assert len(response) == 1
    assert response[0].bound_knowledge_base_count == 2


@pytest.mark.anyio
async def test_retrieval_profile_registry_service_blocks_delete_when_profile_is_still_bound() -> None:
    retrieval_profile_id = uuid4()
    retrieval_profile_repository = SimpleNamespace(
        delete_retrieval_profile=AsyncMock(return_value=True),
        count_knowledge_bases_using_retrieval_profile=AsyncMock(return_value=1),
    )

    service = RetrievalProfileRegistryService(retrieval_profile_repository)

    with pytest.raises(ResourceConflictError):
        await service.delete_retrieval_profile(retrieval_profile_id=retrieval_profile_id)

    retrieval_profile_repository.delete_retrieval_profile.assert_not_called()
