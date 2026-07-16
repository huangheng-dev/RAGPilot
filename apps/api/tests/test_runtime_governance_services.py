from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from ragpilot_api.application.errors import ResourceConflictError
from ragpilot_api.application.model_registry.model_registry_service import ModelRegistryService
from ragpilot_api.application.retrieval.retrieval_profile_registry_service import RetrievalProfileRegistryService
from ragpilot_api.application.runtime_governance.runtime_governance_worklist_service import RuntimeGovernanceWorklistService
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
        "endpoint_url": "http://localhost:8000/tools/search",
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
async def test_model_registry_service_includes_recent_preview_health_in_list_responses() -> None:
    model_endpoint = build_model_endpoint()
    model_repository = SimpleNamespace(
        list_model_endpoints=AsyncMock(return_value=[model_endpoint]),
    )
    agent_repository = SimpleNamespace(
        list_model_endpoint_binding_counts=AsyncMock(return_value={str(model_endpoint.id): 1}),
        count_agents_using_model_endpoint=AsyncMock(return_value=0),
    )
    runtime_governance_event_repository = SimpleNamespace(
        list_runtime_governance_events=AsyncMock(
            return_value=[
                SimpleNamespace(
                    resource_id=model_endpoint.id,
                    action_type="preview_failed",
                    detail_json={"preview_status": "failed"},
                    created_at=datetime.now(timezone.utc),
                ),
                SimpleNamespace(
                    resource_id=model_endpoint.id,
                    action_type="preview_completed",
                    detail_json={"preview_status": "completed"},
                    created_at=datetime.now(timezone.utc) - timedelta(minutes=5),
                ),
            ]
        )
    )

    service = ModelRegistryService(
        model_repository,
        agent_repository,
        settings=SimpleNamespace(chat_model_request_timeout_seconds=30, model_preview_review_window_hours=24),
        runtime_governance_event_repository=runtime_governance_event_repository,
    )

    response = await service.list_model_endpoints()

    assert len(response) == 1
    assert response[0].recent_preview_failed_events == 1
    assert response[0].recent_preview_completed_events == 1
    assert response[0].last_preview_status == "failed"
    assert response[0].last_preview_at is not None


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
        list_agent_definitions_for_governance=AsyncMock(return_value=[]),
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
    assert summary.runtime_ready_default_endpoints == 1
    assert summary.settings_fallback_exposed is False
    assert summary.disabled_bound_endpoints == 1
    assert summary.runtime_ready_endpoints == 1
    assert summary.missing_base_url_endpoints == 1
    assert summary.managed_reserved_credential_endpoints == 1
    assert summary.no_credential_endpoints == 2
    assert summary.deterministic_endpoints == 1
    assert summary.ollama_endpoints == 1
    assert summary.openai_compatible_endpoints == 1
    assert summary.provider_compatibility[0].provider_type == "deterministic"
    assert summary.provider_compatibility[1].routing_style == "openai_compatible"
    assert summary.provider_compatibility[2].default_base_url_hint == "http://127.0.0.1:11434"
    assert summary.provider_runtime_posture[0].provider_type == "deterministic"
    assert summary.provider_runtime_posture[2].missing_base_url_endpoints == 1


