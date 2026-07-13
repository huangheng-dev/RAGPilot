"use client";

import { useState } from "react";

import {
  formatFileSize,
  formatNumber,
  formatParserLabel,
  formatStatusLabel,
  formatTimestamp,
  formatWorkflowTypeLabel,
  getStatusBadgeClass,
} from "../../lib/workspace-formatters";
import { formatOperatorErrorMessage } from "../../lib/api-errors";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DialogFormActions, DialogFormField, DialogFormGrid, DialogFormLayout, FormDialog } from "@/components/ui/form-dialog";
import { Input } from "@/components/ui/input";
import { WorkspaceExecutionPacket } from "@/components/workspace/WorkspaceExecutionPacket";
import { WorkspaceRecommendedAgentsPanel } from "@/components/workspace/WorkspaceRecommendedAgentsPanel";
import { useI18n } from "@/lib/i18n/provider";
import { resolveWorkflowFollowUpStage } from "@/lib/workspace-workflow-follow-up";
import { cn } from "@/lib/utils";
import type { WorkspaceAgentRecommendation, WorkspaceView } from "@/components/workspace/workspace-types";

type DocumentChunk = {
  id: string;
  chunk_index: number;
  content: string;
  token_count: number | null;
  metadata_json: Record<string, unknown>;
};

type DocumentVersionSummary = {
  id: string;
  version_number: number;
  ingestion_status: string;
  parser_name: string | null;
  chunk_count: number;
  token_count_total: number;
  updated_at: string;
};

type DocumentRecord = {
  id: string;
  title: string;
  ingestion_status: string;
  indexing_status: string;
  is_deleted?: boolean;
  deleted_at?: string | null;
};

type WorkflowRunSummary = {
  id: string;
  workflow_status: string;
  workflow_type: string;
  recommended_next_view?: WorkspaceView | null;
  recommended_primary_action?: "retry_workflow" | "open_workflows" | "open_document" | "open_chat" | "monitor_workflow" | null;
  follow_up_reason?: string | null;
  latest_active_step_name?: string | null;
  latest_completed_step_name?: string | null;
  failure_focus_step_name?: string | null;
  error_message?: string | null;
  operator_notes?: string | null;
  created_at: string;
};

type DocumentDetail = {
  document: DocumentRecord;
  document_version_id?: string | null;
  parser_name: string | null;
  version_number: number | null;
  version_ingestion_status?: string | null;
  asset_file_name: string | null;
  asset_content_type?: string | null;
  storage_bucket?: string | null;
  asset_file_size_bytes?: number | null;
  storage_key?: string | null;
  latest_completed_version_number?: number | null;
  latest_completed_parser_name?: string | null;
  chunk_count?: number;
  token_count_total?: number;
  recent_versions?: DocumentVersionSummary[];
  chunks: DocumentChunk[];
};

type SelectedDocumentPanelProps = {
  chunkPreviewClassName?: string;
  detail: DocumentDetail | null;
  emptyState: string;
  focusedChunkId?: string | null;
  canManageDocuments: boolean;
  isActivatingRecommendation?: boolean;
  isRunningDocumentAction: boolean;
  onDeleteDocument: () => void | Promise<void>;
  onPermanentlyDeleteDocument: (confirmationTitle: string) => void | Promise<void>;
  onOpenChatView?: () => void;
  onOpenFailedDocumentsQueue?: () => void;
  onOpenWorkflowView?: () => void;
  onInspectWorkflowRun?: (workflowRunId: string) => void | Promise<void>;
  onReindexDocument: () => void | Promise<void>;
  onRestoreDocument: () => void | Promise<void>;
  onSelectVersion?: (documentVersionId: string) => void | Promise<void>;
  relatedWorkflowRuns?: WorkflowRunSummary[];
  recommendedAgents?: WorkspaceAgentRecommendation[];
  selectedDocumentVersionId?: string | null;
  showExtendedMetadata?: boolean;
  embeddedInDialog?: boolean;
  hideLifecycleActions?: boolean;
  onActivateRecommendedAgent?: (recommendation: WorkspaceAgentRecommendation) => void | Promise<void>;
  title?: string;
};

