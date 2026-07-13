"use client";

import { PaginationControls } from "./PaginationControls";
import { Search } from "lucide-react";
import {
  formatStatusLabel,
  formatSubjectTypeLabel,
  formatTimestamp,
  formatWorkflowTypeLabel,
  getStatusBadgeClass
} from "../../lib/workspace-formatters";
import { formatOperatorErrorMessage } from "../../lib/api-errors";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useI18n } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

type WorkflowRun = {
  id: string;
  workflow_type: string;
  workflow_status: string;
  retry_of_workflow_run_id: string | null;
  subject_type: string | null;
  subject_id: string | null;
  subject_label: string | null;
  error_message: string | null;
  completed_at: string | null;
  updated_at: string;
};

type WorkflowSortOrder =
  | "updated-desc"
  | "created-desc"
  | "created-asc"
  | "status-priority"
  | "type-asc";

type WorkflowTimelinePanelProps = {
  filteredWorkflowRunCount: number;
  pageSize: number;
  paginatedWorkflowRuns: WorkflowRun[];
  selectedWorkflowRunId: string | null;
  workflowPage: number;
  workflowPageCount: number;
  workflowQuery: string;
  workflowSortOrder: WorkflowSortOrder;
  workflowStatusFilter: string;
  workflowTypeFilter: string;
  workflowRetryMode: string;
  onSelectWorkflowRun: (workflowRunId: string) => void | Promise<void>;
  onWorkflowPageChange: (nextPage: number) => void;
  onWorkflowQueryChange: (value: string) => void;
  onWorkflowSortOrderChange: (value: WorkflowSortOrder) => void;
  onWorkflowStatusFilterChange: (value: string) => void;
  onWorkflowTypeFilterChange: (value: string) => void;
  onWorkflowRetryModeChange: (value: string) => void;
};