@pytest.mark.anyio
async def test_model_registry_service_includes_recent_preview_health_in_provider_posture() -> None:
    deterministic_endpoint = build_model_endpoint(
        provider_type="deterministic",
        base_url=None,
        credential_mode="none",
        credential_key_hint=None,
        is_enabled=True,
        is_default=True,
    )
    model_repository = SimpleNamespace(
        list_model_endpoints=AsyncMock(return_value=[deterministic_endpoint]),
    )
    agent_repository = SimpleNamespace(
        list_model_endpoint_binding_counts=AsyncMock(return_value={str(deterministic_endpoint.id): 0}),
        list_agent_definitions_for_governance=AsyncMock(return_value=[]),
        count_agents_using_model_endpoint=AsyncMock(return_value=0),
    )
    runtime_governance_event_repository = SimpleNamespace(
        list_runtime_governance_events=AsyncMock(
            return_value=[
                SimpleNamespace(
                    action_type="preview_failed",
                    detail_json={"provider_type": "deterministic", "preview_status": "failed"},
                    created_at=datetime.now(timezone.utc),
                ),
                SimpleNamespace(
                    action_type="preview_completed",
                    detail_json={"provider_type": "deterministic", "preview_status": "completed"},
                    created_at=datetime.now(timezone.utc) - timedelta(minutes=10),
                ),
            ]
        )
    )

    service = ModelRegistryService(
        model_repository,
        agent_repository,
        settings=SimpleNamespace(chat_model_request_timeout_seconds=30, model_preview_review_window_hours=24),
        runtime_governance_event_repository=runtime_governance_event_repository,
    )

    summary = await service.get_model_governance_summary()
    deterministic_posture = next(item for item in summary.provider_runtime_posture if item.provider_type == "deterministic")

    assert deterministic_posture.recent_preview_failed_events == 1
    assert deterministic_posture.recent_preview_completed_events == 1
    assert deterministic_posture.last_preview_status == "failed"
    assert deterministic_posture.last_preview_at is not None
    assert deterministic_posture.posture_status == "attention"


@pytest.mark.anyio
async def test_model_registry_service_marks_settings_fallback_exposed_when_no_runtime_ready_default_exists() -> None:
    disabled_default_endpoint = build_model_endpoint(
        provider_type="openai_compatible",
        base_url="http://localhost:11434/v1",
        credential_mode="environment",
        credential_key_hint="OPENAI_API_KEY",
        is_enabled=False,
        is_default=True,
    )
    non_default_runtime_ready_endpoint = build_model_endpoint(
        provider_type="deterministic",
        base_url=None,
        credential_mode="none",
        credential_key_hint=None,
        is_enabled=True,
        is_default=False,
    )
    model_repository = SimpleNamespace(
        list_model_endpoints=AsyncMock(return_value=[disabled_default_endpoint, non_default_runtime_ready_endpoint]),
    )
    agent_repository = SimpleNamespace(
        list_model_endpoint_binding_counts=AsyncMock(
            return_value={
                str(disabled_default_endpoint.id): 0,
                str(non_default_runtime_ready_endpoint.id): 0,
            }
        ),
        list_agent_definitions_for_governance=AsyncMock(return_value=[]),
        count_agents_using_model_endpoint=AsyncMock(return_value=0),
    )

    service = ModelRegistryService(
        model_repository,
        agent_repository,
        settings=SimpleNamespace(chat_model_request_timeout_seconds=30),
    )

    summary = await service.get_model_governance_summary()

    assert summary.default_endpoints == 1
    assert summary.enabled_default_endpoints == 0
    assert summary.runtime_ready_default_endpoints == 0
    assert summary.settings_fallback_exposed is True
    assert len(summary.provider_compatibility) == 4
    assert len(summary.provider_runtime_posture) == 4


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
        list_agent_definitions_for_governance=AsyncMock(return_value=[]),
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
async def test_runtime_governance_worklist_service_includes_model_runtime_items() -> None:
    unconfigured_model = build_model_endpoint(
        provider_type="ollama",
        base_url=None,
        credential_mode="none",
        credential_key_hint=None,
        recent_preview_completed_events=0,
        recent_preview_blocked_events=0,
        recent_preview_failed_events=1,
        last_preview_status="failed",
        last_preview_at=datetime.now(timezone.utc),
    )
    disabled_bound_model = build_model_endpoint(
        id=uuid4(),
        provider_type="openai_compatible",
        base_url="http://127.0.0.1:8001/v1",
        credential_mode="environment",
        credential_key_hint="OPENAI_API_KEY",
        is_enabled=False,
    )
    approval_tool = build_tool_registration(requires_admin_approval=True)
    blocked_connector = SimpleNamespace(
        id=uuid4(),
        name="Docs MCP Gateway",
        slug="docs-mcp-gateway",
        connector_type="streamable_http",
        auth_mode="none",
        is_enabled=False,
        integration_ready_tool_count=2,
        referenced_tool_count=3,
        base_url="http://127.0.0.1:8899/mcp",
        credential_key_hint=None,
        recent_preview_completed_events=1,
        recent_preview_blocked_events=0,
        recent_preview_failed_events=2,
        last_preview_status="failed",
        last_preview_at=datetime.now(timezone.utc),
    )

    service = RuntimeGovernanceWorklistService(
        model_registry_service=SimpleNamespace(
            list_model_endpoints=AsyncMock(
                side_effect=[
                    [unconfigured_model],
                    [],
                    [disabled_bound_model],
                ]
            )
        ),
        tool_registry_service=SimpleNamespace(
            list_tool_registrations=AsyncMock(
                side_effect=[
                    [approval_tool],
                    [],
                ]
            )
        ),
        mcp_connector_registry_service=SimpleNamespace(
            list_mcp_connectors=AsyncMock(side_effect=[[blocked_connector], [blocked_connector]])
        ),
    )

    response = await service.get_runtime_governance_worklist(limit=10)

    assert response.total_items == 4
    assert response.unconfigured_model_endpoints == 1
    assert response.disabled_bound_model_endpoints == 1
    assert response.approval_required_tools == 1
    assert response.integration_blocked_connectors == 1
    assert response.mcp_integration_pending_tools == 0

    unconfigured_item = next(item for item in response.items if item.category == "unconfigured_model_endpoint")
    assert unconfigured_item.resource_type == "model_endpoint"
    assert unconfigured_item.recent_preview_failed_events == 1
    assert unconfigured_item.last_preview_status == "failed"
    assert unconfigured_item.follow_up is not None
    assert unconfigured_item.follow_up.settings_target is not None
    assert unconfigured_item.follow_up.settings_target.model_provider_type == "ollama"
    assert unconfigured_item.follow_up.agents_target is not None
    assert unconfigured_item.follow_up.agents_target.issue == "model_runtime_unconfigured"

    disabled_item = next(item for item in response.items if item.category == "disabled_bound_model_endpoint")
    assert disabled_item.follow_up is not None
    assert disabled_item.follow_up.agents_target is not None
    assert disabled_item.follow_up.agents_target.issue == "model_disabled"

    connector_item = next(item for item in response.items if item.category == "integration_blocked_connector")
    assert connector_item.recent_preview_failed_events == 2
    assert connector_item.last_preview_status == "failed"
    assert connector_item.last_preview_at is not None


