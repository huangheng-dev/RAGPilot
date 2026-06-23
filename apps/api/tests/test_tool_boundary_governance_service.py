from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from ragpilot_api.application.tool_runtime.tool_boundary_governance_service import ToolBoundaryGovernanceService


def build_reserved_tool_registration(**overrides):
    now = datetime.now(timezone.utc)
    defaults = {
        "id": uuid4(),
        "name": "Reserved MCP Browser",
        "slug": "reserved-mcp-browser",
        "transport_type": "mcp_reserved",
        "surface_area": "agents",
        "endpoint_url": None,
        "connector_reference": None,
        "description": "Reserved MCP boundary.",
        "capabilities_json": ["browser.navigate"],
        "requires_admin_approval": True,
        "is_enabled": True,
        "created_at": now,
        "updated_at": now,
    }
    return SimpleNamespace(**{**defaults, **overrides})


def build_agent_execution_with_reserved_trace(*, tool_registration_id, executed_at=None, tenant_id=None, summary="Reserved MCP boundary invoked."):
    trace_time = executed_at or datetime.now(timezone.utc)
    return SimpleNamespace(
        id=uuid4(),
        tenant_id=tenant_id or uuid4(),
        agent_definition_id=uuid4(),
        execution_mode="workflow_recovery",
        execution_status="completed",
        trigger_source="agents_console",
        result_payload_json={
            "tool_runtime": {
                "traces": [
                    {
                        "tool_registration_id": str(tool_registration_id),
                        "name": "Reserved MCP Browser",
                        "slug": "reserved-mcp-browser",
                        "transport_type": "mcp_reserved",
                        "surface_area": "agents",
                        "invocation_status": "reserved",
                        "endpoint_url": None,
                        "summary": summary,
                        "capability_results": {},
                        "request_metadata": {},
                        "response_metadata": {},
                        "error_message": None,
                        "executed_at": trace_time.isoformat(),
                    }
                ]
            }
        },
    )


@pytest.mark.anyio
async def test_tool_boundary_governance_service_aggregates_reserved_tool_worklist() -> None:
    tenant_id = uuid4()
    primary_tool = build_reserved_tool_registration(connector_reference="mcp.browser.primary")
    secondary_tool = build_reserved_tool_registration(requires_admin_approval=False)
    recent_execution = build_agent_execution_with_reserved_trace(
        tool_registration_id=primary_tool.id,
        executed_at=datetime.now(timezone.utc),
        tenant_id=tenant_id,
    )
    older_execution = build_agent_execution_with_reserved_trace(
        tool_registration_id=primary_tool.id,
        executed_at=datetime.now(timezone.utc).replace(microsecond=0),
        tenant_id=tenant_id,
        summary="Older reserved boundary review.",
    )

    service = ToolBoundaryGovernanceService(
        tool_registration_repository=SimpleNamespace(
            list_tool_registrations=AsyncMock(return_value=[primary_tool, secondary_tool])
        ),
        agent_repository=SimpleNamespace(
            list_tool_registration_binding_counts=AsyncMock(
                return_value={
                    str(primary_tool.id): 2,
                    str(secondary_tool.id): 0,
                }
            )
        ),
        agent_execution_repository=SimpleNamespace(
            list_agent_executions=AsyncMock(return_value=[recent_execution, older_execution])
        ),
    )

    response = await service.list_mcp_boundary_worklist(
        tenant_id=tenant_id,
        limit=10,
    )

    assert response.total_reserved_tools == 2
    assert response.bound_reserved_tools == 1
    assert response.reserved_trace_count == 2
    assert response.reviewing_tools == 1
    assert response.ready_for_integration_tools == 1
    assert response.quarantined_tools == 0
    assert response.items[0].tool_registration_id == primary_tool.id
    assert response.items[0].boundary_status == "reviewing"
    assert response.items[0].bound_agent_count == 2
    assert response.items[0].reserved_trace_count == 2
    assert response.items[0].available_actions == ["ready_mcp_integration", "quarantine_mcp_boundary"]
    assert response.items[0].latest_invocation_status == "reserved"
