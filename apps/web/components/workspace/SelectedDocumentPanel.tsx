"use client";

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
import { WorkspaceExecutionPacket } from "@/components/workspace/WorkspaceExecutionPacket";
import { WorkspaceRecommendedAgentsPanel } from "@/components/workspace/WorkspaceRecommendedAgentsPanel";
import { useI18n } from "@/lib/i18n/provider";
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
  error_message?: string | null;
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
  isRunningDocumentAction: boolean;
  onDeleteDocument: () => void | Promise<void>;
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
  onActivateRecommendedAgent?: (recommendation: WorkspaceAgentRecommendation) => void | Promise<void>;
  title?: string;
};

export function SelectedDocumentPanel({
  chunkPreviewClassName,
  detail,
  emptyState,
  focusedChunkId = null,
  canManageDocuments,
  isRunningDocumentAction,
  onDeleteDocument,
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
  onActivateRecommendedAgent,
  title,
}: SelectedDocumentPanelProps) {
  const { t } = useI18n();
  const latestWorkflowRun = relatedWorkflowRuns[0] ?? null;
  const topRecommendation = recommendedAgents[0] ?? null;
  const chunkCount = detail?.chunk_count ?? detail?.chunks.length ?? 0;
  const tokenCountTotal = detail?.token_count_total ?? detail?.chunks.reduce((sum, chunk) => sum + (chunk.token_count ?? 0), 0) ?? 0;
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
      return t("workspace.selectedDocument.packet.failedDescription");
    }

    if (isDocumentReady) {
      return t("workspace.selectedDocument.packet.readyDescription");
    }

    return t("workspace.selectedDocument.packet.intakeDescription");
  }

  function buildExecutionPacketPrimaryAction() {
    if (isDeletedDocument) {
      if (!canManageDocuments) {
        return null;
      }

      return {
        label: t("workspace.selectedDocument.restore"),
        onClick: onRestoreDocument,
      };
    }

    if (topRecommendation && onActivateRecommendedAgent) {
      return {
        label: getRecommendationActionLabel(topRecommendation.targetView),
        onClick: () => onActivateRecommendedAgent(topRecommendation),
      };
    }

    if (isDocumentReady && onOpenChatView) {
      return {
        label: t("workspace.selectedDocument.continueInChat"),
        onClick: onOpenChatView,
      };
    }

    if (isDocumentFailed && onOpenFailedDocumentsQueue) {
      return {
        label: t("workspace.selectedDocument.openFailedQueue"),
        onClick: onOpenFailedDocumentsQueue,
        variant: "outline" as const,
      };
    }

    if ((isDocumentFailed || isLatestWorkflowFailed) && onOpenWorkflowView) {
      return {
        label: t("workspace.selectedDocument.openWorkflowSupervision"),
        onClick: onOpenWorkflowView,
        variant: "outline" as const,
      };
    }

    if (latestWorkflowRun && onInspectWorkflowRun) {
      return {
        label: t("workspace.selectedDocument.inspectLatestRun"),
        onClick: () => onInspectWorkflowRun(latestWorkflowRun.id),
        variant: "outline" as const,
      };
    }

    return null;
  }

  function buildExecutionPacketSecondaryActions() {
    const actions: Array<{ label: string; onClick: () => void | Promise<void>; variant?: "default" | "outline" }> = [];
    const primaryAction = buildExecutionPacketPrimaryAction();

    if (isDeletedDocument) {
      return actions;
    }

    if (isDocumentReady && onOpenChatView && primaryAction?.label !== t("workspace.selectedDocument.continueInChat")) {
      actions.push({
        label: t("workspace.selectedDocument.continueInChat"),
        onClick: onOpenChatView,
      });
    }

    if (onOpenWorkflowView && primaryAction?.label !== t("workspace.selectedDocument.openWorkflowSupervision")) {
      actions.push({
        label: t("workspace.selectedDocument.openWorkflowSupervision"),
        onClick: onOpenWorkflowView,
        variant: "outline",
      });
    }

    if (latestWorkflowRun && onInspectWorkflowRun && primaryAction?.label !== t("workspace.selectedDocument.inspectLatestRun")) {
      actions.push({
        label: t("workspace.selectedDocument.inspectLatestRun"),
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

    if (isDocumentFailed || isLatestWorkflowFailed) {
      if (!onOpenFailedDocumentsQueue && !onOpenWorkflowView) {
        return null;
      }

      return (
        <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-3">
          <div className="font-medium text-amber-900">{t("workspace.selectedDocument.operatorNextStep")}</div>
          <div className="mt-1 text-amber-800">
            {t("workspace.selectedDocument.operatorNextStepDescription")}
          </div>
        </div>
      );
    }

    if (isDocumentReady && (onOpenChatView || onOpenWorkflowView)) {
      return (
        <div className="mb-3 rounded-md border border-emerald-200 bg-emerald-50/70 px-3 py-3 text-xs text-slate-700">
          <div className="font-medium text-slate-950">{t("workspace.selectedDocument.readyFollowUpTitle")}</div>
          <div className="mt-1 text-slate-600">{t("workspace.selectedDocument.readyFollowUpDescription")}</div>
        </div>
      );
    }

    if (!isDocumentReady && !isDocumentFailed && !isLatestWorkflowFailed && (onOpenWorkflowView || latestWorkflowRun)) {
      return (
        <div className="mb-3 rounded-md border border-sky-200 bg-sky-50/70 px-3 py-3 text-xs text-slate-700">
          <div className="font-medium text-slate-950">{t("workspace.selectedDocument.intakeFollowUpTitle")}</div>
          <div className="mt-1 text-slate-600">{t("workspace.selectedDocument.intakeFollowUpDescription")}</div>
        </div>
      );
    }

    return null;
  }

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle>{title ?? t("workspace.selectedDocument.selectedDocument")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-slate-700">
        {detail ? (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-medium text-slate-900">{detail.document.title}</div>
                <div className="mt-1 text-xs text-slate-500">{detail.asset_file_name ?? t("workspace.selectedDocument.noAssetMetadata")}</div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  disabled={!canManageDocuments || isRunningDocumentAction}
                  onClick={() => void (isDeletedDocument ? onRestoreDocument() : onReindexDocument())}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  {isDeletedDocument ? t("workspace.selectedDocument.restore") : t("workspace.selectedDocument.reindex")}
                </Button>
                {!isDeletedDocument ? (
                  <Button
                    className="border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-700"
                    disabled={!canManageDocuments || isRunningDocumentAction}
                    onClick={() => void onDeleteDocument()}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    {t("workspace.selectedDocument.delete")}
                  </Button>
                ) : null}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-md bg-white px-2 py-2">
                <div className="text-slate-500">{t("workspace.selectedDocument.parser")}</div>
                <div className="mt-1 font-medium text-slate-900">{detail.parser_name ? formatParserLabel(detail.parser_name) : t("workspace.selectedDocument.pending")}</div>
              </div>
              <div className="rounded-md bg-white px-2 py-2">
                <div className="text-slate-500">{showExtendedMetadata ? t("workspace.selectedDocument.version") : t("workspace.selectedDocument.chunks")}</div>
                {showExtendedMetadata ? (
                  <>
                    <div className="mt-1 font-medium text-slate-900">v{detail.version_number ?? t("workspace.selectedDocument.notAvailable")}</div>
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
                  <div className="rounded-md bg-white px-2 py-2">
                    <div className="text-slate-500">{t("workspace.selectedDocument.chunkCount")}</div>
                    <div className="mt-1 font-medium text-slate-900">{chunkCount}</div>
                  </div>
                  <div className="rounded-md bg-white px-2 py-2">
                    <div className="text-slate-500">{t("workspace.selectedDocument.assetSize")}</div>
                    <div className="mt-1 font-medium text-slate-900">{formatFileSize(detail.asset_file_size_bytes ?? null)}</div>
                  </div>
                </>
              )}
            </div>
            {showExtendedMetadata && (
              <>
                <div className="rounded-md bg-white px-3 py-3 text-xs text-slate-600">
                  <div className="font-medium text-slate-900">{t("workspace.selectedDocument.processingHealth")}</div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                      <div className="text-slate-500">{t("workspace.selectedDocument.documentIngestion")}</div>
                      <div className="mt-2">
                        <Badge className={cn("border text-[11px]", getStatusBadgeClass(detail.document.ingestion_status))} variant="outline">
                          {formatStatusLabel(detail.document.ingestion_status)}
                        </Badge>
                      </div>
                    </div>
                    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                      <div className="text-slate-500">{t("workspace.selectedDocument.documentIndexing")}</div>
                      <div className="mt-2">
                        <Badge className={cn("border text-[11px]", getStatusBadgeClass(detail.document.indexing_status))} variant="outline">
                          {formatStatusLabel(detail.document.indexing_status)}
                        </Badge>
                      </div>
                    </div>
                    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                      <div className="text-slate-500">{t("workspace.selectedDocument.currentVersionTokens")}</div>
                      <div className="mt-1 font-medium text-slate-900">{formatNumber(tokenCountTotal)}</div>
                    </div>
                    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                      <div className="text-slate-500">{t("workspace.selectedDocument.contentType")}</div>
                      <div className="mt-1 font-medium text-slate-900">{detail.asset_content_type ?? t("workspace.selectedDocument.unknown")}</div>
                    </div>
                  </div>
                </div>
                <div className="rounded-md bg-white px-3 py-3 text-xs text-slate-600">
                  <div className="font-medium text-slate-900">{t("workspace.selectedDocument.versionState")}</div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                      <div className="text-slate-500">{t("workspace.selectedDocument.latestAttempt")}</div>
                      <div className="mt-1 font-medium text-slate-900">v{detail.version_number ?? t("workspace.selectedDocument.notAvailable")}</div>
                      <div className="mt-1 text-slate-500">{detail.parser_name ? formatParserLabel(detail.parser_name) : t("workspace.selectedDocument.parserPendingLower")}</div>
                    </div>
                    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                      <div className="text-slate-500">{t("workspace.selectedDocument.latestCompleted")}</div>
                      <div className="mt-1 font-medium text-slate-900">
                        {detail.latest_completed_version_number ? `v${detail.latest_completed_version_number}` : t("workspace.selectedDocument.noCompletedVersion")}
                      </div>
                      <div className="mt-1 text-slate-500">
                        {detail.latest_completed_parser_name ? formatParserLabel(detail.latest_completed_parser_name) : t("workspace.selectedDocument.awaitingSuccessfulIngestion")}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="rounded-md bg-white px-3 py-3 text-xs text-slate-600">
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
                        onActivateRecommendation={onActivateRecommendedAgent}
                        recommendations={recommendedAgents}
                        title={t("workspace.selectedDocument.recommendedAgents")}
                      />
                    </div>
                  ) : null}
                  {renderNextStepPanel()}
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium text-slate-900">{t("workspace.selectedDocument.latestWorkflow")}</div>
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
                        <div className="mt-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">
                          {formatOperatorErrorMessage(latestWorkflowRun.error_message)}
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
                <div className="rounded-md bg-white px-3 py-3 text-xs text-slate-600">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium text-slate-900">{t("workspace.selectedDocument.recentVersions")}</div>
                    <div className="text-slate-500">{detail.recent_versions?.length ?? 0}</div>
                  </div>
                  <div className="mt-3 space-y-2">
                    {detail.recent_versions?.map((version) => (
                      <div key={version.id} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3">
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
                <div className="rounded-md bg-white px-3 py-3 text-xs text-slate-600">
                  <div className="font-medium text-slate-900">{t("workspace.selectedDocument.storageLocation")}</div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                      <div className="text-slate-500">{t("workspace.selectedDocument.bucket")}</div>
                      <div className="mt-1 break-all font-medium text-slate-900">{detail.storage_bucket ?? t("workspace.selectedDocument.notAvailable")}</div>
                    </div>
                    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                      <div className="text-slate-500">{t("workspace.selectedDocument.key")}</div>
                      <div className="mt-1 break-all font-medium text-slate-900">{detail.storage_key ?? t("workspace.selectedDocument.notAvailable")}</div>
                    </div>
                  </div>
                </div>
              </>
            )}
            <div className="space-y-2">
              {detail.chunks.slice(0, 3).map((chunk) => (
                <div
                  key={chunk.id}
                  className={cn(
                    "rounded-md border px-3 py-3",
                    chunk.id === focusedChunkId ? "border-blue-200 bg-blue-50/70 shadow-sm" : "border-transparent bg-white"
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
              {detail.chunks.length === 0 && (
                <div className="rounded-md bg-white px-3 py-3 text-sm text-slate-500">
                  {t("workspace.selectedDocument.chunksAppearAfterIngestion")}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="text-sm text-slate-500">{emptyState}</div>
        )}
      </CardContent>
    </Card>
  );
}
