import type {
  AgentExecutionRecommendedActionSpec,
  AgentExecutionResponse
} from "@/lib/agent-executions";
import {
  buildAgentsHref,
  buildOperationsHref,
  buildSettingsHref,
  buildToolTraceSettingsHref
} from "@/lib/console-route-builders";
import { normalizeRuntimeProviderType } from "@/lib/runtime-fallback";
import {
  buildAdminWorkspaceHref,
  buildAgentsWorkspaceHref,
  buildHomeWorkspaceHref,
  buildOperationsWorkspaceHref
} from "@/lib/workspace-handoffs";
import { buildWorkspaceHref } from "@/lib/workspace-navigation";
import type { UrlObject } from "url";

type WorkspaceSourceContext =
  | { surface: "home" }
  | { surface: "agents" }
  | { surface: "workspace" }
  | { surface: "operations"; lane: "overview" | "failed" | "retries" | "pressure" }
  | { surface: "admin"; section: "overview" | "directory" | "access" | "security" };

export type AgentExecutionFollowUpAction = {
  id: string;
  key: "chat" | "documents" | "operations" | "agents";
  href: UrlObject;
  labelKey?: string;
  label?: string | null;
  variant: "default" | "outline";
};

function hasScopedKnowledgeContext(execution: AgentExecutionResponse) {
  return Boolean(execution.workspace_id && execution.knowledge_base_id);
}

function buildScopedWorkspaceHref(
  sourceContext: WorkspaceSourceContext,
  target: {
    view: "chat" | "documents" | "workflows";
    execution: AgentExecutionResponse;
    draftQuestion?: string | null;
    handoffIntent?: "agent_brief" | "grounded_validation" | "document_recovery" | "workflow_recovery";
    documentStatus?: string | null;
    workflowStatus?: string | null;
  }
) {
  const sharedTarget = {
    view: target.view,
    tenantId: target.execution.tenant_id,
    workspaceId: target.execution.workspace_id,
    knowledgeBaseId: target.execution.knowledge_base_id,
    agentId: target.execution.agent_definition_id,
    draftQuestion: target.draftQuestion ?? null,
    handoffIntent: target.handoffIntent ?? null,
    documentStatus: target.documentStatus ?? null,
    workflowStatus: target.workflowStatus ?? null
  } as const;

  if (sourceContext.surface === "agents") {
    return buildAgentsWorkspaceHref(sharedTarget);
  }

  if (sourceContext.surface === "operations") {
    return buildOperationsWorkspaceHref(sourceContext.lane, sharedTarget);
  }

  if (sourceContext.surface === "home") {
    return buildHomeWorkspaceHref(sharedTarget);
  }

  if (sourceContext.surface === "workspace") {
    return buildWorkspaceHref({
      view: sharedTarget.view,
      tenantId: sharedTarget.tenantId,
      workspaceId: sharedTarget.workspaceId,
      knowledgeBaseId: sharedTarget.knowledgeBaseId,
      agentId: sharedTarget.agentId,
      draftQuestion: sharedTarget.draftQuestion,
      handoffIntent: sharedTarget.handoffIntent,
      documentStatus: sharedTarget.documentStatus,
      workflowStatus: sharedTarget.workflowStatus,
      sourceSurface: "workspace"
    });
  }

  return buildAdminWorkspaceHref(sourceContext.section, sharedTarget);
}

function resolveChatIntent(execution: AgentExecutionResponse) {
  if (execution.execution_mode === "grounded_chat") {
    return "grounded_validation" as const;
  }
  return "agent_brief" as const;
}

function resolveDocumentIntent(execution: AgentExecutionResponse) {
  if (execution.execution_mode === "workflow_recovery" || execution.execution_mode === "document_intake") {
    return "document_recovery" as const;
  }
  return "grounded_validation" as const;
}

function resolveWorkflowIntent(execution: AgentExecutionResponse) {
  if (execution.execution_mode === "workflow_recovery") {
    return "workflow_recovery" as const;
  }
  if (execution.execution_mode === "document_intake") {
    return "document_recovery" as const;
  }
  return "grounded_validation" as const;
}

function resolveDocumentStatusFilter(execution: AgentExecutionResponse) {
  if (execution.execution_mode === "workflow_recovery") {
    return "failed";
  }
  if (execution.execution_mode === "document_intake") {
    if (execution.execution_status === "failed") {
      return "failed";
    }
    if (execution.execution_status === "queued" || execution.execution_status === "running") {
      return "running";
    }
  }
  return "all";
}

