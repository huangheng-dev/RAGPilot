import type { WorkflowRun, WorkflowRunDetail } from "@/components/workspace/workspace-types";

type WorkflowRunLike = Pick<WorkflowRun, "workflow_status" | "created_at">;

type WorkflowSubjectLike = Pick<WorkflowRun, "subject_type">;

export type WorkflowFollowUpStage = "recovery" | "monitoring" | "ready" | "cancelled" | "unknown";

export function getWorkflowFollowUpPriority(workflowStatus: string) {
  if (workflowStatus === "failed" || workflowStatus === "cancelled") {
    return 0;
  }

  if (workflowStatus === "queued" || workflowStatus === "running" || workflowStatus === "pending") {
    return 1;
  }

  if (workflowStatus === "completed") {
    return 2;
  }

  return 3;
}

export function sortWorkflowRunsForFollowUp<T extends WorkflowRunLike>(workflowRuns: T[]) {
  return [...workflowRuns].sort((left, right) => {
    const priorityDifference = getWorkflowFollowUpPriority(left.workflow_status) - getWorkflowFollowUpPriority(right.workflow_status);
    if (priorityDifference !== 0) {
      return priorityDifference;
    }

    return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
  });
}

export function selectPreferredWorkflowRun<T extends WorkflowRunLike>(workflowRuns: T[]) {
  return sortWorkflowRunsForFollowUp(workflowRuns)[0] ?? null;
}

export function selectPreferredWorkflowRunId(workflowRuns: Array<Pick<WorkflowRun, "id" | "workflow_status" | "created_at">>) {
  return selectPreferredWorkflowRun(workflowRuns)?.id ?? null;
}

export function resolveWorkflowFollowUpStage(workflowStatus: string | null | undefined): WorkflowFollowUpStage {
  if (workflowStatus === "failed") {
    return "recovery";
  }

  if (workflowStatus === "cancelled") {
    return "cancelled";
  }

  if (workflowStatus === "queued" || workflowStatus === "running" || workflowStatus === "pending") {
    return "monitoring";
  }

  if (workflowStatus === "completed") {
    return "ready";
  }

  return "unknown";
}

export function resolveWorkflowSurfaceGuidance(
  workflowRun: Pick<WorkflowRunDetail, "subject_type" | "workflow_status"> | Pick<WorkflowRun, "subject_type" | "workflow_status"> | null
) {
  if (!workflowRun) {
    return {
      stage: "unknown" as WorkflowFollowUpStage,
      showDocuments: false,
      showWorkflows: false,
    };
  }

  const stage = resolveWorkflowFollowUpStage(workflowRun.workflow_status);
  const showDocuments =
    workflowRun.subject_type === "document" &&
    (stage === "recovery" || stage === "monitoring" || stage === "cancelled");
  const showWorkflows = stage === "recovery" || stage === "monitoring" || stage === "cancelled";

  return {
    stage,
    showDocuments,
    showWorkflows,
  };
}
