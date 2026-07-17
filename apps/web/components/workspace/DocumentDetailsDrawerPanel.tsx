"use client";

import { useState } from "react";
import { FileText, RotateCcw, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DialogFormActions, DialogFormField, DialogFormGrid, DialogFormLayout, FormDialog } from "@/components/ui/form-dialog";
import { Input } from "@/components/ui/input";
import { WorkspaceRecommendedAgentsPanel } from "@/components/workspace/WorkspaceRecommendedAgentsPanel";
import type { DocumentDetail, WorkspaceAgentRecommendation, WorkflowRun } from "@/components/workspace/workspace-types";
import type { DataSource } from "@/lib/data-sources";
import { useI18n } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";
import {
  formatFileSize,
  formatNumber,
  formatParserLabel,
  formatStatusLabel,
  formatTimestamp,
  formatWorkflowTypeLabel,
  getStatusBadgeClass,
} from "@/lib/workspace-formatters";

type DocumentDetailsDrawerPanelProps = {
  canManageDocuments: boolean;
  dataSource: DataSource | null;
  detail: DocumentDetail;
  focusedChunkId: string | null;
  isActivatingRecommendation: boolean;
  isRunningDocumentAction: boolean;
  onActivateRecommendedAgent: (recommendation: WorkspaceAgentRecommendation) => void | Promise<void>;
  onInspectWorkflowRun: (workflowRunId: string) => void | Promise<void>;
  onPermanentlyDeleteDocument: (confirmationTitle: string) => void | Promise<void>;
  onRestoreDocument: () => void | Promise<void>;
  onSelectVersion: (documentVersionId: string) => void | Promise<void>;
  recommendedAgents: WorkspaceAgentRecommendation[];
  workflowRuns: WorkflowRun[];
};

const labelClassName = "text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500";
const valueClassName = "mt-2 text-sm font-semibold text-slate-950";
const metricClassName = "rounded-xl border border-slate-200 bg-slate-50/70 p-3";
const sectionClassName = "space-y-4 rounded-xl border border-slate-200 bg-white p-4";

