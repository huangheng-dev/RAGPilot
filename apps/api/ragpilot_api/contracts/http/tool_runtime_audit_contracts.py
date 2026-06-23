from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


ToolInvocationStatus = Literal["completed", "blocked", "reserved", "unavailable", "failed", "skipped"]
ToolRuntimeGovernanceIssue = Literal[
    "approval_required",
    "tool_disabled",
    "mcp_reserved",
    "mcp_integration_pending",
    "endpoint_failure",
    "runtime_failure",
]


class ToolRuntimeAuditRecordResponse(BaseModel):
    agent_execution_id: UUID
    agent_definition_id: UUID
    execution_mode: str
    execution_status: str
    trigger_source: str
    tool_registration_id: UUID
    name: str
    slug: str
    transport_type: str
    surface_area: str
    invocation_status: ToolInvocationStatus
    governance_issue: ToolRuntimeGovernanceIssue | None = None
    endpoint_url: str | None = None
    summary: str
    capability_results: dict = Field(default_factory=dict)
    request_metadata: dict = Field(default_factory=dict)
    response_metadata: dict = Field(default_factory=dict)
    error_message: str | None = None
    executed_at: datetime


class ToolRuntimeAuditSummaryResponse(BaseModel):
    total_traces: int = 0
    completed_traces: int = 0
    blocked_traces: int = 0
    reserved_traces: int = 0
    unavailable_traces: int = 0
    failed_traces: int = 0
    skipped_traces: int = 0
    approval_required_traces: int = 0
    disabled_traces: int = 0
    mcp_reserved_traces: int = 0
    mcp_integration_pending_traces: int = 0
    endpoint_failure_traces: int = 0
    runtime_failure_traces: int = 0


class ToolRuntimeAuditListResponse(BaseModel):
    summary: ToolRuntimeAuditSummaryResponse = Field(default_factory=ToolRuntimeAuditSummaryResponse)
    items: list[ToolRuntimeAuditRecordResponse] = Field(default_factory=list)
