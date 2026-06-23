"use client";

import { CheckCircle2, FileText, Waypoints, X } from "lucide-react";

import { formatTimestamp } from "../../lib/workspace-formatters";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { UploadFollowUpSummary } from "@/components/workspace/workspace-types";
import { useI18n } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

type WorkspaceUploadFollowUpCardProps = {
  summary: UploadFollowUpSummary;
  onClear: () => void;
  onInspectWorkflowRun: (workflowRunId: string) => void | Promise<void>;
  onOpenChatView: (draftQuestion?: string | null) => void;
  onOpenWorkflowView: () => void;
};

export function WorkspaceUploadFollowUpCard({
  summary,
  onClear,
  onInspectWorkflowRun,
  onOpenChatView,
  onOpenWorkflowView
}: WorkspaceUploadFollowUpCardProps) {
  const { t } = useI18n();
  const isReady = summary.workflowStatus === "completed";
  const needsWorkflowFocus =
    summary.workflowStatus === "queued" ||
    summary.workflowStatus === "running" ||
    summary.workflowStatus === "pending" ||
    summary.workflowStatus === "failed";

  return (
    <Card
      className={cn(
        "border shadow-sm",
        isReady ? "border-emerald-200 bg-emerald-50/50" : "border-blue-200 bg-blue-50/50"
      )}
    >
      <CardContent className="flex flex-col gap-4 p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                className={cn(
                  "border",
                  isReady ? "border-emerald-200 bg-white text-emerald-700" : "border-blue-200 bg-white text-blue-700"
                )}
                variant="outline"
              >
                <FileText className="h-3.5 w-3.5" />
                {t("workspace.documentsView.uploadFollowUpBadge")}
              </Badge>
              <Badge className="border-slate-200 bg-white text-slate-600" variant="outline">
                {formatTimestamp(summary.completedAt)}
              </Badge>
            </div>

            <div>
              <div className="text-base font-semibold text-slate-950">
                {t("workspace.documentsView.uploadFollowUpTitle", {
                  title: summary.documentTitle
                })}
              </div>
              <div className="mt-1 text-sm text-slate-600">
                {isReady
                  ? t("workspace.documentsView.uploadFollowUpReady")
                  : summary.workflowStatus === "failed"
                    ? t("workspace.documentsView.uploadFollowUpFailed")
                    : t("workspace.documentsView.uploadFollowUpMonitoring")}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => void onInspectWorkflowRun(summary.workflowRunId)} size="sm" type="button" variant="outline">
              <Waypoints className="h-4 w-4" />
              {t("workspace.documentsView.uploadInspectRun")}
            </Button>
            {isReady ? (
              <Button onClick={() => void onOpenChatView(summary.followUpDraftQuestion)} size="sm" type="button">
                <CheckCircle2 className="h-4 w-4" />
                {t("workspace.documentsView.uploadOpenChat")}
              </Button>
            ) : null}
            {needsWorkflowFocus ? (
              <Button className="bg-white" onClick={() => void onOpenWorkflowView()} size="sm" type="button" variant="outline">
                <Waypoints className="h-4 w-4" />
                {t("workspace.documentsView.uploadOpenWorkflows")}
              </Button>
            ) : null}
            <Button className="bg-white" onClick={onClear} size="sm" type="button" variant="outline">
              <X className="h-4 w-4" />
              {t("workspace.documentsView.uploadDismiss")}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
