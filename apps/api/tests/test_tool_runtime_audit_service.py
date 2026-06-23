from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from ragpilot_api.application.tool_runtime.tool_runtime_audit_service import ToolRuntimeAuditService


def build_agent_execution_with_tool_trace(**overrides):
    trace_time = datetime.now(timezone.utc)
    tool_registration_id = overrides.pop("tool_registration_id", uuid4())
    invocation_status = overrides.pop("invocation_status", "completed")
    result_payload_json = overrides.pop(
        "result_payload_json",
        {
            "tool_runtime": {
                "traces": [
                    {
                        "tool_registration_id": str(tool_registration_id),
                        "name": "Governed Search Tool",
                        "slug": "governed-search-tool",
                        "transport_type": "http",
                        "surface_area": "agents",
                        "invocation_status": invocation_status,
                        "endpoint_url": "http://127.0.0.1:9010/invoke",
                        "summary": "Search tool completed.",
                        "capability_results": {"match_count": 2},
                        "request_metadata": {"attempt_count": 1},
                        "response_metadata": {"status_code": 200},
                        "error_message": None,
                        "executed_at": trace_time.isoformat(),
                    }
                ]
            }
        },
    )
    defaults = {
        "id": uuid4(),
        "tenant_id": uuid4(),
        "agent_definition_id": uuid4(),
        "execution_mode": "grounded_chat",
        "execution_status": "completed",
        "trigger_source": "agents_console",
        "result_payload_json": result_payload_json,
    }
    return SimpleNamespace(**{**defaults, **overrides})


@pytest.mark.anyio
async def test_tool_runtime_audit_service_flattens_and_filters_runtime_traces() -> None:
    matching_tool_registration_id = uuid4()
    recent_failed_execution = build_agent_execution_with_tool_trace(
        tool_registration_id=matching_tool_registration_id,
        invocation_status="failed",
    )
    older_completed_execution = build_agent_execution_with_tool_trace(
        tool_registration_id=matching_tool_registration_id,
        invocation_status="completed",
    )
    unrelated_execution = build_agent_execution_with_tool_trace(
        tool_registration_id=uuid4(),
        invocation_status="blocked",
    )

    service = ToolRuntimeAuditService(
        agent_execution_repository=SimpleNamespace(
            list_agent_executions=AsyncMock(
                return_value=[recent_failed_execution, older_completed_execution, unrelated_execution]
            )
        )
    )

    response = await service.list_tool_runtime_audit_records(
        tenant_id=recent_failed_execution.tenant_id,
        tool_registration_id=matching_tool_registration_id,
        limit=10,
    )

    assert response.summary.total_traces == 2
    assert response.summary.failed_traces == 1
    assert response.summary.completed_traces == 1
    assert response.summary.endpoint_failure_traces == 1
    assert all(item.tool_registration_id == matching_tool_registration_id for item in response.items)


@pytest.mark.anyio
async def test_tool_runtime_audit_service_filters_by_invocation_status() -> None:
    failed_execution = build_agent_execution_with_tool_trace(invocation_status="failed")
    completed_execution = build_agent_execution_with_tool_trace(invocation_status="completed")

    service = ToolRuntimeAuditService(
        agent_execution_repository=SimpleNamespace(
            list_agent_executions=AsyncMock(return_value=[failed_execution, completed_execution])
        )
    )

    response = await service.list_tool_runtime_audit_records(
        tenant_id=failed_execution.tenant_id,
        invocation_status="failed",
        limit=10,
    )

    assert response.summary.total_traces == 1
    assert response.items[0].invocation_status == "failed"
    assert response.items[0].governance_issue == "endpoint_failure"


@pytest.mark.anyio
async def test_tool_runtime_audit_service_classifies_governance_issues() -> None:
    blocked_execution = build_agent_execution_with_tool_trace(invocation_status="blocked")
    unavailable_execution = build_agent_execution_with_tool_trace(invocation_status="unavailable")
    reserved_execution = build_agent_execution_with_tool_trace(invocation_status="reserved")
    integration_pending_execution = build_agent_execution_with_tool_trace(
        invocation_status="unavailable",
        result_payload_json={
            "tool_runtime": {
                "traces": [
                    {
                        "tool_registration_id": str(uuid4()),
                        "name": "Reserved MCP Browser",
                        "slug": "reserved-mcp-browser",
                        "transport_type": "mcp_reserved",
                        "surface_area": "agents",
                        "invocation_status": "unavailable",
                        "governance_issue": "mcp_integration_pending",
                        "endpoint_url": None,
                        "summary": "Reserved MCP boundary is cleared, but no runtime connector is attached yet.",
                        "capability_results": {},
                        "request_metadata": {},
                        "response_metadata": {"boundary_status": "ready_for_integration"},
                        "error_message": None,
                        "executed_at": datetime.now(timezone.utc).isoformat(),
                    }
                ]
            }
        },
    )
    native_failed_execution = build_agent_execution_with_tool_trace(
        invocation_status="failed",
        result_payload_json={
            "tool_runtime": {
                "traces": [
                    {
                        "tool_registration_id": str(uuid4()),
                        "name": "Native Scope Tool",
                        "slug": "native-scope-tool",
                        "transport_type": "native",
                        "surface_area": "agents",
                        "invocation_status": "failed",
                        "endpoint_url": None,
                        "summary": "Native tool failed.",
                        "capability_results": {},
                        "request_metadata": {},
                        "response_metadata": {},
                        "error_message": "Unexpected runtime error",
                        "executed_at": datetime.now(timezone.utc).isoformat(),
                    }
                ]
            }
        },
    )

    service = ToolRuntimeAuditService(
        agent_execution_repository=SimpleNamespace(
            list_agent_executions=AsyncMock(
                return_value=[
                    blocked_execution,
                    unavailable_execution,
                    reserved_execution,
                    integration_pending_execution,
                    native_failed_execution,
                ]
            )
        )
    )

    response = await service.list_tool_runtime_audit_records(
        tenant_id=blocked_execution.tenant_id,
        limit=10,
    )

    assert response.summary.approval_required_traces == 1
    assert response.summary.disabled_traces == 1
    assert response.summary.mcp_reserved_traces == 1
    assert response.summary.mcp_integration_pending_traces == 1
    assert response.summary.runtime_failure_traces == 1
