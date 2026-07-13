import type { WorkspaceView } from "@/components/workspace/workspace-types";
import type { UrlObject } from "url";

const DOCUMENT_STATUS_FILTER_VALUES = ["all", "completed", "running", "queued", "failed", "pending"] as const;
const DOCUMENT_SOURCE_FILTER_VALUES = ["all", "file", "web", "other"] as const;
const DOCUMENT_LIFECYCLE_FILTER_VALUES = ["active", "deleted", "all"] as const;
const WORKFLOW_STATUS_FILTER_VALUES = ["all", "completed", "failed", "cancelled", "running", "queued", "pending"] as const;
const WORKFLOW_TYPE_FILTER_VALUES = ["all", "document_ingestion"] as const;
const WORKFLOW_RETRY_MODE_VALUES = ["all", "retries", "originals"] as const;
const DOCUMENT_SORT_VALUES = [
  "updated-desc",
  "created-desc",
  "created-asc",
  "title-asc",
  "title-desc",
  "status-priority"
] as const;
const WORKFLOW_SORT_VALUES = [
  "updated-desc",
  "created-desc",
  "created-asc",
  "status-priority",
  "type-asc"
] as const;
const WORKSPACE_SOURCE_SURFACE_VALUES = ["home", "admin", "operations", "agents", "workspace"] as const;
const WORKSPACE_SOURCE_ADMIN_SECTION_VALUES = ["overview", "directory", "access", "runtime", "security"] as const;
const WORKSPACE_SOURCE_OPERATIONS_LANE_VALUES = ["overview", "failed", "retries", "pressure"] as const;
const WORKSPACE_HANDOFF_INTENT_VALUES = [
  "agent_brief",
  "grounded_validation",
  "document_recovery",
  "workflow_recovery"
] as const;

export type WorkspaceSourceSurface = (typeof WORKSPACE_SOURCE_SURFACE_VALUES)[number];
export type WorkspaceSourceAdminSection = (typeof WORKSPACE_SOURCE_ADMIN_SECTION_VALUES)[number];
export type WorkspaceSourceOperationsLane = (typeof WORKSPACE_SOURCE_OPERATIONS_LANE_VALUES)[number];
export type WorkspaceHandoffIntent = (typeof WORKSPACE_HANDOFF_INTENT_VALUES)[number];

export type WorkspaceNavigationTarget = {
  view?: WorkspaceView | null;
  tenantId?: string | null;
  workspaceId?: string | null;
  knowledgeBaseId?: string | null;
  agentId?: string | null;
  sourceSurface?: WorkspaceSourceSurface | null;
  sourceAdminSection?: WorkspaceSourceAdminSection | null;
  sourceOperationsLane?: WorkspaceSourceOperationsLane | null;
  handoffIntent?: WorkspaceHandoffIntent | null;
  draftQuestion?: string | null;
  conversationId?: string | null;
  conversationQuery?: string | null;
  documentId?: string | null;
  workflowRunId?: string | null;
  documentQuery?: string | null;
  documentSource?: string | null;
  documentLifecycle?: string | null;
  documentStatus?: string | null;
  documentSort?: string | null;
  documentPage?: number | null;
  workflowQuery?: string | null;
  workflowStatus?: string | null;
  workflowType?: string | null;
  workflowRetryMode?: string | null;
  workflowSort?: string | null;
  workflowPage?: number | null;
};

export type WorkspaceLocationState = {
  view: WorkspaceView;
  tenantId: string | null;
  workspaceId: string | null;
  knowledgeBaseId: string | null;
  agentId: string | null;
  sourceSurface: WorkspaceSourceSurface | null;
  sourceAdminSection: WorkspaceSourceAdminSection | null;
  sourceOperationsLane: WorkspaceSourceOperationsLane | null;
  handoffIntent: WorkspaceHandoffIntent | null;
  draftQuestion: string;
  conversationId: string | null;
  conversationQuery: string;
  documentId: string | null;
  workflowRunId: string | null;
  documentQuery: string;
  documentSource: string;
  documentLifecycle: string;
  documentStatus: string;
  documentSort: string;
  documentPage: number;
  workflowQuery: string;
  workflowStatus: string;
  workflowType: string;
  workflowRetryMode: string;
  workflowSort: string;
  workflowPage: number;
};

