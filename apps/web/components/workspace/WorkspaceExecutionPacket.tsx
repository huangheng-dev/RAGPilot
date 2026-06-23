"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";
import type { WorkspaceView } from "@/components/workspace/workspace-types";

type PacketTone = "healthy" | "review" | "attention";

type WorkspaceExecutionPacketAction = {
  label: string;
  onClick: () => void | Promise<void>;
  variant?: "default" | "outline";
};

type WorkspaceExecutionPacketProps = {
  capabilityCount?: number | null;
  currentView: WorkspaceView;
  description: string;
  primaryAction?: WorkspaceExecutionPacketAction | null;
  recommendedView?: WorkspaceView | null;
  scopeMatched?: boolean | null;
  secondaryActions?: WorkspaceExecutionPacketAction[];
  stateSummary: string;
  subject: string;
  title?: string;
  tone: PacketTone;
};

const toneClasses: Record<PacketTone, string> = {
  healthy: "border-emerald-200 bg-emerald-50/70 text-emerald-700",
  review: "border-amber-200 bg-amber-50/70 text-amber-700",
  attention: "border-rose-200 bg-rose-50/80 text-rose-700",
};

export function WorkspaceExecutionPacket({
  capabilityCount = null,
  currentView,
  description,
  primaryAction = null,
  recommendedView = null,
  scopeMatched = null,
  secondaryActions = [],
  stateSummary,
  subject,
  title,
  tone,
}: WorkspaceExecutionPacketProps) {
  const { t } = useI18n();

  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-3 text-xs text-slate-600">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-medium text-slate-900">{title ?? t("workspace.sharedExecutionPacket.title")}</div>
          <div className="mt-1 text-slate-600">{description}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={cn("border", toneClasses[tone])} variant="outline">
            {t(`workspace.sharedExecutionPacket.tones.${tone}`)}
          </Badge>
          <Badge className="border-slate-200 bg-slate-50 text-slate-700" variant="outline">
            {capabilityCount == null
              ? t("workspace.sharedExecutionPacket.capabilitiesUnavailable")
              : t("workspace.sharedExecutionPacket.capabilities", { count: String(capabilityCount) })}
          </Badge>
        </div>
      </div>

      <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-3">
        <div className="text-slate-500">{t("workspace.sharedExecutionPacket.subject")}</div>
        <div className="mt-1 break-words font-medium text-slate-900">{subject}</div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3">
          <div className="text-slate-500">{t("workspace.sharedExecutionPacket.currentState")}</div>
          <div className="mt-1 font-medium text-slate-900">{stateSummary}</div>
        </div>
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3">
          <div className="text-slate-500">{t("workspace.sharedExecutionPacket.currentSurface")}</div>
          <div className="mt-1 font-medium text-slate-900">
            {t(`workspace.sharedRecommendations.targets.${currentView}`)}
          </div>
        </div>
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3">
          <div className="text-slate-500">{t("workspace.sharedExecutionPacket.recommendedSurface")}</div>
          <div className="mt-1 font-medium text-slate-900">
            {recommendedView
              ? t(`workspace.sharedRecommendations.targets.${recommendedView}`)
              : t("workspace.sharedExecutionPacket.noRecommendedSurface")}
          </div>
        </div>
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3">
          <div className="text-slate-500">{t("workspace.sharedExecutionPacket.scopePosture")}</div>
          <div className="mt-1 font-medium text-slate-900">
            {scopeMatched == null
              ? t("workspace.sharedExecutionPacket.scopeUnavailable")
              : scopeMatched
                ? t("workspace.sharedExecutionPacket.scopeMatched")
                : t("workspace.sharedExecutionPacket.scopeReview")}
          </div>
        </div>
      </div>

      {(primaryAction || secondaryActions.length > 0) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {primaryAction ? (
            <Button onClick={() => void primaryAction.onClick()} size="sm" type="button" variant={primaryAction.variant ?? "default"}>
              {primaryAction.label}
            </Button>
          ) : null}
          {secondaryActions.map((action) => (
            <Button
              key={action.label}
              className="bg-white"
              onClick={() => void action.onClick()}
              size="sm"
              type="button"
              variant={action.variant ?? "outline"}
            >
              {action.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
