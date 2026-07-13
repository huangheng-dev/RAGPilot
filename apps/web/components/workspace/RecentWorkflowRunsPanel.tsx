"use client";

import { formatStatusLabel, formatSubjectTypeLabel, formatTimestamp, formatWorkflowTypeLabel, getStatusBadgeClass } from "../../lib/workspace-formatters";
import { formatOperatorErrorMessage } from "../../lib/api-errors";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConsoleEmptyState } from "@/components/console/ConsolePrimitives";
import { useI18n } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

type WorkflowRun = {
  error_message?: string | null;
  id: string;
  operator_notes?: string | null;
  workflow_status: string;
  workflow_type: string;
  subject_label?: string | null;
  subject_type: string | null;
  updated_at: string;
};

type RecentWorkflowRunsPanelProps = {
  emptyState?: string;
  limit?: number;
  selectedWorkflowRunId: string | null;
  showErrorMessage?: boolean;
  showIdentifier?: boolean;
  title?: string;
  workflowRuns: WorkflowRun[];
  onSelectWorkflowRun: (workflowRunId: string) => void | Promise<void>;
};

export function RecentWorkflowRunsPanel({
  emptyState,
  limit = 6,
  selectedWorkflowRunId,
  showErrorMessage = false,
  showIdentifier = false,
  title,
  workflowRuns,
  onSelectWorkflowRun,
}: RecentWorkflowRunsPanelProps) {
  const { t } = useI18n();
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle>{title ?? t("workspace.recentWorkflowRuns.title")}</CardTitle>
        <Badge variant="secondary">{workflowRuns.length}</Badge>
      </CardHeader>
      <CardContent className="space-y-2">
        {workflowRuns.slice(0, limit).map((workflow) => (
          <button
            key={workflow.id}
            className={cn(
              "w-full rounded-lg border px-3 py-3 text-left transition",
              workflow.id === selectedWorkflowRunId
                ? "border-slate-950 bg-slate-950 text-white"
                : "border-slate-200 bg-slate-50 text-slate-900"
            )}
            onClick={() => void onSelectWorkflowRun(workflow.id)}
            type="button"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium">{formatWorkflowTypeLabel(workflow.workflow_type)}</div>
              <span
                className={cn(
                  "rounded-full border px-2 py-1 text-xs",
                  workflow.id === selectedWorkflowRunId
                    ? "border-slate-700 bg-slate-900 text-slate-100"
                    : getStatusBadgeClass(workflow.workflow_status)
                )}
              >
                {formatStatusLabel(workflow.workflow_status)}
              </span>
              </div>
            <div className={`mt-2 text-xs ${workflow.id === selectedWorkflowRunId ? "text-slate-300" : "text-slate-500"}`}>
              {showIdentifier
                ? workflow.id
                : `${workflow.subject_label ?? formatSubjectTypeLabel(workflow.subject_type) ?? t("workspace.recentWorkflowRuns.workflowFallback")} · ${formatTimestamp(workflow.updated_at)}`}
            </div>
            {showErrorMessage && workflow.error_message && (
              <div className="mt-2 rounded-md bg-rose-50 px-2 py-2 text-xs text-rose-700">
                {formatOperatorErrorMessage(workflow.error_message)}
              </div>
            )}
            {workflow.operator_notes ? (
              <div
                className={cn(
                  "mt-2 rounded-md border px-2 py-2 text-xs leading-5",
                  workflow.id === selectedWorkflowRunId
                    ? "border-slate-700 bg-slate-900/70 text-slate-200"
                    : "border-slate-200 bg-white text-slate-600"
                )}
              >
                <div className="font-medium">{t("workspace.recentWorkflowRuns.operatorNotes")}</div>
                <div className="mt-1 line-clamp-3">{workflow.operator_notes}</div>
              </div>
            ) : null}
          </button>
        ))}
        {emptyState && workflowRuns.length === 0 && (
          <ConsoleEmptyState>{emptyState}</ConsoleEmptyState>
        )}
      </CardContent>
    </Card>
  );
}