export type WorkspaceConsolePathname = "/workspace" | "/chat" | "/documents" | "/operations";

export function getWorkspacePathnameForView(view: WorkspaceView | null | undefined): WorkspaceConsolePathname {
  if (view === "chat") {
    return "/chat";
  }

  if (view === "documents") {
    return "/documents";
  }

  if (view === "workflows") {
    return "/operations";
  }

  return "/workspace";
}

export function getWorkspaceViewForPathname(pathname: string): WorkspaceView | null {
  if (pathname === "/chat") {
    return "chat";
  }

  if (pathname === "/documents") {
    return "documents";
  }

  if (pathname === "/operations") {
    return "workflows";
  }

  return pathname === "/workspace" ? "chat" : null;
}

export function readWorkspaceView(value: string | null): WorkspaceView {
  if (value === "documents" || value === "workflows") {
    return value;
  }

  return "chat";
}

function readSelectFilterValue(value: string | null, allowedValues: readonly string[], fallbackValue = "all") {
  if (!value) {
    return fallbackValue;
  }

  return allowedValues.includes(value) ? value : fallbackValue;
}

function setSearchParam(searchParams: URLSearchParams, key: string, value: string | null | undefined) {
  if (value && value.trim().length > 0) {
    searchParams.set(key, value);
    return;
  }

  searchParams.delete(key);
}

function setPositiveIntegerSearchParam(searchParams: URLSearchParams, key: string, value: number | null | undefined) {
  if (typeof value === "number" && Number.isInteger(value) && value > 1) {
    searchParams.set(key, String(value));
    return;
  }

  searchParams.delete(key);
}

function readPositiveInteger(value: string | null, fallbackValue = 1) {
  if (!value) {
    return fallbackValue;
  }

  const parsedValue = Number.parseInt(value, 10);
  return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : fallbackValue;
}

export function applyWorkspaceSearchParams(searchParams: URLSearchParams, target: WorkspaceNavigationTarget) {
  setSearchParam(searchParams, "view", target.view ?? null);
  setSearchParam(searchParams, "tenant_id", target.tenantId ?? null);
  setSearchParam(searchParams, "workspace_id", target.workspaceId ?? null);
  setSearchParam(searchParams, "knowledge_base_id", target.knowledgeBaseId ?? null);
  setSearchParam(searchParams, "agent_id", target.agentId ?? null);
  setSearchParam(searchParams, "source_surface", target.sourceSurface ?? null);
  setSearchParam(searchParams, "source_admin_section", target.sourceAdminSection ?? null);
  setSearchParam(searchParams, "source_operations_lane", target.sourceOperationsLane ?? null);
  setSearchParam(searchParams, "handoff_intent", target.handoffIntent ?? null);
  setSearchParam(searchParams, "draft_question", target.draftQuestion ?? null);
  setSearchParam(searchParams, "conversation_id", target.conversationId ?? null);
  setSearchParam(searchParams, "conversation_query", target.conversationQuery ?? null);
  setSearchParam(searchParams, "document_id", target.documentId ?? null);
  setSearchParam(searchParams, "workflow_run_id", target.workflowRunId ?? null);
  setSearchParam(searchParams, "document_query", target.documentQuery ?? null);
  setSearchParam(searchParams, "document_source", target.documentSource ?? null);
  setSearchParam(searchParams, "document_lifecycle", target.documentLifecycle ?? null);
  setSearchParam(searchParams, "document_status", target.documentStatus ?? null);
  setSearchParam(searchParams, "document_sort", target.documentSort ?? null);
  setPositiveIntegerSearchParam(searchParams, "document_page", target.documentPage);
  setSearchParam(searchParams, "workflow_query", target.workflowQuery ?? null);
  setSearchParam(searchParams, "workflow_status", target.workflowStatus ?? null);
  setSearchParam(searchParams, "workflow_type", target.workflowType ?? null);
  setSearchParam(searchParams, "workflow_retry_mode", target.workflowRetryMode ?? null);
  setSearchParam(searchParams, "workflow_sort", target.workflowSort ?? null);
  setPositiveIntegerSearchParam(searchParams, "workflow_page", target.workflowPage);
  return searchParams;
}

