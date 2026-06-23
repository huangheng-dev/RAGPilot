from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from ragpilot_api.application.errors import ResourceConflictError
from ragpilot_api.application.tool_registry.tool_registry_service import ToolRegistryService


def build_tool_registration(**overrides):
    now = datetime.now(timezone.utc)
    defaults = {
        "id": uuid4(),
        "name": "Governed Browser Tool",
        "slug": "governed-browser-tool",
        "transport_type": "http",
        "surface_area": "agents",
        "endpoint_url": "http://127.0.0.1:9010/invoke",
        "connector_reference": None,
        "description": "Approval-gated browser automation.",
        "capabilities_json": ["browser.navigate"],
        "requires_admin_approval": False,
        "is_enabled": True,
        "created_at": now,
        "updated_at": now,
    }
    return SimpleNamespace(**{**defaults, **overrides})


@pytest.mark.anyio
async def test_tool_registry_service_quarantines_tool_registration() -> None:
    tool_registration = build_tool_registration()
    updated_tool_registration = build_tool_registration(
        id=tool_registration.id,
        requires_admin_approval=True,
        is_enabled=False,
    )
    repository = SimpleNamespace(
        get_tool_registration=AsyncMock(return_value=tool_registration),
        update_tool_registration=AsyncMock(return_value=updated_tool_registration),
    )
    agent_repository = SimpleNamespace(
        count_agents_using_tool_registration=AsyncMock(return_value=2),
    )
    service = ToolRegistryService(repository, agent_repository)

    response = await service.apply_tool_governance_action(
        tool_registration_id=tool_registration.id,
        action_type="quarantine_tool",
    )

    repository.update_tool_registration.assert_awaited_once()
    update_kwargs = repository.update_tool_registration.await_args.kwargs
    assert update_kwargs["is_enabled"] is False
    assert update_kwargs["requires_admin_approval"] is True
    assert response is not None
    assert response.action_type == "quarantine_tool"
    assert response.tool_registration.is_enabled is False
    assert response.tool_registration.requires_admin_approval is True
    assert response.tool_registration.bound_agent_count == 2


@pytest.mark.anyio
async def test_tool_registry_service_allows_direct_use() -> None:
    tool_registration = build_tool_registration(requires_admin_approval=True)
    updated_tool_registration = build_tool_registration(
        id=tool_registration.id,
        requires_admin_approval=False,
        is_enabled=True,
    )
    repository = SimpleNamespace(
        get_tool_registration=AsyncMock(return_value=tool_registration),
        update_tool_registration=AsyncMock(return_value=updated_tool_registration),
    )
    agent_repository = SimpleNamespace(
        count_agents_using_tool_registration=AsyncMock(return_value=1),
    )
    service = ToolRegistryService(repository, agent_repository)

    response = await service.apply_tool_governance_action(
        tool_registration_id=tool_registration.id,
        action_type="allow_direct_use",
    )

    update_kwargs = repository.update_tool_registration.await_args.kwargs
    assert update_kwargs["requires_admin_approval"] is False
    assert update_kwargs["is_enabled"] is True
    assert response is not None
    assert response.action_type == "allow_direct_use"
    assert response.tool_registration.requires_admin_approval is False


@pytest.mark.anyio
async def test_tool_registry_service_marks_reserved_mcp_boundary_ready_for_integration() -> None:
    tool_registration = build_tool_registration(
        transport_type="mcp_reserved",
        endpoint_url=None,
        connector_reference="mcp.browser.primary",
        requires_admin_approval=True,
    )
    updated_tool_registration = build_tool_registration(
        id=tool_registration.id,
        transport_type="mcp_reserved",
        endpoint_url=None,
        connector_reference="mcp.browser.primary",
        requires_admin_approval=False,
        is_enabled=True,
    )
    repository = SimpleNamespace(
        get_tool_registration=AsyncMock(return_value=tool_registration),
        update_tool_registration=AsyncMock(return_value=updated_tool_registration),
    )
    agent_repository = SimpleNamespace(
        count_agents_using_tool_registration=AsyncMock(return_value=3),
    )
    connector_repository = SimpleNamespace(
        get_mcp_connector_by_slug=AsyncMock(
            return_value=SimpleNamespace(
                slug="mcp.browser.primary",
                connector_type="streamable_http",
                base_url="http://127.0.0.1:8899/mcp",
                auth_mode="none",
                credential_key_hint=None,
                is_enabled=True,
            )
        )
    )
    service = ToolRegistryService(repository, agent_repository, connector_repository)

    response = await service.apply_tool_governance_action(
        tool_registration_id=tool_registration.id,
        action_type="ready_mcp_integration",
    )

    update_kwargs = repository.update_tool_registration.await_args.kwargs
    assert update_kwargs["requires_admin_approval"] is False
    assert update_kwargs["is_enabled"] is True
    assert response is not None
    assert response.action_type == "ready_mcp_integration"
    assert response.tool_registration.requires_admin_approval is False
    assert response.tool_registration.bound_agent_count == 3


@pytest.mark.anyio
async def test_tool_registry_service_rejects_ready_mcp_integration_when_connector_reference_is_unresolved() -> None:
    tool_registration = build_tool_registration(
        transport_type="mcp_reserved",
        endpoint_url=None,
        connector_reference="mcp.browser.primary",
        requires_admin_approval=True,
    )
    repository = SimpleNamespace(
        get_tool_registration=AsyncMock(return_value=tool_registration),
        update_tool_registration=AsyncMock(),
    )
    agent_repository = SimpleNamespace(
        count_agents_using_tool_registration=AsyncMock(return_value=0),
    )
    connector_repository = SimpleNamespace(
        get_mcp_connector_by_slug=AsyncMock(return_value=None),
    )
    service = ToolRegistryService(repository, agent_repository, connector_repository)

    with pytest.raises(ResourceConflictError):
        await service.apply_tool_governance_action(
            tool_registration_id=tool_registration.id,
            action_type="ready_mcp_integration",
        )

    repository.update_tool_registration.assert_not_called()


@pytest.mark.anyio
async def test_tool_registry_service_rejects_ready_mcp_integration_without_connector_reference() -> None:
    tool_registration = build_tool_registration(
        transport_type="mcp_reserved",
        endpoint_url=None,
        connector_reference=None,
        requires_admin_approval=True,
    )
    repository = SimpleNamespace(
        get_tool_registration=AsyncMock(return_value=tool_registration),
        update_tool_registration=AsyncMock(),
    )
    agent_repository = SimpleNamespace(
        count_agents_using_tool_registration=AsyncMock(return_value=0),
    )
    service = ToolRegistryService(repository, agent_repository)

    with pytest.raises(ResourceConflictError):
        await service.apply_tool_governance_action(
            tool_registration_id=tool_registration.id,
            action_type="ready_mcp_integration",
        )

    repository.update_tool_registration.assert_not_called()


@pytest.mark.anyio
async def test_tool_registry_service_rejects_mcp_boundary_action_for_non_reserved_tool() -> None:
    tool_registration = build_tool_registration(transport_type="http")
    repository = SimpleNamespace(
        get_tool_registration=AsyncMock(return_value=tool_registration),
        update_tool_registration=AsyncMock(),
    )
    agent_repository = SimpleNamespace(
        count_agents_using_tool_registration=AsyncMock(return_value=0),
    )
    service = ToolRegistryService(repository, agent_repository)

    with pytest.raises(ResourceConflictError):
        await service.apply_tool_governance_action(
            tool_registration_id=tool_registration.id,
            action_type="review_mcp_boundary",
        )

    repository.update_tool_registration.assert_not_called()
