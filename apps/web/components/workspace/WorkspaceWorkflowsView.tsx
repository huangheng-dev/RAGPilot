"use client";

import type { ComponentProps } from "react";

import { SelectedWorkflowRunPanel } from "@/components/workspace/SelectedWorkflowRunPanel";
import { WorkflowTimelinePanel } from "@/components/workspace/WorkflowTimelinePanel";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/provider";
import type { WorkspaceHandoffIntent } from "@/lib/workspace-navigation";
import type {
  WorkspaceAgentContext,
  WorkspaceAgentRecommendation,
  WorkflowMetrics,
  WorkflowRetryMode,
  WorkflowRun,
  WorkflowRunDetail,
  WorkflowSortOrder
} from "@/components/workspace/workspace-types";

type LinkHref = ComponentProps<typeof import("next/link").default>["href"];

type WorkspaceWorkflowsViewProps = {
  activeAgentContext: WorkspaceAgentContext | null;
  agentConsoleHref: LinkHref;
  handoffIntent: WorkspaceHandoffIntent | null;
  canManageWorkflowRuns: boolean;
  isActivatingRecommendation?: boolean;
  isCancellingWorkflow: boolean;
  isSavingWorkflowNotes: boolean;
  isRetryAvailable: boolean;
  isRetryEligibilityLoading: boolean;
  isRetryingWorkflow: boolean;
  isCurrentSurfaceRecommended: boolean;
  onClearWorkflowFilters: () => void;
  onFocusActiveWorkflowRuns: () => void;
  onFocusFailedWorkflowRuns: () => void;
  onOpenChatView: () => void;
  onOpenConsoleControls: () => void;
  onOpenDocumentsView: () => void;
  onActivateRecommendedAgent: (recommendation: WorkspaceAgentRecommendation) => void | Promise<void>;
  onCancelWorkflowRun: () => void | Promise<void>;
  onSelectDocument: (documentId: string) => void | Promise<void>;
  onRetryWorkflowRun: () => void | Promise<void>;
  onSaveWorkflowOperatorNotes: (operatorNotes: string | null) => void | Promise<void>;
  onSelectWorkflowRun: (workflowRunId: string) => void | Promise<void>;
  selectedWorkflowChildRuns: WorkflowRun[];
  selectedWorkflowParentRun: WorkflowRun | null;
  selectedWorkflowRetryDisabledReason: string | null;
  selectedWorkflowRunDetail: WorkflowRunDetail | null;
  selectedWorkflowRunId: string | null;
  selectedWorkflowRecommendedAgents: WorkspaceAgentRecommendation[];
  workflowMetrics: WorkflowMetrics;
  workflowPage: number;
  workflowPageCount: number;
  workflowQuery: string;
  workflowRuns: WorkflowRun[];
  workflowSortOrder: WorkflowSortOrder;
  workflowStatusFilter: string;
  workflowTotalCount: number;
  workflowTypeFilter: string;
  workflowRetryMode: WorkflowRetryMode;
  onWorkflowPageChange: (page: number) => void;
  onWorkflowQueryChange: (value: string) => void;
  onWorkflowSortOrderChange: (value: WorkflowSortOrder) => void;
  onWorkflowStatusFilterChange: (value: string) => void;
  onWorkflowTypeFilterChange: (value: string) => void;
  onWorkflowRetryModeChange: (value: WorkflowRetryMode) => void;
  onFocusQueuedWorkflowRuns: () => void;
  onFocusRetryWorkflowRuns: () => void;
};

const WORKFLOW_PAGE_SIZE = 6;

