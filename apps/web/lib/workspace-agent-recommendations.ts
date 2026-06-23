import type {
  BootstrapState,
  DocumentDetail,
  WorkspaceAgentContext,
  WorkspaceAgentRecommendation,
  WorkspaceAgentRecommendationReason,
  WorkspaceView,
  WorkflowRun,
  WorkflowRunDetail,
} from "@/components/workspace/workspace-types";

type RecommendationContext =
  | {
      type: "document";
      bootstrap: BootstrapState;
      detail: DocumentDetail | null;
      relatedWorkflowRuns?: WorkflowRun[];
    }
  | {
      type: "workflow";
      bootstrap: BootstrapState;
      detail: WorkflowRunDetail | null;
    };

function normalizeScopeValue(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function matchesKnowledgeBaseScope(scope: string | null, bootstrap: BootstrapState) {
  const normalizedScope = normalizeScopeValue(scope);
  if (!normalizedScope) {
    return true;
  }

  const candidateValues = [
    bootstrap.knowledgeBase.id,
    bootstrap.knowledgeBase.slug,
    bootstrap.knowledgeBase.name,
    bootstrap.workspace.id,
    bootstrap.workspace.slug,
    bootstrap.workspace.name,
  ].map((value) => normalizeScopeValue(value));

  return candidateValues.includes(normalizedScope);
}

function resolveTargetView(mode: WorkspaceAgentContext["mode"]): WorkspaceView {
  if (mode === "grounded_chat") {
    return "chat";
  }

  if (mode === "document_intake") {
    return "documents";
  }

  return "workflows";
}

function buildDocumentSignal(
  detail: DocumentDetail | null,
  relatedWorkflowRuns: WorkflowRun[] | undefined
): WorkspaceAgentRecommendationReason {
  const latestWorkflowRun = relatedWorkflowRuns?.[0] ?? null;
  const workflowFailed =
    latestWorkflowRun?.workflow_status === "failed" ||
    detail?.document.latest_workflow_status === "failed";
  const documentFailed =
    detail?.document.ingestion_status === "failed" ||
    detail?.document.indexing_status === "failed";

  if (workflowFailed || documentFailed) {
    return "document-needs-recovery";
  }

  const documentReady =
    detail?.document.ingestion_status === "completed" &&
    detail?.document.indexing_status === "completed";

  return documentReady ? "document-ready-for-grounded-chat" : "document-needs-intake";
}

function buildWorkflowSignal(detail: WorkflowRunDetail | null): WorkspaceAgentRecommendationReason {
  if (detail?.workflow_status === "failed") {
    return "workflow-failed";
  }

  if (detail && ["pending", "queued", "running"].includes(detail.workflow_status)) {
    return "workflow-in-progress";
  }

  return "workflow-completed";
}

function scoreRecommendation(
  agent: WorkspaceAgentContext,
  signal: WorkspaceAgentRecommendationReason
) {
  if (signal === "document-needs-recovery" || signal === "workflow-failed") {
    if (agent.mode === "workflow_recovery") {
      return 100;
    }
    if (agent.mode === "document_intake") {
      return 72;
    }
    return 48;
  }

  if (signal === "document-needs-intake" || signal === "workflow-in-progress") {
    if (agent.mode === "document_intake") {
      return 100;
    }
    if (agent.mode === "workflow_recovery") {
      return 74;
    }
    return 50;
  }

  if (agent.mode === "grounded_chat") {
    return 100;
  }
  if (agent.mode === "document_intake") {
    return 68;
  }
  return 52;
}

export function buildWorkspaceAgentRecommendations(options: {
  activeAgentId: string | null;
  agents: WorkspaceAgentContext[];
  context: RecommendationContext;
  limit?: number;
}): WorkspaceAgentRecommendation[] {
  const { activeAgentId, agents, context, limit = 3 } = options;
  const signal =
    context.type === "document"
      ? buildDocumentSignal(context.detail, context.relatedWorkflowRuns)
      : buildWorkflowSignal(context.detail);

  return agents
    .filter((agent) => agent.status === "active" && agent.id !== activeAgentId)
    .map((agent) => {
      const scopeMatched = matchesKnowledgeBaseScope(agent.knowledge_base_scope, context.bootstrap);
      const baseScore = scoreRecommendation(agent, signal);
      const scopeScore = scopeMatched ? 18 : -14;
      const toolScore = agent.tools.length > 0 ? 4 : 0;

      return {
        agent,
        reason: signal,
        score: baseScore + scopeScore + toolScore,
        scopeMatched,
        capabilityCount: agent.tools.length,
        targetView: resolveTargetView(agent.mode),
      };
    })
    .filter((recommendation) => recommendation.score > 0)
    .sort((left, right) => right.score - left.score || left.agent.name.localeCompare(right.agent.name))
    .slice(0, limit);
}
