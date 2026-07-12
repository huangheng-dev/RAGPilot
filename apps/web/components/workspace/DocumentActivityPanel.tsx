"use client";

import {
  formatNumber,
  formatParserLabel,
  formatStatusLabel,
  formatTimestamp,
  formatWorkflowTypeLabel,
  getStatusBadgeClass
} from "../../lib/workspace-formatters";
import { formatOperatorErrorMessage } from "../../lib/api-errors";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConsoleEmptyState } from "@/components/console/ConsolePrimitives";
import { useI18n } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";
import type { DocumentActivity } from "@/components/workspace/workspace-types";

type DocumentActivityPanelProps = {
  activity: DocumentActivity | null;
  emptyState: string;
  isLoading?: boolean;
  onInspectRun: (workflowRunId: string) => void | Promise<void>;
  title?: string;
};

export function DocumentActivityPanel({
  activity,
  emptyState,
  isLoading = false,
  onInspectRun,
  title,
}: DocumentActivityPanelProps) {
  const { t } = useI18n();
  const activityItems = activity?.events ?? [];

  function buildActivityTitle(eventType: string) {
    if (eventType === "document_registered") {
      return t("workspace.documentActivity.documentRegistered");
    }
    if (eventType === "document_version_created") {
      return t("workspace.documentActivity.versionCreated");
    }
    if (eventType === "workflow_retry_requested") {
      return t("workspace.documentActivity.workflowRetryRequested");
    }
    if (eventType === "workflow_execution_started") {
      return t("workspace.documentActivity.workflowExecutionStarted");
    }
    if (eventType === "workflow_completed") {
      return t("workspace.documentActivity.workflowCompleted");
    }
    if (eventType === "workflow_failed") {
      return t("workspace.documentActivity.workflowFailed");
    }
    if (eventType === "workflow_cancelled") {
      return t("workspace.documentActivity.workflowCancelled");
    }
    return t("workspace.documentActivity.ingestionWorkflowStarted");
  }

  function buildActivitySubtitle(event: DocumentActivity["events"][number]) {
    if (event.event_type === "document_registered") {
      return activity?.asset_file_name ?? activity?.title ?? emptyState;
    }

    if (event.event_type === "document_version_created") {
      return t("workspace.documentActivity.versionSnapshot", {
        version: String(event.version_number ?? 0),
        parser: event.parser_name ? formatParserLabel(event.parser_name) : t("workspace.selectedDocument.pending"),
        chunkCount: String(event.chunk_count ?? 0),
        tokenCount: formatNumber(event.token_count_total)
      });
    }

    if (event.retry_of_workflow_run_id) {
      return t("workspace.documentActivity.retryOf", { id: event.retry_of_workflow_run_id });
    }

    return formatWorkflowTypeLabel("document_ingestion") ?? t("workspace.workflowTimeline.documentIngestion");
  }

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle>{title ?? t("workspace.documentActivity.title")}</CardTitle>
        <Badge variant="secondary">{activity?.summary.total_events ?? activityItems.length}</Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        {activity ? (
          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="text-slate-500">{t("workspace.documentActivity.versions")}</div>
              <div className="mt-1 font-medium text-slate-900">{activity.summary.total_versions}</div>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="text-slate-500">{t("workspace.documentActivity.workflowRuns")}</div>
              <div className="mt-1 font-medium text-slate-900">{activity.summary.workflow_runs}</div>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="text-slate-500">{t("workspace.documentActivity.retryRuns")}</div>
              <div className="mt-1 font-medium text-slate-900">{activity.summary.retry_runs}</div>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="text-slate-500">{t("workspace.documentActivity.failedEvents")}</div>
              <div className="mt-1 font-medium text-slate-900">{activity.summary.failed_events}</div>
            </div>
          </div>
        ) : null}

        {isLoading ? (
          <Card className="border-dashed border-slate-300 bg-slate-50 shadow-none">
            <CardContent className="px-3 py-4 text-sm text-slate-500">
              {t("workspace.documentActivity.loading")}
            </CardContent>
          </Card>
        ) : null}

        {activityItems.map((activityItem) => (
          <Card key={activityItem.id} className="border-slate-200 bg-slate-50 shadow-none">
            <CardContent className="p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-slate-900">{buildActivityTitle(activityItem.event_type)}</div>
                <div className="mt-1 text-xs text-slate-500">{buildActivitySubtitle(activityItem)}</div>
              </div>
              <Badge className={cn("border", getStatusBadgeClass(activityItem.status))} variant="outline">
                {formatStatusLabel(activityItem.status)}
              </Badge>
            </div>
            <div className="mt-2 text-xs text-slate-500">{formatTimestamp(activityItem.timestamp)}</div>
            {activityItem.error_message ? (
              <div className="mt-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {formatOperatorErrorMessage(activityItem.error_message)}
              </div>
            ) : null}
            {activityItem.workflow_run_id && (
              <Button
                className="mt-3"
                onClick={() => void onInspectRun(activityItem.workflow_run_id!)}
                size="sm"
                type="button"
                variant="outline"
              >
                {t("workspace.documentActivity.inspectRun")}
              </Button>
            )}
            </CardContent>
          </Card>
        ))}
        {!isLoading && activityItems.length === 0 && (
          <ConsoleEmptyState>{emptyState}</ConsoleEmptyState>
        )}
      </CardContent>
    </Card>
  );
}
