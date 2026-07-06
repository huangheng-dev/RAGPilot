"use client";

import type { ReactNode } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import type { AgentExecutionFollowUpAction } from "@/lib/agent-execution-follow-up";

type AgentExecutionFollowUpActionsProps = {
  actions: AgentExecutionFollowUpAction[];
  className?: string;
  extraActions?: ReactNode;
  getLabel: (action: AgentExecutionFollowUpAction) => string;
  title: string;
};

export function AgentExecutionFollowUpActions({
  actions,
  className,
  extraActions,
  getLabel,
  title
}: AgentExecutionFollowUpActionsProps) {
  if (actions.length === 0 && !extraActions) {
    return null;
  }

  return (
    <div className={className}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{title}</div>
      <div className="mt-3 flex flex-wrap gap-2">
        {actions.map((action) => (
          <Button
            asChild
            className={action.variant === "default" ? undefined : "bg-white"}
            key={action.id}
            size="sm"
            type="button"
            variant={action.variant}
          >
            <Link href={action.href}>{getLabel(action)}</Link>
          </Button>
        ))}
        {extraActions}
      </div>
    </div>
  );
}
