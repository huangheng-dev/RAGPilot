"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FileText, MessageSquareText, Waypoints } from "lucide-react";
import { ConsoleActionPacketCard } from "@/components/console/ConsoleActionPacketCard";
import { ConsoleRuntimeTaskPacket } from "@/components/console/ConsoleRuntimeTaskPacket";
import { ConsolePageHeader, ConsoleSurface, ConsoleSurfaceHeader } from "@/components/console/ConsolePrimitives";
import { PageTitleSync } from "@/components/console/PageTitleSync";
import { ConsoleShell } from "@/components/console/ConsoleShell";
import { Button } from "@/components/ui/button";
import { MetricSummaryCard } from "@/components/workspace/MetricSummaryCard";
import { WorkspaceChatView } from "@/components/workspace/WorkspaceChatView";
import { WorkspaceHeaderBar } from "@/components/workspace/WorkspaceHeaderBar";
import { WorkspaceDocumentsView } from "@/components/workspace/WorkspaceDocumentsView";
import { WorkspaceRetrievalInspectorPanel } from "@/components/workspace/WorkspaceRetrievalInspectorPanel";
import { WorkspaceSidebar } from "@/components/workspace/WorkspaceSidebar";
import { WorkspaceWorkflowsView } from "@/components/workspace/WorkspaceWorkflowsView";
import type { AgentRunRecordInput } from "@/lib/agent-runs";
import { formatOperatorErrorMessage, readApiErrorMessage } from "@/lib/api-errors";
import { hasDirectoryCapability } from "@/lib/auth/access";
import { useAuth } from "@/lib/auth/provider";
import { useI18n } from "@/lib/i18n/provider";
import { buildSessionActorHeaders } from "@/lib/local-session";
import { listRetrievalProfiles, type PlatformRetrievalProfile } from "@/lib/platform-governance";
import { buildWorkspaceAgentRecommendations } from "@/lib/workspace-agent-recommendations";
import { formatStatusLabel } from "@/lib/workspace-formatters";
import { buildGroundedValidationDraftQuestion } from "@/lib/workspace-follow-up";
import { buildAdminHref, buildAgentsHref, buildOperationsHref } from "@/lib/console-route-builders";
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
import type {
  BootstrapState,
  Citation,
  ChatAskResponse,
  ContextManagementPanel,
  Conversation,
  ConversationMetrics,
  DocumentActionSummary,
  DocumentActivity,
  DocumentDetail,
  DocumentLifecycleFilter,
  DocumentMetrics,
  DocumentRecord,
  DocumentRestoreResponse,
  DocumentSortOrder,
  DocumentWorkflowActionResponse,
  KnowledgeBase,
  MessageFeedback,
  MessageFeedbackSummary,
  Message,
  RetrievalValidationSummary,
  Tenant,
  UploadFollowUpSummary,
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
const DOCUMENT_PAGE_SIZE = 5;
const WORKFLOW_PAGE_SIZE = 6;
const CONVERSATION_PAGE_SIZE = 100;
const SEARCH_DEBOUNCE_MS = 250;

function resolveOperatorErrorMessage(error: unknown, fallbackMessage: string) {
  if (error instanceof Error) {
    return formatOperatorErrorMessage(error.message) ?? fallbackMessage;
  }
  return fallbackMessage;
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
  failed_runs: 0
};

const EMPTY_CONVERSATION_METRICS: ConversationMetrics = {
  total_conversations: 0,
  active_conversations: 0,
  total_messages: 0,
  latest_activity_at: null
};

const EMPTY_MESSAGE_FEEDBACK_SUMMARY: MessageFeedbackSummary = {
  total_feedback: 0,
  helpful_feedback: 0,
  partially_helpful_feedback: 0,
  not_helpful_feedback: 0,
  citation_issue_feedback: 0,
  retrieval_tuning_candidates: 0,
  recent_feedback: []
};

function buildApiBaseUrl() {
  const configuredBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  const fallbackBaseUrl = "http://127.0.0.1:18000";
  const baseUrl = configuredBaseUrl && configuredBaseUrl.length > 0 ? configuredBaseUrl : fallbackBaseUrl;
  return baseUrl.endsWith("/api/v1") ? baseUrl : `${baseUrl}/api/v1`;
}

const apiBaseUrl = buildApiBaseUrl();

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

  return response;
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await performApiRequest(path, init);
  return (await response.json()) as T;
}

