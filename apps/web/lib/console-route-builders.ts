import type { UrlObject } from "url";

import type {
  RuntimeGovernanceFollowUp,
  RuntimeGovernanceEvent,
  RuntimeGovernanceWorklistItem
} from "@/lib/platform-governance";

export type ConsoleHref = {
  pathname: string;
  query: Record<string, string>;
};

export type AgentConsoleTarget = {
  tenantId?: string | null;
  status?: "all" | "draft" | "active" | "paused" | null;
  mode?: "all" | "grounded_chat" | "document_intake" | "workflow_recovery" | null;
  readiness?: "all" | "ready" | "attention" | null;
  issue?:
    | "all"
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
    | "tool_mcp_integration_pending"
    | null;
  query?: string | null;
  agentId?: string | null;
  runTargetSurface?: "all" | "chat" | "documents" | "operations" | "admin" | null;
  runTriggerSource?: "all" | "agents_console" | "workspace" | "home" | "admin" | "operations" | null;
  runStatus?: "all" | "launched" | "completed" | "failed" | "cancelled" | null;
  executionStatus?: "all" | "queued" | "running" | "completed" | "failed" | "cancelled" | null;
  modelEndpointId?: string | null;
  modelProviderType?: "deterministic" | "openai_compatible" | "ollama" | "vllm" | null;
  toolRegistrationId?: string | null;
  retrievalProfileId?: string | null;
};

export type OperationsConsoleTarget = {
  tenantId?: string | null;
  agentId?: string | null;
  lane?: "overview" | "failed" | "retries" | "pressure" | null;
  status?: "all" | "queued" | "running" | "failed" | "cancelled" | "completed" | "pending" | null;
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
  auditEventFilter?: string | null;
  workspaceId?: string | null;
  knowledgeBaseId?: string | null;
  userId?: string | null;
  managementPanel?: "workspace-edit" | "knowledge-base-edit" | "user-edit" | null;
  query?: string | null;
  resumeWorkspaceHref?: string | null;
};

export type SettingsRuntimeTarget = {
  runtimeResource?: "model_endpoint" | "tool_registration" | "retrieval_profile" | "mcp_connector" | null;
  modelEndpointId?: string | null;
  modelProviderType?: "deterministic" | "openai_compatible" | "ollama" | "vllm" | null;
  toolRegistrationId?: string | null;
  toolListFilter?:
    | "all"
    | "approval_required"
    | "disabled"
    | "missing_endpoint"
    | "mcp_reserved_bound"
    | "mcp_integration_pending"
    | "mcp_connector_configured"
    | "mcp_connector_unhealthy"
    | null;
  retrievalProfileId?: string | null;
  mcpConnectorId?: string | null;
  mcpConnectorSlug?: string | null;
  resumeWorkspaceHref?: string | null;
};

export type RuntimeGovernanceFollowUpTarget = {
  tenantId?: string | null;
  mode?: "all" | "grounded_chat" | "document_intake" | "workflow_recovery" | null;
  fallbackAgentId?: string | null;
  disabledModelEndpointId?: string | null;
  unconfiguredModelEndpointId?: string | null;
  unconfiguredModelProviderType?: "deterministic" | "openai_compatible" | "ollama" | "vllm" | null;
  disabledToolRegistrationId?: string | null;
  pendingMcpToolRegistrationId?: string | null;
  pendingMcpConnectorReference?: string | null;
  reservedMcpToolRegistrationId?: string | null;
  reservedMcpConnectorReference?: string | null;
  disabledRetrievalProfileId?: string | null;
  approvalToolRegistrationId?: string | null;
};

export type RuntimeGovernanceTargetKey =
  | "disabled_model"
  | "unconfigured_model"
  | "disabled_tool"
  | "pending_mcp"
  | "reserved_mcp"
  | "disabled_retrieval"
  | "approval_tool"
  | null;

export type RuntimeGovernanceFollowUpBundle = {
  targetKey: RuntimeGovernanceTargetKey;
  hasConcreteTarget: boolean;
  settingsHref: ConsoleHref | null;
  definitionsHref: ConsoleHref;
};

export type RuntimeGovernanceResourceFollowUp = {
  settingsHref: ConsoleHref | null;
  definitionsHref: ConsoleHref | null;
};

