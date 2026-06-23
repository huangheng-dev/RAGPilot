"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  Bot,
  RefreshCw,
  Search,
  ShieldCheck,
  Waypoints
} from "lucide-react";

import { AgentRunButtonLink } from "@/components/agents/AgentRunButtonLink";
import { ConsoleActionPacketCard } from "@/components/console/ConsoleActionPacketCard";
import { ConsoleOutlineBadge, ConsolePageHeader, ConsoleStatusBar, ConsoleSurface, ConsoleSurfaceHeader } from "@/components/console/ConsolePrimitives";
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
import { buildAgentLaunchPrompts, resolveKnowledgeBaseScopeSelection } from "@/lib/agent-runtime";
import {
  EMPTY_AGENT_EXECUTION_METRICS,
  readAgentExecutionEvidenceSummary,
  readAgentExecutionRuntimeBindingSummary,
  readAgentExecutionRuntimeSummary,
  listAgentExecutionMetrics,
  listAgentExecutions,
  readAgentExecutionRetrievalSummary,
  type AgentExecutionMetricsResponse,
  type AgentExecutionResponse
} from "@/lib/agent-executions";
import { buildAgentExecutionFollowUpActions } from "@/lib/agent-execution-follow-up";
import {
  EMPTY_AGENT_RUN_METRICS,
  listAgentRunMetrics,
  listAgentRuns,
  type AgentRunMetricsResponse,
  type AgentRunRecordInput,
  type AgentRunResponse,
  type AgentRunTriggerSource
} from "@/lib/agent-runs";
import { readApiErrorMessage } from "@/lib/api-errors";
import { hasDirectoryCapability } from "@/lib/auth/access";
import { useAuth } from "@/lib/auth/provider";
import {
  buildAdminHref,
  buildAgentsHref,
  buildOperationsHref,
  buildRuntimeGovernanceDefinitionsHref,
  buildRuntimeGovernanceSettingsHref,
  buildSettingsHref,
  buildToolTraceSettingsHref
} from "@/lib/console-route-builders";
import { useI18n } from "@/lib/i18n/provider";
import { buildSessionActorHeaders } from "@/lib/local-session";
import {
  listToolRegistrations,
  type PlatformToolRegistration
} from "@/lib/platform-governance";
import {
  loadAgentRuntimeGovernance,
  type AgentRuntimeGovernanceItem
} from "@/lib/runtime-governance";
import { buildGroundedValidationDraftQuestion } from "@/lib/workspace-follow-up";
import { buildOperationsWorkspaceHref } from "@/lib/workspace-handoffs";
import { cn } from "@/lib/utils";
import {
  formatDateTimeWithYear,
  formatDurationRange,
  formatStatusLabel,
  formatSubjectTypeLabel,
  formatTimestamp,
  formatWorkflowStepLabel,
  formatWorkflowTypeLabel,
  getStatusBadgeClass
} from "@/lib/workspace-formatters";
import type {
  KnowledgeBase,
  Tenant,
  WorkflowMetrics,
  WorkflowRetryMode,
  WorkflowRun,
  WorkflowRunDetail,
  Workspace
} from "@/components/workspace/workspace-types";

type AgentMetrics = {
  total_agents: number;
  active_agents: number;
  paused_agents: number;
  draft_agents: number;
  tool_enabled_agents: number;
  scoped_agents: number;
};

type AgentDefinition = {
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
};

type StatusFilter = "all" | "queued" | "running" | "failed" | "completed" | "pending";
type OperationsLane = "overview" | "failed" | "retries" | "pressure";

type ConsoleLinkHref =
  | ReturnType<typeof buildAdminHref>
  | ReturnType<typeof buildAgentsHref>
  | ReturnType<typeof buildOperationsHref>
  | ReturnType<typeof buildOperationsWorkspaceHref>;

type OperationsExecutionPacket = {
  title: string;
  detail: string;
  status: "attention" | "healthy" | "review";
  metricLabel: string;
  metricValue: string;
  primaryActionLabel: string;
  primaryActionHref: ConsoleLinkHref;
  primaryActionRunRecord?: AgentRunRecordInput | null;
  secondaryActions: Array<{
    label: string;
    href: ConsoleLinkHref;
    runRecord?: AgentRunRecordInput | null;
  }>;
};

const EMPTY_WORKFLOW_METRICS: WorkflowMetrics = {
  total_runs: 0,
  active_runs: 0,
  queued_runs: 0,
  running_runs: 0,
  retry_runs: 0,
  completed_runs: 0,
  failed_runs: 0
};

const EMPTY_AGENT_METRICS: AgentMetrics = {
  total_agents: 0,
  active_agents: 0,
  paused_agents: 0,
  draft_agents: 0,
  tool_enabled_agents: 0,
  scoped_agents: 0
};

function readAllowedStatusFilter(value: string | null): StatusFilter {
  if (value === "queued" || value === "running" || value === "failed" || value === "completed" || value === "pending") {
    return value;
  }

  return "all";
}

function readAllowedRetryMode(value: string | null): WorkflowRetryMode {
  if (value === "originals" || value === "retries") {
    return value;
  }

  return "all";
}

