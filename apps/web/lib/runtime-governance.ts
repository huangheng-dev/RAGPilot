"use client";

import { authenticatedApiRequest } from "@/lib/authenticated-api";
import type {
  RuntimeGovernanceFollowUpTarget,
  RuntimeGovernanceIssueDefinitionsTarget
} from "@/lib/console-route-builders";

export type GovernanceTenantScope = {
  id: string;
  name: string;
  slug: string;
};

export type GovernanceActiveAgentDefinition = {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  mode: "grounded_chat" | "document_intake" | "workflow_recovery";
  status: "draft" | "active" | "paused";
  objective: string;
  knowledge_base_scope: string | null;
  tools: Array<"chat" | "documents" | "operations" | "admin">;
  model_endpoint_id: string | null;
  tool_registration_ids: string[];
  updated_at: string;
};

export type AgentRuntimeReadinessIssue =
  | "model_missing"
  | "model_disabled"
  | "model_runtime_unconfigured"
  | "retrieval_profile_missing"
  | "retrieval_profile_disabled"
  | "scope_missing"
  | "scope_invalid"
  | "tools_missing"
  | "tool_registration_disabled"
  | "tool_approval_required"
  | "tool_mcp_reserved"
  | "tool_mcp_integration_pending";

export type AgentRuntimeGovernanceItem = GovernanceActiveAgentDefinition & {
  is_ready: boolean;
  issues: AgentRuntimeReadinessIssue[];
  blocking_issues: AgentRuntimeReadinessIssue[];
  has_connected_capabilities: boolean;
  approval_required_tool_count: number;
  disabled_registered_tool_count: number;
  missing_tool_registration_count: number;
  reserved_mcp_tool_count: number;
  integration_pending_mcp_tool_count: number;
  disabled_tool_registration_id: string | null;
  approval_required_tool_registration_id: string | null;
  reserved_mcp_tool_registration_id: string | null;
  integration_pending_mcp_tool_registration_id: string | null;
  integration_pending_mcp_connector_reference: string | null;
  focus_tool_registration: {
    id: string;
    name: string;
    slug: string;
    transport_type: "native" | "http" | "mcp_reserved";
    surface_area: "chat" | "documents" | "operations" | "admin" | "agents";
    endpoint_url: string | null;
    connector_reference: string | null;
    requires_admin_approval: boolean;
    is_enabled: boolean;
    recent_preview_completed_events: number;
    recent_preview_blocked_events: number;
    recent_preview_failed_events: number;
    last_preview_status: "completed" | "blocked" | "failed" | null;
    last_preview_at: string | null;
  } | null;
  focus_mcp_connector: {
    id: string;
    name: string;
    slug: string;
    connector_type: "streamable_http" | "sse" | "managed_reserved";
    base_url: string | null;
    auth_mode: "none" | "environment" | "managed_reserved";
    credential_key_hint: string | null;
    is_enabled: boolean;
    recent_preview_completed_events: number;
    recent_preview_blocked_events: number;
    recent_preview_failed_events: number;
    last_preview_status: "completed" | "blocked" | "failed" | null;
    last_preview_at: string | null;
  } | null;
  resolved_scope: {
    workspace_id: string | null;
    workspace_slug: string | null;
    workspace_name: string | null;
    knowledge_base_id: string | null;
    knowledge_base_slug: string | null;
    knowledge_base_name: string | null;
    scope_issue: "scope_missing" | "scope_invalid" | null;
  };
  resolved_model_endpoint: {
    id: string;
    name: string;
    slug: string;
    provider_type: string;
    model_name: string;
    base_url: string | null;
    credential_mode: string;
    credential_key_hint: string | null;
    capabilities: string[];
    is_enabled: boolean;
    is_default: boolean;
    runtime_ready: boolean;
    runtime_issue: "missing_base_url" | "missing_credential_hint" | "managed_reserved" | null;
    recent_preview_completed_events: number;
    recent_preview_blocked_events: number;
    recent_preview_failed_events: number;
    last_preview_status: "completed" | "blocked" | "failed" | null;
    last_preview_at: string | null;
  } | null;
  resolved_retrieval_profile: {
    id: string;
    name: string;
    slug: string;
    retrieval_mode: string;
    is_enabled: boolean;
    is_default: boolean;
    source: "knowledge_base" | "platform_default";
  } | null;
};

