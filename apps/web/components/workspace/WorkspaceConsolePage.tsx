"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { UrlObject } from "url";
import { PageTitleSync } from "@/components/console/PageTitleSync";
import { ConsoleShell } from "@/components/console/ConsoleShell";
import { ConsolePage } from "@/components/console/ConsolePrimitives";
import { WorkspaceChatView } from "@/components/workspace/WorkspaceChatView";
import { WorkspaceHeaderBar } from "@/components/workspace/WorkspaceHeaderBar";
import { WorkspaceDocumentsView } from "@/components/workspace/WorkspaceDocumentsView";
import { WorkspaceSidebar } from "@/components/workspace/WorkspaceSidebar";
import { WorkspaceWorkflowsView } from "@/components/workspace/WorkspaceWorkflowsView";
import { createAgentExecution, readAgentExecutionEvidenceSummary } from "@/lib/agent-executions";
import { buildAgentExecutionFollowUpActions } from "@/lib/agent-execution-follow-up";
import type { AgentRunRecordInput } from "@/lib/agent-runs";
import { authenticatedApiRequest, authenticatedApiRequestWithHeaders, authenticatedFetch, authenticatedUpload } from "@/lib/authenticated-api";
import { formatOperatorErrorMessage } from "@/lib/api-errors";
import { hasDirectoryCapability } from "@/lib/auth/access";
import { useAuth } from "@/lib/auth/provider";
import { readCurrentTenantId, writeCurrentTenantId } from "@/lib/tenant-scope";
import { useI18n } from "@/lib/i18n/provider";
import { useStatusNotifications } from "@/lib/notifications/use-status-notifications";
import {
  listMcpConnectors,
  listRetrievalProfiles,
  type PlatformMcpConnector,
  type PlatformRetrievalProfile
} from "@/lib/platform-governance";
import {
  compareRetrieval,
  inspectRetrieval,
  recordRetrievalEvaluation,
  summarizeRetrievalEvaluations,
  updateRetrievalEvaluationFollowUpStatus,
  updateRetrievalQueryFollowUpStatus,
  type RetrievalEvaluationRecord,
  type RetrievalEvaluationSummary
} from "@/lib/retrieval-inspector";
import {
  applyRuntimeGovernanceQuickAction,
  buildRuntimeGovernanceQuickActions,
  type RuntimeGovernanceQuickActionKey
} from "@/lib/runtime-governance-actions";
import {
  readRuntimeGovernanceConnectorPreviewLabel,
  readRuntimeGovernanceIssueDetail,
  readRuntimeGovernanceIssueLabel,
  readRuntimeGovernanceModelPreviewLabel,
  readRuntimeGovernanceToolPreviewLabel,
  readRuntimeGovernancePreviewFailureLabel
} from "@/lib/runtime-governance-preview";
import { resolveRuntimeGovernanceLeadIssue } from "@/lib/runtime-governance";
import { buildWorkspaceAgentRecommendations } from "@/lib/workspace-agent-recommendations";
import { formatStatusLabel } from "@/lib/workspace-formatters";
import { buildGroundedValidationDraftQuestion } from "@/lib/workspace-follow-up";
import {
  buildWorkspaceRetrievalFollowUpActions,
  type RetrievalFollowUpActionDescriptor
} from "@/lib/workspace-retrieval-follow-up";
import { buildAdminHref, buildAgentsHref, buildOperationsHref } from "@/lib/console-route-builders";
import { withUniqueConsoleFollowUpActions } from "@/lib/console-follow-up-actions";
import {
  applyWorkspaceSearchParams,
  buildWorkspaceHref,
  getWorkspacePathnameForView,
  type WorkspaceHandoffIntent,
  type WorkspaceSourceAdminSection,
  type WorkspaceSourceOperationsLane,
  type WorkspaceConsolePathname,
  type WorkspaceSourceSurface,
  readWorkspaceLocationState,
  type WorkspaceLocationState
} from "@/lib/workspace-navigation";
import { resolveWorkflowFollowUpStage, selectPreferredWorkflowRunId } from "@/lib/workspace-workflow-follow-up";
import type {
  BootstrapState,
  Citation,
  ChatAskResponse,
  ContextManagementPanel,
  Conversation,
  ConversationMetrics,
  DocumentDetail,
  DocumentLifecycleFilter,
  DocumentMetrics,
  DocumentRecord,
  DocumentRestoreResponse,
  DocumentSourceFilter,
  DocumentSortOrder,
  DocumentWorkflowActionResponse,
  KnowledgeBase,
  MessageFeedback,
  MessageFeedbackSummary,
  Message,
  RetrievalValidationSummary,
  Tenant,
  WorkflowMetrics,
  WorkflowRetryMode,
  WorkflowRun,
  WorkflowRunActionResponse,
  WorkflowRunDetail,
  WorkflowSortOrder,
  Workspace,
  WorkspaceAgentRecommendation,
  WorkspaceCatalog,
  WorkspaceAgentContext,
  WorkspaceSelection,
  WorkspaceView
} from "@/components/workspace/workspace-types";

const DEMO_TENANT_SLUG = "ragpilot-demo";
const DEMO_WORKSPACE_SLUG = "ragpilot-operations";
const DEMO_KNOWLEDGE_BASE_SLUG = "ragpilot-handbook";
const DEFAULT_WORKSPACE_SLUG = "customer-operations";
const DEFAULT_KNOWLEDGE_BASE_SLUG = "customer-service";
const DOCUMENT_PAGE_SIZE = 10;
const WORKFLOW_PAGE_SIZE = 6;
const CONVERSATION_PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 250;
const MAX_DOCUMENT_UPLOAD_BYTES = 25 * 1024 * 1024;
const SUPPORTED_DOCUMENT_EXTENSIONS = [
  ".txt",
  ".md",
  ".markdown",
  ".html",
  ".htm",
  ".csv",
  ".json",
  ".pdf",
  ".docx",
  ".xlsx",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".tif",
  ".tiff",
  ".bmp",
];
const RETRIEVAL_VALIDATION_TOP_K = 5;

function resolveOperatorErrorMessage(error: unknown, fallbackMessage: string) {
  if (error instanceof Error) {
    return formatOperatorErrorMessage(error.message) ?? fallbackMessage;
  }
  return fallbackMessage;
}

function buildNavigationHrefString(href: Pick<UrlObject, "pathname" | "query">) {
  const pathname = typeof href.pathname === "string" && href.pathname.length > 0 ? href.pathname : "/";
  if (!href.query) {
    return pathname;
  }

  if (typeof href.query === "string") {
    return href.query.trim().length > 0 ? `${pathname}?${href.query}` : pathname;
  }

  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(href.query)) {
    if (Array.isArray(value)) {
      value.forEach((entry) => {
        const normalizedEntry = String(entry).trim();
        if (normalizedEntry.length > 0) {
          searchParams.append(key, normalizedEntry);
        }
      });
      continue;
    }

    if (value !== null && value !== undefined) {
      const normalizedValue = String(value).trim();
      if (normalizedValue.length > 0) {
        searchParams.set(key, normalizedValue);
      }
    }
  }

  const queryString = searchParams.toString();
  return queryString ? `${pathname}?${queryString}` : pathname;
}

function formatWorkspaceRuntimeTimestamp(value: string, language: "en" | "zh-CN") {
  return new Date(value).toLocaleString(language === "zh-CN" ? "zh-CN" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

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
  failed_runs: 0,
  cancelled_runs: 0
};

const EMPTY_CONVERSATION_METRICS: ConversationMetrics = {
  total_conversations: 0,
  active_conversations: 0,
  total_messages: 0,
  latest_activity_at: null
};

type WorkspaceRunbookDirectAction = {
  key: string;
  label: string;
  actionKey: RuntimeGovernanceQuickActionKey;
  resourceId: string;
};

type WorkspaceRunbookItem = {
  title: string;
  detail: string;
  status: "attention" | "healthy" | "review";
  statusLabel: string;
  metricLabel: string;
  metricValue: string;
  primaryActionHref: ReturnType<typeof buildWorkspaceHref> | ReturnType<typeof buildAdminHref> | ReturnType<typeof buildAgentsHref> | ReturnType<typeof buildOperationsHref> | Route;
  primaryActionRunRecord: AgentRunRecordInput | null;
  primaryActionLabel: string;
  secondaryActions: Array<{
    label: string;
    href: ReturnType<typeof buildWorkspaceHref> | ReturnType<typeof buildAdminHref> | ReturnType<typeof buildAgentsHref> | ReturnType<typeof buildOperationsHref> | Route;
    runRecord?: AgentRunRecordInput | null;
  }>;
  directActions?: WorkspaceRunbookDirectAction[];
};

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedValue(value), delayMs);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [delayMs, value]);

  return debouncedValue;
}

async function performApiRequest(path: string, init?: RequestInit) {
  return await authenticatedFetch(path, init);
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  return await authenticatedApiRequest<T>(path, init);
}

async function apiRequestWithHeaders<T>(
  path: string,
  init?: RequestInit
): Promise<{ data: T; headers: Headers }> {
  return await authenticatedApiRequestWithHeaders<T>(path, init);
}

async function streamChatQuestion(
  payload: Record<string, unknown>,
  onDelta: (content: string) => void,
): Promise<ChatAskResponse> {
  const response = await authenticatedFetch("/chat/messages/stream", {
    method: "POST",
    headers: { Accept: "text/event-stream" },
    body: JSON.stringify(payload),
  });
  if (!response.body) {
    throw new Error("The chat stream did not provide a response body.");
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let completed: ChatAskResponse | null = null;
  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";
    for (const frame of frames) {
      let eventName = "message";
      let data = "";
      for (const line of frame.split("\n")) {
        if (line.startsWith("event:")) eventName = line.slice(6).trim();
        if (line.startsWith("data:")) data += line.slice(5).trim();
      }
      if (!data) continue;
      const parsed = JSON.parse(data) as Record<string, unknown>;
      if (eventName === "delta") onDelta(String(parsed.content ?? ""));
      if (eventName === "complete") completed = parsed as unknown as ChatAskResponse;
      if (eventName === "error") throw new Error(String(parsed.detail ?? "Chat streaming failed."));
    }
    if (done) break;
  }
  if (!completed) throw new Error("The chat stream ended before completion.");
  return completed;
}

function readCountHeader(headers: Headers, headerName: string, fallbackCount: number) {
  const rawValue = headers.get(headerName);
  if (!rawValue) {
    return fallbackCount;
  }

  const parsedValue = Number.parseInt(rawValue, 10);
  return Number.isFinite(parsedValue) ? parsedValue : fallbackCount;
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

async function loadMessageFeedbackSummary(tenantId: string, workspaceId: string, knowledgeBaseId: string | null) {
  const searchParams = new URLSearchParams({
    tenant_id: tenantId,
    workspace_id: workspaceId
  });

  if (knowledgeBaseId) {
    searchParams.set("knowledge_base_id", knowledgeBaseId);
  }

  return await apiRequest<MessageFeedbackSummary>(`/chat/feedback/summary?${searchParams.toString()}`);
}

async function loadRetrievalEvaluationSummary(tenantId: string, workspaceId: string, knowledgeBaseId: string | null) {
  return await summarizeRetrievalEvaluations({
    tenant_id: tenantId,
    workspace_id: workspaceId,
    knowledge_base_id: knowledgeBaseId,
    follow_up_status: null,
    limit: 4,
    sample_size: 120
  });
}

function normalizeMessageFeedbackSummary(summary: MessageFeedbackSummary): MessageFeedbackSummary {
  return {
    ...summary,
    recent_feedback: Array.isArray(summary.recent_feedback)
      ? summary.recent_feedback.map((item) => ({
          ...item,
          recommended_actions: Array.isArray(item.recommended_actions) ? item.recommended_actions : [],
          issue_labels: Array.isArray(item.issue_labels) ? item.issue_labels : [],
          feedback_notes: item.feedback_notes ?? null,
          latest_user_question: item.latest_user_question ?? null,
          knowledge_base_id: item.knowledge_base_id ?? null,
          retrieval_profile_id: item.retrieval_profile_id ?? null,
          retrieval_profile_name: item.retrieval_profile_name ?? null
        }))
      : []
  };
}

function normalizeRetrievalEvaluationSummary(summary: RetrievalEvaluationSummary): RetrievalEvaluationSummary {
  return {
    ...summary,
    primary_query_text: summary.primary_query_text ?? null,
    primary_baseline_engine_name: summary.primary_baseline_engine_name ?? null,
    primary_candidate_engine_name: summary.primary_candidate_engine_name ?? null,
    primary_retrieval_profile_name: summary.primary_retrieval_profile_name ?? null,
    primary_recommended_actions: Array.isArray(summary.primary_recommended_actions) ? summary.primary_recommended_actions : [],
    candidates: Array.isArray(summary.candidates)
      ? summary.candidates.map((candidate) => ({
          ...candidate,
          recommended_actions: Array.isArray(candidate.recommended_actions) ? candidate.recommended_actions : [],
          latest_source_documents: Array.isArray(candidate.latest_source_documents) ? candidate.latest_source_documents : []
        }))
      : [],
    recent_evaluations: Array.isArray(summary.recent_evaluations)
      ? summary.recent_evaluations.map((evaluation) => ({
          ...evaluation,
          source_documents: Array.isArray(evaluation.source_documents) ? evaluation.source_documents : [],
          recommended_actions: Array.isArray(evaluation.recommended_actions) ? evaluation.recommended_actions : []
        }))
      : []
  };
}

async function submitMessageFeedbackItem(options: {
  tenantId: string;
  messageId: string;
  answerQuality: "helpful" | "partially_helpful" | "not_helpful";
  citationQuality: "grounded" | "partial" | "broken";
  issueLabels: string[];
  feedbackNotes?: string | null;
}) {
  return await apiRequest<MessageFeedback>(`/chat/messages/${options.messageId}/feedback?tenant_id=${options.tenantId}`, {
    method: "POST",
    body: JSON.stringify({
      answer_quality: options.answerQuality,
      citation_quality: options.citationQuality,
      issue_labels: options.issueLabels,
      feedback_notes: options.feedbackNotes ?? null
    })
  });
}

async function listTenantAgentDefinitions(tenantId: string) {
  return await apiRequest<WorkspaceAgentContext[]>(
    `/agents?tenant_id=${tenantId}&include_runtime_governance=true`
  );
}

async function loadDocumentItems(options: {
  knowledgeBaseId: string;
  query: string;
  sourceFilter: DocumentSourceFilter;
  lifecycleFilter: DocumentLifecycleFilter;
  statusFilter: string;
  sortOrder: DocumentSortOrder;
  page: number;
  pageSize: number;
}) {
  const searchParams = new URLSearchParams({
    knowledge_base_id: options.knowledgeBaseId,
    sort: options.sortOrder,
    limit: String(options.pageSize),
    offset: String((options.page - 1) * options.pageSize)
  });

  const normalizedQuery = options.query.trim();
  if (normalizedQuery) {
    searchParams.set("query", normalizedQuery);
  }
  if (options.sourceFilter !== "all") {
    searchParams.set("source_kind", options.sourceFilter);
  }
  if (options.lifecycleFilter !== "active") {
    searchParams.set("lifecycle", options.lifecycleFilter);
  }
  if (options.statusFilter !== "all") {
    searchParams.set("status", options.statusFilter);
  }

  const response = await apiRequestWithHeaders<DocumentRecord[]>(`/documents?${searchParams.toString()}`);
  return {
    items: response.data,
    totalCount: readCountHeader(response.headers, "X-Total-Count", response.data.length)
  };
}

async function loadWorkflowRunItems(options: {
  tenantId: string;
  query: string;
  statusFilter: string;
  workflowTypeFilter: string;
  workflowRetryMode: WorkflowRetryMode;
  subjectId?: string;
  sortOrder: WorkflowSortOrder;
  page: number;
  pageSize: number;
}) {
  const searchParams = new URLSearchParams({
    tenant_id: options.tenantId,
    sort: options.sortOrder,
    limit: String(options.pageSize),
    offset: String((options.page - 1) * options.pageSize)
  });

  const normalizedQuery = options.query.trim();
  if (normalizedQuery) {
    searchParams.set("query", normalizedQuery);
  }
  if (options.statusFilter !== "all") {
    searchParams.set("status", options.statusFilter);
  }
  if (options.workflowTypeFilter !== "all") {
    searchParams.set("workflow_type", options.workflowTypeFilter);
  }
  if (options.workflowRetryMode !== "all") {
    searchParams.set("retry_mode", options.workflowRetryMode);
  }
  if (options.subjectId) {
    searchParams.set("subject_id", options.subjectId);
  }

  const response = await apiRequestWithHeaders<WorkflowRun[]>(`/workflow-runs?${searchParams.toString()}`);
  return {
    items: response.data,
    totalCount: readCountHeader(response.headers, "X-Total-Count", response.data.length)
  };
}

async function loadRelatedWorkflowRunItems(tenantId: string, documentId: string, limit = 20) {
  const response = await loadWorkflowRunItems({
    tenantId,
    query: "",
    statusFilter: "all",
    workflowTypeFilter: "all",
    workflowRetryMode: "all",
    subjectId: documentId,
    sortOrder: "created-desc",
    page: 1,
    pageSize: limit,
  });

  return response.items;
}

  async function ensureBootstrapResources(preferredSelection?: WorkspaceSelection): Promise<{ resources: BootstrapState; catalog: WorkspaceCatalog }> {
  let tenants = await listTenants();
  const preferredTenantId = preferredSelection?.tenantId || readCurrentTenantId();
  let tenant =
    (preferredTenantId ? tenants.find((item) => item.id === preferredTenantId) : null) ??
    tenants.find((item) => item.slug === DEMO_TENANT_SLUG);
  if (!tenant) {
    tenant = await apiRequest<Tenant>("/tenants", {
      method: "POST",
      body: JSON.stringify({
        name: "RAGPilot Demo",
        slug: DEMO_TENANT_SLUG
      })
    });
    tenants = [...tenants, tenant];
  }

  let workspaces = await listWorkspaces(tenant.id);
  let workspace =
    (preferredSelection?.workspaceId ? workspaces.find((item) => item.id === preferredSelection.workspaceId) : null) ??
    workspaces.find((item) => item.slug === DEFAULT_WORKSPACE_SLUG) ??
    workspaces.find((item) => item.slug === DEMO_WORKSPACE_SLUG) ??
    workspaces[0];
  if (!workspace) {
    workspace = await apiRequest<Workspace>("/workspaces", {
      method: "POST",
      body: JSON.stringify({
        tenant_id: tenant.id,
        name: "RAGPilot Operations",
        slug: DEMO_WORKSPACE_SLUG,
        description: "Local workspace for grounded chat and document operations."
      })
    });
    workspaces = [...workspaces, workspace];
  }

  let knowledgeBases = await listKnowledgeBases(workspace.id);
  let knowledgeBase =
    (preferredSelection?.knowledgeBaseId
      ? knowledgeBases.find((item) => item.id === preferredSelection.knowledgeBaseId)
      : null) ??
    knowledgeBases.find((item) => item.slug === DEFAULT_KNOWLEDGE_BASE_SLUG) ??
    knowledgeBases.find((item) => item.slug === DEMO_KNOWLEDGE_BASE_SLUG) ??
    knowledgeBases[0];
  if (!knowledgeBase) {
    knowledgeBase = await apiRequest<KnowledgeBase>("/knowledge-bases", {
      method: "POST",
      body: JSON.stringify({
        tenant_id: tenant.id,
        workspace_id: workspace.id,
        name: "RAGPilot Handbook",
        slug: DEMO_KNOWLEDGE_BASE_SLUG,
        description: "Default knowledge base for the local operator workspace."
      })
    });
    knowledgeBases = [...knowledgeBases, knowledgeBase];
  }

  return {
    resources: {
      tenant,
      workspace,
      knowledgeBase
    },
    catalog: {
      tenants,
      workspaces,
      knowledgeBases
    }
  };
}

async function waitForWorkflowCompletion(tenantId: string, workflowRunId: string) {
  const maxAttempts = 30;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const workflowRun = await loadWorkflowRunDetailItem(tenantId, workflowRunId);
    if (["completed", "failed"].includes(workflowRun.workflow_status)) {
      return workflowRun.workflow_status;
    }
    await new Promise((resolve) => window.setTimeout(resolve, 1000));
  }

  return "pending";
}

async function loadWorkspaceOperations(
  resources: BootstrapState,
  options: {
    documentQuery: string;
    documentSourceFilter: DocumentSourceFilter;
    documentLifecycleFilter: DocumentLifecycleFilter;
    documentStatusFilter: string;
    documentSortOrder: DocumentSortOrder;
    documentPage: number;
    workflowQuery: string;
    workflowStatusFilter: string;
    workflowTypeFilter: string;
    workflowRetryMode: WorkflowRetryMode;
    workflowSortOrder: WorkflowSortOrder;
    workflowPage: number;
  }
) {
  const [documentListResult, workflowListResult, documentMetrics, workflowMetrics] = await Promise.all([
    loadDocumentItems({
      knowledgeBaseId: resources.knowledgeBase.id,
      query: options.documentQuery,
      sourceFilter: options.documentSourceFilter,
      lifecycleFilter: options.documentLifecycleFilter,
      statusFilter: options.documentStatusFilter,
      sortOrder: options.documentSortOrder,
      page: options.documentPage,
      pageSize: DOCUMENT_PAGE_SIZE
    }),
    loadWorkflowRunItems({
      tenantId: resources.tenant.id,
      query: options.workflowQuery,
      statusFilter: options.workflowStatusFilter,
      workflowTypeFilter: options.workflowTypeFilter,
      workflowRetryMode: options.workflowRetryMode,
      sortOrder: options.workflowSortOrder,
      page: options.workflowPage,
      pageSize: WORKFLOW_PAGE_SIZE
    }),
    loadDocumentMetrics(resources.knowledgeBase.id),
    loadWorkflowMetrics(resources.tenant.id)
  ]);

  return {
    documentItems: documentListResult.items,
    documentTotalCount: documentListResult.totalCount,
    workflowItems: workflowListResult.items,
    workflowTotalCount: workflowListResult.totalCount,
    documentMetrics,
    workflowMetrics
  };
}

async function loadDocumentDetailItem(
  knowledgeBaseId: string,
  documentId: string,
  documentVersionId?: string | null,
  includeDeleted = false
) {
  const searchParams = new URLSearchParams({
    knowledge_base_id: knowledgeBaseId,
    include_deleted: includeDeleted ? "true" : "false",
  });
  if (documentVersionId) {
    searchParams.set("document_version_id", documentVersionId);
  }

  return await apiRequest<DocumentDetail>(`/documents/${documentId}?${searchParams.toString()}`);
}

async function loadWorkflowRunDetailItem(tenantId: string, workflowRunId: string) {
  return await apiRequest<WorkflowRunDetail>(`/workflow-runs/${workflowRunId}?tenant_id=${tenantId}`);
}

type WorkspaceConsolePageProps = {
  activeHref?: "/" | "/workspace" | "/chat" | "/documents" | "/agents" | "/operations" | "/admin" | "/settings";
  routePath?: WorkspaceConsolePathname;
};