export function WorkspaceWorkflowsView({
  activeAgentContext,
  agentConsoleHref,
  handoffIntent,
  canManageWorkflowRuns,
  isActivatingRecommendation = false,
  isCancellingWorkflow,
  isSavingWorkflowNotes,
  isRetryAvailable,
  isRetryEligibilityLoading,
  isRetryingWorkflow,
  isCurrentSurfaceRecommended,
  onClearWorkflowFilters,
  onFocusActiveWorkflowRuns,
  onFocusFailedWorkflowRuns,
  onOpenChatView,
  onOpenConsoleControls,
  onOpenDocumentsView,
  onActivateRecommendedAgent,
  onCancelWorkflowRun,
  onSelectDocument,
  onRetryWorkflowRun,
  onSaveWorkflowOperatorNotes,
  onSelectWorkflowRun,
  selectedWorkflowChildRuns,
  selectedWorkflowParentRun,
  selectedWorkflowRetryDisabledReason,
  selectedWorkflowRunDetail,
  selectedWorkflowRunId,
  selectedWorkflowRecommendedAgents,
  workflowMetrics,
  workflowPage,
  workflowPageCount,
  workflowQuery,
  workflowRuns,
  workflowSortOrder,
  workflowStatusFilter,
  workflowTotalCount,
  workflowTypeFilter,
  workflowRetryMode,
  onWorkflowPageChange,
  onWorkflowQueryChange,
  onWorkflowSortOrderChange,
  onWorkflowStatusFilterChange,
  onWorkflowTypeFilterChange,
  onWorkflowRetryModeChange,
  onFocusQueuedWorkflowRuns,
  onFocusRetryWorkflowRuns
}: WorkspaceWorkflowsViewProps) {
  const { t } = useI18n();
  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[minmax(0,1fr)_396px]">
      <div className="min-h-0 overflow-y-auto px-6 py-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-6">
          <div className="flex flex-wrap gap-2">
            <Button className="bg-white" onClick={onFocusFailedWorkflowRuns} type="button" variant="outline">
              {t("workspace.workflowsView.failedRuns")}
            </Button>
            <Button className="bg-white" onClick={onFocusActiveWorkflowRuns} type="button" variant="outline">
              {t("workspace.workflowsView.priorityQueue")}
            </Button>
            <Button className="bg-white" onClick={onFocusQueuedWorkflowRuns} type="button" variant="outline">
              {t("workspace.workflowsView.queuedRuns")}
            </Button>
            <Button className="bg-white" onClick={onFocusRetryWorkflowRuns} type="button" variant="outline">
              {t("workspace.workflowsView.retryQueue")}
            </Button>
            <Button className="bg-white" onClick={onClearWorkflowFilters} type="button" variant="outline">
              {t("workspace.workflowsView.clearFilters")}
            </Button>
            <Button className="bg-white" onClick={onOpenDocumentsView} type="button" variant="outline">
              {t("workspace.workflowsView.openDocuments")}
            </Button>
          </div>

          <WorkflowTimelinePanel
            filteredWorkflowRunCount={workflowTotalCount}
            onSelectWorkflowRun={onSelectWorkflowRun}
            onWorkflowPageChange={onWorkflowPageChange}
            onWorkflowQueryChange={onWorkflowQueryChange}
            onWorkflowSortOrderChange={onWorkflowSortOrderChange}
            onWorkflowStatusFilterChange={onWorkflowStatusFilterChange}
            pageSize={WORKFLOW_PAGE_SIZE}
            paginatedWorkflowRuns={workflowRuns}
            selectedWorkflowRunId={selectedWorkflowRunId}
            workflowPage={workflowPage}
            workflowPageCount={workflowPageCount}
            workflowQuery={workflowQuery}
            workflowSortOrder={workflowSortOrder}
            workflowStatusFilter={workflowStatusFilter}
            workflowTypeFilter={workflowTypeFilter}
            workflowRetryMode={workflowRetryMode}
            onWorkflowTypeFilterChange={onWorkflowTypeFilterChange}
            onWorkflowRetryModeChange={(value) => onWorkflowRetryModeChange(value as WorkflowRetryMode)}
          />
        </div>
      </div>

      <aside className="border-t border-slate-200 bg-slate-50/75 xl:border-l xl:border-t-0">
        <div className="space-y-5 px-5 py-5 xl:sticky xl:top-6 xl:px-6 xl:py-6">
          <SelectedWorkflowRunPanel
            detail={selectedWorkflowRunDetail}
            emptyState={t("workspace.workflowsView.selectWorkflowToInspect")}
            canEditOperatorNotes={canManageWorkflowRuns}
            isActivatingRecommendation={isActivatingRecommendation}
            isCancellingWorkflow={isCancellingWorkflow}
            isSavingOperatorNotes={isSavingWorkflowNotes}
            isRetryAvailable={isRetryAvailable}
            isRetryEligibilityLoading={isRetryEligibilityLoading}
            isRetryingWorkflow={isRetryingWorkflow}
            onActivateRecommendedAgent={onActivateRecommendedAgent}
            onCancelWorkflowRun={onCancelWorkflowRun}
            onOpenChatView={onOpenChatView}
            onOpenDocumentsView={onOpenDocumentsView}
            onSaveOperatorNotes={onSaveWorkflowOperatorNotes}
            onSelectDocument={onSelectDocument}
            onRetryWorkflowRun={onRetryWorkflowRun}
            onSelectWorkflowRun={onSelectWorkflowRun}
            recommendedAgents={selectedWorkflowRecommendedAgents}
            retryDisabledReason={selectedWorkflowRetryDisabledReason}
            retryHelpText={t("workspace.workflowsView.retryHelp")}
            selectedWorkflowChildRuns={selectedWorkflowChildRuns}
            selectedWorkflowParentRun={selectedWorkflowParentRun}
            showWorkflowLineage
          />
        </div>
      </aside>
    </div>
  );
}
