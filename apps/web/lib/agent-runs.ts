import { authenticatedApiRequest } from "@/lib/authenticated-api";
import type { UrlObject } from "url";

export type AgentRunTargetSurface = "chat" | "documents" | "operations" | "admin";
export type AgentRunStatus = "launched" | "completed" | "failed" | "cancelled";
export type AgentRunTriggerSource = "agents_console" | "workspace" | "home" | "admin" | "operations";

export type AgentRunResponse = {
  id: string;
  tenant_id: string;
  agent_definition_id: string;
  workspace_id: string | null;
  knowledge_base_id: string | null;
  target_surface: AgentRunTargetSurface;
  handoff_intent: string | null;
  run_status: AgentRunStatus;
  trigger_source: AgentRunTriggerSource;
  launch_prompt: string | null;
  navigation_href: string | null;
  launched_by_user_id: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AgentRunMetricsResponse = {
  total_runs: number;
  chat_runs: number;
  document_runs: number;
  operations_runs: number;
  admin_runs: number;
  latest_launched_at: string | null;
};

export type CreateAgentRunRequest = {
  tenant_id: string;
  agent_definition_id: string;
  workspace_id?: string | null;
  knowledge_base_id?: string | null;
  target_surface: AgentRunTargetSurface;
  handoff_intent?: string | null;
  trigger_source: AgentRunTriggerSource;
  launch_prompt?: string | null;
  navigation_href?: string | null;
};

export type AgentRunRecordInput = Omit<CreateAgentRunRequest, "navigation_href">;

export type AgentRunNavigationHref = string | UrlObject;

export type AgentRunListFilters = {
  targetSurface?: AgentRunTargetSurface | null;
  triggerSource?: AgentRunTriggerSource | null;
  runStatus?: AgentRunStatus | null;
};

export const EMPTY_AGENT_RUN_METRICS: AgentRunMetricsResponse = {
  total_runs: 0,
  chat_runs: 0,
  document_runs: 0,
  operations_runs: 0,
  admin_runs: 0,
  latest_launched_at: null
};

async function agentRunApiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  return await authenticatedApiRequest<T>(path, init);
}

export async function listAgentRuns(
  tenantId: string,
  agentDefinitionId?: string | null,
  limit = 8,
  filters?: AgentRunListFilters
) {
  const searchParams = new URLSearchParams({
    tenant_id: tenantId,
    limit: String(limit)
  });
  if (agentDefinitionId) {
    searchParams.set("agent_definition_id", agentDefinitionId);
  }
  if (filters?.targetSurface) {
    searchParams.set("target_surface", filters.targetSurface);
  }
  if (filters?.triggerSource) {
    searchParams.set("trigger_source", filters.triggerSource);
  }
  if (filters?.runStatus) {
    searchParams.set("run_status", filters.runStatus);
  }

  return await agentRunApiRequest<AgentRunResponse[]>(`/agents/runs?${searchParams.toString()}`);
}

export async function listAgentRunMetrics(
  tenantId: string,
  agentDefinitionId?: string | null,
  filters?: AgentRunListFilters
) {
  const searchParams = new URLSearchParams({
    tenant_id: tenantId
  });
  if (agentDefinitionId) {
    searchParams.set("agent_definition_id", agentDefinitionId);
  }
  if (filters?.targetSurface) {
    searchParams.set("target_surface", filters.targetSurface);
  }
  if (filters?.triggerSource) {
    searchParams.set("trigger_source", filters.triggerSource);
  }
  if (filters?.runStatus) {
    searchParams.set("run_status", filters.runStatus);
  }

  return await agentRunApiRequest<AgentRunMetricsResponse>(`/agents/runs/metrics?${searchParams.toString()}`);
}

export async function createAgentRun(request: CreateAgentRunRequest) {
  return await agentRunApiRequest<AgentRunResponse>("/agents/runs", {
    method: "POST",
    body: JSON.stringify(request)
  });
}

export function serializeAgentRunNavigationHref(href: AgentRunNavigationHref) {
  if (typeof href === "string") {
    return href;
  }

  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(href.query ?? {})) {
    if (value === null || value === undefined) {
      continue;
    }

    searchParams.set(key, String(value));
  }

  const serializedQuery = searchParams.toString();
  const pathname = href.pathname ? String(href.pathname) : "";
  return serializedQuery ? `${pathname}?${serializedQuery}` : pathname;
}
