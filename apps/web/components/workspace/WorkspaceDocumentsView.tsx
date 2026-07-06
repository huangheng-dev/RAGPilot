"use client";

import { DocumentRegistryPanel } from "@/components/workspace/DocumentRegistryPanel";
import { SelectedDocumentPanel } from "@/components/workspace/SelectedDocumentPanel";
import { SelectedWorkflowRunPanel } from "@/components/workspace/SelectedWorkflowRunPanel";
import { useI18n } from "@/lib/i18n/provider";
import type {
  DocumentDetail,
  DocumentLifecycleFilter,
  DocumentRecord,
  DocumentSourceFilter,
  DocumentSortOrder,
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
  documentSortOrder: DocumentSortOrder;
  documentStatusFilter: string;
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
  onDocumentLifecycleFilterChange: (value: DocumentLifecycleFilter) => void;
  onDocumentPageChange: (page: number) => void;
  onDocumentQueryChange: (value: string) => void;
  onDocumentSourceFilterChange: (value: DocumentSourceFilter) => void;
  onDocumentSortOrderChange: (value: DocumentSortOrder) => void;
  onDocumentStatusFilterChange: (value: string) => void;
  onActivateRecommendedAgent: (recommendation: WorkspaceAgentRecommendation) => void | Promise<void>;
  onOpenChatView: () => void;
  onOpenConsoleControls: () => void;
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
  documentQuery,
  documentSourceFilter,
  documentSortOrder,
  documentStatusFilter,
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
  onDocumentLifecycleFilterChange,
  onDocumentPageChange,
  onDocumentQueryChange,
  onDocumentSourceFilterChange,
  onDocumentSortOrderChange,
  onDocumentStatusFilterChange,
  onActivateRecommendedAgent,
  onOpenChatView,
  onOpenConsoleControls,
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
  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[minmax(0,1fr)_388px]">
      <div className="min-h-0 overflow-y-auto px-6 py-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-6">
          <DocumentRegistryPanel
            activeAgentContext={activeAgentContext}
            documentPage={documentPage}
            documentPageCount={documentPageCount}
            documentLifecycleFilter={documentLifecycleFilter}
            documentQuery={documentQuery}
            documentSourceFilter={documentSourceFilter}
            documentSortOrder={documentSortOrder}
            documentStatusFilter={documentStatusFilter}
            filteredDocumentCount={documentTotalCount}
            canManageDocuments={canManageDocuments}
            isRunningDocumentAction={isRunningDocumentAction}
            onBulkDeleteDocuments={onBulkDeleteDocuments}
            onBulkReindexDocuments={onBulkReindexDocuments}
            onBulkRestoreDocuments={onBulkRestoreDocuments}
            onClearDocumentSelection={onClearDocumentSelection}
            onDocumentLifecycleFilterChange={onDocumentLifecycleFilterChange}
            onDocumentPageChange={onDocumentPageChange}
            onDocumentQueryChange={onDocumentQueryChange}
            onDocumentSourceFilterChange={onDocumentSourceFilterChange}
            onDocumentSortOrderChange={onDocumentSortOrderChange}
            onDocumentStatusFilterChange={onDocumentStatusFilterChange}
            onOpenWorkflowView={onOpenWorkflowView}
            onInspectWorkflowRun={onSelectWorkflowRun}
            onSelectDocument={onSelectDocument}
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

      <aside className="border-t border-slate-200 bg-slate-50/75 xl:border-l xl:border-t-0">
        <div className="space-y-5 px-5 py-5 xl:sticky xl:top-6 xl:px-6 xl:py-6">
          <SelectedDocumentPanel
            detail={selectedDocumentDetail}
            emptyState={t("workspace.documentsView.selectDocumentToInspect")}
            focusedChunkId={focusedChunkId}
            canManageDocuments={canManageDocuments}
            isActivatingRecommendation={isActivatingRecommendation}
            isRunningDocumentAction={isRunningDocumentAction}
            onDeleteDocument={onDeleteDocument}
            onOpenChatView={onOpenChatView}
            onOpenFailedDocumentsQueue={onOpenFailedDocumentsQueue}
            onOpenWorkflowView={onOpenWorkflowView}
            onActivateRecommendedAgent={onActivateRecommendedAgent}
            onInspectWorkflowRun={onSelectWorkflowRun}
            onReindexDocument={onReindexDocument}
            onRestoreDocument={onRestoreDocument}
            recommendedAgents={selectedDocumentRecommendedAgents}
            onSelectVersion={onSelectDocumentVersion}
            relatedWorkflowRuns={workflowRuns}
            selectedDocumentVersionId={selectedDocumentDetail?.document_version_id ?? null}
            showExtendedMetadata
          />

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
  );
}
