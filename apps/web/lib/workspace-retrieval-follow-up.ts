import { buildAdminHref, buildSettingsHref, type ConsoleHref } from "@/lib/console-route-builders";
import { buildWorkspaceHref, type WorkspaceSourceSurface } from "@/lib/workspace-navigation";

type RetrievalFollowUpActionRecord = {
  action_key:
    | "review_knowledge_base_governance"
    | "review_retrieval_profile_governance"
    | "rerun_retrieval_inspection"
    | "rerun_retrieval_comparison"
    | "validate_in_chat";
  action_reason: string;
};

export type RetrievalFollowUpActionDescriptor = {
  href?: ConsoleHref;
  key: string;
  label: string;
  onClick?: () => void;
  reason: string;
  variant?: "default" | "outline";
};

export function buildWorkspaceRetrievalFollowUpActions(options: {
  sourceKey: string;
  actions: RetrievalFollowUpActionRecord[];
  queryText: string | null;
  tenantId: string | null;
  workspaceId: string | null;
  knowledgeBaseId: string | null;
  retrievalProfileId: string | null;
  t: (key: string, variables?: Record<string, string>) => string;
  onOpenChatWithQuery?: (query: string) => void;
  onRunComparison?: (query: string) => void;
  onRunInspection?: (query: string) => void;
}) {
  const actions: RetrievalFollowUpActionDescriptor[] = [];
  const normalizedQuery = options.queryText?.trim() ?? "";
  const prioritizedActionRecords = [...options.actions].sort(
    (left, right) => readFollowUpActionPriority(left.action_key) - readFollowUpActionPriority(right.action_key)
  );
  const resumeWorkspaceHref = buildRetrievalValidationWorkspaceHref({
    knowledgeBaseId: options.knowledgeBaseId,
    queryText: normalizedQuery,
    tenantId: options.tenantId,
    workspaceId: options.workspaceId,
  });

  for (const action of prioritizedActionRecords) {
    if (action.action_key === "review_knowledge_base_governance") {
      if (!options.tenantId || !options.knowledgeBaseId) {
        continue;
      }
      actions.push({
        key: `${options.sourceKey}-${action.action_key}`,
        label: options.t("workspace.retrievalInspector.reviewSourceScope"),
        reason: action.action_reason,
        href: buildAdminHref({
          tenantId: options.tenantId,
          section: "directory",
          knowledgeBaseId: options.knowledgeBaseId,
          managementPanel: "knowledge-base-edit",
          resumeWorkspaceHref:
            buildRetrievalValidationWorkspaceHref({
              knowledgeBaseId: options.knowledgeBaseId,
              queryText: normalizedQuery,
              tenantId: options.tenantId,
              workspaceId: options.workspaceId,
              sourceSurface: "admin",
            }) ?? null,
        }),
        variant: "outline",
      });
      continue;
    }

    if (action.action_key === "review_retrieval_profile_governance") {
      actions.push({
        key: `${options.sourceKey}-${action.action_key}`,
        label: options.t("workspace.retrievalInspector.reviewRetrievalProfile"),
        reason: action.action_reason,
        href: buildSettingsHref({
          runtimeResource: "retrieval_profile",
          retrievalProfileId: options.retrievalProfileId,
          resumeWorkspaceHref,
        }),
        variant: "outline",
      });
      continue;
    }

    if (action.action_key === "rerun_retrieval_comparison") {
      if (!normalizedQuery || !options.onRunComparison) {
        continue;
      }
      actions.push({
        key: `${options.sourceKey}-${action.action_key}`,
        label: options.t("workspace.retrievalInspector.compareAgain"),
        reason: action.action_reason,
        onClick: () => options.onRunComparison?.(normalizedQuery),
        variant: "outline",
      });
      continue;
    }

    if (action.action_key === "validate_in_chat") {
      if (!normalizedQuery || !options.onOpenChatWithQuery) {
        continue;
      }
      actions.push({
        key: `${options.sourceKey}-${action.action_key}`,
        label: options.t("workspace.retrievalInspector.openChat"),
        reason: action.action_reason,
        onClick: () => options.onOpenChatWithQuery?.(normalizedQuery),
        variant: "default",
      });
      continue;
    }

    if (!normalizedQuery || !options.onRunInspection) {
      continue;
    }
    actions.push({
      key: `${options.sourceKey}-${action.action_key}`,
      label: options.t("workspace.retrievalInspector.inspectAgain"),
      reason: action.action_reason,
      onClick: () => options.onRunInspection?.(normalizedQuery),
      variant: "outline",
    });
  }

  return actions;
}

function readFollowUpActionPriority(
  actionKey: RetrievalFollowUpActionRecord["action_key"]
) {
  switch (actionKey) {
    case "validate_in_chat":
      return 1;
    case "rerun_retrieval_comparison":
      return 2;
    case "rerun_retrieval_inspection":
      return 3;
    case "review_knowledge_base_governance":
      return 4;
    case "review_retrieval_profile_governance":
      return 5;
    default:
      return 99;
  }
}

function buildRetrievalValidationWorkspaceHref(options: {
  tenantId: string | null;
  workspaceId: string | null;
  knowledgeBaseId: string | null;
  queryText: string;
  sourceSurface?: WorkspaceSourceSurface | null;
}) {
  if (
    !options.tenantId ||
    !options.workspaceId ||
    !options.knowledgeBaseId ||
    !options.queryText.trim()
  ) {
    return null;
  }

  const href = buildWorkspaceHref({
    view: "chat",
    tenantId: options.tenantId,
    workspaceId: options.workspaceId,
    knowledgeBaseId: options.knowledgeBaseId,
    sourceSurface: options.sourceSurface ?? null,
    handoffIntent: "grounded_validation",
    draftQuestion: options.queryText.trim()
  });

  const searchParams = new URLSearchParams(href.query);
  return `${href.pathname}?${searchParams.toString()}`;
}