type DocumentPanelAction = {
  key: string;
  label: string;
  onClick: () => void | Promise<void>;
  disabled?: boolean;
  variant?: "default" | "outline";
};

export function SelectedDocumentPanel({
  chunkPreviewClassName,
  detail,
  emptyState,
  focusedChunkId = null,
  canManageDocuments,
  isActivatingRecommendation = false,
  isRunningDocumentAction,
  onDeleteDocument,
  onPermanentlyDeleteDocument,
  onOpenChatView,
  onOpenFailedDocumentsQueue,
  onOpenWorkflowView,
  onInspectWorkflowRun,
  onReindexDocument,
  onRestoreDocument,
  onSelectVersion,
  relatedWorkflowRuns = [],
  recommendedAgents = [],
  selectedDocumentVersionId = null,
  showExtendedMetadata = false,
  embeddedInDialog = false,
  hideLifecycleActions = false,
  onActivateRecommendedAgent,
  title,
}: SelectedDocumentPanelProps) {
  const { t } = useI18n();
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isLifecycleConfirmOpen, setIsLifecycleConfirmOpen] = useState(false);
  const [isPermanentDeleteOpen, setIsPermanentDeleteOpen] = useState(false);
  const [permanentDeleteTitle, setPermanentDeleteTitle] = useState("");
  const latestWorkflowRun = relatedWorkflowRuns[0] ?? null;
  const topRecommendation = recommendedAgents[0] ?? null;
  const chunks = Array.isArray(detail?.chunks) ? detail.chunks : [];
  const recentVersions = Array.isArray(detail?.recent_versions) ? detail.recent_versions : [];
  const chunkCount = detail?.chunk_count ?? chunks.length;
  const tokenCountTotal = detail?.token_count_total ?? chunks.reduce((sum, chunk) => sum + (chunk.token_count ?? 0), 0);
  const isDeletedDocument = Boolean(detail?.document.is_deleted);
  const isDocumentFailed = detail?.document.ingestion_status === "failed" || detail?.document.indexing_status === "failed";
  const isLatestWorkflowFailed = latestWorkflowRun?.workflow_status === "failed";
  const isDocumentReady =
    !isDeletedDocument &&
    detail?.document.ingestion_status === "completed" &&
    detail?.document.indexing_status === "completed";

  function getRecommendationActionLabel(targetView: "chat" | "documents" | "workflows") {
    if (targetView === "chat") {
      return t("workspace.selectedDocument.activateInChat");
    }

    if (targetView === "documents") {
      return t("workspace.selectedDocument.activateInDocuments");
    }

    return t("workspace.selectedDocument.activateInWorkflows");
  }

  function resolveExecutionPacketTone() {
    if (isDeletedDocument) {
      return "review" as const;
    }

    if (isDocumentFailed || isLatestWorkflowFailed) {
      return "attention" as const;
    }

    if (isDocumentReady) {
      return "healthy" as const;
    }

    return "review" as const;
  }

  function resolveRecommendedView(): WorkspaceView {
    if (isDeletedDocument) {
      return "documents";
    }

    if (topRecommendation) {
      return topRecommendation.targetView;
    }

    if (latestWorkflowRun?.recommended_next_view) {
      return latestWorkflowRun.recommended_next_view;
    }

    if (isDocumentFailed || isLatestWorkflowFailed) {
      return "workflows";
    }

    if (isDocumentReady) {
      return "chat";
    }

    return "documents";
  }

  function resolveExecutionPacketState() {
    if (isDeletedDocument) {
      return t("workspace.selectedDocument.packet.deletedState");
    }

    if (isDocumentFailed || isLatestWorkflowFailed) {
      return t("workspace.selectedDocument.packet.failedState");
    }

    if (isDocumentReady) {
      return t("workspace.selectedDocument.packet.readyState");
    }

    return t("workspace.selectedDocument.packet.intakeState");
  }

  function resolveExecutionPacketDescription() {
    if (isDeletedDocument) {
      return t("workspace.selectedDocument.packet.deletedDescription");
    }

    if (isDocumentFailed || isLatestWorkflowFailed) {
      return latestWorkflowRun?.follow_up_reason ?? t("workspace.selectedDocument.packet.failedDescription");
    }

    if (isDocumentReady) {
      return latestWorkflowRun?.follow_up_reason ?? t("workspace.selectedDocument.packet.readyDescription");
    }

    return latestWorkflowRun?.follow_up_reason ?? t("workspace.selectedDocument.packet.intakeDescription");
  }

  function buildWorkflowDirectedAction(): DocumentPanelAction | null {
    if (!latestWorkflowRun) {
      return null;
    }

    if (latestWorkflowRun.recommended_primary_action === "open_chat" && onOpenChatView) {
      return {
        key: "open-chat",
        label: t("workspace.selectedDocument.continueInChat"),
        onClick: onOpenChatView,
      };
    }

    if (
      (latestWorkflowRun.recommended_primary_action === "open_workflows" ||
        latestWorkflowRun.recommended_primary_action === "monitor_workflow") &&
      onOpenWorkflowView
    ) {
      return {
        key: "open-workflows",
        label: t("workspace.selectedDocument.openWorkflowSupervision"),
        onClick: onOpenWorkflowView,
        variant: "outline",
      };
    }

    if (latestWorkflowRun.recommended_primary_action === "retry_workflow" && onInspectWorkflowRun) {
      return {
        key: "inspect-latest-run",
        label: t("workspace.selectedDocument.inspectLatestRun"),
        onClick: () => onInspectWorkflowRun(latestWorkflowRun.id),
        variant: "outline",
      };
    }

    return null;
  }

  function buildExecutionPacketPrimaryAction(): DocumentPanelAction | null {
    if (isDeletedDocument) {
      if (!canManageDocuments) {
        return null;
      }

      return {
        key: "restore-document",
        label: t("workspace.selectedDocument.restore"),
        onClick: onRestoreDocument,
      };
    }

    if (topRecommendation && onActivateRecommendedAgent) {
      return {
        key: `activate-recommendation-${topRecommendation.agent.id}`,
        label: getRecommendationActionLabel(topRecommendation.targetView),
        disabled: isActivatingRecommendation,
        onClick: () => onActivateRecommendedAgent(topRecommendation),
      };
    }

    const workflowDirectedAction = buildWorkflowDirectedAction();
    if (workflowDirectedAction) {
      return workflowDirectedAction;
    }

    if (isDocumentReady && onOpenChatView) {
      return {
        key: "open-chat",
        label: t("workspace.selectedDocument.continueInChat"),
        onClick: onOpenChatView,
      };
    }

    if (isDocumentFailed && onOpenFailedDocumentsQueue) {
      return {
        key: "open-failed-queue",
        label: t("workspace.selectedDocument.openFailedQueue"),
        onClick: onOpenFailedDocumentsQueue,
        variant: "outline" as const,
      };
    }

    if ((isDocumentFailed || isLatestWorkflowFailed) && onOpenWorkflowView) {
      return {
        key: "open-workflows",
        label: t("workspace.selectedDocument.openWorkflowSupervision"),
        onClick: onOpenWorkflowView,
        variant: "outline" as const,
      };
    }

    if (latestWorkflowRun && onInspectWorkflowRun) {
      return {
        key: "inspect-latest-run",
        label: t("workspace.selectedDocument.inspectLatestRun"),
        onClick: () => onInspectWorkflowRun(latestWorkflowRun.id),
        variant: "outline" as const,
      };
    }

    return null;
  }

  function buildExecutionPacketSecondaryActions() {
    const actions: DocumentPanelAction[] = [];
    const primaryAction = buildExecutionPacketPrimaryAction();

    function pushAction(action: DocumentPanelAction | null) {
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

    if (isDeletedDocument) {
      return actions;
    }

    if (isDocumentReady && onOpenChatView) {
      pushAction({
        key: "open-chat",
        label: t("workspace.selectedDocument.continueInChat"),
        disabled: isActivatingRecommendation,
        onClick: onOpenChatView,
      });
    }

    if (isDocumentFailed && onOpenFailedDocumentsQueue) {
      pushAction({
        key: "open-failed-queue",
        label: t("workspace.selectedDocument.openFailedQueue"),
        disabled: isActivatingRecommendation,
        onClick: onOpenFailedDocumentsQueue,
        variant: "outline",
      });
    }

    pushAction(buildWorkflowDirectedAction());

    if (onOpenWorkflowView) {
      pushAction({
        key: "open-workflows",
        label: t("workspace.selectedDocument.openWorkflowSupervision"),
        disabled: isActivatingRecommendation,
        onClick: onOpenWorkflowView,
        variant: "outline",
      });
    }

    if (latestWorkflowRun && onInspectWorkflowRun) {
      pushAction({
        key: "inspect-latest-run",
        label: t("workspace.selectedDocument.inspectLatestRun"),
        disabled: isActivatingRecommendation,
        onClick: () => onInspectWorkflowRun(latestWorkflowRun.id),
        variant: "outline",
      });
    }

    return actions;
  }

  function renderNextStepPanel() {
    if (isDeletedDocument) {
      return null;
    }

    if (latestWorkflowRun) {
      const latestWorkflowStage = resolveWorkflowFollowUpStage(latestWorkflowRun.workflow_status);

      if (latestWorkflowStage === "recovery") {
        if (!onOpenFailedDocumentsQueue && !onOpenWorkflowView) {
          return null;
        }

        return (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="font-medium text-amber-900">{t("workspace.selectedDocument.operatorNextStep")}</div>
            <div className="mt-1 text-amber-800">
              {latestWorkflowRun.follow_up_reason ?? t("workspace.selectedDocument.operatorNextStepDescription")}
            </div>
          </div>
        );
      }

      if (latestWorkflowStage === "monitoring") {
        return (
          <div className="mb-4 rounded-xl border border-sky-200 bg-sky-50/70 p-4 text-sm text-slate-700">
            <div className="font-medium text-slate-950">{t("workspace.selectedDocument.intakeFollowUpTitle")}</div>
            <div className="mt-1 text-slate-600">
              {latestWorkflowRun.follow_up_reason ?? t("workspace.selectedDocument.intakeFollowUpDescription")}
            </div>
          </div>
        );
      }

      if (latestWorkflowStage === "ready") {
        return (
          <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-sm text-slate-700">
            <div className="font-medium text-slate-950">{t("workspace.selectedDocument.readyFollowUpTitle")}</div>
            <div className="mt-1 text-slate-600">
              {latestWorkflowRun.follow_up_reason ?? t("workspace.selectedDocument.readyFollowUpDescription")}
            </div>
          </div>
        );
      }

      if (latestWorkflowStage === "cancelled") {
        return (
          <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-700">
            <div className="font-medium text-slate-950">{t("workspace.selectedDocument.operatorNextStep")}</div>
            <div className="mt-1 text-slate-600">
              {latestWorkflowRun.follow_up_reason ?? t("workspace.selectedDocument.operatorNextStepDescription")}
            </div>
          </div>
        );
      }
    }

    if (isDocumentFailed) {
      if (!onOpenFailedDocumentsQueue && !onOpenWorkflowView) {
        return null;
      }

      return (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="font-medium text-amber-900">{t("workspace.selectedDocument.operatorNextStep")}</div>
          <div className="mt-1 text-amber-800">{t("workspace.selectedDocument.operatorNextStepDescription")}</div>
        </div>
      );
    }

    if (isDocumentReady && (onOpenChatView || onOpenWorkflowView)) {
      return (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-sm text-slate-700">
          <div className="font-medium text-slate-950">{t("workspace.selectedDocument.readyFollowUpTitle")}</div>
          <div className="mt-1 text-slate-600">{t("workspace.selectedDocument.readyFollowUpDescription")}</div>
        </div>
      );
    }

    if (onOpenWorkflowView) {
      return (
        <div className="mb-4 rounded-xl border border-sky-200 bg-sky-50/70 p-4 text-sm text-slate-700">
          <div className="font-medium text-slate-950">{t("workspace.selectedDocument.intakeFollowUpTitle")}</div>
          <div className="mt-1 text-slate-600">{t("workspace.selectedDocument.intakeFollowUpDescription")}</div>
        </div>
      );
    }

    return null;
  }

  function resolveLatestWorkflowFollowUpTitle() {
    if (!latestWorkflowRun) {
      return t("workspace.selectedDocument.operatorNextStep");
    }

    const latestWorkflowStage = resolveWorkflowFollowUpStage(latestWorkflowRun.workflow_status);
    if (latestWorkflowStage === "ready") {
      return t("workspace.selectedDocument.readyFollowUpTitle");
    }

    if (latestWorkflowStage === "monitoring") {
      return t("workspace.selectedDocument.intakeFollowUpTitle");
    }

    return t("workspace.selectedDocument.operatorNextStep");
  }

  return (
    <Card className={cn("border-slate-200 shadow-sm", embeddedInDialog && "rounded-none border-0 shadow-none")}>
      {!embeddedInDialog ? <CardHeader className="pb-3">
        <CardTitle>{title ?? t("workspace.selectedDocument.selectedDocument")}</CardTitle>
      </CardHeader> : null}
      <CardContent className={cn("space-y-3 text-sm text-slate-700", embeddedInDialog && "p-0")}>
        {detail ? (
          <DialogFormLayout className="space-y-4">
            <div className={cn("flex items-start justify-between gap-3", embeddedInDialog && "rounded-xl border border-slate-200 bg-white p-3")}>
              <div>
                {!embeddedInDialog ? <div className="font-medium text-slate-900">{detail.document.title}</div> : null}
                <div className="mt-1 text-xs text-slate-500">{detail.asset_file_name ?? t("workspace.selectedDocument.noAssetMetadata")}</div>
              </div>
              {!hideLifecycleActions ? <div className="flex items-center gap-2">
                <Button
                  className="rounded-xl bg-white"
                  disabled={!canManageDocuments || isRunningDocumentAction}
                  onClick={() => setIsLifecycleConfirmOpen(true)}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  {isDeletedDocument ? t("workspace.selectedDocument.restore") : t("workspace.selectedDocument.reindex")}
                </Button>
                {!isDeletedDocument ? (
                  <Button
                    className="rounded-xl border-rose-200 bg-white text-rose-700 hover:bg-rose-50 hover:text-rose-700"
                    disabled={!canManageDocuments || isRunningDocumentAction}
                    onClick={() => setIsDeleteConfirmOpen(true)}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    {t("workspace.selectedDocument.delete")}
                  </Button>
                ) : (
                  <Button
                    className="rounded-xl border-rose-200 bg-white text-rose-700 hover:bg-rose-50 hover:text-rose-700"
                    disabled={!canManageDocuments || isRunningDocumentAction}
                    onClick={() => { setPermanentDeleteTitle(""); setIsPermanentDeleteOpen(true); }}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    {t("workspace.selectedDocument.permanentDelete")}
                  </Button>
                )}
              </div> : null}
            </div>
            <DialogFormGrid className="gap-3 text-xs">
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900">
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{t("workspace.selectedDocument.parser")}</div>
                <div className="mt-2 text-sm font-semibold text-slate-950">{detail.parser_name ? formatParserLabel(detail.parser_name) : t("workspace.selectedDocument.pending")}</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900">
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{showExtendedMetadata ? t("workspace.selectedDocument.version") : t("workspace.selectedDocument.chunks")}</div>
                {showExtendedMetadata ? (
                  <>
                    <div className="mt-2 text-sm font-semibold text-slate-950">v{detail.version_number ?? t("workspace.selectedDocument.notAvailable")}</div>
                    {detail.version_ingestion_status && (
                      <div className="mt-2">
                        <Badge
                          className={cn("border text-[11px]", getStatusBadgeClass(detail.version_ingestion_status))}
                          variant="outline"
                        >
                          {formatStatusLabel(detail.version_ingestion_status)}
                        </Badge>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="mt-1 font-medium text-slate-900">{chunkCount}</div>
                )}
              </div>
              {showExtendedMetadata && (
                <>
                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{t("workspace.selectedDocument.chunkCount")}</div>
                    <div className="mt-2 text-sm font-semibold text-slate-950">{chunkCount}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{t("workspace.selectedDocument.assetSize")}</div>
                    <div className="mt-2 text-sm font-semibold text-slate-950">{formatFileSize(detail.asset_file_size_bytes ?? null)}</div>
                  </div>
                </>
              )}
            </DialogFormGrid>
            {showExtendedMetadata && (
              <>
                <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950">
                  <div className="text-sm font-semibold text-slate-950">{t("workspace.selectedDocument.processingHealth")}</div>
                  <DialogFormGrid className="mt-3 gap-3">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{t("workspace.selectedDocument.documentIngestion")}</div>
                      <div className="mt-2">
                        <Badge className={cn("border text-[11px]", getStatusBadgeClass(detail.document.ingestion_status))} variant="outline">
                          {formatStatusLabel(detail.document.ingestion_status)}
                        </Badge>
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{t("workspace.selectedDocument.documentIndexing")}</div>
                      <div className="mt-2">
                        <Badge className={cn("border text-[11px]", getStatusBadgeClass(detail.document.indexing_status))} variant="outline">
                          {formatStatusLabel(detail.document.indexing_status)}
                        </Badge>
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{t("workspace.selectedDocument.currentVersionTokens")}</div>
                      <div className="mt-2 text-sm font-semibold text-slate-950">{formatNumber(tokenCountTotal)}</div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{t("workspace.selectedDocument.contentType")}</div>
                      <div className="mt-2 break-all text-sm font-semibold text-slate-950">{detail.asset_content_type ?? t("workspace.selectedDocument.unknown")}</div>
                    </div>
                  </DialogFormGrid>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950">
                  <div className="text-sm font-semibold text-slate-950">{t("workspace.selectedDocument.versionState")}</div>
                  <DialogFormGrid className="mt-3 gap-3">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{t("workspace.selectedDocument.latestAttempt")}</div>
                      <div className="mt-2 text-sm font-semibold text-slate-950">v{detail.version_number ?? t("workspace.selectedDocument.notAvailable")}</div>
                      <div className="mt-1 text-slate-500">{detail.parser_name ? formatParserLabel(detail.parser_name) : t("workspace.selectedDocument.parserPendingLower")}</div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{t("workspace.selectedDocument.latestCompleted")}</div>
                      <div className="mt-2 text-sm font-semibold text-slate-950">
                        {detail.latest_completed_version_number ? `v${detail.latest_completed_version_number}` : t("workspace.selectedDocument.noCompletedVersion")}
                      </div>
                      <div className="mt-1 text-slate-500">
                        {detail.latest_completed_parser_name ? formatParserLabel(detail.latest_completed_parser_name) : t("workspace.selectedDocument.awaitingSuccessfulIngestion")}
                      </div>
                    </div>
                  </DialogFormGrid>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950">
                  <div className="mb-3">
                    <WorkspaceExecutionPacket
                      capabilityCount={topRecommendation?.capabilityCount ?? null}
                      currentView="documents"
                      description={resolveExecutionPacketDescription()}
                      primaryAction={buildExecutionPacketPrimaryAction()}
                      recommendedView={resolveRecommendedView()}
                      scopeMatched={topRecommendation?.scopeMatched ?? null}
                      secondaryActions={buildExecutionPacketSecondaryActions()}
                      stateSummary={resolveExecutionPacketState()}
                      subject={detail.document.title}
                      tone={resolveExecutionPacketTone()}
                    />
                  </div>
                  {recommendedAgents.length > 0 && onActivateRecommendedAgent ? (
                    <div className="mb-3">
                      <WorkspaceRecommendedAgentsPanel
                        description={t("workspace.selectedDocument.recommendedAgentsDescription")}
                        getActionLabel={getRecommendationActionLabel}
                        isActivatingRecommendation={isActivatingRecommendation}
                        onActivateRecommendation={onActivateRecommendedAgent}
                        recommendations={recommendedAgents}
                        title={t("workspace.selectedDocument.recommendedAgents")}
                      />
                    </div>
                  ) : null}
                  {renderNextStepPanel()}
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-slate-950">{t("workspace.selectedDocument.latestWorkflow")}</div>
                    {latestWorkflowRun ? (
                      <Badge className={cn("border text-[11px]", getStatusBadgeClass(latestWorkflowRun.workflow_status))} variant="outline">
                        {formatStatusLabel(latestWorkflowRun.workflow_status)}
                      </Badge>
                    ) : null}
                  </div>
                  {latestWorkflowRun ? (
                    <>
                      <div className="mt-2 font-medium text-slate-900">{formatWorkflowTypeLabel(latestWorkflowRun.workflow_type)}</div>
                      <div className="mt-1 break-all text-slate-500">{latestWorkflowRun.id}</div>
                      <div className="mt-2 text-slate-500">{formatTimestamp(latestWorkflowRun.created_at)}</div>
                      {latestWorkflowRun.error_message ? (
                        <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-700">
                          {formatOperatorErrorMessage(latestWorkflowRun.error_message)}
                        </div>
                      ) : null}
                      {latestWorkflowRun.follow_up_reason ? (
                        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-slate-700">
                          <div className="font-medium text-slate-900">{resolveLatestWorkflowFollowUpTitle()}</div>
                          <div className="mt-1 leading-6">{latestWorkflowRun.follow_up_reason}</div>
                        </div>
                      ) : null}
                      {latestWorkflowRun.operator_notes ? (
                        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-slate-700">
                          <div className="font-medium text-slate-900">{t("workspace.selectedDocument.operatorHandoff")}</div>
                          <div className="mt-1 whitespace-pre-wrap break-words leading-6">
                            {latestWorkflowRun.operator_notes}
                          </div>
                        </div>
                      ) : null}
                      {onInspectWorkflowRun ? (
                        <Button className="mt-3" onClick={() => void onInspectWorkflowRun(latestWorkflowRun.id)} size="sm" type="button" variant="outline">
                          {t("workspace.selectedDocument.inspectLatestRun")}
                        </Button>
                      ) : null}
                    </>
                  ) : (
                    <div className="mt-2 text-slate-500">{t("workspace.selectedDocument.noWorkflowRuns")}</div>
                  )}
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-slate-950">{t("workspace.selectedDocument.recentVersions")}</div>
                    <div className="text-xs font-medium text-slate-500">{recentVersions.length}</div>
                  </div>
                  <div className="mt-3 space-y-2">
                    {recentVersions.map((version) => (
                      <div key={version.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-medium text-slate-900">v{version.version_number}</div>
                              <div className="mt-1 text-slate-500">
                              {version.parser_name ? formatParserLabel(version.parser_name) : t("workspace.selectedDocument.parserPendingLower")} · {version.chunk_count} {t("workspace.selectedDocument.chunks").toLowerCase()} · {t("workspace.selectedDocument.tokens", { count: formatNumber(version.token_count_total) })}
                              </div>
                            </div>
                          <Badge className={cn("border text-[11px]", getStatusBadgeClass(version.ingestion_status))} variant="outline">
                            {formatStatusLabel(version.ingestion_status)}
                          </Badge>
                        </div>
                        <div className="mt-2 text-slate-500">{formatTimestamp(version.updated_at)}</div>
                        {onSelectVersion ? (
                          <div className="mt-3">
                            <Button
                              className="bg-white"
                              onClick={() => void onSelectVersion(version.id)}
                              size="sm"
                              type="button"
                              variant="outline"
                            >
                              {selectedDocumentVersionId === version.id ? t("workspace.selectedDocument.viewingVersion") : t("workspace.selectedDocument.openVersion")}
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
            <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3">
              {chunks.slice(0, 3).map((chunk) => (
                <div
                  key={chunk.id}
                  className={cn(
                    "rounded-xl border p-3",
                    chunk.id === focusedChunkId ? "border-blue-200 bg-blue-50/70 shadow-sm" : "border-slate-200 bg-slate-50/70"
                  )}
                >
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <div className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                      {t("workspace.chatView.chunkIndex", { index: String(chunk.chunk_index) })}
                      {chunk.id === focusedChunkId ? <span className="ml-2 text-blue-600">{t("workspace.selectedDocument.matchedCitation")}</span> : null}
                    </div>
                    <div className="text-xs text-slate-500">{t("workspace.selectedDocument.tokens", { count: formatNumber(chunk.token_count) })}</div>
                  </div>
                  <div className={`whitespace-pre-wrap text-sm leading-6 text-slate-700 ${chunkPreviewClassName ?? ""}`.trim()}>
                    {chunk.content}
                  </div>
                  {Object.keys(chunk.metadata_json).length > 0 && (
                    <div className="mt-2 text-xs text-slate-500">
                      {t("workspace.selectedDocument.metadataPrefix")} {Object.entries(chunk.metadata_json)
                        .slice(0, 3)
                        .map(([key, value]) => `${key}=${String(value)}`)
                        .join(" · ")}
                    </div>
                  )}
                </div>
              ))}
              {chunks.length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950">
                  {t("workspace.selectedDocument.chunksAppearAfterIngestion")}
                </div>
              )}
            </div>
          </DialogFormLayout>
        ) : (
          <div className="text-sm text-slate-500">{emptyState}</div>
        )}
        <ConfirmDialog
          cancelLabel={t("workspace.headerBar.cancel")}
          confirmLabel={t("workspace.selectedDocument.delete")}
          description={
            detail
              ? t("workspace.confirm.deleteDocument", { title: detail.document.title })
              : t("workspace.confirm.deleteSelectedDocument")
          }
          isLoading={isRunningDocumentAction}
          onCancel={() => setIsDeleteConfirmOpen(false)}
          onConfirm={async () => {
            await onDeleteDocument();
            setIsDeleteConfirmOpen(false);
          }}
          open={isDeleteConfirmOpen && Boolean(detail) && !isDeletedDocument}
          title={t("workspace.selectedDocument.delete")}
        />
        <ConfirmDialog
          cancelLabel={t("workspace.headerBar.cancel")}
          confirmLabel={isDeletedDocument ? t("workspace.selectedDocument.restore") : t("workspace.selectedDocument.reindex")}
          description={detail ? t(isDeletedDocument ? "workspace.confirm.restoreDocument" : "workspace.confirm.reindexDocument", { title: detail.document.title }) : ""}
          isLoading={isRunningDocumentAction}
          onCancel={() => setIsLifecycleConfirmOpen(false)}
          onConfirm={async () => {
            await (isDeletedDocument ? onRestoreDocument() : onReindexDocument());
            setIsLifecycleConfirmOpen(false);
          }}
          open={isLifecycleConfirmOpen && Boolean(detail)}
          title={isDeletedDocument ? t("workspace.selectedDocument.restore") : t("workspace.selectedDocument.reindex")}
        />
        <FormDialog
          description={t("workspace.confirm.permanentDeleteDocument", { title: detail?.document.title ?? "" })}
          footer={<DialogFormActions><Button onClick={() => setIsPermanentDeleteOpen(false)} type="button" variant="outline">{t("workspace.headerBar.cancel")}</Button><Button className="bg-rose-600 text-white hover:bg-rose-700" disabled={isRunningDocumentAction || permanentDeleteTitle !== detail?.document.title} onClick={async () => { await onPermanentlyDeleteDocument(permanentDeleteTitle); setIsPermanentDeleteOpen(false); }} type="button">{t("workspace.selectedDocument.permanentDelete")}</Button></DialogFormActions>}
          onClose={() => setIsPermanentDeleteOpen(false)}
          open={isPermanentDeleteOpen && Boolean(detail) && isDeletedDocument}
          title={t("workspace.selectedDocument.permanentDelete")}
        >
          <DialogFormField hint={t("workspace.confirm.permanentDeleteHint")} label={t("workspace.confirm.permanentDeleteLabel")} showHint>
            <Input autoFocus onChange={(event) => setPermanentDeleteTitle(event.target.value)} value={permanentDeleteTitle} />
          </DialogFormField>
        </FormDialog>
      </CardContent>
    </Card>
  );
}
