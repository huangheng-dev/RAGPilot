from __future__ import annotations

from datetime import datetime
from uuid import UUID

from ragpilot_api.contracts.http.tool_runtime_audit_contracts import (
    ToolRuntimeAuditListResponse,
    ToolRuntimeAuditRecordResponse,
    ToolRuntimeAuditSummaryResponse,
    ToolRuntimeGovernanceIssue,
)
from ragpilot_api.infrastructure.database.repositories.agent_execution_repository import AgentExecutionRepository


class ToolRuntimeAuditService:
    def __init__(self, agent_execution_repository: AgentExecutionRepository) -> None:
        self.agent_execution_repository = agent_execution_repository

    async def list_tool_runtime_audit_records(
        self,
        *,
        tenant_id: UUID,
        tool_registration_id: UUID | None = None,
        invocation_status: str | None = None,
        limit: int = 20,
    ) -> ToolRuntimeAuditListResponse:
        executions = await self.agent_execution_repository.list_agent_executions(
            tenant_id=tenant_id,
            limit=max(limit * 3, 30),
        )

        records: list[ToolRuntimeAuditRecordResponse] = []
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
                if tool_registration_id is not None and record.tool_registration_id != tool_registration_id:
                    continue
                if invocation_status is not None and record.invocation_status != invocation_status:
                    continue
                records.append(record)

        records.sort(key=lambda item: item.executed_at, reverse=True)
        visible_records = records[:limit]
        return ToolRuntimeAuditListResponse(
            summary=build_tool_runtime_audit_summary(visible_records),
            items=visible_records,
        )


def build_tool_runtime_audit_record(*, execution, trace: object) -> ToolRuntimeAuditRecordResponse | None:
    if not isinstance(trace, dict):
        return None

    try:
        tool_registration_id = UUID(str(trace.get("tool_registration_id")))
        executed_at = datetime.fromisoformat(str(trace.get("executed_at")).replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return None

    invocation_status = str(trace.get("invocation_status") or "").strip().lower()
    if invocation_status not in {"completed", "blocked", "reserved", "unavailable", "failed", "skipped"}:
        return None

    name = str(trace.get("name") or "").strip()
    slug = str(trace.get("slug") or "").strip()
    transport_type = str(trace.get("transport_type") or "").strip()
    surface_area = str(trace.get("surface_area") or "").strip()
    summary = str(trace.get("summary") or "").strip()
    if not name or not slug or not transport_type or not surface_area or not summary:
        return None

    explicit_governance_issue = read_governance_issue(trace.get("governance_issue"))

    return ToolRuntimeAuditRecordResponse(
        agent_execution_id=execution.id,
        agent_definition_id=execution.agent_definition_id,
        execution_mode=execution.execution_mode,
        execution_status=execution.execution_status,
        trigger_source=execution.trigger_source,
        tool_registration_id=tool_registration_id,
        name=name,
        slug=slug,
        transport_type=transport_type,
        surface_area=surface_area,
        invocation_status=invocation_status,
        governance_issue=explicit_governance_issue
        if explicit_governance_issue is not None
        else resolve_governance_issue(
            invocation_status=invocation_status,
            transport_type=transport_type,
        ),
        endpoint_url=read_optional_string(trace.get("endpoint_url")),
        summary=summary,
        capability_results=trace.get("capability_results") if isinstance(trace.get("capability_results"), dict) else {},
        request_metadata=trace.get("request_metadata") if isinstance(trace.get("request_metadata"), dict) else {},
        response_metadata=trace.get("response_metadata") if isinstance(trace.get("response_metadata"), dict) else {},
        error_message=read_optional_string(trace.get("error_message")),
        executed_at=executed_at,
    )


def build_tool_runtime_audit_summary(
    records: list[ToolRuntimeAuditRecordResponse],
) -> ToolRuntimeAuditSummaryResponse:
    return ToolRuntimeAuditSummaryResponse(
        total_traces=len(records),
        completed_traces=sum(1 for item in records if item.invocation_status == "completed"),
        blocked_traces=sum(1 for item in records if item.invocation_status == "blocked"),
        reserved_traces=sum(1 for item in records if item.invocation_status == "reserved"),
        unavailable_traces=sum(1 for item in records if item.invocation_status == "unavailable"),
        failed_traces=sum(1 for item in records if item.invocation_status == "failed"),
        skipped_traces=sum(1 for item in records if item.invocation_status == "skipped"),
        approval_required_traces=sum(1 for item in records if item.governance_issue == "approval_required"),
        disabled_traces=sum(1 for item in records if item.governance_issue == "tool_disabled"),
        mcp_reserved_traces=sum(1 for item in records if item.governance_issue == "mcp_reserved"),
        mcp_integration_pending_traces=sum(
            1 for item in records if item.governance_issue == "mcp_integration_pending"
        ),
        endpoint_failure_traces=sum(1 for item in records if item.governance_issue == "endpoint_failure"),
        runtime_failure_traces=sum(1 for item in records if item.governance_issue == "runtime_failure"),
    )


def read_optional_string(value: object) -> str | None:
    if isinstance(value, str):
        normalized = value.strip()
        return normalized or None
    return None


def read_governance_issue(value: object) -> ToolRuntimeGovernanceIssue | None:
    if not isinstance(value, str):
        return None
    normalized = value.strip().lower()
    if normalized in {
        "approval_required",
        "tool_disabled",
        "mcp_reserved",
        "mcp_integration_pending",
        "endpoint_failure",
        "runtime_failure",
    }:
        return normalized
    return None


def resolve_governance_issue(
    *,
    invocation_status: str,
    transport_type: str,
) -> ToolRuntimeGovernanceIssue | None:
    if invocation_status == "blocked":
        return "approval_required"
    if invocation_status == "unavailable":
        return "tool_disabled"
    if invocation_status == "reserved":
        return "mcp_reserved"
    if invocation_status == "failed":
        if transport_type == "http":
            return "endpoint_failure"
        return "runtime_failure"
    return None
