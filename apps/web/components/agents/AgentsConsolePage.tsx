"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  CheckSquare,
  Bot,
  BrainCircuit,
  FileText,
  MessageSquareText,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Square,
  Trash2,
  Waypoints,
} from "lucide-react";

import {
  ConsolePage,
  ConsoleEmptyState,
  ConsoleOutlineBadge,
  ConsoleSurface,
  ConsoleSurfaceHeader,
} from "@/components/console/ConsolePrimitives";
import { AgentExecutionFollowUpActions } from "@/components/agents/AgentExecutionFollowUpActions";
import { McpToolMappingDialog } from "@/components/agents/McpToolMappingDialog";
import { AgentRunButtonLink } from "@/components/agents/AgentRunButtonLink";
import { PaginationControls } from "@/components/workspace/PaginationControls";
import { ConsoleRuntimeTaskPacket } from "@/components/console/ConsoleRuntimeTaskPacket";
import { ConsoleShell } from "@/components/console/ConsoleShell";
import { PageTitleSync } from "@/components/console/PageTitleSync";
import { RuntimeBindingSummaryCard } from "@/components/runtime/RuntimeBindingSummaryCard";
import {
  ToolRuntimeSummaryCard,
  readToolRuntimeSummary,
} from "@/components/runtime/ToolRuntimeSummaryCard";
import { ToolRuntimeTraceActions } from "@/components/runtime/ToolRuntimeTraceActions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  DialogFormActions,
  DialogFormField,
  DialogFormGrid,
  DialogFormLayout,
  FormDialog,
} from "@/components/ui/form-dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  createAgentExecution,
  cancelAgentExecution,
  EMPTY_AGENT_EXECUTION_METRICS,
  getAgentExecutionOutputKindLabelKey,
  getAgentExecutionStageLabelKey,
  readAgentExecutionEvidenceSummary,
  readAgentExecutionRuntimeBindingSummary,
  readAgentExecutionRuntimeSummary,
  listAgentExecutionMetrics,
  listAgentExecutions,
  readAgentExecutionRetrievalSummary,
  type AgentExecutionMetricsResponse,
  type AgentExecutionResponse,
  type AgentExecutionStatus,
  replayAgentExecution,
  retryAgentExecution,
} from "@/lib/agent-executions";
import { buildAgentExecutionFollowUpActions } from "@/lib/agent-execution-follow-up";
import { authenticatedApiRequest } from "@/lib/authenticated-api";
import {
  createAgentRun,
  listAgentRunMetrics,
  listAgentRuns,
  serializeAgentRunNavigationHref,
  type AgentRunNavigationHref,
  type AgentRunRecordInput,
  type AgentRunStatus,
  type AgentRunMetricsResponse,
  type AgentRunResponse,
  type AgentRunTargetSurface,
  type AgentRunTriggerSource,
} from "@/lib/agent-runs";
import {
  buildAgentLaunchPrompts,
  resolveKnowledgeBaseScopeSelection,
} from "@/lib/agent-runtime";
import { hasDirectoryCapability } from "@/lib/auth/access";
import { useAuth } from "@/lib/auth/provider";
import { readCurrentTenantId, writeCurrentTenantId } from "@/lib/tenant-scope";
import {
  buildAdminHref,
  buildAgentsHref,
  buildOperationsHref,
  buildRuntimeGovernanceFollowUp,
  buildSettingsHref,
} from "@/lib/console-route-builders";
import { useI18n } from "@/lib/i18n/provider";
import { useStatusNotifications } from "@/lib/notifications/use-status-notifications";
import {
  readRuntimeGovernanceConnectorPreviewLabel,
  readRuntimeGovernanceModelPreviewLabel,
  readRuntimeGovernancePreviewFailureLabel,
  readRuntimeGovernanceToolPreviewLabel,
} from "@/lib/runtime-governance-preview";
import {
  buildRuntimeGovernanceFollowUpTargetFromItem,
  hasRuntimeGovernanceIssue,
  loadAgentRuntimeGovernance,
  type AgentRuntimeGovernanceItem,
} from "@/lib/runtime-governance";
import {
  buildAgentsWorkspaceHref,
  resolveAgentWorkspaceHandoffIntent,
} from "@/lib/workspace-handoffs";
import {
  listMcpConnectors,
  listModelEndpoints,
  loadModelGovernanceSummary,
  listRetrievalProfiles,
  listToolRegistrations,
  type ModelGovernanceSummary,
  type ModelProviderRuntimePosture,
  type PlatformMcpConnector,
  type PlatformModelEndpoint,
  type PlatformRetrievalProfile,
  type PlatformToolRegistration,
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
type ModelProviderTypeFilter =
  "all" | "deterministic" | "openai_compatible" | "ollama" | "vllm";
type AgentRunSurfaceFilter = "all" | AgentRunTargetSurface;
type AgentRunTriggerSourceFilter = "all" | AgentRunTriggerSource;
type AgentRunStatusFilter = "all" | AgentRunStatus;
type AgentExecutionStatusFilter = "all" | AgentExecutionStatus;
type AgentReadinessIssue =
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
type ResolvedAgentModelEndpoint = {
  id: string;
  name: string;
  slug: string;
  provider_type: string;
  model_name: string;
  base_url?: string | null;
  credential_mode?: string;
  credential_key_hint?: string | null;
  capabilities: string[];
  is_enabled: boolean;
  is_default: boolean;
  runtime_ready?: boolean;
  runtime_issue?:
    "missing_base_url" | "missing_credential_hint" | "managed_reserved" | null;
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
type RetrievalGovernanceIssue = "missing" | "disabled" | null;

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
    toolRegistrationIds: dedupeValues(agent.toolRegistrationIds),
  };
}

function countConnectedCapabilities(
  agent: Pick<AgentDraft, "tools" | "toolRegistrationIds">,
) {
  return dedupeValues([...agent.tools, ...agent.toolRegistrationIds]).length;
}

function normalizeModelProviderType(providerType: string | null | undefined) {
  const normalized = (providerType ?? "").trim().toLowerCase();
  if (normalized === "vllm" || normalized === "vllm_reserved") {
    return "vllm" as const;
  }
  if (normalized === "ollama" || normalized === "ollama_reserved") {
    return "ollama" as const;
  }
  if (normalized === "deterministic") {
    return "deterministic" as const;
  }
  return "openai_compatible" as const;
}

function readAllowedModelProviderTypeFilter(
  value: string | null,
): ModelProviderTypeFilter {
  return value === "deterministic" ||
    value === "openai_compatible" ||
    value === "ollama" ||
    value === "vllm"
    ? value
    : "all";
}

function getExecutionOutputStatusClassName(
  status: "ready" | "attention" | "pending",
) {
  if (status === "ready") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (status === "attention") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function readLocalModelRuntimeIssue(
  modelEndpoint: Pick<
    PlatformModelEndpoint,
    "provider_type" | "base_url" | "credential_mode" | "credential_key_hint"
  >,
) {
  if (
    normalizeModelProviderType(modelEndpoint.provider_type) !==
      "deterministic" &&
    !modelEndpoint.base_url?.trim()
  ) {
    return "missing_base_url" as const;
  }
  if (
    modelEndpoint.credential_mode === "environment" &&
    !modelEndpoint.credential_key_hint?.trim()
  ) {
    return "missing_credential_hint" as const;
  }
  return null;
}

const DEFAULT_RETRIEVAL_PROFILE_FILTER_VALUE = "__default_fallback__";
const DISABLED_RETRIEVAL_PROFILE_FILTER_VALUE = "__disabled_assignment__";

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  return await authenticatedApiRequest<T>(path, init);
}

async function listTenants() {
  return await apiRequest<Tenant[]>("/tenants");
}

async function listWorkspaces(tenantId: string) {
  return await apiRequest<Workspace[]>(`/workspaces?tenant_id=${tenantId}`);
}

async function listKnowledgeBases(workspaceId: string) {
  return await apiRequest<KnowledgeBase[]>(
    `/knowledge-bases?workspace_id=${workspaceId}`,
  );
}

async function listAgentDefinitions(
  tenantId: string,
  filters: { query: string; status: AgentStatusFilter; mode: AgentModeFilter },
) {
  const searchParams = new URLSearchParams({
    tenant_id: tenantId,
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

  return await apiRequest<AgentDefinitionResponse[]>(
    `/agents?${searchParams.toString()}`,
  );
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
      tool_registration_ids: agent.toolRegistrationIds,
    }),
  });
}

async function updateAgentDefinition(agent: AgentDraft) {
  return await apiRequest<AgentDefinitionResponse>(
    `/agents/${agent.id}?tenant_id=${agent.tenantId}`,
    {
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
        tool_registration_ids: agent.toolRegistrationIds,
      }),
    },
  );
}

async function deleteAgentDefinition(agentId: string, tenantId: string) {
  await apiRequest<void>(`/agents/${agentId}?tenant_id=${tenantId}`, {
    method: "DELETE",
  });
}

function mapAgentDefinitionToDraft(
  agentDefinition: AgentDefinitionResponse,
): AgentDraft {
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
    updatedAt: agentDefinition.updated_at,
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
        minute: "2-digit",
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
  if (status === "awaiting_approval") {
    return "border-violet-200 bg-violet-50 text-violet-700";
  }
  if (status === "queued") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-slate-200 bg-slate-100 text-slate-700";
}

function getAgentRunStatusClass(status: AgentRunStatus) {
  if (status === "completed") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (status === "failed") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }
  if (status === "cancelled") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-blue-200 bg-blue-50 text-blue-700";
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
  if (
    value === "grounded_chat" ||
    value === "document_intake" ||
    value === "workflow_recovery"
  ) {
    return value;
  }

  return "all";
}

function readAllowedAgentReadinessFilter(
  value: string | null,
): AgentReadinessFilter {
  if (value === "ready" || value === "attention") {
    return value;
  }

  return "all";
}

