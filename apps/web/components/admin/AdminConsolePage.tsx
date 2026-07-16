"use client";

import Link from "next/link";
import {
  Children,
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowRight,
  Bot,
  Boxes,
  Building2,
  Library,
  MoreHorizontal,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";

import { AgentExecutionFollowUpActions } from "@/components/agents/AgentExecutionFollowUpActions";
import { RuntimeResourcesPanel } from "@/components/admin/RuntimeResourcesPanel";
import { AgentRunButtonLink } from "@/components/agents/AgentRunButtonLink";
import { ConsoleShell } from "@/components/console/ConsoleShell";
import { ConsoleActionPacketCard } from "@/components/console/ConsoleActionPacketCard";
import { ConsoleRuntimeTaskPacket } from "@/components/console/ConsoleRuntimeTaskPacket";
import {
  ConsolePage,
  ConsoleSurface,
  ConsoleSurfaceHeader,
  ConsoleToolbar,
} from "@/components/console/ConsolePrimitives";
import { PageTitleSync } from "@/components/console/PageTitleSync";
import { RuntimeBindingSummaryCard } from "@/components/runtime/RuntimeBindingSummaryCard";
import { RuntimePostureCard } from "@/components/runtime/RuntimePostureCard";
import {
  ToolRuntimeSummaryCard,
  readToolRuntimeSummary,
} from "@/components/runtime/ToolRuntimeSummaryCard";
import { ToolRuntimeTraceActions } from "@/components/runtime/ToolRuntimeTraceActions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  EMPTY_AGENT_EXECUTION_METRICS,
  getAgentExecutionOutputKindLabelKey,
  getAgentExecutionStageLabelKey,
  readAgentExecutionEvidenceSummary,
  listAgentExecutionMetrics,
  listAgentExecutions,
  readAgentExecutionRuntimeBindingSummary,
  readAgentExecutionRetrievalSummary,
  readAgentExecutionRuntimeSummary,
  type AgentExecutionMetricsResponse,
  type AgentExecutionResponse,
} from "@/lib/agent-executions";
import { buildAgentExecutionFollowUpActions } from "@/lib/agent-execution-follow-up";
import { authenticatedApiRequest } from "@/lib/authenticated-api";
import {
  EMPTY_AGENT_RUN_METRICS,
  listAgentRunMetrics,
  listAgentRuns,
  type AgentRunRecordInput,
  type AgentRunMetricsResponse,
  type AgentRunResponse,
  type AgentRunTriggerSource,
} from "@/lib/agent-runs";
import {
  buildAgentLaunchPrompts,
  resolveKnowledgeBaseScopeSelection,
} from "@/lib/agent-runtime";
import {
  canUseDirectorySession,
  hasDirectoryCapability,
} from "@/lib/auth/access";
import { useAuth } from "@/lib/auth/provider";
import {
  buildAdminHref,
  buildAgentsHref,
  buildRuntimeGovernanceIssueDefinitionsHref,
  buildOperationsHref,
  buildRuntimeGovernanceEventFollowUp,
  buildRuntimeGovernanceFollowUp,
  buildRuntimeGovernanceWorklistFollowUp,
  buildSettingsHref,
} from "@/lib/console-route-builders";
import { useI18n } from "@/lib/i18n/provider";
import { useStatusNotifications } from "@/lib/notifications/use-status-notifications";
import {
  getDirectoryAuthMode,
  getCurrentUserAccessSummary,
  listUserAccessEvents,
  getUserAccessGovernanceSummary,
  getUserAccessSummary,
  resetDirectoryUserPassword,
  type DirectoryAuthMode,
  type DirectoryCurrentAccessSummary,
  type DirectoryAccessGovernanceSummary,
} from "@/lib/auth-directory";
import {
  formatPlatformGovernanceIssues,
  listRuntimeGovernanceEvents,
  loadModelGovernanceSummary,
  loadPlatformGovernanceSnapshot,
  loadRuntimeGovernanceWorklist,
  type ModelGovernanceSummary,
  type PlatformModelEndpoint,
  type PlatformRetrievalProfile,
  type PlatformToolRegistration,
  type RuntimeGovernanceEvent,
  type RuntimeGovernanceWorklist,
} from "@/lib/platform-governance";
import {
  applyRuntimeGovernanceQuickAction,
  getRuntimeGovernanceQuickActionLabel,
  resolveRuntimeGovernanceEventQuickAction,
  resolveRuntimeGovernanceWorklistQuickAction,
} from "@/lib/runtime-governance-actions";
import {
  readRuntimeGovernanceConnectorPreviewLabel,
  readRuntimeGovernanceModelPreviewLabel,
  readRuntimeGovernancePreviewFailureLabel,
  readRuntimeGovernanceToolPreviewLabel,
} from "@/lib/runtime-governance-preview";
import {
  buildRuntimeGovernanceIssueDefinitionsTarget,
  buildRuntimeGovernanceFollowUpTargetFromItem,
  hasRuntimeGovernanceIssue,
  loadAgentRuntimeGovernance,
  normalizeRuntimeGovernanceProviderType,
  selectFocusedRuntimeGovernanceItem,
  type AgentRuntimeGovernanceItem,
  type AgentRuntimeGovernanceSummary,
} from "@/lib/runtime-governance";
import { useRuntimeHealth } from "@/lib/runtime-health";
import { writeCurrentTenantId } from "@/lib/tenant-scope";
import { buildAdminWorkspaceHref } from "@/lib/workspace-handoffs";
import { cn } from "@/lib/utils";
import { formatTimestamp } from "@/lib/workspace-formatters";
import type {
  ConversationMetrics,
  DocumentMetrics,
  WorkflowMetrics,
} from "@/components/workspace/workspace-types";

const DEFAULT_RETRIEVAL_PROFILE_FILTER_VALUE = "__default_fallback__";
const DISABLED_RETRIEVAL_PROFILE_FILTER_VALUE = "__disabled_assignment__";

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
  description?: string | null;
  is_archived?: boolean;
};

type KnowledgeBase = {
  id: string;
  tenant_id: string;
  workspace_id: string;
  name: string;
  slug: string;
  description?: string | null;
  retrieval_profile_id?: string | null;
  retrieval_profile_name?: string | null;
  publication_status?: string;
};

type TenantWorkspaceGroup = {
  tenant: Tenant;
  workspaces: Workspace[];
};

type AdminDirectoryCache = {
  tenants: Tenant[] | null;
  agentsByTenantId: Record<string, AgentDefinition[]>;
  workspacesByTenantAndLifecycle: Record<string, Workspace[]>;
  knowledgeBasesByWorkspaceAndPublication: Record<string, KnowledgeBase[]>;
};

type AgentDefinition = {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  mode: "grounded_chat" | "document_intake" | "workflow_recovery";
  status: "draft" | "active" | "paused";
  model_strategy: "local_reserved" | "remote_reserved" | "hybrid_reserved";
  model_endpoint_id: string | null;
  objective: string;
  instructions: string;
  knowledge_base_scope: string | null;
  tools: Array<"chat" | "documents" | "operations" | "admin">;
  tool_registration_ids: string[];
  created_at: string;
  updated_at: string;
};

type UserMembership = {
  id: string;
  tenant_id: string;
  tenant_name: string;
  tenant_slug: string;
  membership_status: "active" | "invited" | "suspended";
  invitation_issue_count: number;
  last_invitation_issued_by_user_id: string | null;
  last_invitation_issued_by_display_name: string | null;
  invited_at: string | null;
  invitation_expires_at: string | null;
  activated_at: string | null;
  created_at: string;
  updated_at: string;
};

type UserDirectoryItem = {
  id: string;
  email: string;
  display_name: string;
  is_active: boolean;
  role: "super_admin" | "operator" | "reviewer";
  last_signed_in_at: string | null;
  memberships: UserMembership[];
  created_at: string;
  updated_at: string;
};

type AdminWatchItem = {
  actionHref?: { pathname: string; query: Record<string, string> };
  actionLabel?: string;
  detail: string;
  status: "attention" | "healthy" | "review";
  title: string;
};

type ConsoleLinkHref =
  | ReturnType<typeof buildAdminHref>
  | ReturnType<typeof buildAdminWorkspaceHref>
  | ReturnType<typeof buildAgentsHref>
  | ReturnType<typeof buildOperationsHref>;

type AdminExecutionPacket = {
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

type AdminRuntimeRoute = {
  agent: AgentDefinition;
  definitionHref: ConsoleLinkHref;
  governanceHref: ConsoleLinkHref;
  launchReady: boolean;
  prompt: string;
  retrievalIssue: "missing" | "disabled" | null;
  retrievalProfile: PlatformRetrievalProfile | null;
  retrievalProfileSource: "knowledge_base" | "platform_default" | null;
  recommendedHref: ConsoleLinkHref;
  recommendedRunRecord: AgentRunRecordInput | null;
  resolvedKnowledgeBase: KnowledgeBase | null;
  resolvedWorkspace: Workspace | null;
  scopeLabel: string | null;
  scopeResolved: boolean;
  secondaryHref: ConsoleLinkHref;
  secondaryRunRecord: AgentRunRecordInput | null;
  targetLabel: string;
};

type MembershipInvitationCredential = {
  membership_id: string;
  tenant_id: string;
  tenant_name: string;
  tenant_slug: string;
  membership_status: "active" | "invited" | "suspended";
  invitation_token: string;
  invitation_issue_count: number;
  last_invitation_issued_by_user_id: string | null;
  last_invitation_issued_by_display_name: string | null;
  invited_at: string | null;
  invitation_expires_at: string | null;
  activated_at: string | null;
};

type UserAccessEvent = {
  id: string;
  tenant_id: string | null;
  user_id: string;
  membership_id: string | null;
  actor_user_id: string | null;
  actor_display_name: string | null;
  user_display_name: string | null;
  tenant_name: string | null;
  event_type: string;
  detail_json: Record<string, unknown>;
  created_at: string;
};

type UserActiveSession = {
  id: string;
  authentication_mode: string;
  user_agent: string | null;
  ip_address: string | null;
  device_label: string | null;
  created_at: string;
  updated_at: string;
  expires_at: string;
  is_current: boolean;
};

type UserSessionSecurityModeCount = {
  authentication_mode: string;
  session_count: number;
};

type UserSessionSecuritySummary = {
  total_active_sessions: number;
  other_active_sessions: number;
  expires_within_24_hours: number;
  distinct_device_count: number;
  distinct_ip_count: number;
  oldest_session_started_at: string | null;
  latest_session_expires_at: string | null;
  current_session_started_at: string | null;
  current_session_expires_at: string | null;
  mode_breakdown: UserSessionSecurityModeCount[];
};

type AdminManagementPanel =
  | "tenant-create"
  | "workspace-create"
  | "workspace-edit"
  | "knowledge-base-create"
  | "knowledge-base-edit"
  | "user-create"
  | "user-edit"
  | null;

type AdminSection =
  "overview" | "directory" | "access" | "runtime" | "security";

const WORKSPACE_LIFECYCLE_FILTER_VALUES = [
  "all",
  "active",
  "archived",
] as const;
const KNOWLEDGE_BASE_PUBLICATION_FILTER_VALUES = [
  "all",
  "published",
  "draft",
] as const;
const MEMBER_ACCOUNT_FILTER_VALUES = ["all", "active", "inactive"] as const;
const MEMBER_RELATIONSHIP_FILTER_VALUES = [
  "all",
  "active",
  "invited",
  "suspended",
] as const;
const AUDIT_EVENT_FILTER_VALUES = [
  "all",
  "sign_in_failed",
  "sign_in_succeeded",
  "invitation_activation_failed",
  "sign_out_succeeded",
  "session_revoked",
  "password_changed",
  "password_reset",
  "invitation_issued",
  "invitation_activated",
  "invitation_revoked",
  "membership_active",
  "membership_suspended",
  "membership_deleted",
] as const;
const EMPTY_CONVERSATION_METRICS: ConversationMetrics = {
  total_conversations: 0,
  active_conversations: 0,
  total_messages: 0,
  latest_activity_at: null,
};
const EMPTY_WORKFLOW_METRICS: WorkflowMetrics = {
  total_runs: 0,
  active_runs: 0,
  queued_runs: 0,
  running_runs: 0,
  retry_runs: 0,
  completed_runs: 0,
  failed_runs: 0,
  cancelled_runs: 0,
};
const EMPTY_DOCUMENT_METRICS: DocumentMetrics = {
  total_documents: 0,
  completed_documents: 0,
  active_documents: 0,
  failed_documents: 0,
};
const EMPTY_RUNTIME_GOVERNANCE_SUMMARY: AgentRuntimeGovernanceSummary = {
  totalAgents: 0,
  activeAgents: 0,
  pausedAgents: 0,
  draftAgents: 0,
  attentionAgents: 0,
  readyAgents: 0,
  activeAgentsWithoutScope: 0,
  agentsMissingModel: 0,
  agentsUsingDisabledModel: 0,
  agentsUsingUnconfiguredModel: 0,
  agentsMissingRetrievalProfile: 0,
  agentsUsingDisabledRetrievalProfile: 0,
  agentsMissingToolRegistration: 0,
  agentsUsingDisabledToolRegistration: 0,
  modelEndpoints: 0,
  enabledModels: 0,
  disabledBoundModels: 0,
  unboundEnabledModels: 0,
  toolRegistrations: 0,
  enabledTools: 0,
  approvalGatedTools: 0,
  disabledBoundTools: 0,
  unboundEnabledTools: 0,
  issue_counts: {
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
};

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

const EMPTY_ACCESS_GOVERNANCE_SUMMARY: DirectoryAccessGovernanceSummary = {
  total_members: 0,
  active_accounts: 0,
  inactive_accounts: 0,
  active_memberships: 0,
  invited_memberships: 0,
  suspended_memberships: 0,
  dormant_accounts: 0,
  expiring_invitations: 0,
  expired_invitations: 0,
  recent_failed_sign_in_events: 0,
  members_under_sign_in_lockout: 0,
  recent_failed_invitation_activation_events: 0,
  members_with_failed_invitation_activation: 0,
  members_with_session_spread: 0,
  total_audit_events: 0,
  sensitive_audit_events: 0,
  active_sessions: 0,
  sessions_expiring_within_24_hours: 0,
  review_queue_items: 0,
  event_breakdown: [],
  review_items: [],
};

function slugifyValue(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatAuthenticationModeLabel(
  value: string,
  t: ReturnType<typeof useI18n>["t"],
) {
  if (value === "bootstrap") {
    return t("settings.activity.loginModeBootstrap");
  }

  if (value === "invitation_activation") {
    return t("settings.activity.loginModeInvitationActivation");
  }

  return t("settings.activity.loginModeDirectory");
}

function AdminManagementDialog({
  children,
  description,
  eyebrow,
  onClose,
  title,
}: {
  children: ReactNode;
  description: string;
  eyebrow: string;
  onClose: () => void;
  title: string;
}) {
  let dialogContent = children;
  let dialogFooter: ReactNode = null;
  const rootChildren = Children.toArray(children);
  const rootLayout = rootChildren.length === 1 ? rootChildren[0] : null;

  if (isValidElement(rootLayout) && rootLayout.type === DialogFormLayout) {
    const layoutElement = rootLayout as ReactElement<{ children?: ReactNode }>;
    const layoutChildren = Children.toArray(layoutElement.props.children);
    const footerCandidate = layoutChildren.at(-1);
    if (
      isValidElement(footerCandidate) &&
      footerCandidate.type === DialogFormActions
    ) {
      dialogFooter = footerCandidate;
      dialogContent = cloneElement(
        layoutElement,
        undefined,
        layoutChildren.slice(0, -1),
      );
    }
  }

  return (
    <FormDialog
      description={description}
      eyebrow={eyebrow}
      focusContainerOnOpen
      footer={dialogFooter}
      onClose={onClose}
      open
      presentation="side"
      size="xl"
      title={title}
      titleClassName="text-base"
    >
      {dialogContent}
    </FormDialog>
  );
}

function AdminManagementField({
  children,
  className,
  hint,
  label,
}: {
  children: ReactNode;
  className?: string;
  hint?: string;
  label: string;
}) {
  return (
    <div className={className}>
      <DialogFormField hint={hint} label={label}>
        {children}
      </DialogFormField>
    </div>
  );
}

function readAllowedFilterValue(
  value: string | null,
  allowedValues: readonly string[],
  fallbackValue = "all",
) {
  if (!value) {
    return fallbackValue;
  }

  return allowedValues.includes(value) ? value : fallbackValue;
}

function readAllowedAdminSection(value: string | null): AdminSection {
  if (
    value === "directory" ||
    value === "access" ||
    value === "runtime" ||
    value === "security"
  ) {
    return value;
  }

  return "overview";
}

function readAllowedAdminManagementPanel(
  value: string | null,
): Extract<
  AdminManagementPanel,
  "workspace-edit" | "knowledge-base-edit" | "user-edit"
> | null {
  if (
    value === "workspace-edit" ||
    value === "knowledge-base-edit" ||
    value === "user-edit"
  ) {
    return value;
  }

  return null;
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  return await authenticatedApiRequest<T>(path, init);
}

async function listTenants() {
  return await apiRequest<Tenant[]>("/tenants");
}

async function listAgentDefinitions(tenantId: string) {
  return await apiRequest<AgentDefinition[]>(`/agents?tenant_id=${tenantId}`);
}

async function loadConversationMetrics(tenantId: string) {
  return await apiRequest<ConversationMetrics>(
    `/chat/conversations/metrics?tenant_id=${tenantId}`,
  );
}

async function loadWorkflowMetrics(tenantId: string) {
  return await apiRequest<WorkflowMetrics>(
    `/workflow-runs/metrics?tenant_id=${tenantId}`,
  );
}

async function loadDocumentMetrics(knowledgeBaseId: string) {
  return await apiRequest<DocumentMetrics>(
    `/documents/metrics?knowledge_base_id=${knowledgeBaseId}`,
  );
}

async function setWorkspaceArchiveState(
  workspaceId: string,
  tenantId: string,
  isArchived: boolean,
) {
  return await apiRequest<Workspace>(
    `/workspaces/${workspaceId}/lifecycle?tenant_id=${tenantId}`,
    {
      method: "POST",
      body: JSON.stringify({
        is_archived: isArchived,
      }),
    },
  );
}

async function setKnowledgeBasePublicationState(
  knowledgeBaseId: string,
  workspaceId: string,
  publicationStatus: "draft" | "published",
) {
  return await apiRequest<KnowledgeBase>(
    `/knowledge-bases/${knowledgeBaseId}/publication?workspace_id=${workspaceId}`,
    {
      method: "POST",
      body: JSON.stringify({
        publication_status: publicationStatus,
      }),
    },
  );
}

async function createTenantResource(payload: { name: string; slug: string }) {
  return await apiRequest<Tenant>("/tenants", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

async function createWorkspaceResource(payload: {
  tenant_id: string;
  name: string;
  slug: string;
  description?: string | null;
}) {
  return await apiRequest<Workspace>("/workspaces", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

async function updateWorkspaceResource(
  workspaceId: string,
  tenantId: string,
  payload: { name: string; slug: string; description?: string | null },
) {
  return await apiRequest<Workspace>(
    `/workspaces/${workspaceId}?tenant_id=${tenantId}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
}

async function createKnowledgeBaseResource(payload: {
  tenant_id: string;
  workspace_id: string;
  name: string;
  slug: string;
  description?: string | null;
  retrieval_profile_id?: string | null;
}) {
  return await apiRequest<KnowledgeBase>("/knowledge-bases", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

async function updateKnowledgeBaseResource(
  knowledgeBaseId: string,
  workspaceId: string,
  payload: {
    name: string;
    slug: string;
    description?: string | null;
    retrieval_profile_id?: string | null;
  },
) {
  return await apiRequest<KnowledgeBase>(
    `/knowledge-bases/${knowledgeBaseId}?workspace_id=${workspaceId}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
}

async function listUsers(filters?: {
  tenantId?: string | null;
  membershipStatus?: "active" | "invited" | "suspended" | "all" | null;
  isActive?: "active" | "inactive" | "all" | null;
  query?: string | null;
}) {
  const searchParams = new URLSearchParams();
  if (filters?.tenantId && filters.tenantId !== "all") {
    searchParams.set("tenant_id", filters.tenantId);
  }
  if (filters?.membershipStatus && filters.membershipStatus !== "all") {
    searchParams.set("membership_status", filters.membershipStatus);
  }
  if (filters?.isActive && filters.isActive !== "all") {
    searchParams.set(
      "is_active",
      filters.isActive === "active" ? "true" : "false",
    );
  }
  if (filters?.query && filters.query.trim().length > 0) {
    searchParams.set("query", filters.query.trim());
  }

  const queryString = searchParams.toString();
  return await apiRequest<UserDirectoryItem[]>(
    queryString.length > 0 ? `/users?${queryString}` : "/users",
  );
}

async function createUserDirectoryEntry(payload: {
  display_name: string;
  email: string;
  is_active: boolean;
  role: "super_admin" | "operator" | "reviewer";
  tenant_id?: string;
  membership_status: "active" | "invited" | "suspended";
}) {
  return await apiRequest<UserDirectoryItem>("/users", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

async function createUserMembership(
  userId: string,
  payload: {
    tenant_id: string;
    membership_status: "active" | "invited" | "suspended";
  },
) {
  return await apiRequest<UserDirectoryItem>(`/users/${userId}/memberships`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

async function updateUserMembershipStatus(
  userId: string,
  membershipId: string,
  payload: {
    membership_status: "active" | "invited" | "suspended";
    reason?: string;
  },
) {
  return await apiRequest<UserDirectoryItem>(
    `/users/${userId}/memberships/${membershipId}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
}

async function issueUserMembershipInvitation(
  userId: string,
  membershipId: string,
  reason?: string,
) {
  return await apiRequest<MembershipInvitationCredential>(
    `/users/${userId}/memberships/${membershipId}/invitation`,
    {
      method: "POST",
      body: JSON.stringify({ reason: reason ?? null }),
    },
  );
}

async function revokeUserMembershipInvitation(
  userId: string,
  membershipId: string,
  reason?: string,
) {
  return await apiRequest<UserDirectoryItem>(
    `/users/${userId}/memberships/${membershipId}/revoke-invitation`,
    {
      method: "POST",
      body: JSON.stringify({ reason: reason ?? null }),
    },
  );
}

async function deleteUserMembership(userId: string, membershipId: string) {
  return await apiRequest<UserDirectoryItem>(
    `/users/${userId}/memberships/${membershipId}`,
    {
      method: "DELETE",
    },
  );
}

async function updateUserDirectoryEntry(
  userId: string,
  payload: {
    display_name: string;
    email: string;
    is_active: boolean;
    role?: "super_admin" | "operator" | "reviewer";
  },
) {
  return await apiRequest<UserDirectoryItem>(`/users/${userId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

async function listUserSessions(userId: string) {
  return await apiRequest<UserActiveSession[]>(`/users/${userId}/sessions`);
}

async function getUserSessionSecuritySummary(userId: string) {
  return await apiRequest<UserSessionSecuritySummary>(
    `/users/${userId}/session-security`,
  );
}

async function revokeUserSession(
  userId: string,
  sessionId: string,
  reason?: string,
) {
  await apiRequest<void>(`/users/${userId}/sessions/${sessionId}`, {
    method: "DELETE",
    body: JSON.stringify({ reason: reason ?? null }),
  });
}

async function loadAdminDirectory(
  filters: {
    tenantId: string;
    knowledgeBasePublicationStatusFilter: string;
    workspaceLifecycleFilter: string;
    memberAccountFilter: string;
    memberRelationshipFilter: string;
    auditEventFilter: string;
    query: string;
  },
  options?: { cache?: AdminDirectoryCache; force?: boolean },
) {
  const cache = options?.cache;
  const useCache = Boolean(cache) && !options?.force;
  const tenants =
    useCache && cache?.tenants !== null
      ? (cache?.tenants ?? [])
      : await listTenants();
  if (cache) {
    cache.tenants = tenants;
  }
  const scopedTenants =
    filters.tenantId === "all"
      ? tenants
      : tenants.filter((tenant) => tenant.id === filters.tenantId);
  const users = await listUsers({
    tenantId: filters.tenantId,
    membershipStatus: filters.memberRelationshipFilter as
      "active" | "invited" | "suspended" | "all",
    isActive: filters.memberAccountFilter as "active" | "inactive" | "all",
    query: filters.query,
  });
  const accessGovernanceSummary = await getUserAccessGovernanceSummary({
    tenantId: filters.tenantId,
    membershipStatus: filters.memberRelationshipFilter as
      "active" | "invited" | "suspended" | "all",
    isActive: filters.memberAccountFilter as "active" | "inactive" | "all",
    query: filters.query,
  });
  const agentGroups = await Promise.all(
    scopedTenants.map(async (tenant) => {
      const cachedAgents = useCache
        ? cache?.agentsByTenantId[tenant.id]
        : undefined;
      const agents = cachedAgents ?? (await listAgentDefinitions(tenant.id));
      if (cache && (!useCache || cachedAgents === undefined)) {
        cache.agentsByTenantId[tenant.id] = agents;
      }
      return {
        tenantId: tenant.id,
        agents,
      };
    }),
  );

  const tenantWorkspaceGroups = await Promise.all(
    scopedTenants.map(async (tenant) => {
      const searchParams = new URLSearchParams({ tenant_id: tenant.id });
      if (filters.workspaceLifecycleFilter !== "all") {
        searchParams.set(
          "is_archived",
          filters.workspaceLifecycleFilter === "archived" ? "true" : "false",
        );
      }
      const workspaceCacheKey = `${tenant.id}:${filters.workspaceLifecycleFilter}`;
      const cachedWorkspaces = useCache
        ? cache?.workspacesByTenantAndLifecycle[workspaceCacheKey]
        : undefined;
      const nextWorkspaces =
        cachedWorkspaces ??
        (await apiRequest<Workspace[]>(
          `/workspaces?${searchParams.toString()}`,
        ));
      if (cache && (!useCache || cachedWorkspaces === undefined)) {
        cache.workspacesByTenantAndLifecycle[workspaceCacheKey] =
          nextWorkspaces;
      }

      return {
        tenant,
        workspaces: nextWorkspaces,
      };
    }),
  );

  const workspaces = tenantWorkspaceGroups.flatMap((group) => group.workspaces);
  const knowledgeBaseGroups = await Promise.all(
    workspaces.map(async (workspace) => {
      const searchParams = new URLSearchParams({ workspace_id: workspace.id });
      if (filters.knowledgeBasePublicationStatusFilter !== "all") {
        searchParams.set(
          "publication_status",
          filters.knowledgeBasePublicationStatusFilter,
        );
      }
      const knowledgeBaseCacheKey = `${workspace.id}:${filters.knowledgeBasePublicationStatusFilter}`;
      const cachedKnowledgeBases = useCache
        ? cache?.knowledgeBasesByWorkspaceAndPublication[knowledgeBaseCacheKey]
        : undefined;
      const nextKnowledgeBases =
        cachedKnowledgeBases ??
        (await apiRequest<KnowledgeBase[]>(
          `/knowledge-bases?${searchParams.toString()}`,
        ));
      if (cache && (!useCache || cachedKnowledgeBases === undefined)) {
        cache.knowledgeBasesByWorkspaceAndPublication[knowledgeBaseCacheKey] =
          nextKnowledgeBases;
      }

      return {
        workspaceId: workspace.id,
        knowledgeBases: nextKnowledgeBases,
      };
    }),
  );

  const knowledgeBases = knowledgeBaseGroups.flatMap(
    (group) => group.knowledgeBases,
  );
  const agents = agentGroups.flatMap((group) => group.agents);
  const auditSearchParams = new URLSearchParams();
  if (filters.tenantId !== "all") {
    auditSearchParams.set("tenant_id", filters.tenantId);
  }
  if (filters.auditEventFilter !== "all") {
    auditSearchParams.set("event_type", filters.auditEventFilter);
  }
  if (filters.query.trim().length > 0) {
    auditSearchParams.set("query", filters.query.trim());
  }
  auditSearchParams.set("limit", "12");
  const auditEvents = await apiRequest<UserAccessEvent[]>(
    `/users/audit-events?${auditSearchParams.toString()}`,
  );

  return {
    tenants,
    scopedTenants,
    users,
    tenantWorkspaceGroups,
    workspaces,
    knowledgeBases,
    agents,
    auditEvents,
    accessGovernanceSummary,
  };
}

function getWatchStatusClass(status: AdminWatchItem["status"]) {
  if (status === "attention") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }
  if (status === "review") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function getWorkspaceLifecycleClass(isArchived: boolean | undefined) {
  return isArchived
    ? "border-amber-200 bg-amber-50 text-amber-700"
    : "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function getKnowledgeBasePublicationClass(
  publicationStatus: string | undefined,
) {
  return publicationStatus === "published"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-slate-200 bg-slate-100 text-slate-700";
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

function getRoleLabel(
  role: "super_admin" | "operator" | "reviewer",
  t: (key: string, variables?: Record<string, string>) => string,
) {
  if (role === "super_admin") {
    return t("auth.roles.superAdmin");
  }
  if (role === "reviewer") {
    return t("auth.roles.reviewer");
  }
  return t("auth.roles.operator");
}

function isInvitationExpired(value: string | null) {
  if (!value) {
    return false;
  }

  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return false;
  }

  return timestamp <= Date.now();
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

function getAccessEventLabel(
  eventType: string,
  t: (key: string, variables?: Record<string, string>) => string,
) {
  if (eventType === "sign_in_failed") {
    return t("admin.audit.eventTypes.signInFailed");
  }
  if (eventType === "sign_in_succeeded") {
    return t("admin.audit.eventTypes.signInSucceeded");
  }
  if (eventType === "invitation_activation_failed") {
    return t("admin.audit.eventTypes.invitationActivationFailed");
  }
  if (eventType === "sign_out_succeeded") {
    return t("admin.audit.eventTypes.signOutSucceeded");
  }
  if (eventType === "session_revoked") {
    return t("admin.audit.eventTypes.sessionRevoked");
  }
  if (eventType === "password_changed") {
    return t("admin.audit.eventTypes.passwordChanged");
  }
  if (eventType === "password_reset") {
    return t("admin.audit.eventTypes.passwordReset");
  }
  if (eventType === "invitation_issued") {
    return t("admin.audit.eventTypes.invitationIssued");
  }
  if (eventType === "invitation_activated") {
    return t("admin.audit.eventTypes.invitationActivated");
  }
  if (eventType === "invitation_revoked") {
    return t("admin.audit.eventTypes.invitationRevoked");
  }
  if (eventType === "membership_active") {
    return t("admin.audit.eventTypes.membershipActive");
  }
  if (eventType === "membership_suspended") {
    return t("admin.audit.eventTypes.membershipSuspended");
  }
  if (eventType === "membership_deleted") {
    return t("admin.audit.eventTypes.membershipDeleted");
  }
  return eventType;
}

function buildAuditEventSliceHref(
  eventType: string,
  options: {
    selectedTenantId: string;
    searchQuery: string;
    memberAccountFilter: string;
    memberRelationshipFilter: string;
  },
) {
  return buildAdminHref({
    tenantId: options.selectedTenantId,
    section: "access",
    auditEventFilter: eventType,
    query:
      options.searchQuery.trim().length > 0 ? options.searchQuery.trim() : null,
    memberAccountFilter:
      options.memberAccountFilter !== "all"
        ? options.memberAccountFilter
        : null,
    memberRelationshipFilter:
      options.memberRelationshipFilter !== "all"
        ? options.memberRelationshipFilter
        : null,
  });
}

function getDefaultGovernanceReason(
  action:
    | "issue_invitation"
    | "revoke_invitation"
    | "activate_membership"
    | "suspend_membership",
) {
  if (action === "issue_invitation") {
    return "Issued from Admin Console";
  }
  if (action === "revoke_invitation") {
    return "Revoked from Admin Console";
  }
  if (action === "activate_membership") {
    return "Activated from Admin Console";
  }
  return "Suspended from Admin Console";
}

function readResumeWorkspaceHref(searchParams: URLSearchParams) {
  const value = searchParams.get("resume_workspace")?.trim() ?? "";
  return value.startsWith("/") ? value : null;
}

function readAccessEventReason(event: UserAccessEvent) {
  const reason = event.detail_json.reason;
  return typeof reason === "string" && reason.trim().length > 0 ? reason : null;
}

function readAccessEventRevocationScope(event: UserAccessEvent) {
  const revocationScope = event.detail_json.revocation_scope;
  return typeof revocationScope === "string" &&
    revocationScope.trim().length > 0
    ? revocationScope
    : null;
}

function formatGovernanceTokenLabel(value: string) {
  return value
    .split("_")
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function getRuntimeGovernanceWorklistCategoryLabel(
  category: RuntimeGovernanceWorklist["items"][number]["category"],
  t: (key: string, variables?: Record<string, string>) => string,
) {
  if (category === "unconfigured_model_endpoint") {
    return t("admin.runtimeQueue.categories.unconfiguredModelEndpoint");
  }
  if (category === "disabled_bound_model_endpoint") {
    return t("admin.runtimeQueue.categories.disabledBoundModelEndpoint");
  }
  if (category === "integration_blocked_connector") {
    return t("admin.runtimeQueue.categories.integrationBlockedConnector");
  }
  if (category === "approval_required_tool") {
    return t("admin.runtimeQueue.categories.approvalRequiredTool");
  }
  return t("admin.runtimeQueue.categories.mcpIntegrationPendingTool");
}

function getRuntimeGovernanceActionHintLabel(
  actionHint: string,
  t: (key: string, variables?: Record<string, string>) => string,
) {
  if (actionHint === "complete_model_runtime") {
    return t("admin.runtimeQueue.actions.completeModelRuntime");
  }
  if (actionHint === "restore_model_runtime") {
    return t("admin.runtimeQueue.actions.restoreModelRuntime");
  }
  if (actionHint === "restore_connector_runtime") {
    return t("admin.runtimeQueue.actions.restoreConnectorRuntime");
  }
  if (actionHint === "review_tool_boundary") {
    return t("admin.runtimeQueue.actions.reviewToolBoundary");
  }
  if (actionHint === "complete_mcp_integration") {
    return t("admin.runtimeQueue.actions.completeMcpIntegration");
  }
  return formatGovernanceTokenLabel(actionHint);
}

function getRuntimeGovernanceWorklistPreviewStatusLabel(
  item: RuntimeGovernanceWorklist["items"][number],
  t: (key: string, variables?: Record<string, string>) => string,
) {
  if (item.resource_type === "tool_registration") {
    return readRuntimeGovernanceToolPreviewLabel(
      item,
      t,
      formatTimestamp,
      "admin.runtimeQueue.lastToolPreview",
    );
  }

  if (item.resource_type === "model_endpoint") {
    return readRuntimeGovernanceModelPreviewLabel(
      item,
      t,
      formatTimestamp,
      "admin.runtimeQueue.lastModelPreview",
    );
  }

  if (item.resource_type === "mcp_connector") {
    return readRuntimeGovernanceConnectorPreviewLabel(
      item,
      t,
      formatTimestamp,
      "admin.runtimeQueue.lastConnectorPreview",
    );
  }

  return null;
}

export default function AdminConsolePage() {
  const { language, t } = useI18n();
  const { session, signOut, refreshSession } = useAuth();
  const hasAdminWriteAccess = hasDirectoryCapability(
    session,
    "manage_admin_resources",
  );
  const showAdvancedAdminSections = false;

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [users, setUsers] = useState<UserDirectoryItem[]>([]);
  const [tenantWorkspaceGroups, setTenantWorkspaceGroups] = useState<
    TenantWorkspaceGroup[]
  >([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [agents, setAgents] = useState<AgentDefinition[]>([]);
  const [auditEvents, setAuditEvents] = useState<UserAccessEvent[]>([]);
  const [accessGovernanceSummary, setAccessGovernanceSummary] =
    useState<DirectoryAccessGovernanceSummary>(EMPTY_ACCESS_GOVERNANCE_SUMMARY);
  const [runtimeGovernanceEvents, setRuntimeGovernanceEvents] = useState<
    RuntimeGovernanceEvent[]
  >([]);
  const [runtimeGovernanceWorklist, setRuntimeGovernanceWorklist] =
    useState<RuntimeGovernanceWorklist | null>(null);
  const [adminSection, setAdminSection] = useState<AdminSection>("overview");
  const [selectedTenantId, setSelectedTenantId] = useState<string>("all");
  const [workspaceLifecycleFilter, setWorkspaceLifecycleFilter] =
    useState<string>("all");
  const [
    knowledgeBasePublicationStatusFilter,
    setKnowledgeBasePublicationStatusFilter,
  ] = useState<string>("all");
  const [retrievalProfileFilter, setRetrievalProfileFilter] =
    useState<string>("all");
  const [memberAccountFilter, setMemberAccountFilter] = useState<string>("all");
  const [memberRelationshipFilter, setMemberRelationshipFilter] =
    useState<string>("all");
  const [auditEventFilter, setAuditEventFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusMessage, setStatusMessage] = useState(() =>
    t("admin.status.loading"),
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  useStatusNotifications(statusMessage, errorMessage, { statusTone: "info" });
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);
  const { runtimeHealth, isLoadingRuntimeHealth, runtimeHealthErrorMessage } =
    useRuntimeHealth({
      enabled: Boolean(session),
    });
  const [conversationMetricsByTenantId, setConversationMetricsByTenantId] =
    useState<Record<string, ConversationMetrics>>({});
  const [
    documentMetricsByKnowledgeBaseId,
    setDocumentMetricsByKnowledgeBaseId,
  ] = useState<Record<string, DocumentMetrics>>({});
  const [workflowMetricsByTenantId, setWorkflowMetricsByTenantId] = useState<
    Record<string, WorkflowMetrics>
  >({});
  const [agentRunMetricsByTenantId, setAgentRunMetricsByTenantId] = useState<
    Record<string, AgentRunMetricsResponse>
  >({});
  const [recentAgentRunsByTenantId, setRecentAgentRunsByTenantId] = useState<
    Record<string, AgentRunResponse[]>
  >({});
  const [agentExecutionMetricsByTenantId, setAgentExecutionMetricsByTenantId] =
    useState<Record<string, AgentExecutionMetricsResponse>>({});
  const [recentAgentExecutionsByTenantId, setRecentAgentExecutionsByTenantId] =
    useState<Record<string, AgentExecutionResponse[]>>({});
  const [modelEndpoints, setModelEndpoints] = useState<PlatformModelEndpoint[]>(
    [],
  );
  const [modelGovernanceSummary, setModelGovernanceSummary] =
    useState<ModelGovernanceSummary>(EMPTY_MODEL_GOVERNANCE_SUMMARY);
  const [toolRegistrations, setToolRegistrations] = useState<
    PlatformToolRegistration[]
  >([]);
  const [retrievalProfiles, setRetrievalProfiles] = useState<
    PlatformRetrievalProfile[]
  >([]);
  const [governancePosture, setGovernancePosture] =
    useState<AgentRuntimeGovernanceSummary>(EMPTY_RUNTIME_GOVERNANCE_SUMMARY);
  const [runtimeGovernanceItems, setRuntimeGovernanceItems] = useState<
    AgentRuntimeGovernanceItem[]
  >([]);
  const [activeWorkspaceActionId, setActiveWorkspaceActionId] = useState<
    string | null
  >(null);
  const [activeKnowledgeBaseActionId, setActiveKnowledgeBaseActionId] =
    useState<string | null>(null);
  const [activeUserActionId, setActiveUserActionId] = useState<string | null>(
    null,
  );
  const [activeMembershipActionId, setActiveMembershipActionId] = useState<
    string | null
  >(null);
  const [
    revealedInvitationByMembershipId,
    setRevealedInvitationByMembershipId,
  ] = useState<Record<string, MembershipInvitationCredential>>({});
  const [managementPanel, setManagementPanel] =
    useState<AdminManagementPanel>(null);
  const [isCreatingResource, setIsCreatingResource] = useState(false);
  const [isUpdatingResource, setIsUpdatingResource] = useState(false);
  const [createTenantName, setCreateTenantName] = useState("");
  const [createTenantSlug, setCreateTenantSlug] = useState("");
  const [createWorkspaceTenantId, setCreateWorkspaceTenantId] = useState("");
  const [createWorkspaceName, setCreateWorkspaceName] = useState("");
  const [createWorkspaceSlug, setCreateWorkspaceSlug] = useState("");
  const [createWorkspaceDescription, setCreateWorkspaceDescription] =
    useState("");
  const [createKnowledgeBaseWorkspaceId, setCreateKnowledgeBaseWorkspaceId] =
    useState("");
  const [createKnowledgeBaseName, setCreateKnowledgeBaseName] = useState("");
  const [createKnowledgeBaseSlug, setCreateKnowledgeBaseSlug] = useState("");
  const [createKnowledgeBaseDescription, setCreateKnowledgeBaseDescription] =
    useState("");
  const [
    createKnowledgeBaseRetrievalProfileId,
    setCreateKnowledgeBaseRetrievalProfileId,
  ] = useState("");
  const [editingWorkspaceId, setEditingWorkspaceId] = useState<string | null>(
    null,
  );
  const [pendingWorkspaceFocusId, setPendingWorkspaceFocusId] = useState<
    string | null
  >(null);
  const [editWorkspaceTenantId, setEditWorkspaceTenantId] = useState("");
  const [editWorkspaceName, setEditWorkspaceName] = useState("");
  const [editWorkspaceSlug, setEditWorkspaceSlug] = useState("");
  const [editWorkspaceDescription, setEditWorkspaceDescription] = useState("");
  const [editingKnowledgeBaseId, setEditingKnowledgeBaseId] = useState<
    string | null
  >(null);
  const [pendingKnowledgeBaseFocusId, setPendingKnowledgeBaseFocusId] =
    useState<string | null>(null);
  const [editKnowledgeBaseWorkspaceId, setEditKnowledgeBaseWorkspaceId] =
    useState("");
  const [editKnowledgeBaseName, setEditKnowledgeBaseName] = useState("");
  const [editKnowledgeBaseSlug, setEditKnowledgeBaseSlug] = useState("");
  const [editKnowledgeBaseDescription, setEditKnowledgeBaseDescription] =
    useState("");
  const [
    editKnowledgeBaseRetrievalProfileId,
    setEditKnowledgeBaseRetrievalProfileId,
  ] = useState("");
  const [createUserDisplayName, setCreateUserDisplayName] = useState("");
  const [createUserEmail, setCreateUserEmail] = useState("");
  const [createUserTenantId, setCreateUserTenantId] = useState("none");
  const [createUserMembershipStatus, setCreateUserMembershipStatus] = useState<
    "active" | "invited" | "suspended"
  >("invited");
  const [createUserRole, setCreateUserRole] = useState<
    "super_admin" | "operator" | "reviewer"
  >("operator");
  const [directoryAuthMode, setDirectoryAuthMode] =
    useState<DirectoryAuthMode | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [pendingUserFocusId, setPendingUserFocusId] = useState<string | null>(
    null,
  );
  const [resumeWorkspaceHref, setResumeWorkspaceHref] = useState<string | null>(
    null,
  );
  const [editUserDisplayName, setEditUserDisplayName] = useState("");
  const [editUserEmail, setEditUserEmail] = useState("");
  const [editUserIsActive, setEditUserIsActive] = useState<
    "active" | "inactive"
  >("active");
  const [editUserRole, setEditUserRole] = useState<
    "super_admin" | "operator" | "reviewer"
  >("operator");
  const [editUserResetPassword, setEditUserResetPassword] = useState("");
  const [editUserResetPasswordConfirm, setEditUserResetPasswordConfirm] =
    useState("");
  const [editUserResetPasswordReason, setEditUserResetPasswordReason] =
    useState("");
  const [isResettingEditingUserPassword, setIsResettingEditingUserPassword] =
    useState(false);
  const [editingUserSessions, setEditingUserSessions] = useState<
    UserActiveSession[]
  >([]);
  const [
    editingUserSessionSecuritySummary,
    setEditingUserSessionSecuritySummary,
  ] = useState<UserSessionSecuritySummary | null>(null);
  const [editingUserAccessSummary, setEditingUserAccessSummary] =
    useState<DirectoryCurrentAccessSummary | null>(null);
  const [editingUserAccessEvents, setEditingUserAccessEvents] = useState<
    UserAccessEvent[]
  >([]);
  const [editingUserAccessEventFilter, setEditingUserAccessEventFilter] =
    useState<(typeof AUDIT_EVENT_FILTER_VALUES)[number]>("all");
  const [editingUserAccessSearchQuery, setEditingUserAccessSearchQuery] =
    useState("");
  const [
    isLoadingEditingUserAccessEvents,
    setIsLoadingEditingUserAccessEvents,
  ] = useState(false);
  const [
    editingUserAccessEventsErrorMessage,
    setEditingUserAccessEventsErrorMessage,
  ] = useState<string | null>(null);
  const [isLoadingEditingUserSessions, setIsLoadingEditingUserSessions] =
    useState(false);
  const [editingUserSessionsErrorMessage, setEditingUserSessionsErrorMessage] =
    useState<string | null>(null);
  const [activeUserSessionActionId, setActiveUserSessionActionId] = useState<
    string | null
  >(null);
  const [currentActorAccessSummary, setCurrentActorAccessSummary] =
    useState<DirectoryCurrentAccessSummary | null>(null);
  const [
    runtimeGovernanceQueueCategoryFilter,
    setRuntimeGovernanceQueueCategoryFilter,
  ] = useState("all");
  const [
    runtimeGovernanceQueueSeverityFilter,
    setRuntimeGovernanceQueueSeverityFilter,
  ] = useState("all");
  const [
    runtimeGovernanceQueueResourceFilter,
    setRuntimeGovernanceQueueResourceFilter,
  ] = useState("all");
  const [runtimeGovernanceSearchQuery, setRuntimeGovernanceSearchQuery] =
    useState("");
  const [runtimeGovernanceActionFilter, setRuntimeGovernanceActionFilter] =
    useState("all");
  const [
    runtimeGovernanceActorRoleFilter,
    setRuntimeGovernanceActorRoleFilter,
  ] = useState("all");
  const [activeRuntimeGovernanceActionId, setActiveRuntimeGovernanceActionId] =
    useState<string | null>(null);
  const adminDirectoryCacheRef = useRef<AdminDirectoryCache>({
    tenants: null,
    agentsByTenantId: {},
    workspacesByTenantAndLifecycle: {},
    knowledgeBasesByWorkspaceAndPublication: {},
  });

  async function syncCurrentSessionFromDirectoryUser(user: UserDirectoryItem) {
    if (!session?.userId || session.userId !== user.id) {
      return;
    }

    if (
      !user.is_active ||
      !canUseDirectorySession(user.role, user.memberships)
    ) {
      signOut(!user.is_active ? "inactive_account" : "inactive_membership");
      return;
    }

    await refreshSession();
  }

  useEffect(() => {
    async function loadDirectoryAuthModeBoundary() {
      try {
        const authMode = await getDirectoryAuthMode();
        setDirectoryAuthMode(authMode);
      } catch {
        setDirectoryAuthMode(null);
      }
    }

    void loadDirectoryAuthModeBoundary();
  }, []);

  useEffect(() => {
    function applyLocationState() {
      const searchParams = new URLSearchParams(window.location.search);
      const requestedManagementPanel = readAllowedAdminManagementPanel(
        searchParams.get("management_panel"),
      );
      const requestedSection = readAllowedAdminSection(
        searchParams.get("section"),
      );
      const normalizedRequestedSection =
        !showAdvancedAdminSections && requestedSection === "security"
          ? "access"
          : requestedSection;
      const requestedWorkspaceId =
        searchParams.get("workspace_id")?.trim() ?? "";
      const requestedKnowledgeBaseId =
        searchParams.get("knowledge_base_id")?.trim() ?? "";
      const requestedUserId = searchParams.get("user_id")?.trim() ?? "";
      const requestedRuntimeResource =
        searchParams.get("runtime_resource")?.trim() ?? "";
      const requestedRuntimeTarget =
        searchParams.get("model_endpoint_id")?.trim() ||
        searchParams.get("tool_registration_id")?.trim() ||
        searchParams.get("retrieval_profile_id")?.trim() ||
        searchParams.get("mcp_connector_id")?.trim() ||
        searchParams.get("mcp_connector_slug")?.trim() ||
        "";
      setAdminSection(
        requestedManagementPanel === "workspace-edit" && requestedWorkspaceId
          ? "directory"
          : requestedManagementPanel === "knowledge-base-edit" &&
              requestedKnowledgeBaseId
            ? "directory"
            : requestedManagementPanel === "user-edit" && requestedUserId
              ? "access"
              : normalizedRequestedSection,
      );
      setSelectedTenantId(searchParams.get("tenant_id") ?? "all");
      setWorkspaceLifecycleFilter(
        readAllowedFilterValue(
          searchParams.get("workspace_lifecycle"),
          WORKSPACE_LIFECYCLE_FILTER_VALUES,
        ),
      );
      setKnowledgeBasePublicationStatusFilter(
        readAllowedFilterValue(
          searchParams.get("knowledge_base_publication"),
          KNOWLEDGE_BASE_PUBLICATION_FILTER_VALUES,
        ),
      );
      setRetrievalProfileFilter(searchParams.get("retrieval_profile") ?? "all");
      setMemberAccountFilter(
        readAllowedFilterValue(
          searchParams.get("member_account"),
          MEMBER_ACCOUNT_FILTER_VALUES,
        ),
      );
      setMemberRelationshipFilter(
        readAllowedFilterValue(
          searchParams.get("member_relationship"),
          MEMBER_RELATIONSHIP_FILTER_VALUES,
        ),
      );
      setAuditEventFilter(
        readAllowedFilterValue(
          searchParams.get("audit_event"),
          AUDIT_EVENT_FILTER_VALUES,
        ),
      );
      setRuntimeGovernanceQueueResourceFilter(
        [
          "model_endpoint",
          "tool_registration",
          "retrieval_profile",
          "mcp_connector",
        ].includes(requestedRuntimeResource)
          ? requestedRuntimeResource
          : "all",
      );
      setRuntimeGovernanceSearchQuery(requestedRuntimeTarget);
      setPendingWorkspaceFocusId(
        requestedManagementPanel === "workspace-edit" && requestedWorkspaceId
          ? requestedWorkspaceId
          : null,
      );
      setPendingKnowledgeBaseFocusId(
        requestedManagementPanel === "knowledge-base-edit" &&
          requestedKnowledgeBaseId
          ? requestedKnowledgeBaseId
          : null,
      );
      setPendingUserFocusId(
        requestedManagementPanel === "user-edit" && requestedUserId
          ? requestedUserId
          : null,
      );
      setSearchQuery(searchParams.get("query") ?? "");
      setResumeWorkspaceHref(readResumeWorkspaceHref(searchParams));
    }

    applyLocationState();
    window.addEventListener("popstate", applyLocationState);

    return () => {
      window.removeEventListener("popstate", applyLocationState);
    };
  }, []);

  useEffect(() => {
    const nextUrl = new URL(window.location.href);
    if (adminSection !== "overview") {
      nextUrl.searchParams.set("section", adminSection);
    } else {
      nextUrl.searchParams.delete("section");
    }
    if (selectedTenantId !== "all") {
      nextUrl.searchParams.set("tenant_id", selectedTenantId);
    } else {
      nextUrl.searchParams.delete("tenant_id");
    }
    if (workspaceLifecycleFilter !== "all") {
      nextUrl.searchParams.set("workspace_lifecycle", workspaceLifecycleFilter);
    } else {
      nextUrl.searchParams.delete("workspace_lifecycle");
    }
    if (knowledgeBasePublicationStatusFilter !== "all") {
      nextUrl.searchParams.set(
        "knowledge_base_publication",
        knowledgeBasePublicationStatusFilter,
      );
    } else {
      nextUrl.searchParams.delete("knowledge_base_publication");
    }
    if (retrievalProfileFilter !== "all") {
      nextUrl.searchParams.set("retrieval_profile", retrievalProfileFilter);
    } else {
      nextUrl.searchParams.delete("retrieval_profile");
    }
    if (memberAccountFilter !== "all") {
      nextUrl.searchParams.set("member_account", memberAccountFilter);
    } else {
      nextUrl.searchParams.delete("member_account");
    }
    if (memberRelationshipFilter !== "all") {
      nextUrl.searchParams.set("member_relationship", memberRelationshipFilter);
    } else {
      nextUrl.searchParams.delete("member_relationship");
    }
    if (auditEventFilter !== "all") {
      nextUrl.searchParams.set("audit_event", auditEventFilter);
    } else {
      nextUrl.searchParams.delete("audit_event");
    }
    if (managementPanel === "workspace-edit" && editingWorkspaceId) {
      nextUrl.searchParams.set("management_panel", "workspace-edit");
      nextUrl.searchParams.set("workspace_id", editingWorkspaceId);
      nextUrl.searchParams.delete("knowledge_base_id");
      nextUrl.searchParams.delete("user_id");
    } else if (
      managementPanel === "knowledge-base-edit" &&
      editingKnowledgeBaseId
    ) {
      nextUrl.searchParams.set("management_panel", "knowledge-base-edit");
      nextUrl.searchParams.set("knowledge_base_id", editingKnowledgeBaseId);
      nextUrl.searchParams.delete("workspace_id");
      nextUrl.searchParams.delete("user_id");
    } else if (managementPanel === "user-edit" && editingUserId) {
      nextUrl.searchParams.set("management_panel", "user-edit");
      nextUrl.searchParams.set("user_id", editingUserId);
      nextUrl.searchParams.delete("workspace_id");
      nextUrl.searchParams.delete("knowledge_base_id");
    } else if (pendingWorkspaceFocusId) {
      nextUrl.searchParams.set("management_panel", "workspace-edit");
      nextUrl.searchParams.set("workspace_id", pendingWorkspaceFocusId);
      nextUrl.searchParams.delete("knowledge_base_id");
      nextUrl.searchParams.delete("user_id");
    } else if (pendingKnowledgeBaseFocusId) {
      nextUrl.searchParams.set("management_panel", "knowledge-base-edit");
      nextUrl.searchParams.set(
        "knowledge_base_id",
        pendingKnowledgeBaseFocusId,
      );
      nextUrl.searchParams.delete("workspace_id");
      nextUrl.searchParams.delete("user_id");
    } else if (pendingUserFocusId) {
      nextUrl.searchParams.set("management_panel", "user-edit");
      nextUrl.searchParams.set("user_id", pendingUserFocusId);
      nextUrl.searchParams.delete("workspace_id");
      nextUrl.searchParams.delete("knowledge_base_id");
    } else {
      nextUrl.searchParams.delete("management_panel");
      nextUrl.searchParams.delete("workspace_id");
      nextUrl.searchParams.delete("knowledge_base_id");
      nextUrl.searchParams.delete("user_id");
    }
    if (searchQuery.trim().length > 0) {
      nextUrl.searchParams.set("query", searchQuery.trim());
    } else {
      nextUrl.searchParams.delete("query");
    }
    window.history.replaceState({}, "", nextUrl);
  }, [
    adminSection,
    selectedTenantId,
    workspaceLifecycleFilter,
    knowledgeBasePublicationStatusFilter,
    retrievalProfileFilter,
    memberAccountFilter,
    memberRelationshipFilter,
    auditEventFilter,
    managementPanel,
    editingWorkspaceId,
    editingKnowledgeBaseId,
    editingUserId,
    pendingWorkspaceFocusId,
    pendingKnowledgeBaseFocusId,
    pendingUserFocusId,
    searchQuery,
  ]);

  useEffect(() => {
    if (
      !pendingWorkspaceFocusId ||
      !hasAdminWriteAccess ||
      workspaces.length === 0
    ) {
      return;
    }

    const targetWorkspace = workspaces.find(
      (workspace) => workspace.id === pendingWorkspaceFocusId,
    );
    if (!targetWorkspace) {
      return;
    }

    if (adminSection !== "directory") {
      setAdminSection("directory");
      return;
    }

    if (selectedTenantId !== targetWorkspace.tenant_id) {
      setSelectedTenantId(targetWorkspace.tenant_id);
      return;
    }

    if (
      managementPanel !== "workspace-edit" ||
      editingWorkspaceId !== targetWorkspace.id
    ) {
      openWorkspaceEditPanel(targetWorkspace);
    }
    setPendingWorkspaceFocusId(null);
  }, [
    adminSection,
    editingWorkspaceId,
    hasAdminWriteAccess,
    managementPanel,
    pendingWorkspaceFocusId,
    selectedTenantId,
    workspaces,
  ]);

  useEffect(() => {
    if (
      !pendingKnowledgeBaseFocusId ||
      !hasAdminWriteAccess ||
      knowledgeBases.length === 0
    ) {
      return;
    }

    const targetKnowledgeBase = knowledgeBases.find(
      (knowledgeBase) => knowledgeBase.id === pendingKnowledgeBaseFocusId,
    );
    if (!targetKnowledgeBase) {
      return;
    }

    if (adminSection !== "directory") {
      setAdminSection("directory");
      return;
    }

    if (selectedTenantId !== targetKnowledgeBase.tenant_id) {
      setSelectedTenantId(targetKnowledgeBase.tenant_id);
      return;
    }

    if (
      managementPanel !== "knowledge-base-edit" ||
      editingKnowledgeBaseId !== targetKnowledgeBase.id
    ) {
      openKnowledgeBaseEditPanel(targetKnowledgeBase);
    }
    setPendingKnowledgeBaseFocusId(null);
  }, [
    adminSection,
    editingKnowledgeBaseId,
    hasAdminWriteAccess,
    knowledgeBases,
    managementPanel,
    pendingKnowledgeBaseFocusId,
    selectedTenantId,
  ]);

  useEffect(() => {
    if (!pendingUserFocusId || !hasAdminWriteAccess || users.length === 0) {
      return;
    }

    const targetUser = users.find((user) => user.id === pendingUserFocusId);
    if (!targetUser) {
      return;
    }

    if (adminSection !== "access") {
      setAdminSection("access");
      return;
    }

    if (managementPanel !== "user-edit" || editingUserId !== targetUser.id) {
      openUserEditPanel(targetUser);
    }
    setPendingUserFocusId(null);
  }, [
    adminSection,
    editingUserId,
    hasAdminWriteAccess,
    managementPanel,
    pendingUserFocusId,
    users,
  ]);

  useEffect(() => {
    if (
      managementPanel !== "user-edit" ||
      !editingUserId ||
      !hasAdminWriteAccess
    ) {
      setEditingUserSessions([]);
      setEditingUserSessionSecuritySummary(null);
      setEditingUserAccessSummary(null);
      setEditingUserAccessEvents([]);
      setEditingUserAccessEventsErrorMessage(null);
      setIsLoadingEditingUserAccessEvents(false);
      setEditingUserSessionsErrorMessage(null);
      setIsLoadingEditingUserSessions(false);
      return;
    }

    const targetUserId = editingUserId;
    let isCancelled = false;

    async function loadEditingUserSessions() {
      try {
        setIsLoadingEditingUserSessions(true);
        setIsLoadingEditingUserAccessEvents(true);
        setEditingUserSessionsErrorMessage(null);
        setEditingUserAccessEventsErrorMessage(null);
        const [sessions, summary, accessSummary, accessEvents] =
          await Promise.all([
            listUserSessions(targetUserId),
            getUserSessionSecuritySummary(targetUserId),
            getUserAccessSummary(targetUserId),
            listUserAccessEvents(targetUserId, {
              eventType: editingUserAccessEventFilter,
              query: editingUserAccessSearchQuery,
              limit: 12,
            }),
          ]);
        if (!isCancelled) {
          setEditingUserSessions(sessions);
          setEditingUserSessionSecuritySummary(summary);
          setEditingUserAccessSummary(accessSummary);
          setEditingUserAccessEvents(accessEvents);
        }
      } catch (error) {
        if (!isCancelled) {
          const resolvedMessage =
            error instanceof Error
              ? error.message
              : t("admin.members.sessionsLoadFailed");
          setEditingUserSessionsErrorMessage(resolvedMessage);
          setEditingUserAccessEventsErrorMessage(resolvedMessage);
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingEditingUserSessions(false);
          setIsLoadingEditingUserAccessEvents(false);
        }
      }
    }

    void loadEditingUserSessions();

    return () => {
      isCancelled = true;
    };
  }, [
    editingUserAccessEventFilter,
    editingUserAccessSearchQuery,
    editingUserId,
    hasAdminWriteAccess,
    lastRefreshedAt,
    managementPanel,
    t,
  ]);

  const refreshEditingUserSessions = useCallback(
    async (userId: string) => {
      setIsLoadingEditingUserSessions(true);
      setIsLoadingEditingUserAccessEvents(true);
      setEditingUserSessionsErrorMessage(null);
      setEditingUserAccessEventsErrorMessage(null);

      try {
        const [sessions, summary, accessSummary, accessEvents] =
          await Promise.all([
            listUserSessions(userId),
            getUserSessionSecuritySummary(userId),
            getUserAccessSummary(userId),
            listUserAccessEvents(userId, {
              eventType: editingUserAccessEventFilter,
              query: editingUserAccessSearchQuery,
              limit: 12,
            }),
          ]);
        setEditingUserSessions(sessions);
        setEditingUserSessionSecuritySummary(summary);
        setEditingUserAccessSummary(accessSummary);
        setEditingUserAccessEvents(accessEvents);
      } catch (error) {
        const resolvedMessage =
          error instanceof Error
            ? error.message
            : t("admin.members.sessionsLoadFailed");
        setEditingUserSessionsErrorMessage(resolvedMessage);
        setEditingUserAccessEventsErrorMessage(resolvedMessage);
      } finally {
        setIsLoadingEditingUserSessions(false);
        setIsLoadingEditingUserAccessEvents(false);
      }
    },
    [editingUserAccessEventFilter, editingUserAccessSearchQuery, t],
  );

  useEffect(() => {
    if (!session?.userId) {
      setCurrentActorAccessSummary(null);
      return;
    }

    let isCancelled = false;

    async function loadCurrentActorAccessSummary() {
      try {
        const accessSummary = await getCurrentUserAccessSummary();
        if (!isCancelled) {
          setCurrentActorAccessSummary(accessSummary);
        }
      } catch {
        if (!isCancelled) {
          setCurrentActorAccessSummary(null);
        }
      }
    }

    void loadCurrentActorAccessSummary();

    return () => {
      isCancelled = true;
    };
  }, [lastRefreshedAt, session?.userId]);

  const handleApplyRuntimeGovernanceQueueAction = useCallback(
    async (item: RuntimeGovernanceWorklist["items"][number]) => {
      if (!hasAdminWriteAccess) {
        return;
      }

      const quickActionKey = resolveRuntimeGovernanceWorklistQuickAction(item);
      if (!quickActionKey) {
        return;
      }

      try {
        setActiveRuntimeGovernanceActionId(item.resource_id);
        setErrorMessage(null);
        const response = await applyRuntimeGovernanceQuickAction(
          item.resource_id,
          quickActionKey,
        );
        setStatusMessage(response.summary);

        await refreshAdminDirectory(true);
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : t("admin.runtimeQueue.actions.applyFailed"),
        );
        setStatusMessage(t("admin.runtimeQueue.actions.applyFailed"));
      } finally {
        setActiveRuntimeGovernanceActionId(null);
      }
    },
    [hasAdminWriteAccess, t],
  );

  const handleApplyRuntimeGovernanceEventAction = useCallback(
    async (event: RuntimeGovernanceEvent) => {
      if (!hasAdminWriteAccess || !event.resource_id) {
        return;
      }

      const quickActionKey = resolveRuntimeGovernanceEventQuickAction(event);
      if (!quickActionKey) {
        return;
      }

      try {
        setActiveRuntimeGovernanceActionId(event.resource_id);
        setErrorMessage(null);
        const response = await applyRuntimeGovernanceQuickAction(
          event.resource_id,
          quickActionKey,
        );
        setStatusMessage(response.summary);

        await refreshAdminDirectory(true);
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : t("admin.runtimeQueue.actions.applyFailed"),
        );
        setStatusMessage(t("admin.runtimeQueue.actions.applyFailed"));
      } finally {
        setActiveRuntimeGovernanceActionId(null);
      }
    },
    [hasAdminWriteAccess, t],
  );

  async function refreshAdminDirectory(force = false) {
    setIsLoading(true);
    setErrorMessage(null);
    setStatusMessage(t("admin.status.refreshing"));

    try {
      const directory = await loadAdminDirectory(
        {
          tenantId: selectedTenantId,
          knowledgeBasePublicationStatusFilter,
          workspaceLifecycleFilter,
          memberAccountFilter,
          memberRelationshipFilter,
          auditEventFilter,
          query: searchQuery,
        },
        {
          cache: adminDirectoryCacheRef.current,
          force,
        },
      );
      const [
        conversationMetricEntries,
        documentMetricEntries,
        workflowMetricEntries,
        agentRunMetricEntries,
        recentAgentRunEntries,
        agentExecutionMetricEntries,
        recentAgentExecutionEntries,
        governanceSnapshot,
        modelGovernanceSummary,
        runtimeGovernance,
        runtimeGovernanceQueue,
        runtimeGovernanceEvents,
      ] = await Promise.all([
        Promise.all(
          directory.scopedTenants.map(
            async (tenant) =>
              [tenant.id, await loadConversationMetrics(tenant.id)] as const,
          ),
        ),
        Promise.all(
          directory.knowledgeBases.map(
            async (knowledgeBase) =>
              [
                knowledgeBase.id,
                await loadDocumentMetrics(knowledgeBase.id),
              ] as const,
          ),
        ),
        Promise.all(
          directory.scopedTenants.map(
            async (tenant) =>
              [tenant.id, await loadWorkflowMetrics(tenant.id)] as const,
          ),
        ),
        Promise.all(
          directory.scopedTenants.map(
            async (tenant) =>
              [tenant.id, await listAgentRunMetrics(tenant.id)] as const,
          ),
        ),
        Promise.all(
          directory.scopedTenants.map(
            async (tenant) =>
              [tenant.id, await listAgentRuns(tenant.id, null, 4)] as const,
          ),
        ),
        Promise.all(
          directory.scopedTenants.map(
            async (tenant) =>
              [tenant.id, await listAgentExecutionMetrics(tenant.id)] as const,
          ),
        ),
        Promise.all(
          directory.scopedTenants.map(
            async (tenant) =>
              [
                tenant.id,
                await listAgentExecutions(tenant.id, null, 4),
              ] as const,
          ),
        ),
        loadPlatformGovernanceSnapshot(),
        loadModelGovernanceSummary(),
        loadAgentRuntimeGovernance({
          tenant_id: selectedTenantId === "all" ? null : selectedTenantId,
          status: "active",
        }),
        loadRuntimeGovernanceWorklist({
          limit: 8,
          category:
            runtimeGovernanceQueueCategoryFilter !== "all"
              ? (runtimeGovernanceQueueCategoryFilter as RuntimeGovernanceWorklist["items"][number]["category"])
              : undefined,
          severity:
            runtimeGovernanceQueueSeverityFilter !== "all"
              ? (runtimeGovernanceQueueSeverityFilter as "review" | "attention")
              : undefined,
          resource_type:
            runtimeGovernanceQueueResourceFilter !== "all"
              ? (runtimeGovernanceQueueResourceFilter as
                  "model_endpoint" | "tool_registration" | "mcp_connector")
              : undefined,
          query: runtimeGovernanceSearchQuery.trim() || undefined,
        }),
        listRuntimeGovernanceEvents({
          limit: 8,
          resource_type:
            runtimeGovernanceQueueResourceFilter !== "all"
              ? (runtimeGovernanceQueueResourceFilter as
                  "model_endpoint" | "tool_registration" | "mcp_connector")
              : undefined,
          action_type:
            runtimeGovernanceActionFilter !== "all"
              ? runtimeGovernanceActionFilter
              : undefined,
          actor_role:
            runtimeGovernanceActorRoleFilter !== "all"
              ? (runtimeGovernanceActorRoleFilter as
                  "super_admin" | "operator" | "reviewer")
              : undefined,
          query: runtimeGovernanceSearchQuery.trim() || undefined,
        }),
      ]);
      setTenants(directory.tenants);
      setUsers(directory.users);
      setTenantWorkspaceGroups(directory.tenantWorkspaceGroups);
      setWorkspaces(directory.workspaces);
      setKnowledgeBases(directory.knowledgeBases);
      setAgents(directory.agents);
      setAuditEvents(directory.auditEvents);
      setAccessGovernanceSummary(directory.accessGovernanceSummary);
      setConversationMetricsByTenantId(
        Object.fromEntries(conversationMetricEntries),
      );
      setDocumentMetricsByKnowledgeBaseId(
        Object.fromEntries(documentMetricEntries),
      );
      setWorkflowMetricsByTenantId(Object.fromEntries(workflowMetricEntries));
      setAgentRunMetricsByTenantId(Object.fromEntries(agentRunMetricEntries));
      setRecentAgentRunsByTenantId(Object.fromEntries(recentAgentRunEntries));
      setAgentExecutionMetricsByTenantId(
        Object.fromEntries(agentExecutionMetricEntries),
      );
      setRecentAgentExecutionsByTenantId(
        Object.fromEntries(recentAgentExecutionEntries),
      );
      setModelEndpoints(governanceSnapshot.modelEndpoints);
      setModelGovernanceSummary(modelGovernanceSummary);
      setToolRegistrations(governanceSnapshot.toolRegistrations);
      setRetrievalProfiles(governanceSnapshot.retrievalProfiles);
      setGovernancePosture(runtimeGovernance.summary);
      setRuntimeGovernanceItems(runtimeGovernance.items);
      setRuntimeGovernanceWorklist(runtimeGovernanceQueue);
      setRuntimeGovernanceEvents(runtimeGovernanceEvents);
      setLastRefreshedAt(new Date().toISOString());
      if (governanceSnapshot.issues.length > 0) {
        setErrorMessage(
          formatPlatformGovernanceIssues(governanceSnapshot.issues),
        );
      }
      setStatusMessage(
        directory.scopedTenants.length === 0
          ? t("admin.status.noTenants")
          : governanceSnapshot.issues.length > 0
            ? `${t("admin.status.loaded", {
                tenantCount: String(directory.scopedTenants.length),
                userCount: String(directory.users.length),
                workspaceCount: String(directory.workspaces.length),
                knowledgeBaseCount: String(directory.knowledgeBases.length),
              })} · ${formatPlatformGovernanceIssues(governanceSnapshot.issues)}`
            : t("admin.status.loaded", {
                tenantCount: String(directory.scopedTenants.length),
                userCount: String(directory.users.length),
                workspaceCount: String(directory.workspaces.length),
                knowledgeBaseCount: String(directory.knowledgeBases.length),
              }),
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : t("admin.status.failed"),
      );
      setStatusMessage(t("admin.status.failed"));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleToggleWorkspaceLifecycle(workspace: Workspace) {
    try {
      setActiveWorkspaceActionId(workspace.id);
      setErrorMessage(null);
      setStatusMessage(
        workspace.is_archived
          ? t("admin.status.restoreWorkspace")
          : t("admin.status.archiveWorkspace"),
      );
      const nextWorkspace = await setWorkspaceArchiveState(
        workspace.id,
        workspace.tenant_id,
        !workspace.is_archived,
      );
      await refreshAdminDirectory(true);
      setStatusMessage(
        nextWorkspace.is_archived
          ? t("admin.status.workspaceArchived", { name: nextWorkspace.name })
          : t("admin.status.workspaceRestored", { name: nextWorkspace.name }),
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : t("admin.status.workspaceActionFailed"),
      );
      setStatusMessage(t("admin.status.workspaceActionFailed"));
    } finally {
      setActiveWorkspaceActionId(null);
    }
  }

  async function handleToggleKnowledgeBasePublication(
    knowledgeBase: KnowledgeBase,
  ) {
    const nextPublicationStatus =
      knowledgeBase.publication_status === "published" ? "draft" : "published";

    try {
      setActiveKnowledgeBaseActionId(knowledgeBase.id);
      setErrorMessage(null);
      setStatusMessage(
        nextPublicationStatus === "published"
          ? t("admin.status.publishKnowledgeBase")
          : t("admin.status.moveKnowledgeBaseToDraft"),
      );
      const nextKnowledgeBase = await setKnowledgeBasePublicationState(
        knowledgeBase.id,
        knowledgeBase.workspace_id,
        nextPublicationStatus,
      );
      await refreshAdminDirectory(true);
      setStatusMessage(
        nextKnowledgeBase.publication_status === "published"
          ? t("admin.status.knowledgeBasePublished", {
              name: nextKnowledgeBase.name,
            })
          : t("admin.status.knowledgeBaseDraft", {
              name: nextKnowledgeBase.name,
            }),
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : t("admin.status.knowledgeBaseActionFailed"),
      );
      setStatusMessage(t("admin.status.knowledgeBaseActionFailed"));
    } finally {
      setActiveKnowledgeBaseActionId(null);
    }
  }

  function openCreateTenantPanel() {
    if (!hasAdminWriteAccess) {
      return;
    }

    setCreateTenantName("");
    setCreateTenantSlug("");
    setManagementPanel("tenant-create");
  }

  function openCreateWorkspacePanel(tenantId?: string) {
    if (!hasAdminWriteAccess) {
      return;
    }

    setCreateWorkspaceTenantId(
      tenantId ??
        (selectedTenantId !== "all"
          ? selectedTenantId
          : (tenants[0]?.id ?? "")),
    );
    setCreateWorkspaceName("");
    setCreateWorkspaceSlug("");
    setCreateWorkspaceDescription("");
    setManagementPanel("workspace-create");
  }

  function openCreateUserPanel() {
    if (!hasAdminWriteAccess) {
      return;
    }

    setCreateUserDisplayName("");
    setCreateUserEmail("");
    setCreateUserTenantId(
      selectedTenantId !== "all" ? selectedTenantId : "none",
    );
    setCreateUserMembershipStatus("invited");
    setCreateUserRole("operator");
    setManagementPanel("user-create");
  }

  function openUserEditPanel(user: UserDirectoryItem) {
    if (!hasAdminWriteAccess) {
      return;
    }

    setEditingUserId(user.id);
    setEditUserDisplayName(user.display_name);
    setEditUserEmail(user.email);
    setEditUserIsActive(user.is_active ? "active" : "inactive");
    setEditUserRole(user.role);
    setEditUserResetPassword("");
    setEditUserResetPasswordConfirm("");
    setEditUserResetPasswordReason("");
    setManagementPanel("user-edit");
  }

  function openWorkspaceEditPanel(workspace: Workspace) {
    if (!hasAdminWriteAccess) {
      return;
    }

    setEditingWorkspaceId(workspace.id);
    setEditWorkspaceTenantId(workspace.tenant_id);
    setEditWorkspaceName(workspace.name);
    setEditWorkspaceSlug(workspace.slug);
    setEditWorkspaceDescription(workspace.description ?? "");
    setManagementPanel("workspace-edit");
  }

  function openCreateKnowledgeBasePanel(workspaceId?: string) {
    if (!hasAdminWriteAccess) {
      return;
    }

    setCreateKnowledgeBaseWorkspaceId(
      workspaceId ??
        scopedPrimaryWorkspace?.id ??
        filteredWorkspaces[0]?.id ??
        "",
    );
    setCreateKnowledgeBaseName("");
    setCreateKnowledgeBaseSlug("");
    setCreateKnowledgeBaseDescription("");
    setCreateKnowledgeBaseRetrievalProfileId(
      retrievalProfiles.find((item) => item.is_default)?.id ??
        retrievalProfiles[0]?.id ??
        "",
    );
    setManagementPanel("knowledge-base-create");
  }

  function openKnowledgeBaseEditPanel(knowledgeBase: KnowledgeBase) {
    if (!hasAdminWriteAccess) {
      return;
    }

    setEditingKnowledgeBaseId(knowledgeBase.id);
    setEditKnowledgeBaseWorkspaceId(knowledgeBase.workspace_id);
    setEditKnowledgeBaseName(knowledgeBase.name);
    setEditKnowledgeBaseSlug(knowledgeBase.slug);
    setEditKnowledgeBaseDescription(knowledgeBase.description ?? "");
    setEditKnowledgeBaseRetrievalProfileId(
      knowledgeBase.retrieval_profile_id ?? "",
    );
    setManagementPanel("knowledge-base-edit");
  }

  async function handleCreateTenant() {
    if (!hasAdminWriteAccess) {
      return;
    }

    const name = createTenantName.trim();
    const slug = createTenantSlug.trim();
    if (!name || !slug || isCreatingResource) {
      return;
    }

    try {
      setIsCreatingResource(true);
      setErrorMessage(null);
      setStatusMessage(t("admin.status.creatingTenant"));
      const tenant = await createTenantResource({ name, slug });
      setManagementPanel(null);
      setSelectedTenantId(tenant.id);
      await refreshAdminDirectory(true);
      setStatusMessage(t("admin.status.tenantCreated", { name: tenant.name }));
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : t("admin.status.tenantCreationFailed"),
      );
      setStatusMessage(t("admin.status.tenantCreationFailed"));
    } finally {
      setIsCreatingResource(false);
    }
  }

  async function handleCreateWorkspace() {
    if (!hasAdminWriteAccess) {
      return;
    }

    const name = createWorkspaceName.trim();
    const slug = createWorkspaceSlug.trim();
    const tenantId = createWorkspaceTenantId;
    if (!name || !slug || !tenantId || isCreatingResource) {
      return;
    }

    try {
      setIsCreatingResource(true);
      setErrorMessage(null);
      setStatusMessage(t("admin.status.creatingWorkspace"));
      const workspace = await createWorkspaceResource({
        tenant_id: tenantId,
        name,
        slug,
        description: createWorkspaceDescription.trim() || null,
      });
      setManagementPanel(null);
      setSelectedTenantId(tenantId);
      await refreshAdminDirectory(true);
      setStatusMessage(
        t("admin.status.workspaceCreated", { name: workspace.name }),
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : t("admin.status.workspaceCreationFailed"),
      );
      setStatusMessage(t("admin.status.workspaceCreationFailed"));
    } finally {
      setIsCreatingResource(false);
    }
  }

  async function handleUpdateWorkspace() {
    if (!hasAdminWriteAccess) {
      return;
    }

    const name = editWorkspaceName.trim();
    const slug = editWorkspaceSlug.trim();
    if (
      !editingWorkspaceId ||
      !editWorkspaceTenantId ||
      !name ||
      !slug ||
      isUpdatingResource
    ) {
      return;
    }

    try {
      setIsUpdatingResource(true);
      setErrorMessage(null);
      setStatusMessage(t("admin.status.updatingWorkspace"));
      const workspace = await updateWorkspaceResource(
        editingWorkspaceId,
        editWorkspaceTenantId,
        {
          name,
          slug,
          description: editWorkspaceDescription.trim() || null,
        },
      );
      setManagementPanel(null);
      await refreshAdminDirectory(true);
      setStatusMessage(
        t("admin.status.workspaceUpdated", { name: workspace.name }),
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : t("admin.status.workspaceUpdateFailed"),
      );
      setStatusMessage(t("admin.status.workspaceUpdateFailed"));
    } finally {
      setIsUpdatingResource(false);
    }
  }

  async function handleCreateKnowledgeBase() {
    if (!hasAdminWriteAccess) {
      return;
    }

    const name = createKnowledgeBaseName.trim();
    const slug = createKnowledgeBaseSlug.trim();
    const workspaceId = createKnowledgeBaseWorkspaceId;
    const workspace =
      filteredWorkspaces.find((item) => item.id === workspaceId) ??
      workspaces.find((item) => item.id === workspaceId);
    if (!workspace || !name || !slug || isCreatingResource) {
      return;
    }

    try {
      setIsCreatingResource(true);
      setErrorMessage(null);
      setStatusMessage(t("admin.status.creatingKnowledgeBase"));
      const knowledgeBase = await createKnowledgeBaseResource({
        tenant_id: workspace.tenant_id,
        workspace_id: workspace.id,
        name,
        slug,
        description: createKnowledgeBaseDescription.trim() || null,
        retrieval_profile_id: createKnowledgeBaseRetrievalProfileId || null,
      });
      setManagementPanel(null);
      setSelectedTenantId(workspace.tenant_id);
      await refreshAdminDirectory(true);
      setStatusMessage(
        t("admin.status.knowledgeBaseCreated", { name: knowledgeBase.name }),
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : t("admin.status.knowledgeBaseCreationFailed"),
      );
      setStatusMessage(t("admin.status.knowledgeBaseCreationFailed"));
    } finally {
      setIsCreatingResource(false);
    }
  }

  async function handleCreateUser() {
    if (!hasAdminWriteAccess) {
      return;
    }

    const displayName = createUserDisplayName.trim();
    const email = createUserEmail.trim().toLowerCase();
    if (!displayName || !email || isCreatingResource) {
      return;
    }

    try {
      setIsCreatingResource(true);
      setErrorMessage(null);
      setStatusMessage(t("admin.status.creatingMember"));
      const user = await createUserDirectoryEntry({
        display_name: displayName,
        email,
        is_active: true,
        role: createUserRole,
        membership_status: createUserMembershipStatus,
        ...(createUserTenantId !== "none"
          ? { tenant_id: createUserTenantId }
          : {}),
      });
      setManagementPanel(null);
      await refreshAdminDirectory(true);
      setStatusMessage(
        t("admin.status.memberCreated", { name: user.display_name }),
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : t("admin.status.memberCreationFailed"),
      );
      setStatusMessage(t("admin.status.memberCreationFailed"));
    } finally {
      setIsCreatingResource(false);
    }
  }

  async function handleUpdateUser() {
    if (!hasAdminWriteAccess) {
      return;
    }

    const displayName = editUserDisplayName.trim();
    const email = editUserEmail.trim().toLowerCase();
    if (!editingUserId || !displayName || !email || isUpdatingResource) {
      return;
    }

    try {
      setIsUpdatingResource(true);
      setErrorMessage(null);
      setStatusMessage(t("admin.status.updatingMember"));
      const user = await updateUserDirectoryEntry(editingUserId, {
        display_name: displayName,
        email,
        is_active: editUserIsActive === "active",
        role: editUserRole,
      });
      await syncCurrentSessionFromDirectoryUser(user);
      setManagementPanel(null);
      await refreshAdminDirectory(true);
      setStatusMessage(
        t("admin.status.memberUpdated", { name: user.display_name }),
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : t("admin.status.memberUpdateFailed"),
      );
      setStatusMessage(t("admin.status.memberUpdateFailed"));
    } finally {
      setIsUpdatingResource(false);
    }
  }

  async function handleResetEditingUserPassword() {
    if (
      !editingUserId ||
      !hasAdminWriteAccess ||
      isResettingEditingUserPassword
    ) {
      return;
    }

    const nextPassword = editUserResetPassword.trim();
    const confirmedPassword = editUserResetPasswordConfirm.trim();
    if (!nextPassword || !confirmedPassword) {
      setErrorMessage(t("admin.members.passwordResetValidation"));
      setStatusMessage(t("admin.status.memberPasswordResetFailed"));
      return;
    }
    if (nextPassword !== confirmedPassword) {
      setErrorMessage(t("admin.members.passwordResetMismatch"));
      setStatusMessage(t("admin.status.memberPasswordResetFailed"));
      return;
    }

    try {
      setIsResettingEditingUserPassword(true);
      setErrorMessage(null);
      setStatusMessage(t("admin.status.memberPasswordResetting"));
      const user = await resetDirectoryUserPassword(editingUserId, {
        new_password: nextPassword,
        reason: editUserResetPasswordReason.trim() || null,
      });
      setEditUserResetPassword("");
      setEditUserResetPasswordConfirm("");
      setEditUserResetPasswordReason("");
      await refreshAdminDirectory(true);
      if (editingUserId) {
        await refreshEditingUserSessions(editingUserId);
      }
      setStatusMessage(
        t("admin.status.memberPasswordReset", { name: user.display_name }),
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : t("admin.status.memberPasswordResetFailed"),
      );
      setStatusMessage(t("admin.status.memberPasswordResetFailed"));
    } finally {
      setIsResettingEditingUserPassword(false);
    }
  }

  async function handleRevokeEditingUserSession(sessionId: string) {
    if (
      !editingUserId ||
      activeUserSessionActionId === sessionId ||
      !hasAdminWriteAccess
    ) {
      return;
    }

    try {
      setActiveUserSessionActionId(sessionId);
      setEditingUserSessionsErrorMessage(null);
      await revokeUserSession(
        editingUserId,
        sessionId,
        t("admin.audit.defaultSessionRevokeReason"),
      );
      await refreshEditingUserSessions(editingUserId);
      setStatusMessage(t("admin.status.memberSessionRevoked"));
    } catch (error) {
      setEditingUserSessionsErrorMessage(
        error instanceof Error
          ? error.message
          : t("admin.members.sessionsLoadFailed"),
      );
      setStatusMessage(t("admin.status.memberSessionRevokeFailed"));
    } finally {
      setActiveUserSessionActionId(null);
    }
  }

  async function handleRefreshEditingUserSessions() {
    if (
      !editingUserId ||
      !hasAdminWriteAccess ||
      isLoadingEditingUserSessions
    ) {
      return;
    }

    await refreshEditingUserSessions(editingUserId);
  }

  async function handleAddUserToTenant(user: UserDirectoryItem) {
    if (!hasAdminWriteAccess) {
      return;
    }

    if (selectedTenantId === "all") {
      return;
    }

    try {
      setActiveUserActionId(user.id);
      setErrorMessage(null);
      setStatusMessage(t("admin.status.invitingMemberToTenant"));
      const updatedUser = await createUserMembership(user.id, {
        tenant_id: selectedTenantId,
        membership_status: "invited",
      });
      await syncCurrentSessionFromDirectoryUser(updatedUser);
      await refreshAdminDirectory(true);
      setStatusMessage(
        t("admin.status.memberInvitedToTenant", { name: user.display_name }),
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : t("admin.status.memberAddFailed"),
      );
      setStatusMessage(t("admin.status.memberAddFailed"));
    } finally {
      setActiveUserActionId(null);
    }
  }

  async function handleUpdateMembership(
    user: UserDirectoryItem,
    membership: UserMembership,
    membershipStatus: "active" | "suspended",
  ) {
    if (!hasAdminWriteAccess) {
      return;
    }

    try {
      setActiveMembershipActionId(membership.id);
      setErrorMessage(null);
      setStatusMessage(
        membershipStatus === "active"
          ? t("admin.status.activatingMembership")
          : t("admin.status.suspendingMembership"),
      );
      const updatedUser = await updateUserMembershipStatus(
        user.id,
        membership.id,
        {
          membership_status: membershipStatus,
          reason: getDefaultGovernanceReason(
            membershipStatus === "active"
              ? "activate_membership"
              : "suspend_membership",
          ),
        },
      );
      await syncCurrentSessionFromDirectoryUser(updatedUser);
      await refreshAdminDirectory(true);
      setStatusMessage(
        membershipStatus === "active"
          ? t("admin.status.membershipActivated", { name: user.display_name })
          : t("admin.status.membershipSuspended", { name: user.display_name }),
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : t("admin.status.membershipUpdateFailed"),
      );
      setStatusMessage(t("admin.status.membershipUpdateFailed"));
    } finally {
      setActiveMembershipActionId(null);
    }
  }

  async function handleIssueMembershipInvitation(
    user: UserDirectoryItem,
    membership: UserMembership,
  ) {
    if (!hasAdminWriteAccess) {
      return;
    }

    try {
      setActiveMembershipActionId(membership.id);
      setErrorMessage(null);
      setStatusMessage(t("admin.status.issuingInvitationCode"));
      const credential = await issueUserMembershipInvitation(
        user.id,
        membership.id,
        getDefaultGovernanceReason("issue_invitation"),
      );
      setRevealedInvitationByMembershipId((current) => ({
        ...current,
        [membership.id]: credential,
      }));
      await refreshAdminDirectory(true);
      setStatusMessage(
        t("admin.status.invitationCodeIssued", { name: user.display_name }),
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : t("admin.status.invitationCodeIssueFailed"),
      );
      setStatusMessage(t("admin.status.invitationCodeIssueFailed"));
    } finally {
      setActiveMembershipActionId(null);
    }
  }

  async function handleRevokeMembershipInvitation(
    user: UserDirectoryItem,
    membership: UserMembership,
  ) {
    if (!hasAdminWriteAccess) {
      return;
    }

    try {
      setActiveMembershipActionId(membership.id);
      setErrorMessage(null);
      setStatusMessage(t("admin.status.revokingInvitationCode"));
      const updatedUser = await revokeUserMembershipInvitation(
        user.id,
        membership.id,
        getDefaultGovernanceReason("revoke_invitation"),
      );
      await syncCurrentSessionFromDirectoryUser(updatedUser);
      await refreshAdminDirectory(true);
      setStatusMessage(
        t("admin.status.invitationCodeRevoked", { name: user.display_name }),
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : t("admin.status.invitationCodeRevokeFailed"),
      );
      setStatusMessage(t("admin.status.invitationCodeRevokeFailed"));
    } finally {
      setActiveMembershipActionId(null);
    }
  }

  async function handleRemoveMembership(
    user: UserDirectoryItem,
    membership: UserMembership,
  ) {
    if (!hasAdminWriteAccess) {
      return;
    }

    try {
      setActiveMembershipActionId(membership.id);
      setErrorMessage(null);
      setStatusMessage(t("admin.status.removingMembership"));
      const updatedUser = await deleteUserMembership(user.id, membership.id);
      await syncCurrentSessionFromDirectoryUser(updatedUser);
      await refreshAdminDirectory(true);
      setStatusMessage(
        t("admin.status.membershipRemoved", { name: user.display_name }),
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : t("admin.status.membershipRemoveFailed"),
      );
      setStatusMessage(t("admin.status.membershipRemoveFailed"));
    } finally {
      setActiveMembershipActionId(null);
    }
  }

  async function handleToggleUserAccount(user: UserDirectoryItem) {
    if (!hasAdminWriteAccess) {
      return;
    }

    try {
      setActiveUserActionId(user.id);
      setErrorMessage(null);
      setStatusMessage(
        user.is_active
          ? t("admin.status.deactivatingMember")
          : t("admin.status.activatingMemberAccount"),
      );
      const updatedUser = await updateUserDirectoryEntry(user.id, {
        display_name: user.display_name,
        email: user.email,
        is_active: !user.is_active,
      });
      await syncCurrentSessionFromDirectoryUser(updatedUser);
      await refreshAdminDirectory(true);
      setStatusMessage(
        user.is_active
          ? t("admin.status.memberDeactivated", { name: user.display_name })
          : t("admin.status.memberActivated", { name: user.display_name }),
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : t("admin.status.memberAccountUpdateFailed"),
      );
      setStatusMessage(t("admin.status.memberAccountUpdateFailed"));
    } finally {
      setActiveUserActionId(null);
    }
  }

  async function handleUpdateKnowledgeBase() {
    if (!hasAdminWriteAccess) {
      return;
    }

    const name = editKnowledgeBaseName.trim();
    const slug = editKnowledgeBaseSlug.trim();
    if (
      !editingKnowledgeBaseId ||
      !editKnowledgeBaseWorkspaceId ||
      !name ||
      !slug ||
      isUpdatingResource
    ) {
      return;
    }

    try {
      setIsUpdatingResource(true);
      setErrorMessage(null);
      setStatusMessage(t("admin.status.updatingKnowledgeBase"));
      const knowledgeBase = await updateKnowledgeBaseResource(
        editingKnowledgeBaseId,
        editKnowledgeBaseWorkspaceId,
        {
          name,
          slug,
          description: editKnowledgeBaseDescription.trim() || null,
          retrieval_profile_id: editKnowledgeBaseRetrievalProfileId || null,
        },
      );
      setManagementPanel(null);
      await refreshAdminDirectory(true);
      setStatusMessage(
        t("admin.status.knowledgeBaseUpdated", { name: knowledgeBase.name }),
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : t("admin.status.knowledgeBaseUpdateFailed"),
      );
      setStatusMessage(t("admin.status.knowledgeBaseUpdateFailed"));
    } finally {
      setIsUpdatingResource(false);
    }
  }

  useEffect(() => {
    void refreshAdminDirectory();
  }, [
    knowledgeBasePublicationStatusFilter,
    memberAccountFilter,
    memberRelationshipFilter,
    searchQuery,
    workspaceLifecycleFilter,
    auditEventFilter,
    selectedTenantId,
    runtimeGovernanceQueueCategoryFilter,
    runtimeGovernanceQueueResourceFilter,
    runtimeGovernanceQueueSeverityFilter,
    runtimeGovernanceSearchQuery,
    runtimeGovernanceActionFilter,
    runtimeGovernanceActorRoleFilter,
  ]);

  const filteredTenantGroups = useMemo(() => {
    if (selectedTenantId === "all") {
      return tenantWorkspaceGroups;
    }

    return tenantWorkspaceGroups.filter(
      (group) => group.tenant.id === selectedTenantId,
    );
  }, [selectedTenantId, tenantWorkspaceGroups]);
  const filteredTenantIds = useMemo(
    () => new Set(filteredTenantGroups.map((group) => group.tenant.id)),
    [filteredTenantGroups],
  );
  const scopedRuntimeGovernanceItems = useMemo(
    () =>
      runtimeGovernanceItems.filter((item) =>
        filteredTenantIds.has(item.tenant_id),
      ),
    [filteredTenantIds, runtimeGovernanceItems],
  );

  const filteredWorkspaceIds = useMemo(
    () =>
      new Set(
        filteredTenantGroups.flatMap((group) =>
          group.workspaces.map((workspace) => workspace.id),
        ),
      ),
    [filteredTenantGroups],
  );

  const filteredWorkspaces = useMemo(
    () =>
      workspaces.filter((workspace) => filteredWorkspaceIds.has(workspace.id)),
    [filteredWorkspaceIds, workspaces],
  );

  const filteredKnowledgeBases = useMemo(
    () =>
      knowledgeBases.filter((knowledgeBase) =>
        filteredWorkspaceIds.has(knowledgeBase.workspace_id),
      ),
    [filteredWorkspaceIds, knowledgeBases],
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
  const retrievalGovernanceSummary = useMemo(() => {
    const retrievalProfileById = new Map(
      retrievalProfiles.map(
        (retrievalProfile) => [retrievalProfile.id, retrievalProfile] as const,
      ),
    );
    const explicitAssignedKnowledgeBases = filteredKnowledgeBases.filter(
      (knowledgeBase) => Boolean(knowledgeBase.retrieval_profile_id),
    ).length;
    const defaultFallbackKnowledgeBases = filteredKnowledgeBases.filter(
      (knowledgeBase) => !knowledgeBase.retrieval_profile_id,
    ).length;
    const knowledgeBasesUsingDisabledRetrievalProfile =
      filteredKnowledgeBases.filter((knowledgeBase) => {
        if (!knowledgeBase.retrieval_profile_id) {
          return false;
        }

        const retrievalProfile = retrievalProfileById.get(
          knowledgeBase.retrieval_profile_id,
        );
        return Boolean(retrievalProfile && !retrievalProfile.is_enabled);
      }).length;
    const disabledBoundRetrievalProfiles = retrievalProfiles.filter(
      (retrievalProfile) =>
        !retrievalProfile.is_enabled &&
        retrievalProfile.bound_knowledge_base_count > 0,
    ).length;

    return {
      totalProfiles: retrievalProfiles.length,
      enabledProfiles: retrievalProfiles.filter(
        (retrievalProfile) => retrievalProfile.is_enabled,
      ).length,
      disabledBoundRetrievalProfiles,
      explicitAssignedKnowledgeBases,
      defaultFallbackKnowledgeBases,
      knowledgeBasesUsingDisabledRetrievalProfile,
    };
  }, [filteredKnowledgeBases, retrievalProfiles]);
  const retrievalProfileAssets = useMemo(() => {
    const fallbackKnowledgeBases = filteredKnowledgeBases.filter(
      (knowledgeBase) => !knowledgeBase.retrieval_profile_id,
    );

    return retrievalProfiles.map((retrievalProfile) => {
      const assignedKnowledgeBases = filteredKnowledgeBases.filter(
        (knowledgeBase) =>
          knowledgeBase.retrieval_profile_id === retrievalProfile.id,
      );
      const assignedWorkspaceCount = new Set(
        assignedKnowledgeBases.map(
          (knowledgeBase) => knowledgeBase.workspace_id,
        ),
      ).size;
      const publishedKnowledgeBaseCount = assignedKnowledgeBases.filter(
        (knowledgeBase) => knowledgeBase.publication_status === "published",
      ).length;
      const fallbackCoverageCount =
        defaultRetrievalProfile?.id === retrievalProfile.id
          ? fallbackKnowledgeBases.length
          : 0;
      const status: AdminWatchItem["status"] =
        !retrievalProfile.is_enabled && assignedKnowledgeBases.length > 0
          ? "attention"
          : assignedKnowledgeBases.length === 0 && fallbackCoverageCount === 0
            ? "review"
            : "healthy";

      return {
        profile: retrievalProfile,
        assignedKnowledgeBases: assignedKnowledgeBases.length,
        assignedWorkspaceCount,
        publishedKnowledgeBaseCount,
        draftKnowledgeBaseCount:
          assignedKnowledgeBases.length - publishedKnowledgeBaseCount,
        fallbackCoverageCount,
        status,
      };
    });
  }, [defaultRetrievalProfile, filteredKnowledgeBases, retrievalProfiles]);
  const scopedAgents = useMemo(
    () => agents.filter((agent) => filteredTenantIds.has(agent.tenant_id)),
    [agents, filteredTenantIds],
  );
  const focusedRuntimeItem = useMemo(
    () => selectFocusedRuntimeGovernanceItem(scopedRuntimeGovernanceItems),
    [scopedRuntimeGovernanceItems],
  );
  const focusedDisabledModelEndpoint = useMemo(() => {
    if (hasRuntimeGovernanceIssue(focusedRuntimeItem, "model_disabled")) {
      return focusedRuntimeItem?.resolved_model_endpoint ?? null;
    }
    return null;
  }, [focusedRuntimeItem]);
  const focusedUnconfiguredModelEndpoint = useMemo(() => {
    if (
      hasRuntimeGovernanceIssue(
        focusedRuntimeItem,
        "model_runtime_unconfigured",
      )
    ) {
      return focusedRuntimeItem?.resolved_model_endpoint ?? null;
    }
    return null;
  }, [focusedRuntimeItem]);
  const focusedDisabledToolRegistration = useMemo(
    () =>
      focusedRuntimeItem?.disabled_tool_registration_id
        ? focusedRuntimeItem.focus_tool_registration
        : null,
    [focusedRuntimeItem],
  );
  const focusedPendingMcpToolRegistration = useMemo(
    () =>
      focusedRuntimeItem?.integration_pending_mcp_tool_registration_id
        ? focusedRuntimeItem.focus_tool_registration
        : null,
    [focusedRuntimeItem],
  );
  const focusedReservedMcpToolRegistration = useMemo(
    () =>
      focusedRuntimeItem?.reserved_mcp_tool_registration_id
        ? focusedRuntimeItem.focus_tool_registration
        : null,
    [focusedRuntimeItem],
  );
  const focusedApprovalToolRegistration = useMemo(
    () =>
      focusedRuntimeItem?.approval_required_tool_registration_id
        ? focusedRuntimeItem.focus_tool_registration
        : null,
    [focusedRuntimeItem],
  );
  const focusedDisabledRetrievalProfile = useMemo(
    () =>
      hasRuntimeGovernanceIssue(
        focusedRuntimeItem,
        "retrieval_profile_disabled",
      )
        ? (focusedRuntimeItem?.resolved_retrieval_profile ?? null)
        : (retrievalProfileAssets.find((asset) => asset.status === "attention")
            ?.profile ?? null),
    [focusedRuntimeItem, retrievalProfileAssets],
  );
  const focusedRuntimeFollowUp = buildRuntimeGovernanceFollowUp(
    buildRuntimeGovernanceFollowUpTargetFromItem({
      tenantId: selectedTenantId === "all" ? null : selectedTenantId,
      item: focusedRuntimeItem,
      disabledRetrievalProfileId: focusedDisabledRetrievalProfile?.id ?? null,
    }),
  );
  const buildScopedRuntimeIssueHref = useCallback(
    (
      issue: Parameters<
        typeof buildRuntimeGovernanceIssueDefinitionsTarget
      >[0]["issue"],
      overrides?: Omit<
        Parameters<typeof buildRuntimeGovernanceIssueDefinitionsTarget>[0],
        "tenantId" | "issue"
      >,
    ) =>
      buildRuntimeGovernanceIssueDefinitionsHref(
        buildRuntimeGovernanceIssueDefinitionsTarget({
          tenantId: selectedTenantId === "all" ? null : selectedTenantId,
          issue,
          ...(overrides ?? {}),
        }),
      ),
    [selectedTenantId],
  );
  const focusedDisabledModelDefinitionsHref = focusedDisabledModelEndpoint
    ? buildScopedRuntimeIssueHref("model_disabled", {
        item: focusedRuntimeItem ?? undefined,
      })
    : null;
  const focusedUnconfiguredModelDefinitionsHref =
    focusedUnconfiguredModelEndpoint
      ? buildScopedRuntimeIssueHref("model_runtime_unconfigured", {
          item: focusedRuntimeItem ?? undefined,
        })
      : null;
  const focusedDisabledToolDefinitionsHref = focusedDisabledToolRegistration
    ? buildScopedRuntimeIssueHref("tool_registration_disabled", {
        item: focusedRuntimeItem ?? undefined,
      })
    : null;
  const focusedApprovalToolDefinitionsHref = focusedApprovalToolRegistration
    ? buildScopedRuntimeIssueHref("tool_approval_required", {
        item: focusedRuntimeItem ?? undefined,
      })
    : null;
  const focusedDisabledRetrievalDefinitionsHref =
    focusedDisabledRetrievalProfile
      ? buildScopedRuntimeIssueHref("retrieval_profile_disabled", {
          item: focusedRuntimeItem ?? undefined,
          retrievalProfileId: focusedDisabledRetrievalProfile.id,
        })
      : null;
  const focusedRuntimeSettingsHref = focusedRuntimeFollowUp.settingsHref;
  const focusedRuntimeDefinitionsHref = focusedRuntimeFollowUp.definitionsHref;

  const scopedConversationMetrics = useMemo<ConversationMetrics>(() => {
    const scopedTenantIds = filteredTenantGroups.map(
      (group) => group.tenant.id,
    );
    const latestActivityCandidates: string[] = [];

    const aggregatedMetrics = scopedTenantIds.reduce(
      (accumulator, tenantId) => {
        const metrics = conversationMetricsByTenantId[tenantId];
        if (!metrics) {
          return accumulator;
        }

        if (metrics.latest_activity_at) {
          latestActivityCandidates.push(metrics.latest_activity_at);
        }

        return {
          total_conversations:
            accumulator.total_conversations + metrics.total_conversations,
          active_conversations:
            accumulator.active_conversations + metrics.active_conversations,
          total_messages: accumulator.total_messages + metrics.total_messages,
          latest_activity_at: null,
        };
      },
      { ...EMPTY_CONVERSATION_METRICS },
    );

    aggregatedMetrics.latest_activity_at =
      latestActivityCandidates.length > 0
        ? latestActivityCandidates.sort(
            (left, right) =>
              new Date(right).getTime() - new Date(left).getTime(),
          )[0]
        : null;

    return aggregatedMetrics;
  }, [conversationMetricsByTenantId, filteredTenantGroups]);

  const scopedAgentRunMetrics = useMemo<AgentRunMetricsResponse>(() => {
    const scopedTenantIds = filteredTenantGroups.map(
      (group) => group.tenant.id,
    );
    const latestLaunchCandidates: string[] = [];

    const aggregatedMetrics = scopedTenantIds.reduce(
      (accumulator, tenantId) => {
        const metrics = agentRunMetricsByTenantId[tenantId];
        if (!metrics) {
          return accumulator;
        }

        if (metrics.latest_launched_at) {
          latestLaunchCandidates.push(metrics.latest_launched_at);
        }

        return {
          total_runs: accumulator.total_runs + metrics.total_runs,
          chat_runs: accumulator.chat_runs + metrics.chat_runs,
          document_runs: accumulator.document_runs + metrics.document_runs,
          operations_runs:
            accumulator.operations_runs + metrics.operations_runs,
          admin_runs: accumulator.admin_runs + metrics.admin_runs,
          latest_launched_at: null,
        };
      },
      { ...EMPTY_AGENT_RUN_METRICS },
    );

    aggregatedMetrics.latest_launched_at =
      latestLaunchCandidates.length > 0
        ? latestLaunchCandidates.sort(
            (left, right) =>
              new Date(right).getTime() - new Date(left).getTime(),
          )[0]
        : null;

    return aggregatedMetrics;
  }, [agentRunMetricsByTenantId, filteredTenantGroups]);

  const scopedAgentExecutionMetrics =
    useMemo<AgentExecutionMetricsResponse>(() => {
      const scopedTenantIds = filteredTenantGroups.map(
        (group) => group.tenant.id,
      );
      const latestExecutionCandidates: string[] = [];

      const aggregatedMetrics = scopedTenantIds.reduce(
        (accumulator, tenantId) => {
          const metrics = agentExecutionMetricsByTenantId[tenantId];
          if (!metrics) {
            return accumulator;
          }

          if (metrics.latest_execution_at) {
            latestExecutionCandidates.push(metrics.latest_execution_at);
          }

          return {
            total_executions:
              accumulator.total_executions + metrics.total_executions,
            queued_executions:
              accumulator.queued_executions + metrics.queued_executions,
            running_executions:
              accumulator.running_executions + metrics.running_executions,
            awaiting_approval_executions:
              accumulator.awaiting_approval_executions +
              metrics.awaiting_approval_executions,
            completed_executions:
              accumulator.completed_executions + metrics.completed_executions,
            failed_executions:
              accumulator.failed_executions + metrics.failed_executions,
            latest_execution_at: null,
          };
        },
        { ...EMPTY_AGENT_EXECUTION_METRICS },
      );

      aggregatedMetrics.latest_execution_at =
        latestExecutionCandidates.length > 0
          ? latestExecutionCandidates.sort(
              (left, right) =>
                new Date(right).getTime() - new Date(left).getTime(),
            )[0]
          : null;

      return aggregatedMetrics;
    }, [agentExecutionMetricsByTenantId, filteredTenantGroups]);

  const scopedDocumentMetrics = useMemo<DocumentMetrics>(() => {
    return filteredKnowledgeBases.reduce(
      (accumulator, knowledgeBase) => {
        const metrics = documentMetricsByKnowledgeBaseId[knowledgeBase.id];
        if (!metrics) {
          return accumulator;
        }

        return {
          total_documents:
            accumulator.total_documents + metrics.total_documents,
          completed_documents:
            accumulator.completed_documents + metrics.completed_documents,
          active_documents:
            accumulator.active_documents + metrics.active_documents,
          failed_documents:
            accumulator.failed_documents + metrics.failed_documents,
        };
      },
      { ...EMPTY_DOCUMENT_METRICS },
    );
  }, [documentMetricsByKnowledgeBaseId, filteredKnowledgeBases]);

  const scopedWorkflowMetrics = useMemo<WorkflowMetrics>(() => {
    const scopedTenantIds = filteredTenantGroups.map(
      (group) => group.tenant.id,
    );

    return scopedTenantIds.reduce(
      (accumulator, tenantId) => {
        const metrics = workflowMetricsByTenantId[tenantId];
        if (!metrics) {
          return accumulator;
        }

        return {
          total_runs: accumulator.total_runs + metrics.total_runs,
          active_runs: accumulator.active_runs + metrics.active_runs,
          queued_runs: accumulator.queued_runs + metrics.queued_runs,
          running_runs: accumulator.running_runs + metrics.running_runs,
          retry_runs: accumulator.retry_runs + metrics.retry_runs,
          completed_runs: accumulator.completed_runs + metrics.completed_runs,
          failed_runs: accumulator.failed_runs + metrics.failed_runs,
          cancelled_runs: accumulator.cancelled_runs + metrics.cancelled_runs,
        };
      },
      { ...EMPTY_WORKFLOW_METRICS },
    );
  }, [filteredTenantGroups, workflowMetricsByTenantId]);

  const recentScopedAgentRuns = useMemo(
    () =>
      filteredTenantGroups
        .flatMap((group) => recentAgentRunsByTenantId[group.tenant.id] ?? [])
        .sort(
          (left, right) =>
            new Date(right.created_at).getTime() -
            new Date(left.created_at).getTime(),
        )
        .slice(0, 8),
    [filteredTenantGroups, recentAgentRunsByTenantId],
  );

  const recentScopedAgentExecutions = useMemo(
    () =>
      filteredTenantGroups
        .flatMap(
          (group) => recentAgentExecutionsByTenantId[group.tenant.id] ?? [],
        )
        .sort(
          (left, right) =>
            new Date(right.updated_at).getTime() -
            new Date(left.updated_at).getTime(),
        )
        .slice(0, 6),
    [filteredTenantGroups, recentAgentExecutionsByTenantId],
  );

  const tenantAgentRuntimeActivity = useMemo(
    () =>
      filteredTenantGroups
        .map((group) => {
          const metrics =
            agentRunMetricsByTenantId[group.tenant.id] ??
            EMPTY_AGENT_RUN_METRICS;
          const recentRuns = recentAgentRunsByTenantId[group.tenant.id] ?? [];

          return {
            tenant: group.tenant,
            metrics,
            recentRuns,
            agentsHref: buildAgentsHref({
              tenantId: group.tenant.id,
              status: "active",
            }),
            operationsHref: buildOperationsHref({
              tenantId: group.tenant.id,
              lane: "overview",
              status: "all",
            }),
          };
        })
        .sort((left, right) => {
          if (right.metrics.total_runs !== left.metrics.total_runs) {
            return right.metrics.total_runs - left.metrics.total_runs;
          }

          const rightLatest = right.metrics.latest_launched_at
            ? new Date(right.metrics.latest_launched_at).getTime()
            : 0;
          const leftLatest = left.metrics.latest_launched_at
            ? new Date(left.metrics.latest_launched_at).getTime()
            : 0;
          return rightLatest - leftLatest;
        }),
    [
      agentRunMetricsByTenantId,
      filteredTenantGroups,
      recentAgentRunsByTenantId,
    ],
  );

  const tenantAgentExecutionActivity = useMemo(
    () =>
      filteredTenantGroups
        .map((group) => {
          const metrics =
            agentExecutionMetricsByTenantId[group.tenant.id] ??
            EMPTY_AGENT_EXECUTION_METRICS;

          return {
            tenant: group.tenant,
            metrics,
            agentsHref: buildAgentsHref({
              tenantId: group.tenant.id,
              status: "active",
            }),
            operationsHref: buildOperationsHref({
              tenantId: group.tenant.id,
              lane: "overview",
              status: "all",
            }),
          };
        })
        .sort((left, right) => {
          if (
            right.metrics.total_executions !== left.metrics.total_executions
          ) {
            return (
              right.metrics.total_executions - left.metrics.total_executions
            );
          }

          const rightLatest = right.metrics.latest_execution_at
            ? new Date(right.metrics.latest_execution_at).getTime()
            : 0;
          const leftLatest = left.metrics.latest_execution_at
            ? new Date(left.metrics.latest_execution_at).getTime()
            : 0;
          return rightLatest - leftLatest;
        }),
    [agentExecutionMetricsByTenantId, filteredTenantGroups],
  );

  const tenantWorkflowActivity = useMemo(
    () =>
      filteredTenantGroups
        .map((group) => {
          const metrics =
            workflowMetricsByTenantId[group.tenant.id] ??
            EMPTY_WORKFLOW_METRICS;
          const preferredRecoveryStatus =
            metrics.failed_runs > 0
              ? "failed"
              : metrics.cancelled_runs > 0
                ? "cancelled"
                : "failed";
          const primaryWorkspace = group.workspaces[0] ?? null;
          const primaryKnowledgeBase = primaryWorkspace
            ? (knowledgeBases.find(
                (knowledgeBase) =>
                  knowledgeBase.workspace_id === primaryWorkspace.id,
              ) ?? null)
            : null;

          return {
            tenant: group.tenant,
            metrics,
            recoveryPressure: metrics.failed_runs + metrics.cancelled_runs,
            preferredRecoveryStatus,
            queuePressure: metrics.queued_runs + metrics.running_runs,
            overviewHref: buildOperationsHref({
              tenantId: group.tenant.id,
              lane: "overview",
              status: "all",
            }),
            failedHref: buildOperationsHref({
              tenantId: group.tenant.id,
              lane: "failed",
              status: preferredRecoveryStatus,
            }),
            queueHref: buildOperationsHref({
              tenantId: group.tenant.id,
              lane: "pressure",
              status: "queued",
            }),
            workspaceWorkflowHref: buildAdminWorkspaceHref("overview", {
              view: "workflows",
              tenantId: group.tenant.id,
              workspaceId: primaryWorkspace?.id ?? null,
              knowledgeBaseId: primaryKnowledgeBase?.id ?? null,
              workflowStatus:
                metrics.failed_runs > 0
                  ? "failed"
                  : metrics.cancelled_runs > 0
                    ? "cancelled"
                    : null,
            }),
          };
        })
        .sort((left, right) => {
          if (right.recoveryPressure !== left.recoveryPressure) {
            return right.recoveryPressure - left.recoveryPressure;
          }
          if (right.queuePressure !== left.queuePressure) {
            return right.queuePressure - left.queuePressure;
          }
          return right.metrics.retry_runs - left.metrics.retry_runs;
        }),
    [filteredTenantGroups, knowledgeBases, workflowMetricsByTenantId],
  );

  const tenantDocumentActivity = useMemo(
    () =>
      filteredTenantGroups
        .map((group) => {
          const groupKnowledgeBases = knowledgeBases.filter((knowledgeBase) =>
            group.workspaces.some(
              (workspace) => workspace.id === knowledgeBase.workspace_id,
            ),
          );
          const metrics = groupKnowledgeBases.reduce(
            (accumulator, knowledgeBase) => {
              const nextMetrics =
                documentMetricsByKnowledgeBaseId[knowledgeBase.id];
              if (!nextMetrics) {
                return accumulator;
              }

              return {
                total_documents:
                  accumulator.total_documents + nextMetrics.total_documents,
                completed_documents:
                  accumulator.completed_documents +
                  nextMetrics.completed_documents,
                active_documents:
                  accumulator.active_documents + nextMetrics.active_documents,
                failed_documents:
                  accumulator.failed_documents + nextMetrics.failed_documents,
              };
            },
            { ...EMPTY_DOCUMENT_METRICS },
          );

          const primaryWorkspace = group.workspaces[0] ?? null;
          const primaryKnowledgeBase = groupKnowledgeBases[0] ?? null;

          return {
            tenant: group.tenant,
            metrics,
            knowledgeBaseCount: groupKnowledgeBases.length,
            documentsHref: buildAdminWorkspaceHref("overview", {
              view: "documents",
              tenantId: group.tenant.id,
              workspaceId: primaryWorkspace?.id ?? null,
              knowledgeBaseId: primaryKnowledgeBase?.id ?? null,
            }),
            failedDocumentsHref: buildAdminWorkspaceHref("overview", {
              view: "documents",
              tenantId: group.tenant.id,
              workspaceId: primaryWorkspace?.id ?? null,
              knowledgeBaseId: primaryKnowledgeBase?.id ?? null,
              documentStatus: "failed",
            }),
            operationsHref: buildOperationsHref({
              tenantId: group.tenant.id,
              lane: "overview",
              status: "all",
            }),
          };
        })
        .sort((left, right) => {
          if (
            right.metrics.failed_documents !== left.metrics.failed_documents
          ) {
            return (
              right.metrics.failed_documents - left.metrics.failed_documents
            );
          }
          if (
            right.metrics.active_documents !== left.metrics.active_documents
          ) {
            return (
              right.metrics.active_documents - left.metrics.active_documents
            );
          }
          return right.metrics.total_documents - left.metrics.total_documents;
        }),
    [documentMetricsByKnowledgeBaseId, filteredTenantGroups, knowledgeBases],
  );

  const tenantChatActivity = useMemo(
    () =>
      filteredTenantGroups
        .map((group) => {
          const metrics =
            conversationMetricsByTenantId[group.tenant.id] ??
            EMPTY_CONVERSATION_METRICS;
          const workflowMetrics =
            workflowMetricsByTenantId[group.tenant.id] ??
            EMPTY_WORKFLOW_METRICS;
          const preferredRecoveryStatus =
            workflowMetrics.failed_runs > 0
              ? "failed"
              : workflowMetrics.cancelled_runs > 0
                ? "cancelled"
                : "failed";
          const primaryWorkspace = group.workspaces[0] ?? null;
          const primaryKnowledgeBase = primaryWorkspace
            ? (knowledgeBases.find(
                (knowledgeBase) =>
                  knowledgeBase.workspace_id === primaryWorkspace.id,
              ) ?? null)
            : null;

          return {
            tenant: group.tenant,
            metrics,
            workspaceCount: group.workspaces.length,
            documentsHref: buildAdminWorkspaceHref("overview", {
              view: "documents",
              tenantId: group.tenant.id,
              workspaceId: primaryWorkspace?.id ?? null,
              knowledgeBaseId: primaryKnowledgeBase?.id ?? null,
            }),
            failedDocumentsHref: buildAdminWorkspaceHref("overview", {
              view: "documents",
              tenantId: group.tenant.id,
              workspaceId: primaryWorkspace?.id ?? null,
              knowledgeBaseId: primaryKnowledgeBase?.id ?? null,
              documentStatus: "failed",
            }),
            workflowsHref: buildAdminWorkspaceHref("overview", {
              view: "workflows",
              tenantId: group.tenant.id,
              workspaceId: primaryWorkspace?.id ?? null,
              knowledgeBaseId: primaryKnowledgeBase?.id ?? null,
            }),
            failedWorkflowsHref: buildAdminWorkspaceHref("overview", {
              view: "workflows",
              tenantId: group.tenant.id,
              workspaceId: primaryWorkspace?.id ?? null,
              knowledgeBaseId: primaryKnowledgeBase?.id ?? null,
              workflowStatus: preferredRecoveryStatus,
            }),
            governanceHref: buildAdminHref({ tenantId: group.tenant.id }),
            openHref: buildAdminWorkspaceHref("overview", {
              view: "chat",
              tenantId: group.tenant.id,
              workspaceId: primaryWorkspace?.id ?? null,
              knowledgeBaseId: primaryKnowledgeBase?.id ?? null,
            }),
          };
        })
        .sort((left, right) => {
          if (right.metrics.total_messages !== left.metrics.total_messages) {
            return right.metrics.total_messages - left.metrics.total_messages;
          }

          const rightLatest = right.metrics.latest_activity_at
            ? new Date(right.metrics.latest_activity_at).getTime()
            : 0;
          const leftLatest = left.metrics.latest_activity_at
            ? new Date(left.metrics.latest_activity_at).getTime()
            : 0;
          return rightLatest - leftLatest;
        }),
    [
      conversationMetricsByTenantId,
      filteredTenantGroups,
      knowledgeBases,
      workflowMetricsByTenantId,
    ],
  );

  const workflowSignals = useMemo(() => {
    const tenantsWithFailures = tenantWorkflowActivity.filter(
      (item) => item.recoveryPressure > 0,
    ).length;
    const tenantsWithQueuePressure = tenantWorkflowActivity.filter(
      (item) => item.queuePressure > 0,
    ).length;
    const tenantsWithRetries = tenantWorkflowActivity.filter(
      (item) => item.metrics.retry_runs > 0,
    ).length;
    const highestPressureTenant = tenantWorkflowActivity[0] ?? null;

    return {
      tenantsWithFailures,
      tenantsWithQueuePressure,
      tenantsWithRetries,
      highestPressureTenant,
    };
  }, [tenantWorkflowActivity]);

  const scopedRecoveryRunCount =
    scopedWorkflowMetrics.failed_runs + scopedWorkflowMetrics.cancelled_runs;
  const scopedRecoveryStatus =
    scopedWorkflowMetrics.failed_runs > 0
      ? "failed"
      : scopedWorkflowMetrics.cancelled_runs > 0
        ? "cancelled"
        : "failed";

  const documentSignals = useMemo(() => {
    const tenantsWithFailedDocuments = tenantDocumentActivity.filter(
      (item) => item.metrics.failed_documents > 0,
    ).length;
    const tenantsWithActiveIntake = tenantDocumentActivity.filter(
      (item) => item.metrics.active_documents > 0,
    ).length;
    const highestPressureTenant = tenantDocumentActivity[0] ?? null;

    return {
      tenantsWithFailedDocuments,
      tenantsWithActiveIntake,
      highestPressureTenant,
    };
  }, [tenantDocumentActivity]);

  const chatSignals = useMemo(() => {
    const now = Date.now();
    const staleTenantCount = tenantChatActivity.filter((item) => {
      if (!item.metrics.latest_activity_at) {
        return true;
      }

      return (
        now - new Date(item.metrics.latest_activity_at).getTime() >
        1000 * 60 * 60 * 24 * 7
      );
    }).length;
    const activeTenant = tenantChatActivity[0] ?? null;
    const idleConversationTenantCount = tenantChatActivity.filter(
      (item) =>
        item.metrics.total_conversations > 0 &&
        item.metrics.active_conversations === 0,
    ).length;

    return {
      activeTenant,
      idleConversationTenantCount,
      staleTenantCount,
    };
  }, [tenantChatActivity]);

  const normalizedSearchQuery = useMemo(
    () => searchQuery.trim().toLowerCase(),
    [searchQuery],
  );

  const searchedWorkspaces = useMemo(() => {
    if (!normalizedSearchQuery) {
      return filteredWorkspaces;
    }

    return filteredWorkspaces.filter((workspace) => {
      const tenant = tenants.find(
        (tenantItem) => tenantItem.id === workspace.tenant_id,
      );
      const workspaceKnowledgeBases = filteredKnowledgeBases.filter(
        (knowledgeBase) => knowledgeBase.workspace_id === workspace.id,
      );
      const searchableText = [
        tenant?.name,
        tenant?.slug,
        workspace.name,
        workspace.slug,
        workspace.description,
        ...workspaceKnowledgeBases.flatMap((knowledgeBase) => [
          knowledgeBase.name,
          knowledgeBase.slug,
          knowledgeBase.description,
        ]),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(normalizedSearchQuery);
    });
  }, [
    filteredKnowledgeBases,
    filteredWorkspaces,
    normalizedSearchQuery,
    tenants,
  ]);

  const searchedWorkspaceIds = useMemo(
    () => new Set(searchedWorkspaces.map((workspace) => workspace.id)),
    [searchedWorkspaces],
  );

  const searchedKnowledgeBases = useMemo(() => {
    const candidateKnowledgeBases = filteredKnowledgeBases.filter(
      (knowledgeBase) => {
        if (!searchedWorkspaceIds.has(knowledgeBase.workspace_id)) {
          return false;
        }

        if (retrievalProfileFilter !== "all") {
          if (
            retrievalProfileFilter === DEFAULT_RETRIEVAL_PROFILE_FILTER_VALUE
          ) {
            if (knowledgeBase.retrieval_profile_id) {
              return false;
            }
          } else if (
            retrievalProfileFilter === DISABLED_RETRIEVAL_PROFILE_FILTER_VALUE
          ) {
            if (!knowledgeBase.retrieval_profile_id) {
              return false;
            }

            const assignedRetrievalProfile =
              retrievalProfiles.find(
                (retrievalProfile) =>
                  retrievalProfile.id === knowledgeBase.retrieval_profile_id,
              ) ?? null;
            if (
              !assignedRetrievalProfile ||
              assignedRetrievalProfile.is_enabled
            ) {
              return false;
            }
          } else {
            const effectiveRetrievalProfileId =
              knowledgeBase.retrieval_profile_id ??
              defaultRetrievalProfile?.id ??
              null;
            if (effectiveRetrievalProfileId !== retrievalProfileFilter) {
              return false;
            }
          }
        }

        return true;
      },
    );

    if (!normalizedSearchQuery) {
      return candidateKnowledgeBases;
    }

    return candidateKnowledgeBases.filter((knowledgeBase) => {
      const workspace = workspaces.find(
        (workspaceItem) => workspaceItem.id === knowledgeBase.workspace_id,
      );
      const tenant = tenants.find(
        (tenantItem) => tenantItem.id === knowledgeBase.tenant_id,
      );
      const assignedRetrievalProfile = knowledgeBase.retrieval_profile_id
        ? (retrievalProfiles.find(
            (retrievalProfile) =>
              retrievalProfile.id === knowledgeBase.retrieval_profile_id,
          ) ?? null)
        : null;
      const effectiveRetrievalProfile =
        assignedRetrievalProfile ?? defaultRetrievalProfile;
      const searchableText = [
        knowledgeBase.name,
        knowledgeBase.slug,
        knowledgeBase.description,
        workspace?.name,
        workspace?.slug,
        tenant?.name,
        tenant?.slug,
        effectiveRetrievalProfile?.name,
        effectiveRetrievalProfile?.slug,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(normalizedSearchQuery);
    });
  }, [
    defaultRetrievalProfile,
    filteredKnowledgeBases,
    normalizedSearchQuery,
    retrievalProfileFilter,
    retrievalProfiles,
    searchedWorkspaceIds,
    tenants,
    workspaces,
  ]);

  const directoryTenantGroups = useMemo(() => {
    const visibleWorkspaceIds = new Set(
      searchedWorkspaces.map((workspace) => workspace.id),
    );

    return filteredTenantGroups
      .map((group) => {
        const visibleWorkspaces = group.workspaces
          .filter((workspace) => visibleWorkspaceIds.has(workspace.id))
          .map((workspace) => ({
            workspace,
            knowledgeBases: searchedKnowledgeBases.filter(
              (knowledgeBase) => knowledgeBase.workspace_id === workspace.id,
            ),
          }));
        const tenantMatchesSearch = [group.tenant.name, group.tenant.slug]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearchQuery);

        return {
          tenant: group.tenant,
          workspaces: visibleWorkspaces,
          knowledgeBaseCount: visibleWorkspaces.reduce(
            (count, item) => count + item.knowledgeBases.length,
            0,
          ),
          isVisible:
            !normalizedSearchQuery ||
            tenantMatchesSearch ||
            visibleWorkspaces.length > 0,
        };
      })
      .filter((group) => group.isVisible);
  }, [
    filteredTenantGroups,
    normalizedSearchQuery,
    searchedKnowledgeBases,
    searchedWorkspaces,
  ]);

  const filteredAgents = useMemo(
    () =>
      agents.filter(
        (agent) =>
          selectedTenantId === "all" || agent.tenant_id === selectedTenantId,
      ),
    [agents, selectedTenantId],
  );

  const searchedAgents = useMemo(() => {
    if (!normalizedSearchQuery) {
      return filteredAgents;
    }

    return filteredAgents.filter((agent) => {
      const tenant = tenants.find(
        (tenantItem) => tenantItem.id === agent.tenant_id,
      );
      const searchableText = [
        tenant?.name,
        tenant?.slug,
        agent.name,
        agent.slug,
        agent.objective,
        agent.instructions,
        agent.knowledge_base_scope,
        agent.mode,
        agent.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(normalizedSearchQuery);
    });
  }, [filteredAgents, normalizedSearchQuery, tenants]);

  const filteredUsers = useMemo(
    () =>
      users.filter(
        (user) =>
          selectedTenantId === "all" ||
          user.memberships.some(
            (membership) => membership.tenant_id === selectedTenantId,
          ),
      ),
    [selectedTenantId, users],
  );

  const searchedUsers = useMemo(() => {
    if (!normalizedSearchQuery) {
      return filteredUsers;
    }

    return filteredUsers.filter((user) => {
      const searchableText = [
        user.display_name,
        user.email,
        user.role,
        ...user.memberships.flatMap((membership) => [
          membership.tenant_name,
          membership.tenant_slug,
          membership.membership_status,
        ]),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(normalizedSearchQuery);
    });
  }, [filteredUsers, normalizedSearchQuery]);

  const adminWatchItems = useMemo<AdminWatchItem[]>(() => {
    const archivedWorkspaceCount = filteredWorkspaces.filter(
      (workspace) => workspace.is_archived,
    ).length;
    const firstArchivedWorkspace =
      filteredWorkspaces.find((workspace) => workspace.is_archived) ?? null;
    const draftKnowledgeBaseCount = filteredKnowledgeBases.filter(
      (knowledgeBase) => knowledgeBase.publication_status !== "published",
    ).length;
    const publishedKnowledgeBaseCount = filteredKnowledgeBases.filter(
      (knowledgeBase) => knowledgeBase.publication_status === "published",
    ).length;
    const draftAgentCount = filteredAgents.filter(
      (agent) => agent.status === "draft",
    ).length;
    const activeAgentsWithoutScopeCount =
      governancePosture.activeAgentsWithoutScope;
    const invitedMembershipCount = filteredUsers.reduce(
      (count, user) =>
        count +
        user.memberships.filter(
          (membership) => membership.membership_status === "invited",
        ).length,
      0,
    );
    const firstInvitedMemberRecord =
      filteredUsers
        .map((user) => ({
          user,
          membership:
            user.memberships.find(
              (membership) =>
                membership.membership_status === "invited" &&
                (selectedTenantId === "all" ||
                  membership.tenant_id === selectedTenantId),
            ) ?? null,
        }))
        .find((item) => item.membership !== null) ?? null;
    const fallbackPrimaryWorkspace = filteredWorkspaces[0] ?? null;
    const fallbackPrimaryKnowledgeBase =
      filteredKnowledgeBases.find(
        (knowledgeBase) =>
          knowledgeBase.workspace_id === fallbackPrimaryWorkspace?.id,
      ) ??
      filteredKnowledgeBases[0] ??
      null;

    return [
      {
        title: t("admin.watchlist.workflowRecoveryPressure"),
        detail:
          scopedRecoveryRunCount > 0
            ? t("admin.watchlist.workflowRecoveryPressureDetail", {
                count: String(scopedRecoveryRunCount),
                tenantCount: String(workflowSignals.tenantsWithFailures),
              })
            : t("admin.watchlist.workflowRecoveryHealthy"),
        status:
          scopedRecoveryRunCount > 0
            ? "attention"
            : workflowSignals.tenantsWithQueuePressure > 0
              ? "review"
              : "healthy",
        actionLabel: t("admin.watchlist.reviewWorkflowPressure"),
        actionHref:
          workflowSignals.highestPressureTenant?.failedHref ??
          buildOperationsHref({
            tenantId: selectedTenantId === "all" ? null : selectedTenantId,
            lane: "overview",
            status: "all",
          }),
      },
      {
        title: t("admin.watchlist.documentRecoveryPressure"),
        detail:
          scopedDocumentMetrics.failed_documents > 0
            ? t("admin.watchlist.documentRecoveryPressureDetail", {
                count: String(scopedDocumentMetrics.failed_documents),
                tenantCount: String(documentSignals.tenantsWithFailedDocuments),
              })
            : scopedDocumentMetrics.active_documents > 0
              ? t("admin.watchlist.documentIntakePressureDetail", {
                  count: String(scopedDocumentMetrics.active_documents),
                  tenantCount: String(documentSignals.tenantsWithActiveIntake),
                })
              : t("admin.watchlist.documentRecoveryHealthy"),
        status:
          scopedDocumentMetrics.failed_documents > 0
            ? "attention"
            : scopedDocumentMetrics.active_documents > 0
              ? "review"
              : "healthy",
        actionLabel: t("admin.watchlist.reviewDocumentPressure"),
        actionHref:
          documentSignals.highestPressureTenant?.failedDocumentsHref ??
          buildAdminWorkspaceHref("overview", {
            view: "documents",
            tenantId: selectedTenantId === "all" ? null : selectedTenantId,
            workspaceId: fallbackPrimaryWorkspace?.id ?? null,
            knowledgeBaseId: fallbackPrimaryKnowledgeBase?.id ?? null,
            documentStatus:
              scopedDocumentMetrics.failed_documents > 0 ? "failed" : null,
          }),
      },
      {
        title: t("admin.watchlist.memberActivationQueue"),
        detail:
          invitedMembershipCount > 0
            ? t("admin.watchlist.memberActivationQueueDetail", {
                count: String(invitedMembershipCount),
              })
            : t("admin.watchlist.memberActivationQueueHealthy"),
        status: invitedMembershipCount > 0 ? "review" : "healthy",
        actionLabel: t("admin.watchlist.reviewInvitations"),
        actionHref: firstInvitedMemberRecord?.membership
          ? buildMemberGovernanceHref(firstInvitedMemberRecord.user, {
              tenantId: firstInvitedMemberRecord.membership.tenant_id,
              memberRelationshipFilter: "invited",
            })
          : buildAdminHref({
              tenantId: selectedTenantId,
              section: "access",
              workspaceLifecycleFilter,
              knowledgeBasePublicationStatusFilter,
              memberRelationshipFilter: "invited",
            }),
      },
      {
        title: t("admin.watchlist.workspaceLifecycleReview"),
        detail:
          archivedWorkspaceCount > 0
            ? t("admin.watchlist.workspaceLifecycleReviewDetail", {
                count: String(archivedWorkspaceCount),
              })
            : t("admin.watchlist.workspaceLifecycleHealthy"),
        status: archivedWorkspaceCount > 0 ? "review" : "healthy",
        actionLabel: t("admin.watchlist.reviewArchived"),
        actionHref: firstArchivedWorkspace
          ? buildWorkspaceGovernanceHref(firstArchivedWorkspace)
          : buildAdminHref({
              tenantId: selectedTenantId,
              section: "directory",
              workspaceLifecycleFilter: "archived",
              knowledgeBasePublicationStatusFilter,
            }),
      },
      {
        title: t("admin.watchlist.knowledgePublicationGate"),
        detail:
          draftKnowledgeBaseCount > 0
            ? t("admin.watchlist.knowledgePublicationDetail", {
                count: String(draftKnowledgeBaseCount),
              })
            : t("admin.watchlist.knowledgePublicationHealthy"),
        status: draftKnowledgeBaseCount > 0 ? "attention" : "healthy",
        actionLabel: t("admin.watchlist.reviewDrafts"),
        actionHref: buildAdminHref({
          tenantId: selectedTenantId,
          section: "directory",
          workspaceLifecycleFilter,
          knowledgeBasePublicationStatusFilter: "draft",
        }),
      },
      {
        title: t("admin.watchlist.publishedRetrievalSurface"),
        detail:
          publishedKnowledgeBaseCount > 0
            ? t("admin.watchlist.publishedRetrievalDetail", {
                count: String(publishedKnowledgeBaseCount),
              })
            : t("admin.watchlist.publishedRetrievalEmpty"),
        status: publishedKnowledgeBaseCount > 0 ? "healthy" : "review",
        actionLabel: t("admin.watchlist.viewPublished"),
        actionHref: buildAdminHref({
          tenantId: selectedTenantId,
          section: "directory",
          workspaceLifecycleFilter,
          knowledgeBasePublicationStatusFilter: "published",
        }),
      },
      {
        title: t("admin.watchlist.retrievalGovernancePressure"),
        detail:
          retrievalGovernanceSummary.knowledgeBasesUsingDisabledRetrievalProfile >
          0
            ? t("admin.watchlist.retrievalGovernanceDisabledDetail", {
                count: String(
                  retrievalGovernanceSummary.knowledgeBasesUsingDisabledRetrievalProfile,
                ),
              })
            : retrievalGovernanceSummary.defaultFallbackKnowledgeBases > 0
              ? t("admin.watchlist.retrievalGovernanceDefaultFallbackDetail", {
                  count: String(
                    retrievalGovernanceSummary.defaultFallbackKnowledgeBases,
                  ),
                })
              : t("admin.watchlist.retrievalGovernanceHealthy"),
        status:
          retrievalGovernanceSummary.knowledgeBasesUsingDisabledRetrievalProfile >
          0
            ? "attention"
            : retrievalGovernanceSummary.defaultFallbackKnowledgeBases > 0
              ? "review"
              : "healthy",
        actionLabel: t("admin.watchlist.reviewRetrievalGovernance"),
        actionHref: buildAdminHref({
          tenantId: selectedTenantId,
          section: "directory",
          workspaceLifecycleFilter,
          knowledgeBasePublicationStatusFilter,
          retrievalProfileFilter:
            retrievalGovernanceSummary.knowledgeBasesUsingDisabledRetrievalProfile >
            0
              ? DISABLED_RETRIEVAL_PROFILE_FILTER_VALUE
              : DEFAULT_RETRIEVAL_PROFILE_FILTER_VALUE,
        }),
      },
      {
        title: t("admin.watchlist.runtimeGovernancePressure"),
        detail:
          governancePosture.agentsUsingDisabledModel > 0 ||
          governancePosture.agentsUsingUnconfiguredModel > 0 ||
          governancePosture.agentsUsingDisabledToolRegistration > 0 ||
          governancePosture.agentsUsingDisabledRetrievalProfile > 0
            ? t("admin.watchlist.runtimeGovernancePressureDetail", {
                count: String(
                  governancePosture.agentsUsingDisabledModel +
                    governancePosture.agentsUsingUnconfiguredModel +
                    governancePosture.agentsUsingDisabledToolRegistration +
                    governancePosture.agentsUsingDisabledRetrievalProfile,
                ),
              })
            : governancePosture.agentsMissingRetrievalProfile > 0
              ? t("admin.watchlist.runtimeGovernanceMissingRetrievalDetail", {
                  count: String(
                    governancePosture.agentsMissingRetrievalProfile,
                  ),
                })
              : governancePosture.approvalGatedTools > 0
                ? t("admin.watchlist.runtimeGovernanceApprovalDetail", {
                    count: String(governancePosture.approvalGatedTools),
                  })
                : t("admin.watchlist.runtimeGovernanceHealthy"),
        status:
          governancePosture.agentsUsingDisabledModel > 0 ||
          governancePosture.agentsUsingUnconfiguredModel > 0 ||
          governancePosture.agentsUsingDisabledToolRegistration > 0 ||
          governancePosture.agentsUsingDisabledRetrievalProfile > 0
            ? "attention"
            : governancePosture.agentsMissingRetrievalProfile > 0
              ? "review"
              : governancePosture.approvalGatedTools > 0
                ? "review"
                : "healthy",
        actionLabel: t("admin.watchlist.reviewRuntimeGovernance"),
        actionHref:
          governancePosture.agentsUsingDisabledModel > 0 ||
          governancePosture.agentsUsingUnconfiguredModel > 0 ||
          governancePosture.agentsUsingDisabledToolRegistration > 0 ||
          governancePosture.agentsUsingDisabledRetrievalProfile > 0 ||
          governancePosture.approvalGatedTools > 0
            ? governancePosture.agentsUsingUnconfiguredModel > 0 &&
              governancePosture.agentsUsingDisabledModel === 0 &&
              governancePosture.agentsUsingDisabledToolRegistration === 0 &&
              governancePosture.agentsUsingDisabledRetrievalProfile === 0
              ? buildAgentsHref({
                  tenantId: selectedTenantId,
                  status: "active",
                  ...buildRuntimeGovernanceIssueDefinitionsTarget({
                    issue: "model_runtime_unconfigured",
                  }),
                  readiness: "attention",
                })
              : focusedRuntimeDefinitionsHref
            : buildAgentsHref({
                tenantId: selectedTenantId,
                status: "active",
                readiness:
                  governancePosture.agentsMissingRetrievalProfile > 0
                    ? "attention"
                    : "all",
                ...(governancePosture.agentsMissingRetrievalProfile > 0
                  ? buildRuntimeGovernanceIssueDefinitionsTarget({
                      issue: "retrieval_profile_missing",
                    })
                  : { issue: null }),
              }),
      },
      {
        title: t("admin.watchlist.agentGovernanceGate"),
        detail:
          activeAgentsWithoutScopeCount > 0
            ? t("admin.watchlist.agentGovernanceDetail", {
                count: String(activeAgentsWithoutScopeCount),
              })
            : draftAgentCount > 0
              ? t("admin.watchlist.agentDraftDetail", {
                  count: String(draftAgentCount),
                })
              : t("admin.watchlist.agentGovernanceHealthy"),
        status:
          activeAgentsWithoutScopeCount > 0
            ? "attention"
            : draftAgentCount > 0
              ? "review"
              : "healthy",
        actionLabel: t("admin.watchlist.reviewAgents"),
        actionHref: buildAgentsHref({
          tenantId: selectedTenantId,
          status:
            activeAgentsWithoutScopeCount > 0
              ? "active"
              : draftAgentCount > 0
                ? "draft"
                : "all",
        }),
      },
    ];
  }, [
    filteredAgents,
    filteredKnowledgeBases,
    filteredUsers,
    filteredWorkspaces,
    focusedRuntimeDefinitionsHref,
    knowledgeBasePublicationStatusFilter,
    memberRelationshipFilter,
    selectedTenantId,
    scopedDocumentMetrics.active_documents,
    scopedDocumentMetrics.failed_documents,
    scopedRecoveryRunCount,
    t,
    documentSignals.highestPressureTenant,
    documentSignals.tenantsWithActiveIntake,
    documentSignals.tenantsWithFailedDocuments,
    governancePosture.agentsUsingDisabledModel,
    governancePosture.agentsUsingDisabledToolRegistration,
    governancePosture.approvalGatedTools,
    governancePosture.activeAgentsWithoutScope,
    retrievalGovernanceSummary.defaultFallbackKnowledgeBases,
    retrievalGovernanceSummary.knowledgeBasesUsingDisabledRetrievalProfile,
    workflowSignals.highestPressureTenant,
    workflowSignals.tenantsWithFailures,
    workflowSignals.tenantsWithQueuePressure,
    workspaceLifecycleFilter,
  ]);

  const metrics = useMemo(
    () => [
      {
        icon: Building2,
        iconClassName: "bg-blue-50 text-blue-600",
        label: t("admin.metrics.managedTenants"),
        value: filteredTenantGroups.length,
        hint: t("admin.metrics.managedTenantsHint"),
        href: buildAdminHref({ section: "overview" }),
      },
      {
        icon: Boxes,
        iconClassName: "bg-cyan-50 text-cyan-600",
        label: t("admin.metrics.activeWorkspaces"),
        value: filteredWorkspaces.filter((workspace) => !workspace.is_archived)
          .length,
        hint: t("admin.metrics.activeWorkspacesHint"),
        href: buildAdminHref({
          section: "directory",
          tenantId: selectedTenantId,
          workspaceLifecycleFilter: "active",
          knowledgeBasePublicationStatusFilter,
        }),
      },
      {
        icon: Library,
        iconClassName: "bg-violet-50 text-violet-600",
        label: t("admin.metrics.publishedKnowledgeBases"),
        value: filteredKnowledgeBases.filter(
          (knowledgeBase) => knowledgeBase.publication_status === "published",
        ).length,
        hint: t("admin.metrics.publishedKnowledgeBasesHint"),
        href: buildAdminHref({
          section: "directory",
          tenantId: selectedTenantId,
          workspaceLifecycleFilter,
          knowledgeBasePublicationStatusFilter: "published",
        }),
      },
      {
        icon: Bot,
        iconClassName: "bg-emerald-50 text-emerald-600",
        label: t("admin.metrics.activeAgents"),
        value: filteredAgents.filter((agent) => agent.status === "active")
          .length,
        hint: t("admin.metrics.activeAgentsHint"),
        href: buildAgentsHref({
          tenantId: selectedTenantId,
          status: "active",
        }),
      },
      {
        icon: ShieldAlert,
        iconClassName: "bg-amber-50 text-amber-600",
        label: t("admin.metrics.pendingControls"),
        value: adminWatchItems.filter((item) => item.status !== "healthy")
          .length,
        hint: t("admin.metrics.pendingControlsHint"),
        href: buildAdminHref({
          section: "security",
          tenantId: selectedTenantId,
          workspaceLifecycleFilter,
          knowledgeBasePublicationStatusFilter:
            knowledgeBasePublicationStatusFilter === "all"
              ? "draft"
              : knowledgeBasePublicationStatusFilter,
        }),
      },
    ],
    [
      adminWatchItems,
      filteredAgents,
      filteredKnowledgeBases,
      filteredTenantGroups.length,
      filteredWorkspaces,
      knowledgeBasePublicationStatusFilter,
      selectedTenantId,
      t,
      workspaceLifecycleFilter,
    ],
  );

  const accessSummaryItems = useMemo(
    () => [
      {
        label: t("admin.accessSummary.totalMembers"),
        value: accessGovernanceSummary.total_members,
        hint: t("admin.accessSummary.totalMembersHint"),
      },
      {
        label: t("admin.accessSummary.invitedMemberships"),
        value: accessGovernanceSummary.invited_memberships,
        hint: t("admin.accessSummary.invitedMembershipsHint"),
      },
      {
        label: t("admin.accessSummary.suspendedMemberships"),
        value: accessGovernanceSummary.suspended_memberships,
        hint: t("admin.accessSummary.suspendedMembershipsHint"),
      },
      {
        label: t("admin.accessSummary.auditEvents"),
        value: accessGovernanceSummary.total_audit_events,
        hint: t("admin.accessSummary.auditEventsHint"),
      },
    ],
    [accessGovernanceSummary, t],
  );

  const accessEventBreakdownItems = useMemo(
    () => accessGovernanceSummary.event_breakdown.slice(0, 6),
    [accessGovernanceSummary.event_breakdown],
  );

  const invitedActivationQueue = useMemo(() => {
    return searchedUsers
      .flatMap((user) =>
        user.memberships
          .filter(
            (membership) =>
              membership.membership_status === "invited" &&
              (selectedTenantId === "all" ||
                membership.tenant_id === selectedTenantId),
          )
          .map((membership) => {
            const invitationCredential =
              revealedInvitationByMembershipId[membership.id] ?? null;
            const invitationExpiresAt =
              invitationCredential?.invitation_expires_at ??
              membership.invitation_expires_at ??
              null;

            return {
              user,
              membership,
              invitationCredential,
              invitationExpired: isInvitationExpired(invitationExpiresAt),
              invitationIssuedAt:
                invitationCredential?.invited_at ??
                membership.invited_at ??
                null,
              invitationExpiresAt,
            };
          }),
      )
      .sort((left, right) => {
        if (left.invitationExpired !== right.invitationExpired) {
          return left.invitationExpired ? -1 : 1;
        }

        const leftExpiresAt = left.invitationExpiresAt
          ? new Date(left.invitationExpiresAt).getTime()
          : Number.MAX_SAFE_INTEGER;
        const rightExpiresAt = right.invitationExpiresAt
          ? new Date(right.invitationExpiresAt).getTime()
          : Number.MAX_SAFE_INTEGER;
        if (leftExpiresAt !== rightExpiresAt) {
          return leftExpiresAt - rightExpiresAt;
        }

        const leftInvitedAt = left.invitationIssuedAt
          ? new Date(left.invitationIssuedAt).getTime()
          : 0;
        const rightInvitedAt = right.invitationIssuedAt
          ? new Date(right.invitationIssuedAt).getTime()
          : 0;
        return rightInvitedAt - leftInvitedAt;
      })
      .slice(0, 6);
  }, [revealedInvitationByMembershipId, searchedUsers, selectedTenantId]);

  const securitySummaryItems = useMemo(() => {
    return [
      {
        label: t("admin.securitySummary.activeAccounts"),
        value: accessGovernanceSummary.active_accounts,
        hint: t("admin.securitySummary.activeAccountsHint"),
      },
      {
        label: t("admin.securitySummary.dormantAccounts"),
        value: accessGovernanceSummary.dormant_accounts,
        hint: t("admin.securitySummary.dormantAccountsHint"),
      },
      {
        label: t("admin.securitySummary.expiringInvitations"),
        value:
          accessGovernanceSummary.expiring_invitations +
          accessGovernanceSummary.expired_invitations,
        hint: t("admin.securitySummary.expiringInvitationsHint"),
      },
      {
        label: t("admin.securitySummary.failedSignIns"),
        value: accessGovernanceSummary.recent_failed_sign_in_events,
        hint: t("admin.securitySummary.failedSignInsHint"),
      },
    ];
  }, [accessGovernanceSummary, t]);

  const securityWatchItems = useMemo<AdminWatchItem[]>(() => {
    const expiredInvitationReview =
      accessGovernanceSummary.review_items.find(
        (item) => item.category === "expired_invitations",
      ) ?? null;
    const expiringInvitationReview =
      accessGovernanceSummary.review_items.find(
        (item) => item.category === "expiring_invitations",
      ) ?? null;
    const dormantAccountReview =
      accessGovernanceSummary.review_items.find(
        (item) => item.category === "dormant_accounts",
      ) ?? null;
    const suspendedMembershipReview =
      accessGovernanceSummary.review_items.find(
        (item) => item.category === "suspended_memberships",
      ) ?? null;
    const failedSignInPressureReview =
      accessGovernanceSummary.review_items.find(
        (item) => item.category === "failed_sign_in_pressure",
      ) ?? null;
    const invitationActivationPressureReview =
      accessGovernanceSummary.review_items.find(
        (item) => item.category === "invitation_activation_pressure",
      ) ?? null;
    const sessionSpreadPressureReview =
      accessGovernanceSummary.review_items.find(
        (item) => item.category === "session_spread_pressure",
      ) ?? null;

    return [
      {
        title: t("admin.securityWatch.expiredInvitations"),
        detail:
          accessGovernanceSummary.expired_invitations > 0
            ? t("admin.securityWatch.expiredInvitationsDetail", {
                count: String(accessGovernanceSummary.expired_invitations),
              })
            : t("admin.securityWatch.expiredInvitationsHealthy"),
        status: expiredInvitationReview?.severity ?? "healthy",
        actionLabel: t("admin.securityWatch.reviewInvitations"),
        actionHref: buildAccessGovernanceReviewHref(expiredInvitationReview, {
          tenantId: selectedTenantId,
          memberRelationshipFilter: "invited",
        }),
      },
      {
        title: t("admin.securityWatch.expiringInvitations"),
        detail:
          accessGovernanceSummary.expiring_invitations > 0
            ? t("admin.securityWatch.expiringInvitationsDetail", {
                count: String(accessGovernanceSummary.expiring_invitations),
              })
            : t("admin.securityWatch.expiringInvitationsHealthy"),
        status: expiringInvitationReview?.severity ?? "healthy",
        actionLabel: t("admin.securityWatch.reviewInvitations"),
        actionHref: buildAccessGovernanceReviewHref(expiringInvitationReview, {
          tenantId: selectedTenantId,
          memberRelationshipFilter: "invited",
        }),
      },
      {
        title: t("admin.securityWatch.dormantAccounts"),
        detail:
          accessGovernanceSummary.dormant_accounts > 0
            ? t("admin.securityWatch.dormantAccountsDetail", {
                count: String(accessGovernanceSummary.dormant_accounts),
              })
            : t("admin.securityWatch.dormantAccountsHealthy"),
        status: dormantAccountReview?.severity ?? "healthy",
        actionLabel: t("admin.securityWatch.reviewAccounts"),
        actionHref: buildAccessGovernanceReviewHref(dormantAccountReview, {
          tenantId: selectedTenantId,
          memberAccountFilter: "active",
        }),
      },
      {
        title: t("admin.securityWatch.failedSignInPressure"),
        detail:
          accessGovernanceSummary.members_under_sign_in_lockout > 0
            ? t("admin.securityWatch.failedSignInPressureDetail", {
                count: String(
                  accessGovernanceSummary.members_under_sign_in_lockout,
                ),
              })
            : t("admin.securityWatch.failedSignInPressureHealthy"),
        status: failedSignInPressureReview?.severity ?? "healthy",
        actionLabel: t("admin.securityWatch.reviewFailedSignIns"),
        actionHref: buildAccessGovernanceReviewHref(
          failedSignInPressureReview,
          {
            tenantId: selectedTenantId,
            memberAccountFilter: "active",
          },
        ),
      },
      {
        title: t("admin.securityWatch.invitationActivationPressure"),
        detail:
          accessGovernanceSummary.members_with_failed_invitation_activation > 0
            ? t("admin.securityWatch.invitationActivationPressureDetail", {
                count: String(
                  accessGovernanceSummary.members_with_failed_invitation_activation,
                ),
              })
            : t("admin.securityWatch.invitationActivationPressureHealthy"),
        status: invitationActivationPressureReview?.severity ?? "healthy",
        actionLabel: t("admin.securityWatch.reviewInvitations"),
        actionHref: buildAccessGovernanceReviewHref(
          invitationActivationPressureReview,
          {
            tenantId: selectedTenantId,
            memberRelationshipFilter: "invited",
          },
        ),
      },
      {
        title: t("admin.securityWatch.sessionSpreadPressure"),
        detail:
          accessGovernanceSummary.members_with_session_spread > 0
            ? t("admin.securityWatch.sessionSpreadPressureDetail", {
                count: String(
                  accessGovernanceSummary.members_with_session_spread,
                ),
              })
            : t("admin.securityWatch.sessionSpreadPressureHealthy"),
        status: sessionSpreadPressureReview?.severity ?? "healthy",
        actionLabel: t("admin.securityWatch.reviewAccounts"),
        actionHref: buildAccessGovernanceReviewHref(
          sessionSpreadPressureReview,
          {
            tenantId: selectedTenantId,
            memberAccountFilter: "active",
          },
        ),
      },
      {
        title: t("admin.securityWatch.suspendedMemberships"),
        detail:
          accessGovernanceSummary.suspended_memberships > 0
            ? t("admin.securityWatch.suspendedMembershipsDetail", {
                count: String(accessGovernanceSummary.suspended_memberships),
              })
            : t("admin.securityWatch.suspendedMembershipsHealthy"),
        status: suspendedMembershipReview?.severity ?? "healthy",
        actionLabel: t("admin.securityWatch.reviewSuspended"),
        actionHref: buildAccessGovernanceReviewHref(suspendedMembershipReview, {
          tenantId: selectedTenantId,
          memberRelationshipFilter: "suspended",
        }),
      },
    ];
  }, [accessGovernanceSummary, selectedTenantId, t]);

  const currentActorSecurityPosture = useMemo(() => {
    if (!session?.userId) {
      return null;
    }

    return users.find((user) => user.id === session.userId) ?? null;
  }, [session?.userId, users]);
  const currentActorInvitationRisk = currentActorAccessSummary
    ? currentActorAccessSummary.expiring_invitations +
      currentActorAccessSummary.expired_invitations
    : null;

  const overviewLaneItems = useMemo(
    () => [
      {
        key: "directory",
        title: t("admin.overviewLanes.directory.title"),
        description: t("admin.overviewLanes.directory.description", {
          workspaceCount: String(filteredWorkspaces.length),
          knowledgeBaseCount: String(filteredKnowledgeBases.length),
        }),
        value: t("admin.overviewLanes.directory.value", {
          agentCount: String(filteredAgents.length),
        }),
        href: buildAdminHref({
          tenantId: selectedTenantId,
          section: "directory",
          workspaceLifecycleFilter,
          knowledgeBasePublicationStatusFilter,
        }),
      },
      {
        key: "access",
        title: t("admin.overviewLanes.access.title"),
        description: t("admin.overviewLanes.access.description", {
          memberCount: String(accessGovernanceSummary.total_members),
        }),
        value: t("admin.overviewLanes.access.value", {
          invitedCount: String(accessGovernanceSummary.invited_memberships),
        }),
        href: buildAdminHref({
          tenantId: selectedTenantId,
          section: "access",
          memberAccountFilter,
          memberRelationshipFilter,
        }),
      },
      {
        key: "security",
        title: t("admin.overviewLanes.security.title"),
        description: t("admin.overviewLanes.security.description", {
          eventCount: String(accessGovernanceSummary.total_audit_events),
        }),
        value: t("admin.overviewLanes.security.value", {
          count: String(accessGovernanceSummary.review_queue_items),
        }),
        href: buildAdminHref({
          tenantId: selectedTenantId,
          section: "security",
          memberAccountFilter,
          memberRelationshipFilter,
        }),
      },
    ],
    [
      accessGovernanceSummary.invited_memberships,
      accessGovernanceSummary.review_queue_items,
      accessGovernanceSummary.total_audit_events,
      accessGovernanceSummary.total_members,
      filteredAgents.length,
      filteredKnowledgeBases.length,
      filteredWorkspaces.length,
      knowledgeBasePublicationStatusFilter,
      memberAccountFilter,
      memberRelationshipFilter,
      selectedTenantId,
      t,
      workspaceLifecycleFilter,
    ],
  );

  const adminSections = [
    {
      key: "overview" as const,
      label: t("admin.sections.overview"),
      description: t("admin.sections.overviewDescription"),
    },
    {
      key: "directory" as const,
      label: t("admin.sections.directory"),
      description: t("admin.sections.directoryDescription"),
    },
    {
      key: "access" as const,
      label: t("admin.sections.access"),
      description: t("admin.sections.accessDescription"),
    },
    {
      key: "runtime" as const,
      label: t("admin.sections.runtime"),
      description: t("admin.sections.runtimeDescription"),
    },
    {
      key: "security" as const,
      label: t("admin.sections.security"),
      description: t("admin.sections.securityDescription"),
    },
  ];
  const visibleAdminSections = showAdvancedAdminSections
    ? adminSections
    : adminSections.filter((section) => section.key !== "security");
  const showOverviewSection = adminSection === "overview";
  const showDirectorySection = adminSection === "directory";
  const showAccessSection = adminSection === "access";
  const showRuntimeSection = adminSection === "runtime";
  const showSecuritySection =
    showAdvancedAdminSections && adminSection === "security";
  const currentAdminSection =
    visibleAdminSections.find((section) => section.key === adminSection) ??
    visibleAdminSections[0];

  function buildWorkspaceContextHref(
    workspace: Workspace,
    view: "chat" | "documents" | "workflows",
  ) {
    const firstKnowledgeBase =
      knowledgeBases.find(
        (knowledgeBase) => knowledgeBase.workspace_id === workspace.id,
      ) ?? null;

    return buildAdminWorkspaceHref(adminSection, {
      view,
      tenantId: workspace.tenant_id,
      workspaceId: workspace.id,
      knowledgeBaseId: firstKnowledgeBase?.id ?? null,
    });
  }

  function buildWorkspaceGovernanceHref(workspace: Workspace) {
    return buildAdminHref({
      tenantId: workspace.tenant_id,
      section: "directory",
      workspaceId: workspace.id,
      managementPanel: "workspace-edit",
    });
  }

  function buildKnowledgeBaseContextHref(
    knowledgeBase: KnowledgeBase,
    view: "documents" | "workflows",
  ) {
    return buildAdminWorkspaceHref(adminSection, {
      view,
      tenantId: knowledgeBase.tenant_id,
      workspaceId: knowledgeBase.workspace_id,
      knowledgeBaseId: knowledgeBase.id,
    });
  }

  function buildKnowledgeBaseGovernanceHref(
    knowledgeBase: KnowledgeBase,
    options?: {
      retrievalProfileFilter?: string | null;
    },
  ) {
    return buildAdminHref({
      tenantId: knowledgeBase.tenant_id,
      section: "directory",
      retrievalProfileFilter: options?.retrievalProfileFilter ?? null,
      knowledgeBaseId: knowledgeBase.id,
      managementPanel: "knowledge-base-edit",
    });
  }

  function buildMemberGovernanceHref(
    user: UserDirectoryItem | string,
    options?: {
      tenantId?: string | null;
      memberRelationshipFilter?: string | null;
    },
  ) {
    return buildAdminHref({
      tenantId: options?.tenantId ?? null,
      section: "access",
      memberRelationshipFilter: options?.memberRelationshipFilter ?? null,
      userId: typeof user === "string" ? user : user.id,
      managementPanel: "user-edit",
    });
  }

  function buildAccessGovernanceReviewHref(
    reviewItem: DirectoryAccessGovernanceSummary["review_items"][number] | null,
    fallbackOptions?: {
      tenantId?: string | null;
      memberRelationshipFilter?: string | null;
      memberAccountFilter?: string | null;
    },
  ) {
    const followUp = reviewItem?.follow_up;
    if (followUp?.user_id) {
      return buildAdminHref({
        tenantId: followUp.tenant_id ?? fallbackOptions?.tenantId ?? null,
        section: "access",
        memberRelationshipFilter:
          followUp.member_relationship_filter ??
          fallbackOptions?.memberRelationshipFilter ??
          null,
        memberAccountFilter:
          followUp.member_account_filter ??
          fallbackOptions?.memberAccountFilter ??
          null,
        userId: followUp.user_id,
        managementPanel: followUp.management_panel ?? "user-edit",
      });
    }

    return buildAdminHref({
      tenantId: followUp?.tenant_id ?? fallbackOptions?.tenantId ?? null,
      section: "security",
      memberRelationshipFilter:
        followUp?.member_relationship_filter ??
        fallbackOptions?.memberRelationshipFilter ??
        null,
      memberAccountFilter:
        followUp?.member_account_filter ??
        fallbackOptions?.memberAccountFilter ??
        null,
    });
  }

  const scopedPrimaryWorkspace = filteredWorkspaces[0] ?? null;
  const scopedPrimaryKnowledgeBase = scopedPrimaryWorkspace
    ? (knowledgeBases.find(
        (knowledgeBase) =>
          knowledgeBase.workspace_id === scopedPrimaryWorkspace.id,
      ) ?? null)
    : null;
  const chatScopeHref = buildAdminWorkspaceHref(adminSection, {
    view: "chat",
    tenantId:
      selectedTenantId === "all"
        ? (scopedPrimaryWorkspace?.tenant_id ?? null)
        : selectedTenantId,
    workspaceId: scopedPrimaryWorkspace?.id ?? null,
    knowledgeBaseId: scopedPrimaryKnowledgeBase?.id ?? null,
  });
  const staleChatScopeHref =
    chatSignals.activeTenant?.openHref ?? chatScopeHref;
  const idleConversationScopeHref =
    tenantChatActivity.find(
      (item) =>
        item.metrics.total_conversations > 0 &&
        item.metrics.active_conversations === 0,
    )?.openHref ?? chatScopeHref;

  const runtimeRoutes = useMemo<AdminRuntimeRoute[]>(() => {
    return searchedAgents
      .filter((agent) => agent.status === "active")
      .slice(0, 4)
      .map((agent) => {
        const resolvedScope = resolveKnowledgeBaseScopeSelection(
          agent.knowledge_base_scope,
          workspaces,
          knowledgeBases,
        );
        const workspaceId =
          resolvedScope.workspaceId || scopedPrimaryWorkspace?.id || null;
        const knowledgeBaseId =
          resolvedScope.knowledgeBaseId ||
          scopedPrimaryKnowledgeBase?.id ||
          null;
        const tenantId = agent.tenant_id;
        const scopeResolved = Boolean(workspaceId && knowledgeBaseId);
        const resolvedWorkspace =
          workspaces.find((workspace) => workspace.id === workspaceId) ?? null;
        const resolvedKnowledgeBase =
          knowledgeBases.find(
            (knowledgeBase) => knowledgeBase.id === knowledgeBaseId,
          ) ?? null;
        const assignedRetrievalProfileId =
          resolvedKnowledgeBase?.retrieval_profile_id?.trim() ?? "";
        const selectedRetrievalProfile = assignedRetrievalProfileId
          ? (retrievalProfiles.find(
              (retrievalProfile) =>
                retrievalProfile.id === assignedRetrievalProfileId,
            ) ?? null)
          : null;
        const retrievalProfileSource =
          agent.mode === "workflow_recovery"
            ? null
            : assignedRetrievalProfileId
              ? ("knowledge_base" as const)
              : defaultRetrievalProfile
                ? ("platform_default" as const)
                : null;
        const resolvedRetrievalProfile =
          agent.mode === "workflow_recovery"
            ? null
            : assignedRetrievalProfileId
              ? selectedRetrievalProfile
              : defaultRetrievalProfile;
        const retrievalIssue =
          agent.mode === "workflow_recovery" || !scopeResolved
            ? null
            : !resolvedRetrievalProfile
              ? ("missing" as const)
              : !resolvedRetrievalProfile.is_enabled
                ? ("disabled" as const)
                : null;
        const launchReady =
          agent.mode === "workflow_recovery" ||
          (scopeResolved && retrievalIssue === null);
        const prompts = buildAgentLaunchPrompts({
          agent: {
            mode: agent.mode,
            objective: agent.objective,
          },
          scopeLabel: agent.knowledge_base_scope ?? null,
          language,
        });
        const targetLabel =
          agent.mode === "workflow_recovery"
            ? t("admin.runtimeTaskPacket.targets.operations")
            : agent.mode === "document_intake"
              ? t("admin.runtimeTaskPacket.targets.documents")
              : t("admin.runtimeTaskPacket.targets.chat");

        const recommendedHref =
          agent.mode === "workflow_recovery"
            ? buildOperationsHref({
                tenantId,
                agentId: agent.id,
                lane: "failed",
                status: scopedRecoveryStatus,
              })
            : buildAdminWorkspaceHref("overview", {
                view: agent.mode === "document_intake" ? "documents" : "chat",
                tenantId,
                workspaceId,
                knowledgeBaseId,
                agentId: agent.id,
                handoffIntent: "agent_brief",
                draftQuestion: prompts[0] ?? null,
              });

        const secondaryHref =
          agent.mode === "workflow_recovery"
            ? buildAdminWorkspaceHref("overview", {
                view: "documents",
                tenantId,
                workspaceId,
                knowledgeBaseId,
                agentId: agent.id,
                handoffIntent: "document_recovery",
                documentStatus: "failed",
              })
            : buildOperationsHref({
                tenantId,
                agentId: agent.id,
                lane: agent.mode === "document_intake" ? "failed" : "overview",
                status: agent.mode === "document_intake" ? "failed" : "all",
              });
        const definitionHref = buildAgentsHref({
          tenantId: agent.tenant_id,
          status: "active",
          agentId: agent.id,
        });
        const governanceHref =
          resolvedKnowledgeBase && retrievalIssue
            ? buildKnowledgeBaseGovernanceHref(resolvedKnowledgeBase, {
                retrievalProfileFilter:
                  retrievalIssue === "disabled"
                    ? DISABLED_RETRIEVAL_PROFILE_FILTER_VALUE
                    : null,
              })
            : buildAdminHref({
                tenantId: agent.tenant_id,
                section: "access",
              });
        const recommendedRunRecord: AgentRunRecordInput | null = launchReady
          ? {
              tenant_id: tenantId,
              agent_definition_id: agent.id,
              workspace_id: workspaceId,
              knowledge_base_id: knowledgeBaseId,
              target_surface:
                agent.mode === "workflow_recovery"
                  ? "operations"
                  : agent.mode === "document_intake"
                    ? "documents"
                    : "chat",
              handoff_intent:
                agent.mode === "workflow_recovery"
                  ? "workflow_recovery"
                  : "agent_brief",
              trigger_source: "admin",
              launch_prompt: prompts[0] ?? null,
            }
          : null;
        const secondaryRunRecord: AgentRunRecordInput | null =
          agent.mode === "workflow_recovery"
            ? {
                tenant_id: tenantId,
                agent_definition_id: agent.id,
                workspace_id: workspaceId,
                knowledge_base_id: knowledgeBaseId,
                target_surface: "documents",
                handoff_intent: "document_recovery",
                trigger_source: "admin",
                launch_prompt: prompts[0] ?? null,
              }
            : {
                tenant_id: tenantId,
                agent_definition_id: agent.id,
                workspace_id: workspaceId,
                knowledge_base_id: knowledgeBaseId,
                target_surface: "operations",
                handoff_intent: "agent_brief",
                trigger_source: "admin",
                launch_prompt: prompts[0] ?? null,
              };

        return {
          agent,
          definitionHref,
          governanceHref,
          launchReady,
          prompt: prompts[0] ?? "",
          retrievalIssue,
          retrievalProfile: resolvedRetrievalProfile,
          retrievalProfileSource,
          resolvedKnowledgeBase,
          resolvedWorkspace,
          recommendedHref,
          recommendedRunRecord,
          scopeResolved,
          scopeLabel: agent.knowledge_base_scope ?? null,
          secondaryHref,
          secondaryRunRecord,
          targetLabel,
        };
      });
  }, [
    defaultRetrievalProfile,
    knowledgeBases,
    language,
    retrievalProfiles,
    scopedPrimaryKnowledgeBase?.id,
    scopedPrimaryWorkspace?.id,
    searchedAgents,
    t,
    workspaces,
  ]);

  const focusedRuntimeRoute = useMemo(
    () =>
      runtimeRoutes.find((item) => item.launchReady) ??
      runtimeRoutes[0] ??
      null,
    [runtimeRoutes],
  );

  const runtimeTaskPacket = useMemo(() => {
    if (!focusedRuntimeRoute) {
      return {
        detail: t("admin.runtimeTaskPacket.emptyDetail"),
        objective: t("admin.runtimeRoutes.noObjective"),
        primaryActionHref: buildAgentsHref({
          tenantId: selectedTenantId === "all" ? null : selectedTenantId,
          status: "active",
        }),
        primaryActionRunRecord: null,
        prompt: t("admin.runtimeTaskPacket.noPrompt"),
        secondaryActions: [
          {
            label: t("admin.runtimeTaskPacket.secondaryAccess"),
            href: buildAdminHref({
              tenantId: selectedTenantId === "all" ? null : selectedTenantId,
              section: "access",
            }),
            runRecord: null,
          },
        ],
        statusLabel: t("admin.runtimeTaskPacket.statuses.review"),
        statusTone: "review" as const,
        summaryItems: [
          {
            label: t("admin.runtimeTaskPacket.fields.mode"),
            value: t("admin.runtimeTaskPacket.unresolved"),
          },
          {
            label: t("admin.runtimeTaskPacket.fields.target"),
            value: t("admin.runtimeTaskPacket.unresolved"),
          },
          {
            label: t("admin.runtimeTaskPacket.fields.scope"),
            value: t("admin.runtimeTaskPacket.unresolved"),
          },
          {
            label: t("admin.runtimeTaskPacket.fields.workspace"),
            value: t("admin.runtimeTaskPacket.unresolved"),
          },
          {
            label: t("admin.runtimeTaskPacket.fields.knowledgeBase"),
            value: t("admin.runtimeTaskPacket.unresolved"),
          },
        ],
        title: t("admin.runtimeTaskPacket.emptyTitle"),
      };
    }

    return {
      detail: focusedRuntimeRoute.launchReady
        ? t("admin.runtimeTaskPacket.readyDetail", {
            surface: focusedRuntimeRoute.targetLabel,
          })
        : focusedRuntimeRoute.retrievalIssue === "disabled"
          ? t("admin.runtimeTaskPacket.retrievalDisabledDetail", {
              profile:
                focusedRuntimeRoute.retrievalProfile?.name ??
                t("agents.dependencies.noRetrievalProfile"),
            })
          : focusedRuntimeRoute.retrievalIssue === "missing"
            ? t("admin.runtimeTaskPacket.retrievalMissingDetail", {
                surface: focusedRuntimeRoute.targetLabel,
              })
            : t("admin.runtimeTaskPacket.scopeReviewDetail", {
                surface: focusedRuntimeRoute.targetLabel,
              }),
      objective: focusedRuntimeRoute.agent.objective.trim().length
        ? focusedRuntimeRoute.agent.objective
        : t("admin.runtimeRoutes.noObjective"),
      primaryActionHref: focusedRuntimeRoute.recommendedHref,
      primaryActionRunRecord: focusedRuntimeRoute.recommendedRunRecord,
      prompt: focusedRuntimeRoute.prompt.trim().length
        ? focusedRuntimeRoute.prompt
        : t("admin.runtimeTaskPacket.noPrompt"),
      secondaryActions: [
        {
          label: t("admin.runtimeTaskPacket.secondaryRoute"),
          href: focusedRuntimeRoute.secondaryHref,
          runRecord: focusedRuntimeRoute.secondaryRunRecord,
        },
        {
          label: t("admin.runtimeTaskPacket.secondaryDefinition"),
          href: focusedRuntimeRoute.definitionHref,
          runRecord: null,
        },
        {
          label: t("admin.runtimeTaskPacket.secondaryAccess"),
          href: focusedRuntimeRoute.governanceHref,
          runRecord: {
            tenant_id: focusedRuntimeRoute.agent.tenant_id,
            agent_definition_id: focusedRuntimeRoute.agent.id,
            workspace_id: focusedRuntimeRoute.resolvedWorkspace?.id ?? null,
            knowledge_base_id:
              focusedRuntimeRoute.resolvedKnowledgeBase?.id ?? null,
            target_surface: "admin",
            handoff_intent: "agent_brief",
            trigger_source: "admin",
            launch_prompt: focusedRuntimeRoute.prompt.trim().length
              ? focusedRuntimeRoute.prompt
              : null,
          } as AgentRunRecordInput,
        },
      ],
      statusLabel: focusedRuntimeRoute.launchReady
        ? t("admin.runtimeTaskPacket.statuses.ready")
        : t("admin.runtimeTaskPacket.statuses.review"),
      statusTone: focusedRuntimeRoute.launchReady
        ? ("healthy" as const)
        : ("review" as const),
      summaryItems: [
        {
          label: t("admin.runtimeTaskPacket.fields.mode"),
          value: t(`agents.modes.${focusedRuntimeRoute.agent.mode}`),
        },
        {
          label: t("admin.runtimeTaskPacket.fields.target"),
          value: focusedRuntimeRoute.targetLabel,
        },
        {
          label: t("admin.runtimeTaskPacket.fields.scope"),
          value: focusedRuntimeRoute.scopeLabel?.trim().length
            ? focusedRuntimeRoute.scopeLabel
            : t("admin.runtimeTaskPacket.unbound"),
        },
        {
          label: t("admin.runtimeTaskPacket.fields.workspace"),
          value:
            focusedRuntimeRoute.resolvedWorkspace?.name ??
            t("admin.runtimeTaskPacket.pending"),
        },
        {
          label: t("admin.runtimeTaskPacket.fields.knowledgeBase"),
          value:
            focusedRuntimeRoute.resolvedKnowledgeBase?.name ??
            t("admin.runtimeTaskPacket.pending"),
        },
      ],
      title: focusedRuntimeRoute.agent.name,
    };
  }, [focusedRuntimeRoute, selectedTenantId, t]);

  const adminExecutionPackets = useMemo<AdminExecutionPacket[]>(() => {
    const activeAgentCount = filteredAgents.filter(
      (agent) => agent.status === "active",
    ).length;
    const scopedRuntimeRoutes = runtimeRoutes.filter(
      (item) => item.launchReady,
    );
    const recoveryRuntimeRoutes = runtimeRoutes.filter(
      (item) => item.agent.mode === "workflow_recovery",
    );
    const scopedRecoveryRuntimeRoutes = recoveryRuntimeRoutes.filter(
      (item) => item.launchReady,
    );
    const draftKnowledgeBaseCount = filteredKnowledgeBases.filter(
      (knowledgeBase) => knowledgeBase.publication_status !== "published",
    ).length;
    const invitedMembershipCount = filteredUsers.reduce(
      (count, user) =>
        count +
        user.memberships.filter(
          (membership) => membership.membership_status === "invited",
        ).length,
      0,
    );
    const firstInvitedMembershipRecord =
      filteredUsers
        .map((user) => ({
          user,
          membership:
            user.memberships.find(
              (membership) =>
                membership.membership_status === "invited" &&
                (selectedTenantId === "all" ||
                  membership.tenant_id === selectedTenantId),
            ) ?? null,
        }))
        .find((item) => item.membership !== null) ?? null;

    const scopedTenantId =
      selectedTenantId === "all"
        ? (scopedPrimaryWorkspace?.tenant_id ?? null)
        : selectedTenantId;

    return [
      {
        title: t("admin.executionPackets.recovery.title"),
        detail:
          scopedPrimaryWorkspace && scopedPrimaryKnowledgeBase
            ? t("admin.executionPackets.recovery.readyDetail", {
                workspace: scopedPrimaryWorkspace.name,
                knowledgeBase: scopedPrimaryKnowledgeBase.name,
              })
            : t("admin.executionPackets.recovery.pendingDetail"),
        status:
          scopedPrimaryWorkspace && scopedPrimaryKnowledgeBase
            ? "review"
            : "attention",
        metricLabel: t("admin.executionPackets.recovery.metric"),
        metricValue:
          scopedPrimaryWorkspace && scopedPrimaryKnowledgeBase
            ? `${scopedPrimaryWorkspace.name} / ${scopedPrimaryKnowledgeBase.name}`
            : t("admin.executionPackets.scopePendingValue"),
        primaryActionLabel: t("admin.executionPackets.recovery.primaryAction"),
        primaryActionHref: buildAdminWorkspaceHref(adminSection, {
          view: "workflows",
          tenantId: scopedTenantId,
          workspaceId: scopedPrimaryWorkspace?.id ?? null,
          knowledgeBaseId: scopedPrimaryKnowledgeBase?.id ?? null,
          workflowStatus: scopedRecoveryStatus,
        }),
        secondaryActions: [
          {
            label: t("admin.executionPackets.recovery.secondaryFailedDocs"),
            href: buildAdminWorkspaceHref(adminSection, {
              view: "documents",
              tenantId: scopedTenantId,
              workspaceId: scopedPrimaryWorkspace?.id ?? null,
              knowledgeBaseId: scopedPrimaryKnowledgeBase?.id ?? null,
              documentStatus: "failed",
            }),
          },
          {
            label: t("admin.executionPackets.recovery.secondaryOperations"),
            href: buildOperationsHref({
              tenantId: scopedTenantId,
              lane: "failed",
              status: scopedRecoveryStatus,
            }),
          },
        ],
      },
      {
        title: t("admin.executionPackets.publication.title"),
        detail:
          draftKnowledgeBaseCount > 0
            ? t("admin.executionPackets.publication.draftDetail", {
                count: String(draftKnowledgeBaseCount),
              })
            : t("admin.executionPackets.publication.healthyDetail"),
        status: draftKnowledgeBaseCount > 0 ? "attention" : "healthy",
        metricLabel: t("admin.executionPackets.publication.metric"),
        metricValue: String(draftKnowledgeBaseCount),
        primaryActionLabel: t(
          "admin.executionPackets.publication.primaryAction",
        ),
        primaryActionHref: buildAdminHref({
          tenantId: selectedTenantId,
          section: "directory",
          workspaceLifecycleFilter,
          knowledgeBasePublicationStatusFilter: "draft",
        }),
        secondaryActions: [
          {
            label: t("admin.executionPackets.publication.secondaryPublished"),
            href: buildAdminHref({
              tenantId: selectedTenantId,
              section: "directory",
              workspaceLifecycleFilter,
              knowledgeBasePublicationStatusFilter: "published",
            }),
          },
          {
            label: t("admin.executionPackets.publication.secondaryDocuments"),
            href: buildAdminWorkspaceHref(adminSection, {
              view: "documents",
              tenantId: scopedTenantId,
              workspaceId: scopedPrimaryWorkspace?.id ?? null,
              knowledgeBaseId: scopedPrimaryKnowledgeBase?.id ?? null,
            }),
          },
        ],
      },
      {
        title: t("admin.executionPackets.runtime.title"),
        detail:
          scopedRuntimeRoutes.length > 0
            ? t("admin.executionPackets.runtime.readyDetail", {
                count: String(scopedRuntimeRoutes.length),
                total: String(activeAgentCount),
              })
            : activeAgentCount > 0
              ? t("admin.executionPackets.runtime.pendingDetail", {
                  total: String(activeAgentCount),
                })
              : t("admin.executionPackets.runtime.emptyDetail"),
        status: scopedRuntimeRoutes.length > 0 ? "healthy" : "review",
        metricLabel: t("admin.executionPackets.runtime.metric"),
        metricValue: `${scopedRuntimeRoutes.length}/${activeAgentCount}`,
        primaryActionLabel: t("admin.executionPackets.runtime.primaryAction"),
        primaryActionHref:
          scopedRuntimeRoutes[0]?.recommendedHref ??
          buildAgentsHref({
            tenantId: selectedTenantId,
            status: "active",
          }),
        primaryActionRunRecord:
          scopedRuntimeRoutes[0]?.recommendedRunRecord ?? null,
        secondaryActions: [
          {
            label: t("admin.executionPackets.runtime.secondaryDefinitions"),
            href: buildAgentsHref({
              tenantId: selectedTenantId,
              status: "active",
            }),
            runRecord: null,
          },
          {
            label: t("admin.executionPackets.runtime.secondaryOperations"),
            href: buildOperationsHref({
              tenantId: scopedTenantId,
              lane: "overview",
              status: "all",
            }),
            runRecord: scopedRuntimeRoutes[0]
              ? ({
                  tenant_id: scopedRuntimeRoutes[0].agent.tenant_id,
                  agent_definition_id: scopedRuntimeRoutes[0].agent.id,
                  workspace_id:
                    scopedRuntimeRoutes[0].resolvedWorkspace?.id ?? null,
                  knowledge_base_id:
                    scopedRuntimeRoutes[0].resolvedKnowledgeBase?.id ?? null,
                  target_surface: "operations",
                  handoff_intent: "agent_brief",
                  trigger_source: "admin",
                  launch_prompt: scopedRuntimeRoutes[0].prompt.trim().length
                    ? scopedRuntimeRoutes[0].prompt
                    : null,
                } as AgentRunRecordInput)
              : null,
          },
        ],
      },
      {
        title: t("admin.executionPackets.recoveryRuntime.title"),
        detail:
          scopedRecoveryRuntimeRoutes.length > 0
            ? t("admin.executionPackets.recoveryRuntime.readyDetail", {
                count: String(scopedRecoveryRuntimeRoutes.length),
                total: String(recoveryRuntimeRoutes.length),
              })
            : recoveryRuntimeRoutes.length > 0
              ? t("admin.executionPackets.recoveryRuntime.pendingDetail", {
                  total: String(recoveryRuntimeRoutes.length),
                })
              : t("admin.executionPackets.recoveryRuntime.emptyDetail"),
        status:
          scopedRecoveryRuntimeRoutes.length > 0
            ? "healthy"
            : recoveryRuntimeRoutes.length > 0
              ? "review"
              : "attention",
        metricLabel: t("admin.executionPackets.recoveryRuntime.metric"),
        metricValue: `${scopedRecoveryRuntimeRoutes.length}/${recoveryRuntimeRoutes.length}`,
        primaryActionLabel: t(
          "admin.executionPackets.recoveryRuntime.primaryAction",
        ),
        primaryActionHref:
          scopedRecoveryRuntimeRoutes[0]?.recommendedHref ??
          buildAgentsHref({
            tenantId: selectedTenantId,
            status: "active",
            mode: "workflow_recovery",
          }),
        primaryActionRunRecord:
          scopedRecoveryRuntimeRoutes[0]?.recommendedRunRecord ?? null,
        secondaryActions: [
          {
            label: t(
              "admin.executionPackets.recoveryRuntime.secondaryDefinitions",
            ),
            href: buildAgentsHref({
              tenantId: selectedTenantId,
              status: "active",
              mode: "workflow_recovery",
            }),
            runRecord: null,
          },
          {
            label: t(
              "admin.executionPackets.recoveryRuntime.secondaryOperations",
            ),
            href: buildOperationsHref({
              tenantId: scopedTenantId,
              lane: "failed",
              status: scopedRecoveryStatus,
            }),
            runRecord: scopedRecoveryRuntimeRoutes[0]
              ? ({
                  tenant_id: scopedRecoveryRuntimeRoutes[0].agent.tenant_id,
                  agent_definition_id: scopedRecoveryRuntimeRoutes[0].agent.id,
                  workspace_id:
                    scopedRecoveryRuntimeRoutes[0].resolvedWorkspace?.id ??
                    null,
                  knowledge_base_id:
                    scopedRecoveryRuntimeRoutes[0].resolvedKnowledgeBase?.id ??
                    null,
                  target_surface: "operations",
                  handoff_intent: "workflow_recovery",
                  trigger_source: "admin",
                  launch_prompt: scopedRecoveryRuntimeRoutes[0].prompt.trim()
                    .length
                    ? scopedRecoveryRuntimeRoutes[0].prompt
                    : null,
                } as AgentRunRecordInput)
              : null,
          },
        ],
      },
      {
        title: t("admin.executionPackets.access.title"),
        detail:
          invitedMembershipCount > 0
            ? t("admin.executionPackets.access.pendingDetail", {
                count: String(invitedMembershipCount),
              })
            : t("admin.executionPackets.access.healthyDetail"),
        status: invitedMembershipCount > 0 ? "review" : "healthy",
        metricLabel: t("admin.executionPackets.access.metric"),
        metricValue: String(invitedMembershipCount),
        primaryActionLabel: t("admin.executionPackets.access.primaryAction"),
        primaryActionHref: firstInvitedMembershipRecord?.membership
          ? buildMemberGovernanceHref(firstInvitedMembershipRecord.user, {
              tenantId: firstInvitedMembershipRecord.membership.tenant_id,
              memberRelationshipFilter: "invited",
            })
          : buildAdminHref({
              tenantId: selectedTenantId,
              section: "access",
              memberRelationshipFilter: "invited",
            }),
        secondaryActions: [
          {
            label: t("admin.executionPackets.access.secondarySecurity"),
            href: firstInvitedMembershipRecord?.membership
              ? buildMemberGovernanceHref(firstInvitedMembershipRecord.user, {
                  tenantId: firstInvitedMembershipRecord.membership.tenant_id,
                  memberRelationshipFilter: "invited",
                })
              : buildAdminHref({
                  tenantId: selectedTenantId,
                  section: "security",
                  memberRelationshipFilter: "invited",
                }),
          },
          {
            label: t("admin.executionPackets.access.secondaryMembers"),
            href: buildAdminHref({
              tenantId: selectedTenantId,
              section: "access",
            }),
          },
        ],
      },
    ];
  }, [
    adminSection,
    filteredAgents,
    filteredKnowledgeBases,
    filteredUsers,
    knowledgeBasePublicationStatusFilter,
    runtimeRoutes,
    scopedPrimaryKnowledgeBase,
    scopedPrimaryWorkspace,
    selectedTenantId,
    t,
    workspaceLifecycleFilter,
  ]);

  function handleAdminTenantScopeChange(tenantId: string) {
    setManagementPanel(null);
    setEditingWorkspaceId(null);
    setPendingWorkspaceFocusId(null);
    setEditingKnowledgeBaseId(null);
    setPendingKnowledgeBaseFocusId(null);
    setEditingUserId(null);
    setPendingUserFocusId(null);
    setSelectedTenantId(tenantId);
    if (tenantId !== "all") {
      writeCurrentTenantId(tenantId);
    }
  }

  return (
    <ConsoleShell activeHref="/admin">
      <PageTitleSync title={t("admin.title")} />
      <ConsolePage className="gap-6">
        <div className="console-split-layout rounded-xl border border-slate-200/80 bg-white shadow-[0_18px_52px_rgba(15,23,42,0.06)]">
          <aside className="console-split-sidebar bg-slate-50/70 dark:bg-slate-950/70">
            <div className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(220px,0.8fr)] sm:items-center lg:grid-cols-1 lg:items-stretch">
              <div className="text-lg font-semibold text-slate-950 dark:text-slate-50">
                {t("admin.title")}
              </div>
              <Select
                disabled={isLoading || tenants.length === 0}
                onValueChange={handleAdminTenantScopeChange}
                value={selectedTenantId}
              >
                <SelectTrigger className="w-full bg-white">
                  <SelectValue placeholder={t("admin.filters.tenantScope")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {t("admin.filters.allTenants")}
                  </SelectItem>
                  {tenants.map((tenant) => (
                    <SelectItem key={tenant.id} value={tenant.id}>
                      {tenant.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-3 border-t border-slate-200 p-4">
              <div className="grid grid-cols-2 gap-1 lg:grid-cols-1">
                {visibleAdminSections.map((section) => (
                  <button
                    className={`w-full rounded-xl px-3 py-2.5 text-left text-sm ${adminSection === section.key ? "bg-blue-50 font-medium text-blue-700" : "text-slate-600 hover:bg-white"}`}
                    key={section.key}
                    onClick={() => setAdminSection(section.key)}
                    type="button"
                  >
                    {section.label}
                  </button>
                ))}
              </div>
              {resumeWorkspaceHref ? (
                <Button asChild className="w-full bg-white" variant="outline">
                  <a href={resumeWorkspaceHref}>
                    {t("admin.filters.returnToValidation")}
                  </a>
                </Button>
              ) : null}
            </div>
          </aside>
          <main className="console-split-content console-split-content-padding">
            {!showRuntimeSection && currentAdminSection ? (
              <ConsoleSurfaceHeader
                className="px-0 pb-4 pt-0"
                description={currentAdminSection.description}
                title={currentAdminSection.label}
              />
            ) : null}
            {!showOverviewSection && !showRuntimeSection ? (
              <ConsoleToolbar className="rounded-xl border-slate-200 bg-slate-50/70 px-4 py-4 shadow-none">
                <div
                  className={cn(
                    "grid w-full gap-3 lg:grid-cols-2",
                    showDirectorySection
                      ? "2xl:grid-cols-5"
                      : "2xl:grid-cols-4",
                  )}
                >
                  <div className="flex items-center justify-between gap-3 lg:col-span-2 2xl:col-span-5">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      {showDirectorySection
                        ? t("admin.filters.resourceFilters")
                        : t("admin.filters.memberFilters")}
                    </div>
                  </div>
                  {!showOverviewSection ? (
                    <div className="relative min-w-0 lg:col-span-2 2xl:col-span-2">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <Input
                        className="rounded-xl border-slate-200 bg-white pl-9"
                        onChange={(event) => setSearchQuery(event.target.value)}
                        placeholder={t("admin.filters.search")}
                        value={searchQuery}
                      />
                    </div>
                  ) : null}

                  {showDirectorySection ? (
                    <Select
                      disabled={isLoading}
                      onValueChange={setWorkspaceLifecycleFilter}
                      value={workspaceLifecycleFilter}
                    >
                      <SelectTrigger className="w-full rounded-xl border-slate-200 bg-white">
                        <SelectValue
                          placeholder={t("admin.filters.workspaceLifecycle")}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">
                          {t("admin.filters.allWorkspaces")}
                        </SelectItem>
                        <SelectItem value="active">
                          {t("admin.filters.activeOnly")}
                        </SelectItem>
                        <SelectItem value="archived">
                          {t("admin.filters.archivedOnly")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  ) : null}

                  {showDirectorySection ? (
                    <Select
                      disabled={isLoading}
                      onValueChange={setKnowledgeBasePublicationStatusFilter}
                      value={knowledgeBasePublicationStatusFilter}
                    >
                      <SelectTrigger className="w-full rounded-xl border-slate-200 bg-white">
                        <SelectValue
                          placeholder={t("admin.filters.knowledgePublication")}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">
                          {t("admin.filters.allKnowledgeBases")}
                        </SelectItem>
                        <SelectItem value="published">
                          {t("admin.filters.publishedOnly")}
                        </SelectItem>
                        <SelectItem value="draft">
                          {t("admin.filters.draftOnly")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  ) : null}

                  {showDirectorySection ? (
                    <Select
                      disabled={isLoading || retrievalProfiles.length === 0}
                      onValueChange={setRetrievalProfileFilter}
                      value={retrievalProfileFilter}
                    >
                      <SelectTrigger className="w-full rounded-xl border-slate-200 bg-white">
                        <SelectValue
                          placeholder={t("admin.filters.retrievalProfile")}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">
                          {t("admin.filters.allRetrievalProfiles")}
                        </SelectItem>
                        <SelectItem
                          value={DEFAULT_RETRIEVAL_PROFILE_FILTER_VALUE}
                        >
                          {t("admin.filters.defaultFallbackRetrievalProfile")}
                        </SelectItem>
                        <SelectItem
                          value={DISABLED_RETRIEVAL_PROFILE_FILTER_VALUE}
                        >
                          {t("admin.filters.disabledAssignedRetrievalProfile")}
                        </SelectItem>
                        {retrievalProfiles.map((retrievalProfile) => (
                          <SelectItem
                            key={retrievalProfile.id}
                            value={retrievalProfile.id}
                          >
                            {retrievalProfile.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : null}

                  {showAccessSection ? (
                    <Select
                      disabled={isLoading}
                      onValueChange={setMemberRelationshipFilter}
                      value={memberRelationshipFilter}
                    >
                      <SelectTrigger className="w-full rounded-xl border-slate-200 bg-white">
                        <SelectValue
                          placeholder={t("admin.members.relationshipFilter")}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">
                          {t("admin.members.allRelationships")}
                        </SelectItem>
                        <SelectItem value="active">
                          {t("admin.members.activeMembership")}
                        </SelectItem>
                        <SelectItem value="invited">
                          {t("admin.members.invitedMembership")}
                        </SelectItem>
                        <SelectItem value="suspended">
                          {t("admin.members.suspendedMembership")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  ) : null}

                  {showAccessSection ? (
                    <Select
                      disabled={isLoading}
                      onValueChange={setMemberAccountFilter}
                      value={memberAccountFilter}
                    >
                      <SelectTrigger className="w-full rounded-xl border-slate-200 bg-white">
                        <SelectValue
                          placeholder={t("admin.members.accountFilter")}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">
                          {t("admin.members.allAccounts")}
                        </SelectItem>
                        <SelectItem value="active">
                          {t("admin.members.activeAccount")}
                        </SelectItem>
                        <SelectItem value="inactive">
                          {t("admin.members.inactiveAccount")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  ) : null}
                </div>
              </ConsoleToolbar>
            ) : null}
            {showRuntimeSection ? (
              <RuntimeResourcesPanel
                tenantId={selectedTenantId === "all" ? null : selectedTenantId}
              />
            ) : null}

            <div
              className={cn(
                "grid gap-6",
                (showDirectorySection || showAccessSection) && "mt-6",
              )}
            >
              {showOverviewSection ? (
                <ConsoleSurface className="overflow-visible rounded-none border-0 bg-transparent shadow-none">
                  <div className="grid auto-rows-fr gap-3 sm:grid-cols-2 xl:grid-cols-5">
                    {metrics.map((metric) => (
                      <Link
                        className="group flex min-h-[144px] flex-col rounded-xl border border-slate-200 bg-slate-50/70 p-4 transition hover:border-blue-200 hover:bg-blue-50/40 dark:border-slate-800 dark:bg-slate-900/60"
                        href={metric.href}
                        key={metric.label}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="pt-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                            {metric.label}
                          </div>
                          <div
                            className={cn(
                              "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                              metric.iconClassName,
                            )}
                          >
                            <metric.icon className="h-4 w-4" />
                          </div>
                        </div>
                        <div className="mt-3 flex items-end justify-between gap-3">
                          <div className="text-[30px] font-semibold tracking-tight text-slate-950">
                            {metric.value}
                          </div>
                          <ArrowRight className="mb-1 h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-blue-600" />
                        </div>
                        <div className="mt-auto pt-3 text-xs leading-5 text-slate-500">
                          {metric.hint}
                        </div>
                      </Link>
                    ))}
                  </div>
                </ConsoleSurface>
              ) : null}

              {showAdvancedAdminSections && showOverviewSection ? (
                <ConsoleSurface>
                  <ConsoleSurfaceHeader
                    title={t("admin.overviewLanes.title")}
                  />
                  <div className="grid gap-4 p-6 lg:grid-cols-3">
                    {overviewLaneItems.map((item) => (
                      <div
                        className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-5"
                        key={item.key}
                      >
                        <div className="text-base font-semibold text-slate-950">
                          {item.title}
                        </div>
                        <div className="mt-2 text-sm font-medium text-blue-600">
                          {item.value}
                        </div>
                        <div className="mt-3 text-sm leading-6 text-slate-500">
                          {item.description}
                        </div>
                        <div className="mt-5">
                          <Button
                            asChild
                            className="bg-white"
                            size="sm"
                            type="button"
                            variant="outline"
                          >
                            <Link href={item.href}>
                              {t("admin.overviewLanes.openLane")}
                            </Link>
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ConsoleSurface>
              ) : null}

              {adminSection === "directory" ? (
                <ConsoleSurface className="overflow-visible rounded-none border-0 bg-transparent shadow-none">
                  <ConsoleSurfaceHeader
                    action={
                      <Button
                        className="rounded-xl"
                        disabled={!hasAdminWriteAccess}
                        onClick={openCreateTenantPanel}
                        size="sm"
                        type="button"
                      >
                        {t("admin.directory.createOrganization")}
                      </Button>
                    }
                    className="px-0 pb-3 pt-0"
                    description={t("admin.directory.description")}
                    title={t("admin.directory.title")}
                  />
                  <div className="grid gap-4 pb-2 pt-2">
                    {directoryTenantGroups.map((group) => (
                      <section
                        className="overflow-visible rounded-[20px] border border-slate-200 bg-white shadow-sm"
                        key={group.tenant.id}
                      >
                        <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                              <Building2 className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="truncate text-base font-semibold text-slate-950">
                                  {group.tenant.name}
                                </h3>
                                <Badge
                                  className="border-slate-200 bg-slate-50 text-slate-600"
                                  variant="outline"
                                >
                                  {t("admin.directory.organization")}
                                </Badge>
                              </div>
                              <p className="mt-1 truncate text-sm text-slate-500">
                                {group.tenant.slug} ·{" "}
                                {t("admin.directory.resourceSummary", {
                                  workspaces: String(group.workspaces.length),
                                  knowledgeBases: String(
                                    group.knowledgeBaseCount,
                                  ),
                                })}
                              </p>
                            </div>
                          </div>
                          <Button
                            className="shrink-0 rounded-xl bg-white"
                            disabled={!hasAdminWriteAccess}
                            onClick={() =>
                              openCreateWorkspacePanel(group.tenant.id)
                            }
                            size="sm"
                            type="button"
                            variant="outline"
                          >
                            {t("admin.actions.createWorkspace")}
                          </Button>
                        </div>

                        <div className="grid gap-3 p-4 sm:p-5">
                          {group.workspaces.map(
                            ({
                              workspace,
                              knowledgeBases: workspaceKnowledgeBases,
                            }) => (
                              <div
                                className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4"
                                key={workspace.id}
                              >
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                  <div className="flex min-w-0 items-start gap-3">
                                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-slate-600 shadow-sm ring-1 ring-slate-200">
                                      <Boxes className="h-4 w-4" />
                                    </div>
                                    <div className="min-w-0">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <h4 className="font-semibold text-slate-900">
                                          {workspace.name}
                                        </h4>
                                        <Badge
                                          className={cn(
                                            "border",
                                            getWorkspaceLifecycleClass(
                                              workspace.is_archived,
                                            ),
                                          )}
                                          variant="outline"
                                        >
                                          {workspace.is_archived
                                            ? t("admin.directory.archived")
                                            : t("admin.directory.active")}
                                        </Badge>
                                      </div>
                                      <p className="mt-1 text-sm text-slate-500">
                                        {workspace.slug} ·{" "}
                                        {t(
                                          "admin.directory.knowledgeBaseSummary",
                                          {
                                            count: String(
                                              workspaceKnowledgeBases.length,
                                            ),
                                          },
                                        )}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex shrink-0 items-center gap-2 self-end lg:self-auto">
                                    <Button
                                      className="bg-white"
                                      disabled={
                                        !hasAdminWriteAccess ||
                                        isUpdatingResource ||
                                        isCreatingResource
                                      }
                                      onClick={() =>
                                        openWorkspaceEditPanel(workspace)
                                      }
                                      size="sm"
                                      type="button"
                                      variant="outline"
                                    >
                                      {t("admin.actions.edit")}
                                    </Button>
                                    <details className="relative open:z-40">
                                      <summary
                                        aria-label={t(
                                          "admin.directory.moreActions",
                                        )}
                                        className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
                                      >
                                        <MoreHorizontal className="h-4 w-4" />
                                      </summary>
                                      <div className="absolute right-0 top-full z-50 mt-2 min-w-44 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                                        <Link
                                          className="flex w-full rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                                          href={buildWorkspaceContextHref(
                                            workspace,
                                            "chat",
                                          )}
                                        >
                                          {t("admin.directory.openChat")}
                                        </Link>
                                        <Link
                                          className="flex w-full rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                                          href={buildWorkspaceContextHref(
                                            workspace,
                                            "documents",
                                          )}
                                        >
                                          {t("shell.nav.documents")}
                                        </Link>
                                        <Link
                                          className="flex w-full rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                                          href={buildWorkspaceContextHref(
                                            workspace,
                                            "workflows",
                                          )}
                                        >
                                          {t("shell.userMenu.operations")}
                                        </Link>
                                        <div className="my-1 border-t border-slate-100" />
                                        <button
                                          className="flex w-full rounded-lg px-3 py-2 text-left text-sm text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                                          disabled={
                                            !hasAdminWriteAccess ||
                                            activeWorkspaceActionId ===
                                              workspace.id ||
                                            activeKnowledgeBaseActionId !==
                                              null ||
                                            isUpdatingResource ||
                                            isCreatingResource
                                          }
                                          onClick={(event) => {
                                            event.currentTarget
                                              .closest("details")
                                              ?.removeAttribute("open");
                                            void handleToggleWorkspaceLifecycle(
                                              workspace,
                                            );
                                          }}
                                          type="button"
                                        >
                                          {activeWorkspaceActionId ===
                                          workspace.id
                                            ? workspace.is_archived
                                              ? t("admin.actions.restoring")
                                              : t("admin.actions.archiving")
                                            : workspace.is_archived
                                              ? t("admin.actions.restore")
                                              : t("admin.actions.archive")}
                                        </button>
                                      </div>
                                    </details>
                                  </div>
                                </div>

                                <div className="mt-4 rounded-xl border border-slate-200 bg-white">
                                  <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                      <div className="text-sm font-semibold text-slate-900">
                                        {t("admin.directory.knowledgeBaseList")}
                                      </div>
                                      <div className="mt-0.5 text-xs text-slate-500">
                                        {t(
                                          "admin.directory.knowledgeBaseListDescription",
                                        )}
                                      </div>
                                    </div>
                                    <Button
                                      className="shrink-0 rounded-xl bg-white"
                                      disabled={!hasAdminWriteAccess}
                                      onClick={() =>
                                        openCreateKnowledgeBasePanel(
                                          workspace.id,
                                        )
                                      }
                                      size="sm"
                                      type="button"
                                      variant="outline"
                                    >
                                      {t("admin.actions.createKnowledgeBase")}
                                    </Button>
                                  </div>
                                  <div className="divide-y divide-slate-100">
                                    {workspaceKnowledgeBases.map(
                                      (knowledgeBase) => {
                                        const assignedRetrievalProfile =
                                          knowledgeBase.retrieval_profile_id
                                            ? (retrievalProfiles.find(
                                                (profile) =>
                                                  profile.id ===
                                                  knowledgeBase.retrieval_profile_id,
                                              ) ?? null)
                                            : null;
                                        const effectiveRetrievalProfile =
                                          assignedRetrievalProfile ??
                                          defaultRetrievalProfile;

                                        return (
                                          <div
                                            className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                                            key={knowledgeBase.id}
                                          >
                                            <div className="flex min-w-0 items-start gap-3">
                                              <Library className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                                              <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                  <span className="font-medium text-slate-900">
                                                    {knowledgeBase.name}
                                                  </span>
                                                  <Badge
                                                    className={cn(
                                                      "border",
                                                      getKnowledgeBasePublicationClass(
                                                        knowledgeBase.publication_status,
                                                      ),
                                                    )}
                                                    variant="outline"
                                                  >
                                                    {knowledgeBase.publication_status ===
                                                    "published"
                                                      ? t(
                                                          "admin.governance.published",
                                                        )
                                                      : t(
                                                          "admin.governance.draft",
                                                        )}
                                                  </Badge>
                                                </div>
                                                <p className="mt-1 truncate text-xs text-slate-500">
                                                  {knowledgeBase.slug}
                                                  {effectiveRetrievalProfile
                                                    ? ` · ${effectiveRetrievalProfile.name}`
                                                    : ""}
                                                </p>
                                              </div>
                                            </div>
                                            <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
                                              <Button
                                                className="bg-white"
                                                disabled={
                                                  !hasAdminWriteAccess ||
                                                  isUpdatingResource ||
                                                  isCreatingResource
                                                }
                                                onClick={() =>
                                                  openKnowledgeBaseEditPanel(
                                                    knowledgeBase,
                                                  )
                                                }
                                                size="sm"
                                                type="button"
                                                variant="outline"
                                              >
                                                {t("admin.actions.edit")}
                                              </Button>
                                              <details className="relative open:z-40">
                                                <summary
                                                  aria-label={t(
                                                    "admin.directory.moreActions",
                                                  )}
                                                  className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
                                                >
                                                  <MoreHorizontal className="h-4 w-4" />
                                                </summary>
                                                <div className="absolute right-0 top-full z-50 mt-2 min-w-44 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                                                  <Link
                                                    className="flex w-full rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                                                    href={buildAdminWorkspaceHref(
                                                      "directory",
                                                      {
                                                        view: "chat",
                                                        tenantId:
                                                          knowledgeBase.tenant_id,
                                                        workspaceId:
                                                          knowledgeBase.workspace_id,
                                                        knowledgeBaseId:
                                                          knowledgeBase.id,
                                                      },
                                                    )}
                                                  >
                                                    {t("shell.nav.chat")}
                                                  </Link>
                                                  <Link
                                                    className="flex w-full rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                                                    href={buildKnowledgeBaseContextHref(
                                                      knowledgeBase,
                                                      "documents",
                                                    )}
                                                  >
                                                    {t("shell.nav.documents")}
                                                  </Link>
                                                  <Link
                                                    className="flex w-full rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                                                    href={buildKnowledgeBaseContextHref(
                                                      knowledgeBase,
                                                      "workflows",
                                                    )}
                                                  >
                                                    {t(
                                                      "shell.userMenu.operations",
                                                    )}
                                                  </Link>
                                                  <div className="my-1 border-t border-slate-100" />
                                                  <button
                                                    className="flex w-full rounded-lg px-3 py-2 text-left text-sm text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                                                    disabled={
                                                      !hasAdminWriteAccess ||
                                                      activeKnowledgeBaseActionId ===
                                                        knowledgeBase.id ||
                                                      activeWorkspaceActionId !==
                                                        null ||
                                                      isUpdatingResource ||
                                                      isCreatingResource
                                                    }
                                                    onClick={(event) => {
                                                      event.currentTarget
                                                        .closest("details")
                                                        ?.removeAttribute(
                                                          "open",
                                                        );
                                                      void handleToggleKnowledgeBasePublication(
                                                        knowledgeBase,
                                                      );
                                                    }}
                                                    type="button"
                                                  >
                                                    {activeKnowledgeBaseActionId ===
                                                    knowledgeBase.id
                                                      ? knowledgeBase.publication_status ===
                                                        "published"
                                                        ? t(
                                                            "admin.actions.unpublishing",
                                                          )
                                                        : t(
                                                            "admin.actions.publishing",
                                                          )
                                                      : knowledgeBase.publication_status ===
                                                          "published"
                                                        ? t(
                                                            "admin.actions.moveToDraft",
                                                          )
                                                        : t(
                                                            "admin.actions.publish",
                                                          )}
                                                  </button>
                                                </div>
                                              </details>
                                            </div>
                                          </div>
                                        );
                                      },
                                    )}
                                    {workspaceKnowledgeBases.length === 0 ? (
                                      <div className="px-4 py-6 text-center text-sm text-slate-500">
                                        {t("admin.directory.noKnowledgeBases")}
                                      </div>
                                    ) : null}
                                  </div>
                                </div>
                              </div>
                            ),
                          )}
                          {group.workspaces.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                              {t("admin.directory.noWorkspacesInOrganization")}
                            </div>
                          ) : null}
                        </div>
                      </section>
                    ))}
                    {directoryTenantGroups.length === 0 ? (
                      <div className="rounded-[20px] border border-dashed border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500">
                        {t("admin.directory.noOrganizations")}
                      </div>
                    ) : null}
                  </div>
                </ConsoleSurface>
              ) : null}

              {showAdvancedAdminSections && adminSection === "directory" ? (
                <ConsoleSurface>
                  <ConsoleSurfaceHeader
                    action={
                      <Badge
                        className="border-slate-200 bg-slate-50 text-slate-600"
                        variant="outline"
                      >
                        {t("admin.directory.results", {
                          count: String(searchedAgents.length),
                        })}
                      </Badge>
                    }
                    title={t("admin.agents.title")}
                  />
                  <div className="px-6 pb-6 pt-2">
                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-slate-100 bg-slate-50">
                            <TableHead>{t("admin.agents.agent")}</TableHead>
                            <TableHead>{t("admin.agents.tenant")}</TableHead>
                            <TableHead>{t("admin.agents.mode")}</TableHead>
                            <TableHead>{t("admin.agents.status")}</TableHead>
                            <TableHead>{t("admin.agents.scope")}</TableHead>
                            <TableHead>{t("admin.agents.tools")}</TableHead>
                            <TableHead className="text-right">
                              {t("admin.agents.actionsColumn")}
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {searchedAgents.map((agent) => {
                            const tenant = tenants.find(
                              (tenantItem) => tenantItem.id === agent.tenant_id,
                            );

                            return (
                              <TableRow
                                className="border-slate-100"
                                key={agent.id}
                              >
                                <TableCell>
                                  <div className="font-medium text-slate-900">
                                    {agent.name}
                                  </div>
                                  <div className="mt-1 text-xs text-slate-400">
                                    {agent.slug}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  {tenant?.name ??
                                    t("admin.directory.unknownTenant")}
                                </TableCell>
                                <TableCell>
                                  {t(`agents.modes.${agent.mode}`)}
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    className={cn(
                                      "border",
                                      agent.status === "active"
                                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                        : agent.status === "paused"
                                          ? "border-amber-200 bg-amber-50 text-amber-700"
                                          : "border-slate-200 bg-slate-100 text-slate-700",
                                    )}
                                    variant="outline"
                                  >
                                    {t(`agents.statuses.${agent.status}`)}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  {agent.knowledge_base_scope ||
                                    t("admin.agents.unscoped")}
                                </TableCell>
                                <TableCell>{agent.tools.length}</TableCell>
                                <TableCell className="text-right">
                                  <div className="flex w-full flex-wrap justify-end gap-2.5 sm:min-w-[430px] sm:w-auto">
                                    <Button
                                      asChild
                                      className="bg-white"
                                      size="sm"
                                      type="button"
                                      variant="outline"
                                    >
                                      <Link
                                        href={buildAgentsHref({
                                          tenantId: agent.tenant_id,
                                          agentId: agent.id,
                                        })}
                                      >
                                        {t("admin.agents.openAgent")}
                                      </Link>
                                    </Button>
                                    <Button
                                      asChild
                                      className="bg-white"
                                      size="sm"
                                      type="button"
                                      variant="outline"
                                    >
                                      <Link
                                        href={buildOperationsHref({
                                          tenantId: agent.tenant_id,
                                          status:
                                            agent.mode === "workflow_recovery"
                                              ? "failed"
                                              : "all",
                                        })}
                                      >
                                        {t("admin.agents.openOperations")}
                                      </Link>
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                          {searchedAgents.length === 0 && (
                            <TableRow className="border-slate-100">
                              <TableCell
                                className="py-10 text-center text-slate-500"
                                colSpan={7}
                              >
                                {t("admin.agents.noAgents")}
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </ConsoleSurface>
              ) : null}

              {adminSection === "access" ||
              (showAdvancedAdminSections && adminSection === "security") ? (
                <ConsoleSurface className="overflow-visible rounded-none border-0 bg-transparent shadow-none">
                  <ConsoleSurfaceHeader
                    action={
                      <Button
                        className="rounded-xl"
                        disabled={!hasAdminWriteAccess}
                        onClick={openCreateUserPanel}
                        size="sm"
                        type="button"
                      >
                        {t("admin.actions.createMember")}
                      </Button>
                    }
                    className="px-0 pb-4 pt-0"
                    description={t("admin.members.description")}
                    title={t("admin.members.title")}
                  />
                  <div className="pb-2 pt-3">
                    <div className="overflow-x-auto rounded-[20px] border border-slate-200">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-slate-100 bg-slate-50">
                            <TableHead>{t("admin.members.member")}</TableHead>
                            <TableHead>
                              {t("admin.members.memberships")}
                            </TableHead>
                            <TableHead>{t("admin.members.account")}</TableHead>
                            <TableHead className="text-right">
                              {t("admin.members.actionsColumn")}
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {searchedUsers.map((user) => {
                            const scopedMembership =
                              selectedTenantId === "all"
                                ? null
                                : (user.memberships.find(
                                    (membership) =>
                                      membership.tenant_id === selectedTenantId,
                                  ) ?? null);
                            const scopedInvitationCredential = scopedMembership
                              ? (revealedInvitationByMembershipId[
                                  scopedMembership.id
                                ] ?? null)
                              : null;
                            const invitationExpired = isInvitationExpired(
                              scopedInvitationCredential?.invitation_expires_at ??
                                scopedMembership?.invitation_expires_at ??
                                null,
                            );

                            return (
                              <TableRow
                                className="border-slate-100"
                                key={user.id}
                              >
                                <TableCell>
                                  <div className="font-medium text-slate-900">
                                    {user.display_name}
                                  </div>
                                  <div className="mt-1 text-xs text-slate-500">
                                    {user.email}
                                  </div>
                                  <div className="mt-2 text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
                                    {getRoleLabel(user.role, t)}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="space-y-3">
                                    <div className="flex flex-wrap gap-2">
                                      {user.memberships.length > 0 ? (
                                        user.memberships.map((membership) => (
                                          <Badge
                                            className="border-slate-200 bg-white text-slate-700"
                                            key={membership.id}
                                            variant="outline"
                                          >
                                            {membership.tenant_name}
                                            {" · "}
                                            {membership.membership_status ===
                                            "active"
                                              ? t(
                                                  "admin.members.activeMembership",
                                                )
                                              : membership.membership_status ===
                                                  "invited"
                                                ? t(
                                                    "admin.members.invitedMembership",
                                                  )
                                                : t(
                                                    "admin.members.suspendedMembership",
                                                  )}
                                          </Badge>
                                        ))
                                      ) : (
                                        <Badge
                                          className="border-slate-200 bg-slate-50 text-slate-600"
                                          variant="outline"
                                        >
                                          {t("admin.members.unassigned")}
                                        </Badge>
                                      )}
                                    </div>
                                    {scopedMembership?.membership_status ===
                                      "invited" &&
                                    scopedInvitationCredential ? (
                                      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-left">
                                        <div className="flex items-center justify-between gap-3">
                                          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-700">
                                            {t("admin.members.invitationCode")}
                                          </div>
                                          {invitationExpired ? (
                                            <Badge
                                              className="border-rose-200 bg-white text-rose-700"
                                              variant="outline"
                                            >
                                              {t(
                                                "admin.members.invitationExpired",
                                              )}
                                            </Badge>
                                          ) : null}
                                        </div>
                                        <div className="mt-2 font-mono text-sm font-semibold text-amber-900">
                                          {
                                            scopedInvitationCredential.invitation_token
                                          }
                                        </div>
                                        <div className="mt-1 text-xs text-amber-800">
                                          {t(
                                            "admin.members.invitationIssuedAt",
                                            {
                                              value:
                                                scopedInvitationCredential.invited_at
                                                  ? formatTimestamp(
                                                      scopedInvitationCredential.invited_at,
                                                    )
                                                  : t(
                                                      "admin.directory.notAvailable",
                                                    ),
                                            },
                                          )}
                                        </div>
                                        <div className="mt-1 text-xs text-amber-800">
                                          {t(
                                            "admin.members.invitationIssuedBy",
                                            {
                                              value:
                                                scopedInvitationCredential.last_invitation_issued_by_display_name ??
                                                t(
                                                  "admin.directory.notAvailable",
                                                ),
                                            },
                                          )}
                                        </div>
                                        <div className="mt-1 text-xs text-amber-800">
                                          {t(
                                            "admin.members.invitationIssueCount",
                                            {
                                              value: String(
                                                scopedInvitationCredential.invitation_issue_count,
                                              ),
                                            },
                                          )}
                                        </div>
                                        <div className="mt-1 text-xs text-amber-800">
                                          {t(
                                            "admin.members.invitationExpiresAt",
                                            {
                                              value:
                                                scopedInvitationCredential.invitation_expires_at
                                                  ? formatTimestamp(
                                                      scopedInvitationCredential.invitation_expires_at,
                                                    )
                                                  : t(
                                                      "admin.directory.notAvailable",
                                                    ),
                                            },
                                          )}
                                        </div>
                                      </div>
                                    ) : null}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    className={cn(
                                      "border",
                                      user.is_active
                                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                        : "border-slate-200 bg-slate-100 text-slate-700",
                                    )}
                                    variant="outline"
                                  >
                                    {user.is_active
                                      ? t("admin.members.activeAccount")
                                      : t("admin.members.inactiveAccount")}
                                  </Badge>
                                  <div className="mt-2 text-xs text-slate-500">
                                    {t("admin.members.createdAt", {
                                      value: formatTimestamp(user.created_at),
                                    })}
                                  </div>
                                  <div className="mt-1 text-xs text-slate-500">
                                    {t("admin.members.lastSignedInAt", {
                                      value: user.last_signed_in_at
                                        ? formatTimestamp(
                                            user.last_signed_in_at,
                                          )
                                        : t("admin.directory.notAvailable"),
                                    })}
                                  </div>
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex w-full flex-wrap justify-end gap-2.5 sm:min-w-[430px] sm:w-auto">
                                    <Button
                                      className="bg-white"
                                      disabled={
                                        !hasAdminWriteAccess || isLoading
                                      }
                                      onClick={() => openUserEditPanel(user)}
                                      size="sm"
                                      type="button"
                                      variant="outline"
                                    >
                                      {t("admin.actions.edit")}
                                    </Button>
                                    <Button
                                      className="bg-white"
                                      disabled={
                                        !hasAdminWriteAccess ||
                                        activeUserActionId === user.id ||
                                        isLoading
                                      }
                                      onClick={() =>
                                        void handleToggleUserAccount(user)
                                      }
                                      size="sm"
                                      type="button"
                                      variant="outline"
                                    >
                                      {activeUserActionId === user.id
                                        ? user.is_active
                                          ? t("admin.actions.deactivating")
                                          : t("admin.actions.activating")
                                        : user.is_active
                                          ? t("admin.actions.deactivate")
                                          : t("admin.actions.activate")}
                                    </Button>
                                    {selectedTenantId === "all" ? (
                                      <Button
                                        className="bg-white"
                                        disabled
                                        size="sm"
                                        type="button"
                                        variant="outline"
                                      >
                                        {t("admin.members.scopeRequired")}
                                      </Button>
                                    ) : scopedMembership ? (
                                      <>
                                        <Button
                                          className="bg-white"
                                          disabled={
                                            !hasAdminWriteAccess ||
                                            activeMembershipActionId ===
                                              scopedMembership.id ||
                                            isLoading
                                          }
                                          onClick={() =>
                                            void handleIssueMembershipInvitation(
                                              user,
                                              scopedMembership,
                                            )
                                          }
                                          size="sm"
                                          type="button"
                                          variant="outline"
                                        >
                                          {activeMembershipActionId ===
                                          scopedMembership.id
                                            ? t(
                                                "admin.actions.issuingInvitationCode",
                                              )
                                            : scopedInvitationCredential
                                              ? t(
                                                  "admin.actions.regenerateInvitationCode",
                                                )
                                              : t(
                                                  "admin.actions.showInvitationCode",
                                                )}
                                        </Button>
                                        {scopedMembership.membership_status ===
                                        "invited" ? (
                                          <Button
                                            className="bg-white"
                                            disabled={
                                              !hasAdminWriteAccess ||
                                              activeMembershipActionId ===
                                                scopedMembership.id ||
                                              isLoading
                                            }
                                            onClick={() =>
                                              void handleRevokeMembershipInvitation(
                                                user,
                                                scopedMembership,
                                              )
                                            }
                                            size="sm"
                                            type="button"
                                            variant="outline"
                                          >
                                            {activeMembershipActionId ===
                                            scopedMembership.id
                                              ? t(
                                                  "admin.actions.revokingInvitationCode",
                                                )
                                              : t(
                                                  "admin.actions.revokeInvitationCode",
                                                )}
                                          </Button>
                                        ) : null}
                                        <Button
                                          className="bg-white"
                                          disabled={
                                            !hasAdminWriteAccess ||
                                            activeMembershipActionId ===
                                              scopedMembership.id ||
                                            isLoading
                                          }
                                          onClick={() =>
                                            void handleUpdateMembership(
                                              user,
                                              scopedMembership,
                                              scopedMembership.membership_status ===
                                                "active"
                                                ? "suspended"
                                                : "active",
                                            )
                                          }
                                          size="sm"
                                          type="button"
                                          variant="outline"
                                        >
                                          {activeMembershipActionId ===
                                          scopedMembership.id
                                            ? scopedMembership.membership_status ===
                                              "active"
                                              ? t("admin.actions.suspending")
                                              : t("admin.actions.activating")
                                            : scopedMembership.membership_status ===
                                                "active"
                                              ? t("admin.actions.suspend")
                                              : scopedMembership.membership_status ===
                                                  "invited"
                                                ? t(
                                                    "admin.actions.activateInvite",
                                                  )
                                                : t("admin.actions.activate")}
                                        </Button>
                                        <Button
                                          className="bg-white"
                                          disabled={
                                            !hasAdminWriteAccess ||
                                            activeMembershipActionId ===
                                              scopedMembership.id ||
                                            isLoading
                                          }
                                          onClick={() =>
                                            void handleRemoveMembership(
                                              user,
                                              scopedMembership,
                                            )
                                          }
                                          size="sm"
                                          type="button"
                                          variant="outline"
                                        >
                                          {activeMembershipActionId ===
                                          scopedMembership.id
                                            ? t("admin.actions.removing")
                                            : t(
                                                "admin.actions.removeFromTenant",
                                              )}
                                        </Button>
                                      </>
                                    ) : (
                                      <Button
                                        className="bg-white"
                                        disabled={
                                          !hasAdminWriteAccess ||
                                          activeUserActionId === user.id ||
                                          isLoading
                                        }
                                        onClick={() =>
                                          void handleAddUserToTenant(user)
                                        }
                                        size="sm"
                                        type="button"
                                        variant="outline"
                                      >
                                        {activeUserActionId === user.id
                                          ? t("admin.actions.invitingToTenant")
                                          : t("admin.actions.inviteToTenant")}
                                      </Button>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                          {searchedUsers.length === 0 ? (
                            <TableRow className="border-slate-100">
                              <TableCell
                                className="py-10 text-center text-slate-500"
                                colSpan={4}
                              >
                                {t("admin.members.noMembers")}
                              </TableCell>
                            </TableRow>
                          ) : null}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </ConsoleSurface>
              ) : null}
            </div>

            <div className="mt-6 grid gap-6">
              {showOverviewSection ? (
                <ConsoleSurface className="overflow-visible rounded-none border-0 bg-transparent shadow-none">
                  <RuntimePostureCard
                    className="border-0 bg-transparent p-0"
                    description={t("settings.governance.description")}
                    errorMessage={runtimeHealthErrorMessage}
                    isLoading={isLoadingRuntimeHealth}
                    runtimeHealth={runtimeHealth}
                    title={t("settings.governance.title")}
                  />
                </ConsoleSurface>
              ) : null}

              {adminSection === "access" ||
              (showAdvancedAdminSections && adminSection === "security") ? (
                <ConsoleSurface className="overflow-visible rounded-none border-0 bg-transparent shadow-none">
                  <ConsoleSurfaceHeader
                    action={
                      <Select
                        disabled={isLoading}
                        onValueChange={setAuditEventFilter}
                        value={auditEventFilter}
                      >
                        <SelectTrigger className="min-w-[210px] rounded-xl border-slate-200 bg-white">
                          <SelectValue placeholder={t("admin.audit.filter")} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">
                            {t("admin.audit.allEvents")}
                          </SelectItem>
                          <SelectItem value="sign_in_failed">
                            {t("admin.audit.eventTypes.signInFailed")}
                          </SelectItem>
                          <SelectItem value="sign_in_succeeded">
                            {t("admin.audit.eventTypes.signInSucceeded")}
                          </SelectItem>
                          <SelectItem value="invitation_activation_failed">
                            {t(
                              "admin.audit.eventTypes.invitationActivationFailed",
                            )}
                          </SelectItem>
                          <SelectItem value="sign_out_succeeded">
                            {t("admin.audit.eventTypes.signOutSucceeded")}
                          </SelectItem>
                          <SelectItem value="session_revoked">
                            {t("admin.audit.eventTypes.sessionRevoked")}
                          </SelectItem>
                          <SelectItem value="password_changed">
                            {t("admin.audit.eventTypes.passwordChanged")}
                          </SelectItem>
                          <SelectItem value="password_reset">
                            {t("admin.audit.eventTypes.passwordReset")}
                          </SelectItem>
                          <SelectItem value="invitation_issued">
                            {t("admin.audit.eventTypes.invitationIssued")}
                          </SelectItem>
                          <SelectItem value="invitation_activated">
                            {t("admin.audit.eventTypes.invitationActivated")}
                          </SelectItem>
                          <SelectItem value="invitation_revoked">
                            {t("admin.audit.eventTypes.invitationRevoked")}
                          </SelectItem>
                          <SelectItem value="membership_active">
                            {t("admin.audit.eventTypes.membershipActive")}
                          </SelectItem>
                          <SelectItem value="membership_suspended">
                            {t("admin.audit.eventTypes.membershipSuspended")}
                          </SelectItem>
                          <SelectItem value="membership_deleted">
                            {t("admin.audit.eventTypes.membershipDeleted")}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    }
                    className="px-0 pb-3 pt-0"
                    description={t("admin.audit.description")}
                    title={t("admin.audit.title")}
                  />
                  <div className="grid gap-3 pt-3 lg:grid-cols-2">
                    {auditEvents.length > 0 ? (
                      auditEvents.map((event) => (
                        <div
                          className="rounded-[18px] border border-slate-100 bg-slate-50/70 p-4"
                          key={event.id}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="text-sm font-semibold text-slate-900">
                              {getAccessEventLabel(event.event_type, t)}
                            </div>
                            <div className="text-xs text-slate-500">
                              {formatTimestamp(event.created_at)}
                            </div>
                          </div>
                          <div className="mt-2 text-sm text-slate-600">
                            {event.user_display_name ??
                              t("admin.directory.notAvailable")}
                            {event.tenant_name ? ` · ${event.tenant_name}` : ""}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            {t("admin.audit.actor", {
                              value:
                                event.actor_display_name ??
                                t("admin.directory.notAvailable"),
                            })}
                          </div>
                          {readAccessEventRevocationScope(event) ? (
                            <div className="mt-1 text-xs text-slate-500">
                              {t("admin.audit.revocationScope", {
                                value:
                                  readAccessEventRevocationScope(event) ===
                                  "self"
                                    ? t("admin.audit.revocationScopeSelf")
                                    : t("admin.audit.revocationScopeAdmin"),
                              })}
                            </div>
                          ) : null}
                          {readAccessEventReason(event) ? (
                            <div className="mt-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                              <span className="font-semibold text-slate-700">
                                {t("admin.audit.reasonLabel")}:{" "}
                              </span>
                              {readAccessEventReason(event)}
                            </div>
                          ) : null}
                          {hasAdminWriteAccess && event.user_id ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                              <Button
                                asChild
                                className="bg-white"
                                size="sm"
                                type="button"
                                variant="outline"
                              >
                                <Link
                                  href={buildMemberGovernanceHref(
                                    event.user_id,
                                    {
                                      tenantId: event.tenant_id,
                                      memberRelationshipFilter:
                                        event.event_type ===
                                          "invitation_issued" ||
                                        event.event_type ===
                                          "invitation_revoked"
                                          ? "invited"
                                          : null,
                                    },
                                  )}
                                >
                                  {t("admin.audit.openMember")}
                                </Link>
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      ))
                    ) : (
                      <div className="rounded-[18px] border border-slate-100 bg-slate-50/70 p-4 text-sm text-slate-500 lg:col-span-2">
                        {t("admin.audit.empty")}
                      </div>
                    )}
                  </div>
                </ConsoleSurface>
              ) : null}

              {showAdvancedAdminSections && adminSection === "access" ? (
                <ConsoleSurface>
                  <ConsoleSurfaceHeader
                    description={t("admin.accessSummary.description")}
                    title={t("admin.accessSummary.title")}
                  />
                  <div className="grid gap-3 p-6">
                    {accessSummaryItems.map((item) => (
                      <div
                        className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-4"
                        key={item.label}
                      >
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                          {item.label}
                        </div>
                        <div className="mt-3 text-2xl font-semibold text-slate-950">
                          {item.value}
                        </div>
                        <div className="mt-2 text-sm leading-6 text-slate-500">
                          {item.hint}
                        </div>
                      </div>
                    ))}
                  </div>
                </ConsoleSurface>
              ) : null}

              {showAdvancedAdminSections && adminSection === "access" ? (
                <ConsoleSurface>
                  <ConsoleSurfaceHeader
                    description={t(
                      "admin.accessSummary.eventBreakdownDescription",
                    )}
                    title={t("admin.accessSummary.eventBreakdownTitle")}
                  />
                  <div className="grid gap-3 p-6 md:grid-cols-2 xl:grid-cols-3">
                    {accessEventBreakdownItems.length > 0 ? (
                      accessEventBreakdownItems.map((item) => (
                        <div
                          className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-4"
                          key={item.event_type}
                        >
                          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                            {getAccessEventLabel(item.event_type, t)}
                          </div>
                          <div className="mt-3 text-2xl font-semibold text-slate-950">
                            {item.event_count}
                          </div>
                          <div className="mt-4">
                            <Button
                              asChild
                              className="bg-white"
                              size="sm"
                              type="button"
                              variant="outline"
                            >
                              <Link
                                href={buildAuditEventSliceHref(
                                  item.event_type,
                                  {
                                    selectedTenantId,
                                    searchQuery,
                                    memberAccountFilter,
                                    memberRelationshipFilter,
                                  },
                                )}
                              >
                                {t("admin.accessSummary.openAuditSlice")}
                              </Link>
                            </Button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-[18px] border border-slate-100 bg-slate-50/70 p-4 text-sm text-slate-500 md:col-span-2 xl:col-span-3">
                        {t("admin.accessSummary.eventBreakdownEmpty")}
                      </div>
                    )}
                  </div>
                </ConsoleSurface>
              ) : null}

              {adminSection === "access" ? (
                <ConsoleSurface>
                  <ConsoleSurfaceHeader
                    description={t("admin.members.activationQueue.description")}
                    title={t("admin.members.activationQueue.title")}
                  />
                  <div className="space-y-3 px-6 py-5">
                    {invitedActivationQueue.length > 0 ? (
                      invitedActivationQueue.map((item) => (
                        <div
                          className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-5"
                          key={item.membership.id}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-base font-semibold text-slate-950">
                                {item.user.display_name}
                              </div>
                              <div className="mt-1 text-sm text-slate-500">
                                {item.user.email}
                              </div>
                            </div>
                            <div className="flex flex-wrap justify-end gap-2">
                              <Badge
                                className="border-slate-200 bg-white text-slate-700"
                                variant="outline"
                              >
                                {item.membership.tenant_name}
                              </Badge>
                              <Badge
                                className={cn(
                                  "border",
                                  item.invitationExpired
                                    ? "border-rose-200 bg-rose-50 text-rose-700"
                                    : "border-amber-200 bg-amber-50 text-amber-700",
                                )}
                                variant="outline"
                              >
                                {item.invitationExpired
                                  ? t("admin.members.invitationExpired")
                                  : t("admin.members.invitedMembership")}
                              </Badge>
                            </div>
                          </div>
                          <div className="mt-3 grid gap-3 md:grid-cols-3">
                            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                                {t("admin.members.invitationCode")}
                              </div>
                              <div className="mt-2 font-mono text-sm font-semibold text-slate-900">
                                {item.invitationCredential?.invitation_token ??
                                  t("admin.members.activationQueue.notIssued")}
                              </div>
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                              <div>
                                {t("admin.members.invitationIssuedAt", {
                                  value: item.invitationIssuedAt
                                    ? formatTimestamp(item.invitationIssuedAt)
                                    : t("admin.directory.notAvailable"),
                                })}
                              </div>
                              <div className="mt-1">
                                {t("admin.members.invitationIssueCount", {
                                  value: String(
                                    item.invitationCredential
                                      ?.invitation_issue_count ??
                                      item.membership.invitation_issue_count,
                                  ),
                                })}
                              </div>
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                              <div>
                                {t("admin.members.invitationExpiresAt", {
                                  value: item.invitationExpiresAt
                                    ? formatTimestamp(item.invitationExpiresAt)
                                    : t("admin.directory.notAvailable"),
                                })}
                              </div>
                              <div className="mt-1">
                                {t("admin.members.invitationIssuedBy", {
                                  value:
                                    item.invitationCredential
                                      ?.last_invitation_issued_by_display_name ??
                                    item.membership
                                      .last_invitation_issued_by_display_name ??
                                    t("admin.directory.notAvailable"),
                                })}
                              </div>
                            </div>
                          </div>
                          <div className="mt-4 flex flex-wrap gap-2">
                            <Button
                              asChild
                              className="bg-white"
                              size="sm"
                              type="button"
                              variant="outline"
                            >
                              <Link
                                href={buildMemberGovernanceHref(item.user, {
                                  tenantId: item.membership.tenant_id,
                                  memberRelationshipFilter: "invited",
                                })}
                              >
                                {t("admin.audit.openMember")}
                              </Link>
                            </Button>
                            <Button
                              className="bg-white"
                              disabled={
                                !hasAdminWriteAccess ||
                                activeMembershipActionId ===
                                  item.membership.id ||
                                isLoading
                              }
                              onClick={() =>
                                void handleIssueMembershipInvitation(
                                  item.user,
                                  item.membership,
                                )
                              }
                              size="sm"
                              type="button"
                              variant="outline"
                            >
                              {activeMembershipActionId === item.membership.id
                                ? t("admin.actions.issuingInvitationCode")
                                : item.invitationCredential
                                  ? t("admin.actions.regenerateInvitationCode")
                                  : t("admin.actions.showInvitationCode")}
                            </Button>
                            <Button
                              className="bg-white"
                              disabled={
                                !hasAdminWriteAccess ||
                                activeMembershipActionId ===
                                  item.membership.id ||
                                isLoading
                              }
                              onClick={() =>
                                void handleUpdateMembership(
                                  item.user,
                                  item.membership,
                                  "active",
                                )
                              }
                              size="sm"
                              type="button"
                              variant="outline"
                            >
                              {activeMembershipActionId === item.membership.id
                                ? t("admin.actions.activating")
                                : t("admin.actions.activateInvite")}
                            </Button>
                            <Button
                              className="bg-white"
                              disabled={
                                !hasAdminWriteAccess ||
                                activeMembershipActionId ===
                                  item.membership.id ||
                                isLoading
                              }
                              onClick={() =>
                                void handleRevokeMembershipInvitation(
                                  item.user,
                                  item.membership,
                                )
                              }
                              size="sm"
                              type="button"
                              variant="outline"
                            >
                              {activeMembershipActionId === item.membership.id
                                ? t("admin.actions.revokingInvitationCode")
                                : t("admin.actions.revokeInvitationCode")}
                            </Button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-[18px] border border-slate-100 bg-slate-50/70 p-4 text-sm text-slate-500">
                        {t("admin.members.activationQueue.empty")}
                      </div>
                    )}
                  </div>
                </ConsoleSurface>
              ) : null}

              {showAdvancedAdminSections && adminSection === "security" ? (
                <ConsoleSurface>
                  <ConsoleSurfaceHeader
                    description={t("admin.securitySummary.description")}
                    title={t("admin.securitySummary.title")}
                  />
                  <div className="grid gap-3 p-6">
                    {securitySummaryItems.map((item) => (
                      <div
                        className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-4"
                        key={item.label}
                      >
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                          {item.label}
                        </div>
                        <div className="mt-3 text-2xl font-semibold text-slate-950">
                          {item.value}
                        </div>
                        <div className="mt-2 text-sm leading-6 text-slate-500">
                          {item.hint}
                        </div>
                      </div>
                    ))}
                  </div>
                </ConsoleSurface>
              ) : null}

              {showAdvancedAdminSections && adminSection === "security" ? (
                <ConsoleSurface>
                  <ConsoleSurfaceHeader
                    description={t("admin.currentActorSecurity.description")}
                    title={t("admin.currentActorSecurity.title")}
                  />
                  <div className="space-y-4 p-6">
                    {currentActorSecurityPosture ? (
                      <>
                        <div className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-5">
                          <div className="text-base font-semibold text-slate-950">
                            {currentActorSecurityPosture.display_name}
                          </div>
                          <div className="mt-1 text-sm text-slate-500">
                            {currentActorSecurityPosture.email}
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Badge
                              className="border-slate-200 bg-white text-slate-700"
                              variant="outline"
                            >
                              {getRoleLabel(
                                currentActorSecurityPosture.role,
                                t,
                              )}
                            </Badge>
                            <Badge
                              className={cn(
                                "border",
                                currentActorSecurityPosture.is_active
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                  : "border-rose-200 bg-rose-50 text-rose-700",
                              )}
                              variant="outline"
                            >
                              {currentActorSecurityPosture.is_active
                                ? t("admin.currentActorSecurity.accountActive")
                                : t(
                                    "admin.currentActorSecurity.accountInactive",
                                  )}
                            </Badge>
                          </div>
                          <div className="mt-4 text-sm text-slate-500">
                            {t("admin.currentActorSecurity.lastSignedIn", {
                              value:
                                currentActorSecurityPosture.last_signed_in_at
                                  ? formatTimestamp(
                                      currentActorSecurityPosture.last_signed_in_at,
                                    )
                                  : t("admin.directory.notAvailable"),
                            })}
                          </div>
                          {hasAdminWriteAccess ? (
                            <div className="mt-4">
                              <Button
                                asChild
                                className="bg-white"
                                size="sm"
                                type="button"
                                variant="outline"
                              >
                                <Link
                                  href={buildMemberGovernanceHref(
                                    currentActorSecurityPosture,
                                  )}
                                >
                                  {t("admin.currentActorSecurity.openMember")}
                                </Link>
                              </Button>
                            </div>
                          ) : null}
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="rounded-[18px] border border-slate-100 bg-slate-50/70 p-4">
                            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                              {t(
                                "admin.currentActorSecurity.activeMemberships",
                              )}
                            </div>
                            <div className="mt-3 text-2xl font-semibold text-slate-950">
                              {currentActorAccessSummary
                                ? currentActorAccessSummary.active_memberships
                                : "--"}
                            </div>
                          </div>
                          <div className="rounded-[18px] border border-slate-100 bg-slate-50/70 p-4">
                            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                              {t(
                                "admin.currentActorSecurity.invitedMemberships",
                              )}
                            </div>
                            <div className="mt-3 text-2xl font-semibold text-slate-950">
                              {currentActorAccessSummary
                                ? currentActorAccessSummary.invited_memberships
                                : "--"}
                            </div>
                          </div>
                          <div className="rounded-[18px] border border-slate-100 bg-slate-50/70 p-4">
                            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                              {t(
                                "admin.currentActorSecurity.suspendedMemberships",
                              )}
                            </div>
                            <div className="mt-3 text-2xl font-semibold text-slate-950">
                              {currentActorAccessSummary
                                ? currentActorAccessSummary.suspended_memberships
                                : "--"}
                            </div>
                          </div>
                          <div className="rounded-[18px] border border-slate-100 bg-slate-50/70 p-4">
                            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                              {t("admin.currentActorSecurity.invitationRisk")}
                            </div>
                            <div className="mt-3 text-2xl font-semibold text-slate-950">
                              {currentActorInvitationRisk ?? "--"}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button
                            asChild
                            className="bg-white"
                            size="sm"
                            type="button"
                            variant="outline"
                          >
                            <Link href="/settings">
                              {t("admin.currentActorSecurity.openSettings")}
                            </Link>
                          </Button>
                          <Button
                            asChild
                            className="bg-white"
                            size="sm"
                            type="button"
                            variant="outline"
                          >
                            <Link
                              href={buildAdminHref({
                                tenantId: selectedTenantId,
                                section: "access",
                              })}
                            >
                              {t("admin.currentActorSecurity.openAccess")}
                            </Link>
                          </Button>
                        </div>
                      </>
                    ) : (
                      <div className="rounded-[18px] border border-dashed border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-500">
                        {t("admin.currentActorSecurity.notAvailable")}
                      </div>
                    )}
                  </div>
                </ConsoleSurface>
              ) : null}

              {showAdvancedAdminSections && adminSection === "security" ? (
                <ConsoleSurface>
                  <ConsoleSurfaceHeader
                    description={t("admin.securityWatch.description")}
                    title={t("admin.securityWatch.title")}
                  />
                  <div className="space-y-4 px-6 py-5">
                    {securityWatchItems.map((item) => (
                      <div
                        className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-5"
                        key={item.title}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-base font-semibold text-slate-900">
                            {item.title}
                          </div>
                          <Badge
                            className={cn(
                              "border",
                              getWatchStatusClass(item.status),
                            )}
                            variant="outline"
                          >
                            {item.status === "attention"
                              ? t("admin.watchlist.attention")
                              : item.status === "review"
                                ? t("admin.watchlist.review")
                                : t("admin.watchlist.healthy")}
                          </Badge>
                        </div>
                        <div className="mt-3 text-sm leading-6 text-slate-500">
                          {item.detail}
                        </div>
                        {item.actionHref && item.actionLabel ? (
                          <div className="mt-4">
                            <Button
                              asChild
                              className="bg-white"
                              size="sm"
                              type="button"
                              variant="outline"
                            >
                              <Link href={item.actionHref}>
                                {item.actionLabel}
                              </Link>
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </ConsoleSurface>
              ) : null}

              {showRuntimeSection ? (
                <ConsoleSurface className="overflow-visible rounded-none border-0 bg-transparent shadow-none">
                  <ConsoleSurfaceHeader
                    actionPlacement="below"
                    action={
                      <div className="grid w-full gap-2 rounded-xl border border-slate-200 bg-slate-50/70 p-4 lg:grid-cols-2 2xl:grid-cols-5">
                        <div className="relative min-w-0 lg:col-span-2 2xl:col-span-5">
                          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <Input
                            className="bg-white pl-9"
                            onChange={(event) =>
                              setRuntimeGovernanceSearchQuery(
                                event.target.value,
                              )
                            }
                            placeholder={t(
                              "admin.runtimeQueue.filters.searchPlaceholder",
                            )}
                            value={runtimeGovernanceSearchQuery}
                          />
                        </div>
                        <Select
                          onValueChange={
                            setRuntimeGovernanceQueueCategoryFilter
                          }
                          value={runtimeGovernanceQueueCategoryFilter}
                        >
                          <SelectTrigger className="h-10 w-full">
                            <SelectValue
                              placeholder={t(
                                "admin.runtimeQueue.filters.category",
                              )}
                            />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">
                              {t("admin.runtimeQueue.filters.allCategories")}
                            </SelectItem>
                            <SelectItem value="unconfigured_model_endpoint">
                              {t(
                                "admin.runtimeQueue.categories.unconfiguredModelEndpoint",
                              )}
                            </SelectItem>
                            <SelectItem value="disabled_bound_model_endpoint">
                              {t(
                                "admin.runtimeQueue.categories.disabledBoundModelEndpoint",
                              )}
                            </SelectItem>
                            <SelectItem value="approval_required_tool">
                              {t(
                                "admin.runtimeQueue.categories.approvalRequiredTool",
                              )}
                            </SelectItem>
                            <SelectItem value="mcp_integration_pending_tool">
                              {t(
                                "admin.runtimeQueue.categories.mcpIntegrationPendingTool",
                              )}
                            </SelectItem>
                            <SelectItem value="integration_blocked_connector">
                              {t(
                                "admin.runtimeQueue.categories.integrationBlockedConnector",
                              )}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <Select
                          onValueChange={
                            setRuntimeGovernanceQueueSeverityFilter
                          }
                          value={runtimeGovernanceQueueSeverityFilter}
                        >
                          <SelectTrigger className="h-10 w-full">
                            <SelectValue
                              placeholder={t(
                                "admin.runtimeQueue.filters.severity",
                              )}
                            />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">
                              {t("admin.runtimeQueue.filters.allSeverities")}
                            </SelectItem>
                            <SelectItem value="attention">
                              {t("admin.watchlist.attention")}
                            </SelectItem>
                            <SelectItem value="review">
                              {t("admin.watchlist.review")}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <Select
                          onValueChange={
                            setRuntimeGovernanceQueueResourceFilter
                          }
                          value={runtimeGovernanceQueueResourceFilter}
                        >
                          <SelectTrigger className="h-10 w-full">
                            <SelectValue
                              placeholder={t(
                                "admin.runtimeQueue.filters.resource",
                              )}
                            />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">
                              {t("admin.runtimeQueue.filters.allResources")}
                            </SelectItem>
                            <SelectItem value="model_endpoint">
                              {formatGovernanceTokenLabel("model_endpoint")}
                            </SelectItem>
                            <SelectItem value="tool_registration">
                              {formatGovernanceTokenLabel("tool_registration")}
                            </SelectItem>
                            <SelectItem value="mcp_connector">
                              {formatGovernanceTokenLabel("mcp_connector")}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <Select
                          onValueChange={setRuntimeGovernanceActionFilter}
                          value={runtimeGovernanceActionFilter}
                        >
                          <SelectTrigger className="h-10 w-full">
                            <SelectValue
                              placeholder={t(
                                "admin.runtimeQueue.filters.action",
                              )}
                            />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">
                              {t("admin.runtimeQueue.filters.allActions")}
                            </SelectItem>
                            <SelectItem value="created">
                              {formatGovernanceTokenLabel("created")}
                            </SelectItem>
                            <SelectItem value="updated">
                              {formatGovernanceTokenLabel("updated")}
                            </SelectItem>
                            <SelectItem value="deleted">
                              {formatGovernanceTokenLabel("deleted")}
                            </SelectItem>
                            <SelectItem value="governance_action">
                              {formatGovernanceTokenLabel("governance_action")}
                            </SelectItem>
                            <SelectItem value="previewed">
                              {formatGovernanceTokenLabel("previewed")}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <Select
                          onValueChange={setRuntimeGovernanceActorRoleFilter}
                          value={runtimeGovernanceActorRoleFilter}
                        >
                          <SelectTrigger className="h-10 w-full">
                            <SelectValue
                              placeholder={t(
                                "admin.runtimeQueue.filters.actor",
                              )}
                            />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">
                              {t("admin.runtimeQueue.filters.allActors")}
                            </SelectItem>
                            <SelectItem value="super_admin">
                              {t("auth.roles.superAdmin")}
                            </SelectItem>
                            <SelectItem value="operator">
                              {t("auth.roles.operator")}
                            </SelectItem>
                            <SelectItem value="reviewer">
                              {t("auth.roles.reviewer")}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    }
                    className="px-0 pb-4 pt-0"
                    description={t("admin.runtimeQueue.description")}
                    title={t("admin.runtimeQueue.title")}
                  />
                  <div className="space-y-6 pt-2">
                    <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                      <div className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-4">
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                          {t("admin.runtimeQueue.metrics.total")}
                        </div>
                        <div className="mt-2 text-2xl font-semibold text-slate-950">
                          {runtimeGovernanceWorklist?.total_items ?? 0}
                        </div>
                      </div>
                      <div className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-4">
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                          {t("admin.runtimeQueue.metrics.unconfiguredModels")}
                        </div>
                        <div className="mt-2 text-2xl font-semibold text-slate-950">
                          {runtimeGovernanceWorklist?.unconfigured_model_endpoints ??
                            0}
                        </div>
                      </div>
                      <div className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-4">
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                          {t("admin.runtimeQueue.metrics.disabledBoundModels")}
                        </div>
                        <div className="mt-2 text-2xl font-semibold text-slate-950">
                          {runtimeGovernanceWorklist?.disabled_bound_model_endpoints ??
                            0}
                        </div>
                      </div>
                      <div className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-4">
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                          {t(
                            "admin.runtimeQueue.metrics.approvalRequiredTools",
                          )}
                        </div>
                        <div className="mt-2 text-2xl font-semibold text-slate-950">
                          {runtimeGovernanceWorklist?.approval_required_tools ??
                            0}
                        </div>
                      </div>
                      <div className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-4">
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                          {t(
                            "admin.runtimeQueue.metrics.integrationPendingTools",
                          )}
                        </div>
                        <div className="mt-2 text-2xl font-semibold text-slate-950">
                          {runtimeGovernanceWorklist?.mcp_integration_pending_tools ??
                            0}
                        </div>
                      </div>
                      <div className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-4">
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                          {t("admin.runtimeQueue.metrics.blockedConnectors")}
                        </div>
                        <div className="mt-2 text-2xl font-semibold text-slate-950">
                          {runtimeGovernanceWorklist?.integration_blocked_connectors ??
                            0}
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-4 2xl:grid-cols-2">
                      <div className="space-y-3">
                        <div className="text-sm font-semibold text-slate-950">
                          {t("admin.runtimeQueue.worklistTitle")}
                        </div>
                        {runtimeGovernanceWorklist?.items.length ? (
                          <div className="space-y-3">
                            {runtimeGovernanceWorklist.items.map((item) => {
                              const followUp =
                                buildRuntimeGovernanceWorklistFollowUp(
                                  item,
                                  selectedTenantId === "all"
                                    ? null
                                    : selectedTenantId,
                                );
                              const quickActionKey =
                                resolveRuntimeGovernanceWorklistQuickAction(
                                  item,
                                );
                              const isApplyingQuickAction =
                                activeRuntimeGovernanceActionId ===
                                item.resource_id;
                              const previewStatusLabel =
                                getRuntimeGovernanceWorklistPreviewStatusLabel(
                                  item,
                                  t,
                                );
                              const previewFailureLabel =
                                item.resource_type === "model_endpoint" ||
                                item.resource_type === "tool_registration" ||
                                item.resource_type === "mcp_connector"
                                  ? readRuntimeGovernancePreviewFailureLabel(
                                      item,
                                      t,
                                      "admin.runtimeQueue.previewFailures",
                                    )
                                  : null;

                              return (
                                <div
                                  className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-4"
                                  key={`${item.resource_type}-${item.resource_id}`}
                                >
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Badge
                                      className={
                                        item.severity === "attention"
                                          ? "border-rose-200 bg-rose-50 text-rose-700"
                                          : "border-amber-200 bg-amber-50 text-amber-700"
                                      }
                                      variant="outline"
                                    >
                                      {item.severity === "attention"
                                        ? t("admin.watchlist.attention")
                                        : t("admin.watchlist.review")}
                                    </Badge>
                                    <Badge
                                      className="border-slate-200 bg-white text-slate-700"
                                      variant="outline"
                                    >
                                      {getRuntimeGovernanceWorklistCategoryLabel(
                                        item.category,
                                        t,
                                      )}
                                    </Badge>
                                  </div>
                                  <div className="mt-3 text-base font-semibold text-slate-950">
                                    {item.resource_name}
                                  </div>
                                  <div className="mt-1 text-sm text-slate-500">
                                    {item.resource_slug}
                                  </div>
                                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                                    <span>
                                      {getRuntimeGovernanceActionHintLabel(
                                        item.action_hint,
                                        t,
                                      )}
                                    </span>
                                    {"provider_type" in item.detail &&
                                    typeof item.detail.provider_type ===
                                      "string" ? (
                                      <span>
                                        {t(
                                          `settings.models.providers.${item.detail.provider_type}`,
                                        )}
                                      </span>
                                    ) : null}
                                    {"transport_type" in item.detail &&
                                    typeof item.detail.transport_type ===
                                      "string" ? (
                                      <span>
                                        {formatGovernanceTokenLabel(
                                          item.detail.transport_type,
                                        )}
                                      </span>
                                    ) : null}
                                    {"surface_area" in item.detail &&
                                    typeof item.detail.surface_area ===
                                      "string" ? (
                                      <span>
                                        {formatGovernanceTokenLabel(
                                          item.detail.surface_area,
                                        )}
                                      </span>
                                    ) : null}
                                    {"bound_agent_count" in item.detail &&
                                    typeof item.detail.bound_agent_count ===
                                      "number" ? (
                                      <span>
                                        {t("admin.runtimeQueue.boundAgents", {
                                          count: String(
                                            item.detail.bound_agent_count,
                                          ),
                                        })}
                                      </span>
                                    ) : null}
                                    {"runtime_issue" in item.detail &&
                                    typeof item.detail.runtime_issue ===
                                      "string" ? (
                                      <span>
                                        {t(
                                          `agents.readiness.issueLabels.model_runtime_unconfigured`,
                                        )}
                                      </span>
                                    ) : null}
                                    {"integration_ready_tool_count" in
                                      item.detail &&
                                    typeof item.detail
                                      .integration_ready_tool_count ===
                                      "number" ? (
                                      <span>
                                        {t(
                                          "admin.runtimeQueue.integrationReadyTools",
                                          {
                                            count: String(
                                              item.detail
                                                .integration_ready_tool_count,
                                            ),
                                          },
                                        )}
                                      </span>
                                    ) : null}
                                    {previewFailureLabel ? (
                                      <span>{previewFailureLabel}</span>
                                    ) : null}
                                  </div>
                                  {previewStatusLabel ? (
                                    <div className="mt-2 text-xs text-slate-500">
                                      {previewStatusLabel}
                                    </div>
                                  ) : null}
                                  <div className="mt-4 flex flex-wrap gap-2">
                                    {quickActionKey ? (
                                      <Button
                                        className="bg-white"
                                        disabled={
                                          !hasAdminWriteAccess ||
                                          isApplyingQuickAction
                                        }
                                        onClick={() =>
                                          void handleApplyRuntimeGovernanceQueueAction(
                                            item,
                                          )
                                        }
                                        size="sm"
                                        type="button"
                                        variant="outline"
                                      >
                                        {getRuntimeGovernanceQuickActionLabel(
                                          quickActionKey,
                                          t,
                                        )}
                                      </Button>
                                    ) : null}
                                    {followUp.settingsHref ? (
                                      <Button
                                        asChild
                                        className="bg-white"
                                        size="sm"
                                        type="button"
                                        variant="outline"
                                      >
                                        <Link href={followUp.settingsHref}>
                                          {t(
                                            "admin.runtimeQueue.actions.openSettings",
                                          )}
                                        </Link>
                                      </Button>
                                    ) : null}
                                    {followUp.definitionsHref ? (
                                      <Button
                                        asChild
                                        className="bg-white"
                                        size="sm"
                                        type="button"
                                        variant="outline"
                                      >
                                        <Link href={followUp.definitionsHref}>
                                          {t(
                                            "admin.runtimeQueue.actions.openAgents",
                                          )}
                                        </Link>
                                      </Button>
                                    ) : null}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="rounded-[20px] border border-dashed border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-500">
                            {t("admin.runtimeQueue.emptyWorklist")}
                          </div>
                        )}
                      </div>

                      <div className="space-y-3">
                        <div className="text-sm font-semibold text-slate-950">
                          {t("admin.runtimeQueue.eventsTitle")}
                        </div>
                        {runtimeGovernanceEvents.length ? (
                          <div className="space-y-3">
                            {runtimeGovernanceEvents.map((event) => {
                              const followUp =
                                buildRuntimeGovernanceEventFollowUp(
                                  event,
                                  selectedTenantId === "all"
                                    ? null
                                    : selectedTenantId,
                                );
                              const quickActionKey =
                                resolveRuntimeGovernanceEventQuickAction(event);
                              const isApplyingQuickAction =
                                Boolean(event.resource_id) &&
                                activeRuntimeGovernanceActionId ===
                                  event.resource_id;

                              return (
                                <div
                                  className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-4"
                                  key={event.id}
                                >
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Badge
                                      className="border-slate-200 bg-white text-slate-700"
                                      variant="outline"
                                    >
                                      {formatGovernanceTokenLabel(
                                        event.resource_type,
                                      )}
                                    </Badge>
                                    <Badge
                                      className="border-slate-200 bg-white text-slate-700"
                                      variant="outline"
                                    >
                                      {event.actor_role
                                        ? getRoleLabel(
                                            event.actor_role as
                                              | "super_admin"
                                              | "operator"
                                              | "reviewer",
                                            t,
                                          )
                                        : t("admin.runtimeQueue.systemActor")}
                                    </Badge>
                                  </div>
                                  <div className="mt-3 text-base font-semibold text-slate-950">
                                    {event.resource_name ??
                                      event.resource_slug ??
                                      t("settings.activity.notAvailable")}
                                  </div>
                                  <div className="mt-1 text-sm text-slate-500">
                                    {formatGovernanceTokenLabel(
                                      event.action_type,
                                    )}
                                  </div>
                                  <div className="mt-3 text-xs text-slate-400">
                                    {formatTimestamp(event.created_at)}
                                  </div>
                                  {followUp.settingsHref ||
                                  followUp.definitionsHref ? (
                                    <div className="mt-4 flex flex-wrap gap-2">
                                      {quickActionKey && event.resource_id ? (
                                        <Button
                                          className="bg-white"
                                          disabled={
                                            !hasAdminWriteAccess ||
                                            isApplyingQuickAction
                                          }
                                          onClick={() =>
                                            void handleApplyRuntimeGovernanceEventAction(
                                              event,
                                            )
                                          }
                                          size="sm"
                                          type="button"
                                          variant="outline"
                                        >
                                          {getRuntimeGovernanceQuickActionLabel(
                                            quickActionKey,
                                            t,
                                          )}
                                        </Button>
                                      ) : null}
                                      {followUp.settingsHref ? (
                                        <Button
                                          asChild
                                          className="bg-white"
                                          size="sm"
                                          type="button"
                                          variant="outline"
                                        >
                                          <Link href={followUp.settingsHref}>
                                            {t(
                                              "admin.runtimeQueue.actions.openSettings",
                                            )}
                                          </Link>
                                        </Button>
                                      ) : null}
                                      {followUp.definitionsHref ? (
                                        <Button
                                          asChild
                                          className="bg-white"
                                          size="sm"
                                          type="button"
                                          variant="outline"
                                        >
                                          <Link href={followUp.definitionsHref}>
                                            {t(
                                              "admin.runtimeQueue.actions.openAgents",
                                            )}
                                          </Link>
                                        </Button>
                                      ) : null}
                                    </div>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="rounded-[20px] border border-dashed border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-500">
                            {t("admin.runtimeQueue.emptyEvents")}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </ConsoleSurface>
              ) : null}

              {showAdvancedAdminSections ? (
                <ConsoleSurface>
                  <ConsoleSurfaceHeader
                    description={t("admin.scopePanel.description")}
                    title={t("admin.scopePanel.title")}
                  />
                  <div className="space-y-3 px-6 py-5 text-sm text-slate-600">
                    <div className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                        {t("admin.scopePanel.tenantScope")}
                      </div>
                      <div className="mt-2 text-base font-semibold text-slate-900">
                        {selectedTenantId === "all"
                          ? t("admin.scopePanel.allTenants")
                          : (tenants.find(
                              (tenant) => tenant.id === selectedTenantId,
                            )?.name ?? t("admin.scopePanel.unknownTenant"))}
                      </div>
                    </div>
                    <div className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                        {t("admin.scopePanel.visibleInventory")}
                      </div>
                      <div className="mt-2 text-base font-semibold text-slate-900">
                        {t("admin.scopePanel.inventoryCounts", {
                          workspaceCount: String(filteredWorkspaces.length),
                          knowledgeBaseCount: String(
                            filteredKnowledgeBases.length,
                          ),
                        })}
                      </div>
                    </div>
                    <div className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                        {t("admin.scopePanel.searchResults")}
                      </div>
                      <div className="mt-2 text-base font-semibold text-slate-900">
                        {t("admin.scopePanel.inventoryCounts", {
                          workspaceCount: String(searchedWorkspaces.length),
                          knowledgeBaseCount: String(
                            searchedKnowledgeBases.length,
                          ),
                        })}
                      </div>
                      <div className="mt-1 text-sm text-slate-500">
                        {normalizedSearchQuery
                          ? t("admin.scopePanel.query", {
                              value: searchQuery.trim(),
                            })
                          : t("admin.scopePanel.noDirectorySearch")}
                      </div>
                    </div>
                    <div className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                        {t("admin.scopePanel.lifecycleFilters")}
                      </div>
                      <div className="mt-2 text-base font-semibold text-slate-900">
                        {workspaceLifecycleFilter === "all"
                          ? t("admin.scopePanel.allWorkspaces")
                          : workspaceLifecycleFilter === "active"
                            ? t("admin.scopePanel.activeWorkspaces")
                            : t("admin.scopePanel.archivedWorkspaces")}
                      </div>
                      <div className="mt-1 text-sm text-slate-500">
                        {knowledgeBasePublicationStatusFilter === "all"
                          ? t("admin.scopePanel.allKnowledgeBases")
                          : knowledgeBasePublicationStatusFilter === "published"
                            ? t("admin.scopePanel.publishedKnowledgeBases")
                            : t("admin.scopePanel.draftKnowledgeBases")}
                      </div>
                    </div>
                    <div className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                        {t("settings.retrievalProfiles.title")}
                      </div>
                      <div className="mt-2 text-base font-semibold text-slate-900">
                        {retrievalProfileFilter === "all"
                          ? t("admin.scopePanel.allRetrievalProfiles")
                          : retrievalProfileFilter ===
                              DEFAULT_RETRIEVAL_PROFILE_FILTER_VALUE
                            ? t(
                                "admin.scopePanel.defaultFallbackRetrievalProfile",
                              )
                            : retrievalProfileFilter ===
                                DISABLED_RETRIEVAL_PROFILE_FILTER_VALUE
                              ? t(
                                  "admin.scopePanel.disabledAssignedRetrievalProfile",
                                )
                              : (retrievalProfiles.find(
                                  (retrievalProfile) =>
                                    retrievalProfile.id ===
                                    retrievalProfileFilter,
                                )?.name ?? t("settings.governance.empty"))}
                      </div>
                      <div className="mt-1 text-sm text-slate-500">
                        {retrievalProfileFilter === "all"
                          ? t("admin.scopePanel.retrievalProfileAllDescription")
                          : t(
                              "admin.scopePanel.retrievalProfileFilteredDescription",
                            )}
                      </div>
                    </div>
                    <div className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                        {t("admin.scopePanel.primaryRoute")}
                      </div>
                      <div className="mt-2 text-base font-semibold text-slate-900">
                        {scopedPrimaryWorkspace?.name ??
                          t("admin.scopePanel.noScopedWorkspace")}
                      </div>
                      <div className="mt-1 text-sm text-slate-500">
                        {scopedPrimaryKnowledgeBase?.name ??
                          t("admin.scopePanel.noScopedKnowledgeBase")}
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button
                          asChild
                          className="bg-white"
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          <Link href={chatScopeHref}>
                            {t("shell.nav.chat")}
                          </Link>
                        </Button>
                        <Button
                          asChild
                          className="bg-white"
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          <Link
                            href={buildAdminWorkspaceHref(adminSection, {
                              view: "documents",
                              tenantId:
                                selectedTenantId === "all"
                                  ? (scopedPrimaryWorkspace?.tenant_id ?? null)
                                  : selectedTenantId,
                              workspaceId: scopedPrimaryWorkspace?.id ?? null,
                              knowledgeBaseId:
                                scopedPrimaryKnowledgeBase?.id ?? null,
                            })}
                          >
                            {t("shell.nav.documents")}
                          </Link>
                        </Button>
                        <Button
                          asChild
                          className="bg-white"
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          <Link
                            href={buildAdminWorkspaceHref(adminSection, {
                              view: "workflows",
                              tenantId:
                                selectedTenantId === "all"
                                  ? (scopedPrimaryWorkspace?.tenant_id ?? null)
                                  : selectedTenantId,
                              workspaceId: scopedPrimaryWorkspace?.id ?? null,
                              knowledgeBaseId:
                                scopedPrimaryKnowledgeBase?.id ?? null,
                            })}
                          >
                            {t("shell.userMenu.operations")}
                          </Link>
                        </Button>
                        <Button
                          asChild
                          className="bg-white"
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          <Link
                            href={buildAdminWorkspaceHref(adminSection, {
                              view: "documents",
                              tenantId:
                                selectedTenantId === "all"
                                  ? (scopedPrimaryWorkspace?.tenant_id ?? null)
                                  : selectedTenantId,
                              workspaceId: scopedPrimaryWorkspace?.id ?? null,
                              knowledgeBaseId:
                                scopedPrimaryKnowledgeBase?.id ?? null,
                              documentStatus: "failed",
                            })}
                          >
                            {t("admin.scopePanel.failedDocuments")}
                          </Link>
                        </Button>
                        <Button
                          asChild
                          className="bg-white"
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          <Link
                            href={buildAdminWorkspaceHref(adminSection, {
                              view: "workflows",
                              tenantId:
                                selectedTenantId === "all"
                                  ? (scopedPrimaryWorkspace?.tenant_id ?? null)
                                  : selectedTenantId,
                              workspaceId: scopedPrimaryWorkspace?.id ?? null,
                              knowledgeBaseId:
                                scopedPrimaryKnowledgeBase?.id ?? null,
                              workflowStatus: scopedRecoveryStatus,
                            })}
                          >
                            {t("admin.scopePanel.failedWorkflows")}
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                </ConsoleSurface>
              ) : null}

              {showAdvancedAdminSections && adminSection === "overview" ? (
                <ConsoleSurface>
                  <ConsoleSurfaceHeader
                    description={t("admin.runtimeTaskPacket.description")}
                    title={t("admin.runtimeTaskPacket.title")}
                  />
                  <div className="p-6">
                    <ConsoleRuntimeTaskPacket
                      detail={runtimeTaskPacket.detail}
                      objective={runtimeTaskPacket.objective}
                      objectiveLabel={t(
                        "admin.runtimeTaskPacket.fields.objective",
                      )}
                      primaryActionHref={runtimeTaskPacket.primaryActionHref}
                      primaryActionLabel={t(
                        "admin.runtimeTaskPacket.primaryAction",
                      )}
                      primaryActionRunRecord={
                        runtimeTaskPacket.primaryActionRunRecord
                      }
                      prompt={runtimeTaskPacket.prompt}
                      promptLabel={t("admin.runtimeTaskPacket.fields.prompt")}
                      secondaryActions={runtimeTaskPacket.secondaryActions}
                      statusLabel={runtimeTaskPacket.statusLabel}
                      statusTone={runtimeTaskPacket.statusTone}
                      summaryItems={runtimeTaskPacket.summaryItems}
                      title={runtimeTaskPacket.title}
                    />
                  </div>
                </ConsoleSurface>
              ) : null}

              {showAdvancedAdminSections && adminSection === "overview" ? (
                <ConsoleSurface>
                  <ConsoleSurfaceHeader
                    action={
                      <Button
                        asChild
                        className="bg-white"
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        <Link
                          href={buildOperationsHref({
                            tenantId:
                              selectedTenantId === "all"
                                ? null
                                : selectedTenantId,
                            lane: "overview",
                            status: "all",
                          })}
                        >
                          {t("admin.agentExecutions.openOperations")}
                        </Link>
                      </Button>
                    }
                    description={t("admin.agentExecutions.description")}
                    title={t("admin.agentExecutions.title")}
                  />
                  <div className="grid gap-4 p-6 md:grid-cols-3">
                    <div className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                        {t("admin.agentExecutions.metrics.total")}
                      </div>
                      <div className="mt-2 text-2xl font-semibold text-slate-950">
                        {scopedAgentExecutionMetrics.total_executions}
                      </div>
                      <div className="mt-1 text-sm text-slate-500">
                        {t("admin.agentExecutions.metrics.totalHint")}
                      </div>
                    </div>
                    <div className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                        {t("admin.agentExecutions.metrics.completed")}
                      </div>
                      <div className="mt-2 text-2xl font-semibold text-slate-950">
                        {scopedAgentExecutionMetrics.completed_executions}
                      </div>
                      <div className="mt-1 text-sm text-slate-500">
                        {t("admin.agentExecutions.metrics.completedHint")}
                      </div>
                    </div>
                    <div className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                        {t("admin.agentExecutions.metrics.failed")}
                      </div>
                      <div className="mt-2 text-2xl font-semibold text-slate-950">
                        {scopedAgentExecutionMetrics.failed_executions}
                      </div>
                      <div className="mt-1 text-sm text-slate-500">
                        {scopedAgentExecutionMetrics.latest_execution_at
                          ? t("admin.agentExecutions.latestExecution", {
                              value: formatTimestamp(
                                scopedAgentExecutionMetrics.latest_execution_at,
                              ),
                            })
                          : t("admin.agentExecutions.noLatestExecution")}
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-4 border-t border-slate-100 p-6 xl:grid-cols-2">
                    <div className="space-y-3">
                      <div className="text-sm font-semibold text-slate-950">
                        {t("admin.agentExecutions.tenantBreakdown")}
                      </div>
                      {tenantAgentExecutionActivity.slice(0, 4).map((item) => (
                        <div
                          className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-4"
                          key={item.tenant.id}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-base font-semibold text-slate-900">
                                {item.tenant.name}
                              </div>
                              <div className="mt-1 text-sm text-slate-500">
                                {item.tenant.slug}
                              </div>
                            </div>
                            <Badge
                              className="border-slate-200 bg-white text-slate-700"
                              variant="outline"
                            >
                              {t("admin.agentExecutions.tenantExecutionCount", {
                                count: String(item.metrics.total_executions),
                              })}
                            </Badge>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Badge
                              className="border-slate-200 bg-white text-slate-700"
                              variant="outline"
                            >
                              {t("admin.agentExecutions.tenantCompletedCount", {
                                count: String(
                                  item.metrics.completed_executions,
                                ),
                              })}
                            </Badge>
                            <Badge
                              className="border-slate-200 bg-white text-slate-700"
                              variant="outline"
                            >
                              {t("admin.agentExecutions.tenantFailedCount", {
                                count: String(item.metrics.failed_executions),
                              })}
                            </Badge>
                          </div>
                          <div className="mt-3 text-sm text-slate-500">
                            {item.metrics.latest_execution_at
                              ? t("admin.agentExecutions.latestExecution", {
                                  value: formatTimestamp(
                                    item.metrics.latest_execution_at,
                                  ),
                                })
                              : t("admin.agentExecutions.noLatestExecution")}
                          </div>
                          <div className="mt-4 flex flex-wrap gap-2">
                            <Button
                              asChild
                              className="bg-white"
                              size="sm"
                              type="button"
                              variant="outline"
                            >
                              <Link href={item.operationsHref}>
                                {t("admin.agentExecutions.openOperations")}
                              </Link>
                            </Button>
                            <Button
                              asChild
                              className="bg-white"
                              size="sm"
                              type="button"
                              variant="outline"
                            >
                              <Link href={item.agentsHref}>
                                {t("admin.agentExecutions.openAgents")}
                              </Link>
                            </Button>
                          </div>
                        </div>
                      ))}
                      {!isLoading &&
                      tenantAgentExecutionActivity.length === 0 ? (
                        <div className="rounded-[20px] border border-dashed border-slate-200 bg-slate-50/80 px-5 py-8 text-sm text-slate-500">
                          {t("admin.agentExecutions.noTenantExecutions")}
                        </div>
                      ) : null}
                    </div>

                    <div className="space-y-3">
                      <div className="text-sm font-semibold text-slate-950">
                        {t("admin.agentExecutions.recentExecutions")}
                      </div>
                      {recentScopedAgentExecutions.length > 0 ? (
                        recentScopedAgentExecutions.map((execution) => {
                          const linkedAgent =
                            agents.find(
                              (agent) =>
                                agent.id === execution.agent_definition_id,
                            ) ?? null;
                          const toolRuntime = readToolRuntimeSummary(
                            execution.result_payload_json,
                          );
                          const retrievalSummary =
                            readAgentExecutionRetrievalSummary(
                              execution.result_payload_json,
                            );
                          const evidenceSummary =
                            readAgentExecutionEvidenceSummary(
                              execution.result_payload_json,
                            );
                          const runtimeBindingSummary =
                            readAgentExecutionRuntimeBindingSummary(
                              execution.result_payload_json,
                            );
                          const runtimeSummary =
                            readAgentExecutionRuntimeSummary(
                              execution.result_payload_json,
                            );
                          const taskState = execution.task_state;
                          const generatedOutputs =
                            execution.generated_outputs ?? [];
                          const recommendedActionSpecs =
                            evidenceSummary?.recommendedActionSpecs ?? [];
                          const recommendedActions =
                            recommendedActionSpecs.length === 0
                              ? (evidenceSummary?.recommendedActions.slice(
                                  0,
                                  2,
                                ) ?? [])
                              : [];
                          const followUpActions =
                            buildAgentExecutionFollowUpActions({
                              sourceContext: {
                                surface: "admin",
                                section: adminSection,
                              },
                              execution,
                              executionInput: evidenceSummary?.executionInput,
                              recommendedActions: recommendedActionSpecs,
                            });
                          const executionHref =
                            execution.execution_mode === "workflow_recovery"
                              ? buildOperationsHref({
                                  tenantId: execution.tenant_id,
                                  agentId: execution.agent_definition_id,
                                  lane: "overview",
                                  status: "all",
                                })
                              : buildAgentsHref({
                                  tenantId: execution.tenant_id,
                                  agentId: execution.agent_definition_id,
                                });

                          return (
                            <div
                              className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-4"
                              key={execution.id}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="text-sm font-semibold text-slate-950">
                                    {linkedAgent?.name ??
                                      t("admin.agentRuntime.unknownAgent")}
                                  </div>
                                  <div className="mt-1 text-sm leading-6 text-slate-500">
                                    {execution.summary ||
                                      execution.error_message ||
                                      t("operations.agentExecutions.pending")}
                                  </div>
                                </div>
                                <Badge
                                  className={cn(
                                    "border",
                                    execution.execution_status === "completed"
                                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                      : execution.execution_status === "failed"
                                        ? "border-rose-200 bg-rose-50 text-rose-700"
                                        : execution.execution_status ===
                                            "running"
                                          ? "border-blue-200 bg-blue-50 text-blue-700"
                                          : "border-amber-200 bg-amber-50 text-amber-700",
                                  )}
                                  variant="outline"
                                >
                                  {t(
                                    `agents.executions.statuses.${execution.execution_status}`,
                                  )}
                                </Badge>
                              </div>
                              <div className="mt-3 flex flex-wrap gap-2">
                                <Badge
                                  className="border-slate-200 bg-white text-slate-700"
                                  variant="outline"
                                >
                                  {t(
                                    `agents.modes.${execution.execution_mode}`,
                                  )}
                                </Badge>
                                {retrievalSummary?.retrievalProfileName ? (
                                  <Badge
                                    className="border-slate-200 bg-white text-slate-700"
                                    variant="outline"
                                  >
                                    {t(
                                      "home.retrievalInspector.retrievalProfile",
                                      {
                                        value:
                                          retrievalSummary.retrievalProfileName,
                                      },
                                    )}
                                  </Badge>
                                ) : null}
                                {retrievalSummary?.retrievalMode ? (
                                  <Badge
                                    className="border-slate-200 bg-white text-slate-700"
                                    variant="outline"
                                  >
                                    {t(
                                      "home.retrievalInspector.retrievalMode",
                                      {
                                        value: t(
                                          `settings.retrievalProfiles.modes.${retrievalSummary.retrievalMode}`,
                                        ),
                                      },
                                    )}
                                  </Badge>
                                ) : null}
                                <Badge
                                  className="border-slate-200 bg-white text-slate-700"
                                  variant="outline"
                                >
                                  {formatTimestamp(execution.updated_at)}
                                </Badge>
                                {execution.knowledge_base_scope ? (
                                  <Badge
                                    className="border-slate-200 bg-white text-slate-700"
                                    variant="outline"
                                  >
                                    {execution.knowledge_base_scope}
                                  </Badge>
                                ) : null}
                                {runtimeSummary?.agentRuntimeEngine ? (
                                  <Badge
                                    className="border-slate-200 bg-white text-slate-700"
                                    variant="outline"
                                  >
                                    {t("agents.executions.runtimeEngine", {
                                      value: runtimeSummary.agentRuntimeEngine,
                                    })}
                                  </Badge>
                                ) : null}
                              </div>
                              {runtimeBindingSummary ? (
                                <RuntimeBindingSummaryCard
                                  summary={runtimeBindingSummary}
                                />
                              ) : null}
                              {taskState || generatedOutputs.length > 0 ? (
                                <div className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-4">
                                  <div className="flex flex-wrap items-center gap-2">
                                    {taskState ? (
                                      <Badge
                                        className="border-slate-200 bg-slate-50 text-slate-700"
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
                                    taskState?.duration_seconds !==
                                      undefined ? (
                                      <Badge
                                        className="border-slate-200 bg-slate-50 text-slate-700"
                                        variant="outline"
                                      >
                                        {t(
                                          "agents.executions.durationSeconds",
                                          {
                                            value: String(
                                              taskState.duration_seconds,
                                            ),
                                          },
                                        )}
                                      </Badge>
                                    ) : null}
                                    {taskState ? (
                                      <Badge
                                        className="border-slate-200 bg-slate-50 text-slate-700"
                                        variant="outline"
                                      >
                                        {t("agents.executions.outputCount", {
                                          count: String(taskState.output_count),
                                        })}
                                      </Badge>
                                    ) : null}
                                    {taskState ? (
                                      <Badge
                                        className="border-slate-200 bg-slate-50 text-slate-700"
                                        variant="outline"
                                      >
                                        {t("agents.executions.followUpCount", {
                                          count: String(
                                            taskState.recommended_action_count,
                                          ),
                                        })}
                                      </Badge>
                                    ) : null}
                                  </div>
                                  {generatedOutputs.length > 0 ? (
                                    <div className="mt-4 grid gap-3 xl:grid-cols-2">
                                      {generatedOutputs.map((output) => (
                                        <div
                                          className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3"
                                          key={`${execution.id}-${output.output_key}`}
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
                              {toolRuntime ? (
                                <ToolRuntimeSummaryCard
                                  renderTraceActions={(trace) => (
                                    <ToolRuntimeTraceActions
                                      tenantId={execution.tenant_id}
                                      trace={trace}
                                    />
                                  )}
                                  summary={toolRuntime}
                                />
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
                                      <Badge
                                        className="border-slate-200 bg-slate-50 text-slate-700"
                                        variant="outline"
                                      >
                                        {t(
                                          "agents.executions.retrievalResults",
                                          {
                                            count: String(
                                              evidenceSummary.retrievalResultCount,
                                            ),
                                          },
                                        )}
                                      </Badge>
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
                                        <Badge
                                          className={cn(
                                            "border",
                                            getRetrievalMethodBadgeClassName(
                                              entry.method,
                                            ),
                                          )}
                                          key={`${execution.id}-${entry.method}`}
                                          variant="outline"
                                        >
                                          {t(
                                            `settings.retrievalProfiles.modes.${entry.method}`,
                                          )}{" "}
                                          x{entry.count}
                                        </Badge>
                                      ),
                                    )}
                                  </div>
                                  <div className="mt-3 space-y-2">
                                    {evidenceSummary.retrievalSources.map(
                                      (source, index) => (
                                        <div
                                          className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-3"
                                          key={`${execution.id}-${source.documentChunkId ?? index}`}
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
                                            {typeof source.score ===
                                            "number" ? (
                                              <span>
                                                {t("agents.executions.score", {
                                                  value:
                                                    source.score.toFixed(3),
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
                              {recommendedActions.length > 0 ? (
                                <div className="mt-4 flex flex-wrap gap-2">
                                  {recommendedActions.map((action) => (
                                    <Badge
                                      className="border-slate-200 bg-white text-slate-700"
                                      key={action}
                                      variant="outline"
                                    >
                                      {action}
                                    </Badge>
                                  ))}
                                </div>
                              ) : null}
                              <AgentExecutionFollowUpActions
                                actions={followUpActions}
                                className="mt-4"
                                extraActions={
                                  <Button
                                    asChild
                                    className="bg-white"
                                    size="sm"
                                    type="button"
                                    variant="outline"
                                  >
                                    <Link href={executionHref}>
                                      {t(
                                        "admin.agentExecutions.openExecutionRoute",
                                      )}
                                    </Link>
                                  </Button>
                                }
                                getLabel={(action) =>
                                  action.labelKey
                                    ? t(action.labelKey)
                                    : (action.label ?? "")
                                }
                                title={t("agents.executions.followUpTitle")}
                              />
                            </div>
                          );
                        })
                      ) : (
                        <div className="rounded-[20px] border border-dashed border-slate-200 bg-slate-50/80 px-5 py-8 text-sm text-slate-500">
                          {t("admin.agentExecutions.empty")}
                        </div>
                      )}
                    </div>
                  </div>
                </ConsoleSurface>
              ) : null}

              {showAdvancedAdminSections && adminSection === "overview" ? (
                <ConsoleSurface>
                  <ConsoleSurfaceHeader
                    action={
                      <Button
                        asChild
                        className="bg-white"
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        <Link
                          href={buildAgentsHref({
                            tenantId:
                              selectedTenantId === "all"
                                ? null
                                : selectedTenantId,
                            status: "active",
                            readiness: "attention",
                          })}
                        >
                          {t("admin.runtimeGovernance.openAttentionAgents")}
                        </Link>
                      </Button>
                    }
                    description={t("admin.runtimeGovernance.description")}
                    title={t("admin.runtimeGovernance.title")}
                  />
                  <div className="grid gap-4 p-6 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                        {t("admin.runtimeGovernance.metrics.attentionAgents")}
                      </div>
                      <div className="mt-2 text-2xl font-semibold text-slate-950">
                        {governancePosture.attentionAgents}
                      </div>
                      <div className="mt-1 text-sm text-slate-500">
                        {t(
                          "admin.runtimeGovernance.metrics.attentionAgentsHint",
                        )}
                      </div>
                    </div>
                    <div className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                        {t(
                          "admin.runtimeGovernance.metrics.disabledBoundModels",
                        )}
                      </div>
                      <div className="mt-2 text-2xl font-semibold text-slate-950">
                        {governancePosture.disabledBoundModels}
                      </div>
                      <div className="mt-1 text-sm text-slate-500">
                        {t(
                          "admin.runtimeGovernance.metrics.disabledBoundModelsHint",
                        )}
                      </div>
                    </div>
                    <div className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                        {t(
                          "admin.runtimeGovernance.metrics.disabledBoundTools",
                        )}
                      </div>
                      <div className="mt-2 text-2xl font-semibold text-slate-950">
                        {governancePosture.disabledBoundTools}
                      </div>
                      <div className="mt-1 text-sm text-slate-500">
                        {t(
                          "admin.runtimeGovernance.metrics.disabledBoundToolsHint",
                        )}
                      </div>
                    </div>
                    <div className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                        {t(
                          "admin.runtimeGovernance.metrics.approvalGatedTools",
                        )}
                      </div>
                      <div className="mt-2 text-2xl font-semibold text-slate-950">
                        {governancePosture.approvalGatedTools}
                      </div>
                      <div className="mt-1 text-sm text-slate-500">
                        {t(
                          "admin.runtimeGovernance.metrics.approvalGatedToolsHint",
                        )}
                      </div>
                    </div>
                    <div className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                        {t(
                          "admin.runtimeGovernance.metrics.disabledBoundRetrievalProfiles",
                        )}
                      </div>
                      <div className="mt-2 text-2xl font-semibold text-slate-950">
                        {
                          retrievalGovernanceSummary.disabledBoundRetrievalProfiles
                        }
                      </div>
                      <div className="mt-1 text-sm text-slate-500">
                        {t(
                          "admin.runtimeGovernance.metrics.disabledBoundRetrievalProfilesHint",
                        )}
                      </div>
                    </div>
                    <div className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                        {t(
                          "admin.runtimeGovernance.metrics.defaultFallbackKnowledgeBases",
                        )}
                      </div>
                      <div className="mt-2 text-2xl font-semibold text-slate-950">
                        {
                          retrievalGovernanceSummary.defaultFallbackKnowledgeBases
                        }
                      </div>
                      <div className="mt-1 text-sm text-slate-500">
                        {t(
                          "admin.runtimeGovernance.metrics.defaultFallbackKnowledgeBasesHint",
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-4 border-t border-slate-100 p-6 xl:grid-cols-2">
                    <div className="space-y-3">
                      <div className="text-sm font-semibold text-slate-950">
                        {t("admin.runtimeGovernance.signals")}
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-4">
                          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                            {t(
                              "admin.runtimeGovernance.activeAgentsWithoutScope",
                            )}
                          </div>
                          <div className="mt-2 text-2xl font-semibold text-slate-950">
                            {governancePosture.activeAgentsWithoutScope}
                          </div>
                        </div>
                        <div className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-4">
                          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                            {t("admin.runtimeGovernance.missingModelBindings")}
                          </div>
                          <div className="mt-2 text-2xl font-semibold text-slate-950">
                            {governancePosture.agentsMissingModel}
                          </div>
                        </div>
                        <div className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-4">
                          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                            {t("admin.runtimeGovernance.disabledModelBindings")}
                          </div>
                          <div className="mt-2 text-2xl font-semibold text-slate-950">
                            {governancePosture.agentsUsingDisabledModel}
                          </div>
                        </div>
                        <div className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-4">
                          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                            {t(
                              "admin.runtimeGovernance.unconfiguredModelBindings",
                            )}
                          </div>
                          <div className="mt-2 text-2xl font-semibold text-slate-950">
                            {governancePosture.agentsUsingUnconfiguredModel}
                          </div>
                        </div>
                        <div className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-4">
                          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                            {t("admin.runtimeGovernance.disabledToolBindings")}
                          </div>
                          <div className="mt-2 text-2xl font-semibold text-slate-950">
                            {
                              governancePosture.agentsUsingDisabledToolRegistration
                            }
                          </div>
                        </div>
                        <div className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-4">
                          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                            {t(
                              "admin.runtimeGovernance.missingRetrievalBindings",
                            )}
                          </div>
                          <div className="mt-2 text-2xl font-semibold text-slate-950">
                            {governancePosture.agentsMissingRetrievalProfile}
                          </div>
                        </div>
                        <div className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-4">
                          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                            {t(
                              "admin.runtimeGovernance.disabledRetrievalBindings",
                            )}
                          </div>
                          <div className="mt-2 text-2xl font-semibold text-slate-950">
                            {
                              governancePosture.agentsUsingDisabledRetrievalProfile
                            }
                          </div>
                        </div>
                        <div className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-4">
                          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                            {t(
                              "admin.runtimeGovernance.disabledRetrievalAssignments",
                            )}
                          </div>
                          <div className="mt-2 text-2xl font-semibold text-slate-950">
                            {
                              retrievalGovernanceSummary.knowledgeBasesUsingDisabledRetrievalProfile
                            }
                          </div>
                        </div>
                        <div className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-4">
                          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                            {t(
                              "admin.runtimeGovernance.explicitRetrievalBindings",
                            )}
                          </div>
                          <div className="mt-2 text-2xl font-semibold text-slate-950">
                            {
                              retrievalGovernanceSummary.explicitAssignedKnowledgeBases
                            }
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="text-sm font-semibold text-slate-950">
                        {t("admin.runtimeGovernance.quickActions")}
                      </div>
                      <div className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-4 text-sm leading-6 text-slate-600">
                        {t("admin.runtimeGovernance.quickActionsDescription")}
                      </div>
                      <div className="space-y-3">
                        <div className="text-sm font-semibold text-slate-950">
                          {t("admin.runtimeGovernance.providerLanes")}
                        </div>
                        <div className="grid gap-3">
                          {modelGovernanceSummary.provider_runtime_posture.map(
                            (provider) => (
                              <div
                                className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-4"
                                key={provider.provider_type}
                              >
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                  <div className="text-sm font-semibold text-slate-950">
                                    {t(
                                      `settings.models.providers.${provider.provider_type}`,
                                    )}
                                  </div>
                                  <Badge
                                    className={cn(
                                      "border",
                                      provider.posture_status === "ready"
                                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                        : provider.posture_status ===
                                            "attention"
                                          ? "border-amber-200 bg-amber-50 text-amber-800"
                                          : "border-slate-200 bg-slate-100 text-slate-700",
                                    )}
                                    variant="outline"
                                  >
                                    {t(
                                      `settings.models.compatibility.postureStatuses.${provider.posture_status}`,
                                    )}
                                  </Badge>
                                </div>
                                <div className="mt-3 grid gap-3 sm:grid-cols-4">
                                  <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                                      {t(
                                        "admin.runtimeGovernance.providerMetrics.runtimeReady",
                                      )}
                                    </div>
                                    <div className="mt-2 text-base font-semibold text-slate-950">
                                      {provider.runtime_ready_endpoints}
                                    </div>
                                  </div>
                                  <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                                      {t(
                                        "admin.runtimeGovernance.providerMetrics.activeAgents",
                                      )}
                                    </div>
                                    <div className="mt-2 text-base font-semibold text-slate-950">
                                      {provider.active_agent_count}
                                    </div>
                                  </div>
                                  <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                                      {t(
                                        "admin.runtimeGovernance.providerMetrics.attentionAgents",
                                      )}
                                    </div>
                                    <div className="mt-2 text-base font-semibold text-slate-950">
                                      {provider.attention_active_agent_count}
                                    </div>
                                  </div>
                                  <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                                      {t(
                                        "admin.runtimeGovernance.providerMetrics.previewFailures",
                                      )}
                                    </div>
                                    <div className="mt-2 text-base font-semibold text-slate-950">
                                      {provider.recent_preview_failed_events}
                                    </div>
                                  </div>
                                </div>
                                <div className="mt-3 text-xs text-slate-500">
                                  {provider.last_preview_status &&
                                  provider.last_preview_at
                                    ? t(
                                        "admin.runtimeGovernance.providerPreviewStatus",
                                        {
                                          status: provider.last_preview_status,
                                          value: formatTimestamp(
                                            provider.last_preview_at,
                                          ),
                                        },
                                      )
                                    : t(
                                        "admin.runtimeGovernance.providerPreviewEmpty",
                                      )}
                                </div>
                                <div className="mt-3 flex flex-wrap gap-2">
                                  <Button
                                    asChild
                                    className="bg-white"
                                    size="sm"
                                    type="button"
                                    variant="outline"
                                  >
                                    <Link
                                      href={buildSettingsHref({
                                        runtimeResource: "model_endpoint",
                                        modelProviderType:
                                          provider.provider_type,
                                      })}
                                    >
                                      {t(
                                        "admin.runtimeGovernance.openProviderModels",
                                      )}
                                    </Link>
                                  </Button>
                                  <Button
                                    asChild
                                    className="bg-white"
                                    size="sm"
                                    type="button"
                                    variant="outline"
                                  >
                                    <Link
                                      href={buildScopedRuntimeIssueHref(
                                        "model_runtime_unconfigured",
                                        {
                                          modelProviderType:
                                            normalizeRuntimeGovernanceProviderType(
                                              provider.provider_type,
                                            ),
                                        },
                                      )}
                                    >
                                      {t(
                                        "settings.models.compatibility.openRuntimeAttention",
                                      )}
                                    </Link>
                                  </Button>
                                </div>
                              </div>
                            ),
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          asChild
                          className="bg-white"
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          <Link
                            href={buildAgentsHref({
                              tenantId:
                                selectedTenantId === "all"
                                  ? null
                                  : selectedTenantId,
                              status: "active",
                              readiness: "attention",
                            })}
                          >
                            {t("admin.runtimeGovernance.openAttentionAgents")}
                          </Link>
                        </Button>
                        {focusedRuntimeSettingsHref ? (
                          <Button
                            asChild
                            className="bg-white"
                            size="sm"
                            type="button"
                            variant="outline"
                          >
                            <Link href={focusedRuntimeSettingsHref}>
                              {t("admin.runtimeGovernance.openSettings")}
                            </Link>
                          </Button>
                        ) : null}
                        <Button
                          asChild
                          className="bg-white"
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          <Link
                            href={buildAdminHref({
                              tenantId:
                                selectedTenantId === "all"
                                  ? null
                                  : selectedTenantId,
                              section: "directory",
                              retrievalProfileFilter:
                                DEFAULT_RETRIEVAL_PROFILE_FILTER_VALUE,
                            })}
                          >
                            {t(
                              "admin.runtimeGovernance.openDefaultFallbackKnowledgeBases",
                            )}
                          </Link>
                        </Button>
                        <Button
                          asChild
                          className="bg-white"
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          <Link href={focusedRuntimeDefinitionsHref}>
                            {t("admin.runtimeGovernance.openActiveAgents")}
                          </Link>
                        </Button>
                        <Button
                          asChild
                          className="bg-white"
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          <Link
                            href={buildAdminHref({
                              tenantId:
                                selectedTenantId === "all"
                                  ? null
                                  : selectedTenantId,
                              section: "directory",
                              retrievalProfileFilter:
                                DISABLED_RETRIEVAL_PROFILE_FILTER_VALUE,
                            })}
                          >
                            {t(
                              "admin.runtimeGovernance.openDisabledRetrievalAssignments",
                            )}
                          </Link>
                        </Button>
                      </div>
                      <div className="pt-1 text-sm font-semibold text-slate-950">
                        {t("admin.runtimeGovernance.issueActions")}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          asChild
                          className="bg-white"
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          <Link
                            href={buildScopedRuntimeIssueHref("scope_missing")}
                          >
                            {t("agents.readiness.issueLabels.scope_missing")}
                          </Link>
                        </Button>
                        <Button
                          asChild
                          className="bg-white"
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          <Link
                            href={buildScopedRuntimeIssueHref("model_missing")}
                          >
                            {t("agents.readiness.issueLabels.model_missing")}
                          </Link>
                        </Button>
                        <Button
                          asChild
                          className="bg-white"
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          <Link
                            href={
                              focusedDisabledModelDefinitionsHref ??
                              buildScopedRuntimeIssueHref("model_disabled")
                            }
                          >
                            {t("agents.readiness.issueLabels.model_disabled")}
                          </Link>
                        </Button>
                        <Button
                          asChild
                          className="bg-white"
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          <Link
                            href={
                              focusedUnconfiguredModelDefinitionsHref ??
                              buildScopedRuntimeIssueHref(
                                "model_runtime_unconfigured",
                              )
                            }
                          >
                            {t(
                              "agents.readiness.issueLabels.model_runtime_unconfigured",
                            )}
                          </Link>
                        </Button>
                        <Button
                          asChild
                          className="bg-white"
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          <Link
                            href={buildScopedRuntimeIssueHref(
                              "retrieval_profile_missing",
                            )}
                          >
                            {t(
                              "agents.readiness.issueLabels.retrieval_profile_missing",
                            )}
                          </Link>
                        </Button>
                        <Button
                          asChild
                          className="bg-white"
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          <Link
                            href={
                              focusedDisabledRetrievalDefinitionsHref ??
                              buildScopedRuntimeIssueHref(
                                "retrieval_profile_disabled",
                              )
                            }
                          >
                            {t(
                              "agents.readiness.issueLabels.retrieval_profile_disabled",
                            )}
                          </Link>
                        </Button>
                        <Button
                          asChild
                          className="bg-white"
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          <Link
                            href={buildScopedRuntimeIssueHref("tools_missing")}
                          >
                            {t("agents.readiness.issueLabels.tools_missing")}
                          </Link>
                        </Button>
                        <Button
                          asChild
                          className="bg-white"
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          <Link
                            href={
                              focusedDisabledToolDefinitionsHref ??
                              buildScopedRuntimeIssueHref(
                                "tool_registration_disabled",
                              )
                            }
                          >
                            {t(
                              "agents.readiness.issueLabels.tool_registration_disabled",
                            )}
                          </Link>
                        </Button>
                        {focusedApprovalToolDefinitionsHref ? (
                          <Button
                            asChild
                            className="bg-white"
                            size="sm"
                            type="button"
                            variant="outline"
                          >
                            <Link href={focusedApprovalToolDefinitionsHref}>
                              {t(
                                "agents.readiness.issueLabels.tool_approval_required",
                              )}
                            </Link>
                          </Button>
                        ) : null}
                        {governancePosture.issue_counts.tool_mcp_reserved >
                        0 ? (
                          <Button
                            asChild
                            className="bg-white"
                            size="sm"
                            type="button"
                            variant="outline"
                          >
                            <Link
                              href={buildScopedRuntimeIssueHref(
                                "tool_mcp_reserved",
                                {
                                  toolRegistrationId:
                                    focusedReservedMcpToolRegistration?.id ??
                                    null,
                                },
                              )}
                            >
                              {t(
                                "agents.readiness.issueLabels.tool_mcp_reserved",
                              )}
                            </Link>
                          </Button>
                        ) : null}
                        {governancePosture.issue_counts
                          .tool_mcp_integration_pending > 0 ? (
                          <Button
                            asChild
                            className="bg-white"
                            size="sm"
                            type="button"
                            variant="outline"
                          >
                            <Link
                              href={buildScopedRuntimeIssueHref(
                                "tool_mcp_integration_pending",
                                {
                                  toolRegistrationId:
                                    focusedPendingMcpToolRegistration?.id ??
                                    null,
                                },
                              )}
                            >
                              {t(
                                "agents.readiness.issueLabels.tool_mcp_integration_pending",
                              )}
                            </Link>
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </ConsoleSurface>
              ) : null}

              {showAdvancedAdminSections && adminSection === "overview" ? (
                <ConsoleSurface>
                  <ConsoleSurfaceHeader
                    description={t("admin.retrievalProfiles.description")}
                    title={t("admin.retrievalProfiles.title")}
                  />
                  <div className="grid gap-4 px-6 py-5 xl:grid-cols-2">
                    {retrievalProfileAssets.length > 0 ? (
                      retrievalProfileAssets.map((asset) => (
                        <div
                          className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-5"
                          key={asset.profile.id}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <div className="text-base font-semibold text-slate-950">
                                {asset.profile.name}
                              </div>
                              <div className="mt-1 text-sm text-slate-500">
                                {asset.profile.slug}
                              </div>
                            </div>
                            <Badge
                              className={cn(
                                "border",
                                getWatchStatusClass(asset.status),
                              )}
                              variant="outline"
                            >
                              {asset.status === "attention"
                                ? t("admin.watchlist.attention")
                                : asset.status === "review"
                                  ? t("admin.watchlist.review")
                                  : t("admin.watchlist.healthy")}
                            </Badge>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Badge
                              className={cn(
                                "border",
                                getRetrievalMethodBadgeClassName(
                                  asset.profile.retrieval_mode,
                                ),
                              )}
                              variant="outline"
                            >
                              {t(
                                `settings.retrievalProfiles.modes.${asset.profile.retrieval_mode}`,
                              )}
                            </Badge>
                            {asset.profile.is_default ? (
                              <Badge
                                className="border-slate-200 bg-white text-slate-700"
                                variant="outline"
                              >
                                {t("settings.retrievalProfiles.default")}
                              </Badge>
                            ) : null}
                            <Badge
                              className="border-slate-200 bg-white text-slate-700"
                              variant="outline"
                            >
                              {asset.profile.is_enabled
                                ? t("settings.runtime.enabled")
                                : t("settings.runtime.disabled")}
                            </Badge>
                            <Badge
                              className="border-slate-200 bg-white text-slate-700"
                              variant="outline"
                            >
                              {t("home.retrievalInspector.effectiveTopK", {
                                value: String(asset.profile.top_k),
                              })}
                            </Badge>
                          </div>
                          <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3">
                              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                                {t(
                                  "admin.retrievalProfiles.metrics.assignedKnowledgeBases",
                                )}
                              </div>
                              <div className="mt-2 text-2xl font-semibold text-slate-950">
                                {asset.assignedKnowledgeBases}
                              </div>
                              <div className="mt-1 text-sm text-slate-500">
                                {t(
                                  "admin.retrievalProfiles.metrics.workspaceCoverage",
                                  {
                                    count: String(asset.assignedWorkspaceCount),
                                  },
                                )}
                              </div>
                            </div>
                            <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3">
                              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                                {t(
                                  "admin.retrievalProfiles.metrics.defaultFallbackCoverage",
                                )}
                              </div>
                              <div className="mt-2 text-2xl font-semibold text-slate-950">
                                {asset.fallbackCoverageCount}
                              </div>
                              <div className="mt-1 text-sm text-slate-500">
                                {t(
                                  "admin.retrievalProfiles.metrics.publicationMix",
                                  {
                                    published: String(
                                      asset.publishedKnowledgeBaseCount,
                                    ),
                                    draft: String(
                                      asset.draftKnowledgeBaseCount,
                                    ),
                                  },
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="mt-4 rounded-2xl border border-slate-100 bg-white px-4 py-3 text-sm leading-6 text-slate-600">
                            {!asset.profile.is_enabled &&
                            asset.assignedKnowledgeBases > 0
                              ? t(
                                  "admin.retrievalProfiles.status.disabledAssigned",
                                  {
                                    count: String(asset.assignedKnowledgeBases),
                                  },
                                )
                              : asset.fallbackCoverageCount > 0
                                ? t(
                                    "admin.retrievalProfiles.status.defaultFallback",
                                    {
                                      count: String(
                                        asset.fallbackCoverageCount,
                                      ),
                                    },
                                  )
                                : asset.assignedKnowledgeBases === 0
                                  ? t("admin.retrievalProfiles.status.unused")
                                  : t(
                                      "admin.retrievalProfiles.status.healthyAssigned",
                                      {
                                        count: String(
                                          asset.assignedKnowledgeBases,
                                        ),
                                      },
                                    )}
                          </div>
                          <div className="mt-4 flex flex-wrap gap-2">
                            <Button
                              asChild
                              className="bg-white"
                              size="sm"
                              type="button"
                              variant="outline"
                            >
                              <Link
                                href={buildAdminHref({
                                  tenantId:
                                    selectedTenantId === "all"
                                      ? null
                                      : selectedTenantId,
                                  section: "directory",
                                  retrievalProfileFilter: asset.profile.id,
                                })}
                              >
                                {t(
                                  "admin.retrievalProfiles.reviewKnowledgeBases",
                                )}
                              </Link>
                            </Button>
                            {asset.fallbackCoverageCount > 0 ? (
                              <Button
                                asChild
                                className="bg-white"
                                size="sm"
                                type="button"
                                variant="outline"
                              >
                                <Link
                                  href={buildAdminHref({
                                    tenantId:
                                      selectedTenantId === "all"
                                        ? null
                                        : selectedTenantId,
                                    section: "directory",
                                    retrievalProfileFilter:
                                      DEFAULT_RETRIEVAL_PROFILE_FILTER_VALUE,
                                  })}
                                >
                                  {t(
                                    "admin.retrievalProfiles.openDefaultFallback",
                                  )}
                                </Link>
                              </Button>
                            ) : null}
                            <Button
                              asChild
                              className="bg-white"
                              size="sm"
                              type="button"
                              variant="outline"
                            >
                              <Link
                                href={buildSettingsHref({
                                  runtimeResource: "retrieval_profile",
                                  retrievalProfileId: asset.profile.id,
                                })}
                              >
                                {t("admin.runtimeGovernance.openSettings")}
                              </Link>
                            </Button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-[20px] border border-dashed border-slate-200 bg-slate-50/80 px-5 py-8 text-sm text-slate-500">
                        {t("settings.retrievalProfiles.empty")}
                      </div>
                    )}
                  </div>
                </ConsoleSurface>
              ) : null}

              {showAdvancedAdminSections && adminSection === "overview" ? (
                <ConsoleSurface>
                  <ConsoleSurfaceHeader
                    description={t("admin.runtimeRoutes.description")}
                    title={t("admin.runtimeRoutes.title")}
                  />
                  <div className="space-y-3 px-6 py-5">
                    {runtimeRoutes.length > 0 ? (
                      runtimeRoutes.map((item) => (
                        <div
                          className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-4"
                          key={item.agent.id}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-base font-semibold text-slate-900">
                                {item.agent.name}
                              </div>
                              <div className="mt-1 text-sm text-slate-500">
                                {t(`agents.modes.${item.agent.mode}`)}
                              </div>
                            </div>
                            <Badge
                              className={cn(
                                "border",
                                item.launchReady
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                  : item.retrievalIssue
                                    ? "border-amber-200 bg-amber-50 text-amber-700"
                                    : "border-amber-200 bg-amber-50 text-amber-700",
                              )}
                              variant="outline"
                            >
                              {item.launchReady
                                ? t("admin.runtimeRoutes.scopeReady")
                                : item.retrievalIssue === "disabled"
                                  ? t("admin.runtimeRoutes.retrievalDisabled")
                                  : item.retrievalIssue === "missing"
                                    ? t("admin.runtimeRoutes.retrievalMissing")
                                    : t("admin.runtimeRoutes.scopePending")}
                            </Badge>
                          </div>
                          <div className="mt-3 text-sm leading-6 text-slate-600">
                            {item.agent.objective.trim().length > 0
                              ? item.agent.objective
                              : t("admin.runtimeRoutes.noObjective")}
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Badge
                              className="border-slate-200 bg-white text-slate-700"
                              variant="outline"
                            >
                              {t("admin.runtimeRoutes.scopeLabel", {
                                value: item.scopeLabel?.trim().length
                                  ? item.scopeLabel
                                  : t("admin.runtimeRoutes.scopeUnbound"),
                              })}
                            </Badge>
                            {item.resolvedWorkspace ? (
                              <Badge
                                className="border-slate-200 bg-white text-slate-700"
                                variant="outline"
                              >
                                {t("admin.runtimeRoutes.resolvedWorkspace", {
                                  value: item.resolvedWorkspace.name,
                                })}
                              </Badge>
                            ) : null}
                            {item.resolvedKnowledgeBase ? (
                              <Badge
                                className="border-slate-200 bg-white text-slate-700"
                                variant="outline"
                              >
                                {t(
                                  "admin.runtimeRoutes.resolvedKnowledgeBase",
                                  {
                                    value: item.resolvedKnowledgeBase.name,
                                  },
                                )}
                              </Badge>
                            ) : null}
                            {item.retrievalProfile ? (
                              <Badge
                                className="border-slate-200 bg-white text-slate-700"
                                variant="outline"
                              >
                                {t("admin.runtimeRoutes.retrievalProfile", {
                                  value: item.retrievalProfile.name,
                                })}
                              </Badge>
                            ) : null}
                          </div>
                          {item.retrievalIssue ? (
                            <div className="mt-3 rounded-[16px] border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm leading-6 text-amber-800">
                              {item.retrievalIssue === "disabled"
                                ? t(
                                    "admin.runtimeRoutes.retrievalDisabledDetail",
                                    {
                                      profile:
                                        item.retrievalProfile?.name ??
                                        t(
                                          "agents.dependencies.noRetrievalProfile",
                                        ),
                                    },
                                  )
                                : t(
                                    "admin.runtimeRoutes.retrievalMissingDetail",
                                  )}
                            </div>
                          ) : null}
                          <div className="mt-3 rounded-[16px] border border-slate-200 bg-white px-4 py-3">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                              {t("admin.runtimeRoutes.launchPrompt")}
                            </div>
                            <div className="mt-2 text-sm leading-6 text-slate-700">
                              {item.prompt}
                            </div>
                          </div>
                          <div className="mt-4 flex flex-wrap gap-2">
                            <AgentRunButtonLink
                              href={item.recommendedHref}
                              runRecord={item.recommendedRunRecord}
                              size="sm"
                              type="button"
                            >
                              {t("admin.runtimeRoutes.openRecommended")}
                            </AgentRunButtonLink>
                            <AgentRunButtonLink
                              className="bg-white"
                              href={item.secondaryHref}
                              runRecord={item.secondaryRunRecord}
                              size="sm"
                              type="button"
                              variant="outline"
                            >
                              {t("admin.runtimeRoutes.openSecondary")}
                            </AgentRunButtonLink>
                            <Button
                              asChild
                              className="bg-white"
                              size="sm"
                              type="button"
                              variant="outline"
                            >
                              <Link href={item.definitionHref}>
                                {t("admin.runtimeRoutes.openDefinition")}
                              </Link>
                            </Button>
                            {item.retrievalIssue === "disabled" ? (
                              <Button
                                asChild
                                className="bg-white"
                                size="sm"
                                type="button"
                                variant="outline"
                              >
                                <Link
                                  href={
                                    item.resolvedKnowledgeBase
                                      ? buildKnowledgeBaseGovernanceHref(
                                          item.resolvedKnowledgeBase,
                                          {
                                            retrievalProfileFilter:
                                              DISABLED_RETRIEVAL_PROFILE_FILTER_VALUE,
                                          },
                                        )
                                      : buildAdminHref({
                                          tenantId: item.agent.tenant_id,
                                          section: "directory",
                                          retrievalProfileFilter:
                                            DISABLED_RETRIEVAL_PROFILE_FILTER_VALUE,
                                        })
                                  }
                                >
                                  {t(
                                    "admin.runtimeRoutes.openRetrievalGovernance",
                                  )}
                                </Link>
                              </Button>
                            ) : item.retrievalIssue === "missing" ? (
                              <Button
                                asChild
                                className="bg-white"
                                size="sm"
                                type="button"
                                variant="outline"
                              >
                                <Link
                                  href={
                                    item.resolvedKnowledgeBase
                                      ? buildKnowledgeBaseGovernanceHref(
                                          item.resolvedKnowledgeBase,
                                        )
                                      : buildSettingsHref({
                                          runtimeResource: "retrieval_profile",
                                        })
                                  }
                                >
                                  {t(
                                    "admin.runtimeRoutes.openRetrievalSettings",
                                  )}
                                </Link>
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-[20px] border border-dashed border-slate-200 bg-slate-50/80 px-5 py-8 text-sm text-slate-500">
                        {t("admin.runtimeRoutes.empty")}
                      </div>
                    )}
                  </div>
                </ConsoleSurface>
              ) : null}

              {showAdvancedAdminSections && adminSection === "overview" ? (
                <ConsoleSurface>
                  <ConsoleSurfaceHeader
                    action={
                      <Button
                        asChild
                        className="bg-white"
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        <Link
                          href={buildAgentsHref({
                            tenantId:
                              selectedTenantId === "all"
                                ? null
                                : selectedTenantId,
                            status: "active",
                          })}
                        >
                          {t("admin.agentRuntime.openAgents")}
                        </Link>
                      </Button>
                    }
                    description={t("admin.agentRuntime.description")}
                    title={t("admin.agentRuntime.title")}
                  />
                  <div className="grid gap-4 p-6 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                        {t("agents.runs.metrics.total")}
                      </div>
                      <div className="mt-2 text-2xl font-semibold text-slate-950">
                        {scopedAgentRunMetrics.total_runs}
                      </div>
                      <div className="mt-1 text-sm text-slate-500">
                        {t("admin.agentRuntime.metrics.totalHint")}
                      </div>
                    </div>
                    <div className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                        {t("agents.runs.metrics.chat")}
                      </div>
                      <div className="mt-2 text-2xl font-semibold text-slate-950">
                        {scopedAgentRunMetrics.chat_runs}
                      </div>
                      <div className="mt-1 text-sm text-slate-500">
                        {t("admin.agentRuntime.metrics.chatHint")}
                      </div>
                    </div>
                    <div className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                        {t("agents.runs.metrics.documents")}
                      </div>
                      <div className="mt-2 text-2xl font-semibold text-slate-950">
                        {scopedAgentRunMetrics.document_runs}
                      </div>
                      <div className="mt-1 text-sm text-slate-500">
                        {t("admin.agentRuntime.metrics.documentsHint")}
                      </div>
                    </div>
                    <div className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                        {t("agents.runs.metrics.operations")}
                      </div>
                      <div className="mt-2 text-2xl font-semibold text-slate-950">
                        {scopedAgentRunMetrics.operations_runs}
                      </div>
                      <div className="mt-1 text-sm text-slate-500">
                        {scopedAgentRunMetrics.latest_launched_at
                          ? t("admin.agentRuntime.latestLaunch", {
                              value: formatTimestamp(
                                scopedAgentRunMetrics.latest_launched_at,
                              ),
                            })
                          : t("admin.agentRuntime.noLatestLaunch")}
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-4 border-t border-slate-100 p-6 xl:grid-cols-2">
                    <div className="space-y-3">
                      <div className="text-sm font-semibold text-slate-950">
                        {t("admin.agentRuntime.tenantBreakdown")}
                      </div>
                      {tenantAgentRuntimeActivity.slice(0, 4).map((item) => (
                        <div
                          className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-4"
                          key={item.tenant.id}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-base font-semibold text-slate-900">
                                {item.tenant.name}
                              </div>
                              <div className="mt-1 text-sm text-slate-500">
                                {item.tenant.slug}
                              </div>
                            </div>
                            <Badge
                              className="border-slate-200 bg-white text-slate-700"
                              variant="outline"
                            >
                              {t("admin.agentRuntime.tenantRunCount", {
                                count: String(item.metrics.total_runs),
                              })}
                            </Badge>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Badge
                              className="border-slate-200 bg-white text-slate-700"
                              variant="outline"
                            >
                              {t("agents.runs.metrics.chat")}:{" "}
                              {item.metrics.chat_runs}
                            </Badge>
                            <Badge
                              className="border-slate-200 bg-white text-slate-700"
                              variant="outline"
                            >
                              {t("agents.runs.metrics.documents")}:{" "}
                              {item.metrics.document_runs}
                            </Badge>
                            <Badge
                              className="border-slate-200 bg-white text-slate-700"
                              variant="outline"
                            >
                              {t("agents.runs.metrics.operations")}:{" "}
                              {item.metrics.operations_runs}
                            </Badge>
                          </div>
                          <div className="mt-3 text-sm text-slate-500">
                            {item.metrics.latest_launched_at
                              ? t("admin.agentRuntime.latestLaunch", {
                                  value: formatTimestamp(
                                    item.metrics.latest_launched_at,
                                  ),
                                })
                              : t("admin.agentRuntime.noLatestLaunch")}
                          </div>
                          <div className="mt-4 flex flex-wrap gap-2">
                            <Button
                              asChild
                              className="bg-white"
                              size="sm"
                              type="button"
                              variant="outline"
                            >
                              <Link href={item.agentsHref}>
                                {t("admin.agentRuntime.openAgents")}
                              </Link>
                            </Button>
                            <Button
                              asChild
                              className="bg-white"
                              size="sm"
                              type="button"
                              variant="outline"
                            >
                              <Link href={item.operationsHref}>
                                {t("shell.userMenu.operations")}
                              </Link>
                            </Button>
                          </div>
                        </div>
                      ))}
                      {!isLoading && tenantAgentRuntimeActivity.length === 0 ? (
                        <div className="rounded-[20px] border border-dashed border-slate-200 bg-slate-50/80 px-5 py-8 text-sm text-slate-500">
                          {t("admin.agentRuntime.noTenantRuns")}
                        </div>
                      ) : null}
                    </div>

                    <div className="space-y-3">
                      <div className="text-sm font-semibold text-slate-950">
                        {t("admin.agentRuntime.recentRuns")}
                      </div>
                      {recentScopedAgentRuns.length > 0 ? (
                        recentScopedAgentRuns.map((agentRun) => {
                          const linkedAgent =
                            agents.find(
                              (agent) =>
                                agent.id === agentRun.agent_definition_id,
                            ) ?? null;

                          return (
                            <div
                              className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-4"
                              key={agentRun.id}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="text-sm font-semibold text-slate-950">
                                    {linkedAgent?.name ??
                                      t("admin.agentRuntime.unknownAgent")}
                                  </div>
                                  <div className="mt-1 text-sm leading-6 text-slate-500">
                                    {agentRun.launch_prompt?.trim().length
                                      ? agentRun.launch_prompt
                                      : t("agents.runs.noPrompt")}
                                  </div>
                                </div>
                                <Badge
                                  className="border-emerald-200 bg-emerald-50 text-emerald-700"
                                  variant="outline"
                                >
                                  {t(
                                    `agents.runs.statuses.${agentRun.run_status}`,
                                  )}
                                </Badge>
                              </div>
                              <div className="mt-3 flex flex-wrap gap-2">
                                <Badge
                                  className="border-slate-200 bg-white text-slate-700"
                                  variant="outline"
                                >
                                  {t(`agents.tools.${agentRun.target_surface}`)}
                                </Badge>
                                <Badge
                                  className="border-slate-200 bg-white text-slate-700"
                                  variant="outline"
                                >
                                  {formatAgentRunTriggerSourceLabel(
                                    agentRun.trigger_source,
                                    t,
                                  )}
                                </Badge>
                                <Badge
                                  className="border-slate-200 bg-white text-slate-700"
                                  variant="outline"
                                >
                                  {formatTimestamp(agentRun.created_at)}
                                </Badge>
                              </div>
                              {agentRun.navigation_href ? (
                                <div className="mt-4">
                                  <Button
                                    asChild
                                    className="bg-white"
                                    size="sm"
                                    type="button"
                                    variant="outline"
                                  >
                                    <a href={agentRun.navigation_href}>
                                      {t("agents.runs.openRoute")}
                                    </a>
                                  </Button>
                                </div>
                              ) : null}
                            </div>
                          );
                        })
                      ) : (
                        <div className="rounded-[20px] border border-dashed border-slate-200 bg-slate-50/80 px-5 py-8 text-sm text-slate-500">
                          {t("admin.agentRuntime.empty")}
                        </div>
                      )}
                    </div>
                  </div>
                </ConsoleSurface>
              ) : null}

              {showAdvancedAdminSections && adminSection === "overview" ? (
                <ConsoleSurface>
                  <ConsoleSurfaceHeader
                    action={
                      <Button
                        asChild
                        className="bg-white"
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        <Link
                          href={
                            workflowSignals.highestPressureTenant
                              ?.overviewHref ??
                            buildOperationsHref({
                              tenantId:
                                selectedTenantId === "all"
                                  ? null
                                  : selectedTenantId,
                              lane: "overview",
                              status: "all",
                            })
                          }
                        >
                          {t("admin.workflowRuntime.openOperations")}
                        </Link>
                      </Button>
                    }
                    description={t("admin.workflowRuntime.description")}
                    title={t("admin.workflowRuntime.title")}
                  />
                  <div className="grid gap-4 p-6 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                        {t("admin.workflowRuntime.metrics.failed")}
                      </div>
                      <div className="mt-2 text-2xl font-semibold text-slate-950">
                        {scopedRecoveryRunCount}
                      </div>
                      <div className="mt-1 text-sm text-slate-500">
                        {t("admin.workflowRuntime.metrics.failedHint")}
                      </div>
                    </div>
                    <div className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                        {t("admin.workflowRuntime.metrics.queued")}
                      </div>
                      <div className="mt-2 text-2xl font-semibold text-slate-950">
                        {scopedWorkflowMetrics.queued_runs}
                      </div>
                      <div className="mt-1 text-sm text-slate-500">
                        {t("admin.workflowRuntime.metrics.queuedHint")}
                      </div>
                    </div>
                    <div className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                        {t("admin.workflowRuntime.metrics.running")}
                      </div>
                      <div className="mt-2 text-2xl font-semibold text-slate-950">
                        {scopedWorkflowMetrics.running_runs}
                      </div>
                      <div className="mt-1 text-sm text-slate-500">
                        {t("admin.workflowRuntime.metrics.runningHint")}
                      </div>
                    </div>
                    <div className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                        {t("admin.workflowRuntime.metrics.retries")}
                      </div>
                      <div className="mt-2 text-2xl font-semibold text-slate-950">
                        {scopedWorkflowMetrics.retry_runs}
                      </div>
                      <div className="mt-1 text-sm text-slate-500">
                        {t("admin.workflowRuntime.metrics.retriesHint")}
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-4 border-t border-slate-100 p-6 xl:grid-cols-2">
                    <div className="space-y-3">
                      <div className="text-sm font-semibold text-slate-950">
                        {t("admin.workflowRuntime.pressureSignals")}
                      </div>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-4">
                          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                            {t("admin.workflowRuntime.tenantsWithFailures")}
                          </div>
                          <div className="mt-2 text-2xl font-semibold text-slate-950">
                            {workflowSignals.tenantsWithFailures}
                          </div>
                        </div>
                        <div className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-4">
                          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                            {t(
                              "admin.workflowRuntime.tenantsWithQueuePressure",
                            )}
                          </div>
                          <div className="mt-2 text-2xl font-semibold text-slate-950">
                            {workflowSignals.tenantsWithQueuePressure}
                          </div>
                        </div>
                        <div className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-4">
                          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                            {t("admin.workflowRuntime.tenantsWithRetries")}
                          </div>
                          <div className="mt-2 text-2xl font-semibold text-slate-950">
                            {workflowSignals.tenantsWithRetries}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="text-sm font-semibold text-slate-950">
                        {t("admin.workflowRuntime.tenantBreakdown")}
                      </div>
                      {tenantWorkflowActivity.slice(0, 4).map((item) => (
                        <div
                          className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-4"
                          key={item.tenant.id}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-base font-semibold text-slate-900">
                                {item.tenant.name}
                              </div>
                              <div className="mt-1 text-sm text-slate-500">
                                {item.tenant.slug}
                              </div>
                            </div>
                            <Badge
                              className="border-slate-200 bg-white text-slate-700"
                              variant="outline"
                            >
                              {t("admin.workflowRuntime.failedRunCount", {
                                count: String(item.recoveryPressure),
                              })}
                            </Badge>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Badge
                              className="border-slate-200 bg-white text-slate-700"
                              variant="outline"
                            >
                              {t("admin.workflowRuntime.queuePressureCount", {
                                count: String(item.queuePressure),
                              })}
                            </Badge>
                            <Badge
                              className="border-slate-200 bg-white text-slate-700"
                              variant="outline"
                            >
                              {t("admin.workflowRuntime.retryRunCount", {
                                count: String(item.metrics.retry_runs),
                              })}
                            </Badge>
                          </div>
                          <div className="mt-4 flex flex-wrap gap-2">
                            <Button
                              asChild
                              className="bg-white"
                              size="sm"
                              type="button"
                              variant="outline"
                            >
                              <Link href={item.failedHref}>
                                {t("admin.workflowRuntime.openFailedLane")}
                              </Link>
                            </Button>
                            <Button
                              asChild
                              className="bg-white"
                              size="sm"
                              type="button"
                              variant="outline"
                            >
                              <Link href={item.queueHref}>
                                {t("admin.workflowRuntime.openQueueLane")}
                              </Link>
                            </Button>
                            <Button
                              asChild
                              className="bg-white"
                              size="sm"
                              type="button"
                              variant="outline"
                            >
                              <Link href={item.workspaceWorkflowHref}>
                                {t("admin.workflowRuntime.openWorkflowSurface")}
                              </Link>
                            </Button>
                          </div>
                        </div>
                      ))}
                      {!isLoading && tenantWorkflowActivity.length === 0 ? (
                        <div className="rounded-[20px] border border-dashed border-slate-200 bg-slate-50/80 px-5 py-8 text-sm text-slate-500">
                          {t("admin.workflowRuntime.noTenantPressure")}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </ConsoleSurface>
              ) : null}

              {showAdvancedAdminSections && adminSection === "overview" ? (
                <ConsoleSurface>
                  <ConsoleSurfaceHeader
                    action={
                      <Button
                        asChild
                        className="bg-white"
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        <Link
                          href={
                            documentSignals.highestPressureTenant
                              ?.documentsHref ??
                            buildAdminWorkspaceHref("overview", {
                              view: "documents",
                              tenantId:
                                selectedTenantId === "all"
                                  ? null
                                  : selectedTenantId,
                              workspaceId: scopedPrimaryWorkspace?.id ?? null,
                              knowledgeBaseId:
                                scopedPrimaryKnowledgeBase?.id ?? null,
                            })
                          }
                        >
                          {t("admin.documentRuntime.openDocuments")}
                        </Link>
                      </Button>
                    }
                    description={t("admin.documentRuntime.description")}
                    title={t("admin.documentRuntime.title")}
                  />
                  <div className="grid gap-4 p-6 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                        {t("admin.documentRuntime.metrics.failed")}
                      </div>
                      <div className="mt-2 text-2xl font-semibold text-slate-950">
                        {scopedDocumentMetrics.failed_documents}
                      </div>
                      <div className="mt-1 text-sm text-slate-500">
                        {t("admin.documentRuntime.metrics.failedHint")}
                      </div>
                    </div>
                    <div className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                        {t("admin.documentRuntime.metrics.active")}
                      </div>
                      <div className="mt-2 text-2xl font-semibold text-slate-950">
                        {scopedDocumentMetrics.active_documents}
                      </div>
                      <div className="mt-1 text-sm text-slate-500">
                        {t("admin.documentRuntime.metrics.activeHint")}
                      </div>
                    </div>
                    <div className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                        {t("admin.documentRuntime.metrics.completed")}
                      </div>
                      <div className="mt-2 text-2xl font-semibold text-slate-950">
                        {scopedDocumentMetrics.completed_documents}
                      </div>
                      <div className="mt-1 text-sm text-slate-500">
                        {t("admin.documentRuntime.metrics.completedHint")}
                      </div>
                    </div>
                    <div className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                        {t("admin.documentRuntime.metrics.total")}
                      </div>
                      <div className="mt-2 text-2xl font-semibold text-slate-950">
                        {scopedDocumentMetrics.total_documents}
                      </div>
                      <div className="mt-1 text-sm text-slate-500">
                        {t("admin.documentRuntime.metrics.totalHint")}
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-4 border-t border-slate-100 p-6 xl:grid-cols-2">
                    <div className="space-y-3">
                      <div className="text-sm font-semibold text-slate-950">
                        {t("admin.documentRuntime.pressureSignals")}
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-4">
                          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                            {t("admin.documentRuntime.tenantsWithFailures")}
                          </div>
                          <div className="mt-2 text-2xl font-semibold text-slate-950">
                            {documentSignals.tenantsWithFailedDocuments}
                          </div>
                        </div>
                        <div className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-4">
                          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                            {t("admin.documentRuntime.tenantsWithActiveIntake")}
                          </div>
                          <div className="mt-2 text-2xl font-semibold text-slate-950">
                            {documentSignals.tenantsWithActiveIntake}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="text-sm font-semibold text-slate-950">
                        {t("admin.documentRuntime.tenantBreakdown")}
                      </div>
                      {tenantDocumentActivity.slice(0, 4).map((item) => (
                        <div
                          className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-4"
                          key={item.tenant.id}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-base font-semibold text-slate-900">
                                {item.tenant.name}
                              </div>
                              <div className="mt-1 text-sm text-slate-500">
                                {item.tenant.slug}
                              </div>
                            </div>
                            <Badge
                              className="border-slate-200 bg-white text-slate-700"
                              variant="outline"
                            >
                              {t("admin.documentRuntime.failedDocumentCount", {
                                count: String(item.metrics.failed_documents),
                              })}
                            </Badge>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Badge
                              className="border-slate-200 bg-white text-slate-700"
                              variant="outline"
                            >
                              {t("admin.documentRuntime.activeDocumentCount", {
                                count: String(item.metrics.active_documents),
                              })}
                            </Badge>
                            <Badge
                              className="border-slate-200 bg-white text-slate-700"
                              variant="outline"
                            >
                              {t("admin.documentRuntime.knowledgeBaseCount", {
                                count: String(item.knowledgeBaseCount),
                              })}
                            </Badge>
                          </div>
                          <div className="mt-4 flex flex-wrap gap-2">
                            <Button
                              asChild
                              className="bg-white"
                              size="sm"
                              type="button"
                              variant="outline"
                            >
                              <Link href={item.failedDocumentsHref}>
                                {t("admin.documentRuntime.openFailedDocuments")}
                              </Link>
                            </Button>
                            <Button
                              asChild
                              className="bg-white"
                              size="sm"
                              type="button"
                              variant="outline"
                            >
                              <Link href={item.documentsHref}>
                                {t("admin.documentRuntime.openDocuments")}
                              </Link>
                            </Button>
                            <Button
                              asChild
                              className="bg-white"
                              size="sm"
                              type="button"
                              variant="outline"
                            >
                              <Link href={item.operationsHref}>
                                {t("admin.documentRuntime.openOperations")}
                              </Link>
                            </Button>
                          </div>
                        </div>
                      ))}
                      {!isLoading && tenantDocumentActivity.length === 0 ? (
                        <div className="rounded-[20px] border border-dashed border-slate-200 bg-slate-50/80 px-5 py-8 text-sm text-slate-500">
                          {t("admin.documentRuntime.noTenantPressure")}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </ConsoleSurface>
              ) : null}

              {showAdvancedAdminSections && adminSection === "overview" ? (
                <ConsoleSurface>
                  <ConsoleSurfaceHeader
                    description={t("admin.chatScope.description")}
                    title={t("admin.chatScope.title")}
                  />
                  <div className="space-y-3 px-6 py-5">
                    <div className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                        {t("admin.chatScope.conversations")}
                      </div>
                      <div className="mt-2 text-2xl font-semibold text-slate-950">
                        {scopedConversationMetrics.total_conversations}
                      </div>
                      <div className="mt-1 text-sm text-slate-500">
                        {t("admin.chatScope.activeConversationThreads", {
                          count: String(
                            scopedConversationMetrics.active_conversations,
                          ),
                        })}
                      </div>
                    </div>
                    <div className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                        {t("admin.chatScope.messages")}
                      </div>
                      <div className="mt-2 text-2xl font-semibold text-slate-950">
                        {scopedConversationMetrics.total_messages}
                      </div>
                      <div className="mt-1 text-sm text-slate-500">
                        {scopedConversationMetrics.latest_activity_at
                          ? t("admin.chatScope.latestActivity", {
                              value: formatTimestamp(
                                scopedConversationMetrics.latest_activity_at,
                              ),
                            })
                          : t("admin.chatScope.noChatActivity")}
                      </div>
                    </div>
                    <Button
                      asChild
                      className="w-full bg-white"
                      type="button"
                      variant="outline"
                    >
                      <Link href={chatScopeHref}>
                        {t("admin.chatScope.openScopedChatWorkspace")}
                      </Link>
                    </Button>
                  </div>
                </ConsoleSurface>
              ) : null}

              {showAdvancedAdminSections && adminSection === "overview" ? (
                <ConsoleSurface>
                  <ConsoleSurfaceHeader
                    description={t("admin.tenantChat.description")}
                    title={t("admin.tenantChat.title")}
                  />
                  <div className="space-y-3 px-6 py-5">
                    {tenantChatActivity.slice(0, 6).map((item) => (
                      <div
                        className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-4"
                        key={item.tenant.id}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-base font-semibold text-slate-900">
                              {item.tenant.name}
                            </div>
                            <div className="mt-1 text-sm text-slate-500">
                              {item.tenant.slug}
                            </div>
                          </div>
                          <Badge
                            className="border-slate-200 bg-white text-slate-700"
                            variant="outline"
                          >
                            {t("admin.tenantChat.messages", {
                              count: String(item.metrics.total_messages),
                            })}
                          </Badge>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                          <Badge
                            className="border-slate-200 bg-white text-slate-700"
                            variant="outline"
                          >
                            {t("admin.tenantChat.conversations", {
                              count: String(item.metrics.total_conversations),
                            })}
                          </Badge>
                          <Badge
                            className="border-slate-200 bg-white text-slate-700"
                            variant="outline"
                          >
                            {t("admin.tenantChat.active", {
                              count: String(item.metrics.active_conversations),
                            })}
                          </Badge>
                          <Badge
                            className="border-slate-200 bg-white text-slate-700"
                            variant="outline"
                          >
                            {t("admin.tenantChat.workspaces", {
                              count: String(item.workspaceCount),
                            })}
                          </Badge>
                        </div>
                        <div className="mt-3 text-sm text-slate-500">
                          {item.metrics.latest_activity_at
                            ? t("admin.tenantChat.latestActivity", {
                                value: formatTimestamp(
                                  item.metrics.latest_activity_at,
                                ),
                              })
                            : t("admin.tenantChat.noChatActivity")}
                        </div>
                        <div className="mt-4">
                          <div className="flex flex-wrap gap-2">
                            <Button
                              asChild
                              className="bg-white"
                              size="sm"
                              type="button"
                              variant="outline"
                            >
                              <Link href={item.openHref}>
                                {t("admin.tenantChat.openTenantChat")}
                              </Link>
                            </Button>
                            <Button
                              asChild
                              className="bg-white"
                              size="sm"
                              type="button"
                              variant="outline"
                            >
                              <Link href={item.documentsHref}>
                                {t("shell.nav.documents")}
                              </Link>
                            </Button>
                            <Button
                              asChild
                              className="bg-white"
                              size="sm"
                              type="button"
                              variant="outline"
                            >
                              <Link href={item.workflowsHref}>
                                {t("shell.userMenu.operations")}
                              </Link>
                            </Button>
                            <Button
                              asChild
                              className="bg-white"
                              size="sm"
                              type="button"
                              variant="outline"
                            >
                              <Link href={item.failedDocumentsHref}>
                                {t("admin.tenantChat.failedDocs")}
                              </Link>
                            </Button>
                            <Button
                              asChild
                              className="bg-white"
                              size="sm"
                              type="button"
                              variant="outline"
                            >
                              <Link href={item.failedWorkflowsHref}>
                                {t("admin.tenantChat.failedWorkflows")}
                              </Link>
                            </Button>
                            <Button
                              asChild
                              className="bg-white"
                              size="sm"
                              type="button"
                              variant="outline"
                            >
                              <Link href={item.governanceHref}>
                                {t("admin.tenantChat.governance")}
                              </Link>
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                    {!isLoading && tenantChatActivity.length === 0 ? (
                      <div className="text-sm text-slate-500">
                        {t("admin.tenantChat.noTenantActivity")}
                      </div>
                    ) : null}
                  </div>
                </ConsoleSurface>
              ) : null}

              {showAdvancedAdminSections && adminSection === "overview" ? (
                <ConsoleSurface>
                  <ConsoleSurfaceHeader
                    description={t("admin.executionPackets.description")}
                    title={t("admin.executionPackets.title")}
                  />
                  <div className="grid gap-4 px-6 py-5 xl:grid-cols-2">
                    {adminExecutionPackets.map((item) => (
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
                            ? t("admin.watchlist.attention")
                            : item.status === "review"
                              ? t("admin.watchlist.review")
                              : t("admin.watchlist.healthy")
                        }
                        title={item.title}
                      />
                    ))}
                  </div>
                </ConsoleSurface>
              ) : null}

              {showAdvancedAdminSections && adminSection === "overview" ? (
                <ConsoleSurface>
                  <ConsoleSurfaceHeader
                    description={t("admin.chatSignals.description")}
                    title={t("admin.chatSignals.title")}
                  />
                  <div className="space-y-3 px-6 py-5">
                    <div className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                        {t("admin.chatSignals.mostActiveTenant")}
                      </div>
                      <div className="mt-2 text-base font-semibold text-slate-900">
                        {chatSignals.activeTenant?.tenant.name ??
                          t("admin.chatSignals.noTenantActivity")}
                      </div>
                      <div className="mt-1 text-sm text-slate-500">
                        {chatSignals.activeTenant
                          ? t("admin.chatSignals.activeTenantDetail", {
                              conversationCount: String(
                                chatSignals.activeTenant.metrics
                                  .total_conversations,
                              ),
                              messageCount: String(
                                chatSignals.activeTenant.metrics.total_messages,
                              ),
                            })
                          : t("admin.chatSignals.noPersistedMessages")}
                      </div>
                      <div className="mt-3">
                        <Button
                          asChild
                          className="bg-white"
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          <Link
                            href={
                              chatSignals.activeTenant?.openHref ??
                              chatScopeHref
                            }
                          >
                            {t("admin.chatSignals.openTenantChat")}
                          </Link>
                        </Button>
                      </div>
                    </div>
                    <div className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                        {t("admin.chatSignals.staleChatTenants")}
                      </div>
                      <div className="mt-2 text-2xl font-semibold text-slate-950">
                        {chatSignals.staleTenantCount}
                      </div>
                      <div className="mt-1 text-sm text-slate-500">
                        {t("admin.chatSignals.staleChatDetail")}
                      </div>
                      <div className="mt-3">
                        <Button
                          asChild
                          className="bg-white"
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          <Link href={staleChatScopeHref}>
                            {t("admin.chatSignals.reviewChatScope")}
                          </Link>
                        </Button>
                      </div>
                    </div>
                    <div className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                        {t("admin.chatSignals.idleConversationScope")}
                      </div>
                      <div className="mt-2 text-2xl font-semibold text-slate-950">
                        {chatSignals.idleConversationTenantCount}
                      </div>
                      <div className="mt-1 text-sm text-slate-500">
                        {t("admin.chatSignals.idleConversationDetail")}
                      </div>
                      <div className="mt-3">
                        <Button
                          asChild
                          className="bg-white"
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          <Link href={idleConversationScopeHref}>
                            {t("admin.chatSignals.inspectIdleScope")}
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                </ConsoleSurface>
              ) : null}

              {showAdvancedAdminSections && adminSection === "overview" ? (
                <ConsoleSurface>
                  <ConsoleSurfaceHeader
                    description={t("admin.watchlist.description")}
                    title={t("admin.watchlist.title")}
                  />
                  <div className="space-y-4 px-6 py-5">
                    {adminWatchItems.map((item) => (
                      <div
                        className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-5"
                        key={item.title}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-base font-semibold text-slate-900">
                            {item.title}
                          </div>
                          <Badge
                            className={cn(
                              "border",
                              getWatchStatusClass(item.status),
                            )}
                            variant="outline"
                          >
                            {item.status === "attention"
                              ? t("admin.watchlist.attention")
                              : item.status === "review"
                                ? t("admin.watchlist.review")
                                : t("admin.watchlist.healthy")}
                          </Badge>
                        </div>
                        <div className="mt-3 text-sm leading-6 text-slate-500">
                          {item.detail}
                        </div>
                        {item.actionHref && item.actionLabel ? (
                          <div className="mt-4">
                            <Button
                              asChild
                              className="bg-white"
                              size="sm"
                              type="button"
                              variant="outline"
                            >
                              <Link href={item.actionHref}>
                                {item.actionLabel}
                              </Link>
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </ConsoleSurface>
              ) : null}
            </div>

            {managementPanel === "tenant-create" ? (
              <AdminManagementDialog
                description={t(
                  "workspace.sidebar.modal.tenantCreateDescription",
                )}
                eyebrow={t("admin.title")}
                onClose={() => setManagementPanel(null)}
                title={t("workspace.sidebar.modal.tenantCreateTitle")}
              >
                <DialogFormLayout>
                  <DialogFormGrid className="xl:grid-cols-3">
                    <AdminManagementField
                      className="xl:col-span-2"
                      hint={t("workspace.sidebar.modal.tenantSlugHint")}
                      label={t("workspace.sidebar.modal.tenantName")}
                    >
                      <Input
                        onChange={(event) => {
                          const nextName = event.target.value;
                          setCreateTenantName(nextName);
                          if (!createTenantSlug.trim()) {
                            setCreateTenantSlug(slugifyValue(nextName));
                          }
                        }}
                        placeholder={t(
                          "workspace.sidebar.modal.tenantNamePlaceholder",
                        )}
                        value={createTenantName}
                      />
                    </AdminManagementField>

                    <AdminManagementField
                      label={t("workspace.sidebar.modal.tenantSlug")}
                    >
                      <Input
                        onChange={(event) =>
                          setCreateTenantSlug(slugifyValue(event.target.value))
                        }
                        placeholder={t(
                          "workspace.sidebar.modal.tenantSlugPlaceholder",
                        )}
                        value={createTenantSlug}
                      />
                    </AdminManagementField>
                  </DialogFormGrid>

                  <DialogFormActions>
                    <Button
                      onClick={() => setManagementPanel(null)}
                      type="button"
                      variant="outline"
                    >
                      {t("workspace.sidebar.modal.cancel")}
                    </Button>
                    <Button
                      disabled={
                        !createTenantName.trim() ||
                        !createTenantSlug.trim() ||
                        isCreatingResource
                      }
                      onClick={handleCreateTenant}
                      type="button"
                    >
                      {isCreatingResource
                        ? t("workspace.sidebar.modal.creating")
                        : t("workspace.sidebar.modal.createTenant")}
                    </Button>
                  </DialogFormActions>
                </DialogFormLayout>
              </AdminManagementDialog>
            ) : null}

            {managementPanel === "user-create" ? (
              <AdminManagementDialog
                description={t("admin.members.createDescription")}
                eyebrow={t("admin.title")}
                onClose={() => setManagementPanel(null)}
                title={t("admin.members.createTitle")}
              >
                <DialogFormLayout>
                  <DialogFormGrid className="xl:grid-cols-3">
                    <AdminManagementField
                      label={t("admin.members.displayName")}
                    >
                      <Input
                        onChange={(event) =>
                          setCreateUserDisplayName(event.target.value)
                        }
                        placeholder={t("admin.members.displayNamePlaceholder")}
                        value={createUserDisplayName}
                      />
                    </AdminManagementField>

                    <AdminManagementField
                      className="xl:col-span-2"
                      label={t("admin.members.email")}
                    >
                      <Input
                        onChange={(event) =>
                          setCreateUserEmail(event.target.value)
                        }
                        placeholder={t("admin.members.emailPlaceholder")}
                        type="email"
                        value={createUserEmail}
                      />
                    </AdminManagementField>
                  </DialogFormGrid>

                  <DialogFormGrid className="lg:grid-cols-3">
                    <AdminManagementField label={t("admin.members.role")}>
                      <Select
                        onValueChange={(value) =>
                          setCreateUserRole(
                            value as "super_admin" | "operator" | "reviewer",
                          )
                        }
                        value={createUserRole}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t("admin.members.role")} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="super_admin">
                            {t("auth.roles.superAdmin")}
                          </SelectItem>
                          <SelectItem value="operator">
                            {t("auth.roles.operator")}
                          </SelectItem>
                          <SelectItem value="reviewer">
                            {t("auth.roles.reviewer")}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </AdminManagementField>

                    <AdminManagementField
                      label={t("admin.members.initialTenant")}
                    >
                      <Select
                        onValueChange={setCreateUserTenantId}
                        value={createUserTenantId}
                      >
                        <SelectTrigger>
                          <SelectValue
                            placeholder={t("admin.members.initialTenant")}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">
                            {t("admin.members.noInitialTenant")}
                          </SelectItem>
                          {tenants.map((tenant) => (
                            <SelectItem key={tenant.id} value={tenant.id}>
                              {tenant.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </AdminManagementField>

                    <AdminManagementField
                      label={t("admin.members.initialMembershipStatus")}
                    >
                      <Select
                        onValueChange={(value) =>
                          setCreateUserMembershipStatus(
                            value as "active" | "invited" | "suspended",
                          )
                        }
                        value={createUserMembershipStatus}
                      >
                        <SelectTrigger>
                          <SelectValue
                            placeholder={t(
                              "admin.members.initialMembershipStatus",
                            )}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">
                            {t("admin.members.activeMembership")}
                          </SelectItem>
                          <SelectItem value="invited">
                            {t("admin.members.invitedMembership")}
                          </SelectItem>
                          <SelectItem value="suspended">
                            {t("admin.members.suspendedMembership")}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </AdminManagementField>
                  </DialogFormGrid>

                  <DialogFormActions>
                    <Button
                      onClick={() => setManagementPanel(null)}
                      type="button"
                      variant="outline"
                    >
                      {t("workspace.sidebar.modal.cancel")}
                    </Button>
                    <Button
                      disabled={
                        !createUserDisplayName.trim() ||
                        !createUserEmail.trim() ||
                        isCreatingResource
                      }
                      onClick={handleCreateUser}
                      type="button"
                    >
                      {isCreatingResource
                        ? t("workspace.sidebar.modal.creating")
                        : t("admin.actions.createMember")}
                    </Button>
                  </DialogFormActions>
                </DialogFormLayout>
              </AdminManagementDialog>
            ) : null}

            {managementPanel === "user-edit" ? (
              <AdminManagementDialog
                description={t("admin.members.editDescription")}
                eyebrow={t("admin.title")}
                onClose={() => setManagementPanel(null)}
                title={t("admin.members.editTitle")}
              >
                <DialogFormLayout>
                  <DialogFormGrid className="xl:grid-cols-3">
                    <AdminManagementField
                      label={t("admin.members.displayName")}
                    >
                      <Input
                        onChange={(event) =>
                          setEditUserDisplayName(event.target.value)
                        }
                        placeholder={t("admin.members.displayNamePlaceholder")}
                        value={editUserDisplayName}
                      />
                    </AdminManagementField>

                    <AdminManagementField
                      className="xl:col-span-2"
                      label={t("admin.members.email")}
                    >
                      <Input
                        onChange={(event) =>
                          setEditUserEmail(event.target.value)
                        }
                        placeholder={t("admin.members.emailPlaceholder")}
                        type="email"
                        value={editUserEmail}
                      />
                    </AdminManagementField>
                  </DialogFormGrid>

                  <DialogFormGrid>
                    <AdminManagementField label={t("admin.members.role")}>
                      <Select
                        onValueChange={(value) =>
                          setEditUserRole(
                            value as "super_admin" | "operator" | "reviewer",
                          )
                        }
                        value={editUserRole}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t("admin.members.role")} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="super_admin">
                            {t("auth.roles.superAdmin")}
                          </SelectItem>
                          <SelectItem value="operator">
                            {t("auth.roles.operator")}
                          </SelectItem>
                          <SelectItem value="reviewer">
                            {t("auth.roles.reviewer")}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </AdminManagementField>

                    <AdminManagementField
                      label={t("admin.members.accountFilter")}
                    >
                      <Select
                        onValueChange={(value) =>
                          setEditUserIsActive(value as "active" | "inactive")
                        }
                        value={editUserIsActive}
                      >
                        <SelectTrigger>
                          <SelectValue
                            placeholder={t("admin.members.accountFilter")}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">
                            {t("admin.members.activeAccount")}
                          </SelectItem>
                          <SelectItem value="inactive">
                            {t("admin.members.inactiveAccount")}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </AdminManagementField>
                  </DialogFormGrid>

                  <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                    <div className="space-y-1">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                        {t("admin.members.accessPostureTitle")}
                      </div>
                      <div className="text-sm text-slate-600">
                        {t("admin.members.accessPostureDescription")}
                      </div>
                    </div>

                    {editingUserAccessSummary ? (
                      <>
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                              {t("settings.activity.latestEvent")}
                            </div>
                            <div className="mt-2 text-sm font-semibold text-slate-950">
                              {editingUserAccessSummary.latest_event_type
                                ? getAccessEventLabel(
                                    editingUserAccessSummary.latest_event_type,
                                    t,
                                  )
                                : t("settings.activity.empty")}
                            </div>
                            <div className="mt-2 text-sm text-slate-500">
                              {editingUserAccessSummary.latest_event_at
                                ? formatTimestamp(
                                    editingUserAccessSummary.latest_event_at,
                                  )
                                : t("settings.activity.notAvailable")}
                            </div>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                              {t("settings.activity.lastSignIn")}
                            </div>
                            <div className="mt-2 text-sm font-semibold text-slate-950">
                              {editingUserAccessSummary.recent_sign_in_events >
                              0
                                ? t("settings.activity.loadedLoginEvents", {
                                    count:
                                      editingUserAccessSummary.recent_sign_in_events,
                                  })
                                : t("settings.activity.noLoginEvents")}
                            </div>
                            <div className="mt-2 text-sm text-slate-500">
                              {editingUserAccessSummary.total_audit_events}{" "}
                              {t("admin.members.auditEventsSuffix")}
                            </div>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                              {t("settings.posture.recentFailedSignIns")}
                            </div>
                            <div className="mt-2 text-2xl font-semibold text-slate-950">
                              {
                                editingUserAccessSummary.recent_failed_sign_in_events
                              }
                            </div>
                            <div className="mt-2 text-sm text-slate-500">
                              {t("settings.posture.recentFailedSignInsHint")}
                            </div>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                              {t("settings.sessions.summary.total")}
                            </div>
                            <div className="mt-2 text-2xl font-semibold text-slate-950">
                              {editingUserAccessSummary.active_sessions}
                            </div>
                            <div className="mt-2 text-sm text-slate-500">
                              {t("admin.members.sessionsExpiringHint", {
                                count: String(
                                  editingUserAccessSummary.sessions_expiring_within_24_hours,
                                ),
                              })}
                            </div>
                          </div>
                        </div>

                        {editingUserAccessSummary.review_items.filter(
                          (item) =>
                            item.severity !== "healthy" && item.item_count > 0,
                        ).length > 0 ? (
                          <div className="grid gap-3 md:grid-cols-2">
                            {editingUserAccessSummary.review_items
                              .filter(
                                (item) =>
                                  item.severity !== "healthy" &&
                                  item.item_count > 0,
                              )
                              .map((item) => (
                                <div
                                  className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3"
                                  key={`${editingUserAccessSummary.latest_event_at ?? "none"}-${item.category}`}
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="text-sm font-semibold text-slate-950">
                                      {item.category === "expired_invitations"
                                        ? t(
                                            "admin.securityWatch.expiredInvitations",
                                          )
                                        : item.category ===
                                            "expiring_invitations"
                                          ? t(
                                              "admin.securityWatch.expiringInvitations",
                                            )
                                          : item.category ===
                                              "failed_sign_in_pressure"
                                            ? t(
                                                "admin.securityWatch.failedSignInPressure",
                                              )
                                            : item.category ===
                                                "invitation_activation_pressure"
                                              ? t(
                                                  "admin.securityWatch.invitationActivationPressure",
                                                )
                                              : t(
                                                  "admin.securityWatch.sessionSpreadPressure",
                                                )}
                                    </div>
                                    <Badge
                                      className={
                                        item.severity === "attention"
                                          ? "border-rose-200 bg-rose-50 text-rose-700"
                                          : "border-amber-200 bg-amber-50 text-amber-700"
                                      }
                                      variant="outline"
                                    >
                                      {item.item_count}
                                    </Badge>
                                  </div>
                                  <div className="mt-2 text-sm leading-6 text-slate-600">
                                    {item.category === "expired_invitations"
                                      ? t(
                                          "admin.securityWatch.expiredInvitationsDetail",
                                          { count: String(item.item_count) },
                                        )
                                      : item.category === "expiring_invitations"
                                        ? t(
                                            "admin.securityWatch.expiringInvitationsDetail",
                                            { count: String(item.item_count) },
                                          )
                                        : item.category ===
                                            "failed_sign_in_pressure"
                                          ? editingUserAccessSummary.sign_in_lockout_expires_at
                                            ? `${t("admin.securityWatch.failedSignInPressureDetail", { count: String(item.item_count) })} ${formatTimestamp(editingUserAccessSummary.sign_in_lockout_expires_at)}`
                                            : t(
                                                "admin.securityWatch.failedSignInPressureDetail",
                                                {
                                                  count: String(
                                                    item.item_count,
                                                  ),
                                                },
                                              )
                                          : item.category ===
                                              "invitation_activation_pressure"
                                            ? t(
                                                "admin.securityWatch.invitationActivationPressureDetail",
                                                {
                                                  count: String(
                                                    item.item_count,
                                                  ),
                                                },
                                              )
                                            : t(
                                                "admin.securityWatch.sessionSpreadPressureDetail",
                                                {
                                                  count: String(
                                                    item.item_count,
                                                  ),
                                                },
                                              )}
                                  </div>
                                </div>
                              ))}
                          </div>
                        ) : null}

                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                              {t("settings.posture.activeMemberships")}
                            </div>
                            <div className="mt-2 text-2xl font-semibold text-slate-950">
                              {editingUserAccessSummary.active_memberships}
                            </div>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                              {t("settings.posture.invitedMemberships")}
                            </div>
                            <div className="mt-2 text-2xl font-semibold text-slate-950">
                              {editingUserAccessSummary.invited_memberships}
                            </div>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                              {t("settings.posture.expiringInvitations")}
                            </div>
                            <div className="mt-2 text-2xl font-semibold text-slate-950">
                              {editingUserAccessSummary.expiring_invitations +
                                editingUserAccessSummary.expired_invitations}
                            </div>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                              {t("settings.posture.sensitiveEvents")}
                            </div>
                            <div className="mt-2 text-2xl font-semibold text-slate-950">
                              {editingUserAccessSummary.sensitive_audit_events}
                            </div>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                              {t("admin.securityWatch.failedSignInPressure")}
                            </div>
                            <div className="mt-2 text-sm font-semibold text-slate-950">
                              {editingUserAccessSummary.sign_in_lockout_active
                                ? t("settings.fields.membershipAccessBlocked")
                                : t("settings.fields.membershipAccessReady")}
                            </div>
                            <div className="mt-2 text-sm text-slate-500">
                              {editingUserAccessSummary.sign_in_lockout_active &&
                              editingUserAccessSummary.sign_in_lockout_expires_at
                                ? formatTimestamp(
                                    editingUserAccessSummary.sign_in_lockout_expires_at,
                                  )
                                : t(
                                    "admin.securityWatch.failedSignInPressureHealthy",
                                  )}
                            </div>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                              {t("admin.securityWatch.sessionSpreadPressure")}
                            </div>
                            <div className="mt-2 text-sm font-semibold text-slate-950">
                              {editingUserAccessSummary.session_spread_detected
                                ? t("settings.fields.membershipAccessBlocked")
                                : t("settings.fields.membershipAccessReady")}
                            </div>
                            <div className="mt-2 text-sm text-slate-500">
                              {editingUserAccessSummary.session_spread_detected
                                ? t(
                                    "admin.securityWatch.sessionSpreadPressureDetail",
                                    { count: "1" },
                                  )
                                : t(
                                    "admin.securityWatch.sessionSpreadPressureHealthy",
                                  )}
                            </div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-5 text-sm text-slate-500">
                        {t("admin.members.accessPostureEmpty")}
                      </div>
                    )}
                  </div>

                  <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-1">
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                          {t("admin.members.accessEventsTitle")}
                        </div>
                        <div className="text-sm text-slate-600">
                          {t("admin.members.accessEventsDescription")}
                        </div>
                      </div>
                      <Button
                        disabled={
                          !editingUserId || isLoadingEditingUserAccessEvents
                        }
                        onClick={() =>
                          editingUserId
                            ? void refreshEditingUserSessions(editingUserId)
                            : undefined
                        }
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        <RefreshCw
                          className={`mr-2 h-4 w-4 ${isLoadingEditingUserAccessEvents ? "animate-spin" : ""}`}
                        />
                        {isLoadingEditingUserAccessEvents
                          ? t("admin.actions.refreshingActivity")
                          : t("admin.actions.refreshActivity")}
                      </Button>
                    </div>

                    <div className="grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)]">
                      <div className="space-y-2">
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                          {t("admin.audit.filter")}
                        </div>
                        <Select
                          onValueChange={(value) =>
                            setEditingUserAccessEventFilter(
                              value as (typeof AUDIT_EVENT_FILTER_VALUES)[number],
                            )
                          }
                          value={editingUserAccessEventFilter}
                        >
                          <SelectTrigger className="rounded-xl border-slate-200 bg-white">
                            <SelectValue
                              placeholder={t("admin.audit.allEvents")}
                            />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">
                              {t("admin.audit.allEvents")}
                            </SelectItem>
                            <SelectItem value="sign_in_failed">
                              {t("admin.audit.eventTypes.signInFailed")}
                            </SelectItem>
                            <SelectItem value="sign_in_succeeded">
                              {t("admin.audit.eventTypes.signInSucceeded")}
                            </SelectItem>
                            <SelectItem value="invitation_activation_failed">
                              {t(
                                "admin.audit.eventTypes.invitationActivationFailed",
                              )}
                            </SelectItem>
                            <SelectItem value="sign_out_succeeded">
                              {t("admin.audit.eventTypes.signOutSucceeded")}
                            </SelectItem>
                            <SelectItem value="session_revoked">
                              {t("admin.audit.eventTypes.sessionRevoked")}
                            </SelectItem>
                            <SelectItem value="password_changed">
                              {t("admin.audit.eventTypes.passwordChanged")}
                            </SelectItem>
                            <SelectItem value="password_reset">
                              {t("admin.audit.eventTypes.passwordReset")}
                            </SelectItem>
                            <SelectItem value="invitation_issued">
                              {t("admin.audit.eventTypes.invitationIssued")}
                            </SelectItem>
                            <SelectItem value="invitation_activated">
                              {t("admin.audit.eventTypes.invitationActivated")}
                            </SelectItem>
                            <SelectItem value="invitation_revoked">
                              {t("admin.audit.eventTypes.invitationRevoked")}
                            </SelectItem>
                            <SelectItem value="membership_active">
                              {t("admin.audit.eventTypes.membershipActive")}
                            </SelectItem>
                            <SelectItem value="membership_suspended">
                              {t("admin.audit.eventTypes.membershipSuspended")}
                            </SelectItem>
                            <SelectItem value="membership_deleted">
                              {t("admin.audit.eventTypes.membershipDeleted")}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                          {t("admin.members.accessEventsSearch")}
                        </div>
                        <Input
                          className="rounded-xl border-slate-200 bg-white"
                          onChange={(event) =>
                            setEditingUserAccessSearchQuery(event.target.value)
                          }
                          placeholder={t(
                            "admin.members.accessEventsSearchPlaceholder",
                          )}
                          value={editingUserAccessSearchQuery}
                        />
                      </div>
                    </div>

                    {editingUserAccessEventsErrorMessage ? (
                      <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                        {editingUserAccessEventsErrorMessage}
                      </div>
                    ) : null}

                    {isLoadingEditingUserAccessEvents &&
                    editingUserAccessEvents.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-5 text-sm text-slate-500">
                        {t("admin.actions.refreshingActivity")}
                      </div>
                    ) : null}

                    {!isLoadingEditingUserAccessEvents &&
                    editingUserAccessEvents.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-5 text-sm text-slate-500">
                        {t("admin.members.accessEventsEmpty")}
                      </div>
                    ) : null}

                    {editingUserAccessEvents.length > 0 ? (
                      <div className="space-y-3">
                        {editingUserAccessEvents.map((event) => {
                          const reason =
                            typeof event.detail_json.reason === "string"
                              ? event.detail_json.reason
                              : null;
                          const loginMode =
                            typeof event.detail_json.login_mode === "string"
                              ? event.detail_json.login_mode
                              : null;
                          const sessionId =
                            typeof event.detail_json.session_id === "string"
                              ? event.detail_json.session_id
                              : null;

                          return (
                            <div
                              className="rounded-xl border border-slate-200 bg-white px-4 py-4"
                              key={event.id}
                            >
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div className="space-y-3">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Badge
                                      className="border-slate-200 bg-slate-50 text-slate-700"
                                      variant="outline"
                                    >
                                      {getAccessEventLabel(event.event_type, t)}
                                    </Badge>
                                    <Badge
                                      className="border-slate-200 bg-white text-slate-700"
                                      variant="outline"
                                    >
                                      {event.tenant_name ??
                                        t("settings.activity.noTenant")}
                                    </Badge>
                                  </div>

                                  <div className="grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                                    <div>
                                      <span className="font-medium text-slate-700">
                                        {t("admin.members.accessEventAt")}
                                      </span>
                                      <span className="ml-2">
                                        {formatTimestamp(event.created_at)}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="font-medium text-slate-700">
                                        {t("settings.activity.issuedBy")}
                                      </span>
                                      <span className="ml-2">
                                        {event.actor_display_name ??
                                          t("settings.activity.noActor")}
                                      </span>
                                    </div>
                                    {loginMode ? (
                                      <div>
                                        <span className="font-medium text-slate-700">
                                          {t("settings.activity.loginMode")}
                                        </span>
                                        <span className="ml-2">
                                          {formatAuthenticationModeLabel(
                                            loginMode,
                                            t,
                                          )}
                                        </span>
                                      </div>
                                    ) : null}
                                    {sessionId ? (
                                      <div className="sm:col-span-2">
                                        <span className="font-medium text-slate-700">
                                          {t("settings.activity.sessionId")}
                                        </span>
                                        <span className="ml-2 font-mono text-xs text-slate-500">
                                          {sessionId}
                                        </span>
                                      </div>
                                    ) : null}
                                    {reason ? (
                                      <div className="sm:col-span-2">
                                        <span className="font-medium text-slate-700">
                                          {t("admin.audit.reasonLabel")}
                                        </span>
                                        <span className="ml-2">{reason}</span>
                                      </div>
                                    ) : null}
                                  </div>
                                </div>
                                <div className="shrink-0 text-xs text-slate-400">
                                  {event.user_display_name}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>

                  <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-1">
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                          {t("admin.members.sessionsTitle")}
                        </div>
                        <div className="text-sm text-slate-600">
                          {t("admin.members.sessionsDescription")}
                        </div>
                      </div>
                      <Button
                        disabled={
                          !editingUserId || isLoadingEditingUserSessions
                        }
                        onClick={() => void handleRefreshEditingUserSessions()}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        <RefreshCw
                          className={`mr-2 h-4 w-4 ${isLoadingEditingUserSessions ? "animate-spin" : ""}`}
                        />
                        {isLoadingEditingUserSessions
                          ? t("admin.actions.refreshingSessions")
                          : t("admin.actions.refreshSessions")}
                      </Button>
                    </div>

                    {editingUserSessionsErrorMessage ? (
                      <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                        {editingUserSessionsErrorMessage}
                      </div>
                    ) : null}

                    {editingUserSessionSecuritySummary ? (
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
                        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                            {t("admin.members.sessionSummary.total")}
                          </div>
                          <div className="mt-2 text-2xl font-semibold text-slate-950">
                            {
                              editingUserSessionSecuritySummary.total_active_sessions
                            }
                          </div>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                            {t("admin.members.sessionSummary.other")}
                          </div>
                          <div className="mt-2 text-2xl font-semibold text-slate-950">
                            {
                              editingUserSessionSecuritySummary.other_active_sessions
                            }
                          </div>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                            {t("admin.members.sessionSummary.expiring")}
                          </div>
                          <div className="mt-2 text-2xl font-semibold text-slate-950">
                            {
                              editingUserSessionSecuritySummary.expires_within_24_hours
                            }
                          </div>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                            {t("admin.members.sessionSummary.currentExpiry")}
                          </div>
                          <div className="mt-2 text-sm font-semibold text-slate-950">
                            {editingUserSessionSecuritySummary.current_session_expires_at
                              ? formatTimestamp(
                                  editingUserSessionSecuritySummary.current_session_expires_at,
                                )
                              : t("admin.directory.notAvailable")}
                          </div>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                            {t("admin.members.sessionSummary.devices")}
                          </div>
                          <div className="mt-2 text-2xl font-semibold text-slate-950">
                            {
                              editingUserSessionSecuritySummary.distinct_device_count
                            }
                          </div>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                            {t("admin.members.sessionSummary.ips")}
                          </div>
                          <div className="mt-2 text-2xl font-semibold text-slate-950">
                            {
                              editingUserSessionSecuritySummary.distinct_ip_count
                            }
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {isLoadingEditingUserSessions &&
                    editingUserSessions.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-5 text-sm text-slate-500">
                        {t("admin.actions.refreshingSessions")}
                      </div>
                    ) : null}

                    {!isLoadingEditingUserSessions &&
                    editingUserSessions.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-5 text-sm text-slate-500">
                        {t("admin.members.sessionsEmpty")}
                      </div>
                    ) : null}

                    {editingUserSessions.length > 0 ? (
                      <div className="space-y-3">
                        {editingUserSessions.map((trackedSession) => (
                          <div
                            className="rounded-xl border border-slate-200 bg-white px-4 py-4"
                            key={trackedSession.id}
                          >
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div className="space-y-3">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge
                                    className={
                                      trackedSession.is_current
                                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                        : ""
                                    }
                                    variant={
                                      trackedSession.is_current
                                        ? "outline"
                                        : "secondary"
                                    }
                                  >
                                    {trackedSession.is_current
                                      ? t("admin.members.sessionsCurrent")
                                      : t("admin.members.sessionsOther")}
                                  </Badge>
                                  <Badge variant="outline">
                                    {formatAuthenticationModeLabel(
                                      trackedSession.authentication_mode,
                                      t,
                                    )}
                                  </Badge>
                                </div>
                                <div className="text-sm font-medium text-slate-900">
                                  {trackedSession.id}
                                </div>
                                <div className="grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                                  <div>
                                    <span className="font-medium text-slate-700">
                                      {t("admin.members.sessionsStartedAt")}
                                    </span>
                                    <span className="ml-2">
                                      {formatTimestamp(
                                        trackedSession.created_at,
                                      )}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="font-medium text-slate-700">
                                      {t("admin.members.sessionsExpiresAt")}
                                    </span>
                                    <span className="ml-2">
                                      {formatTimestamp(
                                        trackedSession.expires_at,
                                      )}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="font-medium text-slate-700">
                                      {t("admin.members.sessionsDeviceLabel")}
                                    </span>
                                    <span className="ml-2">
                                      {trackedSession.device_label ||
                                        t("admin.directory.notAvailable")}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="font-medium text-slate-700">
                                      {t("admin.members.sessionsIpAddress")}
                                    </span>
                                    <span className="ml-2">
                                      {trackedSession.ip_address ||
                                        t("admin.directory.notAvailable")}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <Button
                                disabled={
                                  trackedSession.is_current ||
                                  activeUserSessionActionId ===
                                    trackedSession.id
                                }
                                onClick={() =>
                                  void handleRevokeEditingUserSession(
                                    trackedSession.id,
                                  )
                                }
                                size="sm"
                                type="button"
                                variant="outline"
                              >
                                {activeUserSessionActionId === trackedSession.id
                                  ? t("admin.actions.revokingSession")
                                  : t("admin.actions.revokeSession")}
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  {directoryAuthMode?.supports_password_input ? (
                    <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                      <div className="space-y-1">
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                          {t("admin.members.passwordResetTitle")}
                        </div>
                        <div className="text-sm text-slate-600">
                          {t("admin.members.passwordResetDescription")}
                        </div>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <AdminManagementField
                          label={t("admin.members.passwordResetNewPassword")}
                        >
                          <Input
                            autoComplete="new-password"
                            onChange={(event) =>
                              setEditUserResetPassword(event.target.value)
                            }
                            placeholder={t(
                              "admin.members.passwordResetNewPasswordPlaceholder",
                            )}
                            type="password"
                            value={editUserResetPassword}
                          />
                        </AdminManagementField>
                        <AdminManagementField
                          label={t(
                            "admin.members.passwordResetConfirmPassword",
                          )}
                        >
                          <Input
                            autoComplete="new-password"
                            onChange={(event) =>
                              setEditUserResetPasswordConfirm(
                                event.target.value,
                              )
                            }
                            placeholder={t(
                              "admin.members.passwordResetConfirmPasswordPlaceholder",
                            )}
                            type="password"
                            value={editUserResetPasswordConfirm}
                          />
                        </AdminManagementField>
                      </div>
                      <AdminManagementField
                        label={t("admin.members.passwordResetReason")}
                      >
                        <Textarea
                          className="min-h-[88px] rounded-xl border-slate-200 bg-white"
                          onChange={(event) =>
                            setEditUserResetPasswordReason(event.target.value)
                          }
                          placeholder={t(
                            "admin.members.passwordResetReasonPlaceholder",
                          )}
                          value={editUserResetPasswordReason}
                        />
                      </AdminManagementField>
                      <div className="flex justify-end">
                        <Button
                          disabled={
                            isResettingEditingUserPassword ||
                            !editUserResetPassword.trim() ||
                            !editUserResetPasswordConfirm.trim()
                          }
                          onClick={() => void handleResetEditingUserPassword()}
                          type="button"
                          variant="outline"
                        >
                          {isResettingEditingUserPassword
                            ? t("admin.actions.resettingMemberPassword")
                            : t("admin.actions.resetMemberPassword")}
                        </Button>
                      </div>
                    </div>
                  ) : null}

                  <DialogFormActions>
                    <Button
                      onClick={() => setManagementPanel(null)}
                      type="button"
                      variant="outline"
                    >
                      {t("workspace.sidebar.modal.cancel")}
                    </Button>
                    <Button
                      disabled={
                        !editUserDisplayName.trim() ||
                        !editUserEmail.trim() ||
                        isUpdatingResource
                      }
                      onClick={() => void handleUpdateUser()}
                      type="button"
                    >
                      {isUpdatingResource
                        ? t("workspace.sidebar.modal.saving")
                        : t("admin.actions.saveMember")}
                    </Button>
                  </DialogFormActions>
                </DialogFormLayout>
              </AdminManagementDialog>
            ) : null}

            {managementPanel === "workspace-create" ? (
              <AdminManagementDialog
                description={t(
                  "workspace.sidebar.modal.workspaceCreateDescription",
                )}
                eyebrow={t("admin.title")}
                onClose={() => setManagementPanel(null)}
                title={t("workspace.sidebar.modal.workspaceCreateTitle")}
              >
                <DialogFormLayout>
                  <AdminManagementField
                    label={t("workspace.sidebar.sectionTenant")}
                  >
                    <Select
                      onValueChange={setCreateWorkspaceTenantId}
                      value={createWorkspaceTenantId}
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={t("workspace.sidebar.selectTenant")}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {tenants.map((tenant) => (
                          <SelectItem key={tenant.id} value={tenant.id}>
                            {tenant.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </AdminManagementField>

                  <DialogFormGrid className="xl:grid-cols-3">
                    <AdminManagementField
                      className="xl:col-span-2"
                      label={t("workspace.sidebar.modal.workspaceName")}
                    >
                      <Input
                        onChange={(event) => {
                          const nextName = event.target.value;
                          setCreateWorkspaceName(nextName);
                          if (!createWorkspaceSlug.trim()) {
                            setCreateWorkspaceSlug(slugifyValue(nextName));
                          }
                        }}
                        placeholder={t(
                          "workspace.sidebar.modal.workspaceNamePlaceholder",
                        )}
                        value={createWorkspaceName}
                      />
                    </AdminManagementField>

                    <AdminManagementField
                      hint={t("workspace.sidebar.modal.workspaceSlugHint")}
                      label={t("workspace.sidebar.modal.workspaceSlug")}
                    >
                      <Input
                        onChange={(event) =>
                          setCreateWorkspaceSlug(
                            slugifyValue(event.target.value),
                          )
                        }
                        placeholder={t(
                          "workspace.sidebar.modal.workspaceSlugPlaceholder",
                        )}
                        value={createWorkspaceSlug}
                      />
                    </AdminManagementField>
                  </DialogFormGrid>

                  <AdminManagementField
                    hint={t("workspace.sidebar.modal.workspaceDescriptionHint")}
                    label={t("workspace.sidebar.modal.workspaceDescription")}
                  >
                    <Textarea
                      className="min-h-[112px] resize-y"
                      onChange={(event) =>
                        setCreateWorkspaceDescription(event.target.value)
                      }
                      placeholder={t(
                        "workspace.sidebar.modal.workspaceDescriptionPlaceholder",
                      )}
                      value={createWorkspaceDescription}
                    />
                  </AdminManagementField>

                  <DialogFormActions>
                    <Button
                      onClick={() => setManagementPanel(null)}
                      type="button"
                      variant="outline"
                    >
                      {t("workspace.sidebar.modal.cancel")}
                    </Button>
                    <Button
                      disabled={
                        !createWorkspaceTenantId ||
                        !createWorkspaceName.trim() ||
                        !createWorkspaceSlug.trim() ||
                        isCreatingResource
                      }
                      onClick={handleCreateWorkspace}
                      type="button"
                    >
                      {isCreatingResource
                        ? t("workspace.sidebar.modal.creating")
                        : t("workspace.sidebar.modal.createWorkspace")}
                    </Button>
                  </DialogFormActions>
                </DialogFormLayout>
              </AdminManagementDialog>
            ) : null}

            {managementPanel === "workspace-edit" ? (
              <AdminManagementDialog
                description={t(
                  "workspace.sidebar.modal.workspaceEditDescription",
                )}
                eyebrow={t("admin.title")}
                onClose={() => setManagementPanel(null)}
                title={t("workspace.sidebar.modal.workspaceEditTitle")}
              >
                <DialogFormLayout>
                  <AdminManagementField
                    label={t("workspace.sidebar.sectionTenant")}
                  >
                    <Select
                      onValueChange={setEditWorkspaceTenantId}
                      value={editWorkspaceTenantId}
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={t("workspace.sidebar.selectTenant")}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {tenants.map((tenant) => (
                          <SelectItem key={tenant.id} value={tenant.id}>
                            {tenant.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </AdminManagementField>

                  <DialogFormGrid className="xl:grid-cols-3">
                    <AdminManagementField
                      className="xl:col-span-2"
                      label={t("workspace.sidebar.modal.workspaceName")}
                    >
                      <Input
                        onChange={(event) =>
                          setEditWorkspaceName(event.target.value)
                        }
                        placeholder={t(
                          "workspace.sidebar.modal.workspaceNamePlaceholder",
                        )}
                        value={editWorkspaceName}
                      />
                    </AdminManagementField>

                    <AdminManagementField
                      hint={t("workspace.sidebar.modal.workspaceSlugHint")}
                      label={t("workspace.sidebar.modal.workspaceSlug")}
                    >
                      <Input
                        onChange={(event) =>
                          setEditWorkspaceSlug(slugifyValue(event.target.value))
                        }
                        placeholder={t(
                          "workspace.sidebar.modal.workspaceSlugPlaceholder",
                        )}
                        value={editWorkspaceSlug}
                      />
                    </AdminManagementField>
                  </DialogFormGrid>

                  <AdminManagementField
                    hint={t("workspace.sidebar.modal.workspaceDescriptionHint")}
                    label={t("workspace.sidebar.modal.workspaceDescription")}
                  >
                    <Textarea
                      className="min-h-[112px] resize-y"
                      onChange={(event) =>
                        setEditWorkspaceDescription(event.target.value)
                      }
                      placeholder={t(
                        "workspace.sidebar.modal.workspaceDescriptionPlaceholder",
                      )}
                      value={editWorkspaceDescription}
                    />
                  </AdminManagementField>

                  <DialogFormActions>
                    <Button
                      onClick={() => setManagementPanel(null)}
                      type="button"
                      variant="outline"
                    >
                      {t("workspace.sidebar.modal.cancel")}
                    </Button>
                    <Button
                      disabled={
                        !editWorkspaceTenantId ||
                        !editWorkspaceName.trim() ||
                        !editWorkspaceSlug.trim() ||
                        isUpdatingResource
                      }
                      onClick={handleUpdateWorkspace}
                      type="button"
                    >
                      {isUpdatingResource
                        ? t("workspace.sidebar.modal.saving")
                        : t("workspace.sidebar.modal.saveWorkspace")}
                    </Button>
                  </DialogFormActions>
                </DialogFormLayout>
              </AdminManagementDialog>
            ) : null}

            {managementPanel === "knowledge-base-create" ? (
              <AdminManagementDialog
                description={t(
                  "workspace.sidebar.modal.knowledgeBaseCreateDescription",
                )}
                eyebrow={t("admin.title")}
                onClose={() => setManagementPanel(null)}
                title={t("workspace.sidebar.modal.knowledgeBaseCreateTitle")}
              >
                <DialogFormLayout>
                  <AdminManagementField
                    label={t("workspace.sidebar.sectionWorkspace")}
                  >
                    <Select
                      onValueChange={setCreateKnowledgeBaseWorkspaceId}
                      value={createKnowledgeBaseWorkspaceId}
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={t("workspace.sidebar.selectWorkspace")}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {(filteredWorkspaces.length > 0
                          ? filteredWorkspaces
                          : workspaces
                        ).map((workspace) => (
                          <SelectItem key={workspace.id} value={workspace.id}>
                            {workspace.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </AdminManagementField>

                  <DialogFormGrid className="xl:grid-cols-3">
                    <AdminManagementField
                      className="xl:col-span-2"
                      label={t("workspace.sidebar.modal.knowledgeBaseName")}
                    >
                      <Input
                        onChange={(event) => {
                          const nextName = event.target.value;
                          setCreateKnowledgeBaseName(nextName);
                          if (!createKnowledgeBaseSlug.trim()) {
                            setCreateKnowledgeBaseSlug(slugifyValue(nextName));
                          }
                        }}
                        placeholder={t(
                          "workspace.sidebar.modal.knowledgeBaseNamePlaceholder",
                        )}
                        value={createKnowledgeBaseName}
                      />
                    </AdminManagementField>

                    <AdminManagementField
                      hint={t("workspace.sidebar.modal.knowledgeBaseSlugHint")}
                      label={t("workspace.sidebar.modal.knowledgeBaseSlug")}
                    >
                      <Input
                        onChange={(event) =>
                          setCreateKnowledgeBaseSlug(
                            slugifyValue(event.target.value),
                          )
                        }
                        placeholder={t(
                          "workspace.sidebar.modal.knowledgeBaseSlugPlaceholder",
                        )}
                        value={createKnowledgeBaseSlug}
                      />
                    </AdminManagementField>
                  </DialogFormGrid>

                  <AdminManagementField
                    hint={t(
                      "workspace.sidebar.modal.knowledgeBaseDescriptionHint",
                    )}
                    label={t(
                      "workspace.sidebar.modal.knowledgeBaseDescription",
                    )}
                  >
                    <Textarea
                      className="min-h-[112px] resize-y"
                      onChange={(event) =>
                        setCreateKnowledgeBaseDescription(event.target.value)
                      }
                      placeholder={t(
                        "workspace.sidebar.modal.knowledgeBaseDescriptionPlaceholder",
                      )}
                      value={createKnowledgeBaseDescription}
                    />
                  </AdminManagementField>

                  <AdminManagementField
                    hint={t(
                      "workspace.sidebar.modal.knowledgeBaseRetrievalProfileHint",
                    )}
                    label={t(
                      "workspace.sidebar.modal.knowledgeBaseRetrievalProfile",
                    )}
                  >
                    <Select
                      onValueChange={(value) =>
                        setCreateKnowledgeBaseRetrievalProfileId(
                          value === "none" ? "" : value,
                        )
                      }
                      value={createKnowledgeBaseRetrievalProfileId || "none"}
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={t(
                            "workspace.sidebar.modal.knowledgeBaseRetrievalProfile",
                          )}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">
                          {t(
                            "workspace.sidebar.modal.knowledgeBaseRetrievalProfileDefault",
                          )}
                        </SelectItem>
                        {retrievalProfiles.map((retrievalProfile) => (
                          <SelectItem
                            key={retrievalProfile.id}
                            value={retrievalProfile.id}
                          >
                            {retrievalProfile.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </AdminManagementField>

                  <DialogFormActions>
                    <Button
                      onClick={() => setManagementPanel(null)}
                      type="button"
                      variant="outline"
                    >
                      {t("workspace.sidebar.modal.cancel")}
                    </Button>
                    <Button
                      disabled={
                        !createKnowledgeBaseWorkspaceId ||
                        !createKnowledgeBaseName.trim() ||
                        !createKnowledgeBaseSlug.trim() ||
                        isCreatingResource
                      }
                      onClick={handleCreateKnowledgeBase}
                      type="button"
                    >
                      {isCreatingResource
                        ? t("workspace.sidebar.modal.creating")
                        : t("workspace.sidebar.modal.createKnowledgeBase")}
                    </Button>
                  </DialogFormActions>
                </DialogFormLayout>
              </AdminManagementDialog>
            ) : null}

            {managementPanel === "knowledge-base-edit" ? (
              <AdminManagementDialog
                description={t(
                  "workspace.sidebar.modal.knowledgeBaseEditDescription",
                )}
                eyebrow={t("admin.title")}
                onClose={() => setManagementPanel(null)}
                title={t("workspace.sidebar.modal.knowledgeBaseEditTitle")}
              >
                <DialogFormLayout>
                  <AdminManagementField
                    label={t("workspace.sidebar.sectionWorkspace")}
                  >
                    <Select
                      onValueChange={setEditKnowledgeBaseWorkspaceId}
                      value={editKnowledgeBaseWorkspaceId}
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={t("workspace.sidebar.selectWorkspace")}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {workspaces.map((workspace) => (
                          <SelectItem key={workspace.id} value={workspace.id}>
                            {workspace.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </AdminManagementField>

                  <DialogFormGrid className="xl:grid-cols-3">
                    <AdminManagementField
                      className="xl:col-span-2"
                      label={t("workspace.sidebar.modal.knowledgeBaseName")}
                    >
                      <Input
                        onChange={(event) =>
                          setEditKnowledgeBaseName(event.target.value)
                        }
                        placeholder={t(
                          "workspace.sidebar.modal.knowledgeBaseNamePlaceholder",
                        )}
                        value={editKnowledgeBaseName}
                      />
                    </AdminManagementField>

                    <AdminManagementField
                      hint={t("workspace.sidebar.modal.knowledgeBaseSlugHint")}
                      label={t("workspace.sidebar.modal.knowledgeBaseSlug")}
                    >
                      <Input
                        onChange={(event) =>
                          setEditKnowledgeBaseSlug(
                            slugifyValue(event.target.value),
                          )
                        }
                        placeholder={t(
                          "workspace.sidebar.modal.knowledgeBaseSlugPlaceholder",
                        )}
                        value={editKnowledgeBaseSlug}
                      />
                    </AdminManagementField>
                  </DialogFormGrid>

                  <AdminManagementField
                    hint={t(
                      "workspace.sidebar.modal.knowledgeBaseDescriptionHint",
                    )}
                    label={t(
                      "workspace.sidebar.modal.knowledgeBaseDescription",
                    )}
                  >
                    <Textarea
                      className="min-h-[112px] resize-y"
                      onChange={(event) =>
                        setEditKnowledgeBaseDescription(event.target.value)
                      }
                      placeholder={t(
                        "workspace.sidebar.modal.knowledgeBaseDescriptionPlaceholder",
                      )}
                      value={editKnowledgeBaseDescription}
                    />
                  </AdminManagementField>

                  <AdminManagementField
                    hint={t(
                      "workspace.sidebar.modal.knowledgeBaseRetrievalProfileHint",
                    )}
                    label={t(
                      "workspace.sidebar.modal.knowledgeBaseRetrievalProfile",
                    )}
                  >
                    <Select
                      onValueChange={(value) =>
                        setEditKnowledgeBaseRetrievalProfileId(
                          value === "none" ? "" : value,
                        )
                      }
                      value={editKnowledgeBaseRetrievalProfileId || "none"}
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={t(
                            "workspace.sidebar.modal.knowledgeBaseRetrievalProfile",
                          )}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">
                          {t(
                            "workspace.sidebar.modal.knowledgeBaseRetrievalProfileDefault",
                          )}
                        </SelectItem>
                        {retrievalProfiles.map((retrievalProfile) => (
                          <SelectItem
                            key={retrievalProfile.id}
                            value={retrievalProfile.id}
                          >
                            {retrievalProfile.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </AdminManagementField>

                  <DialogFormActions>
                    <Button
                      onClick={() => setManagementPanel(null)}
                      type="button"
                      variant="outline"
                    >
                      {t("workspace.sidebar.modal.cancel")}
                    </Button>
                    <Button
                      disabled={
                        !editKnowledgeBaseWorkspaceId ||
                        !editKnowledgeBaseName.trim() ||
                        !editKnowledgeBaseSlug.trim() ||
                        isUpdatingResource
                      }
                      onClick={handleUpdateKnowledgeBase}
                      type="button"
                    >
                      {isUpdatingResource
                        ? t("workspace.sidebar.modal.saving")
                        : t("workspace.sidebar.modal.saveKnowledgeBase")}
                    </Button>
                  </DialogFormActions>
                </DialogFormLayout>
              </AdminManagementDialog>
            ) : null}
          </main>
        </div>
      </ConsolePage>
    </ConsoleShell>
  );
}
