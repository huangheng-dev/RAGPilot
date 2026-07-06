from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

from ragpilot_api.contracts.http.mcp_connector_contracts import McpConnectorGovernanceSummaryResponse
from ragpilot_api.contracts.http.model_endpoint_contracts import ModelGovernanceSummaryResponse
from ragpilot_api.contracts.http.tool_registration_contracts import ToolGovernanceSummaryResponse


RuntimeGovernanceResourceType = Literal[
    "model_endpoint",
    "tool_registration",
    "mcp_connector",
    "retrieval_profile",
]

RuntimeGovernanceWorklistCategory = Literal[
    "approval_required_tool",
    "mcp_integration_pending_tool",
    "integration_blocked_connector",
    "unconfigured_model_endpoint",
    "disabled_bound_model_endpoint",
]
RuntimeGovernanceWorklistSeverity = Literal["review", "attention"]
RuntimeGovernanceOverviewStatus = Literal["stable", "review", "attention"]
RuntimeGovernanceOverviewReasonCode = Literal[
    "stable",
    "unconfigured_model_endpoint",
    "disabled_bound_model_endpoint",
    "approval_required_tool",
    "mcp_integration_pending_tool",
    "integration_blocked_connector",
]
RuntimeGovernanceToolListFilter = Literal[
    "approval_required",
    "disabled",
    "mcp_reserved_bound",
    "mcp_integration_pending",
]
RuntimeGovernanceAgentIssue = Literal[
    "model_disabled",
    "model_runtime_unconfigured",
    "retrieval_profile_disabled",
    "tool_registration_disabled",
    "tool_approval_required",
    "tool_mcp_reserved",
    "tool_mcp_integration_pending",
]


class RuntimeGovernanceSettingsTargetResponse(BaseModel):
    runtime_resource: RuntimeGovernanceResourceType
    model_endpoint_id: UUID | None = None
    model_provider_type: Literal["deterministic", "openai_compatible", "ollama", "vllm"] | None = None
    tool_registration_id: UUID | None = None
    tool_list_filter: RuntimeGovernanceToolListFilter | None = None
    retrieval_profile_id: UUID | None = None
    mcp_connector_id: UUID | None = None
    mcp_connector_slug: str | None = None


class RuntimeGovernanceAgentsTargetResponse(BaseModel):
    issue: RuntimeGovernanceAgentIssue
    model_endpoint_id: UUID | None = None
    model_provider_type: Literal["deterministic", "openai_compatible", "ollama", "vllm"] | None = None
    tool_registration_id: UUID | None = None
    retrieval_profile_id: UUID | None = None


class RuntimeGovernanceFollowUpResponse(BaseModel):
    settings_target: RuntimeGovernanceSettingsTargetResponse | None = None
    agents_target: RuntimeGovernanceAgentsTargetResponse | None = None


class RuntimeGovernanceEventResponse(BaseModel):
    id: UUID
    actor_user_id: UUID | None
    actor_role: str | None
    resource_type: RuntimeGovernanceResourceType
    resource_id: UUID | None
    resource_name: str | None
    resource_slug: str | None
    action_type: str
    detail: dict[str, object] = Field(default_factory=dict, validation_alias="detail_json")
    follow_up: RuntimeGovernanceFollowUpResponse | None = None
    created_at: datetime

    model_config = {
        "from_attributes": True,
        "populate_by_name": True,
    }


class RuntimeGovernanceWorklistItemResponse(BaseModel):
    category: RuntimeGovernanceWorklistCategory
    severity: RuntimeGovernanceWorklistSeverity
    resource_type: Literal["model_endpoint", "tool_registration", "mcp_connector"]
    resource_id: UUID
    resource_name: str
    resource_slug: str
    action_hint: str
    recent_preview_completed_events: int = 0
    recent_preview_blocked_events: int = 0
    recent_preview_failed_events: int = 0
    last_preview_status: str | None = None
    last_preview_at: datetime | None = None
    detail: dict[str, object] = Field(default_factory=dict)
    follow_up: RuntimeGovernanceFollowUpResponse | None = None


class RuntimeGovernanceWorklistResponse(BaseModel):
    total_items: int = 0
    unconfigured_model_endpoints: int = 0
    disabled_bound_model_endpoints: int = 0
    approval_required_tools: int = 0
    mcp_integration_pending_tools: int = 0
    integration_blocked_connectors: int = 0
    items: list[RuntimeGovernanceWorklistItemResponse] = Field(default_factory=list)


class RuntimeGovernanceOverviewResponse(BaseModel):
    status: RuntimeGovernanceOverviewStatus
    reason_code: RuntimeGovernanceOverviewReasonCode
    attention_items: int = 0
    review_items: int = 0
    primary_item: RuntimeGovernanceWorklistItemResponse | None = None
    model_summary: ModelGovernanceSummaryResponse
    tool_summary: ToolGovernanceSummaryResponse
    mcp_connector_summary: McpConnectorGovernanceSummaryResponse
    worklist: RuntimeGovernanceWorklistResponse
    recent_events: list[RuntimeGovernanceEventResponse] = Field(default_factory=list)
