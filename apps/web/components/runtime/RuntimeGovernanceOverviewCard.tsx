"use client";

import Link from "next/link";

import { ConsoleOutlineBadge } from "@/components/console/ConsolePrimitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  buildRuntimeGovernanceWorklistFollowUp,
  buildSettingsHref
} from "@/lib/console-route-builders";
import { useI18n } from "@/lib/i18n/provider";
import type {
  RuntimeGovernanceOverview,
  RuntimeGovernanceOverviewReasonCode,
  RuntimeGovernanceOverviewStatus
} from "@/lib/platform-governance";
import {
  getRuntimeGovernanceQuickActionLabel,
  resolveRuntimeGovernanceWorklistQuickAction,
  type RuntimeGovernanceQuickActionKey
} from "@/lib/runtime-governance-actions";
import { cn } from "@/lib/utils";

function readStatusClassName(status: RuntimeGovernanceOverviewStatus) {
  if (status === "attention") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }
  if (status === "review") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function readReasonTranslationKey(reasonCode: RuntimeGovernanceOverviewReasonCode) {
  return `settings.governance.overview.reasons.${reasonCode}`;
}

export function RuntimeGovernanceOverviewCard({
  errorMessage,
  isApplyingQuickAction,
  isLoading,
  onApplyQuickAction,
  overview
}: {
  errorMessage: string | null;
  isApplyingQuickAction?: boolean;
  isLoading: boolean;
  onApplyQuickAction?: (resourceId: string, actionKey: RuntimeGovernanceQuickActionKey) => void | Promise<void>;
  overview: RuntimeGovernanceOverview | null;
}) {
  const { t } = useI18n();

  if (isLoading) {
    return (
      <div className="rounded-[20px] border border-dashed border-slate-200 bg-slate-50/70 p-5 text-sm text-slate-500">
        {t("settings.governance.overview.loading")}
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="rounded-[20px] border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
        {errorMessage}
      </div>
    );
  }

  if (!overview) {
    return (
      <div className="rounded-[20px] border border-dashed border-slate-200 bg-slate-50/70 p-5 text-sm text-slate-500">
        {t("settings.governance.overview.empty")}
      </div>
    );
  }

  const primaryItem = overview.primary_item;
  const followUp = primaryItem ? buildRuntimeGovernanceWorklistFollowUp(primaryItem) : null;
  const quickAction = primaryItem ? resolveRuntimeGovernanceWorklistQuickAction(primaryItem) : null;

  const metrics = [
    {
      label: t("settings.governance.overview.metrics.attentionItems"),
      value: String(overview.attention_items)
    },
    {
      label: t("settings.governance.overview.metrics.reviewItems"),
      value: String(overview.review_items)
    },
    {
      label: t("settings.governance.overview.metrics.governedDefaultModels"),
      value: String(overview.model_summary.runtime_ready_default_endpoints)
    },
    {
      label: t("settings.governance.overview.metrics.approvalTools"),
      value: String(overview.tool_summary.approval_required_tools)
    },
    {
      label: t("settings.governance.overview.metrics.pendingMcpTools"),
      value: String(overview.tool_summary.mcp_integration_pending_tools)
    },
    {
      label: t("settings.governance.overview.metrics.blockedConnectors"),
      value: String(overview.mcp_connector_summary.blocked_integration_connectors)
    }
  ];

  return (
    <div className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-950">{t("settings.governance.overview.title")}</div>
          <div className="mt-2 text-sm leading-6 text-slate-500">
            {t(readReasonTranslationKey(overview.reason_code))}
          </div>
        </div>
        <Badge className={cn("border", readStatusClassName(overview.status))} variant="outline">
          {overview.status === "attention"
            ? t("admin.watchlist.attention")
            : overview.status === "review"
              ? t("admin.watchlist.review")
              : t("admin.watchlist.healthy")}
        </Badge>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {metrics.map((metric) => (
          <div className="rounded-[16px] border border-slate-200 bg-white px-4 py-4" key={metric.label}>
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{metric.label}</div>
            <div className="mt-2 text-2xl font-semibold text-slate-950">{metric.value}</div>
          </div>
        ))}
      </div>

      {primaryItem ? (
        <div className="mt-4 rounded-[18px] border border-slate-200 bg-white px-4 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                {t("settings.governance.overview.primaryFocus")}
              </div>
              <div className="mt-2 text-base font-semibold text-slate-950">{primaryItem.resource_name}</div>
              <div className="mt-1 text-sm text-slate-500">
                {t(`admin.runtimeQueue.categories.${primaryItem.category === "unconfigured_model_endpoint"
                  ? "unconfiguredModelEndpoint"
                  : primaryItem.category === "disabled_bound_model_endpoint"
                    ? "disabledBoundModelEndpoint"
                    : primaryItem.category === "approval_required_tool"
                      ? "approvalRequiredTool"
                      : primaryItem.category === "mcp_integration_pending_tool"
                        ? "mcpIntegrationPendingTool"
                        : "integrationBlockedConnector"}`)}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <ConsoleOutlineBadge>{primaryItem.resource_slug}</ConsoleOutlineBadge>
              {primaryItem.last_preview_status ? (
                <ConsoleOutlineBadge>
                  {t("settings.governance.overview.lastPreview", { status: primaryItem.last_preview_status })}
                </ConsoleOutlineBadge>
              ) : null}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {quickAction && onApplyQuickAction ? (
              <Button
                disabled={isApplyingQuickAction}
                onClick={() => void onApplyQuickAction(primaryItem.resource_id, quickAction)}
                size="sm"
                type="button"
              >
                {isApplyingQuickAction
                  ? t("settings.governance.overview.applying")
                  : getRuntimeGovernanceQuickActionLabel(quickAction, t)}
              </Button>
            ) : null}
            <Button asChild className="bg-white" size="sm" type="button" variant="outline">
              <Link href={followUp?.settingsHref ?? buildSettingsHref()}>{t("admin.runtimeQueue.actions.openSettings")}</Link>
            </Button>
            {followUp?.definitionsHref ? (
              <Button asChild className="bg-white" size="sm" type="button" variant="outline">
                <Link href={followUp.definitionsHref}>{t("admin.runtimeQueue.actions.openAgents")}</Link>
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
