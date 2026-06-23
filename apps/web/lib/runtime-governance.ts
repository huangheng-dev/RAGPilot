"use client";

import { readApiErrorMessage } from "@/lib/api-errors";
import { buildSessionActorHeaders } from "@/lib/local-session";

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
    capabilities: string[];
    is_enabled: boolean;
    is_default: boolean;
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

function buildApiBaseUrl() {
  const configuredBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  const fallbackBaseUrl = "http://127.0.0.1:18000";
  const baseUrl = configuredBaseUrl && configuredBaseUrl.length > 0 ? configuredBaseUrl : fallbackBaseUrl;
  return baseUrl.endsWith("/api/v1") ? baseUrl : `${baseUrl}/api/v1`;
}

const apiBaseUrl = buildApiBaseUrl();

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...buildSessionActorHeaders(init?.headers)
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response));
  }

  return (await response.json()) as T;
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