@pytest.mark.anyio
async def test_runtime_governance_worklist_service_filters_items() -> None:
    unconfigured_model = build_model_endpoint(
        provider_type="ollama",
        base_url=None,
        credential_mode="none",
        credential_key_hint=None,
        name="Local Ollama",
        slug="local-ollama",
    )
    approval_tool = build_tool_registration(
        name="Browser Tool",
        slug="browser-tool",
        requires_admin_approval=True,
    )

    service = RuntimeGovernanceWorklistService(
        model_registry_service=SimpleNamespace(
            list_model_endpoints=AsyncMock(
                side_effect=[
                    [unconfigured_model],
                    [],
                    [],
                ]
            )
        ),
        tool_registry_service=SimpleNamespace(
            list_tool_registrations=AsyncMock(
                side_effect=[
                    [approval_tool],
                    [],
                ]
            )
        ),
        mcp_connector_registry_service=SimpleNamespace(
            list_mcp_connectors=AsyncMock(side_effect=[[], []])
        ),
    )

    response = await service.get_runtime_governance_worklist(
        limit=10,
        category="unconfigured_model_endpoint",
        severity="attention",
        resource_type="model_endpoint",
        query="ollama",
    )

    assert response.total_items == 1
    assert response.unconfigured_model_endpoints == 1
    assert response.disabled_bound_model_endpoints == 0
    assert response.approval_required_tools == 0
    assert len(response.items) == 1
    assert response.items[0].resource_slug == "local-ollama"


