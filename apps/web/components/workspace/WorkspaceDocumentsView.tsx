"use client";

import type { ComponentProps } from "react";

import { DocumentActionSummaryPanel } from "@/components/workspace/DocumentActionSummaryPanel";
import { DocumentActivityPanel } from "@/components/workspace/DocumentActivityPanel";
import { WorkspaceAgentContextCard } from "@/components/workspace/WorkspaceAgentContextCard";
import { DocumentRegistryPanel } from "@/components/workspace/DocumentRegistryPanel";
import { MetricSummaryCard } from "@/components/workspace/MetricSummaryCard";
import { RecentWorkflowRunsPanel } from "@/components/workspace/RecentWorkflowRunsPanel";
import { SelectedDocumentPanel } from "@/components/workspace/SelectedDocumentPanel";
import { SelectedWorkflowRunPanel } from "@/components/workspace/SelectedWorkflowRunPanel";
import { WorkspaceUploadFollowUpCard } from "@/components/workspace/WorkspaceUploadFollowUpCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n/provider";
import type {
  DocumentActivity,
  DocumentActionSummary,
  DocumentDetail,
  DocumentLifecycleFilter,
  DocumentMetrics,
  DocumentRecord,
  DocumentSortOrder,
  UploadFollowUpSummary,
  WorkspaceAgentContext,
  WorkspaceAgentRecommendation,
  WorkflowRun,
  WorkflowRunDetail
} from "@/components/workspace/workspace-types";

type LinkHref = ComponentProps<typeof import("next/link").default>["href"];

type WorkspaceDocumentsViewProps = {
  activeAgentContext: WorkspaceAgentContext | null;
  agentConsoleHref: LinkHref;
  documentActionSummary: DocumentActionSummary | null;
  documentMetrics: DocumentMetrics;
  documentPage: number;
  documentPageCount: number;
  documentLifecycleFilter: DocumentLifecycleFilter;
  documentQuery: string;
  documentSortOrder: DocumentSortOrder;
  documentStatusFilter: string;
  documentTotalCount: number;
  documents: DocumentRecord[];
  focusedChunkId: string | null;
  canManageDocuments: boolean;
  isRetryAvailable: boolean;
  isRetryEligibilityLoading: boolean;
  isRetryingWorkflow: boolean;
  isRunningDocumentAction: boolean;
  isCurrentSurfaceRecommended: boolean;
  onBulkDeleteDocuments: () => void | Promise<void>;
  onBulkReindexDocuments: () => void | Promise<void>;
  onBulkRestoreDocuments: () => void | Promise<void>;
  onClearDocumentActionSummary: () => void;
  onClearUploadFollowUpSummary: () => void;
  onClearDocumentSelection: () => void;
  onDeleteDocument: () => void | Promise<void>;
  onDocumentLifecycleFilterChange: (value: DocumentLifecycleFilter) => void;
  onDocumentPageChange: (page: number) => void;
  onDocumentQueryChange: (value: string) => void;
  onDocumentSortOrderChange: (value: DocumentSortOrder) => void;
  onDocumentStatusFilterChange: (value: string) => void;
  onActivateRecommendedAgent: (recommendation: WorkspaceAgentRecommendation) => void | Promise<void>;
  onOpenChatView: () => void;
  onOpenConsoleControls: () => void;
  onOpenFailedDocumentsQueue: () => void;
  onOpenWorkflowView: () => void;
  onReindexDocument: () => void | Promise<void>;
  onRestoreDocument: () => void | Promise<void>;
  onSelectDocumentVersion: (documentVersionId: string) => void | Promise<void>;
  onRetryWorkflowRun: () => void | Promise<void>;
  onSelectDocument: (documentId: string) => void | Promise<void>;
  onSelectWorkflowRun: (workflowRunId: string) => void | Promise<void>;
  onShowFailedDocuments: () => void;
  onToggleDocumentSelection: (documentId: string) => void;
  onToggleSelectAllDocumentsOnPage: () => void;
  isLoadingSelectedDocumentActivity: boolean;
  selectedDocumentActivity: DocumentActivity | null;
  selectedDocumentDetail: DocumentDetail | null;
  selectedDocumentId: string | null;
  selectedDocumentIds: string[];
  selectedDocumentRecommendedAgents: WorkspaceAgentRecommendation[];
  uploadFollowUpSummary: UploadFollowUpSummary | null;
  selectedWorkflowRunDetail: WorkflowRunDetail | null;
  selectedWorkflowRunId: string | null;
  selectedWorkflowRetryDisabledReason: string | null;
  workflowRuns: WorkflowRun[];
};