export function WorkflowTimelinePanel({
  filteredWorkflowRunCount,
  pageSize,
  paginatedWorkflowRuns,
  selectedWorkflowRunId,
  workflowPage,
  workflowPageCount,
  workflowQuery,
  workflowSortOrder,
  workflowStatusFilter,
  workflowTypeFilter,
  workflowRetryMode,
  onSelectWorkflowRun,
  onWorkflowPageChange,
  onWorkflowQueryChange,
  onWorkflowSortOrderChange,
  onWorkflowStatusFilterChange,
  onWorkflowTypeFilterChange,
  onWorkflowRetryModeChange
}: WorkflowTimelinePanelProps) {
  const { t } = useI18n();
  return (
      <Card className="border-slate-200 shadow-sm">
      <CardHeader className="gap-4 border-b border-slate-200">
        <div className="flex flex-col gap-4">
          <div>
            <CardTitle>{t("workspace.workflowTimeline.title")}</CardTitle>
            <CardDescription className="mt-1">
              {t("workspace.workflowTimeline.description")}
            </CardDescription>
          </div>
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1.6fr)_repeat(4,minmax(0,180px))]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="w-full min-w-0 bg-white pl-9 xl:min-w-64"
              onChange={(event) => onWorkflowQueryChange(event.target.value)}
              placeholder={t("workspace.workflowTimeline.searchPlaceholder")}
              value={workflowQuery}
            />
            </div>
            <Select onValueChange={onWorkflowTypeFilterChange} value={workflowTypeFilter}>
              <SelectTrigger className="w-full min-w-0 bg-white xl:min-w-[180px]">
                <SelectValue placeholder={t("workspace.workflowTimeline.workflowType")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("workspace.workflowTimeline.allWorkflowTypes")}</SelectItem>
                <SelectItem value="document_ingestion">{t("workspace.workflowTimeline.documentIngestion")}</SelectItem>
              </SelectContent>
            </Select>
            <Select onValueChange={onWorkflowStatusFilterChange} value={workflowStatusFilter}>
              <SelectTrigger className="w-full min-w-0 bg-white xl:min-w-[160px]">
                <SelectValue placeholder={t("workspace.workflowTimeline.status")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("workspace.workflowTimeline.allStatuses")}</SelectItem>
                <SelectItem value="completed">{t("workspace.workflowTimeline.completed")}</SelectItem>
                <SelectItem value="failed">{t("workspace.workflowTimeline.failed")}</SelectItem>
                <SelectItem value="cancelled">{t("workspace.workflowTimeline.cancelled")}</SelectItem>
                <SelectItem value="running">{t("workspace.workflowTimeline.running")}</SelectItem>
                <SelectItem value="queued">{t("workspace.workflowTimeline.queued")}</SelectItem>
                <SelectItem value="pending">{t("workspace.workflowTimeline.pending")}</SelectItem>
              </SelectContent>
            </Select>
            <Select onValueChange={onWorkflowRetryModeChange} value={workflowRetryMode}>
              <SelectTrigger className="w-full min-w-0 bg-white xl:min-w-[180px]">
                <SelectValue placeholder={t("workspace.workflowTimeline.retryMode")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("workspace.workflowTimeline.allRetryModes")}</SelectItem>
                <SelectItem value="retries">{t("workspace.workflowTimeline.retryOnly")}</SelectItem>
                <SelectItem value="originals">{t("workspace.workflowTimeline.originalOnly")}</SelectItem>
              </SelectContent>
            </Select>
            <Select onValueChange={(value) => onWorkflowSortOrderChange(value as WorkflowSortOrder)} value={workflowSortOrder}>
              <SelectTrigger className="w-full min-w-0 bg-white xl:min-w-[190px]">
                <SelectValue placeholder={t("workspace.workflowTimeline.sortWorkflows")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="updated-desc">{t("workspace.workflowTimeline.recentlyUpdated")}</SelectItem>
                <SelectItem value="created-desc">{t("workspace.workflowTimeline.recentlyCreated")}</SelectItem>
                <SelectItem value="created-asc">{t("workspace.workflowTimeline.oldestCreated")}</SelectItem>
                <SelectItem value="status-priority">{t("workspace.workflowTimeline.statusPriority")}</SelectItem>
                <SelectItem value="type-asc">{t("workspace.workflowTimeline.workflowTypeAsc")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>

      <CardContent className="divide-y divide-slate-100 p-0">
        {paginatedWorkflowRuns.map((workflowRun) => (
          <button
            key={workflowRun.id}
            className={cn(
              "w-full px-5 py-4 text-left transition hover:bg-slate-50",
              workflowRun.id === selectedWorkflowRunId ? "bg-blue-50" : "bg-white"
            )}
            onClick={() => void onSelectWorkflowRun(workflowRun.id)}
            type="button"
          >
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="font-medium text-slate-900">{formatWorkflowTypeLabel(workflowRun.workflow_type)}</div>
                  <Badge className={cn("border", getStatusBadgeClass(workflowRun.workflow_status))} variant="outline">
                    {formatStatusLabel(workflowRun.workflow_status)}
                  </Badge>
                  {workflowRun.retry_of_workflow_run_id && (
                    <Badge className="border-slate-200 bg-slate-50 text-slate-600" variant="outline">
                      {t("workspace.workflowTimeline.retry")}
                    </Badge>
                  )}
                </div>
                <div className="mt-2 text-xs text-muted-foreground">{workflowRun.id}</div>
                <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
                  <span>{t("workspace.workflowTimeline.subjectValue", { value: formatSubjectTypeLabel(workflowRun.subject_type) })}</span>
                  <span>{workflowRun.subject_label ?? workflowRun.subject_id ?? t("workspace.workflowTimeline.unbound")}</span>
                </div>
                {workflowRun.subject_label && (
                  <div className="mt-1 text-xs text-muted-foreground">{workflowRun.subject_id ?? t("workspace.workflowTimeline.unbound")}</div>
                )}
                {workflowRun.retry_of_workflow_run_id && (
                  <div className="mt-2 text-xs text-muted-foreground">{t("workspace.workflowTimeline.retryOf", { id: workflowRun.retry_of_workflow_run_id })}</div>
                )}
                {workflowRun.error_message && (
                  <div className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">
                    {formatOperatorErrorMessage(workflowRun.error_message)}
                  </div>
                )}
              </div>
              <div className="text-right text-xs text-muted-foreground">
                <div>{formatTimestamp(workflowRun.updated_at)}</div>
                {workflowRun.completed_at && <div className="mt-1">{t("workspace.workflowTimeline.completedMarker")}</div>}
              </div>
            </div>
          </button>
        ))}
        {filteredWorkflowRunCount === 0 && (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">{t("workspace.workflowTimeline.noRunsMatch")}</div>
        )}
      </CardContent>
      <PaginationControls
        currentPage={workflowPage}
        onPageChange={onWorkflowPageChange}
        pageCount={workflowPageCount}
        pageSize={pageSize}
        totalItems={filteredWorkflowRunCount}
      />
    </Card>
  );
}