function resolveWorkflowStatusFilter(execution: AgentExecutionResponse) {
  if (execution.execution_status === "failed") {
    return "failed";
  }
  if (execution.execution_mode === "document_intake") {
    if (execution.execution_status === "queued" || execution.execution_status === "running") {
      return "pending";
    }
  }
  return "all";
}

function uniqueActions(actions: AgentExecutionFollowUpAction[]) {
  const seen = new Set<string>();
  return actions.filter((action) => {
    const token = `${action.id}:${action.key}:${JSON.stringify(action.href)}`;
    if (seen.has(token)) {
      return false;
    }
    seen.add(token);
    return true;
  });
}

function resolveStructuredActionKey(targetView: AgentExecutionRecommendedActionSpec["targetView"]) {
  if (targetView === "chat") {
    return "chat" as const;
  }
  if (targetView === "documents") {
    return "documents" as const;
  }
  if (targetView === "workflows") {
    return "operations" as const;
  }
  return "agents" as const;
}

function resolveStructuredActionLabelKey(actionKey: string, targetView: AgentExecutionRecommendedActionSpec["targetView"]) {
  switch (actionKey) {
    case "review_model_runtime":
      return "agents.executions.structuredActions.review_model_runtime";
    case "review_tool_approval":
      return "agents.executions.structuredActions.review_tool_approval";
    case "review_disabled_tool":
      return "agents.executions.structuredActions.review_disabled_tool";
    case "review_reserved_mcp_tool":
      return "agents.executions.structuredActions.review_reserved_mcp_tool";
    case "review_mcp_connector_integration":
      return "agents.executions.structuredActions.review_mcp_connector_integration";
    case "review_tool_endpoint":
      return "agents.executions.structuredActions.review_tool_endpoint";
    case "review_tool_runtime":
      return "agents.executions.structuredActions.review_tool_runtime";
    case "review_retrieval_profile":
      return "agents.executions.structuredActions.review_retrieval_profile";
    case "resume_grounded_chat":
      return "agents.executions.structuredActions.resume_grounded_chat";
    case "review_evidence":
      return "agents.executions.structuredActions.review_evidence";
    case "recover_missing_evidence":
      return "agents.executions.structuredActions.recover_missing_evidence";
    case "review_failed_documents":
      return "agents.executions.structuredActions.review_failed_documents";
    case "review_active_intake":
      return "agents.executions.structuredActions.review_active_intake";
    case "inspect_workflow_recovery":
      return "agents.executions.structuredActions.inspect_workflow_recovery";
    case "triage_failed_workflows":
      return "agents.executions.structuredActions.triage_failed_workflows";
    case "inspect_retry_lineage":
      return "agents.executions.structuredActions.inspect_retry_lineage";
    case "return_to_documents":
      return "agents.executions.structuredActions.return_to_documents";
    default:
      if (targetView === "chat") {
        return "agents.runbook.actions.openChat";
      }
      if (targetView === "documents") {
        return "agents.runbook.actions.openDocuments";
      }
      if (targetView === "workflows") {
        return "agents.runbook.actions.openOperations";
      }
      return "admin.agentExecutions.openAgents";
  }
}

function resolveStructuredToolGovernanceIssue(actionKey: string) {
  switch (actionKey) {
    case "review_tool_approval":
      return "approval_required";
    case "review_disabled_tool":
      return "tool_disabled";
    case "review_reserved_mcp_tool":
      return "mcp_reserved";
    case "review_mcp_connector_integration":
      return "mcp_integration_pending";
    default:
      return null;
  }
}

function readExecutionRuntimeProviderType(execution: AgentExecutionResponse) {
  const payload =
    execution.result_payload_json && typeof execution.result_payload_json === "object"
      ? execution.result_payload_json
      : null;
  if (!payload) {
    return null;
  }

  const runtimeBinding =
    payload.runtime_binding && typeof payload.runtime_binding === "object" && !Array.isArray(payload.runtime_binding)
      ? (payload.runtime_binding as Record<string, unknown>)
      : null;

  const providerType =
    runtimeBinding && typeof runtimeBinding.provider_type === "string"
      ? runtimeBinding.provider_type
      : null;

  return normalizeRuntimeProviderType(providerType);
}

