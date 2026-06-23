"use client";

import { AgentRunButtonLink } from "@/components/agents/AgentRunButtonLink";
import { Badge } from "@/components/ui/badge";
import type { AgentRunNavigationHref, AgentRunRecordInput } from "@/lib/agent-runs";
import { cn } from "@/lib/utils";

type AppHref = AgentRunNavigationHref;

type PacketStatus = "attention" | "review" | "healthy";

type ConsoleActionPacketCardProps = {
  detail: string;
  metricLabel: string;
  metricValue: string;
  primaryActionHref: AppHref;
  primaryActionLabel: string;
  secondaryActions: Array<{
    label: string;
    href: AppHref;
    runRecord?: AgentRunRecordInput | null;
  }>;
  primaryActionRunRecord?: AgentRunRecordInput | null;
  status: PacketStatus;
  statusLabel: string;
  title: string;
};

function getPacketStatusClass(status: PacketStatus) {
  if (status === "attention") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  if (status === "review") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

export function ConsoleActionPacketCard({
  detail,
  metricLabel,
  metricValue,
  primaryActionHref,
  primaryActionLabel,
  primaryActionRunRecord,
  secondaryActions,
  status,
  statusLabel,
  title
}: ConsoleActionPacketCardProps) {
  return (
    <div className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-base font-semibold text-slate-900">{title}</div>
          <div className="mt-2 text-sm leading-6 text-slate-600">{detail}</div>
        </div>
        <Badge className={cn("border", getPacketStatusClass(status))} variant="outline">
          {statusLabel}
        </Badge>
      </div>
      <div className="mt-4 rounded-[16px] border border-slate-200 bg-white px-4 py-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{metricLabel}</div>
        <div className="mt-2 text-base font-semibold text-slate-900">{metricValue}</div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
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