export type AgentRuntimeGovernanceSummary = {
  totalAgents: number;
  activeAgents: number;
  pausedAgents: number;
  draftAgents: number;
  attentionAgents: number;
  readyAgents: number;
  activeAgentsWithoutScope: number;
  agentsMissingModel: number;
  agentsUsingDisabledModel: number;
  agentsUsingUnconfiguredModel: number;
  agentsMissingRetrievalProfile: number;
  agentsUsingDisabledRetrievalProfile: number;
  agentsMissingToolRegistration: number;
  agentsUsingDisabledToolRegistration: number;
  modelEndpoints: number;
  enabledModels: number;
  disabledBoundModels: number;
  unboundEnabledModels: number;
  toolRegistrations: number;
  enabledTools: number;
  approvalGatedTools: number;
  disabledBoundTools: number;
  unboundEnabledTools: number;
  issue_counts: Record<AgentRuntimeReadinessIssue, number>;
};

export type AgentRuntimeGovernanceResponse = {
  summary: AgentRuntimeGovernanceSummary;
  items: AgentRuntimeGovernanceItem[];
};

export type RuntimeGovernanceFocusState = Pick<
  AgentRuntimeGovernanceItem,
  | "issues"
  | "blocking_issues"
  | "approval_required_tool_count"
  | "disabled_registered_tool_count"
  | "reserved_mcp_tool_count"
  | "integration_pending_mcp_tool_count"
  | "resolved_model_endpoint"
  | "resolved_retrieval_profile"
  | "disabled_tool_registration_id"
  | "approval_required_tool_registration_id"
  | "reserved_mcp_tool_registration_id"
  | "integration_pending_mcp_tool_registration_id"
  | "integration_pending_mcp_connector_reference"
  | "focus_tool_registration"
  | "focus_mcp_connector"
>;

const RUNTIME_GOVERNANCE_FOCUS_PRIORITY = [
  "model_disabled",
  "model_runtime_unconfigured",
  "tool_registration_disabled",
  "retrieval_profile_disabled",
  "tool_approval_required",
  "tool_mcp_integration_pending",
  "tool_mcp_reserved"
] as const satisfies AgentRuntimeReadinessIssue[];

type RawAgentRuntimeGovernanceResponse = {
  summary: {
    total_agents: number;
    active_agents: number;
    paused_agents: number;
    draft_agents: number;
    attention_agents: number;
    ready_agents: number;
    active_agents_without_scope: number;
    agents_missing_model: number;
    agents_using_disabled_model: number;
    agents_using_unconfigured_model: number;
    agents_missing_retrieval_profile: number;
    agents_using_disabled_retrieval_profile: number;
    agents_missing_tool_registration: number;
    agents_using_disabled_tool_registration: number;
    model_endpoints: number;
    enabled_models: number;
    disabled_bound_models: number;
    unbound_enabled_models: number;
    tool_registrations: number;
    enabled_tools: number;
    approval_gated_tools: number;
    disabled_bound_tools: number;
    unbound_enabled_tools: number;
    issue_counts: Record<AgentRuntimeReadinessIssue, number>;
  };
  items: AgentRuntimeGovernanceItem[];
};

export function normalizeRuntimeGovernanceProviderType(
  value: string | null | undefined
): RuntimeGovernanceFollowUpTarget["unconfiguredModelProviderType"] {
  if (value === "deterministic" || value === "openai_compatible" || value === "ollama" || value === "vllm") {
    return value;
  }

  return null;
}

export function resolveRuntimeGovernanceLeadIssue(
  item: RuntimeGovernanceFocusState | null | undefined
): AgentRuntimeReadinessIssue | null {
  return item?.blocking_issues[0] ?? item?.issues[0] ?? null;
}

export function hasRuntimeGovernanceIssue(
  item: Pick<RuntimeGovernanceFocusState, "issues"> | null | undefined,
  issue: AgentRuntimeReadinessIssue
) {
  return item?.issues.includes(issue) ?? false;
}

export function selectFocusedRuntimeGovernanceItem(
  items: AgentRuntimeGovernanceItem[]
): AgentRuntimeGovernanceItem | null {
  for (const issue of RUNTIME_GOVERNANCE_FOCUS_PRIORITY) {
    const matchedItem = items.find((item) => item.issues.includes(issue));
    if (matchedItem) {
      return matchedItem;
    }
  }

  return null;
}

