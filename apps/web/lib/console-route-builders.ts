import type { UrlObject } from "url";

export type AgentConsoleTarget = {
  tenantId?: string | null;
  status?: "all" | "draft" | "active" | "paused" | null;
  mode?: "all" | "grounded_chat" | "document_intake" | "workflow_recovery" | null;
  readiness?: "all" | "ready" | "attention" | null;
  issue?:
    | "all"
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
    | "tool_mcp_integration_pending"
    | null;
  query?: string | null;
  agentId?: string | null;
  runTargetSurface?: "all" | "chat" | "documents" | "operations" | "admin" | null;
  runTriggerSource?: "all" | "agents_console" | "workspace" | "home" | "admin" | "operations" | null;
  runStatus?: "all" | "launched" | "completed" | "failed" | "cancelled" | null;
  executionStatus?: "all" | "queued" | "running" | "completed" | "failed" | "cancelled" | null;
  modelEndpointId?: string | null;
  toolRegistrationId?: string | null;
  retrievalProfileId?: string | null;
};

export type OperationsConsoleTarget = {
  tenantId?: string | null;
  agentId?: string | null;
  lane?: "overview" | "failed" | "retries" | "pressure" | null;
  status?: "all" | "queued" | "running" | "failed" | "completed" | "pending" | null;
  retryMode?: "all" | "originals" | "retries" | null;
  query?: string | null;
  workflowRunId?: string | null;
};

export type AdminConsoleTarget = {
  tenantId?: string | null;
  section?: "overview" | "directory" | "access" | "security" | null;
  workspaceLifecycleFilter?: string | null;
  knowledgeBasePublicationStatusFilter?: string | null;
  retrievalProfileFilter?: string | null;
  memberAccountFilter?: string | null;
  memberRelationshipFilter?: string | null;
  workspaceId?: string | null;
  knowledgeBaseId?: string | null;
  userId?: string | null;
  managementPanel?: "workspace-edit" | "knowledge-base-edit" | "user-edit" | null;
  query?: string | null;
};

export type SettingsRuntimeTarget = {
  runtimeResource?: "model_endpoint" | "tool_registration" | "retrieval_profile" | "mcp_connector" | null;
  modelEndpointId?: string | null;
  toolRegistrationId?: string | null;
  retrievalProfileId?: string | null;
  mcpConnectorId?: string | null;
  mcpConnectorSlug?: string | null;
};

export type RuntimeGovernanceFollowUpTarget = {
  tenantId?: string | null;
  mode?: "all" | "grounded_chat" | "document_intake" | "workflow_recovery" | null;
  fallbackAgentId?: string | null;
  disabledModelEndpointId?: string | null;
  disabledToolRegistrationId?: string | null;
  pendingMcpToolRegistrationId?: string | null;
  pendingMcpConnectorReference?: string | null;
  reservedMcpToolRegistrationId?: string | null;
  reservedMcpConnectorReference?: string | null;
  disabledRetrievalProfileId?: string | null;
  approvalToolRegistrationId?: string | null;
};

function setSearchParam(searchParams: URLSearchParams, key: string, value: string | null | undefined) {
  if (value && value.trim().length > 0) {
    searchParams.set(key, value);
    return;
  }

  searchParams.delete(key);
}

export function buildAgentsHref(target: AgentConsoleTarget) {
  const searchParams = new URLSearchParams();
  setSearchParam(searchParams, "tenant_id", target.tenantId ?? null);
  if (target.status && target.status !== "all") {
    searchParams.set("status", target.status);
  }
  if (target.mode && target.mode !== "all") {
    searchParams.set("mode", target.mode);
  }
  if (target.readiness && target.readiness !== "all") {
    searchParams.set("readiness", target.readiness);
  }
  if (target.issue && target.issue !== "all") {
    searchParams.set("issue", target.issue);
  }
  setSearchParam(searchParams, "query", target.query ?? null);
  setSearchParam(searchParams, "agent_id", target.agentId ?? null);
  if (target.runTargetSurface && target.runTargetSurface !== "all") {
    searchParams.set("run_target_surface", target.runTargetSurface);
  }
  if (target.runTriggerSource && target.runTriggerSource !== "all") {
    searchParams.set("run_trigger_source", target.runTriggerSource);
  }
  if (target.runStatus && target.runStatus !== "all") {
    searchParams.set("run_status", target.runStatus);
  }
  if (target.executionStatus && target.executionStatus !== "all") {
    searchParams.set("execution_status", target.executionStatus);
  }
  setSearchParam(searchParams, "model_endpoint_id", target.modelEndpointId ?? null);
  setSearchParam(searchParams, "tool_registration_id", target.toolRegistrationId ?? null);
  setSearchParam(searchParams, "retrieval_profile_id", target.retrievalProfileId ?? null);

  return {
    pathname: "/agents",
    query: Object.fromEntries(searchParams.entries())
  } satisfies UrlObject;
}

