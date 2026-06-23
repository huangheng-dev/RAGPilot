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


class ToolInvocationPreviewRequest(BaseModel):
    tenant_id: UUID
    workspace_id: UUID | None = None
    knowledge_base_id: UUID | None = None
    execution_input: str | None = Field(default=None, max_length=4000)


class ToolInvocationResponse(BaseModel):
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


class ToolRuntimeSummaryResponse(BaseModel):
    total_bound_tools: int
    completed_tools: int
    blocked_tools: int
    reserved_tools: int
    unavailable_tools: int
    failed_tools: int
    skipped_tools: int
    traces: list[ToolInvocationResponse] = Field(default_factory=list)
