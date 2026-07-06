"use client";

import type {
  AgentRuntimeReadinessIssue,
  RuntimeGovernanceFocusState
} from "@/lib/runtime-governance";

type PreviewHealthRecord = {
  last_preview_status: string | null;
  last_preview_at: string | null;
  recent_preview_failed_events: number;
};

type TranslationFn = (key: string, variables?: Record<string, string>) => string;

export function readRuntimeGovernanceToolPreviewLabel(
  tool: PreviewHealthRecord | null | undefined,
  t: TranslationFn,
  formatTimestamp: (value: string) => string,
  messageKey: string
) {
  if (!tool?.last_preview_status || !tool.last_preview_at) {
    return null;
  }

  return t(messageKey, {
    status: t(`settings.tools.previewStatuses.${tool.last_preview_status}`),
    value: formatTimestamp(tool.last_preview_at)
  });
}

export function readRuntimeGovernanceModelPreviewLabel(
  model: PreviewHealthRecord | null | undefined,
  t: TranslationFn,
  formatTimestamp: (value: string) => string,
  messageKey: string
) {
  if (!model?.last_preview_status || !model.last_preview_at) {
    return null;
  }

  return t(messageKey, {
    status: t(`settings.models.previewStatuses.${model.last_preview_status}`),
    value: formatTimestamp(model.last_preview_at)
  });
}

export function readRuntimeGovernanceConnectorPreviewLabel(
  connector: PreviewHealthRecord | null | undefined,
  t: TranslationFn,
  formatTimestamp: (value: string) => string,
  messageKey: string
) {
  if (!connector?.last_preview_status || !connector.last_preview_at) {
    return null;
  }

  return t(messageKey, {
    status: t(`settings.mcpConnectors.previewStatuses.${connector.last_preview_status}`),
    value: formatTimestamp(connector.last_preview_at)
  });
}

export function readRuntimeGovernancePreviewFailureLabel(
  target: PreviewHealthRecord | null | undefined,
  t: TranslationFn,
  messageKey: string
) {
  if (!target || target.recent_preview_failed_events <= 0) {
    return null;
  }

  return t(messageKey, {
    count: String(target.recent_preview_failed_events)
  });
}

export function readRuntimeGovernanceIssueLabel(
  issue: AgentRuntimeReadinessIssue | null | undefined,
  t: TranslationFn
) {
  if (!issue) {
    return null;
  }

  return t(`agents.readiness.issueLabels.${issue}`);
}

export function readRuntimeGovernanceIssueDetail(
  item: RuntimeGovernanceFocusState | null | undefined,
  issue: AgentRuntimeReadinessIssue | null | undefined,
  t: TranslationFn,
  previewContext?: string | null
) {
  if (!item || !issue) {
    return null;
  }

  let detail: string;
  if (issue === "tool_registration_disabled") {
    detail = t("agents.readiness.issues.tool_registration_disabled", {
      count: String(item.disabled_registered_tool_count)
    });
  } else if (issue === "tool_approval_required") {
    detail = t("agents.readiness.issues.tool_approval_required", {
      count: String(item.approval_required_tool_count)
    });
  } else if (issue === "tool_mcp_reserved") {
    detail = t("agents.readiness.issues.tool_mcp_reserved", {
      count: String(item.reserved_mcp_tool_count)
    });
  } else if (issue === "tool_mcp_integration_pending") {
    detail = t("agents.readiness.issues.tool_mcp_integration_pending", {
      count: String(item.integration_pending_mcp_tool_count)
    });
  } else {
    detail = t(`agents.readiness.issues.${issue}`);
  }

  return previewContext ? `${detail} · ${previewContext}` : detail;
}
