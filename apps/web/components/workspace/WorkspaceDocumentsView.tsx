"use client";

import { useState } from "react";
import { ArrowLeft, RotateCcw, Trash2, X } from "lucide-react";
import { DocumentRegistryPanel } from "@/components/workspace/DocumentRegistryPanel";
import { SelectedDocumentPanel } from "@/components/workspace/SelectedDocumentPanel";
import { SelectedWorkflowRunPanel } from "@/components/workspace/SelectedWorkflowRunPanel";
import { Button } from "@/components/ui/button";
import { DialogFormActions, FormDialog } from "@/components/ui/form-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useI18n } from "@/lib/i18n/provider";
import type {
  DocumentDetail,
  DocumentLifecycleFilter,
  DocumentRecord,
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
  documentTotalCount: number;
  documents: DocumentRecord[];
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

const DOCUMENT_PAGE_SIZE = 5;

export function WorkspaceDocumentsView({
  activeAgentContext,
  documentPage,
  documentPageCount,
  documentLifecycleFilter,
  documentTotalCount,
  documents,
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

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <div className="flex w-full flex-col gap-3">
          <DocumentRegistryPanel
            activeAgentContext={activeAgentContext}
            documentPage={documentPage}
            documentPageCount={documentPageCount}
            documentLifecycleFilter={documentLifecycleFilter}
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
          />
      </div>
      </div>
      {selectedDocumentDetail ? (
        <FormDialog
          eyebrow={t("workspace.documentsView.documentDetails")}
          footer={selectedDocumentDetail.document.is_deleted ? <DialogFormActions><Button className="rounded-xl bg-white" onClick={() => setIsDocumentDetailOpen(false)} type="button" variant="outline">{t("workspace.headerBar.cancel")}</Button><Button className="rounded-xl" onClick={onOpenChatView} type="button">{t("workspace.selectedDocument.openChat")}</Button></DialogFormActions> : <DialogFormActions className="items-center justify-between"><Button className="rounded-xl border-rose-200 bg-white text-rose-700 hover:bg-rose-50 hover:text-rose-700" disabled={!canManageDocuments || isRunningDocumentAction} onClick={() => setIsDocumentDeleteConfirmOpen(true)} type="button" variant="outline"><Trash2 className="h-4 w-4" />{t("workspace.selectedDocument.delete")}</Button><div className="flex flex-wrap justify-end gap-3"><Button className="rounded-xl bg-white" disabled={!canManageDocuments || isRunningDocumentAction} onClick={() => setIsDocumentReindexConfirmOpen(true)} type="button" variant="outline"><RotateCcw className="h-4 w-4" />{t("workspace.selectedDocument.reindex")}</Button><Button className="rounded-xl bg-white" onClick={() => setIsDocumentDetailOpen(false)} type="button" variant="outline">{t("workspace.headerBar.cancel")}</Button><Button className="rounded-xl" onClick={onOpenChatView} type="button">{t("workspace.selectedDocument.openChat")}</Button></div></DialogFormActions>}
          onClose={() => setIsDocumentDetailOpen(false)}
          open={isDocumentDetailOpen}
          presentation="side"
          size="xl"
          title={selectedDocumentDetail.document.title}
        >
              <SelectedDocumentPanel
                detail={selectedDocumentDetail}
                emptyState={t("workspace.documentsView.selectDocumentToInspect")}
                focusedChunkId={focusedChunkId}
                canManageDocuments={canManageDocuments}
                isActivatingRecommendation={isActivatingRecommendation}
                isRunningDocumentAction={isRunningDocumentAction}
              onDeleteDocument={onDeleteDocument}
              onPermanentlyDeleteDocument={onPermanentlyDeleteDocument}
                onOpenChatView={onOpenChatView}
                onOpenFailedDocumentsQueue={onOpenFailedDocumentsQueue}
                onOpenWorkflowView={onOpenWorkflowView}
                onActivateRecommendedAgent={onActivateRecommendedAgent}
                onInspectWorkflowRun={async (workflowRunId) => {
                  setWorkflowOpenedFromDocument(true);
                  setIsDocumentDetailOpen(false);
                  setIsWorkflowDetailOpen(true);
                  await onSelectWorkflowRun(workflowRunId);
                }}
                onReindexDocument={onReindexDocument}
                onRestoreDocument={onRestoreDocument}
                recommendedAgents={selectedDocumentRecommendedAgents}
                onSelectVersion={onSelectDocumentVersion}
                relatedWorkflowRuns={workflowRuns}
                selectedDocumentVersionId={selectedDocumentDetail.document_version_id ?? null}
                showExtendedMetadata
                embeddedInDialog
                hideLifecycleActions={!selectedDocumentDetail.document.is_deleted}
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
        <div className="fixed inset-0 z-[70]">
          <button
            aria-label={t("workspace.documentsView.closeWorkflowDetails")}
            className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm"
            onClick={() => setIsWorkflowDetailOpen(false)}
            type="button"
          />
          <aside className="absolute inset-y-0 right-0 flex w-full max-w-xl flex-col border-l border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
              <div className="flex min-w-0 items-center gap-2">
                {workflowOpenedFromDocument ? (
                  <Button
                    aria-label={t("workspace.documentsView.backToDocument")}
                    onClick={() => {
                      setIsWorkflowDetailOpen(false);
                      setIsDocumentDetailOpen(true);
                    }}
                    size="icon"
                    type="button"
                    variant="ghost"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                ) : null}
                <div className="truncate text-sm font-semibold text-slate-950 dark:text-slate-50">
                  {t("workspace.documentsView.relatedWorkflow")}
                </div>
              </div>
              <Button aria-label={t("workspace.documentsView.closeWorkflowDetails")} onClick={() => setIsWorkflowDetailOpen(false)} size="icon" type="button" variant="ghost">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
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
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
