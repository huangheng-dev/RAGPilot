"use client";

import { authenticatedApiRequest } from "@/lib/authenticated-api";

export type ModelProviderType =
  | "deterministic"
  | "openai_compatible"
  | "ollama"
  | "ollama_reserved"
  | "vllm"
  | "vllm_reserved";
export type ModelCapability = "chat" | "embeddings";
export type CredentialMode = "none" | "environment" | "managed_reserved";
export type RetrievalMode = "hybrid" | "vector" | "lexical";

export type PlatformModelEndpoint = {
  id: string;
  name: string;
  slug: string;
  provider_type: ModelProviderType;
  model_name: string;
  base_url: string | null;
  credential_mode: CredentialMode;
  credential_key_hint: string | null;
  capabilities: ModelCapability[];
  is_enabled: boolean;
  is_default: boolean;
  notes: string | null;
  bound_agent_count: number;
  recent_preview_completed_events: number;
  recent_preview_blocked_events: number;
  recent_preview_failed_events: number;
  last_preview_status: ModelEndpointPreviewStatus | null;
  last_preview_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ModelEndpointPreviewStatus = "completed" | "blocked" | "failed";
export type ModelEndpointGovernanceActionType = "enable_endpoint" | "disable_endpoint" | "promote_default";

export type ModelEndpointPreviewResponse = {
  model_endpoint_id: string;
  name: string;
  slug: string;
  provider_type: ModelProviderType;
  model_name: string;
  preview_status: ModelEndpointPreviewStatus;
  summary: string;
  response_excerpt: string | null;
  request_metadata: Record<string, unknown>;
  response_metadata: Record<string, unknown>;
  error_message: string | null;
  executed_at: string;
};

export type ModelEndpointGovernanceActionResponse = {
  action_type: ModelEndpointGovernanceActionType;
  summary: string;
  model_endpoint: PlatformModelEndpoint;
};

export type ModelProviderGovernanceBreakdown = {
  provider_type: ModelProviderType;
  total_endpoints: number;
  enabled_endpoints: number;
  bound_endpoints: number;
  default_endpoints: number;
  runtime_ready_endpoints: number;
};

export type ModelProviderCompatibility = {
  provider_type: "deterministic" | "openai_compatible" | "ollama" | "vllm";
  routing_style: "builtin" | "native_http" | "openai_compatible";
  requires_base_url: boolean;
  supports_no_credential: boolean;
  supports_environment_credential: boolean;
  supports_managed_reserved: boolean;
  preview_available: boolean;
  default_base_url_hint: string | null;
};

export type ModelProviderRuntimePosture = {
  provider_type: "deterministic" | "openai_compatible" | "ollama" | "vllm";
  posture_status: "ready" | "attention" | "setup_required";
  total_endpoints: number;
  enabled_endpoints: number;
  runtime_ready_endpoints: number;
  default_endpoints: number;
  runtime_ready_default_endpoints: number;
  bound_agent_count: number;
  active_agent_count: number;
  attention_active_agent_count: number;
  missing_base_url_endpoints: number;
  missing_credential_hint_endpoints: number;
  recent_preview_completed_events: number;
  recent_preview_blocked_events: number;
  recent_preview_failed_events: number;
  last_preview_status: ModelEndpointPreviewStatus | null;
  last_preview_at: string | null;
};

export type ModelCredentialGovernanceBreakdown = {
  credential_mode: CredentialMode;
  total_endpoints: number;
  enabled_endpoints: number;
  configured_endpoints: number;
};

export type ModelGovernanceSummary = {
  total_endpoints: number;
  enabled_endpoints: number;
  disabled_endpoints: number;
  bound_endpoints: number;
  default_endpoints: number;
  enabled_default_endpoints: number;
  runtime_ready_default_endpoints: number;
  settings_fallback_exposed: boolean;
  disabled_bound_endpoints: number;
  runtime_ready_endpoints: number;
  missing_base_url_endpoints: number;
  environment_credential_endpoints: number;
  missing_credential_hint_endpoints: number;
  managed_reserved_credential_endpoints: number;
  no_credential_endpoints: number;
  deterministic_endpoints: number;
  ollama_endpoints: number;
  openai_compatible_endpoints: number;
  vllm_endpoints: number;
  provider_breakdown: ModelProviderGovernanceBreakdown[];
  credential_breakdown: ModelCredentialGovernanceBreakdown[];
  provider_compatibility: ModelProviderCompatibility[];
  provider_runtime_posture: ModelProviderRuntimePosture[];
};

export type ToolTransportType = "native" | "http" | "mcp_reserved";
export type ToolSurfaceArea = "chat" | "documents" | "operations" | "admin" | "agents";
export type McpConnectorType = "streamable_http" | "sse" | "managed_reserved";
export type McpConnectorAuthMode = "none" | "environment" | "managed_reserved";

export type PlatformToolRegistration = {
  id: string;
  name: string;
  slug: string;
  transport_type: ToolTransportType;
  surface_area: ToolSurfaceArea;
  endpoint_url: string | null;
  connector_reference: string | null;
  description: string | null;
  capabilities: string[];
  requires_admin_approval: boolean;
  is_enabled: boolean;
  bound_agent_count: number;
  recent_preview_completed_events: number;
  recent_preview_blocked_events: number;
  recent_preview_failed_events: number;
  last_preview_status: string | null;
  last_preview_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ToolTransportGovernanceBreakdown = {
  transport_type: ToolTransportType;
  total_tools: number;
  enabled_tools: number;
  bound_tools: number;
  approval_required_tools: number;
  missing_endpoint_tools: number;
  connector_configured_tools: number;
  runtime_ready_tools: number;
};

export type ToolSurfaceGovernanceBreakdown = {
  surface_area: ToolSurfaceArea;
  total_tools: number;
  enabled_tools: number;
  bound_tools: number;
  approval_required_tools: number;
};

export type ToolGovernanceSummary = {
  total_tools: number;
  enabled_tools: number;
  disabled_tools: number;
  bound_tools: number;
  approval_required_tools: number;
  native_tools: number;
  http_tools: number;
  http_tools_missing_endpoint_tools: number;
  mcp_reserved_tools: number;
  mcp_reserved_bound_tools: number;
  mcp_integration_pending_tools: number;
  mcp_connector_configured_tools: number;
  mcp_connector_unhealthy_tools: number;
  runtime_ready_tools: number;
  recent_preview_completed_events: number;
  recent_preview_blocked_events: number;
  recent_preview_failed_events: number;
  last_preview_status: string | null;
  last_preview_at: string | null;
  transport_breakdown: ToolTransportGovernanceBreakdown[];
  surface_breakdown: ToolSurfaceGovernanceBreakdown[];
};

export type ToolGovernanceActionType =
  | "disable_tool"
  | "enable_tool"
  | "require_admin_approval"
  | "allow_direct_use"
  | "quarantine_tool"
  | "review_mcp_boundary"
  | "ready_mcp_integration"
  | "quarantine_mcp_boundary";

export type ToolMcpBoundaryStatus = "reviewing" | "quarantined" | "ready_for_integration";

export type ToolGovernanceActionResponse = {
  action_type: ToolGovernanceActionType;
  summary: string;
  tool_registration: PlatformToolRegistration;
};

export type ToolInvocationStatus = "completed" | "blocked" | "reserved" | "unavailable" | "failed" | "skipped";
export type ToolRuntimeGovernanceIssue =
  | "approval_required"
  | "tool_disabled"
  | "mcp_reserved"
  | "mcp_integration_pending"
  | "endpoint_failure"
  | "runtime_failure";

export type ToolInvocationPreviewRequest = {
  tenant_id: string;
  workspace_id?: string | null;
  knowledge_base_id?: string | null;
  execution_input?: string | null;
};

export type ToolInvocationResponse = {
  tool_registration_id: string;
  name: string;
  slug: string;
  transport_type: ToolTransportType;
  surface_area: ToolSurfaceArea;
  invocation_status: ToolInvocationStatus;
  governance_issue: ToolRuntimeGovernanceIssue | null;
  endpoint_url: string | null;
  summary: string;
  capability_results: Record<string, unknown>;
  request_metadata: Record<string, unknown>;
  response_metadata: Record<string, unknown>;
  error_message: string | null;
  executed_at: string;
};

export type ToolRuntimeAuditRecord = {
  agent_execution_id: string;
  agent_definition_id: string;
  execution_mode: string;
  execution_status: string;
  trigger_source: string;
  tool_registration_id: string;
  name: string;
  slug: string;
  transport_type: ToolTransportType;
  surface_area: ToolSurfaceArea;
  invocation_status: ToolInvocationStatus;
  governance_issue: ToolRuntimeGovernanceIssue | null;
  endpoint_url: string | null;
  summary: string;
  capability_results: Record<string, unknown>;
  request_metadata: Record<string, unknown>;
  response_metadata: Record<string, unknown>;
  error_message: string | null;
  executed_at: string;
};

export type ToolRuntimeAuditSummary = {
  total_traces: number;
  completed_traces: number;
  blocked_traces: number;
  reserved_traces: number;
  unavailable_traces: number;
  failed_traces: number;
  skipped_traces: number;
  approval_required_traces: number;
  disabled_traces: number;
  mcp_reserved_traces: number;
  mcp_integration_pending_traces: number;
  endpoint_failure_traces: number;
  runtime_failure_traces: number;
};

export type ToolRuntimeAuditListResponse = {
  summary: ToolRuntimeAuditSummary;
  items: ToolRuntimeAuditRecord[];
};

export type ToolMcpBoundaryWorklistItem = {
  tool_registration_id: string;
  name: string;
  slug: string;
  surface_area: ToolSurfaceArea;
  boundary_status: ToolMcpBoundaryStatus;
  connector_reference: string | null;
  requires_admin_approval: boolean;
  is_enabled: boolean;
  bound_agent_count: number;
  reserved_trace_count: number;
  available_actions: ToolGovernanceActionType[];
  latest_invocation_status: ToolInvocationStatus | null;
  latest_governance_issue: ToolRuntimeGovernanceIssue | null;
  latest_summary: string | null;
  latest_executed_at: string | null;
};

export type ToolMcpBoundaryWorklistResponse = {
  total_reserved_tools: number;
  bound_reserved_tools: number;
  reserved_trace_count: number;
  reviewing_tools: number;
  quarantined_tools: number;
  ready_for_integration_tools: number;
  items: ToolMcpBoundaryWorklistItem[];
};

export type PlatformMcpConnector = {
  id: string;
  name: string;
  slug: string;
  connector_type: McpConnectorType;
  base_url: string | null;
  auth_mode: McpConnectorAuthMode;
  credential_key_hint: string | null;
  notes: string | null;
  is_enabled: boolean;
  referenced_tool_count: number;
  integration_ready_tool_count: number;
  recent_preview_completed_events: number;
  recent_preview_blocked_events: number;
  recent_preview_failed_events: number;
  last_preview_status: McpConnectorPreviewStatus | null;
  last_preview_at: string | null;
  created_at: string;
  updated_at: string;
};

export type McpRemoteTool = {
  name: string;
  description: string | null;
  input_schema: Record<string, unknown>;
};

export type McpRemoteToolCatalog = {
  mcp_connector_id: string;
  connector_slug: string;
  protocol_version: string;
  server_info: Record<string, unknown>;
  tools: McpRemoteTool[];
  discovered_at: string;
};

export type McpConnectorTypeGovernanceBreakdown = {
  connector_type: McpConnectorType;
  total_connectors: number;
  enabled_connectors: number;
  referenced_connectors: number;
  runtime_ready_connectors: number;
};

export type McpConnectorAuthGovernanceBreakdown = {
  auth_mode: McpConnectorAuthMode;
  total_connectors: number;
  enabled_connectors: number;
  configured_connectors: number;
};

export type McpConnectorGovernanceSummary = {
  total_connectors: number;
  enabled_connectors: number;
  disabled_connectors: number;
  referenced_connectors: number;
  integration_ready_connectors: number;
  blocked_integration_connectors: number;
  runtime_ready_connectors: number;
  missing_base_url_connectors: number;
  environment_auth_connectors: number;
  missing_credential_hint_connectors: number;
  managed_reserved_connectors: number;
  recent_preview_completed_events: number;
  recent_preview_blocked_events: number;
  recent_preview_failed_events: number;
  last_preview_status: McpConnectorPreviewStatus | null;
  last_preview_at: string | null;
  type_breakdown: McpConnectorTypeGovernanceBreakdown[];
  auth_breakdown: McpConnectorAuthGovernanceBreakdown[];
};

export type McpConnectorPreviewStatus = "completed" | "blocked" | "failed";
export type McpConnectorGovernanceActionType = "enable_connector" | "disable_connector";

export type McpConnectorGovernanceActionResponse = {
  action_type: McpConnectorGovernanceActionType;
  summary: string;
  mcp_connector: PlatformMcpConnector;
};

export type McpConnectorPreviewResponse = {
  mcp_connector_id: string;
  name: string;
  slug: string;
  connector_type: McpConnectorType;
  preview_status: McpConnectorPreviewStatus;
  summary: string;
  request_metadata: Record<string, unknown>;
  response_metadata: Record<string, unknown>;
  error_message: string | null;
  executed_at: string;
};

export type PlatformRetrievalProfile = {
  id: string;
  name: string;
  slug: string;
  retrieval_mode: RetrievalMode;
  engine_name: "native" | "llamaindex_pilot";
  engine_version: string;
  runtime_ready: boolean;
  runtime_issue: "engine_unavailable" | null;
  top_k: number;
  vector_weight: number;
  lexical_weight: number;
  hybrid_overlap_bonus: number;
  llamaindex_similarity_cutoff: number;
  llamaindex_long_context_reorder_enabled: boolean;
  is_enabled: boolean;
  is_default: boolean;
  notes: string | null;
  bound_knowledge_base_count: number;
  created_at: string;
  updated_at: string;
};

export type RetrievalProfileGovernanceActionType = "enable_profile" | "disable_profile" | "promote_default";

export type RetrievalProfileGovernanceActionResponse = {
  action_type: RetrievalProfileGovernanceActionType;
  summary: string;
  retrieval_profile: PlatformRetrievalProfile;
};

export type ModelEndpointPayload = Omit<
  PlatformModelEndpoint,
  "id" | "bound_agent_count" | "created_at" | "updated_at"
>;

export type ToolRegistrationPayload = Omit<
  PlatformToolRegistration,
  | "id"
  | "bound_agent_count"
  | "recent_preview_completed_events"
  | "recent_preview_blocked_events"
  | "recent_preview_failed_events"
  | "last_preview_status"
  | "last_preview_at"
  | "created_at"
  | "updated_at"
>;

export type RetrievalProfilePayload = Omit<
  PlatformRetrievalProfile,
  | "id"
  | "runtime_ready"
  | "runtime_issue"
  | "bound_knowledge_base_count"
  | "created_at"
  | "updated_at"
>;

export type McpConnectorPayload = Omit<
  PlatformMcpConnector,
  "id" | "referenced_tool_count" | "integration_ready_tool_count" | "created_at" | "updated_at"
>;

export type PlatformGovernanceResourceKey =
  | "model_endpoints"
  | "tool_registrations"
  | "retrieval_profiles";

export type PlatformGovernanceLoadIssue = {
  resource: PlatformGovernanceResourceKey;
  message: string;
};

export type PlatformGovernanceSnapshot = {
  modelEndpoints: PlatformModelEndpoint[];
  toolRegistrations: PlatformToolRegistration[];
  retrievalProfiles: PlatformRetrievalProfile[];
  issues: PlatformGovernanceLoadIssue[];
};

export type RuntimeGovernanceResourceType =
  | "model_endpoint"
  | "tool_registration"
  | "mcp_connector"
  | "retrieval_profile";

export type RuntimeGovernanceToolListFilter =
  | "approval_required"
  | "disabled"
  | "mcp_reserved_bound"
  | "mcp_integration_pending";

export type RuntimeGovernanceAgentIssue =
  | "model_disabled"
  | "model_runtime_unconfigured"
  | "retrieval_profile_disabled"
  | "retrieval_engine_unavailable"
  | "tool_registration_disabled"
  | "tool_approval_required"
  | "tool_mcp_reserved"
  | "tool_mcp_integration_pending"
  | "runtime_engine_unavailable";

export type RuntimeGovernanceSettingsTarget = {
  runtime_resource: RuntimeGovernanceResourceType;
  model_endpoint_id: string | null;
  model_provider_type: "deterministic" | "openai_compatible" | "ollama" | "vllm" | null;
  tool_registration_id: string | null;
  tool_list_filter: RuntimeGovernanceToolListFilter | null;
  retrieval_profile_id: string | null;
  mcp_connector_id: string | null;
  mcp_connector_slug: string | null;
};

export type RuntimeGovernanceAgentsTarget = {
  issue: RuntimeGovernanceAgentIssue;
  model_endpoint_id: string | null;
  model_provider_type: "deterministic" | "openai_compatible" | "ollama" | "vllm" | null;
  tool_registration_id: string | null;
  retrieval_profile_id: string | null;
};

export type RuntimeGovernanceFollowUp = {
  settings_target: RuntimeGovernanceSettingsTarget | null;
  agents_target: RuntimeGovernanceAgentsTarget | null;
};

export type RuntimeGovernanceEvent = {
  id: string;
  actor_user_id: string | null;
  actor_role: string | null;
  resource_type: RuntimeGovernanceResourceType;
  resource_id: string | null;
  resource_name: string | null;
  resource_slug: string | null;
  action_type: string;
  detail: Record<string, unknown>;
  follow_up: RuntimeGovernanceFollowUp | null;
  created_at: string;
};

export type RuntimeGovernanceWorklistCategory =
  | "approval_required_tool"
  | "mcp_integration_pending_tool"
  | "integration_blocked_connector"
  | "unconfigured_model_endpoint"
  | "disabled_bound_model_endpoint";

export type RuntimeGovernanceWorklistItem = {
  category: RuntimeGovernanceWorklistCategory;
  severity: "review" | "attention";
  resource_type: "model_endpoint" | "tool_registration" | "mcp_connector";
  resource_id: string;
  resource_name: string;
  resource_slug: string;
  action_hint: string;
  recent_preview_completed_events: number;
  recent_preview_blocked_events: number;
  recent_preview_failed_events: number;
  last_preview_status: string | null;
  last_preview_at: string | null;
  detail: Record<string, unknown>;
  follow_up: RuntimeGovernanceFollowUp | null;
};

export type RuntimeGovernanceWorklist = {
  total_items: number;
  unconfigured_model_endpoints: number;
  disabled_bound_model_endpoints: number;
  approval_required_tools: number;
  mcp_integration_pending_tools: number;
  integration_blocked_connectors: number;
  items: RuntimeGovernanceWorklistItem[];
};

export type RuntimeGovernanceOverviewStatus = "stable" | "review" | "attention";
export type RuntimeGovernanceOverviewReasonCode =
  | "stable"
  | "unconfigured_model_endpoint"
  | "disabled_bound_model_endpoint"
  | "approval_required_tool"
  | "mcp_integration_pending_tool"
  | "integration_blocked_connector";

export type RuntimeGovernanceOverview = {
  status: RuntimeGovernanceOverviewStatus;
  reason_code: RuntimeGovernanceOverviewReasonCode;
  attention_items: number;
  review_items: number;
  primary_item: RuntimeGovernanceWorklistItem | null;
  model_summary: ModelGovernanceSummary;
  tool_summary: ToolGovernanceSummary;
  mcp_connector_summary: McpConnectorGovernanceSummary;
  worklist: RuntimeGovernanceWorklist;
  recent_events: RuntimeGovernanceEvent[];
};

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  return await authenticatedApiRequest<T>(path, init);
}

export async function listModelEndpoints(filters?: {
  provider_type?: ModelProviderType;
  is_enabled?: boolean;
  runtime_state?:
    | "disabled_bound"
    | "managed_reserved"
    | "missing_base_url"
    | "missing_credential_hint"
    | "runtime_ready";
  query?: string;
}) {
  const params = new URLSearchParams();
  if (filters?.provider_type) {
    params.set("provider_type", filters.provider_type);
  }
  if (typeof filters?.is_enabled === "boolean") {
    params.set("is_enabled", String(filters.is_enabled));
  }
  if (filters?.runtime_state) {
    params.set("runtime_state", filters.runtime_state);
  }
  if (filters?.query?.trim()) {
    params.set("query", filters.query.trim());
  }

  const query = params.toString();
  return await apiRequest<PlatformModelEndpoint[]>(`/model-endpoints${query ? `?${query}` : ""}`);
}

export async function createModelEndpoint(payload: ModelEndpointPayload) {
  return await apiRequest<PlatformModelEndpoint>("/model-endpoints", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function updateModelEndpoint(
  modelEndpointId: string,
  payload: ModelEndpointPayload
) {
  return await apiRequest<PlatformModelEndpoint>(`/model-endpoints/${modelEndpointId}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export async function deleteModelEndpoint(modelEndpointId: string) {
  await apiRequest<void>(`/model-endpoints/${modelEndpointId}`, {
    method: "DELETE"
  });
}

export async function previewModelEndpoint(modelEndpointId: string) {
  return await apiRequest<ModelEndpointPreviewResponse>(`/model-endpoints/${modelEndpointId}/preview`, {
    method: "POST"
  });
}

export async function applyModelEndpointGovernanceAction(
  modelEndpointId: string,
  actionType: ModelEndpointGovernanceActionType
) {
  return await apiRequest<ModelEndpointGovernanceActionResponse>(`/model-endpoints/${modelEndpointId}/governance-action`, {
    method: "POST",
    body: JSON.stringify({ action_type: actionType })
  });
}

export async function loadModelGovernanceSummary() {
  return await apiRequest<ModelGovernanceSummary>("/model-endpoints/governance-summary");
}

export async function listToolRegistrations(filters?: {
  transport_type?: ToolTransportType;
  surface_area?: ToolSurfaceArea;
  is_enabled?: boolean;
  requires_admin_approval?: boolean;
  runtime_state?:
    | "approval_required"
    | "disabled"
    | "missing_endpoint"
    | "mcp_reserved"
    | "mcp_reserved_bound"
    | "mcp_integration_pending"
    | "mcp_connector_configured"
    | "mcp_connector_unhealthy"
    | "runtime_ready";
  query?: string;
}) {
  const params = new URLSearchParams();
  if (filters?.transport_type) {
    params.set("transport_type", filters.transport_type);
  }
  if (filters?.surface_area) {
    params.set("surface_area", filters.surface_area);
  }
  if (typeof filters?.is_enabled === "boolean") {
    params.set("is_enabled", String(filters.is_enabled));
  }
  if (typeof filters?.requires_admin_approval === "boolean") {
    params.set("requires_admin_approval", String(filters.requires_admin_approval));
  }
  if (filters?.runtime_state) {
    params.set("runtime_state", filters.runtime_state);
  }
  if (filters?.query?.trim()) {
    params.set("query", filters.query.trim());
  }

  const query = params.toString();
  return await apiRequest<PlatformToolRegistration[]>(`/tool-registrations${query ? `?${query}` : ""}`);
}

export async function createToolRegistration(payload: ToolRegistrationPayload) {
  return await apiRequest<PlatformToolRegistration>("/tool-registrations", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function updateToolRegistration(
  toolRegistrationId: string,
  payload: ToolRegistrationPayload
) {
  return await apiRequest<PlatformToolRegistration>(`/tool-registrations/${toolRegistrationId}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export async function deleteToolRegistration(toolRegistrationId: string) {
  await apiRequest<void>(`/tool-registrations/${toolRegistrationId}`, {
    method: "DELETE"
  });
}

export async function applyToolGovernanceAction(
  toolRegistrationId: string,
  actionType: ToolGovernanceActionType
) {
  return await apiRequest<ToolGovernanceActionResponse>(`/tool-registrations/${toolRegistrationId}/governance-action`, {
    method: "POST",
    body: JSON.stringify({ action_type: actionType })
  });
}

export async function previewToolRegistration(
  toolRegistrationId: string,
  payload: ToolInvocationPreviewRequest
) {
  return await apiRequest<ToolInvocationResponse>(`/tool-registrations/${toolRegistrationId}/preview`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function loadToolGovernanceSummary() {
  return await apiRequest<ToolGovernanceSummary>("/tool-registrations/governance-summary");
}

export async function loadToolRuntimeAudit(filters: {
  tenant_id: string;
  tool_registration_id?: string;
  invocation_status?: ToolInvocationStatus;
  limit?: number;
}) {
  const params = new URLSearchParams({
    tenant_id: filters.tenant_id,
    limit: String(filters.limit ?? 8)
  });
  if (filters.tool_registration_id) {
    params.set("tool_registration_id", filters.tool_registration_id);
  }
  if (filters.invocation_status) {
    params.set("invocation_status", filters.invocation_status);
  }
  return await apiRequest<ToolRuntimeAuditListResponse>(`/tool-registrations/runtime-audit?${params.toString()}`);
}

export async function loadToolMcpBoundaryWorklist(filters: {
  tenant_id: string;
  limit?: number;
}) {
  const params = new URLSearchParams({
    tenant_id: filters.tenant_id,
  });
  if (typeof filters.limit === "number") {
    params.set("limit", String(filters.limit));
  }
  return await apiRequest<ToolMcpBoundaryWorklistResponse>(
    `/tool-registrations/mcp-boundary-worklist?${params.toString()}`
  );
}

export async function listMcpConnectors(filters?: {
  connector_type?: McpConnectorType;
  is_enabled?: boolean;
  runtime_state?:
    | "disabled"
    | "missing_base_url"
    | "missing_credential_hint"
    | "managed_reserved"
    | "referenced"
    | "runtime_ready";
  query?: string;
}) {
  const params = new URLSearchParams();
  if (filters?.connector_type) {
    params.set("connector_type", filters.connector_type);
  }
  if (typeof filters?.is_enabled === "boolean") {
    params.set("is_enabled", String(filters.is_enabled));
  }
  if (filters?.runtime_state) {
    params.set("runtime_state", filters.runtime_state);
  }
  if (filters?.query?.trim()) {
    params.set("query", filters.query.trim());
  }

  const query = params.toString();
  return await apiRequest<PlatformMcpConnector[]>(`/mcp-connectors${query ? `?${query}` : ""}`);
}

export async function createMcpConnector(payload: McpConnectorPayload) {
  return await apiRequest<PlatformMcpConnector>("/mcp-connectors", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function updateMcpConnector(
  mcpConnectorId: string,
  payload: McpConnectorPayload
) {
  return await apiRequest<PlatformMcpConnector>(`/mcp-connectors/${mcpConnectorId}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export async function deleteMcpConnector(mcpConnectorId: string) {
  await apiRequest<void>(`/mcp-connectors/${mcpConnectorId}`, {
    method: "DELETE"
  });
}

export async function previewMcpConnector(mcpConnectorId: string) {
  return await apiRequest<McpConnectorPreviewResponse>(`/mcp-connectors/${mcpConnectorId}/preview`, {
    method: "POST"
  });
}

export async function listMcpConnectorTools(mcpConnectorId: string) {
  return await apiRequest<McpRemoteToolCatalog>(
    `/mcp-connectors/${mcpConnectorId}/tools`,
  );
}

export async function applyMcpConnectorGovernanceAction(
  mcpConnectorId: string,
  actionType: McpConnectorGovernanceActionType
) {
  return await apiRequest<McpConnectorGovernanceActionResponse>(`/mcp-connectors/${mcpConnectorId}/governance-action`, {
    method: "POST",
    body: JSON.stringify({ action_type: actionType })
  });
}

export async function loadMcpConnectorGovernanceSummary() {
  return await apiRequest<McpConnectorGovernanceSummary>("/mcp-connectors/governance-summary");
}

export async function listRetrievalProfiles() {
  return await apiRequest<PlatformRetrievalProfile[]>("/retrieval-profiles");
}

export async function createRetrievalProfile(payload: RetrievalProfilePayload) {
  return await apiRequest<PlatformRetrievalProfile>("/retrieval-profiles", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function updateRetrievalProfile(
  retrievalProfileId: string,
  payload: RetrievalProfilePayload
) {
  return await apiRequest<PlatformRetrievalProfile>(`/retrieval-profiles/${retrievalProfileId}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export async function deleteRetrievalProfile(retrievalProfileId: string) {
  await apiRequest<void>(`/retrieval-profiles/${retrievalProfileId}`, {
    method: "DELETE"
  });
}

export async function applyRetrievalProfileGovernanceAction(
  retrievalProfileId: string,
  actionType: RetrievalProfileGovernanceActionType
) {
  return await apiRequest<RetrievalProfileGovernanceActionResponse>(
    `/retrieval-profiles/${retrievalProfileId}/governance-action`,
    {
      method: "POST",
      body: JSON.stringify({ action_type: actionType })
    }
  );
}

export async function listRuntimeGovernanceEvents(filters?: {
  resource_type?: RuntimeGovernanceResourceType;
  action_type?: string;
  actor_role?: "super_admin" | "operator" | "reviewer";
  query?: string;
  limit?: number;
}) {
  const params = new URLSearchParams();
  if (filters?.resource_type) {
    params.set("resource_type", filters.resource_type);
  }
  if (filters?.action_type?.trim()) {
    params.set("action_type", filters.action_type.trim());
  }
  if (filters?.actor_role) {
    params.set("actor_role", filters.actor_role);
  }
  if (filters?.query?.trim()) {
    params.set("query", filters.query.trim());
  }
  if (typeof filters?.limit === "number") {
    params.set("limit", String(filters.limit));
  }
  const query = params.toString();
  return await apiRequest<RuntimeGovernanceEvent[]>(`/runtime-governance/events${query ? `?${query}` : ""}`);
}

export async function loadRuntimeGovernanceWorklist(filters?: {
  limit?: number;
  category?: RuntimeGovernanceWorklistCategory;
  severity?: "review" | "attention";
  resource_type?: "model_endpoint" | "tool_registration" | "mcp_connector";
  query?: string;
}) {
  const params = new URLSearchParams();
  if (typeof filters?.limit === "number") {
    params.set("limit", String(filters.limit));
  }
  if (filters?.category) {
    params.set("category", filters.category);
  }
  if (filters?.severity) {
    params.set("severity", filters.severity);
  }
  if (filters?.resource_type) {
    params.set("resource_type", filters.resource_type);
  }
  if (filters?.query?.trim()) {
    params.set("query", filters.query.trim());
  }
  const query = params.toString();
  return await apiRequest<RuntimeGovernanceWorklist>(`/runtime-governance/worklist${query ? `?${query}` : ""}`);
}

export async function loadRuntimeGovernanceOverview(filters?: {
  worklist_limit?: number;
  recent_event_limit?: number;
}) {
  const params = new URLSearchParams();
  if (typeof filters?.worklist_limit === "number") {
    params.set("worklist_limit", String(filters.worklist_limit));
  }
  if (typeof filters?.recent_event_limit === "number") {
    params.set("recent_event_limit", String(filters.recent_event_limit));
  }
  const query = params.toString();
  return await apiRequest<RuntimeGovernanceOverview>(`/runtime-governance/overview${query ? `?${query}` : ""}`);
}

function readIssueMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown governance registry error.";
}

function formatGovernanceResourceLabel(resource: PlatformGovernanceResourceKey) {
  if (resource === "model_endpoints") {
    return "model endpoints";
  }

  if (resource === "tool_registrations") {
    return "tool registrations";
  }

  return "retrieval profiles";
}

export function formatPlatformGovernanceIssues(issues: PlatformGovernanceLoadIssue[]) {
  if (issues.length === 0) {
    return "";
  }

  return issues
    .map((issue) => `${formatGovernanceResourceLabel(issue.resource)}: ${issue.message}`)
    .join(" | ");
}

export async function loadPlatformGovernanceSnapshot(): Promise<PlatformGovernanceSnapshot> {
  const [modelEndpointsResult, toolRegistrationsResult, retrievalProfilesResult] = await Promise.allSettled([
    listModelEndpoints(),
    listToolRegistrations(),
    listRetrievalProfiles()
  ]);

  const issues: PlatformGovernanceLoadIssue[] = [];

  if (modelEndpointsResult.status === "rejected") {
    issues.push({
      resource: "model_endpoints",
      message: readIssueMessage(modelEndpointsResult.reason)
    });
  }

  if (toolRegistrationsResult.status === "rejected") {
    issues.push({
      resource: "tool_registrations",
      message: readIssueMessage(toolRegistrationsResult.reason)
    });
  }

  if (retrievalProfilesResult.status === "rejected") {
    issues.push({
      resource: "retrieval_profiles",
      message: readIssueMessage(retrievalProfilesResult.reason)
    });
  }

  return {
    modelEndpoints: modelEndpointsResult.status === "fulfilled" ? modelEndpointsResult.value : [],
    toolRegistrations: toolRegistrationsResult.status === "fulfilled" ? toolRegistrationsResult.value : [],
    retrievalProfiles: retrievalProfilesResult.status === "fulfilled" ? retrievalProfilesResult.value : [],
    issues
  };
}
