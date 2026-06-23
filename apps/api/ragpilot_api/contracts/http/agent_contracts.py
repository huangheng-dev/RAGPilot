from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


AgentMode = Literal["grounded_chat", "document_intake", "workflow_recovery"]
AgentStatus = Literal["draft", "active", "paused"]
ModelStrategy = Literal["local_reserved", "remote_reserved", "hybrid_reserved"]
AgentTool = Literal["chat", "documents", "operations", "admin"]
AgentRuntimeReadinessIssue = Literal[
    "model_missing",
    "model_disabled",
    "retrieval_profile_missing",
    "retrieval_profile_disabled",
    "scope_missing",
    "scope_invalid",
    "tools_missing",
    "tool_registration_disabled",
    "tool_approval_required",
    "tool_mcp_reserved",
    "tool_mcp_integration_pending",
]


class AgentDefinitionCreateRequest(BaseModel):
    tenant_id: UUID
    name: str = Field(min_length=1, max_length=160)
    slug: str = Field(min_length=1, max_length=120, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    mode: AgentMode
    status: AgentStatus
    model_strategy: ModelStrategy
    model_endpoint_id: UUID | None = None
    objective: str = Field(default="", max_length=4000)
    instructions: str = Field(default="", max_length=12000)
    knowledge_base_scope: str | None = Field(default=None, max_length=160)
    tools: list[AgentTool] = Field(default_factory=list)
    tool_registration_ids: list[UUID] = Field(default_factory=list)


class AgentDefinitionUpdateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    slug: str = Field(min_length=1, max_length=120, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    mode: AgentMode
    status: AgentStatus
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
    model_strategy: ModelStrategy
    model_endpoint_id: UUID | None
    objective: str
    instructions: str
    knowledge_base_scope: str | None
    tools: list[AgentTool]
    tool_registration_ids: list[UUID]
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
    capabilities: list[str]
    is_enabled: bool
    is_default: bool


class AgentRuntimeResolvedRetrievalProfileResponse(BaseModel):
    id: UUID
    name: str
    slug: str
    retrieval_mode: str
    is_enabled: bool
    is_default: bool
    source: Literal["knowledge_base", "platform_default"]


class AgentRuntimeIssueCountsResponse(BaseModel):
    model_missing: int = 0
    model_disabled: int = 0
    retrieval_profile_missing: int = 0
    retrieval_profile_disabled: int = 0
    scope_missing: int = 0
    scope_invalid: int = 0
    tools_missing: int = 0
    tool_registration_disabled: int = 0
    tool_approval_required: int = 0
    tool_mcp_reserved: int = 0
    tool_mcp_integration_pending: int = 0


class AgentRuntimeGovernanceItemResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    name: str
    slug: str
    mode: AgentMode
    status: AgentStatus
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
