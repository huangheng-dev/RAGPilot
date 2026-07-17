"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, RotateCcw, Trash2 } from "lucide-react";
import { DocumentRegistryPanel } from "@/components/workspace/DocumentRegistryPanel";
import { DocumentDetailsDrawerPanel } from "@/components/workspace/DocumentDetailsDrawerPanel";
import { SelectedWorkflowRunPanel } from "@/components/workspace/SelectedWorkflowRunPanel";
import { Button } from "@/components/ui/button";
import { DialogFormActions, FormDialog } from "@/components/ui/form-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { listDataSources, startDataSourceSync, type DataSource } from "@/lib/data-sources";
import { useI18n } from "@/lib/i18n/provider";
import type {
  DocumentDetail,
  DocumentLifecycleFilter,
  DocumentRecord,
  DocumentSourceFilter,
  WorkspaceAgentContext,
  WorkspaceAgentRecommendation,
  WorkflowRun,
  WorkflowRunDetail
} from "@/components/workspace/workspace-types";

type WorkspaceDocumentsViewProps = {
  activeAgentContext: WorkspaceAgentContext | null;
  documentPage: number;
  documentPageCount: number;
  documentLifecycleFilter: DocumentLifecycleFilter;
  documentQuery: string;
  documentSourceFilter: DocumentSourceFilter;
  documentStatusFilter: string;
  documentTotalCount: number;
  documents: DocumentRecord[];
  tenantId: string | null;
  knowledgeBaseId: string | null;
  focusedChunkId: string | null;
  canManageDocuments: boolean;
  canManageWorkflowRuns: boolean;
  isActivatingRecommendation?: boolean;
  isCancellingWorkflow: boolean;
  isSavingWorkflowNotes: boolean;
  isRetryAvailable: boolean;
  isRetryEligibilityLoading: boolean;
  isRetryingWorkflow: boolean;
  isRunningDocumentAction: boolean;
  onBulkDeleteDocuments: () => void | Promise<void>;
  onBulkReindexDocuments: () => void | Promise<void>;
  onBulkRestoreDocuments: () => void | Promise<void>;
  onClearDocumentSelection: () => void;
  onDeleteDocument: () => void | Promise<void>;
  onPermanentlyDeleteDocument: (confirmationTitle: string) => void | Promise<void>;
  onDocumentPageChange: (page: number) => void;
  onActivateRecommendedAgent: (recommendation: WorkspaceAgentRecommendation) => void | Promise<void>;
  onOpenChatView: () => void;
  onOpenFailedDocumentsQueue: () => void;
  onOpenWorkflowView: () => void;
  onCancelWorkflowRun: () => void | Promise<void>;
  onReindexDocument: () => void | Promise<void>;
  onRestoreDocument: () => void | Promise<void>;
  onSaveWorkflowOperatorNotes: (operatorNotes: string | null) => void | Promise<void>;
  onSelectDocumentVersion: (documentVersionId: string) => void | Promise<void>;
  onRetryWorkflowRun: () => void | Promise<void>;
  onSelectDocument: (documentId: string) => void | Promise<void>;
  onSelectWorkflowRun: (workflowRunId: string) => void | Promise<void>;
  onShowFailedDocuments: () => void;
  onToggleDocumentSelection: (documentId: string) => void;
  onToggleSelectAllDocumentsOnPage: () => void;
  selectedDocumentDetail: DocumentDetail | null;
  selectedDocumentId: string | null;
  selectedDocumentIds: string[];
  selectedDocumentRecommendedAgents: WorkspaceAgentRecommendation[];
  selectedWorkflowRunDetail: WorkflowRunDetail | null;
  selectedWorkflowRetryDisabledReason: string | null;
  workflowRuns: WorkflowRun[];
};

const DOCUMENT_PAGE_SIZE = 10;

function formatDataSourceError(
  error: unknown,
  fallback: string,
  invalidRequest: string,
  unsupportedSource: string,
) {
  if (!(error instanceof Error)) return fallback;
  const normalizedMessage = error.message.toLowerCase();
  if (
    normalizedMessage.includes("valid dictionary") ||
    normalizedMessage.includes("field required") ||
    normalizedMessage.includes("unprocessable entity")
  ) {
    return invalidRequest;
  }
  if (normalizedMessage.includes("does not provide a durable connector sync adapter")) {
    return unsupportedSource;
  }
  return fallback;
}

