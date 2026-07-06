from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


ToolTransportType = Literal["native", "http", "mcp_reserved"]
ToolSurfaceArea = Literal["chat", "documents", "operations", "admin", "agents"]
ToolGovernanceActionType = Literal[
    "disable_tool",
    "enable_tool",
    "require_admin_approval",
    "allow_direct_use",
    "quarantine_tool",
    "review_mcp_boundary",
    "ready_mcp_integration",
    "quarantine_mcp_boundary",
]


class ToolRegistrationCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=160)
    slug: str = Field(min_length=1, max_length=120, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    transport_type: ToolTransportType
    surface_area: ToolSurfaceArea
    endpoint_url: str | None = Field(default=None, max_length=500)
    connector_reference: str | None = Field(default=None, max_length=240)
    description: str | None = Field(default=None, max_length=4000)
    capabilities: list[str] = Field(default_factory=list, max_length=24)
    requires_admin_approval: bool = False
    is_enabled: bool = True


class ToolRegistrationUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=160)
    slug: str = Field(min_length=1, max_length=120, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    transport_type: ToolTransportType
    surface_area: ToolSurfaceArea
    endpoint_url: str | None = Field(default=None, max_length=500)
    connector_reference: str | None = Field(default=None, max_length=240)
    description: str | None = Field(default=None, max_length=4000)
    capabilities: list[str] = Field(default_factory=list, max_length=24)
    requires_admin_approval: bool
    is_enabled: bool


class ToolRegistrationResponse(BaseModel):
    id: UUID
    name: str
    slug: str
    transport_type: ToolTransportType
    surface_area: ToolSurfaceArea
    endpoint_url: str | None
    connector_reference: str | None = None
    description: str | None
    capabilities: list[str]
    requires_admin_approval: bool
    is_enabled: bool
    bound_agent_count: int = 0
    recent_preview_completed_events: int = 0
    recent_preview_blocked_events: int = 0
    recent_preview_failed_events: int = 0
    last_preview_status: str | None = None
    last_preview_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class ToolGovernanceActionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    action_type: ToolGovernanceActionType


class ToolGovernanceActionResponse(BaseModel):
    action_type: ToolGovernanceActionType
    summary: str
    tool_registration: ToolRegistrationResponse


class ToolTransportGovernanceBreakdownResponse(BaseModel):
    transport_type: ToolTransportType
    total_tools: int = 0
    enabled_tools: int = 0
    bound_tools: int = 0
    approval_required_tools: int = 0
    missing_endpoint_tools: int = 0
    connector_configured_tools: int = 0
    runtime_ready_tools: int = 0


class ToolSurfaceGovernanceBreakdownResponse(BaseModel):
    surface_area: ToolSurfaceArea
    total_tools: int = 0
    enabled_tools: int = 0
    bound_tools: int = 0
    approval_required_tools: int = 0


class ToolGovernanceSummaryResponse(BaseModel):
    total_tools: int = 0
    enabled_tools: int = 0
    disabled_tools: int = 0
    bound_tools: int = 0
    approval_required_tools: int = 0
    native_tools: int = 0
    http_tools: int = 0
    http_tools_missing_endpoint_tools: int = 0
    mcp_reserved_tools: int = 0
    mcp_reserved_bound_tools: int = 0
    mcp_integration_pending_tools: int = 0
    mcp_connector_configured_tools: int = 0
    mcp_connector_unhealthy_tools: int = 0
    runtime_ready_tools: int = 0
    recent_preview_completed_events: int = 0
    recent_preview_blocked_events: int = 0
    recent_preview_failed_events: int = 0
    last_preview_status: str | None = None
    last_preview_at: datetime | None = None
    transport_breakdown: list[ToolTransportGovernanceBreakdownResponse] = Field(default_factory=list)
    surface_breakdown: list[ToolSurfaceGovernanceBreakdownResponse] = Field(default_factory=list)