export type RuntimeGovernanceIssueDefinitionsTarget = {
  tenantId?: string | null;
  mode?: "all" | "grounded_chat" | "document_intake" | "workflow_recovery" | null;
  issue:
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
  modelEndpointId?: string | null;
  modelProviderType?: "deterministic" | "openai_compatible" | "ollama" | "vllm" | null;
  toolRegistrationId?: string | null;
  retrievalProfileId?: string | null;
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
  setSearchParam(searchParams, "model_provider_type", target.modelProviderType ?? null);
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
  if (target.auditEventFilter && target.auditEventFilter !== "all") {
    searchParams.set("audit_event", target.auditEventFilter);
  }
  setSearchParam(searchParams, "workspace_id", target.workspaceId ?? null);
  setSearchParam(searchParams, "knowledge_base_id", target.knowledgeBaseId ?? null);
  setSearchParam(searchParams, "user_id", target.userId ?? null);
  setSearchParam(searchParams, "management_panel", target.managementPanel ?? null);
  setSearchParam(searchParams, "query", target.query ?? null);
  setSearchParam(searchParams, "resume_workspace", target.resumeWorkspaceHref ?? null);

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
  setSearchParam(searchParams, "model_provider_type", target.modelProviderType ?? null);
  setSearchParam(searchParams, "tool_registration_id", target.toolRegistrationId ?? null);
  setSearchParam(searchParams, "tool_list_filter", target.toolListFilter ?? null);
  setSearchParam(searchParams, "retrieval_profile_id", target.retrievalProfileId ?? null);
  setSearchParam(searchParams, "mcp_connector_id", target.mcpConnectorId ?? null);
  setSearchParam(searchParams, "mcp_connector_slug", target.mcpConnectorSlug ?? null);
  setSearchParam(searchParams, "resume_workspace", target.resumeWorkspaceHref ?? null);

  return {
    pathname: "/settings",
    query: Object.fromEntries(searchParams.entries())
  } satisfies UrlObject;
}

export function buildSettingsHrefFromRuntimeGovernanceTarget(
  target: RuntimeGovernanceFollowUp["settings_target"]
) {
  if (!target) {
    return null;
  }

  return buildSettingsHref({
    runtimeResource: target.runtime_resource,
    modelEndpointId: target.model_endpoint_id,
    modelProviderType: target.model_provider_type,
    toolRegistrationId: target.tool_registration_id,
    toolListFilter: target.tool_list_filter,
    retrievalProfileId: target.retrieval_profile_id,
    mcpConnectorId: target.mcp_connector_id,
    mcpConnectorSlug: target.mcp_connector_slug,
  });
}

export function buildAgentsHrefFromRuntimeGovernanceTarget(
  target: RuntimeGovernanceFollowUp["agents_target"],
  tenantId?: string | null
) {
  if (!target) {
    return null;
  }

  return buildAgentsHref({
    tenantId: tenantId ?? null,
    status: "active",
    readiness:
      target.issue === "tool_approval_required"
        ? null
        : "attention",
    issue: target.issue,
    modelEndpointId: target.model_endpoint_id,
    modelProviderType: target.model_provider_type,
    toolRegistrationId: target.tool_registration_id,
    retrievalProfileId: target.retrieval_profile_id,
  });
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

  const toolListFilter =
    target.governanceIssue === "approval_required"
      ? "approval_required"
      : target.governanceIssue === "tool_disabled"
        ? "disabled"
        : target.governanceIssue === "mcp_reserved"
          ? "mcp_reserved_bound"
          : target.governanceIssue === "mcp_integration_pending"
            ? "mcp_integration_pending"
            : null;

  return buildSettingsHref({
    runtimeResource: "tool_registration",
    toolRegistrationId: target.toolRegistrationId ?? null,
    toolListFilter
  });
}