export function buildOperationsHref(target: OperationsConsoleTarget) {
  const searchParams = new URLSearchParams();
  setSearchParam(searchParams, "tenant_id", target.tenantId ?? null);
  setSearchParam(searchParams, "agent_id", target.agentId ?? null);
  if (target.lane && target.lane !== "overview") {
    searchParams.set("lane", target.lane);
  }
  if (target.status && target.status !== "all") {
    searchParams.set("status", target.status);
  }
  if (target.retryMode && target.retryMode !== "all") {
    searchParams.set("retry_mode", target.retryMode);
  }
  setSearchParam(searchParams, "query", target.query ?? null);
  setSearchParam(searchParams, "workflow_run_id", target.workflowRunId ?? null);

  return {
    pathname: "/operations",
    query: Object.fromEntries(searchParams.entries())
  } satisfies UrlObject;
}

export function buildAdminHref(target: AdminConsoleTarget) {
  const searchParams = new URLSearchParams();
  setSearchParam(searchParams, "tenant_id", target.tenantId ?? null);
  if (target.section && target.section !== "overview") {
    searchParams.set("section", target.section);
  }
  if (target.workspaceLifecycleFilter && target.workspaceLifecycleFilter !== "all") {
    searchParams.set("workspace_lifecycle", target.workspaceLifecycleFilter);
  }
  if (
    target.knowledgeBasePublicationStatusFilter &&
    target.knowledgeBasePublicationStatusFilter !== "all"
  ) {
    searchParams.set("knowledge_base_publication", target.knowledgeBasePublicationStatusFilter);
  }
  if (target.retrievalProfileFilter && target.retrievalProfileFilter !== "all") {
    searchParams.set("retrieval_profile", target.retrievalProfileFilter);
  }
  if (target.memberAccountFilter && target.memberAccountFilter !== "all") {
    searchParams.set("member_account", target.memberAccountFilter);
  }
  if (target.memberRelationshipFilter && target.memberRelationshipFilter !== "all") {
    searchParams.set("member_relationship", target.memberRelationshipFilter);
  }
  setSearchParam(searchParams, "workspace_id", target.workspaceId ?? null);
  setSearchParam(searchParams, "knowledge_base_id", target.knowledgeBaseId ?? null);
  setSearchParam(searchParams, "user_id", target.userId ?? null);
  setSearchParam(searchParams, "management_panel", target.managementPanel ?? null);
  setSearchParam(searchParams, "query", target.query ?? null);

  return {
    pathname: "/admin",
    query: Object.fromEntries(searchParams.entries())
  } satisfies UrlObject;
}

export function buildSettingsHref(target: SettingsRuntimeTarget = {}) {
  const searchParams = new URLSearchParams();
  if (target.runtimeResource) {
    searchParams.set("runtime_resource", target.runtimeResource);
  }
  setSearchParam(searchParams, "model_endpoint_id", target.modelEndpointId ?? null);
  setSearchParam(searchParams, "tool_registration_id", target.toolRegistrationId ?? null);
  setSearchParam(searchParams, "retrieval_profile_id", target.retrievalProfileId ?? null);
  setSearchParam(searchParams, "mcp_connector_id", target.mcpConnectorId ?? null);
  setSearchParam(searchParams, "mcp_connector_slug", target.mcpConnectorSlug ?? null);

  return {
    pathname: "/settings",
    query: Object.fromEntries(searchParams.entries())
  } satisfies UrlObject;
}