function buildStructuredFollowUpActions(options: {
  sourceContext: WorkspaceSourceContext;
  execution: AgentExecutionResponse;
  executionInput?: string | null;
  recommendedActions: AgentExecutionRecommendedActionSpec[];
}) {
  const { sourceContext, execution, recommendedActions } = options;
  const executionInput = options.executionInput?.trim() || execution.execution_input?.trim() || null;
  const scopedContextReady = hasScopedKnowledgeContext(execution);
  const runtimeProviderType = readExecutionRuntimeProviderType(execution);

  return recommendedActions
    .map((action): AgentExecutionFollowUpAction | null => {
      let href: UrlObject | null = null;

      if (action.targetSurface === "settings") {
        if (action.toolRegistrationId) {
          href = buildToolTraceSettingsHref({
            toolRegistrationId: action.toolRegistrationId,
            governanceIssue: resolveStructuredToolGovernanceIssue(action.actionKey),
            connectorReference: action.mcpConnectorSlug ?? null,
            mcpConnectorId: action.mcpConnectorId ?? null
          });
        } else {
          href = buildSettingsHref({
            runtimeResource: action.modelEndpointId
              ? "model_endpoint"
              : action.mcpConnectorId || action.mcpConnectorSlug
                ? "mcp_connector"
                : action.retrievalProfileId
                  ? "retrieval_profile"
                  : null,
            modelEndpointId: action.modelEndpointId,
            modelProviderType:
              action.actionKey === "review_model_runtime" ? runtimeProviderType : null,
            retrievalProfileId: action.retrievalProfileId,
            mcpConnectorId: action.mcpConnectorId ?? null,
            mcpConnectorSlug: action.mcpConnectorSlug ?? null,
          });
        }
      } else if (action.targetSurface === "agents") {
        href = buildAgentsHref({
          tenantId: execution.tenant_id,
          agentId: execution.agent_definition_id,
        });
      } else if (action.targetView === "chat") {
        if (!scopedContextReady) {
          return null;
        }
        href = buildScopedWorkspaceHref(sourceContext, {
          view: "chat",
          execution,
          draftQuestion: executionInput,
          handoffIntent:
            action.handoffIntent === "agent_brief" ||
            action.handoffIntent === "grounded_validation" ||
            action.handoffIntent === "document_recovery" ||
            action.handoffIntent === "workflow_recovery"
              ? action.handoffIntent
              : resolveChatIntent(execution),
        });
      } else if (action.targetView === "documents") {
        if (!scopedContextReady) {
          return null;
        }
        href = buildScopedWorkspaceHref(sourceContext, {
          view: "documents",
          execution,
          handoffIntent:
            action.handoffIntent === "agent_brief" ||
            action.handoffIntent === "grounded_validation" ||
            action.handoffIntent === "document_recovery" ||
            action.handoffIntent === "workflow_recovery"
              ? action.handoffIntent
              : resolveDocumentIntent(execution),
          documentStatus: action.documentStatus ?? resolveDocumentStatusFilter(execution),
        });
      } else if (action.targetView === "workflows") {
        href = buildScopedWorkspaceHref(sourceContext, {
          view: "workflows",
          execution,
          handoffIntent:
            action.handoffIntent === "agent_brief" ||
            action.handoffIntent === "grounded_validation" ||
            action.handoffIntent === "document_recovery" ||
            action.handoffIntent === "workflow_recovery"
              ? action.handoffIntent
              : resolveWorkflowIntent(execution),
          workflowStatus: action.workflowStatus ?? resolveWorkflowStatusFilter(execution),
        });
      } else {
        href = buildAgentsHref({
          tenantId: execution.tenant_id,
          agentId: execution.agent_definition_id,
        });
      }

      return {
        id: action.actionKey,
        key:
          action.targetSurface === "settings"
            ? "agents"
            : resolveStructuredActionKey(action.targetView),
        href,
        labelKey: resolveStructuredActionLabelKey(action.actionKey, action.targetView),
        label: action.actionLabel,
        variant: action.priority === "primary" ? "default" : "outline",
      };
    })
    .filter((action): action is AgentExecutionFollowUpAction => action !== null);
}