@pytest.mark.anyio
async def test_runtime_governance_worklist_service_marks_mcp_pending_tool_ready_for_direct_queue_action() -> None:
    ready_connector = SimpleNamespace(
        id=uuid4(),
        name="Browser MCP",
        slug="mcp.browser.primary",
        connector_type="streamable_http",
        auth_mode="none",
        is_enabled=True,
        integration_ready_tool_count=1,
        referenced_tool_count=1,
        base_url="http://127.0.0.1:8899/mcp",
        credential_key_hint=None,
    )
    pending_tool = build_tool_registration(
        transport_type="mcp_reserved",
        endpoint_url=None,
        connector_reference="mcp.browser.primary",
        requires_admin_approval=False,
        is_enabled=True,
        recent_preview_completed_events=0,
        recent_preview_blocked_events=0,
        recent_preview_failed_events=1,
        last_preview_status="failed",
        last_preview_at=datetime.now(timezone.utc),
    )

    service = RuntimeGovernanceWorklistService(
        model_registry_service=SimpleNamespace(
            list_model_endpoints=AsyncMock(side_effect=[[], [], []])
        ),
        tool_registry_service=SimpleNamespace(
            list_tool_registrations=AsyncMock(side_effect=[[], [pending_tool]])
        ),
        mcp_connector_registry_service=SimpleNamespace(
            list_mcp_connectors=AsyncMock(side_effect=[[], [ready_connector]])
        ),
    )

    response = await service.get_runtime_governance_worklist(limit=10)

    assert response.total_items == 1
    assert response.mcp_integration_pending_tools == 1
    pending_item = response.items[0]
    assert pending_item.category == "mcp_integration_pending_tool"
    assert pending_item.severity == "attention"
    assert pending_item.detail["connector_reference"] == "mcp.browser.primary"
    assert pending_item.detail["connector_enabled"] is True
    assert pending_item.detail["connector_runtime_ready"] is True
    assert pending_item.recent_preview_failed_events == 1
    assert pending_item.last_preview_status == "failed"


