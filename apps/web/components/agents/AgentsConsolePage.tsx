"use client";

import Link from "next/link";
import { type ComponentProps, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ArrowRight,
  Bot,
  BrainCircuit,
  Copy,
  FileText,
  MessageSquareText,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  Waypoints
} from "lucide-react";

import {
  ConsoleOutlineBadge,
  ConsolePageHeader,
  ConsoleStatusBar,
  ConsoleSurface,
  ConsoleSurfaceHeader
} from "@/components/console/ConsolePrimitives";
import { AgentRunButtonLink } from "@/components/agents/AgentRunButtonLink";
import { ConsoleActionPacketCard } from "@/components/console/ConsoleActionPacketCard";
import { ConsoleRuntimeTaskPacket } from "@/components/console/ConsoleRuntimeTaskPacket";
import { ConsoleShell } from "@/components/console/ConsoleShell";
import { PageTitleSync } from "@/components/console/PageTitleSync";
import { RuntimeBindingSummaryCard } from "@/components/runtime/RuntimeBindingSummaryCard";
import {
  readToolTraceConnectorReference,
  ToolRuntimeSummaryCard,
  readToolRuntimeSummary,
  type ToolRuntimeTraceRecord
} from "@/components/runtime/ToolRuntimeSummaryCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  createAgentExecution,
  EMPTY_AGENT_EXECUTION_METRICS,
  readAgentExecutionEvidenceSummary,
  readAgentExecutionRuntimeBindingSummary,
  readAgentExecutionRuntimeSummary,
  listAgentExecutionMetrics,
  listAgentExecutions,
  readAgentExecutionRetrievalSummary,
  type AgentExecutionMetricsResponse,
  type AgentExecutionResponse,
  type AgentExecutionStatus
} from "@/lib/agent-executions";
import { buildAgentExecutionFollowUpActions } from "@/lib/agent-execution-follow-up";
import {
  createAgentRun,
  listAgentRunMetrics,
  listAgentRuns,
  serializeAgentRunNavigationHref,
  type AgentRunStatus,
  type AgentRunMetricsResponse,
  type AgentRunResponse,
  type AgentRunTargetSurface,
  type AgentRunTriggerSource
} from "@/lib/agent-runs";
import { readApiErrorMessage } from "@/lib/api-errors";
import { buildAgentLaunchPrompts, resolveKnowledgeBaseScopeSelection } from "@/lib/agent-runtime";
import { hasDirectoryCapability } from "@/lib/auth/access";
import { useAuth } from "@/lib/auth/provider";
import {
  buildAdminHref,
  buildAgentsHref,
  buildOperationsHref,
  buildRuntimeGovernanceSettingsHref,
  buildSettingsHref,
  buildToolTraceSettingsHref
} from "@/lib/console-route-builders";
import { useI18n } from "@/lib/i18n/provider";
import { buildSessionActorHeaders } from "@/lib/local-session";
import {
  loadAgentRuntimeGovernance,
  type AgentRuntimeGovernanceItem
} from "@/lib/runtime-governance";
import { buildAgentsWorkspaceHref, resolveAgentWorkspaceHandoffIntent } from "@/lib/workspace-handoffs";
import {
  listModelEndpoints,
  listRetrievalProfiles,
  listToolRegistrations,
  type PlatformModelEndpoint,
  type PlatformRetrievalProfile,
  type PlatformToolRegistration
} from "@/lib/platform-governance";
import { cn } from "@/lib/utils";
import { buildWorkspaceHref } from "@/lib/workspace-navigation";

type AgentMode = "grounded_chat" | "document_intake" | "workflow_recovery";
type AgentStatus = "draft" | "active" | "paused";
type ModelStrategy = "local_reserved" | "remote_reserved" | "hybrid_reserved";
type AgentTool = "chat" | "documents" | "operations" | "admin";
type AgentStatusFilter = "all" | AgentStatus;
type AgentModeFilter = "all" | AgentMode;
type AgentReadinessFilter = "all" | "ready" | "attention";
type AgentReadinessIssueFilter = "all" | AgentReadinessIssue;
type AgentRunSurfaceFilter = "all" | AgentRunTargetSurface;
type AgentRunTriggerSourceFilter = "all" | AgentRunTriggerSource;
type AgentRunStatusFilter = "all" | AgentRunStatus;
type AgentExecutionStatusFilter = "all" | AgentExecutionStatus;
type AgentReadinessIssue =
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
type ResolvedAgentModelEndpoint = {
  id: string;
  name: string;
  slug: string;
  provider_type: string;
  model_name: string;
  capabilities: string[];
  is_enabled: boolean;
  is_default: boolean;
};
type ResolvedAgentRetrievalProfile = {
  id: string;
  name: string;
  slug: string;
  retrieval_mode: string;
  is_enabled: boolean;
  is_default: boolean;
  source?: "knowledge_base" | "platform_default";
};
type AgentReadinessState = {
  approvalRequiredToolCount: number;
  blockingIssues: AgentReadinessIssue[];
  disabledRegisteredToolCount: number;
  integrationPendingMcpToolCount: number;
  isReady: boolean;
  issues: AgentReadinessIssue[];
  reservedMcpToolCount: number;
  resolvedRetrievalProfile: ResolvedAgentRetrievalProfile | null;
  resolvedModelEndpoint: ResolvedAgentModelEndpoint | null;
  missingToolRegistrationCount?: number;
};
type ConsoleLinkHref = ComponentProps<typeof Link>["href"];
type AgentExecutionPacket = {
  title: string;
  detail: string;
  status: "attention" | "healthy" | "review";
  metricLabel: string;
  metricValue: string;
  primaryActionLabel: string;
  primaryActionHref: ConsoleLinkHref;
  secondaryActions: Array<{
    label: string;
    href: ConsoleLinkHref;
  }>;
};
type AgentReleaseBoardItem = {
  title: string;
  detail: string;
  status: "attention" | "healthy" | "review";
  metricLabel: string;
  metricValue: string;
  actionLabel: string;
  href: ConsoleLinkHref;
};
type RetrievalGovernanceIssue = "missing" | "disabled" | null;
type AgentRunbookStep = {
  title: string;
  detail: string;
  status: "attention" | "healthy" | "review";
  actionLabel: string;
  href: ConsoleLinkHref;
};

type Tenant = {
  id: string;
  name: string;
  slug: string;
};

type Workspace = {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
};

type KnowledgeBase = {
  id: string;
  workspace_id: string;
  name: string;
  slug: string;
  retrieval_profile_id?: string | null;
  retrieval_profile_name?: string | null;
};

type AgentDraft = {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  mode: AgentMode;
  status: AgentStatus;
  modelStrategy: ModelStrategy;
  modelEndpointId: string;
  objective: string;
  instructions: string;
  knowledgeBaseScope: string;
  tools: AgentTool[];
  toolRegistrationIds: string[];
  updatedAt: string;
};

type AgentDefinitionResponse = {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  mode: AgentMode;
  status: AgentStatus;
  model_strategy: ModelStrategy;
  model_endpoint_id: string | null;
  objective: string;
  instructions: string;
  knowledge_base_scope: string | null;
  tools: AgentTool[];
  tool_registration_ids: string[];
  created_at: string;
  updated_at: string;
};

function slugifyValue(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function createAgentId() {
  return `agent-${Math.random().toString(36).slice(2, 10)}`;
}

function dedupeValues(values: string[]) {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0)));
}

function normalizeAgentDraft(agent: AgentDraft): AgentDraft {
  return {
    ...agent,
    name: agent.name.trim(),
    slug: slugifyValue(agent.slug),
    objective: agent.objective.trim(),
    instructions: agent.instructions.trim(),
    knowledgeBaseScope: agent.knowledgeBaseScope.trim(),
    toolRegistrationIds: dedupeValues(agent.toolRegistrationIds)
  };
}

function countConnectedCapabilities(agent: Pick<AgentDraft, "tools" | "toolRegistrationIds">) {
  return dedupeValues([...agent.tools, ...agent.toolRegistrationIds]).length;
}

function buildApiBaseUrl() {
  const configuredBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  const fallbackBaseUrl = "http://127.0.0.1:18000";
  const baseUrl = configuredBaseUrl && configuredBaseUrl.length > 0 ? configuredBaseUrl : fallbackBaseUrl;
  return baseUrl.endsWith("/api/v1") ? baseUrl : `${baseUrl}/api/v1`;
}

const apiBaseUrl = buildApiBaseUrl();
const DEFAULT_RETRIEVAL_PROFILE_FILTER_VALUE = "__default_fallback__";
const DISABLED_RETRIEVAL_PROFILE_FILTER_VALUE = "__disabled_assignment__";

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

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

async function listTenants() {
  return await apiRequest<Tenant[]>("/tenants");
}

async function listWorkspaces(tenantId: string) {
  return await apiRequest<Workspace[]>(`/workspaces?tenant_id=${tenantId}`);
}

async function listKnowledgeBases(workspaceId: string) {
  return await apiRequest<KnowledgeBase[]>(`/knowledge-bases?workspace_id=${workspaceId}`);
}

async function listAgentDefinitions(
  tenantId: string,
  filters: { query: string; status: AgentStatusFilter; mode: AgentModeFilter }
) {
  const searchParams = new URLSearchParams({
    tenant_id: tenantId
  });

  if (filters.status !== "all") {
    searchParams.set("status", filters.status);
  }
  if (filters.mode !== "all") {
    searchParams.set("mode", filters.mode);
  }

  const normalizedQuery = filters.query.trim();
  if (normalizedQuery) {
    searchParams.set("query", normalizedQuery);
  }

  return await apiRequest<AgentDefinitionResponse[]>(`/agents?${searchParams.toString()}`);
}

async function createAgentDefinition(agent: AgentDraft) {
  return await apiRequest<AgentDefinitionResponse>("/agents", {
    method: "POST",
    body: JSON.stringify({
      tenant_id: agent.tenantId,
      name: agent.name,
      slug: agent.slug,
      mode: agent.mode,
      status: agent.status,
      model_strategy: agent.modelStrategy,
      model_endpoint_id: agent.modelEndpointId || null,
      objective: agent.objective,
      instructions: agent.instructions,
      knowledge_base_scope: agent.knowledgeBaseScope || null,
      tools: agent.tools,
      tool_registration_ids: agent.toolRegistrationIds
    })
  });
}

async function updateAgentDefinition(agent: AgentDraft) {
  return await apiRequest<AgentDefinitionResponse>(`/agents/${agent.id}?tenant_id=${agent.tenantId}`, {
    method: "PATCH",
    body: JSON.stringify({
      name: agent.name,
      slug: agent.slug,
      mode: agent.mode,
      status: agent.status,
      model_strategy: agent.modelStrategy,
      model_endpoint_id: agent.modelEndpointId || null,
      objective: agent.objective,
      instructions: agent.instructions,
      knowledge_base_scope: agent.knowledgeBaseScope || null,
      tools: agent.tools,
      tool_registration_ids: agent.toolRegistrationIds
    })
  });
}

async function deleteAgentDefinition(agentId: string, tenantId: string) {
  await apiRequest<void>(`/agents/${agentId}?tenant_id=${tenantId}`, {
    method: "DELETE"
  });
}

function mapAgentDefinitionToDraft(agentDefinition: AgentDefinitionResponse): AgentDraft {
  return {
    id: agentDefinition.id,
    tenantId: agentDefinition.tenant_id,
    name: agentDefinition.name,
    slug: agentDefinition.slug,
    mode: agentDefinition.mode,
    status: agentDefinition.status,
    modelStrategy: agentDefinition.model_strategy,
    modelEndpointId: agentDefinition.model_endpoint_id ?? "",
    objective: agentDefinition.objective,
    instructions: agentDefinition.instructions,
    knowledgeBaseScope: agentDefinition.knowledge_base_scope ?? "",
    tools: agentDefinition.tools,
    toolRegistrationIds: agentDefinition.tool_registration_ids,
    updatedAt: agentDefinition.updated_at
  };
}

function formatUpdatedAt(value: string, language: "en" | "zh-CN") {
  const nextDate = new Date(value);
  return Number.isNaN(nextDate.getTime())
    ? value
    : nextDate.toLocaleString(language === "zh-CN" ? "zh-CN" : "en-US", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
      });
}

function getAgentStatusClass(status: AgentStatus) {
  if (status === "active") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "paused") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-slate-200 bg-slate-100 text-slate-700";
}

function getPacketStatusClass(status: AgentExecutionPacket["status"]) {
  if (status === "attention") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  if (status === "review") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function getAgentExecutionStatusClass(status: AgentExecutionStatus) {
  if (status === "completed") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (status === "failed") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }
  if (status === "running") {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }
  if (status === "queued") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-slate-200 bg-slate-100 text-slate-700";
}

function getRetrievalMethodBadgeClassName(method: string | null) {
  if (method === "hybrid") {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }
  if (method === "vector") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (method === "lexical") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
}

function readAllowedAgentStatusFilter(value: string | null): AgentStatusFilter {
  if (value === "draft" || value === "active" || value === "paused") {
    return value;
  }

  return "all";
}

function readAllowedAgentModeFilter(value: string | null): AgentModeFilter {
  if (value === "grounded_chat" || value === "document_intake" || value === "workflow_recovery") {
    return value;
  }

  return "all";
}

function readAllowedAgentReadinessFilter(value: string | null): AgentReadinessFilter {
  if (value === "ready" || value === "attention") {
    return value;
  }

  return "all";
}

function readAllowedAgentReadinessIssueFilter(value: string | null): AgentReadinessIssueFilter {
  if (
    value === "model_missing" ||
    value === "model_disabled" ||
    value === "retrieval_profile_missing" ||
    value === "retrieval_profile_disabled" ||
    value === "scope_missing" ||
    value === "scope_invalid" ||
    value === "tools_missing" ||
    value === "tool_registration_disabled" ||
    value === "tool_approval_required" ||
    value === "tool_mcp_reserved" ||
    value === "tool_mcp_integration_pending"
  ) {
    return value;
  }

  return "all";
}

function readAllowedAgentRunSurfaceFilter(value: string | null): AgentRunSurfaceFilter {
  if (value === "chat" || value === "documents" || value === "operations" || value === "admin") {
    return value;
  }

  return "all";
}

function readAllowedAgentRunTriggerSourceFilter(value: string | null): AgentRunTriggerSourceFilter {
  if (value === "agents_console" || value === "workspace" || value === "home" || value === "admin" || value === "operations") {
    return value;
  }

  return "all";
}

function readAllowedAgentRunStatusFilter(value: string | null): AgentRunStatusFilter {
  if (value === "launched" || value === "completed" || value === "failed" || value === "cancelled") {
    return value;
  }

  return "all";
}

function readAllowedAgentExecutionStatusFilter(value: string | null): AgentExecutionStatusFilter {
  if (value === "queued" || value === "running" || value === "completed" || value === "failed" || value === "cancelled") {
    return value;
  }

  return "all";
}

function formatAgentRunTriggerSourceLabel(
  triggerSource: AgentRunTriggerSource,
  t: (key: string, variables?: Record<string, string>) => string
) {
  if (triggerSource === "agents_console") {
    return t("agents.runs.sources.agentsConsole");
  }

  if (triggerSource === "workspace") {
    return t("agents.runs.sources.workspace");
  }

  if (triggerSource === "admin") {
    return t("agents.runs.sources.admin");
  }

  if (triggerSource === "operations") {
    return t("agents.runs.sources.operations");
  }

  return t("agents.runs.sources.home");
}

function buildKnowledgeBaseScope(workspaceSlug: string, knowledgeBaseSlug: string) {
  return `${workspaceSlug}/${knowledgeBaseSlug}`;
}

function assessAgentReadiness(
  agent: AgentDraft,
  context: {
    knowledgeBases: KnowledgeBase[];
    modelEndpoints: PlatformModelEndpoint[];
    retrievalProfiles: PlatformRetrievalProfile[];
    toolRegistrations: PlatformToolRegistration[];
    workspaces: Workspace[];
  }
): AgentReadinessState {
  const issues: AgentReadinessIssue[] = [];
  const selectedModelEndpoint = agent.modelEndpointId
    ? context.modelEndpoints.find((modelEndpoint) => modelEndpoint.id === agent.modelEndpointId) ?? null
    : null;
  const fallbackModelEndpoint =
    context.modelEndpoints.find((modelEndpoint) => modelEndpoint.is_enabled && modelEndpoint.is_default) ??
    context.modelEndpoints.find((modelEndpoint) => modelEndpoint.is_enabled) ??
    null;
  const resolvedModelEndpoint = selectedModelEndpoint ?? fallbackModelEndpoint;
  const requiresKnowledgeScope = agent.mode === "grounded_chat" || agent.mode === "document_intake";
  const scopeSelection = resolveKnowledgeBaseScopeSelection(agent.knowledgeBaseScope, context.workspaces, context.knowledgeBases);
  const scopedKnowledgeBase = scopeSelection.knowledgeBaseId
    ? context.knowledgeBases.find((knowledgeBase) => knowledgeBase.id === scopeSelection.knowledgeBaseId) ?? null
    : null;
  const assignedRetrievalProfileId = scopedKnowledgeBase?.retrieval_profile_id?.trim() ?? "";
  const defaultRetrievalProfile =
    context.retrievalProfiles.find((retrievalProfile) => retrievalProfile.is_enabled && retrievalProfile.is_default) ??
    context.retrievalProfiles.find((retrievalProfile) => retrievalProfile.is_enabled) ??
    null;
  const selectedRetrievalProfile = assignedRetrievalProfileId
    ? context.retrievalProfiles.find((retrievalProfile) => retrievalProfile.id === assignedRetrievalProfileId) ?? null
    : null;
  const resolvedRetrievalProfile = assignedRetrievalProfileId ? selectedRetrievalProfile : defaultRetrievalProfile;
  const hasConnectedCapabilities = countConnectedCapabilities(agent) > 0;
  const disabledRegisteredToolCount = context.toolRegistrations.filter(
    (toolRegistration) =>
      agent.toolRegistrationIds.includes(toolRegistration.id) && !toolRegistration.is_enabled
  ).length;
  const approvalRequiredToolCount = context.toolRegistrations.filter(
    (toolRegistration) =>
      agent.toolRegistrationIds.includes(toolRegistration.id) && toolRegistration.requires_admin_approval
  ).length;
  const reservedMcpToolCount = context.toolRegistrations.filter(
    (toolRegistration) =>
      agent.toolRegistrationIds.includes(toolRegistration.id) &&
      toolRegistration.is_enabled &&
      toolRegistration.transport_type === "mcp_reserved" &&
      !toolRegistration.connector_reference?.trim()
  ).length;
  const integrationPendingMcpToolCount = context.toolRegistrations.filter(
    (toolRegistration) =>
      agent.toolRegistrationIds.includes(toolRegistration.id) &&
      toolRegistration.is_enabled &&
      toolRegistration.transport_type === "mcp_reserved" &&
      Boolean(toolRegistration.connector_reference?.trim())
  ).length;

  if (!resolvedModelEndpoint) {
    issues.push("model_missing");
  } else if (!resolvedModelEndpoint.is_enabled) {
    issues.push("model_disabled");
  }

  if (requiresKnowledgeScope) {
    if (!agent.knowledgeBaseScope.trim()) {
      issues.push("scope_missing");
    } else if (!scopeSelection.workspaceId || !scopeSelection.knowledgeBaseId) {
      issues.push("scope_invalid");
    } else if (!resolvedRetrievalProfile) {
      issues.push("retrieval_profile_missing");
    } else if (!resolvedRetrievalProfile.is_enabled) {
      issues.push("retrieval_profile_disabled");
    }
  }

  if (!hasConnectedCapabilities) {
    issues.push("tools_missing");
  }

  if (disabledRegisteredToolCount > 0) {
    issues.push("tool_registration_disabled");
  }

  if (approvalRequiredToolCount > 0) {
    issues.push("tool_approval_required");
  }

  if (reservedMcpToolCount > 0) {
    issues.push("tool_mcp_reserved");
  }

  if (integrationPendingMcpToolCount > 0) {
    issues.push("tool_mcp_integration_pending");
  }

  const blockingIssues = issues.filter((issue) => issue !== "tool_approval_required");

  return {
    approvalRequiredToolCount,
    blockingIssues,
    disabledRegisteredToolCount,
    integrationPendingMcpToolCount,
    isReady: blockingIssues.length === 0,
    issues,
    reservedMcpToolCount,
    resolvedRetrievalProfile,
    resolvedModelEndpoint
  };
}

