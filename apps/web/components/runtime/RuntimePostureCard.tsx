"use client";

import Link from "next/link";
import type { ComponentProps } from "react";

import { ConsoleOutlineBadge } from "@/components/console/ConsolePrimitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/provider";
import type { RuntimeHealthSnapshot } from "@/lib/runtime-health";
import { cn } from "@/lib/utils";

function buildRuntimeReadinessClassName(isReady: boolean) {
  return isReady
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-amber-200 bg-amber-50 text-amber-800";
}

export function RuntimePostureCard({
  title,
  description,
  runtimeHealth,
  isLoading,
  errorMessage,
  actionHref,
  actionLabel,
  className
}: {
  title: string;
  description: string;
  runtimeHealth: RuntimeHealthSnapshot | null;
  isLoading: boolean;
  errorMessage: string | null;
  actionHref: ComponentProps<typeof Link>["href"];
  actionLabel: string;
  className?: string;
}) {
  const { t } = useI18n();

  return (
    <div className={cn("rounded-xl border border-slate-100 bg-slate-50/70 p-5", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-950">{title}</div>
          <div className="mt-2 text-sm leading-6 text-slate-500">{description}</div>
        </div>
        <Badge
          className={cn(
            "border",
            runtimeHealth
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : errorMessage
                ? "border-amber-200 bg-amber-50 text-amber-800"
                : "border-slate-200 bg-white text-slate-600"
          )}
          variant="outline"
        >
          {runtimeHealth ? t("settings.governance.ready") : errorMessage ? t("settings.governance.loadFailed") : t("settings.governance.loading")}
        </Badge>
      </div>

      {runtimeHealth ? (
        <>
          <div className="mt-4 rounded-[16px] border border-slate-200 bg-white px-4 py-4">
            <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
              {t("settings.governance.metrics.defaultModel")}
            </div>
            <div className="mt-2 text-base font-semibold text-slate-950">
              {runtimeHealth.effective_chat_model_name || runtimeHealth.chat_model_name}
            </div>
            <div className="mt-1 text-sm text-slate-500">
              {t(`settings.models.providers.${runtimeHealth.effective_chat_model_provider || runtimeHealth.chat_model_provider}`)}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <ConsoleOutlineBadge>
                {runtimeHealth.effective_chat_model_source === "model_endpoint"
                  ? t("agents.executions.runtimeBindingGoverned")
                  : t("agents.executions.runtimeBindingDefault")}
              </ConsoleOutlineBadge>
              {runtimeHealth.effective_chat_model_endpoint_name ? (
                <ConsoleOutlineBadge>{runtimeHealth.effective_chat_model_endpoint_name}</ConsoleOutlineBadge>
              ) : null}
              {runtimeHealth.effective_chat_model_api_base_url ? (
                <ConsoleOutlineBadge>{runtimeHealth.effective_chat_model_api_base_url}</ConsoleOutlineBadge>
              ) : null}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <ConsoleOutlineBadge>
              {t("settings.fields.retrievalEngine")} · {runtimeHealth.retrieval_engine}
            </ConsoleOutlineBadge>
            <ConsoleOutlineBadge>
              {t("settings.fields.agentRuntimeEngine")} · {runtimeHealth.agent_runtime_engine}
            </ConsoleOutlineBadge>
            <ConsoleOutlineBadge>
              {t("settings.fields.chatProvider")} · {t(`settings.models.providers.${runtimeHealth.effective_chat_model_provider || runtimeHealth.chat_model_provider}`)}
            </ConsoleOutlineBadge>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Badge
              className={buildRuntimeReadinessClassName(Boolean(runtimeHealth.llamaindex_pilot_ready))}
              variant="outline"
            >
              {`LlamaIndex · ${
                runtimeHealth.llamaindex_pilot_ready
                  ? t("settings.fields.runtimeReady")
                  : t("settings.fields.runtimePending")
              }`}
            </Badge>
            <Badge
              className={buildRuntimeReadinessClassName(Boolean(runtimeHealth.langgraph_pilot_ready))}
              variant="outline"
            >
              {`LangGraph · ${
                runtimeHealth.langgraph_pilot_ready
                  ? t("settings.fields.runtimeReady")
                  : t("settings.fields.runtimePending")
              }`}
            </Badge>
          </div>
        </>
      ) : isLoading ? (
        <div className="mt-4 rounded-[16px] border border-dashed border-slate-200 bg-white px-4 py-4 text-sm text-slate-500">
          {t("settings.governance.loading")}
        </div>
      ) : errorMessage ? (
        <div className="mt-4 rounded-[16px] border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
          {errorMessage}
        </div>
      ) : null}

      <div className="mt-4">
        <Button asChild className="bg-white" size="sm" type="button" variant="outline">
          <Link href={actionHref}>{actionLabel}</Link>
        </Button>
      </div>
    </div>
  );
}
