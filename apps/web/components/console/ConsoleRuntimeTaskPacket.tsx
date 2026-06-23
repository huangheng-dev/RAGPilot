"use client";

import { AgentRunButtonLink } from "@/components/agents/AgentRunButtonLink";
import { Badge } from "@/components/ui/badge";
import type { AgentRunNavigationHref, AgentRunRecordInput } from "@/lib/agent-runs";
import { cn } from "@/lib/utils";

type AppHref = AgentRunNavigationHref;

type RuntimeTaskTone = "attention" | "review" | "healthy";

type ConsoleRuntimeTaskPacketProps = {
  detail: string;
  objective?: string | null;
  objectiveLabel: string;
  primaryActionHref: AppHref;
  primaryActionLabel: string;
  primaryActionRunRecord?: AgentRunRecordInput | null;
  prompt?: string | null;
  promptLabel: string;
  secondaryActions: Array<{
    label: string;
    href: AppHref;
    runRecord?: AgentRunRecordInput | null;
  }>;
  statusLabel: string;
  statusTone: RuntimeTaskTone;
  summaryItems: Array<{
    label: string;
    value: string;
  }>;
  title: string;
};

function getToneClassName(tone: RuntimeTaskTone) {
  if (tone === "attention") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  if (tone === "review") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

export function ConsoleRuntimeTaskPacket({
  detail,
  objective,
  objectiveLabel,
  primaryActionHref,
  primaryActionLabel,
  primaryActionRunRecord,
  prompt,
  promptLabel,
  secondaryActions,
  statusLabel,
  statusTone,
  summaryItems,
  title
}: ConsoleRuntimeTaskPacketProps) {
  return (
    <div className="rounded-[24px] border border-slate-100 bg-gradient-to-br from-white to-slate-50/80 p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-lg font-semibold text-slate-950">{title}</div>
          <div className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{detail}</div>
        </div>
        <Badge className={cn("border", getToneClassName(statusTone))} variant="outline">
          {statusLabel}
        </Badge>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {summaryItems.map((item) => (
          <div className="rounded-[18px] border border-slate-200 bg-white px-4 py-3" key={item.label}>
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{item.label}</div>
            <div className="mt-2 text-sm font-semibold leading-6 text-slate-900">{item.value}</div>
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="rounded-[18px] border border-slate-200 bg-white px-4 py-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{objectiveLabel}</div>
          <div className="mt-2 text-sm leading-6 text-slate-700">{objective}</div>
        </div>
        <div className="rounded-[18px] border border-slate-200 bg-white px-4 py-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{promptLabel}</div>
          <div className="mt-2 text-sm leading-6 text-slate-700">{prompt}</div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <AgentRunButtonLink href={primaryActionHref} runRecord={primaryActionRunRecord} size="sm" type="button">
          {primaryActionLabel}
        </AgentRunButtonLink>
        {secondaryActions.map((action) => (
          <AgentRunButtonLink
            className="bg-white"
            href={action.href}
            key={action.label}
            runRecord={action.runRecord}
            size="sm"
            type="button"
            variant="outline"
          >
            {action.label}
          </AgentRunButtonLink>
        ))}
      </div>
    </div>
  );
}
