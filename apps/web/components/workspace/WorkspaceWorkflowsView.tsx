"use client";

import type { ComponentProps } from "react";

import { MetricSummaryCard } from "@/components/workspace/MetricSummaryCard";
import { SelectedWorkflowRunPanel } from "@/components/workspace/SelectedWorkflowRunPanel";
import { WorkspaceAgentContextCard } from "@/components/workspace/WorkspaceAgentContextCard";
import { WorkflowTimelinePanel } from "@/components/workspace/WorkflowTimelinePanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n/provider";
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
  onSelectDocument: (documentId: string) => void | Promise<void>;
  onRetryWorkflowRun: () => void | Promise<void>;
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
  onSelectDocument,
  onRetryWorkflowRun,
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
    <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-h-0 overflow-y-auto px-6 py-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-6">
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricSummaryCard description={t("workspace.workflowsView.workflowRunsDescription")} label={t("workspace.workflowsView.workflowRuns")} value={workflowMetrics.total_runs} />
            <MetricSummaryCard description={t("workspace.workflowsView.activeDescription")} label={t("workspace.workflowsView.active")} value={workflowMetrics.active_runs} />
            <MetricSummaryCard
              accentClassName="border-emerald-200"
              description={t("workspace.workflowsView.completedDescription")}
              label={t("workspace.workflowsView.completed")}
              value={workflowMetrics.completed_runs}
            />
            <MetricSummaryCard
              accentClassName="border-rose-200"
              description={t("workspace.workflowsView.failedDescription")}
              label={t("workspace.workflowsView.failed")}
              value={workflowMetrics.failed_runs}
            />
          </section>

          <section className="grid gap-4 md:grid-cols-3">
            <MetricSummaryCard
              accentClassName="border-amber-200"
              description={t("workspace.workflowsView.queuedDescription")}
              label={t("workspace.workflowsView.queued")}
              value={workflowMetrics.queued_runs}
            />
            <MetricSummaryCard
              accentClassName="border-sky-200"
              description={t("workspace.workflowsView.runningDescription")}
              label={t("workspace.workflowsView.running")}
              value={workflowMetrics.running_runs}
            />
            <MetricSummaryCard
              accentClassName="border-violet-200"
              description={t("workspace.workflowsView.retryRunsDescription")}
              label={t("workspace.workflowsView.retryRuns")}
              value={workflowMetrics.retry_runs}
            />
          </section>

          {activeAgentContext ? (
            <WorkspaceAgentContextCard
              activeAgentContext={activeAgentContext}
              agentConsoleHref={agentConsoleHref}
              onPrimaryAction={
                activeAgentContext.mode === "grounded_chat" ? onOpenChatView : onFocusFailedWorkflowRuns
              }
              onSecondaryAction={onOpenDocumentsView}
              primaryActionLabel={
                activeAgentContext.mode === "grounded_chat"
                  ? t("workspace.workflowsView.openChatSurface")
                  : t("workspace.workflowsView.failedRuns")
              }
              secondaryActionLabel={t("workspace.workflowsView.openDocuments")}
              surface="workflows"
              surfaceAligned={isCurrentSurfaceRecommended}
            />
          ) : null}

          <section className="grid gap-4 md:grid-cols-3">
            <MetricSummaryCard
              accentClassName="border-rose-200"
              description={t("workspace.workflowsView.failureLaneDescription")}
              label={t("workspace.workflowsView.failureLane")}
              value={workflowMetrics.failed_runs}
            />
            <MetricSummaryCard
              accentClassName="border-violet-200"
              description={t("workspace.workflowsView.retryLaneDescription")}
              label={t("workspace.workflowsView.retryLane")}
              value={workflowMetrics.retry_runs}
            />
            <MetricSummaryCard
              accentClassName="border-sky-200"
              description={t("workspace.workflowsView.pressureLaneDescription")}
              label={t("workspace.workflowsView.pressureLane")}
              value={workflowMetrics.queued_runs + workflowMetrics.running_runs}
            />
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{t("workspace.workflowsView.supervision")}</div>
                <div className="text-base font-semibold text-slate-950">{t("workspace.workflowsView.supervisionTitle")}</div>
                <div className="text-sm text-slate-600">
                  {t("workspace.workflowsView.supervisionDescription")}
                </div>
              </div>
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
            </div>
          </section>

          {workflowMetrics.total_runs === 0 ? (
            <Card className="border-dashed border-slate-300 bg-white shadow-sm">
              <CardContent className="flex flex-col gap-4 p-6">
                <div>
                  <div className="text-base font-semibold text-slate-950">{t("workspace.workflowsView.emptyQueueTitle")}</div>
                  <div className="mt-2 text-sm leading-7 text-slate-600">{t("workspace.workflowsView.emptyQueueDescription")}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={onOpenDocumentsView} size="sm" type="button">
                    {t("workspace.workflowsView.openDocuments")}
                  </Button>
                  <Button className="bg-white" onClick={onOpenConsoleControls} size="sm" type="button" variant="outline">
                    {t("workspace.workflowsView.openContextControls")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : workflowMetrics.failed_runs === 0 && workflowMetrics.active_runs === 0 && workflowMetrics.completed_runs > 0 ? (
            <Card className="border-emerald-200 bg-emerald-50/60 shadow-sm">
              <CardContent className="flex flex-col gap-4 p-6">
                <div>
                  <div className="text-base font-semibold text-slate-950">{t("workspace.workflowsView.healthyQueueTitle")}</div>
                  <div className="mt-2 text-sm leading-7 text-slate-600">{t("workspace.workflowsView.healthyQueueDescription")}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={onOpenChatView} size="sm" type="button">
                    {t("workspace.workflowsView.openChatSurface")}
                  </Button>
                  <Button className="bg-white" onClick={onOpenDocumentsView} size="sm" type="button" variant="outline">
                    {t("workspace.workflowsView.openDocuments")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

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

      <aside className="border-t border-slate-200 bg-white xl:border-l xl:border-t-0">
        <div className="space-y-5 px-6 py-6 xl:sticky xl:top-6">
          <SelectedWorkflowRunPanel
            detail={selectedWorkflowRunDetail}
            emptyState={t("workspace.workflowsView.selectWorkflowToInspect")}
            isRetryAvailable={isRetryAvailable}
            isRetryEligibilityLoading={isRetryEligibilityLoading}
            isRetryingWorkflow={isRetryingWorkflow}
            onActivateRecommendedAgent={onActivateRecommendedAgent}
            onOpenChatView={onOpenChatView}
            onOpenDocumentsView={onOpenDocumentsView}
            onSelectDocument={onSelectDocument}
            onRetryWorkflowRun={onRetryWorkflowRun}
            onSelectWorkflowRun={onSelectWorkflowRun}
            recommendedAgents={selectedWorkflowRecommendedAgents}
            retryDisabledReason={selectedWorkflowRetryDisabledReason}
            retryHelpText={t("workspace.workflowsView.retryHelp")}
            selectedWorkflowChildRuns={selectedWorkflowChildRuns}
            selectedWorkflowParentRun={selectedWorkflowParentRun}
            showWorkflowInput
            showWorkflowLineage
          />
        </div>
      </aside>
    </div>
  );
}
