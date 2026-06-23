"use client";

import { AlertTriangle, CheckCircle2, Trash2, Waypoints, X } from "lucide-react";

import { formatOperatorErrorMessage } from "../../lib/api-errors";
import { formatTimestamp } from "../../lib/workspace-formatters";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { DocumentActionSummary } from "@/components/workspace/workspace-types";
import { useI18n } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

type DocumentActionSummaryPanelProps = {
  onClear: () => void;
  onInspectWorkflowRun: (workflowRunId: string) => void | Promise<void>;
  onOpenChatView?: (draftQuestion?: string | null) => void | Promise<void>;
  onOpenWorkflowView?: () => void;
  onShowFailedDocuments?: () => void;
  summary: DocumentActionSummary;
};

export function DocumentActionSummaryPanel({
  onClear,
  onInspectWorkflowRun,
  onOpenChatView,
  onOpenWorkflowView,
  onShowFailedDocuments,
  summary
}: DocumentActionSummaryPanelProps) {
  const { t } = useI18n();
  const hasFailures = summary.failureCount > 0;
  const actionLabel =
    summary.action === "delete"
      ? t("workspace.selectedDocument.delete")
      : summary.action === "restore"
        ? t("workspace.selectedDocument.restore")
        : t("workspace.selectedDocument.reindex");
  const actionPastTense =
    summary.action === "delete"
      ? t("workspace.documentActionSummary.deleted")
      : summary.action === "restore"
        ? t("workspace.documentActionSummary.restored")
        : t("workspace.documentActionSummary.queuedForReindex");
  const visibleFailedItems = summary.failedItems.slice(0, 3);
  const hiddenFailureCount = Math.max(0, summary.failedItems.length - visibleFailedItems.length);
  const shouldShowWorkflowGuidance = summary.action === "reindex" && summary.successCount > 0;
  const shouldShowWorkflowAction =
    shouldShowWorkflowGuidance &&
    (summary.followUpView === "workflows" || summary.lastWorkflowStatus === "failed") &&
    typeof onOpenWorkflowView === "function";
  const shouldShowChatGuidance =
    summary.action === "reindex" &&
    summary.successCount > 0 &&
    summary.followUpView === "chat" &&
    typeof onOpenChatView === "function";
  const shouldShowFailureFollowUp = hasFailures && typeof onShowFailedDocuments === "function";
  const shouldShowRestoreGuidance = summary.action === "restore" && summary.successCount > 0;

  return (
    <Card
      className={cn(
        "border shadow-sm",
        hasFailures ? "border-amber-200 bg-amber-50/50" : "border-emerald-200 bg-emerald-50/50"
      )}
    >
      <CardContent className="flex flex-col gap-4 p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                className={cn(
                  "border",
                  hasFailures ? "border-amber-200 bg-white text-amber-700" : "border-emerald-200 bg-white text-emerald-700"
                )}
                variant="outline"
              >
                {summary.action === "delete" ? <Trash2 className="h-3.5 w-3.5" /> : <Waypoints className="h-3.5 w-3.5" />}
                {actionLabel} {t("workspace.documentActionSummary.summarySuffix")}
              </Badge>
              <Badge className="border-slate-200 bg-white text-slate-600" variant="outline">
                {formatTimestamp(summary.completedAt)}
              </Badge>
            </div>

            <div>
              <div className="text-base font-semibold text-slate-950">
                {t("workspace.documentActionSummary.successLine", {
                  actionResult: actionPastTense,
                  requestedCount: String(summary.requestedCount),
                  successCount: String(summary.successCount)
                })}
              </div>
              <div className="mt-1 text-sm text-slate-600">
                {hasFailures
                  ? t("workspace.documentActionSummary.failureLine", {
                      failureCount: String(summary.failureCount)
                    })
                  : t("workspace.documentActionSummary.allSucceeded")}
              </div>
            </div>

            {hasFailures && visibleFailedItems.length > 0 ? (
              <div className="rounded-xl border border-amber-200 bg-white px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">{t("workspace.documentActionSummary.followUpRequired")}</div>
                <div className="mt-3 space-y-2 text-sm text-slate-700">
                  {visibleFailedItems.map((failedItem) => (
                    <div key={failedItem.documentId}>
                      <div className="font-medium text-slate-950">{failedItem.documentTitle}</div>
                      <div className="mt-1 text-slate-600">{formatOperatorErrorMessage(failedItem.message)}</div>
                    </div>
                  ))}
                  {hiddenFailureCount > 0 ? (
                    <div className="text-slate-500">{t("workspace.documentActionSummary.hiddenFailures", { count: String(hiddenFailureCount) })}</div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {shouldShowWorkflowGuidance ? (
              <div className="rounded-xl border border-blue-200 bg-white px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">{t("workspace.documentActionSummary.workflowFollowUp")}</div>
                <div className="mt-2 text-sm text-slate-600">
                  {t("workspace.documentActionSummary.workflowGuidance")}
                </div>
              </div>
            ) : null}

            {shouldShowChatGuidance ? (
              <div className="rounded-xl border border-indigo-200 bg-white px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-700">{t("workspace.documentActionSummary.chatFollowUp")}</div>
                <div className="mt-2 text-sm text-slate-600">
                  {t("workspace.documentActionSummary.chatGuidance")}
                </div>
              </div>
            ) : null}

            {shouldShowRestoreGuidance ? (
              <div className="rounded-xl border border-sky-200 bg-white px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">
                  {t("workspace.documentActionSummary.restoreFollowUp")}
                </div>
                <div className="mt-2 text-sm text-slate-600">
                  {t("workspace.documentActionSummary.restoreGuidance")}
                </div>
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {summary.lastWorkflowRunId ? (
              <Button onClick={() => void onInspectWorkflowRun(summary.lastWorkflowRunId as string)} size="sm" type="button" variant="outline">
                <Waypoints className="h-4 w-4" />
                {t("workspace.documentActionSummary.inspectWorkflowRun")}
              </Button>
            ) : null}
            {shouldShowWorkflowAction ? (
              <Button onClick={() => void onOpenWorkflowView()} size="sm" type="button" variant="outline">
                <Waypoints className="h-4 w-4" />
                {t("workspace.documentActionSummary.openWorkflowSupervision")}
              </Button>
            ) : null}
            {shouldShowChatGuidance ? (
              <Button
                className="bg-white"
                onClick={() => void onOpenChatView?.(summary.followUpDraftQuestion)}
                size="sm"
                type="button"
                variant="outline"
              >
                <CheckCircle2 className="h-4 w-4" />
                {t("workspace.documentActionSummary.openGroundedChat")}
              </Button>
            ) : null}
            {shouldShowFailureFollowUp ? (
              <Button className="bg-white" onClick={() => void onShowFailedDocuments?.()} size="sm" type="button" variant="outline">
                <AlertTriangle className="h-4 w-4" />
                {t("workspace.documentActionSummary.reviewFailedDocuments")}
              </Button>
            ) : null}
            <Button className="bg-white" onClick={onClear} size="sm" type="button" variant="outline">
              <X className="h-4 w-4" />
              {t("workspace.documentActionSummary.dismiss")}
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-white/80 bg-white px-4 py-3">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{t("workspace.documentActionSummary.requested")}</div>
            <div className="mt-2 text-2xl font-semibold text-slate-950">{summary.requestedCount}</div>
          </div>
          <div className="rounded-xl border border-white/80 bg-white px-4 py-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              {t("workspace.documentActionSummary.succeeded")}
            </div>
            <div className="mt-2 text-2xl font-semibold text-emerald-700">{summary.successCount}</div>
          </div>
          <div className="rounded-xl border border-white/80 bg-white px-4 py-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
              {t("workspace.documentActionSummary.failed")}
            </div>
            <div className="mt-2 text-2xl font-semibold text-amber-700">{summary.failureCount}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