async function apiRequestWithHeaders<T>(
  path: string,
  init?: RequestInit
): Promise<{ data: T; headers: Headers }> {
  const response = await performApiRequest(path, init);
  return {
    data: (await response.json()) as T,
    headers: response.headers
  };
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

async function loadMessageFeedbackSummary(tenantId: string, workspaceId: string, knowledgeBaseId?: string | null) {
  const searchParams = new URLSearchParams({
    tenant_id: tenantId,
    workspace_id: workspaceId
  });
  if (knowledgeBaseId) {
    searchParams.set("knowledge_base_id", knowledgeBaseId);
  }

  return await apiRequest<MessageFeedbackSummary>(`/chat/feedback/summary?${searchParams.toString()}`);
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
  return await apiRequest<WorkspaceAgentContext[]>(`/agents?tenant_id=${tenantId}`);
}

async function loadDocumentItems(options: {
  knowledgeBaseId: string;
  query: string;
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
  let tenant =
    (preferredSelection?.tenantId ? tenants.find((item) => item.id === preferredSelection.tenantId) : null) ??
    tenants.find((item) => item.slug === DEMO_TENANT_SLUG);
  if (!tenant) {
    tenant = await apiRequest<Tenant>("/tenants", {
      method: "POST",
      body: JSON.stringify({
        name: "RagPilot Demo",
        slug: DEMO_TENANT_SLUG
      })
    });
    tenants = [...tenants, tenant];
  }

  let workspaces = await listWorkspaces(tenant.id);
  let workspace =
    (preferredSelection?.workspaceId ? workspaces.find((item) => item.id === preferredSelection.workspaceId) : null) ??
    workspaces.find((item) => item.slug === DEMO_WORKSPACE_SLUG) ??
    workspaces[0];
  if (!workspace) {
    workspace = await apiRequest<Workspace>("/workspaces", {
      method: "POST",
      body: JSON.stringify({
        tenant_id: tenant.id,
        name: "RagPilot Operations",
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
    knowledgeBases.find((item) => item.slug === DEMO_KNOWLEDGE_BASE_SLUG) ??
    knowledgeBases[0];
  if (!knowledgeBase) {
    knowledgeBase = await apiRequest<KnowledgeBase>("/knowledge-bases", {
      method: "POST",
      body: JSON.stringify({
        tenant_id: tenant.id,
        workspace_id: workspace.id,
        name: "RagPilot Handbook",
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

function getDocumentLabel(documentId: string, documents: DocumentRecord[], selectedDocumentDetail: DocumentDetail | null) {
  if (selectedDocumentDetail?.document.id === documentId) {
    return selectedDocumentDetail.document.title;
  }

  return documents.find((document) => document.id === documentId)?.title ?? `Document ${documentId.slice(0, 8)}`;
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

  const [bootstrap, setBootstrap] = useState<BootstrapState | null>(null);
  const [tenantAgentDefinitions, setTenantAgentDefinitions] = useState<WorkspaceAgentContext[]>([]);
  const [catalog, setCatalog] = useState<WorkspaceCatalog>({
    tenants: [],
    workspaces: [],
    knowledgeBases: []
  });
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [retrievalValidationSummary, setRetrievalValidationSummary] = useState<RetrievalValidationSummary | null>(null);
  const [conversationDraftTitle, setConversationDraftTitle] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [documentTotalCount, setDocumentTotalCount] = useState(0);
  const [documentMetrics, setDocumentMetrics] = useState<DocumentMetrics>(EMPTY_DOCUMENT_METRICS);
  const [documentActionSummary, setDocumentActionSummary] = useState<DocumentActionSummary | null>(null);
  const [uploadFollowUpSummary, setUploadFollowUpSummary] = useState<UploadFollowUpSummary | null>(null);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  const [workflowRuns, setWorkflowRuns] = useState<WorkflowRun[]>([]);
  const [workflowTotalCount, setWorkflowTotalCount] = useState(0);
  const [workflowMetrics, setWorkflowMetrics] = useState<WorkflowMetrics>(EMPTY_WORKFLOW_METRICS);
  const [conversationMetrics, setConversationMetrics] = useState<ConversationMetrics>(EMPTY_CONVERSATION_METRICS);
  const [messageFeedbackSummary, setMessageFeedbackSummary] = useState<MessageFeedbackSummary>(
    EMPTY_MESSAGE_FEEDBACK_SUMMARY
  );
  const [hasLoadedWorkspaceOperations, setHasLoadedWorkspaceOperations] = useState(false);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [selectedDocumentVersionId, setSelectedDocumentVersionId] = useState<string | null>(null);
  const [selectedDocumentDetail, setSelectedDocumentDetail] = useState<DocumentDetail | null>(null);
  const [focusedDocumentChunkId, setFocusedDocumentChunkId] = useState<string | null>(null);
  const [selectedDocumentWorkflowRuns, setSelectedDocumentWorkflowRuns] = useState<WorkflowRun[]>([]);
  const [selectedDocumentActivity, setSelectedDocumentActivity] = useState<DocumentActivity | null>(null);
  const [isLoadingSelectedDocumentActivity, setIsLoadingSelectedDocumentActivity] = useState(false);
  const [selectedWorkflowRunId, setSelectedWorkflowRunId] = useState<string | null>(null);
  const [selectedWorkflowRunDetail, setSelectedWorkflowRunDetail] = useState<WorkflowRunDetail | null>(null);
  const [selectedWorkflowLineageRuns, setSelectedWorkflowLineageRuns] = useState<WorkflowRun[]>([]);
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>(initialWorkspaceView);
  const [showConsoleControls, setShowConsoleControls] = useState(false);
  const [documentQuery, setDocumentQuery] = useState(initialWorkspaceLocationState.documentQuery);
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
  const [retrievalInspectorDraftQuery, setRetrievalInspectorDraftQuery] = useState("");
  const [retrievalInspectorFocusToken, setRetrievalInspectorFocusToken] = useState(0);
  const [retrievalInspectorAutoRunMode, setRetrievalInspectorAutoRunMode] = useState<"inspect" | "compare" | null>(
    null
  );
  const [conversationSearchQuery, setConversationSearchQuery] = useState(initialWorkspaceLocationState.conversationQuery);
  const [isConversationEditorOpen, setIsConversationEditorOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [messageFeedbackPendingId, setMessageFeedbackPendingId] = useState<string | null>(null);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);
  const [isDeletingConversation, setIsDeletingConversation] = useState(false);
  const [isUpdatingConversationTitle, setIsUpdatingConversationTitle] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isRunningDocumentAction, setIsRunningDocumentAction] = useState(false);
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
  const [retrievalProfiles, setRetrievalProfiles] = useState<PlatformRetrievalProfile[]>([]);
  const [statusMessage, setStatusMessage] = useState(() => t("workspace.status.loading"));
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
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
  const canSendChatMessages = hasDirectoryCapability(session, "send_chat_messages");
  const isWorkspaceBusy =
    isBootstrapping ||
    isSwitchingContext ||
    isUpdatingContext ||
    isRunningContextLifecycleAction ||
    isCreatingConversation ||
    isDeletingConversation ||
    isUpdatingConversationTitle;

  useEffect(() => {
    let isMounted = true;

    async function loadRetrievalProfiles() {
      try {
        const nextRetrievalProfiles = await listRetrievalProfiles();
        if (!isMounted) {
          return;
        }
        setRetrievalProfiles(nextRetrievalProfiles);
      } catch {
        if (!isMounted) {
          return;
        }
        setRetrievalProfiles([]);
      }
    }

    void loadRetrievalProfiles();

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

    if (sourceSurface === "operations") {
      return buildOperationsHref({
        tenantId,
        agentId,
        lane: sourceOperationsLane ?? (activeAgentContext?.mode === "workflow_recovery" ? "failed" : "overview"),
        status: selectedWorkflowRunDetail?.workflow_status === "failed" ? "failed" : "all",
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
      const failedSignalCount = documentMetrics.failed_documents + workflowMetrics.failed_runs;
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

    return {
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
          : handoffIntent === "workflow_recovery" && selectedWorkflowRunDetail?.workflow_status === "failed"
            ? t("workspace.runtimeTaskPacket.statuses.attention")
            : isCurrentSurfaceRecommended
              ? t("workspace.runtimeTaskPacket.statuses.ready")
              : t("workspace.runtimeTaskPacket.statuses.review"),
      statusTone:
        handoffIntent === "grounded_validation"
          ? retrievalValidationTone
          : handoffIntent === "workflow_recovery" && selectedWorkflowRunDetail?.workflow_status === "failed"
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
    };
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

  const workspaceRuntimeRunbook = useMemo(() => {
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
        handoffIntent === "workflow_recovery"
          ? "failed"
          : selectedWorkflowRunDetail?.workflow_status === "running" || selectedWorkflowRunDetail?.workflow_status === "queued"
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
      const hasFailures = documentMetrics.failed_documents > 0 || workflowMetrics.failed_runs > 0;
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
          metricValue: `${workflowMetrics.failed_runs}/${workflowMetrics.active_runs}/${workflowMetrics.total_runs}`,
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
      ];
    }

    if (handoffIntent === "workflow_recovery") {
      return [
        {
          title: t("workspace.runtimeRunbook.workflowRecovery.stabilizeTitle"),
          detail: t("workspace.runtimeRunbook.workflowRecovery.stabilizeDetail"),
          status:
            selectedWorkflowRunDetail?.workflow_status === "failed"
              ? ("attention" as const)
              : ("review" as const),
          statusLabel:
            selectedWorkflowRunDetail?.workflow_status === "failed"
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
          detail: t("workspace.runtimeRunbook.workflowRecovery.closeLoopDetail"),
          status: "review" as const,
          statusLabel: reviewLabel,
          metricLabel: t("workspace.runtimeRunbook.metrics.owner"),
          metricValue: activeAgentContext?.name ?? t("workspace.runtimeTaskPacket.pending"),
          primaryActionHref: governanceHref,
          primaryActionRunRecord: buildWorkspaceAgentRunRecord("admin", "workflow_recovery"),
          primaryActionLabel: t("workspace.runtimeRunbook.actions.openGovernance"),
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
      ];
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
          detail: t("workspace.runtimeRunbook.documentRecovery.briefAgentDetail"),
          status: activeAgentContext ? ("healthy" as const) : ("review" as const),
          statusLabel: activeAgentContext ? healthyLabel : reviewLabel,
          metricLabel: t("workspace.runtimeRunbook.metrics.owner"),
          metricValue: activeAgentContext?.name ?? t("workspace.runtimeTaskPacket.pending"),
          primaryActionHref: chatHref,
          primaryActionRunRecord: buildWorkspaceAgentRunRecord("chat", "agent_brief"),
          primaryActionLabel: t("workspace.runtimeRunbook.actions.openChat"),
          secondaryActions: [
            {
              label: t("workspace.runtimeRunbook.actions.openAgent"),
              href: agentConsoleHref ?? governanceHref,
              runRecord: agentConsoleHref ? null : buildWorkspaceAgentRunRecord("admin", "document_recovery")
            }
          ]
        }
      ];
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
          detail: validationCloseLoopDetail,
          status: retrievalValidationReady
            ? ("healthy" as const)
            : retrievalValidationBlocksGroundedChat
              ? ("attention" as const)
              : ("review" as const),
          statusLabel: retrievalValidationReady
            ? healthyLabel
            : retrievalValidationBlocksGroundedChat
              ? attentionLabel
              : reviewLabel,
          metricLabel: t("workspace.runtimeRunbook.metrics.owner"),
          metricValue: activeAgentContext?.name ?? t("workspace.runtimeTaskPacket.pending"),
          primaryActionHref: retrievalValidationReady ? governanceHref : validationPrimaryActionHref,
          primaryActionRunRecord: retrievalValidationReady
            ? buildWorkspaceAgentRunRecord("admin", "grounded_validation")
            : validationPrimaryActionRunRecord,
          primaryActionLabel: retrievalValidationReady
            ? t("workspace.runtimeRunbook.actions.openGovernance")
            : validationPrimaryActionLabel,
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
      ];
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
        detail: t("workspace.runtimeRunbook.agentBrief.closeLoopDetail"),
        status: activeAgentContext ? ("healthy" as const) : ("review" as const),
        statusLabel: activeAgentContext ? healthyLabel : reviewLabel,
        metricLabel: t("workspace.runtimeRunbook.metrics.owner"),
        metricValue: activeAgentContext?.name ?? t("workspace.runtimeTaskPacket.pending"),
        primaryActionHref: agentConsoleHref ?? governanceHref,
        primaryActionRunRecord: agentConsoleHref ? null : buildWorkspaceAgentRunRecord("admin", "agent_brief"),
        primaryActionLabel: t("workspace.runtimeRunbook.actions.openAgent"),
        secondaryActions: [
          {
            label: t("workspace.runtimeRunbook.actions.openGovernance"),
            href: governanceHref,
            runRecord: buildWorkspaceAgentRunRecord("admin", "agent_brief")
          }
        ]
      }
    ];
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
      conversationId: selectedConversationId,
      conversationQuery: conversationSearchQuery,
      documentId: selectedDocumentId,
      workflowRunId: selectedWorkflowRunId,
      documentQuery,
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

  useEffect(() => {
    if (!bootstrap) {
      setTenantAgentDefinitions([]);
      return;
    }

    const tenantId = bootstrap.tenant.id;
    let cancelled = false;

    async function loadTenantAgentDefinitions() {
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

    void loadTenantAgentDefinitions();

    return () => {
      cancelled = true;
    };
  }, [bootstrap]);

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
        : operations.documentItems[0]?.id ?? null
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
    setDocumentActionSummary(null);
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
    setMessageFeedbackSummary(EMPTY_MESSAGE_FEEDBACK_SUMMARY);
    setHasLoadedWorkspaceOperations(false);
    setDocumentPage(options?.preferredDocumentPage ?? 1);
    setWorkflowPage(options?.preferredWorkflowPage ?? 1);
    setMessages([]);
    setRetrievalInspectorDraftQuery("");
    setRetrievalInspectorFocusToken(0);
    setRetrievalInspectorAutoRunMode(null);
    setConversationSearchQuery(options?.preferredConversationQuery ?? "");
    setUploadFile(null);

    const conversationSearchParams = new URLSearchParams({
      tenant_id: resources.tenant.id,
      workspace_id: resources.workspace.id,
      limit: String(CONVERSATION_PAGE_SIZE)
    });
    const normalizedPreferredConversationQuery = options?.preferredConversationQuery?.trim() ?? "";
    if (normalizedPreferredConversationQuery) {
      conversationSearchParams.set("query", normalizedPreferredConversationQuery);
    }

    const [conversationItems, nextConversationMetrics, nextMessageFeedbackSummary] = await Promise.all([
      apiRequest<Conversation[]>(`/chat/conversations?${conversationSearchParams.toString()}`),
      loadConversationMetrics(resources.tenant.id, resources.workspace.id),
      loadMessageFeedbackSummary(resources.tenant.id, resources.workspace.id, resources.knowledgeBase.id),
    ]);

    setConversations(conversationItems);
    setConversationMetrics(nextConversationMetrics);
    setMessageFeedbackSummary(nextMessageFeedbackSummary);
    const nextConversationId =
      options?.preferredConversationId && conversationItems.some((item) => item.id === options.preferredConversationId)
        ? options.preferredConversationId
        : conversationItems[0]?.id ?? null;

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

      const tenants = catalog.tenants.length > 0 ? catalog.tenants : await listTenants();
      const tenant = tenants.find((item) => item.id === nextTenantId);
      if (!tenant) {
        throw new Error(t("workspace.errors.selectedTenantNotResolved"));
      }

      const workspaces = await listWorkspaces(tenant.id);
      const workspace =
        workspaces.find((item) => item.id === nextWorkspaceId) ??
        (tenant.id === bootstrap.tenant.id ? workspaces.find((item) => item.id === bootstrap.workspace.id) : null) ??
        workspaces[0];
      if (!workspace) {
        throw new Error(t("workspace.errors.selectedTenantNoWorkspaces"));
      }

      const knowledgeBases = await listKnowledgeBases(workspace.id);
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
      currentId && documents.some((item) => item.id === currentId) ? currentId : documents[0]?.id ?? null
    );
    setSelectedDocumentIds((currentIds) => currentIds.filter((documentId) => documents.some((item) => item.id === documentId)));
  }, [documents]);

  useEffect(() => {
    if (isApplyingDocumentLocationStateRef.current) {
      isApplyingDocumentLocationStateRef.current = false;
      return;
    }

    setDocumentPage(1);
  }, [documentQuery, documentLifecycleFilter, documentSortOrder, documentStatusFilter]);

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
        if (initialLocationState.documentId) {
          hasAppliedInitialTargetRef.current = true;
          await handleSelectDocument(initialLocationState.documentId);
          if (!cancelled) {
            setWorkspaceView("documents");
          }
          return;
        }

        if (initialLocationState.workflowRunId) {
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
    let cancelled = false;

    async function loadSelectedDocumentActivity() {
      if (!bootstrap || !selectedDocumentId) {
        setSelectedDocumentActivity(null);
        setIsLoadingSelectedDocumentActivity(false);
        return;
      }

      try {
        if (!cancelled) {
          setIsLoadingSelectedDocumentActivity(true);
        }
        const activity = await apiRequest<DocumentActivity>(
          `/documents/${selectedDocumentId}/activity?${new URLSearchParams({
            knowledge_base_id: bootstrap.knowledgeBase.id,
            include_deleted:
              documentLifecycleFilter !== "active" || isSelectedDocumentDeleted ? "true" : "false",
          }).toString()}`
        );
        if (!cancelled) {
          setSelectedDocumentActivity(activity);
          setErrorMessage(null);
        }
      } catch (error) {
        if (!cancelled) {
          setSelectedDocumentActivity(null);
          setErrorMessage(resolveOperatorErrorMessage(error, t("workspace.status.documentActivityLoadFailed")));
        }
      } finally {
        if (!cancelled) {
          setIsLoadingSelectedDocumentActivity(false);
        }
      }
    }

    void loadSelectedDocumentActivity();

    return () => {
      cancelled = true;
    };
  }, [bootstrap, documentLifecycleFilter, isSelectedDocumentDeleted, selectedDocumentId, selectedDocumentWorkflowRuns, t]);

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
    setConversationMetrics(nextConversationMetrics);

    const nextConversationId =
      (preferredConversationId && conversationItems.some((item) => item.id === preferredConversationId)
        ? preferredConversationId
        : (selectedConversationId && conversationItems.some((item) => item.id === selectedConversationId)
            ? selectedConversationId
            : conversationItems[0]?.id ?? null));

    setSelectedConversationId(nextConversationId);
  }

  async function refreshMessageFeedbackSummary() {
    if (!bootstrap) {
      return;
    }

    const nextSummary = await loadMessageFeedbackSummary(
      bootstrap.tenant.id,
      bootstrap.workspace.id,
      bootstrap.knowledgeBase.id
    );
    setMessageFeedbackSummary(nextSummary);
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

  function handleOpenFeedbackConversation(conversationId: string) {
    handleSelectConversation(conversationId);
    setWorkspaceView("chat");
  }

  function openConversationEditor() {
    if (!selectedConversation) {
      return;
    }

    setConversationDraftTitle(selectedConversation.title);
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

  async function handleCreateConversation() {
    if (!bootstrap || isCreatingConversation) {
      return;
    }

    try {
      setIsCreatingConversation(true);
      setErrorMessage(null);
      setStatusMessage(t("workspace.status.creatingConversation"));

      const createdConversation = await apiRequest<Conversation>("/chat/conversations", {
        method: "POST",
        body: JSON.stringify({
          tenant_id: bootstrap.tenant.id,
          workspace_id: bootstrap.workspace.id,
          knowledge_base_id: bootstrap.knowledgeBase.id,
          title: t("workspace.status.conversationDraftTitle", {
            timestamp: new Intl.DateTimeFormat(language === "zh-CN" ? "zh-CN" : "en-US", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit"
          }).format(new Date())
          })
        })
      });

      await refreshConversations(createdConversation.id);
      setMessages([]);
      setQuestion("");
      setIsConversationEditorOpen(false);
      setConversationDraftTitle(createdConversation.title);
      setStatusMessage(t("workspace.status.conversationCreated", { title: createdConversation.title }));
    } catch (error) {
      setErrorMessage(resolveOperatorErrorMessage(error, t("workspace.status.conversationCreationFailed")));
      setStatusMessage(t("workspace.status.conversationCreationFailed"));
    } finally {
      setIsCreatingConversation(false);
    }
  }

  async function handleDeleteConversation() {
    if (!bootstrap || !selectedConversationId || isDeletingConversation) {
      return;
    }

    const conversationTitle =
      selectedConversation?.title ??
      t("workspace.headerBar.startConversationPlaceholder");
    const confirmed = window.confirm(t("workspace.confirm.deleteConversation", { title: conversationTitle }));
    if (!confirmed) {
      return;
    }

    try {
      setIsDeletingConversation(true);
      setErrorMessage(null);
      setStatusMessage(t("workspace.status.deletingConversation"));

      await apiRequest<void>(
        `/chat/conversations/${selectedConversationId}?tenant_id=${bootstrap.tenant.id}`,
        {
          method: "DELETE",
        }
      );

      setMessages([]);
      setQuestion("");
      setIsConversationEditorOpen(false);
      setConversationDraftTitle("");
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

    try {
      setIsSending(true);
      setErrorMessage(null);
      setStatusMessage(t("workspace.status.generatingGroundedReply"));

      const response = await apiRequest<ChatAskResponse>("/chat/messages", {
        method: "POST",
        body: JSON.stringify({
          tenant_id: bootstrap.tenant.id,
          workspace_id: bootstrap.workspace.id,
          knowledge_base_id: bootstrap.knowledgeBase.id,
          agent_definition_id: activeAgentContext?.id ?? null,
          conversation_id: selectedConversationId,
          question: question.trim(),
          top_k: 3
        })
      });

      setQuestion("");
      await refreshConversations(response.conversation.id);
      await refreshOperations();
      setMessages((currentMessages) =>
        response.conversation.id === selectedConversationId
          ? [...currentMessages, response.user_message, response.assistant_message]
          : [response.user_message, response.assistant_message]
      );
      setStatusMessage(
        activeAgentContext
          ? t("workspace.status.groundedAnswerReadyWithAgent", { name: activeAgentContext.name })
          : t("workspace.status.groundedAnswerReady")
      );
    } catch (error) {
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
    if (!bootstrap || !canManageDocuments || !uploadFile || isUploading || isSwitchingContext || isUpdatingContext || isRunningContextLifecycleAction) {
      return;
    }

    try {
      setIsUploading(true);
      setErrorMessage(null);
      setUploadFollowUpSummary(null);
      setStatusMessage(t("workspace.status.uploadingAndStartingIngestion"));

      const formData = new FormData();
      formData.append("tenant_id", bootstrap.tenant.id);
      formData.append("knowledge_base_id", bootstrap.knowledgeBase.id);
      formData.append("title", uploadFile.name.replace(/\.[^.]+$/, ""));
      formData.append("file", uploadFile);

      const uploadResponse = await apiRequest<{
        workflow_run_id: string;
      }>("/documents/upload", {
        method: "POST",
        body: formData
      });

      const workflowStatus = await waitForWorkflowCompletion(bootstrap.tenant.id, uploadResponse.workflow_run_id);
      const normalizedUploadWorkflowStatus =
        workflowStatus === "queued" ||
        workflowStatus === "running" ||
        workflowStatus === "pending" ||
        workflowStatus === "completed" ||
        workflowStatus === "failed"
          ? workflowStatus
          : "running";
      const uploadedWorkflowRun = await loadWorkflowRunDetailItem(bootstrap.tenant.id, uploadResponse.workflow_run_id);

      setSelectedWorkflowRunId(uploadedWorkflowRun.id);
      let uploadedDocumentTitle = uploadFile.name.replace(/\.[^.]+$/, "");
      if (uploadedWorkflowRun.subject_type === "document" && uploadedWorkflowRun.subject_id) {
        await handleSelectDocument(uploadedWorkflowRun.subject_id);
        const matchedDocument = documents.find((document) => document.id === uploadedWorkflowRun.subject_id) ?? null;
        if (matchedDocument?.title) {
          uploadedDocumentTitle = matchedDocument.title;
        }
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
            workflowStatus === "completed"
            ? workflowStatus
            : "all"
        );
        setWorkflowPage(1);
      }

      await refreshOperations();
      setUploadFollowUpSummary({
        documentId:
          uploadedWorkflowRun.subject_type === "document" ? uploadedWorkflowRun.subject_id ?? null : null,
        documentTitle: uploadedWorkflowRun.subject_label ?? uploadedDocumentTitle,
        workflowRunId: uploadedWorkflowRun.id,
        workflowStatus: normalizedUploadWorkflowStatus,
        completedAt: new Date().toISOString(),
        followUpDraftQuestion: buildGroundedValidationDraftQuestion(t, {
          documentTitle:
            normalizedUploadWorkflowStatus === "completed" ? uploadedWorkflowRun.subject_label ?? uploadedDocumentTitle : null,
          workflowStatus: normalizedUploadWorkflowStatus,
          workflowLabel: uploadedWorkflowRun.subject_label ?? uploadedDocumentTitle,
          workflowId: uploadedWorkflowRun.id
        })
      });
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
      setUploadFile(null);
    } catch (error) {
      setErrorMessage(resolveOperatorErrorMessage(error, t("workspace.status.uploadFailed")));
      setStatusMessage(t("workspace.status.uploadFailed"));
    } finally {
      setIsUploading(false);
    }
  }

  function handleFileSelection(event: ChangeEvent<HTMLInputElement>) {
    setUploadFile(event.target.files?.[0] ?? null);
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
      const nextSelectedWorkflowRunId = relatedWorkflowRuns[0]?.id ?? null;

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

  async function handleInspectCitationDocument(citation: Citation) {
    if (!citation.document_id) {
      return;
    }
    await handleSelectDocument(citation.document_id, {
      documentVersionId: citation.document_version_id,
      focusedChunkId: citation.document_chunk_id,
    });
    setStatusMessage(
      citation.chunk_index !== null
        ? t("workspace.status.sourceChunkLoadedInChat", { index: String(citation.chunk_index) })
        : t("workspace.status.sourceDocumentLoadedInChat")
    );
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

  function clearDocumentActionSummary() {
    setDocumentActionSummary(null);
  }

  function clearUploadFollowUpSummary() {
    setUploadFollowUpSummary(null);
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
    if (selectedWorkflowRunDetail?.workflow_status === "failed") {
      setWorkflowStatusFilter("failed");
      setWorkflowPage(1);
    } else if (selectedWorkflowRunDetail?.workflow_status === "queued" || selectedWorkflowRunDetail?.workflow_status === "running") {
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

  function handleOpenRetrievalQueryInChat(nextQuery: string) {
    const normalizedQuery = nextQuery.trim();
    if (!normalizedQuery) {
      return;
    }

    setWorkspaceView("chat");
    setHandoffIntent("grounded_validation");
    setQuestion(normalizedQuery);
    setStatusMessage(t("workspace.status.retrievalQueryPreparedInChat"));
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

  function handleRunFeedbackValidationQuery(nextQuery: string, mode: "inspect" | "compare") {
    const normalizedQuery = nextQuery.trim();
    if (!normalizedQuery) {
      return;
    }

    setWorkspaceView("chat");
    setHandoffIntent("grounded_validation");
    setRetrievalInspectorDraftQuery(normalizedQuery);
    setRetrievalInspectorAutoRunMode(mode);
    setRetrievalInspectorFocusToken((currentValue) => currentValue + 1);
    setStatusMessage(
      mode === "compare"
        ? t("workspace.status.feedbackComparisonPrepared")
        : t("workspace.status.feedbackValidationPrepared")
    );
  }

  function showFailedDocumentsQueue() {
    setWorkspaceView("documents");
    setDocumentLifecycleFilter("active");
    setDocumentStatusFilter("failed");
    setDocumentPage(1);
  }

  function focusFailedWorkflowRuns() {
    setWorkspaceView("workflows");
    setWorkflowStatusFilter("failed");
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

    if (
      selectedWorkflowRunDetail?.workflow_status === "failed" ||
      isSelectedDocumentFailed()
    ) {
      setHandoffIntent("document_recovery");
      setDocumentStatusFilter("failed");
      setDocumentPage(1);
      return;
    }

    if (
      selectedWorkflowRunDetail?.workflow_status === "completed" ||
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

  function handleActivateRecommendedAgent(
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

  function resolveDocumentActionFollowUpView(options: {
    action: "delete" | "reindex" | "restore";
    successCount: number;
    failureCount: number;
    lastWorkflowStatus: string | null;
  }): "none" | "documents" | "workflows" | "chat" {
    if (options.action === "restore") {
      return options.successCount > 0 ? "documents" : options.failureCount > 0 ? "documents" : "none";
    }

    if (options.action === "delete") {
      return options.failureCount > 0 ? "documents" : "none";
    }

    if (options.successCount === 0) {
      return options.failureCount > 0 ? "documents" : "none";
    }

    if (options.lastWorkflowStatus === "completed") {
      return "chat";
    }

    if (options.lastWorkflowStatus === "failed") {
      return "documents";
    }

    return "workflows";
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
      setDocumentActionSummary(null);
      setStatusMessage(options.statusLabel);

      let successCount = 0;
      let failureCount = 0;
      const successfulDocumentIds: string[] = [];
      const failedDocumentIds: string[] = [];
      const failedItems: DocumentActionSummary["failedItems"] = [];
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
          failedItems.push({
            documentId,
            documentTitle: getDocumentLabel(documentId, documents, selectedDocumentDetail),
            message: lastErrorMessage
          });
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
      setDocumentActionSummary({
        action: options.action,
        requestedCount: options.documentIds.length,
        successCount,
        failureCount,
        completedAt: new Date().toISOString(),
        successfulDocumentIds,
        lastWorkflowRunId,
        lastWorkflowStatus,
        followUpView: resolveDocumentActionFollowUpView({
          action: options.action,
          successCount,
          failureCount,
          lastWorkflowStatus
        }),
        followUpDraftQuestion:
          options.action === "reindex" && successCount > 0
            ? buildGroundedValidationDraftQuestion(t, {
                documentTitle:
                  successfulDocumentIds.length === 1
                    ? getDocumentLabel(successfulDocumentIds[0], documents, selectedDocumentDetail)
                    : null,
                workflowStatus: lastWorkflowStatus,
                workflowLabel:
                  successfulDocumentIds.length === 1
                    ? getDocumentLabel(successfulDocumentIds[0], documents, selectedDocumentDetail)
                    : null,
                workflowId: lastWorkflowRunId
              })
            : null,
        failedItems
      });

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

    const confirmed = window.confirm(t("workspace.confirm.deleteSelectedDocument"));
    if (!confirmed) {
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

    const confirmed = window.confirm(
      t("workspace.confirm.deleteSelectedDocuments", {
        count: String(selectedDocumentIds.length)
      })
    );
    if (!confirmed) {
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
          response.workflow_status === "completed"
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

  return (
    <ConsoleShell activeHref={activeHref}>
      <PageTitleSync title={workspaceSurfaceCopy.browserTitle} />
      <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-6">
        <ConsolePageHeader
          description={workspaceSurfaceCopy.description}
          eyebrow={workspaceSurfaceCopy.eyebrow}
          icon={
            workspaceView === "chat" ? (
              <MessageSquareText className="h-4 w-4" />
            ) : workspaceView === "documents" ? (
              <FileText className="h-4 w-4" />
            ) : (
              <Waypoints className="h-4 w-4" />
            )
          }
          title={workspaceSurfaceCopy.title}
        />

        <ConsoleSurface>
          <ConsoleSurfaceHeader
            action={
              <div className="flex flex-wrap gap-2">
                {workspaceView === "chat" ? (
                  <Button onClick={() => void handleCreateConversation()} size="sm" type="button">
                    {t("workspace.chatView.startConversation")}
                  </Button>
                ) : workspaceView === "documents" ? (
                  <Button onClick={showFailedDocumentsQueue} size="sm" type="button">
                    {t("workspace.documentsView.needsAttention")}
                  </Button>
                ) : (
                  <Button onClick={focusFailedWorkflowRuns} size="sm" type="button">
                    {t("workspace.workflowsView.failedRuns")}
                  </Button>
                )}
                <Button className="bg-white" onClick={() => setShowConsoleControls(true)} size="sm" type="button" variant="outline">
                  {t("workspace.headerBar.contextControls")}
                </Button>
              </div>
            }
            description={workspaceSurfaceCopy.description}
            title={workspaceView === "chat" ? t("workspace.routePanel.chat") : workspaceView === "documents" ? t("workspace.routePanel.documents") : t("workspace.routePanel.operations")}
          />
          <div className="grid gap-4 p-6 md:grid-cols-3">
            {workspaceView === "chat" ? (
              <>
                <MetricSummaryCard
                  description={t("workspace.chatView.activeInScope", {
                    count: String(conversationMetrics.active_conversations)
                  })}
                  label={t("workspace.chatView.workspaceConversations")}
                  value={conversationMetrics.total_conversations}
                />
                <MetricSummaryCard
                  description={t("workspace.chatView.askKnowledgeBaseDescription")}
                  label={t("workspace.chatView.workspaceMessages")}
                  value={conversationMetrics.total_messages}
                />
                <MetricSummaryCard
                  description={t("workspace.documentsView.documentsDescription")}
                  label={t("workspace.chatView.indexedDocuments")}
                  value={documentTotalCount}
                />
              </>
            ) : workspaceView === "documents" ? (
              <>
                <MetricSummaryCard
                  description={t("workspace.documentsView.documentsDescription")}
                  label={t("workspace.documentsView.documents")}
                  value={documentMetrics.total_documents}
                />
                <MetricSummaryCard
                  accentClassName="border-amber-200"
                  description={t("workspace.documentsView.inProgressDescription")}
                  label={t("workspace.documentsView.inProgress")}
                  value={documentMetrics.active_documents}
                />
                <MetricSummaryCard
                  accentClassName="border-rose-200"
                  description={t("workspace.documentsView.needsAttentionDescription")}
                  label={t("workspace.documentsView.needsAttention")}
                  value={documentMetrics.failed_documents}
                />
              </>
            ) : (
              <>
                <MetricSummaryCard
                  description={t("workspace.workflowsView.workflowRunsDescription")}
                  label={t("workspace.workflowsView.workflowRuns")}
                  value={workflowMetrics.total_runs}
                />
                <MetricSummaryCard
                  accentClassName="border-amber-200"
                  description={t("workspace.workflowsView.activeDescription")}
                  label={t("workspace.workflowsView.active")}
                  value={workflowMetrics.active_runs}
                />
                <MetricSummaryCard
                  accentClassName="border-rose-200"
                  description={t("workspace.workflowsView.failedDescription")}
                  label={t("workspace.workflowsView.failed")}
                  value={workflowMetrics.failed_runs}
                />
              </>
            )}
          </div>
        </ConsoleSurface>

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
          onSwitchWorkspaceContext={switchWorkspaceContext}
          onUploadDocument={handleUploadDocument}
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

        <section className="flex min-h-[calc(100vh-190px)] flex-col overflow-hidden rounded-[24px] border border-white/80 bg-white shadow-[0_16px_48px_rgba(15,23,42,0.06)] dark:border-slate-800 dark:bg-slate-950/90">
          <WorkspaceHeaderBar
            activeAgentContext={activeAgentContext}
            agentConsoleHref={agentConsoleHref}
            bootstrap={bootstrap}
            conversationMetrics={conversationMetrics}
            conversationDraftTitle={conversationDraftTitle}
            conversationSearchQuery={conversationSearchQuery}
            conversations={conversations}
            errorMessage={errorMessage}
            isCurrentSurfaceRecommended={isCurrentSurfaceRecommended}
            isBusy={isWorkspaceBusy}
            isConversationEditing={isConversationEditorOpen}
            isDeletingConversation={isDeletingConversation}
            isUpdatingConversation={isUpdatingConversationTitle}
            onCancelConversationEditing={handleCancelConversationEditing}
            onConversationDraftTitleChange={setConversationDraftTitle}
            onConversationSearchQueryChange={setConversationSearchQuery}
            onDeleteConversation={handleDeleteConversation}
            onOpenConversationEditor={openConversationEditor}
            onRefreshWorkspace={handleRefreshWorkspace}
            onSelectConversation={handleSelectConversation}
            onStartNewConversation={handleCreateConversation}
            onSubmitConversationTitle={handleSaveConversationTitle}
            onToggleConsoleControls={() => setShowConsoleControls((currentValue) => !currentValue)}
            recommendedSurfaceHref={recommendedSurfaceHref}
            recommendedSurfaceRunRecord={recommendedSurfaceRunRecord}
            sourceSurfaceHref={sourceSurfaceHref}
            sourceSurface={sourceSurface}
            selectedConversationId={selectedConversationId}
            selectedConversationTitle={selectedConversation?.title ?? null}
            showConsoleControls={showConsoleControls}
            statusMessage={statusMessage}
            retrievalValidationSummary={retrievalValidationSummary}
            workspaceView={workspaceView}
          />

          {workspaceRuntimeTaskPacket ? (
            <div className="border-b border-slate-100 px-6 py-5 dark:border-slate-800">
              <ConsoleRuntimeTaskPacket
                detail={workspaceRuntimeTaskPacket.detail}
                objective={workspaceRuntimeTaskPacket.objective}
                objectiveLabel={t("workspace.runtimeTaskPacket.fields.objective")}
                primaryActionHref={workspaceRuntimeTaskPacket.primaryActionHref}
                primaryActionLabel={workspaceRuntimeTaskPacket.primaryActionLabel}
                primaryActionRunRecord={workspaceRuntimeTaskPacket.primaryActionRunRecord}
                prompt={workspaceRuntimeTaskPacket.prompt}
                promptLabel={t("workspace.runtimeTaskPacket.fields.prompt")}
                secondaryActions={workspaceRuntimeTaskPacket.secondaryActions}
                statusLabel={workspaceRuntimeTaskPacket.statusLabel}
                statusTone={workspaceRuntimeTaskPacket.statusTone}
                summaryItems={workspaceRuntimeTaskPacket.summaryItems}
                title={workspaceRuntimeTaskPacket.title}
              />
            </div>
          ) : null}

          {workspaceRuntimeRunbook.length > 0 ? (
            <div className="border-b border-slate-100 px-6 py-5 dark:border-slate-800">
              <ConsoleSurfaceHeader
                description={t("workspace.runtimeRunbook.description")}
                title={t("workspace.runtimeRunbook.title")}
              />
              <div className="mt-4 grid gap-4 xl:grid-cols-3">
                {workspaceRuntimeRunbook.map((item) => (
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
                    statusLabel={item.statusLabel}
                    title={item.title}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {workspaceView !== "workflows" ? (
            <WorkspaceRetrievalInspectorPanel
              autoRunMode={retrievalInspectorAutoRunMode}
              draftQuery={retrievalInspectorDraftQuery}
              focusToken={retrievalInspectorFocusToken}
              knowledgeBaseId={bootstrap?.knowledgeBase.id ?? null}
              onOpenChatWithQuery={handleOpenRetrievalQueryInChat}
              onOpenDocument={handleOpenDocumentFromWorkflow}
              onValidationSummaryChange={setRetrievalValidationSummary}
              suggestions={workspaceRetrievalSuggestions}
              tenantId={bootstrap?.tenant.id ?? null}
              workspaceId={bootstrap?.workspace.id ?? null}
            />
          ) : null}

          {workspaceView === "chat" ? (
            <WorkspaceChatView
              activeAgentContext={activeAgentContext}
              agentConsoleHref={agentConsoleHref ?? buildAgentsHref({ tenantId: bootstrap?.tenant.id ?? null })}
              bootstrap={bootstrap}
              conversationMetrics={conversationMetrics}
              currentConversationStats={currentConversationStats}
              documents={documents}
              documentTotalCount={documentTotalCount}
              errorMessage={errorMessage}
              focusedChunkId={focusedDocumentChunkId}
              canManageDocuments={canManageDocuments}
              canSendChatMessages={canSendChatMessages}
              canSubmitMessageFeedback={Boolean(session?.userId)}
              currentUserId={session?.userId ?? null}
              handleSendQuestion={handleSendQuestion}
              isBusy={isWorkspaceBusy}
              isGroundedValidationFlow={handoffIntent === "grounded_validation"}
              isCurrentSurfaceRecommended={Boolean(isCurrentSurfaceRecommended)}
              isLoadingMessages={isLoadingMessages}
              isRetryingWorkflow={isRetryingWorkflow}
              isRunningDocumentAction={isRunningDocumentAction}
              isSending={isSending}
              messageFeedbackSummary={messageFeedbackSummary}
              messageFeedbackPendingId={messageFeedbackPendingId}
              messages={messages}
              onDeleteDocument={handleDeleteDocument}
              onOpenFeedbackConversation={handleOpenFeedbackConversation}
              onInspectCitationDocument={handleInspectCitationDocument}
              onOpenDocumentsView={openDocumentsView}
              onOpenCitationDocumentView={handleOpenCitationDocumentView}
              onRunFeedbackValidationQuery={handleRunFeedbackValidationQuery}
              onPrepareValidationQuery={handlePrepareValidationQuery}
              onFocusQueuedWorkflowRuns={focusQueuedWorkflowRuns}
              onFocusRetryWorkflowRuns={focusRetryWorkflowRuns}
              onRefreshWorkspace={handleRefreshWorkspace}
              onReindexDocument={handleReindexDocument}
              onRestoreDocument={handleRestoreDocument}
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
              selectedDocumentId={selectedDocumentId}
              selectedWorkflowRunDetail={selectedWorkflowRunDetail}
              selectedWorkflowRunId={selectedWorkflowRunId}
              setQuestion={setQuestion}
              validationQueryPrompt={resolveGroundedValidationDraftQuestion()}
              workflowRuns={workflowRuns}
            />
          ) : workspaceView === "documents" ? (
          <WorkspaceDocumentsView
            activeAgentContext={activeAgentContext}
            agentConsoleHref={agentConsoleHref ?? buildAgentsHref({ tenantId: bootstrap?.tenant.id ?? null })}
            documentActionSummary={documentActionSummary}
            documentMetrics={documentMetrics}
            documentPage={documentPage}
            documentPageCount={documentPageCount}
            documentLifecycleFilter={documentLifecycleFilter}
            documentQuery={documentQuery}
            documentSortOrder={documentSortOrder}
            documentStatusFilter={documentStatusFilter}
            documentTotalCount={documentTotalCount}
            documents={documents}
            focusedChunkId={focusedDocumentChunkId}
            canManageDocuments={canManageDocuments}
            isRetryAvailable={isRetryAvailable}
            isRetryEligibilityLoading={false}
            isRetryingWorkflow={isRetryingWorkflow}
            isRunningDocumentAction={isRunningDocumentAction}
            isCurrentSurfaceRecommended={Boolean(isCurrentSurfaceRecommended)}
            onBulkDeleteDocuments={handleBulkDeleteDocuments}
            onBulkReindexDocuments={handleBulkReindexDocuments}
            onBulkRestoreDocuments={handleBulkRestoreDocuments}
            onClearDocumentActionSummary={clearDocumentActionSummary}
            onClearUploadFollowUpSummary={clearUploadFollowUpSummary}
            onClearDocumentSelection={clearDocumentSelection}
            onDeleteDocument={handleDeleteDocument}
            onDocumentLifecycleFilterChange={setDocumentLifecycleFilter}
            onDocumentPageChange={setDocumentPage}
            onDocumentQueryChange={setDocumentQuery}
            onDocumentSortOrderChange={setDocumentSortOrder}
            onDocumentStatusFilterChange={setDocumentStatusFilter}
            onActivateRecommendedAgent={handleActivateRecommendedAgent}
            onOpenChatView={openChatView}
            onOpenConsoleControls={() => setShowConsoleControls(true)}
            onOpenFailedDocumentsQueue={showFailedDocumentsQueue}
            onOpenWorkflowView={openWorkflowSupervision}
            onReindexDocument={handleReindexDocument}
            onRestoreDocument={handleRestoreDocument}
            onSelectDocumentVersion={handleSelectDocumentVersion}
            onRetryWorkflowRun={handleRetryWorkflowRun}
            onSelectDocument={handleSelectDocument}
            onSelectWorkflowRun={handleSelectWorkflowRun}
            onShowFailedDocuments={showFailedDocumentsQueue}
            onToggleDocumentSelection={toggleDocumentSelection}
            onToggleSelectAllDocumentsOnPage={toggleSelectAllDocumentsOnPage}
            isLoadingSelectedDocumentActivity={isLoadingSelectedDocumentActivity}
            selectedDocumentActivity={selectedDocumentActivity}
            selectedDocumentDetail={selectedDocumentDetail}
            selectedDocumentId={selectedDocumentId}
            selectedDocumentIds={selectedDocumentIds}
            selectedDocumentRecommendedAgents={selectedDocumentRecommendedAgents}
            uploadFollowUpSummary={uploadFollowUpSummary}
            selectedWorkflowRunDetail={selectedWorkflowRunDetail}
            selectedWorkflowRunId={selectedWorkflowRunId}
            selectedWorkflowRetryDisabledReason={selectedWorkflowRunDetail?.retry_unavailable_reason ?? null}
            workflowRuns={selectedDocumentWorkflowRuns}
          />
          ) : (
            <WorkspaceWorkflowsView
              activeAgentContext={activeAgentContext}
              agentConsoleHref={agentConsoleHref ?? buildAgentsHref({ tenantId: bootstrap?.tenant.id ?? null })}
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
              onOpenDocumentsView={openDocumentsView}
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
      </div>
    </ConsoleShell>
  );
}