export function buildWorkspaceHref(target: WorkspaceNavigationTarget) {
  const searchParams = applyWorkspaceSearchParams(new URLSearchParams(), target);
  return {
    pathname: target.view ? getWorkspacePathnameForView(target.view) : "/workspace",
    query: Object.fromEntries(searchParams.entries())
  } satisfies UrlObject;
}

export function readWorkspaceLocationState(search: string): WorkspaceLocationState {
  const searchParams = new URLSearchParams(search);
  const sourceSurfaceValue = readSelectFilterValue(
    searchParams.get("source_surface"),
    WORKSPACE_SOURCE_SURFACE_VALUES,
    ""
  );
  const sourceAdminSectionValue = readSelectFilterValue(
    searchParams.get("source_admin_section"),
    WORKSPACE_SOURCE_ADMIN_SECTION_VALUES,
    ""
  );
  const sourceOperationsLaneValue = readSelectFilterValue(
    searchParams.get("source_operations_lane"),
    WORKSPACE_SOURCE_OPERATIONS_LANE_VALUES,
    ""
  );
  const handoffIntentValue = readSelectFilterValue(
    searchParams.get("handoff_intent"),
    WORKSPACE_HANDOFF_INTENT_VALUES,
    ""
  );

  return {
    view: readWorkspaceView(searchParams.get("view")),
    tenantId: searchParams.get("tenant_id"),
    workspaceId: searchParams.get("workspace_id"),
    knowledgeBaseId: searchParams.get("knowledge_base_id"),
    agentId: searchParams.get("agent_id"),
    sourceSurface: sourceSurfaceValue ? (sourceSurfaceValue as WorkspaceSourceSurface) : null,
    sourceAdminSection: sourceAdminSectionValue ? (sourceAdminSectionValue as WorkspaceSourceAdminSection) : null,
    sourceOperationsLane: sourceOperationsLaneValue ? (sourceOperationsLaneValue as WorkspaceSourceOperationsLane) : null,
    handoffIntent: handoffIntentValue ? (handoffIntentValue as WorkspaceHandoffIntent) : null,
    draftQuestion: searchParams.get("draft_question") ?? "",
    conversationId: searchParams.get("conversation_id"),
    conversationQuery: searchParams.get("conversation_query") ?? "",
    documentId: searchParams.get("document_id"),
    workflowRunId: searchParams.get("workflow_run_id"),
    documentQuery: searchParams.get("document_query") ?? "",
    documentSource: readSelectFilterValue(searchParams.get("document_source"), DOCUMENT_SOURCE_FILTER_VALUES),
    documentLifecycle: readSelectFilterValue(
      searchParams.get("document_lifecycle"),
      DOCUMENT_LIFECYCLE_FILTER_VALUES,
      "active"
    ),
    documentStatus: readSelectFilterValue(searchParams.get("document_status"), DOCUMENT_STATUS_FILTER_VALUES),
    documentSort: readSelectFilterValue(searchParams.get("document_sort"), DOCUMENT_SORT_VALUES, "updated-desc"),
    documentPage: readPositiveInteger(searchParams.get("document_page")),
    workflowQuery: searchParams.get("workflow_query") ?? "",
    workflowStatus: readSelectFilterValue(searchParams.get("workflow_status"), WORKFLOW_STATUS_FILTER_VALUES),
    workflowType: readSelectFilterValue(searchParams.get("workflow_type"), WORKFLOW_TYPE_FILTER_VALUES),
    workflowRetryMode: readSelectFilterValue(searchParams.get("workflow_retry_mode"), WORKFLOW_RETRY_MODE_VALUES),
    workflowSort: readSelectFilterValue(searchParams.get("workflow_sort"), WORKFLOW_SORT_VALUES, "updated-desc"),
    workflowPage: readPositiveInteger(searchParams.get("workflow_page"))
  };
}