export function buildRuntimeGovernanceFollowUpTargetFromItem(input: {
  tenantId?: string | null;
  mode?: RuntimeGovernanceFollowUpTarget["mode"];
  fallbackAgentId?: string | null;
  item?: AgentRuntimeGovernanceItem | null;
  disabledRetrievalProfileId?: string | null;
}): RuntimeGovernanceFollowUpTarget {
  const item = input.item ?? null;
  const resolvedModelEndpoint = item?.resolved_model_endpoint ?? null;
  const resolvedRetrievalProfile = item?.resolved_retrieval_profile ?? null;

  return {
    tenantId: input.tenantId ?? null,
    mode: input.mode ?? null,
    fallbackAgentId: input.fallbackAgentId ?? null,
    disabledModelEndpointId:
      resolvedModelEndpoint && !resolvedModelEndpoint.is_enabled ? resolvedModelEndpoint.id : null,
    unconfiguredModelEndpointId:
      resolvedModelEndpoint?.runtime_ready === false ? resolvedModelEndpoint.id : null,
    unconfiguredModelProviderType:
      resolvedModelEndpoint?.runtime_ready === false
        ? normalizeRuntimeGovernanceProviderType(resolvedModelEndpoint.provider_type)
        : null,
    disabledToolRegistrationId: item?.disabled_tool_registration_id ?? null,
    pendingMcpToolRegistrationId: item?.integration_pending_mcp_tool_registration_id ?? null,
    pendingMcpConnectorReference:
      item?.integration_pending_mcp_connector_reference ??
      item?.focus_tool_registration?.connector_reference ??
      null,
    reservedMcpToolRegistrationId: item?.reserved_mcp_tool_registration_id ?? null,
    reservedMcpConnectorReference: item?.focus_tool_registration?.connector_reference ?? null,
    disabledRetrievalProfileId:
      input.disabledRetrievalProfileId ??
      (resolvedRetrievalProfile && !resolvedRetrievalProfile.is_enabled ? resolvedRetrievalProfile.id : null),
    approvalToolRegistrationId: item?.approval_required_tool_registration_id ?? null
  };
}

export function buildRuntimeGovernanceIssueDefinitionsTarget(input: {
  tenantId?: string | null;
  mode?: RuntimeGovernanceIssueDefinitionsTarget["mode"];
  issue: AgentRuntimeReadinessIssue;
  item?: RuntimeGovernanceFocusState | null;
  modelEndpointId?: string | null;
  modelProviderType?: RuntimeGovernanceIssueDefinitionsTarget["modelProviderType"];
  toolRegistrationId?: string | null;
  retrievalProfileId?: string | null;
}): RuntimeGovernanceIssueDefinitionsTarget {
  const item = input.item ?? null;
  const resolvedModelEndpoint = item?.resolved_model_endpoint ?? null;
  const resolvedRetrievalProfile = item?.resolved_retrieval_profile ?? null;

  let modelEndpointId = input.modelEndpointId ?? null;
  let modelProviderType: RuntimeGovernanceIssueDefinitionsTarget["modelProviderType"] =
    input.modelProviderType ?? null;
  let toolRegistrationId = input.toolRegistrationId ?? null;
  let retrievalProfileId = input.retrievalProfileId ?? null;

  if (input.issue === "model_disabled" && !modelEndpointId && resolvedModelEndpoint && !resolvedModelEndpoint.is_enabled) {
    modelEndpointId = resolvedModelEndpoint.id;
  }

  if (input.issue === "model_runtime_unconfigured") {
    if (!modelEndpointId && resolvedModelEndpoint?.runtime_ready === false) {
      modelEndpointId = resolvedModelEndpoint.id;
    }
    if (!modelProviderType && resolvedModelEndpoint?.runtime_ready === false) {
      modelProviderType = normalizeRuntimeGovernanceProviderType(resolvedModelEndpoint.provider_type);
    }
  }

  if (input.issue === "tool_registration_disabled" && !toolRegistrationId) {
    toolRegistrationId = item?.disabled_tool_registration_id ?? null;
  }

  if (input.issue === "tool_approval_required" && !toolRegistrationId) {
    toolRegistrationId = item?.approval_required_tool_registration_id ?? null;
  }

  if (input.issue === "tool_mcp_reserved" && !toolRegistrationId) {
    toolRegistrationId = item?.reserved_mcp_tool_registration_id ?? null;
  }

  if (input.issue === "tool_mcp_integration_pending" && !toolRegistrationId) {
    toolRegistrationId = item?.integration_pending_mcp_tool_registration_id ?? null;
  }

  if (input.issue === "retrieval_profile_disabled" && !retrievalProfileId) {
    retrievalProfileId =
      resolvedRetrievalProfile && !resolvedRetrievalProfile.is_enabled ? resolvedRetrievalProfile.id : null;
  }

  return {
    tenantId: input.tenantId ?? null,
    mode: input.mode ?? null,
    issue: input.issue,
    modelEndpointId,
    modelProviderType,
    toolRegistrationId,
    retrievalProfileId
  };
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  return await authenticatedApiRequest<T>(path, init);
}

