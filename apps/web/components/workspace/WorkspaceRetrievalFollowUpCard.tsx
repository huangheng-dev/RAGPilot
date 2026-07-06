"use client";

import type { ComponentProps, ReactNode } from "react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { RetrievalFollowUpActionDescriptor } from "@/lib/workspace-retrieval-follow-up";
import { cn } from "@/lib/utils";

type LinkHref = ComponentProps<typeof Link>["href"];

type WorkspaceRetrievalFollowUpCardProps = {
  actions: RetrievalFollowUpActionDescriptor[];
  badges?: Array<{
    label: string;
    tone?: "default" | "status";
    className?: string;
  }>;
  body?: ReactNode;
  isResolving?: boolean;
  meta?: ReactNode;
  onOpenThread?: () => void;
  onResolve?: () => void;
  openThreadLabel?: string;
  pendingLabel: string;
  resolveLabel?: string;
  title: ReactNode;
};

export function WorkspaceRetrievalFollowUpCard({
  actions,
  badges = [],
  body,
  isResolving = false,
  meta,
  onOpenThread,
  onResolve,
  openThreadLabel,
  pendingLabel,
  resolveLabel,
  title
}: WorkspaceRetrievalFollowUpCardProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="line-clamp-2 text-sm font-semibold leading-6 text-slate-950">{title}</div>
          {meta ? <div className="mt-1 text-xs text-slate-500">{meta}</div> : null}
        </div>
        {badges.length > 0 ? (
          <div className="flex flex-wrap justify-end gap-2">
            {badges.map((badge, index) => (
              <Badge
                key={`${index}-${badge.label}`}
                className={cn(
                  badge.tone === "status" ? "border" : "border-slate-200 bg-slate-50 text-slate-700",
                  badge.className
                )}
                variant="outline"
              >
                {badge.label}
              </Badge>
            ))}
          </div>
        ) : null}
      </div>

      {body ? <div className="mt-3">{body}</div> : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {onOpenThread && openThreadLabel ? (
          <Button className="bg-white" onClick={onOpenThread} size="sm" type="button" variant="outline">
            {openThreadLabel}
          </Button>
        ) : null}
        {actions.map((action) =>
          action.href ? (
            <Button
              asChild
              className={action.variant === "default" ? "" : "bg-white"}
              key={action.key}
              size="sm"
              type="button"
              variant={action.variant === "default" ? "default" : "outline"}
            >
              <Link href={action.href as LinkHref} title={action.reason}>
                {action.label}
              </Link>
            </Button>
          ) : (
            <Button
              className={action.variant === "default" ? "" : "bg-white"}
              key={action.key}
              onClick={action.onClick}
              size="sm"
              title={action.reason}
              type="button"
              variant={action.variant === "default" ? "default" : "outline"}
            >
              {action.label}
            </Button>
          )
        )}
        {onResolve && resolveLabel ? (
          <Button className="bg-white" disabled={isResolving} onClick={onResolve} size="sm" type="button" variant="outline">
            {isResolving ? pendingLabel : resolveLabel}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
