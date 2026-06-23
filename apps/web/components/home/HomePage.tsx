"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Route } from "next";
import type { ComponentProps } from "react";
import { ArrowRight, Database, RefreshCw, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";

import { AgentRunButtonLink } from "@/components/agents/AgentRunButtonLink";
import { ConsoleOutlineBadge, ConsolePageHeader, ConsoleStatusBar, ConsoleSurface, ConsoleSurfaceHeader } from "@/components/console/ConsolePrimitives";
import { ConsoleShell } from "@/components/console/ConsoleShell";
import { PageTitleSync } from "@/components/console/PageTitleSync";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AgentRunRecordInput } from "@/lib/agent-runs";
import { useAuth } from "@/lib/auth/provider";
import { readApiErrorMessage } from "@/lib/api-errors";
import { buildOperationsHref } from "@/lib/console-route-builders";
import { useI18n } from "@/lib/i18n/provider";
import { buildSessionActorHeaders } from "@/lib/local-session";
import { cn } from "@/lib/utils";
import { buildGroundedValidationDraftQuestion } from "@/lib/workspace-follow-up";
import { buildHomeWorkspaceHref } from "@/lib/workspace-handoffs";
import { formatTimestamp } from "@/lib/workspace-formatters";
import type {
  ConversationMetrics,
  DocumentMetrics,
  KnowledgeBase,
  Tenant,
  WorkflowMetrics,
  Workspace
} from "@/components/workspace/workspace-types";

