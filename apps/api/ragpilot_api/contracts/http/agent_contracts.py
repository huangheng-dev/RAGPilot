from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


AgentMode = Literal["grounded_chat", "document_intake", "workflow_recovery"]
AgentStatus = Literal["draft", "active", "paused"]
AgentRuntimeEngine = Literal["native", "langgraph_pilot"]
ModelStrategy = Literal["local_reserved", "remote_reserved", "hybrid_reserved"]
AgentTool = Literal["chat", "documents", "operations", "admin"]
AgentRuntimeReadinessIssue = Literal[
    "model_missing",
    "model_disabled",
    "model_runtime_unconfigured",
    "retrieval_profile_missing",
    "retrieval_profile_disabled",
    "retrieval_engine_unavailable",
    "scope_missing",
    "scope_invalid",
    "tools_missing",
    "tool_registration_disabled",
    "tool_approval_required",
    "tool_mcp_reserved",
    "tool_mcp_integration_pending",
    "runtime_engine_unavailable",
]


class AgentDefinitionCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    tenant_id: UUID
    name: str = Field(min_length=1, max_length=160)
    slug: str = Field(min_length=1, max_length=120, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    mode: AgentMode
    status: AgentStatus
    runtime_engine: AgentRuntimeEngine = "native"
    runtime_version: str = Field(default="native_v1", min_length=1, max_length=80, pattern=r"^[a-z0-9_]+$")
    model_strategy: ModelStrategy
    model_endpoint_id: UUID | None = None
    objective: str = Field(default="", max_length=4000)
    instructions: str = Field(default="", max_length=12000)
    knowledge_base_scope: str | None = Field(default=None, max_length=160)
    tools: list[AgentTool] = Field(default_factory=list)
    tool_registration_ids: list[UUID] = Field(default_factory=list)


class AgentDefinitionUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=160)
    slug: str = Field(min_length=1, max_length=120, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    mode: AgentMode
    status: AgentStatus
    runtime_engine: AgentRuntimeEngine | None = None
    runtime_version: str | None = Field(default=None, min_length=1, max_length=80, pattern=r"^[a-z0-9_]+$")
    model_strategy: ModelStrategy
    model_endpoint_id: UUID | None = None
    objective: str = Field(default="", max_length=4000)
    instructions: str = Field(default="", max_length=12000)
    knowledge_base_scope: str | None = Field(default=None, max_length=160)
    tools: list[AgentTool] = Field(default_factory=list)
    tool_registration_ids: list[UUID] = Field(default_factory=list)


class AgentDefinitionResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    name: str
    slug: str
    mode: AgentMode
    status: AgentStatus
    runtime_engine: AgentRuntimeEngine = "native"
    runtime_version: str = "native_v1"
    model_strategy: ModelStrategy
    model_endpoint_id: UUID | None
    objective: str
    instructions: str
    knowledge_base_scope: str | None
    tools: list[AgentTool]
    tool_registration_ids: list[UUID]
    runtime_governance: "AgentRuntimeGovernanceDigestResponse | None" = None
    created_at: datetime
    updated_at: datetime


class AgentDefinitionMetricsResponse(BaseModel):
    total_agents: int
    active_agents: int
    paused_agents: int
    draft_agents: int
    tool_enabled_agents: int
    scoped_agents: int


class AgentRuntimeResolvedScopeResponse(BaseModel):
    workspace_id: UUID | None
    workspace_slug: str | None
    workspace_name: str | None
    knowledge_base_id: UUID | None
    knowledge_base_slug: str | None
    knowledge_base_name: str | None
    scope_issue: Literal["scope_missing", "scope_invalid"] | None


class AgentRuntimeResolvedModelEndpointResponse(BaseModel):
    id: UUID
    name: str
    slug: str
    provider_type: str
    model_name: str
    base_url: str | None
    credential_mode: str
    credential_key_hint: str | None
    capabilities: list[str]
    is_enabled: bool
    is_default: bool
    runtime_ready: bool
    runtime_issue: Literal["missing_base_url", "missing_credential_hint", "managed_reserved"] | None
    recent_preview_completed_events: int = 0
    recent_preview_blocked_events: int = 0
    recent_preview_failed_events: int = 0
    last_preview_status: Literal["completed", "blocked", "failed"] | None = None
    last_preview_at: datetime | None = None


class AgentRuntimeResolvedRetrievalProfileResponse(BaseModel):
    id: UUID
    name: str
    slug: str
    retrieval_mode: str
    engine_name: str = "native"
    engine_version: str = "native_v1"
    is_enabled: bool
    is_default: bool
    source: Literal["knowledge_base", "platform_default"]


class AgentRuntimeFocusToolRegistrationResponse(BaseModel):
    id: UUID
    name: str
    slug: str
    transport_type: Literal["native", "http", "mcp_reserved"]
    surface_area: Literal["chat", "documents", "operations", "admin", "agents"]
    endpoint_url: str | None
    connector_reference: str | None
    requires_admin_approval: bool
    is_enabled: bool
    recent_preview_completed_events: int = 0
    recent_preview_blocked_events: int = 0
    recent_preview_failed_events: int = 0
    last_preview_status: Literal["completed", "blocked", "failed"] | None = None
    last_preview_at: datetime | None = None


class AgentRuntimeFocusMcpConnectorResponse(BaseModel):
    id: UUID
    name: str
    slug: str
    connector_type: Literal["streamable_http", "sse", "managed_reserved"]
    base_url: str | None
    auth_mode: Literal["none", "environment", "managed_reserved"]
    credential_key_hint: str | None
    is_enabled: bool
    recent_preview_completed_events: int = 0
    recent_preview_blocked_events: int = 0
    recent_preview_failed_events: int = 0
    last_preview_status: Literal["completed", "blocked", "failed"] | None = None
    last_preview_at: datetime | None = None


class AgentRuntimeIssueCountsResponse(BaseModel):
    model_missing: int = 0
    model_disabled: int = 0
    model_runtime_unconfigured: int = 0
    retrieval_profile_missing: int = 0
    retrieval_profile_disabled: int = 0
    retrieval_engine_unavailable: int = 0
    scope_missing: int = 0
    scope_invalid: int = 0
    tools_missing: int = 0
    tool_registration_disabled: int = 0
    tool_approval_required: int = 0
    tool_mcp_reserved: int = 0
    tool_mcp_integration_pending: int = 0
    runtime_engine_unavailable: int = 0


class AgentRuntimeGovernanceItemResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    name: str
    slug: str
    mode: AgentMode
    status: AgentStatus
    runtime_engine: AgentRuntimeEngine = "native"
    runtime_version: str = "native_v1"
    objective: str
    knowledge_base_scope: str | None
    model_endpoint_id: UUID | None
    tool_registration_ids: list[UUID]
    tools: list[AgentTool]
    created_at: datetime
    updated_at: datetime
    is_ready: bool
    issues: list[AgentRuntimeReadinessIssue]
    blocking_issues: list[AgentRuntimeReadinessIssue]
    has_connected_capabilities: bool
    approval_required_tool_count: int
    disabled_registered_tool_count: int
    missing_tool_registration_count: int
    reserved_mcp_tool_count: int
    integration_pending_mcp_tool_count: int
    disabled_tool_registration_id: UUID | None
    approval_required_tool_registration_id: UUID | None
    reserved_mcp_tool_registration_id: UUID | None
    integration_pending_mcp_tool_registration_id: UUID | None
    integration_pending_mcp_connector_reference: str | None
    focus_tool_registration: AgentRuntimeFocusToolRegistrationResponse | None
    focus_mcp_connector: AgentRuntimeFocusMcpConnectorResponse | None
    resolved_scope: AgentRuntimeResolvedScopeResponse
    resolved_model_endpoint: AgentRuntimeResolvedModelEndpointResponse | None
    resolved_retrieval_profile: AgentRuntimeResolvedRetrievalProfileResponse | None


class AgentRuntimeGovernanceDigestResponse(BaseModel):
    is_ready: bool
    issues: list[AgentRuntimeReadinessIssue]
    blocking_issues: list[AgentRuntimeReadinessIssue]
    approval_required_tool_count: int
    disabled_registered_tool_count: int
    missing_tool_registration_count: int
    reserved_mcp_tool_count: int
    integration_pending_mcp_tool_count: int
    disabled_tool_registration_id: UUID | None
    approval_required_tool_registration_id: UUID | None
    reserved_mcp_tool_registration_id: UUID | None
    integration_pending_mcp_tool_registration_id: UUID | None
    integration_pending_mcp_connector_reference: str | None
    focus_tool_registration: AgentRuntimeFocusToolRegistrationResponse | None
    focus_mcp_connector: AgentRuntimeFocusMcpConnectorResponse | None
    resolved_scope: AgentRuntimeResolvedScopeResponse
    resolved_model_endpoint: AgentRuntimeResolvedModelEndpointResponse | None
    resolved_retrieval_profile: AgentRuntimeResolvedRetrievalProfileResponse | None


class AgentRuntimeGovernanceSummaryResponse(BaseModel):
    total_agents: int
    active_agents: int
    paused_agents: int
    draft_agents: int
    attention_agents: int
    ready_agents: int
    active_agents_without_scope: int
    agents_missing_model: int
    agents_using_disabled_model: int
    agents_using_unconfigured_model: int
    agents_missing_retrieval_profile: int
    agents_using_disabled_retrieval_profile: int
    agents_missing_tool_registration: int
    agents_using_disabled_tool_registration: int
    model_endpoints: int
    enabled_models: int
    disabled_bound_models: int
    unbound_enabled_models: int
    tool_registrations: int
    enabled_tools: int
    approval_gated_tools: int
    disabled_bound_tools: int
    unbound_enabled_tools: int
    issue_counts: AgentRuntimeIssueCountsResponse


class AgentRuntimeGovernanceResponse(BaseModel):
    summary: AgentRuntimeGovernanceSummaryResponse
    items: list[AgentRuntimeGovernanceItemResponse]


AgentDefinitionResponse.model_rebuild()
