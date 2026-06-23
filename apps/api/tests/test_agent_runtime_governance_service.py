from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from ragpilot_api.application.agents.agent_runtime_governance_service import AgentRuntimeGovernanceService


def build_agent_definition(**overrides):
    defaults = {
        "id": uuid4(),
        "tenant_id": uuid4(),
        "name": "Grounded Support Agent",
        "slug": "grounded-support-agent",
        "agent_mode": "grounded_chat",
        "agent_status": "active",
        "objective": "Answer grounded support questions.",
        "knowledge_base_scope": "ragpilot-operations/ragpilot-handbook",
        "model_endpoint_id": None,
        "tool_bindings_json": [],
        "tool_registration_ids_json": [],
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    return SimpleNamespace(**{**defaults, **overrides})


def build_model_endpoint(**overrides):
    defaults = {
        "id": uuid4(),
        "name": "Primary Chat",
        "slug": "primary-chat",
        "provider_type": "openai_compatible",
        "model_name": "gpt-4.1-mini",
        "capabilities_json": ["chat"],
        "is_enabled": True,
        "is_default": True,
    }
    return SimpleNamespace(**{**defaults, **overrides})


def build_tool_registration(**overrides):
    defaults = {
        "id": uuid4(),
        "name": "Recovery Tool",
        "slug": "recovery-tool",
        "requires_admin_approval": False,
        "is_enabled": True,
        "transport_type": "native",
        "connector_reference": None,
    }
    return SimpleNamespace(**{**defaults, **overrides})


def build_retrieval_profile(**overrides):
    defaults = {
        "id": uuid4(),
        "name": "Default Hybrid",
        "slug": "default-hybrid",
        "retrieval_mode": "hybrid",
        "is_enabled": True,
        "is_default": True,
    }
    return SimpleNamespace(**{**defaults, **overrides})


def build_workspace(**overrides):
    defaults = {
        "id": uuid4(),
        "name": "RagPilot Operations",
        "slug": "ragpilot-operations",
    }
    return SimpleNamespace(**{**defaults, **overrides})


def build_knowledge_base(**overrides):
    defaults = {
        "id": uuid4(),
        "name": "RagPilot Handbook",
        "slug": "ragpilot-handbook",
        "retrieval_profile_id": None,
    }
    return SimpleNamespace(**{**defaults, **overrides})


@pytest.mark.anyio
async def test_agent_runtime_governance_service_builds_issue_posture() -> None:
    tenant_id = uuid4()
    disabled_retrieval_profile = build_retrieval_profile(is_enabled=False, is_default=False)
    default_model_endpoint = build_model_endpoint()
    blocked_tool_registration = build_tool_registration(is_enabled=False, requires_admin_approval=True)
    workspace = build_workspace()
    knowledge_base = build_knowledge_base(
        retrieval_profile_id=disabled_retrieval_profile.id,
    )
    agent_definition = build_agent_definition(
        tenant_id=tenant_id,
        tool_registration_ids_json=[str(blocked_tool_registration.id)],
    )

    service = AgentRuntimeGovernanceService(
        agent_repository=SimpleNamespace(
            list_agent_definitions_for_governance=AsyncMock(return_value=[agent_definition])
        ),
        model_endpoint_repository=SimpleNamespace(
            list_model_endpoints=AsyncMock(return_value=[default_model_endpoint])
        ),
        tool_registration_repository=SimpleNamespace(
            list_tool_registrations=AsyncMock(return_value=[blocked_tool_registration])
        ),
        retrieval_profile_repository=SimpleNamespace(
            list_retrieval_profiles=AsyncMock(return_value=[disabled_retrieval_profile])
        ),
        workspace_repository=SimpleNamespace(
            list_workspaces=AsyncMock(return_value=[workspace])
        ),
        knowledge_base_repository=SimpleNamespace(
            list_knowledge_bases=AsyncMock(return_value=[knowledge_base])
        ),
    )

    response = await service.get_runtime_governance_posture(tenant_id=tenant_id, status="active")

    assert response.summary.total_agents == 1
    assert response.summary.attention_agents == 1
    assert response.summary.ready_agents == 0
    assert response.summary.agents_using_disabled_retrieval_profile == 1
    assert response.summary.agents_using_disabled_tool_registration == 1
    assert response.summary.approval_gated_tools == 1
    assert response.summary.disabled_bound_tools == 1
    assert response.summary.issue_counts.retrieval_profile_disabled == 1
    assert response.summary.issue_counts.tool_registration_disabled == 1
    assert response.summary.issue_counts.tool_approval_required == 1
    assert response.summary.issue_counts.tool_mcp_reserved == 0
    assert response.summary.issue_counts.tool_mcp_integration_pending == 0

    assert len(response.items) == 1
    item = response.items[0]
    assert item.is_ready is False
    assert item.resolved_model_endpoint is not None
    assert item.resolved_model_endpoint.id == default_model_endpoint.id
    assert item.resolved_retrieval_profile is not None
    assert item.resolved_retrieval_profile.id == disabled_retrieval_profile.id
    assert item.resolved_retrieval_profile.source == "knowledge_base"
    assert "retrieval_profile_disabled" in item.issues
    assert "tool_registration_disabled" in item.issues
    assert "tool_approval_required" in item.issues
    assert item.reserved_mcp_tool_count == 0
    assert item.integration_pending_mcp_tool_count == 0


@pytest.mark.anyio
async def test_agent_runtime_governance_service_applies_runtime_filters() -> None:
    tenant_id = uuid4()
    default_model_endpoint = build_model_endpoint()
    disabled_retrieval_profile = build_retrieval_profile(is_enabled=False, is_default=False)
    healthy_retrieval_profile = build_retrieval_profile()
    blocked_tool_registration = build_tool_registration(is_enabled=False, requires_admin_approval=True)
    healthy_tool_registration = build_tool_registration()
    workspace = build_workspace()
    blocked_knowledge_base = build_knowledge_base(
        retrieval_profile_id=disabled_retrieval_profile.id,
    )
    healthy_knowledge_base = build_knowledge_base(
        id=uuid4(),
        slug="healthy-knowledge-base",
        retrieval_profile_id=healthy_retrieval_profile.id,
    )
    blocked_agent = build_agent_definition(
        tenant_id=tenant_id,
        tool_registration_ids_json=[str(blocked_tool_registration.id)],
    )
    healthy_agent = build_agent_definition(
        id=uuid4(),
        tenant_id=tenant_id,
        slug="healthy-agent",
        knowledge_base_scope=f"{workspace.slug}/{healthy_knowledge_base.slug}",
        tool_registration_ids_json=[str(healthy_tool_registration.id)],
    )

    service = AgentRuntimeGovernanceService(
        agent_repository=SimpleNamespace(
            list_agent_definitions_for_governance=AsyncMock(return_value=[blocked_agent, healthy_agent])
        ),
        model_endpoint_repository=SimpleNamespace(
            list_model_endpoints=AsyncMock(return_value=[default_model_endpoint])
        ),
        tool_registration_repository=SimpleNamespace(
            list_tool_registrations=AsyncMock(return_value=[blocked_tool_registration, healthy_tool_registration])
        ),
        retrieval_profile_repository=SimpleNamespace(
            list_retrieval_profiles=AsyncMock(return_value=[disabled_retrieval_profile, healthy_retrieval_profile])
        ),
        workspace_repository=SimpleNamespace(
            list_workspaces=AsyncMock(return_value=[workspace])
        ),
        knowledge_base_repository=SimpleNamespace(
            list_knowledge_bases=AsyncMock(return_value=[blocked_knowledge_base, healthy_knowledge_base])
        ),
    )

    response = await service.get_runtime_governance_posture(
        tenant_id=tenant_id,
        status="active",
        readiness="attention",
        issue="tool_registration_disabled",
        model_endpoint_id=default_model_endpoint.id,
        tool_registration_id=blocked_tool_registration.id,
        retrieval_profile_id=disabled_retrieval_profile.id,
    )

    assert response.summary.total_agents == 1
    assert response.summary.attention_agents == 1
    assert response.summary.ready_agents == 0
    assert response.summary.issue_counts.tool_registration_disabled == 1
    assert len(response.items) == 1
    assert response.items[0].id == blocked_agent.id


@pytest.mark.anyio
async def test_agent_runtime_governance_service_tracks_reserved_and_pending_mcp_issues() -> None:
    tenant_id = uuid4()
    default_model_endpoint = build_model_endpoint()
    default_retrieval_profile = build_retrieval_profile()
    workspace = build_workspace()
    reserved_tool = build_tool_registration(
        transport_type="mcp_reserved",
        connector_reference=None,
    )
    pending_tool = build_tool_registration(
        id=uuid4(),
        slug="pending-mcp-tool",
        transport_type="mcp_reserved",
        connector_reference="mcp-browser-primary",
    )
    reserved_knowledge_base = build_knowledge_base(retrieval_profile_id=default_retrieval_profile.id)
    pending_knowledge_base = build_knowledge_base(
        id=uuid4(),
        slug="pending-knowledge-base",
        retrieval_profile_id=default_retrieval_profile.id,
    )
    reserved_agent = build_agent_definition(
        tenant_id=tenant_id,
        tool_registration_ids_json=[str(reserved_tool.id)],
    )
    pending_agent = build_agent_definition(
        id=uuid4(),
        slug="pending-agent",
        knowledge_base_scope=f"{workspace.slug}/{pending_knowledge_base.slug}",
        tenant_id=tenant_id,
        tool_registration_ids_json=[str(pending_tool.id)],
    )

    service = AgentRuntimeGovernanceService(
        agent_repository=SimpleNamespace(
            list_agent_definitions_for_governance=AsyncMock(return_value=[reserved_agent, pending_agent])
        ),
        model_endpoint_repository=SimpleNamespace(
            list_model_endpoints=AsyncMock(return_value=[default_model_endpoint])
        ),
        tool_registration_repository=SimpleNamespace(
            list_tool_registrations=AsyncMock(return_value=[reserved_tool, pending_tool])
        ),
        retrieval_profile_repository=SimpleNamespace(
            list_retrieval_profiles=AsyncMock(return_value=[default_retrieval_profile])
        ),
        workspace_repository=SimpleNamespace(
            list_workspaces=AsyncMock(return_value=[workspace])
        ),
        knowledge_base_repository=SimpleNamespace(
            list_knowledge_bases=AsyncMock(return_value=[reserved_knowledge_base, pending_knowledge_base])
        ),
    )

    response = await service.get_runtime_governance_posture(tenant_id=tenant_id, status="active")

    assert response.summary.issue_counts.tool_mcp_reserved == 1
    assert response.summary.issue_counts.tool_mcp_integration_pending == 1
    reserved_item = next(item for item in response.items if item.id == reserved_agent.id)
    pending_item = next(item for item in response.items if item.id == pending_agent.id)
    assert "tool_mcp_reserved" in reserved_item.issues
    assert reserved_item.reserved_mcp_tool_count == 1
    assert reserved_item.integration_pending_mcp_tool_count == 0
    assert reserved_item.is_ready is False
    assert "tool_mcp_integration_pending" in pending_item.issues
    assert pending_item.reserved_mcp_tool_count == 0
    assert pending_item.integration_pending_mcp_tool_count == 1
    assert pending_item.is_ready is False