function mapRuntimeGovernanceItemToReadiness(item: AgentRuntimeGovernanceItem): AgentReadinessState {
  return {
    approvalRequiredToolCount: item.approval_required_tool_count,
    blockingIssues: item.blocking_issues,
    disabledRegisteredToolCount: item.disabled_registered_tool_count,
    integrationPendingMcpToolCount: item.integration_pending_mcp_tool_count,
    isReady: item.is_ready,
    issues: item.issues,
    reservedMcpToolCount: item.reserved_mcp_tool_count,
    resolvedRetrievalProfile: item.resolved_retrieval_profile,
    resolvedModelEndpoint: item.resolved_model_endpoint,
    missingToolRegistrationCount: item.missing_tool_registration_count
  };
}

export default function AgentsConsolePage() {
  const { language, t } = useI18n();
  const { session } = useAuth();
  const hasAgentWriteAccess = hasDirectoryCapability(session, "manage_agent_definitions");
  const hasAgentExecutionAccess = hasDirectoryCapability(session, "execute_agents");

  function renderExecutionToolTraceActions(execution: AgentExecutionResponse, trace: ToolRuntimeTraceRecord) {
    const settingsHref = buildToolTraceSettingsHref({
      toolRegistrationId: trace.tool_registration_id,
      governanceIssue: trace.governance_issue ?? null,
      connectorReference: readToolTraceConnectorReference(trace)
    });

    if (trace.governance_issue === "approval_required") {
      return (
        <>
          <Button asChild className="bg-white" size="sm" type="button" variant="outline">
            <Link
              href={buildAgentsHref({
                tenantId: execution.tenant_id,
                status: "active",
                issue: "tool_approval_required",
                toolRegistrationId: trace.tool_registration_id
              })}
            >
              {t("settings.tools.auditActions.openApprovalAgents")}
            </Link>
          </Button>
          <Button asChild className="bg-white" size="sm" type="button" variant="outline">
            <Link href={settingsHref}>{t("settings.tools.auditActions.openToolSettings")}</Link>
          </Button>
        </>
      );
    }

    if (trace.governance_issue === "tool_disabled") {
      return (
        <>
          <Button asChild className="bg-white" size="sm" type="button" variant="outline">
            <Link
              href={buildAgentsHref({
                tenantId: execution.tenant_id,
                status: "active",
                readiness: "attention",
                issue: "tool_registration_disabled",
                toolRegistrationId: trace.tool_registration_id
              })}
            >
              {t("settings.tools.auditActions.openImpactedAgents")}
            </Link>
          </Button>
          <Button asChild className="bg-white" size="sm" type="button" variant="outline">
            <Link href={settingsHref}>{t("settings.tools.auditActions.openToolSettings")}</Link>
          </Button>
        </>
      );
    }

    if (trace.governance_issue === "mcp_reserved") {
      return (
        <>
          <Button asChild className="bg-white" size="sm" type="button" variant="outline">
            <Link href={settingsHref}>{t("settings.tools.auditActions.reviewReservedTransport")}</Link>
          </Button>
          <Button asChild className="bg-white" size="sm" type="button" variant="outline">
            <Link
              href={buildAgentsHref({
                tenantId: execution.tenant_id,
                status: "active",
                toolRegistrationId: trace.tool_registration_id
              })}
            >
              {t("settings.tools.auditActions.openBoundAgents")}
            </Link>
          </Button>
        </>
      );
    }

    if (trace.governance_issue === "mcp_integration_pending") {
      return (
        <>
          <Button asChild className="bg-white" size="sm" type="button" variant="outline">
            <Link href={settingsHref}>{t("settings.tools.auditActions.reviewIntegrationPending")}</Link>
          </Button>
          <Button asChild className="bg-white" size="sm" type="button" variant="outline">
            <Link
              href={buildAgentsHref({
                tenantId: execution.tenant_id,
                status: "active",
                toolRegistrationId: trace.tool_registration_id
              })}
            >
              {t("settings.tools.auditActions.openBoundAgents")}
            </Link>
          </Button>
        </>
      );
    }

    if (trace.governance_issue === "endpoint_failure" || trace.governance_issue === "runtime_failure") {
      return (
        <>
          <Button asChild className="bg-white" size="sm" type="button" variant="outline">
            <Link href={settingsHref}>{t("settings.tools.auditActions.reviewToolRuntime")}</Link>
          </Button>
          <Button asChild className="bg-white" size="sm" type="button" variant="outline">
            <Link
              href={buildAgentsHref({
                tenantId: execution.tenant_id,
                status: "active",
                toolRegistrationId: trace.tool_registration_id
              })}
            >
              {t("settings.tools.auditActions.openBoundAgents")}
            </Link>
          </Button>
        </>
      );
    }

    return null;
  }

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [modelEndpoints, setModelEndpoints] = useState<PlatformModelEndpoint[]>([]);
  const [retrievalProfiles, setRetrievalProfiles] = useState<PlatformRetrievalProfile[]>([]);
  const [toolRegistrations, setToolRegistrations] = useState<PlatformToolRegistration[]>([]);
  const [runtimeGovernanceItems, setRuntimeGovernanceItems] = useState<AgentRuntimeGovernanceItem[]>([]);
  const [agents, setAgents] = useState<AgentDraft[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [statusFilter, setStatusFilter] = useState<AgentStatusFilter>("all");
  const [modeFilter, setModeFilter] = useState<AgentModeFilter>("all");
  const [readinessFilter, setReadinessFilter] = useState<AgentReadinessFilter>("all");
  const [issueFilter, setIssueFilter] = useState<AgentReadinessIssueFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [runTargetSurfaceFilter, setRunTargetSurfaceFilter] = useState<AgentRunSurfaceFilter>("all");
  const [runTriggerSourceFilter, setRunTriggerSourceFilter] = useState<AgentRunTriggerSourceFilter>("all");
  const [runStatusFilter, setRunStatusFilter] = useState<AgentRunStatusFilter>("all");
  const [executionStatusFilter, setExecutionStatusFilter] = useState<AgentExecutionStatusFilter>("all");
  const [modelEndpointFilterId, setModelEndpointFilterId] = useState("");
  const [toolRegistrationFilterId, setToolRegistrationFilterId] = useState("");
  const [retrievalProfileFilterId, setRetrievalProfileFilterId] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [agentRuns, setAgentRuns] = useState<AgentRunResponse[]>([]);
  const [agentRunMetrics, setAgentRunMetrics] = useState<AgentRunMetricsResponse | null>(null);
  const [isLoadingAgentRuns, setIsLoadingAgentRuns] = useState(false);
  const [agentExecutions, setAgentExecutions] = useState<AgentExecutionResponse[]>([]);
  const [agentExecutionMetrics, setAgentExecutionMetrics] = useState<AgentExecutionMetricsResponse | null>(EMPTY_AGENT_EXECUTION_METRICS);
  const [isLoadingAgentExecutions, setIsLoadingAgentExecutions] = useState(false);
  const [isExecutingAgent, setIsExecutingAgent] = useState(false);
  const [launchingSurface, setLaunchingSurface] = useState<AgentRunTargetSurface | null>(null);

  useEffect(() => {
    function applyLocationState() {
      const searchParams = new URLSearchParams(window.location.search);
      setSelectedTenantId(searchParams.get("tenant_id") ?? "");
      setStatusFilter(readAllowedAgentStatusFilter(searchParams.get("status")));
      setModeFilter(readAllowedAgentModeFilter(searchParams.get("mode")));
      setReadinessFilter(readAllowedAgentReadinessFilter(searchParams.get("readiness")));
      setIssueFilter(readAllowedAgentReadinessIssueFilter(searchParams.get("issue")));
      setSearchQuery(searchParams.get("query") ?? "");
      setSelectedAgentId(searchParams.get("agent_id") ?? "");
      setRunTargetSurfaceFilter(readAllowedAgentRunSurfaceFilter(searchParams.get("run_target_surface")));
      setRunTriggerSourceFilter(readAllowedAgentRunTriggerSourceFilter(searchParams.get("run_trigger_source")));
      setRunStatusFilter(readAllowedAgentRunStatusFilter(searchParams.get("run_status")));
      setExecutionStatusFilter(readAllowedAgentExecutionStatusFilter(searchParams.get("execution_status")));
      setModelEndpointFilterId(searchParams.get("model_endpoint_id") ?? "");
      setToolRegistrationFilterId(searchParams.get("tool_registration_id") ?? "");
      setRetrievalProfileFilterId(searchParams.get("retrieval_profile_id") ?? "");
    }

    applyLocationState();
    window.addEventListener("popstate", applyLocationState);

    return () => {
      window.removeEventListener("popstate", applyLocationState);
    };
  }, []);

  useEffect(() => {
    const nextUrl = new URL(window.location.href);
    const nextHref = buildAgentsHref({
      tenantId: selectedTenantId || null,
      status: statusFilter,
      mode: modeFilter,
      readiness: readinessFilter,
      issue: issueFilter,
      query: searchQuery,
      agentId: selectedAgentId || null,
      runTargetSurface: runTargetSurfaceFilter,
      runTriggerSource: runTriggerSourceFilter,
      runStatus: runStatusFilter,
      executionStatus: executionStatusFilter,
      modelEndpointId: modelEndpointFilterId || null,
      toolRegistrationId: toolRegistrationFilterId || null,
      retrievalProfileId: retrievalProfileFilterId || null
    });
    nextUrl.search = new URLSearchParams(
      Object.entries(nextHref.query ?? {}).map(([key, value]) => [key, String(value)])
    ).toString();
    window.history.replaceState({}, "", nextUrl);
  }, [
    modeFilter,
    issueFilter,
    executionStatusFilter,
    readinessFilter,
    runStatusFilter,
    runTargetSurfaceFilter,
    runTriggerSourceFilter,
    searchQuery,
    selectedAgentId,
    modelEndpointFilterId,
    selectedTenantId,
    statusFilter,
    toolRegistrationFilterId,
    retrievalProfileFilterId
  ]);

  useEffect(() => {
    let isMounted = true;

    async function refreshTenants() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const nextTenants = await listTenants();
        if (!isMounted) {
          return;
        }

        setTenants(nextTenants);
        if (nextTenants.length === 0) {
          setSelectedTenantId("");
          setAgents([]);
          setRuntimeGovernanceItems([]);
          setSelectedAgentId("");
          setStatusMessage(t("agents.status.noTenants"));
          return;
        }

        setSelectedTenantId((currentTenantId) =>
          currentTenantId && nextTenants.some((tenant) => tenant.id === currentTenantId)
            ? currentTenantId
            : nextTenants[0].id
        );
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setErrorMessage(error instanceof Error ? error.message : t("agents.status.restoreFailed"));
        setStatusMessage(t("agents.status.restoreFailed"));
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void refreshTenants();
    return () => {
      isMounted = false;
    };
  }, [t]);

  useEffect(() => {
    let isMounted = true;

    async function refreshRuntimeGovernance() {
      try {
        const [nextModelEndpoints, nextRetrievalProfiles, nextToolRegistrations] = await Promise.all([
          listModelEndpoints(),
          listRetrievalProfiles(),
          listToolRegistrations()
        ]);
        if (!isMounted) {
          return;
        }

        setModelEndpoints(nextModelEndpoints);
        setRetrievalProfiles(nextRetrievalProfiles);
        setToolRegistrations(nextToolRegistrations);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setErrorMessage(error instanceof Error ? error.message : t("agents.status.restoreFailed"));
      }
    }

    void refreshRuntimeGovernance();
    return () => {
      isMounted = false;
    };
  }, [t]);

  useEffect(() => {
    if (!selectedTenantId) {
      setWorkspaces([]);
      setKnowledgeBases([]);
      setAgents([]);
      setRuntimeGovernanceItems([]);
      return;
    }

    let isMounted = true;

    async function refreshTenantScopeDirectory() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const nextWorkspaces = await listWorkspaces(selectedTenantId);
        const knowledgeBaseGroups = await Promise.all(
          nextWorkspaces.map(async (workspace) => ({
            workspaceId: workspace.id,
            knowledgeBases: await listKnowledgeBases(workspace.id)
          }))
        );
        const nextKnowledgeBases = knowledgeBaseGroups.flatMap((group) => group.knowledgeBases);
        if (!isMounted) {
          return;
        }

        setWorkspaces(nextWorkspaces);
        setKnowledgeBases(nextKnowledgeBases);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setErrorMessage(error instanceof Error ? error.message : t("agents.status.restoreFailed"));
        setStatusMessage(t("agents.status.restoreFailed"));
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void refreshTenantScopeDirectory();
    return () => {
      isMounted = false;
    };
  }, [selectedTenantId, t]);

  useEffect(() => {
    if (!selectedTenantId) {
      return;
    }

    let isMounted = true;

    async function refreshAgentDefinitionsForTenant() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const [nextAgentDefinitions, runtimeGovernance] = await Promise.all([
          listAgentDefinitions(selectedTenantId, {
            status: statusFilter,
            mode: modeFilter,
            query: searchQuery
          }),
          loadAgentRuntimeGovernance({
            tenant_id: selectedTenantId,
            status: statusFilter === "all" ? null : statusFilter,
            mode: modeFilter === "all" ? null : modeFilter,
            readiness: readinessFilter === "all" ? null : readinessFilter,
            issue: issueFilter === "all" ? null : issueFilter,
            query: searchQuery,
            model_endpoint_id: modelEndpointFilterId || null,
            tool_registration_id: toolRegistrationFilterId || null,
            retrieval_profile_id: retrievalProfileFilterId || null
          })
        ]);
        if (!isMounted) {
          return;
        }

        const nextAgents = nextAgentDefinitions.map(mapAgentDefinitionToDraft);
        setAgents(nextAgents);
        setRuntimeGovernanceItems(runtimeGovernance.items);
        setStatusMessage(t("agents.status.restored", { count: String(nextAgents.length) }));
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setAgents([]);
        setRuntimeGovernanceItems([]);
        setSelectedAgentId("");
        setErrorMessage(error instanceof Error ? error.message : t("agents.status.restoreFailed"));
        setStatusMessage(t("agents.status.restoreFailed"));
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void refreshAgentDefinitionsForTenant();
    return () => {
      isMounted = false;
    };
  }, [
    issueFilter,
    modeFilter,
    modelEndpointFilterId,
    readinessFilter,
    retrievalProfileFilterId,
    searchQuery,
    selectedTenantId,
    statusFilter,
    t,
    toolRegistrationFilterId
  ]);

  const readinessByAgentId = useMemo(() => {
    const byId = new Map<string, AgentReadinessState>();
    for (const item of runtimeGovernanceItems) {
      byId.set(item.id, mapRuntimeGovernanceItemToReadiness(item));
    }
    return byId;
  }, [runtimeGovernanceItems]);
  const scopedAgents = useMemo(() => {
    return agents.filter((agent) => {
      if (modelEndpointFilterId && agent.modelEndpointId !== modelEndpointFilterId) {
        return false;
      }

      if (toolRegistrationFilterId && !agent.toolRegistrationIds.includes(toolRegistrationFilterId)) {
        return false;
      }

      const readiness = readinessByAgentId.get(agent.id);
      if (retrievalProfileFilterId && readiness?.resolvedRetrievalProfile?.id !== retrievalProfileFilterId) {
        return false;
      }
      if (!readiness) {
        return readinessFilter === "all" && issueFilter === "all";
      }

      if (readinessFilter !== "all") {
        const matchesReadiness = readinessFilter === "ready" ? readiness.isReady : !readiness.isReady;
        if (!matchesReadiness) {
          return false;
        }
      }

      if (issueFilter !== "all" && !readiness.issues.includes(issueFilter)) {
        return false;
      }

      return true;
    });
  }, [
    agents,
    issueFilter,
    modelEndpointFilterId,
    readinessByAgentId,
    readinessFilter,
    retrievalProfileFilterId,
    toolRegistrationFilterId
  ]);
  const readinessIssueCounts = useMemo(() => {
    return agents.reduce<Record<AgentReadinessIssue, number>>(
      (accumulator, agent) => {
        const readiness = readinessByAgentId.get(agent.id);
        if (!readiness) {
          return accumulator;
        }

        for (const issue of new Set(readiness.issues)) {
          accumulator[issue] += 1;
        }

        return accumulator;
      },
      {
        model_missing: 0,
        model_disabled: 0,
        retrieval_profile_missing: 0,
        retrieval_profile_disabled: 0,
        scope_missing: 0,
        scope_invalid: 0,
        tools_missing: 0,
        tool_registration_disabled: 0,
        tool_approval_required: 0,
        tool_mcp_reserved: 0,
        tool_mcp_integration_pending: 0
      }
    );
  }, [agents, readinessByAgentId]);
  useEffect(() => {
    if (!scopedAgents.find((agent) => agent.id === selectedAgentId)) {
      setSelectedAgentId(scopedAgents[0]?.id ?? "");
    }
  }, [scopedAgents, selectedAgentId]);
  const selectedAgent = useMemo(
    () => scopedAgents.find((agent) => agent.id === selectedAgentId) ?? null,
    [scopedAgents, selectedAgentId]
  );
  const selectedAgentReadiness = useMemo(
    () => (selectedAgent ? readinessByAgentId.get(selectedAgent.id) ?? null : null),
    [readinessByAgentId, selectedAgent]
  );
  const selectedRetrievalGovernanceIssue = useMemo<RetrievalGovernanceIssue>(() => {
    if (!selectedAgentReadiness) {
      return null;
    }
    if (selectedAgentReadiness.issues.includes("retrieval_profile_disabled")) {
      return "disabled";
    }
    if (selectedAgentReadiness.issues.includes("retrieval_profile_missing")) {
      return "missing";
    }
    return null;
  }, [selectedAgentReadiness]);
  const selectedTenant = useMemo(
    () => tenants.find((tenant) => tenant.id === (selectedAgent?.tenantId || selectedTenantId)) ?? null,
    [selectedAgent?.tenantId, selectedTenantId, tenants]
  );
  const selectedAgentScopeSelection = useMemo(
    () =>
      selectedAgent
        ? resolveKnowledgeBaseScopeSelection(selectedAgent.knowledgeBaseScope, workspaces, knowledgeBases)
        : { workspaceId: "", knowledgeBaseId: "" },
    [knowledgeBases, selectedAgent, workspaces]
  );
  const selectedAgentScopeKnowledgeBases = useMemo(
    () =>
      selectedAgentScopeSelection.workspaceId
        ? knowledgeBases.filter((knowledgeBase) => knowledgeBase.workspace_id === selectedAgentScopeSelection.workspaceId)
        : [],
    [knowledgeBases, selectedAgentScopeSelection.workspaceId]
  );
  const selectedScopeWorkspace = useMemo(
    () =>
      selectedAgentScopeSelection.workspaceId
        ? workspaces.find((workspace) => workspace.id === selectedAgentScopeSelection.workspaceId) ?? null
        : null,
    [selectedAgentScopeSelection.workspaceId, workspaces]
  );
  const selectedScopeKnowledgeBase = useMemo(
    () =>
      selectedAgentScopeSelection.knowledgeBaseId
        ? knowledgeBases.find((knowledgeBase) => knowledgeBase.id === selectedAgentScopeSelection.knowledgeBaseId) ?? null
        : null,
    [knowledgeBases, selectedAgentScopeSelection.knowledgeBaseId]
  );
  const retrievalProfileById = useMemo(
    () => new Map(retrievalProfiles.map((retrievalProfile) => [retrievalProfile.id, retrievalProfile])),
    [retrievalProfiles]
  );
  const defaultRetrievalProfile = useMemo(
    () =>
      retrievalProfiles.find((retrievalProfile) => retrievalProfile.is_enabled && retrievalProfile.is_default) ??
      retrievalProfiles.find((retrievalProfile) => retrievalProfile.is_enabled) ??
      retrievalProfiles[0] ??
      null,
    [retrievalProfiles]
  );
  const selectedScopeRetrievalProfile = useMemo(() => {
    if (selectedScopeKnowledgeBase?.retrieval_profile_id) {
      return retrievalProfileById.get(selectedScopeKnowledgeBase.retrieval_profile_id) ?? null;
    }

    return defaultRetrievalProfile;
  }, [defaultRetrievalProfile, retrievalProfileById, selectedScopeKnowledgeBase?.retrieval_profile_id]);
  const selectedScopeRetrievalProfileSource = useMemo(() => {
    if (!selectedScopeRetrievalProfile) {
      return null;
    }

    return selectedScopeKnowledgeBase?.retrieval_profile_id ? "knowledge_base" : "platform_default";
  }, [selectedScopeKnowledgeBase?.retrieval_profile_id, selectedScopeRetrievalProfile]);
  const selectedModelEndpoint = useMemo(
    () =>
      selectedAgent?.modelEndpointId
        ? modelEndpoints.find((modelEndpoint) => modelEndpoint.id === selectedAgent.modelEndpointId) ?? null
        : null,
    [modelEndpoints, selectedAgent?.modelEndpointId]
  );
  const availableModelFilterEndpoints = useMemo(
    () =>
      modelEndpoints.filter(
        (modelEndpoint) =>
          agents.some((agent) => agent.modelEndpointId === modelEndpoint.id) ||
          modelEndpoint.id === modelEndpointFilterId
      ),
    [agents, modelEndpointFilterId, modelEndpoints]
  );
  const availableToolFilterRegistrations = useMemo(
    () =>
      toolRegistrations.filter(
        (toolRegistration) =>
          agents.some((agent) => agent.toolRegistrationIds.includes(toolRegistration.id)) ||
          toolRegistration.id === toolRegistrationFilterId
      ),
    [agents, toolRegistrationFilterId, toolRegistrations]
  );
  const enabledModelEndpoints = useMemo(
    () => modelEndpoints.filter((modelEndpoint) => modelEndpoint.is_enabled),
    [modelEndpoints]
  );
  const enabledToolRegistrations = useMemo(
    () => toolRegistrations.filter((toolRegistration) => toolRegistration.is_enabled),
    [toolRegistrations]
  );
  const availableModelEndpoints = useMemo(() => {
    if (!selectedModelEndpoint) {
      return enabledModelEndpoints;
    }

    return enabledModelEndpoints.some((modelEndpoint) => modelEndpoint.id === selectedModelEndpoint.id)
      ? enabledModelEndpoints
      : [selectedModelEndpoint, ...enabledModelEndpoints];
  }, [enabledModelEndpoints, selectedModelEndpoint]);
  const selectedRegisteredTools = useMemo(
    () =>
      selectedAgent
        ? toolRegistrations.filter((toolRegistration) =>
            selectedAgent.toolRegistrationIds.includes(toolRegistration.id)
          )
        : [],
    [selectedAgent, toolRegistrations]
  );
  const availableToolRegistrations = useMemo(() => {
    const byId = new Map<string, PlatformToolRegistration>();
    for (const toolRegistration of enabledToolRegistrations) {
      byId.set(toolRegistration.id, toolRegistration);
    }
    for (const toolRegistration of selectedRegisteredTools) {
      byId.set(toolRegistration.id, toolRegistration);
    }
    return Array.from(byId.values());
  }, [enabledToolRegistrations, selectedRegisteredTools]);
  const selectedDisabledToolRegistration = useMemo(
    () => selectedRegisteredTools.find((toolRegistration) => !toolRegistration.is_enabled) ?? null,
    [selectedRegisteredTools]
  );
  const selectedPendingMcpToolRegistration = useMemo(
    () =>
      selectedRegisteredTools.find(
        (toolRegistration) =>
          toolRegistration.is_enabled &&
          toolRegistration.transport_type === "mcp_reserved" &&
          Boolean(toolRegistration.connector_reference?.trim())
      ) ?? null,
    [selectedRegisteredTools]
  );
  const selectedReservedMcpToolRegistration = useMemo(
    () =>
      selectedRegisteredTools.find(
        (toolRegistration) =>
          toolRegistration.is_enabled &&
          toolRegistration.transport_type === "mcp_reserved" &&
          !toolRegistration.connector_reference?.trim()
      ) ?? null,
    [selectedRegisteredTools]
  );
  const selectedApprovalToolRegistration = useMemo(
    () => selectedRegisteredTools.find((toolRegistration) => toolRegistration.requires_admin_approval) ?? null,
    [selectedRegisteredTools]
  );
  const selectedRuntimeSettingsHref = useMemo(
    () => {
      const disabledModelEndpointId =
        selectedAgentReadiness?.resolvedModelEndpoint && !selectedAgentReadiness.resolvedModelEndpoint.is_enabled
          ? selectedAgentReadiness.resolvedModelEndpoint.id
          : null;
      const disabledToolRegistrationId = selectedDisabledToolRegistration?.id ?? null;
      const pendingMcpToolRegistrationId = selectedPendingMcpToolRegistration?.id ?? null;
      const reservedMcpToolRegistrationId = selectedReservedMcpToolRegistration?.id ?? null;
      const disabledRetrievalProfileId =
        selectedRetrievalGovernanceIssue === "disabled" && selectedAgentReadiness?.resolvedRetrievalProfile
          ? selectedAgentReadiness.resolvedRetrievalProfile.id
          : null;
      const approvalToolRegistrationId = selectedApprovalToolRegistration?.id ?? null;

      if (
        !disabledModelEndpointId &&
        !disabledToolRegistrationId &&
        !pendingMcpToolRegistrationId &&
        !reservedMcpToolRegistrationId &&
        !disabledRetrievalProfileId &&
        !approvalToolRegistrationId
      ) {
        return null;
      }

      return buildRuntimeGovernanceSettingsHref({
        tenantId: selectedTenantId || null,
        mode: selectedAgent?.mode ?? null,
        fallbackAgentId: selectedAgent?.id ?? null,
        disabledModelEndpointId,
        disabledToolRegistrationId,
        pendingMcpToolRegistrationId,
        pendingMcpConnectorReference: selectedPendingMcpToolRegistration?.connector_reference ?? null,
        reservedMcpToolRegistrationId,
        reservedMcpConnectorReference: selectedReservedMcpToolRegistration?.connector_reference ?? null,
        disabledRetrievalProfileId,
        approvalToolRegistrationId
      });
    },
    [
      selectedAgent,
      selectedAgentReadiness,
      selectedApprovalToolRegistration,
      selectedDisabledToolRegistration,
      selectedPendingMcpToolRegistration,
      selectedReservedMcpToolRegistration,
      selectedRetrievalGovernanceIssue,
      selectedTenantId
    ]
  );

  const metrics = useMemo(() => {
    const activeDrafts = scopedAgents.filter((agent) => agent.status === "active").length;
    const toolEnabledDrafts = scopedAgents.filter((agent) => countConnectedCapabilities(agent) > 0).length;
    const scopedDrafts = scopedAgents.filter((agent) => agent.knowledgeBaseScope.trim().length > 0).length;

    return {
      totalDrafts: scopedAgents.length,
      activeDrafts,
      toolEnabledDrafts,
      scopedDrafts
    };
  }, [scopedAgents]);

  const modeMetrics = useMemo(() => {
    const groundedChatDrafts = scopedAgents.filter((agent) => agent.mode === "grounded_chat");
    const documentIntakeDrafts = scopedAgents.filter((agent) => agent.mode === "document_intake");
    const workflowRecoveryDrafts = scopedAgents.filter((agent) => agent.mode === "workflow_recovery");
    const readyDrafts = scopedAgents.filter((agent) => readinessByAgentId.get(agent.id)?.isReady).length;
    const governanceAttentionDrafts = scopedAgents.filter((agent) => !readinessByAgentId.get(agent.id)?.isReady).length;

    return {
      groundedChat: {
        total: groundedChatDrafts.length,
        active: groundedChatDrafts.filter((agent) => agent.status === "active").length
      },
      documentIntake: {
        total: documentIntakeDrafts.length,
        active: documentIntakeDrafts.filter((agent) => agent.status === "active").length
      },
      workflowRecovery: {
        total: workflowRecoveryDrafts.length,
        active: workflowRecoveryDrafts.filter((agent) => agent.status === "active").length
      },
      readyDrafts,
      governanceAttentionDrafts
    };
  }, [readinessByAgentId, scopedAgents]);
  const governanceIssueCards = useMemo(
    () =>
      ([
        "scope_missing",
        "scope_invalid",
        "model_missing",
        "model_disabled",
        "retrieval_profile_missing",
        "retrieval_profile_disabled",
        "tools_missing",
        "tool_registration_disabled",
        "tool_approval_required",
        "tool_mcp_reserved",
        "tool_mcp_integration_pending"
      ] as AgentReadinessIssue[]).map((issue) => ({
        issue,
        count: readinessIssueCounts[issue],
        href: buildAgentsHref({
          tenantId: selectedTenantId || null,
          status: statusFilter,
          mode: modeFilter,
          readiness: "attention",
          issue,
          query: searchQuery || null,
          modelEndpointId: modelEndpointFilterId || null,
          toolRegistrationId: toolRegistrationFilterId || null
        })
      })),
    [modeFilter, modelEndpointFilterId, readinessIssueCounts, searchQuery, selectedTenantId, statusFilter, toolRegistrationFilterId]
  );

  const agentRunFilters = useMemo(
    () => ({
      targetSurface: runTargetSurfaceFilter === "all" ? null : runTargetSurfaceFilter,
      triggerSource: runTriggerSourceFilter === "all" ? null : runTriggerSourceFilter,
      runStatus: runStatusFilter === "all" ? null : runStatusFilter
    }),
    [runStatusFilter, runTargetSurfaceFilter, runTriggerSourceFilter]
  );
  const agentExecutionFilters = useMemo(
    () => ({
      executionMode: selectedAgent?.mode ?? null,
      executionStatus: executionStatusFilter === "all" ? null : executionStatusFilter
    }),
    [executionStatusFilter, selectedAgent?.mode]
  );

  async function refreshAgentRunsForCurrentScope() {
    if (!selectedTenantId) {
      setAgentRuns([]);
      setAgentRunMetrics(null);
      return;
    }

    setIsLoadingAgentRuns(true);
    try {
      const [nextAgentRuns, nextAgentRunMetrics] = await Promise.all([
        listAgentRuns(selectedTenantId, selectedAgentId || null, 8, agentRunFilters),
        listAgentRunMetrics(selectedTenantId, selectedAgentId || null, agentRunFilters)
      ]);
      setAgentRuns(nextAgentRuns);
      setAgentRunMetrics(nextAgentRunMetrics);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("agents.status.launchHistoryFailed"));
    } finally {
      setIsLoadingAgentRuns(false);
    }
  }

  async function refreshAgentExecutionsForCurrentScope() {
    if (!selectedTenantId) {
      setAgentExecutions([]);
      setAgentExecutionMetrics(null);
      return;
    }

    setIsLoadingAgentExecutions(true);
    try {
      const [nextAgentExecutions, nextAgentExecutionMetrics] = await Promise.all([
        listAgentExecutions(selectedTenantId, selectedAgentId || null, 8, agentExecutionFilters),
        listAgentExecutionMetrics(selectedTenantId, selectedAgentId || null, agentExecutionFilters)
      ]);
      setAgentExecutions(nextAgentExecutions);
      setAgentExecutionMetrics(nextAgentExecutionMetrics);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("agents.status.executionHistoryFailed"));
    } finally {
      setIsLoadingAgentExecutions(false);
    }
  }

  function updateSelectedAgent(updater: (agent: AgentDraft) => AgentDraft) {
    if (!selectedAgentId) {
      return;
    }

    setAgents((currentAgents) =>
      currentAgents.map((agent) => (agent.id === selectedAgentId ? updater(agent) : agent))
    );
    setErrorMessage(null);
  }

  async function refreshAgentDefinitionsForSelectedTenant() {
    if (!selectedTenantId) {
      setStatusMessage(t("agents.status.noTenants"));
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setStatusMessage(t("agents.status.refreshing"));

    try {
      const [nextAgentDefinitions, runtimeGovernance] = await Promise.all([
        listAgentDefinitions(selectedTenantId, {
          status: statusFilter,
          mode: modeFilter,
          query: searchQuery
        }),
        loadAgentRuntimeGovernance({
          tenant_id: selectedTenantId,
          status: statusFilter === "all" ? null : statusFilter,
          mode: modeFilter === "all" ? null : modeFilter,
          readiness: readinessFilter === "all" ? null : readinessFilter,
          issue: issueFilter === "all" ? null : issueFilter,
          query: searchQuery,
          model_endpoint_id: modelEndpointFilterId || null,
          tool_registration_id: toolRegistrationFilterId || null,
          retrieval_profile_id: retrievalProfileFilterId || null
        })
      ]);
      const nextAgents = nextAgentDefinitions.map(mapAgentDefinitionToDraft);
      setAgents(nextAgents);
      setRuntimeGovernanceItems(runtimeGovernance.items);
      setStatusMessage(t("agents.status.refreshed", { count: String(nextAgents.length) }));
    } catch (error) {
      setRuntimeGovernanceItems([]);
      setErrorMessage(error instanceof Error ? error.message : t("agents.status.restoreFailed"));
      setStatusMessage(t("agents.status.restoreFailed"));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function refreshAgentRunState() {
      if (!selectedTenantId) {
        if (!isMounted) {
          return;
        }

        setAgentRuns([]);
        setAgentRunMetrics(null);
        return;
      }

      setIsLoadingAgentRuns(true);
      try {
        const [nextAgentRuns, nextAgentRunMetrics] = await Promise.all([
          listAgentRuns(selectedTenantId, selectedAgentId || null, 8, agentRunFilters),
          listAgentRunMetrics(selectedTenantId, selectedAgentId || null, agentRunFilters)
        ]);
        if (!isMounted) {
          return;
        }

        setAgentRuns(nextAgentRuns);
        setAgentRunMetrics(nextAgentRunMetrics);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setErrorMessage(error instanceof Error ? error.message : t("agents.status.launchHistoryFailed"));
      } finally {
        if (isMounted) {
          setIsLoadingAgentRuns(false);
        }
      }
    }

    void refreshAgentRunState();
    return () => {
      isMounted = false;
    };
  }, [agentRunFilters, selectedAgentId, selectedTenantId, t]);

  useEffect(() => {
    let isMounted = true;

    async function refreshAgentExecutionState() {
      if (!selectedTenantId) {
        if (!isMounted) {
          return;
        }

        setAgentExecutions([]);
        setAgentExecutionMetrics(null);
        return;
      }

      setIsLoadingAgentExecutions(true);
      try {
        const [nextAgentExecutions, nextAgentExecutionMetrics] = await Promise.all([
          listAgentExecutions(selectedTenantId, selectedAgentId || null, 8, agentExecutionFilters),
          listAgentExecutionMetrics(selectedTenantId, selectedAgentId || null, agentExecutionFilters)
        ]);
        if (!isMounted) {
          return;
        }

        setAgentExecutions(nextAgentExecutions);
        setAgentExecutionMetrics(nextAgentExecutionMetrics);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setErrorMessage(error instanceof Error ? error.message : t("agents.status.executionHistoryFailed"));
      } finally {
        if (isMounted) {
          setIsLoadingAgentExecutions(false);
        }
      }
    }

    void refreshAgentExecutionState();
    return () => {
      isMounted = false;
    };
  }, [agentExecutionFilters, selectedAgentId, selectedTenantId, t]);

  async function handleCreateAgent() {
    if (!hasAgentWriteAccess) {
      return;
    }

    if (!selectedTenantId) {
      setErrorMessage(t("agents.status.noTenants"));
      setStatusMessage(t("agents.status.noTenants"));
      return;
    }

    const nextAgent: AgentDraft = {
      id: createAgentId(),
      tenantId: selectedTenantId,
      name: t("agents.editor.newAgentName"),
      slug: `agent-${agents.length + 1}`,
      mode: "grounded_chat",
      status: "draft",
      modelStrategy: "remote_reserved",
      modelEndpointId: enabledModelEndpoints.find((modelEndpoint) => modelEndpoint.is_default)?.id ?? "",
      objective: "",
      instructions: "",
      knowledgeBaseScope: "",
      tools: ["chat"],
      toolRegistrationIds: [],
      updatedAt: new Date().toISOString()
    };

    setIsMutating(true);
    setErrorMessage(null);
    try {
      const createdAgent = mapAgentDefinitionToDraft(await createAgentDefinition(nextAgent));
      await refreshAgentDefinitionsForSelectedTenant();
      setSelectedAgentId(createdAgent.id);
      setStatusMessage(t("agents.status.created"));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("agents.status.createFailed"));
      setStatusMessage(t("agents.status.createFailed"));
    } finally {
      setIsMutating(false);
    }
  }

  async function handleDuplicateAgent() {
    if (!hasAgentWriteAccess) {
      return;
    }

    if (!selectedAgent) {
      return;
    }

    const duplicatedAgent: AgentDraft = {
      ...selectedAgent,
      id: createAgentId(),
      name: `${selectedAgent.name} Copy`,
      slug: `${selectedAgent.slug}-copy`,
      status: "draft",
      updatedAt: new Date().toISOString()
    };

    setIsMutating(true);
    setErrorMessage(null);
    try {
      const createdAgent = mapAgentDefinitionToDraft(await createAgentDefinition(duplicatedAgent));
      await refreshAgentDefinitionsForSelectedTenant();
      setSelectedAgentId(createdAgent.id);
      setStatusMessage(t("agents.status.duplicated", { name: selectedAgent.name }));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("agents.status.createFailed"));
      setStatusMessage(t("agents.status.createFailed"));
    } finally {
      setIsMutating(false);
    }
  }

  async function handleDeleteAgent() {
    if (!hasAgentWriteAccess) {
      return;
    }

    if (!selectedAgent) {
      return;
    }

    if (!window.confirm(t("agents.confirm.delete", { name: selectedAgent.name }))) {
      return;
    }

    setIsMutating(true);
    setErrorMessage(null);
    try {
      await deleteAgentDefinition(selectedAgent.id, selectedAgent.tenantId);
      await refreshAgentDefinitionsForSelectedTenant();
      setStatusMessage(t("agents.status.deleted", { name: selectedAgent.name }));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("agents.status.deleteFailed"));
      setStatusMessage(t("agents.status.deleteFailed"));
    } finally {
      setIsMutating(false);
    }
  }

  async function handleSaveAgent() {
    if (!hasAgentWriteAccess) {
      return;
    }

    if (!selectedAgent) {
      return;
    }

    if (!selectedAgent.name.trim() || !selectedAgent.slug.trim()) {
      setErrorMessage(t("agents.status.validationFailed"));
      setStatusMessage(t("agents.status.validationFailed"));
      return;
    }

    const normalizedAgent = normalizeAgentDraft(selectedAgent);
    const readiness = assessAgentReadiness(normalizedAgent, {
      workspaces,
      knowledgeBases,
      modelEndpoints,
      retrievalProfiles,
      toolRegistrations
    });

    if (normalizedAgent.status === "active" && !readiness.isReady) {
      setErrorMessage(t("agents.status.activationBlocked"));
      setStatusMessage(t("agents.status.activationBlocked"));
      return;
    }

    setIsMutating(true);
    setErrorMessage(null);
    try {
      const savedAgent = mapAgentDefinitionToDraft(await updateAgentDefinition(normalizedAgent));
      await refreshAgentDefinitionsForSelectedTenant();
      setSelectedAgentId(savedAgent.id);
      setStatusMessage(t("agents.status.saved", { name: savedAgent.name || t("agents.editor.newAgentName") }));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("agents.status.saveFailed"));
      setStatusMessage(t("agents.status.saveFailed"));
    } finally {
      setIsMutating(false);
    }
  }

  async function handleTransitionAgentStatus(nextStatus: AgentStatus) {
    if (!hasAgentWriteAccess) {
      return;
    }

    if (!selectedAgent) {
      return;
    }

    const normalizedAgent = normalizeAgentDraft({
      ...selectedAgent,
      status: nextStatus
    });
    const readiness = assessAgentReadiness(normalizedAgent, {
      workspaces,
      knowledgeBases,
      modelEndpoints,
      retrievalProfiles,
      toolRegistrations
    });

    if (nextStatus === "active" && !readiness.isReady) {
      setErrorMessage(t("agents.status.activationBlocked"));
      setStatusMessage(t("agents.status.activationBlocked"));
      return;
    }

    setIsMutating(true);
    setErrorMessage(null);
    try {
      const savedAgent = mapAgentDefinitionToDraft(await updateAgentDefinition(normalizedAgent));
      await refreshAgentDefinitionsForSelectedTenant();
      setSelectedAgentId(savedAgent.id);
      setStatusMessage(
        nextStatus === "active"
          ? t("agents.status.activated", { name: savedAgent.name })
          : nextStatus === "paused"
            ? t("agents.status.paused", { name: savedAgent.name })
            : t("agents.status.returnedToDraft", { name: savedAgent.name })
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("agents.status.saveFailed"));
      setStatusMessage(t("agents.status.saveFailed"));
    } finally {
      setIsMutating(false);
    }
  }

  function toggleTool(tool: AgentTool) {
    if (!hasAgentWriteAccess) {
      return;
    }

    updateSelectedAgent((agent) => ({
      ...agent,
      tools: agent.tools.includes(tool)
        ? agent.tools.filter((currentTool) => currentTool !== tool)
        : [...agent.tools, tool]
    }));
  }

  function toggleRegisteredTool(toolRegistrationId: string) {
    if (!hasAgentWriteAccess) {
      return;
    }

    updateSelectedAgent((agent) => ({
      ...agent,
      toolRegistrationIds: agent.toolRegistrationIds.includes(toolRegistrationId)
        ? agent.toolRegistrationIds.filter((currentToolRegistrationId) => currentToolRegistrationId !== toolRegistrationId)
        : [...agent.toolRegistrationIds, toolRegistrationId]
    }));
  }

  const toolDefinitions: Array<{
    tool: AgentTool;
    icon: typeof MessageSquareText;
    label: string;
    description: string;
  }> = [
    {
      tool: "chat",
      icon: MessageSquareText,
      label: t("agents.tools.chat"),
      description: t("agents.connectivity.chatDescription")
    },
    {
      tool: "documents",
      icon: FileText,
      label: t("agents.tools.documents"),
      description: t("agents.connectivity.documentsDescription")
    },
    {
      tool: "operations",
      icon: Waypoints,
      label: t("agents.tools.operations"),
      description: t("agents.connectivity.operationsDescription")
    },
    {
      tool: "admin",
      icon: ShieldCheck,
      label: t("agents.tools.admin"),
      description: t("agents.connectivity.adminDescription")
    }
  ];

  function buildScopedToolHref(
    tool: AgentTool,
    options?: {
      draftQuestion?: string | null;
      documentStatus?: string | null;
      workflowStatus?: "all" | "queued" | "running" | "failed" | "completed" | "pending" | null;
      workflowQuery?: string | null;
      workflowRetryMode?: "all" | "originals" | "retries" | null;
    }
  ) {
    const tenantId = selectedAgent?.tenantId ?? selectedTenantId;
    const agentId = selectedAgent?.id ?? null;

    if ((tool === "chat" || tool === "documents") && tenantId && selectedScopeWorkspace && selectedScopeKnowledgeBase) {
      return buildAgentsWorkspaceHref({
        view: tool === "chat" ? "chat" : "documents",
        tenantId,
        workspaceId: selectedScopeWorkspace.id,
        knowledgeBaseId: selectedScopeKnowledgeBase.id,
        agentId,
        handoffIntent: resolveAgentWorkspaceHandoffIntent(
          selectedAgent?.mode ?? "grounded_chat",
          tool === "chat" ? "chat" : "documents"
        ),
        draftQuestion: options?.draftQuestion ?? null,
        documentStatus: tool === "documents" ? options?.documentStatus ?? null : null
      });
    }

    if (tool === "operations") {
      return buildOperationsHref({
        tenantId: tenantId || null,
        agentId,
        lane: selectedAgent?.mode === "workflow_recovery" ? "failed" : "overview",
        status: options?.workflowStatus ?? (selectedAgent?.mode === "workflow_recovery" ? "failed" : "all"),
        retryMode: options?.workflowRetryMode ?? null,
        query: options?.workflowQuery ?? null,
      });
    }

    if (tool === "admin") {
      return buildAdminHref({
        tenantId: tenantId || null,
        section: "access"
      });
    }

    return tool === "chat"
      ? buildAgentsWorkspaceHref({
          view: "chat",
          tenantId: tenantId || null,
          agentId,
          handoffIntent: "agent_brief"
        })
      : buildAgentsWorkspaceHref({
          view: "documents",
          tenantId: tenantId || null,
          agentId,
          handoffIntent: resolveAgentWorkspaceHandoffIntent(
            selectedAgent?.mode ?? "grounded_chat",
            "documents"
          )
        });
  }

  function resolveLaunchHandoffIntent(surface: AgentRunTargetSurface) {
    if (!selectedAgent) {
      return null;
    }

    if (surface === "chat") {
      return resolveAgentWorkspaceHandoffIntent(selectedAgent.mode, "chat");
    }

    if (surface === "documents") {
      return resolveAgentWorkspaceHandoffIntent(selectedAgent.mode, "documents");
    }

    if (surface === "operations") {
      return selectedAgent.mode === "workflow_recovery" ? "workflow_recovery" : "agent_brief";
    }

    return "governance_review";
  }

  async function handleLaunchSurface(
    surface: AgentRunTargetSurface,
    options?: {
      draftQuestion?: string | null;
      documentStatus?: string | null;
      workflowStatus?: "all" | "queued" | "running" | "failed" | "completed" | "pending" | null;
      workflowQuery?: string | null;
      workflowRetryMode?: "all" | "originals" | "retries" | null;
    }
  ) {
    if (!hasAgentExecutionAccess || !selectedAgent) {
      return;
    }

    if (selectedAgent.status !== "active" || !selectedAgentReadiness?.isReady) {
      setErrorMessage(t("agents.status.runtimeLaunchBlocked"));
      setStatusMessage(t("agents.status.runtimeLaunchBlocked"));
      return;
    }

    const href = buildScopedToolHref(surface, options);
    const navigationHref = serializeAgentRunNavigationHref(href);
    const surfaceLabel = t(`agents.tools.${surface}`);
    const launchPrompt =
      options?.draftQuestion?.trim() ||
      (surface === "chat" ? launchPrompts[0]?.trim() ?? null : null);

    setLaunchingSurface(surface);
    setErrorMessage(null);

    try {
      await createAgentRun({
        tenant_id: selectedAgent.tenantId,
        agent_definition_id: selectedAgent.id,
        workspace_id: selectedScopeWorkspace?.id ?? null,
        knowledge_base_id: selectedScopeKnowledgeBase?.id ?? null,
        target_surface: surface,
        handoff_intent: resolveLaunchHandoffIntent(surface),
        trigger_source: "agents_console",
        launch_prompt: launchPrompt,
        navigation_href: navigationHref
      });
      await refreshAgentRunsForCurrentScope();
      setStatusMessage(t("agents.status.launchRecorded", { surface: surfaceLabel }));
      window.location.assign(navigationHref);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("agents.status.launchFailed"));
      setStatusMessage(t("agents.status.launchFailed"));
    } finally {
      setLaunchingSurface(null);
    }
  }

  async function handleExecuteAgent() {
    if (!hasAgentExecutionAccess || !selectedAgent) {
      return;
    }

    if (selectedAgent.status !== "active" || !selectedAgentReadiness?.isReady) {
      setErrorMessage(t("agents.status.executionBlocked"));
      setStatusMessage(t("agents.status.executionBlocked"));
      return;
    }

    setIsExecutingAgent(true);
    setErrorMessage(null);

    try {
      const executionInput = launchPrompts[0]?.trim() || selectedAgent.objective.trim() || null;
      const execution = await createAgentExecution({
        tenant_id: selectedAgent.tenantId,
        agent_definition_id: selectedAgent.id,
        execution_input: executionInput,
        trigger_source: "agents_console"
      });
      await refreshAgentExecutionsForCurrentScope();
      setStatusMessage(
        execution.execution_status === "completed"
          ? t("agents.status.executionCompleted")
          : execution.execution_status === "failed"
            ? t("agents.status.executionFailed")
            : t("agents.status.executionQueued")
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("agents.status.executionFailed"));
      setStatusMessage(t("agents.status.executionFailed"));
    } finally {
      setIsExecutingAgent(false);
    }
  }

  const recommendedRoute = useMemo(() => {
    if (!selectedAgent) {
      return null;
    }

    if (selectedAgent.mode === "grounded_chat") {
      return {
        title: t("agents.delivery.recommendedChat"),
        description:
          selectedScopeWorkspace && selectedScopeKnowledgeBase
            ? t("agents.delivery.chatReady", { scope: selectedAgent.knowledgeBaseScope })
            : t("agents.delivery.scopeRequired"),
        href: buildScopedToolHref("chat")
      };
    }

    if (selectedAgent.mode === "document_intake") {
      return {
        title: t("agents.delivery.recommendedDocuments"),
        description:
          selectedScopeWorkspace && selectedScopeKnowledgeBase
            ? t("agents.delivery.documentsReady", { scope: selectedAgent.knowledgeBaseScope })
            : t("agents.delivery.scopeRequired"),
        href: buildScopedToolHref("documents")
      };
    }

    return {
      title: t("agents.delivery.recommendedOperations"),
      description: t("agents.delivery.operationsReady"),
      href: buildScopedToolHref("operations")
    };
  }, [
    selectedAgent,
    selectedScopeKnowledgeBase,
    selectedScopeWorkspace,
    t
  ]);

  const launchPrompts = useMemo(() => {
    if (!selectedAgent) {
      return [];
    }

    const scopeLabel =
      selectedScopeWorkspace && selectedScopeKnowledgeBase
        ? `${selectedScopeWorkspace.slug}/${selectedScopeKnowledgeBase.slug}`
        : selectedAgent.knowledgeBaseScope || null;

    return buildAgentLaunchPrompts({
      agent: selectedAgent,
      scopeLabel,
      language,
    });
  }, [language, selectedAgent, selectedScopeKnowledgeBase, selectedScopeWorkspace]);

  const launchSurfaceCards = useMemo(() => {
    if (!selectedAgent) {
      return [];
    }

    const cards: Array<{
      key: string;
      title: string;
      description: string;
      href: ReturnType<typeof buildWorkspaceHref> | ReturnType<typeof buildOperationsHref> | ReturnType<typeof buildAdminHref>;
      actionLabel: string;
    }> = [];

    if (selectedAgent.mode === "grounded_chat") {
      cards.push({
        key: "primary-chat",
        title: t("agents.delivery.primarySurface"),
        description: t("agents.delivery.primaryChatDescription"),
        href: buildScopedToolHref("chat", { draftQuestion: launchPrompts[0] ?? null }),
        actionLabel: t("agents.delivery.openPrimary"),
      });
      cards.push({
        key: "documents-followup",
        title: t("agents.delivery.secondarySurface"),
        description: t("agents.delivery.secondaryDocumentsDescription"),
        href: buildScopedToolHref("documents"),
        actionLabel: t("agents.delivery.openSecondary"),
      });
      cards.push({
        key: "operations-followup",
        title: t("agents.delivery.tertiarySurface"),
        description: t("agents.delivery.tertiaryOperationsDescription"),
        href: buildScopedToolHref("operations"),
        actionLabel: t("agents.delivery.openTertiary"),
      });
      return cards;
    }

    if (selectedAgent.mode === "document_intake") {
      cards.push({
        key: "primary-documents",
        title: t("agents.delivery.primarySurface"),
        description: t("agents.delivery.primaryDocumentsDescription"),
        href: buildScopedToolHref("documents"),
        actionLabel: t("agents.delivery.openPrimary"),
      });
      cards.push({
        key: "chat-briefing",
        title: t("agents.delivery.secondarySurface"),
        description: t("agents.delivery.secondaryChatDescription"),
        href: buildScopedToolHref("chat", { draftQuestion: launchPrompts[0] ?? null }),
        actionLabel: t("agents.delivery.openSecondary"),
      });
      cards.push({
        key: "operations-failures",
        title: t("agents.delivery.tertiarySurface"),
        description: t("agents.delivery.tertiaryOperationsDescription"),
        href: buildScopedToolHref("operations", { workflowStatus: "failed" }),
        actionLabel: t("agents.delivery.openTertiary"),
      });
      return cards;
    }

    cards.push({
      key: "primary-operations",
      title: t("agents.delivery.primarySurface"),
      description: t("agents.delivery.primaryOperationsDescription"),
      href: buildScopedToolHref("operations", { workflowStatus: "failed", workflowRetryMode: "all" }),
      actionLabel: t("agents.delivery.openPrimary"),
    });
    cards.push({
      key: "chat-briefing",
      title: t("agents.delivery.secondarySurface"),
      description: t("agents.delivery.secondaryChatDescription"),
      href: buildScopedToolHref("chat", { draftQuestion: launchPrompts[0] ?? null }),
      actionLabel: t("agents.delivery.openSecondary"),
    });
    cards.push({
      key: "documents-failed",
      title: t("agents.delivery.tertiarySurface"),
      description: t("agents.delivery.tertiaryDocumentsDescription"),
      href: buildScopedToolHref("documents", { documentStatus: "failed" }),
      actionLabel: t("agents.delivery.openTertiary"),
    });
    return cards;
  }, [launchPrompts, selectedAgent, t]);

  const launchChecklistItems = useMemo(() => {
    if (!selectedAgent) {
      return [];
    }

    const checklist = [];
    checklist.push(
      selectedAgent.knowledgeBaseScope.trim()
        ? t("agents.delivery.checkScopeReady", { scope: selectedAgent.knowledgeBaseScope })
        : t("agents.delivery.checkScopeMissing")
    );
    checklist.push(
      selectedModelEndpoint
        ? t("agents.delivery.checkModelReady", { name: selectedModelEndpoint.name })
        : t("agents.delivery.checkModelInherited")
    );
    checklist.push(
      countConnectedCapabilities(selectedAgent) > 0
        ? t("agents.delivery.checkToolsReady", { count: String(countConnectedCapabilities(selectedAgent)) })
        : t("agents.delivery.checkToolsMissing")
    );
    return checklist;
  }, [selectedAgent, selectedModelEndpoint, t]);

  const runtimeTaskPacket = useMemo(() => {
    const connectedCapabilityCount = selectedAgent ? countConnectedCapabilities(selectedAgent) : 0;
    const launchReady = selectedAgent
      ? selectedAgent.mode === "workflow_recovery" || Boolean(selectedScopeWorkspace && selectedScopeKnowledgeBase)
      : false;
    const statusTone = !selectedAgent
      ? ("review" as const)
      : selectedAgentReadiness?.isReady
        ? launchReady
          ? ("healthy" as const)
          : ("review" as const)
        : ("attention" as const);
    const targetLabel = !selectedAgent
      ? t("agents.delivery.runtimeTaskPending")
      : selectedAgent.mode === "workflow_recovery"
        ? t("agents.tools.operations")
        : selectedAgent.mode === "document_intake"
          ? t("agents.tools.documents")
          : t("agents.tools.chat");

    return {
      detail: selectedAgent
        ? recommendedRoute?.description ?? t("agents.delivery.scopeRequired")
        : t("agents.delivery.selectAgent"),
      objective: selectedAgent?.objective.trim().length
        ? selectedAgent.objective
        : t("agents.delivery.runtimeTaskNoObjective"),
      primaryActionHref:
        recommendedRoute?.href ??
        buildAgentsHref({
          tenantId: selectedTenantId || null,
          agentId: selectedAgent?.id ?? null
        }),
      prompt: launchPrompts[0] ?? t("agents.delivery.runtimeTaskNoPrompt"),
      secondaryActions: [
        {
          label: t("agents.delivery.runtimeTaskOpenOperations"),
          href: buildScopedToolHref("operations")
        },
        {
          label: t("agents.delivery.runtimeTaskOpenAdmin"),
          href: buildScopedToolHref("admin")
        }
      ],
      statusLabel:
        statusTone === "attention"
          ? t("agents.executionPackets.statuses.attention")
          : statusTone === "review"
            ? t("agents.executionPackets.statuses.review")
            : t("agents.executionPackets.statuses.healthy"),
      statusTone,
      summaryItems: [
        {
          label: t("agents.delivery.runtimeTaskFields.mode"),
          value: selectedAgent ? t(`agents.modes.${selectedAgent.mode}`) : t("agents.delivery.runtimeTaskPending")
        },
        {
          label: t("agents.delivery.runtimeTaskFields.target"),
          value: targetLabel
        },
        {
          label: t("agents.delivery.runtimeTaskFields.scope"),
          value: !selectedAgent
            ? t("agents.delivery.runtimeTaskPending")
            : selectedAgent.mode === "workflow_recovery"
              ? t("agents.delivery.runtimeTaskScopeNotRequired")
              : selectedScopeWorkspace && selectedScopeKnowledgeBase
                ? `${selectedScopeWorkspace.name} / ${selectedScopeKnowledgeBase.name}`
                : selectedAgent.knowledgeBaseScope || t("agents.executionPackets.scopePending")
        },
        {
          label: t("agents.delivery.runtimeTaskFields.model"),
          value: selectedAgentReadiness?.resolvedModelEndpoint?.name ?? t("agents.executionPackets.modelInherited")
        },
        {
          label: t("agents.delivery.runtimeTaskFields.capabilities"),
          value: t("agents.delivery.runtimeTaskCapabilitiesValue", {
            count: String(connectedCapabilityCount)
          })
        }
      ],
      title: recommendedRoute?.title ?? t("agents.delivery.noRecommendation")
    };
  }, [
    launchPrompts,
    recommendedRoute,
    selectedAgent,
    selectedAgentReadiness,
    selectedScopeKnowledgeBase,
    selectedScopeWorkspace,
    selectedTenantId,
    t
  ]);

  const executionPackets = useMemo<AgentExecutionPacket[]>(() => {
    const selectedAgentName = selectedAgent?.name ?? t("agents.executionPackets.notSelected");
    const readinessCount = scopedAgents.filter((agent) => readinessByAgentId.get(agent.id)?.isReady).length;
    const activeCount = scopedAgents.filter((agent) => agent.status === "active").length;
    const scopeValue =
      selectedScopeWorkspace && selectedScopeKnowledgeBase
        ? `${selectedScopeWorkspace.name} / ${selectedScopeKnowledgeBase.name}`
        : selectedAgent?.knowledgeBaseScope || t("agents.executionPackets.scopePending");
    const resolvedRuntimeModel = selectedAgentReadiness?.resolvedModelEndpoint?.name ?? t("agents.executionPackets.modelInherited");
    const resolvedRetrievalProfile =
      selectedAgentReadiness?.resolvedRetrievalProfile?.name ??
      selectedScopeRetrievalProfile?.name ??
      t("agents.dependencies.noRetrievalProfile");
    const connectedCapabilityCount = selectedAgent ? countConnectedCapabilities(selectedAgent) : 0;
    const recommendedPrimaryHref =
      recommendedRoute?.href ??
      buildAgentsHref({
        tenantId: selectedTenantId || null,
        agentId: selectedAgent?.id ?? null
      });
    const retrievalPrimaryActionHref =
      selectedScopeKnowledgeBase
        ? buildAdminHref({
            tenantId: (selectedScopeWorkspace?.tenant_id ?? selectedTenantId) || null,
            section: "directory",
            retrievalProfileFilter:
              selectedRetrievalGovernanceIssue === "disabled"
                ? DISABLED_RETRIEVAL_PROFILE_FILTER_VALUE
                : null,
            knowledgeBaseId: selectedScopeKnowledgeBase.id,
            managementPanel: "knowledge-base-edit"
          })
        : selectedRetrievalGovernanceIssue === "disabled"
          ? buildAdminHref({
              tenantId: selectedTenantId || null,
              section: "directory",
              retrievalProfileFilter: DISABLED_RETRIEVAL_PROFILE_FILTER_VALUE
            })
          : buildAdminHref({
              tenantId: selectedTenantId || null,
              section: "directory",
              retrievalProfileFilter: DEFAULT_RETRIEVAL_PROFILE_FILTER_VALUE
            });
    const retrievalPrimaryActionLabel =
      selectedRetrievalGovernanceIssue === "missing"
        ? t("agents.executionPackets.retrieval.primaryMissingAction")
        : t("agents.executionPackets.retrieval.primaryAction");
    const retrievalSettingsHref =
      selectedScopeRetrievalProfile || selectedAgentReadiness?.resolvedRetrievalProfile
        ? buildSettingsHref({
            runtimeResource: "retrieval_profile",
            retrievalProfileId:
              selectedScopeRetrievalProfile?.id ?? selectedAgentReadiness?.resolvedRetrievalProfile?.id ?? ""
          })
        : buildSettingsHref({ runtimeResource: "retrieval_profile" });

    return [
      {
        title: t("agents.executionPackets.readiness.title"),
        detail: selectedAgentReadiness
          ? selectedAgentReadiness.isReady
            ? t("agents.executionPackets.readiness.readyDetail", { name: selectedAgentName })
            : t("agents.executionPackets.readiness.reviewDetail", {
                name: selectedAgentName,
                count: String(selectedAgentReadiness.issues.length)
              })
          : t("agents.executionPackets.readiness.emptyDetail"),
        status: selectedAgentReadiness ? (selectedAgentReadiness.isReady ? "healthy" : "attention") : "review",
        metricLabel: t("agents.executionPackets.readiness.metric"),
        metricValue: `${readinessCount}/${scopedAgents.length}`,
        primaryActionLabel: t("agents.executionPackets.readiness.primaryAction"),
        primaryActionHref: buildAgentsHref({
          tenantId: selectedTenantId || null,
          agentId: selectedAgent?.id ?? null,
          status: selectedAgent?.status ?? "all",
          mode: selectedAgent?.mode ?? "all"
        }),
        secondaryActions: [
          {
            label:
              selectedRetrievalGovernanceIssue === null
                ? t("agents.executionPackets.readiness.secondaryAdmin")
                : t("agents.executionPackets.retrieval.secondarySettings"),
            href:
              selectedRetrievalGovernanceIssue === null
                ? buildAdminHref({
                    tenantId: selectedTenantId || null,
                    section: "overview"
                  })
                : retrievalSettingsHref
          },
          {
            label: t("agents.executionPackets.readiness.secondaryOperations"),
            href: buildScopedToolHref("operations")
          }
        ]
      },
      {
        title: t("agents.executionPackets.delivery.title"),
        detail: recommendedRoute
          ? t("agents.executionPackets.delivery.readyDetail", {
              destination: recommendedRoute.title
            })
          : t("agents.executionPackets.delivery.emptyDetail"),
        status: recommendedRoute ? "healthy" : "review",
        metricLabel: t("agents.executionPackets.delivery.metric"),
        metricValue: scopeValue,
        primaryActionLabel: t("agents.executionPackets.delivery.primaryAction"),
        primaryActionHref: recommendedPrimaryHref,
        secondaryActions: [
          {
            label: t("agents.executionPackets.delivery.secondaryChat"),
            href: buildScopedToolHref("chat", { draftQuestion: launchPrompts[0] ?? null })
          },
          {
            label: t("agents.executionPackets.delivery.secondaryDocuments"),
            href: buildScopedToolHref("documents")
          }
        ]
      },
      {
        title: t("agents.executionPackets.runtime.title"),
        detail: selectedAgent
          ? t("agents.executionPackets.runtime.detail", {
              count: String(connectedCapabilityCount),
              model: resolvedRuntimeModel
            })
          : t("agents.executionPackets.runtime.emptyDetail"),
        status: selectedAgent ? (connectedCapabilityCount > 0 ? "healthy" : "review") : "review",
        metricLabel: t("agents.executionPackets.runtime.metric"),
        metricValue: String(connectedCapabilityCount),
        primaryActionLabel: t("agents.executionPackets.runtime.primaryAction"),
        primaryActionHref:
          selectedRuntimeSettingsHref ??
          buildScopedToolHref(
            selectedAgent?.mode === "workflow_recovery"
              ? "operations"
              : selectedAgent?.mode === "document_intake"
                ? "documents"
                : "chat",
            {
              draftQuestion: launchPrompts[0] ?? null,
              workflowStatus: selectedAgent?.mode === "workflow_recovery" ? "failed" : null
            }
          ),
        secondaryActions: [
          {
            label: t("agents.executionPackets.runtime.secondaryOperations"),
            href: buildScopedToolHref("operations")
          },
          {
            label: t("agents.executionPackets.runtime.secondaryAdmin"),
            href: selectedRuntimeSettingsHref ?? buildScopedToolHref("admin")
          }
        ]
      },
      {
        title: t("agents.executionPackets.retrieval.title"),
        detail:
          selectedRetrievalGovernanceIssue === "disabled"
            ? t("agents.executionPackets.retrieval.disabledDetail", {
                profile: resolvedRetrievalProfile
              })
            : selectedRetrievalGovernanceIssue === "missing"
              ? t("agents.executionPackets.retrieval.missingDetail", {
                  scope: scopeValue
                })
              : selectedAgent && (selectedAgent.mode === "grounded_chat" || selectedAgent.mode === "document_intake")
                ? t("agents.executionPackets.retrieval.readyDetail", {
                    profile: resolvedRetrievalProfile
                  })
                : t("agents.executionPackets.retrieval.emptyDetail"),
        status:
          selectedRetrievalGovernanceIssue === "disabled"
            ? "attention"
            : selectedRetrievalGovernanceIssue === "missing"
              ? "review"
              : selectedAgent && (selectedAgent.mode === "grounded_chat" || selectedAgent.mode === "document_intake")
                ? "healthy"
                : "review",
        metricLabel: t("agents.executionPackets.retrieval.metric"),
        metricValue: resolvedRetrievalProfile,
        primaryActionLabel: retrievalPrimaryActionLabel,
        primaryActionHref: retrievalPrimaryActionHref,
        secondaryActions: [
          {
            label: t("agents.executionPackets.retrieval.secondarySettings"),
            href: retrievalSettingsHref
          },
          {
            label: t("agents.executionPackets.retrieval.secondaryDefinitions"),
            href: buildAgentsHref({
              tenantId: selectedTenantId || null,
              status: "active",
              agentId: selectedAgent?.id ?? null
            })
          }
        ]
      },
      {
        title: t("agents.executionPackets.governance.title"),
        detail:
          activeCount > 0
            ? t("agents.executionPackets.governance.activeDetail", {
                active: String(activeCount),
                total: String(scopedAgents.length)
              })
            : t("agents.executionPackets.governance.emptyDetail"),
        status: activeCount > 0 ? "review" : "healthy",
        metricLabel: t("agents.executionPackets.governance.metric"),
        metricValue: resolvedRuntimeModel,
        primaryActionLabel: t("agents.executionPackets.governance.primaryAction"),
        primaryActionHref:
          selectedRuntimeSettingsHref ??
          buildAdminHref({
            tenantId: selectedTenantId || null,
            section: "directory"
          }),
        secondaryActions: [
          {
            label: t("agents.executionPackets.governance.secondaryDefinitions"),
            href: buildAgentsHref({
              tenantId: selectedTenantId || null,
              status: "active",
              agentId: selectedAgent?.id ?? null,
              modelEndpointId: selectedAgentReadiness?.resolvedModelEndpoint?.id ?? null,
              toolRegistrationId: selectedDisabledToolRegistration?.id ?? null
            })
          },
          {
            label: t("agents.executionPackets.governance.secondaryAccess"),
            href: buildAdminHref({
              tenantId: selectedTenantId || null,
              section: "access"
            })
          }
        ]
      }
    ];
  }, [
    launchPrompts,
    readinessByAgentId,
    recommendedRoute,
    scopedAgents,
    selectedAgent,
    selectedAgentReadiness,
    selectedDisabledToolRegistration,
    selectedRetrievalGovernanceIssue,
    selectedScopeRetrievalProfile,
    selectedScopeKnowledgeBase,
    selectedScopeWorkspace,
    selectedRuntimeSettingsHref,
    selectedTenantId,
    t
  ]);

  const releaseBoardItems = useMemo<AgentReleaseBoardItem[]>(() => {
    const resolvedRuntimeModel = selectedAgentReadiness?.resolvedModelEndpoint ?? selectedModelEndpoint ?? null;
    const retrievalSettingsHref =
      selectedScopeRetrievalProfile || selectedAgentReadiness?.resolvedRetrievalProfile
        ? buildSettingsHref({
            runtimeResource: "retrieval_profile",
            retrievalProfileId:
              selectedScopeRetrievalProfile?.id ?? selectedAgentReadiness?.resolvedRetrievalProfile?.id ?? ""
          })
        : buildSettingsHref({ runtimeResource: "retrieval_profile" });
    const missingDefinitionFields = selectedAgent
      ? [
          !selectedAgent.name.trim(),
          !selectedAgent.slug.trim(),
          !selectedAgent.objective.trim(),
          !selectedAgent.instructions.trim()
        ].filter(Boolean).length
      : 4;
    const scopeRequired =
      selectedAgent?.mode === "grounded_chat" || selectedAgent?.mode === "document_intake";
    const scopeResolved = Boolean(selectedScopeWorkspace && selectedScopeKnowledgeBase);
    const connectedCapabilityCount = selectedAgent ? countConnectedCapabilities(selectedAgent) : 0;
    const approvalRequiredCount = selectedRegisteredTools.filter(
      (toolRegistration) => toolRegistration.requires_admin_approval
    ).length;
    const disabledRegistrationCount = selectedAgentReadiness?.disabledRegisteredToolCount ?? 0;

    return [
      {
        title: t("agents.releaseBoard.definition.title"),
        detail: selectedAgent
          ? missingDefinitionFields === 0
            ? t("agents.releaseBoard.definition.readyDetail")
            : t("agents.releaseBoard.definition.reviewDetail", {
                count: String(missingDefinitionFields)
              })
          : t("agents.releaseBoard.definition.emptyDetail"),
        status: selectedAgent ? (missingDefinitionFields === 0 ? "healthy" : "review") : "review",
        metricLabel: t("agents.releaseBoard.definition.metric"),
        metricValue: `${selectedAgent ? 4 - missingDefinitionFields : 0}/4`,
        actionLabel: t("agents.releaseBoard.definition.action"),
        href: buildAgentsHref({
          tenantId: selectedTenantId || null,
          agentId: selectedAgent?.id ?? null
        })
      },
      {
        title: t("agents.releaseBoard.scope.title"),
        detail: selectedAgent
          ? !scopeRequired
            ? t("agents.releaseBoard.scope.optionalDetail")
            : scopeResolved
              ? t("agents.releaseBoard.scope.readyDetail", {
                  scope: selectedAgent.knowledgeBaseScope
                })
              : t("agents.releaseBoard.scope.reviewDetail")
          : t("agents.releaseBoard.scope.emptyDetail"),
        status: selectedAgent
          ? !scopeRequired
            ? "healthy"
            : scopeResolved
              ? "healthy"
              : "attention"
          : "review",
        metricLabel: t("agents.releaseBoard.scope.metric"),
        metricValue: !selectedAgent
          ? t("agents.executionPackets.scopePending")
          : scopeRequired
            ? selectedAgent.knowledgeBaseScope || t("agents.executionPackets.scopePending")
            : t("agents.releaseBoard.scope.notRequiredValue"),
        actionLabel: t("agents.releaseBoard.scope.action"),
        href: scopeRequired ? buildScopedToolHref("documents") : buildScopedToolHref("operations")
      },
      {
        title: t("agents.releaseBoard.retrieval.title"),
        detail: !selectedAgent
          ? t("agents.releaseBoard.retrieval.emptyDetail")
          : !scopeRequired
            ? t("agents.releaseBoard.retrieval.notRequiredDetail")
            : selectedRetrievalGovernanceIssue === "disabled"
              ? t("agents.releaseBoard.retrieval.disabledDetail", {
                  profile: selectedAgentReadiness?.resolvedRetrievalProfile?.name ?? t("agents.dependencies.noRetrievalProfile")
                })
              : selectedRetrievalGovernanceIssue === "missing"
                ? t("agents.releaseBoard.retrieval.missingDetail")
                : selectedAgentReadiness?.resolvedRetrievalProfile
                  ? t("agents.releaseBoard.retrieval.readyDetail", {
                      profile: selectedAgentReadiness.resolvedRetrievalProfile.name
                    })
                  : t("agents.releaseBoard.retrieval.emptyDetail"),
        status: !selectedAgent
          ? "review"
          : !scopeRequired
            ? "healthy"
            : selectedRetrievalGovernanceIssue === "disabled"
              ? "attention"
              : selectedRetrievalGovernanceIssue === "missing"
                ? "review"
                : selectedAgentReadiness?.resolvedRetrievalProfile
                  ? "healthy"
                  : "review",
        metricLabel: t("agents.releaseBoard.retrieval.metric"),
        metricValue:
          selectedAgentReadiness?.resolvedRetrievalProfile?.name ??
          t("agents.dependencies.noRetrievalProfile"),
        actionLabel:
          selectedRetrievalGovernanceIssue === "missing"
            ? t("agents.releaseBoard.retrieval.actionSettings")
            : t("agents.releaseBoard.retrieval.action"),
        href:
          selectedRetrievalGovernanceIssue === "disabled"
            ? selectedScopeKnowledgeBase
              ? buildAdminHref({
                  tenantId: (selectedScopeWorkspace?.tenant_id ?? selectedTenantId) || null,
                  section: "directory",
                  retrievalProfileFilter: DISABLED_RETRIEVAL_PROFILE_FILTER_VALUE,
                  knowledgeBaseId: selectedScopeKnowledgeBase.id,
                  managementPanel: "knowledge-base-edit"
                })
              : buildAdminHref({
                  tenantId: selectedTenantId || null,
                  section: "directory",
                  retrievalProfileFilter: DISABLED_RETRIEVAL_PROFILE_FILTER_VALUE
                })
            : selectedRetrievalGovernanceIssue === "missing"
              ? selectedScopeKnowledgeBase
                ? buildAdminHref({
                    tenantId: (selectedScopeWorkspace?.tenant_id ?? selectedTenantId) || null,
                    section: "directory",
                    knowledgeBaseId: selectedScopeKnowledgeBase.id,
                    managementPanel: "knowledge-base-edit"
                  })
                : retrievalSettingsHref
              : buildAdminHref({
                  tenantId: selectedTenantId || null,
                  section: "directory",
                  retrievalProfileFilter:
                    selectedScopeRetrievalProfileSource === "knowledge_base" && selectedScopeRetrievalProfile
                      ? selectedScopeRetrievalProfile.id
                      : DEFAULT_RETRIEVAL_PROFILE_FILTER_VALUE
                })
      },
      {
        title: t("agents.releaseBoard.runtime.title"),
        detail: selectedAgent
          ? resolvedRuntimeModel
            ? connectedCapabilityCount > 0
              ? t("agents.releaseBoard.runtime.readyDetail", {
                  model: resolvedRuntimeModel.name,
                  provider: t(`settings.models.providers.${resolvedRuntimeModel.provider_type}`)
                })
              : t("agents.releaseBoard.runtime.reviewDetail", {
                  model: resolvedRuntimeModel.name
                })
            : t("agents.releaseBoard.runtime.emptyRuntimeDetail")
          : t("agents.releaseBoard.runtime.emptyDetail"),
        status: selectedAgent
          ? resolvedRuntimeModel
            ? connectedCapabilityCount > 0
              ? "healthy"
              : "review"
            : "attention"
          : "review",
        metricLabel: t("agents.releaseBoard.runtime.metric"),
        metricValue: resolvedRuntimeModel?.name ?? t("agents.executionPackets.modelInherited"),
        actionLabel: t("agents.releaseBoard.runtime.action"),
        href:
          selectedRuntimeSettingsHref ??
          buildScopedToolHref(
            selectedAgent?.mode === "workflow_recovery"
              ? "operations"
              : selectedAgent?.mode === "document_intake"
                ? "documents"
                : "chat",
            {
              draftQuestion: launchPrompts[0] ?? null,
              workflowStatus: selectedAgent?.mode === "workflow_recovery" ? "failed" : null
            }
          )
      },
      {
        title: t("agents.releaseBoard.governance.title"),
        detail: selectedAgent
          ? disabledRegistrationCount > 0
            ? t("agents.releaseBoard.governance.reviewDetail", {
                count: String(disabledRegistrationCount)
              })
            : approvalRequiredCount > 0
              ? t("agents.releaseBoard.governance.pendingDetail", {
                  count: String(approvalRequiredCount)
                })
              : t("agents.releaseBoard.governance.healthyDetail", {
                  status: t(`agents.statuses.${selectedAgent.status}`)
                })
          : t("agents.releaseBoard.governance.emptyDetail"),
        status: selectedAgent
          ? disabledRegistrationCount > 0
            ? "attention"
            : approvalRequiredCount > 0 || selectedAgent.status !== "active"
              ? "review"
              : "healthy"
          : "review",
        metricLabel: t("agents.releaseBoard.governance.metric"),
        metricValue: `${approvalRequiredCount + disabledRegistrationCount}`,
        actionLabel: t("agents.releaseBoard.governance.action"),
        href:
          selectedRuntimeSettingsHref ??
          buildAdminHref({
            tenantId: selectedTenantId || null,
            section: "access"
          })
      }
    ];
  }, [
    launchPrompts,
    selectedAgent,
    selectedAgentReadiness,
    selectedApprovalToolRegistration,
    selectedModelEndpoint,
    selectedRegisteredTools,
    selectedRuntimeSettingsHref,
    selectedScopeKnowledgeBase,
    selectedScopeRetrievalProfile,
    selectedScopeRetrievalProfileSource,
    selectedScopeWorkspace,
    selectedRetrievalGovernanceIssue,
    selectedTenantId,
    t
  ]);

  const runbookSteps = useMemo<AgentRunbookStep[]>(() => {
    if (!selectedAgent) {
      return [];
    }

    const approvalRequiredCount = selectedRegisteredTools.filter(
      (toolRegistration) => toolRegistration.requires_admin_approval
    ).length;

    if (selectedAgent.mode === "document_intake") {
      return [
        {
          title: t("agents.runbook.documentIntake.intakeTitle"),
          detail: t("agents.runbook.documentIntake.intakeDetail"),
          status: selectedScopeWorkspace && selectedScopeKnowledgeBase ? "healthy" : "review",
          actionLabel: t("agents.runbook.actions.openDocuments"),
          href: buildScopedToolHref("documents")
        },
        {
          title: t("agents.runbook.documentIntake.recoveryTitle"),
          detail: t("agents.runbook.documentIntake.recoveryDetail"),
          status: selectedRegisteredTools.length > 0 ? "healthy" : "review",
          actionLabel: t("agents.runbook.actions.openOperations"),
          href: buildScopedToolHref("operations", { workflowStatus: "failed" })
        },
        {
          title: t("agents.runbook.documentIntake.briefingTitle"),
          detail: t("agents.runbook.documentIntake.briefingDetail"),
          status: launchPrompts.length > 0 ? "healthy" : "review",
          actionLabel: t("agents.runbook.actions.openChat"),
          href: buildScopedToolHref("chat", { draftQuestion: launchPrompts[0] ?? null })
        }
      ];
    }

    if (selectedAgent.mode === "workflow_recovery") {
      return [
        {
          title: t("agents.runbook.workflowRecovery.triageTitle"),
          detail: t("agents.runbook.workflowRecovery.triageDetail"),
          status: "healthy",
          actionLabel: t("agents.runbook.actions.openOperations"),
          href: buildScopedToolHref("operations", { workflowStatus: "failed", workflowRetryMode: "all" })
        },
        {
          title: t("agents.runbook.workflowRecovery.cleanupTitle"),
          detail: t("agents.runbook.workflowRecovery.cleanupDetail"),
          status: selectedRegisteredTools.length > 0 ? "healthy" : "review",
          actionLabel: t("agents.runbook.actions.openDocuments"),
          href: buildScopedToolHref("documents", { documentStatus: "failed" })
        },
        {
          title: t("agents.runbook.workflowRecovery.approvalTitle"),
          detail: t("agents.runbook.workflowRecovery.approvalDetail", {
            count: String(approvalRequiredCount)
          }),
          status: approvalRequiredCount > 0 || selectedAgent.status !== "active" ? "review" : "healthy",
          actionLabel: t("agents.runbook.actions.openAccess"),
          href: buildAdminHref({
            tenantId: selectedTenantId || null,
            section: "access"
          })
        }
      ];
    }

    return [
      {
        title: t("agents.runbook.groundedChat.scopeTitle"),
        detail:
          selectedScopeWorkspace && selectedScopeKnowledgeBase
            ? t("agents.runbook.groundedChat.scopeReady", {
                scope: selectedAgent.knowledgeBaseScope
              })
            : t("agents.runbook.groundedChat.scopeMissing"),
        status: selectedScopeWorkspace && selectedScopeKnowledgeBase ? "healthy" : "attention",
        actionLabel: t("agents.runbook.actions.openDocuments"),
        href: buildScopedToolHref("documents")
      },
      {
        title: t("agents.runbook.groundedChat.launchTitle"),
        detail: t("agents.runbook.groundedChat.launchDetail"),
        status: selectedAgentReadiness?.isReady ? "healthy" : "review",
        actionLabel: t("agents.runbook.actions.openChat"),
        href: buildScopedToolHref("chat", { draftQuestion: launchPrompts[0] ?? null })
      },
      {
        title: t("agents.runbook.groundedChat.closureTitle"),
        detail: t("agents.runbook.groundedChat.closureDetail", {
          count: String(approvalRequiredCount)
        }),
        status: approvalRequiredCount > 0 || selectedAgent.status !== "active" ? "review" : "healthy",
        actionLabel: t("agents.runbook.actions.openAccess"),
        href: buildAdminHref({
          tenantId: selectedTenantId || null,
          section: "access"
        })
      }
    ];
  }, [
    launchPrompts,
    selectedAgent,
    selectedAgentReadiness,
    selectedRegisteredTools,
    selectedScopeKnowledgeBase,
    selectedScopeWorkspace,
    selectedTenantId,
    t
  ]);

  const operatingLaneItems = [
    {
      key: "grounded_chat",
      title: t("agents.architecture.groundedChat.title"),
      description: t("agents.architecture.groundedChat.description", {
        total: String(modeMetrics.groundedChat.total)
      }),
      value: t("agents.architecture.groundedChat.value", {
        active: String(modeMetrics.groundedChat.active),
        total: String(modeMetrics.groundedChat.total)
      }),
      href: buildScopedToolHref("chat")
    },
    {
      key: "document_intake",
      title: t("agents.architecture.documentIntake.title"),
      description: t("agents.architecture.documentIntake.description", {
        total: String(modeMetrics.documentIntake.total)
      }),
      value: t("agents.architecture.documentIntake.value", {
        active: String(modeMetrics.documentIntake.active),
        total: String(modeMetrics.documentIntake.total)
      }),
      href: buildScopedToolHref("documents")
    },
    {
      key: "workflow_recovery",
      title: t("agents.architecture.workflowRecovery.title"),
      description: t("agents.architecture.workflowRecovery.description", {
        total: String(modeMetrics.workflowRecovery.total)
      }),
      value: t("agents.architecture.workflowRecovery.value", {
        active: String(modeMetrics.workflowRecovery.active),
        total: String(modeMetrics.workflowRecovery.total)
      }),
      href: buildOperationsHref({
        tenantId: selectedAgent?.tenantId ?? selectedTenantId ?? null,
        agentId: selectedAgent?.id ?? null,
        lane: "failed",
        status: "failed"
      })
    },
    {
      key: "governance",
      title: t("agents.architecture.governance.title"),
      description: t("agents.architecture.governance.description", {
        ready: String(modeMetrics.readyDrafts)
      }),
      value: t("agents.architecture.governance.value", {
        count: String(modeMetrics.governanceAttentionDrafts)
      }),
      href: buildAdminHref({
        tenantId: selectedAgent?.tenantId ?? selectedTenantId ?? null,
        section: "access"
      })
    }
  ];

  function handleWorkspaceScopeChange(workspaceId: string) {
    if (!hasAgentWriteAccess) {
      return;
    }

    if (workspaceId === "unscoped") {
      updateSelectedAgent((agent) => ({
        ...agent,
        knowledgeBaseScope: ""
      }));
      return;
    }

    const workspace = workspaces.find((item) => item.id === workspaceId) ?? null;
    const firstKnowledgeBase = knowledgeBases.find((item) => item.workspace_id === workspaceId) ?? null;
    updateSelectedAgent((agent) => ({
      ...agent,
      knowledgeBaseScope:
        workspace && firstKnowledgeBase
          ? buildKnowledgeBaseScope(workspace.slug, firstKnowledgeBase.slug)
          : ""
    }));
  }

  function handleKnowledgeBaseScopeChange(knowledgeBaseId: string) {
    if (!hasAgentWriteAccess) {
      return;
    }

    if (!selectedAgentScopeSelection.workspaceId) {
      return;
    }

    const workspace = workspaces.find((item) => item.id === selectedAgentScopeSelection.workspaceId) ?? null;
    const knowledgeBase = knowledgeBases.find((item) => item.id === knowledgeBaseId) ?? null;
    updateSelectedAgent((agent) => ({
      ...agent,
      knowledgeBaseScope:
        workspace && knowledgeBase ? buildKnowledgeBaseScope(workspace.slug, knowledgeBase.slug) : ""
    }));
  }

  function handleReadinessFilterChange(value: string) {
    const nextValue = value as AgentReadinessFilter;
    setReadinessFilter(nextValue);
    if (nextValue === "ready") {
      setIssueFilter("all");
    }
  }

  function handleIssueFilterChange(value: string) {
    const nextValue = value as AgentReadinessIssueFilter;
    setIssueFilter(nextValue);
    if (nextValue !== "all") {
      setReadinessFilter("attention");
    }
  }

  const showAdvancedAgentSections = false;
  const canOperateSelectedAgentRuntime = Boolean(
    hasAgentExecutionAccess &&
      selectedAgent &&
      selectedAgent.status === "active" &&
      selectedAgentReadiness?.isReady
  );

  return (
    <ConsoleShell activeHref="/agents">
      <PageTitleSync title={t("agents.title")} />
      <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-6">
        <ConsolePageHeader
          actions={
            <>
              <Select
                disabled={isLoading || tenants.length === 0 || isMutating}
                onValueChange={setSelectedTenantId}
                value={selectedTenantId}
              >
                <SelectTrigger className="min-w-[240px] rounded-xl border-slate-200 bg-white">
                  <SelectValue placeholder={t("agents.filters.tenantScope")} />
                </SelectTrigger>
                <SelectContent>
                  {tenants.map((tenant) => (
                    <SelectItem key={tenant.id} value={tenant.id}>
                      {tenant.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                className="rounded-xl border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                disabled={isLoading || !selectedTenantId || isMutating}
                onClick={() => void refreshAgentDefinitionsForSelectedTenant()}
                type="button"
                variant="outline"
              >
                <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
                {isLoading ? t("agents.actions.refreshing") : t("agents.actions.refresh")}
              </Button>
              <Button
                className="rounded-xl"
                disabled={!hasAgentWriteAccess || !selectedTenantId || isMutating}
                onClick={() => void handleCreateAgent()}
                type="button"
              >
                <Plus className="h-4 w-4" />
                {t("agents.actions.newDraft")}
              </Button>
              <Button
                className="rounded-xl"
                disabled={!hasAgentWriteAccess || !selectedAgent || isMutating}
                onClick={() => void handleDuplicateAgent()}
                type="button"
                variant="outline"
              >
                <Copy className="h-4 w-4" />
                {t("agents.actions.duplicate")}
              </Button>
              <Button
                className="rounded-xl"
                disabled={!hasAgentWriteAccess || !selectedAgent || isMutating}
                onClick={() => void handleSaveAgent()}
                type="button"
                variant="outline"
              >
                <Save className="h-4 w-4" />
                {t("agents.actions.saveDraft")}
              </Button>
              <Button
                className="rounded-xl"
                disabled={!hasAgentWriteAccess || !selectedAgent || selectedAgent.status === "active" || isMutating}
                onClick={() => void handleTransitionAgentStatus("active")}
                type="button"
                variant="outline"
              >
                <CheckCircle2 className="h-4 w-4" />
                {t("agents.actions.activate")}
              </Button>
              <Button
                className="rounded-xl"
                disabled={!hasAgentWriteAccess || !selectedAgent || selectedAgent.status !== "active" || isMutating}
                onClick={() => void handleTransitionAgentStatus("paused")}
                type="button"
                variant="outline"
              >
                <Waypoints className="h-4 w-4" />
                {t("agents.actions.pause")}
              </Button>
              <Button
                className="rounded-xl"
                disabled={!hasAgentWriteAccess || !selectedAgent || selectedAgent.status === "draft" || isMutating}
                onClick={() => void handleTransitionAgentStatus("draft")}
                type="button"
                variant="outline"
              >
                <ArrowRight className="h-4 w-4" />
                {t("agents.actions.moveToDraft")}
              </Button>
              <Button
                className="rounded-xl"
                disabled={!canOperateSelectedAgentRuntime || isExecutingAgent}
                onClick={() => void handleExecuteAgent()}
                type="button"
                variant="outline"
              >
                <BrainCircuit className="h-4 w-4" />
                {isExecutingAgent ? t("agents.actions.executing") : t("agents.actions.execute")}
              </Button>
              <Badge
                className={cn(
                  "border",
                  hasAgentWriteAccess
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-amber-200 bg-amber-50 text-amber-700"
                )}
                variant="outline"
              >
                {hasAgentWriteAccess ? t("agents.access.editable") : t("agents.access.readOnly")}
              </Badge>
            </>
          }
          description={t("agents.header.description")}
          eyebrow={t("agents.header.eyebrow")}
          icon={<Bot className="h-4 w-4" />}
          title={t("agents.header.title")}
        />

        <ConsoleStatusBar
          error={errorMessage}
          message={isLoading ? t("agents.status.loading") : statusMessage || t("agents.status.ready")}
          meta={selectedAgent ? t("agents.status.lastUpdated", { value: formatUpdatedAt(selectedAgent.updatedAt, language) }) : undefined}
        />

        {showAdvancedAgentSections ? (
          <ConsoleSurface>
            <ConsoleSurfaceHeader
              description={t("agents.architecture.description")}
              title={t("agents.architecture.title")}
            />
            <div className="grid gap-4 p-6 lg:grid-cols-4">
              {operatingLaneItems.map((item) => (
                <div className="rounded-[20px] border border-slate-100 bg-slate-50/80 p-5" key={item.key}>
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                    {t("agents.architecture.lane")}
                  </div>
                  <div className="mt-3 text-base font-semibold text-slate-950">{item.title}</div>
                  <div className="mt-2 text-sm font-medium text-blue-600">{item.value}</div>
                  <div className="mt-3 text-sm leading-6 text-slate-500">{item.description}</div>
                  <div className="mt-5">
                    <Button asChild className="bg-white" size="sm" type="button" variant="outline">
                      <Link href={item.href}>
                        {t("agents.architecture.openLane")}
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ConsoleSurface>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-4">
          <ConsoleSurface className="px-6 py-5">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{t("agents.metrics.totalDrafts")}</div>
            <div className="mt-3 text-[34px] font-semibold tracking-tight text-slate-950">{metrics.totalDrafts}</div>
          </ConsoleSurface>
          <ConsoleSurface className="px-6 py-5">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{t("agents.metrics.activeDrafts")}</div>
            <div className="mt-3 text-[34px] font-semibold tracking-tight text-slate-950">{metrics.activeDrafts}</div>
          </ConsoleSurface>
          <ConsoleSurface className="px-6 py-5">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{t("agents.metrics.toolEnabledDrafts")}</div>
            <div className="mt-3 text-[34px] font-semibold tracking-tight text-slate-950">{metrics.toolEnabledDrafts}</div>
          </ConsoleSurface>
          <ConsoleSurface className="px-6 py-5">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{t("agents.metrics.scopedDrafts")}</div>
            <div className="mt-3 text-[34px] font-semibold tracking-tight text-slate-950">{metrics.scopedDrafts}</div>
          </ConsoleSurface>
        </div>

        {showAdvancedAgentSections ? (
          <ConsoleSurface>
            <ConsoleSurfaceHeader
              action={<ConsoleOutlineBadge>{t("agents.directory.count", { count: String(modeMetrics.governanceAttentionDrafts) })}</ConsoleOutlineBadge>}
              description={t("agents.governance.description")}
              title={t("agents.governance.title")}
            />
            <div className="grid gap-4 p-6 md:grid-cols-2 xl:grid-cols-3">
              {governanceIssueCards.map((item) => (
                <div className="rounded-[20px] border border-slate-100 bg-slate-50/80 p-5" key={item.issue}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-950">{t(`agents.readiness.issueLabels.${item.issue}`)}</div>
                      <div className="mt-2 text-sm leading-6 text-slate-500">
                        {t("agents.governance.issueDescription", { count: String(item.count) })}
                      </div>
                    </div>
                    <Badge
                      className={cn(
                        "border",
                        item.count > 0
                          ? "border-amber-200 bg-amber-50 text-amber-700"
                          : "border-emerald-200 bg-emerald-50 text-emerald-700"
                      )}
                      variant="outline"
                    >
                      {item.count > 0 ? t("agents.readiness.attention") : t("agents.readiness.ready")}
                    </Badge>
                  </div>
                  <div className="mt-4 text-[28px] font-semibold tracking-tight text-slate-950">{item.count}</div>
                  <div className="mt-5">
                    <Button asChild className="bg-white" size="sm" type="button" variant="outline">
                      <Link href={item.href}>{t("agents.governance.filterIssue")}</Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ConsoleSurface>
        ) : null}

        {showAdvancedAgentSections ? (
          <ConsoleSurface>
            <ConsoleSurfaceHeader
              description={t("agents.executionPackets.description")}
              title={t("agents.executionPackets.title")}
            />
            <div className="grid gap-4 p-6 xl:grid-cols-2">
              {executionPackets.map((item) => (
                <ConsoleActionPacketCard
                  detail={item.detail}
                  key={item.title}
                  metricLabel={item.metricLabel}
                  metricValue={item.metricValue}
                  primaryActionHref={item.primaryActionHref}
                  primaryActionLabel={item.primaryActionLabel}
                  secondaryActions={item.secondaryActions}
                  status={item.status}
                  statusLabel={
                    item.status === "attention"
                      ? t("agents.executionPackets.statuses.attention")
                      : item.status === "review"
                        ? t("agents.executionPackets.statuses.review")
                        : t("agents.executionPackets.statuses.healthy")
                  }
                  title={item.title}
                />
              ))}
            </div>
          </ConsoleSurface>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
          <ConsoleSurface>
            <ConsoleSurfaceHeader
              action={<ConsoleOutlineBadge>{t("agents.directory.count", { count: String(scopedAgents.length) })}</ConsoleOutlineBadge>}
              description={t("agents.directory.description")}
              title={t("agents.directory.title")}
            />
            <div className="grid gap-3 border-b border-slate-100 px-4 py-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  className="pl-9"
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder={t("agents.filters.searchPlaceholder")}
                  value={searchQuery}
                />
              </div>
              <Select onValueChange={(value) => setStatusFilter(value as AgentStatusFilter)} value={statusFilter}>
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder={t("agents.filters.status")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("agents.filters.allStatuses")}</SelectItem>
                  <SelectItem value="draft">{t("agents.statuses.draft")}</SelectItem>
                  <SelectItem value="active">{t("agents.statuses.active")}</SelectItem>
                  <SelectItem value="paused">{t("agents.statuses.paused")}</SelectItem>
                </SelectContent>
              </Select>
              <Select onValueChange={(value) => setModeFilter(value as AgentModeFilter)} value={modeFilter}>
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder={t("agents.filters.mode")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("agents.filters.allModes")}</SelectItem>
                  <SelectItem value="grounded_chat">{t("agents.modes.grounded_chat")}</SelectItem>
                  <SelectItem value="document_intake">{t("agents.modes.document_intake")}</SelectItem>
                  <SelectItem value="workflow_recovery">{t("agents.modes.workflow_recovery")}</SelectItem>
                </SelectContent>
              </Select>
              {showAdvancedAgentSections ? (
                <>
                  <Select onValueChange={handleReadinessFilterChange} value={readinessFilter}>
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder={t("agents.filters.readiness")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("agents.filters.allReadiness")}</SelectItem>
                      <SelectItem value="ready">{t("agents.readiness.ready")}</SelectItem>
                      <SelectItem value="attention">{t("agents.readiness.attention")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select onValueChange={handleIssueFilterChange} value={issueFilter}>
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder={t("agents.filters.issue")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("agents.filters.allIssues")}</SelectItem>
                      <SelectItem value="scope_missing">{t("agents.readiness.issueLabels.scope_missing")}</SelectItem>
                      <SelectItem value="scope_invalid">{t("agents.readiness.issueLabels.scope_invalid")}</SelectItem>
                      <SelectItem value="model_missing">{t("agents.readiness.issueLabels.model_missing")}</SelectItem>
                      <SelectItem value="model_disabled">{t("agents.readiness.issueLabels.model_disabled")}</SelectItem>
                      <SelectItem value="retrieval_profile_missing">{t("agents.readiness.issueLabels.retrieval_profile_missing")}</SelectItem>
                      <SelectItem value="retrieval_profile_disabled">{t("agents.readiness.issueLabels.retrieval_profile_disabled")}</SelectItem>
                      <SelectItem value="tools_missing">{t("agents.readiness.issueLabels.tools_missing")}</SelectItem>
                      <SelectItem value="tool_registration_disabled">
                        {t("agents.readiness.issueLabels.tool_registration_disabled")}
                      </SelectItem>
                      <SelectItem value="tool_approval_required">
                        {t("agents.readiness.issueLabels.tool_approval_required")}
                      </SelectItem>
                      <SelectItem value="tool_mcp_reserved">
                        {t("agents.readiness.issueLabels.tool_mcp_reserved")}
                      </SelectItem>
                      <SelectItem value="tool_mcp_integration_pending">
                        {t("agents.readiness.issueLabels.tool_mcp_integration_pending")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <Select onValueChange={(value) => setModelEndpointFilterId(value === "all" ? "" : value)} value={modelEndpointFilterId || "all"}>
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder={t("agents.filters.modelEndpoint")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("agents.filters.allModelEndpoints")}</SelectItem>
                      {availableModelFilterEndpoints.map((modelEndpoint) => (
                        <SelectItem key={modelEndpoint.id} value={modelEndpoint.id}>
                          {modelEndpoint.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select onValueChange={(value) => setToolRegistrationFilterId(value === "all" ? "" : value)} value={toolRegistrationFilterId || "all"}>
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder={t("agents.filters.toolRegistration")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("agents.filters.allToolRegistrations")}</SelectItem>
                      {availableToolFilterRegistrations.map((toolRegistration) => (
                        <SelectItem key={toolRegistration.id} value={toolRegistration.id}>
                          {toolRegistration.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              ) : null}
            </div>
            <div className="space-y-3 p-4">
              {scopedAgents.length === 0 ? (
                <div className="rounded-[20px] border border-dashed border-slate-200 bg-slate-50/80 px-5 py-8 text-sm text-slate-500">
                  {t("agents.directory.empty")}
                </div>
              ) : (
                scopedAgents.map((agent) => {
                  const readiness = readinessByAgentId.get(agent.id);
                  const scopeSelection = resolveKnowledgeBaseScopeSelection(agent.knowledgeBaseScope, workspaces, knowledgeBases);
                  const scopedKnowledgeBase = scopeSelection.knowledgeBaseId
                    ? knowledgeBases.find((knowledgeBase) => knowledgeBase.id === scopeSelection.knowledgeBaseId) ?? null
                    : null;
                  const scopedRetrievalProfile = scopedKnowledgeBase?.retrieval_profile_id
                    ? retrievalProfileById.get(scopedKnowledgeBase.retrieval_profile_id) ?? null
                    : defaultRetrievalProfile;

                  return (
                    <button
                      className={cn(
                        "w-full rounded-[20px] border px-4 py-4 text-left transition",
                        selectedAgentId === agent.id
                          ? "border-blue-200 bg-blue-50/70 shadow-sm"
                          : "border-slate-100 bg-slate-50/70 hover:border-slate-200 hover:bg-white"
                      )}
                      key={agent.id}
                      onClick={() => setSelectedAgentId(agent.id)}
                      type="button"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-base font-semibold text-slate-950">{agent.name}</div>
                          <div className="mt-1 truncate text-xs text-slate-400">{agent.slug}</div>
                        </div>
                        <Badge className={cn("border", getAgentStatusClass(agent.status))} variant="outline">
                          {t(`agents.statuses.${agent.status}`)}
                        </Badge>
                      </div>
                      <div className="mt-3 text-sm leading-6 text-slate-500">{agent.objective || t("agents.directory.noObjective")}</div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <ConsoleOutlineBadge>{t(`agents.modes.${agent.mode}`)}</ConsoleOutlineBadge>
                        <ConsoleOutlineBadge>
                          {t("agents.directory.toolCount", { count: String(countConnectedCapabilities(agent)) })}
                        </ConsoleOutlineBadge>
                        {agent.modelEndpointId ? (
                          <ConsoleOutlineBadge>{t("agents.editor.runtimeModelBound")}</ConsoleOutlineBadge>
                        ) : null}
                        <ConsoleOutlineBadge>
                          {agent.knowledgeBaseScope.trim().length > 0
                            ? agent.knowledgeBaseScope
                            : t("agents.metrics.noScope")}
                        </ConsoleOutlineBadge>
                        {showAdvancedAgentSections && scopedRetrievalProfile ? (
                          <ConsoleOutlineBadge>
                            {t("home.retrievalInspector.retrievalProfile", { value: scopedRetrievalProfile.name })}
                          </ConsoleOutlineBadge>
                        ) : null}
                        {showAdvancedAgentSections ? (
                          <>
                            <Badge
                              className={cn(
                                "border",
                                readiness?.isReady
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                  : "border-amber-200 bg-amber-50 text-amber-700"
                              )}
                              variant="outline"
                            >
                              {readiness?.isReady ? t("agents.readiness.ready") : t("agents.readiness.attention")}
                            </Badge>
                            {readiness?.issues.slice(0, 2).map((issue) => (
                              <ConsoleOutlineBadge className="border-amber-200 bg-amber-50 text-amber-800" key={issue}>
                                {t(`agents.readiness.issueLabels.${issue}`)}
                              </ConsoleOutlineBadge>
                            ))}
                          </>
                        ) : null}
                      </div>
                      <div className="mt-4 text-xs text-slate-400">
                        {t("agents.directory.lastUpdated", { value: formatUpdatedAt(agent.updatedAt, language) })}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </ConsoleSurface>

          <ConsoleSurface>
            <ConsoleSurfaceHeader
              action={
                <Button
                  className="rounded-xl text-rose-600 hover:text-rose-700"
                  disabled={!hasAgentWriteAccess || !selectedAgent || isMutating}
                  onClick={() => void handleDeleteAgent()}
                  type="button"
                  variant="ghost"
                >
                  <Trash2 className="h-4 w-4" />
                  {t("agents.actions.delete")}
                </Button>
              }
              description={t("agents.editor.description")}
              title={t("agents.editor.title")}
            />
            {selectedAgent ? (
              <div className="grid gap-5 p-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{t("agents.editor.name")}</div>
                    <Input
                      disabled={!hasAgentWriteAccess}
                      onChange={(event) => {
                        const nextName = event.target.value;
                        updateSelectedAgent((agent) => ({
                          ...agent,
                          name: nextName,
                          slug: agent.slug.trim().length === 0 ? slugifyValue(nextName) : agent.slug
                        }));
                      }}
                      placeholder={t("agents.editor.namePlaceholder")}
                      value={selectedAgent.name}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{t("agents.editor.slug")}</div>
                    <Input
                      disabled={!hasAgentWriteAccess}
                      onChange={(event) => {
                        const nextSlug = slugifyValue(event.target.value);
                        updateSelectedAgent((agent) => ({
                          ...agent,
                          slug: nextSlug
                        }));
                      }}
                      placeholder={t("agents.editor.slugPlaceholder")}
                      value={selectedAgent.slug}
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-4">
                  <div className="space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{t("agents.editor.mode")}</div>
                    <Select
                      disabled={!hasAgentWriteAccess}
                      onValueChange={(value) => {
                        updateSelectedAgent((agent) => ({
                          ...agent,
                          mode: value as AgentMode
                        }));
                      }}
                      value={selectedAgent.mode}
                    >
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder={t("agents.editor.mode")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="grounded_chat">{t("agents.modes.grounded_chat")}</SelectItem>
                        <SelectItem value="document_intake">{t("agents.modes.document_intake")}</SelectItem>
                        <SelectItem value="workflow_recovery">{t("agents.modes.workflow_recovery")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{t("agents.editor.status")}</div>
                    <Select
                      disabled={!hasAgentWriteAccess}
                      onValueChange={(value) => {
                        updateSelectedAgent((agent) => ({
                          ...agent,
                          status: value as AgentStatus
                        }));
                      }}
                      value={selectedAgent.status}
                    >
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder={t("agents.editor.status")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">{t("agents.statuses.draft")}</SelectItem>
                        <SelectItem value="active">{t("agents.statuses.active")}</SelectItem>
                        <SelectItem value="paused">{t("agents.statuses.paused")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{t("agents.editor.modelStrategy")}</div>
                    <Select
                      disabled={!hasAgentWriteAccess}
                      onValueChange={(value) => {
                        updateSelectedAgent((agent) => ({
                          ...agent,
                          modelStrategy: value as ModelStrategy
                        }));
                      }}
                      value={selectedAgent.modelStrategy}
                    >
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder={t("agents.editor.modelStrategy")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="local_reserved">{t("agents.modelStrategies.local_reserved")}</SelectItem>
                        <SelectItem value="remote_reserved">{t("agents.modelStrategies.remote_reserved")}</SelectItem>
                        <SelectItem value="hybrid_reserved">{t("agents.modelStrategies.hybrid_reserved")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      {t("agents.editor.runtimeModel")}
                    </div>
                    <Select
                      disabled={!hasAgentWriteAccess}
                      onValueChange={(value) => {
                        updateSelectedAgent((agent) => ({
                          ...agent,
                          modelEndpointId: value === "inherit_strategy" ? "" : value
                        }));
                      }}
                      value={selectedAgent.modelEndpointId || "inherit_strategy"}
                    >
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder={t("agents.editor.runtimeModel")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="inherit_strategy">{t("agents.editor.runtimeModelInherited")}</SelectItem>
                        {availableModelEndpoints.map((modelEndpoint) => (
                          <SelectItem key={modelEndpoint.id} value={modelEndpoint.id}>
                            {modelEndpoint.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{t("agents.editor.workspaceScope")}</div>
                    <Select
                      disabled={!hasAgentWriteAccess}
                      onValueChange={handleWorkspaceScopeChange}
                      value={selectedAgentScopeSelection.workspaceId || "unscoped"}
                    >
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder={t("agents.editor.workspaceScope")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unscoped">{t("agents.editor.unscoped")}</SelectItem>
                        {workspaces.map((workspace) => (
                          <SelectItem key={workspace.id} value={workspace.id}>
                            {workspace.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{t("agents.editor.knowledgeBaseScope")}</div>
                    <Select
                      disabled={!hasAgentWriteAccess || !selectedAgentScopeSelection.workspaceId || selectedAgentScopeKnowledgeBases.length === 0}
                      onValueChange={handleKnowledgeBaseScopeChange}
                      value={selectedAgentScopeSelection.knowledgeBaseId || undefined}
                    >
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder={t("agents.editor.scopePlaceholder")} />
                      </SelectTrigger>
                      <SelectContent>
                        {selectedAgentScopeKnowledgeBases.map((knowledgeBase) => (
                          <SelectItem key={knowledgeBase.id} value={knowledgeBase.id}>
                            {knowledgeBase.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{t("agents.editor.scopePreview")}</div>
                    <Input readOnly value={selectedAgent.knowledgeBaseScope || t("agents.editor.unscoped")} />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{t("agents.editor.objective")}</div>
                  <Textarea
                    disabled={!hasAgentWriteAccess}
                    className="min-h-[96px] resize-y"
                    onChange={(event) => {
                      updateSelectedAgent((agent) => ({
                        ...agent,
                        objective: event.target.value
                      }));
                    }}
                    placeholder={t("agents.editor.objectivePlaceholder")}
                    value={selectedAgent.objective}
                  />
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{t("agents.editor.instructions")}</div>
                  <Textarea
                    disabled={!hasAgentWriteAccess}
                    className="min-h-[160px] resize-y"
                    onChange={(event) => {
                      updateSelectedAgent((agent) => ({
                        ...agent,
                        instructions: event.target.value
                      }));
                    }}
                    placeholder={t("agents.editor.instructionsPlaceholder")}
                    value={selectedAgent.instructions}
                  />
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{t("agents.editor.tools")}</div>
                    <div className="mt-1 text-sm text-slate-500">{t("agents.editor.toolHint")}</div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {toolDefinitions.map((item) => {
                      const Icon = item.icon;
                      const isEnabled = selectedAgent.tools.includes(item.tool);

                      return (
                        <button
                          className={cn(
                            "flex items-start gap-3 rounded-[18px] border px-4 py-4 text-left transition",
                            isEnabled
                              ? "border-blue-200 bg-blue-50/70"
                              : "border-slate-200 bg-white hover:border-slate-300"
                          )}
                          disabled={!hasAgentWriteAccess}
                          key={item.tool}
                          onClick={() => toggleTool(item.tool)}
                          type="button"
                        >
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-slate-700 shadow-sm">
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <div className="text-sm font-semibold text-slate-950">{item.label}</div>
                              <Badge className={cn("border", isEnabled ? "border-blue-200 bg-white text-blue-700" : "border-slate-200 bg-slate-50 text-slate-600")} variant="outline">
                                {isEnabled ? t("agents.connectivity.enabled") : t("agents.connectivity.disabled")}
                              </Badge>
                            </div>
                            <div className="mt-1 text-sm leading-6 text-slate-500">{item.description}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      {t("agents.editor.registeredTools")}
                    </div>
                    <div className="mt-1 text-sm text-slate-500">{t("agents.editor.registeredToolsHint")}</div>
                  </div>
                  {availableToolRegistrations.length === 0 ? (
                    <div className="rounded-[18px] border border-dashed border-slate-200 bg-slate-50/80 px-4 py-5 text-sm text-slate-500">
                      {t("agents.editor.noRegisteredTools")}
                    </div>
                  ) : (
                    <div className="grid gap-3 md:grid-cols-2">
                      {availableToolRegistrations.map((toolRegistration) => {
                        const isBound = selectedAgent.toolRegistrationIds.includes(toolRegistration.id);

                        return (
                          <button
                            className={cn(
                              "flex items-start gap-3 rounded-[18px] border px-4 py-4 text-left transition",
                              isBound
                                ? "border-emerald-200 bg-emerald-50/70"
                                : "border-slate-200 bg-white hover:border-slate-300"
                            )}
                            disabled={!hasAgentWriteAccess}
                            key={toolRegistration.id}
                            onClick={() => toggleRegisteredTool(toolRegistration.id)}
                            type="button"
                          >
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-slate-700 shadow-sm">
                              <Bot className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="text-sm font-semibold text-slate-950">{toolRegistration.name}</div>
                                <Badge
                                  className={cn(
                                    "border",
                                    isBound
                                      ? "border-emerald-200 bg-white text-emerald-700"
                                      : "border-slate-200 bg-slate-50 text-slate-600"
                                  )}
                                  variant="outline"
                                >
                                  {isBound ? t("agents.connectivity.enabled") : t("agents.connectivity.disabled")}
                                </Badge>
                                <Badge className="border-slate-200 bg-white text-slate-600" variant="outline">
                                  {t(`settings.tools.surfaces.${toolRegistration.surface_area}`)}
                                </Badge>
                              </div>
                              <div className="mt-1 text-sm leading-6 text-slate-500">
                                {toolRegistration.description || t("settings.governance.empty")}
                              </div>
                              <div className="mt-2 flex flex-wrap gap-2">
                                <ConsoleOutlineBadge>{toolRegistration.transport_type}</ConsoleOutlineBadge>
                                {toolRegistration.requires_admin_approval ? (
                                  <ConsoleOutlineBadge>{t("settings.tools.adminApproval")}</ConsoleOutlineBadge>
                                ) : null}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="px-6 py-10 text-sm text-slate-500">{t("agents.editor.empty")}</div>
            )}
          </ConsoleSurface>
        </div>

        <ConsoleSurface>
          <ConsoleSurfaceHeader
            description={t("agents.delivery.description")}
            title={t("agents.delivery.title")}
          />
          <div className="grid gap-4 p-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
            <div className="space-y-4">
              <div className="rounded-[20px] border border-slate-100 bg-white p-5">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  {t("agents.delivery.selectedAgentTitle")}
                </div>
                <div className="mt-3 text-base font-semibold text-slate-950">
                  {selectedAgent?.name ?? t("agents.delivery.selectAgent")}
                </div>
                <div className="mt-2 text-sm leading-6 text-slate-500">
                  {selectedAgent
                    ? t("agents.delivery.selectedAgentDescription", {
                        mode: t(`agents.modes.${selectedAgent.mode}`),
                        status: t(`agents.statuses.${selectedAgent.status}`)
                      })
                    : t("agents.delivery.selectAgent")}
                </div>
                {selectedAgent ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <ConsoleOutlineBadge>{selectedAgent.slug}</ConsoleOutlineBadge>
                    <ConsoleOutlineBadge>
                      {selectedScopeWorkspace?.name ?? t("agents.executionPackets.scopePending")}
                    </ConsoleOutlineBadge>
                    <ConsoleOutlineBadge>
                      {selectedScopeKnowledgeBase?.name ?? t("agents.executionPackets.scopePending")}
                    </ConsoleOutlineBadge>
                    {selectedScopeRetrievalProfile ? (
                      <ConsoleOutlineBadge>
                        {t("home.retrievalInspector.retrievalProfile", { value: selectedScopeRetrievalProfile.name })}
                      </ConsoleOutlineBadge>
                    ) : null}
                    <ConsoleOutlineBadge>
                      {selectedAgentReadiness?.resolvedModelEndpoint?.name ?? t("agents.executionPackets.modelInherited")}
                    </ConsoleOutlineBadge>
                    {selectedAgentReadiness?.resolvedModelEndpoint?.provider_type ? (
                      <ConsoleOutlineBadge>
                        {t(`settings.models.providers.${selectedAgentReadiness.resolvedModelEndpoint.provider_type}`)}
                      </ConsoleOutlineBadge>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="space-y-4">
                <ConsoleRuntimeTaskPacket
                  detail={runtimeTaskPacket.detail}
                  objective={runtimeTaskPacket.objective}
                  objectiveLabel={t("agents.delivery.runtimeTaskFields.objective")}
                  primaryActionHref={runtimeTaskPacket.primaryActionHref}
                  primaryActionLabel={t("agents.delivery.runtimeTaskOpenPrimary")}
                  prompt={runtimeTaskPacket.prompt}
                  promptLabel={t("agents.delivery.runtimeTaskFields.prompt")}
                  secondaryActions={runtimeTaskPacket.secondaryActions}
                  statusLabel={runtimeTaskPacket.statusLabel}
                  statusTone={runtimeTaskPacket.statusTone}
                  summaryItems={runtimeTaskPacket.summaryItems}
                  title={runtimeTaskPacket.title}
                />
                <div className="space-y-2">
                  {launchChecklistItems.map((item, index) => (
                    <div key={`${index}-${item}`} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                      {item}
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {launchSurfaceCards.map((card) => (
                  <div className="rounded-[20px] border border-slate-100 bg-white p-5" key={card.key}>
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{card.title}</div>
                    <div className="mt-3 text-sm leading-6 text-slate-600">{card.description}</div>
                    <div className="mt-4">
                      <Button
                        className="w-full justify-center rounded-xl bg-white"
                        disabled={!canOperateSelectedAgentRuntime || launchingSurface !== null}
                        onClick={() =>
                          void handleLaunchSurface(
                            card.key.includes("operations")
                              ? "operations"
                              : card.key.includes("documents")
                                ? "documents"
                                : "chat",
                            card.key === "primary-chat" || card.key === "chat-briefing"
                              ? { draftQuestion: launchPrompts[0] ?? null }
                              : card.key === "primary-operations"
                                ? { workflowStatus: "failed", workflowRetryMode: "all" }
                                : card.key === "documents-failed"
                                  ? { documentStatus: "failed" }
                                  : card.key === "operations-failures"
                                    ? { workflowStatus: "failed" }
                                    : undefined
                          )
                        }
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        {card.actionLabel}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-[20px] border border-slate-100 bg-slate-50/80 p-5">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  {t("agents.delivery.launchPrompts")}
                </div>
                <div className="mt-3 text-sm leading-6 text-slate-500">
                  {t("agents.delivery.launchPromptsDescription")}
                </div>
                <div className="mt-4 space-y-3">
                  {launchPrompts.map((prompt, index) => (
                    <div className="rounded-xl border border-slate-200 bg-white p-4" key={`${index}-${prompt}`}>
                      <div className="text-sm leading-7 text-slate-700">{prompt}</div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button
                          className="rounded-xl bg-white"
                          disabled={!canOperateSelectedAgentRuntime || launchingSurface !== null}
                          onClick={() => void handleLaunchSurface("chat", { draftQuestion: prompt })}
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          {t("agents.delivery.openInChat")}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Button
                  className="justify-start rounded-xl bg-white"
                  disabled={!canOperateSelectedAgentRuntime || launchingSurface !== null}
                  onClick={() => void handleLaunchSurface("chat")}
                  type="button"
                  variant="outline"
                >
                  {launchingSurface === "chat" ? t("agents.actions.launching") : t("agents.actions.openChat")}
                </Button>
                <Button
                  className="justify-start rounded-xl bg-white"
                  disabled={!canOperateSelectedAgentRuntime || launchingSurface !== null}
                  onClick={() => void handleLaunchSurface("documents")}
                  type="button"
                  variant="outline"
                >
                  {launchingSurface === "documents" ? t("agents.actions.launching") : t("agents.actions.openDocuments")}
                </Button>
                <Button
                  className="justify-start rounded-xl bg-white"
                  disabled={!canOperateSelectedAgentRuntime || launchingSurface !== null}
                  onClick={() => void handleLaunchSurface("operations")}
                  type="button"
                  variant="outline"
                >
                  {launchingSurface === "operations" ? t("agents.actions.launching") : t("agents.actions.openOperations")}
                </Button>
                <Button
                  className="justify-start rounded-xl bg-white"
                  disabled={!canOperateSelectedAgentRuntime || launchingSurface !== null}
                  onClick={() => void handleLaunchSurface("admin")}
                  type="button"
                  variant="outline"
                >
                  {launchingSurface === "admin" ? t("agents.actions.launching") : t("agents.actions.openAdmin")}
                </Button>
              </div>
            </div>
          </div>
        </ConsoleSurface>

        <ConsoleSurface>
          <ConsoleSurfaceHeader
            action={
              <ConsoleOutlineBadge>
                {t("agents.executions.count", { count: String(agentExecutionMetrics?.total_executions ?? 0) })}
              </ConsoleOutlineBadge>
            }
            description={t("agents.executions.description")}
            title={t("agents.executions.title")}
          />
          <div className="grid gap-4 p-6">
            <div className="grid gap-4 xl:grid-cols-5">
              <div className="rounded-[20px] border border-slate-100 bg-slate-50/80 p-5">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  {t("agents.executions.metrics.total")}
                </div>
                <div className="mt-3 text-[28px] font-semibold tracking-tight text-slate-950">
                  {agentExecutionMetrics?.total_executions ?? 0}
                </div>
              </div>
              <div className="rounded-[20px] border border-slate-100 bg-slate-50/80 p-5">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  {t("agents.executions.metrics.queued")}
                </div>
                <div className="mt-3 text-[28px] font-semibold tracking-tight text-slate-950">
                  {agentExecutionMetrics?.queued_executions ?? 0}
                </div>
              </div>
              <div className="rounded-[20px] border border-slate-100 bg-slate-50/80 p-5">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  {t("agents.executions.metrics.running")}
                </div>
                <div className="mt-3 text-[28px] font-semibold tracking-tight text-slate-950">
                  {agentExecutionMetrics?.running_executions ?? 0}
                </div>
              </div>
              <div className="rounded-[20px] border border-slate-100 bg-slate-50/80 p-5">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  {t("agents.executions.metrics.completed")}
                </div>
                <div className="mt-3 text-[28px] font-semibold tracking-tight text-slate-950">
                  {agentExecutionMetrics?.completed_executions ?? 0}
                </div>
              </div>
              <div className="rounded-[20px] border border-slate-100 bg-slate-50/80 p-5">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  {t("agents.executions.metrics.failed")}
                </div>
                <div className="mt-3 text-[28px] font-semibold tracking-tight text-slate-950">
                  {agentExecutionMetrics?.failed_executions ?? 0}
                </div>
              </div>
            </div>

            <div className="rounded-[20px] border border-slate-100 bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-950">{t("agents.executions.latestTitle")}</div>
                  <div className="mt-1 text-sm text-slate-500">
                    {agentExecutionMetrics?.latest_execution_at
                      ? t("agents.executions.latestTimestamp", {
                          value: formatUpdatedAt(agentExecutionMetrics.latest_execution_at, language)
                        })
                      : t("agents.executions.noLatest")}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Select
                    onValueChange={(value) => setExecutionStatusFilter(value as AgentExecutionStatusFilter)}
                    value={executionStatusFilter}
                  >
                    <SelectTrigger className="min-w-[220px] bg-white">
                      <SelectValue placeholder={t("agents.executions.filters.status")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("agents.executions.filters.allStatuses")}</SelectItem>
                      <SelectItem value="queued">{t("agents.executions.statuses.queued")}</SelectItem>
                      <SelectItem value="running">{t("agents.executions.statuses.running")}</SelectItem>
                      <SelectItem value="completed">{t("agents.executions.statuses.completed")}</SelectItem>
                      <SelectItem value="failed">{t("agents.executions.statuses.failed")}</SelectItem>
                      <SelectItem value="cancelled">{t("agents.executions.statuses.cancelled")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    className="rounded-xl bg-white"
                    disabled={isLoadingAgentExecutions || !selectedTenantId}
                    onClick={() => void refreshAgentExecutionsForCurrentScope()}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <RefreshCw className={cn("h-4 w-4", isLoadingAgentExecutions && "animate-spin")} />
                    {isLoadingAgentExecutions ? t("agents.actions.refreshing") : t("agents.executions.refresh")}
                  </Button>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {agentExecutions.length === 0 ? (
                  <div className="rounded-[18px] border border-dashed border-slate-200 bg-slate-50/80 px-4 py-6 text-sm text-slate-500">
                    {t("agents.executions.empty")}
                  </div>
                ) : (
                  agentExecutions.map((agentExecution) => {
                    const evidenceSummary = readAgentExecutionEvidenceSummary(agentExecution.result_payload_json);
                    const runtimeBindingSummary = readAgentExecutionRuntimeBindingSummary(agentExecution.result_payload_json);
                    const runtimeSummary = readAgentExecutionRuntimeSummary(agentExecution.result_payload_json);
                    const recommendedActionSpecs = evidenceSummary?.recommendedActionSpecs ?? [];
                    const recommendedActions =
                      recommendedActionSpecs.length === 0 ? evidenceSummary?.recommendedActions.slice(0, 3) ?? [] : [];
                    const toolRuntime = readToolRuntimeSummary(agentExecution.result_payload_json);
                    const retrievalSummary = readAgentExecutionRetrievalSummary(agentExecution.result_payload_json);
                    const followUpActions = buildAgentExecutionFollowUpActions({
                      sourceContext: { surface: "agents" },
                      execution: agentExecution,
                      executionInput: evidenceSummary?.executionInput,
                      recommendedActions: recommendedActionSpecs
                    });

                    return (
                      <div className="rounded-[18px] border border-slate-200 bg-slate-50/70 px-4 py-4" key={agentExecution.id}>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-slate-950">
                              {selectedAgent?.name ?? t("agents.executions.unknownAgent")}
                            </div>
                            <div className="mt-1 text-sm leading-6 text-slate-500">
                              {agentExecution.summary || agentExecution.error_message || t("agents.executions.pendingSummary")}
                            </div>
                          </div>
                          <Badge className={cn("border", getAgentExecutionStatusClass(agentExecution.execution_status))} variant="outline">
                            {t(`agents.executions.statuses.${agentExecution.execution_status}`)}
                          </Badge>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <ConsoleOutlineBadge>{t(`agents.modes.${agentExecution.execution_mode}`)}</ConsoleOutlineBadge>
                          <ConsoleOutlineBadge>{formatAgentRunTriggerSourceLabel(agentExecution.trigger_source, t)}</ConsoleOutlineBadge>
                          {retrievalSummary?.retrievalEngine ? (
                            <ConsoleOutlineBadge>
                              {t("home.retrievalInspector.engineLabel", { value: retrievalSummary.retrievalEngine })}
                            </ConsoleOutlineBadge>
                          ) : null}
                          {retrievalSummary?.retrievalProfileName ? (
                            <ConsoleOutlineBadge>
                              {t("home.retrievalInspector.retrievalProfile", { value: retrievalSummary.retrievalProfileName })}
                            </ConsoleOutlineBadge>
                          ) : null}
                          {retrievalSummary?.retrievalMode ? (
                            <ConsoleOutlineBadge>
                              {t("home.retrievalInspector.retrievalMode", {
                                value: t(`settings.retrievalProfiles.modes.${retrievalSummary.retrievalMode}`)
                              })}
                            </ConsoleOutlineBadge>
                          ) : null}
                          {retrievalSummary && retrievalSummary.effectiveTopK !== null ? (
                            <ConsoleOutlineBadge>
                              {t("home.retrievalInspector.effectiveTopK", {
                                value: String(retrievalSummary.effectiveTopK)
                              })}
                            </ConsoleOutlineBadge>
                          ) : null}
                          {runtimeSummary?.agentRuntimeEngine ? (
                            <ConsoleOutlineBadge>
                              {t("agents.executions.runtimeEngine", { value: runtimeSummary.agentRuntimeEngine })}
                            </ConsoleOutlineBadge>
                          ) : null}
                          {runtimeSummary?.configuredAgentRuntimeEngine &&
                          runtimeSummary.configuredAgentRuntimeEngine !== runtimeSummary.agentRuntimeEngine ? (
                            <ConsoleOutlineBadge>
                              {t("agents.executions.configuredRuntimeEngine", {
                                value: runtimeSummary.configuredAgentRuntimeEngine
                              })}
                            </ConsoleOutlineBadge>
                          ) : null}
                          {runtimeSummary?.fallbackApplied ? (
                            <ConsoleOutlineBadge>{t("agents.executions.runtimeFallback")}</ConsoleOutlineBadge>
                          ) : null}
                          {runtimeSummary?.graphWorkflow ? (
                            <ConsoleOutlineBadge>
                              {t("agents.executions.runtimeWorkflow", { value: runtimeSummary.graphWorkflow })}
                            </ConsoleOutlineBadge>
                          ) : null}
                          {runtimeSummary && runtimeSummary.graphTraceCount > 0 ? (
                            <ConsoleOutlineBadge>{`graph ${runtimeSummary.graphTraceCount}`}</ConsoleOutlineBadge>
                          ) : null}
                          <ConsoleOutlineBadge>{formatUpdatedAt(agentExecution.updated_at, language)}</ConsoleOutlineBadge>
                        </div>
                        {runtimeBindingSummary ? <RuntimeBindingSummaryCard summary={runtimeBindingSummary} /> : null}
                        {runtimeSummary?.fallbackReason ? (
                          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
                            {runtimeSummary.configuredModelEndpointName ? (
                              <div className="mb-2 font-medium">
                                {t("agents.executions.configuredRuntimeModel", {
                                  value: runtimeSummary.configuredModelEndpointName
                                })}
                              </div>
                            ) : null}
                            {runtimeSummary.fallbackReason}
                          </div>
                        ) : null}
                        {evidenceSummary?.executionInput ? (
                          <div className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                              {t("agents.executions.executionInput")}
                            </div>
                            <div className="mt-2 text-sm leading-6 text-slate-700">{evidenceSummary.executionInput}</div>
                          </div>
                        ) : null}
                        {evidenceSummary?.answerPreview ? (
                          <div className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                                {t("agents.executions.answerPreview")}
                              </div>
                              {evidenceSummary.retrievalResultCount !== null ? (
                                <ConsoleOutlineBadge>
                                  {t("agents.executions.retrievalResults", { count: String(evidenceSummary.retrievalResultCount) })}
                                </ConsoleOutlineBadge>
                              ) : null}
                            </div>
                            <div className="mt-2 text-sm leading-6 text-slate-700">{evidenceSummary.answerPreview}</div>
                          </div>
                        ) : null}
                        {evidenceSummary && evidenceSummary.retrievalSources.length > 0 ? (
                          <div className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                              {t("agents.executions.evidenceSources")}
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {evidenceSummary.retrievalMethodBreakdown.map((entry) => (
                                <ConsoleOutlineBadge key={`${agentExecution.id}-${entry.method}`}>
                                  {t(`settings.retrievalProfiles.modes.${entry.method}`)} x{entry.count}
                                </ConsoleOutlineBadge>
                              ))}
                            </div>
                            <div className="mt-3 space-y-2">
                              {evidenceSummary.retrievalSources.map((source, index) => (
                                <div className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-3" key={`${agentExecution.id}-${source.documentChunkId ?? index}`}>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <div className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">
                                      {source.documentTitle ?? t("agents.executions.unknownSourceDocument")}
                                    </div>
                                    {source.retrievalMethod ? (
                                      <Badge className={cn("border", getRetrievalMethodBadgeClassName(source.retrievalMethod))} variant="outline">
                                        {t(`settings.retrievalProfiles.modes.${source.retrievalMethod}`)}
                                      </Badge>
                                    ) : null}
                                  </div>
                                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                                    {source.chunkIndex !== null ? (
                                      <span>{t("agents.executions.chunkIndex", { value: String(source.chunkIndex) })}</span>
                                    ) : null}
                                    {typeof source.score === "number" ? (
                                      <span>{t("agents.executions.score", { value: source.score.toFixed(3) })}</span>
                                    ) : null}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        {runtimeSummary && runtimeSummary.graphTrace.length > 0 ? (
                          <div className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                              {t("agents.executions.runtimeTrace")}
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {runtimeSummary.graphTrace.map((entry, index) => (
                                <ConsoleOutlineBadge key={`${agentExecution.id}-graph-${entry.step}-${index}`}>
                                  {`${entry.step} · ${entry.status}`}
                                </ConsoleOutlineBadge>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        {followUpActions.length > 0 ? (
                          <div className="mt-4">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                              {t("agents.executions.followUpTitle")}
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {followUpActions.map((action) => (
                                <Button
                                  asChild
                                  className={action.variant === "default" ? undefined : "bg-white"}
                                  key={`${agentExecution.id}-${action.id}`}
                                  size="sm"
                                  type="button"
                                  variant={action.variant}
                                >
                                  <Link href={action.href}>{action.labelKey ? t(action.labelKey) : action.label}</Link>
                                </Button>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        {recommendedActions.length > 0 ? (
                          <div className="mt-4 flex flex-wrap gap-2">
                            {recommendedActions.map((action) => (
                              <ConsoleOutlineBadge key={action}>{action}</ConsoleOutlineBadge>
                            ))}
                          </div>
                        ) : null}
                        {toolRuntime ? (
                          <ToolRuntimeSummaryCard
                            maxTraces={3}
                            renderTraceActions={(trace) => renderExecutionToolTraceActions(agentExecution, trace)}
                            summary={toolRuntime}
                          />
                        ) : null}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </ConsoleSurface>

        <ConsoleSurface>
          <ConsoleSurfaceHeader
            action={
              <ConsoleOutlineBadge>
                {t("agents.runs.count", { count: String(agentRunMetrics?.total_runs ?? 0) })}
              </ConsoleOutlineBadge>
            }
            description={t("agents.runs.description")}
            title={t("agents.runs.title")}
          />
          <div className="grid gap-4 p-6">
            <div className="grid gap-4 xl:grid-cols-5">
              <div className="rounded-[20px] border border-slate-100 bg-slate-50/80 p-5">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  {t("agents.runs.metrics.total")}
                </div>
                <div className="mt-3 text-[28px] font-semibold tracking-tight text-slate-950">
                  {agentRunMetrics?.total_runs ?? 0}
                </div>
              </div>
              <div className="rounded-[20px] border border-slate-100 bg-slate-50/80 p-5">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  {t("agents.runs.metrics.chat")}
                </div>
                <div className="mt-3 text-[28px] font-semibold tracking-tight text-slate-950">
                  {agentRunMetrics?.chat_runs ?? 0}
                </div>
              </div>
              <div className="rounded-[20px] border border-slate-100 bg-slate-50/80 p-5">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  {t("agents.runs.metrics.documents")}
                </div>
                <div className="mt-3 text-[28px] font-semibold tracking-tight text-slate-950">
                  {agentRunMetrics?.document_runs ?? 0}
                </div>
              </div>
              <div className="rounded-[20px] border border-slate-100 bg-slate-50/80 p-5">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  {t("agents.runs.metrics.operations")}
                </div>
                <div className="mt-3 text-[28px] font-semibold tracking-tight text-slate-950">
                  {agentRunMetrics?.operations_runs ?? 0}
                </div>
              </div>
              <div className="rounded-[20px] border border-slate-100 bg-slate-50/80 p-5">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  {t("agents.runs.metrics.admin")}
                </div>
                <div className="mt-3 text-[28px] font-semibold tracking-tight text-slate-950">
                  {agentRunMetrics?.admin_runs ?? 0}
                </div>
              </div>
            </div>

            <div className="rounded-[20px] border border-slate-100 bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-950">{t("agents.runs.latestTitle")}</div>
                  <div className="mt-1 text-sm text-slate-500">
                    {agentRunMetrics?.latest_launched_at
                      ? t("agents.runs.latestTimestamp", {
                          value: formatUpdatedAt(agentRunMetrics.latest_launched_at, language)
                        })
                      : t("agents.runs.noLatest")}
                  </div>
                </div>
                <Button
                  className="rounded-xl bg-white"
                  disabled={isLoadingAgentRuns || !selectedTenantId}
                  onClick={() => void refreshAgentRunsForCurrentScope()}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <RefreshCw className={cn("h-4 w-4", isLoadingAgentRuns && "animate-spin")} />
                  {isLoadingAgentRuns ? t("agents.actions.refreshing") : t("agents.runs.refresh")}
                </Button>
              </div>

              <div className="mt-5 grid gap-3 lg:grid-cols-3">
                <Select onValueChange={(value) => setRunTargetSurfaceFilter(value as AgentRunSurfaceFilter)} value={runTargetSurfaceFilter}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder={t("agents.runs.filters.surface")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("agents.runs.filters.allSurfaces")}</SelectItem>
                    <SelectItem value="chat">{t("agents.tools.chat")}</SelectItem>
                    <SelectItem value="documents">{t("agents.tools.documents")}</SelectItem>
                    <SelectItem value="operations">{t("agents.tools.operations")}</SelectItem>
                    <SelectItem value="admin">{t("agents.tools.admin")}</SelectItem>
                  </SelectContent>
                </Select>
                <Select onValueChange={(value) => setRunTriggerSourceFilter(value as AgentRunTriggerSourceFilter)} value={runTriggerSourceFilter}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder={t("agents.runs.filters.source")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("agents.runs.filters.allSources")}</SelectItem>
                    <SelectItem value="agents_console">{t("agents.runs.sources.agentsConsole")}</SelectItem>
                    <SelectItem value="workspace">{t("agents.runs.sources.workspace")}</SelectItem>
                    <SelectItem value="home">{t("agents.runs.sources.home")}</SelectItem>
                    <SelectItem value="admin">{t("agents.runs.sources.admin")}</SelectItem>
                    <SelectItem value="operations">{t("agents.runs.sources.operations")}</SelectItem>
                  </SelectContent>
                </Select>
                <Select onValueChange={(value) => setRunStatusFilter(value as AgentRunStatusFilter)} value={runStatusFilter}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder={t("agents.runs.filters.status")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("agents.runs.filters.allStatuses")}</SelectItem>
                    <SelectItem value="launched">{t("agents.runs.statuses.launched")}</SelectItem>
                    <SelectItem value="completed">{t("agents.runs.statuses.completed")}</SelectItem>
                    <SelectItem value="failed">{t("agents.runs.statuses.failed")}</SelectItem>
                    <SelectItem value="cancelled">{t("agents.runs.statuses.cancelled")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="mt-5 space-y-3">
                {agentRuns.length === 0 ? (
                  <div className="rounded-[18px] border border-dashed border-slate-200 bg-slate-50/80 px-4 py-6 text-sm text-slate-500">
                    {t("agents.runs.empty")}
                  </div>
                ) : (
                  agentRuns.map((agentRun) => {
                    const linkedAgent =
                      agents.find((agent) => agent.id === agentRun.agent_definition_id) ?? selectedAgent ?? null;

                    return (
                      <div className="rounded-[18px] border border-slate-200 bg-slate-50/70 px-4 py-4" key={agentRun.id}>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-slate-950">
                              {linkedAgent?.name ?? t("agents.executionPackets.notSelected")}
                            </div>
                            <div className="mt-1 text-sm leading-6 text-slate-500">
                              {agentRun.launch_prompt?.trim().length
                                ? agentRun.launch_prompt
                                : t("agents.runs.noPrompt")}
                            </div>
                          </div>
                          <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700" variant="outline">
                            {t(`agents.runs.statuses.${agentRun.run_status}`)}
                          </Badge>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <ConsoleOutlineBadge>{t(`agents.tools.${agentRun.target_surface}`)}</ConsoleOutlineBadge>
                          <ConsoleOutlineBadge>{formatAgentRunTriggerSourceLabel(agentRun.trigger_source, t)}</ConsoleOutlineBadge>
                          <ConsoleOutlineBadge>
                            {agentRun.handoff_intent || t("agents.runs.noHandoffIntent")}
                          </ConsoleOutlineBadge>
                          <ConsoleOutlineBadge>{formatUpdatedAt(agentRun.created_at, language)}</ConsoleOutlineBadge>
                        </div>
                        {agentRun.navigation_href ? (
                          <div className="mt-4">
                            <AgentRunButtonLink
                              className="rounded-xl bg-white"
                              href={agentRun.navigation_href}
                              runRecord={{
                                tenant_id: agentRun.tenant_id,
                                agent_definition_id: agentRun.agent_definition_id,
                                workspace_id: agentRun.workspace_id,
                                knowledge_base_id: agentRun.knowledge_base_id,
                                target_surface: agentRun.target_surface,
                                handoff_intent: agentRun.handoff_intent,
                                trigger_source: "agents_console",
                                launch_prompt: agentRun.launch_prompt
                              }}
                              size="sm"
                              type="button"
                              variant="outline"
                            >
                              {t("agents.runs.openRoute")}
                            </AgentRunButtonLink>
                          </div>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </ConsoleSurface>

        {showAdvancedAgentSections ? (
          <>
            <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
              <ConsoleSurface>
                <ConsoleSurfaceHeader
                  description={t("agents.releaseBoard.description")}
                  title={t("agents.releaseBoard.title")}
                />
                <div className="grid gap-4 p-6 md:grid-cols-2">
                  {releaseBoardItems.map((item) => (
                    <div className="rounded-[20px] border border-slate-100 bg-slate-50/80 p-5" key={item.title}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-base font-semibold text-slate-950">{item.title}</div>
                          <div className="mt-2 text-sm leading-6 text-slate-600">{item.detail}</div>
                        </div>
                        <Badge className={cn("border", getPacketStatusClass(item.status))} variant="outline">
                          {item.status === "attention"
                            ? t("agents.executionPackets.statuses.attention")
                            : item.status === "review"
                              ? t("agents.executionPackets.statuses.review")
                              : t("agents.executionPackets.statuses.healthy")}
                        </Badge>
                      </div>
                      <div className="mt-4 rounded-[16px] border border-slate-200 bg-white px-4 py-3">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{item.metricLabel}</div>
                        <div className="mt-2 text-base font-semibold text-slate-900">{item.metricValue}</div>
                      </div>
                      <div className="mt-4">
                        <Button asChild className="rounded-xl bg-white" size="sm" type="button" variant="outline">
                          <Link href={item.href}>{item.actionLabel}</Link>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ConsoleSurface>

              <div className="grid gap-6">
                <ConsoleSurface>
                  <ConsoleSurfaceHeader
                    description={t("agents.dependencies.description")}
                    title={t("agents.dependencies.title")}
                  />
                  <div className="space-y-4 p-6">
                    <div className="rounded-[20px] border border-slate-100 bg-slate-50/80 p-5">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                        {t("agents.dependencies.resolvedModelTitle")}
                      </div>
                      <div className="mt-3 text-base font-semibold text-slate-950">
                        {selectedAgentReadiness?.resolvedModelEndpoint?.name ?? t("agents.dependencies.noResolvedModel")}
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <ConsoleOutlineBadge>
                          {t("agents.dependencies.modelProvider", {
                            value: selectedAgentReadiness?.resolvedModelEndpoint
                              ? t(`settings.models.providers.${selectedAgentReadiness.resolvedModelEndpoint.provider_type}`)
                              : t("agents.executionPackets.modelInherited")
                          })}
                        </ConsoleOutlineBadge>
                        <ConsoleOutlineBadge>
                          {t("agents.dependencies.modelCapabilities", {
                            value:
                              selectedAgentReadiness?.resolvedModelEndpoint?.capabilities
                                .map((capability) => t(`settings.models.capabilityLabels.${capability}`))
                                .join(", ") || t("settings.governance.empty")
                          })}
                        </ConsoleOutlineBadge>
                      </div>
                    </div>
                  </div>
                </ConsoleSurface>
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
              <ConsoleSurface>
                <ConsoleSurfaceHeader
                  description={t("agents.connectivity.description")}
                  title={t("agents.connectivity.title")}
                />
                <div className="grid gap-4 p-6 md:grid-cols-2">
                  {toolDefinitions.map((item) => {
                    const Icon = item.icon;
                    const isEnabled = selectedAgent?.tools.includes(item.tool) ?? false;

                    return (
                      <div className="rounded-[20px] border border-slate-100 bg-slate-50/80 p-5" key={item.tool}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-slate-700 shadow-sm">
                            <Icon className="h-5 w-5" />
                          </div>
                          <Badge className={cn("border", isEnabled ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-100 text-slate-600")} variant="outline">
                            {isEnabled ? t("agents.connectivity.enabled") : t("agents.connectivity.disabled")}
                          </Badge>
                        </div>
                        <div className="mt-4 text-base font-semibold text-slate-950">{item.label}</div>
                        <div className="mt-2 text-sm leading-6 text-slate-500">{item.description}</div>
                      </div>
                    );
                  })}
                </div>
              </ConsoleSurface>
            </div>
          </>
        ) : null}
      </div>
    </ConsoleShell>
  );
}
