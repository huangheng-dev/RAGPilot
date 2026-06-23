from __future__ import annotations

from uuid import UUID

from ragpilot_api.application.tool_runtime.tool_runtime_audit_service import build_tool_runtime_audit_record
from ragpilot_api.contracts.http.tool_boundary_governance_contracts import (
    ToolMcpBoundaryStatus,
    ToolMcpBoundaryWorklistItemResponse,
    ToolMcpBoundaryWorklistResponse,
)
from ragpilot_api.infrastructure.database.repositories.agent_execution_repository import AgentExecutionRepository
from ragpilot_api.infrastructure.database.repositories.agent_repository import AgentRepository
from ragpilot_api.infrastructure.database.repositories.tool_registration_repository import ToolRegistrationRepository


class ToolBoundaryGovernanceService:
    def __init__(
        self,
        tool_registration_repository: ToolRegistrationRepository,
        agent_repository: AgentRepository,
        agent_execution_repository: AgentExecutionRepository,
    ) -> None:
        self.tool_registration_repository = tool_registration_repository
        self.agent_repository = agent_repository
        self.agent_execution_repository = agent_execution_repository

    async def list_mcp_boundary_worklist(
        self,
        *,
        tenant_id: UUID,
        limit: int = 12,
    ) -> ToolMcpBoundaryWorklistResponse:
        reserved_tools = await self.tool_registration_repository.list_tool_registrations(
            transport_type="mcp_reserved"
        )
        binding_counts = await self.agent_repository.list_tool_registration_binding_counts()
        executions = await self.agent_execution_repository.list_agent_executions(
            tenant_id=tenant_id,
            limit=max(limit * 5, 40),
        )

        trace_by_tool_id: dict[str, list] = {}
        for execution in executions:
            result_payload = dict(execution.result_payload_json or {})
            tool_runtime = result_payload.get("tool_runtime")
            if not isinstance(tool_runtime, dict):
                continue

            traces = tool_runtime.get("traces")
            if not isinstance(traces, list):
                continue

            for trace in traces:
                record = build_tool_runtime_audit_record(execution=execution, trace=trace)
                if record is None:
                    continue
                if record.transport_type != "mcp_reserved":
                    continue
                trace_by_tool_id.setdefault(str(record.tool_registration_id), []).append(record)

        items: list[ToolMcpBoundaryWorklistItemResponse] = []
        for tool_registration in reserved_tools:
            tool_id = str(tool_registration.id)
            records = sorted(
                trace_by_tool_id.get(tool_id, []),
                key=lambda item: item.executed_at,
                reverse=True,
            )
            latest_record = records[0] if records else None
            bound_agent_count = binding_counts.get(tool_id, 0)
            reserved_trace_count = len(records)
            boundary_status = determine_mcp_boundary_status(
                is_enabled=tool_registration.is_enabled,
                requires_admin_approval=tool_registration.requires_admin_approval,
            )
            has_connector_reference = bool(getattr(tool_registration, "connector_reference", None))

            items.append(
                ToolMcpBoundaryWorklistItemResponse(
                    tool_registration_id=tool_registration.id,
                    name=tool_registration.name,
                    slug=tool_registration.slug,
                    surface_area=tool_registration.surface_area,
                    boundary_status=boundary_status,
                    connector_reference=getattr(tool_registration, "connector_reference", None),
                    requires_admin_approval=tool_registration.requires_admin_approval,
                    is_enabled=tool_registration.is_enabled,
                    bound_agent_count=bound_agent_count,
                    reserved_trace_count=reserved_trace_count,
                    available_actions=determine_mcp_boundary_actions(
                        boundary_status=boundary_status,
                        has_connector_reference=has_connector_reference,
                    ),
                    latest_invocation_status=latest_record.invocation_status if latest_record else None,
                    latest_governance_issue=latest_record.governance_issue if latest_record else None,
                    latest_summary=latest_record.summary if latest_record else None,
                    latest_executed_at=latest_record.executed_at if latest_record else None,
                )
            )

        items.sort(
            key=lambda item: (
                boundary_status_rank(item.boundary_status),
                0 if item.bound_agent_count > 0 else 1,
                0 if item.reserved_trace_count > 0 else 1,
                -(item.latest_executed_at.timestamp()) if item.latest_executed_at is not None else float("inf"),
            )
        )
        visible_items = items[:limit]
        return ToolMcpBoundaryWorklistResponse(
            total_reserved_tools=len(reserved_tools),
            bound_reserved_tools=sum(1 for item in items if item.bound_agent_count > 0),
            reserved_trace_count=sum(item.reserved_trace_count for item in items),
            reviewing_tools=sum(1 for item in items if item.boundary_status == "reviewing"),
            quarantined_tools=sum(1 for item in items if item.boundary_status == "quarantined"),
            ready_for_integration_tools=sum(1 for item in items if item.boundary_status == "ready_for_integration"),
            items=visible_items,
        )


def determine_mcp_boundary_status(
    *,
    is_enabled: bool,
    requires_admin_approval: bool,
) -> ToolMcpBoundaryStatus:
    if not is_enabled:
        return "quarantined"
    if requires_admin_approval:
        return "reviewing"
    return "ready_for_integration"


def determine_mcp_boundary_actions(
    *,
    boundary_status: ToolMcpBoundaryStatus,
    has_connector_reference: bool,
) -> list[str]:
    if boundary_status == "quarantined":
        actions = ["review_mcp_boundary"]
        if has_connector_reference:
            actions.append("ready_mcp_integration")
        return actions
    if boundary_status == "ready_for_integration":
        return ["review_mcp_boundary", "quarantine_mcp_boundary"]
    actions = ["quarantine_mcp_boundary"]
    if has_connector_reference:
        actions.insert(0, "ready_mcp_integration")
    return actions


def boundary_status_rank(boundary_status: ToolMcpBoundaryStatus) -> int:
    if boundary_status == "reviewing":
        return 0
    if boundary_status == "quarantined":
        return 1
    return 2
