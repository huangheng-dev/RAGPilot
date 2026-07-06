"use client";

import {
  applyMcpConnectorGovernanceAction,
  applyModelEndpointGovernanceAction,
  applyToolGovernanceAction,
  type PlatformMcpConnector,
  type RuntimeGovernanceEvent,
  type RuntimeGovernanceWorklistItem
} from "@/lib/platform-governance";
import type { RuntimeGovernanceFocusState } from "@/lib/runtime-governance";

export type RuntimeGovernanceQuickActionKey =
  | "enable_model_endpoint"
  | "allow_direct_tool_use"
  | "enable_tool_registration"
  | "ready_mcp_integration"
  | "enable_mcp_connector";

export type RuntimeGovernanceQuickActionDescriptor = {
  key: string;
  label: string;
  actionKey: RuntimeGovernanceQuickActionKey;
  resourceId: string;
};

function readRuntimeGovernanceDetailBoolean(detail: Record<string, unknown>, key: string) {
  const value = detail[key];
  return typeof value === "boolean" ? value : null;
}

export function isRuntimeGovernanceMcpConnectorReady(
  connector:
    | Pick<
        PlatformMcpConnector,
        "connector_type" | "auth_mode" | "base_url" | "credential_key_hint" | "is_enabled"
      >
    | null
    | undefined
) {
  if (!connector || !connector.is_enabled) {
    return false;
  }
  if (connector.connector_type === "managed_reserved" || connector.auth_mode === "managed_reserved") {
    return false;
  }
  if ((connector.connector_type === "streamable_http" || connector.connector_type === "sse") && !connector.base_url?.trim()) {
    return false;
  }
  if (connector.auth_mode === "environment" && !connector.credential_key_hint?.trim()) {
    return false;
  }
  return true;
}

export function resolveRuntimeGovernanceWorklistQuickAction(
  item: RuntimeGovernanceWorklistItem
): RuntimeGovernanceQuickActionKey | null {
  if (item.category === "disabled_bound_model_endpoint") {
    return "enable_model_endpoint";
  }
  if (item.category === "approval_required_tool") {
    return "allow_direct_tool_use";
  }
  if (item.category === "mcp_integration_pending_tool") {
    return readRuntimeGovernanceDetailBoolean(item.detail, "connector_runtime_ready") === true
      ? "ready_mcp_integration"
      : null;
  }
  if (item.category === "integration_blocked_connector") {
    return readRuntimeGovernanceDetailBoolean(item.detail, "is_enabled") === false
      ? "enable_mcp_connector"
      : null;
  }
  return null;
}

export function resolveRuntimeGovernanceEventQuickAction(
  event: RuntimeGovernanceEvent
): RuntimeGovernanceQuickActionKey | null {
  if (event.resource_type === "model_endpoint" && event.action_type === "disable_endpoint" && event.resource_id) {
    return "enable_model_endpoint";
  }
  if (event.resource_type === "tool_registration" && event.action_type === "require_admin_approval" && event.resource_id) {
    return "allow_direct_tool_use";
  }
  if (event.resource_type === "tool_registration" && event.action_type === "disable_tool" && event.resource_id) {
    return "enable_tool_registration";
  }
  if (event.resource_type === "mcp_connector" && event.action_type === "disable_connector" && event.resource_id) {
    return "enable_mcp_connector";
  }
  return null;
}

export function getRuntimeGovernanceQuickActionLabel(
  quickActionKey: RuntimeGovernanceQuickActionKey,
  t: (key: string, variables?: Record<string, string>) => string
) {
  if (quickActionKey === "enable_model_endpoint") {
    return t("admin.runtimeQueue.actions.enableModelEndpoint");
  }
  if (quickActionKey === "allow_direct_tool_use") {
    return t("admin.runtimeQueue.actions.allowDirectToolUse");
  }
  if (quickActionKey === "enable_tool_registration") {
    return t("admin.runtimeQueue.actions.enableToolRegistration");
  }
  if (quickActionKey === "ready_mcp_integration") {
    return t("admin.runtimeQueue.actions.readyMcpIntegration");
  }
  return t("admin.runtimeQueue.actions.enableMcpConnector");
}

export function buildRuntimeGovernanceQuickActions(
  item: RuntimeGovernanceFocusState | null | undefined,
  t: (key: string, variables?: Record<string, string>) => string
): RuntimeGovernanceQuickActionDescriptor[] {
  if (!item) {
    return [];
  }

  const actions: RuntimeGovernanceQuickActionDescriptor[] = [];
  const seen = new Set<string>();

  const pushAction = (actionKey: RuntimeGovernanceQuickActionKey, resourceId: string | null | undefined) => {
    if (!resourceId) {
      return;
    }

    const token = `${actionKey}:${resourceId}`;
    if (seen.has(token)) {
      return;
    }

    seen.add(token);
    actions.push({
      key: token,
      label: getRuntimeGovernanceQuickActionLabel(actionKey, t),
      actionKey,
      resourceId
    });
  };

  if (item.resolved_model_endpoint && !item.resolved_model_endpoint.is_enabled) {
    pushAction("enable_model_endpoint", item.resolved_model_endpoint.id);
  }

  pushAction("enable_tool_registration", item.disabled_tool_registration_id);
  pushAction("allow_direct_tool_use", item.approval_required_tool_registration_id);

  if (item.focus_mcp_connector && !item.focus_mcp_connector.is_enabled) {
    pushAction("enable_mcp_connector", item.focus_mcp_connector.id);
  }

  if (
    item.integration_pending_mcp_tool_registration_id &&
    isRuntimeGovernanceMcpConnectorReady(item.focus_mcp_connector)
  ) {
    pushAction("ready_mcp_integration", item.integration_pending_mcp_tool_registration_id);
  }

  return actions;
}

export async function applyRuntimeGovernanceQuickAction(
  resourceId: string,
  quickActionKey: RuntimeGovernanceQuickActionKey
) {
  if (quickActionKey === "enable_model_endpoint") {
    return await applyModelEndpointGovernanceAction(resourceId, "enable_endpoint");
  }
  if (quickActionKey === "allow_direct_tool_use") {
    return await applyToolGovernanceAction(resourceId, "allow_direct_use");
  }
  if (quickActionKey === "enable_tool_registration") {
    return await applyToolGovernanceAction(resourceId, "enable_tool");
  }
  if (quickActionKey === "ready_mcp_integration") {
    return await applyToolGovernanceAction(resourceId, "ready_mcp_integration");
  }
  return await applyMcpConnectorGovernanceAction(resourceId, "enable_connector");
}