const DOCUMENT_PAGE_SIZE = 5;

export function WorkspaceDocumentsView({
  activeAgentContext,
  agentConsoleHref,
  documentActionSummary,
  documentMetrics,
  documentPage,
  documentPageCount,
  documentLifecycleFilter,
  documentQuery,
  documentSortOrder,
  documentStatusFilter,
  documentTotalCount,
  documents,
  focusedChunkId,
  canManageDocuments,
  isRetryAvailable,
  isRetryEligibilityLoading,
  isRetryingWorkflow,
  isRunningDocumentAction,
  isCurrentSurfaceRecommended,
  onBulkDeleteDocuments,
  onBulkReindexDocuments,
  onBulkRestoreDocuments,
  onClearDocumentActionSummary,
  onClearUploadFollowUpSummary,
  onClearDocumentSelection,
  onDeleteDocument,
  onDocumentLifecycleFilterChange,
  onDocumentPageChange,
  onDocumentQueryChange,
  onDocumentSortOrderChange,
  onDocumentStatusFilterChange,
  onActivateRecommendedAgent,
  onOpenChatView,
  onOpenConsoleControls,
  onOpenFailedDocumentsQueue,
  onOpenWorkflowView,
  onReindexDocument,
  onRestoreDocument,
  onSelectDocumentVersion,
  onRetryWorkflowRun,
  onSelectDocument,
  onSelectWorkflowRun,
  onShowFailedDocuments,
  onToggleDocumentSelection,
  onToggleSelectAllDocumentsOnPage,
  isLoadingSelectedDocumentActivity,
  selectedDocumentActivity,
  selectedDocumentDetail,
  selectedDocumentId,
  selectedDocumentIds,
  selectedDocumentRecommendedAgents,
  uploadFollowUpSummary,
  selectedWorkflowRunDetail,
  selectedWorkflowRunId,
  selectedWorkflowRetryDisabledReason,
  workflowRuns
}: WorkspaceDocumentsViewProps) {
  const { t } = useI18n();

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-h-0 overflow-y-auto px-6 py-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-6">
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricSummaryCard description={t("workspace.documentsView.documentsDescription")} label={t("workspace.documentsView.documents")} value={documentMetrics.total_documents} />
            <MetricSummaryCard
              accentClassName="border-emerald-200"
              description={t("workspace.documentsView.completedDescription")}
              label={t("workspace.documentsView.completed")}
              value={documentMetrics.completed_documents}
            />
            <MetricSummaryCard
              accentClassName="border-amber-200"
              description={t("workspace.documentsView.inProgressDescription")}
              label={t("workspace.documentsView.inProgress")}
              value={documentMetrics.active_documents}
            />
            <MetricSummaryCard
              accentClassName="border-rose-200"
              description={t("workspace.documentsView.needsAttentionDescription")}
              label={t("workspace.documentsView.needsAttention")}
              value={documentMetrics.failed_documents}
            />
          </section>

          {activeAgentContext ? (
            <WorkspaceAgentContextCard
              activeAgentContext={activeAgentContext}
              agentConsoleHref={agentConsoleHref}
              onPrimaryAction={
                activeAgentContext.mode === "grounded_chat" ? onOpenChatView : onOpenFailedDocumentsQueue
              }
              onSecondaryAction={onOpenWorkflowView}
              primaryActionLabel={
                activeAgentContext.mode === "grounded_chat"
                  ? t("workspace.documentsView.openChatSurface")
                  : t("workspace.documentsView.showFailedQueue")
              }
              secondaryActionLabel={t("workspace.documentsView.openWorkflowSurface")}
              surface="documents"
              surfaceAligned={isCurrentSurfaceRecommended}
            />
          ) : null}

          {documentActionSummary ? (
            <DocumentActionSummaryPanel
              onClear={onClearDocumentActionSummary}
              onOpenChatView={onOpenChatView}
              onInspectWorkflowRun={onSelectWorkflowRun}
              onOpenWorkflowView={onOpenWorkflowView}
              onShowFailedDocuments={onShowFailedDocuments}
              summary={documentActionSummary}
            />
          ) : null}

          {uploadFollowUpSummary ? (
            <WorkspaceUploadFollowUpCard
              onClear={onClearUploadFollowUpSummary}
              onInspectWorkflowRun={onSelectWorkflowRun}
              onOpenChatView={onOpenChatView}
              onOpenWorkflowView={onOpenWorkflowView}
              summary={uploadFollowUpSummary}
            />
          ) : null}

          {documentTotalCount === 0 ? (
            <Card className="border-dashed border-slate-300 bg-white shadow-sm">
              <CardContent className="flex flex-col gap-4 p-6">
                <div>
                  <div className="text-base font-semibold text-slate-950">{t("workspace.documentsView.emptyRegistryTitle")}</div>
                  <div className="mt-2 text-sm leading-7 text-slate-600">{t("workspace.documentsView.emptyRegistryDescription")}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={onOpenConsoleControls} size="sm" type="button">
                    {t("workspace.documentsView.openContextControls")}
                  </Button>
                  <Button className="bg-white" onClick={onOpenWorkflowView} size="sm" type="button" variant="outline">
                    {t("workspace.documentsView.openWorkflowSurface")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

          <DocumentRegistryPanel
            activeAgentContext={activeAgentContext}
            documentPage={documentPage}
            documentPageCount={documentPageCount}
            documentLifecycleFilter={documentLifecycleFilter}
            documentQuery={documentQuery}
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

      <aside className="border-t border-slate-200 bg-white xl:border-l xl:border-t-0">
        <div className="space-y-5 px-6 py-6 xl:sticky xl:top-6">
          <SelectedDocumentPanel
            detail={selectedDocumentDetail}
            emptyState={t("workspace.documentsView.selectDocumentToInspect")}
            focusedChunkId={focusedChunkId}
            canManageDocuments={canManageDocuments}
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
            isRetryAvailable={isRetryAvailable}
            isRetryEligibilityLoading={isRetryEligibilityLoading}
            isRetryingWorkflow={isRetryingWorkflow}
            onOpenChatView={onOpenChatView}
            onOpenWorkflowView={onOpenWorkflowView}
            onSelectDocument={onSelectDocument}
            onRetryWorkflowRun={onRetryWorkflowRun}
            retryDisabledReason={selectedWorkflowRetryDisabledReason}
            retryHelpText={t("workspace.documentsView.retryHelp")}
            title={t("workspace.documentsView.relatedWorkflow")}
          />

          <DocumentActivityPanel
            activity={selectedDocumentActivity}
            emptyState={t("workspace.documentsView.noDocumentActivity")}
            isLoading={isLoadingSelectedDocumentActivity}
            onInspectRun={onSelectWorkflowRun}
          />

          <RecentWorkflowRunsPanel
            emptyState={t("workspace.documentsView.noRelatedWorkflowRuns")}
            selectedWorkflowRunId={selectedWorkflowRunId}
            title={t("workspace.documentsView.relatedWorkflowRuns")}
            workflowRuns={workflowRuns}
            onSelectWorkflowRun={onSelectWorkflowRun}
          />
        </div>
      </aside>
    </div>
  );
}
