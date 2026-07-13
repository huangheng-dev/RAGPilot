"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Route } from "next";
import type { ComponentProps } from "react";
import { useRouter } from "next/navigation";

import {
  ConsoleEmptyState,
  ConsolePage,
  ConsoleSurface,
  ConsoleToolbar,
  ConsoleToolbarGroup
} from "@/components/console/ConsolePrimitives";
import { ConsoleShell } from "@/components/console/ConsoleShell";
import { PageTitleSync } from "@/components/console/PageTitleSync";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getAgentExecutionStageLabelKey,
  listAgentExecutions,
  readAgentExecutionEvidenceSummary,
  type AgentExecutionResponse
} from "@/lib/agent-executions";
import { buildAgentExecutionFollowUpActions } from "@/lib/agent-execution-follow-up";
import { authenticatedApiRequest } from "@/lib/authenticated-api";
import { useAuth } from "@/lib/auth/provider";
import { readCurrentTenantId, writeCurrentTenantId } from "@/lib/tenant-scope";
import { buildAgentsHref } from "@/lib/console-route-builders";
import { useI18n } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";
import { buildHomeWorkspaceHref } from "@/lib/workspace-handoffs";
import { formatStatusLabel, formatTimestamp, getStatusBadgeClass } from "@/lib/workspace-formatters";
import type {
  Conversation,
  ConversationMetrics,
  DocumentRecord,
  DocumentMetrics,
  KnowledgeBase,
  Tenant,
  Workspace
} from "@/components/workspace/workspace-types";

const EMPTY_DOCUMENT_METRICS: DocumentMetrics = {
  total_documents: 0,
  completed_documents: 0,
  active_documents: 0,
  failed_documents: 0
};

const EMPTY_CONVERSATION_METRICS: ConversationMetrics = {
  total_conversations: 0,
  active_conversations: 0,
  total_messages: 0,
  latest_activity_at: null
};

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
  return await apiRequest<KnowledgeBase[]>(`/knowledge-bases?workspace_id=${workspaceId}`);
}

async function loadDocumentMetrics(knowledgeBaseId: string) {
  return await apiRequest<DocumentMetrics>(`/documents/metrics?knowledge_base_id=${knowledgeBaseId}`);
}

async function loadConversationMetrics(tenantId: string, workspaceId: string) {
  return await apiRequest<ConversationMetrics>(
    `/chat/conversations/metrics?tenant_id=${tenantId}&workspace_id=${workspaceId}`
  );
}

async function listRecentConversations(tenantId: string, workspaceId: string, limit = 5) {
  const searchParams = new URLSearchParams({
    tenant_id: tenantId,
    workspace_id: workspaceId,
    limit: String(limit),
    offset: "0"
  });

  return await apiRequest<Conversation[]>(`/chat/conversations?${searchParams.toString()}`);
}

async function listRecentDocuments(knowledgeBaseId: string, limit = 5) {
  const searchParams = new URLSearchParams({
    knowledge_base_id: knowledgeBaseId,
    sort: "updated-desc",
    limit: String(limit),
    offset: "0"
  });

  return await apiRequest<DocumentRecord[]>(`/documents?${searchParams.toString()}`);
}

type AgentDefinition = {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  mode: "grounded_chat" | "document_intake" | "workflow_recovery";
  status: "draft" | "active" | "paused";
  objective: string;
  updated_at: string;
  tools: string[];
};

function normalizeArray<T>(value: T[] | null | undefined) {
  return Array.isArray(value) ? value : [];
}

async function listTenantAgents(tenantId: string) {
  return await apiRequest<AgentDefinition[]>(`/agents?tenant_id=${tenantId}`);
}

type AppHref = ComponentProps<typeof Link>["href"];