export function buildToolTraceSettingsHref(target: {
  toolRegistrationId?: string | null;
  governanceIssue?: string | null;
  connectorReference?: string | null;
  mcpConnectorId?: string | null;
}) {
  const trimmedConnectorReference = target.connectorReference?.trim() ?? "";
  if (
    (target.governanceIssue === "mcp_reserved" || target.governanceIssue === "mcp_integration_pending") &&
    (target.mcpConnectorId || trimmedConnectorReference)
  ) {
    return buildSettingsHref({
      runtimeResource: "mcp_connector",
      mcpConnectorId: target.mcpConnectorId ?? null,
      mcpConnectorSlug: trimmedConnectorReference || null
    });
  }

  return buildSettingsHref({
    runtimeResource: "tool_registration",
    toolRegistrationId: target.toolRegistrationId ?? null
  });
}

export function buildRuntimeGovernanceSettingsHref(target: RuntimeGovernanceFollowUpTarget) {
  if (target.disabledModelEndpointId) {
    return buildSettingsHref({
      runtimeResource: "model_endpoint",
      modelEndpointId: target.disabledModelEndpointId
    });
  }

  if (target.disabledToolRegistrationId) {
    return buildSettingsHref({
      runtimeResource: "tool_registration",
      toolRegistrationId: target.disabledToolRegistrationId
    });
  }

  if (target.pendingMcpToolRegistrationId) {
    return buildToolTraceSettingsHref({
      toolRegistrationId: target.pendingMcpToolRegistrationId,
      governanceIssue: "mcp_integration_pending",
      connectorReference: target.pendingMcpConnectorReference
    });
  }

  if (target.reservedMcpToolRegistrationId) {
    return buildToolTraceSettingsHref({
      toolRegistrationId: target.reservedMcpToolRegistrationId,
      governanceIssue: "mcp_reserved",
      connectorReference: target.reservedMcpConnectorReference
    });
  }

  if (target.disabledRetrievalProfileId) {
    return buildSettingsHref({
      runtimeResource: "retrieval_profile",
      retrievalProfileId: target.disabledRetrievalProfileId
    });
  }

  if (target.approvalToolRegistrationId) {
    return buildSettingsHref({
      runtimeResource: "tool_registration",
      toolRegistrationId: target.approvalToolRegistrationId
    });
  }

  return buildSettingsHref();
}

export function buildRuntimeGovernanceDefinitionsHref(target: RuntimeGovernanceFollowUpTarget) {
  const sharedTarget = {
    tenantId: target.tenantId ?? null,
    status: "active" as const,
    mode: target.mode ?? null
  };

  if (target.disabledModelEndpointId) {
    return buildAgentsHref({
      ...sharedTarget,
      readiness: "attention",
      issue: "model_disabled",
      modelEndpointId: target.disabledModelEndpointId
    });
  }

  if (target.disabledToolRegistrationId) {
    return buildAgentsHref({
      ...sharedTarget,
      readiness: "attention",
      issue: "tool_registration_disabled",
      toolRegistrationId: target.disabledToolRegistrationId
    });
  }

  if (target.pendingMcpToolRegistrationId) {
    return buildAgentsHref({
      ...sharedTarget,
      readiness: "attention",
      issue: "tool_mcp_integration_pending",
      toolRegistrationId: target.pendingMcpToolRegistrationId
    });
  }

  if (target.reservedMcpToolRegistrationId) {
    return buildAgentsHref({
      ...sharedTarget,
      readiness: "attention",
      issue: "tool_mcp_reserved",
      toolRegistrationId: target.reservedMcpToolRegistrationId
    });
  }

  if (target.disabledRetrievalProfileId) {
    return buildAgentsHref({
      ...sharedTarget,
      readiness: "attention",
      issue: "retrieval_profile_disabled",
      retrievalProfileId: target.disabledRetrievalProfileId
    });
  }

  if (target.approvalToolRegistrationId) {
    return buildAgentsHref({
      ...sharedTarget,
      issue: "tool_approval_required",
      toolRegistrationId: target.approvalToolRegistrationId
    });
  }

  return buildAgentsHref({
    ...sharedTarget,
    readiness: "attention",
    agentId: target.fallbackAgentId ?? null
  });
}