function readAllowedOperationsLane(value: string | null): OperationsLane {
  if (value === "failed" || value === "retries" || value === "pressure") {
    return value;
  }

  return "overview";
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

async function listTenants() {
  return await apiRequest<Tenant[]>("/tenants");
}

async function listWorkspaces(tenantId: string) {
  return await apiRequest<Workspace[]>(`/workspaces?tenant_id=${tenantId}`);
}

async function listKnowledgeBases(workspaceId: string) {
  return await apiRequest<KnowledgeBase[]>(`/knowledge-bases?workspace_id=${workspaceId}`);
}

async function loadWorkflowMetrics(tenantId: string) {
  return await apiRequest<WorkflowMetrics>(`/workflow-runs/metrics?tenant_id=${tenantId}`);
}

async function loadAgentMetrics(tenantId: string) {
  return await apiRequest<AgentMetrics>(`/agents/metrics?tenant_id=${tenantId}`);
}

async function loadWorkflowRuns(options: {
  tenantId: string;
  query: string;
  status: StatusFilter;
  retryMode: WorkflowRetryMode;
}) {
  const searchParams = new URLSearchParams({
    tenant_id: options.tenantId,
    sort: "updated-desc",
    limit: "24",
    offset: "0"
  });

  const normalizedQuery = options.query.trim();
  if (normalizedQuery) {
    searchParams.set("query", normalizedQuery);
  }
  if (options.status !== "all") {
    searchParams.set("status", options.status);
  }
  if (options.retryMode !== "all") {
    searchParams.set("retry_mode", options.retryMode);
  }

  return await apiRequest<WorkflowRun[]>(`/workflow-runs?${searchParams.toString()}`);
}

async function loadWorkflowRunDetail(tenantId: string, workflowRunId: string) {
  return await apiRequest<WorkflowRunDetail>(`/workflow-runs/${workflowRunId}?tenant_id=${tenantId}`);
}

async function retryWorkflowRun(tenantId: string, workflowRunId: string) {
  return await apiRequest<WorkflowRun>(`/workflow-runs/${workflowRunId}/retry?tenant_id=${tenantId}`, {
    method: "POST"
  });
}

function OperationsMetricCard({
  label,
  value,
  hint,
  accentClassName
}: {
  accentClassName?: string;
  hint: string;
  label: string;
  value: number;
}) {
  return (
    <ConsoleSurface className={cn("px-6 py-5", accentClassName)}>
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</div>
      <div className="mt-3 text-[34px] font-semibold tracking-tight text-slate-950">{value}</div>
      <div className="mt-2 text-sm text-slate-500">{hint}</div>
    </ConsoleSurface>
  );
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

export default function OperationsConsolePage() {
  const { language, t } = useI18n();
  const { session } = useAuth();
  const hasRetryAccess = hasDirectoryCapability(session, "retry_workflow_runs");
  const showAdvancedOperationsSections = false;

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
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [workflowMetrics, setWorkflowMetrics] = useState<WorkflowMetrics>(EMPTY_WORKFLOW_METRICS);
  const [agentMetrics, setAgentMetrics] = useState<AgentMetrics>(EMPTY_AGENT_METRICS);
  const [operationsAgentRunMetrics, setOperationsAgentRunMetrics] = useState<AgentRunMetricsResponse>(EMPTY_AGENT_RUN_METRICS);
  const [recentOperationsAgentRuns, setRecentOperationsAgentRuns] = useState<AgentRunResponse[]>([]);
  const [workflowRecoveryExecutionMetrics, setWorkflowRecoveryExecutionMetrics] = useState<AgentExecutionMetricsResponse>(EMPTY_AGENT_EXECUTION_METRICS);
  const [recentWorkflowRecoveryExecutions, setRecentWorkflowRecoveryExecutions] = useState<AgentExecutionResponse[]>([]);
  const [workflowRecoveryAgents, setWorkflowRecoveryAgents] = useState<AgentRuntimeGovernanceItem[]>([]);
  const [toolRegistrations, setToolRegistrations] = useState<PlatformToolRegistration[]>([]);
  const [workflowRuns, setWorkflowRuns] = useState<WorkflowRun[]>([]);
  const [selectedWorkflowRunId, setSelectedWorkflowRunId] = useState("");
  const [selectedWorkflowRunDetail, setSelectedWorkflowRunDetail] = useState<WorkflowRunDetail | null>(null);
  const [operationsLane, setOperationsLane] = useState<OperationsLane>("overview");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [retryMode, setRetryMode] = useState<WorkflowRetryMode>("all");
  const [query, setQuery] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingAgentRuns, setIsLoadingAgentRuns] = useState(false);
  const [isLoadingAgentExecutions, setIsLoadingAgentExecutions] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);

  useEffect(() => {
    function applyLocationState() {
      const searchParams = new URLSearchParams(window.location.search);
      setSelectedTenantId(searchParams.get("tenant_id") ?? "");
      setSelectedAgentId(searchParams.get("agent_id") ?? "");
      setOperationsLane(readAllowedOperationsLane(searchParams.get("lane")));
      setStatusFilter(readAllowedStatusFilter(searchParams.get("status")));
      setRetryMode(readAllowedRetryMode(searchParams.get("retry_mode")));
      setQuery(searchParams.get("query") ?? "");
      setSelectedWorkflowRunId(searchParams.get("workflow_run_id") ?? "");
    }

    applyLocationState();
    window.addEventListener("popstate", applyLocationState);

    return () => {
      window.removeEventListener("popstate", applyLocationState);
    };
  }, []);

  useEffect(() => {
    const nextUrl = new URL(window.location.href);
    const nextHref = buildOperationsHref({
      tenantId: selectedTenantId || null,
      agentId: selectedAgentId || null,
      lane: operationsLane,
      status: statusFilter,
      retryMode,
      query,
      workflowRunId: selectedWorkflowRunId || null
    });
    nextUrl.search = new URLSearchParams(
      Object.entries(nextHref.query ?? {}).map(([key, value]) => [key, String(value)])
    ).toString();
    window.history.replaceState({}, "", nextUrl);
  }, [operationsLane, query, retryMode, selectedAgentId, selectedTenantId, selectedWorkflowRunId, statusFilter]);

  useEffect(() => {
    let isMounted = true;

    async function loadTenantsDirectory() {
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
          setStatusMessage(t("operations.status.noTenants"));
          setWorkflowRuns([]);
          return;
        }

        setSelectedTenantId((currentValue) =>
          currentValue && nextTenants.some((tenant) => tenant.id === currentValue)
            ? currentValue
            : nextTenants[0].id
        );
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setErrorMessage(error instanceof Error ? error.message : t("operations.status.failed"));
        setStatusMessage(t("operations.status.failed"));
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadTenantsDirectory();

    return () => {
      isMounted = false;
    };
  }, [t]);

  useEffect(() => {
    if (!selectedTenantId) {
      setWorkspaces([]);
      setKnowledgeBases([]);
      setWorkflowMetrics(EMPTY_WORKFLOW_METRICS);
      setAgentMetrics(EMPTY_AGENT_METRICS);
      setOperationsAgentRunMetrics(EMPTY_AGENT_RUN_METRICS);
      setRecentOperationsAgentRuns([]);
      setWorkflowRecoveryExecutionMetrics(EMPTY_AGENT_EXECUTION_METRICS);
      setRecentWorkflowRecoveryExecutions([]);
      setWorkflowRecoveryAgents([]);
      setToolRegistrations([]);
      setWorkflowRuns([]);
      setSelectedWorkflowRunId("");
      setSelectedWorkflowRunDetail(null);
      return;
    }

    let isMounted = true;

    async function refreshOperations() {
      setIsLoading(true);
      setErrorMessage(null);
      setStatusMessage(t("operations.status.refreshing"));

      try {
        const [nextWorkspaces, nextWorkflowMetrics, nextAgentMetrics, nextWorkflowRecoveryAgents, nextToolRegistrations, nextWorkflowRuns] = await Promise.all([
          listWorkspaces(selectedTenantId),
          loadWorkflowMetrics(selectedTenantId),
          loadAgentMetrics(selectedTenantId),
          loadAgentRuntimeGovernance({
            tenant_id: selectedTenantId,
            status: "active",
            mode: "workflow_recovery"
          }),
          listToolRegistrations(),
          loadWorkflowRuns({
            tenantId: selectedTenantId,
            query,
            status: statusFilter,
            retryMode
          })
        ]);

        const scopedKnowledgeBaseCollections = await Promise.all(
          nextWorkspaces.map((workspace) => listKnowledgeBases(workspace.id))
        );
        const nextKnowledgeBases = scopedKnowledgeBaseCollections.flat();

        if (!isMounted) {
          return;
        }

        setWorkspaces(nextWorkspaces);
        setKnowledgeBases(nextKnowledgeBases);
        setWorkflowMetrics(nextWorkflowMetrics);
        setAgentMetrics(nextAgentMetrics);
        setWorkflowRecoveryAgents(nextWorkflowRecoveryAgents.items);
        setToolRegistrations(nextToolRegistrations);
        setWorkflowRuns(nextWorkflowRuns);
        setSelectedAgentId((currentValue) =>
          currentValue && nextWorkflowRecoveryAgents.items.some((agent) => agent.id === currentValue)
            ? currentValue
            : nextWorkflowRecoveryAgents.items[0]?.id ?? ""
        );
        setLastRefreshedAt(new Date().toISOString());
        setStatusMessage(
          t("operations.status.loaded", {
            count: String(nextWorkflowRuns.length)
          })
        );
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setWorkflowRuns([]);
        setSelectedWorkflowRunId("");
        setSelectedWorkflowRunDetail(null);
        setErrorMessage(error instanceof Error ? error.message : t("operations.status.failed"));
        setStatusMessage(t("operations.status.failed"));
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void refreshOperations();

    return () => {
      isMounted = false;
    };
  }, [query, retryMode, selectedTenantId, statusFilter, t]);

  useEffect(() => {
    if (!selectedTenantId) {
      setOperationsAgentRunMetrics(EMPTY_AGENT_RUN_METRICS);
      setRecentOperationsAgentRuns([]);
      return;
    }

    let isMounted = true;

    async function refreshOperationsAgentRuns() {
      setIsLoadingAgentRuns(true);

      try {
        const [nextAgentRunMetrics, nextRecentAgentRuns] = await Promise.all([
          listAgentRunMetrics(selectedTenantId, selectedAgentId || null, {
            targetSurface: "operations"
          }),
          listAgentRuns(selectedTenantId, selectedAgentId || null, 6, {
            targetSurface: "operations"
          })
        ]);

        if (!isMounted) {
          return;
        }

        setOperationsAgentRunMetrics(nextAgentRunMetrics);
        setRecentOperationsAgentRuns(nextRecentAgentRuns);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setOperationsAgentRunMetrics(EMPTY_AGENT_RUN_METRICS);
        setRecentOperationsAgentRuns([]);
        setErrorMessage(error instanceof Error ? error.message : t("operations.status.failed"));
      } finally {
        if (isMounted) {
          setIsLoadingAgentRuns(false);
        }
      }
    }

    void refreshOperationsAgentRuns();

    return () => {
      isMounted = false;
    };
  }, [selectedAgentId, selectedTenantId, t]);

  useEffect(() => {
    if (!selectedTenantId) {
      setWorkflowRecoveryExecutionMetrics(EMPTY_AGENT_EXECUTION_METRICS);
      setRecentWorkflowRecoveryExecutions([]);
      return;
    }

    let isMounted = true;

    async function refreshWorkflowRecoveryExecutions() {
      setIsLoadingAgentExecutions(true);

      try {
        const [nextExecutionMetrics, nextRecentExecutions] = await Promise.all([
          listAgentExecutionMetrics(selectedTenantId, selectedAgentId || null, {
            executionMode: "workflow_recovery"
          }),
          listAgentExecutions(selectedTenantId, selectedAgentId || null, 6, {
            executionMode: "workflow_recovery"
          })
        ]);

        if (!isMounted) {
          return;
        }

        setWorkflowRecoveryExecutionMetrics(nextExecutionMetrics);
        setRecentWorkflowRecoveryExecutions(nextRecentExecutions);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setWorkflowRecoveryExecutionMetrics(EMPTY_AGENT_EXECUTION_METRICS);
        setRecentWorkflowRecoveryExecutions([]);
        setErrorMessage(error instanceof Error ? error.message : t("operations.status.failed"));
      } finally {
        if (isMounted) {
          setIsLoadingAgentExecutions(false);
        }
      }
    }

    void refreshWorkflowRecoveryExecutions();

    return () => {
      isMounted = false;
    };
  }, [selectedAgentId, selectedTenantId, t]);

  useEffect(() => {
    if (!selectedTenantId || workflowRuns.length === 0) {
      setSelectedWorkflowRunId("");
      setSelectedWorkflowRunDetail(null);
      return;
    }

    const fallbackWorkflowRunId = workflowRuns[0]?.id ?? "";
    const nextWorkflowRunId = workflowRuns.some((workflowRun) => workflowRun.id === selectedWorkflowRunId)
      ? selectedWorkflowRunId
      : fallbackWorkflowRunId;

    if (!nextWorkflowRunId) {
      setSelectedWorkflowRunId("");
      setSelectedWorkflowRunDetail(null);
      return;
    }

    if (nextWorkflowRunId !== selectedWorkflowRunId) {
      setSelectedWorkflowRunId(nextWorkflowRunId);
      return;
    }

    let isMounted = true;

    async function refreshWorkflowDetail() {
      try {
        const nextDetail = await loadWorkflowRunDetail(selectedTenantId, nextWorkflowRunId);
        if (isMounted) {
          setSelectedWorkflowRunDetail(nextDetail);
        }
      } catch (error) {
        if (isMounted) {
          setSelectedWorkflowRunDetail(null);
          setErrorMessage(error instanceof Error ? error.message : t("operations.status.detailFailed"));
        }
      }
    }

    void refreshWorkflowDetail();

    return () => {
      isMounted = false;
    };
  }, [selectedTenantId, selectedWorkflowRunId, t, workflowRuns]);

  const selectedTenant = useMemo(
    () => tenants.find((tenant) => tenant.id === selectedTenantId) ?? null,
    [selectedTenantId, tenants]
  );

  const selectedRecoveryAgent = useMemo(
    () => workflowRecoveryAgents.find((agent) => agent.id === selectedAgentId) ?? null,
    [selectedAgentId, workflowRecoveryAgents]
  );

  const focusedRecoveryAgent = selectedRecoveryAgent ?? workflowRecoveryAgents[0] ?? null;

  const focusedRecoveryScope = useMemo(
    () =>
      resolveKnowledgeBaseScopeSelection(
        focusedRecoveryAgent?.knowledge_base_scope,
        workspaces,
        knowledgeBases
      ),
    [focusedRecoveryAgent, knowledgeBases, workspaces]
  );

  const focusedRecoveryWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === focusedRecoveryScope.workspaceId) ?? null,
    [focusedRecoveryScope.workspaceId, workspaces]
  );

  const focusedRecoveryWorkspaceId =
    selectedWorkflowRunDetail?.subject_workspace_id ??
    (focusedRecoveryScope.workspaceId.trim().length > 0 ? focusedRecoveryScope.workspaceId : null);
  const focusedRecoveryKnowledgeBaseId =
    selectedWorkflowRunDetail?.subject_knowledge_base_id ??
    (focusedRecoveryScope.knowledgeBaseId.trim().length > 0 ? focusedRecoveryScope.knowledgeBaseId : null);
  const focusedGovernanceKnowledgeBase =
    knowledgeBases.find((knowledgeBase) => knowledgeBase.id === focusedRecoveryKnowledgeBaseId) ?? null;
  const focusedGovernanceWorkspace =
    workspaces.find((workspace) => workspace.id === focusedRecoveryWorkspaceId) ?? focusedRecoveryWorkspace ?? null;
  const focusedRecoveryModelEndpoint = focusedRecoveryAgent?.resolved_model_endpoint ?? null;
  const focusedRecoveryRegisteredTools = useMemo(
    () =>
      focusedRecoveryAgent
        ? toolRegistrations.filter((toolRegistration) =>
            focusedRecoveryAgent.tool_registration_ids.includes(toolRegistration.id)
          )
        : [],
    [focusedRecoveryAgent, toolRegistrations]
  );
  const focusedRecoveryDisabledToolRegistration = useMemo(
    () =>
      focusedRecoveryRegisteredTools.find((toolRegistration) => !toolRegistration.is_enabled) ?? null,
    [focusedRecoveryRegisteredTools]
  );
  const focusedRecoveryApprovalToolRegistration = useMemo(
    () =>
      focusedRecoveryRegisteredTools.find((toolRegistration) => toolRegistration.requires_admin_approval) ?? null,
    [focusedRecoveryRegisteredTools]
  );
  const focusedRecoveryReservedMcpToolRegistration = useMemo(
    () =>
      focusedRecoveryRegisteredTools.find(
        (toolRegistration) =>
          toolRegistration.is_enabled &&
          toolRegistration.transport_type === "mcp_reserved" &&
          !toolRegistration.connector_reference?.trim()
      ) ?? null,
    [focusedRecoveryRegisteredTools]
  );
  const focusedRecoveryPendingMcpToolRegistration = useMemo(
    () =>
      focusedRecoveryRegisteredTools.find(
        (toolRegistration) =>
          toolRegistration.is_enabled &&
          toolRegistration.transport_type === "mcp_reserved" &&
          Boolean(toolRegistration.connector_reference?.trim())
      ) ?? null,
    [focusedRecoveryRegisteredTools]
  );
  const focusedRecoveryRetrievalProfile = focusedRecoveryAgent?.resolved_retrieval_profile ?? null;
  const focusedKnowledgeBaseGovernanceHref =
    focusedGovernanceKnowledgeBase
      ? buildAdminHref({
          tenantId: focusedGovernanceKnowledgeBase.tenant_id,
          section: "directory",
          workspaceId: focusedGovernanceKnowledgeBase.workspace_id,
          knowledgeBaseId: focusedGovernanceKnowledgeBase.id,
          managementPanel: "knowledge-base-edit"
        })
      : null;
  const focusedWorkspaceGovernanceHref =
    focusedGovernanceWorkspace
      ? buildAdminHref({
          tenantId: focusedGovernanceWorkspace.tenant_id,
          section: "directory",
          workspaceId: focusedGovernanceWorkspace.id,
          managementPanel: "workspace-edit"
        })
      : buildAdminHref({
          tenantId: selectedTenantId || null,
          section: "overview"
        });
  const focusedRuntimeGovernanceHref = focusedKnowledgeBaseGovernanceHref ?? focusedWorkspaceGovernanceHref;
  const focusedRuntimeSettingsHref = buildRuntimeGovernanceSettingsHref({
    tenantId: selectedTenantId || null,
    mode: "workflow_recovery",
    fallbackAgentId: (focusedRecoveryAgent?.id ?? selectedAgentId) || null,
    disabledModelEndpointId:
      focusedRecoveryModelEndpoint && !focusedRecoveryModelEndpoint.is_enabled ? focusedRecoveryModelEndpoint.id : null,
    disabledToolRegistrationId: focusedRecoveryDisabledToolRegistration?.id ?? null,
    pendingMcpToolRegistrationId: focusedRecoveryPendingMcpToolRegistration?.id ?? null,
    pendingMcpConnectorReference: focusedRecoveryPendingMcpToolRegistration?.connector_reference ?? null,
    reservedMcpToolRegistrationId: focusedRecoveryReservedMcpToolRegistration?.id ?? null,
    reservedMcpConnectorReference: focusedRecoveryReservedMcpToolRegistration?.connector_reference ?? null,
    disabledRetrievalProfileId:
      focusedRecoveryRetrievalProfile && !focusedRecoveryRetrievalProfile.is_enabled
        ? focusedRecoveryRetrievalProfile.id
        : null,
    approvalToolRegistrationId: focusedRecoveryApprovalToolRegistration?.id ?? null
  });
  const focusedRuntimeDefinitionsHref = buildRuntimeGovernanceDefinitionsHref({
    tenantId: selectedTenantId || null,
    mode: "workflow_recovery",
    fallbackAgentId: (focusedRecoveryAgent?.id ?? selectedAgentId) || null,
    disabledModelEndpointId:
      focusedRecoveryModelEndpoint && !focusedRecoveryModelEndpoint.is_enabled ? focusedRecoveryModelEndpoint.id : null,
    disabledToolRegistrationId: focusedRecoveryDisabledToolRegistration?.id ?? null,
    pendingMcpToolRegistrationId: focusedRecoveryPendingMcpToolRegistration?.id ?? null,
    reservedMcpToolRegistrationId: focusedRecoveryReservedMcpToolRegistration?.id ?? null,
    disabledRetrievalProfileId:
      focusedRecoveryRetrievalProfile && !focusedRecoveryRetrievalProfile.is_enabled
        ? focusedRecoveryRetrievalProfile.id
        : null,
    approvalToolRegistrationId: focusedRecoveryApprovalToolRegistration?.id ?? null
  });

  function buildOperationsAgentRunRecord(
    targetSurface: AgentRunRecordInput["target_surface"],
    handoffIntent?: string | null
  ): AgentRunRecordInput | null {
    if (!selectedTenantId || !focusedRecoveryAgent) {
      return null;
    }

    return {
      tenant_id: selectedTenantId,
      agent_definition_id: focusedRecoveryAgent.id,
      workspace_id: focusedRecoveryWorkspaceId,
      knowledge_base_id: focusedRecoveryKnowledgeBaseId,
      target_surface: targetSurface,
      handoff_intent: handoffIntent ?? null,
      trigger_source: "operations",
      launch_prompt: focusedRecoveryPrompts[0] ?? null
    };
  }

  const focusedRecoveryPrompts = useMemo(
    () =>
      focusedRecoveryAgent
        ? buildAgentLaunchPrompts({
            agent: {
              mode: focusedRecoveryAgent.mode,
              objective: focusedRecoveryAgent.objective
            },
            scopeLabel: focusedRecoveryAgent.knowledge_base_scope ?? null,
            language
          })
        : [],
    [focusedRecoveryAgent, language]
  );

  const focusedRecoveryChatHref =
    focusedRecoveryAgent && focusedRecoveryWorkspaceId && focusedRecoveryKnowledgeBaseId
      ? buildOperationsWorkspaceHref(operationsLane, {
          view: "chat",
          tenantId: selectedTenantId || null,
          workspaceId: focusedRecoveryWorkspaceId,
          knowledgeBaseId: focusedRecoveryKnowledgeBaseId,
          agentId: focusedRecoveryAgent.id,
          workflowRunId: selectedWorkflowRunDetail?.id ?? null,
          draftQuestion: focusedRecoveryPrompts[1] ?? focusedRecoveryPrompts[0] ?? null
        })
      : null;

  const focusedRecoveryDocumentsHref =
    focusedRecoveryAgent && focusedRecoveryWorkspaceId && focusedRecoveryKnowledgeBaseId
      ? buildOperationsWorkspaceHref(operationsLane, {
          view: "documents",
          tenantId: selectedTenantId || null,
          workspaceId: focusedRecoveryWorkspaceId,
          knowledgeBaseId: focusedRecoveryKnowledgeBaseId,
          agentId: focusedRecoveryAgent.id,
          handoffIntent: "document_recovery",
          documentId:
            selectedWorkflowRunDetail?.subject_type === "document"
              ? selectedWorkflowRunDetail.subject_id ?? null
              : null,
          documentStatus: "failed"
        })
      : null;
  const hasWorkflowPressure =
    workflowMetrics.failed_runs > 0 ||
    workflowMetrics.active_runs > 0 ||
    workflowMetrics.queued_runs > 0 ||
    workflowMetrics.retry_runs > 0;
  const defaultOperationsDocumentsHref = buildOperationsWorkspaceHref(operationsLane, {
    view: "documents",
    tenantId: selectedTenantId || null,
    workspaceId: selectedWorkflowRunDetail?.subject_workspace_id ?? focusedRecoveryWorkspaceId,
    knowledgeBaseId: selectedWorkflowRunDetail?.subject_knowledge_base_id ?? focusedRecoveryKnowledgeBaseId,
    agentId: focusedRecoveryAgent?.id ?? selectedAgentId ?? null,
    handoffIntent: workflowMetrics.failed_runs > 0 ? "document_recovery" : "agent_brief",
    documentId:
      selectedWorkflowRunDetail?.subject_type === "document"
        ? selectedWorkflowRunDetail.subject_id ?? null
        : null,
    documentStatus: workflowMetrics.failed_runs > 0 ? "failed" : null
  });
  const defaultOperationsWorkflowsHref = buildOperationsWorkspaceHref(operationsLane, {
    view: "workflows",
    tenantId: selectedTenantId || null,
    workspaceId: selectedWorkflowRunDetail?.subject_workspace_id ?? focusedRecoveryWorkspaceId,
    knowledgeBaseId: selectedWorkflowRunDetail?.subject_knowledge_base_id ?? focusedRecoveryKnowledgeBaseId,
    agentId: focusedRecoveryAgent?.id ?? selectedAgentId ?? null,
    handoffIntent: workflowMetrics.failed_runs > 0 ? "workflow_recovery" : "agent_brief",
    workflowRunId: selectedWorkflowRunDetail?.id ?? null,
    documentId:
      selectedWorkflowRunDetail?.subject_type === "document"
        ? selectedWorkflowRunDetail.subject_id ?? null
        : null,
    workflowStatus:
      workflowMetrics.failed_runs > 0
        ? "failed"
        : workflowMetrics.active_runs > 0
          ? "running"
          : workflowMetrics.queued_runs > 0
            ? "queued"
            : null
  });
  const defaultOperationsChatHref = buildOperationsWorkspaceHref(operationsLane, {
    view: "chat",
    tenantId: selectedTenantId || null,
    workspaceId: selectedWorkflowRunDetail?.subject_workspace_id ?? focusedRecoveryWorkspaceId,
    knowledgeBaseId: selectedWorkflowRunDetail?.subject_knowledge_base_id ?? focusedRecoveryKnowledgeBaseId,
    agentId: focusedRecoveryAgent?.id ?? selectedAgentId ?? null,
    handoffIntent: "grounded_validation",
    workflowRunId: selectedWorkflowRunDetail?.id ?? null,
    documentId:
      selectedWorkflowRunDetail?.subject_type === "document"
        ? selectedWorkflowRunDetail.subject_id ?? null
        : null,
    draftQuestion:
      buildGroundedValidationDraftQuestion(t, {
        documentTitle:
          selectedWorkflowRunDetail?.workflow_status === "completed" &&
          selectedWorkflowRunDetail?.subject_type === "document"
            ? selectedWorkflowRunDetail.subject_label ?? null
            : null,
        workflowStatus: selectedWorkflowRunDetail?.workflow_status ?? null,
        workflowLabel: selectedWorkflowRunDetail?.subject_label ?? null,
        workflowId: selectedWorkflowRunDetail?.id ?? null
      }) ||
      focusedRecoveryPrompts[1] ||
      focusedRecoveryPrompts[0] ||
      null
  });

  const operationsAgentRunSourceBreakdown = useMemo(() => {
    const sourceCounts = new Map<AgentRunTriggerSource, number>();
    for (const agentRun of recentOperationsAgentRuns) {
      sourceCounts.set(agentRun.trigger_source, (sourceCounts.get(agentRun.trigger_source) ?? 0) + 1);
    }

    return Array.from(sourceCounts.entries()).sort((left, right) => right[1] - left[1]);
  }, [recentOperationsAgentRuns]);

  const operationsRuntimeTaskPacket = useMemo(() => {
    const selectedRunStatus = selectedWorkflowRunDetail?.workflow_status ?? null;
    let detail = t("operations.runtimeTaskPacket.emptyDetail");
    let targetLabel = t("operations.runtimeTaskPacket.pending");
    let primaryActionHref = buildOperationsHref({
      tenantId: selectedTenantId || null,
      agentId: focusedRecoveryAgent?.id ?? selectedAgentId ?? null,
      lane: hasWorkflowPressure ? "pressure" : "overview",
      status:
        workflowMetrics.failed_runs > 0
          ? "failed"
          : workflowMetrics.active_runs > 0
            ? "running"
            : workflowMetrics.queued_runs > 0
              ? "queued"
              : "all",
      workflowRunId: selectedWorkflowRunDetail?.id ?? null
    });
    let primaryActionRunRecord: AgentRunRecordInput | null = null;
    let statusLabel = t("operations.runtimeTaskPacket.statuses.review");
    let statusTone: "attention" | "review" | "healthy" = "review";

    if (selectedWorkflowRunDetail) {
      if (selectedRunStatus === "completed") {
        detail = t("operations.runtimeTaskPacket.completedDetail");
        targetLabel = t("operations.runtimeTaskPacket.targets.chat");
        primaryActionHref = defaultOperationsChatHref;
        primaryActionRunRecord = buildOperationsAgentRunRecord("chat", "grounded_validation");
        statusLabel = t("operations.runtimeTaskPacket.statuses.ready");
        statusTone = "healthy";
      } else if (selectedRunStatus === "failed") {
        detail = t("operations.runtimeTaskPacket.failedDetail");
        targetLabel = t("operations.runtimeTaskPacket.targets.workflows");
        primaryActionHref = defaultOperationsWorkflowsHref;
        primaryActionRunRecord = buildOperationsAgentRunRecord("operations", "workflow_recovery");
        statusLabel = t("operations.runtimeTaskPacket.statuses.attention");
        statusTone = "attention";
      } else {
        detail = t("operations.runtimeTaskPacket.activeDetail");
        targetLabel = t("operations.runtimeTaskPacket.targets.workflows");
        primaryActionHref = defaultOperationsWorkflowsHref;
        primaryActionRunRecord = buildOperationsAgentRunRecord("operations", "workflow_recovery");
      }
    } else if (workflowMetrics.failed_runs > 0) {
      detail = t("operations.runtimeTaskPacket.failedDetail");
      targetLabel = t("operations.runtimeTaskPacket.targets.workflows");
      primaryActionHref = defaultOperationsWorkflowsHref;
      statusLabel = t("operations.runtimeTaskPacket.statuses.attention");
      statusTone = "attention";
    } else if (workflowMetrics.active_runs > 0 || workflowMetrics.queued_runs > 0 || workflowMetrics.retry_runs > 0) {
      detail = t("operations.runtimeTaskPacket.monitoringDetail");
      targetLabel = t("operations.runtimeTaskPacket.targets.workflows");
      primaryActionHref = defaultOperationsWorkflowsHref;
    } else if (focusedRecoveryWorkspaceId && focusedRecoveryKnowledgeBaseId) {
      detail = t("operations.runtimeTaskPacket.intakeDetail");
      targetLabel = t("operations.runtimeTaskPacket.targets.documents");
      primaryActionHref = defaultOperationsDocumentsHref;
      primaryActionRunRecord = buildOperationsAgentRunRecord("documents", "agent_brief");
    } else if (focusedRecoveryAgent) {
      detail = t("operations.runtimeTaskPacket.agentOnlyDetail");
      primaryActionHref = buildAgentsHref({
        tenantId: selectedTenantId || null,
        status: "active",
        mode: "workflow_recovery",
        agentId: focusedRecoveryAgent.id
      });
    }

    return {
      detail,
      objective: focusedRecoveryAgent?.objective.trim().length
        ? focusedRecoveryAgent.objective
        : t("operations.runtimeTaskPacket.noObjective"),
      primaryActionHref,
      prompt: focusedRecoveryPrompts[0] ?? t("operations.runtimeTaskPacket.noPrompt"),
      primaryActionRunRecord,
      secondaryActions: [
        {
          label: t("operations.runtimeTaskPacket.secondaryQueue"),
          href: buildOperationsHref({
            tenantId: selectedTenantId || null,
            agentId: focusedRecoveryAgent?.id ?? selectedAgentId ?? null,
            lane: selectedRunStatus === "failed" || workflowMetrics.failed_runs > 0 ? "failed" : hasWorkflowPressure ? "pressure" : "overview",
            status:
              selectedRunStatus === "failed" || workflowMetrics.failed_runs > 0
                ? "failed"
                : workflowMetrics.active_runs > 0
                  ? "running"
                  : workflowMetrics.queued_runs > 0
                    ? "queued"
                    : "all",
            workflowRunId: selectedWorkflowRunDetail?.id ?? null
          }),
          runRecord: null
        },
        {
          label: t("operations.runtimeTaskPacket.secondaryDocuments"),
          href:
            focusedRecoveryDocumentsHref ??
            defaultOperationsDocumentsHref,
          runRecord: buildOperationsAgentRunRecord(
            "documents",
            selectedRunStatus === "failed" || workflowMetrics.failed_runs > 0 ? "document_recovery" : "agent_brief"
          )
        },
        {
          label: t("operations.runtimeTaskPacket.secondaryGovernance"),
          href: focusedRuntimeGovernanceHref,
          runRecord: buildOperationsAgentRunRecord("admin", "workflow_recovery")
        }
      ],
      statusLabel,
      statusTone,
      summaryItems: [
        {
          label: t("operations.runtimeTaskPacket.fields.target"),
          value: targetLabel
        },
        {
          label: t("operations.runtimeTaskPacket.fields.runStatus"),
          value: selectedRunStatus ? formatStatusLabel(selectedRunStatus) : t("operations.runtimeTaskPacket.pending")
        },
        {
          label: t("operations.runtimeTaskPacket.fields.subject"),
          value:
            selectedWorkflowRunDetail?.subject_label ??
            selectedWorkflowRunDetail?.id ??
            t("operations.runtimeTaskPacket.pending")
        },
        {
          label: t("operations.runtimeTaskPacket.fields.workspace"),
          value:
            workspaces.find((workspace) => workspace.id === (selectedWorkflowRunDetail?.subject_workspace_id ?? focusedRecoveryWorkspaceId))
              ?.name ?? t("operations.runtimeTaskPacket.pending")
        },
        {
          label: t("operations.runtimeTaskPacket.fields.knowledgeBase"),
          value:
            knowledgeBases.find(
              (knowledgeBase) =>
                knowledgeBase.id === (selectedWorkflowRunDetail?.subject_knowledge_base_id ?? focusedRecoveryKnowledgeBaseId)
            )?.name ?? t("operations.runtimeTaskPacket.pending")
        }
      ],
      title:
        selectedWorkflowRunDetail?.subject_label ??
        focusedRecoveryAgent?.name ??
        t("operations.runtimeTaskPacket.emptyTitle")
    };
  }, [
    focusedRecoveryAgent,
    defaultOperationsChatHref,
    defaultOperationsDocumentsHref,
    defaultOperationsWorkflowsHref,
    focusedRecoveryDocumentsHref,
    focusedRecoveryKnowledgeBaseId,
    focusedRecoveryPrompts,
    focusedRecoveryWorkspaceId,
    focusedRuntimeGovernanceHref,
    buildOperationsAgentRunRecord,
    hasWorkflowPressure,
    knowledgeBases,
    selectedAgentId,
    selectedTenantId,
    selectedWorkflowRunDetail,
    t,
    workflowMetrics,
    workspaces
  ]);

  const operationsExecutionPackets = useMemo<OperationsExecutionPacket[]>(() => {
    const failedRunCount = workflowMetrics.failed_runs;
    const retryRunCount = workflowMetrics.retry_runs;
    const activeRecoveryAgentCount = workflowRecoveryAgents.length;
    const scopedRecoveryAgentCount = workflowRecoveryAgents.filter(
      (agent) => (agent.knowledge_base_scope ?? "").trim().length > 0
    ).length;
    const selectedRunStatus = selectedWorkflowRunDetail?.workflow_status ?? null;

    return [
      {
        title: t("operations.executionPackets.recovery.title"),
        detail:
          failedRunCount > 0
            ? t("operations.executionPackets.recovery.failedDetail", { count: String(failedRunCount) })
            : t("operations.executionPackets.recovery.healthyDetail"),
        status: failedRunCount > 0 ? "attention" : "healthy",
        metricLabel: t("operations.executionPackets.recovery.metric"),
        metricValue: String(failedRunCount),
        primaryActionLabel: t("operations.executionPackets.recovery.primaryAction"),
        primaryActionHref: buildOperationsHref({
          tenantId: selectedTenantId || null,
          agentId: selectedAgentId || null,
          lane: "failed",
          status: "failed"
        }),
        primaryActionRunRecord: null,
        secondaryActions: [
          {
            label: t("operations.executionPackets.recovery.secondaryDocuments"),
            href:
              focusedRecoveryDocumentsHref ??
              buildOperationsWorkspaceHref(operationsLane, {
                view: "documents",
                tenantId: selectedTenantId || null,
                workspaceId: focusedRecoveryWorkspaceId,
                knowledgeBaseId: focusedRecoveryKnowledgeBaseId,
                agentId: selectedAgentId || null,
                handoffIntent: "document_recovery",
                documentStatus: "failed"
              }),
            runRecord: buildOperationsAgentRunRecord("documents", "document_recovery")
          },
          {
            label: t("operations.executionPackets.recovery.secondaryAdmin"),
            href: focusedRuntimeGovernanceHref,
            runRecord: buildOperationsAgentRunRecord("admin", "workflow_recovery")
          }
        ]
      },
      {
        title: t("operations.executionPackets.retry.title"),
        detail:
          retryRunCount > 0
            ? t("operations.executionPackets.retry.readyDetail", { count: String(retryRunCount) })
            : t("operations.executionPackets.retry.emptyDetail"),
        status: retryRunCount > 0 ? "review" : "healthy",
        metricLabel: t("operations.executionPackets.retry.metric"),
        metricValue: String(retryRunCount),
        primaryActionLabel: t("operations.executionPackets.retry.primaryAction"),
        primaryActionHref: buildOperationsHref({
          tenantId: selectedTenantId || null,
          agentId: selectedAgentId || null,
          lane: "retries",
          retryMode: "retries",
          workflowRunId: selectedWorkflowRunDetail?.retry_of_workflow_run_id ? selectedWorkflowRunDetail.id : null
        }),
        primaryActionRunRecord: null,
        secondaryActions: [
          {
            label: t("operations.executionPackets.retry.secondaryQueued"),
            href: buildOperationsHref({
              tenantId: selectedTenantId || null,
              agentId: selectedAgentId || null,
              lane: "pressure",
              status: "queued"
            }),
            runRecord: null
          },
          {
            label: t("operations.executionPackets.retry.secondaryRunning"),
            href: buildOperationsHref({
              tenantId: selectedTenantId || null,
              agentId: selectedAgentId || null,
              lane: "pressure",
              status: "running"
            }),
            runRecord: null
          }
        ]
      },
      {
        title: t("operations.executionPackets.agent.title"),
        detail:
          activeRecoveryAgentCount > 0
            ? t("operations.executionPackets.agent.readyDetail", {
                scopedCount: String(scopedRecoveryAgentCount),
                totalCount: String(activeRecoveryAgentCount)
              })
            : t("operations.executionPackets.agent.emptyDetail"),
        status: activeRecoveryAgentCount === 0 ? "review" : scopedRecoveryAgentCount < activeRecoveryAgentCount ? "review" : "healthy",
        metricLabel: t("operations.executionPackets.agent.metric"),
        metricValue: `${scopedRecoveryAgentCount}/${activeRecoveryAgentCount}`,
        primaryActionLabel: t("operations.executionPackets.agent.primaryAction"),
        primaryActionHref:
          focusedRecoveryAgent
            ? buildOperationsHref({
                tenantId: selectedTenantId || null,
                agentId: focusedRecoveryAgent.id,
                lane: "failed",
                status: "failed",
                workflowRunId: selectedWorkflowRunDetail?.id ?? null
              })
            : buildAgentsHref({
              tenantId: selectedTenantId || null,
              status: "active",
              mode: "workflow_recovery"
            }),
        primaryActionRunRecord: null,
        secondaryActions: [
          {
            label: t("operations.executionPackets.agent.secondaryDefinitions"),
            href: buildAgentsHref({
              tenantId: selectedTenantId || null,
              status: "active",
              mode: "workflow_recovery",
              agentId: selectedAgentId || null
            }),
            runRecord: null
          },
          {
            label: t("operations.executionPackets.agent.secondaryBrief"),
            href:
              focusedRecoveryChatHref ??
              buildOperationsWorkspaceHref(operationsLane, {
                view: "chat",
                tenantId: selectedTenantId || null,
                workspaceId: focusedRecoveryWorkspaceId,
                knowledgeBaseId: focusedRecoveryKnowledgeBaseId,
                agentId: selectedAgentId || null,
                handoffIntent: "agent_brief"
              }),
            runRecord: buildOperationsAgentRunRecord("chat", "agent_brief")
          }
        ]
      },
      {
        title: t("operations.executionPackets.governance.title"),
        detail:
          focusedRecoveryAgent && focusedRecoveryWorkspaceId && focusedRecoveryKnowledgeBaseId
            ? t("operations.executionPackets.governance.readyDetail", {
                name: focusedRecoveryAgent.name
              })
            : activeRecoveryAgentCount > 0
              ? t("operations.executionPackets.governance.pendingDetail", {
                  count: String(activeRecoveryAgentCount)
                })
              : t("operations.executionPackets.governance.emptyDetail"),
        status:
          focusedRecoveryAgent && focusedRecoveryWorkspaceId && focusedRecoveryKnowledgeBaseId
            ? "healthy"
            : activeRecoveryAgentCount > 0
              ? "review"
              : "attention",
        metricLabel: t("operations.executionPackets.governance.metric"),
        metricValue:
          focusedRecoveryAgent?.name ??
          t("operations.executionPackets.governance.unassigned"),
        primaryActionLabel: t("operations.executionPackets.governance.primaryAction"),
        primaryActionHref:
          (focusedRecoveryModelEndpoint && !focusedRecoveryModelEndpoint.is_enabled) ||
          Boolean(focusedRecoveryDisabledToolRegistration) ||
          Boolean(focusedRecoveryPendingMcpToolRegistration) ||
          Boolean(focusedRecoveryReservedMcpToolRegistration) ||
          Boolean(focusedRecoveryRetrievalProfile && !focusedRecoveryRetrievalProfile.is_enabled)
            ? focusedRuntimeSettingsHref
            : focusedRuntimeGovernanceHref,
        primaryActionRunRecord:
          (focusedRecoveryModelEndpoint && !focusedRecoveryModelEndpoint.is_enabled) ||
          Boolean(focusedRecoveryDisabledToolRegistration) ||
          Boolean(focusedRecoveryPendingMcpToolRegistration) ||
          Boolean(focusedRecoveryReservedMcpToolRegistration) ||
          Boolean(focusedRecoveryRetrievalProfile && !focusedRecoveryRetrievalProfile.is_enabled)
            ? null
            : buildOperationsAgentRunRecord("admin", "workflow_recovery"),
        secondaryActions: [
          {
            label: t("operations.executionPackets.governance.secondaryDefinitions"),
            href: focusedRuntimeDefinitionsHref,
            runRecord: null
          },
          {
            label: t("operations.executionPackets.governance.secondaryAccess"),
            href: buildAdminHref({
              tenantId: selectedTenantId || null,
              section: "access"
            }),
            runRecord: buildOperationsAgentRunRecord("admin", "workflow_recovery")
          }
        ]
      },
      {
        title: t("operations.executionPackets.followUp.title"),
        detail:
          selectedRunStatus === "completed"
            ? t("operations.executionPackets.followUp.completedDetail")
            : selectedRunStatus === "failed"
              ? t("operations.executionPackets.followUp.failedDetail")
              : selectedRunStatus === "queued" || selectedRunStatus === "running" || selectedRunStatus === "pending"
                ? t("operations.executionPackets.followUp.activeDetail")
                : t("operations.executionPackets.followUp.emptyDetail"),
        status:
          selectedRunStatus === "failed"
            ? "attention"
            : selectedRunStatus === "completed"
              ? "healthy"
              : selectedRunStatus
                ? "review"
                : "review",
        metricLabel: t("operations.executionPackets.followUp.metric"),
        metricValue:
          selectedWorkflowRunDetail?.subject_label ??
          selectedWorkflowRunDetail?.id ??
          t("operations.executionPackets.followUp.notSelected"),
        primaryActionLabel: t("operations.executionPackets.followUp.primaryAction"),
        primaryActionHref: buildOperationsWorkspaceHref(operationsLane, {
          view: selectedRunStatus === "completed" ? "chat" : "workflows",
          tenantId: selectedTenantId || null,
          workspaceId: selectedWorkflowRunDetail?.subject_workspace_id ?? focusedRecoveryWorkspaceId,
          knowledgeBaseId: selectedWorkflowRunDetail?.subject_knowledge_base_id ?? focusedRecoveryKnowledgeBaseId,
          agentId: selectedAgentId || null,
          handoffIntent: selectedRunStatus === "completed" ? "grounded_validation" : "workflow_recovery",
          workflowRunId: selectedWorkflowRunDetail?.id ?? null,
          documentId:
            selectedWorkflowRunDetail?.subject_type === "document"
              ? selectedWorkflowRunDetail.subject_id ?? null
              : null,
          draftQuestion:
            selectedRunStatus === "completed"
              ? buildGroundedValidationDraftQuestion(t, {
                  documentTitle:
                    selectedWorkflowRunDetail?.subject_type === "document"
                      ? selectedWorkflowRunDetail.subject_label ?? null
                      : null,
                  workflowStatus: selectedWorkflowRunDetail?.workflow_status ?? null,
                  workflowLabel: selectedWorkflowRunDetail?.subject_label ?? null,
                  workflowId: selectedWorkflowRunDetail?.id ?? null
                })
              : null
        }),
        primaryActionRunRecord: buildOperationsAgentRunRecord(
          selectedRunStatus === "completed" ? "chat" : "operations",
          selectedRunStatus === "completed" ? "grounded_validation" : "workflow_recovery"
        ),
        secondaryActions: [
          {
            label: t("operations.executionPackets.followUp.secondaryWorkspace"),
            href: buildOperationsWorkspaceHref(operationsLane, {
              view: "workflows",
              tenantId: selectedTenantId || null,
              workspaceId: selectedWorkflowRunDetail?.subject_workspace_id ?? focusedRecoveryWorkspaceId,
              knowledgeBaseId: selectedWorkflowRunDetail?.subject_knowledge_base_id ?? focusedRecoveryKnowledgeBaseId,
              agentId: selectedAgentId || null,
              handoffIntent: "workflow_recovery",
              workflowRunId: selectedWorkflowRunDetail?.id ?? null
            }),
            runRecord: buildOperationsAgentRunRecord("operations", "workflow_recovery")
          },
          ...(selectedWorkflowRunDetail?.subject_type === "document" && selectedWorkflowRunDetail.subject_id
            ? [
                {
                  label: t("operations.executionPackets.followUp.secondarySubject"),
                  href: buildOperationsWorkspaceHref(operationsLane, {
                    view: "documents",
                    tenantId: selectedTenantId || null,
                    workspaceId: selectedWorkflowRunDetail?.subject_workspace_id ?? focusedRecoveryWorkspaceId,
                    knowledgeBaseId: selectedWorkflowRunDetail?.subject_knowledge_base_id ?? focusedRecoveryKnowledgeBaseId,
                    agentId: selectedAgentId || null,
                    handoffIntent: "document_recovery",
                    documentId: selectedWorkflowRunDetail.subject_id
                  }),
                  runRecord: buildOperationsAgentRunRecord("documents", "document_recovery")
                }
              ]
            : [])
        ].filter((action) => JSON.stringify(action.href) !== JSON.stringify(
          buildOperationsWorkspaceHref(operationsLane, {
            view: selectedRunStatus === "completed" ? "chat" : "workflows",
            tenantId: selectedTenantId || null,
            workspaceId: selectedWorkflowRunDetail?.subject_workspace_id ?? focusedRecoveryWorkspaceId,
            knowledgeBaseId: selectedWorkflowRunDetail?.subject_knowledge_base_id ?? focusedRecoveryKnowledgeBaseId,
            agentId: selectedAgentId || null,
            handoffIntent: selectedRunStatus === "completed" ? "grounded_validation" : "workflow_recovery",
            workflowRunId: selectedWorkflowRunDetail?.id ?? null,
            documentId:
              selectedWorkflowRunDetail?.subject_type === "document"
                ? selectedWorkflowRunDetail.subject_id ?? null
                : null,
            draftQuestion:
              selectedRunStatus === "completed"
                ? buildGroundedValidationDraftQuestion(t, {
                    documentTitle:
                      selectedWorkflowRunDetail?.subject_type === "document"
                        ? selectedWorkflowRunDetail.subject_label ?? null
                        : null,
                    workflowStatus: selectedWorkflowRunDetail?.workflow_status ?? null,
                    workflowLabel: selectedWorkflowRunDetail?.subject_label ?? null,
                    workflowId: selectedWorkflowRunDetail?.id ?? null
                  })
                : null
          })
        ))
      }
    ];
  }, [
    focusedRecoveryAgent,
    focusedRecoveryChatHref,
    focusedRecoveryDisabledToolRegistration,
    focusedRecoveryDocumentsHref,
    focusedRecoveryKnowledgeBaseId,
    focusedRecoveryModelEndpoint,
    focusedRecoveryPendingMcpToolRegistration,
    focusedRecoveryRetrievalProfile,
    focusedRecoveryReservedMcpToolRegistration,
    focusedRuntimeDefinitionsHref,
    focusedRecoveryWorkspaceId,
    focusedRuntimeSettingsHref,
    focusedRuntimeGovernanceHref,
    buildOperationsAgentRunRecord,
    selectedAgentId,
    selectedTenantId,
    selectedWorkflowRunDetail,
    t,
    workflowMetrics.failed_runs,
    workflowMetrics.retry_runs,
    workflowRecoveryAgents
  ]);

  const queueSummaryItems = [
    {
      key: "queued",
      value: workflowMetrics.queued_runs,
      label: t("operations.queues.queued"),
      href: buildOperationsHref({
        tenantId: selectedTenantId || null,
        agentId: selectedAgentId || null,
        lane: "pressure",
        status: "queued"
      })
    },
    {
      key: "running",
      value: workflowMetrics.running_runs,
      label: t("operations.queues.running"),
      href: buildOperationsHref({
        tenantId: selectedTenantId || null,
        agentId: selectedAgentId || null,
        lane: "pressure",
        status: "running"
      })
    },
    {
      key: "failed",
      value: workflowMetrics.failed_runs,
      label: t("operations.queues.failed"),
      href: buildOperationsHref({
        tenantId: selectedTenantId || null,
        agentId: selectedAgentId || null,
        lane: "failed",
        status: "failed"
      })
    },
    {
      key: "retry",
      value: workflowMetrics.retry_runs,
      label: t("operations.queues.retries"),
      href: buildOperationsHref({
        tenantId: selectedTenantId || null,
        agentId: selectedAgentId || null,
        lane: "retries",
        retryMode: "retries"
      })
    }
  ];

  const laneItems = [
    {
      key: "overview" as const,
      label: t("operations.lanes.overview"),
      description: t("operations.lanes.overviewDescription"),
      value: workflowMetrics.total_runs
    },
    {
      key: "failed" as const,
      label: t("operations.lanes.failed"),
      description: t("operations.lanes.failedDescription"),
      value: workflowMetrics.failed_runs
    },
    {
      key: "retries" as const,
      label: t("operations.lanes.retries"),
      description: t("operations.lanes.retriesDescription"),
      value: workflowMetrics.retry_runs
    },
    {
      key: "pressure" as const,
      label: t("operations.lanes.pressure"),
      description: t("operations.lanes.pressureDescription"),
      value: workflowMetrics.queued_runs + workflowMetrics.running_runs
    }
  ];

  function handleSelectOperationsLane(lane: OperationsLane) {
    setOperationsLane(lane);

    if (lane === "failed") {
      setStatusFilter("failed");
      setRetryMode("all");
    } else if (lane === "retries") {
      setStatusFilter("all");
      setRetryMode("retries");
    } else if (lane === "pressure") {
      setStatusFilter("queued");
      setRetryMode("all");
    } else {
      setStatusFilter("all");
      setRetryMode("all");
    }

    setSelectedWorkflowRunId("");
  }

  async function handleRetryWorkflow() {
    if (!hasRetryAccess) {
      return;
    }

    if (!selectedTenantId || !selectedWorkflowRunDetail || !selectedWorkflowRunDetail.is_retry_available) {
      return;
    }

    try {
      setIsRetrying(true);
      setErrorMessage(null);
      setStatusMessage(t("operations.status.retrying"));

      const retriedRun = await retryWorkflowRun(selectedTenantId, selectedWorkflowRunDetail.id);
      setOperationsLane("retries");
      setStatusFilter("all");
      setRetryMode("retries");
      setQuery("");
      setWorkflowRuns((currentRuns) => [
        retriedRun,
        ...currentRuns.filter((workflowRun) => workflowRun.id !== retriedRun.id)
      ]);
      setSelectedWorkflowRunDetail(null);
      setSelectedWorkflowRunId(retriedRun.id);
      setStatusMessage(t("operations.status.retryQueuedFocused"));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("operations.status.retryFailed"));
      setStatusMessage(t("operations.status.retryFailed"));
    } finally {
      setIsRetrying(false);
    }
  }

  const selectedWorkflowWorkspaceHref = selectedWorkflowRunDetail
    ? buildOperationsWorkspaceHref(operationsLane, {
        view: "workflows",
        tenantId: selectedTenantId || null,
        workspaceId: selectedWorkflowRunDetail.subject_workspace_id ?? null,
        knowledgeBaseId: selectedWorkflowRunDetail.subject_knowledge_base_id ?? null,
        agentId: selectedAgentId || null,
        handoffIntent: "workflow_recovery",
        workflowRunId: selectedWorkflowRunDetail.id
      })
    : null;

  const selectedWorkflowDocumentHref =
    selectedWorkflowRunDetail?.subject_id
      ? buildOperationsWorkspaceHref(operationsLane, {
          view: "documents",
          tenantId: selectedTenantId || null,
          workspaceId: selectedWorkflowRunDetail.subject_workspace_id ?? null,
          knowledgeBaseId: selectedWorkflowRunDetail.subject_knowledge_base_id ?? null,
          agentId: selectedAgentId || null,
          handoffIntent: "document_recovery",
          documentId: selectedWorkflowRunDetail.subject_id
        })
      : null;

  const selectedWorkflowChatHref = selectedWorkflowRunDetail
    ? buildOperationsWorkspaceHref(operationsLane, {
        view: "chat",
        tenantId: selectedTenantId || null,
        workspaceId: selectedWorkflowRunDetail.subject_workspace_id ?? null,
        knowledgeBaseId: selectedWorkflowRunDetail.subject_knowledge_base_id ?? null,
        agentId: selectedAgentId || null,
        handoffIntent: "agent_brief"
      })
    : null;

  return (
    <ConsoleShell activeHref="/operations">
      <PageTitleSync title={t("operations.title")} />
      <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-6">
        <ConsolePageHeader
          actions={
            <>
              <Select disabled={isLoading || tenants.length === 0} onValueChange={setSelectedTenantId} value={selectedTenantId}>
                <SelectTrigger className="min-w-[240px] rounded-xl border-slate-200 bg-white">
                  <SelectValue placeholder={t("operations.filters.tenant")} />
                </SelectTrigger>
                <SelectContent>
                  {tenants.map((tenant) => (
                    <SelectItem key={tenant.id} value={tenant.id}>
                      {tenant.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button className="rounded-xl border-slate-200 bg-white text-slate-700 hover:bg-slate-50" disabled={isLoading} onClick={() => window.location.reload()} type="button" variant="outline">
                <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
                {t("operations.actions.refresh")}
              </Button>
              <Badge
                className={cn(
                  "border",
                  hasRetryAccess
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-amber-200 bg-amber-50 text-amber-700"
                )}
                variant="outline"
              >
                {hasRetryAccess ? t("operations.access.retryEnabled") : t("operations.access.readOnly")}
              </Badge>
            </>
          }
          description={t("operations.header.description")}
          eyebrow={t("operations.header.eyebrow")}
          icon={<Waypoints className="h-4 w-4" />}
          title={t("operations.header.title")}
        />

        <ConsoleStatusBar
          error={errorMessage}
          message={isLoading ? t("operations.status.loading") : statusMessage || t("operations.status.ready")}
          meta={lastRefreshedAt ? t("operations.status.lastRefreshed", { value: formatTimestamp(lastRefreshedAt) }) : undefined}
        />

        <ConsoleSurface className="p-3">
          <ConsoleSurfaceHeader
            description={t("operations.lanes.description")}
            title={t("operations.lanes.title")}
          />
          <div className="grid gap-3 p-3 lg:grid-cols-4">
            {laneItems.map((item) => (
              <button
                className={cn(
                  "rounded-[20px] border px-5 py-5 text-left transition",
                  operationsLane === item.key
                    ? "border-blue-200 bg-blue-50/70 shadow-sm"
                    : "border-slate-100 bg-slate-50/70 hover:border-slate-200 hover:bg-white"
                )}
                key={item.key}
                onClick={() => handleSelectOperationsLane(item.key)}
                type="button"
              >
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{item.label}</div>
                <div className="mt-3 text-[30px] font-semibold tracking-tight text-slate-950">{item.value}</div>
                <div className="mt-2 text-sm leading-6 text-slate-500">{item.description}</div>
              </button>
            ))}
          </div>
        </ConsoleSurface>

        <div className="grid gap-4 xl:grid-cols-4">
          <OperationsMetricCard hint={t("operations.metrics.totalHint")} label={t("operations.metrics.total")} value={workflowMetrics.total_runs} />
          <OperationsMetricCard hint={t("operations.metrics.activeHint")} label={t("operations.metrics.active")} value={workflowMetrics.active_runs} accentClassName="border-amber-200" />
          <OperationsMetricCard hint={t("operations.metrics.failedHint")} label={t("operations.metrics.failed")} value={workflowMetrics.failed_runs} accentClassName="border-rose-200" />
          <OperationsMetricCard hint={t("operations.metrics.agentsHint")} label={t("operations.metrics.activeAgents")} value={agentMetrics.active_agents} />
        </div>

        <ConsoleSurface>
          <ConsoleSurfaceHeader
            description={t("operations.runtimeTaskPacket.description")}
            title={t("operations.runtimeTaskPacket.title")}
          />
          <div className="p-6">
            <ConsoleRuntimeTaskPacket
              detail={operationsRuntimeTaskPacket.detail}
              objective={operationsRuntimeTaskPacket.objective}
              objectiveLabel={t("operations.runtimeTaskPacket.fields.objective")}
              primaryActionHref={operationsRuntimeTaskPacket.primaryActionHref}
              primaryActionLabel={t("operations.runtimeTaskPacket.primaryAction")}
              primaryActionRunRecord={operationsRuntimeTaskPacket.primaryActionRunRecord}
              prompt={operationsRuntimeTaskPacket.prompt}
              promptLabel={t("operations.runtimeTaskPacket.fields.prompt")}
              secondaryActions={operationsRuntimeTaskPacket.secondaryActions}
              statusLabel={operationsRuntimeTaskPacket.statusLabel}
              statusTone={operationsRuntimeTaskPacket.statusTone}
              summaryItems={operationsRuntimeTaskPacket.summaryItems}
              title={operationsRuntimeTaskPacket.title}
            />
          </div>
        </ConsoleSurface>

        {showAdvancedOperationsSections ? (
        <ConsoleSurface>
          <ConsoleSurfaceHeader
            action={
              <Button asChild className="bg-white" size="sm" type="button" variant="outline">
                <Link href={buildAgentsHref({ tenantId: selectedTenantId || null, agentId: selectedAgentId || null })}>
                  <Bot className="h-4 w-4" />
                  {t("operations.agentRuntime.openAgents")}
                </Link>
              </Button>
            }
            description={t("operations.agentRuntime.description")}
            title={t("operations.agentRuntime.title")}
          />
          <div className="grid gap-4 p-6">
            <div className="grid gap-3 lg:grid-cols-3">
              <div className="rounded-[18px] border border-slate-100 bg-slate-50/70 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  {t("operations.agentRuntime.totalRuns")}
                </div>
                <div className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{operationsAgentRunMetrics.total_runs}</div>
              </div>
              <div className="rounded-[18px] border border-slate-100 bg-slate-50/70 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  {t("operations.agentRuntime.selectedAgent")}
                </div>
                <div className="mt-3 text-base font-semibold text-slate-950">
                  {focusedRecoveryAgent?.name ?? t("operations.agentRuntime.noSelectedAgent")}
                </div>
              </div>
              <div className="rounded-[18px] border border-slate-100 bg-slate-50/70 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  {t("operations.agentRuntime.latestLaunchLabel")}
                </div>
                <div className="mt-3 text-base font-semibold text-slate-950">
                  {operationsAgentRunMetrics.latest_launched_at
                    ? t("operations.agentRuntime.latestLaunch", {
                        value: formatTimestamp(operationsAgentRunMetrics.latest_launched_at)
                      })
                    : t("operations.agentRuntime.noLatestLaunch")}
                </div>
              </div>
            </div>

            <div className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-5">
              <div className="text-sm font-semibold text-slate-950">{t("operations.agentRuntime.sourceMix")}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {operationsAgentRunSourceBreakdown.length > 0 ? (
                  operationsAgentRunSourceBreakdown.map(([triggerSource, count]) => (
                    <ConsoleOutlineBadge key={triggerSource}>
                      {formatAgentRunTriggerSourceLabel(triggerSource, t)} · {count}
                    </ConsoleOutlineBadge>
                  ))
                ) : (
                  <div className="text-sm text-slate-500">{t("operations.agentRuntime.noSourceMix")}</div>
                )}
              </div>
            </div>

            <div className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-slate-950">{t("operations.agentExecutions.title")}</div>
                {isLoadingAgentExecutions ? <div className="text-xs text-slate-400">{t("operations.actions.refresh")}</div> : null}
              </div>
              <div className="mt-4 grid gap-3 lg:grid-cols-3">
                <div className="rounded-[18px] border border-slate-100 bg-white p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                    {t("operations.agentExecutions.total")}
                  </div>
                  <div className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
                    {workflowRecoveryExecutionMetrics.total_executions}
                  </div>
                </div>
                <div className="rounded-[18px] border border-slate-100 bg-white p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                    {t("operations.agentExecutions.completed")}
                  </div>
                  <div className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
                    {workflowRecoveryExecutionMetrics.completed_executions}
                  </div>
                </div>
                <div className="rounded-[18px] border border-slate-100 bg-white p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                    {t("operations.agentExecutions.failed")}
                  </div>
                  <div className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
                    {workflowRecoveryExecutionMetrics.failed_executions}
                  </div>
                </div>
              </div>
              <div className="mt-4 space-y-3">
                {recentWorkflowRecoveryExecutions.length > 0 ? (
                  recentWorkflowRecoveryExecutions.map((execution) => {
                    const toolRuntime = readToolRuntimeSummary(execution.result_payload_json);
                    const retrievalSummary = readAgentExecutionRetrievalSummary(execution.result_payload_json);
                    const evidenceSummary = readAgentExecutionEvidenceSummary(execution.result_payload_json);
                    const runtimeBindingSummary = readAgentExecutionRuntimeBindingSummary(execution.result_payload_json);
                    const runtimeSummary = readAgentExecutionRuntimeSummary(execution.result_payload_json);
                    const recommendedActionSpecs = evidenceSummary?.recommendedActionSpecs ?? [];
                    const recommendedActions =
                      recommendedActionSpecs.length === 0 ? evidenceSummary?.recommendedActions.slice(0, 2) ?? [] : [];
                    const followUpActions = buildAgentExecutionFollowUpActions({
                      sourceContext: { surface: "operations", lane: operationsLane },
                      execution,
                      executionInput: evidenceSummary?.executionInput,
                      recommendedActions: recommendedActionSpecs
                    });

                    return (
                      <div className="rounded-[18px] border border-slate-100 bg-white px-4 py-4" key={execution.id}>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-slate-950">
                              {workflowRecoveryAgents.find((agent) => agent.id === execution.agent_definition_id)?.name ??
                                t("operations.agentRuntime.unknownAgent")}
                            </div>
                            <div className="mt-1 text-sm leading-6 text-slate-500">
                              {execution.summary || execution.error_message || t("operations.agentExecutions.pending")}
                            </div>
                          </div>
                          <Badge
                            className={cn(
                              "border",
                              execution.execution_status === "completed"
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : execution.execution_status === "failed"
                                  ? "border-rose-200 bg-rose-50 text-rose-700"
                                  : execution.execution_status === "running"
                                    ? "border-blue-200 bg-blue-50 text-blue-700"
                                    : "border-amber-200 bg-amber-50 text-amber-700"
                            )}
                            variant="outline"
                          >
                            {t(`agents.executions.statuses.${execution.execution_status}`)}
                          </Badge>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <ConsoleOutlineBadge>{formatTimestamp(execution.updated_at)}</ConsoleOutlineBadge>
                          <ConsoleOutlineBadge>{t(`agents.modes.${execution.execution_mode}`)}</ConsoleOutlineBadge>
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
                          {execution.knowledge_base_scope ? (
                            <ConsoleOutlineBadge>{execution.knowledge_base_scope}</ConsoleOutlineBadge>
                          ) : null}
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
                          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                              {t("agents.executions.executionInput")}
                            </div>
                            <div className="mt-2 text-sm leading-6 text-slate-700">{evidenceSummary.executionInput}</div>
                          </div>
                        ) : null}
                        {evidenceSummary?.answerPreview ? (
                          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3">
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
                        {runtimeSummary && runtimeSummary.graphTrace.length > 0 ? (
                          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                              {t("agents.executions.runtimeTrace")}
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {runtimeSummary.graphTrace.map((entry, index) => (
                                <ConsoleOutlineBadge key={`${execution.id}-graph-${entry.step}-${index}`}>
                                  {`${entry.step} · ${entry.status}`}
                                </ConsoleOutlineBadge>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        {evidenceSummary && evidenceSummary.retrievalSources.length > 0 ? (
                          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                              {t("agents.executions.evidenceSources")}
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {evidenceSummary.retrievalMethodBreakdown.map((entry) => (
                                <Badge
                                  className={cn("border", getRetrievalMethodBadgeClassName(entry.method))}
                                  key={`${execution.id}-${entry.method}`}
                                  variant="outline"
                                >
                                  {t(`settings.retrievalProfiles.modes.${entry.method}`)} x{entry.count}
                                </Badge>
                              ))}
                            </div>
                            <div className="mt-3 space-y-2">
                              {evidenceSummary.retrievalSources.map((source, index) => (
                                <div className="rounded-lg border border-slate-100 bg-white px-3 py-3" key={`${execution.id}-${source.documentChunkId ?? index}`}>
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
                        {recommendedActions.length > 0 ? (
                          <div className="mt-4 flex flex-wrap gap-2">
                            {recommendedActions.map((action) => (
                              <ConsoleOutlineBadge key={action}>{action}</ConsoleOutlineBadge>
                            ))}
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
                                  key={`${execution.id}-${action.id}`}
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
                        {toolRuntime ? (
                          <ToolRuntimeSummaryCard
                            renderTraceActions={(trace) => renderExecutionToolTraceActions(execution, trace)}
                            summary={toolRuntime}
                          />
                        ) : null}
                      </div>
                    );
                  })
                ) : (
                  <div className="text-sm text-slate-500">{t("operations.agentExecutions.empty")}</div>
                )}
              </div>
            </div>

            <div className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-slate-950">{t("operations.agentRuntime.recentRuns")}</div>
                {isLoadingAgentRuns ? <div className="text-xs text-slate-400">{t("operations.actions.refresh")}</div> : null}
              </div>
              <div className="mt-4 space-y-3">
                {recentOperationsAgentRuns.length > 0 ? (
                  recentOperationsAgentRuns.map((agentRun) => (
                    <div className="rounded-[18px] border border-slate-100 bg-white px-4 py-4" key={agentRun.id}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-slate-950">
                            {workflowRecoveryAgents.find((agent) => agent.id === agentRun.agent_definition_id)?.name ??
                              t("operations.agentRuntime.unknownAgent")}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">{agentRun.id}</div>
                        </div>
                        <Badge className={cn("border", getStatusBadgeClass(agentRun.run_status))} variant="outline">
                          {t(`agents.runs.statuses.${agentRun.run_status}`)}
                        </Badge>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <ConsoleOutlineBadge>{formatAgentRunTriggerSourceLabel(agentRun.trigger_source, t)}</ConsoleOutlineBadge>
                        {agentRun.handoff_intent ? <ConsoleOutlineBadge>{agentRun.handoff_intent}</ConsoleOutlineBadge> : null}
                        <ConsoleOutlineBadge>{formatTimestamp(agentRun.created_at)}</ConsoleOutlineBadge>
                      </div>
                      {agentRun.navigation_href ? (
                        <div className="mt-4">
                          <AgentRunButtonLink
                            href={agentRun.navigation_href}
                            runRecord={buildOperationsAgentRunRecord(agentRun.target_surface, agentRun.handoff_intent)}
                            size="sm"
                            type="button"
                          >
                            {t("agents.runs.openRoute")}
                          </AgentRunButtonLink>
                        </div>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-slate-500">{t("operations.agentRuntime.empty")}</div>
                )}
              </div>
              </div>
            </div>
        </ConsoleSurface>
        ) : null}

        {showAdvancedOperationsSections ? (
        <ConsoleSurface>
          <ConsoleSurfaceHeader
            description={t("operations.executionPackets.description")}
            title={t("operations.executionPackets.title")}
          />
          <div className="grid gap-4 p-6 xl:grid-cols-2">
            {operationsExecutionPackets.map((item) => (
              <ConsoleActionPacketCard
                detail={item.detail}
                key={item.title}
                metricLabel={item.metricLabel}
                metricValue={item.metricValue}
                primaryActionHref={item.primaryActionHref}
                primaryActionLabel={item.primaryActionLabel}
                primaryActionRunRecord={item.primaryActionRunRecord}
                secondaryActions={item.secondaryActions}
                status={item.status}
                statusLabel={
                  item.status === "attention"
                    ? t("operations.executionPackets.statuses.attention")
                    : item.status === "review"
                      ? t("operations.executionPackets.statuses.review")
                      : t("operations.executionPackets.statuses.healthy")
                }
                title={item.title}
              />
            ))}
          </div>
        </ConsoleSurface>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_420px]">
          <div className="grid gap-6">
            <ConsoleSurface>
              <ConsoleSurfaceHeader
                action={
                  <div className="flex flex-wrap gap-2">
                    <Button asChild className="bg-white" size="sm" type="button" variant="outline">
                      <Link href={buildAgentsHref({ tenantId: selectedTenantId || null, agentId: selectedAgentId || null })}>
                        <Bot className="h-4 w-4" />
                        {t("operations.actions.openAgents")}
                      </Link>
                    </Button>
                    <Button asChild className="bg-white" size="sm" type="button" variant="outline">
                      <Link href={buildAdminHref({ tenantId: selectedTenantId || null, section: "overview" })}>
                        <ShieldCheck className="h-4 w-4" />
                        {t("operations.actions.openAdmin")}
                      </Link>
                    </Button>
                  </div>
                }
                description={t("operations.scope.description")}
                title={t("operations.scope.title")}
              />
              <div className="grid gap-4 p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-5">
                  <div className="text-sm font-semibold text-slate-950">{selectedTenant?.name ?? t("operations.scope.notAvailable")}</div>
                  <div className="mt-2 text-sm text-slate-500">{selectedTenant?.slug ?? t("operations.scope.notAvailable")}</div>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <ConsoleOutlineBadge>{t("operations.scope.workspaces", { count: String(workspaces.length) })}</ConsoleOutlineBadge>
                    <ConsoleOutlineBadge>{t("operations.scope.agentDrafts", { count: String(agentMetrics.total_agents) })}</ConsoleOutlineBadge>
                    <ConsoleOutlineBadge>{t("operations.scope.toolEnabledAgents", { count: String(agentMetrics.tool_enabled_agents) })}</ConsoleOutlineBadge>
                    {selectedRecoveryAgent ? (
                      <ConsoleOutlineBadge>{t("operations.recoveryAgents.selectedAgent", { name: selectedRecoveryAgent.name })}</ConsoleOutlineBadge>
                    ) : null}
                  </div>
                  <div className="mt-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{t("operations.scope.recoveryAgent")}</div>
                    <Select onValueChange={setSelectedAgentId} value={selectedAgentId}>
                      <SelectTrigger className="mt-2 bg-white">
                        <SelectValue placeholder={t("operations.scope.selectRecoveryAgent")} />
                      </SelectTrigger>
                      <SelectContent>
                        {workflowRecoveryAgents.map((agent) => (
                          <SelectItem key={agent.id} value={agent.id}>
                            {agent.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {queueSummaryItems.map((item) => (
                    <div className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-5" key={item.key}>
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{item.label}</div>
                      <div className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{item.value}</div>
                      <div className="mt-4">
                        <Button asChild className="bg-white" size="sm" type="button" variant="outline">
                          <Link href={item.href}>
                            {t("operations.actions.openQueue")}
                            <ArrowRight className="h-4 w-4" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </ConsoleSurface>

            <ConsoleSurface>
              <ConsoleSurfaceHeader
                description={t("operations.directory.description")}
                title={t("operations.directory.title")}
              />
              <div className="grid gap-3 border-b border-slate-100 px-6 py-4 md:grid-cols-[minmax(0,1fr)_220px_220px]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input className="pl-9" onChange={(event) => setQuery(event.target.value)} placeholder={t("operations.filters.searchPlaceholder")} value={query} />
                </div>
                <Select onValueChange={(value) => setStatusFilter(value as StatusFilter)} value={statusFilter}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder={t("operations.filters.status")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("operations.filters.allStatuses")}</SelectItem>
                    <SelectItem value="queued">{t("operations.queues.queued")}</SelectItem>
                    <SelectItem value="running">{t("operations.queues.running")}</SelectItem>
                    <SelectItem value="failed">{t("operations.queues.failed")}</SelectItem>
                    <SelectItem value="completed">{t("operations.queues.completed")}</SelectItem>
                    <SelectItem value="pending">{t("operations.queues.pending")}</SelectItem>
                  </SelectContent>
                </Select>
                <Select onValueChange={(value) => setRetryMode(value as WorkflowRetryMode)} value={retryMode}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder={t("operations.filters.retryMode")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("operations.filters.allRetries")}</SelectItem>
                    <SelectItem value="originals">{t("operations.filters.originals")}</SelectItem>
                    <SelectItem value="retries">{t("operations.filters.retries")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-3 p-4">
                {workflowRuns.length === 0 ? (
                  <div className="rounded-[20px] border border-dashed border-slate-200 bg-slate-50/80 px-5 py-8">
                    <div className="text-sm text-slate-500">{t("operations.directory.empty")}</div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <AgentRunButtonLink
                        href={defaultOperationsDocumentsHref}
                        runRecord={buildOperationsAgentRunRecord(
                          "documents",
                          workflowMetrics.failed_runs > 0 ? "document_recovery" : "agent_brief"
                        )}
                        size="sm"
                        type="button"
                      >
                        {t("operations.executionPackets.recovery.secondaryDocuments")}
                      </AgentRunButtonLink>
                      <Button asChild className="bg-white" size="sm" type="button" variant="outline">
                        <Link href={defaultOperationsWorkflowsHref}>{t("operations.focus.openWorkflowFollowUp")}</Link>
                      </Button>
                    </div>
                  </div>
                ) : (
                  workflowRuns.map((workflowRun) => (
                    <button
                      className={cn(
                        "w-full rounded-[20px] border px-4 py-4 text-left transition",
                        selectedWorkflowRunId === workflowRun.id
                          ? "border-blue-200 bg-blue-50/70 shadow-sm"
                          : "border-slate-100 bg-slate-50/70 hover:border-slate-200 hover:bg-white"
                      )}
                      key={workflowRun.id}
                      onClick={() => setSelectedWorkflowRunId(workflowRun.id)}
                      type="button"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-base font-semibold text-slate-950">
                            {workflowRun.subject_label || formatWorkflowTypeLabel(workflowRun.workflow_type)}
                          </div>
                          <div className="mt-1 truncate text-sm text-slate-500">{workflowRun.id}</div>
                        </div>
                        <Badge className={cn("border", getStatusBadgeClass(workflowRun.workflow_status))} variant="outline">
                          {formatStatusLabel(workflowRun.workflow_status)}
                        </Badge>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <ConsoleOutlineBadge>{formatWorkflowTypeLabel(workflowRun.workflow_type)}</ConsoleOutlineBadge>
                        <ConsoleOutlineBadge>{formatSubjectTypeLabel(workflowRun.subject_type)}</ConsoleOutlineBadge>
                        {workflowRun.retry_of_workflow_run_id ? (
                          <ConsoleOutlineBadge>{t("operations.directory.retryRun")}</ConsoleOutlineBadge>
                        ) : null}
                      </div>
                      <div className="mt-3 text-sm leading-6 text-slate-500">
                        {workflowRun.error_message || t("operations.directory.noError")}
                      </div>
                      <div className="mt-4 text-xs text-slate-400">
                        {t("operations.directory.updatedAt", { value: formatTimestamp(workflowRun.updated_at) })}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </ConsoleSurface>
          </div>

          <div className="grid gap-6">
            <ConsoleSurface>
              <ConsoleSurfaceHeader
                description={t("operations.focus.description")}
                title={t("operations.focus.title")}
              />
              <div className="grid gap-4 p-6">
                <div className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-5">
                  <div className="text-sm font-semibold text-slate-950">{t("operations.focus.selectedRun")}</div>
                  <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                    {selectedWorkflowRunDetail?.subject_label || t("operations.focus.notSelected")}
                  </div>
                  <div className="mt-2 text-sm text-slate-500">
                    {selectedWorkflowRunDetail?.id || t("operations.focus.selectHint")}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {selectedWorkflowRunDetail ? (
                      <>
                        <Badge className={cn("border", getStatusBadgeClass(selectedWorkflowRunDetail.workflow_status))} variant="outline">
                          {formatStatusLabel(selectedWorkflowRunDetail.workflow_status)}
                        </Badge>
                        <ConsoleOutlineBadge>{formatWorkflowTypeLabel(selectedWorkflowRunDetail.workflow_type)}</ConsoleOutlineBadge>
                      </>
                    ) : null}
                  </div>
                </div>
                <div className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-5">
                  <div className="text-sm font-semibold text-slate-950">{t("operations.focus.guardrail")}</div>
                  <div className="mt-2 text-sm leading-6 text-slate-500">
                    {selectedWorkflowRunDetail?.retry_unavailable_reason ||
                      (selectedWorkflowRunDetail?.is_retry_available
                        ? t("operations.focus.retryReady")
                        : t("operations.focus.retryBlocked"))}
                  </div>
                  <div className="mt-4">
                    <Button
                      disabled={!hasRetryAccess || !selectedWorkflowRunDetail?.is_retry_available || isRetrying}
                      onClick={() => void handleRetryWorkflow()}
                      size="sm"
                      type="button"
                    >
                      <RefreshCw className={cn("h-4 w-4", isRetrying && "animate-spin")} />
                      {t("operations.actions.retryRun")}
                    </Button>
                  </div>
                </div>
                <div className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-5">
                  <div className="text-sm font-semibold text-slate-950">{t("operations.focus.nextStep")}</div>
                  <div className="mt-2 text-sm leading-6 text-slate-500">
                    {selectedWorkflowRunDetail?.workflow_status === "failed"
                      ? t("operations.focus.nextStepFailed")
                      : selectedWorkflowRunDetail?.workflow_status === "completed"
                        ? t("operations.focus.nextStepCompleted")
                          : selectedWorkflowRunDetail?.workflow_status
                          ? t("operations.focus.nextStepActive")
                          : t("operations.focus.nextStepEmpty")}
                  </div>
                  {selectedWorkflowRunDetail ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <AgentRunButtonLink
                        href={buildOperationsWorkspaceHref(operationsLane, {
                          view: selectedWorkflowRunDetail.workflow_status === "completed" ? "chat" : "workflows",
                          tenantId: selectedTenantId || null,
                          workspaceId: selectedWorkflowRunDetail.subject_workspace_id ?? null,
                          knowledgeBaseId: selectedWorkflowRunDetail.subject_knowledge_base_id ?? null,
                          agentId: selectedAgentId || null,
                          handoffIntent:
                            selectedWorkflowRunDetail.workflow_status === "completed"
                              ? "grounded_validation"
                              : "workflow_recovery",
                          workflowRunId: selectedWorkflowRunDetail.id
                        })}
                        runRecord={buildOperationsAgentRunRecord(
                          selectedWorkflowRunDetail.workflow_status === "completed" ? "chat" : "operations",
                          selectedWorkflowRunDetail.workflow_status === "completed"
                            ? "grounded_validation"
                            : "workflow_recovery"
                        )}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                          {selectedWorkflowRunDetail.workflow_status === "completed"
                            ? t("operations.focus.openChatFollowUp")
                            : t("operations.focus.openWorkflowFollowUp")}
                      </AgentRunButtonLink>
                      {selectedWorkflowRunDetail.subject_id ? (
                        <AgentRunButtonLink
                          href={buildOperationsWorkspaceHref(operationsLane, {
                            view: "documents",
                            tenantId: selectedTenantId || null,
                            workspaceId: selectedWorkflowRunDetail.subject_workspace_id ?? null,
                            knowledgeBaseId: selectedWorkflowRunDetail.subject_knowledge_base_id ?? null,
                            agentId: selectedAgentId || null,
                            handoffIntent: "document_recovery",
                            documentId: selectedWorkflowRunDetail.subject_id
                          })}
                          runRecord={buildOperationsAgentRunRecord("documents", "document_recovery")}
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                            {t("operations.focus.openSubjectFollowUp")}
                        </AgentRunButtonLink>
                      ) : null}
                    </div>
                  ) : focusedRecoveryWorkspaceId && focusedRecoveryKnowledgeBaseId ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <AgentRunButtonLink
                        href={workflowMetrics.failed_runs > 0 || workflowMetrics.active_runs > 0 || workflowMetrics.queued_runs > 0
                          ? defaultOperationsWorkflowsHref
                          : defaultOperationsDocumentsHref}
                        runRecord={buildOperationsAgentRunRecord(
                          workflowMetrics.failed_runs > 0 || workflowMetrics.active_runs > 0 || workflowMetrics.queued_runs > 0
                            ? "operations"
                            : "documents",
                          workflowMetrics.failed_runs > 0
                            ? "workflow_recovery"
                            : workflowMetrics.active_runs > 0 || workflowMetrics.queued_runs > 0
                              ? "workflow_recovery"
                              : "agent_brief"
                        )}
                        size="sm"
                        type="button"
                      >
                        {workflowMetrics.failed_runs > 0 || workflowMetrics.active_runs > 0 || workflowMetrics.queued_runs > 0
                          ? t("operations.focus.openWorkflowFollowUp")
                          : t("operations.executionPackets.recovery.secondaryDocuments")}
                      </AgentRunButtonLink>
                      <Button asChild className="bg-white" size="sm" type="button" variant="outline">
                        <Link
                          href={
                            workflowMetrics.failed_runs > 0 || workflowMetrics.active_runs > 0 || workflowMetrics.queued_runs > 0
                              ? defaultOperationsDocumentsHref
                              : defaultOperationsChatHref
                          }
                        >
                          {workflowMetrics.failed_runs > 0 || workflowMetrics.active_runs > 0 || workflowMetrics.queued_runs > 0
                            ? t("operations.executionPackets.recovery.secondaryDocuments")
                            : t("operations.focus.openChatFollowUp")}
                        </Link>
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>
            </ConsoleSurface>

            {showAdvancedOperationsSections ? (
            <ConsoleSurface>
              <ConsoleSurfaceHeader
                description={t("operations.recoveryAgents.description")}
                title={t("operations.recoveryAgents.title")}
              />
              <div className="grid gap-4 p-6">
                {focusedRecoveryAgent ? (
                  <div className="rounded-[20px] border border-blue-200 bg-blue-50/40 p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
                          {t("operations.recoveryAgents.runtimePacket")}
                        </div>
                        <div className="mt-2 text-base font-semibold text-slate-950">
                          {focusedRecoveryAgent.name}
                        </div>
                        <div className="mt-2 text-sm leading-6 text-slate-600">
                          {focusedRecoveryAgent.objective.trim().length > 0
                            ? focusedRecoveryAgent.objective
                            : t("operations.recoveryAgents.noObjective")}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Badge className="border-blue-200 bg-white text-blue-700" variant="outline">
                            {t("agents.modes.workflow_recovery")}
                          </Badge>
                          {focusedRecoveryAgent.knowledge_base_scope ? (
                            <ConsoleOutlineBadge>
                              {t("operations.recoveryAgents.scopeReady", {
                                scope: focusedRecoveryAgent.knowledge_base_scope
                              })}
                            </ConsoleOutlineBadge>
                          ) : (
                            <ConsoleOutlineBadge>
                              {t("operations.recoveryAgents.scopeMissing")}
                            </ConsoleOutlineBadge>
                          )}
                          {focusedRecoveryWorkspace ? (
                            <ConsoleOutlineBadge>{focusedRecoveryWorkspace.name}</ConsoleOutlineBadge>
                          ) : null}
                          {focusedRecoveryModelEndpoint && !focusedRecoveryModelEndpoint.is_enabled ? (
                            <ConsoleOutlineBadge className="border-amber-200 bg-amber-50 text-amber-800">
                              {t("operations.recoveryAgents.disabledModel", { name: focusedRecoveryModelEndpoint.name })}
                            </ConsoleOutlineBadge>
                          ) : null}
                          {focusedRecoveryDisabledToolRegistration ? (
                            <ConsoleOutlineBadge className="border-amber-200 bg-amber-50 text-amber-800">
                              {t("operations.recoveryAgents.disabledTool", { name: focusedRecoveryDisabledToolRegistration.name })}
                            </ConsoleOutlineBadge>
                          ) : null}
                          {focusedRecoveryReservedMcpToolRegistration ? (
                            <ConsoleOutlineBadge className="border-sky-200 bg-sky-50 text-sky-700">
                              {t("operations.recoveryAgents.reservedMcpTool", { name: focusedRecoveryReservedMcpToolRegistration.name })}
                            </ConsoleOutlineBadge>
                          ) : null}
                          {focusedRecoveryPendingMcpToolRegistration ? (
                            <ConsoleOutlineBadge className="border-indigo-200 bg-indigo-50 text-indigo-700">
                              {t("operations.recoveryAgents.pendingMcpTool", { name: focusedRecoveryPendingMcpToolRegistration.name })}
                            </ConsoleOutlineBadge>
                          ) : null}
                          {focusedRecoveryRetrievalProfile && !focusedRecoveryRetrievalProfile.is_enabled ? (
                            <ConsoleOutlineBadge className="border-amber-200 bg-amber-50 text-amber-800">
                              {t("operations.recoveryAgents.disabledRetrieval", { name: focusedRecoveryRetrievalProfile.name })}
                            </ConsoleOutlineBadge>
                          ) : null}
                          {focusedRecoveryApprovalToolRegistration ? (
                            <ConsoleOutlineBadge className="border-sky-200 bg-sky-50 text-sky-700">
                              {t("operations.recoveryAgents.approvalTool", { name: focusedRecoveryApprovalToolRegistration.name })}
                            </ConsoleOutlineBadge>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button asChild className="bg-white" size="sm" type="button" variant="outline">
                          <Link
                            href={buildAgentsHref({
                              tenantId: selectedTenantId || null,
                              status: "active",
                              mode: "workflow_recovery",
                              agentId: focusedRecoveryAgent.id
                            })}
                          >
                            {t("operations.recoveryAgents.openDefinition")}
                          </Link>
                        </Button>
                        <Button asChild size="sm" type="button">
                          <Link
                            href={buildOperationsHref({
                              tenantId: selectedTenantId || null,
                              agentId: focusedRecoveryAgent.id,
                              lane: "failed",
                              status: "failed",
                              workflowRunId: selectedWorkflowRunDetail?.id ?? null
                            })}
                          >
                            {t("operations.recoveryAgents.openRecommended")}
                          </Link>
                        </Button>
                        {focusedRecoveryChatHref ? (
                          <AgentRunButtonLink
                            href={focusedRecoveryChatHref}
                            runRecord={buildOperationsAgentRunRecord("chat", "agent_brief")}
                            size="sm"
                            type="button"
                            variant="outline"
                          >
                              {t("operations.recoveryAgents.openRecoveryBrief")}
                          </AgentRunButtonLink>
                        ) : null}
                        {focusedRecoveryDocumentsHref ? (
                          <AgentRunButtonLink
                            href={focusedRecoveryDocumentsHref}
                            runRecord={buildOperationsAgentRunRecord("documents", "document_recovery")}
                            size="sm"
                            type="button"
                            variant="outline"
                          >
                              {t("operations.recoveryAgents.openScopedDocuments")}
                          </AgentRunButtonLink>
                        ) : null}
                        {focusedRuntimeSettingsHref ? (
                          <Button asChild className="bg-white" size="sm" type="button" variant="outline">
                            <Link href={focusedRuntimeSettingsHref}>{t("operations.recoveryAgents.openRuntimeSettings")}</Link>
                          </Button>
                        ) : null}
                        <Button asChild className="bg-white" size="sm" type="button" variant="outline">
                          <Link href={focusedRuntimeDefinitionsHref}>{t("operations.recoveryAgents.openImpactedDefinitions")}</Link>
                        </Button>
                      </div>
                    </div>
                    {focusedRecoveryPrompts.length > 0 ? (
                      <div className="mt-4 rounded-[16px] border border-blue-100 bg-white px-4 py-4">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                          {t("operations.recoveryAgents.launchPrompt")}
                        </div>
                        <div className="mt-2 text-sm leading-6 text-slate-700">
                          {focusedRecoveryPrompts[0]}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-5">
                  <div className="text-sm font-semibold text-slate-950">{t("operations.recoveryAgents.activeCount")}</div>
                  <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{workflowRecoveryAgents.length}</div>
                  <div className="mt-2 text-sm leading-6 text-slate-500">
                    {workflowRecoveryAgents.length > 0
                      ? t("operations.recoveryAgents.activeReady")
                      : t("operations.recoveryAgents.activeEmpty")}
                  </div>
                </div>

                <div className="space-y-3">
                  {workflowRecoveryAgents.slice(0, 3).map((agent) => (
                    <div className="rounded-[18px] border border-slate-100 bg-slate-50/70 px-4 py-4" key={agent.id}>
                      <div className="text-sm font-semibold text-slate-950">{agent.name}</div>
                      <div className="mt-1 text-xs text-slate-400">{agent.slug}</div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <ConsoleOutlineBadge>{t("agents.statuses.active")}</ConsoleOutlineBadge>
                        <ConsoleOutlineBadge>{agent.knowledge_base_scope || t("operations.recoveryAgents.unscoped")}</ConsoleOutlineBadge>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button asChild className="bg-white" size="sm" type="button" variant="outline">
                          <Link
                            href={buildAgentsHref({
                              tenantId: selectedTenantId || null,
                              status: "active",
                              mode: "workflow_recovery",
                              agentId: agent.id
                            })}
                          >
                            {t("operations.recoveryAgents.openDefinition")}
                          </Link>
                        </Button>
                        <Button asChild size="sm" type="button">
                      <Link
                        href={buildOperationsHref({
                          tenantId: selectedTenantId || null,
                          agentId: agent.id,
                          lane: "failed",
                          status: "failed"
                        })}
                      >
                            {t("operations.recoveryAgents.openRecommended")}
                          </Link>
                        </Button>
                      </div>
                    </div>
                  ))}
                  {workflowRecoveryAgents.length === 0 ? (
                    <div className="text-sm text-slate-500">{t("operations.recoveryAgents.noAgents")}</div>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button asChild className="bg-white" size="sm" type="button" variant="outline">
                    <Link
                      href={buildAgentsHref({
                        tenantId: selectedTenantId || null,
                        status: "active",
                        mode: "workflow_recovery",
                        agentId: selectedAgentId || null
                      })}
                    >
                      {t("operations.recoveryAgents.openAgents")}
                    </Link>
                  </Button>
                  <Button asChild className="bg-white" size="sm" type="button" variant="outline">
                    <Link
                      href={buildOperationsHref({
                        tenantId: selectedTenantId || null,
                        agentId: selectedAgentId || null,
                        lane: "failed",
                        status: "failed"
                      })}
                    >
                      {t("operations.recoveryAgents.openFailedQueue")}
                    </Link>
                  </Button>
                </div>
              </div>
            </ConsoleSurface>
            ) : null}

            <ConsoleSurface>
              <ConsoleSurfaceHeader
                description={t("operations.detail.description")}
                title={t("operations.detail.title")}
              />
              {selectedWorkflowRunDetail ? (
                <div className="grid gap-4 p-6">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[18px] border border-slate-100 bg-slate-50/70 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{t("operations.detail.startedAt")}</div>
                      <div className="mt-2 text-sm text-slate-900">
                        {selectedWorkflowRunDetail.started_at
                          ? formatDateTimeWithYear(selectedWorkflowRunDetail.started_at)
                          : t("operations.detail.notAvailable")}
                      </div>
                    </div>
                    <div className="rounded-[18px] border border-slate-100 bg-slate-50/70 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{t("operations.detail.duration")}</div>
                      <div className="mt-2 text-sm text-slate-900">
                        {formatDurationRange(selectedWorkflowRunDetail.started_at, selectedWorkflowRunDetail.completed_at)}
                      </div>
                    </div>
                    <div className="rounded-[18px] border border-slate-100 bg-slate-50/70 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{t("operations.detail.workspace")}</div>
                      <div className="mt-2 text-sm text-slate-900">
                        {workspaces.find((workspace) => workspace.id === selectedWorkflowRunDetail.subject_workspace_id)?.name ??
                          t("operations.detail.notAvailable")}
                      </div>
                    </div>
                    <div className="rounded-[18px] border border-slate-100 bg-slate-50/70 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{t("operations.detail.knowledgeBase")}</div>
                      <div className="mt-2 text-sm text-slate-900">
                        {knowledgeBases.find((knowledgeBase) => knowledgeBase.id === selectedWorkflowRunDetail.subject_knowledge_base_id)?.name ??
                          t("operations.detail.notAvailable")}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[18px] border border-slate-100 bg-slate-50/70 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{t("operations.detail.retryOf")}</div>
                      <div className="mt-2 break-all text-sm text-slate-900">
                        {selectedWorkflowRunDetail.retry_of_workflow_run_id ?? t("operations.detail.notAvailable")}
                      </div>
                    </div>
                    <div className="rounded-[18px] border border-slate-100 bg-slate-50/70 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{t("operations.detail.temporalWorkflowId")}</div>
                      <div className="mt-2 break-all text-sm text-slate-900">
                        {selectedWorkflowRunDetail.temporal_workflow_id ?? t("operations.detail.notAvailable")}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-5">
                    <div className="grid gap-3 lg:grid-cols-[0.8fr_1.2fr]">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                          {t("operations.detail.recommendedAction")}
                        </div>
                        <div className="mt-2 text-sm font-semibold text-slate-950">
                          {selectedWorkflowRunDetail.recommended_primary_action === "retry_workflow"
                            ? t("operations.actions.retryRun")
                            : selectedWorkflowRunDetail.recommended_primary_action === "open_chat"
                              ? t("operations.focus.openChatFollowUp")
                              : selectedWorkflowRunDetail.recommended_primary_action === "open_document"
                                ? t("operations.focus.openSubjectFollowUp")
                                : t("operations.focus.openWorkflowFollowUp")}
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          {selectedWorkflowRunDetail.recommended_primary_action === "retry_workflow" ? (
                            <Button
                              disabled={isRetrying || !hasRetryAccess || !selectedWorkflowRunDetail.is_retry_available}
                              onClick={() => void handleRetryWorkflow()}
                              size="sm"
                              type="button"
                            >
                              {t("operations.actions.retryRun")}
                            </Button>
                          ) : null}
                          {selectedWorkflowRunDetail.recommended_primary_action === "open_chat" && selectedWorkflowChatHref ? (
                            <AgentRunButtonLink
                              href={selectedWorkflowChatHref}
                              runRecord={buildOperationsAgentRunRecord("chat", "agent_brief")}
                              size="sm"
                              type="button"
                            >
                              {t("operations.focus.openChatFollowUp")}
                            </AgentRunButtonLink>
                          ) : null}
                          {selectedWorkflowRunDetail.recommended_primary_action === "open_document" && selectedWorkflowDocumentHref ? (
                            <AgentRunButtonLink
                              href={selectedWorkflowDocumentHref}
                              runRecord={buildOperationsAgentRunRecord("documents", "document_recovery")}
                              size="sm"
                              type="button"
                              variant="outline"
                            >
                              {t("operations.focus.openSubjectFollowUp")}
                            </AgentRunButtonLink>
                          ) : null}
                          {selectedWorkflowWorkspaceHref ? (
                            <AgentRunButtonLink
                              href={selectedWorkflowWorkspaceHref}
                              runRecord={buildOperationsAgentRunRecord("operations", "workflow_recovery")}
                              size="sm"
                              type="button"
                              variant="outline"
                            >
                              {t("operations.focus.openWorkflowFollowUp")}
                            </AgentRunButtonLink>
                          ) : null}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                          {t("operations.detail.followUpReason")}
                        </div>
                        <div className="mt-2 text-sm leading-6 text-slate-600">
                          {selectedWorkflowRunDetail.follow_up_reason ??
                            (selectedWorkflowRunDetail.workflow_status === "failed"
                              ? t("operations.focus.nextStepFailed")
                              : selectedWorkflowRunDetail.workflow_status === "completed"
                                ? t("operations.focus.nextStepCompleted")
                                : selectedWorkflowRunDetail.workflow_status === "queued" ||
                                    selectedWorkflowRunDetail.workflow_status === "running" ||
                                    selectedWorkflowRunDetail.workflow_status === "pending"
                                  ? t("operations.focus.nextStepActive")
                                  : t("operations.focus.nextStepEmpty"))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-5">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                      <Activity className="h-4 w-4 text-blue-600" />
                      {t("operations.detail.steps")}
                    </div>
                    <div className="mt-4 space-y-3">
                      {selectedWorkflowRunDetail.steps.length === 0 ? (
                        <div className="text-sm text-slate-500">{t("operations.detail.noSteps")}</div>
                      ) : (
                        selectedWorkflowRunDetail.steps.map((step) => (
                          <div className="rounded-[18px] border border-slate-100 bg-white px-4 py-3" key={step.id}>
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-sm font-semibold text-slate-950">{formatWorkflowStepLabel(step.step_name)}</div>
                                <div className="mt-1 text-xs text-slate-500">
                                  {t("operations.detail.attemptCount", { count: String(step.attempt_count) })}
                                </div>
                              </div>
                              <Badge className={cn("border", getStatusBadgeClass(step.step_status))} variant="outline">
                                {formatStatusLabel(step.step_status)}
                              </Badge>
                            </div>
                            {step.error_message ? (
                              <div className="mt-3 text-sm leading-6 text-rose-700">{step.error_message}</div>
                            ) : null}
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {selectedWorkflowWorkspaceHref ? (
                      <AgentRunButtonLink
                        href={selectedWorkflowWorkspaceHref}
                        runRecord={buildOperationsAgentRunRecord("operations", "workflow_recovery")}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        {t("operations.actions.openWorkspaceRun")}
                      </AgentRunButtonLink>
                    ) : null}
                    {selectedWorkflowDocumentHref ? (
                      <AgentRunButtonLink
                        href={selectedWorkflowDocumentHref}
                        runRecord={buildOperationsAgentRunRecord("documents", "document_recovery")}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        {t("operations.actions.openSubject")}
                      </AgentRunButtonLink>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="p-6 text-sm text-slate-500">{t("operations.detail.empty")}</div>
              )}
            </ConsoleSurface>
          </div>
        </div>
      </div>
    </ConsoleShell>
  );
}