function HomeSectionCard({
  actionHref,
  actionLabel,
  children,
  contentClassName,
  count,
  title
}: {
  actionHref: AppHref;
  actionLabel: string;
  children: React.ReactNode;
  contentClassName?: string;
  count: number;
  title: string;
}) {
  return (
    <ConsoleSurface>
      <div className="flex items-center justify-between gap-3 px-6 pb-3 pt-6">
        <Link className="group flex min-w-0 items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30" href={actionHref}>
          <div className="truncate text-base font-semibold text-slate-950 transition group-hover:text-primary">{title}</div>
          <Badge className="border-slate-200 bg-slate-50 text-slate-700" variant="outline">
            {count}
          </Badge>
        </Link>
        <Button asChild className="bg-white" size="sm" type="button" variant="outline">
          <Link href={actionHref}>{actionLabel}</Link>
        </Button>
      </div>
      <div className={cn("px-6 pb-6 pt-2", contentClassName ?? "space-y-3")}>{children}</div>
    </ConsoleSurface>
  );
}

function HomeListItem({
  href,
  title,
  meta,
  badges,
  detail
}: {
  href: AppHref;
  title: string;
  meta?: string;
  badges?: React.ReactNode;
  detail?: string;
}) {
  return (
    <Link
      className="flex items-start justify-between gap-4 rounded-[18px] border border-slate-100 bg-slate-50/70 px-4 py-4 transition hover:border-slate-200 hover:bg-white"
      href={href}
    >
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-slate-950">{title}</div>
        {detail ? <div className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{detail}</div> : null}
        {(badges || meta) ? (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            {badges}
            {meta ? <span>{meta}</span> : null}
          </div>
        ) : null}
      </div>
    </Link>
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
  const [homeWorkspaces, setHomeWorkspaces] = useState<Workspace[]>([]);
  const [homeKnowledgeBases, setHomeKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>("");
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>("");
  const [selectedKnowledgeBaseId, setSelectedKnowledgeBaseId] = useState<string>("");
  const [documentMetrics, setDocumentMetrics] = useState<DocumentMetrics>(EMPTY_DOCUMENT_METRICS);
  const [conversationMetrics, setConversationMetrics] = useState<ConversationMetrics>(EMPTY_CONVERSATION_METRICS);
  const [recentConversations, setRecentConversations] = useState<Conversation[]>([]);
  const [recentDocuments, setRecentDocuments] = useState<DocumentRecord[]>([]);
  const [tenantAgents, setTenantAgents] = useState<AgentDefinition[]>([]);
  const [recentAgentExecutions, setRecentAgentExecutions] = useState<AgentExecutionResponse[]>([]);
  const [, setIsLoadingDirectory] = useState(true);

  useEffect(() => {
    if (!isReady || session) {
      return;
    }

    router.replace(("/login?return_to=" + returnTo) as Route);
  }, [isReady, returnTo, router, session]);

  const activeAgents = useMemo(
    () =>
      [...tenantAgents]
        .sort((left, right) => new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime()),
    [tenantAgents]
  );

  const agentNameById = useMemo(
    () =>
      tenantAgents.reduce<Record<string, string>>((accumulator, agent) => {
        accumulator[agent.id] = agent.name;
        return accumulator;
      }, {}),
    [tenantAgents]
  );

  useEffect(() => {
    function applyLocationState() {
      const searchParams = new URLSearchParams(window.location.search);
      setSelectedTenantId(searchParams.get("tenant_id") ?? readCurrentTenantId());
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
    if (selectedTenantId) writeCurrentTenantId(selectedTenantId);
  }, [selectedTenantId]);

  useEffect(() => {
    let isMounted = true;

    async function refreshTenants() {
      if (!isReady || !session) {
        if (isMounted) {
          setIsLoadingDirectory(false);
        }
        return;
      }
      setIsLoadingDirectory(true);

      try {
        const nextTenants = await listTenants();
        if (!isMounted) {
          return;
        }

        setTenants(normalizeArray(nextTenants));
      } catch {
        if (!isMounted) {
          return;
        }
        setTenants([]);
      } finally {
        if (isMounted) {
          setIsLoadingDirectory(false);
        }
      }
    }

    void refreshTenants();

    return () => {
      isMounted = false;
    };
  }, [isReady, session]);

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
    if (!selectedTenantId) {
      setWorkspaces([]);
      setSelectedWorkspaceId("");
      setKnowledgeBases([]);
      setSelectedKnowledgeBaseId("");
      return;
    }

    let isMounted = true;

    async function refreshWorkspaces() {
      try {
        const nextWorkspaces = normalizeArray(await listWorkspaces(selectedTenantId));
        if (!isMounted) {
          return;
        }

        setWorkspaces(nextWorkspaces);
        setSelectedWorkspaceId((currentWorkspaceId) =>
          nextWorkspaces.some((workspace) => workspace.id === currentWorkspaceId)
            ? currentWorkspaceId
            : (nextWorkspaces[0]?.id ?? "")
        );
      } catch {
        if (!isMounted) {
          return;
        }

        setWorkspaces([]);
        setSelectedWorkspaceId("");
      }
    }

    void refreshWorkspaces();

    return () => {
      isMounted = false;
    };
  }, [selectedTenantId]);

  useEffect(() => {
    if (!selectedWorkspaceId) {
      setKnowledgeBases([]);
      setSelectedKnowledgeBaseId("");
      return;
    }

    let isMounted = true;

    async function refreshKnowledgeBases() {
      try {
        const nextKnowledgeBases = normalizeArray(await listKnowledgeBases(selectedWorkspaceId));
        if (!isMounted) {
          return;
        }

        setKnowledgeBases(nextKnowledgeBases);
        setSelectedKnowledgeBaseId((currentKnowledgeBaseId) =>
          nextKnowledgeBases.some((knowledgeBase) => knowledgeBase.id === currentKnowledgeBaseId)
            ? currentKnowledgeBaseId
            : (nextKnowledgeBases[0]?.id ?? "")
        );
      } catch {
        if (!isMounted) {
          return;
        }

        setKnowledgeBases([]);
        setSelectedKnowledgeBaseId("");
      }
    }

    void refreshKnowledgeBases();

    return () => {
      isMounted = false;
    };
  }, [selectedWorkspaceId]);

  useEffect(() => {
    if (!session || tenants.length === 0) {
      setDocumentMetrics(EMPTY_DOCUMENT_METRICS);
      setConversationMetrics(EMPTY_CONVERSATION_METRICS);
      setRecentConversations([]);
      setRecentDocuments([]);
      setTenantAgents([]);
      setRecentAgentExecutions([]);
      setHomeWorkspaces([]);
      setHomeKnowledgeBases([]);
      return;
    }

    let isMounted = true;

    async function refreshHomeOverview() {
      try {
        const workspaceGroups = await Promise.all(
          tenants.map(async (tenant) => ({
            tenantId: tenant.id,
            workspaces: normalizeArray(await listWorkspaces(tenant.id))
          }))
        );
        const nextHomeWorkspaces = workspaceGroups.flatMap((group) => group.workspaces);
        const knowledgeBaseGroups = await Promise.all(
          nextHomeWorkspaces.map(async (workspace) =>
            normalizeArray(await listKnowledgeBases(workspace.id))
          )
        );
        const nextHomeKnowledgeBases = knowledgeBaseGroups.flat();
        const [documentGroups, conversationGroups, agentGroups] = await Promise.all([
          Promise.all(
            nextHomeKnowledgeBases.map(async (knowledgeBase) => ({
              documents: normalizeArray(await listRecentDocuments(knowledgeBase.id)),
              knowledgeBaseId: knowledgeBase.id,
              metrics: await loadDocumentMetrics(knowledgeBase.id)
            }))
          ),
          Promise.all(
            nextHomeWorkspaces.map(async (workspace) => ({
              conversations: normalizeArray(
                await listRecentConversations(workspace.tenant_id, workspace.id)
              ),
              metrics: await loadConversationMetrics(workspace.tenant_id, workspace.id)
            }))
          ),
          Promise.all(
            tenants.map(async (tenant) => ({
              agents: normalizeArray(await listTenantAgents(tenant.id)),
              executions: normalizeArray(await listAgentExecutions(tenant.id, undefined, 4))
            }))
          )
        ]);

        if (!isMounted) {
          return;
        }

        const nextDocumentMetrics = documentGroups.reduce<DocumentMetrics>(
          (totals, group) => ({
            active_documents: totals.active_documents + group.metrics.active_documents,
            completed_documents: totals.completed_documents + group.metrics.completed_documents,
            failed_documents: totals.failed_documents + group.metrics.failed_documents,
            total_documents: totals.total_documents + group.metrics.total_documents
          }),
          EMPTY_DOCUMENT_METRICS
        );
        const nextConversationMetrics = conversationGroups.reduce<ConversationMetrics>(
          (totals, group) => {
            const latestActivityAt = [totals.latest_activity_at, group.metrics.latest_activity_at]
              .filter((value): value is string => Boolean(value))
              .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0] ?? null;
            return {
              active_conversations: totals.active_conversations + group.metrics.active_conversations,
              latest_activity_at: latestActivityAt,
              total_conversations: totals.total_conversations + group.metrics.total_conversations,
              total_messages: totals.total_messages + group.metrics.total_messages
            };
          },
          EMPTY_CONVERSATION_METRICS
        );
        const nextRecentConversations = conversationGroups
          .flatMap((group) => group.conversations)
          .sort(
            (left, right) =>
              new Date(right.latest_activity_at ?? right.updated_at).getTime() -
              new Date(left.latest_activity_at ?? left.updated_at).getTime()
          )
          .slice(0, 4);
        const nextRecentDocuments = documentGroups
          .flatMap((group) => group.documents)
          .sort((left, right) => new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime())
          .slice(0, 4);

        setHomeWorkspaces(nextHomeWorkspaces);
        setHomeKnowledgeBases(nextHomeKnowledgeBases);
        setDocumentMetrics(nextDocumentMetrics);
        setConversationMetrics(nextConversationMetrics);
        setRecentConversations(nextRecentConversations);
        setRecentDocuments(nextRecentDocuments);
        setTenantAgents(agentGroups.flatMap((group) => group.agents));
        setRecentAgentExecutions(
          agentGroups
            .flatMap((group) => group.executions)
            .sort((left, right) => new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime())
            .slice(0, 4)
        );
      } catch {
        if (!isMounted) {
          return;
        }

        setDocumentMetrics(EMPTY_DOCUMENT_METRICS);
        setConversationMetrics(EMPTY_CONVERSATION_METRICS);
        setRecentConversations([]);
        setRecentDocuments([]);
        setTenantAgents([]);
        setRecentAgentExecutions([]);
        setHomeWorkspaces([]);
        setHomeKnowledgeBases([]);
      }
    }

    void refreshHomeOverview();

    return () => {
      isMounted = false;
    };
  }, [session, tenants]);

  if (!isReady || !session) {
    return null;
  }

  const latestConversation = recentConversations[0] ?? null;
  const latestDocument = recentDocuments[0] ?? null;
  const latestDocumentKnowledgeBase = latestDocument
    ? homeKnowledgeBases.find((knowledgeBase) => knowledgeBase.id === latestDocument.knowledge_base_id) ?? null
    : null;
  const latestDocumentWorkspace = latestDocumentKnowledgeBase
    ? homeWorkspaces.find((workspace) => workspace.id === latestDocumentKnowledgeBase.workspace_id) ?? null
    : null;
  const chatHref = buildHomeWorkspaceHref({
    view: "chat",
    tenantId: (latestConversation?.tenant_id ?? selectedTenantId) || null,
    workspaceId: (latestConversation?.workspace_id ?? selectedWorkspaceId) || null,
    knowledgeBaseId: (latestConversation?.knowledge_base_id ?? selectedKnowledgeBaseId) || null
  });
  const documentsHref = buildHomeWorkspaceHref({
    view: "documents",
    tenantId: (latestDocument?.tenant_id ?? selectedTenantId) || null,
    workspaceId: (latestDocumentWorkspace?.id ?? selectedWorkspaceId) || null,
    knowledgeBaseId: (latestDocument?.knowledge_base_id ?? selectedKnowledgeBaseId) || null
  });
  const agentsHref = buildAgentsHref({
    tenantId: (activeAgents[0]?.tenant_id ?? selectedTenantId) || null,
    status: "all"
  });
  const latestActivityLabel = conversationMetrics.latest_activity_at
    ? formatTimestamp(conversationMetrics.latest_activity_at)
    : t("home.core.noActivity");
  const welcomeTitle = t("home.welcome.title", {
    name: session.displayName?.trim() || t("home.welcome.fallbackName")
  });

  const hasActiveAgents = activeAgents.length > 0;

  return (
    <ConsoleShell activeHref="/">
      <PageTitleSync title={t("home.title")} />
      <ConsolePage>
        <ConsoleToolbar>
          <div className="min-w-0 flex-1">
            <div className="text-[22px] font-semibold tracking-tight text-slate-950 sm:text-[26px]">{welcomeTitle}</div>
            <div className="mt-1 text-sm leading-6 text-slate-500">{t("home.welcome.description")}</div>
          </div>
          <ConsoleToolbarGroup className="w-full justify-start lg:w-auto lg:justify-end">
            <Button asChild size="sm" type="button">
              <Link href={chatHref}>{t("home.commandCenter.retrieval.primaryChat")}</Link>
            </Button>
            <Button asChild className="bg-white" size="sm" type="button" variant="outline">
              <Link href={documentsHref}>{t("home.commandCenter.retrieval.primaryDocuments")}</Link>
            </Button>
            <Button asChild className="bg-white" size="sm" type="button" variant="outline">
              <Link href={agentsHref}>{t("home.commandCenter.agents.primaryAgents")}</Link>
            </Button>
          </ConsoleToolbarGroup>
        </ConsoleToolbar>

        <div className="grid gap-6">
          <HomeSectionCard
            contentClassName="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
            actionHref={chatHref}
            actionLabel={t("home.overview.viewMore")}
            count={conversationMetrics.total_conversations}
            title={t("home.overview.chats")}
          >
            {recentConversations.length === 0 ? (
              <div className="sm:col-span-2 xl:col-span-4">
                <Link className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30" href={chatHref}>
                  <ConsoleEmptyState>{latestActivityLabel}</ConsoleEmptyState>
                </Link>
              </div>
            ) : (
              recentConversations.map((conversation) => (
                <HomeListItem
                  badges={<span>{t("home.overview.messageCount", { count: String(conversation.message_count) })}</span>}
                  href={buildHomeWorkspaceHref({
                    view: "chat",
                    tenantId: conversation.tenant_id,
                    workspaceId: conversation.workspace_id,
                    knowledgeBaseId: conversation.knowledge_base_id,
                    conversationId: conversation.id
                  })}
                  key={conversation.id}
                  meta={formatTimestamp(conversation.latest_activity_at ?? conversation.updated_at)}
                  title={conversation.title}
                />
              ))
            )}
          </HomeSectionCard>
          <HomeSectionCard
            contentClassName="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
            actionHref={documentsHref}
            actionLabel={t("home.overview.viewMore")}
            count={documentMetrics.total_documents}
            title={t("home.overview.documents")}
          >
            {recentDocuments.length === 0 ? (
              <div className="sm:col-span-2 xl:col-span-4">
                <Link className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30" href={documentsHref}>
                  <ConsoleEmptyState>{t("home.overview.emptyDocuments")}</ConsoleEmptyState>
                </Link>
              </div>
            ) : (
              recentDocuments.map((document) => (
                <HomeListItem
                  badges={
                    <>
                      <Badge className={cn("border", getStatusBadgeClass(document.ingestion_status))} variant="outline">
                        {formatStatusLabel(document.ingestion_status)}
                      </Badge>
                      <Badge className={cn("border", getStatusBadgeClass(document.indexing_status))} variant="outline">
                        {formatStatusLabel(document.indexing_status)}
                      </Badge>
                    </>
                  }
                  href={buildHomeWorkspaceHref({
                    view: "documents",
                    tenantId: document.tenant_id,
                    workspaceId:
                      homeKnowledgeBases.find((knowledgeBase) => knowledgeBase.id === document.knowledge_base_id)
                        ?.workspace_id ?? null,
                    knowledgeBaseId: document.knowledge_base_id,
                    documentId: document.id
                  })}
                  key={document.id}
                  meta={formatTimestamp(document.updated_at)}
                  title={document.title}
                />
              ))
            )}
          </HomeSectionCard>
          <HomeSectionCard
            contentClassName="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
            actionHref={agentsHref}
            actionLabel={t("home.overview.viewMore")}
            count={recentAgentExecutions.length > 0 ? recentAgentExecutions.length : activeAgents.length}
            title={t("home.overview.agents")}
          >
            {recentAgentExecutions.length === 0 && activeAgents.length === 0 ? (
              <div className="sm:col-span-2 xl:col-span-4">
                <Link className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30" href={agentsHref}>
                  <ConsoleEmptyState>
                    {hasActiveAgents
                      ? t("home.commandCenter.agents.readyDetail", {
                          name: activeAgents[0]?.name ?? t("home.overview.agents")
                        })
                      : t("home.overview.emptyAgents")}
                  </ConsoleEmptyState>
                </Link>
              </div>
            ) : recentAgentExecutions.length > 0 ? (
              recentAgentExecutions.map((agentExecution) => {
                const evidenceSummary = readAgentExecutionEvidenceSummary(agentExecution.result_payload_json);
                const followUpActions = buildAgentExecutionFollowUpActions({
                  sourceContext: { surface: "home" },
                  execution: agentExecution,
                  executionInput: evidenceSummary?.executionInput,
                  recommendedActions: evidenceSummary?.recommendedActionSpecs ?? []
                });
                const primaryAction = followUpActions[0] ?? null;
                const previewText =
                  evidenceSummary?.answerPreview?.trim() ||
                  agentExecution.summary?.trim() ||
                  agentExecution.error_message?.trim() ||
                  t("agents.executions.pendingSummary");

                return (
                  <HomeListItem
                    badges={
                      <>
                        <Badge className={cn("border", getStatusBadgeClass(agentExecution.execution_status))} variant="outline">
                          {t(`agents.executions.statuses.${agentExecution.execution_status}`)}
                        </Badge>
                        <Badge className="border-slate-200 bg-white text-slate-700" variant="outline">
                          {t(`agents.modes.${agentExecution.execution_mode}`)}
                        </Badge>
                        {agentExecution.task_state ? (
                          <Badge className="border-slate-200 bg-white text-slate-700" variant="outline">
                            {t(getAgentExecutionStageLabelKey(agentExecution.task_state.stage_key))}
                          </Badge>
                        ) : null}
                      </>
                    }
                    detail={previewText}
                    href={
                      primaryAction?.href ??
                      buildAgentsHref({
                        tenantId: selectedTenantId || null,
                        status: "active",
                        agentId: agentExecution.agent_definition_id
                      })
                    }
                    key={agentExecution.id}
                    meta={formatTimestamp(agentExecution.updated_at)}
                  title={agentNameById[agentExecution.agent_definition_id] ?? t("agents.executions.unknownAgent")}
                />
              );
            })
            ) : (
              activeAgents.slice(0, 4).map((agent) => (
                <HomeListItem
                  badges={
                    <>
                      <Badge className={cn("border", getStatusBadgeClass(agent.status))} variant="outline">
                        {formatStatusLabel(agent.status)}
                      </Badge>
                      <Badge className="border-slate-200 bg-white text-slate-700" variant="outline">
                        {t(`agents.modes.${agent.mode}`)}
                      </Badge>
                    </>
                  }
                  detail={agent.objective?.trim().length ? agent.objective : t("home.overview.noAgentObjective")}
                  href={buildAgentsHref({
                    tenantId: selectedTenantId || null,
                    status: "active",
                    agentId: agent.id
                  })}
                  key={agent.id}
                  meta={formatTimestamp(agent.updated_at)}
                  title={agent.name}
                />
              ))
            )}
          </HomeSectionCard>
        </div>
      </ConsolePage>
    </ConsoleShell>
  );
}
