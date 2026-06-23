"use client";

import {
  formatDateTimeWithYear,
  formatDurationRange,
  formatStatusLabel,
  formatSubjectTypeLabel,
  formatTimestamp,
  formatWorkflowStepLabel,
  formatWorkflowTypeLabel,
  getStatusBadgeClass
} from "../../lib/workspace-formatters";
import { formatOperatorErrorMessage } from "../../lib/api-errors";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkspaceExecutionPacket } from "@/components/workspace/WorkspaceExecutionPacket";
import { WorkspaceRecommendedAgentsPanel } from "@/components/workspace/WorkspaceRecommendedAgentsPanel";
import { useI18n } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";
import type { WorkspaceAgentRecommendation, WorkspaceView } from "@/components/workspace/workspace-types";

type WorkflowStep = {
  id: string;
  step_name: string;
  step_status: string;
  attempt_count: number;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

type WorkflowRunSummary = {
  id: string;
  workflow_status: string;
  subject_label?: string | null;
};

type WorkflowRunDetail = {
  id: string;
  workflow_type: string;
  workflow_status: string;
  temporal_workflow_id: string | null;
  retry_of_workflow_run_id?: string | null;
  subject_type: string | null;
  subject_id: string | null;
  subject_label: string | null;
  error_message: string | null;
  recovery_stage:
    | "retry_available"
    | "retry_blocked_document_deleted"
    | "retry_blocked_document_missing"
    | "retry_blocked_unsupported"
    | "active_monitoring"
    | "completed_ready_for_chat"
    | "review_workflow"
    | null;
  recommended_next_view: "chat" | "documents" | "workflows" | null;
  recommended_primary_action:
    | "retry_workflow"
    | "open_workflows"
    | "open_document"
    | "open_chat"
    | "monitor_workflow"
    | null;
  follow_up_reason: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  input_json: Record<string, unknown>;
  steps: WorkflowStep[];
};

type SelectedWorkflowRunPanelProps = {
  detail: WorkflowRunDetail | null;
  emptyStepsMessage?: string;
  emptyState: string;
  isRetryAvailable?: boolean;
  isRetryEligibilityLoading?: boolean;
  isRetryingWorkflow: boolean;
  onSelectDocument?: (documentId: string) => void | Promise<void>;
  onRetryWorkflowRun: () => void | Promise<void>;
  retryDisabledReason?: string | null;
  retryHelpText?: string | null;
  recommendedAgents?: WorkspaceAgentRecommendation[];
  onSelectWorkflowRun?: (workflowRunId: string) => void | Promise<void>;
  selectedWorkflowChildRuns?: WorkflowRunSummary[];
  selectedWorkflowParentRun?: WorkflowRunSummary | null;
  showWorkflowInput?: boolean;
  showWorkflowLineage?: boolean;
  onActivateRecommendedAgent?: (recommendation: WorkspaceAgentRecommendation) => void | Promise<void>;
  onOpenChatView?: () => void | Promise<void>;
  onOpenDocumentsView?: () => void | Promise<void>;
  onOpenWorkflowView?: () => void | Promise<void>;
  title?: string;
};

export function SelectedWorkflowRunPanel({
  detail,
  emptyStepsMessage,
  emptyState,
  isRetryAvailable = true,
  isRetryEligibilityLoading = false,
  isRetryingWorkflow,
  onSelectDocument,
  onRetryWorkflowRun,
  retryDisabledReason = null,
  retryHelpText = null,
  recommendedAgents = [],
  onSelectWorkflowRun,
  selectedWorkflowChildRuns = [],
  selectedWorkflowParentRun = null,
  showWorkflowInput = false,
  showWorkflowLineage = false,
  onActivateRecommendedAgent,
  onOpenChatView,
  onOpenDocumentsView,
  onOpenWorkflowView,
  title,
}: SelectedWorkflowRunPanelProps) {
  const { t } = useI18n();
  const topRecommendation = recommendedAgents[0] ?? null;

  function getRecommendationActionLabel(targetView: "chat" | "documents" | "workflows") {
    if (targetView === "chat") {
      return t("workspace.selectedWorkflow.activateInChat");
    }

    if (targetView === "documents") {
      return t("workspace.selectedWorkflow.activateInDocuments");
    }

    return t("workspace.selectedWorkflow.activateInWorkflows");
  }

  function resolveExecutionPacketTone() {
    if (!detail) {
      return "review" as const;
    }

    if (detail.workflow_status === "failed") {
      return "attention" as const;
    }

    if (detail.workflow_status === "completed") {
      return "healthy" as const;
    }

    return "review" as const;
  }

  function resolveRecommendedView(): WorkspaceView | null {
    if (topRecommendation) {
      return topRecommendation.targetView;
    }

    if (!detail) {
      return null;
    }

    if (detail.recommended_next_view) {
      return detail.recommended_next_view;
    }

    if (detail.workflow_status === "completed") {
      return "chat";
    }

    return "workflows";
  }

  function resolveExecutionPacketState() {
    if (!detail) {
      return t("workspace.selectedWorkflow.packet.pendingState");
    }

    if (detail.workflow_status === "failed") {
      return t("workspace.selectedWorkflow.packet.failedState");
    }

    if (detail.workflow_status === "completed") {
      return t("workspace.selectedWorkflow.packet.completedState");
    }

    return t("workspace.selectedWorkflow.packet.activeState");
  }

  function resolveExecutionPacketDescription() {
    if (!detail) {
      return t("workspace.selectedWorkflow.packet.pendingDescription");
    }

    if (detail.workflow_status === "failed") {
      return t("workspace.selectedWorkflow.packet.failedDescription");
    }

    if (detail.workflow_status === "completed") {
      return t("workspace.selectedWorkflow.packet.completedDescription");
    }

    return t("workspace.selectedWorkflow.packet.activeDescription");
  }

  function buildExecutionPacketPrimaryAction() {
    if (!detail) {
      return null;
    }

    if (topRecommendation && onActivateRecommendedAgent) {
      return {
        label: getRecommendationActionLabel(topRecommendation.targetView),
        onClick: () => onActivateRecommendedAgent(topRecommendation),
      };
    }

    if (detail.recommended_primary_action === "retry_workflow" && detail.workflow_status === "failed") {
      return {
        label: t("workspace.selectedWorkflow.retryRun"),
        onClick: onRetryWorkflowRun,
      };
    }

    if (detail.recommended_primary_action === "open_chat" && onOpenChatView) {
      return {
        label: t("workspace.selectedWorkflow.continueInChat"),
        onClick: onOpenChatView,
      };
    }

    if (detail.recommended_primary_action === "open_document" && detail.subject_type === "document" && detail.subject_id && onSelectDocument) {
      return {
        label: t("workspace.selectedWorkflow.openDocument"),
        onClick: () => onSelectDocument(detail.subject_id!),
        variant: "outline" as const,
      };
    }

    if (
      (detail.recommended_primary_action === "open_workflows" || detail.recommended_primary_action === "monitor_workflow") &&
      onOpenWorkflowView
    ) {
      return {
        label: t("workspace.selectedWorkflow.openWorkflowSupervision"),
        onClick: onOpenWorkflowView,
        variant: "outline" as const,
      };
    }

    if (detail.workflow_status === "failed" && onOpenWorkflowView) {
      return {
        label: t("workspace.selectedWorkflow.openWorkflowSupervision"),
        onClick: onOpenWorkflowView,
        variant: "outline" as const,
      };
    }

    if (detail.workflow_status === "completed" && onOpenChatView) {
      return {
        label: t("workspace.selectedWorkflow.continueInChat"),
        onClick: onOpenChatView,
      };
    }

    if (detail.subject_type === "document" && detail.subject_id && onSelectDocument) {
      return {
        label: t("workspace.selectedWorkflow.openDocument"),
        onClick: () => onSelectDocument(detail.subject_id!),
        variant: "outline" as const,
      };
    }

    return null;
  }

  function buildExecutionPacketSecondaryActions() {
    const actions: Array<{ label: string; onClick: () => void | Promise<void>; variant?: "default" | "outline" }> = [];
    const primaryAction = buildExecutionPacketPrimaryAction();

    if (detail?.subject_type === "document" && detail.subject_id && onSelectDocument && primaryAction?.label !== t("workspace.selectedWorkflow.openDocument")) {
      actions.push({
        label: t("workspace.selectedWorkflow.openDocument"),
        onClick: () => onSelectDocument(detail.subject_id!),
        variant: "outline",
      });
    }

    if (onOpenWorkflowView && primaryAction?.label !== t("workspace.selectedWorkflow.openWorkflowSupervision")) {
      actions.push({
        label: t("workspace.selectedWorkflow.openWorkflowSupervision"),
        onClick: onOpenWorkflowView,
        variant: "outline",
      });
    }

    if (detail?.workflow_status === "completed" && onOpenDocumentsView && primaryAction?.label !== t("workspace.selectedWorkflow.continueInDocuments")) {
      actions.push({
        label: t("workspace.selectedWorkflow.continueInDocuments"),
        onClick: onOpenDocumentsView,
        variant: "outline",
      });
    }

    return actions;
  }

  function renderNextStepPanel() {
    if (!detail) {
      return null;
    }

    if (detail.workflow_status === "failed") {
      return (
        <div className="rounded-md border border-rose-200 bg-rose-50/70 px-3 py-3 text-xs text-slate-700">
          <div className="font-medium text-slate-950">{t("workspace.selectedWorkflow.failedFollowUpTitle")}</div>
          <div className="mt-1 text-slate-600">
            {detail.follow_up_reason ?? t("workspace.selectedWorkflow.failedFollowUpDescription")}
          </div>
        </div>
      );
    }

    if (detail.workflow_status === "queued" || detail.workflow_status === "running" || detail.workflow_status === "pending") {
      return (
        <div className="rounded-md border border-sky-200 bg-sky-50/70 px-3 py-3 text-xs text-slate-700">
          <div className="font-medium text-slate-950">{t("workspace.selectedWorkflow.activeFollowUpTitle")}</div>
          <div className="mt-1 text-slate-600">
            {detail.follow_up_reason ?? t("workspace.selectedWorkflow.activeFollowUpDescription")}
          </div>
        </div>
      );
    }

    if (detail.workflow_status === "completed") {
      return (
        <div className="rounded-md border border-emerald-200 bg-emerald-50/70 px-3 py-3 text-xs text-slate-700">
          <div className="font-medium text-slate-950">{t("workspace.selectedWorkflow.completedFollowUpTitle")}</div>
          <div className="mt-1 text-slate-600">
            {detail.follow_up_reason ?? t("workspace.selectedWorkflow.completedFollowUpDescription")}
          </div>
        </div>
      );
    }

    return null;
  }

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle>{title ?? t("workspace.selectedWorkflow.selectedWorkflowRun")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-slate-700">
        {detail ? (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-medium text-slate-900">{formatWorkflowTypeLabel(detail.workflow_type)}</div>
                <div className="mt-1 text-xs text-slate-500">{detail.id}</div>
              </div>
              <div className="flex items-center gap-2">
                {detail.subject_type === "document" && detail.subject_id && onSelectDocument ? (
                  <Button onClick={() => void onSelectDocument(detail.subject_id!)} size="sm" type="button" variant="outline">
                    {t("workspace.selectedWorkflow.openDocument")}
                  </Button>
                ) : null}
                {detail.workflow_status === "failed" && (
                  <Button
                    disabled={isRetryingWorkflow || !isRetryAvailable || isRetryEligibilityLoading}
                    onClick={() => void onRetryWorkflowRun()}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    {isRetryEligibilityLoading ? t("workspace.selectedWorkflow.checkingRetry") : t("workspace.selectedWorkflow.retryRun")}
                  </Button>
                )}
                <Badge className={cn("border", getStatusBadgeClass(detail.workflow_status))} variant="outline">
                  {formatStatusLabel(detail.workflow_status)}
                </Badge>
              </div>
            </div>
            {detail.workflow_status === "failed" && retryDisabledReason ? (
              <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-3 text-xs text-rose-700">{retryDisabledReason}</div>
            ) : null}
            {detail.workflow_status === "failed" && retryHelpText ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-800">{retryHelpText}</div>
            ) : null}
            <WorkspaceExecutionPacket
              capabilityCount={topRecommendation?.capabilityCount ?? null}
              currentView="workflows"
              description={resolveExecutionPacketDescription()}
              primaryAction={buildExecutionPacketPrimaryAction()}
              recommendedView={resolveRecommendedView()}
              scopeMatched={topRecommendation?.scopeMatched ?? null}
              secondaryActions={buildExecutionPacketSecondaryActions()}
              stateSummary={resolveExecutionPacketState()}
              subject={detail.subject_label ?? detail.subject_id ?? formatWorkflowTypeLabel(detail.workflow_type)}
              tone={resolveExecutionPacketTone()}
            />
            {renderNextStepPanel()}
            {recommendedAgents.length > 0 && onActivateRecommendedAgent ? (
              <WorkspaceRecommendedAgentsPanel
                description={t("workspace.selectedWorkflow.recommendedAgentsDescription")}
                getActionLabel={getRecommendationActionLabel}
                onActivateRecommendation={onActivateRecommendedAgent}
                recommendations={recommendedAgents}
                title={t("workspace.selectedWorkflow.recommendedAgents")}
              />
            ) : null}
            {showWorkflowLineage && detail.retry_of_workflow_run_id && (
              <div className="rounded-md bg-white px-3 py-3 text-xs text-slate-600">
                <div className="font-medium text-slate-900">{t("workspace.selectedWorkflow.retryOf")}</div>
                <div className="mt-1 break-all">{detail.retry_of_workflow_run_id}</div>
              </div>
            )}
            {showWorkflowLineage && (selectedWorkflowParentRun || selectedWorkflowChildRuns.length > 0) && onSelectWorkflowRun && (
              <div className="rounded-md bg-white px-3 py-3 text-xs text-slate-600">
                <div className="font-medium text-slate-900">{t("workspace.selectedWorkflow.workflowLineage")}</div>
                {selectedWorkflowParentRun && (
                  <Button
                    className="mt-2 block h-auto w-full rounded-md border-slate-200 bg-slate-50 px-3 py-2 text-left hover:bg-slate-100"
                    onClick={() => void onSelectWorkflowRun(selectedWorkflowParentRun.id)}
                    size={null}
                    type="button"
                    variant="outline"
                  >
                    <div className="font-medium text-slate-900">{t("workspace.selectedWorkflow.parentRetrySource")}</div>
                    <div className="mt-1 break-all">{selectedWorkflowParentRun.id}</div>
                    <div className="mt-1 text-slate-500">{formatStatusLabel(selectedWorkflowParentRun.workflow_status)}</div>
                  </Button>
                )}
                {selectedWorkflowChildRuns.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <div className="font-medium text-slate-900">{t("workspace.selectedWorkflow.spawnedRetries")}</div>
                    {selectedWorkflowChildRuns.map((workflowRun) => (
                      <Button
                        key={workflowRun.id}
                        className="block h-auto w-full rounded-md border-slate-200 bg-slate-50 px-3 py-2 text-left hover:bg-slate-100"
                        onClick={() => void onSelectWorkflowRun(workflowRun.id)}
                        size={null}
                        type="button"
                        variant="outline"
                      >
                        <div className="break-all">{workflowRun.id}</div>
                        <div className="mt-1 text-slate-500">{formatStatusLabel(workflowRun.workflow_status)}</div>
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-md bg-white px-2 py-2">
                <div className="text-slate-500">{t("workspace.selectedWorkflow.subject")}</div>
                <div className="mt-1 break-all font-medium text-slate-900">{formatSubjectTypeLabel(detail.subject_type) ?? t("workspace.selectedWorkflow.notAvailable")}</div>
              </div>
              <div className="rounded-md bg-white px-2 py-2">
                <div className="text-slate-500">{t("workspace.selectedWorkflow.steps")}</div>
                <div className="mt-1 font-medium text-slate-900">{detail.steps.length}</div>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
              <div className="rounded-md bg-white px-3 py-3">
                <div className="text-slate-500">{t("workspace.selectedWorkflow.created")}</div>
                <div className="mt-1 font-medium text-slate-900">{formatDateTimeWithYear(detail.created_at)}</div>
              </div>
              <div className="rounded-md bg-white px-3 py-3">
                <div className="text-slate-500">{t("workspace.selectedWorkflow.updated")}</div>
                <div className="mt-1 font-medium text-slate-900">{formatDateTimeWithYear(detail.updated_at)}</div>
              </div>
              <div className="rounded-md bg-white px-3 py-3">
                <div className="text-slate-500">{t("workspace.selectedWorkflow.subjectId")}</div>
                <div className="mt-1 break-all font-medium text-slate-900">{detail.subject_id ?? t("workspace.selectedWorkflow.unbound")}</div>
              </div>
              <div className="rounded-md bg-white px-3 py-3">
                <div className="text-slate-500">{t("workspace.selectedWorkflow.subjectLabel")}</div>
                <div className="mt-1 break-all font-medium text-slate-900">{detail.subject_label ?? t("workspace.selectedWorkflow.notAvailable")}</div>
              </div>
              <div className="rounded-md bg-white px-3 py-3">
                <div className="text-slate-500">{t("workspace.selectedWorkflow.temporalWorkflowId")}</div>
                <div className="mt-1 break-all font-medium text-slate-900">{detail.temporal_workflow_id ?? t("workspace.selectedWorkflow.notAvailable")}</div>
              </div>
              <div className="rounded-md bg-white px-3 py-3">
                <div className="text-slate-500">{t("workspace.selectedWorkflow.started")}</div>
                <div className="mt-1 font-medium text-slate-900">
                  {detail.started_at ? formatTimestamp(detail.started_at) : t("workspace.selectedWorkflow.notStarted")}
                </div>
              </div>
              <div className="rounded-md bg-white px-3 py-3">
                <div className="text-slate-500">{t("workspace.selectedWorkflow.completed")}</div>
                <div className="mt-1 font-medium text-slate-900">
                  {detail.completed_at ? formatTimestamp(detail.completed_at) : t("workspace.selectedWorkflow.notCompleted")}
                </div>
              </div>
              <div className="rounded-md bg-white px-3 py-3">
                <div className="text-slate-500">{t("workspace.selectedWorkflow.runtime")}</div>
                <div className="mt-1 font-medium text-slate-900">
                  {formatDurationRange(detail.started_at, detail.completed_at)}
                </div>
              </div>
            </div>
            {detail.error_message && (
              <div className="rounded-md bg-rose-50 px-3 py-3 text-xs text-rose-700">
                {formatOperatorErrorMessage(detail.error_message)}
              </div>
            )}
            <div className="space-y-2">
              {detail.steps.map((step) => (
                <div key={step.id} className="rounded-md bg-white px-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">{formatWorkflowStepLabel(step.step_name)}</div>
                    <Badge className={cn("border text-[11px]", getStatusBadgeClass(step.step_status))} variant="outline">
                      {formatStatusLabel(step.step_status)}
                    </Badge>
                  </div>
                  <div className="mt-2 grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
                    <div>{t("workspace.selectedWorkflow.attempt", { count: String(step.attempt_count) })}</div>
                    <div>{t("workspace.selectedWorkflow.runtimeValue", { value: formatDurationRange(step.started_at, step.completed_at) })}</div>
                    <div>{step.started_at ? t("workspace.selectedWorkflow.startedValue", { value: formatTimestamp(step.started_at) }) : t("workspace.selectedWorkflow.notStarted")}</div>
                    <div>{step.completed_at ? t("workspace.selectedWorkflow.completedValue", { value: formatTimestamp(step.completed_at) }) : t("workspace.selectedWorkflow.notCompleted")}</div>
                  </div>
                  {step.error_message && (
                    <div className="mt-2 rounded-md bg-rose-50 px-2 py-2 text-xs text-rose-700">
                      {formatOperatorErrorMessage(step.error_message)}
                    </div>
                  )}
                </div>
              ))}
              {emptyStepsMessage && detail.steps.length === 0 && (
                <div className="rounded-md bg-white px-3 py-3 text-sm text-slate-500">{emptyStepsMessage}</div>
              )}
            </div>
            {showWorkflowInput && (
              <div className="rounded-md bg-white px-3 py-3">
                <div className="mb-2 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">{t("workspace.selectedWorkflow.workflowInput")}</div>
                <pre className="overflow-x-auto whitespace-pre-wrap break-all text-xs leading-6 text-slate-700">
                  {JSON.stringify(detail.input_json, null, 2)}
                </pre>
              </div>
            )}
          </>
        ) : (
          <div className="text-sm text-slate-500">{emptyState}</div>
        )}
      </CardContent>
    </Card>
  );
}
