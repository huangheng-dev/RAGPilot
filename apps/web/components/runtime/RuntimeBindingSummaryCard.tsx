"use client";

import { ConsoleOutlineBadge } from "@/components/console/ConsolePrimitives";
import type { AgentExecutionRuntimeBindingSummary } from "@/lib/agent-executions";
import { useI18n } from "@/lib/i18n/provider";

export function RuntimeBindingSummaryCard({
  summary
}: {
  summary: AgentExecutionRuntimeBindingSummary;
}) {
  const { t } = useI18n();
  const providerLabel = summary.providerType ? t(`settings.models.providers.${summary.providerType}`) : null;
  const sourceLabel =
    summary.source === "model_endpoint"
      ? t("agents.executions.runtimeBindingGoverned")
      : summary.source === "settings"
        ? t("agents.executions.runtimeBindingDefault")
        : summary.source;

  return (
    <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
        {t("agents.executions.runtimeBinding")}
      </div>
      <div className="mt-2 text-sm font-semibold text-slate-950">
        {summary.modelName ?? t("settings.fields.runtimeUnavailable")}
      </div>
      <div className="mt-1 text-sm leading-6 text-slate-500">
        {providerLabel ?? t("settings.fields.runtimeUnavailable")}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {sourceLabel ? <ConsoleOutlineBadge>{sourceLabel}</ConsoleOutlineBadge> : null}
        {summary.modelEndpointName ? <ConsoleOutlineBadge>{summary.modelEndpointName}</ConsoleOutlineBadge> : null}
        {summary.apiBaseUrl ? <ConsoleOutlineBadge>{summary.apiBaseUrl}</ConsoleOutlineBadge> : null}
      </div>
    </div>
  );
}
