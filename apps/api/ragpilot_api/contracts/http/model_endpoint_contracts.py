from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


ModelProviderType = Literal["deterministic", "openai_compatible", "ollama", "ollama_reserved", "vllm", "vllm_reserved"]
ModelCapability = Literal["chat", "embeddings"]
CredentialMode = Literal["none", "environment", "managed_reserved"]
ModelEndpointPreviewStatus = Literal["completed", "blocked", "failed"]
ModelEndpointGovernanceActionType = Literal["enable_endpoint", "disable_endpoint", "promote_default"]
ModelProviderRoutingStyle = Literal["builtin", "native_http", "openai_compatible"]
ModelProviderRuntimePostureStatus = Literal["ready", "attention", "setup_required"]


class ModelEndpointCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=160)
    slug: str = Field(min_length=1, max_length=120, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    provider_type: ModelProviderType
    model_name: str = Field(min_length=1, max_length=160)
    base_url: str | None = Field(default=None, max_length=500)
    credential_mode: CredentialMode
    credential_key_hint: str | None = Field(default=None, max_length=160)
    capabilities: list[ModelCapability] = Field(default_factory=list)
    is_enabled: bool = True
    is_default: bool = False
    notes: str | None = Field(default=None, max_length=4000)


class ModelEndpointUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=160)
    slug: str = Field(min_length=1, max_length=120, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    provider_type: ModelProviderType
    model_name: str = Field(min_length=1, max_length=160)
    base_url: str | None = Field(default=None, max_length=500)
    credential_mode: CredentialMode
    credential_key_hint: str | None = Field(default=None, max_length=160)
    capabilities: list[ModelCapability] = Field(default_factory=list)
    is_enabled: bool
    is_default: bool
    notes: str | None = Field(default=None, max_length=4000)


class ModelEndpointResponse(BaseModel):
    id: UUID
    name: str
    slug: str
    provider_type: ModelProviderType
    model_name: str
    base_url: str | None
    credential_mode: CredentialMode
    credential_key_hint: str | None
    capabilities: list[ModelCapability]
    is_enabled: bool
    is_default: bool
    notes: str | None
    bound_agent_count: int = 0
    recent_preview_completed_events: int = 0
    recent_preview_blocked_events: int = 0
    recent_preview_failed_events: int = 0
    last_preview_status: ModelEndpointPreviewStatus | None = None
    last_preview_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class ModelEndpointGovernanceActionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    action_type: ModelEndpointGovernanceActionType


class ModelEndpointGovernanceActionResponse(BaseModel):
    action_type: ModelEndpointGovernanceActionType
    summary: str
    model_endpoint: ModelEndpointResponse


class ModelEndpointPreviewResponse(BaseModel):
    model_endpoint_id: UUID
    name: str
    slug: str
    provider_type: ModelProviderType
    model_name: str
    preview_status: ModelEndpointPreviewStatus
    summary: str
    response_excerpt: str | None
    request_metadata: dict[str, object] = Field(default_factory=dict)
    response_metadata: dict[str, object] = Field(default_factory=dict)
    error_message: str | None
    executed_at: datetime


class ModelProviderGovernanceBreakdownResponse(BaseModel):
    provider_type: ModelProviderType
    total_endpoints: int = 0
    enabled_endpoints: int = 0
    bound_endpoints: int = 0
    default_endpoints: int = 0
    runtime_ready_endpoints: int = 0


class ModelCredentialGovernanceBreakdownResponse(BaseModel):
    credential_mode: CredentialMode
    total_endpoints: int = 0
    enabled_endpoints: int = 0
    configured_endpoints: int = 0


class ModelProviderCompatibilityResponse(BaseModel):
    provider_type: Literal["deterministic", "openai_compatible", "ollama", "vllm"]
    routing_style: ModelProviderRoutingStyle
    requires_base_url: bool
    supports_no_credential: bool
    supports_environment_credential: bool
    supports_managed_reserved: bool
    preview_available: bool
    default_base_url_hint: str | None = None


class ModelProviderRuntimePostureResponse(BaseModel):
    provider_type: Literal["deterministic", "openai_compatible", "ollama", "vllm"]
    posture_status: ModelProviderRuntimePostureStatus
    total_endpoints: int = 0
    enabled_endpoints: int = 0
    runtime_ready_endpoints: int = 0
    default_endpoints: int = 0
    runtime_ready_default_endpoints: int = 0
    bound_agent_count: int = 0
    active_agent_count: int = 0
    attention_active_agent_count: int = 0
    missing_base_url_endpoints: int = 0
    missing_credential_hint_endpoints: int = 0
    recent_preview_completed_events: int = 0
    recent_preview_blocked_events: int = 0
    recent_preview_failed_events: int = 0
    last_preview_status: ModelEndpointPreviewStatus | None = None
    last_preview_at: datetime | None = None


class ModelGovernanceSummaryResponse(BaseModel):
    total_endpoints: int = 0
    enabled_endpoints: int = 0
    disabled_endpoints: int = 0
    bound_endpoints: int = 0
    default_endpoints: int = 0
    enabled_default_endpoints: int = 0
    runtime_ready_default_endpoints: int = 0
    settings_fallback_exposed: bool = False
    disabled_bound_endpoints: int = 0
    runtime_ready_endpoints: int = 0
    missing_base_url_endpoints: int = 0
    environment_credential_endpoints: int = 0
    missing_credential_hint_endpoints: int = 0
    managed_reserved_credential_endpoints: int = 0
    no_credential_endpoints: int = 0
    deterministic_endpoints: int = 0
    ollama_endpoints: int = 0
    openai_compatible_endpoints: int = 0
    vllm_endpoints: int = 0
    provider_breakdown: list[ModelProviderGovernanceBreakdownResponse] = Field(default_factory=list)
    credential_breakdown: list[ModelCredentialGovernanceBreakdownResponse] = Field(default_factory=list)
    provider_compatibility: list[ModelProviderCompatibilityResponse] = Field(default_factory=list)
    provider_runtime_posture: list[ModelProviderRuntimePostureResponse] = Field(default_factory=list)
