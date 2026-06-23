from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

from ragpilot_api.contracts.http.tool_registration_contracts import ToolGovernanceActionType, ToolSurfaceArea
from ragpilot_api.contracts.http.tool_runtime_audit_contracts import ToolRuntimeGovernanceIssue
from ragpilot_api.contracts.http.tool_runtime_contracts import ToolInvocationStatus

ToolMcpBoundaryStatus = Literal["reviewing", "quarantined", "ready_for_integration"]


class ToolMcpBoundaryWorklistItemResponse(BaseModel):
    tool_registration_id: UUID
    name: str
    slug: str
    surface_area: ToolSurfaceArea
    boundary_status: ToolMcpBoundaryStatus
    connector_reference: str | None = None
    requires_admin_approval: bool
    is_enabled: bool
    bound_agent_count: int = 0
    reserved_trace_count: int = 0
    available_actions: list[ToolGovernanceActionType] = Field(default_factory=list)
    latest_invocation_status: ToolInvocationStatus | None = None
    latest_governance_issue: ToolRuntimeGovernanceIssue | None = None
    latest_summary: str | None = None
    latest_executed_at: datetime | None = None


class ToolMcpBoundaryWorklistResponse(BaseModel):
    total_reserved_tools: int = 0
    bound_reserved_tools: int = 0
    reserved_trace_count: int = 0
    reviewing_tools: int = 0
    quarantined_tools: int = 0
    ready_for_integration_tools: int = 0
    items: list[ToolMcpBoundaryWorklistItemResponse] = Field(default_factory=list)
