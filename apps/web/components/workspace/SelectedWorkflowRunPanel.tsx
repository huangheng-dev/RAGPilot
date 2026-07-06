"use client";

import { useEffect, useMemo, useState } from "react";

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
import { Textarea } from "@/components/ui/textarea";
import { WorkspaceExecutionPacket } from "@/components/workspace/WorkspaceExecutionPacket";
import { WorkspaceRecommendedAgentsPanel } from "@/components/workspace/WorkspaceRecommendedAgentsPanel";
import { useI18n } from "@/lib/i18n/provider";
import { resolveWorkflowFollowUpStage } from "@/lib/workspace-workflow-follow-up";
import { cn } from "@/lib/utils";
import type {
  WorkflowRecoveryAction,
  WorkflowRunDetail,
  WorkspaceAgentRecommendation,
  WorkspaceView
} from "@/components/workspace/workspace-types";

type WorkflowRunSummary = {
  id: string;
  workflow_status: string;
  subject_label?: string | null;
};

type SelectedWorkflowRunPanelProps = {
  detail: WorkflowRunDetail | null;
  emptyStepsMessage?: string;
  emptyState: string;
  isActivatingRecommendation?: boolean;
  isCancellingWorkflow?: boolean;
  isRetryAvailable?: boolean;
  isRetryEligibilityLoading?: boolean;
  isRetryingWorkflow: boolean;
  onCancelWorkflowRun?: () => void | Promise<void>;
  onSelectDocument?: (documentId: string) => void | Promise<void>;
  onRetryWorkflowRun: () => void | Promise<void>;
  onSaveOperatorNotes?: (operatorNotes: string | null) => void | Promise<void>;
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
  canEditOperatorNotes?: boolean;
  isSavingOperatorNotes?: boolean;
  title?: string;
};

type WorkflowPanelAction = {
  key: string;
  disabled?: boolean;
  label: string;
  onClick: () => void | Promise<void>;
  variant?: "default" | "outline";
};