export function WorkspaceDocumentsView({
  activeAgentContext,
  documentPage,
  documentPageCount,
  documentLifecycleFilter,
  documentQuery,
  documentSourceFilter,
  documentStatusFilter,
  documentTotalCount,
  documents,
  tenantId,
  knowledgeBaseId,
  focusedChunkId,
  canManageDocuments,
  canManageWorkflowRuns,
  isActivatingRecommendation = false,
  isCancellingWorkflow,
  isSavingWorkflowNotes,
  isRetryAvailable,
  isRetryEligibilityLoading,
  isRetryingWorkflow,
  isRunningDocumentAction,
  onBulkDeleteDocuments,
  onBulkReindexDocuments,
  onBulkRestoreDocuments,
  onClearDocumentSelection,
  onDeleteDocument,
  onPermanentlyDeleteDocument,
  onDocumentPageChange,
  onActivateRecommendedAgent,
  onOpenChatView,
  onOpenFailedDocumentsQueue,
  onOpenWorkflowView,
  onCancelWorkflowRun,
  onReindexDocument,
  onRestoreDocument,
  onSaveWorkflowOperatorNotes,
  onSelectDocumentVersion,
  onRetryWorkflowRun,
  onSelectDocument,
  onSelectWorkflowRun,
  onShowFailedDocuments,
  onToggleDocumentSelection,
  onToggleSelectAllDocumentsOnPage,
  selectedDocumentDetail,
  selectedDocumentId,
  selectedDocumentIds,
  selectedDocumentRecommendedAgents,
  selectedWorkflowRunDetail,
  selectedWorkflowRetryDisabledReason,
  workflowRuns
}: WorkspaceDocumentsViewProps) {
  const { t } = useI18n();
  const [isDocumentDetailOpen, setIsDocumentDetailOpen] = useState(false);
  const [isWorkflowDetailOpen, setIsWorkflowDetailOpen] = useState(false);
  const [workflowOpenedFromDocument, setWorkflowOpenedFromDocument] = useState(false);
  const [isDocumentDeleteConfirmOpen, setIsDocumentDeleteConfirmOpen] = useState(false);
  const [isDocumentReindexConfirmOpen, setIsDocumentReindexConfirmOpen] = useState(false);
  const [externalSources, setExternalSources] = useState<DataSource[]>([]);
  const [runningSourceId, setRunningSourceId] = useState<string | null>(null);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const loadExternalSources = useCallback(async () => {
    if (!tenantId || !knowledgeBaseId) {
      setExternalSources([]);
      return;
    }
    setSourceError(null);
    try {
      setExternalSources(await listDataSources(knowledgeBaseId));
    } catch (error) {
      setSourceError(
        formatDataSourceError(
          error,
          t("workspace.documentsView.dataSources.loadFailed"),
          t("workspace.documentsView.dataSources.invalidRequest"),
          t("workspace.documentsView.dataSources.unsupportedSource"),
        ),
      );
    }
  }, [knowledgeBaseId, t, tenantId]);

  useEffect(() => {
    void loadExternalSources();
  }, [loadExternalSources]);

  const hasActiveSourceSync = useMemo(
    () => externalSources.some(
      (source) => source.sync_status === "syncing" || source.latest_sync_run?.run_status === "running",
    ),
    [externalSources],
  );

  useEffect(() => {
    if (!hasActiveSourceSync) return;
    const timer = window.setInterval(() => void loadExternalSources(), 3000);
    return () => window.clearInterval(timer);
  }, [hasActiveSourceSync, loadExternalSources]);

  const dataSourceById = useMemo(
    () => new Map(externalSources.map((source) => [source.id, source])),
    [externalSources],
  );
  const selectedExternalSource = selectedDocumentDetail?.document.data_source_id
    ? dataSourceById.get(selectedDocumentDetail.document.data_source_id) ?? null
    : null;
  const selectedSourceActive = Boolean(
    selectedExternalSource &&
    (selectedExternalSource.sync_status === "syncing" || selectedExternalSource.latest_sync_run?.run_status === "running"),
  );

  useEffect(() => {
    if (
      selectedDocumentDetail &&
      selectedDocumentId === selectedDocumentDetail.document.id
    ) {
      setIsDocumentDetailOpen(true);
    }
  }, [selectedDocumentDetail, selectedDocumentId]);

  async function handleSyncSource(source: DataSource) {
    if (!tenantId) return;
    setRunningSourceId(source.id);
    setSourceError(null);
    try {
      await startDataSourceSync(source.id, tenantId);
      await loadExternalSources();
    } catch (error) {
      setSourceError(
        formatDataSourceError(
          error,
          t("workspace.documentsView.dataSources.syncFailed"),
          t("workspace.documentsView.dataSources.invalidRequest"),
          t("workspace.documentsView.dataSources.unsupportedSource"),
        ),
      );
    } finally {
      setRunningSourceId(null);
    }
  }

  return (
    <>
      <div className="console-split-content console-split-content-padding flex-1">
        <div className="flex w-full flex-col gap-3">
          <DocumentRegistryPanel
            activeAgentContext={activeAgentContext}
            documentPage={documentPage}
            documentPageCount={documentPageCount}
            documentLifecycleFilter={documentLifecycleFilter}
            documentQuery={documentQuery}
            documentSourceFilter={documentSourceFilter}
            documentStatusFilter={documentStatusFilter}
            externalSources={externalSources}
            filteredDocumentCount={documentTotalCount}
            canManageDocuments={canManageDocuments}
            isRunningDocumentAction={isRunningDocumentAction}
            onBulkDeleteDocuments={onBulkDeleteDocuments}
            onBulkReindexDocuments={onBulkReindexDocuments}
            onBulkRestoreDocuments={onBulkRestoreDocuments}
            onClearDocumentSelection={onClearDocumentSelection}
            onDocumentPageChange={onDocumentPageChange}
            onOpenWorkflowView={onOpenWorkflowView}
            onInspectWorkflowRun={async (workflowRunId) => {
              setWorkflowOpenedFromDocument(false);
              setIsWorkflowDetailOpen(true);
              await onSelectWorkflowRun(workflowRunId);
            }}
            onSelectDocument={async (documentId) => {
              setIsDocumentDetailOpen(true);
              await onSelectDocument(documentId);
            }}
            onShowFailedDocuments={onShowFailedDocuments}
            onToggleDocumentSelection={onToggleDocumentSelection}
            onToggleSelectAllDocumentsOnPage={onToggleSelectAllDocumentsOnPage}
            pageSize={DOCUMENT_PAGE_SIZE}
            paginatedDocuments={documents}
            selectedDocumentId={selectedDocumentId}
            selectedDocumentIds={selectedDocumentIds}
            sourceError={sourceError}
          />
        </div>
      </div>
      {selectedDocumentDetail ? (
        <FormDialog
          eyebrow={t("workspace.documentsView.documentDetails")}
          footer={selectedDocumentDetail.document.is_deleted ? (
            <DialogFormActions>
              <Button className="rounded-xl bg-white" onClick={() => setIsDocumentDetailOpen(false)} type="button" variant="outline">
                {t("workspace.headerBar.cancel")}
              </Button>
              <Button className="rounded-xl" onClick={onOpenChatView} type="button">
                {t("workspace.selectedDocument.openChat")}
              </Button>
            </DialogFormActions>
          ) : (
            <DialogFormActions className="items-center justify-between">
              <Button
                className="rounded-xl border-rose-200 bg-white text-rose-700 hover:bg-rose-50 hover:text-rose-700"
                disabled={!canManageDocuments || isRunningDocumentAction}
                onClick={() => setIsDocumentDeleteConfirmOpen(true)}
                type="button"
                variant="outline"
              >
                <Trash2 className="h-4 w-4" />
                {t("workspace.selectedDocument.delete")}
              </Button>
              <div className="flex flex-wrap justify-end gap-3">
                {selectedExternalSource ? (
                  <Button
                    className="rounded-xl bg-white"
                    disabled={!canManageDocuments || selectedSourceActive || runningSourceId === selectedExternalSource.id}
                    onClick={() => void handleSyncSource(selectedExternalSource)}
                    type="button"
                    variant="outline"
                  >
                    <RotateCcw className={selectedSourceActive ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
                    {selectedSourceActive
                      ? t("workspace.documentsView.dataSources.syncing")
                      : t("workspace.documentsView.dataSources.sync")}
                  </Button>
                ) : null}
                <Button
                  className="rounded-xl bg-white"
                  disabled={!canManageDocuments || isRunningDocumentAction}
                  onClick={() => setIsDocumentReindexConfirmOpen(true)}
                  type="button"
                  variant="outline"
                >
                  <RotateCcw className="h-4 w-4" />
                  {t("workspace.selectedDocument.reindex")}
                </Button>
                <Button className="rounded-xl bg-white" onClick={() => setIsDocumentDetailOpen(false)} type="button" variant="outline">
                  {t("workspace.headerBar.cancel")}
                </Button>
                <Button className="rounded-xl" onClick={onOpenChatView} type="button">
                  {t("workspace.selectedDocument.openChat")}
                </Button>
              </div>
            </DialogFormActions>
          )}
          onClose={() => setIsDocumentDetailOpen(false)}
          open={isDocumentDetailOpen}
          presentation="side"
          size="xl"
          title={selectedDocumentDetail.document.title}
        >
              {sourceError ? (
                <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {sourceError}
                </div>
              ) : null}
              <DocumentDetailsDrawerPanel
                detail={selectedDocumentDetail}
                dataSource={selectedExternalSource}
                focusedChunkId={focusedChunkId}
                canManageDocuments={canManageDocuments}
                isActivatingRecommendation={isActivatingRecommendation}
                isRunningDocumentAction={isRunningDocumentAction}
                onPermanentlyDeleteDocument={onPermanentlyDeleteDocument}
                onActivateRecommendedAgent={onActivateRecommendedAgent}
                onInspectWorkflowRun={async (workflowRunId) => {
                  setWorkflowOpenedFromDocument(true);
                  setIsDocumentDetailOpen(false);
                  setIsWorkflowDetailOpen(true);
                  await onSelectWorkflowRun(workflowRunId);
                }}
                onRestoreDocument={onRestoreDocument}
                recommendedAgents={selectedDocumentRecommendedAgents}
                onSelectVersion={onSelectDocumentVersion}
                workflowRuns={workflowRuns}
              />
        </FormDialog>
      ) : null}
      <ConfirmDialog
        cancelLabel={t("workspace.headerBar.cancel")}
        confirmLabel={t("workspace.selectedDocument.delete")}
        description={selectedDocumentDetail ? t("workspace.confirm.deleteDocument", { title: selectedDocumentDetail.document.title }) : ""}
        isLoading={isRunningDocumentAction}
        onCancel={() => setIsDocumentDeleteConfirmOpen(false)}
        onConfirm={async () => { await onDeleteDocument(); setIsDocumentDeleteConfirmOpen(false); setIsDocumentDetailOpen(false); }}
        open={isDocumentDeleteConfirmOpen && Boolean(selectedDocumentDetail) && !selectedDocumentDetail?.document.is_deleted}
        title={t("workspace.selectedDocument.delete")}
      />
      <ConfirmDialog
        cancelLabel={t("workspace.headerBar.cancel")}
        confirmLabel={t("workspace.selectedDocument.reindex")}
        description={selectedDocumentDetail ? t("workspace.confirm.reindexDocument", { title: selectedDocumentDetail.document.title }) : ""}
        isLoading={isRunningDocumentAction}
        onCancel={() => setIsDocumentReindexConfirmOpen(false)}
        onConfirm={async () => { await onReindexDocument(); setIsDocumentReindexConfirmOpen(false); }}
        open={isDocumentReindexConfirmOpen && Boolean(selectedDocumentDetail) && !selectedDocumentDetail?.document.is_deleted}
        title={t("workspace.selectedDocument.reindex")}
      />
      {selectedWorkflowRunDetail && isWorkflowDetailOpen ? (
        <FormDialog
          eyebrow={t("workspace.documentsView.documentDetails")}
          footer={<DialogFormActions>{workflowOpenedFromDocument ? <Button className="rounded-xl bg-white" onClick={() => { setIsWorkflowDetailOpen(false); setIsDocumentDetailOpen(true); }} type="button" variant="outline"><ArrowLeft className="h-4 w-4" />{t("workspace.documentsView.backToDocument")}</Button> : null}<Button className="rounded-xl" onClick={() => setIsWorkflowDetailOpen(false)} type="button" variant="outline">{t("workspace.headerBar.cancel")}</Button></DialogFormActions>}
          onClose={() => setIsWorkflowDetailOpen(false)}
          open
          presentation="side"
          size="xl"
          title={t("workspace.documentsView.relatedWorkflow")}
        >
              <SelectedWorkflowRunPanel
                detail={selectedWorkflowRunDetail}
                emptyState={t("workspace.documentsView.selectDocumentOrWorkflow")}
                canEditOperatorNotes={canManageWorkflowRuns}
                isCancellingWorkflow={isCancellingWorkflow}
                isSavingOperatorNotes={isSavingWorkflowNotes}
                isRetryAvailable={isRetryAvailable}
                isRetryEligibilityLoading={isRetryEligibilityLoading}
                isRetryingWorkflow={isRetryingWorkflow}
                onCancelWorkflowRun={onCancelWorkflowRun}
                onOpenChatView={onOpenChatView}
                onOpenWorkflowView={onOpenWorkflowView}
                onSaveOperatorNotes={onSaveWorkflowOperatorNotes}
                onSelectDocument={onSelectDocument}
                onRetryWorkflowRun={onRetryWorkflowRun}
                retryDisabledReason={selectedWorkflowRetryDisabledReason}
                retryHelpText={t("workspace.documentsView.retryHelp")}
                title={t("workspace.documentsView.relatedWorkflow")}
              />
        </FormDialog>
      ) : null}
    </>
  );
}
