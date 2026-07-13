"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";
import type { WorkspaceAgentRecommendation } from "@/components/workspace/workspace-types";

type WorkspaceRecommendedAgentsPanelProps = {
  description: string;
  recommendations: WorkspaceAgentRecommendation[];
  title: string;
  isActivatingRecommendation?: boolean;
  onActivateRecommendation: (recommendation: WorkspaceAgentRecommendation) => void | Promise<void>;
  getActionLabel: (targetView: "chat" | "documents" | "workflows") => string;
  presentation?: "default" | "dialog";
};

export function WorkspaceRecommendedAgentsPanel({
  description,
  recommendations,
  title,
  isActivatingRecommendation = false,
  onActivateRecommendation,
  getActionLabel,
  presentation = "default"
}: WorkspaceRecommendedAgentsPanelProps) {
  const { t } = useI18n();

  if (recommendations.length === 0) {
    return null;
  }

  return (
    <div className={cn("border border-blue-200 bg-blue-50/50", presentation === "dialog" ? "rounded-xl p-4" : "rounded-md px-3 py-3")}>
      <div className="text-sm font-semibold text-slate-950">{title}</div>
      <div className="mt-1 text-sm leading-6 text-slate-600">{description}</div>
      <div className="mt-3 space-y-2">
        {recommendations.map((recommendation) => (
          <div key={recommendation.agent.id} className={cn("border border-blue-100 bg-white px-3 py-3", presentation === "dialog" ? "rounded-xl" : "rounded-md")}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium text-slate-900">{recommendation.agent.name}</div>
                <div className="mt-1 text-slate-500">{t(`agents.modes.${recommendation.agent.mode}`)}</div>
                <div className="mt-2 text-slate-600">{t(`workspace.agentRecommendations.${recommendation.reason}`)}</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge className="border-slate-200 bg-slate-50 text-slate-700" variant="outline">
                    {t(`workspace.sharedRecommendations.targets.${recommendation.targetView}`)}
                  </Badge>
                  <Badge
                    className={cn(
                      "border",
                      recommendation.scopeMatched
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-amber-200 bg-amber-50 text-amber-700"
                    )}
                    variant="outline"
                  >
                    {recommendation.scopeMatched
                      ? t("workspace.sharedRecommendations.scopeMatched")
                      : t("workspace.sharedRecommendations.scopeReview")}
                  </Badge>
                  <Badge className="border-slate-200 bg-slate-50 text-slate-700" variant="outline">
                    {t("workspace.sharedRecommendations.capabilities", {
                      count: String(recommendation.capabilityCount)
                    })}
                  </Badge>
                  <Badge className="border-slate-200 bg-slate-50 text-slate-700" variant="outline">
                    {t("workspace.sharedRecommendations.score", {
                      count: String(recommendation.score)
                    })}
                  </Badge>
                </div>
              </div>
              <Button
                className="shrink-0 bg-white"
                disabled={isActivatingRecommendation}
                onClick={() => void onActivateRecommendation(recommendation)}
                size="sm"
                type="button"
                variant="outline"
              >
                {getActionLabel(recommendation.targetView)}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