export async function listGovernanceTenants() {
  return await apiRequest<GovernanceTenantScope[]>("/tenants");
}

export async function listActiveGovernanceAgents(tenantId: string) {
  return await apiRequest<GovernanceActiveAgentDefinition[]>(`/agents?tenant_id=${tenantId}&status=active`);
}

export async function loadAllActiveGovernanceAgents() {
  const tenants = await listGovernanceTenants();
  const agentGroups = await Promise.all(
    tenants.map(async (tenant) => await listActiveGovernanceAgents(tenant.id))
  );

  return {
    tenants,
    agents: agentGroups.flat()
  };
}

export async function loadAgentRuntimeGovernance(filters?: {
  tenant_id?: string | null;
  status?: "draft" | "active" | "paused" | null;
  mode?: "grounded_chat" | "document_intake" | "workflow_recovery" | null;
  readiness?: "ready" | "attention" | null;
  issue?: AgentRuntimeReadinessIssue | null;
  query?: string | null;
  model_endpoint_id?: string | null;
  model_provider_type?: "deterministic" | "openai_compatible" | "ollama" | "vllm" | null;
  tool_registration_id?: string | null;
  retrieval_profile_id?: string | null;
}) {
  const params = new URLSearchParams();
  if (filters?.tenant_id) {
    params.set("tenant_id", filters.tenant_id);
  }
  if (filters?.status) {
    params.set("status", filters.status);
  }
  if (filters?.mode) {
    params.set("mode", filters.mode);
  }
  if (filters?.readiness) {
    params.set("readiness", filters.readiness);
  }
  if (filters?.issue) {
    params.set("issue", filters.issue);
  }
  if (filters?.query?.trim()) {
    params.set("query", filters.query.trim());
  }
  if (filters?.model_endpoint_id) {
    params.set("model_endpoint_id", filters.model_endpoint_id);
  }
  if (filters?.model_provider_type) {
    params.set("model_provider_type", filters.model_provider_type);
  }
  if (filters?.tool_registration_id) {
    params.set("tool_registration_id", filters.tool_registration_id);
  }
  if (filters?.retrieval_profile_id) {
    params.set("retrieval_profile_id", filters.retrieval_profile_id);
  }
  const query = params.toString();
  const response = await apiRequest<RawAgentRuntimeGovernanceResponse>(
    `/agents/runtime-governance${query ? `?${query}` : ""}`
  );
  return {
    summary: {
      totalAgents: response.summary.total_agents,
      activeAgents: response.summary.active_agents,
      pausedAgents: response.summary.paused_agents,
      draftAgents: response.summary.draft_agents,
      attentionAgents: response.summary.attention_agents,
      readyAgents: response.summary.ready_agents,
      activeAgentsWithoutScope: response.summary.active_agents_without_scope,
      agentsMissingModel: response.summary.agents_missing_model,
      agentsUsingDisabledModel: response.summary.agents_using_disabled_model,
      agentsUsingUnconfiguredModel: response.summary.agents_using_unconfigured_model,
      agentsMissingRetrievalProfile: response.summary.agents_missing_retrieval_profile,
      agentsUsingDisabledRetrievalProfile: response.summary.agents_using_disabled_retrieval_profile,
      agentsMissingToolRegistration: response.summary.agents_missing_tool_registration,
      agentsUsingDisabledToolRegistration: response.summary.agents_using_disabled_tool_registration,
      modelEndpoints: response.summary.model_endpoints,
      enabledModels: response.summary.enabled_models,
      disabledBoundModels: response.summary.disabled_bound_models,
      unboundEnabledModels: response.summary.unbound_enabled_models,
      toolRegistrations: response.summary.tool_registrations,
      enabledTools: response.summary.enabled_tools,
      approvalGatedTools: response.summary.approval_gated_tools,
      disabledBoundTools: response.summary.disabled_bound_tools,
      unboundEnabledTools: response.summary.unbound_enabled_tools,
      issue_counts: response.summary.issue_counts
    },
    items: response.items
  } satisfies AgentRuntimeGovernanceResponse;
}