export function buildAgentExecutionFollowUpActions(options: {
  sourceContext: WorkspaceSourceContext;
  execution: AgentExecutionResponse;
  executionInput?: string | null;
  recommendedActions?: AgentExecutionRecommendedActionSpec[];
}) {
  const { sourceContext, execution } = options;
  const executionInput = options.executionInput?.trim() || execution.execution_input?.trim() || null;
  const scopedContextReady = hasScopedKnowledgeContext(execution);
  const structuredActions =
    options.recommendedActions && options.recommendedActions.length > 0
      ? buildStructuredFollowUpActions({
          sourceContext,
          execution,
          executionInput,
          recommendedActions: options.recommendedActions,
        })
      : [];

  if (structuredActions.length > 0) {
    return uniqueActions(structuredActions);
  }

  const chatHref = scopedContextReady
    ? buildScopedWorkspaceHref(sourceContext, {
        view: "chat",
        execution,
        draftQuestion: executionInput,
        handoffIntent: resolveChatIntent(execution)
      })
    : null;
  const documentsHref = scopedContextReady
    ? buildScopedWorkspaceHref(sourceContext, {
        view: "documents",
        execution,
        handoffIntent: resolveDocumentIntent(execution),
        documentStatus: resolveDocumentStatusFilter(execution)
      })
    : null;
  const workflowsHref = buildScopedWorkspaceHref(sourceContext, {
    view: "workflows",
    execution,
    handoffIntent: resolveWorkflowIntent(execution),
    workflowStatus: resolveWorkflowStatusFilter(execution)
  });

  const actions: AgentExecutionFollowUpAction[] = [];

  if (execution.execution_mode === "grounded_chat") {
    if (chatHref) {
      actions.push({
        id: "open-chat",
        key: "chat",
        href: chatHref,
        labelKey: "agents.runbook.actions.openChat",
        variant: "default"
      });
    }
    if (documentsHref) {
      actions.push({
        id: "open-documents",
        key: "documents",
        href: documentsHref,
        labelKey: "agents.runbook.actions.openDocuments",
        variant: "outline"
      });
    }
    actions.push({
      id: "open-operations",
      key: "operations",
      href: workflowsHref,
      labelKey: "agents.runbook.actions.openOperations",
      variant: "outline"
    });
  } else if (execution.execution_mode === "document_intake") {
    if (documentsHref) {
      actions.push({
        id: "open-documents",
        key: "documents",
        href: documentsHref,
        labelKey: "agents.runbook.actions.openDocuments",
        variant: "default"
      });
    }
    actions.push({
      id: "open-operations",
      key: "operations",
      href: workflowsHref,
      labelKey: "agents.runbook.actions.openOperations",
      variant: "outline"
    });
    if (chatHref && execution.execution_status === "completed") {
      actions.push({
        id: "open-chat",
        key: "chat",
        href: chatHref,
        labelKey: "agents.runbook.actions.openChat",
        variant: "outline"
      });
    }
  } else {
    actions.push({
      id: "open-operations",
      key: "operations",
      href: workflowsHref,
      labelKey: "agents.runbook.actions.openOperations",
      variant: "default"
    });
    if (documentsHref) {
      actions.push({
        id: "open-documents",
        key: "documents",
        href: documentsHref,
        labelKey: "agents.runbook.actions.openDocuments",
        variant: "outline"
      });
    }
    if (chatHref && execution.execution_status === "completed") {
      actions.push({
        id: "open-chat",
        key: "chat",
        href: chatHref,
        labelKey: "agents.runbook.actions.openChat",
        variant: "outline"
      });
    }
  }

  if (actions.length === 0) {
    if (execution.execution_mode === "workflow_recovery") {
      actions.push({
        id: "open-operations-fallback",
        key: "operations",
        href: buildOperationsHref({
          tenantId: execution.tenant_id,
          agentId: execution.agent_definition_id,
          lane: execution.execution_status === "failed" ? "failed" : "overview",
          status: execution.execution_status === "failed" ? "failed" : "all"
        }),
        labelKey: "agents.runbook.actions.openOperations",
        variant: "default"
      });
    } else {
      actions.push({
        id: "open-agents-fallback",
        key: "agents",
        href: buildAgentsHref({
          tenantId: execution.tenant_id,
          agentId: execution.agent_definition_id
        }),
        labelKey: "admin.agentExecutions.openAgents",
        variant: "default"
      });
    }
  }

  return uniqueActions(actions);
}