export function DocumentDetailsDrawerPanel({
  canManageDocuments,
  dataSource,
  detail,
  focusedChunkId,
  isActivatingRecommendation,
  isRunningDocumentAction,
  onActivateRecommendedAgent,
  onInspectWorkflowRun,
  onPermanentlyDeleteDocument,
  onRestoreDocument,
  onSelectVersion,
  recommendedAgents,
  workflowRuns,
}: DocumentDetailsDrawerPanelProps) {
  const { t } = useI18n();
  const [isPermanentDeleteOpen, setIsPermanentDeleteOpen] = useState(false);
  const [permanentDeleteTitle, setPermanentDeleteTitle] = useState("");
  const latestWorkflowRun = workflowRuns
    .filter((workflowRun) => workflowRun.subject_id === detail.document.id)
    .sort((left, right) => new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime())[0] ?? null;
  const isDeleted = Boolean(detail.document.is_deleted);
  const dataSourceStatus = dataSource?.latest_sync_run?.run_status === "running"
    ? "syncing"
    : dataSource?.sync_status ?? null;
  const contentType = detail.asset_content_type?.toLowerCase() ?? "";
  const contentTypeLabel = contentType.includes("pdf")
    ? t("workspace.selectedDocument.contentTypes.pdf")
    : contentType.includes("word") || contentType.includes("msword")
      ? t("workspace.selectedDocument.contentTypes.word")
      : contentType.includes("spreadsheet") || contentType.includes("excel")
        ? t("workspace.selectedDocument.contentTypes.spreadsheet")
        : contentType.includes("presentation") || contentType.includes("powerpoint")
          ? t("workspace.selectedDocument.contentTypes.presentation")
          : contentType.startsWith("image/")
            ? t("workspace.selectedDocument.contentTypes.image")
            : contentType === "text/html"
              ? t("workspace.selectedDocument.contentTypes.web")
              : contentType === "application/json"
                ? t("workspace.selectedDocument.contentTypes.json")
                : contentType.startsWith("text/")
                  ? t("workspace.selectedDocument.contentTypes.text")
                  : contentType
                    ? t("workspace.selectedDocument.contentTypes.other")
                    : t("workspace.selectedDocument.unknown");

  return (
    <>
      <DialogFormLayout>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600">
              <FileText className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-slate-950">
                {detail.asset_file_name ?? detail.document.title}
              </div>
              <div className="mt-1 flex flex-wrap gap-2">
                <Badge className={cn("border", getStatusBadgeClass(detail.document.ingestion_status))} variant="outline">
                  {formatStatusLabel(detail.document.ingestion_status)}
                </Badge>
                {detail.document.indexing_status !== detail.document.ingestion_status ? (
                  <Badge className={cn("border", getStatusBadgeClass(detail.document.indexing_status))} variant="outline">
                    {formatStatusLabel(detail.document.indexing_status)}
                  </Badge>
                ) : null}
              </div>
            </div>
          </div>
          {isDeleted ? (
            <div className="flex flex-wrap gap-2">
              <Button className="rounded-xl bg-white" disabled={!canManageDocuments || isRunningDocumentAction} onClick={() => void onRestoreDocument()} size="sm" type="button" variant="outline">
                <RotateCcw className="h-4 w-4" />
                {t("workspace.selectedDocument.restore")}
              </Button>
              <Button className="rounded-xl border-rose-200 bg-white text-rose-700 hover:bg-rose-50 hover:text-rose-700" disabled={!canManageDocuments || isRunningDocumentAction} onClick={() => setIsPermanentDeleteOpen(true)} size="sm" type="button" variant="outline">
                <Trash2 className="h-4 w-4" />
                {t("workspace.selectedDocument.permanentDelete")}
              </Button>
            </div>
          ) : null}
        </div>

        <section className={sectionClassName}>
          <div className="text-sm font-semibold text-slate-950">{t("workspace.selectedDocument.selectedDocument")}</div>
          <DialogFormGrid className="gap-3 xl:grid-cols-3">
            <div className={metricClassName}>
              <div className={labelClassName}>{t("workspace.selectedDocument.parser")}</div>
              <div className={valueClassName}>{detail.parser_name ? formatParserLabel(detail.parser_name) : t("workspace.selectedDocument.pending")}</div>
            </div>
            <div className={metricClassName}>
              <div className={labelClassName}>{t("workspace.selectedDocument.contentType")}</div>
              <div className={cn(valueClassName, "truncate")} title={detail.asset_content_type ?? undefined}>{contentTypeLabel}</div>
            </div>
            <div className={metricClassName}>
              <div className={labelClassName}>{t("workspace.selectedDocument.assetSize")}</div>
              <div className={valueClassName}>{formatFileSize(detail.asset_file_size_bytes)}</div>
            </div>
          </DialogFormGrid>
        </section>

        {dataSource ? (
          <section className={sectionClassName}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm font-semibold text-slate-950">{t("workspace.selectedDocument.sourceInformation")}</div>
              {dataSourceStatus ? (
                <Badge className={cn("border", getStatusBadgeClass(dataSourceStatus))} variant="outline">
                  {t(`workspace.documentsView.dataSources.status.${dataSourceStatus}`)}
                </Badge>
              ) : null}
            </div>
            <DialogFormGrid className="gap-3">
              <div className={metricClassName}>
                <div className={labelClassName}>{t("workspace.selectedDocument.sourceType")}</div>
                <div className={valueClassName}>{t(`workspace.documentsView.dataSources.types.${dataSource.source_type}`)}</div>
              </div>
              <div className={metricClassName}>
                <div className={labelClassName}>{t("workspace.selectedDocument.lastSynchronized")}</div>
                <div className={valueClassName}>
                  {dataSource.last_synced_at
                    ? formatTimestamp(dataSource.last_synced_at)
                    : t("workspace.selectedDocument.neverSynchronized")}
                </div>
              </div>
            </DialogFormGrid>
            {dataSource.source_uri ? (
              <div className={metricClassName}>
                <div className={labelClassName}>{t("workspace.selectedDocument.sourceUrl")}</div>
                <a
                  className="mt-2 block break-all text-sm font-medium text-blue-700 underline-offset-4 hover:underline"
                  href={dataSource.source_uri}
                  rel="noreferrer"
                  target="_blank"
                >
                  {dataSource.source_uri}
                </a>
              </div>
            ) : null}
            {dataSource.last_sync_error ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm leading-6 text-rose-700">
                <div className="font-semibold">{t("workspace.selectedDocument.syncError")}</div>
                <div className="mt-1 break-words">{dataSource.last_sync_error}</div>
              </div>
            ) : null}
          </section>
        ) : null}

        <section className={sectionClassName}>
          <div className="text-sm font-semibold text-slate-950">{t("workspace.selectedDocument.processingHealth")}</div>
          <DialogFormGrid className="gap-3 xl:grid-cols-4">
            <div className={metricClassName}>
              <div className={labelClassName}>{t("workspace.selectedDocument.documentIngestion")}</div>
              <div className="mt-2"><Badge className={cn("border", getStatusBadgeClass(detail.document.ingestion_status))} variant="outline">{formatStatusLabel(detail.document.ingestion_status)}</Badge></div>
            </div>
            <div className={metricClassName}>
              <div className={labelClassName}>{t("workspace.selectedDocument.documentIndexing")}</div>
              <div className="mt-2"><Badge className={cn("border", getStatusBadgeClass(detail.document.indexing_status))} variant="outline">{formatStatusLabel(detail.document.indexing_status)}</Badge></div>
            </div>
            <div className={metricClassName}>
              <div className={labelClassName}>{t("workspace.selectedDocument.chunkCount")}</div>
              <div className={valueClassName}>{formatNumber(detail.chunk_count)}</div>
            </div>
            <div className={metricClassName}>
              <div className={labelClassName}>{t("workspace.selectedDocument.currentVersionTokens")}</div>
              <div className={valueClassName}>{formatNumber(detail.token_count_total)}</div>
            </div>
          </DialogFormGrid>
        </section>

        <section className={sectionClassName}>
          <div className="text-sm font-semibold text-slate-950">{t("workspace.selectedDocument.versionState")}</div>
          <DialogFormGrid className="gap-3">
            <div className={metricClassName}>
              <div className={labelClassName}>{t("workspace.selectedDocument.latestAttempt")}</div>
              <div className={valueClassName}>v{detail.version_number ?? t("workspace.selectedDocument.notAvailable")}</div>
              <div className="mt-1 text-xs text-slate-500">{detail.parser_name ? formatParserLabel(detail.parser_name) : t("workspace.selectedDocument.parserPendingLower")}</div>
            </div>
            <div className={metricClassName}>
              <div className={labelClassName}>{t("workspace.selectedDocument.latestCompleted")}</div>
              <div className={valueClassName}>{detail.latest_completed_version_number ? `v${detail.latest_completed_version_number}` : t("workspace.selectedDocument.noCompletedVersion")}</div>
              <div className="mt-1 text-xs text-slate-500">{detail.latest_completed_parser_name ? formatParserLabel(detail.latest_completed_parser_name) : t("workspace.selectedDocument.awaitingSuccessfulIngestion")}</div>
            </div>
          </DialogFormGrid>
          {detail.recent_versions.length > 0 ? (
            <div className="space-y-2">
              {detail.recent_versions.map((version) => (
                <button className={cn("flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left transition", version.id === detail.document_version_id ? "border-blue-200 bg-blue-50/70" : "border-slate-200 bg-white hover:bg-slate-50")} key={version.id} onClick={() => void onSelectVersion(version.id)} type="button">
                  <div>
                    <div className="text-sm font-semibold text-slate-950">v{version.version_number}</div>
                    <div className="mt-1 text-xs text-slate-500">{formatTimestamp(version.updated_at)} · {version.chunk_count} {t("workspace.selectedDocument.chunks").toLowerCase()}</div>
                  </div>
                  <Badge className={cn("border", getStatusBadgeClass(version.ingestion_status))} variant="outline">{formatStatusLabel(version.ingestion_status)}</Badge>
                </button>
              ))}
            </div>
          ) : null}
        </section>

        {recommendedAgents.length > 0 ? <WorkspaceRecommendedAgentsPanel description={t("workspace.selectedDocument.recommendedAgentsDescription")} getActionLabel={(targetView) => targetView === "chat" ? t("workspace.selectedDocument.activateInChat") : targetView === "documents" ? t("workspace.selectedDocument.activateInDocuments") : t("workspace.selectedDocument.activateInWorkflows")} isActivatingRecommendation={isActivatingRecommendation} onActivateRecommendation={onActivateRecommendedAgent} presentation="dialog" recommendations={recommendedAgents} title={t("workspace.selectedDocument.recommendedAgents")} /> : null}

        <section className={sectionClassName}>
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-slate-950">{t("workspace.selectedDocument.latestWorkflow")}</div>
            {latestWorkflowRun ? <Badge className={cn("border", getStatusBadgeClass(latestWorkflowRun.workflow_status))} variant="outline">{formatStatusLabel(latestWorkflowRun.workflow_status)}</Badge> : null}
          </div>
          {latestWorkflowRun ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
              <div className="text-sm font-semibold text-slate-950">{formatWorkflowTypeLabel(latestWorkflowRun.workflow_type)}</div>
              <div className="mt-1 text-xs text-slate-500">{formatTimestamp(latestWorkflowRun.updated_at)}</div>
              {latestWorkflowRun.follow_up_reason ? <div className="mt-2 text-sm leading-6 text-slate-600">{latestWorkflowRun.follow_up_reason}</div> : null}
              <Button className="mt-3 bg-white" onClick={() => void onInspectWorkflowRun(latestWorkflowRun.id)} size="sm" type="button" variant="outline">{t("workspace.selectedDocument.inspectLatestRun")}</Button>
            </div>
          ) : <div className="text-sm text-slate-500">{t("workspace.selectedDocument.noWorkflowRuns")}</div>}
        </section>

        <section className={sectionClassName}>
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-slate-950">{t("workspace.selectedDocument.chunks")}</div>
            <div className="text-xs font-medium text-slate-500">{detail.chunks.length}</div>
          </div>
          <div className="space-y-2">
            {detail.chunks.slice(0, 3).map((chunk) => (
              <div className={cn("rounded-xl border p-3", chunk.id === focusedChunkId ? "border-blue-200 bg-blue-50/70" : "border-slate-200 bg-slate-50/70")} key={chunk.id}>
                <div className="flex items-center justify-between gap-3">
                  <div className={labelClassName}>{t("workspace.chatView.chunkIndex", { index: String(chunk.chunk_index) })}</div>
                  <div className="text-xs text-slate-500">{t("workspace.selectedDocument.tokens", { count: formatNumber(chunk.token_count) })}</div>
                </div>
                <div className="mt-2 line-clamp-5 whitespace-pre-wrap text-sm leading-6 text-slate-700">{chunk.content}</div>
              </div>
            ))}
            {detail.chunks.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">{t("workspace.selectedDocument.chunksAppearAfterIngestion")}</div> : null}
          </div>
        </section>
      </DialogFormLayout>

      <FormDialog
        footer={<DialogFormActions><Button onClick={() => setIsPermanentDeleteOpen(false)} type="button" variant="outline">{t("workspace.headerBar.cancel")}</Button><Button className="bg-rose-600 text-white hover:bg-rose-700" disabled={isRunningDocumentAction || permanentDeleteTitle !== detail.document.title} onClick={async () => { await onPermanentlyDeleteDocument(permanentDeleteTitle); setIsPermanentDeleteOpen(false); }} type="button">{t("workspace.selectedDocument.permanentDelete")}</Button></DialogFormActions>}
        onClose={() => setIsPermanentDeleteOpen(false)}
        open={isPermanentDeleteOpen}
        title={t("workspace.selectedDocument.permanentDelete")}
      >
        <DialogFormField hint={t("workspace.confirm.permanentDeleteHint")} label={t("workspace.confirm.permanentDeleteLabel")} showHint>
          <Input onChange={(event) => setPermanentDeleteTitle(event.target.value)} placeholder={detail.document.title} value={permanentDeleteTitle} />
        </DialogFormField>
      </FormDialog>
    </>
  );
}