export function SelectedWorkflowRunPanel({
  detail,
  emptyStepsMessage,
  emptyState,
  isActivatingRecommendation = false,
  isCancellingWorkflow = false,
  isRetryAvailable = true,
  isRetryEligibilityLoading = false,
  isRetryingWorkflow,
  onCancelWorkflowRun,
  onSelectDocument,
  onRetryWorkflowRun,
  onSaveOperatorNotes,
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
  canEditOperatorNotes = false,
  isSavingOperatorNotes = false,
  title,
}: SelectedWorkflowRunPanelProps) {
  const { t } = useI18n();
  const topRecommendation = recommendedAgents[0] ?? null;
  const [operatorNotesDraft, setOperatorNotesDraft] = useState("");
  const workflowRecoveryActions = Array.isArray(detail?.recovery_actions) ? detail.recovery_actions : [];
  const workflowSteps = Array.isArray(detail?.steps) ? detail.steps : [];

  useEffect(() => {
    setOperatorNotesDraft(detail?.operator_notes ?? "");
  }, [detail?.id, detail?.operator_notes]);

  const hasOperatorNotesChanges = useMemo(() => {
    const currentNotes = (detail?.operator_notes ?? "").trim();
    return operatorNotesDraft.trim() !== currentNotes;
  }, [detail?.operator_notes, operatorNotesDraft]);

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

    const workflowStage = resolveWorkflowFollowUpStage(detail.workflow_status);

    if (workflowStage === "recovery") {
      return "attention" as const;
    }

    if (workflowStage === "ready") {
      return "healthy" as const;
    }

    if (workflowStage === "cancelled") {
      return "review" as const;
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

    if (resolveWorkflowFollowUpStage(detail.workflow_status) === "ready") {
      return "chat";
    }

    return "workflows";
  }

  function resolveExecutionPacketState() {
    if (!detail) {
      return t("workspace.selectedWorkflow.packet.pendingState");
    }

    const workflowStage = resolveWorkflowFollowUpStage(detail.workflow_status);

    if (workflowStage === "recovery") {
      return t("workspace.selectedWorkflow.packet.failedState");
    }

    if (workflowStage === "ready") {
      return t("workspace.selectedWorkflow.packet.completedState");
    }

    if (workflowStage === "cancelled") {
      return t("workspace.selectedWorkflow.packet.cancelledState");
    }

    return t("workspace.selectedWorkflow.packet.activeState");
  }

  function resolveExecutionPacketDescription() {
    if (!detail) {
      return t("workspace.selectedWorkflow.packet.pendingDescription");
    }

    const workflowStage = resolveWorkflowFollowUpStage(detail.workflow_status);

    if (workflowStage === "recovery") {
      return detail.follow_up_reason ?? t("workspace.selectedWorkflow.packet.failedDescription");
    }

    if (workflowStage === "ready") {
      return detail.follow_up_reason ?? t("workspace.selectedWorkflow.packet.completedDescription");
    }

    if (workflowStage === "cancelled") {
      return detail.follow_up_reason ?? t("workspace.selectedWorkflow.packet.cancelledDescription");
    }

    return detail.follow_up_reason ?? t("workspace.selectedWorkflow.packet.activeDescription");
  }

  function buildExecutionPacketPrimaryAction(): WorkflowPanelAction | null {
    if (!detail) {
      return null;
    }

    const workflowStage = resolveWorkflowFollowUpStage(detail.workflow_status);

    if (topRecommendation && onActivateRecommendedAgent) {
      return {
        key: `activate-recommendation-${topRecommendation.agent.id}`,
        label: getRecommendationActionLabel(topRecommendation.targetView),
        disabled: isActivatingRecommendation,
        onClick: () => onActivateRecommendedAgent(topRecommendation),
      };
    }

    if (detail.recommended_primary_action === "retry_workflow" && workflowStage === "recovery") {
      return {
        key: "retry-workflow",
        label: t("workspace.selectedWorkflow.retryRun"),
        onClick: onRetryWorkflowRun,
      };
    }

    if (detail.recommended_primary_action === "open_chat" && onOpenChatView) {
      return {
        key: "open-chat",
        label: t("workspace.selectedWorkflow.continueInChat"),
        onClick: onOpenChatView,
      };
    }

    if (detail.recommended_primary_action === "open_document" && detail.subject_type === "document" && detail.subject_id && onSelectDocument) {
      return {
        key: "open-document",
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
        key: "open-workflows",
        label: t("workspace.selectedWorkflow.openWorkflowSupervision"),
        onClick: onOpenWorkflowView,
        variant: "outline" as const,
      };
    }

    if (workflowStage === "recovery" && onOpenWorkflowView) {
      return {
        key: "open-workflows",
        label: t("workspace.selectedWorkflow.openWorkflowSupervision"),
        onClick: onOpenWorkflowView,
        variant: "outline" as const,
      };
    }

    if (workflowStage === "ready" && onOpenChatView) {
      return {
        key: "open-chat",
        label: t("workspace.selectedWorkflow.continueInChat"),
        onClick: onOpenChatView,
      };
    }

    if (detail.subject_type === "document" && detail.subject_id && onSelectDocument) {
      return {
        key: "open-document",
        label: t("workspace.selectedWorkflow.openDocument"),
        onClick: () => onSelectDocument(detail.subject_id!),
        variant: "outline" as const,
      };
    }

    return null;
  }

  function buildExecutionPacketSecondaryActions() {
    const actions: WorkflowPanelAction[] = [];
    const primaryAction = buildExecutionPacketPrimaryAction();
    const workflowStage = detail ? resolveWorkflowFollowUpStage(detail.workflow_status) : "unknown";

    function pushAction(action: WorkflowPanelAction | null) {
      if (!action) {
        return;
      }

      if (primaryAction?.key === action.key) {
        return;
      }

      if (actions.some((item) => item.key === action.key)) {
        return;
      }

      actions.push(action);
    }

    if (detail?.subject_type === "document" && detail.subject_id && onSelectDocument) {
      pushAction({
        key: "open-document",
        label: t("workspace.selectedWorkflow.openDocument"),
        disabled: isActivatingRecommendation,
        onClick: () => onSelectDocument(detail.subject_id!),
        variant: "outline",
      });
    }

    if (onOpenWorkflowView) {
      pushAction({
        key: "open-workflows",
        label: t("workspace.selectedWorkflow.openWorkflowSupervision"),
        disabled: isActivatingRecommendation,
        onClick: onOpenWorkflowView,
        variant: "outline",
      });
    }

    if (workflowStage === "ready" && onOpenDocumentsView) {
      pushAction({
        key: "open-documents",
        label: t("workspace.selectedWorkflow.continueInDocuments"),
        disabled: isActivatingRecommendation,
        onClick: onOpenDocumentsView,
        variant: "outline",
      });
    }

    if (workflowStage === "monitoring" && onCancelWorkflowRun) {
      pushAction({
        key: "cancel-workflow",
        label: t("workspace.selectedWorkflow.cancelRun"),
        disabled: isActivatingRecommendation,
        onClick: onCancelWorkflowRun,
        variant: "outline",
      });
    }

    return actions;
  }

  function renderNextStepPanel() {
    if (!detail) {
      return null;
    }

    const workflowStage = resolveWorkflowFollowUpStage(detail.workflow_status);

    if (workflowStage === "recovery") {
      return (
        <div className="rounded-md border border-rose-200 bg-rose-50/70 px-3 py-3 text-xs text-slate-700">
          <div className="font-medium text-slate-950">{t("workspace.selectedWorkflow.failedFollowUpTitle")}</div>
          <div className="mt-1 text-slate-600">
            {detail.follow_up_reason ?? t("workspace.selectedWorkflow.failedFollowUpDescription")}
          </div>
        </div>
      );
    }

    if (workflowStage === "monitoring") {
      return (
        <div className="rounded-md border border-sky-200 bg-sky-50/70 px-3 py-3 text-xs text-slate-700">
          <div className="font-medium text-slate-950">{t("workspace.selectedWorkflow.activeFollowUpTitle")}</div>
          <div className="mt-1 text-slate-600">
            {detail.follow_up_reason ?? t("workspace.selectedWorkflow.activeFollowUpDescription")}
          </div>
        </div>
      );
    }

    if (workflowStage === "ready") {
      return (
        <div className="rounded-md border border-emerald-200 bg-emerald-50/70 px-3 py-3 text-xs text-slate-700">
          <div className="font-medium text-slate-950">{t("workspace.selectedWorkflow.completedFollowUpTitle")}</div>
          <div className="mt-1 text-slate-600">
            {detail.follow_up_reason ?? t("workspace.selectedWorkflow.completedFollowUpDescription")}
          </div>
        </div>
      );
    }

    if (workflowStage === "cancelled") {
      return (
        <div className="rounded-md border border-slate-200 bg-slate-50/80 px-3 py-3 text-xs text-slate-700">
          <div className="font-medium text-slate-950">{t("workspace.selectedWorkflow.cancelledFollowUpTitle")}</div>
          <div className="mt-1 text-slate-600">
            {detail.follow_up_reason ?? t("workspace.selectedWorkflow.cancelledFollowUpDescription")}
          </div>
        </div>
      );
    }

    return null;
  }

  function resolveFailureFocusTitle() {
    if (!detail?.failure_category) {
      return null;
    }

    if (detail.failure_category === "source_deleted") {
      return t("workspace.selectedWorkflow.failureFocus.categories.sourceDeleted");
    }
    if (detail.failure_category === "source_missing") {
      return t("workspace.selectedWorkflow.failureFocus.categories.sourceMissing");
    }
    if (detail.failure_category === "parser_failure") {
      return t("workspace.selectedWorkflow.failureFocus.categories.parserFailure");
    }
    if (detail.failure_category === "embedding_failure") {
      return t("workspace.selectedWorkflow.failureFocus.categories.embeddingFailure");
    }
    if (detail.failure_category === "indexing_failure") {
      return t("workspace.selectedWorkflow.failureFocus.categories.indexingFailure");
    }
    if (detail.failure_category === "runtime_timeout") {
      return t("workspace.selectedWorkflow.failureFocus.categories.runtimeTimeout");
    }
    if (detail.failure_category === "runtime_capacity") {
      return t("workspace.selectedWorkflow.failureFocus.categories.runtimeCapacity");
    }
    return t("workspace.selectedWorkflow.failureFocus.categories.unknown");
  }

  function resolveFailureFocusActionLabel(
    actionKey: WorkflowRunDetail["failure_recommended_action"] | WorkflowRecoveryAction["action_key"] | null = detail?.failure_recommended_action ?? null
  ) {
    if (!actionKey) {
      return null;
    }

    if (actionKey === "review_document_source") {
      return t("workspace.selectedWorkflow.failureFocus.actions.reviewDocumentSource");
    }
    if (actionKey === "review_parser_path") {
      return t("workspace.selectedWorkflow.failureFocus.actions.reviewParserPath");
    }
    if (actionKey === "review_runtime") {
      return t("workspace.selectedWorkflow.failureFocus.actions.reviewRuntime");
    }
    if (actionKey === "review_indexing") {
      return t("workspace.selectedWorkflow.failureFocus.actions.reviewIndexing");
    }
    if (actionKey === "retry_when_ready") {
      return t("workspace.selectedWorkflow.failureFocus.actions.retryWhenReady");
    }
    return t("workspace.selectedWorkflow.failureFocus.actions.inspectWorkflow");
  }

  function resolveRecoveryActionLabel(action: WorkflowRecoveryAction) {
    if (action.action_key === "review_document_source") {
      return t("workspace.selectedWorkflow.failureFocus.actions.reviewDocumentSource");
    }
    if (action.action_key === "review_parser_path") {
      return t("workspace.selectedWorkflow.failureFocus.actions.reviewParserPath");
    }
    if (action.action_key === "review_runtime") {
      return t("workspace.selectedWorkflow.failureFocus.actions.reviewRuntime");
    }
    if (action.action_key === "review_indexing") {
      return t("workspace.selectedWorkflow.failureFocus.actions.reviewIndexing");
    }
    if (action.action_key === "retry_when_ready") {
      return t("workspace.selectedWorkflow.failureFocus.actions.retryWhenReady");
    }
    return t("workspace.selectedWorkflow.failureFocus.actions.inspectWorkflow");
  }

  function buildRecoveryActionButton(action: WorkflowRecoveryAction) {
    const variant: "default" | "outline" = action.is_primary ? "default" : "outline";
    const commonProps = {
      size: "sm" as const,
      type: "button" as const,
      variant,
      disabled: !action.is_enabled,
    };

    if (action.target_primary_action === "open_document" && detail?.subject_id && onSelectDocument) {
      return (
        <Button {...commonProps} key={action.action_key} onClick={() => void onSelectDocument(detail.subject_id!)}>
          {resolveRecoveryActionLabel(action)}
        </Button>
      );
    }

    if (action.target_primary_action === "retry_workflow") {
      return (
        <Button
          {...commonProps}
          key={action.action_key}
          disabled={!action.is_enabled || isRetryingWorkflow}
          onClick={() => void onRetryWorkflowRun()}
        >
          {isRetryingWorkflow ? t("workspace.selectedWorkflow.checkingRetry") : resolveRecoveryActionLabel(action)}
        </Button>
      );
    }

    if (
      (action.target_primary_action === "open_workflows" || action.target_primary_action === "monitor_workflow") &&
      onOpenWorkflowView
    ) {
      return (
        <Button {...commonProps} key={action.action_key} onClick={() => void onOpenWorkflowView()}>
          {resolveRecoveryActionLabel(action)}
        </Button>
      );
    }

    if (action.target_view === "documents" && onOpenDocumentsView) {
      return (
        <Button {...commonProps} key={action.action_key} onClick={() => void onOpenDocumentsView()}>
          {resolveRecoveryActionLabel(action)}
        </Button>
      );
    }

    return null;
  }

  function renderFailureFocusPanel() {
    if (!detail || detail.workflow_status !== "failed" || !detail.failure_category) {
      return null;
    }
    const failureActionButtons = workflowRecoveryActions.flatMap((action) => {
      const button = buildRecoveryActionButton(action);
      return button ? [button] : [];
    });
    const disabledRecoveryAction = workflowRecoveryActions.find((action) => !action.is_enabled && action.disabled_reason);

    return (
      <div className="rounded-md border border-amber-200 bg-amber-50/80 px-3 py-3 text-xs text-slate-700">
        <div className="font-medium text-slate-950">{t("workspace.selectedWorkflow.failureFocus.title")}</div>
        <div className="mt-2 text-slate-900">{resolveFailureFocusTitle()}</div>
        {detail.failure_focus_step_name ? (
          <div className="mt-2 text-slate-600">
            {t("workspace.selectedWorkflow.failureFocus.step", {
              value: formatWorkflowStepLabel(detail.failure_focus_step_name),
            })}
          </div>
        ) : null}
        {detail.failure_focus_attempt_count > 1 ? (
          <div className="mt-1 text-slate-600">
            {t("workspace.selectedWorkflow.failureFocus.attempts", {
              value: String(detail.failure_focus_attempt_count),
            })}
          </div>
        ) : null}
        {detail.failure_focus_error_message ? (
          <div className="mt-2 rounded-md bg-white/80 px-2 py-2 text-rose-700">
            {formatOperatorErrorMessage(detail.failure_focus_error_message)}
          </div>
        ) : null}
        {resolveFailureFocusActionLabel() ? (
          <div className="mt-2 text-slate-600">
            {t("workspace.selectedWorkflow.failureFocus.nextAction", {
              value: resolveFailureFocusActionLabel()!,
            })}
          </div>
        ) : null}
        {failureActionButtons.length > 0 ? <div className="mt-1 flex flex-wrap gap-2">{failureActionButtons}</div> : null}
        {disabledRecoveryAction?.disabled_reason ? (
          <div className="mt-2 text-slate-500">{disabledRecoveryAction.disabled_reason}</div>
        ) : null}
      </div>
    );
  }

  async function handleSaveOperatorNotes() {
    if (!detail || !onSaveOperatorNotes || !hasOperatorNotesChanges) {
      return;
    }

    const normalizedNotes = operatorNotesDraft.trim();
    await onSaveOperatorNotes(normalizedNotes.length > 0 ? normalizedNotes : null);
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
                <Badge className={cn("border", getStatusBadgeClass(detail.workflow_status))} variant="outline">
                  {formatStatusLabel(detail.workflow_status)}
                </Badge>
              </div>
            </div>
            {resolveWorkflowFollowUpStage(detail.workflow_status) === "recovery" && retryDisabledReason ? (
              <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-3 text-xs text-rose-700">{retryDisabledReason}</div>
            ) : null}
            {resolveWorkflowFollowUpStage(detail.workflow_status) === "recovery" && retryHelpText ? (
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
            {renderFailureFocusPanel()}
            {recommendedAgents.length > 0 && onActivateRecommendedAgent ? (
              <WorkspaceRecommendedAgentsPanel
                description={t("workspace.selectedWorkflow.recommendedAgentsDescription")}
                getActionLabel={getRecommendationActionLabel}
                isActivatingRecommendation={isActivatingRecommendation}
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
                <div className="mt-1 font-medium text-slate-900">{detail.total_step_count}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
              <div className="rounded-md bg-white px-2 py-2">
                <div className="text-slate-500">{t("workspace.selectedWorkflow.summary.retryDepth")}</div>
                <div className="mt-1 font-medium text-slate-900">{detail.retry_depth}</div>
              </div>
              <div className="rounded-md bg-white px-2 py-2">
                <div className="text-slate-500">{t("workspace.selectedWorkflow.summary.remainingRetries")}</div>
                <div className="mt-1 font-medium text-slate-900">
                  {detail.remaining_retry_attempts}/{detail.max_retry_depth}
                </div>
              </div>
              <div className="rounded-md bg-white px-2 py-2">
                <div className="text-slate-500">{t("workspace.selectedWorkflow.summary.childRetries")}</div>
                <div className="mt-1 font-medium text-slate-900">{detail.child_retry_run_count}</div>
              </div>
              <div className="rounded-md bg-white px-2 py-2">
                <div className="text-slate-500">{t("workspace.selectedWorkflow.summary.failedSteps")}</div>
                <div className="mt-1 font-medium text-slate-900">
                  {detail.failed_step_count}/{detail.total_step_count}
                </div>
              </div>
              <div className="rounded-md bg-white px-2 py-2">
                <div className="text-slate-500">{t("workspace.selectedWorkflow.summary.recoveryEvents")}</div>
                <div className="mt-1 font-medium text-slate-900">{detail.recovery_event_count}</div>
              </div>
              <div className="rounded-md bg-white px-2 py-2">
                <div className="text-slate-500">{t("workspace.selectedWorkflow.summary.activeRetry")}</div>
                <div className="mt-1 break-all font-medium text-slate-900">
                  {detail.has_active_retry_child
                    ? detail.latest_child_retry_status
                      ? formatStatusLabel(detail.latest_child_retry_status)
                      : t("workspace.selectedWorkflow.summary.activeRetryRunning")
                    : t("workspace.selectedWorkflow.summary.none")}
                </div>
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
              <div className="rounded-md bg-white px-3 py-3">
                <div className="text-slate-500">{t("workspace.selectedWorkflow.summary.latestRecoveryActivity")}</div>
                <div className="mt-1 font-medium text-slate-900">
                  {detail.latest_recovery_event_at
                    ? formatDateTimeWithYear(detail.latest_recovery_event_at)
                    : t("workspace.selectedWorkflow.notAvailable")}
                </div>
              </div>
              <div className="rounded-md bg-white px-3 py-3">
                <div className="text-slate-500">{t("workspace.selectedWorkflow.summary.latestFailedStep")}</div>
                <div className="mt-1 font-medium text-slate-900">
                  {detail.latest_failed_step_name
                    ? formatWorkflowStepLabel(detail.latest_failed_step_name)
                    : t("workspace.selectedWorkflow.notAvailable")}
                </div>
              </div>
              <div className="rounded-md bg-white px-3 py-3">
                <div className="text-slate-500">{t("workspace.selectedWorkflow.summary.latestActiveStep")}</div>
                <div className="mt-1 font-medium text-slate-900">
                  {detail.latest_active_step_name
                    ? formatWorkflowStepLabel(detail.latest_active_step_name)
                    : t("workspace.selectedWorkflow.notAvailable")}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {detail.latest_active_step_started_at
                    ? formatDateTimeWithYear(detail.latest_active_step_started_at)
                    : t("workspace.selectedWorkflow.notStarted")}
                </div>
              </div>
              <div className="rounded-md bg-white px-3 py-3">
                <div className="text-slate-500">{t("workspace.selectedWorkflow.summary.latestCompletedStep")}</div>
                <div className="mt-1 font-medium text-slate-900">
                  {detail.latest_completed_step_name
                    ? formatWorkflowStepLabel(detail.latest_completed_step_name)
                    : t("workspace.selectedWorkflow.notAvailable")}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {detail.latest_completed_step_completed_at
                    ? formatDateTimeWithYear(detail.latest_completed_step_completed_at)
                    : t("workspace.selectedWorkflow.notCompleted")}
                </div>
              </div>
              <div className="rounded-md bg-white px-3 py-3">
                <div className="text-slate-500">{t("workspace.selectedWorkflow.summary.highestAttemptStep")}</div>
                <div className="mt-1 font-medium text-slate-900">
                  {detail.highest_attempt_step_name
                    ? formatWorkflowStepLabel(detail.highest_attempt_step_name)
                    : t("workspace.selectedWorkflow.notAvailable")}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {t("workspace.selectedWorkflow.attempt", { count: String(detail.highest_attempt_count) })}
                </div>
              </div>
            </div>
            {detail.error_message && (
              <div className="rounded-md bg-rose-50 px-3 py-3 text-xs text-rose-700">
                {formatOperatorErrorMessage(detail.error_message)}
              </div>
            )}
            <div className="rounded-md bg-white px-3 py-3">
              <div className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                {t("workspace.selectedWorkflow.operatorNotes")}
              </div>
              <Textarea
                className="mt-3 min-h-[112px] rounded-xl border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
                disabled={!canEditOperatorNotes || isSavingOperatorNotes}
                onChange={(event) => setOperatorNotesDraft(event.target.value)}
                placeholder={t("workspace.selectedWorkflow.operatorNotesPlaceholder")}
                value={operatorNotesDraft}
              />
              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="text-xs text-slate-500">
                  {detail.operator_notes
                    ? t("workspace.selectedWorkflow.operatorNotesSaved")
                    : t("workspace.selectedWorkflow.operatorNotesEmpty")}
                </div>
                {canEditOperatorNotes && onSaveOperatorNotes ? (
                  <Button
                    disabled={!hasOperatorNotesChanges || isSavingOperatorNotes}
                    onClick={() => void handleSaveOperatorNotes()}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    {isSavingOperatorNotes
                      ? t("workspace.selectedWorkflow.savingOperatorNotes")
                      : t("workspace.selectedWorkflow.saveOperatorNotes")}
                  </Button>
                ) : null}
              </div>
            </div>
            <div className="space-y-2">
              {workflowSteps.map((step) => {
                const stepRecoveryActions = Array.isArray(step.recovery_actions) ? step.recovery_actions : [];

                return (
                <div
                  key={step.id}
                  className={cn(
                    "rounded-md bg-white px-3 py-3",
                    step.is_failure_focus && "border border-amber-200 bg-amber-50/40"
                  )}
                >
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
                  {step.failure_recommended_action && resolveFailureFocusActionLabel(step.failure_recommended_action) ? (
                    <div className="mt-2 text-xs text-slate-600">
                      {t("workspace.selectedWorkflow.failureFocus.nextAction", {
                        value: resolveFailureFocusActionLabel(step.failure_recommended_action)!,
                      })}
                    </div>
                  ) : null}
                  {stepRecoveryActions.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {stepRecoveryActions.flatMap((action) => {
                        const button = buildRecoveryActionButton(action);
                        return button ? [button] : [];
                      })}
                    </div>
                  ) : null}
                </div>
                );
              })}
              {emptyStepsMessage && workflowSteps.length === 0 && (
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