function readAllowedAgentReadinessIssueFilter(
  value: string | null,
): AgentReadinessIssueFilter {
  if (
    value === "model_missing" ||
    value === "model_disabled" ||
    value === "model_runtime_unconfigured" ||
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

function readAllowedAgentRunSurfaceFilter(
  value: string | null,
): AgentRunSurfaceFilter {
  if (
    value === "chat" ||
    value === "documents" ||
    value === "operations" ||
    value === "admin"
  ) {
    return value;
  }

  return "all";
}

function readAllowedAgentRunTriggerSourceFilter(
  value: string | null,
): AgentRunTriggerSourceFilter {
  if (
    value === "agents_console" ||
    value === "workspace" ||
    value === "home" ||
    value === "admin" ||
    value === "operations"
  ) {
    return value;
  }

  return "all";
}

function readAllowedAgentRunStatusFilter(
  value: string | null,
): AgentRunStatusFilter {
  if (
    value === "launched" ||
    value === "completed" ||
    value === "failed" ||
    value === "cancelled"
  ) {
    return value;
  }

  return "all";
}

function readAllowedAgentExecutionStatusFilter(
  value: string | null,
): AgentExecutionStatusFilter {
  if (
    value === "queued" ||
    value === "running" ||
    value === "awaiting_approval" ||
    value === "completed" ||
    value === "failed" ||
    value === "cancelled"
  ) {
    return value;
  }

  return "all";
}

function formatAgentRunTriggerSourceLabel(
  triggerSource: AgentRunTriggerSource,
  t: (key: string, variables?: Record<string, string>) => string,
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

type RuntimePacketAction = {
  label: string;
  href: AgentRunNavigationHref;
  runRecord?: AgentRunRecordInput | null;
};

function appendUniqueRuntimePacketAction(
  actions: RuntimePacketAction[],
  action: RuntimePacketAction | null | undefined,
) {
  if (!action) {
    return;
  }

  const nextToken = `${action.label}:${typeof action.href === "string" ? action.href : JSON.stringify(action.href)}`;
  const hasDuplicate = actions.some((entry) => {
    const entryToken = `${entry.label}:${typeof entry.href === "string" ? entry.href : JSON.stringify(entry.href)}`;
    return entryToken === nextToken;
  });

  if (!hasDuplicate) {
    actions.push(action);
  }
}

function buildKnowledgeBaseScope(
  workspaceSlug: string,
  knowledgeBaseSlug: string,
) {
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
  },
): AgentReadinessState {
  const issues: AgentReadinessIssue[] = [];
  const selectedModelEndpoint = agent.modelEndpointId
    ? (context.modelEndpoints.find(
        (modelEndpoint) => modelEndpoint.id === agent.modelEndpointId,
      ) ?? null)
    : null;
  const fallbackModelEndpoint =
    context.modelEndpoints.find(
      (modelEndpoint) => modelEndpoint.is_enabled && modelEndpoint.is_default,
    ) ??
    context.modelEndpoints.find((modelEndpoint) => modelEndpoint.is_enabled) ??
    null;
  const resolvedModelEndpoint = selectedModelEndpoint ?? fallbackModelEndpoint;
  const resolvedModelRuntimeIssue = resolvedModelEndpoint
    ? readLocalModelRuntimeIssue(resolvedModelEndpoint)
    : null;
  const requiresKnowledgeScope =
    agent.mode === "grounded_chat" || agent.mode === "document_intake";
  const scopeSelection = resolveKnowledgeBaseScopeSelection(
    agent.knowledgeBaseScope,
    context.workspaces,
    context.knowledgeBases,
  );
  const scopedKnowledgeBase = scopeSelection.knowledgeBaseId
    ? (context.knowledgeBases.find(
        (knowledgeBase) => knowledgeBase.id === scopeSelection.knowledgeBaseId,
      ) ?? null)
    : null;
  const assignedRetrievalProfileId =
    scopedKnowledgeBase?.retrieval_profile_id?.trim() ?? "";
  const defaultRetrievalProfile =
    context.retrievalProfiles.find(
      (retrievalProfile) =>
        retrievalProfile.is_enabled && retrievalProfile.is_default,
    ) ??
    context.retrievalProfiles.find(
      (retrievalProfile) => retrievalProfile.is_enabled,
    ) ??
    null;
  const selectedRetrievalProfile = assignedRetrievalProfileId
    ? (context.retrievalProfiles.find(
        (retrievalProfile) =>
          retrievalProfile.id === assignedRetrievalProfileId,
      ) ?? null)
    : null;
  const resolvedRetrievalProfile = assignedRetrievalProfileId
    ? selectedRetrievalProfile
    : defaultRetrievalProfile;
  const hasConnectedCapabilities = countConnectedCapabilities(agent) > 0;
  const disabledRegisteredToolCount = context.toolRegistrations.filter(
    (toolRegistration) =>
      agent.toolRegistrationIds.includes(toolRegistration.id) &&
      !toolRegistration.is_enabled,
  ).length;
  const approvalRequiredToolCount = context.toolRegistrations.filter(
    (toolRegistration) =>
      agent.toolRegistrationIds.includes(toolRegistration.id) &&
      toolRegistration.requires_admin_approval,
  ).length;
  const reservedMcpToolCount = context.toolRegistrations.filter(
    (toolRegistration) =>
      agent.toolRegistrationIds.includes(toolRegistration.id) &&
      toolRegistration.is_enabled &&
      toolRegistration.transport_type === "mcp_reserved" &&
      !toolRegistration.connector_reference?.trim(),
  ).length;
  const integrationPendingMcpToolCount = context.toolRegistrations.filter(
    (toolRegistration) =>
      agent.toolRegistrationIds.includes(toolRegistration.id) &&
      toolRegistration.is_enabled &&
      toolRegistration.transport_type === "mcp_reserved" &&
      Boolean(toolRegistration.connector_reference?.trim()),
  ).length;

  if (!resolvedModelEndpoint) {
    issues.push("model_missing");
  } else if (!resolvedModelEndpoint.is_enabled) {
    issues.push("model_disabled");
  } else if (resolvedModelRuntimeIssue) {
    issues.push("model_runtime_unconfigured");
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

  const blockingIssues = issues.filter(
    (issue) => issue !== "tool_approval_required",
  );

  return {
    approvalRequiredToolCount,
    blockingIssues,
    disabledRegisteredToolCount,
    integrationPendingMcpToolCount,
    isReady: blockingIssues.length === 0,
    issues,
    reservedMcpToolCount,
    resolvedRetrievalProfile,
    resolvedModelEndpoint,
  };
}

function mapRuntimeGovernanceItemToReadiness(
  item: AgentRuntimeGovernanceItem,
): AgentReadinessState {
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
    missingToolRegistrationCount: item.missing_tool_registration_count,
  };
}

const EMPTY_MODEL_GOVERNANCE_SUMMARY: ModelGovernanceSummary = {
  total_endpoints: 0,
  enabled_endpoints: 0,
  disabled_endpoints: 0,
  bound_endpoints: 0,
  default_endpoints: 0,
  enabled_default_endpoints: 0,
  runtime_ready_default_endpoints: 0,
  settings_fallback_exposed: false,
  disabled_bound_endpoints: 0,
  runtime_ready_endpoints: 0,
  missing_base_url_endpoints: 0,
  environment_credential_endpoints: 0,
  missing_credential_hint_endpoints: 0,
  managed_reserved_credential_endpoints: 0,
  no_credential_endpoints: 0,
  deterministic_endpoints: 0,
  ollama_endpoints: 0,
  openai_compatible_endpoints: 0,
  vllm_endpoints: 0,
  provider_breakdown: [],
  credential_breakdown: [],
  provider_compatibility: [],
  provider_runtime_posture: [],
};

export default function AgentsConsolePage() {
  const { language, t } = useI18n();
  const { session } = useAuth();
  const hasAgentWriteAccess = hasDirectoryCapability(
    session,
    "manage_agent_definitions",
  );
  const hasAgentExecutionAccess = hasDirectoryCapability(
    session,
    "execute_agents",
  );
  const canManageRuntimeGovernance = hasDirectoryCapability(
    session,
    "manage_runtime_governance",
  );

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [modelEndpoints, setModelEndpoints] = useState<PlatformModelEndpoint[]>(
    [],
  );
  const [modelGovernanceSummary, setModelGovernanceSummary] =
    useState<ModelGovernanceSummary>(EMPTY_MODEL_GOVERNANCE_SUMMARY);
  const [retrievalProfiles, setRetrievalProfiles] = useState<
    PlatformRetrievalProfile[]
  >([]);
  const [toolRegistrations, setToolRegistrations] = useState<
    PlatformToolRegistration[]
  >([]);
  const [mcpConnectors, setMcpConnectors] = useState<PlatformMcpConnector[]>(
    [],
  );
  const [isMcpMappingOpen, setIsMcpMappingOpen] = useState(false);
  const tenantWorkspacesCacheRef = useRef<Record<string, Workspace[]>>({});
  const workspaceKnowledgeBasesCacheRef = useRef<Record<string, KnowledgeBase[]>>(
    {},
  );
  const [runtimeGovernanceItems, setRuntimeGovernanceItems] = useState<
    AgentRuntimeGovernanceItem[]
  >([]);
  const [agents, setAgents] = useState<AgentDraft[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [statusFilter, setStatusFilter] = useState<AgentStatusFilter>("all");
  const [modeFilter, setModeFilter] = useState<AgentModeFilter>("all");
  const [readinessFilter, setReadinessFilter] =
    useState<AgentReadinessFilter>("all");
  const [issueFilter, setIssueFilter] =
    useState<AgentReadinessIssueFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [agentPage, setAgentPage] = useState(1);
  const [runTargetSurfaceFilter, setRunTargetSurfaceFilter] =
    useState<AgentRunSurfaceFilter>("all");
  const [runTriggerSourceFilter, setRunTriggerSourceFilter] =
    useState<AgentRunTriggerSourceFilter>("all");
  const [runStatusFilter, setRunStatusFilter] =
    useState<AgentRunStatusFilter>("all");
  const [executionStatusFilter, setExecutionStatusFilter] =
    useState<AgentExecutionStatusFilter>("all");
  const [modelEndpointFilterId, setModelEndpointFilterId] = useState("");
  const [modelProviderTypeFilter, setModelProviderTypeFilter] =
    useState<ModelProviderTypeFilter>("all");
  const [toolRegistrationFilterId, setToolRegistrationFilterId] = useState("");
  const [retrievalProfileFilterId, setRetrievalProfileFilterId] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [agentRuns, setAgentRuns] = useState<AgentRunResponse[]>([]);
  const [agentRunMetrics, setAgentRunMetrics] =
    useState<AgentRunMetricsResponse | null>(null);
  const [isLoadingAgentRuns, setIsLoadingAgentRuns] = useState(false);
  const [agentExecutions, setAgentExecutions] = useState<
    AgentExecutionResponse[]
  >([]);
  const [agentExecutionMetrics, setAgentExecutionMetrics] =
    useState<AgentExecutionMetricsResponse | null>(
      EMPTY_AGENT_EXECUTION_METRICS,
    );
  const [isLoadingAgentExecutions, setIsLoadingAgentExecutions] =
    useState(false);
  const [isExecutingAgent, setIsExecutingAgent] = useState(false);
  const [retryingExecutionId, setRetryingExecutionId] = useState<string | null>(null);
  const [replayingExecutionId, setReplayingExecutionId] = useState<string | null>(null);
  const [cancellingExecutionId, setCancellingExecutionId] = useState<string | null>(null);
  const [executionMaxToolCalls, setExecutionMaxToolCalls] = useState("");
  const [executionMaxRuntimeSeconds, setExecutionMaxRuntimeSeconds] = useState("");
  const [executionMaxOutputBytes, setExecutionMaxOutputBytes] = useState("");
  const [executionOutputSchema, setExecutionOutputSchema] = useState("");
  const [launchingSurface, setLaunchingSurface] =
    useState<AgentRunTargetSurface | null>(null);
  const [isDeleteAgentDialogOpen, setIsDeleteAgentDialogOpen] = useState(false);
  const [isBulkDeleteAgentDialogOpen, setIsBulkDeleteAgentDialogOpen] = useState(false);
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
  useStatusNotifications(statusMessage, errorMessage, { statusTone: "info" });

  useEffect(() => {
    function applyLocationState() {
      const searchParams = new URLSearchParams(window.location.search);
      setSelectedTenantId(searchParams.get("tenant_id") ?? readCurrentTenantId());
      setStatusFilter(readAllowedAgentStatusFilter(searchParams.get("status")));
      setModeFilter(readAllowedAgentModeFilter(searchParams.get("mode")));
      setReadinessFilter(
        readAllowedAgentReadinessFilter(searchParams.get("readiness")),
      );
      setIssueFilter(
        readAllowedAgentReadinessIssueFilter(searchParams.get("issue")),
      );
      setSearchQuery(searchParams.get("query") ?? "");
      setSelectedAgentId(searchParams.get("agent_id") ?? "");
      setRunTargetSurfaceFilter(
        readAllowedAgentRunSurfaceFilter(
          searchParams.get("run_target_surface"),
        ),
      );
      setRunTriggerSourceFilter(
        readAllowedAgentRunTriggerSourceFilter(
          searchParams.get("run_trigger_source"),
        ),
      );
      setRunStatusFilter(
        readAllowedAgentRunStatusFilter(searchParams.get("run_status")),
      );
      setExecutionStatusFilter(
        readAllowedAgentExecutionStatusFilter(
          searchParams.get("execution_status"),
        ),
      );
      setModelEndpointFilterId(searchParams.get("model_endpoint_id") ?? "");
      setModelProviderTypeFilter(
        readAllowedModelProviderTypeFilter(
          searchParams.get("model_provider_type"),
        ),
      );
      setToolRegistrationFilterId(
        searchParams.get("tool_registration_id") ?? "",
      );
      setRetrievalProfileFilterId(
        searchParams.get("retrieval_profile_id") ?? "",
      );
    }

    applyLocationState();
    window.addEventListener("popstate", applyLocationState);

    return () => {
      window.removeEventListener("popstate", applyLocationState);
    };
  }, []);

  useEffect(() => {
    if (selectedTenantId) writeCurrentTenantId(selectedTenantId);
  }, [selectedTenantId]);

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
      modelProviderType:
        modelProviderTypeFilter === "all" ? null : modelProviderTypeFilter,
      toolRegistrationId: toolRegistrationFilterId || null,
      retrievalProfileId: retrievalProfileFilterId || null,
    });
    nextUrl.search = new URLSearchParams(
      Object.entries(nextHref.query ?? {}).map(([key, value]) => [
        key,
        String(value),
      ]),
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
    modelProviderTypeFilter,
    selectedTenantId,
    statusFilter,
    toolRegistrationFilterId,
    retrievalProfileFilterId,
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
          currentTenantId &&
          nextTenants.some((tenant) => tenant.id === currentTenantId)
            ? currentTenantId
            : nextTenants[0].id,
        );
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : t("agents.status.restoreFailed"),
        );
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

  const refreshRuntimeGovernanceCatalog = useCallback(async () => {
    const [
      nextModelEndpoints,
      nextModelGovernanceSummary,
      nextRetrievalProfiles,
      nextToolRegistrations,
      nextMcpConnectors,
    ] = await Promise.all([
      listModelEndpoints(),
      loadModelGovernanceSummary(),
      listRetrievalProfiles(),
      listToolRegistrations(),
      listMcpConnectors(),
    ]);

    setModelEndpoints(nextModelEndpoints);
    setModelGovernanceSummary(nextModelGovernanceSummary);
    setRetrievalProfiles(nextRetrievalProfiles);
    setToolRegistrations(nextToolRegistrations);
    setMcpConnectors(nextMcpConnectors);
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function refreshRuntimeGovernance() {
      try {
        const [
          nextModelEndpoints,
          nextModelGovernanceSummary,
          nextRetrievalProfiles,
          nextToolRegistrations,
          nextMcpConnectors,
        ] = await Promise.all([
          listModelEndpoints(),
          loadModelGovernanceSummary(),
          listRetrievalProfiles(),
          listToolRegistrations(),
          listMcpConnectors(),
        ]);
        if (!isMounted) {
          return;
        }

        setModelEndpoints(nextModelEndpoints);
        setModelGovernanceSummary(nextModelGovernanceSummary);
        setRetrievalProfiles(nextRetrievalProfiles);
        setToolRegistrations(nextToolRegistrations);
        setMcpConnectors(nextMcpConnectors);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : t("agents.status.restoreFailed"),
        );
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
        const cachedWorkspaces = tenantWorkspacesCacheRef.current[selectedTenantId];
        const nextWorkspaces =
          cachedWorkspaces ?? (await listWorkspaces(selectedTenantId));
        if (cachedWorkspaces == null) {
          tenantWorkspacesCacheRef.current[selectedTenantId] = nextWorkspaces;
        }

        const missingKnowledgeBaseWorkspaces = nextWorkspaces.filter(
          (workspace) =>
            workspaceKnowledgeBasesCacheRef.current[workspace.id] == null,
        );
        if (missingKnowledgeBaseWorkspaces.length > 0) {
          const fetchedKnowledgeBaseGroups = await Promise.all(
            missingKnowledgeBaseWorkspaces.map(async (workspace) => ({
              workspaceId: workspace.id,
              knowledgeBases: await listKnowledgeBases(workspace.id),
            })),
          );
          for (const group of fetchedKnowledgeBaseGroups) {
            workspaceKnowledgeBasesCacheRef.current[group.workspaceId] =
              group.knowledgeBases;
          }
        }

        const knowledgeBaseGroups = nextWorkspaces.map((workspace) => ({
          workspaceId: workspace.id,
          knowledgeBases:
            workspaceKnowledgeBasesCacheRef.current[workspace.id] ?? [],
        }));
        const nextKnowledgeBases = knowledgeBaseGroups.flatMap(
          (group) => group.knowledgeBases,
        );
        if (!isMounted) {
          return;
        }

        setWorkspaces(nextWorkspaces);
        setKnowledgeBases(nextKnowledgeBases);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : t("agents.status.restoreFailed"),
        );
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
            query: searchQuery,
          }),
          loadAgentRuntimeGovernance({
            tenant_id: selectedTenantId,
            status: statusFilter === "all" ? null : statusFilter,
            mode: modeFilter === "all" ? null : modeFilter,
            readiness: readinessFilter === "all" ? null : readinessFilter,
            issue: issueFilter === "all" ? null : issueFilter,
            query: searchQuery,
            model_endpoint_id: modelEndpointFilterId || null,
            model_provider_type:
              modelProviderTypeFilter === "all"
                ? null
                : modelProviderTypeFilter,
            tool_registration_id: toolRegistrationFilterId || null,
            retrieval_profile_id: retrievalProfileFilterId || null,
          }),
        ]);
        if (!isMounted) {
          return;
        }

        const nextAgents = nextAgentDefinitions.map(mapAgentDefinitionToDraft);
        setAgents(nextAgents);
        setRuntimeGovernanceItems(runtimeGovernance.items);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setAgents([]);
        setRuntimeGovernanceItems([]);
        setSelectedAgentId("");
        setErrorMessage(
          error instanceof Error
            ? error.message
            : t("agents.status.restoreFailed"),
        );
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
    modelProviderTypeFilter,
    readinessFilter,
    retrievalProfileFilterId,
    searchQuery,
    selectedTenantId,
    statusFilter,
    t,
    toolRegistrationFilterId,
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
      if (
        modelEndpointFilterId &&
        agent.modelEndpointId !== modelEndpointFilterId
      ) {
        return false;
      }

      const readiness = readinessByAgentId.get(agent.id);
      const resolvedProviderType = readiness?.resolvedModelEndpoint
        ?.provider_type
        ? normalizeModelProviderType(
            readiness.resolvedModelEndpoint.provider_type,
          )
        : null;
      if (
        modelProviderTypeFilter !== "all" &&
        resolvedProviderType !== modelProviderTypeFilter
      ) {
        return false;
      }
      if (
        toolRegistrationFilterId &&
        !agent.toolRegistrationIds.includes(toolRegistrationFilterId)
      ) {
        return false;
      }
      if (
        retrievalProfileFilterId &&
        readiness?.resolvedRetrievalProfile?.id !== retrievalProfileFilterId
      ) {
        return false;
      }
      if (!readiness) {
        return readinessFilter === "all" && issueFilter === "all";
      }

      if (readinessFilter !== "all") {
        const matchesReadiness =
          readinessFilter === "ready" ? readiness.isReady : !readiness.isReady;
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
    modelProviderTypeFilter,
    readinessByAgentId,
    readinessFilter,
    retrievalProfileFilterId,
    toolRegistrationFilterId,
  ]);
  const agentPageSize = 10;
  const agentPageCount = Math.max(1, Math.ceil(scopedAgents.length / agentPageSize));
  const paginatedAgents = useMemo(
    () => scopedAgents.slice((agentPage - 1) * agentPageSize, agentPage * agentPageSize),
    [agentPage, scopedAgents],
  );
  const allAgentsOnPageSelected = paginatedAgents.length > 0 && paginatedAgents.every((agent) => selectedAgentIds.includes(agent.id));
  useEffect(() => {
    setAgentPage((page) => Math.min(page, agentPageCount));
  }, [agentPageCount]);
  useEffect(() => {
    setAgentPage(1);
  }, [modeFilter, searchQuery, selectedTenantId, statusFilter]);
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
        model_runtime_unconfigured: 0,
        retrieval_profile_missing: 0,
        retrieval_profile_disabled: 0,
        scope_missing: 0,
        scope_invalid: 0,
        tools_missing: 0,
        tool_registration_disabled: 0,
        tool_approval_required: 0,
        tool_mcp_reserved: 0,
        tool_mcp_integration_pending: 0,
      },
    );
  }, [agents, readinessByAgentId]);
  useEffect(() => {
    if (selectedAgentId && !scopedAgents.find((agent) => agent.id === selectedAgentId)) {
      setSelectedAgentId("");
    }
    setSelectedAgentIds((ids) => ids.filter((id) => scopedAgents.some((agent) => agent.id === id)));
  }, [scopedAgents, selectedAgentId]);
  const selectedAgent = useMemo(
    () => scopedAgents.find((agent) => agent.id === selectedAgentId) ?? null,
    [scopedAgents, selectedAgentId],
  );
  const scopedAgentById = useMemo(
    () => new Map(scopedAgents.map((agent) => [agent.id, agent] as const)),
    [scopedAgents],
  );
  const selectedAgentReadiness = useMemo(
    () =>
      selectedAgent ? (readinessByAgentId.get(selectedAgent.id) ?? null) : null,
    [readinessByAgentId, selectedAgent],
  );
  const selectedRuntimeGovernanceItem = useMemo(
    () =>
      selectedAgent
        ? (runtimeGovernanceItems.find(
            (item) => item.id === selectedAgent.id,
          ) ?? null)
        : null,
    [runtimeGovernanceItems, selectedAgent],
  );
  const selectedRetrievalGovernanceIssue =
    useMemo<RetrievalGovernanceIssue>(() => {
      if (!selectedAgentReadiness) {
        return null;
      }
      if (
        hasRuntimeGovernanceIssue(
          selectedRuntimeGovernanceItem ?? selectedAgentReadiness,
          "retrieval_profile_disabled",
        )
      ) {
        return "disabled";
      }
      if (
        hasRuntimeGovernanceIssue(
          selectedRuntimeGovernanceItem ?? selectedAgentReadiness,
          "retrieval_profile_missing",
        )
      ) {
        return "missing";
      }
      return null;
    }, [selectedAgentReadiness, selectedRuntimeGovernanceItem]);
  const selectedTenant = useMemo(
    () =>
      tenants.find(
        (tenant) => tenant.id === (selectedAgent?.tenantId || selectedTenantId),
      ) ?? null,
    [selectedAgent?.tenantId, selectedTenantId, tenants],
  );
  const selectedAgentScopeSelection = useMemo(
    () =>
      selectedAgent
        ? resolveKnowledgeBaseScopeSelection(
            selectedAgent.knowledgeBaseScope,
            workspaces,
            knowledgeBases,
          )
        : { workspaceId: "", knowledgeBaseId: "" },
    [knowledgeBases, selectedAgent, workspaces],
  );
  const selectedAgentScopeKnowledgeBases = useMemo(
    () =>
      selectedAgentScopeSelection.workspaceId
        ? knowledgeBases.filter(
            (knowledgeBase) =>
              knowledgeBase.workspace_id ===
              selectedAgentScopeSelection.workspaceId,
          )
        : [],
    [knowledgeBases, selectedAgentScopeSelection.workspaceId],
  );
  const selectedScopeWorkspace = useMemo(
    () =>
      selectedAgentScopeSelection.workspaceId
        ? (workspaces.find(
            (workspace) =>
              workspace.id === selectedAgentScopeSelection.workspaceId,
          ) ?? null)
        : null,
    [selectedAgentScopeSelection.workspaceId, workspaces],
  );
  const selectedScopeKnowledgeBase = useMemo(
    () =>
      selectedAgentScopeSelection.knowledgeBaseId
        ? (knowledgeBases.find(
            (knowledgeBase) =>
              knowledgeBase.id === selectedAgentScopeSelection.knowledgeBaseId,
          ) ?? null)
        : null,
    [knowledgeBases, selectedAgentScopeSelection.knowledgeBaseId],
  );
  const retrievalProfileById = useMemo(
    () =>
      new Map(
        retrievalProfiles.map((retrievalProfile) => [
          retrievalProfile.id,
          retrievalProfile,
        ]),
      ),
    [retrievalProfiles],
  );
  const defaultRetrievalProfile = useMemo(
    () =>
      retrievalProfiles.find(
        (retrievalProfile) =>
          retrievalProfile.is_enabled && retrievalProfile.is_default,
      ) ??
      retrievalProfiles.find(
        (retrievalProfile) => retrievalProfile.is_enabled,
      ) ??
      retrievalProfiles[0] ??
      null,
    [retrievalProfiles],
  );
  const selectedScopeRetrievalProfile = useMemo(() => {
    if (selectedScopeKnowledgeBase?.retrieval_profile_id) {
      return (
        retrievalProfileById.get(
          selectedScopeKnowledgeBase.retrieval_profile_id,
        ) ?? null
      );
    }

    return defaultRetrievalProfile;
  }, [
    defaultRetrievalProfile,
    retrievalProfileById,
    selectedScopeKnowledgeBase?.retrieval_profile_id,
  ]);
  const selectedScopeRetrievalProfileSource = useMemo(() => {
    if (!selectedScopeRetrievalProfile) {
      return null;
    }

    return selectedScopeKnowledgeBase?.retrieval_profile_id
      ? "knowledge_base"
      : "platform_default";
  }, [
    selectedScopeKnowledgeBase?.retrieval_profile_id,
    selectedScopeRetrievalProfile,
  ]);
  const selectedModelEndpoint = useMemo(
    () =>
      selectedAgent?.modelEndpointId
        ? (modelEndpoints.find(
            (modelEndpoint) =>
              modelEndpoint.id === selectedAgent.modelEndpointId,
          ) ?? null)
        : null,
    [modelEndpoints, selectedAgent?.modelEndpointId],
  );
  const selectedRuntimeModel = useMemo(
    () =>
      selectedAgentReadiness?.resolvedModelEndpoint ??
      selectedModelEndpoint ??
      null,
    [selectedAgentReadiness?.resolvedModelEndpoint, selectedModelEndpoint],
  );
  const selectedPreviewAwareModelEndpoint = useMemo(
    () =>
      selectedRuntimeModel?.id
        ? (modelEndpoints.find(
            (modelEndpoint) => modelEndpoint.id === selectedRuntimeModel.id,
          ) ?? null)
        : null,
    [modelEndpoints, selectedRuntimeModel?.id],
  );
  const selectedProviderPosture =
    useMemo<ModelProviderRuntimePosture | null>(() => {
      if (!selectedRuntimeModel?.provider_type) {
        return null;
      }
      const providerType = normalizeModelProviderType(
        selectedRuntimeModel.provider_type,
      );
      return (
        modelGovernanceSummary.provider_runtime_posture.find(
          (item) => item.provider_type === providerType,
        ) ?? null
      );
    }, [modelGovernanceSummary.provider_runtime_posture, selectedRuntimeModel]);
  const selectedProviderCompatibility = useMemo(() => {
    if (!selectedRuntimeModel?.provider_type) {
      return null;
    }
    const providerType = normalizeModelProviderType(
      selectedRuntimeModel.provider_type,
    );
    return (
      modelGovernanceSummary.provider_compatibility.find(
        (item) => item.provider_type === providerType,
      ) ?? null
    );
  }, [modelGovernanceSummary.provider_compatibility, selectedRuntimeModel]);
  const availableModelFilterEndpoints = useMemo(
    () =>
      modelEndpoints.filter(
        (modelEndpoint) =>
          agents.some((agent) => agent.modelEndpointId === modelEndpoint.id) ||
          modelEndpoint.id === modelEndpointFilterId,
      ),
    [agents, modelEndpointFilterId, modelEndpoints],
  );
  const availableModelProviderFilters = useMemo(
    () =>
      modelGovernanceSummary.provider_runtime_posture.filter(
        (provider) =>
          provider.active_agent_count > 0 ||
          provider.provider_type === modelProviderTypeFilter,
      ),
    [modelGovernanceSummary.provider_runtime_posture, modelProviderTypeFilter],
  );
  const availableToolFilterRegistrations = useMemo(
    () =>
      toolRegistrations.filter(
        (toolRegistration) =>
          agents.some((agent) =>
            agent.toolRegistrationIds.includes(toolRegistration.id),
          ) || toolRegistration.id === toolRegistrationFilterId,
      ),
    [agents, toolRegistrationFilterId, toolRegistrations],
  );
  const enabledModelEndpoints = useMemo(
    () => modelEndpoints.filter((modelEndpoint) => modelEndpoint.is_enabled),
    [modelEndpoints],
  );
  const enabledToolRegistrations = useMemo(
    () =>
      toolRegistrations.filter(
        (toolRegistration) => toolRegistration.is_enabled,
      ),
    [toolRegistrations],
  );
  const availableModelEndpoints = useMemo(() => {
    if (!selectedModelEndpoint) {
      return enabledModelEndpoints;
    }

    return enabledModelEndpoints.some(
      (modelEndpoint) => modelEndpoint.id === selectedModelEndpoint.id,
    )
      ? enabledModelEndpoints
      : [selectedModelEndpoint, ...enabledModelEndpoints];
  }, [enabledModelEndpoints, selectedModelEndpoint]);
  const selectedRegisteredTools = useMemo(
    () =>
      selectedAgent
        ? toolRegistrations.filter((toolRegistration) =>
            selectedAgent.toolRegistrationIds.includes(toolRegistration.id),
          )
        : [],
    [selectedAgent, toolRegistrations],
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
  const selectedPendingMcpConnector = useMemo(
    () => selectedRuntimeGovernanceItem?.focus_mcp_connector ?? null,
    [selectedRuntimeGovernanceItem],
  );
  const selectedToolPreviewDetail = useMemo(() => {
    return readRuntimeGovernanceToolPreviewLabel(
      selectedRuntimeGovernanceItem?.focus_tool_registration,
      t,
      (value) => formatUpdatedAt(value, language),
      "operations.recoveryAgents.lastToolPreview",
    );
  }, [language, selectedRuntimeGovernanceItem, t]);
  const selectedToolPreviewFailures = useMemo(() => {
    return readRuntimeGovernancePreviewFailureLabel(
      selectedRuntimeGovernanceItem?.focus_tool_registration,
      t,
      "admin.runtimeQueue.previewFailures",
    );
  }, [selectedRuntimeGovernanceItem, t]);
  const selectedConnectorPreviewDetail = useMemo(
    () =>
      readRuntimeGovernanceConnectorPreviewLabel(
        selectedPendingMcpConnector,
        t,
        (value) => formatUpdatedAt(value, language),
        "operations.recoveryAgents.lastConnectorPreview",
      ),
    [language, selectedPendingMcpConnector, t],
  );
  const selectedConnectorPreviewFailures = useMemo(
    () =>
      readRuntimeGovernancePreviewFailureLabel(
        selectedPendingMcpConnector,
        t,
        "admin.runtimeQueue.previewFailures",
      ),
    [selectedPendingMcpConnector, t],
  );
  const selectedModelPreviewDetail = useMemo(
    () =>
      readRuntimeGovernanceModelPreviewLabel(
        selectedPreviewAwareModelEndpoint,
        t,
        (value) => formatUpdatedAt(value, language),
        "admin.runtimeQueue.lastModelPreview",
      ),
    [language, selectedPreviewAwareModelEndpoint, t],
  );
  const selectedModelPreviewFailures = useMemo(
    () =>
      readRuntimeGovernancePreviewFailureLabel(
        selectedPreviewAwareModelEndpoint,
        t,
        "admin.runtimeQueue.previewFailures",
      ),
    [selectedPreviewAwareModelEndpoint, t],
  );
  const selectedRuntimeFollowUp = useMemo(() => {
    return buildRuntimeGovernanceFollowUp(
      buildRuntimeGovernanceFollowUpTargetFromItem({
        tenantId: selectedTenantId || null,
        mode: selectedAgent?.mode ?? null,
        fallbackAgentId: selectedAgent?.id ?? null,
        item: selectedRuntimeGovernanceItem,
        disabledRetrievalProfileId:
          selectedRetrievalGovernanceIssue === "disabled" &&
          selectedAgentReadiness?.resolvedRetrievalProfile
            ? selectedAgentReadiness.resolvedRetrievalProfile.id
            : null,
      }),
    );
  }, [
    selectedAgent,
    selectedAgentReadiness,
    selectedRetrievalGovernanceIssue,
    selectedRuntimeGovernanceItem,
    selectedTenantId,
  ]);
  const selectedRuntimeSettingsHref = selectedRuntimeFollowUp.settingsHref;

  const agentRunFilters = useMemo(
    () => ({
      targetSurface:
        runTargetSurfaceFilter === "all" ? null : runTargetSurfaceFilter,
      triggerSource:
        runTriggerSourceFilter === "all" ? null : runTriggerSourceFilter,
      runStatus: runStatusFilter === "all" ? null : runStatusFilter,
    }),
    [runStatusFilter, runTargetSurfaceFilter, runTriggerSourceFilter],
  );
  const agentExecutionFilters = useMemo(
    () => ({
      executionMode: selectedAgent?.mode ?? null,
      executionStatus:
        executionStatusFilter === "all" ? null : executionStatusFilter,
    }),
    [executionStatusFilter, selectedAgent?.mode],
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
        listAgentRuns(
          selectedTenantId,
          selectedAgentId || null,
          8,
          agentRunFilters,
        ),
        listAgentRunMetrics(
          selectedTenantId,
          selectedAgentId || null,
          agentRunFilters,
        ),
      ]);
      setAgentRuns(nextAgentRuns);
      setAgentRunMetrics(nextAgentRunMetrics);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : t("agents.status.launchHistoryFailed"),
      );
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
      const [nextAgentExecutions, nextAgentExecutionMetrics] =
        await Promise.all([
          listAgentExecutions(
            selectedTenantId,
            selectedAgentId || null,
            8,
            agentExecutionFilters,
          ),
          listAgentExecutionMetrics(
            selectedTenantId,
            selectedAgentId || null,
            agentExecutionFilters,
          ),
        ]);
      setAgentExecutions(nextAgentExecutions);
      setAgentExecutionMetrics(nextAgentExecutionMetrics);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : t("agents.status.executionHistoryFailed"),
      );
    } finally {
      setIsLoadingAgentExecutions(false);
    }
  }

  function updateSelectedAgent(updater: (agent: AgentDraft) => AgentDraft) {
    if (!selectedAgentId) {
      return;
    }

    setAgents((currentAgents) =>
      currentAgents.map((agent) =>
        agent.id === selectedAgentId ? updater(agent) : agent,
      ),
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
    try {
      const [nextAgentDefinitions, runtimeGovernance] = await Promise.all([
        listAgentDefinitions(selectedTenantId, {
          status: statusFilter,
          mode: modeFilter,
          query: searchQuery,
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
          retrieval_profile_id: retrievalProfileFilterId || null,
        }),
      ]);
      const nextAgents = nextAgentDefinitions.map(mapAgentDefinitionToDraft);
      setAgents(nextAgents);
      setRuntimeGovernanceItems(runtimeGovernance.items);
    } catch (error) {
      setRuntimeGovernanceItems([]);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : t("agents.status.restoreFailed"),
      );
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
          listAgentRuns(
            selectedTenantId,
            selectedAgentId || null,
            8,
            agentRunFilters,
          ),
          listAgentRunMetrics(
            selectedTenantId,
            selectedAgentId || null,
            agentRunFilters,
          ),
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

        setErrorMessage(
          error instanceof Error
            ? error.message
            : t("agents.status.launchHistoryFailed"),
        );
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
        const [nextAgentExecutions, nextAgentExecutionMetrics] =
          await Promise.all([
            listAgentExecutions(
              selectedTenantId,
              selectedAgentId || null,
              8,
              agentExecutionFilters,
            ),
            listAgentExecutionMetrics(
              selectedTenantId,
              selectedAgentId || null,
              agentExecutionFilters,
            ),
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

        setErrorMessage(
          error instanceof Error
            ? error.message
            : t("agents.status.executionHistoryFailed"),
        );
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

  useEffect(() => {
    const hasActiveExecution = agentExecutions.some(
      (execution) => execution.execution_status === "queued" || execution.execution_status === "running",
    );
    if (!hasActiveExecution || !selectedTenantId) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void refreshAgentExecutionsForCurrentScope();
    }, 4000);
    return () => window.clearInterval(intervalId);
  }, [agentExecutions, agentExecutionFilters, selectedAgentId, selectedTenantId]);

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
      modelEndpointId:
        enabledModelEndpoints.find((modelEndpoint) => modelEndpoint.is_default)
          ?.id ?? "",
      objective: "",
      instructions: "",
      knowledgeBaseScope: "",
      tools: ["chat"],
      toolRegistrationIds: [],
      updatedAt: new Date().toISOString(),
    };

    setIsMutating(true);
    setErrorMessage(null);
    try {
      const createdAgent = mapAgentDefinitionToDraft(
        await createAgentDefinition(nextAgent),
      );
      await refreshAgentDefinitionsForSelectedTenant();
      setSelectedAgentId(createdAgent.id);
      setAgentSection("editor");
      setStatusMessage(t("agents.status.created"));
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : t("agents.status.createFailed"),
      );
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
      updatedAt: new Date().toISOString(),
    };

    setIsMutating(true);
    setErrorMessage(null);
    try {
      const createdAgent = mapAgentDefinitionToDraft(
        await createAgentDefinition(duplicatedAgent),
      );
      await refreshAgentDefinitionsForSelectedTenant();
      setSelectedAgentId(createdAgent.id);
      setAgentSection("editor");
      setStatusMessage(
        t("agents.status.duplicated", { name: selectedAgent.name }),
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : t("agents.status.createFailed"),
      );
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

    setIsMutating(true);
    setErrorMessage(null);
    try {
      await deleteAgentDefinition(selectedAgent.id, selectedAgent.tenantId);
      await refreshAgentDefinitionsForSelectedTenant();
      setSelectedAgentId("");
      setAgentSection("directory");
      setStatusMessage(
        t("agents.status.deleted", { name: selectedAgent.name }),
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : t("agents.status.deleteFailed"),
      );
      setStatusMessage(t("agents.status.deleteFailed"));
    } finally {
      setIsMutating(false);
    }
  }

  async function handleBulkDeleteAgents() {
    if (!hasAgentWriteAccess || selectedAgentIds.length === 0) {
      return;
    }

    const agentsToDelete = scopedAgents.filter((agent) => selectedAgentIds.includes(agent.id));
    setIsMutating(true);
    setErrorMessage(null);
    try {
      await Promise.all(agentsToDelete.map((agent) => deleteAgentDefinition(agent.id, agent.tenantId)));
      await refreshAgentDefinitionsForSelectedTenant();
      setSelectedAgentIds([]);
      if (selectedAgentId && selectedAgentIds.includes(selectedAgentId)) {
        setSelectedAgentId("");
        setAgentSection("directory");
      }
      setStatusMessage(t("agents.status.bulkDeleted", { count: String(agentsToDelete.length) }));
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
      toolRegistrations,
    });

    if (normalizedAgent.status === "active" && !readiness.isReady) {
      setErrorMessage(t("agents.status.activationBlocked"));
      setStatusMessage(t("agents.status.activationBlocked"));
      return;
    }

    setIsMutating(true);
    setErrorMessage(null);
    try {
      const savedAgent = mapAgentDefinitionToDraft(
        await updateAgentDefinition(normalizedAgent),
      );
      await refreshAgentDefinitionsForSelectedTenant();
      setSelectedAgentId(savedAgent.id);
      setStatusMessage(
        t("agents.status.saved", {
          name: savedAgent.name || t("agents.editor.newAgentName"),
        }),
      );
      setAgentSection("directory");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : t("agents.status.saveFailed"),
      );
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
      status: nextStatus,
    });
    const readiness = assessAgentReadiness(normalizedAgent, {
      workspaces,
      knowledgeBases,
      modelEndpoints,
      retrievalProfiles,
      toolRegistrations,
    });

    if (nextStatus === "active" && !readiness.isReady) {
      setErrorMessage(t("agents.status.activationBlocked"));
      setStatusMessage(t("agents.status.activationBlocked"));
      return;
    }

    setIsMutating(true);
    setErrorMessage(null);
    try {
      const savedAgent = mapAgentDefinitionToDraft(
        await updateAgentDefinition(normalizedAgent),
      );
      await refreshAgentDefinitionsForSelectedTenant();
      setSelectedAgentId(savedAgent.id);
      setStatusMessage(
        nextStatus === "active"
          ? t("agents.status.activated", { name: savedAgent.name })
          : nextStatus === "paused"
            ? t("agents.status.paused", { name: savedAgent.name })
            : t("agents.status.returnedToDraft", { name: savedAgent.name }),
      );
      setAgentSection("directory");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : t("agents.status.saveFailed"),
      );
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
        : [...agent.tools, tool],
    }));
  }

  function toggleRegisteredTool(toolRegistrationId: string) {
    if (!hasAgentWriteAccess) {
      return;
    }

    updateSelectedAgent((agent) => ({
      ...agent,
      toolRegistrationIds: agent.toolRegistrationIds.includes(
        toolRegistrationId,
      )
        ? agent.toolRegistrationIds.filter(
            (currentToolRegistrationId) =>
              currentToolRegistrationId !== toolRegistrationId,
          )
        : [...agent.toolRegistrationIds, toolRegistrationId],
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
      description: t("agents.connectivity.chatDescription"),
    },
    {
      tool: "documents",
      icon: FileText,
      label: t("agents.tools.documents"),
      description: t("agents.connectivity.documentsDescription"),
    },
    {
      tool: "operations",
      icon: Waypoints,
      label: t("agents.tools.operations"),
      description: t("agents.connectivity.operationsDescription"),
    },
    {
      tool: "admin",
      icon: ShieldCheck,
      label: t("agents.tools.admin"),
      description: t("agents.connectivity.adminDescription"),
    },
  ];

  function buildScopedToolHref(
    tool: AgentTool,
    options?: {
      draftQuestion?: string | null;
      documentStatus?: string | null;
      workflowStatus?:
        | "all"
        | "queued"
        | "running"
        | "failed"
        | "completed"
        | "pending"
        | null;
      workflowQuery?: string | null;
      workflowRetryMode?: "all" | "originals" | "retries" | null;
    },
  ) {
    const tenantId = selectedAgent?.tenantId ?? selectedTenantId;
    const agentId = selectedAgent?.id ?? null;

    if (
      (tool === "chat" || tool === "documents") &&
      tenantId &&
      selectedScopeWorkspace &&
      selectedScopeKnowledgeBase
    ) {
      return buildAgentsWorkspaceHref({
        view: tool === "chat" ? "chat" : "documents",
        tenantId,
        workspaceId: selectedScopeWorkspace.id,
        knowledgeBaseId: selectedScopeKnowledgeBase.id,
        agentId,
        handoffIntent: resolveAgentWorkspaceHandoffIntent(
          selectedAgent?.mode ?? "grounded_chat",
          tool === "chat" ? "chat" : "documents",
        ),
        draftQuestion: options?.draftQuestion ?? null,
        documentStatus:
          tool === "documents" ? (options?.documentStatus ?? null) : null,
      });
    }

    if (tool === "operations") {
      return buildOperationsHref({
        tenantId: tenantId || null,
        agentId,
        lane:
          selectedAgent?.mode === "workflow_recovery" ? "failed" : "overview",
        status:
          options?.workflowStatus ??
          (selectedAgent?.mode === "workflow_recovery" ? "failed" : "all"),
        retryMode: options?.workflowRetryMode ?? null,
        query: options?.workflowQuery ?? null,
      });
    }

    if (tool === "admin") {
      return buildAdminHref({
        tenantId: tenantId || null,
        section: "access",
      });
    }

    return tool === "chat"
      ? buildAgentsWorkspaceHref({
          view: "chat",
          tenantId: tenantId || null,
          agentId,
          handoffIntent: "agent_brief",
        })
      : buildAgentsWorkspaceHref({
          view: "documents",
          tenantId: tenantId || null,
          agentId,
          handoffIntent: resolveAgentWorkspaceHandoffIntent(
            selectedAgent?.mode ?? "grounded_chat",
            "documents",
          ),
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
      return resolveAgentWorkspaceHandoffIntent(
        selectedAgent.mode,
        "documents",
      );
    }

    if (surface === "operations") {
      return selectedAgent.mode === "workflow_recovery"
        ? "workflow_recovery"
        : "agent_brief";
    }

    return "governance_review";
  }

  async function handleLaunchSurface(
    surface: AgentRunTargetSurface,
    options?: {
      draftQuestion?: string | null;
      documentStatus?: string | null;
      workflowStatus?:
        | "all"
        | "queued"
        | "running"
        | "failed"
        | "completed"
        | "pending"
        | null;
      workflowQuery?: string | null;
      workflowRetryMode?: "all" | "originals" | "retries" | null;
    },
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
      (surface === "chat" ? (launchPrompts[0]?.trim() ?? null) : null);

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
        navigation_href: navigationHref,
      });
      await refreshAgentRunsForCurrentScope();
      setStatusMessage(
        t("agents.status.launchRecorded", { surface: surfaceLabel }),
      );
      window.location.assign(navigationHref);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : t("agents.status.launchFailed"),
      );
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
      const executionInput =
        launchPrompts[0]?.trim() || selectedAgent.objective.trim() || null;
      const parseOptionalInteger = (value: string) =>
        value.trim() ? Number.parseInt(value.trim(), 10) : undefined;
      let outputSchema: Record<string, unknown> | undefined;
      if (executionOutputSchema.trim()) {
        let parsedSchema: unknown;
        try {
          parsedSchema = JSON.parse(executionOutputSchema);
        } catch {
          throw new Error(t("agents.executions.policy.invalidSchema"));
        }
        if (!parsedSchema || typeof parsedSchema !== "object" || Array.isArray(parsedSchema)) {
          throw new Error(t("agents.executions.policy.invalidSchema"));
        }
        outputSchema = parsedSchema as Record<string, unknown>;
      }
      const execution = await createAgentExecution({
        tenant_id: selectedAgent.tenantId,
        agent_definition_id: selectedAgent.id,
        execution_input: executionInput,
        trigger_source: "agents_console",
        max_tool_calls: parseOptionalInteger(executionMaxToolCalls),
        max_runtime_seconds: parseOptionalInteger(executionMaxRuntimeSeconds),
        max_output_bytes: parseOptionalInteger(executionMaxOutputBytes),
        output_schema_json: outputSchema,
      });
      await refreshAgentExecutionsForCurrentScope();
      setAgentSection("executions");
      setStatusMessage(
        execution.execution_status === "completed"
          ? t("agents.status.executionCompleted")
          : execution.execution_status === "failed"
            ? t("agents.status.executionFailed")
            : t("agents.status.executionQueued"),
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : t("agents.status.executionFailed"),
      );
      setStatusMessage(t("agents.status.executionFailed"));
    } finally {
      setIsExecutingAgent(false);
    }
  }

  async function handleRetryAgentExecution(execution: AgentExecutionResponse) {
    if (!hasAgentExecutionAccess || execution.execution_status !== "failed") {
      return;
    }

    setRetryingExecutionId(execution.id);
    setErrorMessage(null);
    try {
      const retriedExecution = await retryAgentExecution(execution);
      await refreshAgentExecutionsForCurrentScope();
      setStatusMessage(
        retriedExecution.execution_status === "completed"
          ? t("agents.status.executionCompleted")
          : retriedExecution.execution_status === "failed"
            ? t("agents.status.executionFailed")
            : t("agents.status.executionQueued"),
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("agents.status.executionFailed"));
    } finally {
      setRetryingExecutionId(null);
    }
  }

  async function handleReplayAgentExecution(execution: AgentExecutionResponse) {
    if (
      !hasAgentExecutionAccess ||
      !["completed", "failed", "cancelled"].includes(execution.execution_status)
    ) {
      return;
    }

    setReplayingExecutionId(execution.id);
    setErrorMessage(null);
    try {
      await replayAgentExecution(execution);
      await refreshAgentExecutionsForCurrentScope();
      setStatusMessage(t("agents.executions.replayQueued"));
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : t("agents.executions.replayFailed"),
      );
    } finally {
      setReplayingExecutionId(null);
    }
  }

  async function handleCancelAgentExecution(execution: AgentExecutionResponse) {
    setCancellingExecutionId(execution.id);
    setErrorMessage(null);
    try {
      await cancelAgentExecution(execution);
      await refreshAgentExecutionsForCurrentScope();
      setStatusMessage(t("agents.status.executionCancelled"));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("agents.status.executionCancelFailed"));
    } finally {
      setCancellingExecutionId(null);
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
            ? t("agents.delivery.chatReady", {
                scope: selectedAgent.knowledgeBaseScope,
              })
            : t("agents.delivery.scopeRequired"),
        href: buildScopedToolHref("chat"),
      };
    }

    if (selectedAgent.mode === "document_intake") {
      return {
        title: t("agents.delivery.recommendedDocuments"),
        description:
          selectedScopeWorkspace && selectedScopeKnowledgeBase
            ? t("agents.delivery.documentsReady", {
                scope: selectedAgent.knowledgeBaseScope,
              })
            : t("agents.delivery.scopeRequired"),
        href: buildScopedToolHref("documents"),
      };
    }

    return {
      title: t("agents.delivery.recommendedOperations"),
      description: t("agents.delivery.operationsReady"),
      href: buildScopedToolHref("operations"),
    };
  }, [selectedAgent, selectedScopeKnowledgeBase, selectedScopeWorkspace, t]);

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
  }, [
    language,
    selectedAgent,
    selectedScopeKnowledgeBase,
    selectedScopeWorkspace,
  ]);

  const launchSurfaceCards = useMemo(() => {
    if (!selectedAgent) {
      return [];
    }

    const cards: Array<{
      key: string;
      title: string;
      description: string;
      href:
        | ReturnType<typeof buildWorkspaceHref>
        | ReturnType<typeof buildOperationsHref>
        | ReturnType<typeof buildAdminHref>;
      actionLabel: string;
    }> = [];

    if (selectedAgent.mode === "grounded_chat") {
      cards.push({
        key: "primary-chat",
        title: t("agents.delivery.primarySurface"),
        description: t("agents.delivery.primaryChatDescription"),
        href: buildScopedToolHref("chat", {
          draftQuestion: launchPrompts[0] ?? null,
        }),
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
        href: buildScopedToolHref("chat", {
          draftQuestion: launchPrompts[0] ?? null,
        }),
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
      href: buildScopedToolHref("operations", {
        workflowStatus: "failed",
        workflowRetryMode: "all",
      }),
      actionLabel: t("agents.delivery.openPrimary"),
    });
    cards.push({
      key: "chat-briefing",
      title: t("agents.delivery.secondarySurface"),
      description: t("agents.delivery.secondaryChatDescription"),
      href: buildScopedToolHref("chat", {
        draftQuestion: launchPrompts[0] ?? null,
      }),
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
        ? t("agents.delivery.checkScopeReady", {
            scope: selectedAgent.knowledgeBaseScope,
          })
        : t("agents.delivery.checkScopeMissing"),
    );
    checklist.push(
      selectedModelEndpoint
        ? t("agents.delivery.checkModelReady", {
            name: selectedModelEndpoint.name,
          })
        : t("agents.delivery.checkModelInherited"),
    );
    checklist.push(
      countConnectedCapabilities(selectedAgent) > 0
        ? t("agents.delivery.checkToolsReady", {
            count: String(countConnectedCapabilities(selectedAgent)),
          })
        : t("agents.delivery.checkToolsMissing"),
    );
    return checklist;
  }, [selectedAgent, selectedModelEndpoint, t]);

  const runtimeTaskPacket = useMemo(() => {
    const connectedCapabilityCount = selectedAgent
      ? countConnectedCapabilities(selectedAgent)
      : 0;
    const launchReady = selectedAgent
      ? selectedAgent.mode === "workflow_recovery" ||
        Boolean(selectedScopeWorkspace && selectedScopeKnowledgeBase)
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
        ? (recommendedRoute?.description ?? t("agents.delivery.scopeRequired"))
        : t("agents.delivery.selectAgent"),
      objective: selectedAgent?.objective.trim().length
        ? selectedAgent.objective
        : t("agents.delivery.runtimeTaskNoObjective"),
      primaryActionHref:
        recommendedRoute?.href ??
        buildAgentsHref({
          tenantId: selectedTenantId || null,
          agentId: selectedAgent?.id ?? null,
        }),
      prompt: launchPrompts[0] ?? t("agents.delivery.runtimeTaskNoPrompt"),
      secondaryActions: [
        {
          label: t("agents.delivery.runtimeTaskOpenOperations"),
          href: buildScopedToolHref("operations"),
        },
        {
          label: t("agents.delivery.runtimeTaskOpenAdmin"),
          href: buildScopedToolHref("admin"),
        },
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
          value: selectedAgent
            ? t(`agents.modes.${selectedAgent.mode}`)
            : t("agents.delivery.runtimeTaskPending"),
        },
        {
          label: t("agents.delivery.runtimeTaskFields.target"),
          value: targetLabel,
        },
        {
          label: t("agents.delivery.runtimeTaskFields.scope"),
          value: !selectedAgent
            ? t("agents.delivery.runtimeTaskPending")
            : selectedAgent.mode === "workflow_recovery"
              ? t("agents.delivery.runtimeTaskScopeNotRequired")
              : selectedScopeWorkspace && selectedScopeKnowledgeBase
                ? `${selectedScopeWorkspace.name} / ${selectedScopeKnowledgeBase.name}`
                : selectedAgent.knowledgeBaseScope ||
                  t("agents.executionPackets.scopePending"),
        },
        {
          label: t("agents.delivery.runtimeTaskFields.model"),
          value:
            selectedAgentReadiness?.resolvedModelEndpoint?.name ??
            t("agents.executionPackets.modelInherited"),
        },
        {
          label: t("agents.delivery.runtimeTaskFields.capabilities"),
          value: t("agents.delivery.runtimeTaskCapabilitiesValue", {
            count: String(connectedCapabilityCount),
          }),
        },
      ],
      title: recommendedRoute?.title ?? t("agents.delivery.noRecommendation"),
    };
  }, [
    launchPrompts,
    recommendedRoute,
    selectedAgent,
    selectedAgentReadiness,
    selectedScopeKnowledgeBase,
    selectedScopeWorkspace,
    selectedTenantId,
    t,
  ]);

  const latestAgentExecution = agentExecutions[0] ?? null;
  const latestAgentExecutionLinkedAgent = latestAgentExecution
    ? (scopedAgentById.get(latestAgentExecution.agent_definition_id) ??
      selectedAgent ??
      null)
    : null;
  const latestAgentExecutionEvidenceSummary = latestAgentExecution
    ? readAgentExecutionEvidenceSummary(
        latestAgentExecution.result_payload_json,
      )
    : null;
  const latestAgentExecutionFollowUpActions = latestAgentExecution
    ? buildAgentExecutionFollowUpActions({
        sourceContext: { surface: "agents" },
        execution: latestAgentExecution,
        executionInput: latestAgentExecutionEvidenceSummary?.executionInput,
        recommendedActions:
          latestAgentExecutionEvidenceSummary?.recommendedActionSpecs ?? [],
      })
    : [];

  const latestExecutionTaskPacket = useMemo(() => {
    const secondaryActions: RuntimePacketAction[] = [];
    latestAgentExecutionFollowUpActions.slice(1, 3).forEach((action) => {
      appendUniqueRuntimePacketAction(secondaryActions, {
        label: action.labelKey ? t(action.labelKey) : (action.label ?? ""),
        href: action.href,
      });
    });
    appendUniqueRuntimePacketAction(
      secondaryActions,
      selectedRuntimeSettingsHref
        ? {
            label: t("agents.executions.latestPacket.openSettings"),
            href: selectedRuntimeSettingsHref,
          }
        : null,
    );
    appendUniqueRuntimePacketAction(secondaryActions, {
      label: t("agents.executions.latestPacket.openDefinitions"),
      href: selectedRuntimeFollowUp.definitionsHref,
    });

    if (!latestAgentExecution) {
      return {
        detail: t("agents.executions.latestPacket.emptyDetail"),
        objective: t("agents.executions.latestPacket.emptyObjective"),
        primaryActionHref: buildAgentsHref({
          tenantId: selectedTenantId || null,
          agentId: selectedAgent?.id ?? null,
        }),
        primaryActionLabel: t("agents.executions.latestPacket.openDefinitions"),
        prompt: t("agents.executions.latestPacket.emptyPrompt"),
        secondaryActions,
        statusLabel: t("agents.executionPackets.statuses.review"),
        statusTone: "review" as const,
        summaryItems: [
          {
            label: t("agents.executions.latestPacket.fields.status"),
            value: t("agents.executionPackets.statuses.review"),
          },
          {
            label: t("agents.executions.latestPacket.fields.stage"),
            value: t("agents.executionPackets.notSelected"),
          },
          {
            label: t("agents.executions.latestPacket.fields.scope"),
            value: t("agents.executionPackets.scopePending"),
          },
          {
            label: t("agents.executions.latestPacket.fields.outputs"),
            value: "0",
          },
          {
            label: t("agents.executions.latestPacket.fields.followUps"),
            value: "0",
          },
        ],
        title: t("agents.executions.latestPacket.title"),
      };
    }

    const primaryAction = latestAgentExecutionFollowUpActions[0] ?? null;
    const fallbackStatusLabel = t(
      `agents.executions.statuses.${latestAgentExecution.execution_status}`,
    );
    const scopeValue =
      latestAgentExecution.knowledge_base_scope?.trim() ||
      (selectedScopeWorkspace && selectedScopeKnowledgeBase
        ? `${selectedScopeWorkspace.name} / ${selectedScopeKnowledgeBase.name}`
        : t("agents.executionPackets.scopePending"));

    const detail =
      latestAgentExecution.execution_status === "completed"
        ? t("agents.executions.latestPacket.completedDetail")
        : latestAgentExecution.execution_status === "failed"
          ? latestAgentExecution.error_message?.trim() ||
            t("agents.executions.latestPacket.failedDetail")
          : latestAgentExecution.execution_status === "running"
            ? t("agents.executions.latestPacket.runningDetail")
            : latestAgentExecution.execution_status === "awaiting_approval"
              ? t("agents.executions.latestPacket.awaitingApprovalDetail")
            : latestAgentExecution.execution_status === "cancelled"
              ? t("agents.executions.latestPacket.cancelledDetail")
              : t("agents.executions.latestPacket.queuedDetail");

    return {
      detail,
      objective:
        latestAgentExecution.summary?.trim() ||
        latestAgentExecutionLinkedAgent?.objective?.trim() ||
        t("agents.executions.pendingSummary"),
      primaryActionHref:
        primaryAction?.href ??
        selectedRuntimeSettingsHref ??
        buildAgentsHref({
          tenantId: latestAgentExecution.tenant_id,
          agentId: latestAgentExecution.agent_definition_id,
        }),
      primaryActionLabel: primaryAction
        ? primaryAction.labelKey
          ? t(primaryAction.labelKey)
          : (primaryAction.label ??
            t("agents.executions.latestPacket.openDefinitions"))
        : selectedRuntimeSettingsHref
          ? t("agents.executions.latestPacket.openSettings")
          : t("agents.executions.latestPacket.openDefinitions"),
      prompt:
        latestAgentExecutionEvidenceSummary?.executionInput ||
        latestAgentExecution.execution_input ||
        t("agents.executions.latestPacket.emptyPrompt"),
      secondaryActions,
      statusLabel: fallbackStatusLabel,
      statusTone:
        latestAgentExecution.execution_status === "completed"
          ? ("healthy" as const)
          : latestAgentExecution.execution_status === "failed" ||
              latestAgentExecution.execution_status === "cancelled"
            ? ("attention" as const)
            : ("review" as const),
      summaryItems: [
        {
          label: t("agents.executions.latestPacket.fields.status"),
          value: fallbackStatusLabel,
        },
        {
          label: t("agents.executions.latestPacket.fields.stage"),
          value: latestAgentExecution.task_state
            ? t(
                getAgentExecutionStageLabelKey(
                  latestAgentExecution.task_state.stage_key,
                ),
              )
            : t("agents.executions.pendingSummary"),
        },
        {
          label: t("agents.executions.latestPacket.fields.scope"),
          value: scopeValue,
        },
        {
          label: t("agents.executions.latestPacket.fields.outputs"),
          value: String(latestAgentExecution.generated_outputs?.length ?? 0),
        },
        {
          label: t("agents.executions.latestPacket.fields.followUps"),
          value: String(latestAgentExecutionFollowUpActions.length),
        },
      ],
      title:
        latestAgentExecutionLinkedAgent?.name ??
        t("agents.executions.latestPacket.title"),
    };
  }, [
    latestAgentExecution,
    latestAgentExecutionEvidenceSummary,
    latestAgentExecutionFollowUpActions,
    latestAgentExecutionLinkedAgent,
    selectedAgent,
    selectedRuntimeFollowUp.definitionsHref,
    selectedRuntimeSettingsHref,
    selectedScopeKnowledgeBase,
    selectedScopeWorkspace,
    selectedTenantId,
    t,
  ]);

  const latestAgentRun = agentRuns[0] ?? null;
  const latestAgentRunLinkedAgent = latestAgentRun
    ? (scopedAgentById.get(latestAgentRun.agent_definition_id) ??
      selectedAgent ??
      null)
    : null;

  const latestRunTaskPacket = useMemo(() => {
    const secondaryActions: RuntimePacketAction[] = [];
    appendUniqueRuntimePacketAction(
      secondaryActions,
      selectedRuntimeSettingsHref
        ? {
            label: t("agents.runs.latestPacket.openSettings"),
            href: selectedRuntimeSettingsHref,
          }
        : null,
    );
    appendUniqueRuntimePacketAction(secondaryActions, {
      label: t("agents.runs.latestPacket.openDefinitions"),
      href: selectedRuntimeFollowUp.definitionsHref,
    });
    appendUniqueRuntimePacketAction(secondaryActions, {
      label: t("agents.runs.latestPacket.openAdmin"),
      href: buildAdminHref({
        tenantId: selectedTenantId || null,
        section: "access",
      }),
    });

    if (!latestAgentRun) {
      return {
        detail: t("agents.runs.latestPacket.emptyDetail"),
        objective: t("agents.runs.latestPacket.emptyObjective"),
        primaryActionHref: buildAgentsHref({
          tenantId: selectedTenantId || null,
          agentId: selectedAgent?.id ?? null,
        }),
        primaryActionLabel: t("agents.runs.latestPacket.openDefinitions"),
        primaryActionRunRecord: null,
        prompt: t("agents.runs.noPrompt"),
        secondaryActions,
        statusLabel: t("agents.executionPackets.statuses.review"),
        statusTone: "review" as const,
        summaryItems: [
          {
            label: t("agents.runs.latestPacket.fields.status"),
            value: t("agents.executionPackets.statuses.review"),
          },
          {
            label: t("agents.runs.latestPacket.fields.surface"),
            value: t("agents.executionPackets.notSelected"),
          },
          {
            label: t("agents.runs.latestPacket.fields.source"),
            value: t("agents.executionPackets.notSelected"),
          },
          {
            label: t("agents.runs.latestPacket.fields.intent"),
            value: t("agents.executionPackets.notSelected"),
          },
          {
            label: t("agents.runs.latestPacket.fields.scope"),
            value: t("agents.executionPackets.scopePending"),
          },
        ],
        title: t("agents.runs.latestPacket.title"),
      };
    }

    const scopeValue =
      latestAgentRunLinkedAgent?.knowledgeBaseScope?.trim() ||
      (selectedScopeWorkspace && selectedScopeKnowledgeBase
        ? `${selectedScopeWorkspace.name} / ${selectedScopeKnowledgeBase.name}`
        : t("agents.executionPackets.scopePending"));

    const detail =
      latestAgentRun.run_status === "completed"
        ? t("agents.runs.latestPacket.completedDetail", {
            surface: t(`agents.tools.${latestAgentRun.target_surface}`),
          })
        : latestAgentRun.run_status === "failed"
          ? t("agents.runs.latestPacket.failedDetail", {
              surface: t(`agents.tools.${latestAgentRun.target_surface}`),
            })
          : latestAgentRun.run_status === "cancelled"
            ? t("agents.runs.latestPacket.cancelledDetail", {
                surface: t(`agents.tools.${latestAgentRun.target_surface}`),
              })
            : t("agents.runs.latestPacket.launchedDetail", {
                surface: t(`agents.tools.${latestAgentRun.target_surface}`),
              });

    return {
      detail,
      objective:
        latestAgentRunLinkedAgent?.objective?.trim() ||
        t("agents.runs.latestPacket.emptyObjective"),
      primaryActionHref:
        latestAgentRun.navigation_href ||
        buildAgentsHref({
          tenantId: latestAgentRun.tenant_id,
          agentId: latestAgentRun.agent_definition_id,
        }),
      primaryActionLabel: latestAgentRun.navigation_href
        ? t("agents.runs.openRoute")
        : t("agents.runs.latestPacket.openDefinitions"),
      primaryActionRunRecord: latestAgentRun.navigation_href
        ? {
            tenant_id: latestAgentRun.tenant_id,
            agent_definition_id: latestAgentRun.agent_definition_id,
            workspace_id: latestAgentRun.workspace_id,
            knowledge_base_id: latestAgentRun.knowledge_base_id,
            target_surface: latestAgentRun.target_surface,
            handoff_intent: latestAgentRun.handoff_intent,
            trigger_source: "agents_console" as const,
            launch_prompt: latestAgentRun.launch_prompt,
          }
        : null,
      prompt: latestAgentRun.launch_prompt?.trim() || t("agents.runs.noPrompt"),
      secondaryActions,
      statusLabel: t(`agents.runs.statuses.${latestAgentRun.run_status}`),
      statusTone:
        latestAgentRun.run_status === "completed"
          ? ("healthy" as const)
          : latestAgentRun.run_status === "failed" ||
              latestAgentRun.run_status === "cancelled"
            ? ("attention" as const)
            : ("review" as const),
      summaryItems: [
        {
          label: t("agents.runs.latestPacket.fields.status"),
          value: t(`agents.runs.statuses.${latestAgentRun.run_status}`),
        },
        {
          label: t("agents.runs.latestPacket.fields.surface"),
          value: t(`agents.tools.${latestAgentRun.target_surface}`),
        },
        {
          label: t("agents.runs.latestPacket.fields.source"),
          value: formatAgentRunTriggerSourceLabel(
            latestAgentRun.trigger_source,
            t,
          ),
        },
        {
          label: t("agents.runs.latestPacket.fields.intent"),
          value:
            latestAgentRun.handoff_intent || t("agents.runs.noHandoffIntent"),
        },
        {
          label: t("agents.runs.latestPacket.fields.scope"),
          value: scopeValue,
        },
      ],
      title:
        latestAgentRunLinkedAgent?.name ?? t("agents.runs.latestPacket.title"),
    };
  }, [
    latestAgentRun,
    latestAgentRunLinkedAgent,
    selectedAgent,
    selectedRuntimeFollowUp.definitionsHref,
    selectedRuntimeSettingsHref,
    selectedScopeKnowledgeBase,
    selectedScopeWorkspace,
    selectedTenantId,
    t,
  ]);

  function handleWorkspaceScopeChange(workspaceId: string) {
    if (!hasAgentWriteAccess) {
      return;
    }

    if (workspaceId === "unscoped") {
      updateSelectedAgent((agent) => ({
        ...agent,
        knowledgeBaseScope: "",
      }));
      return;
    }

    const workspace =
      workspaces.find((item) => item.id === workspaceId) ?? null;
    const firstKnowledgeBase =
      knowledgeBases.find((item) => item.workspace_id === workspaceId) ?? null;
    updateSelectedAgent((agent) => ({
      ...agent,
      knowledgeBaseScope:
        workspace && firstKnowledgeBase
          ? buildKnowledgeBaseScope(workspace.slug, firstKnowledgeBase.slug)
          : "",
    }));
  }

  function handleKnowledgeBaseScopeChange(knowledgeBaseId: string) {
    if (!hasAgentWriteAccess) {
      return;
    }

    if (!selectedAgentScopeSelection.workspaceId) {
      return;
    }

    const workspace =
      workspaces.find(
        (item) => item.id === selectedAgentScopeSelection.workspaceId,
      ) ?? null;
    const knowledgeBase =
      knowledgeBases.find((item) => item.id === knowledgeBaseId) ?? null;
    updateSelectedAgent((agent) => ({
      ...agent,
      knowledgeBaseScope:
        workspace && knowledgeBase
          ? buildKnowledgeBaseScope(workspace.slug, knowledgeBase.slug)
          : "",
    }));
  }

  const [agentSection, setAgentSection] = useState<
    "directory" | "editor" | "delivery" | "executions" | "runs"
  >("directory");
  const canOperateSelectedAgentRuntime = Boolean(
    hasAgentExecutionAccess &&
    selectedAgent &&
    selectedAgent.status === "active" &&
    selectedAgentReadiness?.isReady,
  );
  return (
    <ConsoleShell activeHref="/agents">
      <PageTitleSync title={t("agents.title")} />
      <ConsolePage className="gap-6">
        <div className="min-w-0 overflow-visible rounded-xl border border-slate-200/80 bg-white shadow-[0_18px_52px_rgba(15,23,42,0.06)] xl:overflow-hidden">
            <ConsoleSurface className="console-split-layout overflow-visible rounded-none border-0 shadow-none lg:overflow-hidden">
              <div className="console-split-sidebar flex flex-col bg-slate-50/70 dark:bg-slate-950/70">
              <div className="p-4">
                <div className="mb-4 text-lg font-semibold text-slate-950 dark:text-slate-50">{t("shell.nav.agents")}</div>
                <Button
                  className="w-full justify-center"
                  disabled={!hasAgentWriteAccess || !selectedTenantId || isMutating}
                  onClick={() => void handleCreateAgent()}
                  type="button"
                >
                  <Plus className="h-4 w-4" />
                  {t("agents.actions.newDraft")}
                </Button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto border-t border-slate-200 p-4">
                <div className="mb-2 px-1 text-xs font-semibold uppercase tracking-[.14em] text-slate-500">{t("agents.filters.filterTitle")}</div>
                <div className="grid gap-2">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input className="bg-white pl-9" onChange={(event) => setSearchQuery(event.target.value)} placeholder={t("agents.filters.searchPlaceholder")} value={searchQuery} />
                  </div>
                  <Select onValueChange={(value) => setStatusFilter(value as AgentStatusFilter)} value={statusFilter}>
                    <SelectTrigger className="bg-white"><SelectValue placeholder={t("agents.filters.status")} /></SelectTrigger>
                    <SelectContent><SelectItem value="all">{t("agents.filters.allStatuses")}</SelectItem><SelectItem value="draft">{t("agents.statuses.draft")}</SelectItem><SelectItem value="active">{t("agents.statuses.active")}</SelectItem><SelectItem value="paused">{t("agents.statuses.paused")}</SelectItem></SelectContent>
                  </Select>
                  <Select onValueChange={(value) => setModeFilter(value as AgentModeFilter)} value={modeFilter}>
                    <SelectTrigger className="bg-white"><SelectValue placeholder={t("agents.filters.mode")} /></SelectTrigger>
                    <SelectContent><SelectItem value="all">{t("agents.filters.allModes")}</SelectItem><SelectItem value="grounded_chat">{t("agents.modes.grounded_chat")}</SelectItem><SelectItem value="document_intake">{t("agents.modes.document_intake")}</SelectItem><SelectItem value="workflow_recovery">{t("agents.modes.workflow_recovery")}</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
              </div>
              <div className="console-split-content console-split-content-padding flex-1 bg-white dark:bg-slate-950">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-950 dark:text-slate-50">{t("agents.directory.title")}</h2>
                    <p className="mt-1 text-sm text-slate-500">{t("agents.directory.description")}</p>
                  </div>
                  {selectedAgentIds.length > 0 ? (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-blue-700">{t("agents.directory.selectedCount", { count: String(selectedAgentIds.length) })}</span>
                      <Button onClick={() => setSelectedAgentIds([])} size="sm" type="button" variant="outline">{t("agents.directory.clearSelection")}</Button>
                      <Button className="border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-700" disabled={!hasAgentWriteAccess || isMutating} onClick={() => setIsBulkDeleteAgentDialogOpen(true)} size="sm" type="button" variant="outline"><Trash2 className="h-4 w-4" />{t("agents.directory.deleteSelected")}</Button>
                    </div>
                  ) : null}
                </div>
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <Table className="border-separate border-spacing-0">
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead className="w-12 px-3"><button aria-label={t("agents.directory.selectPage")} className={cn("flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-slate-100", allAgentsOnPageSelected ? "text-blue-600" : "text-slate-400 hover:text-slate-600")} onClick={() => setSelectedAgentIds((ids) => allAgentsOnPageSelected ? ids.filter((id) => !paginatedAgents.some((agent) => agent.id === id)) : Array.from(new Set([...ids, ...paginatedAgents.map((agent) => agent.id)])))} type="button">{allAgentsOnPageSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}</button></TableHead>
                        <TableHead className="px-5">{t("agents.directory.agent")}</TableHead>
                        <TableHead>{t("agents.directory.status")}</TableHead>
                        <TableHead>{t("agents.directory.mode")}</TableHead>
                        <TableHead>{t("agents.directory.scope")}</TableHead>
                        <TableHead>{t("agents.directory.updated")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="bg-white text-sm text-slate-700">
                {scopedAgents.length === 0 ? (
                  <TableRow><TableCell className="px-5 py-10 text-center text-sm text-muted-foreground" colSpan={6}>{t("agents.directory.empty")}</TableCell></TableRow>
                ) : (
                  paginatedAgents.map((agent) => {
                    const readiness = readinessByAgentId.get(agent.id);

                    return (
                      <TableRow
                        className={cn(
                          "cursor-pointer border-b border-slate-100 transition hover:bg-slate-50 [&>td]:py-[14px]",
                          selectedAgentId === agent.id
                            ? "bg-blue-50/70"
                            : "bg-white",
                        )}
                        key={agent.id}
                        onClick={() => {
                          setSelectedAgentId(agent.id);
                          setAgentSection("editor");
                        }}
                      >
                        <TableCell className="px-3 align-middle"><button aria-label={t("agents.directory.selectAgent", { name: agent.name })} className={cn("flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-slate-100", selectedAgentIds.includes(agent.id) ? "text-blue-600" : "text-slate-400 hover:text-slate-600")} onClick={(event) => { event.stopPropagation(); setSelectedAgentIds((ids) => ids.includes(agent.id) ? ids.filter((id) => id !== agent.id) : [...ids, agent.id]); }} type="button">{selectedAgentIds.includes(agent.id) ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}</button></TableCell>
                        <TableCell className="px-5 align-middle"><div className="font-medium text-slate-900">{agent.name}</div></TableCell>
                        <TableCell className="align-middle"><div className="flex items-center gap-2"><Badge className={cn("border", getAgentStatusClass(agent.status))} variant="outline">{t(`agents.statuses.${agent.status}`)}</Badge>{!readiness?.isReady ? <Badge className="border-amber-200 bg-amber-50 text-amber-700" variant="outline">{t("agents.readiness.attention")}</Badge> : null}</div></TableCell>
                        <TableCell className="align-middle text-sm text-slate-600">{t(`agents.modes.${agent.mode}`)}</TableCell>
                        <TableCell className="max-w-64 align-middle"><div className="truncate text-sm text-slate-600">{agent.knowledgeBaseScope.trim() || t("agents.metrics.noScope")}</div></TableCell>
                        <TableCell className="align-middle text-xs text-slate-500">{formatUpdatedAt(agent.updatedAt, language)}</TableCell>
                      </TableRow>
                    );
                  })
                )}
                    </TableBody>
                  </Table>
                  <PaginationControls currentPage={agentPage} onPageChange={setAgentPage} pageCount={agentPageCount} pageSize={agentPageSize} totalItems={scopedAgents.length} />
                </div>
              </div>
            </ConsoleSurface>

          <FormDialog
            eyebrow={t("agents.editor.detailTitle")}
            footer={
              <DialogFormActions className="items-center justify-between">
                <Button
                  className="rounded-xl border-rose-200 bg-white text-rose-700 hover:bg-rose-50 hover:text-rose-700"
                  disabled={
                    !hasAgentWriteAccess || !selectedAgent || isMutating
                  }
                  onClick={() => setIsDeleteAgentDialogOpen(true)}
                  type="button"
                  variant="outline"
                >
                  <Trash2 className="h-4 w-4" />
                  {t("agents.actions.delete")}
                </Button>
                <div className="flex flex-wrap justify-end gap-3">
                  <Button
                    className="rounded-xl bg-white"
                    disabled={isMutating}
                    onClick={() => setAgentSection("directory")}
                    type="button"
                    variant="outline"
                  >
                    {t("workspace.headerBar.cancel")}
                  </Button>
                  <Button
                    className="rounded-xl"
                    disabled={
                      !hasAgentWriteAccess || !selectedAgent || isMutating
                    }
                    onClick={() => void handleSaveAgent()}
                    type="button"
                  >
                    <Save className="h-4 w-4" />
                    {t("agents.actions.saveDraft")}
                  </Button>
                </div>
              </DialogFormActions>
            }
            onClose={() => setAgentSection("directory")}
            open={agentSection === "editor"}
            presentation="side"
            size="xl"
            title={selectedAgent?.name ?? t("agents.editor.title")}
            titleClassName="text-base"
          >
            {selectedAgent ? (
              <DialogFormLayout>
                <DialogFormGrid className="xl:grid-cols-3">
                  <div className="xl:col-span-2">
                  <DialogFormField label={t("agents.editor.name")}>
                    <Input
                      disabled={!hasAgentWriteAccess}
                      onChange={(event) => {
                        const nextName = event.target.value;
                        updateSelectedAgent((agent) => ({
                          ...agent,
                          name: nextName,
                          slug:
                            agent.slug.trim().length === 0
                              ? slugifyValue(nextName)
                              : agent.slug,
                        }));
                      }}
                      placeholder={t("agents.editor.namePlaceholder")}
                      value={selectedAgent.name}
                    />
                  </DialogFormField>
                  </div>
                  <DialogFormField label={t("agents.editor.slug")}>
                    <Input
                      disabled={!hasAgentWriteAccess}
                      onChange={(event) => {
                        const nextSlug = slugifyValue(event.target.value);
                        updateSelectedAgent((agent) => ({
                          ...agent,
                          slug: nextSlug,
                        }));
                      }}
                      placeholder={t("agents.editor.slugPlaceholder")}
                      value={selectedAgent.slug}
                    />
                  </DialogFormField>
                </DialogFormGrid>

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="flex items-center gap-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      {t("agents.editor.status")}
                    </div>
                    <Badge className={cn("border", getAgentStatusClass(selectedAgent.status))} variant="outline">
                      {t(`agents.statuses.${selectedAgent.status}`)}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {selectedAgent.status !== "active" ? (
                      <Button className="rounded-xl bg-white" disabled={!hasAgentWriteAccess || isMutating} onClick={() => void handleTransitionAgentStatus("active")} size="sm" type="button" variant="outline">
                        <CheckCircle2 className="h-4 w-4" />
                        {t("agents.actions.activate")}
                      </Button>
                    ) : (
                      <Button className="rounded-xl bg-white" disabled={!hasAgentWriteAccess || isMutating} onClick={() => void handleTransitionAgentStatus("paused")} size="sm" type="button" variant="outline">
                        <Waypoints className="h-4 w-4" />
                        {t("agents.actions.pause")}
                      </Button>
                    )}
                    {canOperateSelectedAgentRuntime ? (
                      <Button className="rounded-xl bg-white" disabled={isExecutingAgent} onClick={() => void handleExecuteAgent()} size="sm" type="button" variant="outline">
                        <BrainCircuit className="h-4 w-4" />
                        {isExecutingAgent ? t("agents.actions.executing") : t("agents.actions.execute")}
                      </Button>
                    ) : null}
                  </div>
                </div>

                <DialogFormGrid className="xl:grid-cols-3">
                  <DialogFormField label={t("agents.editor.mode")}>
                    <Select
                      disabled={!hasAgentWriteAccess}
                      onValueChange={(value) => {
                        updateSelectedAgent((agent) => ({
                          ...agent,
                          mode: value as AgentMode,
                        }));
                      }}
                      value={selectedAgent.mode}
                    >
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder={t("agents.editor.mode")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="grounded_chat">
                          {t("agents.modes.grounded_chat")}
                        </SelectItem>
                        <SelectItem value="document_intake">
                          {t("agents.modes.document_intake")}
                        </SelectItem>
                        <SelectItem value="workflow_recovery">
                          {t("agents.modes.workflow_recovery")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </DialogFormField>

                  <DialogFormField label={t("agents.editor.modelStrategy")}>
                    <Select
                      disabled={!hasAgentWriteAccess}
                      onValueChange={(value) => {
                        updateSelectedAgent((agent) => ({
                          ...agent,
                          modelStrategy: value as ModelStrategy,
                        }));
                      }}
                      value={selectedAgent.modelStrategy}
                    >
                      <SelectTrigger className="bg-white">
                        <SelectValue
                          placeholder={t("agents.editor.modelStrategy")}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="local_reserved">
                          {t("agents.modelStrategies.local_reserved")}
                        </SelectItem>
                        <SelectItem value="remote_reserved">
                          {t("agents.modelStrategies.remote_reserved")}
                        </SelectItem>
                        <SelectItem value="hybrid_reserved">
                          {t("agents.modelStrategies.hybrid_reserved")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </DialogFormField>

                  <DialogFormField label={t("agents.editor.runtimeModel")}>
                    <Select
                      disabled={!hasAgentWriteAccess}
                      onValueChange={(value) => {
                        updateSelectedAgent((agent) => ({
                          ...agent,
                          modelEndpointId:
                            value === "inherit_strategy" ? "" : value,
                        }));
                      }}
                      value={
                        selectedAgent.modelEndpointId || "inherit_strategy"
                      }
                    >
                      <SelectTrigger className="bg-white">
                        <SelectValue
                          placeholder={t("agents.editor.runtimeModel")}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="inherit_strategy">
                          {t("agents.editor.runtimeModelInherited")}
                        </SelectItem>
                        {availableModelEndpoints.map((modelEndpoint) => (
                          <SelectItem
                            key={modelEndpoint.id}
                            value={modelEndpoint.id}
                          >
                            {modelEndpoint.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </DialogFormField>
                </DialogFormGrid>

                <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
                <DialogFormGrid>
                  <DialogFormField label={t("agents.editor.workspaceScope")}>
                    <Select
                      disabled={!hasAgentWriteAccess}
                      onValueChange={handleWorkspaceScopeChange}
                      value={
                        selectedAgentScopeSelection.workspaceId || "unscoped"
                      }
                    >
                      <SelectTrigger className="bg-white">
                        <SelectValue
                          placeholder={t("agents.editor.workspaceScope")}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unscoped">
                          {t("agents.editor.unscoped")}
                        </SelectItem>
                        {workspaces.map((workspace) => (
                          <SelectItem key={workspace.id} value={workspace.id}>
                            {workspace.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </DialogFormField>
                  <DialogFormField
                    label={t("agents.editor.knowledgeBaseScope")}
                  >
                    <Select
                      disabled={
                        !hasAgentWriteAccess ||
                        !selectedAgentScopeSelection.workspaceId ||
                        selectedAgentScopeKnowledgeBases.length === 0
                      }
                      onValueChange={handleKnowledgeBaseScopeChange}
                      value={
                        selectedAgentScopeSelection.knowledgeBaseId || undefined
                      }
                    >
                      <SelectTrigger className="bg-white">
                        <SelectValue
                          placeholder={t("agents.editor.scopePlaceholder")}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {selectedAgentScopeKnowledgeBases.map(
                          (knowledgeBase) => (
                            <SelectItem
                              key={knowledgeBase.id}
                              value={knowledgeBase.id}
                            >
                              {knowledgeBase.name}
                            </SelectItem>
                          ),
                        )}
                      </SelectContent>
                    </Select>
                  </DialogFormField>
                </DialogFormGrid>
                  <div className="text-xs leading-5 text-slate-500">
                    {t("agents.editor.scopePreview")}: <span className="font-medium text-slate-700">{selectedAgent.knowledgeBaseScope || t("agents.editor.unscoped")}</span>
                  </div>
                </div>

                <DialogFormField label={t("agents.editor.objective")}>
                  <Textarea
                    disabled={!hasAgentWriteAccess}
                    className="min-h-[72px] resize-y"
                    onChange={(event) => {
                      updateSelectedAgent((agent) => ({
                        ...agent,
                        objective: event.target.value,
                      }));
                    }}
                    placeholder={t("agents.editor.objectivePlaceholder")}
                    value={selectedAgent.objective}
                  />
                </DialogFormField>

                <DialogFormField label={t("agents.editor.instructions")}>
                  <Textarea
                    disabled={!hasAgentWriteAccess}
                    className="min-h-[128px] resize-y"
                    onChange={(event) => {
                      updateSelectedAgent((agent) => ({
                        ...agent,
                        instructions: event.target.value,
                      }));
                    }}
                    placeholder={t("agents.editor.instructionsPlaceholder")}
                    value={selectedAgent.instructions}
                  />
                </DialogFormField>

                <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      {t("agents.editor.tools")}
                    </div>
                    <div className="mt-1 text-sm text-slate-500">
                      {t("agents.editor.toolHint")}
                    </div>
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
                              : "border-slate-200 bg-white hover:border-slate-300",
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
                              <div className="text-sm font-semibold text-slate-950">
                                {item.label}
                              </div>
                              <Badge
                                className={cn(
                                  "border",
                                  isEnabled
                                    ? "border-blue-200 bg-white text-blue-700"
                                    : "border-slate-200 bg-slate-50 text-slate-600",
                                )}
                                variant="outline"
                              >
                                {isEnabled
                                  ? t("agents.connectivity.enabled")
                                  : t("agents.connectivity.disabled")}
                              </Badge>
                            </div>
                            <div className="mt-1 text-sm leading-6 text-slate-500">
                              {item.description}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      {t("agents.editor.registeredTools")}
                    </div>
                    <div className="mt-1 text-sm text-slate-500">
                      {t("agents.editor.registeredToolsHint")}
                    </div>
                  </div>
                  {availableToolRegistrations.length === 0 ? (
                    <ConsoleEmptyState>
                      {t("agents.editor.noRegisteredTools")}
                    </ConsoleEmptyState>
                  ) : (
                    <div className="grid gap-3 md:grid-cols-2">
                      {availableToolRegistrations.map((toolRegistration) => {
                        const isBound =
                          selectedAgent.toolRegistrationIds.includes(
                            toolRegistration.id,
                          );

                        return (
                          <button
                            className={cn(
                              "flex items-start gap-3 rounded-xl border p-4 text-left transition",
                              isBound
                                ? "border-emerald-200 bg-emerald-50/70 shadow-sm"
                                : "border-slate-200 bg-white hover:border-blue-200 hover:bg-slate-50/70",
                            )}
                            disabled={!hasAgentWriteAccess}
                            key={toolRegistration.id}
                            onClick={() =>
                              toggleRegisteredTool(toolRegistration.id)
                            }
                            type="button"
                          >
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-slate-700 shadow-sm">
                              <Bot className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="text-sm font-semibold text-slate-950">
                                  {toolRegistration.name}
                                </div>
                                <Badge
                                  className={cn(
                                    "border",
                                    isBound
                                      ? "border-emerald-200 bg-white text-emerald-700"
                                      : "border-slate-200 bg-slate-50 text-slate-600",
                                  )}
                                  variant="outline"
                                >
                                  {isBound
                                    ? t("agents.connectivity.enabled")
                                    : t("agents.connectivity.disabled")}
                                </Badge>
                                <Badge
                                  className="border-slate-200 bg-white text-slate-600"
                                  variant="outline"
                                >
                                  {t(
                                    `settings.tools.surfaces.${toolRegistration.surface_area}`,
                                  )}
                                </Badge>
                              </div>
                              <div className="mt-1 text-sm leading-6 text-slate-500">
                                {toolRegistration.description ||
                                  t("settings.governance.empty")}
                              </div>
                              <div className="mt-2 flex flex-wrap gap-2">
                                <ConsoleOutlineBadge>
                                  {toolRegistration.transport_type}
                                </ConsoleOutlineBadge>
                                {toolRegistration.requires_admin_approval ? (
                                  <ConsoleOutlineBadge>
                                    {t("settings.tools.adminApproval")}
                                  </ConsoleOutlineBadge>
                                ) : null}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {canManageRuntimeGovernance && availableToolRegistrations.some((tool) => tool.transport_type === "mcp_reserved") ? (
                    <Button onClick={() => setIsMcpMappingOpen(true)} type="button" variant="outline">
                      {t("agents.mcpMapping.open")}
                    </Button>
                  ) : null}
                </div>
              </DialogFormLayout>
            ) : (
              <ConsoleEmptyState>
                {t("agents.editor.empty")}
              </ConsoleEmptyState>
            )}
          </FormDialog>

          <McpToolMappingDialog
            connectors={mcpConnectors}
            onClose={() => setIsMcpMappingOpen(false)}
            onSaved={refreshRuntimeGovernanceCatalog}
            open={isMcpMappingOpen}
            tools={availableToolRegistrations}
          />

          {agentSection === "delivery" ? (
            <ConsoleSurface>
              <ConsoleSurfaceHeader title={t("agents.delivery.title")} />
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
                            status: t(
                              `agents.statuses.${selectedAgent.status}`,
                            ),
                          })
                        : t("agents.delivery.selectAgent")}
                    </div>
                    {selectedAgent ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        <ConsoleOutlineBadge>
                          {selectedAgent.slug}
                        </ConsoleOutlineBadge>
                        <ConsoleOutlineBadge>
                          {selectedScopeWorkspace?.name ??
                            t("agents.executionPackets.scopePending")}
                        </ConsoleOutlineBadge>
                        <ConsoleOutlineBadge>
                          {selectedScopeKnowledgeBase?.name ??
                            t("agents.executionPackets.scopePending")}
                        </ConsoleOutlineBadge>
                        {selectedScopeRetrievalProfile ? (
                          <ConsoleOutlineBadge>
                            {t("home.retrievalInspector.retrievalProfile", {
                              value: selectedScopeRetrievalProfile.name,
                            })}
                          </ConsoleOutlineBadge>
                        ) : null}
                        <ConsoleOutlineBadge>
                          {selectedAgentReadiness?.resolvedModelEndpoint
                            ?.name ??
                            t("agents.executionPackets.modelInherited")}
                        </ConsoleOutlineBadge>
                        {selectedAgentReadiness?.resolvedModelEndpoint
                          ?.provider_type ? (
                          <ConsoleOutlineBadge>
                            {t(
                              `settings.models.providers.${selectedAgentReadiness.resolvedModelEndpoint.provider_type}`,
                            )}
                          </ConsoleOutlineBadge>
                        ) : null}
                        {selectedModelPreviewDetail ? (
                          <ConsoleOutlineBadge>
                            {selectedModelPreviewDetail}
                          </ConsoleOutlineBadge>
                        ) : null}
                        {selectedModelPreviewFailures ? (
                          <ConsoleOutlineBadge>
                            {selectedModelPreviewFailures}
                          </ConsoleOutlineBadge>
                        ) : null}
                        {selectedToolPreviewDetail ? (
                          <ConsoleOutlineBadge>
                            {selectedToolPreviewDetail}
                          </ConsoleOutlineBadge>
                        ) : null}
                        {selectedToolPreviewFailures ? (
                          <ConsoleOutlineBadge>
                            {selectedToolPreviewFailures}
                          </ConsoleOutlineBadge>
                        ) : null}
                        {selectedConnectorPreviewDetail ? (
                          <ConsoleOutlineBadge>
                            {selectedConnectorPreviewDetail}
                          </ConsoleOutlineBadge>
                        ) : null}
                        {selectedConnectorPreviewFailures ? (
                          <ConsoleOutlineBadge>
                            {selectedConnectorPreviewFailures}
                          </ConsoleOutlineBadge>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  <div className="space-y-4">
                    <ConsoleRuntimeTaskPacket
                      detail={runtimeTaskPacket.detail}
                      objective={runtimeTaskPacket.objective}
                      objectiveLabel={t(
                        "agents.delivery.runtimeTaskFields.objective",
                      )}
                      primaryActionHref={runtimeTaskPacket.primaryActionHref}
                      primaryActionLabel={t(
                        "agents.delivery.runtimeTaskOpenPrimary",
                      )}
                      prompt={runtimeTaskPacket.prompt}
                      promptLabel={t(
                        "agents.delivery.runtimeTaskFields.prompt",
                      )}
                      secondaryActions={runtimeTaskPacket.secondaryActions}
                      statusLabel={runtimeTaskPacket.statusLabel}
                      statusTone={runtimeTaskPacket.statusTone}
                      summaryItems={runtimeTaskPacket.summaryItems}
                      title={runtimeTaskPacket.title}
                    />
                    <div className="space-y-2">
                      {launchChecklistItems.map((item, index) => (
                        <div
                          key={`${index}-${item}`}
                          className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600"
                        >
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    {launchSurfaceCards.map((card) => (
                      <div
                        className="rounded-[20px] border border-slate-100 bg-white p-5"
                        key={card.key}
                      >
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                          {card.title}
                        </div>
                        <div className="mt-3 text-sm leading-6 text-slate-600">
                          {card.description}
                        </div>
                        <div className="mt-4">
                          <Button
                            className="w-full justify-center rounded-xl bg-white"
                            disabled={
                              !canOperateSelectedAgentRuntime ||
                              launchingSurface !== null
                            }
                            onClick={() =>
                              void handleLaunchSurface(
                                card.key.includes("operations")
                                  ? "operations"
                                  : card.key.includes("documents")
                                    ? "documents"
                                    : "chat",
                                card.key === "primary-chat" ||
                                  card.key === "chat-briefing"
                                  ? { draftQuestion: launchPrompts[0] ?? null }
                                  : card.key === "primary-operations"
                                    ? {
                                        workflowStatus: "failed",
                                        workflowRetryMode: "all",
                                      }
                                    : card.key === "documents-failed"
                                      ? { documentStatus: "failed" }
                                      : card.key === "operations-failures"
                                        ? { workflowStatus: "failed" }
                                        : undefined,
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
                        <div
                          className="rounded-xl border border-slate-200 bg-white p-4"
                          key={`${index}-${prompt}`}
                        >
                          <div className="text-sm leading-7 text-slate-700">
                            {prompt}
                          </div>
                          <div className="mt-4 flex flex-wrap gap-2">
                            <Button
                              className="rounded-xl bg-white"
                              disabled={
                                !canOperateSelectedAgentRuntime ||
                                launchingSurface !== null
                              }
                              onClick={() =>
                                void handleLaunchSurface("chat", {
                                  draftQuestion: prompt,
                                })
                              }
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
                      disabled={
                        !canOperateSelectedAgentRuntime ||
                        launchingSurface !== null
                      }
                      onClick={() => void handleLaunchSurface("chat")}
                      type="button"
                      variant="outline"
                    >
                      {launchingSurface === "chat"
                        ? t("agents.actions.launching")
                        : t("agents.actions.openChat")}
                    </Button>
                    <Button
                      className="justify-start rounded-xl bg-white"
                      disabled={
                        !canOperateSelectedAgentRuntime ||
                        launchingSurface !== null
                      }
                      onClick={() => void handleLaunchSurface("documents")}
                      type="button"
                      variant="outline"
                    >
                      {launchingSurface === "documents"
                        ? t("agents.actions.launching")
                        : t("agents.actions.openDocuments")}
                    </Button>
                    <Button
                      className="justify-start rounded-xl bg-white"
                      disabled={
                        !canOperateSelectedAgentRuntime ||
                        launchingSurface !== null
                      }
                      onClick={() => void handleLaunchSurface("operations")}
                      type="button"
                      variant="outline"
                    >
                      {launchingSurface === "operations"
                        ? t("agents.actions.launching")
                        : t("agents.actions.openOperations")}
                    </Button>
                    <Button
                      className="justify-start rounded-xl bg-white"
                      disabled={
                        !canOperateSelectedAgentRuntime ||
                        launchingSurface !== null
                      }
                      onClick={() => void handleLaunchSurface("admin")}
                      type="button"
                      variant="outline"
                    >
                      {launchingSurface === "admin"
                        ? t("agents.actions.launching")
                        : t("agents.actions.openAdmin")}
                    </Button>
                  </div>
                </div>
              </div>
            </ConsoleSurface>
          ) : null}

          {agentSection === "executions" ? (
            <ConsoleSurface>
              <ConsoleSurfaceHeader
                action={
                  <ConsoleOutlineBadge>
                    {t("agents.executions.count", {
                      count: String(
                        agentExecutionMetrics?.total_executions ?? 0,
                      ),
                    })}
                  </ConsoleOutlineBadge>
                }
                title={t("agents.executions.title")}
              />
              <div className="grid gap-4 p-6">
                <details className="rounded-[20px] border border-slate-200 bg-slate-50/70 p-5">
                  <summary className="cursor-pointer text-sm font-semibold text-slate-950">
                    {t("agents.executions.policy.title")}
                  </summary>
                  <div className="mt-2 text-sm leading-6 text-slate-500">
                    {t("agents.executions.policy.description")}
                  </div>
                  <div className="mt-4 grid gap-4 lg:grid-cols-3">
                    <DialogFormField label={t("agents.executions.policy.maxToolCalls")}>
                      <Input
                        max={20}
                        min={0}
                        onChange={(event) => setExecutionMaxToolCalls(event.target.value)}
                        placeholder={t("agents.executions.policy.deploymentDefault")}
                        type="number"
                        value={executionMaxToolCalls}
                      />
                    </DialogFormField>
                    <DialogFormField label={t("agents.executions.policy.maxRuntimeSeconds")}>
                      <Input
                        max={1800}
                        min={10}
                        onChange={(event) => setExecutionMaxRuntimeSeconds(event.target.value)}
                        placeholder={t("agents.executions.policy.deploymentDefault")}
                        type="number"
                        value={executionMaxRuntimeSeconds}
                      />
                    </DialogFormField>
                    <DialogFormField label={t("agents.executions.policy.maxOutputBytes")}>
                      <Input
                        max={256000}
                        min={1024}
                        onChange={(event) => setExecutionMaxOutputBytes(event.target.value)}
                        placeholder={t("agents.executions.policy.deploymentDefault")}
                        type="number"
                        value={executionMaxOutputBytes}
                      />
                    </DialogFormField>
                  </div>
                  <div className="mt-4">
                    <DialogFormField label={t("agents.executions.policy.outputSchema")}>
                      <Textarea
                        className="min-h-28 bg-white font-mono text-xs"
                        onChange={(event) => setExecutionOutputSchema(event.target.value)}
                        placeholder={t("agents.executions.policy.outputSchemaPlaceholder")}
                        value={executionOutputSchema}
                      />
                    </DialogFormField>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="text-xs leading-5 text-slate-500">
                      {t("agents.executions.policy.sandboxBoundary")}
                    </div>
                    <Button
                      disabled={!canOperateSelectedAgentRuntime || isExecutingAgent}
                      onClick={() => void handleExecuteAgent()}
                      type="button"
                    >
                      <BrainCircuit className="h-4 w-4" />
                      {isExecutingAgent
                        ? t("agents.actions.executing")
                        : t("agents.actions.execute")}
                    </Button>
                  </div>
                </details>

                <ConsoleRuntimeTaskPacket
                  detail={latestExecutionTaskPacket.detail}
                  objective={latestExecutionTaskPacket.objective}
                  objectiveLabel={t(
                    "agents.delivery.runtimeTaskFields.objective",
                  )}
                  primaryActionHref={
                    latestExecutionTaskPacket.primaryActionHref
                  }
                  primaryActionLabel={
                    latestExecutionTaskPacket.primaryActionLabel
                  }
                  prompt={latestExecutionTaskPacket.prompt}
                  promptLabel={t("agents.delivery.runtimeTaskFields.prompt")}
                  secondaryActions={latestExecutionTaskPacket.secondaryActions}
                  statusLabel={latestExecutionTaskPacket.statusLabel}
                  statusTone={latestExecutionTaskPacket.statusTone}
                  summaryItems={latestExecutionTaskPacket.summaryItems}
                  title={latestExecutionTaskPacket.title}
                />

                <div className="grid gap-4 xl:grid-cols-6">
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
                      {t("agents.executions.metrics.awaitingApproval")}
                    </div>
                    <div className="mt-3 text-[28px] font-semibold tracking-tight text-slate-950">
                      {agentExecutionMetrics?.awaiting_approval_executions ?? 0}
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
                      <div className="text-sm font-semibold text-slate-950">
                        {t("agents.executions.latestTitle")}
                      </div>
                      <div className="mt-1 text-sm text-slate-500">
                        {agentExecutionMetrics?.latest_execution_at
                          ? t("agents.executions.latestTimestamp", {
                              value: formatUpdatedAt(
                                agentExecutionMetrics.latest_execution_at,
                                language,
                              ),
                            })
                          : t("agents.executions.noLatest")}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Select
                        onValueChange={(value) =>
                          setExecutionStatusFilter(
                            value as AgentExecutionStatusFilter,
                          )
                        }
                        value={executionStatusFilter}
                      >
                        <SelectTrigger className="min-w-[220px] bg-white">
                          <SelectValue
                            placeholder={t("agents.executions.filters.status")}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">
                            {t("agents.executions.filters.allStatuses")}
                          </SelectItem>
                          <SelectItem value="queued">
                            {t("agents.executions.statuses.queued")}
                          </SelectItem>
                          <SelectItem value="running">
                            {t("agents.executions.statuses.running")}
                          </SelectItem>
                          <SelectItem value="awaiting_approval">
                            {t("agents.executions.statuses.awaiting_approval")}
                          </SelectItem>
                          <SelectItem value="completed">
                            {t("agents.executions.statuses.completed")}
                          </SelectItem>
                          <SelectItem value="failed">
                            {t("agents.executions.statuses.failed")}
                          </SelectItem>
                          <SelectItem value="cancelled">
                            {t("agents.executions.statuses.cancelled")}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        className="rounded-xl bg-white"
                        disabled={isLoadingAgentExecutions || !selectedTenantId}
                        onClick={() =>
                          void refreshAgentExecutionsForCurrentScope()
                        }
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        <RefreshCw
                          className={cn(
                            "h-4 w-4",
                            isLoadingAgentExecutions && "animate-spin",
                          )}
                        />
                        {isLoadingAgentExecutions
                          ? t("agents.actions.refreshing")
                          : t("agents.executions.refresh")}
                      </Button>
                    </div>
                  </div>

                  <div className="mt-5 space-y-3">
                    {agentExecutions.length === 0 ? (
                      <ConsoleEmptyState>
                        {t("agents.executions.empty")}
                      </ConsoleEmptyState>
                    ) : (
                      agentExecutions.map((agentExecution) => {
                        const linkedAgent =
                          scopedAgentById.get(
                            agentExecution.agent_definition_id,
                          ) ??
                          selectedAgent ??
                          null;
                        const evidenceSummary =
                          readAgentExecutionEvidenceSummary(
                            agentExecution.result_payload_json,
                          );
                        const runtimeBindingSummary =
                          readAgentExecutionRuntimeBindingSummary(
                            agentExecution.result_payload_json,
                          );
                        const runtimeSummary = readAgentExecutionRuntimeSummary(
                          agentExecution.result_payload_json,
                        );
                        const taskState = agentExecution.task_state;
                        const generatedOutputs =
                          agentExecution.generated_outputs ?? [];
                        const recommendedActionSpecs =
                          evidenceSummary?.recommendedActionSpecs ?? [];
                        const recommendedActions =
                          recommendedActionSpecs.length === 0
                            ? (evidenceSummary?.recommendedActions.slice(
                                0,
                                3,
                              ) ?? [])
                            : [];
                        const toolRuntime = readToolRuntimeSummary(
                          agentExecution.result_payload_json,
                        );
                        const retrievalSummary =
                          readAgentExecutionRetrievalSummary(
                            agentExecution.result_payload_json,
                          );
                        const followUpActions =
                          buildAgentExecutionFollowUpActions({
                            sourceContext: { surface: "agents" },
                            execution: agentExecution,
                            executionInput: evidenceSummary?.executionInput,
                            recommendedActions: recommendedActionSpecs,
                          });
                        const executionPolicy = agentExecution.execution_policy_json ?? {};
                        const maxToolCalls =
                          typeof executionPolicy.max_tool_calls === "number"
                            ? executionPolicy.max_tool_calls
                            : null;
                        const maxRuntimeSeconds =
                          typeof executionPolicy.max_runtime_seconds === "number"
                            ? executionPolicy.max_runtime_seconds
                            : null;
                        const maxOutputBytes =
                          typeof executionPolicy.max_output_bytes === "number"
                            ? executionPolicy.max_output_bytes
                            : null;
                        const isTerminalExecution = [
                          "completed",
                          "failed",
                          "cancelled",
                        ].includes(agentExecution.execution_status);

                        return (
                          <div
                            className="rounded-[18px] border border-slate-200 bg-slate-50/70 px-4 py-4"
                            key={agentExecution.id}
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-slate-950">
                                  {linkedAgent?.name ??
                                    t("agents.executions.unknownAgent")}
                                </div>
                                <div className="mt-1 text-sm leading-6 text-slate-500">
                                  {agentExecution.summary ||
                                    agentExecution.error_message ||
                                    t("agents.executions.pendingSummary")}
                                </div>
                              </div>
                              <Badge
                                className={cn(
                                  "border",
                                  getAgentExecutionStatusClass(
                                    agentExecution.execution_status,
                                  ),
                                )}
                                variant="outline"
                              >
                                {t(
                                  `agents.executions.statuses.${agentExecution.execution_status}`,
                                )}
                              </Badge>
                              {agentExecution.execution_status === "failed" && hasAgentExecutionAccess ? (
                                <Button
                                  disabled={retryingExecutionId !== null}
                                  onClick={() => void handleRetryAgentExecution(agentExecution)}
                                  size="sm"
                                  type="button"
                                  variant="outline"
                                >
                                  <RefreshCw className={cn("h-4 w-4", retryingExecutionId === agentExecution.id && "animate-spin")} />
                                  {retryingExecutionId === agentExecution.id
                                    ? t("agents.executions.retrying")
                                    : t("agents.executions.retry")}
                                </Button>
                              ) : null}
                              {isTerminalExecution && hasAgentExecutionAccess ? (
                                <Button
                                  disabled={replayingExecutionId !== null}
                                  onClick={() => void handleReplayAgentExecution(agentExecution)}
                                  size="sm"
                                  type="button"
                                  variant="outline"
                                >
                                  <RefreshCw className={cn("h-4 w-4", replayingExecutionId === agentExecution.id && "animate-spin")} />
                                  {replayingExecutionId === agentExecution.id
                                    ? t("agents.executions.replaying")
                                    : t("agents.executions.replay")}
                                </Button>
                              ) : null}
                              {(agentExecution.execution_status === "queued" || agentExecution.execution_status === "running" || agentExecution.execution_status === "awaiting_approval") && hasAgentExecutionAccess ? (
                                <Button disabled={cancellingExecutionId !== null} onClick={() => void handleCancelAgentExecution(agentExecution)} size="sm" type="button" variant="outline">
                                  {cancellingExecutionId === agentExecution.id ? t("agents.executions.cancelling") : t("agents.executions.cancel")}
                                </Button>
                              ) : null}
                            </div>
                            <div className="mt-4 flex flex-wrap gap-2">
                              <ConsoleOutlineBadge>
                                {t(
                                  `agents.modes.${agentExecution.execution_mode}`,
                                )}
                              </ConsoleOutlineBadge>
                              <ConsoleOutlineBadge>
                                {formatAgentRunTriggerSourceLabel(
                                  agentExecution.trigger_source,
                                  t,
                                )}
                              </ConsoleOutlineBadge>
                              {maxToolCalls !== null ? (
                                <ConsoleOutlineBadge>
                                  {t("agents.executions.policy.toolBudget", { value: String(maxToolCalls) })}
                                </ConsoleOutlineBadge>
                              ) : null}
                              {maxRuntimeSeconds !== null ? (
                                <ConsoleOutlineBadge>
                                  {t("agents.executions.policy.runtimeBudget", { value: String(maxRuntimeSeconds) })}
                                </ConsoleOutlineBadge>
                              ) : null}
                              {maxOutputBytes !== null ? (
                                <ConsoleOutlineBadge>
                                  {t("agents.executions.policy.outputBudget", { value: String(maxOutputBytes) })}
                                </ConsoleOutlineBadge>
                              ) : null}
                              {agentExecution.output_schema_json ? (
                                <ConsoleOutlineBadge>
                                  {t("agents.executions.policy.schemaBound")}
                                </ConsoleOutlineBadge>
                              ) : null}
                              {agentExecution.replay_of_execution_id ? (
                                <ConsoleOutlineBadge>
                                  {t("agents.executions.policy.replayOf", {
                                    value: agentExecution.replay_of_execution_id.slice(0, 8),
                                  })}
                                </ConsoleOutlineBadge>
                              ) : null}
                              {retrievalSummary?.retrievalEngine ? (
                                <ConsoleOutlineBadge>
                                  {t("home.retrievalInspector.engineLabel", {
                                    value: retrievalSummary.retrievalEngine,
                                  })}
                                </ConsoleOutlineBadge>
                              ) : null}
                              {retrievalSummary?.retrievalProfileName ? (
                                <ConsoleOutlineBadge>
                                  {t(
                                    "home.retrievalInspector.retrievalProfile",
                                    {
                                      value:
                                        retrievalSummary.retrievalProfileName,
                                    },
                                  )}
                                </ConsoleOutlineBadge>
                              ) : null}
                              {retrievalSummary?.retrievalMode ? (
                                <ConsoleOutlineBadge>
                                  {t("home.retrievalInspector.retrievalMode", {
                                    value: t(
                                      `settings.retrievalProfiles.modes.${retrievalSummary.retrievalMode}`,
                                    ),
                                  })}
                                </ConsoleOutlineBadge>
                              ) : null}
                              {retrievalSummary &&
                              retrievalSummary.effectiveTopK !== null ? (
                                <ConsoleOutlineBadge>
                                  {t("home.retrievalInspector.effectiveTopK", {
                                    value: String(
                                      retrievalSummary.effectiveTopK,
                                    ),
                                  })}
                                </ConsoleOutlineBadge>
                              ) : null}
                              {runtimeSummary?.agentRuntimeEngine ? (
                                <ConsoleOutlineBadge>
                                  {t("agents.executions.runtimeEngine", {
                                    value: runtimeSummary.agentRuntimeEngine,
                                  })}
                                </ConsoleOutlineBadge>
                              ) : null}
                              {runtimeSummary?.configuredAgentRuntimeEngine &&
                              runtimeSummary.configuredAgentRuntimeEngine !==
                                runtimeSummary.agentRuntimeEngine ? (
                                <ConsoleOutlineBadge>
                                  {t(
                                    "agents.executions.configuredRuntimeEngine",
                                    {
                                      value:
                                        runtimeSummary.configuredAgentRuntimeEngine,
                                    },
                                  )}
                                </ConsoleOutlineBadge>
                              ) : null}
                              {runtimeSummary?.fallbackApplied ? (
                                <ConsoleOutlineBadge>
                                  {t("agents.executions.runtimeFallback")}
                                </ConsoleOutlineBadge>
                              ) : null}
                              {runtimeSummary?.graphWorkflow ? (
                                <ConsoleOutlineBadge>
                                  {t("agents.executions.runtimeWorkflow", {
                                    value: runtimeSummary.graphWorkflow,
                                  })}
                                </ConsoleOutlineBadge>
                              ) : null}
                              {runtimeSummary &&
                              runtimeSummary.graphTraceCount > 0 ? (
                                <ConsoleOutlineBadge>{`graph ${runtimeSummary.graphTraceCount}`}</ConsoleOutlineBadge>
                              ) : null}
                              <ConsoleOutlineBadge>
                                {formatUpdatedAt(
                                  agentExecution.updated_at,
                                  language,
                                )}
                              </ConsoleOutlineBadge>
                            </div>
                            {runtimeBindingSummary ? (
                              <RuntimeBindingSummaryCard
                                summary={runtimeBindingSummary}
                              />
                            ) : null}
                            {runtimeSummary?.fallbackReason ? (
                              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
                                {runtimeSummary.configuredModelEndpointName ? (
                                  <div className="mb-2 font-medium">
                                    {t(
                                      "agents.executions.configuredRuntimeModel",
                                      {
                                        value:
                                          runtimeSummary.configuredModelEndpointName,
                                      },
                                    )}
                                  </div>
                                ) : null}
                                {runtimeSummary.fallbackReason}
                              </div>
                            ) : null}
                            {taskState || generatedOutputs.length > 0 ? (
                              <div className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-4">
                                <div className="flex flex-wrap items-center gap-2">
                                  {taskState ? (
                                    <Badge
                                      className="border border-slate-200 bg-slate-50 text-slate-700"
                                      variant="outline"
                                    >
                                      {t(
                                        getAgentExecutionStageLabelKey(
                                          taskState.stage_key,
                                        ),
                                      )}
                                    </Badge>
                                  ) : null}
                                  {taskState?.duration_seconds !== null &&
                                  taskState?.duration_seconds !== undefined ? (
                                    <ConsoleOutlineBadge>
                                      {t("agents.executions.durationSeconds", {
                                        value: String(
                                          taskState.duration_seconds,
                                        ),
                                      })}
                                    </ConsoleOutlineBadge>
                                  ) : null}
                                  {taskState?.fallback_applied ? (
                                    <ConsoleOutlineBadge>
                                      {t("agents.executions.runtimeFallback")}
                                    </ConsoleOutlineBadge>
                                  ) : null}
                                  {taskState ? (
                                    <ConsoleOutlineBadge>
                                      {t("agents.executions.outputCount", {
                                        count: String(taskState.output_count),
                                      })}
                                    </ConsoleOutlineBadge>
                                  ) : null}
                                  {taskState ? (
                                    <ConsoleOutlineBadge>
                                      {t("agents.executions.followUpCount", {
                                        count: String(
                                          taskState.recommended_action_count,
                                        ),
                                      })}
                                    </ConsoleOutlineBadge>
                                  ) : null}
                                  {taskState &&
                                  taskState.tool_trace_count > 0 ? (
                                    <ConsoleOutlineBadge>
                                      {t("agents.executions.toolTraceCount", {
                                        count: String(
                                          taskState.tool_trace_count,
                                        ),
                                      })}
                                    </ConsoleOutlineBadge>
                                  ) : null}
                                </div>
                                {generatedOutputs.length > 0 ? (
                                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                                    {generatedOutputs.map((output) => (
                                      <div
                                        className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3"
                                        key={`${agentExecution.id}-${output.output_key}`}
                                      >
                                        <div className="flex flex-wrap items-start justify-between gap-2">
                                          <div className="text-sm font-semibold text-slate-900">
                                            {t(
                                              getAgentExecutionOutputKindLabelKey(
                                                output.kind,
                                              ),
                                            )}
                                          </div>
                                          <Badge
                                            className={cn(
                                              "border",
                                              getExecutionOutputStatusClassName(
                                                output.status,
                                              ),
                                            )}
                                            variant="outline"
                                          >
                                            {t(
                                              `agents.executions.outputStatuses.${output.status}`,
                                            )}
                                          </Badge>
                                        </div>
                                        {output.metric_value ? (
                                          <div className="mt-2 text-sm font-medium text-slate-700">
                                            {output.metric_value}
                                          </div>
                                        ) : null}
                                        {output.preview ? (
                                          <div className="mt-2 line-clamp-3 text-sm leading-6 text-slate-500">
                                            {output.preview}
                                          </div>
                                        ) : null}
                                      </div>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                            ) : null}
                            {evidenceSummary?.executionInput ? (
                              <div className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3">
                                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                                  {t("agents.executions.executionInput")}
                                </div>
                                <div className="mt-2 text-sm leading-6 text-slate-700">
                                  {evidenceSummary.executionInput}
                                </div>
                              </div>
                            ) : null}
                            {evidenceSummary?.answerPreview ? (
                              <div className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                                    {t("agents.executions.answerPreview")}
                                  </div>
                                  {evidenceSummary.retrievalResultCount !==
                                  null ? (
                                    <ConsoleOutlineBadge>
                                      {t("agents.executions.retrievalResults", {
                                        count: String(
                                          evidenceSummary.retrievalResultCount,
                                        ),
                                      })}
                                    </ConsoleOutlineBadge>
                                  ) : null}
                                </div>
                                <div className="mt-2 text-sm leading-6 text-slate-700">
                                  {evidenceSummary.answerPreview}
                                </div>
                              </div>
                            ) : null}
                            {evidenceSummary &&
                            evidenceSummary.retrievalSources.length > 0 ? (
                              <div className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3">
                                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                                  {t("agents.executions.evidenceSources")}
                                </div>
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {evidenceSummary.retrievalMethodBreakdown.map(
                                    (entry) => (
                                      <ConsoleOutlineBadge
                                        key={`${agentExecution.id}-${entry.method}`}
                                      >
                                        {t(
                                          `settings.retrievalProfiles.modes.${entry.method}`,
                                        )}{" "}
                                        x{entry.count}
                                      </ConsoleOutlineBadge>
                                    ),
                                  )}
                                </div>
                                <div className="mt-3 space-y-2">
                                  {evidenceSummary.retrievalSources.map(
                                    (source, index) => (
                                      <div
                                        className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-3"
                                        key={`${agentExecution.id}-${source.documentChunkId ?? index}`}
                                      >
                                        <div className="flex flex-wrap items-center gap-2">
                                          <div className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">
                                            {source.documentTitle ??
                                              t(
                                                "agents.executions.unknownSourceDocument",
                                              )}
                                          </div>
                                          {source.retrievalMethod ? (
                                            <Badge
                                              className={cn(
                                                "border",
                                                getRetrievalMethodBadgeClassName(
                                                  source.retrievalMethod,
                                                ),
                                              )}
                                              variant="outline"
                                            >
                                              {t(
                                                `settings.retrievalProfiles.modes.${source.retrievalMethod}`,
                                              )}
                                            </Badge>
                                          ) : null}
                                        </div>
                                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                                          {source.chunkIndex !== null ? (
                                            <span>
                                              {t(
                                                "agents.executions.chunkIndex",
                                                {
                                                  value: String(
                                                    source.chunkIndex,
                                                  ),
                                                },
                                              )}
                                            </span>
                                          ) : null}
                                          {typeof source.score === "number" ? (
                                            <span>
                                              {t("agents.executions.score", {
                                                value: source.score.toFixed(3),
                                              })}
                                            </span>
                                          ) : null}
                                        </div>
                                      </div>
                                    ),
                                  )}
                                </div>
                              </div>
                            ) : null}
                            {runtimeSummary &&
                            runtimeSummary.graphTrace.length > 0 ? (
                              <div className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3">
                                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                                  {t("agents.executions.runtimeTrace")}
                                </div>
                                {runtimeSummary.graphDecisionReason ? (
                                  <div className="mt-2 text-xs leading-5 text-slate-600">
                                    {[
                                      runtimeSummary.graphSelectedBranch,
                                      runtimeSummary.graphRiskLevel,
                                      runtimeSummary.graphDecisionReason,
                                    ]
                                      .filter(Boolean)
                                      .join(" · ")}
                                  </div>
                                ) : null}
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {runtimeSummary.graphTrace.map(
                                    (entry, index) => (
                                      <ConsoleOutlineBadge
                                        key={`${agentExecution.id}-graph-${entry.step}-${index}`}
                                      >
                                        {`${entry.step} · ${entry.status}${entry.durationMs !== null ? ` · ${entry.durationMs.toFixed(1)}ms` : ""}`}
                                      </ConsoleOutlineBadge>
                                    ),
                                  )}
                                </div>
                              </div>
                            ) : null}
                            <AgentExecutionFollowUpActions
                              actions={followUpActions}
                              className="mt-4"
                              getLabel={(action) =>
                                action.labelKey
                                  ? t(action.labelKey)
                                  : (action.label ?? "")
                              }
                              title={t("agents.executions.followUpTitle")}
                            />
                            {recommendedActions.length > 0 ? (
                              <div className="mt-4 flex flex-wrap gap-2">
                                {recommendedActions.map((action) => (
                                  <ConsoleOutlineBadge key={action}>
                                    {action}
                                  </ConsoleOutlineBadge>
                                ))}
                              </div>
                            ) : null}
                            {toolRuntime ? (
                              <ToolRuntimeSummaryCard
                                maxTraces={3}
                                renderTraceActions={(trace) => (
                                  <ToolRuntimeTraceActions
                                    tenantId={agentExecution.tenant_id}
                                    trace={trace}
                                  />
                                )}
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
          ) : null}

          {agentSection === "runs" ? (
            <ConsoleSurface>
              <ConsoleSurfaceHeader
                action={
                  <ConsoleOutlineBadge>
                    {t("agents.runs.count", {
                      count: String(agentRunMetrics?.total_runs ?? 0),
                    })}
                  </ConsoleOutlineBadge>
                }
                description={t("agents.runs.description")}
                title={t("agents.runs.title")}
              />
              <div className="grid gap-4 p-6">
                <ConsoleRuntimeTaskPacket
                  detail={latestRunTaskPacket.detail}
                  objective={latestRunTaskPacket.objective}
                  objectiveLabel={t(
                    "agents.delivery.runtimeTaskFields.objective",
                  )}
                  primaryActionHref={latestRunTaskPacket.primaryActionHref}
                  primaryActionLabel={latestRunTaskPacket.primaryActionLabel}
                  primaryActionRunRecord={
                    latestRunTaskPacket.primaryActionRunRecord
                  }
                  prompt={latestRunTaskPacket.prompt}
                  promptLabel={t("agents.delivery.runtimeTaskFields.prompt")}
                  secondaryActions={latestRunTaskPacket.secondaryActions}
                  statusLabel={latestRunTaskPacket.statusLabel}
                  statusTone={latestRunTaskPacket.statusTone}
                  summaryItems={latestRunTaskPacket.summaryItems}
                  title={latestRunTaskPacket.title}
                />

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
                      <div className="text-sm font-semibold text-slate-950">
                        {t("agents.runs.latestTitle")}
                      </div>
                      <div className="mt-1 text-sm text-slate-500">
                        {agentRunMetrics?.latest_launched_at
                          ? t("agents.runs.latestTimestamp", {
                              value: formatUpdatedAt(
                                agentRunMetrics.latest_launched_at,
                                language,
                              ),
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
                      <RefreshCw
                        className={cn(
                          "h-4 w-4",
                          isLoadingAgentRuns && "animate-spin",
                        )}
                      />
                      {isLoadingAgentRuns
                        ? t("agents.actions.refreshing")
                        : t("agents.runs.refresh")}
                    </Button>
                  </div>

                  <div className="mt-5 grid gap-3 lg:grid-cols-3">
                    <Select
                      onValueChange={(value) =>
                        setRunTargetSurfaceFilter(
                          value as AgentRunSurfaceFilter,
                        )
                      }
                      value={runTargetSurfaceFilter}
                    >
                      <SelectTrigger className="bg-white">
                        <SelectValue
                          placeholder={t("agents.runs.filters.surface")}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">
                          {t("agents.runs.filters.allSurfaces")}
                        </SelectItem>
                        <SelectItem value="chat">
                          {t("agents.tools.chat")}
                        </SelectItem>
                        <SelectItem value="documents">
                          {t("agents.tools.documents")}
                        </SelectItem>
                        <SelectItem value="operations">
                          {t("agents.tools.operations")}
                        </SelectItem>
                        <SelectItem value="admin">
                          {t("agents.tools.admin")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      onValueChange={(value) =>
                        setRunTriggerSourceFilter(
                          value as AgentRunTriggerSourceFilter,
                        )
                      }
                      value={runTriggerSourceFilter}
                    >
                      <SelectTrigger className="bg-white">
                        <SelectValue
                          placeholder={t("agents.runs.filters.source")}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">
                          {t("agents.runs.filters.allSources")}
                        </SelectItem>
                        <SelectItem value="agents_console">
                          {t("agents.runs.sources.agentsConsole")}
                        </SelectItem>
                        <SelectItem value="workspace">
                          {t("agents.runs.sources.workspace")}
                        </SelectItem>
                        <SelectItem value="home">
                          {t("agents.runs.sources.home")}
                        </SelectItem>
                        <SelectItem value="admin">
                          {t("agents.runs.sources.admin")}
                        </SelectItem>
                        <SelectItem value="operations">
                          {t("agents.runs.sources.operations")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      onValueChange={(value) =>
                        setRunStatusFilter(value as AgentRunStatusFilter)
                      }
                      value={runStatusFilter}
                    >
                      <SelectTrigger className="bg-white">
                        <SelectValue
                          placeholder={t("agents.runs.filters.status")}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">
                          {t("agents.runs.filters.allStatuses")}
                        </SelectItem>
                        <SelectItem value="launched">
                          {t("agents.runs.statuses.launched")}
                        </SelectItem>
                        <SelectItem value="completed">
                          {t("agents.runs.statuses.completed")}
                        </SelectItem>
                        <SelectItem value="failed">
                          {t("agents.runs.statuses.failed")}
                        </SelectItem>
                        <SelectItem value="cancelled">
                          {t("agents.runs.statuses.cancelled")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="mt-5 space-y-3">
                    {agentRuns.length === 0 ? (
                      <ConsoleEmptyState>
                        {t("agents.runs.empty")}
                      </ConsoleEmptyState>
                    ) : (
                      agentRuns.map((agentRun) => {
                        const linkedAgent =
                          scopedAgentById.get(agentRun.agent_definition_id) ??
                          selectedAgent ??
                          null;

                        return (
                          <div
                            className="rounded-[18px] border border-slate-200 bg-slate-50/70 px-4 py-4"
                            key={agentRun.id}
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-slate-950">
                                  {linkedAgent?.name ??
                                    t("agents.executionPackets.notSelected")}
                                </div>
                                <div className="mt-1 text-sm leading-6 text-slate-500">
                                  {agentRun.launch_prompt?.trim().length
                                    ? agentRun.launch_prompt
                                    : t("agents.runs.noPrompt")}
                                </div>
                              </div>
                              <Badge
                                className={cn(
                                  "border",
                                  getAgentRunStatusClass(agentRun.run_status),
                                )}
                                variant="outline"
                              >
                                {t(
                                  `agents.runs.statuses.${agentRun.run_status}`,
                                )}
                              </Badge>
                            </div>
                            <div className="mt-4 flex flex-wrap gap-2">
                              <ConsoleOutlineBadge>
                                {t(`agents.tools.${agentRun.target_surface}`)}
                              </ConsoleOutlineBadge>
                              <ConsoleOutlineBadge>
                                {formatAgentRunTriggerSourceLabel(
                                  agentRun.trigger_source,
                                  t,
                                )}
                              </ConsoleOutlineBadge>
                              <ConsoleOutlineBadge>
                                {agentRun.handoff_intent ||
                                  t("agents.runs.noHandoffIntent")}
                              </ConsoleOutlineBadge>
                              <ConsoleOutlineBadge>
                                {formatUpdatedAt(agentRun.created_at, language)}
                              </ConsoleOutlineBadge>
                            </div>
                            {agentRun.navigation_href ? (
                              <div className="mt-4">
                                <AgentRunButtonLink
                                  className="rounded-xl bg-white"
                                  href={agentRun.navigation_href}
                                  runRecord={{
                                    tenant_id: agentRun.tenant_id,
                                    agent_definition_id:
                                      agentRun.agent_definition_id,
                                    workspace_id: agentRun.workspace_id,
                                    knowledge_base_id:
                                      agentRun.knowledge_base_id,
                                    target_surface: agentRun.target_surface,
                                    handoff_intent: agentRun.handoff_intent,
                                    trigger_source: "agents_console",
                                    launch_prompt: agentRun.launch_prompt,
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
          ) : null}
        </div>
      </ConsolePage>
      <ConfirmDialog
        cancelLabel={t("workspace.headerBar.cancel")}
        confirmLabel={
          isMutating ? t("agents.actions.delete") : t("agents.actions.delete")
        }
        description={
          selectedAgent
            ? t("agents.confirm.delete", { name: selectedAgent.name })
            : ""
        }
        isLoading={isMutating}
        onCancel={() => setIsDeleteAgentDialogOpen(false)}
        onConfirm={async () => {
          await handleDeleteAgent();
          setIsDeleteAgentDialogOpen(false);
        }}
        open={isDeleteAgentDialogOpen && Boolean(selectedAgent)}
        title={t("agents.actions.delete")}
      />
      <ConfirmDialog
        cancelLabel={t("workspace.headerBar.cancel")}
        confirmLabel={t("agents.directory.deleteSelected")}
        description={t("agents.confirm.bulkDelete", { count: String(selectedAgentIds.length) })}
        isLoading={isMutating}
        onCancel={() => setIsBulkDeleteAgentDialogOpen(false)}
        onConfirm={async () => {
          await handleBulkDeleteAgents();
          setIsBulkDeleteAgentDialogOpen(false);
        }}
        open={isBulkDeleteAgentDialogOpen && selectedAgentIds.length > 0}
        title={t("agents.directory.deleteSelected")}
      />
    </ConsoleShell>
  );
}