export default function WorkspaceConsolePage({
  activeHref = "/workspace",
  routePath = "/workspace"
}: WorkspaceConsolePageProps) {
  const { language, t } = useI18n();
  const { session } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const workspaceLocationSearch = searchParams.toString();
  const initialWorkspaceLocationState = useMemo(
    () =>
      readWorkspaceLocationState(
        workspaceLocationSearch.length > 0 ? `?${workspaceLocationSearch}` : ""
      ),
    [workspaceLocationSearch]
  );
  const initialWorkspaceView =
    routePath === "/chat"
      ? "chat"
      : routePath === "/documents"
        ? "documents"
        : routePath === "/operations"
          ? "workflows"
          : initialWorkspaceLocationState.view;

  const initialLocationStateRef = useRef<WorkspaceLocationState | null>(null);
  const hasAppliedInitialTargetRef = useRef(false);
  const isApplyingDocumentLocationStateRef = useRef(false);
  const isApplyingWorkflowLocationStateRef = useRef(false);
  const previousLanguageRef = useRef(language);
  const cachedTenantsRef = useRef<Tenant[] | null>(null);
  const cachedWorkspacesByTenantIdRef = useRef<Record<string, Workspace[]>>({});
  const cachedKnowledgeBasesByWorkspaceIdRef = useRef<Record<string, KnowledgeBase[]>>({});

  const [bootstrap, setBootstrap] = useState<BootstrapState | null>(null);
  const [tenantAgentDefinitions, setTenantAgentDefinitions] = useState<WorkspaceAgentContext[]>([]);
  const [catalog, setCatalog] = useState<WorkspaceCatalog>({
    tenants: [],
    workspaces: [],
    knowledgeBases: []
  });
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [hasMoreConversations, setHasMoreConversations] = useState(false);
  const [isLoadingMoreConversations, setIsLoadingMoreConversations] = useState(false);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [retrievalValidationSummary, setRetrievalValidationSummary] = useState<RetrievalValidationSummary | null>(null);
  const [conversationDraftTitle, setConversationDraftTitle] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [documentTotalCount, setDocumentTotalCount] = useState(0);
  const [documentMetrics, setDocumentMetrics] = useState<DocumentMetrics>(EMPTY_DOCUMENT_METRICS);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  const [workflowRuns, setWorkflowRuns] = useState<WorkflowRun[]>([]);
  const [workflowTotalCount, setWorkflowTotalCount] = useState(0);
  const [workflowMetrics, setWorkflowMetrics] = useState<WorkflowMetrics>(EMPTY_WORKFLOW_METRICS);
  const [conversationMetrics, setConversationMetrics] = useState<ConversationMetrics>(EMPTY_CONVERSATION_METRICS);
  const [messageFeedbackSummary, setMessageFeedbackSummary] = useState<MessageFeedbackSummary | null>(null);
  const [retrievalEvaluationSummary, setRetrievalEvaluationSummary] = useState<RetrievalEvaluationSummary | null>(null);
  const [hasLoadedWorkspaceOperations, setHasLoadedWorkspaceOperations] = useState(false);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [selectedDocumentVersionId, setSelectedDocumentVersionId] = useState<string | null>(null);
  const [selectedDocumentDetail, setSelectedDocumentDetail] = useState<DocumentDetail | null>(null);
  const [focusedDocumentChunkId, setFocusedDocumentChunkId] = useState<string | null>(null);
  const [selectedDocumentWorkflowRuns, setSelectedDocumentWorkflowRuns] = useState<WorkflowRun[]>([]);
  const [selectedWorkflowRunId, setSelectedWorkflowRunId] = useState<string | null>(null);
  const [selectedWorkflowRunDetail, setSelectedWorkflowRunDetail] = useState<WorkflowRunDetail | null>(null);
  const [selectedWorkflowLineageRuns, setSelectedWorkflowLineageRuns] = useState<WorkflowRun[]>([]);
  const [isSavingWorkflowNotes, setIsSavingWorkflowNotes] = useState(false);
  const [mcpConnectors, setMcpConnectors] = useState<PlatformMcpConnector[]>([]);
  const [activeRuntimeGovernanceActionId, setActiveRuntimeGovernanceActionId] = useState<string | null>(null);
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>(initialWorkspaceView);
  const [showConsoleControls, setShowConsoleControls] = useState(false);
  const [documentQuery, setDocumentQuery] = useState(initialWorkspaceLocationState.documentQuery);
  const [documentSourceFilter, setDocumentSourceFilter] = useState<DocumentSourceFilter>(
    initialWorkspaceLocationState.documentSource as DocumentSourceFilter
  );
  const [documentLifecycleFilter, setDocumentLifecycleFilter] = useState<DocumentLifecycleFilter>(
    initialWorkspaceLocationState.documentLifecycle as DocumentLifecycleFilter
  );
  const [documentStatusFilter, setDocumentStatusFilter] = useState(initialWorkspaceLocationState.documentStatus);
  const [documentSortOrder, setDocumentSortOrder] = useState<DocumentSortOrder>(
    initialWorkspaceLocationState.documentSort as DocumentSortOrder
  );
  const [documentPage, setDocumentPage] = useState(initialWorkspaceLocationState.documentPage);
  const [workflowQuery, setWorkflowQuery] = useState(initialWorkspaceLocationState.workflowQuery);
  const [workflowStatusFilter, setWorkflowStatusFilter] = useState(initialWorkspaceLocationState.workflowStatus);
  const [workflowTypeFilter, setWorkflowTypeFilter] = useState(initialWorkspaceLocationState.workflowType);
  const [workflowRetryMode, setWorkflowRetryMode] = useState<WorkflowRetryMode>(
    initialWorkspaceLocationState.workflowRetryMode as WorkflowRetryMode
  );
  const [workflowSortOrder, setWorkflowSortOrder] = useState<WorkflowSortOrder>(
    initialWorkspaceLocationState.workflowSort as WorkflowSortOrder
  );
  const [workflowPage, setWorkflowPage] = useState(initialWorkspaceLocationState.workflowPage);
  const [question, setQuestion] = useState("");
  const [conversationSearchQuery, setConversationSearchQuery] = useState(initialWorkspaceLocationState.conversationQuery);
  const [isConversationEditorOpen, setIsConversationEditorOpen] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const uploadFile = uploadFiles[0] ?? null;
  const [webImportUrl, setWebImportUrl] = useState("");
  const [webImportTitle, setWebImportTitle] = useState("");
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [messageFeedbackPendingId, setMessageFeedbackPendingId] = useState<string | null>(null);
  const [activeRetrievalEvaluationId, setActiveRetrievalEvaluationId] = useState<string | null>(null);
  const [activeRetrievalFollowUpQuery, setActiveRetrievalFollowUpQuery] = useState<string | null>(null);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isDeletingConversation, setIsDeletingConversation] = useState(false);
  const [isUpdatingConversationTitle, setIsUpdatingConversationTitle] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isRunningDocumentAction, setIsRunningDocumentAction] = useState(false);
  const [isCancellingWorkflow, setIsCancellingWorkflow] = useState(false);
  const [isRetryingWorkflow, setIsRetryingWorkflow] = useState(false);
  const [isSwitchingContext, setIsSwitchingContext] = useState(false);
  const [isCreatingContext, setIsCreatingContext] = useState(false);
  const [isUpdatingContext, setIsUpdatingContext] = useState(false);
  const [isRunningContextLifecycleAction, setIsRunningContextLifecycleAction] = useState(false);
  const [managementPanel, setManagementPanel] = useState<ContextManagementPanel>(null);
  const [newTenantName, setNewTenantName] = useState("");
  const [newTenantSlug, setNewTenantSlug] = useState("");
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [newWorkspaceSlug, setNewWorkspaceSlug] = useState("");
  const [newWorkspaceDescription, setNewWorkspaceDescription] = useState("");
  const [newKnowledgeBaseName, setNewKnowledgeBaseName] = useState("");
  const [newKnowledgeBaseSlug, setNewKnowledgeBaseSlug] = useState("");
  const [newKnowledgeBaseDescription, setNewKnowledgeBaseDescription] = useState("");
  const [newKnowledgeBaseRetrievalProfileId, setNewKnowledgeBaseRetrievalProfileId] = useState("");
  const [editTenantName, setEditTenantName] = useState("");
  const [editTenantSlug, setEditTenantSlug] = useState("");
  const [editWorkspaceName, setEditWorkspaceName] = useState("");
  const [editWorkspaceSlug, setEditWorkspaceSlug] = useState("");
  const [editWorkspaceDescription, setEditWorkspaceDescription] = useState("");
  const [editKnowledgeBaseName, setEditKnowledgeBaseName] = useState("");
  const [editKnowledgeBaseSlug, setEditKnowledgeBaseSlug] = useState("");
  const [editKnowledgeBaseDescription, setEditKnowledgeBaseDescription] = useState("");
  const [editKnowledgeBaseRetrievalProfileId, setEditKnowledgeBaseRetrievalProfileId] = useState("");

  useEffect(() => {
    if (catalog.tenants.length > 0) {
      cachedTenantsRef.current = catalog.tenants;
    }
    if (bootstrap !== null) {
      cachedWorkspacesByTenantIdRef.current[bootstrap.tenant.id] = catalog.workspaces;
      cachedKnowledgeBasesByWorkspaceIdRef.current[bootstrap.workspace.id] = catalog.knowledgeBases;
    }
  }, [bootstrap, catalog]);
  const [retrievalProfiles, setRetrievalProfiles] = useState<PlatformRetrievalProfile[]>([]);
  const [statusMessage, setStatusMessage] = useState(() => t("workspace.status.loading"));
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  useStatusNotifications(statusMessage, errorMessage, { statusTone: "info" });
  const [isActivatingRecommendedAgent, setIsActivatingRecommendedAgent] = useState(false);
  const [activeAgentId, setActiveAgentId] = useState<string | null>(initialWorkspaceLocationState.agentId);
  const [sourceSurface, setSourceSurface] = useState<WorkspaceSourceSurface | null>(
    initialWorkspaceLocationState.sourceSurface
  );
  const [sourceAdminSection, setSourceAdminSection] = useState<WorkspaceSourceAdminSection | null>(
    initialWorkspaceLocationState.sourceAdminSection
  );
  const [sourceOperationsLane, setSourceOperationsLane] = useState<WorkspaceSourceOperationsLane | null>(
    initialWorkspaceLocationState.sourceOperationsLane
  );
  const [handoffIntent, setHandoffIntent] = useState<WorkspaceHandoffIntent | null>(
    initialWorkspaceLocationState.handoffIntent
  );

  const debouncedDocumentQuery = useDebouncedValue(documentQuery, SEARCH_DEBOUNCE_MS);
  const debouncedWorkflowQuery = useDebouncedValue(workflowQuery, SEARCH_DEBOUNCE_MS);
  const debouncedConversationSearchQuery = useDebouncedValue(conversationSearchQuery, SEARCH_DEBOUNCE_MS);
  const canManageAdminResources = hasDirectoryCapability(session, "manage_admin_resources");
  const canManageDocuments = hasDirectoryCapability(session, "manage_documents");
  const canManageRuntimeGovernance = hasDirectoryCapability(session, "manage_runtime_governance");
  const canManageWorkflowRuns = hasDirectoryCapability(session, "retry_workflow_runs");
  const canSendChatMessages = hasDirectoryCapability(session, "send_chat_messages");
  const isWorkspaceBusy =
    isBootstrapping ||
    isSwitchingContext ||
    isUpdatingContext ||
    isRunningContextLifecycleAction ||
    isDeletingConversation ||
    isUpdatingConversationTitle;

  useEffect(() => {
    let isMounted = true;

    async function loadRuntimeCatalog() {
      try {
        const [nextRetrievalProfiles, nextMcpConnectors] = await Promise.all([
          listRetrievalProfiles(),
          listMcpConnectors(),
        ]);
        if (!isMounted) {
          return;
        }
        setRetrievalProfiles(nextRetrievalProfiles);
        setMcpConnectors(nextMcpConnectors);
      } catch {
        if (!isMounted) {
          return;
        }
        setRetrievalProfiles([]);
        setMcpConnectors([]);
      }
    }

    void loadRuntimeCatalog();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (previousLanguageRef.current === language) {
      return;
    }

    previousLanguageRef.current = language;

    if (!bootstrap || isWorkspaceBusy || errorMessage) {
      return;
    }

    setStatusMessage(t("workspace.status.readyForKnowledgeBase", { name: bootstrap.knowledgeBase.name }));
  }, [bootstrap, errorMessage, isWorkspaceBusy, language, t]);

  const selectedConversation = useMemo(
    () => conversations.find((item) => item.id === selectedConversationId) ?? null,
    [conversations, selectedConversationId]
  );

  const currentConversationStats = useMemo(() => {
    const firstMessageAt = messages[0]?.created_at ?? null;
    const latestMessageAt = messages.length > 0 ? messages[messages.length - 1]?.created_at ?? null : null;
    const userMessageCount = messages.filter((message) => message.role === "user").length;
    const assistantMessageCount = messages.filter((message) => message.role === "assistant").length;

    return {
      messageCount: messages.length,
      userMessageCount,
      assistantMessageCount,
      firstMessageAt,
      latestMessageAt,
    };
  }, [messages]);

  const activeAgentContext = useMemo(
    () => tenantAgentDefinitions.find((agentDefinition) => agentDefinition.id === activeAgentId) ?? null,
    [activeAgentId, tenantAgentDefinitions]
  );
  const activeAgentRuntimeGovernance = activeAgentContext?.runtime_governance ?? null;
  const activePendingMcpConnector = useMemo(
    () => activeAgentRuntimeGovernance?.focus_mcp_connector ?? null,
    [activeAgentRuntimeGovernance]
  );
  const activeAgentRuntimeDirectActions = useMemo(
    () => buildRuntimeGovernanceQuickActions(activeAgentRuntimeGovernance, t),
    [activeAgentRuntimeGovernance, t]
  );
  const activeAgentRuntimeLeadIssue = useMemo(
    () => resolveRuntimeGovernanceLeadIssue(activeAgentRuntimeGovernance),
    [activeAgentRuntimeGovernance]
  );
  const activeAgentModelPreviewDetail = useMemo(
    () =>
      readRuntimeGovernanceModelPreviewLabel(
        activeAgentRuntimeGovernance?.resolved_model_endpoint,
        t,
        (value) => formatWorkspaceRuntimeTimestamp(value, language),
        "admin.runtimeQueue.lastModelPreview"
      ),
    [activeAgentRuntimeGovernance?.resolved_model_endpoint, language, t]
  );
  const activeAgentModelPreviewFailures = useMemo(
    () =>
      readRuntimeGovernancePreviewFailureLabel(
        activeAgentRuntimeGovernance?.resolved_model_endpoint,
        t,
        "admin.runtimeQueue.previewFailures"
      ),
    [activeAgentRuntimeGovernance?.resolved_model_endpoint, t]
  );
  const activeAgentToolPreviewDetail = useMemo(
    () =>
      readRuntimeGovernanceToolPreviewLabel(
        activeAgentRuntimeGovernance?.focus_tool_registration,
        t,
        (value) => formatWorkspaceRuntimeTimestamp(value, language),
        "operations.recoveryAgents.lastToolPreview"
      ),
    [activeAgentRuntimeGovernance?.focus_tool_registration, language, t]
  );
  const activeAgentToolPreviewFailures = useMemo(
    () =>
      readRuntimeGovernancePreviewFailureLabel(
        activeAgentRuntimeGovernance?.focus_tool_registration,
        t,
        "admin.runtimeQueue.previewFailures"
      ),
    [activeAgentRuntimeGovernance?.focus_tool_registration, t]
  );
  const activeAgentConnectorPreviewDetail = useMemo(
    () =>
      readRuntimeGovernanceConnectorPreviewLabel(
        activeAgentRuntimeGovernance?.focus_mcp_connector,
        t,
        (value) => formatWorkspaceRuntimeTimestamp(value, language),
        "operations.recoveryAgents.lastConnectorPreview"
      ),
    [activeAgentRuntimeGovernance?.focus_mcp_connector, language, t]
  );
  const activeAgentConnectorPreviewFailures = useMemo(
    () =>
      readRuntimeGovernancePreviewFailureLabel(
        activeAgentRuntimeGovernance?.focus_mcp_connector,
        t,
        "admin.runtimeQueue.previewFailures"
      ),
    [activeAgentRuntimeGovernance?.focus_mcp_connector, t]
  );
  const activeAgentRuntimeIssueDetail = useMemo(() => {
    const previewContext =
      activeAgentConnectorPreviewFailures ??
      activeAgentConnectorPreviewDetail ??
      activeAgentToolPreviewFailures ??
      activeAgentToolPreviewDetail ??
      activeAgentModelPreviewFailures ??
      activeAgentModelPreviewDetail;

    return readRuntimeGovernanceIssueDetail(
      activeAgentRuntimeGovernance,
      activeAgentRuntimeLeadIssue,
      t,
      previewContext
    );
  }, [
    activeAgentConnectorPreviewDetail,
    activeAgentConnectorPreviewFailures,
    activeAgentModelPreviewDetail,
    activeAgentModelPreviewFailures,
    activeAgentRuntimeGovernance,
    activeAgentRuntimeLeadIssue,
    activeAgentToolPreviewDetail,
    activeAgentToolPreviewFailures,
    t
  ]);
  const activeAgentRuntimeIssueLabel = useMemo(
    () => {
      if (activeAgentRuntimeLeadIssue) {
        return readRuntimeGovernanceIssueLabel(activeAgentRuntimeLeadIssue, t);
      }

      return activeAgentModelPreviewFailures ?? activeAgentModelPreviewDetail ?? null;
    },
    [activeAgentModelPreviewDetail, activeAgentModelPreviewFailures, activeAgentRuntimeLeadIssue, t]
  );
  const buildWorkspaceAgentRunRecord = useCallback((
    targetSurface: "chat" | "documents" | "operations" | "admin",
    nextHandoffIntent?: WorkspaceHandoffIntent | null
  ): AgentRunRecordInput | null => {
    if (!bootstrap || !activeAgentContext) {
      return null;
    }

    return {
      tenant_id: bootstrap.tenant.id,
      agent_definition_id: activeAgentContext.id,
      workspace_id: bootstrap.workspace.id,
      knowledge_base_id: bootstrap.knowledgeBase.id,
      target_surface: targetSurface,
      handoff_intent: nextHandoffIntent ?? handoffIntent ?? "agent_brief",
      trigger_source: "workspace",
      launch_prompt: question.trim() || null
    };
  }, [activeAgentContext, bootstrap, handoffIntent, question]);
  const isCurrentSurfaceRecommended = useMemo(() => {
    if (!activeAgentContext) {
      return null;
    }

    const recommendedView =
      activeAgentContext.mode === "grounded_chat"
        ? "chat"
        : activeAgentContext.mode === "document_intake"
          ? "documents"
          : "workflows";

    return workspaceView === recommendedView;
  }, [activeAgentContext, workspaceView]);
  const agentConsoleHref = useMemo(() => {
    if (!bootstrap || !activeAgentContext) {
      return null;
    }

    return buildAgentsHref({
      tenantId: bootstrap.tenant.id,
      agentId: activeAgentContext.id
    });
  }, [activeAgentContext, bootstrap]);
  const recommendedSurfaceHref = useMemo(() => {
    if (!bootstrap || !activeAgentContext) {
      return null;
    }

    const recommendedView =
      activeAgentContext.mode === "grounded_chat"
        ? "chat"
        : activeAgentContext.mode === "document_intake"
          ? "documents"
          : "workflows";

    return buildWorkspaceHref({
      view: recommendedView,
      tenantId: bootstrap.tenant.id,
      workspaceId: bootstrap.workspace.id,
      knowledgeBaseId: bootstrap.knowledgeBase.id,
      agentId: activeAgentContext.id,
      sourceSurface,
      sourceAdminSection,
      sourceOperationsLane,
      handoffIntent,
      conversationId: recommendedView === "chat" ? selectedConversationId : null,
      conversationQuery: recommendedView === "chat" ? conversationSearchQuery : null,
      draftQuestion: recommendedView === "chat" ? question.trim() || null : null,
      documentId: recommendedView === "documents" ? selectedDocumentId : null,
      documentQuery: recommendedView === "documents" ? documentQuery : null,
      documentSource: recommendedView === "documents" ? documentSourceFilter : null,
      documentLifecycle: recommendedView === "documents" ? documentLifecycleFilter : null,
      documentStatus: recommendedView === "documents" ? documentStatusFilter : null,
      documentSort: recommendedView === "documents" ? documentSortOrder : null,
      documentPage: recommendedView === "documents" ? documentPage : null,
      workflowRunId: recommendedView === "workflows" ? selectedWorkflowRunId : null,
      workflowQuery: recommendedView === "workflows" ? workflowQuery : null,
      workflowStatus: recommendedView === "workflows" ? workflowStatusFilter : null,
      workflowType: recommendedView === "workflows" ? workflowTypeFilter : null,
      workflowRetryMode: recommendedView === "workflows" ? workflowRetryMode : null,
      workflowSort: recommendedView === "workflows" ? workflowSortOrder : null,
      workflowPage: recommendedView === "workflows" ? workflowPage : null
    });
  }, [
    activeAgentContext,
    bootstrap,
    conversationSearchQuery,
    documentPage,
    documentLifecycleFilter,
    documentQuery,
    documentSortOrder,
    documentStatusFilter,
    question,
    selectedConversationId,
    selectedDocumentId,
    selectedWorkflowRunId,
    sourceAdminSection,
    sourceOperationsLane,
    handoffIntent,
    sourceSurface,
    workflowPage,
    workflowQuery,
    workflowRetryMode,
    workflowSortOrder,
    workflowStatusFilter,
    workflowTypeFilter
  ]);
  const sourceSurfaceHref = useMemo(() => {
    if (sourceSurface === "home") {
      return "/" as Route;
    }

    const tenantId = bootstrap?.tenant.id ?? null;
    const agentId = activeAgentContext?.id ?? activeAgentId ?? null;

    if (sourceSurface === "agents") {
      return buildAgentsHref({
        tenantId,
        agentId
      });
    }

    const selectedWorkflowStage = resolveWorkflowFollowUpStage(selectedWorkflowRunDetail?.workflow_status);

    if (sourceSurface === "operations") {
      return buildOperationsHref({
        tenantId,
        agentId,
        lane: sourceOperationsLane ?? (activeAgentContext?.mode === "workflow_recovery" ? "failed" : "overview"),
        status: selectedWorkflowStage === "recovery" ? "failed" : "all",
        workflowRunId: selectedWorkflowRunId
      });
    }

    if (sourceSurface === "admin") {
      return buildAdminHref({
        tenantId,
        section: sourceAdminSection ?? (agentId ? "directory" : "overview")
      });
    }

    return null;
  }, [
    activeAgentRuntimeDirectActions,
    activeAgentRuntimeGovernance,
    activeAgentRuntimeIssueDetail,
    activeAgentRuntimeIssueLabel,
    activeAgentContext,
    activeAgentId,
    bootstrap?.tenant.id,
    sourceAdminSection,
    sourceOperationsLane,
    selectedWorkflowRunDetail?.workflow_status,
    selectedWorkflowRunId,
    sourceSurface
  ]);
  const recommendedSurfaceRunRecord = activeAgentContext
    ? buildWorkspaceAgentRunRecord(
        activeAgentContext.mode === "grounded_chat"
          ? "chat"
          : activeAgentContext.mode === "document_intake"
            ? "documents"
            : "operations",
        activeAgentContext.mode === "workflow_recovery" ? "workflow_recovery" : "agent_brief"
      )
    : null;

  const workspaceSurfaceCopy = useMemo(() => {
    if (workspaceView === "documents") {
      return {
        browserTitle: t("workspace.routePage.documents.browserTitle"),
        eyebrow: t("workspace.routePage.documents.eyebrow"),
        title: t("workspace.routePage.documents.title"),
        description: t("workspace.routePage.documents.description")
      };
    }

    if (workspaceView === "workflows") {
      return {
        browserTitle: t("workspace.routePage.operations.browserTitle"),
        eyebrow: t("workspace.routePage.operations.eyebrow"),
        title: t("workspace.routePage.operations.title"),
        description: t("workspace.routePage.operations.description")
      };
    }

    return {
      browserTitle: t("workspace.routePage.chat.browserTitle"),
      eyebrow: t("workspace.routePage.chat.eyebrow"),
      title: t("workspace.routePage.chat.title"),
      description: t("workspace.routePage.chat.description")
    };
  }, [t, workspaceView]);

  const retrievalValidationStatusLabel = useMemo(() => {
    if (!retrievalValidationSummary) {
      return t("workspace.chatView.validationStatuses.pending");
    }

    return t(`workspace.chatView.validationStatuses.${retrievalValidationSummary.status}`);
  }, [retrievalValidationSummary, t]);

  const retrievalValidationTone = useMemo(() => {
    switch (retrievalValidationSummary?.status) {
      case "ready":
        return "healthy" as const;
      case "review":
        return "review" as const;
      case "hold":
      case "empty":
      case "failed":
        return "attention" as const;
      default:
        return "review" as const;
    }
  }, [retrievalValidationSummary]);

  const retrievalValidationBlocksGroundedChat =
    retrievalValidationSummary?.status === "hold" ||
    retrievalValidationSummary?.status === "empty" ||
    retrievalValidationSummary?.status === "failed";
  const retrievalValidationNeedsReview = retrievalValidationSummary?.status === "review";
  const retrievalValidationReady = retrievalValidationSummary?.status === "ready";

  const workspaceRuntimeTaskPacket = useMemo(() => {
    if (!bootstrap) {
      return null;
    }

    const taskDocumentsHref = buildWorkspaceHref({
      view: "documents",
      tenantId: bootstrap.tenant.id,
      workspaceId: bootstrap.workspace.id,
      knowledgeBaseId: bootstrap.knowledgeBase.id,
      agentId: activeAgentId,
      sourceSurface,
      sourceAdminSection,
      sourceOperationsLane,
      handoffIntent,
      documentId: selectedDocumentId,
      documentSource: documentSourceFilter !== "all" ? documentSourceFilter : null,
      documentLifecycle: "active",
      documentStatus:
        documentMetrics.failed_documents > 0
          ? "failed"
          : documentMetrics.active_documents > 0
            ? "running"
            : documentStatusFilter !== "all"
              ? documentStatusFilter
              : null,
      documentSort: documentSortOrder,
      documentPage
    });
    const taskWorkflowsHref = buildWorkspaceHref({
      view: "workflows",
      tenantId: bootstrap.tenant.id,
      workspaceId: bootstrap.workspace.id,
      knowledgeBaseId: bootstrap.knowledgeBase.id,
      agentId: activeAgentId,
      sourceSurface,
      sourceAdminSection,
      sourceOperationsLane,
      handoffIntent,
      workflowRunId: selectedWorkflowRunId,
      workflowStatus:
        workflowMetrics.failed_runs > 0
          ? "failed"
          : workflowMetrics.cancelled_runs > 0
            ? "cancelled"
            : workflowMetrics.active_runs > 0
              ? "running"
              : workflowStatusFilter !== "all"
                ? workflowStatusFilter
                : null,
      workflowType: workflowTypeFilter,
      workflowRetryMode,
      workflowSort: workflowSortOrder,
      workflowPage
    });
    const taskChatHref = buildWorkspaceHref({
      view: "chat",
      tenantId: bootstrap.tenant.id,
      workspaceId: bootstrap.workspace.id,
      knowledgeBaseId: bootstrap.knowledgeBase.id,
      agentId: activeAgentId,
      sourceSurface,
      sourceAdminSection,
      sourceOperationsLane,
      handoffIntent,
      conversationId: selectedConversationId,
      conversationQuery: conversationSearchQuery,
      draftQuestion: question.trim() || null
    });

    const currentSurfaceLabel =
      workspaceView === "documents"
        ? t("workspace.headerBar.documentOperations")
        : workspaceView === "workflows"
          ? t("workspace.headerBar.workflowOperations")
          : t("workspace.headerBar.groundedChat");
    const sourceSurfaceLabel = sourceSurface ? t(`workspace.headerBar.sources.${sourceSurface}`) : t("workspace.runtimeTaskPacket.pending");
    const sourceRouteLabel =
      sourceSurface === "admin"
        ? t(`admin.sections.${sourceAdminSection ?? "overview"}`)
        : sourceSurface === "operations"
          ? t(`operations.lanes.${sourceOperationsLane ?? "overview"}`)
          : sourceSurface === "agents"
            ? t("workspace.headerBar.sources.agents")
            : sourceSurface === "workspace"
              ? t("workspace.headerBar.sources.workspace")
            : sourceSurface === "home"
              ? t("workspace.headerBar.sources.home")
              : t("workspace.runtimeTaskPacket.pending");
    const subjectLabel =
      selectedWorkflowRunDetail?.subject_label ??
      selectedDocumentDetail?.document.title ??
      selectedConversation?.title ??
      bootstrap.knowledgeBase.name;
    const scopeLabel = `${bootstrap.workspace.name} / ${bootstrap.knowledgeBase.name}`;
    const intentLabel =
      handoffIntent === "grounded_validation"
        ? t("workspace.runtimeTaskPacket.intents.grounded_validation")
        : handoffIntent === "document_recovery"
          ? t("workspace.runtimeTaskPacket.intents.document_recovery")
          : handoffIntent === "workflow_recovery"
            ? t("workspace.runtimeTaskPacket.intents.workflow_recovery")
            : handoffIntent === "agent_brief"
              ? t("workspace.runtimeTaskPacket.intents.agent_brief")
              : t("workspace.runtimeTaskPacket.intents.general");
    const detail =
      handoffIntent === "grounded_validation"
        ? t("workspace.runtimeTaskPacket.details.grounded_validation")
        : handoffIntent === "document_recovery"
          ? t("workspace.runtimeTaskPacket.details.document_recovery")
          : handoffIntent === "workflow_recovery"
            ? t("workspace.runtimeTaskPacket.details.workflow_recovery")
            : handoffIntent === "agent_brief"
              ? t("workspace.runtimeTaskPacket.details.agent_brief")
              : t("workspace.runtimeTaskPacket.details.general", {
                  source: sourceSurfaceLabel
                });
    const objective =
      activeAgentContext?.objective.trim().length
        ? activeAgentContext.objective
        : handoffIntent === "grounded_validation"
          ? t("workspace.runtimeTaskPacket.objectives.grounded_validation")
          : handoffIntent === "document_recovery"
            ? t("workspace.runtimeTaskPacket.objectives.document_recovery")
            : handoffIntent === "workflow_recovery"
              ? t("workspace.runtimeTaskPacket.objectives.workflow_recovery")
              : handoffIntent === "agent_brief"
                ? t("workspace.runtimeTaskPacket.objectives.agent_brief")
                : t("workspace.runtimeTaskPacket.objectives.general");
    const prompt = question.trim().length > 0 ? question.trim() : t("workspace.runtimeTaskPacket.noPrompt");

    if (!sourceSurface && !activeAgentContext && !handoffIntent) {
      const failedSignalCount =
        documentMetrics.failed_documents + workflowMetrics.failed_runs + workflowMetrics.cancelled_runs;
      const activeSignalCount = documentMetrics.active_documents + workflowMetrics.active_runs;
      const hasReadyKnowledge = documentMetrics.completed_documents > 0;
      const defaultValidationDetail = retrievalValidationReady
        ? t("workspace.runtimeTaskPacket.default.details.validationReady", {
            count: String(documentMetrics.completed_documents)
          })
        : retrievalValidationNeedsReview
          ? t("workspace.runtimeTaskPacket.default.details.validationReview", {
              count: String(documentMetrics.completed_documents)
            })
          : retrievalValidationBlocksGroundedChat
            ? t("workspace.runtimeTaskPacket.default.details.validationBlocked")
            : t("workspace.runtimeTaskPacket.default.details.validation", {
                count: String(documentMetrics.completed_documents)
              });
      const defaultValidationObjective = retrievalValidationReady
        ? t("workspace.runtimeTaskPacket.default.objectives.validationReady")
        : retrievalValidationNeedsReview
          ? t("workspace.runtimeTaskPacket.default.objectives.validationReview")
          : retrievalValidationBlocksGroundedChat
            ? t("workspace.runtimeTaskPacket.default.objectives.validationBlocked")
            : t("workspace.runtimeTaskPacket.default.objectives.validation");
      const defaultValidationActionHref = retrievalValidationBlocksGroundedChat ? taskDocumentsHref : taskChatHref;
      const defaultValidationActionRunRecord = retrievalValidationBlocksGroundedChat
        ? buildWorkspaceAgentRunRecord("documents", "grounded_validation")
        : buildWorkspaceAgentRunRecord("chat", "grounded_validation");
      const defaultValidationActionLabel = retrievalValidationBlocksGroundedChat
        ? t("workspace.runtimeTaskPacket.default.actions.openEvidenceReview")
        : retrievalValidationNeedsReview
          ? t("workspace.runtimeTaskPacket.default.actions.resumeValidation")
          : t("workspace.runtimeTaskPacket.default.actions.openValidation");

      return {
        detail:
          failedSignalCount > 0
            ? t("workspace.runtimeTaskPacket.default.details.recovery", {
                count: String(failedSignalCount)
              })
            : activeSignalCount > 0
              ? t("workspace.runtimeTaskPacket.default.details.monitoring", {
                  count: String(activeSignalCount)
                })
              : hasReadyKnowledge
                ? defaultValidationDetail
                : t("workspace.runtimeTaskPacket.default.details.intake"),
        objective:
          failedSignalCount > 0
            ? t("workspace.runtimeTaskPacket.default.objectives.recovery")
            : activeSignalCount > 0
              ? t("workspace.runtimeTaskPacket.default.objectives.monitoring")
              : hasReadyKnowledge
                ? defaultValidationObjective
                : t("workspace.runtimeTaskPacket.default.objectives.intake"),
        primaryActionHref:
          failedSignalCount > 0
            ? taskWorkflowsHref
            : activeSignalCount > 0
              ? taskWorkflowsHref
              : hasReadyKnowledge
                ? defaultValidationActionHref
                : taskDocumentsHref,
        primaryActionRunRecord:
          failedSignalCount > 0
            ? buildWorkspaceAgentRunRecord("operations", "workflow_recovery")
            : activeSignalCount > 0
              ? buildWorkspaceAgentRunRecord("operations", "workflow_recovery")
              : hasReadyKnowledge
                ? defaultValidationActionRunRecord
                : buildWorkspaceAgentRunRecord("documents", "agent_brief"),
        primaryActionLabel:
          failedSignalCount > 0
            ? t("workspace.runtimeTaskPacket.default.actions.openRecovery")
            : activeSignalCount > 0
              ? t("workspace.runtimeTaskPacket.default.actions.openMonitoring")
              : hasReadyKnowledge
                ? defaultValidationActionLabel
                : t("workspace.runtimeTaskPacket.default.actions.openIntake"),
        prompt,
        secondaryActions: [
          {
            label: t("workspace.runtimeRunbook.actions.openDocuments"),
            href: taskDocumentsHref,
            runRecord: buildWorkspaceAgentRunRecord("documents", "agent_brief")
          },
          {
            label: t("workspace.runtimeRunbook.actions.openWorkflowLane"),
            href: taskWorkflowsHref,
            runRecord: buildWorkspaceAgentRunRecord("operations", "workflow_recovery")
          },
          {
            label: t("workspace.runtimeRunbook.actions.openChat"),
            href: taskChatHref,
            runRecord: buildWorkspaceAgentRunRecord("chat", "grounded_validation")
          }
        ],
        statusLabel:
          failedSignalCount > 0
            ? t("workspace.runtimeTaskPacket.statuses.attention")
            : activeSignalCount > 0
              ? t("workspace.runtimeTaskPacket.statuses.review")
              : hasReadyKnowledge
                ? retrievalValidationSummary
                  ? retrievalValidationStatusLabel
                  : t("workspace.runtimeTaskPacket.statuses.ready")
                : t("workspace.runtimeTaskPacket.statuses.review"),
        statusTone:
          failedSignalCount > 0
            ? ("attention" as const)
            : activeSignalCount > 0
              ? ("review" as const)
              : hasReadyKnowledge
                ? retrievalValidationSummary
                  ? retrievalValidationTone
                  : ("healthy" as const)
                : ("review" as const),
        summaryItems: [
          {
            label: t("workspace.runtimeTaskPacket.fields.currentSurface"),
            value: currentSurfaceLabel
          },
          {
            label: t("workspace.runtimeTaskPacket.fields.scope"),
            value: scopeLabel
          },
          {
            label: t("workspace.runtimeTaskPacket.fields.readyDocuments"),
            value: String(documentMetrics.completed_documents)
          },
          {
            label: t("workspace.runtimeTaskPacket.fields.activeWorkflows"),
            value: String(workflowMetrics.active_runs)
          },
          {
            label: t("workspace.runtimeTaskPacket.fields.failedWorkflows"),
            value: String(workflowMetrics.failed_runs)
          },
          {
            label: t("workspace.runtimeTaskPacket.fields.conversations"),
            value: String(conversationMetrics.total_conversations)
          }
        ],
        title: t("workspace.runtimeTaskPacket.default.title", {
          name: bootstrap.knowledgeBase.name
        })
      };
    }

    const validationSummaryItems =
      handoffIntent === "grounded_validation"
        ? [
            {
              label: t("workspace.runtimeTaskPacket.fields.validation"),
              value: retrievalValidationStatusLabel
            },
            ...(retrievalValidationSummary
              ? [
                  {
                    label: t("workspace.runtimeTaskPacket.fields.validatedHits"),
                    value: String(retrievalValidationSummary.resultCount)
                  }
                ]
              : [])
          ]
        : [];

    const primaryActionHref =
      !isCurrentSurfaceRecommended && recommendedSurfaceHref
        ? recommendedSurfaceHref
        : sourceSurfaceHref ?? buildWorkspaceHref({
            view: workspaceView,
            tenantId: bootstrap.tenant.id,
            workspaceId: bootstrap.workspace.id,
            knowledgeBaseId: bootstrap.knowledgeBase.id,
            agentId: activeAgentId,
            sourceSurface,
            sourceAdminSection,
            sourceOperationsLane,
            handoffIntent,
            conversationId: selectedConversationId,
            documentId: selectedDocumentId,
            workflowRunId: selectedWorkflowRunId
          });
    const primaryActionRunRecord =
      !isCurrentSurfaceRecommended && recommendedSurfaceHref
        ? recommendedSurfaceRunRecord
        : sourceSurface === "admin"
          ? buildWorkspaceAgentRunRecord("admin")
          : sourceSurface === "operations"
            ? buildWorkspaceAgentRunRecord(
                "operations",
                handoffIntent === "workflow_recovery" ? "workflow_recovery" : "agent_brief"
              )
            : null;

    return withUniqueConsoleFollowUpActions({
      detail,
      objective,
      primaryActionHref,
      primaryActionRunRecord,
      primaryActionLabel:
        !isCurrentSurfaceRecommended && recommendedSurfaceHref
          ? t("workspace.runtimeTaskPacket.primaryOpenRecommended")
          : t("workspace.runtimeTaskPacket.primaryReturn"),
      prompt,
      secondaryActions: [
        ...(sourceSurfaceHref
          ? [
              {
                label: t("workspace.runtimeTaskPacket.secondarySource"),
                href: sourceSurfaceHref,
                runRecord:
                  sourceSurface === "admin"
                    ? buildWorkspaceAgentRunRecord("admin")
                    : sourceSurface === "operations"
                      ? buildWorkspaceAgentRunRecord(
                          "operations",
                          handoffIntent === "workflow_recovery" ? "workflow_recovery" : "agent_brief"
                        )
                      : null
              }
            ]
          : []),
        ...(agentConsoleHref
          ? [
              {
                label: t("workspace.runtimeTaskPacket.secondaryAgent"),
                href: agentConsoleHref,
                runRecord: null
              }
            ]
          : []),
        {
          label: t("workspace.runtimeTaskPacket.secondaryGovernance"),
          href: buildAdminHref({
            tenantId: bootstrap.tenant.id,
            section: activeAgentContext ? "directory" : "overview"
          }),
          runRecord: buildWorkspaceAgentRunRecord("admin")
        }
      ],
      statusLabel:
        handoffIntent === "grounded_validation"
          ? retrievalValidationStatusLabel
          : handoffIntent === "workflow_recovery" && resolveWorkflowFollowUpStage(selectedWorkflowRunDetail?.workflow_status) === "recovery"
            ? t("workspace.runtimeTaskPacket.statuses.attention")
            : isCurrentSurfaceRecommended
              ? t("workspace.runtimeTaskPacket.statuses.ready")
              : t("workspace.runtimeTaskPacket.statuses.review"),
      statusTone:
        handoffIntent === "grounded_validation"
          ? retrievalValidationTone
          : handoffIntent === "workflow_recovery" && resolveWorkflowFollowUpStage(selectedWorkflowRunDetail?.workflow_status) === "recovery"
            ? ("attention" as const)
            : isCurrentSurfaceRecommended
              ? ("healthy" as const)
              : ("review" as const),
      summaryItems: [
        {
          label: t("workspace.runtimeTaskPacket.fields.currentSurface"),
          value: currentSurfaceLabel
        },
        {
          label: t("workspace.runtimeTaskPacket.fields.source"),
          value: sourceSurfaceLabel
        },
        {
          label: t("workspace.runtimeTaskPacket.fields.sourceRoute"),
          value: sourceRouteLabel
        },
        {
          label: t("workspace.runtimeTaskPacket.fields.intent"),
          value: intentLabel
        },
        ...validationSummaryItems,
        {
          label: t("workspace.runtimeTaskPacket.fields.scope"),
          value: scopeLabel
        },
        {
          label: t("workspace.runtimeTaskPacket.fields.subject"),
          value: subjectLabel
        }
      ],
      title: activeAgentContext?.name ?? subjectLabel
    });
  }, [
    activeAgentContext,
    activeAgentId,
    agentConsoleHref,
    bootstrap,
    conversationMetrics.total_conversations,
    conversationSearchQuery,
    documentMetrics.active_documents,
    documentMetrics.completed_documents,
    documentMetrics.failed_documents,
    documentPage,
    documentSortOrder,
    documentStatusFilter,
    handoffIntent,
    isCurrentSurfaceRecommended,
    question,
    recommendedSurfaceHref,
    retrievalValidationBlocksGroundedChat,
    retrievalValidationNeedsReview,
    retrievalValidationReady,
    retrievalValidationStatusLabel,
    retrievalValidationSummary,
    retrievalValidationTone,
    selectedConversation,
    selectedConversationId,
    selectedDocumentDetail,
    selectedDocumentId,
    selectedWorkflowRunDetail,
    selectedWorkflowRunId,
    sourceAdminSection,
    sourceOperationsLane,
    sourceSurface,
    sourceSurfaceHref,
    recommendedSurfaceRunRecord,
    t,
    buildWorkspaceAgentRunRecord,
    workflowMetrics.active_runs,
    workflowMetrics.failed_runs,
    workflowPage,
    workflowRetryMode,
    workflowSortOrder,
    workflowStatusFilter,
    workflowTypeFilter,
    workspaceView
  ]);

  const workspaceRuntimeRunbook = useMemo<WorkspaceRunbookItem[]>(() => {
    if (!bootstrap || !workspaceRuntimeTaskPacket) {
      return [];
    }

    const currentWorkspaceHref = buildWorkspaceHref({
      view: workspaceView,
      tenantId: bootstrap.tenant.id,
      workspaceId: bootstrap.workspace.id,
      knowledgeBaseId: bootstrap.knowledgeBase.id,
      agentId: activeAgentId,
      sourceSurface,
      sourceAdminSection,
      sourceOperationsLane,
      handoffIntent,
      conversationId: selectedConversationId,
      documentId: selectedDocumentId,
      workflowRunId: selectedWorkflowRunId,
      documentQuery,
      documentSource: documentSourceFilter,
      documentLifecycle: documentLifecycleFilter,
      documentStatus: documentStatusFilter,
      documentSort: documentSortOrder,
      documentPage,
      workflowQuery,
      workflowStatus: workflowStatusFilter,
      workflowType: workflowTypeFilter,
      workflowRetryMode,
      workflowSort: workflowSortOrder,
      workflowPage
    });
    const documentsHref = buildWorkspaceHref({
      view: "documents",
      tenantId: bootstrap.tenant.id,
      workspaceId: bootstrap.workspace.id,
      knowledgeBaseId: bootstrap.knowledgeBase.id,
      agentId: activeAgentId,
      sourceSurface,
      sourceAdminSection,
      sourceOperationsLane,
      handoffIntent: handoffIntent === "document_recovery" ? "document_recovery" : "agent_brief",
      documentId: selectedDocumentId ?? (selectedWorkflowRunDetail?.subject_type === "document" ? selectedWorkflowRunDetail.subject_id : null),
      documentSource: documentSourceFilter !== "all" ? documentSourceFilter : null,
      documentLifecycle: "active",
      documentStatus:
        handoffIntent === "document_recovery" || handoffIntent === "workflow_recovery"
          ? "failed"
          : null
    });
    const workflowsHref = buildWorkspaceHref({
      view: "workflows",
      tenantId: bootstrap.tenant.id,
      workspaceId: bootstrap.workspace.id,
      knowledgeBaseId: bootstrap.knowledgeBase.id,
      agentId: activeAgentId,
      sourceSurface,
      sourceAdminSection,
      sourceOperationsLane,
      handoffIntent:
        handoffIntent === "workflow_recovery"
          ? "workflow_recovery"
          : handoffIntent === "document_recovery"
            ? "document_recovery"
            : handoffIntent,
      workflowRunId: selectedWorkflowRunId,
      workflowStatus:
        handoffIntent === "workflow_recovery" && resolveWorkflowFollowUpStage(selectedWorkflowRunDetail?.workflow_status) === "recovery"
          ? "failed"
          : handoffIntent === "workflow_recovery" && resolveWorkflowFollowUpStage(selectedWorkflowRunDetail?.workflow_status) === "cancelled"
            ? "cancelled"
            : resolveWorkflowFollowUpStage(selectedWorkflowRunDetail?.workflow_status) === "monitoring"
            ? "running"
            : null
    });
    const chatHref = buildWorkspaceHref({
      view: "chat",
      tenantId: bootstrap.tenant.id,
      workspaceId: bootstrap.workspace.id,
      knowledgeBaseId: bootstrap.knowledgeBase.id,
      agentId: activeAgentId,
      sourceSurface,
      sourceAdminSection,
      sourceOperationsLane,
      handoffIntent:
        handoffIntent === "grounded_validation" ? "grounded_validation" : "agent_brief",
      conversationId: selectedConversationId,
      draftQuestion: question.trim() || null
    });
    const governanceHref = buildAdminHref({
      tenantId: bootstrap.tenant.id,
      section: activeAgentContext ? "directory" : "overview"
    });
    const sourceHref = sourceSurfaceHref ?? currentWorkspaceHref;
    const healthyLabel = t("workspace.runtimeTaskPacket.statuses.ready");
    const reviewLabel = t("workspace.runtimeTaskPacket.statuses.review");
    const attentionLabel = t("workspace.runtimeTaskPacket.statuses.attention");
    const validationPrimaryActionHref = retrievalValidationBlocksGroundedChat ? documentsHref : chatHref;
    const validationPrimaryActionRunRecord = retrievalValidationBlocksGroundedChat
      ? buildWorkspaceAgentRunRecord("documents", "grounded_validation")
      : buildWorkspaceAgentRunRecord("chat", "grounded_validation");
    const validationPrimaryActionLabel = retrievalValidationBlocksGroundedChat
      ? t("workspace.runtimeRunbook.actions.openDocuments")
      : t("workspace.runtimeRunbook.actions.openChat");

    if (!sourceSurface && !activeAgentContext && !handoffIntent) {
      const hasAnyDocuments = documentMetrics.total_documents > 0;
      const hasReadyKnowledge = documentMetrics.completed_documents > 0;
      const hasFailures =
        documentMetrics.failed_documents > 0 ||
        workflowMetrics.failed_runs > 0 ||
        workflowMetrics.cancelled_runs > 0;
      const hasActiveExecutions = documentMetrics.active_documents > 0 || workflowMetrics.active_runs > 0;
      const defaultValidationDetail = !hasReadyKnowledge
        ? t("workspace.runtimeRunbook.mainFlow.validatePendingDetail")
        : retrievalValidationReady
          ? t("workspace.runtimeRunbook.mainFlow.validateReadyDetail")
          : retrievalValidationNeedsReview
            ? t("workspace.runtimeRunbook.mainFlow.validateReviewDetail")
            : retrievalValidationBlocksGroundedChat
              ? t("workspace.runtimeRunbook.mainFlow.validateBlockedDetail")
              : t("workspace.runtimeRunbook.mainFlow.validateReadyDetail");
      const defaultValidationStatus = !hasReadyKnowledge
        ? ("review" as const)
        : retrievalValidationBlocksGroundedChat
          ? ("attention" as const)
          : retrievalValidationReady
            ? ("healthy" as const)
            : ("review" as const);
      const defaultValidationStatusLabel = !hasReadyKnowledge
        ? reviewLabel
        : retrievalValidationSummary
          ? retrievalValidationStatusLabel
          : healthyLabel;

      return [
        {
          title: t("workspace.runtimeRunbook.mainFlow.ingestTitle"),
          detail: t("workspace.runtimeRunbook.mainFlow.ingestDetail"),
          status: hasAnyDocuments ? ("healthy" as const) : ("review" as const),
          statusLabel: hasAnyDocuments ? healthyLabel : reviewLabel,
          metricLabel: t("workspace.runtimeRunbook.metrics.subject"),
          metricValue: String(documentMetrics.total_documents),
          primaryActionHref: documentsHref,
          primaryActionRunRecord: buildWorkspaceAgentRunRecord("documents", "agent_brief"),
          primaryActionLabel: t("workspace.runtimeRunbook.actions.openDocuments"),
          secondaryActions: [
            {
              label: t("workspace.runtimeRunbook.mainFlow.uploadFollowUp"),
              href: documentsHref,
              runRecord: buildWorkspaceAgentRunRecord("documents", "agent_brief")
            }
          ]
        },
        {
          title: t("workspace.runtimeRunbook.mainFlow.monitorTitle"),
          detail: hasFailures
            ? t("workspace.runtimeRunbook.mainFlow.monitorFailureDetail")
            : hasActiveExecutions
              ? t("workspace.runtimeRunbook.mainFlow.monitorActiveDetail")
              : t("workspace.runtimeRunbook.mainFlow.monitorHealthyDetail"),
          status: hasFailures ? ("attention" as const) : hasActiveExecutions ? ("review" as const) : ("healthy" as const),
          statusLabel: hasFailures ? attentionLabel : hasActiveExecutions ? reviewLabel : healthyLabel,
          metricLabel: t("workspace.runtimeRunbook.metrics.scope"),
          metricValue: `${workflowMetrics.failed_runs + workflowMetrics.cancelled_runs}/${workflowMetrics.active_runs}/${workflowMetrics.total_runs}`,
          primaryActionHref: workflowsHref,
          primaryActionRunRecord: buildWorkspaceAgentRunRecord("operations", "workflow_recovery"),
          primaryActionLabel: t("workspace.runtimeRunbook.actions.openWorkflowLane"),
          secondaryActions: [
            ...(documentMetrics.failed_documents > 0
              ? [
                  {
                    label: t("workspace.runtimeRunbook.mainFlow.reviewFailedDocuments"),
                    href: documentsHref,
                    runRecord: buildWorkspaceAgentRunRecord("documents", "document_recovery")
                  }
                ]
              : []),
            {
              label: t("workspace.runtimeRunbook.mainFlow.reviewExecutionQueue"),
              href: workflowsHref,
              runRecord: buildWorkspaceAgentRunRecord("operations", "workflow_recovery")
            }
          ]
        },
        {
          title: t("workspace.runtimeRunbook.mainFlow.validateTitle"),
          detail: defaultValidationDetail,
          status: defaultValidationStatus,
          statusLabel: defaultValidationStatusLabel,
          metricLabel: t("workspace.runtimeRunbook.metrics.validation"),
          metricValue: hasReadyKnowledge ? retrievalValidationStatusLabel : reviewLabel,
          primaryActionHref: hasReadyKnowledge ? validationPrimaryActionHref : chatHref,
          primaryActionRunRecord: hasReadyKnowledge
            ? validationPrimaryActionRunRecord
            : buildWorkspaceAgentRunRecord("chat", "grounded_validation"),
          primaryActionLabel: hasReadyKnowledge
            ? validationPrimaryActionLabel
            : t("workspace.runtimeRunbook.actions.openChat"),
          secondaryActions: [
            {
              label: t("workspace.runtimeRunbook.mainFlow.reviewReadySources"),
              href: documentsHref,
              runRecord: buildWorkspaceAgentRunRecord("documents", "grounded_validation")
            }
          ]
        }
      ].map((item) => withUniqueConsoleFollowUpActions(item));
    }

    if (handoffIntent === "workflow_recovery") {
      const selectedWorkflowStage = resolveWorkflowFollowUpStage(selectedWorkflowRunDetail?.workflow_status);
      return [
        {
          title: t("workspace.runtimeRunbook.workflowRecovery.stabilizeTitle"),
          detail: t("workspace.runtimeRunbook.workflowRecovery.stabilizeDetail"),
          status:
            selectedWorkflowStage === "recovery"
              ? ("attention" as const)
              : ("review" as const),
          statusLabel:
            selectedWorkflowStage === "recovery"
              ? attentionLabel
              : reviewLabel,
          metricLabel: t("workspace.runtimeRunbook.metrics.subject"),
          metricValue:
            selectedWorkflowRunDetail?.subject_label ??
            selectedWorkflowRunDetail?.id ??
            t("workspace.runtimeTaskPacket.pending"),
          primaryActionHref: workflowsHref,
          primaryActionRunRecord: buildWorkspaceAgentRunRecord("operations", "workflow_recovery"),
          primaryActionLabel: t("workspace.runtimeRunbook.actions.openWorkflowLane"),
          secondaryActions: [
            {
              label: t("workspace.runtimeRunbook.actions.openDocuments"),
              href: documentsHref,
              runRecord: buildWorkspaceAgentRunRecord("documents", "document_recovery")
            },
            {
              label: t("workspace.runtimeRunbook.actions.openGovernance"),
              href: governanceHref,
              runRecord: buildWorkspaceAgentRunRecord("admin", "workflow_recovery")
            }
          ]
        },
        {
          title: t("workspace.runtimeRunbook.workflowRecovery.inspectDocumentTitle"),
          detail: t("workspace.runtimeRunbook.workflowRecovery.inspectDocumentDetail"),
          status: selectedDocumentId ? ("review" as const) : ("attention" as const),
          statusLabel: selectedDocumentId ? reviewLabel : attentionLabel,
          metricLabel: t("workspace.runtimeRunbook.metrics.scope"),
          metricValue: `${bootstrap.workspace.name} / ${bootstrap.knowledgeBase.name}`,
          primaryActionHref: documentsHref,
          primaryActionRunRecord: buildWorkspaceAgentRunRecord("documents", "document_recovery"),
          primaryActionLabel: t("workspace.runtimeRunbook.actions.openDocuments"),
          secondaryActions: [
            {
              label: t("workspace.runtimeRunbook.actions.openWorkflowLane"),
              href: workflowsHref,
              runRecord: buildWorkspaceAgentRunRecord("operations", "workflow_recovery")
            }
          ]
        },
        {
          title: t("workspace.runtimeRunbook.workflowRecovery.closeLoopTitle"),
          detail:
            activeAgentRuntimeGovernance && !activeAgentRuntimeGovernance.is_ready
              ? activeAgentRuntimeIssueDetail ?? t("workspace.runtimeRunbook.workflowRecovery.closeLoopDetail")
              : t("workspace.runtimeRunbook.workflowRecovery.closeLoopDetail"),
          status:
            activeAgentRuntimeGovernance && !activeAgentRuntimeGovernance.is_ready
              ? ("attention" as const)
              : ("review" as const),
          statusLabel:
            activeAgentRuntimeGovernance && !activeAgentRuntimeGovernance.is_ready
              ? attentionLabel
              : reviewLabel,
          metricLabel: t("workspace.runtimeRunbook.metrics.owner"),
          metricValue:
            activeAgentRuntimeIssueLabel ??
            activeAgentContext?.name ??
            t("workspace.runtimeTaskPacket.pending"),
          primaryActionHref: governanceHref,
          primaryActionRunRecord: buildWorkspaceAgentRunRecord("admin", "workflow_recovery"),
          primaryActionLabel: t("workspace.runtimeRunbook.actions.openGovernance"),
          directActions:
            activeAgentRuntimeGovernance && !activeAgentRuntimeGovernance.is_ready && activeAgentRuntimeDirectActions.length > 0
              ? activeAgentRuntimeDirectActions
              : undefined,
          secondaryActions: [
            {
              label: t("workspace.runtimeRunbook.actions.returnToSource"),
              href: sourceHref,
              runRecord:
                sourceSurface === "admin"
                  ? buildWorkspaceAgentRunRecord("admin", "workflow_recovery")
                  : sourceSurface === "operations"
                    ? buildWorkspaceAgentRunRecord("operations", "workflow_recovery")
                    : null
            }
          ]
        }
      ].map((item) => withUniqueConsoleFollowUpActions(item));
    }

    if (handoffIntent === "document_recovery") {
      return [
        {
          title: t("workspace.runtimeRunbook.documentRecovery.inspectDocumentTitle"),
          detail: t("workspace.runtimeRunbook.documentRecovery.inspectDocumentDetail"),
          status: selectedDocumentDetail ? ("healthy" as const) : ("review" as const),
          statusLabel: selectedDocumentDetail ? healthyLabel : reviewLabel,
          metricLabel: t("workspace.runtimeRunbook.metrics.subject"),
          metricValue:
            selectedDocumentDetail?.document.title ??
            selectedWorkflowRunDetail?.subject_label ??
            t("workspace.runtimeTaskPacket.pending"),
          primaryActionHref: documentsHref,
          primaryActionRunRecord: buildWorkspaceAgentRunRecord("documents", "document_recovery"),
          primaryActionLabel: t("workspace.runtimeRunbook.actions.openDocuments"),
          secondaryActions: [
            {
              label: t("workspace.runtimeRunbook.actions.openWorkflowLane"),
              href: workflowsHref,
              runRecord: buildWorkspaceAgentRunRecord("operations", "workflow_recovery")
            }
          ]
        },
        {
          title: t("workspace.runtimeRunbook.documentRecovery.reviewLineageTitle"),
          detail: t("workspace.runtimeRunbook.documentRecovery.reviewLineageDetail"),
          status: selectedWorkflowRunId ? ("review" as const) : ("attention" as const),
          statusLabel: selectedWorkflowRunId ? reviewLabel : attentionLabel,
          metricLabel: t("workspace.runtimeRunbook.metrics.scope"),
          metricValue: `${bootstrap.workspace.name} / ${bootstrap.knowledgeBase.name}`,
          primaryActionHref: workflowsHref,
          primaryActionRunRecord: buildWorkspaceAgentRunRecord("operations", "workflow_recovery"),
          primaryActionLabel: t("workspace.runtimeRunbook.actions.openWorkflowLane"),
          secondaryActions: [
            {
              label: t("workspace.runtimeRunbook.actions.openGovernance"),
              href: governanceHref,
              runRecord: buildWorkspaceAgentRunRecord("admin", "document_recovery")
            }
          ]
        },
        {
          title: t("workspace.runtimeRunbook.documentRecovery.briefAgentTitle"),
          detail:
            activeAgentRuntimeGovernance && !activeAgentRuntimeGovernance.is_ready
              ? activeAgentRuntimeIssueDetail ?? t("workspace.runtimeRunbook.documentRecovery.briefAgentDetail")
              : t("workspace.runtimeRunbook.documentRecovery.briefAgentDetail"),
          status:
            activeAgentRuntimeGovernance && !activeAgentRuntimeGovernance.is_ready
              ? ("attention" as const)
              : activeAgentContext
                ? ("healthy" as const)
                : ("review" as const),
          statusLabel:
            activeAgentRuntimeGovernance && !activeAgentRuntimeGovernance.is_ready
              ? attentionLabel
              : activeAgentContext
                ? healthyLabel
                : reviewLabel,
          metricLabel: t("workspace.runtimeRunbook.metrics.owner"),
          metricValue:
            activeAgentRuntimeIssueLabel ??
            activeAgentContext?.name ??
            t("workspace.runtimeTaskPacket.pending"),
          primaryActionHref: chatHref,
          primaryActionRunRecord: buildWorkspaceAgentRunRecord("chat", "agent_brief"),
          primaryActionLabel: t("workspace.runtimeRunbook.actions.openChat"),
          directActions:
            activeAgentRuntimeGovernance && !activeAgentRuntimeGovernance.is_ready && activeAgentRuntimeDirectActions.length > 0
              ? activeAgentRuntimeDirectActions
              : undefined,
          secondaryActions: [
            {
              label: t("workspace.runtimeRunbook.actions.openAgent"),
              href: agentConsoleHref ?? governanceHref,
              runRecord: agentConsoleHref ? null : buildWorkspaceAgentRunRecord("admin", "document_recovery")
            }
          ]
        }
      ].map((item) => withUniqueConsoleFollowUpActions(item));
    }

    if (handoffIntent === "grounded_validation") {
      const validationRunbookDetail = retrievalValidationReady
        ? t("workspace.runtimeRunbook.groundedValidation.validateAnswerDetail")
        : retrievalValidationNeedsReview
          ? t("workspace.runtimeRunbook.groundedValidation.validateAnswerReviewDetail")
          : retrievalValidationBlocksGroundedChat
            ? t("workspace.runtimeRunbook.groundedValidation.validateAnswerBlockedDetail")
            : t("workspace.runtimeRunbook.groundedValidation.validateAnswerPendingDetail");
      const validationRunbookStatus = retrievalValidationReady
        ? ("healthy" as const)
        : retrievalValidationBlocksGroundedChat
          ? ("attention" as const)
          : ("review" as const);
      const validationCloseLoopDetail = retrievalValidationReady
        ? t("workspace.runtimeRunbook.groundedValidation.closeLoopDetail")
        : t("workspace.runtimeRunbook.groundedValidation.closeLoopPendingDetail");

      return [
        {
          title: t("workspace.runtimeRunbook.groundedValidation.validateAnswerTitle"),
          detail: validationRunbookDetail,
          status: validationRunbookStatus,
          statusLabel: retrievalValidationStatusLabel,
          metricLabel: t("workspace.runtimeRunbook.metrics.validation"),
          metricValue: retrievalValidationStatusLabel,
          primaryActionHref: validationPrimaryActionHref,
          primaryActionRunRecord: validationPrimaryActionRunRecord,
          primaryActionLabel: validationPrimaryActionLabel,
          secondaryActions: [
            {
              label: t("workspace.runtimeRunbook.actions.openDocuments"),
              href: documentsHref,
              runRecord: buildWorkspaceAgentRunRecord("documents", "grounded_validation")
            }
          ]
        },
        {
          title: t("workspace.runtimeRunbook.groundedValidation.inspectSourcesTitle"),
          detail: retrievalValidationBlocksGroundedChat
            ? t("workspace.runtimeRunbook.groundedValidation.inspectSourcesBlockedDetail")
            : t("workspace.runtimeRunbook.groundedValidation.inspectSourcesDetail"),
          status: retrievalValidationBlocksGroundedChat
            ? ("attention" as const)
            : selectedDocumentDetail
              ? ("healthy" as const)
              : ("review" as const),
          statusLabel: retrievalValidationBlocksGroundedChat
            ? attentionLabel
            : selectedDocumentDetail
              ? healthyLabel
              : reviewLabel,
          metricLabel: t("workspace.runtimeRunbook.metrics.scope"),
          metricValue: `${bootstrap.workspace.name} / ${bootstrap.knowledgeBase.name}`,
          primaryActionHref: documentsHref,
          primaryActionRunRecord: buildWorkspaceAgentRunRecord("documents", "grounded_validation"),
          primaryActionLabel: t("workspace.runtimeRunbook.actions.openDocuments"),
          secondaryActions: [
            {
              label: t("workspace.runtimeRunbook.actions.openWorkflowLane"),
              href: workflowsHref,
              runRecord: buildWorkspaceAgentRunRecord("operations", "workflow_recovery")
            }
          ]
        },
        {
          title: t("workspace.runtimeRunbook.groundedValidation.closeLoopTitle"),
          detail:
            activeAgentRuntimeGovernance && !activeAgentRuntimeGovernance.is_ready
              ? activeAgentRuntimeIssueDetail ?? validationCloseLoopDetail
              : validationCloseLoopDetail,
          status: retrievalValidationReady
            ? activeAgentRuntimeGovernance && !activeAgentRuntimeGovernance.is_ready
              ? ("attention" as const)
              : ("healthy" as const)
            : retrievalValidationBlocksGroundedChat
              ? ("attention" as const)
              : ("review" as const),
          statusLabel: retrievalValidationReady
            ? activeAgentRuntimeGovernance && !activeAgentRuntimeGovernance.is_ready
              ? attentionLabel
              : healthyLabel
            : retrievalValidationBlocksGroundedChat
              ? attentionLabel
              : reviewLabel,
          metricLabel: t("workspace.runtimeRunbook.metrics.owner"),
          metricValue:
            activeAgentRuntimeIssueLabel ??
            activeAgentContext?.name ??
            t("workspace.runtimeTaskPacket.pending"),
          primaryActionHref: retrievalValidationReady ? governanceHref : validationPrimaryActionHref,
          primaryActionRunRecord: retrievalValidationReady
            ? buildWorkspaceAgentRunRecord("admin", "grounded_validation")
            : validationPrimaryActionRunRecord,
          primaryActionLabel: retrievalValidationReady
            ? t("workspace.runtimeRunbook.actions.openGovernance")
            : validationPrimaryActionLabel,
          directActions:
            activeAgentRuntimeGovernance && !activeAgentRuntimeGovernance.is_ready && activeAgentRuntimeDirectActions.length > 0
              ? activeAgentRuntimeDirectActions
              : undefined,
          secondaryActions: [
            {
              label: t("workspace.runtimeRunbook.actions.returnToSource"),
              href: sourceHref,
              runRecord:
                sourceSurface === "admin"
                  ? buildWorkspaceAgentRunRecord("admin", "grounded_validation")
                  : sourceSurface === "operations"
                    ? buildWorkspaceAgentRunRecord("operations", "workflow_recovery")
                    : null
            }
          ]
        }
      ].map((item) => withUniqueConsoleFollowUpActions(item));
    }

    return [
      {
        title: t("workspace.runtimeRunbook.agentBrief.alignSurfaceTitle"),
        detail: t("workspace.runtimeRunbook.agentBrief.alignSurfaceDetail"),
        status: isCurrentSurfaceRecommended ? ("healthy" as const) : ("review" as const),
        statusLabel: isCurrentSurfaceRecommended ? healthyLabel : reviewLabel,
        metricLabel: t("workspace.runtimeRunbook.metrics.target"),
        metricValue: workspaceRuntimeTaskPacket.summaryItems[0]?.value ?? t("workspace.runtimeTaskPacket.pending"),
        primaryActionHref: recommendedSurfaceHref ?? currentWorkspaceHref,
        primaryActionRunRecord: recommendedSurfaceRunRecord,
        primaryActionLabel: t("workspace.runtimeRunbook.actions.openRecommended"),
        secondaryActions: [
          {
            label: t("workspace.runtimeRunbook.actions.returnToSource"),
            href: sourceHref,
            runRecord:
              sourceSurface === "admin"
                ? buildWorkspaceAgentRunRecord("admin")
                : sourceSurface === "operations"
                  ? buildWorkspaceAgentRunRecord(
                      "operations",
                      "agent_brief"
                    )
                  : null
          }
        ]
      },
      {
        title: t("workspace.runtimeRunbook.agentBrief.checkScopeTitle"),
        detail: t("workspace.runtimeRunbook.agentBrief.checkScopeDetail"),
        status: "review" as const,
        statusLabel: reviewLabel,
        metricLabel: t("workspace.runtimeRunbook.metrics.scope"),
        metricValue: `${bootstrap.workspace.name} / ${bootstrap.knowledgeBase.name}`,
        primaryActionHref: documentsHref,
        primaryActionRunRecord: buildWorkspaceAgentRunRecord("documents", "agent_brief"),
        primaryActionLabel: t("workspace.runtimeRunbook.actions.openDocuments"),
        secondaryActions: [
          {
            label: t("workspace.runtimeRunbook.actions.openChat"),
            href: chatHref,
            runRecord: buildWorkspaceAgentRunRecord("chat", "agent_brief")
          }
        ]
      },
      {
        title: t("workspace.runtimeRunbook.agentBrief.closeLoopTitle"),
        detail:
          activeAgentRuntimeGovernance && !activeAgentRuntimeGovernance.is_ready
            ? activeAgentRuntimeIssueDetail ?? t("workspace.runtimeRunbook.agentBrief.closeLoopDetail")
            : t("workspace.runtimeRunbook.agentBrief.closeLoopDetail"),
        status:
          activeAgentRuntimeGovernance && !activeAgentRuntimeGovernance.is_ready
            ? ("attention" as const)
            : activeAgentContext
              ? ("healthy" as const)
              : ("review" as const),
        statusLabel:
          activeAgentRuntimeGovernance && !activeAgentRuntimeGovernance.is_ready
            ? attentionLabel
            : activeAgentContext
              ? healthyLabel
              : reviewLabel,
        metricLabel: t("workspace.runtimeRunbook.metrics.owner"),
        metricValue:
          activeAgentRuntimeIssueLabel ??
          activeAgentContext?.name ??
          t("workspace.runtimeTaskPacket.pending"),
        primaryActionHref: agentConsoleHref ?? governanceHref,
        primaryActionRunRecord: agentConsoleHref ? null : buildWorkspaceAgentRunRecord("admin", "agent_brief"),
        primaryActionLabel: t("workspace.runtimeRunbook.actions.openAgent"),
        directActions:
          activeAgentRuntimeGovernance && !activeAgentRuntimeGovernance.is_ready && activeAgentRuntimeDirectActions.length > 0
            ? activeAgentRuntimeDirectActions
            : undefined,
        secondaryActions: [
          {
            label: t("workspace.runtimeRunbook.actions.openGovernance"),
            href: governanceHref,
            runRecord: buildWorkspaceAgentRunRecord("admin", "agent_brief")
          }
        ]
      }
    ].map((item) => withUniqueConsoleFollowUpActions(item));
  }, [
    activeAgentContext,
    activeAgentId,
    agentConsoleHref,
    bootstrap,
    conversationMetrics.total_messages,
    documentLifecycleFilter,
    documentMetrics.active_documents,
    documentMetrics.completed_documents,
    documentMetrics.failed_documents,
    documentMetrics.total_documents,
    documentPage,
    documentQuery,
    documentSortOrder,
    documentStatusFilter,
    handoffIntent,
    isCurrentSurfaceRecommended,
    question,
    recommendedSurfaceHref,
    retrievalValidationBlocksGroundedChat,
    retrievalValidationReady,
    retrievalValidationNeedsReview,
    retrievalValidationStatusLabel,
    retrievalValidationSummary,
    selectedConversation,
    selectedConversationId,
    selectedDocumentDetail,
    selectedDocumentId,
    selectedWorkflowRunDetail,
    selectedWorkflowRunId,
    sourceAdminSection,
    sourceOperationsLane,
    sourceSurface,
    sourceSurfaceHref,
    recommendedSurfaceRunRecord,
    t,
    buildWorkspaceAgentRunRecord,
    workflowPage,
    workflowMetrics.active_runs,
    workflowMetrics.failed_runs,
    workflowMetrics.total_runs,
    workflowQuery,
    workflowRetryMode,
    workflowSortOrder,
    workflowStatusFilter,
    workflowTypeFilter,
    workspaceRuntimeTaskPacket,
    workspaceView
  ]);

  useEffect(() => {
    if (isConversationEditorOpen) {
      return;
    }

    setConversationDraftTitle(selectedConversation?.title ?? "");
  }, [isConversationEditorOpen, selectedConversation]);

  useEffect(() => {
    setIsConversationEditorOpen(false);
  }, [selectedConversationId]);

  function replaceWorkspaceLocation(nextState: {
    view?: WorkspaceView | null;
    tenantId?: string | null;
    workspaceId?: string | null;
    knowledgeBaseId?: string | null;
    agentId?: string | null;
    sourceSurface?: WorkspaceSourceSurface | null;
    sourceAdminSection?: WorkspaceSourceAdminSection | null;
    sourceOperationsLane?: WorkspaceSourceOperationsLane | null;
    handoffIntent?: WorkspaceHandoffIntent | null;
    conversationId?: string | null;
    conversationQuery?: string | null;
    documentId?: string | null;
    workflowRunId?: string | null;
    documentQuery?: string | null;
    documentSource?: DocumentSourceFilter | null;
    documentLifecycle?: DocumentLifecycleFilter | null;
    documentStatus?: string | null;
    documentSort?: string | null;
    documentPage?: number | null;
    workflowQuery?: string | null;
    workflowStatus?: string | null;
    workflowType?: string | null;
    workflowRetryMode?: WorkflowRetryMode | null;
    workflowSort?: string | null;
    workflowPage?: number | null;
    pathnameOverride?: WorkspaceConsolePathname;
  }) {
    const nextUrl = new URL(window.location.href);
    if (nextState.pathnameOverride) {
      nextUrl.pathname = nextState.pathnameOverride;
    }
    applyWorkspaceSearchParams(nextUrl.searchParams, nextState);
    window.history.replaceState({}, "", nextUrl);
  }

  useEffect(() => {
    const nextLocationState = readWorkspaceLocationState(
      workspaceLocationSearch.length > 0 ? `?${workspaceLocationSearch}` : ""
    );
    initialLocationStateRef.current = nextLocationState;
    isApplyingDocumentLocationStateRef.current = true;
    isApplyingWorkflowLocationStateRef.current = true;
    setWorkspaceView(initialWorkspaceView);
    setActiveAgentId(nextLocationState.agentId);
    setSourceSurface(nextLocationState.sourceSurface);
    setSourceAdminSection(nextLocationState.sourceAdminSection);
    setSourceOperationsLane(nextLocationState.sourceOperationsLane);
    setHandoffIntent(nextLocationState.handoffIntent);
    if (nextLocationState.draftQuestion.trim().length > 0) {
      setQuestion(nextLocationState.draftQuestion);
    }
    setSelectedConversationId(nextLocationState.conversationId);
    setConversationSearchQuery(nextLocationState.conversationQuery);
    setDocumentQuery(nextLocationState.documentQuery);
    setDocumentSourceFilter(nextLocationState.documentSource as DocumentSourceFilter);
    setDocumentLifecycleFilter(nextLocationState.documentLifecycle as DocumentLifecycleFilter);
    setDocumentStatusFilter(nextLocationState.documentStatus);
    setDocumentSortOrder(nextLocationState.documentSort as DocumentSortOrder);
    setDocumentPage(nextLocationState.documentPage);
    setWorkflowQuery(nextLocationState.workflowQuery);
    setWorkflowStatusFilter(nextLocationState.workflowStatus);
    setWorkflowTypeFilter(nextLocationState.workflowType);
    setWorkflowSortOrder(nextLocationState.workflowSort as WorkflowSortOrder);
    setWorkflowPage(nextLocationState.workflowPage);
  }, [initialWorkspaceView, workspaceLocationSearch]);

  useEffect(() => {
    if (!bootstrap) {
      return;
    }

    if (
      !hasAppliedInitialTargetRef.current &&
      (initialLocationStateRef.current?.documentId || initialLocationStateRef.current?.workflowRunId)
    ) {
      return;
    }

    replaceWorkspaceLocation({
      view: workspaceView,
      tenantId: bootstrap.tenant.id,
      workspaceId: bootstrap.workspace.id,
      knowledgeBaseId: bootstrap.knowledgeBase.id,
      agentId: activeAgentId,
      sourceSurface,
      sourceAdminSection,
      sourceOperationsLane,
      handoffIntent,
      conversationId: workspaceView === "chat" ? selectedConversationId : null,
      conversationQuery:
        workspaceView === "chat" ? conversationSearchQuery : null,
      documentId: workspaceView === "documents" ? selectedDocumentId : null,
      workflowRunId:
        workspaceView === "workflows" ? selectedWorkflowRunId : null,
      documentQuery,
      documentSource: documentSourceFilter,
      documentLifecycle: documentLifecycleFilter,
      documentStatus: documentStatusFilter,
      documentSort: documentSortOrder,
      documentPage,
      workflowQuery,
      workflowStatus: workflowStatusFilter,
      workflowType: workflowTypeFilter,
      workflowRetryMode,
      workflowSort: workflowSortOrder,
      workflowPage,
      pathnameOverride: routePath === "/workspace" ? undefined : getWorkspacePathnameForView(workspaceView)
    });
  }, [
    bootstrap,
    activeAgentId,
    sourceSurface,
    sourceAdminSection,
    sourceOperationsLane,
    handoffIntent,
    workspaceView,
    selectedConversationId,
    conversationSearchQuery,
    selectedDocumentId,
    selectedWorkflowRunId,
    documentQuery,
    documentSourceFilter,
    documentLifecycleFilter,
    documentStatusFilter,
    documentSortOrder,
    documentPage,
    workflowQuery,
    workflowStatusFilter,
    workflowTypeFilter,
    workflowRetryMode,
    workflowSortOrder,
    workflowPage,
    routePath
  ]);

  useEffect(() => {
    if (routePath === "/workspace") {
      return;
    }

    const expectedPathname = getWorkspacePathnameForView(workspaceView);
    if (pathname !== expectedPathname) {
      router.replace(`${expectedPathname}${window.location.search}` as Route);
    }
  }, [pathname, routePath, router, workspaceView]);

  const refreshTenantAgentDefinitions = useCallback(async (tenantId: string) => {
    const agentDefinitions = await listTenantAgentDefinitions(tenantId);
    setTenantAgentDefinitions(agentDefinitions);
  }, []);

  useEffect(() => {
    if (!bootstrap) {
      setTenantAgentDefinitions([]);
      return;
    }

    const tenantId = bootstrap.tenant.id;
    let cancelled = false;

    async function loadTenantAgentsForCurrentScope() {
      try {
        const agentDefinitions = await listTenantAgentDefinitions(tenantId);
        if (!cancelled) {
          setTenantAgentDefinitions(agentDefinitions);
        }
      } catch {
        if (!cancelled) {
          setTenantAgentDefinitions([]);
        }
      }
    }

    void loadTenantAgentsForCurrentScope();

    return () => {
      cancelled = true;
    };
  }, [bootstrap]);

  const handleApplyWorkspaceRuntimeGovernanceAction = useCallback(
    async (action: { actionKey: RuntimeGovernanceQuickActionKey; resourceId: string }) => {
      if (!bootstrap || !canManageRuntimeGovernance) {
        return;
      }

      try {
        setActiveRuntimeGovernanceActionId(action.resourceId);
        setErrorMessage(null);
        const response = await applyRuntimeGovernanceQuickAction(action.resourceId, action.actionKey);
        const [nextMcpConnectors] = await Promise.all([
          listMcpConnectors(),
          refreshTenantAgentDefinitions(bootstrap.tenant.id),
        ]);
        setMcpConnectors(nextMcpConnectors);
        setStatusMessage(response.summary);
      } catch (error) {
        setErrorMessage(resolveOperatorErrorMessage(error, t("admin.runtimeQueue.actions.applyFailed")));
        setStatusMessage(t("admin.runtimeQueue.actions.applyFailed"));
      } finally {
        setActiveRuntimeGovernanceActionId(null);
      }
    },
    [bootstrap, canManageRuntimeGovernance, refreshTenantAgentDefinitions, t]
  );

  const documentPageCount = useMemo(
    () => Math.max(1, Math.ceil(documentTotalCount / DOCUMENT_PAGE_SIZE)),
    [documentTotalCount]
  );

  const workflowPageCount = useMemo(
    () => Math.max(1, Math.ceil(workflowTotalCount / WORKFLOW_PAGE_SIZE)),
    [workflowTotalCount]
  );

  const selectedWorkflowParentRun = useMemo(() => {
    if (!selectedWorkflowRunDetail?.retry_of_workflow_run_id) {
      return null;
    }

    return selectedWorkflowLineageRuns.find((workflowRun) => workflowRun.id === selectedWorkflowRunDetail.retry_of_workflow_run_id) ?? null;
  }, [selectedWorkflowLineageRuns, selectedWorkflowRunDetail]);

  const selectedWorkflowChildRuns = useMemo(() => {
    if (!selectedWorkflowRunId) {
      return [];
    }

    return selectedWorkflowLineageRuns.filter((workflowRun) => workflowRun.retry_of_workflow_run_id === selectedWorkflowRunId);
  }, [selectedWorkflowLineageRuns, selectedWorkflowRunId]);

  const latestUserMessage = useMemo(
    () => [...messages].reverse().find((message) => message.role === "user") ?? null,
    [messages]
  );

  const workspaceRetrievalSuggestions = useMemo(() => {
    const suggestions: Array<{ key: string; label: string; query: string }> = [];

    if (question.trim().length > 0) {
      suggestions.push({
        key: "composer",
        label: t("workspace.retrievalInspector.suggestions.composer"),
        query: question.trim()
      });
    }

    if (latestUserMessage?.content.trim().length) {
      suggestions.push({
        key: "latest-user-message",
        label: t("workspace.retrievalInspector.suggestions.latestUserQuestion"),
        query: latestUserMessage.content.trim()
      });
    }

    if (selectedDocumentDetail?.document.title.trim().length) {
      suggestions.push({
        key: "selected-document",
        label: t("workspace.retrievalInspector.suggestions.selectedDocument"),
        query: selectedDocumentDetail.document.title.trim()
      });
    }

    if (activeAgentContext?.objective.trim().length) {
      suggestions.push({
        key: "agent-objective",
        label: t("workspace.retrievalInspector.suggestions.agentObjective"),
        query: activeAgentContext.objective.trim()
      });
    }

    return suggestions;
  }, [activeAgentContext?.objective, latestUserMessage?.content, question, selectedDocumentDetail?.document.title, t]);

  useEffect(() => {
    setRetrievalValidationSummary(null);
  }, [bootstrap?.tenant.id, bootstrap?.workspace.id, bootstrap?.knowledgeBase.id]);

  const isRetryAvailable = useMemo(
    () => Boolean(selectedWorkflowRunDetail?.is_retry_available),
    [selectedWorkflowRunDetail]
  );

  const selectedDocumentRecord = useMemo(
    () =>
      documents.find((document) => document.id === selectedDocumentId) ??
      selectedDocumentDetail?.document ??
      null,
    [documents, selectedDocumentDetail, selectedDocumentId]
  );
  const isSelectedDocumentDeleted = Boolean(selectedDocumentRecord?.is_deleted);

  const selectedDocumentRecommendedAgents = useMemo(() => {
    if (!bootstrap || !selectedDocumentDetail || selectedDocumentDetail.document.is_deleted) {
      return [];
    }

    return buildWorkspaceAgentRecommendations({
      activeAgentId,
      agents: tenantAgentDefinitions,
      context: {
        type: "document",
        bootstrap,
        detail: selectedDocumentDetail,
        relatedWorkflowRuns: selectedDocumentWorkflowRuns,
      },
    });
  }, [activeAgentId, bootstrap, selectedDocumentDetail, selectedDocumentWorkflowRuns, tenantAgentDefinitions]);

  const selectedWorkflowRecommendedAgents = useMemo(() => {
    if (!bootstrap || !selectedWorkflowRunDetail) {
      return [];
    }

    return buildWorkspaceAgentRecommendations({
      activeAgentId,
      agents: tenantAgentDefinitions,
      context: {
        type: "workflow",
        bootstrap,
        detail: selectedWorkflowRunDetail,
      },
    });
  }, [activeAgentId, bootstrap, selectedWorkflowRunDetail, tenantAgentDefinitions]);

  async function resolveDocumentDetail(
    documentId: string | null,
    knowledgeBaseId: string,
    documentVersionId?: string | null,
    includeDeleted = false
  ) {
    if (!documentId) {
      setSelectedDocumentDetail(null);
      return;
    }

    const detail = await loadDocumentDetailItem(knowledgeBaseId, documentId, documentVersionId, includeDeleted);
    setSelectedDocumentDetail(detail);
  }

  async function resolveWorkflowRunDetail(workflowRunId: string | null, tenantId: string) {
    if (!workflowRunId) {
      setSelectedWorkflowRunDetail(null);
      return;
    }

    const detail = await loadWorkflowRunDetailItem(tenantId, workflowRunId);
    setSelectedWorkflowRunDetail(detail);
  }

  function applyWorkspaceOperationsState(operations: Awaited<ReturnType<typeof loadWorkspaceOperations>>) {
    setDocuments(operations.documentItems);
    setDocumentTotalCount(operations.documentTotalCount);
    setDocumentMetrics(operations.documentMetrics);
    setWorkflowRuns(operations.workflowItems);
    setWorkflowTotalCount(operations.workflowTotalCount);
    setWorkflowMetrics(operations.workflowMetrics);
    setHasLoadedWorkspaceOperations(true);
    setSelectedDocumentId((currentId) =>
      currentId && operations.documentItems.some((item) => item.id === currentId)
        ? currentId
        : null
    );
    setSelectedWorkflowRunId((currentId) =>
      currentId && operations.workflowItems.some((item) => item.id === currentId)
        ? currentId
        : operations.workflowItems[0]?.id ?? null
    );
    setSelectedDocumentIds((currentIds) => currentIds.filter((documentId) => operations.documentItems.some((item) => item.id === documentId)));
  }

  async function hydrateWorkspace(
    resources: BootstrapState,
    options?: {
      preferredConversationId?: string | null;
      preferredConversationQuery?: string;
      preferredDocumentPage?: number;
      preferredWorkflowPage?: number;
    }
  ) {
    setBootstrap(resources);
    setSelectedConversationId(null);
    setIsConversationEditorOpen(false);
    setConversationDraftTitle("");
    setSelectedDocumentId(null);
    setSelectedDocumentIds([]);
    setSelectedWorkflowRunId(null);
    setSelectedDocumentDetail(null);
    setSelectedDocumentWorkflowRuns([]);
    setSelectedWorkflowRunDetail(null);
    setSelectedWorkflowLineageRuns([]);
    setDocuments([]);
    setDocumentTotalCount(0);
    setDocumentMetrics(EMPTY_DOCUMENT_METRICS);
    setWorkflowRuns([]);
    setWorkflowTotalCount(0);
    setWorkflowMetrics(EMPTY_WORKFLOW_METRICS);
    setConversationMetrics(EMPTY_CONVERSATION_METRICS);
    setMessageFeedbackSummary(null);
    setHasLoadedWorkspaceOperations(false);
    setDocumentPage(options?.preferredDocumentPage ?? 1);
    setWorkflowPage(options?.preferredWorkflowPage ?? 1);
    setMessages([]);
    setConversationSearchQuery(options?.preferredConversationQuery ?? "");
    setUploadFiles([]);

    const conversationSearchParams = new URLSearchParams({
      tenant_id: resources.tenant.id,
      workspace_id: resources.workspace.id,
      limit: String(CONVERSATION_PAGE_SIZE)
    });
    const normalizedPreferredConversationQuery = options?.preferredConversationQuery?.trim() ?? "";
    if (normalizedPreferredConversationQuery) {
      conversationSearchParams.set("query", normalizedPreferredConversationQuery);
    }

    const [conversationItems, nextConversationMetrics] = await Promise.all([
      apiRequest<Conversation[]>(`/chat/conversations?${conversationSearchParams.toString()}`),
      loadConversationMetrics(resources.tenant.id, resources.workspace.id),
    ]);

    setConversations(conversationItems);
    setHasMoreConversations(conversationItems.length === CONVERSATION_PAGE_SIZE);
    setConversationMetrics(nextConversationMetrics);
    const nextConversationId =
      options?.preferredConversationId && conversationItems.some((item) => item.id === options.preferredConversationId)
        ? options.preferredConversationId
        : null;

    setSelectedConversationId(nextConversationId);

    setStatusMessage(
      conversationItems.length > 0
        ? t("workspace.status.readyForKnowledgeBase", { name: resources.knowledgeBase.name })
        : t("workspace.status.contextSwitched", { name: resources.knowledgeBase.name })
    );
  }

  async function switchWorkspaceContext(nextSelection: WorkspaceSelection) {
    if (!bootstrap) {
      return;
    }

    const nextTenantId = nextSelection.tenantId ?? bootstrap.tenant.id;
    const nextWorkspaceId = nextSelection.workspaceId;
    const nextKnowledgeBaseId = nextSelection.knowledgeBaseId;

    if (
      nextTenantId === bootstrap.tenant.id &&
      (nextWorkspaceId === undefined || nextWorkspaceId === bootstrap.workspace.id) &&
      (nextKnowledgeBaseId === undefined || nextKnowledgeBaseId === bootstrap.knowledgeBase.id)
    ) {
      return;
    }

    try {
      setIsSwitchingContext(true);
      setErrorMessage(null);
      setStatusMessage(t("workspace.status.switchingContext"));

      const tenants =
        catalog.tenants.length > 0
          ? catalog.tenants
          : cachedTenantsRef.current ?? (await listTenants());
      cachedTenantsRef.current = tenants;
      const tenant = tenants.find((item) => item.id === nextTenantId);
      if (!tenant) {
        throw new Error(t("workspace.errors.selectedTenantNotResolved"));
      }

      const workspaces =
        cachedWorkspacesByTenantIdRef.current[tenant.id] ?? (await listWorkspaces(tenant.id));
      cachedWorkspacesByTenantIdRef.current[tenant.id] = workspaces;
      const workspace =
        workspaces.find((item) => item.id === nextWorkspaceId) ??
        (tenant.id === bootstrap.tenant.id ? workspaces.find((item) => item.id === bootstrap.workspace.id) : null) ??
        workspaces[0];
      if (!workspace) {
        throw new Error(t("workspace.errors.selectedTenantNoWorkspaces"));
      }

      const knowledgeBases =
        cachedKnowledgeBasesByWorkspaceIdRef.current[workspace.id] ??
        (await listKnowledgeBases(workspace.id));
      cachedKnowledgeBasesByWorkspaceIdRef.current[workspace.id] = knowledgeBases;
      const knowledgeBase =
        knowledgeBases.find((item) => item.id === nextKnowledgeBaseId) ??
        (workspace.id === bootstrap.workspace.id
          ? knowledgeBases.find((item) => item.id === bootstrap.knowledgeBase.id)
          : null) ??
        knowledgeBases[0];
      if (!knowledgeBase) {
        throw new Error(t("workspace.errors.selectedWorkspaceNoKnowledgeBases"));
      }

      setCatalog({
        tenants,
        workspaces,
        knowledgeBases
      });

        await hydrateWorkspace(
          {
            tenant,
            workspace,
            knowledgeBase
          },
          {
            preferredConversationId: initialLocationStateRef.current?.conversationId ?? null,
            preferredConversationQuery: initialLocationStateRef.current?.conversationQuery ?? "",
            preferredDocumentPage: initialLocationStateRef.current?.documentPage,
            preferredWorkflowPage: initialLocationStateRef.current?.workflowPage
          }
        );
        writeCurrentTenantId(tenant.id);
    } catch (error) {
      setErrorMessage(resolveOperatorErrorMessage(error, t("workspace.status.contextSwitchFailed")));
      setStatusMessage(t("workspace.status.contextSwitchFailed"));
    } finally {
      setIsSwitchingContext(false);
    }
  }

  async function handleCreateTenant() {
    if (!canManageAdminResources || isCreatingContext) {
      return;
    }

    const name = newTenantName.trim();
    const slug = newTenantSlug.trim();
    if (!name || !slug) {
      setErrorMessage(t("workspace.errors.tenantNameSlugRequired"));
      return;
    }

    try {
      setIsCreatingContext(true);
      setErrorMessage(null);
      setStatusMessage(t("workspace.status.creatingTenant"));

      const tenant = await apiRequest<Tenant>("/tenants", {
        method: "POST",
        body: JSON.stringify({
          name,
          slug
        })
      });

      const tenants = [...catalog.tenants.filter((item) => item.id !== tenant.id), tenant].sort((left, right) =>
        left.name.localeCompare(right.name)
      );
      setCatalog({
        tenants,
        workspaces: [],
        knowledgeBases: []
      });
      setNewTenantName("");
      setNewTenantSlug("");
      setManagementPanel(null);
      setStatusMessage(t("workspace.status.tenantCreated", { name: tenant.name }));
      await switchWorkspaceContext({ tenantId: tenant.id });
    } catch (error) {
      setErrorMessage(resolveOperatorErrorMessage(error, t("workspace.status.tenantCreationFailed")));
      setStatusMessage(t("workspace.status.tenantCreationFailed"));
    } finally {
      setIsCreatingContext(false);
    }
  }

  async function handleCreateWorkspace() {
    if (!canManageAdminResources || !bootstrap || isCreatingContext) {
      return;
    }

    const name = newWorkspaceName.trim();
    const slug = newWorkspaceSlug.trim();
    const description = newWorkspaceDescription.trim();
    if (!name || !slug) {
      setErrorMessage(t("workspace.errors.workspaceNameSlugRequired"));
      return;
    }

    try {
      setIsCreatingContext(true);
      setErrorMessage(null);
      setStatusMessage(t("workspace.status.creatingWorkspace"));

      const workspace = await apiRequest<Workspace>("/workspaces", {
        method: "POST",
        body: JSON.stringify({
          tenant_id: bootstrap.tenant.id,
          name,
          slug,
          description: description || null
        })
      });

      const workspaces = [...catalog.workspaces.filter((item) => item.id !== workspace.id), workspace].sort((left, right) =>
        left.name.localeCompare(right.name)
      );
      setCatalog({
        tenants: catalog.tenants,
        workspaces,
        knowledgeBases: []
      });
      setNewWorkspaceName("");
      setNewWorkspaceSlug("");
      setNewWorkspaceDescription("");
      setManagementPanel(null);
      setStatusMessage(t("workspace.status.workspaceCreated", { name: workspace.name }));
      await switchWorkspaceContext({
        tenantId: bootstrap.tenant.id,
        workspaceId: workspace.id
      });
    } catch (error) {
      setErrorMessage(resolveOperatorErrorMessage(error, t("workspace.status.workspaceCreationFailed")));
      setStatusMessage(t("workspace.status.workspaceCreationFailed"));
    } finally {
      setIsCreatingContext(false);
    }
  }

  async function handleCreateKnowledgeBase() {
    if (!canManageAdminResources || !bootstrap || isCreatingContext) {
      return;
    }

    const name = newKnowledgeBaseName.trim();
    const slug = newKnowledgeBaseSlug.trim();
    const description = newKnowledgeBaseDescription.trim();
    if (!name || !slug) {
      setErrorMessage(t("workspace.errors.knowledgeBaseNameSlugRequired"));
      return;
    }

    try {
      setIsCreatingContext(true);
      setErrorMessage(null);
      setStatusMessage(t("workspace.status.creatingKnowledgeBase"));

      const knowledgeBase = await apiRequest<KnowledgeBase>("/knowledge-bases", {
        method: "POST",
        body: JSON.stringify({
          tenant_id: bootstrap.tenant.id,
          workspace_id: bootstrap.workspace.id,
          name,
          slug,
          description: description || null,
          retrieval_profile_id: newKnowledgeBaseRetrievalProfileId || null
        })
      });

      const knowledgeBases = [
        ...catalog.knowledgeBases.filter((item) => item.id !== knowledgeBase.id),
        knowledgeBase
      ].sort((left, right) => left.name.localeCompare(right.name));
      setCatalog({
        tenants: catalog.tenants,
        workspaces: catalog.workspaces,
        knowledgeBases
      });
      setNewKnowledgeBaseName("");
      setNewKnowledgeBaseSlug("");
      setNewKnowledgeBaseDescription("");
      setNewKnowledgeBaseRetrievalProfileId("");
      setManagementPanel(null);
      setStatusMessage(t("workspace.status.knowledgeBaseCreated", { name: knowledgeBase.name }));
      await switchWorkspaceContext({
        tenantId: bootstrap.tenant.id,
        workspaceId: bootstrap.workspace.id,
        knowledgeBaseId: knowledgeBase.id
      });
    } catch (error) {
      setErrorMessage(resolveOperatorErrorMessage(error, t("workspace.status.knowledgeBaseCreationFailed")));
      setStatusMessage(t("workspace.status.knowledgeBaseCreationFailed"));
    } finally {
      setIsCreatingContext(false);
    }
  }

  function openTenantEditPanel() {
    if (!bootstrap) {
      return;
    }
    setEditTenantName(bootstrap.tenant.name);
    setEditTenantSlug(bootstrap.tenant.slug);
    setManagementPanel("tenant-edit");
  }

  function openWorkspaceEditPanel() {
    if (!bootstrap) {
      return;
    }
    setEditWorkspaceName(bootstrap.workspace.name);
    setEditWorkspaceSlug(bootstrap.workspace.slug);
    setEditWorkspaceDescription(bootstrap.workspace.description ?? "");
    setManagementPanel("workspace-edit");
  }

  function openKnowledgeBaseEditPanel() {
    if (!bootstrap) {
      return;
    }
    setEditKnowledgeBaseName(bootstrap.knowledgeBase.name);
    setEditKnowledgeBaseSlug(bootstrap.knowledgeBase.slug);
    setEditKnowledgeBaseDescription(bootstrap.knowledgeBase.description ?? "");
    setEditKnowledgeBaseRetrievalProfileId(bootstrap.knowledgeBase.retrieval_profile_id ?? "");
    setManagementPanel("knowledge-base-edit");
  }

  function openKnowledgeBaseCreatePanel() {
    setNewKnowledgeBaseName("");
    setNewKnowledgeBaseSlug("");
    setNewKnowledgeBaseDescription("");
    setNewKnowledgeBaseRetrievalProfileId(
      retrievalProfiles.find((item) => item.is_default)?.id ?? retrievalProfiles[0]?.id ?? ""
    );
    setManagementPanel("knowledge-base-create");
  }

  async function handleUpdateTenant() {
    if (!canManageAdminResources || !bootstrap || isUpdatingContext) {
      return;
    }

    const name = editTenantName.trim();
    const slug = editTenantSlug.trim();
    if (!name || !slug) {
      setErrorMessage(t("workspace.errors.tenantNameSlugRequired"));
      return;
    }

    try {
      setIsUpdatingContext(true);
      setErrorMessage(null);
      setStatusMessage(t("workspace.status.updatingTenant"));

      const tenant = await apiRequest<Tenant>(`/tenants/${bootstrap.tenant.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name,
          slug
        })
      });

      const tenants = catalog.tenants.map((item) => (item.id === tenant.id ? tenant : item));
      setCatalog({
        tenants,
        workspaces: catalog.workspaces,
        knowledgeBases: catalog.knowledgeBases
      });
      setBootstrap({
        tenant,
        workspace: bootstrap.workspace,
        knowledgeBase: bootstrap.knowledgeBase
      });
      setManagementPanel(null);
      setStatusMessage(t("workspace.status.tenantUpdated", { name: tenant.name }));
    } catch (error) {
      setErrorMessage(resolveOperatorErrorMessage(error, t("workspace.status.tenantUpdateFailed")));
      setStatusMessage(t("workspace.status.tenantUpdateFailed"));
    } finally {
      setIsUpdatingContext(false);
    }
  }

  async function handleUpdateWorkspace() {
    if (!canManageAdminResources || !bootstrap || isUpdatingContext) {
      return;
    }

    const name = editWorkspaceName.trim();
    const slug = editWorkspaceSlug.trim();
    const description = editWorkspaceDescription.trim();
    if (!name || !slug) {
      setErrorMessage(t("workspace.errors.workspaceNameSlugRequired"));
      return;
    }

    try {
      setIsUpdatingContext(true);
      setErrorMessage(null);
      setStatusMessage(t("workspace.status.updatingWorkspace"));

      const workspace = await apiRequest<Workspace>(`/workspaces/${bootstrap.workspace.id}?tenant_id=${bootstrap.tenant.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name,
          slug,
          description: description || null
        })
      });

      const workspaces = catalog.workspaces.map((item) => (item.id === workspace.id ? workspace : item));
      setCatalog({
        tenants: catalog.tenants,
        workspaces,
        knowledgeBases: catalog.knowledgeBases
      });
      setBootstrap({
        tenant: bootstrap.tenant,
        workspace,
        knowledgeBase: bootstrap.knowledgeBase
      });
      setManagementPanel(null);
      setStatusMessage(t("workspace.status.workspaceUpdated", { name: workspace.name }));
    } catch (error) {
      setErrorMessage(resolveOperatorErrorMessage(error, t("workspace.status.workspaceUpdateFailed")));
      setStatusMessage(t("workspace.status.workspaceUpdateFailed"));
    } finally {
      setIsUpdatingContext(false);
    }
  }

  async function handleUpdateKnowledgeBase() {
    if (!canManageAdminResources || !bootstrap || isUpdatingContext) {
      return;
    }

    const name = editKnowledgeBaseName.trim();
    const slug = editKnowledgeBaseSlug.trim();
    const description = editKnowledgeBaseDescription.trim();
    if (!name || !slug) {
      setErrorMessage(t("workspace.errors.knowledgeBaseNameSlugRequired"));
      return;
    }

    try {
      setIsUpdatingContext(true);
      setErrorMessage(null);
      setStatusMessage(t("workspace.status.updatingKnowledgeBase"));

      const knowledgeBase = await apiRequest<KnowledgeBase>(
        `/knowledge-bases/${bootstrap.knowledgeBase.id}?workspace_id=${bootstrap.workspace.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            name,
            slug,
            description: description || null,
            retrieval_profile_id: editKnowledgeBaseRetrievalProfileId || null
          })
        }
      );

      const knowledgeBases = catalog.knowledgeBases.map((item) => (item.id === knowledgeBase.id ? knowledgeBase : item));
      setCatalog({
        tenants: catalog.tenants,
        workspaces: catalog.workspaces,
        knowledgeBases
      });
      setBootstrap({
        tenant: bootstrap.tenant,
        workspace: bootstrap.workspace,
        knowledgeBase
      });
      setManagementPanel(null);
      setStatusMessage(t("workspace.status.knowledgeBaseUpdated", { name: knowledgeBase.name }));
    } catch (error) {
      setErrorMessage(resolveOperatorErrorMessage(error, t("workspace.status.knowledgeBaseUpdateFailed")));
      setStatusMessage(t("workspace.status.knowledgeBaseUpdateFailed"));
    } finally {
      setIsUpdatingContext(false);
    }
  }

  async function handleToggleWorkspaceArchiveState() {
    if (!canManageAdminResources || !bootstrap || isRunningContextLifecycleAction) {
      return;
    }

    const nextArchivedState = !bootstrap.workspace.is_archived;

    try {
      setIsRunningContextLifecycleAction(true);
      setErrorMessage(null);
      setStatusMessage(
        nextArchivedState ? t("workspace.status.archivingWorkspace") : t("workspace.status.restoringWorkspace")
      );

      const workspace = await apiRequest<Workspace>(
        `/workspaces/${bootstrap.workspace.id}/lifecycle?tenant_id=${bootstrap.tenant.id}`,
        {
          method: "POST",
          body: JSON.stringify({
            is_archived: nextArchivedState
          })
        }
      );

      const workspaces = catalog.workspaces.map((item) => (item.id === workspace.id ? workspace : item));
      setCatalog({
        tenants: catalog.tenants,
        workspaces,
        knowledgeBases: catalog.knowledgeBases
      });
      setBootstrap({
        tenant: bootstrap.tenant,
        workspace,
        knowledgeBase: bootstrap.knowledgeBase
      });
      setStatusMessage(
        nextArchivedState
          ? t("workspace.status.workspaceArchived", { name: workspace.name })
          : t("workspace.status.workspaceRestored", { name: workspace.name })
      );
    } catch (error) {
      setErrorMessage(resolveOperatorErrorMessage(error, t("workspace.status.workspaceLifecycleUpdateFailed")));
      setStatusMessage(t("workspace.status.workspaceLifecycleUpdateFailed"));
    } finally {
      setIsRunningContextLifecycleAction(false);
    }
  }

  async function handleToggleKnowledgeBasePublicationStatus() {
    if (!canManageAdminResources || !bootstrap || isRunningContextLifecycleAction) {
      return;
    }

    const nextPublicationStatus = bootstrap.knowledgeBase.publication_status === "published" ? "draft" : "published";

    try {
      setIsRunningContextLifecycleAction(true);
      setErrorMessage(null);
      setStatusMessage(
        nextPublicationStatus === "published"
          ? t("workspace.status.publishingKnowledgeBase")
          : t("workspace.status.movingKnowledgeBaseToDraft")
      );

      const knowledgeBase = await apiRequest<KnowledgeBase>(
        `/knowledge-bases/${bootstrap.knowledgeBase.id}/publication?workspace_id=${bootstrap.workspace.id}`,
        {
          method: "POST",
          body: JSON.stringify({
            publication_status: nextPublicationStatus
          })
        }
      );

      const knowledgeBases = catalog.knowledgeBases.map((item) => (item.id === knowledgeBase.id ? knowledgeBase : item));
      setCatalog({
        tenants: catalog.tenants,
        workspaces: catalog.workspaces,
        knowledgeBases
      });
      setBootstrap({
        tenant: bootstrap.tenant,
        workspace: bootstrap.workspace,
        knowledgeBase
      });
      setStatusMessage(
        nextPublicationStatus === "published"
          ? t("workspace.status.knowledgeBasePublished", { name: knowledgeBase.name })
          : t("workspace.status.knowledgeBaseMovedToDraft", { name: knowledgeBase.name })
      );
    } catch (error) {
      setErrorMessage(resolveOperatorErrorMessage(error, t("workspace.status.knowledgeBasePublicationUpdateFailed")));
      setStatusMessage(t("workspace.status.knowledgeBasePublicationUpdateFailed"));
    } finally {
      setIsRunningContextLifecycleAction(false);
    }
  }

  useEffect(() => {
    setSelectedDocumentId((currentId) =>
      currentId && documents.some((item) => item.id === currentId) ? currentId : null
    );
    setSelectedDocumentIds((currentIds) => currentIds.filter((documentId) => documents.some((item) => item.id === documentId)));
  }, [documents]);

  useEffect(() => {
    if (isApplyingDocumentLocationStateRef.current) {
      isApplyingDocumentLocationStateRef.current = false;
      return;
    }

    setDocumentPage(1);
  }, [documentQuery, documentSourceFilter, documentLifecycleFilter, documentSortOrder, documentStatusFilter]);

  useEffect(() => {
    if (isApplyingWorkflowLocationStateRef.current) {
      isApplyingWorkflowLocationStateRef.current = false;
      return;
    }

    setWorkflowPage(1);
  }, [workflowQuery, workflowSortOrder, workflowStatusFilter, workflowTypeFilter]);

  useEffect(() => {
    if (!hasLoadedWorkspaceOperations) {
      return;
    }

    if (documentPage > documentPageCount) {
      setDocumentPage(documentPageCount);
    }
  }, [documentPage, documentPageCount, hasLoadedWorkspaceOperations]);

  useEffect(() => {
    if (!hasLoadedWorkspaceOperations) {
      return;
    }

    if (workflowPage > workflowPageCount) {
      setWorkflowPage(workflowPageCount);
    }
  }, [hasLoadedWorkspaceOperations, workflowPage, workflowPageCount]);

  useEffect(() => {
    setSelectedWorkflowRunId((currentId) =>
      currentId && workflowRuns.some((item) => item.id === currentId) ? currentId : workflowRuns[0]?.id ?? null
    );
  }, [workflowRuns]);

  useEffect(() => {
    let cancelled = false;

    async function loadOperations() {
      if (!bootstrap) {
        return;
      }

      try {
        const operations = await loadWorkspaceOperations(bootstrap, {
          documentQuery: debouncedDocumentQuery,
          documentSourceFilter,
          documentLifecycleFilter,
          documentStatusFilter,
          documentSortOrder,
          documentPage,
          workflowQuery: debouncedWorkflowQuery,
          workflowStatusFilter,
          workflowTypeFilter,
          workflowRetryMode,
          workflowSortOrder,
          workflowPage
        });

        if (!cancelled) {
          applyWorkspaceOperationsState(operations);
          setErrorMessage(null);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(resolveOperatorErrorMessage(error, t("workspace.status.operationsLoadFailed")));
        }
      }
    }

    void loadOperations();

    return () => {
      cancelled = true;
    };
  }, [
    bootstrap,
    debouncedDocumentQuery,
    documentSourceFilter,
    documentLifecycleFilter,
    documentStatusFilter,
    documentSortOrder,
    documentPage,
    debouncedWorkflowQuery,
    workflowStatusFilter,
    workflowTypeFilter,
    workflowRetryMode,
    workflowSortOrder,
    workflowPage
  ]);

  useEffect(() => {
    let cancelled = false;

    async function bootstrapWorkspace() {
      try {
        setIsBootstrapping(true);
        setErrorMessage(null);
        const initialLocationState = initialLocationStateRef.current ?? readWorkspaceLocationState(window.location.search);
        initialLocationStateRef.current = initialLocationState;
        const { resources, catalog: bootstrapCatalog } = await ensureBootstrapResources({
          tenantId: initialLocationState.tenantId ?? undefined,
          workspaceId: initialLocationState.workspaceId ?? undefined,
          knowledgeBaseId: initialLocationState.knowledgeBaseId ?? undefined
        });
        if (cancelled) {
          return;
        }

        setCatalog(bootstrapCatalog);
        writeCurrentTenantId(resources.tenant.id);
        setStatusMessage(t("workspace.status.loadingConversations"));
        await hydrateWorkspace(resources, {
          preferredConversationId: initialLocationState.conversationId,
          preferredConversationQuery: initialLocationState.conversationQuery,
          preferredDocumentPage: initialLocationState.documentPage,
          preferredWorkflowPage: initialLocationState.workflowPage
        });
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(resolveOperatorErrorMessage(error, t("workspace.status.initializationFailed")));
          setStatusMessage(t("workspace.status.initializationFailed"));
        }
      } finally {
        if (!cancelled) {
          setIsBootstrapping(false);
        }
      }
    }

    void bootstrapWorkspace();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function applyInitialWorkspaceTarget() {
      if (!bootstrap || hasAppliedInitialTargetRef.current) {
        return;
      }

      const initialLocationState = initialLocationStateRef.current;
      if (!initialLocationState) {
        hasAppliedInitialTargetRef.current = true;
        return;
      }

      try {
        if (
          initialWorkspaceView === "documents" &&
          initialLocationState.documentId
        ) {
          hasAppliedInitialTargetRef.current = true;
          await handleSelectDocument(initialLocationState.documentId);
          if (!cancelled) {
            setWorkspaceView("documents");
          }
          return;
        }

        if (
          initialWorkspaceView === "workflows" &&
          initialLocationState.workflowRunId
        ) {
          hasAppliedInitialTargetRef.current = true;
          await handleSelectWorkflowRun(initialLocationState.workflowRunId);
          if (!cancelled) {
            setWorkspaceView("workflows");
          }
          return;
        }

        hasAppliedInitialTargetRef.current = true;
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(resolveOperatorErrorMessage(error, t("workspace.status.deepLinkApplyFailed")));
        }
      }
    }

    void applyInitialWorkspaceTarget();

    return () => {
      cancelled = true;
    };
  }, [bootstrap]);

  useEffect(() => {
    let cancelled = false;

    async function loadMessages() {
      if (!bootstrap || !selectedConversationId) {
        setMessages([]);
        return;
      }

      try {
        setIsLoadingMessages(true);
        const messageItems = await apiRequest<Message[]>(
          `/chat/messages?tenant_id=${bootstrap.tenant.id}&conversation_id=${selectedConversationId}`
        );
        if (!cancelled) {
          setMessages(messageItems);
          setErrorMessage(null);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(resolveOperatorErrorMessage(error, t("workspace.status.messagesLoadFailed")));
        }
      } finally {
        if (!cancelled) {
          setIsLoadingMessages(false);
        }
      }
    }

    void loadMessages();

    return () => {
      cancelled = true;
    };
  }, [bootstrap, selectedConversationId]);

  useEffect(() => {
    let cancelled = false;

    async function loadFeedbackSummary() {
      if (!bootstrap) {
        setMessageFeedbackSummary(null);
        setRetrievalEvaluationSummary(null);
        return;
      }

      try {
        const [summary, retrievalSummary] = await Promise.all([
          loadMessageFeedbackSummary(
            bootstrap.tenant.id,
            bootstrap.workspace.id,
            bootstrap.knowledgeBase.id
          ),
          loadRetrievalEvaluationSummary(
            bootstrap.tenant.id,
            bootstrap.workspace.id,
            bootstrap.knowledgeBase.id
          )
        ]);
        if (!cancelled) {
          setMessageFeedbackSummary(normalizeMessageFeedbackSummary(summary));
          setRetrievalEvaluationSummary(normalizeRetrievalEvaluationSummary(retrievalSummary));
        }
      } catch {
        if (!cancelled) {
          setMessageFeedbackSummary(null);
          setRetrievalEvaluationSummary(null);
        }
      }
    }

    void loadFeedbackSummary();

    return () => {
      cancelled = true;
    };
  }, [bootstrap]);

  useEffect(() => {
    let cancelled = false;

    async function loadDocumentDetail() {
      if (!bootstrap || !selectedDocumentId) {
        setSelectedDocumentDetail(null);
        return;
      }

      try {
        const detail = await apiRequest<DocumentDetail>(
          `/documents/${selectedDocumentId}?${new URLSearchParams({
            knowledge_base_id: bootstrap.knowledgeBase.id,
            include_deleted:
              documentLifecycleFilter !== "active" || isSelectedDocumentDeleted ? "true" : "false",
            ...(selectedDocumentVersionId ? { document_version_id: selectedDocumentVersionId } : {})
          }).toString()}`
        );
        if (!cancelled) {
          setSelectedDocumentDetail(detail);
          setErrorMessage(null);
        }
      } catch (error) {
        if (!cancelled) {
          setSelectedDocumentDetail(null);
          setErrorMessage(resolveOperatorErrorMessage(error, t("workspace.status.documentDetailLoadFailed")));
        }
      }
    }

    void loadDocumentDetail();

    return () => {
      cancelled = true;
    };
  }, [bootstrap, documentLifecycleFilter, isSelectedDocumentDeleted, selectedDocumentId, selectedDocumentVersionId]);

  useEffect(() => {
    let cancelled = false;

    async function loadSelectedDocumentWorkflowRuns() {
      if (!bootstrap || !selectedDocumentId) {
        setSelectedDocumentWorkflowRuns([]);
        return;
      }

      try {
        const relatedWorkflowRuns = await loadRelatedWorkflowRunItems(bootstrap.tenant.id, selectedDocumentId);
        if (!cancelled) {
          setSelectedDocumentWorkflowRuns(relatedWorkflowRuns);
          setErrorMessage(null);
        }
      } catch (error) {
        if (!cancelled) {
          setSelectedDocumentWorkflowRuns([]);
          setErrorMessage(resolveOperatorErrorMessage(error, t("workspace.status.relatedWorkflowRunsLoadFailed")));
        }
      }
    }

    void loadSelectedDocumentWorkflowRuns();

    return () => {
      cancelled = true;
    };
  }, [bootstrap, selectedDocumentId, workflowRuns]);

  useEffect(() => {
    if (!selectedDocumentId) {
      return;
    }

    const currentWorkflowMatchesSelectedDocument = selectedDocumentWorkflowRuns.some(
      (workflowRun) => workflowRun.id === selectedWorkflowRunId
    );

    if (currentWorkflowMatchesSelectedDocument) {
      return;
    }

    const nextSelectedWorkflowRunId = selectPreferredWorkflowRunId(selectedDocumentWorkflowRuns);
    if (nextSelectedWorkflowRunId !== selectedWorkflowRunId) {
      setSelectedWorkflowRunId(nextSelectedWorkflowRunId);
    }
  }, [selectedDocumentId, selectedDocumentWorkflowRuns, selectedWorkflowRunId]);

  useEffect(() => {
    let cancelled = false;

    async function loadWorkflowRunDetail() {
      if (!bootstrap || !selectedWorkflowRunId) {
        setSelectedWorkflowRunDetail(null);
        return;
      }

      try {
        const detail = await apiRequest<WorkflowRunDetail>(
          `/workflow-runs/${selectedWorkflowRunId}?tenant_id=${bootstrap.tenant.id}`
        );
        if (!cancelled) {
          setSelectedWorkflowRunDetail(detail);
          setErrorMessage(null);
        }
      } catch (error) {
        if (!cancelled) {
          setSelectedWorkflowRunDetail(null);
          setErrorMessage(resolveOperatorErrorMessage(error, t("workspace.status.workflowRunDetailLoadFailed")));
        }
      }
    }

    void loadWorkflowRunDetail();

    return () => {
      cancelled = true;
    };
  }, [bootstrap, selectedWorkflowRunId]);

  useEffect(() => {
    let cancelled = false;

    async function loadWorkflowLineageRuns() {
      if (!bootstrap || selectedWorkflowRunDetail?.subject_type !== "document" || !selectedWorkflowRunDetail.subject_id) {
        setSelectedWorkflowLineageRuns([]);
        return;
      }

      try {
        const relatedWorkflowRuns = await loadRelatedWorkflowRunItems(bootstrap.tenant.id, selectedWorkflowRunDetail.subject_id);
        if (!cancelled) {
          setSelectedWorkflowLineageRuns(relatedWorkflowRuns);
          setErrorMessage(null);
        }
      } catch (error) {
        if (!cancelled) {
          setSelectedWorkflowLineageRuns([]);
          setErrorMessage(resolveOperatorErrorMessage(error, t("workspace.status.workflowLineageLoadFailed")));
        }
      }
    }

    void loadWorkflowLineageRuns();

    return () => {
      cancelled = true;
    };
  }, [bootstrap, selectedWorkflowRunDetail, workflowRuns]);

  async function refreshConversations(preferredConversationId?: string) {
    if (!bootstrap) {
      return;
    }

    const searchParams = new URLSearchParams({
      tenant_id: bootstrap.tenant.id,
      workspace_id: bootstrap.workspace.id,
      limit: String(CONVERSATION_PAGE_SIZE),
    });
    const normalizedConversationQuery = debouncedConversationSearchQuery.trim();
    if (normalizedConversationQuery) {
      searchParams.set("query", normalizedConversationQuery);
    }

    const [conversationItems, nextConversationMetrics] = await Promise.all([
      apiRequest<Conversation[]>(`/chat/conversations?${searchParams.toString()}`),
      loadConversationMetrics(bootstrap.tenant.id, bootstrap.workspace.id),
    ]);
    setConversations(conversationItems);
    setHasMoreConversations(conversationItems.length === CONVERSATION_PAGE_SIZE);
    setConversationMetrics(nextConversationMetrics);

    setSelectedConversationId((currentConversationId) =>
      preferredConversationId && conversationItems.some((item) => item.id === preferredConversationId)
        ? preferredConversationId
        : currentConversationId && conversationItems.some((item) => item.id === currentConversationId)
          ? currentConversationId
          : null
    );
  }

  async function loadMoreConversations() {
    if (!bootstrap || isLoadingMoreConversations || !hasMoreConversations) return;
    try {
      setIsLoadingMoreConversations(true);
      const searchParams = new URLSearchParams({
        tenant_id: bootstrap.tenant.id,
        workspace_id: bootstrap.workspace.id,
        limit: String(CONVERSATION_PAGE_SIZE),
        offset: String(conversations.length),
      });
      const normalizedConversationQuery = debouncedConversationSearchQuery.trim();
      if (normalizedConversationQuery) searchParams.set("query", normalizedConversationQuery);
      const nextItems = await apiRequest<Conversation[]>(`/chat/conversations?${searchParams.toString()}`);
      setConversations((currentItems) => {
        const combined = [...currentItems, ...nextItems];
        return combined.filter((item, index) => combined.findIndex((candidate) => candidate.id === item.id) === index);
      });
      setHasMoreConversations(nextItems.length === CONVERSATION_PAGE_SIZE);
    } catch (error) {
      setErrorMessage(resolveOperatorErrorMessage(error, t("workspace.status.conversationsLoadMoreFailed")));
    } finally {
      setIsLoadingMoreConversations(false);
    }
  }

  useEffect(() => {
    if (!bootstrap) {
      return;
    }

    void refreshConversations();
  }, [bootstrap, debouncedConversationSearchQuery]);

  function handleSelectConversation(conversationId: string) {
    setIsConversationEditorOpen(false);
    setSelectedConversationId(conversationId);
  }

  function openConversationEditor(conversationId?: string) {
    const targetConversationId = conversationId ?? selectedConversationId;
    const targetConversation = conversations.find(
      (conversation) => conversation.id === targetConversationId,
    );
    if (!targetConversation) {
      return;
    }

    setSelectedConversationId(targetConversation.id);
    setConversationDraftTitle(targetConversation.title);
    setIsConversationEditorOpen(true);
  }

  function handleCancelConversationEditing() {
    setConversationDraftTitle(selectedConversation?.title ?? "");
    setIsConversationEditorOpen(false);
  }

  async function handleSaveConversationTitle() {
    if (!bootstrap || !selectedConversationId || isUpdatingConversationTitle) {
      return;
    }

    const title = conversationDraftTitle.trim();
    if (!title) {
      setErrorMessage(t("workspace.errors.conversationTitleRequired"));
      return;
    }

    try {
      setIsUpdatingConversationTitle(true);
      setErrorMessage(null);
      setStatusMessage(t("workspace.status.savingConversationTitle"));

      const updatedConversation = await apiRequest<Conversation>(
        `/chat/conversations/${selectedConversationId}?tenant_id=${bootstrap.tenant.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({ title })
        }
      );

      await refreshConversations(updatedConversation.id);
      setConversationDraftTitle(updatedConversation.title);
      setIsConversationEditorOpen(false);
      setStatusMessage(t("workspace.status.conversationRenamed", { title: updatedConversation.title }));
    } catch (error) {
      setErrorMessage(resolveOperatorErrorMessage(error, t("workspace.status.conversationRenameFailed")));
      setStatusMessage(t("workspace.status.conversationRenameFailed"));
    } finally {
      setIsUpdatingConversationTitle(false);
    }
  }

  function handleCreateConversation() {
    setSelectedConversationId(null);
    setMessages([]);
    setQuestion("");
    setIsConversationEditorOpen(false);
    setConversationDraftTitle("");
    setErrorMessage(null);
  }

  async function handleDeleteConversation(conversationId: string) {
    if (!bootstrap || !conversationId || isDeletingConversation) {
      return;
    }

    const conversationTitle =
      conversations.find((conversation) => conversation.id === conversationId)?.title ??
      t("workspace.headerBar.startConversationPlaceholder");

    try {
      setIsDeletingConversation(true);
      setErrorMessage(null);
      setStatusMessage(t("workspace.status.deletingConversation"));

      await apiRequest<void>(
        `/chat/conversations/${conversationId}?tenant_id=${bootstrap.tenant.id}`,
        {
          method: "DELETE",
        }
      );

      if (selectedConversationId === conversationId) {
        setSelectedConversationId(null);
        setMessages([]);
        setQuestion("");
        setIsConversationEditorOpen(false);
        setConversationDraftTitle("");
      }
      await refreshConversations();
      setStatusMessage(t("workspace.status.conversationDeleted", { title: conversationTitle }));
    } catch (error) {
      setErrorMessage(resolveOperatorErrorMessage(error, t("workspace.status.conversationDeletionFailed")));
      setStatusMessage(t("workspace.status.conversationDeletionFailed"));
    } finally {
      setIsDeletingConversation(false);
    }
  }

  async function refreshOperations() {
    if (!bootstrap) {
      return;
    }

    const operations = await loadWorkspaceOperations(bootstrap, {
      documentQuery: debouncedDocumentQuery,
      documentSourceFilter,
      documentLifecycleFilter,
      documentStatusFilter,
      documentSortOrder,
      documentPage,
      workflowQuery: debouncedWorkflowQuery,
      workflowStatusFilter,
      workflowTypeFilter,
      workflowRetryMode,
      workflowSortOrder,
      workflowPage
    });
    applyWorkspaceOperationsState(operations);
  }

  async function handleRefreshWorkspace() {
    if (!bootstrap || isBootstrapping || isSwitchingContext || isUpdatingContext || isRunningContextLifecycleAction) {
      return;
    }

    try {
      setErrorMessage(null);
      setStatusMessage(t("workspace.status.refreshingWorkspaceData"));
      await Promise.all([refreshConversations(), refreshOperations(), refreshMessageFeedbackSummary()]);
      setStatusMessage(t("workspace.status.workspaceDataRefreshed"));
    } catch (error) {
      setErrorMessage(resolveOperatorErrorMessage(error, t("workspace.status.workspaceRefreshFailed")));
      setStatusMessage(t("workspace.status.workspaceRefreshFailed"));
    }
  }

  async function handleSendQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!bootstrap || !canSendChatMessages || !question.trim() || isSending || isSwitchingContext || isUpdatingContext || isRunningContextLifecycleAction) {
      return;
    }

    const submittedQuestion = question.trim();
    const optimisticMessageId = `pending-${crypto.randomUUID()}`;
    const streamingAssistantId = `streaming-${crypto.randomUUID()}`;
    const optimisticMessage: Message = {
      id: optimisticMessageId,
      tenant_id: bootstrap.tenant.id,
      conversation_id: selectedConversationId ?? "",
      role: "user",
      content: submittedQuestion,
      model_name: null,
      usage_json: {},
      created_at: new Date().toISOString(),
      citations: [],
      feedback_entries: [],
    };
    const streamingAssistant: Message = {
      ...optimisticMessage,
      id: streamingAssistantId,
      role: "assistant",
      content: "",
      model_name: "streaming",
    };

    try {
      setIsSending(true);
      setErrorMessage(null);
      setStatusMessage(t("workspace.status.generatingGroundedReply"));
      setQuestion("");
      setMessages((currentMessages) =>
        selectedConversationId ? [...currentMessages, optimisticMessage, streamingAssistant] : [optimisticMessage, streamingAssistant]
      );

      const response = await streamChatQuestion(
        {
          tenant_id: bootstrap.tenant.id,
          workspace_id: bootstrap.workspace.id,
          knowledge_base_id: bootstrap.knowledgeBase.id,
          agent_definition_id: activeAgentContext?.id ?? null,
          conversation_id: selectedConversationId,
          question: submittedQuestion,
          top_k: 3
        },
        (content) => setMessages((currentMessages) => currentMessages.map((message) =>
          message.id === streamingAssistantId ? { ...message, content: `${message.content}${content}` } : message
        )),
      );

      setMessages((currentMessages) =>
        response.conversation.id === selectedConversationId
          ? [
              ...currentMessages.filter((message) => message.id !== optimisticMessageId && message.id !== streamingAssistantId),
              response.user_message,
              response.assistant_message,
            ]
          : [response.user_message, response.assistant_message]
      );
      setStatusMessage(
        activeAgentContext
          ? t("workspace.status.groundedAnswerReadyWithAgent", { name: activeAgentContext.name })
          : t("workspace.status.groundedAnswerReady")
      );
      void Promise.allSettled([
        refreshConversations(response.conversation.id),
        refreshOperations(),
      ]);
    } catch (error) {
      setMessages((currentMessages) =>
        currentMessages.filter((message) => message.id !== optimisticMessageId && message.id !== streamingAssistantId)
      );
      setQuestion(submittedQuestion);
      setErrorMessage(resolveOperatorErrorMessage(error, t("workspace.status.questionFailed")));
      setStatusMessage(t("workspace.status.questionFailed"));
    } finally {
      setIsSending(false);
    }
  }

  async function handleSubmitMessageFeedback(messageId: string, signal: "helpful" | "review") {
    if (
      !bootstrap ||
      !session?.userId ||
      messageFeedbackPendingId === messageId ||
      isSwitchingContext ||
      isUpdatingContext ||
      isRunningContextLifecycleAction
    ) {
      return;
    }

    try {
      setMessageFeedbackPendingId(messageId);
      setErrorMessage(null);

      const feedback = await submitMessageFeedbackItem({
        tenantId: bootstrap.tenant.id,
        messageId,
        answerQuality: signal === "helpful" ? "helpful" : "not_helpful",
        citationQuality: signal === "helpful" ? "grounded" : "partial",
        issueLabels: signal === "helpful" ? [] : ["answer_quality_review"],
        feedbackNotes: signal === "helpful" ? null : "Operator flagged this answer for retrieval review."
      });

      setMessages((currentMessages) =>
        currentMessages.map((message) => {
          if (message.id !== messageId) {
            return message;
          }

          const remainingFeedbackEntries = message.feedback_entries.filter(
            (entry) => entry.submitted_by_user_id !== feedback.submitted_by_user_id
          );

          return {
            ...message,
            feedback_entries: [...remainingFeedbackEntries, feedback]
          };
        })
      );
      await refreshMessageFeedbackSummary();
      setStatusMessage(
        signal === "helpful"
          ? t("workspace.status.messageFeedbackSavedHelpful")
          : t("workspace.status.messageFeedbackSavedReview")
      );
    } catch (error) {
      setErrorMessage(resolveOperatorErrorMessage(error, t("workspace.status.messageFeedbackFailed")));
      setStatusMessage(t("workspace.status.messageFeedbackFailed"));
    } finally {
      setMessageFeedbackPendingId(null);
    }
  }

  async function handleUploadDocument() {
    if (!bootstrap || !canManageDocuments || uploadFiles.length === 0 || isUploading || isSwitchingContext || isUpdatingContext || isRunningContextLifecycleAction) {
      return;
    }

    try {
      setIsUploading(true);
      setUploadProgress(0);
      setErrorMessage(null);
      setStatusMessage(t("workspace.status.uploadingAndStartingIngestion"));

      const workflowRunIds: string[] = [];
      for (const [index, file] of uploadFiles.entries()) {
        const formData = new FormData();
        formData.append("tenant_id", bootstrap.tenant.id);
        formData.append("knowledge_base_id", bootstrap.knowledgeBase.id);
        formData.append("title", file.name.replace(/\.[^.]+$/, ""));
        formData.append("file", file);
        const uploadResponse = await authenticatedUpload<{ workflow_run_id: string }>(
          "/documents/upload",
          formData,
          (progress) => setUploadProgress(Math.round(((index + progress / 100) / uploadFiles.length) * 100)),
        );
        workflowRunIds.push(uploadResponse.workflow_run_id);
      }
      for (const workflowRunId of workflowRunIds) {
        await handleImportedDocumentWorkflow(workflowRunId);
      }
      setUploadFiles([]);
    } catch (error) {
      setErrorMessage(resolveOperatorErrorMessage(error, t("workspace.status.uploadFailed")));
      setStatusMessage(t("workspace.status.uploadFailed"));
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
    }
  }

  async function handleImportWebPage() {
    if (
      !bootstrap ||
      !canManageDocuments ||
      !webImportUrl.trim() ||
      isUploading ||
      isSwitchingContext ||
      isUpdatingContext ||
      isRunningContextLifecycleAction
    ) {
      return;
    }

    try {
      setIsUploading(true);
      setErrorMessage(null);
      setStatusMessage(t("workspace.status.importingWebPageAndStartingIngestion"));

      const importResponse = await apiRequest<{
        workflow_run_id: string;
      }>("/documents/import-webpage", {
        method: "POST",
        body: JSON.stringify({
          tenant_id: bootstrap.tenant.id,
          knowledge_base_id: bootstrap.knowledgeBase.id,
          source_url: webImportUrl.trim(),
          title: webImportTitle.trim() || null
        })
      });

      await handleImportedDocumentWorkflow(importResponse.workflow_run_id);
      setWebImportUrl("");
      setWebImportTitle("");
    } catch (error) {
      setErrorMessage(resolveOperatorErrorMessage(error, t("workspace.status.webImportFailed")));
      setStatusMessage(t("workspace.status.webImportFailed"));
    } finally {
      setIsUploading(false);
    }
  }

  async function handleImportedDocumentWorkflow(workflowRunId: string) {
    if (!bootstrap) {
      return;
    }

    const workflowStatus = await waitForWorkflowCompletion(bootstrap.tenant.id, workflowRunId);
    const uploadedWorkflowRun = await loadWorkflowRunDetailItem(bootstrap.tenant.id, workflowRunId);

    setSelectedWorkflowRunId(uploadedWorkflowRun.id);
    if (uploadedWorkflowRun.subject_type === "document" && uploadedWorkflowRun.subject_id) {
      await handleSelectDocument(uploadedWorkflowRun.subject_id);
    }

    if (workflowStatus === "completed") {
      setWorkspaceView("documents");
      setHandoffIntent("grounded_validation");
      setWorkflowStatusFilter("all");
      setWorkflowPage(1);
    } else {
      setWorkspaceView("workflows");
      setHandoffIntent("workflow_recovery");
      setWorkflowQuery("");
      setWorkflowTypeFilter("all");
      setWorkflowRetryMode("all");
      setWorkflowSortOrder("updated-desc");
      setWorkflowStatusFilter(
        workflowStatus === "queued" ||
          workflowStatus === "running" ||
          workflowStatus === "pending" ||
          workflowStatus === "failed" ||
          workflowStatus === "completed" ||
          workflowStatus === "cancelled"
          ? workflowStatus
          : "all"
      );
      setWorkflowPage(1);
    }

    await refreshOperations();
    setStatusMessage(
      workflowStatus === "completed"
        ? t("workspace.status.documentIndexedReady")
        : workflowStatus === "failed"
          ? t("workspace.status.documentWorkflowOpenedInOperations")
          : workflowStatus === "queued" || workflowStatus === "running" || workflowStatus === "pending"
            ? t("workspace.status.documentWorkflowMonitoring", {
                status: formatStatusLabel(workflowStatus)
              })
            : t("workspace.status.workflowFinishedWithStatus", {
                status: formatStatusLabel(workflowStatus)
              })
    );
  }

  function selectUploadFiles(files: File[]) {
    const validFiles = files.filter((file) => {
      const fileName = file.name.toLowerCase();
      return SUPPORTED_DOCUMENT_EXTENSIONS.some((extension) => fileName.endsWith(extension)) && file.size <= MAX_DOCUMENT_UPLOAD_BYTES;
    });
    if (validFiles.length !== files.length) {
      setErrorMessage(t("workspace.status.someUploadFilesRejected"));
    } else {
      setErrorMessage(null);
    }
    setUploadFiles((currentFiles) => {
      const combined = [...currentFiles, ...validFiles];
      return combined.filter((file, index) => combined.findIndex((candidate) => candidate.name === file.name && candidate.size === file.size) === index);
    });
  }

  function handleFileSelection(event: ChangeEvent<HTMLInputElement>) {
    selectUploadFiles(Array.from(event.target.files ?? []));
    event.target.value = "";
  }

  async function handleSelectDocument(
    documentId: string,
    options?: {
      documentVersionId?: string | null;
      focusedChunkId?: string | null;
    }
  ) {
    setSelectedDocumentId(documentId);
    setSelectedDocumentVersionId(options?.documentVersionId ?? null);
    setFocusedDocumentChunkId(options?.focusedChunkId ?? null);
    if (!bootstrap) {
      return;
    }

    try {
      const [relatedWorkflowRuns] = await Promise.all([
        loadRelatedWorkflowRunItems(bootstrap.tenant.id, documentId),
        resolveDocumentDetail(
          documentId,
          bootstrap.knowledgeBase.id,
          options?.documentVersionId ?? null,
          documentLifecycleFilter !== "active" || documents.find((item) => item.id === documentId)?.is_deleted === true
        ),
      ]);
      const nextSelectedWorkflowRunId = selectPreferredWorkflowRunId(relatedWorkflowRuns);

      setSelectedDocumentWorkflowRuns(relatedWorkflowRuns);
      setSelectedWorkflowRunId(nextSelectedWorkflowRunId);
      if (nextSelectedWorkflowRunId) {
        await resolveWorkflowRunDetail(nextSelectedWorkflowRunId, bootstrap.tenant.id);
      } else {
        setSelectedWorkflowRunDetail(null);
      }
      setErrorMessage(null);
    } catch (error) {
      setSelectedDocumentDetail(null);
      setSelectedDocumentWorkflowRuns([]);
      setErrorMessage(resolveOperatorErrorMessage(error, t("workspace.status.documentDetailLoadFailed")));
    }
  }

  async function handleOpenDocumentFromWorkflow(
    documentId: string,
    options?: { documentVersionId?: string | null; focusedChunkId?: string | null }
  ) {
    await handleSelectDocument(documentId, options);
    setWorkspaceView("documents");
    setDocumentLifecycleFilter("active");
  }

  async function handleOpenCitationDocumentView(citation: Citation) {
    if (!citation.document_id) {
      return;
    }
    await handleOpenDocumentFromWorkflow(citation.document_id, {
      documentVersionId: citation.document_version_id,
      focusedChunkId: citation.document_chunk_id,
    });
    setStatusMessage(
      citation.chunk_index !== null
        ? t("workspace.status.sourceChunkOpenedInDocuments", { index: String(citation.chunk_index) })
        : t("workspace.status.sourceDocumentOpenedInDocuments")
    );
  }

  async function handleSelectWorkflowRun(workflowRunId: string) {
    setSelectedWorkflowRunId(workflowRunId);
    if (!bootstrap) {
      return;
    }

    try {
      await resolveWorkflowRunDetail(workflowRunId, bootstrap.tenant.id);
      setErrorMessage(null);
    } catch (error) {
      setSelectedWorkflowRunDetail(null);
      setErrorMessage(resolveOperatorErrorMessage(error, t("workspace.status.workflowRunDetailLoadFailed")));
    }
  }

  async function handleSelectDocumentVersion(documentVersionId: string) {
    if (!bootstrap || !selectedDocumentId) {
      return;
    }

    try {
      setSelectedDocumentVersionId(documentVersionId);
      setFocusedDocumentChunkId(null);
      await resolveDocumentDetail(
        selectedDocumentId,
        bootstrap.knowledgeBase.id,
        documentVersionId,
        documentLifecycleFilter !== "active" || isSelectedDocumentDeleted
      );
      setErrorMessage(null);
      setStatusMessage(t("workspace.status.documentVersionLoaded"));
    } catch (error) {
      setSelectedDocumentDetail(null);
      setErrorMessage(resolveOperatorErrorMessage(error, t("workspace.status.documentVersionLoadingFailed")));
      setStatusMessage(t("workspace.status.documentVersionLoadingFailed"));
    }
  }

  function toggleDocumentSelection(documentId: string) {
    setSelectedDocumentIds((currentIds) =>
      currentIds.includes(documentId)
        ? currentIds.filter((currentId) => currentId !== documentId)
        : [...currentIds, documentId]
    );
  }

  function toggleSelectAllDocumentsOnPage() {
    setSelectedDocumentIds((currentIds) => {
      const documentIdsOnPage = documents.map((document) => document.id);
      if (documentIdsOnPage.length === 0) {
        return currentIds;
      }

      const allSelected = documentIdsOnPage.every((documentId) => currentIds.includes(documentId));
      if (allSelected) {
        return currentIds.filter((documentId) => !documentIdsOnPage.includes(documentId));
      }

      return Array.from(new Set([...currentIds, ...documentIdsOnPage]));
    });
  }

  function clearDocumentSelection() {
    setSelectedDocumentIds([]);
  }

  function isSelectedDocumentReady() {
    return (
      selectedDocumentDetail?.document.ingestion_status === "completed" &&
      selectedDocumentDetail?.document.indexing_status === "completed"
    );
  }

  function isSelectedDocumentFailed() {
    return (
      selectedDocumentDetail?.document.ingestion_status === "failed" ||
      selectedDocumentDetail?.document.indexing_status === "failed"
    );
  }

  function resolveGroundedValidationDraftQuestion() {
    return buildGroundedValidationDraftQuestion(t, {
      documentTitle: isSelectedDocumentReady() && selectedDocumentDetail ? selectedDocumentDetail.document.title : null,
      workflowStatus: selectedWorkflowRunDetail?.workflow_status ?? null,
      workflowLabel: selectedWorkflowRunDetail?.subject_label ?? null,
      workflowId: selectedWorkflowRunDetail?.id ?? null
    });
  }

  function openWorkflowSupervision() {
    setWorkspaceView("workflows");
    setHandoffIntent("workflow_recovery");
    const selectedWorkflowStage = resolveWorkflowFollowUpStage(selectedWorkflowRunDetail?.workflow_status);
    if (selectedWorkflowStage === "recovery") {
      setWorkflowStatusFilter("failed");
      setWorkflowPage(1);
    } else if (selectedWorkflowStage === "cancelled") {
      setWorkflowStatusFilter("cancelled");
      setWorkflowPage(1);
    } else if (selectedWorkflowStage === "monitoring") {
      setWorkflowStatusFilter("running");
      setWorkflowPage(1);
    }
  }

  function openChatView(nextDraftQuestion?: string | null) {
    setWorkspaceView("chat");
    setHandoffIntent("grounded_validation");

    if (question.trim().length > 0) {
      return;
    }

    const nextQuestion = nextDraftQuestion?.trim() || resolveGroundedValidationDraftQuestion();
    if (nextQuestion) {
      setQuestion(nextQuestion);
    }
  }

  function handlePrepareValidationQuery(nextQuery: string) {
    const normalizedQuery = nextQuery.trim();
    if (!normalizedQuery) {
      return;
    }

    setWorkspaceView("chat");
    setHandoffIntent("grounded_validation");
    setQuestion(normalizedQuery);
    setStatusMessage(t("workspace.status.retrievalQueryPreparedInChat"));
  }

  async function refreshMessageFeedbackSummary() {
    if (!bootstrap) {
      setMessageFeedbackSummary(null);
      setRetrievalEvaluationSummary(null);
      return;
    }

    const [summary, retrievalSummary] = await Promise.all([
      loadMessageFeedbackSummary(
        bootstrap.tenant.id,
        bootstrap.workspace.id,
        bootstrap.knowledgeBase.id
      ),
      loadRetrievalEvaluationSummary(
        bootstrap.tenant.id,
        bootstrap.workspace.id,
        bootstrap.knowledgeBase.id
      )
    ]);
    setMessageFeedbackSummary(normalizeMessageFeedbackSummary(summary));
    setRetrievalEvaluationSummary(normalizeRetrievalEvaluationSummary(retrievalSummary));
  }

  async function handleRunFeedbackValidationQuery(nextQuery: string, mode: "inspect" | "compare") {
    if (!bootstrap) {
      return;
    }

    const normalizedQuery = nextQuery.trim();
    if (!normalizedQuery) {
      return;
    }

    setWorkspaceView("chat");
    setHandoffIntent("grounded_validation");
    setQuestion(normalizedQuery);
    setErrorMessage(null);

    try {
      if (mode === "compare") {
        setStatusMessage(t("workspace.status.feedbackComparisonPrepared"));

        const response = await compareRetrieval({
          tenant_id: bootstrap.tenant.id,
          knowledge_base_id: bootstrap.knowledgeBase.id,
          query_text: normalizedQuery,
          top_k: RETRIEVAL_VALIDATION_TOP_K
        });

        const summary: RetrievalValidationSummary = {
          mode: "compare",
          status:
            response.summary.recommendation_status === "aligned"
              ? "ready"
              : response.summary.recommendation_status,
          queryText: normalizedQuery,
          detail: response.summary.recommendation_reason,
          engineName: response.baseline.engine_name,
          candidateEngineName: response.candidate.engine_name,
          retrievalProfileName:
            response.candidate.retrieval_profile_name ?? response.baseline.retrieval_profile_name,
          resultCount: response.summary.shared_result_count,
          updatedAt: new Date().toISOString()
        };

        setRetrievalValidationSummary(summary);
        setStatusMessage(response.summary.recommendation_reason);

        try {
          await recordRetrievalEvaluation({
            tenant_id: bootstrap.tenant.id,
            workspace_id: bootstrap.workspace.id,
            knowledge_base_id: bootstrap.knowledgeBase.id,
            evaluation_mode: "compare",
            validation_status: summary.status,
            query_text: normalizedQuery,
            baseline_engine_name: response.baseline.engine_name,
            candidate_engine_name: response.candidate.engine_name,
            retrieval_profile_name: summary.retrievalProfileName,
            retrieval_profile_source:
              response.candidate.retrieval_profile_source ?? response.baseline.retrieval_profile_source,
            result_count: response.baseline.result_count,
            shared_result_count: response.summary.shared_result_count,
            baseline_only_count: response.summary.baseline_only_count,
            candidate_only_count: response.summary.candidate_only_count,
            top_result_matches: response.summary.top_result_matches,
            recommendation_reason: response.summary.recommendation_reason,
            evaluation_payload_json: response as unknown as Record<string, unknown>
          });
        } catch {
          // Preserve the validation result even if evaluation logging fails.
        }

        await refreshMessageFeedbackSummary();

        return;
      }

      setStatusMessage(t("workspace.status.feedbackValidationPrepared"));

      const response = await inspectRetrieval({
        tenant_id: bootstrap.tenant.id,
        knowledge_base_id: bootstrap.knowledgeBase.id,
        query_text: normalizedQuery,
        top_k: RETRIEVAL_VALIDATION_TOP_K
      });
      const detail =
        response.results.length > 0
          ? t("workspace.retrievalInspector.statusLoaded", { count: String(response.results.length) })
          : t("workspace.retrievalInspector.statusEmpty");
      const summary: RetrievalValidationSummary = {
        mode: "inspect",
        status: response.results.length > 0 ? "ready" : "empty",
        queryText: normalizedQuery,
        detail,
        engineName: response.engine_name,
        candidateEngineName: null,
        retrievalProfileName: response.retrieval_profile_name,
        resultCount: response.results.length,
        updatedAt: new Date().toISOString()
      };

      setRetrievalValidationSummary(summary);
      setStatusMessage(detail);

      try {
        await recordRetrievalEvaluation({
          tenant_id: bootstrap.tenant.id,
          workspace_id: bootstrap.workspace.id,
          knowledge_base_id: bootstrap.knowledgeBase.id,
          evaluation_mode: "inspect",
          validation_status: summary.status,
          query_text: normalizedQuery,
          baseline_engine_name: response.engine_name,
          retrieval_profile_name: response.retrieval_profile_name,
          retrieval_profile_source: response.retrieval_profile_source,
          result_count: response.results.length,
          recommendation_reason: detail,
          evaluation_payload_json: response as unknown as Record<string, unknown>
        });
      } catch {
        // Preserve the validation result even if evaluation logging fails.
      }

      await refreshMessageFeedbackSummary();
    } catch (error) {
      const detail =
        error instanceof Error ? error.message : t("workspace.retrievalInspector.statusFailed");
      setRetrievalValidationSummary({
        mode,
        status: "failed",
        queryText: normalizedQuery,
        detail,
        engineName: null,
        candidateEngineName: null,
        retrievalProfileName: null,
        resultCount: 0,
        updatedAt: new Date().toISOString()
      });
      setErrorMessage(detail);
      setStatusMessage(t("workspace.retrievalInspector.statusFailed"));
    }
  }

  function handleOpenFeedbackConversation(conversationId: string) {
    setWorkspaceView("chat");
    setIsConversationEditorOpen(false);
    setSelectedConversationId(conversationId);
  }

  const buildRetrievalFollowUpDescriptors = useCallback(
    (options: {
      sourceKey: string;
      actions: Array<{
        action_key:
          | "review_knowledge_base_governance"
          | "review_retrieval_profile_governance"
          | "rerun_retrieval_inspection"
          | "rerun_retrieval_comparison"
          | "validate_in_chat";
        action_category: "governance" | "analysis" | "validation";
        action_label: string;
        action_reason: string;
      }>;
      queryText: string | null;
      knowledgeBaseId: string | null;
      retrievalProfileId: string | null;
    }) => {
      if (!bootstrap) {
        return [];
      }

      return buildWorkspaceRetrievalFollowUpActions({
        sourceKey: options.sourceKey,
        actions: options.actions,
        queryText: options.queryText,
        tenantId: bootstrap.tenant.id,
        workspaceId: bootstrap.workspace.id,
        knowledgeBaseId: options.knowledgeBaseId,
        retrievalProfileId: options.retrievalProfileId,
        t,
        onOpenChatWithQuery: handlePrepareValidationQuery,
        onRunComparison: (query) => {
          void handleRunFeedbackValidationQuery(query, "compare");
        },
        onRunInspection: (query) => {
          void handleRunFeedbackValidationQuery(query, "inspect");
        }
      });
    },
    [bootstrap, t]
  );

  const feedbackFollowUpActionsByItemId = useMemo<Record<string, RetrievalFollowUpActionDescriptor[]>>(() => {
    if (!bootstrap || !messageFeedbackSummary) {
      return {};
    }

    return Object.fromEntries(
      messageFeedbackSummary.recent_feedback.map((item) => [
        item.id,
        buildRetrievalFollowUpDescriptors({
          sourceKey: `feedback-${item.id}`,
          actions: item.recommended_actions,
          queryText: item.latest_user_question,
          knowledgeBaseId: item.knowledge_base_id ?? bootstrap.knowledgeBase.id,
          retrievalProfileId: item.retrieval_profile_id
        })
      ])
    );
  }, [bootstrap, buildRetrievalFollowUpDescriptors, messageFeedbackSummary]);

  const candidateFollowUpActionsByQuery = useMemo<Record<string, RetrievalFollowUpActionDescriptor[]>>(() => {
    if (!bootstrap || !retrievalEvaluationSummary) {
      return {};
    }

    return Object.fromEntries(
      retrievalEvaluationSummary.candidates.map((candidate) => [
        candidate.query_text.trim(),
        buildRetrievalFollowUpDescriptors({
          sourceKey: `candidate-${candidate.query_text.trim()}`,
          actions: candidate.recommended_actions,
          queryText: candidate.query_text,
          knowledgeBaseId: bootstrap.knowledgeBase.id,
          retrievalProfileId: candidate.retrieval_profile_id
        })
      ])
    );
  }, [bootstrap, buildRetrievalFollowUpDescriptors, retrievalEvaluationSummary]);

  const recentEvaluationFollowUpActionsById = useMemo<Record<string, RetrievalFollowUpActionDescriptor[]>>(() => {
    if (!bootstrap || !retrievalEvaluationSummary) {
      return {};
    }

    return Object.fromEntries(
      retrievalEvaluationSummary.recent_evaluations.map((evaluation) => [
        evaluation.id,
        buildRetrievalFollowUpDescriptors({
          sourceKey: `evaluation-${evaluation.id}`,
          actions: evaluation.recommended_actions,
          queryText: evaluation.query_text,
          knowledgeBaseId: evaluation.knowledge_base_id,
          retrievalProfileId: evaluation.retrieval_profile_id
        })
      ])
    );
  }, [bootstrap, buildRetrievalFollowUpDescriptors, retrievalEvaluationSummary]);

  async function handleSetRetrievalEvaluationFollowUpStatus(
    evaluation: RetrievalEvaluationRecord,
    nextStatus: "pending" | "resolved"
  ) {
    try {
      setActiveRetrievalEvaluationId(evaluation.id);
      setErrorMessage(null);
      await updateRetrievalEvaluationFollowUpStatus({
        retrieval_evaluation_id: evaluation.id,
        follow_up_status: nextStatus
      });
      await refreshMessageFeedbackSummary();
      setStatusMessage(
        nextStatus === "resolved"
          ? t("workspace.retrievalInspector.followUpResolvedToast")
          : t("workspace.retrievalInspector.followUpReopenedToast")
      );
    } catch (error) {
      setErrorMessage(resolveOperatorErrorMessage(error, t("workspace.retrievalInspector.followUpUpdateFailed")));
    } finally {
      setActiveRetrievalEvaluationId(null);
    }
  }

  async function handleSetRetrievalQueryFollowUpStatus(
    queryText: string,
    nextStatus: "pending" | "resolved"
  ) {
    if (!bootstrap) {
      return;
    }

    const normalizedQuery = queryText.trim();
    if (!normalizedQuery) {
      return;
    }

    try {
      setActiveRetrievalFollowUpQuery(normalizedQuery);
      setErrorMessage(null);
      await updateRetrievalQueryFollowUpStatus({
        tenant_id: bootstrap.tenant.id,
        workspace_id: bootstrap.workspace.id,
        knowledge_base_id: bootstrap.knowledgeBase.id,
        query_text: normalizedQuery,
        follow_up_status: nextStatus
      });
      await refreshMessageFeedbackSummary();
      setStatusMessage(
        nextStatus === "resolved"
          ? t("workspace.retrievalInspector.candidateResolvedToast")
          : t("workspace.retrievalInspector.candidateReopenedToast")
      );
    } catch (error) {
      setErrorMessage(resolveOperatorErrorMessage(error, t("workspace.status.workspaceRefreshFailed")));
    } finally {
      setActiveRetrievalFollowUpQuery(null);
    }
  }

  function showFailedDocumentsQueue() {
    setWorkspaceView("documents");
    setDocumentLifecycleFilter("active");
    setDocumentStatusFilter("failed");
    setDocumentPage(1);
  }

  function focusFailedWorkflowRuns() {
    setWorkspaceView("workflows");
    setWorkflowStatusFilter(workflowMetrics.failed_runs > 0 ? "failed" : "cancelled");
    setWorkflowRetryMode("all");
    setWorkflowPage(1);
  }

  function focusActiveWorkflowRuns() {
    setWorkspaceView("workflows");
    setWorkflowStatusFilter("all");
    setWorkflowRetryMode("all");
    setWorkflowSortOrder("status-priority");
    setWorkflowPage(1);
  }

  function focusQueuedWorkflowRuns() {
    setWorkspaceView("workflows");
    setWorkflowStatusFilter("queued");
    setWorkflowRetryMode("all");
    setWorkflowSortOrder("updated-desc");
    setWorkflowPage(1);
  }

  function focusRetryWorkflowRuns() {
    setWorkspaceView("workflows");
    setWorkflowStatusFilter("all");
    setWorkflowRetryMode("retries");
    setWorkflowSortOrder("updated-desc");
    setWorkflowPage(1);
  }

  function clearWorkflowFilters() {
    setWorkspaceView("workflows");
    setWorkflowQuery("");
    setWorkflowStatusFilter("all");
    setWorkflowTypeFilter("all");
    setWorkflowRetryMode("all");
    setWorkflowSortOrder("updated-desc");
    setWorkflowPage(1);
  }

  function openDocumentsView() {
    setWorkspaceView("documents");
    setDocumentLifecycleFilter("active");
    const selectedWorkflowStage = resolveWorkflowFollowUpStage(selectedWorkflowRunDetail?.workflow_status);

    if (
      selectedWorkflowStage === "recovery" ||
      isSelectedDocumentFailed()
    ) {
      setHandoffIntent("document_recovery");
      setDocumentStatusFilter("failed");
      setDocumentPage(1);
      return;
    }

    if (
      selectedWorkflowStage === "ready" ||
      isSelectedDocumentReady()
    ) {
      setHandoffIntent("grounded_validation");
      return;
    }

    setHandoffIntent("agent_brief");
  }

  function buildRecommendationDraftQuestion(recommendation: WorkspaceAgentRecommendation) {
    if (recommendation.reason === "document-ready-for-grounded-chat") {
      return resolveGroundedValidationDraftQuestion();
    }

    if (recommendation.reason === "workflow-completed" && selectedWorkflowRunDetail) {
      return t("workspace.status.recommendationPrompts.workflowCompleted", {
        label: selectedWorkflowRunDetail.subject_label ?? selectedWorkflowRunDetail.id
      });
    }

    if (recommendation.reason === "workflow-in-progress" && selectedWorkflowRunDetail) {
      return t("workspace.status.recommendationPrompts.workflowInProgress", {
        label: selectedWorkflowRunDetail.subject_label ?? selectedWorkflowRunDetail.id
      });
    }

    return recommendation.targetView === "chat"
      ? t("workspace.status.recommendationPrompts.agentObjective", {
          name: recommendation.agent.name
        })
      : "";
  }

  function buildRecommendationExecutionInput(
    recommendation: WorkspaceAgentRecommendation
  ) {
    if (recommendation.reason === "workflow-completed" || recommendation.reason === "workflow-in-progress" || recommendation.reason === "workflow-failed") {
      if (!selectedWorkflowRunDetail) {
        return null;
      }

      const lines = [
        `Review workflow run ${selectedWorkflowRunDetail.id}.`,
        `Workflow type: ${selectedWorkflowRunDetail.workflow_type}.`,
        `Workflow status: ${selectedWorkflowRunDetail.workflow_status}.`,
      ];

      if (selectedWorkflowRunDetail.subject_label?.trim()) {
        lines.push(`Subject label: ${selectedWorkflowRunDetail.subject_label.trim()}.`);
      }
      if (selectedWorkflowRunDetail.subject_type?.trim()) {
        lines.push(`Subject type: ${selectedWorkflowRunDetail.subject_type.trim()}.`);
      }
      if (selectedWorkflowRunDetail.error_message?.trim()) {
        lines.push(`Latest error: ${selectedWorkflowRunDetail.error_message.trim()}.`);
      }
      if (selectedWorkflowRunDetail.operator_notes?.trim()) {
        lines.push(`Operator notes: ${selectedWorkflowRunDetail.operator_notes.trim()}.`);
      }
      if (selectedWorkflowRunDetail.subject_type === "document" && selectedDocumentDetail?.document.title?.trim()) {
        lines.push(`Related document: ${selectedDocumentDetail.document.title.trim()}.`);
      }
      if (selectedDocumentDetail?.document.source_kind === "web" && selectedDocumentDetail.document.source_uri?.trim()) {
        lines.push(`Related source URL: ${selectedDocumentDetail.document.source_uri.trim()}.`);
      }

      lines.push(`Recommendation reason: ${recommendation.reason}.`);
      return lines.join(" ");
    }

    if (!selectedDocumentDetail) {
      return null;
    }

    const lines = [
      `Review document ${selectedDocumentDetail.document.title}.`,
      `Document ingestion status: ${selectedDocumentDetail.document.ingestion_status}.`,
      `Document indexing status: ${selectedDocumentDetail.document.indexing_status}.`,
      `Document source kind: ${selectedDocumentDetail.document.source_kind}.`,
    ];

    if (selectedDocumentDetail.document.source_uri?.trim()) {
      lines.push(`Document source reference: ${selectedDocumentDetail.document.source_uri.trim()}.`);
    }
    if (selectedDocumentDetail.parser_name?.trim()) {
      lines.push(`Current parser: ${selectedDocumentDetail.parser_name.trim()}.`);
    }
    if (typeof selectedDocumentDetail.chunk_count === "number") {
      lines.push(`Chunk count: ${selectedDocumentDetail.chunk_count}.`);
    }
    if (typeof selectedDocumentDetail.token_count_total === "number") {
      lines.push(`Token count: ${selectedDocumentDetail.token_count_total}.`);
    }
    if (selectedDocumentWorkflowRuns[0]?.workflow_status?.trim()) {
      lines.push(`Latest workflow status: ${selectedDocumentWorkflowRuns[0].workflow_status.trim()}.`);
    }
    if (selectedDocumentWorkflowRuns[0]?.error_message?.trim()) {
      lines.push(`Latest workflow error: ${selectedDocumentWorkflowRuns[0].error_message.trim()}.`);
    }

    lines.push(`Recommendation reason: ${recommendation.reason}.`);
    return lines.join(" ");
  }

  function applyRecommendationWorkspaceContext(
    recommendation: WorkspaceAgentRecommendation
  ) {
    const matchedAgent =
      tenantAgentDefinitions.find((agentDefinition) => agentDefinition.id === recommendation.agent.id) ?? null;

    setActiveAgentId(recommendation.agent.id);
    setWorkspaceView(recommendation.targetView);
    setErrorMessage(null);
    if (recommendation.targetView === "chat") {
      const recommendedDraftQuestion = buildRecommendationDraftQuestion(recommendation);
      if (recommendedDraftQuestion.trim().length > 0) {
        setQuestion(recommendedDraftQuestion);
      }
    }

    if (recommendation.targetView === "documents") {
      if (selectedDocumentDetail?.document.source_kind) {
        setDocumentSourceFilter(selectedDocumentDetail.document.source_kind);
      }
      if (recommendation.reason === "document-needs-recovery") {
        setDocumentStatusFilter("failed");
      } else if (recommendation.reason === "document-needs-intake" || recommendation.reason === "workflow-in-progress") {
        setDocumentStatusFilter("running");
      }
      setDocumentPage(1);

      if (
        selectedWorkflowRunDetail?.subject_type === "document" &&
        selectedWorkflowRunDetail.subject_id
      ) {
        setSelectedDocumentId(selectedWorkflowRunDetail.subject_id);
      }
    }

    if (recommendation.targetView === "workflows") {
      if (recommendation.reason === "document-needs-recovery" || recommendation.reason === "workflow-failed") {
        setWorkflowStatusFilter("failed");
      } else if (recommendation.reason === "workflow-in-progress") {
        setWorkflowStatusFilter("running");
      }
      setWorkflowPage(1);
      if (selectedWorkflowRunDetail?.id) {
        setSelectedWorkflowRunId(selectedWorkflowRunDetail.id);
      }
    }

    setStatusMessage(
      matchedAgent
        ? t("workspace.status.agentContextActivatedForView", {
            name: matchedAgent.name,
            view:
              recommendation.targetView === "chat"
                ? t("workspace.headerBar.groundedChat")
                : recommendation.targetView === "documents"
                  ? t("workspace.headerBar.documentOperations")
                  : t("workspace.headerBar.workflowOperations")
          })
          : t("workspace.status.workspaceRefreshed")
      );
  }

  function applyExecutionResultToWorkspace(
    recommendation: WorkspaceAgentRecommendation,
    execution: Awaited<ReturnType<typeof createAgentExecution>>
  ) {
    const evidenceSummary = readAgentExecutionEvidenceSummary(
      execution.result_payload_json && typeof execution.result_payload_json === "object"
        ? execution.result_payload_json
        : null
    );
    const followUpActions = buildAgentExecutionFollowUpActions({
      sourceContext: { surface: "workspace" },
      execution,
      executionInput: evidenceSummary?.executionInput ?? null,
      recommendedActions: evidenceSummary?.recommendedActionSpecs ?? []
    });
    const primaryFollowUpAction =
      followUpActions.find((action) => action.variant === "default") ?? followUpActions[0] ?? null;

    setActiveAgentId(recommendation.agent.id);
    setErrorMessage(null);

    if (primaryFollowUpAction) {
      router.push(buildNavigationHrefString(primaryFollowUpAction.href) as Route);
      return;
    }

    const payload =
      execution.result_payload_json && typeof execution.result_payload_json === "object"
        ? execution.result_payload_json
        : {};
    const documentMetrics =
      payload.document_metrics && typeof payload.document_metrics === "object" && !Array.isArray(payload.document_metrics)
        ? (payload.document_metrics as Record<string, unknown>)
        : null;
    const workflowMetrics =
      payload.workflow_metrics && typeof payload.workflow_metrics === "object" && !Array.isArray(payload.workflow_metrics)
        ? (payload.workflow_metrics as Record<string, unknown>)
        : null;
    const failedDocuments =
      typeof documentMetrics?.failed_documents === "number" ? documentMetrics.failed_documents : 0;
    const activeDocuments =
      typeof documentMetrics?.active_documents === "number" ? documentMetrics.active_documents : 0;
    const failedRuns = typeof workflowMetrics?.failed_runs === "number" ? workflowMetrics.failed_runs : 0;
    const runningRuns = typeof workflowMetrics?.running_runs === "number" ? workflowMetrics.running_runs : 0;
    const queuedRuns = typeof workflowMetrics?.queued_runs === "number" ? workflowMetrics.queued_runs : 0;

    if (execution.execution_mode === "document_intake") {
      setWorkspaceView("documents");
      setDocumentLifecycleFilter("active");
      setDocumentPage(1);
      setHandoffIntent(failedDocuments > 0 || execution.execution_status === "failed" ? "document_recovery" : "agent_brief");
      if (selectedDocumentDetail?.document.source_kind) {
        setDocumentSourceFilter(selectedDocumentDetail.document.source_kind);
      }
      if (failedDocuments > 0 || execution.execution_status === "failed") {
        setDocumentStatusFilter("failed");
      } else if (
        activeDocuments > 0 ||
        execution.execution_status === "queued" ||
        execution.execution_status === "running"
      ) {
        setDocumentStatusFilter("running");
      } else {
        setDocumentStatusFilter("all");
      }
      setStatusMessage(
        t("workspace.status.agentExecutionCompletedForDocuments", {
          name: recommendation.agent.name
        })
      );
      return;
    }

    if (execution.execution_mode === "workflow_recovery") {
      setWorkspaceView("workflows");
      setWorkflowPage(1);
      setHandoffIntent("workflow_recovery");
      if (failedRuns > 0 || execution.execution_status === "failed") {
        setWorkflowStatusFilter("failed");
      } else if (
        runningRuns > 0 ||
        queuedRuns > 0 ||
        execution.execution_status === "queued" ||
        execution.execution_status === "running"
      ) {
        setWorkflowStatusFilter("running");
      } else {
        setWorkflowStatusFilter("all");
      }
      if (selectedWorkflowRunDetail?.id) {
        setSelectedWorkflowRunId(selectedWorkflowRunDetail.id);
      }
      setStatusMessage(
        t("workspace.status.agentExecutionCompletedForWorkflows", {
          name: recommendation.agent.name
        })
      );
      return;
    }

    applyRecommendationWorkspaceContext(recommendation);
  }

  async function handleActivateRecommendedAgent(
    recommendation: WorkspaceAgentRecommendation
  ) {
    if (!bootstrap) {
      return;
    }

    if (recommendation.agent.mode === "grounded_chat") {
      applyRecommendationWorkspaceContext(recommendation);
      return;
    }

    if (isActivatingRecommendedAgent) {
      return;
    }

    try {
      setIsActivatingRecommendedAgent(true);
      setErrorMessage(null);
      setStatusMessage(
        t("workspace.status.executingRecommendedAgent", {
          name: recommendation.agent.name
        })
      );

      const execution = await createAgentExecution({
        tenant_id: bootstrap.tenant.id,
        agent_definition_id: recommendation.agent.id,
        execution_input: buildRecommendationExecutionInput(recommendation),
        trigger_source: "workspace"
      });

      applyExecutionResultToWorkspace(recommendation, execution);
    } catch (error) {
      setErrorMessage(resolveOperatorErrorMessage(error, t("workspace.status.recommendedAgentExecutionFailed")));
      setStatusMessage(t("workspace.status.recommendedAgentExecutionFailed"));
    } finally {
      setIsActivatingRecommendedAgent(false);
    }
  }

  async function runDocumentAction(options: {
    action: "delete" | "reindex" | "restore";
    documentIds: string[];
    statusLabel: string;
  }) {
    if (
      !bootstrap ||
      options.documentIds.length === 0 ||
      !canManageDocuments ||
      isRunningDocumentAction ||
      isSwitchingContext ||
      isUpdatingContext ||
      isRunningContextLifecycleAction
    ) {
      return;
    }

    try {
      setIsRunningDocumentAction(true);
      setErrorMessage(null);
      setStatusMessage(options.statusLabel);

      let successCount = 0;
      let failureCount = 0;
      const successfulDocumentIds: string[] = [];
      const failedDocumentIds: string[] = [];
      let lastWorkflowRunId: string | null = null;
      let lastWorkflowStatus: string | null = null;
      let lastErrorMessage: string | null = null;

      for (const documentId of options.documentIds) {
        try {
          if (options.action === "reindex") {
            const response = await apiRequest<DocumentWorkflowActionResponse>(
              `/documents/${documentId}/reindex?knowledge_base_id=${bootstrap.knowledgeBase.id}`,
              {
                method: "POST"
              }
            );
            lastWorkflowRunId = response.workflow_run_id;
            lastWorkflowStatus = response.workflow_status;
          } else if (options.action === "restore") {
            await apiRequest<DocumentRestoreResponse>(
              `/documents/${documentId}/restore?knowledge_base_id=${bootstrap.knowledgeBase.id}`,
              {
                method: "POST"
              }
            );
          } else {
            await apiRequest(`/documents/${documentId}?knowledge_base_id=${bootstrap.knowledgeBase.id}`, {
              method: "DELETE"
            });
          }
          successCount += 1;
          successfulDocumentIds.push(documentId);
        } catch (error) {
          failureCount += 1;
          failedDocumentIds.push(documentId);
          lastErrorMessage = resolveOperatorErrorMessage(
            error,
            options.action === "delete"
              ? t("workspace.status.documentDeleteFailed")
              : options.action === "restore"
                ? t("workspace.status.documentRestoreFailed")
                : t("workspace.status.documentReindexFailed")
          );
        }
      }

      if (lastWorkflowRunId) {
        setSelectedWorkflowRunId(lastWorkflowRunId);
      }

      await refreshOperations();

      if ((options.action === "reindex" || options.action === "restore") && successfulDocumentIds.length === 1) {
        setSelectedDocumentId(successfulDocumentIds[0]);
      }

      setSelectedDocumentIds((currentIds) => currentIds.filter((documentId) => failedDocumentIds.includes(documentId)));

      if (failureCount > 0) {
        setErrorMessage(lastErrorMessage ?? t("workspace.status.documentActionFailed"));
        setStatusMessage(
          t("workspace.status.documentActionPartial", {
            actionResult:
              options.action === "delete"
                ? t("workspace.documentActionSummary.deleted")
                : options.action === "restore"
                  ? t("workspace.documentActionSummary.restored")
                  : t("workspace.documentActionSummary.queuedForReindex"),
            failureCount: String(failureCount),
            successCount: String(successCount)
          })
        );
        return;
      }

      setStatusMessage(
        options.action === "delete"
          ? t("workspace.status.documentDeleteCompleted", { count: String(successCount) })
          : options.action === "restore"
            ? t("workspace.status.documentRestoreCompleted", { count: String(successCount) })
            : t("workspace.status.documentReindexCompleted", { count: String(successCount) })
      );
    } finally {
      setIsRunningDocumentAction(false);
    }
  }

  async function handleReindexDocument() {
    if (!selectedDocumentId) {
      return;
    }
    await runDocumentAction({
      action: "reindex",
      documentIds: [selectedDocumentId],
      statusLabel: t("workspace.status.startingDocumentReindex")
    });
  }

  async function handleDeleteDocument() {
    if (!selectedDocumentId) {
      return;
    }
    await runDocumentAction({
      action: "delete",
      documentIds: [selectedDocumentId],
      statusLabel: t("workspace.status.deletingSelectedDocument")
    });
  }

  async function handleRestoreDocument() {
    if (!selectedDocumentId) {
      return;
    }

    await runDocumentAction({
      action: "restore",
      documentIds: [selectedDocumentId],
      statusLabel: t("workspace.status.restoringSelectedDocument")
    });
  }

  async function handlePermanentlyDeleteDocument(confirmationTitle: string) {
    if (!bootstrap || !selectedDocumentId || isRunningDocumentAction) return;
    try {
      setIsRunningDocumentAction(true);
      setErrorMessage(null);
      setStatusMessage(t("workspace.status.permanentlyDeletingDocument"));
      await apiRequest(`/documents/${selectedDocumentId}/permanent-delete?knowledge_base_id=${bootstrap.knowledgeBase.id}`, {
        method: "POST",
        body: JSON.stringify({ confirmation_title: confirmationTitle }),
      });
      setSelectedDocumentId(null);
      setSelectedDocumentDetail(null);
      setSelectedDocumentIds((ids) => ids.filter((id) => id !== selectedDocumentId));
      await refreshOperations();
      setStatusMessage(t("workspace.status.documentPermanentlyDeleted"));
    } catch (error) {
      setErrorMessage(resolveOperatorErrorMessage(error, t("workspace.status.documentPermanentDeleteFailed")));
      setStatusMessage(t("workspace.status.documentPermanentDeleteFailed"));
      throw error;
    } finally {
      setIsRunningDocumentAction(false);
    }
  }

  async function handleBulkReindexDocuments() {
    if (selectedDocumentIds.length === 0) {
      return;
    }
    await runDocumentAction({
      action: "reindex",
      documentIds: selectedDocumentIds,
      statusLabel: t("workspace.status.queueingReindexSelectedDocuments", {
        count: String(selectedDocumentIds.length)
      })
    });
  }

  async function handleBulkDeleteDocuments() {
    if (selectedDocumentIds.length === 0) {
      return;
    }

    await runDocumentAction({
      action: "delete",
      documentIds: selectedDocumentIds,
      statusLabel: t("workspace.status.deletingSelectedDocuments", {
        count: String(selectedDocumentIds.length)
      })
    });
  }

  async function handleBulkRestoreDocuments() {
    if (selectedDocumentIds.length === 0) {
      return;
    }

    await runDocumentAction({
      action: "restore",
      documentIds: selectedDocumentIds,
      statusLabel: t("workspace.status.restoringSelectedDocuments", {
        count: String(selectedDocumentIds.length)
      })
    });
  }

  async function handleRetryWorkflowRun() {
    if (!bootstrap || !selectedWorkflowRunId || isRetryingWorkflow || isSwitchingContext || isUpdatingContext || isRunningContextLifecycleAction) {
      return;
    }

    if (selectedWorkflowRunDetail?.retry_unavailable_reason) {
      setErrorMessage(selectedWorkflowRunDetail.retry_unavailable_reason);
      setStatusMessage(t("workspace.status.workflowRetryUnavailable"));
      return;
    }

    try {
      setIsRetryingWorkflow(true);
      setErrorMessage(null);
      setStatusMessage(t("workspace.status.retryingWorkflow"));

      const response = await apiRequest<WorkflowRunActionResponse>(
        `/workflow-runs/${selectedWorkflowRunId}/retry?tenant_id=${bootstrap.tenant.id}`,
        {
          method: "POST"
        }
      );

      setWorkspaceView("workflows");
      setWorkflowQuery("");
      setWorkflowTypeFilter("all");
      setWorkflowRetryMode("retries");
      setWorkflowSortOrder("updated-desc");
      setWorkflowStatusFilter(
        response.workflow_status === "queued" ||
          response.workflow_status === "running" ||
          response.workflow_status === "pending" ||
          response.workflow_status === "failed" ||
          response.workflow_status === "completed" ||
          response.workflow_status === "cancelled"
          ? response.workflow_status
          : "all"
      );
      setWorkflowPage(1);
      setSelectedWorkflowRunId(response.id);
      await refreshOperations();
      setStatusMessage(
        response.workflow_status === "queued"
          ? t("workspace.status.workflowRetryQueuedMonitoring")
          : t("workspace.status.workflowRetryFinished", {
              status: formatStatusLabel(response.workflow_status)
            })
      );
    } catch (error) {
      setErrorMessage(resolveOperatorErrorMessage(error, t("workspace.status.workflowRetryFailed")));
      setStatusMessage(t("workspace.status.workflowRetryFailed"));
    } finally {
      setIsRetryingWorkflow(false);
    }
  }

  async function handleCancelWorkflowRun() {
    if (
      !bootstrap ||
      !selectedWorkflowRunId ||
      isCancellingWorkflow ||
      isRetryingWorkflow ||
      isSwitchingContext ||
      isUpdatingContext ||
      isRunningContextLifecycleAction
    ) {
      return;
    }

    try {
      setIsCancellingWorkflow(true);
      setErrorMessage(null);
      setStatusMessage(t("workspace.status.cancellingWorkflow"));

      const response = await apiRequest<WorkflowRunActionResponse>(
        `/workflow-runs/${selectedWorkflowRunId}/cancel?tenant_id=${bootstrap.tenant.id}`,
        {
          method: "POST"
        }
      );

      setWorkspaceView("workflows");
      setWorkflowQuery("");
      setWorkflowTypeFilter("all");
      setWorkflowRetryMode("all");
      setWorkflowSortOrder("updated-desc");
      setWorkflowStatusFilter("cancelled");
      setWorkflowPage(1);
      setSelectedWorkflowRunId(response.id);
      await refreshOperations();
      setStatusMessage(t("workspace.status.workflowCancelFinished"));
    } catch (error) {
      setErrorMessage(resolveOperatorErrorMessage(error, t("workspace.status.workflowCancelFailed")));
      setStatusMessage(t("workspace.status.workflowCancelFailed"));
    } finally {
      setIsCancellingWorkflow(false);
    }
  }

  async function handleSaveWorkflowOperatorNotes(operatorNotes: string | null) {
    if (
      !bootstrap ||
      !selectedWorkflowRunId ||
      isSavingWorkflowNotes ||
      isRetryingWorkflow ||
      isCancellingWorkflow ||
      isSwitchingContext ||
      isUpdatingContext ||
      isRunningContextLifecycleAction
    ) {
      return;
    }

    try {
      setIsSavingWorkflowNotes(true);
      setErrorMessage(null);
      setStatusMessage(t("workspace.status.savingWorkflowNotes"));

      const response = await apiRequest<WorkflowRunDetail>(
        `/workflow-runs/${selectedWorkflowRunId}/notes?tenant_id=${bootstrap.tenant.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            operator_notes: operatorNotes,
          }),
        }
      );

      setSelectedWorkflowRunDetail(response);
      setWorkflowRuns((currentRuns) =>
        currentRuns.map((workflowRun) =>
          workflowRun.id === response.id
            ? {
                ...workflowRun,
                workflow_status: response.workflow_status,
                error_message: response.error_message,
                operator_notes: response.operator_notes,
                updated_at: response.updated_at,
              }
            : workflowRun
        )
      );
      setStatusMessage(t("workspace.status.workflowNotesSaved"));
    } catch (error) {
      setErrorMessage(resolveOperatorErrorMessage(error, t("workspace.status.workflowNotesSaveFailed")));
      setStatusMessage(t("workspace.status.workflowNotesSaveFailed"));
    } finally {
      setIsSavingWorkflowNotes(false);
    }
  }

  return (
    <ConsoleShell activeHref={activeHref}>
      <PageTitleSync title={workspaceSurfaceCopy.browserTitle} />
      <ConsolePage className="gap-6">
        <WorkspaceSidebar
          bootstrap={bootstrap}
          canManageAdminResources={canManageAdminResources}
          canManageDocuments={canManageDocuments}
          catalog={catalog}
          isBootstrapping={isBootstrapping}
          isCreatingContext={isCreatingContext}
          isRunningContextLifecycleAction={isRunningContextLifecycleAction}
          isSwitchingContext={isSwitchingContext}
          isUpdatingContext={isUpdatingContext}
          isUploading={isUploading}
          knowledgeBaseForm={{
            editDescription: editKnowledgeBaseDescription,
            editName: editKnowledgeBaseName,
            editRetrievalProfileId: editKnowledgeBaseRetrievalProfileId,
            editSlug: editKnowledgeBaseSlug,
            newDescription: newKnowledgeBaseDescription,
            newName: newKnowledgeBaseName,
            newRetrievalProfileId: newKnowledgeBaseRetrievalProfileId,
            newSlug: newKnowledgeBaseSlug,
            onCreate: handleCreateKnowledgeBase,
            onOpenCreate: openKnowledgeBaseCreatePanel,
            onOpenEdit: openKnowledgeBaseEditPanel,
            onTogglePublication: handleToggleKnowledgeBasePublicationStatus,
            onUpdate: handleUpdateKnowledgeBase,
            setEditDescription: setEditKnowledgeBaseDescription,
            setEditName: setEditKnowledgeBaseName,
            setEditRetrievalProfileId: setEditKnowledgeBaseRetrievalProfileId,
            setEditSlug: setEditKnowledgeBaseSlug,
            setNewDescription: setNewKnowledgeBaseDescription,
            setNewName: setNewKnowledgeBaseName,
            setNewRetrievalProfileId: setNewKnowledgeBaseRetrievalProfileId,
            setNewSlug: setNewKnowledgeBaseSlug
          }}
          managementPanel={managementPanel}
          onFileSelection={handleFileSelection}
          onImportWebPage={handleImportWebPage}
          onSwitchWorkspaceContext={switchWorkspaceContext}
          onUploadDocument={handleUploadDocument}
          onWebImportTitleChange={setWebImportTitle}
          onWebImportUrlChange={setWebImportUrl}
          retrievalProfiles={retrievalProfiles}
          setManagementPanel={setManagementPanel}
          setShowConsoleControls={setShowConsoleControls}
          showConsoleControls={showConsoleControls}
          tenantForm={{
            editName: editTenantName,
            editSlug: editTenantSlug,
            newName: newTenantName,
            newSlug: newTenantSlug,
            onCreate: handleCreateTenant,
            onOpenEdit: openTenantEditPanel,
            onUpdate: handleUpdateTenant,
            setEditName: setEditTenantName,
            setEditSlug: setEditTenantSlug,
            setNewName: setNewTenantName,
            setNewSlug: setNewTenantSlug
          }}
          uploadFile={uploadFile}
          webImportTitle={webImportTitle}
          webImportUrl={webImportUrl}
          workspaceForm={{
            editDescription: editWorkspaceDescription,
            editName: editWorkspaceName,
            editSlug: editWorkspaceSlug,
            newDescription: newWorkspaceDescription,
            newName: newWorkspaceName,
            newSlug: newWorkspaceSlug,
            onCreate: handleCreateWorkspace,
            onOpenEdit: openWorkspaceEditPanel,
            onToggleArchive: handleToggleWorkspaceArchiveState,
            onUpdate: handleUpdateWorkspace,
            setEditDescription: setEditWorkspaceDescription,
            setEditName: setEditWorkspaceName,
            setEditSlug: setEditWorkspaceSlug,
            setNewDescription: setNewWorkspaceDescription,
            setNewName: setNewWorkspaceName,
            setNewSlug: setNewWorkspaceSlug
          }}
        />

        <section className={`min-w-0 rounded-xl border border-slate-200/80 bg-white shadow-[0_18px_52px_rgba(15,23,42,0.06)] dark:border-slate-800 dark:bg-slate-950/92 ${workspaceView === "chat" || workspaceView === "documents" ? "console-split-layout" : "min-h-[calc(100dvh-152px)] xl:h-[calc(100dvh-128px)] xl:min-h-0 xl:overflow-hidden"}`}>
          <WorkspaceHeaderBar
            conversationDraftTitle={conversationDraftTitle}
            conversationSearchQuery={conversationSearchQuery}
            conversations={conversations}
            currentWorkspaceName={bootstrap?.workspace.name ?? "--"}
            currentKnowledgeBaseName={bootstrap?.knowledgeBase.name ?? "--"}
            currentWorkspaceId={bootstrap?.workspace.id ?? ""}
            currentKnowledgeBaseId={bootstrap?.knowledgeBase.id ?? ""}
            availableWorkspaces={catalog.workspaces}
            availableKnowledgeBases={catalog.knowledgeBases}
            hasMoreConversations={hasMoreConversations}
            isLoadingMoreConversations={isLoadingMoreConversations}
            documentLifecycleFilter={documentLifecycleFilter}
            documentQuery={documentQuery}
            documentSourceFilter={documentSourceFilter}
            documentSortOrder={documentSortOrder}
            documentStatusFilter={documentStatusFilter}
            isBusy={isWorkspaceBusy}
            isConversationEditing={isConversationEditorOpen}
            isDeletingConversation={isDeletingConversation}
            isUploading={isUploading}
            uploadProgress={uploadProgress}
            isUpdatingConversation={isUpdatingConversationTitle}
            onCancelConversationEditing={handleCancelConversationEditing}
            onConversationDraftTitleChange={setConversationDraftTitle}
            onConversationSearchQueryChange={setConversationSearchQuery}
            onDeleteConversation={handleDeleteConversation}
            onFileSelection={handleFileSelection}
            onImportWebPage={handleImportWebPage}
            onLoadMoreConversations={loadMoreConversations}
            onSwitchKnowledgeScope={switchWorkspaceContext}
            onDocumentLifecycleFilterChange={(value) => {
              setDocumentLifecycleFilter(value);
              setDocumentPage(1);
            }}
            onDocumentQueryChange={setDocumentQuery}
            onDocumentSourceFilterChange={(value) => {
              setDocumentSourceFilter(value);
              setDocumentPage(1);
            }}
            onDocumentSortOrderChange={setDocumentSortOrder}
            onDocumentStatusFilterChange={(value) => {
              setDocumentStatusFilter(value);
              setDocumentPage(1);
            }}
            onOpenConversationEditor={openConversationEditor}
            onSelectConversation={handleSelectConversation}
            onStartNewConversation={handleCreateConversation}
            onSubmitConversationTitle={handleSaveConversationTitle}
            onUploadDocument={handleUploadDocument}
            onUploadFileSelected={selectUploadFiles}
            onRemoveUploadFile={(index) => setUploadFiles((files) => files.filter((_, fileIndex) => fileIndex !== index))}
            onWebImportTitleChange={setWebImportTitle}
            onWebImportUrlChange={setWebImportUrl}
            selectedConversationId={selectedConversationId}
            workspaceView={workspaceView}
            uploadFiles={uploadFiles}
            webImportTitle={webImportTitle}
            webImportUrl={webImportUrl}
          />

          {workspaceView === "chat" ? (
            <WorkspaceChatView
              activeAgentContext={activeAgentContext}
              agentConsoleHref={agentConsoleHref ?? buildAgentsHref({ tenantId: bootstrap?.tenant.id ?? null })}
              bootstrap={bootstrap}
              conversationMetrics={conversationMetrics}
              currentConversationStats={currentConversationStats}
              documents={documents}
              errorMessage={errorMessage}
              focusedChunkId={focusedDocumentChunkId}
              canManageDocuments={canManageDocuments}
              canManageWorkflowRuns={canManageWorkflowRuns}
              canSendChatMessages={canSendChatMessages}
              canSubmitMessageFeedback={Boolean(session?.userId)}
              currentUserId={session?.userId ?? null}
              candidateFollowUpActionsByQuery={candidateFollowUpActionsByQuery}
              feedbackFollowUpActionsByItemId={feedbackFollowUpActionsByItemId}
              recentEvaluationFollowUpActionsById={recentEvaluationFollowUpActionsById}
              knowledgeBaseId={bootstrap?.knowledgeBase.id ?? null}
              handleSendQuestion={handleSendQuestion}
              isBusy={isWorkspaceBusy}
              isCancellingWorkflow={isCancellingWorkflow}
              isGroundedValidationFlow={handoffIntent === "grounded_validation"}
              isCurrentSurfaceRecommended={Boolean(isCurrentSurfaceRecommended)}
              isLoadingMessages={isLoadingMessages}
              isSavingWorkflowNotes={isSavingWorkflowNotes}
              isRetryingWorkflow={isRetryingWorkflow}
              isRunningDocumentAction={isRunningDocumentAction}
              isSending={isSending}
              activeRetrievalEvaluationId={activeRetrievalEvaluationId}
              messageFeedbackPendingId={messageFeedbackPendingId}
              messageFeedbackSummary={messageFeedbackSummary}
              messages={messages}
              activeRetrievalFollowUpQuery={activeRetrievalFollowUpQuery}
              onDeleteDocument={handleDeleteDocument}
              onPermanentlyDeleteDocument={handlePermanentlyDeleteDocument}
              onCancelWorkflowRun={handleCancelWorkflowRun}
              onOpenFeedbackConversation={handleOpenFeedbackConversation}
              onOpenDocumentsView={openDocumentsView}
              onOpenCitationDocumentView={handleOpenCitationDocumentView}
              onPrepareValidationQuery={handlePrepareValidationQuery}
              onSetRetrievalEvaluationFollowUpStatus={handleSetRetrievalEvaluationFollowUpStatus}
              onSetRetrievalQueryFollowUpStatus={handleSetRetrievalQueryFollowUpStatus}
              onFocusQueuedWorkflowRuns={focusQueuedWorkflowRuns}
              onFocusRetryWorkflowRuns={focusRetryWorkflowRuns}
              onRefreshWorkspace={handleRefreshWorkspace}
              onReindexDocument={handleReindexDocument}
              onRestoreDocument={handleRestoreDocument}
              onSaveWorkflowOperatorNotes={handleSaveWorkflowOperatorNotes}
              onSelectDocumentVersion={handleSelectDocumentVersion}
              onRetryWorkflowRun={handleRetryWorkflowRun}
              onSelectDocument={handleSelectDocument}
              onSelectWorkflowRun={handleSelectWorkflowRun}
              onOpenWorkflowView={openWorkflowSupervision}
              onStartNewConversation={handleCreateConversation}
              onSubmitMessageFeedback={handleSubmitMessageFeedback}
              onToggleConsoleControls={() => setShowConsoleControls(true)}
              question={question}
              retrievalValidationSummary={retrievalValidationSummary}
              selectedConversation={selectedConversation}
              selectedDocumentDetail={selectedDocumentDetail}
              selectedDocumentWorkflowRuns={selectedDocumentWorkflowRuns}
              selectedDocumentId={selectedDocumentId}
              selectedWorkflowRunDetail={selectedWorkflowRunDetail}
              selectedWorkflowRunId={selectedWorkflowRunId}
              setQuestion={setQuestion}
              tenantId={bootstrap?.tenant.id ?? null}
              retrievalEvaluationSummary={retrievalEvaluationSummary}
              validationQueryPrompt={resolveGroundedValidationDraftQuestion()}
              workflowRuns={selectedDocumentWorkflowRuns}
            />
          ) : workspaceView === "documents" ? (
          <WorkspaceDocumentsView
            activeAgentContext={activeAgentContext}
            documentPage={documentPage}
            documentPageCount={documentPageCount}
            documentLifecycleFilter={documentLifecycleFilter}
            documentQuery={documentQuery}
            documentSourceFilter={documentSourceFilter}
            documentStatusFilter={documentStatusFilter}
            documentTotalCount={documentTotalCount}
            documents={documents}
            tenantId={bootstrap?.tenant.id ?? null}
            knowledgeBaseId={bootstrap?.knowledgeBase.id ?? null}
            focusedChunkId={focusedDocumentChunkId}
              canManageDocuments={canManageDocuments}
              canManageWorkflowRuns={canManageWorkflowRuns}
              isActivatingRecommendation={isActivatingRecommendedAgent}
              isCancellingWorkflow={isCancellingWorkflow}
              isSavingWorkflowNotes={isSavingWorkflowNotes}
            isRetryAvailable={isRetryAvailable}
            isRetryEligibilityLoading={false}
            isRetryingWorkflow={isRetryingWorkflow}
            isRunningDocumentAction={isRunningDocumentAction}
            onBulkDeleteDocuments={handleBulkDeleteDocuments}
            onBulkReindexDocuments={handleBulkReindexDocuments}
            onBulkRestoreDocuments={handleBulkRestoreDocuments}
            onClearDocumentSelection={clearDocumentSelection}
            onDeleteDocument={handleDeleteDocument}
            onPermanentlyDeleteDocument={handlePermanentlyDeleteDocument}
            onDocumentPageChange={setDocumentPage}
            onActivateRecommendedAgent={handleActivateRecommendedAgent}
            onOpenChatView={openChatView}
            onOpenFailedDocumentsQueue={showFailedDocumentsQueue}
            onOpenWorkflowView={openWorkflowSupervision}
            onCancelWorkflowRun={handleCancelWorkflowRun}
            onReindexDocument={handleReindexDocument}
            onRestoreDocument={handleRestoreDocument}
            onSaveWorkflowOperatorNotes={handleSaveWorkflowOperatorNotes}
            onSelectDocumentVersion={handleSelectDocumentVersion}
            onRetryWorkflowRun={handleRetryWorkflowRun}
            onSelectDocument={handleSelectDocument}
            onSelectWorkflowRun={handleSelectWorkflowRun}
            onShowFailedDocuments={showFailedDocumentsQueue}
            onToggleDocumentSelection={toggleDocumentSelection}
            onToggleSelectAllDocumentsOnPage={toggleSelectAllDocumentsOnPage}
            selectedDocumentDetail={selectedDocumentDetail}
            selectedDocumentId={selectedDocumentId}
            selectedDocumentIds={selectedDocumentIds}
            selectedDocumentRecommendedAgents={selectedDocumentRecommendedAgents}
            selectedWorkflowRunDetail={selectedWorkflowRunDetail}
            selectedWorkflowRetryDisabledReason={selectedWorkflowRunDetail?.retry_unavailable_reason ?? null}
            workflowRuns={selectedDocumentWorkflowRuns}
          />
          ) : (
            <WorkspaceWorkflowsView
              activeAgentContext={activeAgentContext}
              agentConsoleHref={agentConsoleHref ?? buildAgentsHref({ tenantId: bootstrap?.tenant.id ?? null })}
                handoffIntent={handoffIntent}
                canManageWorkflowRuns={canManageWorkflowRuns}
                isActivatingRecommendation={isActivatingRecommendedAgent}
                isCancellingWorkflow={isCancellingWorkflow}
              isSavingWorkflowNotes={isSavingWorkflowNotes}
              isRetryAvailable={isRetryAvailable}
              isRetryEligibilityLoading={false}
              isRetryingWorkflow={isRetryingWorkflow}
              isCurrentSurfaceRecommended={Boolean(isCurrentSurfaceRecommended)}
              onClearWorkflowFilters={clearWorkflowFilters}
              onFocusActiveWorkflowRuns={focusActiveWorkflowRuns}
              onFocusFailedWorkflowRuns={focusFailedWorkflowRuns}
              onActivateRecommendedAgent={handleActivateRecommendedAgent}
              onOpenChatView={openChatView}
              onOpenConsoleControls={() => setShowConsoleControls(true)}
              onFocusQueuedWorkflowRuns={focusQueuedWorkflowRuns}
              onFocusRetryWorkflowRuns={focusRetryWorkflowRuns}
              onCancelWorkflowRun={handleCancelWorkflowRun}
              onOpenDocumentsView={openDocumentsView}
              onSaveWorkflowOperatorNotes={handleSaveWorkflowOperatorNotes}
              onSelectDocument={handleOpenDocumentFromWorkflow}
              onRetryWorkflowRun={handleRetryWorkflowRun}
              onSelectWorkflowRun={handleSelectWorkflowRun}
              onWorkflowPageChange={setWorkflowPage}
              onWorkflowQueryChange={setWorkflowQuery}
              onWorkflowSortOrderChange={setWorkflowSortOrder}
              onWorkflowStatusFilterChange={setWorkflowStatusFilter}
              onWorkflowTypeFilterChange={setWorkflowTypeFilter}
              onWorkflowRetryModeChange={(value) => {
                setWorkflowRetryMode(value);
                setWorkflowPage(1);
              }}
              selectedWorkflowChildRuns={selectedWorkflowChildRuns}
              selectedWorkflowParentRun={selectedWorkflowParentRun}
              selectedWorkflowRetryDisabledReason={selectedWorkflowRunDetail?.retry_unavailable_reason ?? null}
              selectedWorkflowRunDetail={selectedWorkflowRunDetail}
              selectedWorkflowRunId={selectedWorkflowRunId}
              selectedWorkflowRecommendedAgents={selectedWorkflowRecommendedAgents}
              workflowMetrics={workflowMetrics}
              workflowPage={workflowPage}
              workflowPageCount={workflowPageCount}
              workflowQuery={workflowQuery}
              workflowRuns={workflowRuns}
              workflowSortOrder={workflowSortOrder}
              workflowStatusFilter={workflowStatusFilter}
              workflowTotalCount={workflowTotalCount}
              workflowTypeFilter={workflowTypeFilter}
              workflowRetryMode={workflowRetryMode}
            />
          )}
        </section>
      </ConsolePage>
    </ConsoleShell>
  );
}