@pytest.mark.anyio
async def test_runtime_governance_worklist_service_prioritizes_attention_items_with_preview_failures() -> None:
    failed_approval_tool = build_tool_registration(
        name="Browser Tool",
        slug="browser-tool",
        requires_admin_approval=True,
        recent_preview_completed_events=0,
        recent_preview_blocked_events=0,
        recent_preview_failed_events=3,
        last_preview_status="failed",
        last_preview_at=datetime.now(timezone.utc),
    )
    blocked_connector = SimpleNamespace(
        id=uuid4(),
        name="Docs MCP Gateway",
        slug="docs-mcp-gateway",
        connector_type="streamable_http",
        auth_mode="none",
        is_enabled=False,
        integration_ready_tool_count=1,
        referenced_tool_count=2,
        base_url="http://127.0.0.1:8899/mcp",
        credential_key_hint=None,
        recent_preview_completed_events=1,
        recent_preview_blocked_events=0,
        recent_preview_failed_events=0,
        last_preview_status="completed",
        last_preview_at=datetime.now(timezone.utc),
    )

    service = RuntimeGovernanceWorklistService(
        model_registry_service=SimpleNamespace(
            list_model_endpoints=AsyncMock(side_effect=[[], [], []])
        ),
        tool_registry_service=SimpleNamespace(
            list_tool_registrations=AsyncMock(side_effect=[[failed_approval_tool], []])
        ),
        mcp_connector_registry_service=SimpleNamespace(
            list_mcp_connectors=AsyncMock(side_effect=[[blocked_connector], [blocked_connector]])
        ),
    )

    response = await service.get_runtime_governance_worklist(limit=10)

    assert response.total_items == 2
    assert response.items[0].resource_id == failed_approval_tool.id
    assert response.items[0].severity == "attention"
    assert response.items[0].recent_preview_failed_events == 3


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
async def test_model_registry_service_promotes_enabled_endpoint_as_default() -> None:
    model_endpoint = build_model_endpoint(is_enabled=True, is_default=False)
    updated_model_endpoint = build_model_endpoint(
        id=model_endpoint.id,
        slug=model_endpoint.slug,
        is_enabled=True,
        is_default=True,
    )
    model_repository = SimpleNamespace(
        get_model_endpoint=AsyncMock(return_value=model_endpoint),
        update_model_endpoint=AsyncMock(return_value=updated_model_endpoint),
    )
    agent_repository = SimpleNamespace(
        count_agents_using_model_endpoint=AsyncMock(return_value=2),
    )
    service = ModelRegistryService(
        model_repository,
        agent_repository,
        settings=SimpleNamespace(chat_model_request_timeout_seconds=30),
    )

    response = await service.apply_model_endpoint_governance_action(
        model_endpoint_id=model_endpoint.id,
        action_type="promote_default",
    )

    assert response is not None
    assert response.model_endpoint.is_default is True
    assert response.model_endpoint.bound_agent_count == 2
    assert "default" in response.summary.lower()


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
    mcp_connector_repository = SimpleNamespace(
        list_mcp_connectors=AsyncMock(
            return_value=[
                SimpleNamespace(
                    slug="mcp.browser.primary",
                    connector_type="streamable_http",
                    base_url="http://127.0.0.1:8899/mcp",
                    auth_mode="none",
                    credential_key_hint=None,
                    is_enabled=True,
                )
            ]
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

    service = ToolRegistryService(tool_repository, agent_repository, mcp_connector_repository)
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
    assert summary.mcp_connector_unhealthy_tools == 0
    assert summary.runtime_ready_tools == 1


@pytest.mark.anyio
async def test_tool_registry_service_includes_recent_preview_health_in_summary() -> None:
    native_tool = build_tool_registration(
        transport_type="native",
        surface_area="chat",
        endpoint_url=None,
        requires_admin_approval=False,
        is_enabled=True,
    )
    tool_repository = SimpleNamespace(
        list_tool_registrations=AsyncMock(return_value=[native_tool]),
    )
    agent_repository = SimpleNamespace(
        list_tool_registration_binding_counts=AsyncMock(return_value={}),
        count_agents_using_tool_registration=AsyncMock(return_value=0),
    )
    runtime_governance_event_repository = SimpleNamespace(
        list_runtime_governance_events=AsyncMock(
            return_value=[
                SimpleNamespace(
                    action_type="preview_blocked",
                    resource_id=native_tool.id,
                    created_at=datetime.now(timezone.utc) - timedelta(minutes=20),
                    detail_json={"invocation_status": "blocked"},
                ),
                SimpleNamespace(
                    action_type="preview_failed",
                    resource_id=native_tool.id,
                    created_at=datetime.now(timezone.utc) - timedelta(minutes=5),
                    detail_json={"invocation_status": "failed"},
                ),
            ]
        )
    )

    service = ToolRegistryService(
        tool_repository,
        agent_repository,
        None,
        runtime_governance_event_repository,
    )

    summary = await service.get_tool_governance_summary()

    assert summary.recent_preview_blocked_events == 1
    assert summary.recent_preview_failed_events == 1
    assert summary.last_preview_status == "failed"
    assert summary.last_preview_at is not None


@pytest.mark.anyio
async def test_tool_registry_service_includes_recent_preview_health_in_list_responses() -> None:
    native_tool = build_tool_registration(
        transport_type="native",
        surface_area="chat",
        endpoint_url=None,
        requires_admin_approval=False,
        is_enabled=True,
    )
    tool_repository = SimpleNamespace(
        list_tool_registrations=AsyncMock(return_value=[native_tool]),
    )
    agent_repository = SimpleNamespace(
        list_tool_registration_binding_counts=AsyncMock(return_value={str(native_tool.id): 0}),
        count_agents_using_tool_registration=AsyncMock(return_value=0),
    )
    runtime_governance_event_repository = SimpleNamespace(
        list_runtime_governance_events=AsyncMock(
            return_value=[
                SimpleNamespace(
                    action_type="preview_blocked",
                    resource_id=native_tool.id,
                    created_at=datetime.now(timezone.utc) - timedelta(minutes=8),
                    detail_json={"invocation_status": "blocked"},
                ),
                SimpleNamespace(
                    action_type="preview_completed",
                    resource_id=native_tool.id,
                    created_at=datetime.now(timezone.utc) - timedelta(minutes=1),
                    detail_json={"invocation_status": "completed"},
                ),
            ]
        )
    )

    service = ToolRegistryService(
        tool_repository,
        agent_repository,
        None,
        runtime_governance_event_repository,
    )

    responses = await service.list_tool_registrations()

    assert len(responses) == 1
    assert responses[0].recent_preview_blocked_events == 1
    assert responses[0].recent_preview_completed_events == 1
    assert responses[0].last_preview_status == "completed"
    assert responses[0].last_preview_at is not None


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
    mcp_connector_repository = SimpleNamespace(
        list_mcp_connectors=AsyncMock(
            return_value=[
                SimpleNamespace(
                    slug="mcp.browser.primary",
                    connector_type="streamable_http",
                    base_url="http://127.0.0.1:8899/mcp",
                    auth_mode="none",
                    credential_key_hint=None,
                    is_enabled=True,
                )
            ]
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

    service = ToolRegistryService(tool_repository, agent_repository, mcp_connector_repository)

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
async def test_tool_registry_service_marks_connector_unhealthy_for_reserved_mcp_tools() -> None:
    reserved_tool_with_broken_connector = build_tool_registration(
        transport_type="mcp_reserved",
        endpoint_url=None,
        connector_reference="mcp.browser.broken",
        is_enabled=True,
        requires_admin_approval=False,
    )
    tool_repository = SimpleNamespace(
        list_tool_registrations=AsyncMock(return_value=[reserved_tool_with_broken_connector]),
    )
    mcp_connector_repository = SimpleNamespace(
        list_mcp_connectors=AsyncMock(
            return_value=[
                SimpleNamespace(
                    slug="mcp.browser.broken",
                    connector_type="sse",
                    base_url=None,
                    auth_mode="environment",
                    credential_key_hint=None,
                    is_enabled=True,
                )
            ]
        ),
    )
    agent_repository = SimpleNamespace(
        list_tool_registration_binding_counts=AsyncMock(return_value={str(reserved_tool_with_broken_connector.id): 1}),
        count_agents_using_tool_registration=AsyncMock(return_value=0),
    )

    service = ToolRegistryService(tool_repository, agent_repository, mcp_connector_repository)

    summary = await service.get_tool_governance_summary()
    unhealthy = await service.list_tool_registrations(runtime_state="mcp_connector_unhealthy")

    assert summary.mcp_connector_configured_tools == 1
    assert summary.mcp_connector_unhealthy_tools == 1
    assert len(unhealthy) == 1
    assert unhealthy[0].id == reserved_tool_with_broken_connector.id


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


@pytest.mark.anyio
async def test_retrieval_profile_registry_service_disables_profile_through_governance_action() -> None:
    retrieval_profile = build_retrieval_profile(is_enabled=True, is_default=False)
    updated_retrieval_profile = build_retrieval_profile(
        id=retrieval_profile.id,
        slug=retrieval_profile.slug,
        is_enabled=False,
        is_default=False,
    )
    retrieval_profile_repository = SimpleNamespace(
        get_retrieval_profile=AsyncMock(return_value=retrieval_profile),
        update_retrieval_profile=AsyncMock(return_value=updated_retrieval_profile),
        count_knowledge_bases_using_retrieval_profile=AsyncMock(return_value=3),
    )

    service = RetrievalProfileRegistryService(retrieval_profile_repository)

    response = await service.apply_retrieval_profile_governance_action(
        retrieval_profile_id=retrieval_profile.id,
        action_type="disable_profile",
    )

    assert response is not None
    assert response.retrieval_profile.is_enabled is False
    assert response.retrieval_profile.bound_knowledge_base_count == 3
    assert "disabled" in response.summary.lower()
