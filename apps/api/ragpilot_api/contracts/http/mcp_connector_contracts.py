from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


McpConnectorType = Literal["streamable_http", "sse", "managed_reserved"]
McpConnectorAuthMode = Literal["none", "environment", "managed_reserved"]
McpConnectorPreviewStatus = Literal["completed", "blocked", "failed"]
McpConnectorGovernanceActionType = Literal["enable_connector", "disable_connector"]


class McpConnectorCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=160)
    slug: str = Field(min_length=1, max_length=120, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    connector_type: McpConnectorType
    base_url: str | None = Field(default=None, max_length=500)
    auth_mode: McpConnectorAuthMode = "none"
    credential_key_hint: str | None = Field(default=None, max_length=160)
    notes: str | None = Field(default=None, max_length=4000)
    is_enabled: bool = True


class McpConnectorUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=160)
    slug: str = Field(min_length=1, max_length=120, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    connector_type: McpConnectorType
    base_url: str | None = Field(default=None, max_length=500)
    auth_mode: McpConnectorAuthMode
    credential_key_hint: str | None = Field(default=None, max_length=160)
    notes: str | None = Field(default=None, max_length=4000)
    is_enabled: bool


class McpConnectorResponse(BaseModel):
    id: UUID
    name: str
    slug: str
    connector_type: McpConnectorType
    base_url: str | None
    auth_mode: McpConnectorAuthMode
    credential_key_hint: str | None
    notes: str | None
    is_enabled: bool
    referenced_tool_count: int = 0
    integration_ready_tool_count: int = 0
    recent_preview_completed_events: int = 0
    recent_preview_blocked_events: int = 0
    recent_preview_failed_events: int = 0
    last_preview_status: McpConnectorPreviewStatus | None = None
    last_preview_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class McpConnectorGovernanceActionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    action_type: McpConnectorGovernanceActionType


class McpConnectorGovernanceActionResponse(BaseModel):
    action_type: McpConnectorGovernanceActionType
    summary: str
    mcp_connector: McpConnectorResponse


class McpConnectorPreviewResponse(BaseModel):
    mcp_connector_id: UUID
    name: str
    slug: str
    connector_type: McpConnectorType
    preview_status: McpConnectorPreviewStatus
    summary: str
    request_metadata: dict[str, object] = Field(default_factory=dict)
    response_metadata: dict[str, object] = Field(default_factory=dict)
    error_message: str | None = None
    executed_at: datetime


class McpConnectorTypeGovernanceBreakdownResponse(BaseModel):
    connector_type: McpConnectorType
    total_connectors: int = 0
    enabled_connectors: int = 0
    referenced_connectors: int = 0
    runtime_ready_connectors: int = 0


class McpConnectorAuthGovernanceBreakdownResponse(BaseModel):
    auth_mode: McpConnectorAuthMode
    total_connectors: int = 0
    enabled_connectors: int = 0
    configured_connectors: int = 0


class McpConnectorGovernanceSummaryResponse(BaseModel):
    total_connectors: int = 0
    enabled_connectors: int = 0
    disabled_connectors: int = 0
    referenced_connectors: int = 0
    integration_ready_connectors: int = 0
    blocked_integration_connectors: int = 0
    runtime_ready_connectors: int = 0
    missing_base_url_connectors: int = 0
    environment_auth_connectors: int = 0
    missing_credential_hint_connectors: int = 0
    managed_reserved_connectors: int = 0
    recent_preview_completed_events: int = 0
    recent_preview_blocked_events: int = 0
    recent_preview_failed_events: int = 0
    last_preview_status: McpConnectorPreviewStatus | None = None
    last_preview_at: datetime | None = None
    type_breakdown: list[McpConnectorTypeGovernanceBreakdownResponse] = Field(default_factory=list)
    auth_breakdown: list[McpConnectorAuthGovernanceBreakdownResponse] = Field(default_factory=list)
