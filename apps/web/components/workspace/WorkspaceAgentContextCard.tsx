"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { Bot } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { WorkspaceAgentContext } from "@/components/workspace/workspace-types";
import { useI18n } from "@/lib/i18n/provider";

type WorkspaceSurface = "chat" | "documents" | "workflows";
type LinkHref = ComponentProps<typeof Link>["href"];

type WorkspaceAgentContextCardProps = {
  activeAgentContext: WorkspaceAgentContext;
  agentConsoleHref: LinkHref;
  onPrimaryAction: () => void;
  onSecondaryAction: () => void;
  primaryActionLabel: string;
  secondaryActionLabel: string;
  surface: WorkspaceSurface;
  surfaceAligned: boolean;
};

export function WorkspaceAgentContextCard({
  activeAgentContext,
  agentConsoleHref,
  onPrimaryAction,
  onSecondaryAction,
  primaryActionLabel,
  secondaryActionLabel,
  surface,
  surfaceAligned
}: WorkspaceAgentContextCardProps) {
  const { t } = useI18n();
  const activeAgentModeLabel = t(`agents.modes.${activeAgentContext.mode}`);
  const activeAgentStatusLabel = t(`agents.statuses.${activeAgentContext.status}`);
  const surfaceKey =
    surface === "chat"
      ? "chatView"
      : surface === "documents"
        ? "documentsView"
        : "workflowsView";

  const description =
    activeAgentContext.mode === "grounded_chat"
      ? t(`workspace.${surfaceKey}.groundedAgentDescription`)
      : activeAgentContext.mode === "document_intake"
        ? t(`workspace.${surfaceKey}.intakeAgentDescription`)
        : t(`workspace.${surfaceKey}.recoveryAgentDescription`);

  return (
    <Card className="border-blue-200 bg-blue-50/40 shadow-sm">
      <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
            <Bot className="h-4 w-4" />
            {t(`workspace.${surfaceKey}.agentHandoff`)}
          </div>
          <div className="mt-2 text-base font-semibold text-slate-950">
            {t(`workspace.${surfaceKey}.agentHandoffTitle`, { name: activeAgentContext.name })}
          </div>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">{description}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge className="border-blue-200 bg-white text-blue-700" variant="outline">
              {activeAgentModeLabel}
            </Badge>
            <Badge className="border-slate-200 bg-white text-slate-700" variant="outline">
              {activeAgentStatusLabel}
            </Badge>
            <Badge
              className={
                surfaceAligned
                  ? "border-emerald-200 bg-white text-emerald-700"
                  : "border-amber-200 bg-white text-amber-700"
              }
              variant="outline"
            >
              {surfaceAligned
                ? t("workspace.sharedAgentContext.aligned")
                : t("workspace.sharedAgentContext.review")}
            </Badge>
            {activeAgentContext.knowledge_base_scope ? (
              <Badge className="border-blue-200 bg-white text-slate-700" variant="outline">
                {t(`workspace.${surfaceKey}.agentScope`, { scope: activeAgentContext.knowledge_base_scope })}
              </Badge>
            ) : null}
            <Badge className="border-slate-200 bg-white text-slate-700" variant="outline">
              {t("workspace.sharedAgentContext.connectedCapabilities", {
                count: String(activeAgentContext.tools.length)
              })}
            </Badge>
          </div>
          <div className="mt-3 text-sm leading-7 text-slate-600">
            <span className="font-medium text-slate-900">{t("workspace.sharedAgentContext.objective")}</span>{" "}
            {activeAgentContext.objective.trim().length > 0
              ? activeAgentContext.objective
              : t("workspace.sharedAgentContext.objectiveMissing")}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={onPrimaryAction} size="sm" type="button">
            {primaryActionLabel}
          </Button>
          <Button className="bg-white" onClick={onSecondaryAction} size="sm" type="button" variant="outline">
            {secondaryActionLabel}
          </Button>
          <Button asChild className="bg-white" size="sm" type="button" variant="outline">
            <Link href={agentConsoleHref}>{t("workspace.sharedAgentContext.openDefinition")}</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
