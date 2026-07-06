from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from ragpilot_api.application.errors import ResourceConflictError
from ragpilot_api.application.mcp_connectors.mcp_connector_registry_service import McpConnectorRegistryService


def build_mcp_connector(**overrides):
    defaults = {
        "id": uuid4(),
        "name": "Primary Browser Bridge",
        "slug": "mcp-browser-primary",
        "connector_type": "streamable_http",
        "base_url": "http://127.0.0.1:8899/mcp",
        "auth_mode": "none",
        "credential_key_hint": None,
        "notes": "Primary browser connector.",
        "is_enabled": True,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    return SimpleNamespace(**{**defaults, **overrides})


def build_tool_registration(**overrides):
    defaults = {
        "id": uuid4(),
        "transport_type": "mcp_reserved",
        "connector_reference": "mcp-browser-primary",
        "requires_admin_approval": False,
        "is_enabled": True,
    }
    return SimpleNamespace(**{**defaults, **overrides})


@pytest.mark.anyio
async def test_mcp_connector_registry_service_builds_summary_and_reference_counts() -> None:
    ready_connector = build_mcp_connector()
    missing_base_url_connector = build_mcp_connector(
        slug="mcp-sse-secondary",
        connector_type="sse",
        base_url=None,
        auth_mode="environment",
        credential_key_hint=None,
    )
    reserved_connector = build_mcp_connector(
        slug="mcp-managed-reserved",
        connector_type="managed_reserved",
        base_url=None,
        auth_mode="managed_reserved",
        is_enabled=False,
    )
    connector_repository = SimpleNamespace(
        list_mcp_connectors=AsyncMock(return_value=[ready_connector, missing_base_url_connector, reserved_connector]),
    )
    tool_registration_repository = SimpleNamespace(
        list_tool_registrations=AsyncMock(
            return_value=[
                build_tool_registration(connector_reference=ready_connector.slug, is_enabled=True, requires_admin_approval=False),
                build_tool_registration(connector_reference=ready_connector.slug, is_enabled=True, requires_admin_approval=True),
                build_tool_registration(connector_reference=missing_base_url_connector.slug, is_enabled=False, requires_admin_approval=True),
            ]
        ),
    )

    service = McpConnectorRegistryService(connector_repository, tool_registration_repository)

    summary = await service.get_mcp_connector_governance_summary()
    connectors = await service.list_mcp_connectors(runtime_state="referenced")

    assert summary.total_connectors == 3
    assert summary.enabled_connectors == 2
    assert summary.disabled_connectors == 1
    assert summary.referenced_connectors == 2
    assert summary.integration_ready_connectors == 1
    assert summary.blocked_integration_connectors == 0
    assert summary.runtime_ready_connectors == 1
    assert summary.missing_base_url_connectors == 1
    assert summary.environment_auth_connectors == 1
    assert summary.missing_credential_hint_connectors == 1
    assert summary.managed_reserved_connectors == 1
    assert len(connectors) == 2
    assert connectors[0].slug == ready_connector.slug
    assert connectors[0].referenced_tool_count == 2
    assert connectors[0].integration_ready_tool_count == 1


@pytest.mark.anyio
async def test_mcp_connector_registry_service_marks_integration_blocked_connectors() -> None:
    blocked_connector = build_mcp_connector(
        slug="mcp-sse-blocked",
        connector_type="sse",
        base_url=None,
        auth_mode="environment",
        credential_key_hint=None,
    )
    connector_repository = SimpleNamespace(
        list_mcp_connectors=AsyncMock(return_value=[blocked_connector]),
    )
    tool_registration_repository = SimpleNamespace(
        list_tool_registrations=AsyncMock(
            return_value=[
                build_tool_registration(
                    connector_reference=blocked_connector.slug,
                    is_enabled=True,
                    requires_admin_approval=False,
                )
            ]
        ),
    )

    service = McpConnectorRegistryService(connector_repository, tool_registration_repository)

    summary = await service.get_mcp_connector_governance_summary()
    blocked = await service.list_mcp_connectors(runtime_state="integration_blocked")

    assert summary.integration_ready_connectors == 1
    assert summary.blocked_integration_connectors == 1
    assert len(blocked) == 1
    assert blocked[0].slug == blocked_connector.slug


@pytest.mark.anyio
async def test_mcp_connector_registry_service_includes_recent_preview_health_in_summary() -> None:
    connector = build_mcp_connector()
    connector_repository = SimpleNamespace(
        list_mcp_connectors=AsyncMock(return_value=[connector]),
    )
    tool_registration_repository = SimpleNamespace(
        list_tool_registrations=AsyncMock(return_value=[]),
    )
    runtime_governance_event_repository = SimpleNamespace(
        list_runtime_governance_events=AsyncMock(
            return_value=[
                SimpleNamespace(
                    action_type="preview_completed",
                    resource_id=connector.id,
                    created_at=datetime.now(timezone.utc) - timedelta(minutes=20),
                    detail_json={"preview_status": "completed"},
                ),
                SimpleNamespace(
                    action_type="preview_failed",
                    resource_id=connector.id,
                    created_at=datetime.now(timezone.utc) - timedelta(minutes=5),
                    detail_json={"preview_status": "failed"},
                ),
            ]
        )
    )

    service = McpConnectorRegistryService(
        connector_repository,
        tool_registration_repository,
        runtime_governance_event_repository,
    )

    summary = await service.get_mcp_connector_governance_summary()

    assert summary.recent_preview_completed_events == 1
    assert summary.recent_preview_failed_events == 1
    assert summary.last_preview_status == "failed"
    assert summary.last_preview_at is not None


@pytest.mark.anyio
async def test_mcp_connector_registry_service_includes_recent_preview_health_in_list_responses() -> None:
    connector = build_mcp_connector()
    connector_repository = SimpleNamespace(
        list_mcp_connectors=AsyncMock(return_value=[connector]),
    )
    tool_registration_repository = SimpleNamespace(
        list_tool_registrations=AsyncMock(return_value=[]),
    )
    runtime_governance_event_repository = SimpleNamespace(
        list_runtime_governance_events=AsyncMock(
            return_value=[
                SimpleNamespace(
                    action_type="preview_blocked",
                    resource_id=connector.id,
                    created_at=datetime.now(timezone.utc) - timedelta(minutes=10),
                    detail_json={"preview_status": "blocked"},
                ),
                SimpleNamespace(
                    action_type="preview_completed",
                    resource_id=connector.id,
                    created_at=datetime.now(timezone.utc) - timedelta(minutes=2),
                    detail_json={"preview_status": "completed"},
                ),
            ]
        )
    )

    service = McpConnectorRegistryService(
        connector_repository,
        tool_registration_repository,
        runtime_governance_event_repository,
    )

    responses = await service.list_mcp_connectors()

    assert len(responses) == 1
    assert responses[0].recent_preview_blocked_events == 1
    assert responses[0].recent_preview_completed_events == 1
    assert responses[0].last_preview_status == "completed"
    assert responses[0].last_preview_at is not None


@pytest.mark.anyio
async def test_mcp_connector_registry_service_blocks_delete_when_connector_is_still_referenced() -> None:
    connector = build_mcp_connector()
    connector_repository = SimpleNamespace(
        get_mcp_connector=AsyncMock(return_value=connector),
        delete_mcp_connector=AsyncMock(return_value=True),
    )
    tool_registration_repository = SimpleNamespace(
        list_tool_registrations=AsyncMock(
            return_value=[build_tool_registration(connector_reference=connector.slug)]
        ),
    )
    service = McpConnectorRegistryService(connector_repository, tool_registration_repository)

    with pytest.raises(ResourceConflictError):
        await service.delete_mcp_connector(mcp_connector_id=connector.id)

    connector_repository.delete_mcp_connector.assert_not_called()


@pytest.mark.anyio
async def test_mcp_connector_registry_service_previews_remote_connector_reachability(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    connector = build_mcp_connector()
    connector_repository = SimpleNamespace(
        get_mcp_connector=AsyncMock(return_value=connector),
    )
    tool_registration_repository = SimpleNamespace(
        list_tool_registrations=AsyncMock(return_value=[]),
    )
    service = McpConnectorRegistryService(connector_repository, tool_registration_repository)

    class FakeResponse:
        status_code = 200
        headers = {"content-type": "application/json"}

    class FakeAsyncClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def get(self, url):
            assert url == connector.base_url
            return FakeResponse()

    monkeypatch.setattr(
        "ragpilot_api.application.mcp_connectors.mcp_connector_registry_service.httpx.AsyncClient",
        FakeAsyncClient,
    )

    response = await service.preview_mcp_connector(mcp_connector_id=connector.id)

    assert response.preview_status == "completed"
    assert response.response_metadata["status_code"] == 200


@pytest.mark.anyio
async def test_mcp_connector_registry_service_enables_connector_through_governance_action() -> None:
    connector = build_mcp_connector(is_enabled=False)
    updated_connector = build_mcp_connector(
        id=connector.id,
        slug=connector.slug,
        is_enabled=True,
    )
    connector_repository = SimpleNamespace(
        get_mcp_connector=AsyncMock(return_value=connector),
        update_mcp_connector=AsyncMock(return_value=updated_connector),
    )
    tool_registration_repository = SimpleNamespace(
        list_tool_registrations=AsyncMock(return_value=[build_tool_registration(connector_reference=connector.slug)]),
    )
    service = McpConnectorRegistryService(connector_repository, tool_registration_repository)

    response = await service.apply_mcp_connector_governance_action(
        mcp_connector_id=connector.id,
        action_type="enable_connector",
    )

    assert response is not None
    assert response.action_type == "enable_connector"
    assert response.mcp_connector.is_enabled is True
    assert "enabled" in response.summary.lower()