function readRuntimeGovernanceDetailString(detail: Record<string, unknown>, key: string) {
  const value = detail[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function readRuntimeGovernanceDetailId(detail: Record<string, unknown>, key: string) {
  return readRuntimeGovernanceDetailString(detail, key);
}

function resolveToolGovernanceEventIssue(actionType: string) {
  if (actionType === "disable_tool") {
    return "tool_disabled" as const;
  }
  if (actionType === "require_admin_approval") {
    return "approval_required" as const;
  }
  if (actionType === "review_mcp_boundary" || actionType === "quarantine_mcp_boundary") {
    return "mcp_reserved" as const;
  }
  if (actionType === "ready_mcp_integration") {
    return "mcp_integration_pending" as const;
  }
  return null;
}

function buildRuntimeGovernanceToolDefinitionsHref(target: {
  tenantId?: string | null;
  toolRegistrationId: string;
  actionType: string;
}) {
  if (target.actionType === "disable_tool") {
    return buildAgentsHref({
      tenantId: target.tenantId ?? null,
      status: "active",
      readiness: "attention",
      issue: "tool_registration_disabled",
      toolRegistrationId: target.toolRegistrationId
    });
  }

  if (target.actionType === "require_admin_approval") {
    return buildAgentsHref({
      tenantId: target.tenantId ?? null,
      status: "active",
      issue: "tool_approval_required",
      toolRegistrationId: target.toolRegistrationId
    });
  }

  if (target.actionType === "review_mcp_boundary" || target.actionType === "quarantine_mcp_boundary") {
    return buildAgentsHref({
      tenantId: target.tenantId ?? null,
      status: "active",
      readiness: "attention",
      issue: "tool_mcp_reserved",
      toolRegistrationId: target.toolRegistrationId
    });
  }

  if (target.actionType === "ready_mcp_integration") {
    return buildAgentsHref({
      tenantId: target.tenantId ?? null,
      status: "active",
      readiness: "attention",
      issue: "tool_mcp_integration_pending",
      toolRegistrationId: target.toolRegistrationId
    });
  }

  return null;
}

export function buildRuntimeGovernanceWorklistFollowUp(
  item: RuntimeGovernanceWorklistItem,
  tenantId?: string | null
): RuntimeGovernanceResourceFollowUp {
  if (item.follow_up) {
    return {
      settingsHref: buildSettingsHrefFromRuntimeGovernanceTarget(item.follow_up.settings_target),
      definitionsHref: buildAgentsHrefFromRuntimeGovernanceTarget(item.follow_up.agents_target, tenantId),
    };
  }

  if (item.resource_type === "mcp_connector") {
    return {
      settingsHref: buildSettingsHref({
        runtimeResource: "mcp_connector",
        mcpConnectorId: item.resource_id
      }),
      definitionsHref: null
    };
  }

  const governanceIssue =
    item.category === "approval_required_tool"
      ? "approval_required"
      : item.category === "mcp_integration_pending_tool"
        ? "mcp_integration_pending"
        : null;
  const connectorReference = readRuntimeGovernanceDetailString(item.detail, "connector_reference");
  const mcpConnectorId = readRuntimeGovernanceDetailId(item.detail, "mcp_connector_id");

  return {
    settingsHref: buildToolTraceSettingsHref({
      toolRegistrationId: item.resource_id,
      governanceIssue,
      connectorReference,
      mcpConnectorId
    }),
    definitionsHref:
      item.category === "approval_required_tool"
        ? buildAgentsHref({
            tenantId: tenantId ?? null,
            status: "active",
            issue: "tool_approval_required",
            toolRegistrationId: item.resource_id
          })
        : item.category === "mcp_integration_pending_tool"
          ? buildAgentsHref({
              tenantId: tenantId ?? null,
              status: "active",
              readiness: "attention",
              issue: "tool_mcp_integration_pending",
              toolRegistrationId: item.resource_id
            })
          : null
  };
}

export function buildRuntimeGovernanceEventFollowUp(
  event: RuntimeGovernanceEvent,
  tenantId?: string | null
): RuntimeGovernanceResourceFollowUp {
  if (event.follow_up) {
    return {
      settingsHref: buildSettingsHrefFromRuntimeGovernanceTarget(event.follow_up.settings_target),
      definitionsHref: buildAgentsHrefFromRuntimeGovernanceTarget(event.follow_up.agents_target, tenantId),
    };
  }

  if (!event.resource_id) {
    return {
      settingsHref: null,
      definitionsHref: null
    };
  }

  if (event.resource_type === "model_endpoint") {
    return {
      settingsHref: buildSettingsHref({
        runtimeResource: "model_endpoint",
        modelEndpointId: event.resource_id
      }),
      definitionsHref:
        event.action_type === "disable_endpoint"
          ? buildAgentsHref({
              tenantId: tenantId ?? null,
              status: "active",
              readiness: "attention",
              issue: "model_disabled",
              modelEndpointId: event.resource_id
            })
          : null
    };
  }

  if (event.resource_type === "retrieval_profile") {
    return {
      settingsHref: buildSettingsHref({
        runtimeResource: "retrieval_profile",
        retrievalProfileId: event.resource_id
      }),
      definitionsHref:
        event.action_type === "disable_profile"
          ? buildAgentsHref({
              tenantId: tenantId ?? null,
              status: "active",
              readiness: "attention",
              issue: "retrieval_profile_disabled",
              retrievalProfileId: event.resource_id
            })
          : null
    };
  }

  if (event.resource_type === "mcp_connector") {
    return {
      settingsHref: buildSettingsHref({
        runtimeResource: "mcp_connector",
        mcpConnectorId: event.resource_id
      }),
      definitionsHref: null
    };
  }

  const governanceIssue = resolveToolGovernanceEventIssue(event.action_type);
  const connectorReference = readRuntimeGovernanceDetailString(event.detail, "connector_reference");
  const mcpConnectorId = readRuntimeGovernanceDetailId(event.detail, "mcp_connector_id");

  return {
    settingsHref: buildToolTraceSettingsHref({
      toolRegistrationId: event.resource_id,
      governanceIssue,
      connectorReference,
      mcpConnectorId
    }),
    definitionsHref: buildRuntimeGovernanceToolDefinitionsHref({
      tenantId,
      toolRegistrationId: event.resource_id,
      actionType: event.action_type
    })
  };
}

export function buildRuntimeGovernanceSettingsHref(target: RuntimeGovernanceFollowUpTarget) {
  if (target.disabledModelEndpointId) {
    return buildSettingsHref({
      runtimeResource: "model_endpoint",
      modelEndpointId: target.disabledModelEndpointId
    });
  }

  if (target.unconfiguredModelEndpointId) {
    return buildSettingsHref({
      runtimeResource: "model_endpoint",
      modelEndpointId: target.unconfiguredModelEndpointId,
      modelProviderType: target.unconfiguredModelProviderType ?? null
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

  if (target.unconfiguredModelEndpointId) {
    return buildAgentsHref({
      ...sharedTarget,
      readiness: "attention",
      issue: "model_runtime_unconfigured",
      modelEndpointId: target.unconfiguredModelEndpointId,
      modelProviderType: target.unconfiguredModelProviderType ?? null
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

export function buildRuntimeGovernanceIssueDefinitionsHref(
  target: RuntimeGovernanceIssueDefinitionsTarget
) {
  const sharedTarget = {
    tenantId: target.tenantId ?? null,
    status: "active" as const,
    mode: target.mode ?? null
  };

  if (target.issue === "tool_approval_required") {
    return buildAgentsHref({
      ...sharedTarget,
      issue: target.issue,
      toolRegistrationId: target.toolRegistrationId ?? null
    });
  }

  return buildAgentsHref({
    ...sharedTarget,
    readiness: "attention",
    issue: target.issue,
    modelEndpointId: target.modelEndpointId ?? null,
    modelProviderType: target.modelProviderType ?? null,
    toolRegistrationId: target.toolRegistrationId ?? null,
    retrievalProfileId: target.retrievalProfileId ?? null
  });
}

export function resolveRuntimeGovernanceTargetKey(
  target: RuntimeGovernanceFollowUpTarget
): RuntimeGovernanceTargetKey {
  if (target.disabledModelEndpointId) {
    return "disabled_model";
  }
  if (target.unconfiguredModelEndpointId) {
    return "unconfigured_model";
  }
  if (target.disabledToolRegistrationId) {
    return "disabled_tool";
  }
  if (target.pendingMcpToolRegistrationId) {
    return "pending_mcp";
  }
  if (target.reservedMcpToolRegistrationId) {
    return "reserved_mcp";
  }
  if (target.disabledRetrievalProfileId) {
    return "disabled_retrieval";
  }
  if (target.approvalToolRegistrationId) {
    return "approval_tool";
  }
  return null;
}

export function buildRuntimeGovernanceFollowUp(
  target: RuntimeGovernanceFollowUpTarget
): RuntimeGovernanceFollowUpBundle {
  const targetKey = resolveRuntimeGovernanceTargetKey(target);
  return {
    targetKey,
    hasConcreteTarget: targetKey !== null,
    settingsHref: targetKey !== null ? buildRuntimeGovernanceSettingsHref(target) : null,
    definitionsHref: buildRuntimeGovernanceDefinitionsHref(target)
  };
}