const EMPTY_DOCUMENT_METRICS: DocumentMetrics = {
  total_documents: 0,
  completed_documents: 0,
  active_documents: 0,
  failed_documents: 0
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

const EMPTY_CONVERSATION_METRICS: ConversationMetrics = {
  total_conversations: 0,
  active_conversations: 0,
  total_messages: 0,
  latest_activity_at: null
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

async function listTenants() {
  return await apiRequest<Tenant[]>("/tenants");
}

async function listWorkspaces(tenantId: string) {
  return await apiRequest<Workspace[]>(`/workspaces?tenant_id=${tenantId}`);
}

async function listKnowledgeBases(workspaceId: string) {
  return await apiRequest<KnowledgeBase[]>(`/knowledge-bases?workspace_id=${workspaceId}`);
}

async function loadDocumentMetrics(knowledgeBaseId: string) {
  return await apiRequest<DocumentMetrics>(`/documents/metrics?knowledge_base_id=${knowledgeBaseId}`);
}

async function loadWorkflowMetrics(tenantId: string) {
  return await apiRequest<WorkflowMetrics>(`/workflow-runs/metrics?tenant_id=${tenantId}`);
}

async function loadConversationMetrics(tenantId: string, workspaceId: string) {
  return await apiRequest<ConversationMetrics>(
    `/chat/conversations/metrics?tenant_id=${tenantId}&workspace_id=${workspaceId}`
  );
}

async function loadHomeDirectory() {
  const tenants = await listTenants();
  const workspaceGroups = await Promise.all(
    tenants.map(async (tenant) => ({
      tenantId: tenant.id,
      workspaces: await listWorkspaces(tenant.id)
    }))
  );
  const workspaces = workspaceGroups.flatMap((group) => group.workspaces);

  const knowledgeBaseGroups = await Promise.all(
    workspaces.map(async (workspace) => ({
      workspaceId: workspace.id,
      knowledgeBases: await listKnowledgeBases(workspace.id)
    }))
  );
  const knowledgeBases = knowledgeBaseGroups.flatMap((group) => group.knowledgeBases);

  return {
    tenants,
    workspaces,
    knowledgeBases
  };
}

type StatusTone = "healthy" | "attention" | "pending";

type AppHref = ComponentProps<typeof Link>["href"];

type HomeTaskPacket = {
  title: string;
  detail: string;
  tone: StatusTone;
  metricLabel: string;
  metricValue: string;
  primaryActionLabel: string;
  primaryActionHref: AppHref;
  primaryActionRunRecord?: AgentRunRecordInput | null;
  secondaryActions: Array<{
    label: string;
    href: AppHref;
    runRecord?: AgentRunRecordInput | null;
  }>;
};

function getToneClassName(tone: StatusTone) {
  if (tone === "healthy") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (tone === "attention") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-slate-200 bg-slate-100 text-slate-600";
}

function OverviewMetricCard({
  label,
  value,
  hint
}: {
  hint: string;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-5">
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</div>
      <div className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{value}</div>
      <div className="mt-2 text-sm text-slate-500">{hint}</div>
    </div>
  );
}

function CommandPacketCard({
  detail,
  metricLabel,
  metricValue,
  primaryActionHref,
  primaryActionLabel,
  primaryActionRunRecord,
  secondaryActions,
  title,
  tone
}: HomeTaskPacket) {
  return (
    <div className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-950">{title}</div>
          <div className="mt-2 text-sm leading-6 text-slate-500">{detail}</div>
        </div>
        <Badge className={cn("border", getToneClassName(tone))} variant="outline">
          {metricValue}
        </Badge>
      </div>
      <div className="mt-4 rounded-[16px] border border-slate-200 bg-white px-4 py-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{metricLabel}</div>
        <div className="mt-2 text-sm font-semibold text-slate-950">{metricValue}</div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <AgentRunButtonLink href={primaryActionHref} runRecord={primaryActionRunRecord} size="sm" type="button">
          {primaryActionLabel}
        </AgentRunButtonLink>
        {secondaryActions.map((action) => (
          <AgentRunButtonLink
            className="bg-white"
            href={action.href}
            key={action.label}
            runRecord={action.runRecord}
            size="sm"
            type="button"
            variant="outline"
          >
            {action.label}
          </AgentRunButtonLink>
        ))}
      </div>
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();
  const { isReady, session } = useAuth();
  const { t } = useI18n();
  const returnTo = encodeURIComponent("/");
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>("");
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>("");
  const [selectedKnowledgeBaseId, setSelectedKnowledgeBaseId] = useState<string>("");
  const [documentMetrics, setDocumentMetrics] = useState<DocumentMetrics>(EMPTY_DOCUMENT_METRICS);
  const [workflowMetrics, setWorkflowMetrics] = useState<WorkflowMetrics>(EMPTY_WORKFLOW_METRICS);
  const [conversationMetrics, setConversationMetrics] = useState<ConversationMetrics>(EMPTY_CONVERSATION_METRICS);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoadingDirectory, setIsLoadingDirectory] = useState(true);
  const [isRefreshingScope, setIsRefreshingScope] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);

  useEffect(() => {
    if (!isReady || session) {
      return;
    }

    router.replace(("/login?return_to=" + returnTo) as Route);
  }, [isReady, returnTo, router, session]);

  const filteredWorkspaces = useMemo(
    () => workspaces.filter((workspace) => workspace.tenant_id === selectedTenantId),
    [selectedTenantId, workspaces]
  );

  const filteredKnowledgeBases = useMemo(
    () => knowledgeBases.filter((knowledgeBase) => knowledgeBase.workspace_id === selectedWorkspaceId),
    [knowledgeBases, selectedWorkspaceId]
  );

  const selectedTenant = useMemo(
    () => tenants.find((tenant) => tenant.id === selectedTenantId) ?? null,
    [selectedTenantId, tenants]
  );
  const selectedWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === selectedWorkspaceId) ?? null,
    [selectedWorkspaceId, workspaces]
  );
  const selectedKnowledgeBase = useMemo(
    () => knowledgeBases.find((knowledgeBase) => knowledgeBase.id === selectedKnowledgeBaseId) ?? null,
    [knowledgeBases, selectedKnowledgeBaseId]
  );

  useEffect(() => {
    function applyLocationState() {
      const searchParams = new URLSearchParams(window.location.search);
      setSelectedTenantId(searchParams.get("tenant_id") ?? "");
      setSelectedWorkspaceId(searchParams.get("workspace_id") ?? "");
      setSelectedKnowledgeBaseId(searchParams.get("knowledge_base_id") ?? "");
    }

    applyLocationState();
    window.addEventListener("popstate", applyLocationState);

    return () => {
      window.removeEventListener("popstate", applyLocationState);
    };
  }, []);

  useEffect(() => {
    const nextUrl = new URL(window.location.href);
    if (selectedTenantId) {
      nextUrl.searchParams.set("tenant_id", selectedTenantId);
    } else {
      nextUrl.searchParams.delete("tenant_id");
    }
    if (selectedWorkspaceId) {
      nextUrl.searchParams.set("workspace_id", selectedWorkspaceId);
    } else {
      nextUrl.searchParams.delete("workspace_id");
    }
    if (selectedKnowledgeBaseId) {
      nextUrl.searchParams.set("knowledge_base_id", selectedKnowledgeBaseId);
    } else {
      nextUrl.searchParams.delete("knowledge_base_id");
    }
    window.history.replaceState({}, "", nextUrl);
  }, [selectedKnowledgeBaseId, selectedTenantId, selectedWorkspaceId]);

  useEffect(() => {
    let isMounted = true;

    async function refreshDirectory() {
      if (!isReady || !session) {
        if (isMounted) {
          setIsLoadingDirectory(false);
        }
        return;
      }
      setIsLoadingDirectory(true);
      setErrorMessage(null);
      setStatusMessage(t("home.status.refreshingDirectory"));

      try {
        const directory = await loadHomeDirectory();
        if (!isMounted) {
          return;
        }

        setTenants(directory.tenants);
        setWorkspaces(directory.workspaces);
        setKnowledgeBases(directory.knowledgeBases);
        setLastRefreshedAt(new Date().toISOString());

        if (directory.tenants.length === 0) {
          setStatusMessage(t("home.status.noTenants"));
        } else {
          setStatusMessage(
            t("home.status.loaded", {
              tenantCount: String(directory.tenants.length),
              workspaceCount: String(directory.workspaces.length),
              knowledgeBaseCount: String(directory.knowledgeBases.length)
            })
          );
        }
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setErrorMessage(error instanceof Error ? error.message : t("home.status.failed"));
        setStatusMessage(t("home.status.failed"));
      } finally {
        if (isMounted) {
          setIsLoadingDirectory(false);
        }
      }
    }

    void refreshDirectory();

    return () => {
      isMounted = false;
    };
  }, [isReady, session, t]);

  useEffect(() => {
    if (tenants.length === 0) {
      setSelectedTenantId("");
      return;
    }

    if (!tenants.some((tenant) => tenant.id === selectedTenantId)) {
      setSelectedTenantId(tenants[0].id);
    }
  }, [selectedTenantId, tenants]);

  useEffect(() => {
    if (filteredWorkspaces.length === 0) {
      setSelectedWorkspaceId("");
      return;
    }

    if (!filteredWorkspaces.some((workspace) => workspace.id === selectedWorkspaceId)) {
      setSelectedWorkspaceId(filteredWorkspaces[0].id);
    }
  }, [filteredWorkspaces, selectedWorkspaceId]);

  useEffect(() => {
    if (filteredKnowledgeBases.length === 0) {
      setSelectedKnowledgeBaseId("");
      return;
    }

    if (!filteredKnowledgeBases.some((knowledgeBase) => knowledgeBase.id === selectedKnowledgeBaseId)) {
      setSelectedKnowledgeBaseId(filteredKnowledgeBases[0].id);
    }
  }, [filteredKnowledgeBases, selectedKnowledgeBaseId]);

  useEffect(() => {
    if (!selectedTenantId || !selectedWorkspaceId || !selectedKnowledgeBaseId) {
      setDocumentMetrics(EMPTY_DOCUMENT_METRICS);
      setWorkflowMetrics(EMPTY_WORKFLOW_METRICS);
      setConversationMetrics(EMPTY_CONVERSATION_METRICS);
      return;
    }

    let isMounted = true;

    async function refreshScopeMetrics() {
      if (!session) {
        if (isMounted) {
          setIsRefreshingScope(false);
        }
        return;
      }
      setIsRefreshingScope(true);
      setErrorMessage(null);
      setStatusMessage(t("home.status.refreshingScope"));

      try {
        const [
          nextDocumentMetrics,
          nextWorkflowMetrics,
          nextConversationMetrics
        ] = await Promise.all([
          loadDocumentMetrics(selectedKnowledgeBaseId),
          loadWorkflowMetrics(selectedTenantId),
          loadConversationMetrics(selectedTenantId, selectedWorkspaceId)
        ]);

        if (!isMounted) {
          return;
        }

        setDocumentMetrics(nextDocumentMetrics);
        setWorkflowMetrics(nextWorkflowMetrics);
        setConversationMetrics(nextConversationMetrics);
        setStatusMessage(t("home.status.scopedRefreshed"));
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setDocumentMetrics(EMPTY_DOCUMENT_METRICS);
        setWorkflowMetrics(EMPTY_WORKFLOW_METRICS);
        setConversationMetrics(EMPTY_CONVERSATION_METRICS);
        setErrorMessage(error instanceof Error ? error.message : t("home.status.scopedFailed"));
        setStatusMessage(t("home.status.scopedFailed"));
      } finally {
        if (isMounted) {
          setIsRefreshingScope(false);
        }
      }
    }

    void refreshScopeMetrics();

    return () => {
      isMounted = false;
    };
  }, [selectedKnowledgeBaseId, selectedTenantId, selectedWorkspaceId, session, t]);

  if (!isReady || !session) {
    return null;
  }

  const chatHref = buildHomeWorkspaceHref({
    view: "chat",
    tenantId: selectedTenantId || null,
    workspaceId: selectedWorkspaceId || null,
    knowledgeBaseId: selectedKnowledgeBaseId || null
  });
  const documentsHref = buildHomeWorkspaceHref({
    view: "documents",
    tenantId: selectedTenantId || null,
    workspaceId: selectedWorkspaceId || null,
    knowledgeBaseId: selectedKnowledgeBaseId || null
  });
  const hasRecoveryPressure = workflowMetrics.failed_runs > 0 || documentMetrics.failed_documents > 0;
  const hasMonitoringPressure =
    workflowMetrics.active_runs > 0 ||
    workflowMetrics.queued_runs > 0 ||
    documentMetrics.active_documents > 0;
  const monitoringOperationsHref = buildOperationsHref({
    tenantId: selectedTenantId || null,
    lane: hasMonitoringPressure ? "pressure" : "overview",
    status:
      workflowMetrics.active_runs > 0
        ? "running"
        : workflowMetrics.queued_runs > 0
          ? "queued"
          : "all"
  });
  const scopedWorkflowHref = buildHomeWorkspaceHref({
    view: "workflows",
    tenantId: selectedTenantId || null,
    workspaceId: selectedWorkspaceId || null,
    knowledgeBaseId: selectedKnowledgeBaseId || null,
    handoffIntent:
      hasRecoveryPressure ? "workflow_recovery" : "agent_brief",
    workflowStatus:
      workflowMetrics.failed_runs > 0
        ? "failed"
        : workflowMetrics.active_runs > 0
          ? "running"
          : null
  });

  const statusMeta = lastRefreshedAt ? formatTimestamp(lastRefreshedAt) : undefined;

  return (
    <ConsoleShell activeHref="/">
      <PageTitleSync title={t("home.title")} />
      <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-6">
        <ConsolePageHeader
          actions={
            <>
              <Button asChild type="button">
                <Link href={chatHref}>
                  {t("home.hero.openChat")}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild type="button" variant="outline">
                <Link href={documentsHref}>{t("home.hero.openDocuments")}</Link>
              </Button>
              <Button asChild type="button" variant="outline">
                <Link href={monitoringOperationsHref}>{t("home.hero.openOperations")}</Link>
              </Button>
            </>
          }
          description={t("home.hero.description")}
          eyebrow={t("home.hero.eyebrow")}
          icon={<Sparkles className="h-4 w-4" />}
          title={t("home.hero.title")}
        />

        <ConsoleStatusBar
          error={errorMessage}
          message={isLoadingDirectory ? t("home.status.loading") : statusMessage}
          meta={statusMeta}
        />

        <ConsoleSurface>
          <ConsoleSurfaceHeader
            action={
              <div className="flex flex-wrap items-center gap-2">
                <ConsoleOutlineBadge>{selectedKnowledgeBase?.slug ?? t("home.scope.notAvailable")}</ConsoleOutlineBadge>
                <Button disabled={isLoadingDirectory || isRefreshingScope} onClick={() => window.location.reload()} size="sm" type="button" variant="outline">
                  <RefreshCw className={cn("h-4 w-4", isLoadingDirectory || isRefreshingScope ? "animate-spin" : "")} />
                  {isRefreshingScope ? t("home.scope.refreshing") : t("home.scope.refresh")}
                </Button>
              </div>
            }
            description={t("home.hero.currentScopeDescription")}
            title={t("home.hero.currentScope")}
          />
          <div className="grid gap-4 p-6 md:grid-cols-3">
            <OverviewMetricCard
              hint={conversationMetrics.latest_activity_at ? t("home.signals.latestConversationDetail", { value: formatTimestamp(conversationMetrics.latest_activity_at) }) : t("home.core.noActivity")}
              label={t("home.core.chatsTitle")}
              value={conversationMetrics.total_conversations}
            />
            <OverviewMetricCard
              hint={t("home.core.documentsDetail", {
                total: String(documentMetrics.total_documents),
                ready: String(documentMetrics.completed_documents),
                failed: String(documentMetrics.failed_documents)
              })}
              label={t("home.core.documentsTitle")}
              value={documentMetrics.total_documents}
            />
            <OverviewMetricCard
              hint={t("home.core.workflowsDetail", {
                total: String(workflowMetrics.total_runs),
                active: String(workflowMetrics.active_runs),
                failed: String(workflowMetrics.failed_runs)
              })}
              label={t("home.core.workflowsTitle")}
              value={workflowMetrics.total_runs}
            />
          </div>
        </ConsoleSurface>

        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <ConsoleSurface>
            <ConsoleSurfaceHeader description={t("home.scope.description")} title={t("home.scope.title")} />
            <div className="grid gap-5 p-6 lg:grid-cols-2">
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{t("home.scope.tenant")}</div>
                  <Select disabled={tenants.length === 0 || isLoadingDirectory} onValueChange={setSelectedTenantId} value={selectedTenantId || undefined}>
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder={t("home.scope.selectTenant")} />
                    </SelectTrigger>
                    <SelectContent>
                      {tenants.map((tenant) => (
                        <SelectItem key={tenant.id} value={tenant.id}>
                          {tenant.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{t("home.scope.workspace")}</div>
                  <Select
                    disabled={filteredWorkspaces.length === 0 || isLoadingDirectory}
                    onValueChange={setSelectedWorkspaceId}
                    value={selectedWorkspaceId || undefined}
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder={t("home.scope.selectWorkspace")} />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredWorkspaces.map((workspace) => (
                        <SelectItem key={workspace.id} value={workspace.id}>
                          {workspace.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{t("home.scope.knowledgeBase")}</div>
                  <Select
                    disabled={filteredKnowledgeBases.length === 0 || isLoadingDirectory}
                    onValueChange={setSelectedKnowledgeBaseId}
                    value={selectedKnowledgeBaseId || undefined}
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder={t("home.scope.selectKnowledgeBase")} />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredKnowledgeBases.map((knowledgeBase) => (
                        <SelectItem key={knowledgeBase.id} value={knowledgeBase.id}>
                          {knowledgeBase.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-5">
                <div className="flex items-center gap-2 text-sm font-medium text-blue-600">
                  <Database className="h-4 w-4" />
                  {t("home.scope.liveScope")}
                </div>
                <div className="mt-4 space-y-4">
                  <div>
                    <div className="text-sm font-semibold text-slate-950">{selectedTenant?.name ?? t("home.scope.notAvailable")}</div>
                    <div className="mt-1 text-sm text-slate-500">{selectedTenant?.slug ?? t("home.scope.notAvailable")}</div>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-950">{selectedWorkspace?.name ?? t("home.scope.notAvailable")}</div>
                    <div className="mt-1 text-sm text-slate-500">{selectedWorkspace?.description ?? selectedWorkspace?.slug ?? t("home.scope.notAvailable")}</div>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-950">{selectedKnowledgeBase?.name ?? t("home.scope.notAvailable")}</div>
                    <div className="mt-1 text-sm text-slate-500">
                      {selectedKnowledgeBase?.description ?? selectedKnowledgeBase?.slug ?? t("home.scope.notAvailable")}
                    </div>
                  </div>
                </div>
                <div className="mt-5 text-sm leading-6 text-slate-500">{t("home.scope.liveScopeDescription")}</div>
              </div>
            </div>
          </ConsoleSurface>

          <ConsoleSurface>
            <ConsoleSurfaceHeader
              description={t("home.core.description")}
              title={t("home.core.title")}
            />
            <div className="grid gap-4 p-6">
              <CommandPacketCard
                detail={t("home.core.chatsDetail", {
                  messageCount: String(conversationMetrics.total_messages),
                  activity: conversationMetrics.latest_activity_at
                    ? formatTimestamp(conversationMetrics.latest_activity_at)
                    : t("home.core.noActivity")
                })}
                metricLabel={t("home.core.chatsMetric")}
                metricValue={String(conversationMetrics.total_conversations)}
                primaryActionHref={chatHref}
                primaryActionLabel={t("home.hero.openChat")}
                secondaryActions={[]}
                title={t("home.core.chatsTitle")}
                tone={"healthy"}
              />
              <CommandPacketCard
                detail={t("home.core.documentsDetail", {
                  total: String(documentMetrics.total_documents),
                  ready: String(documentMetrics.completed_documents),
                  failed: String(documentMetrics.failed_documents)
                })}
                metricLabel={t("home.core.documentsMetric")}
                metricValue={String(documentMetrics.total_documents)}
                primaryActionHref={documentsHref}
                primaryActionLabel={t("home.hero.openDocuments")}
                secondaryActions={[]}
                title={t("home.core.documentsTitle")}
                tone={documentMetrics.failed_documents > 0 ? "attention" : "healthy"}
              />
              <CommandPacketCard
                detail={t("home.core.workflowsDetail", {
                  total: String(workflowMetrics.total_runs),
                  active: String(workflowMetrics.active_runs),
                  failed: String(workflowMetrics.failed_runs)
                })}
                metricLabel={t("home.core.workflowsMetric")}
                metricValue={String(workflowMetrics.total_runs)}
                primaryActionHref={scopedWorkflowHref}
                primaryActionLabel={t("home.hero.openOperations")}
                secondaryActions={[]}
                title={t("home.core.workflowsTitle")}
                tone={workflowMetrics.failed_runs > 0 ? "attention" : hasMonitoringPressure ? "pending" : "healthy"}
              />
            </div>
          </ConsoleSurface>
        </div>
      </div>
    </ConsoleShell>
  );
}
