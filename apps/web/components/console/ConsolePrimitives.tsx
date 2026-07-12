"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { AlertCircle, Inbox } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function ConsoleSurface({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-[0_18px_52px_rgba(15,23,42,0.06)] dark:border-slate-800 dark:bg-slate-950/92",
        className
      )}
    >
      {children}
    </section>
  );
}

export function ConsolePage({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("mx-auto flex w-full max-w-[1520px] flex-col gap-6", className)}>{children}</div>;
}

export function ConsoleSurfaceHeader({
  title,
  description,
  action,
  actionPlacement = "side",
  className
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  actionPlacement?: "side" | "below";
  className?: string;
}) {
  return (
    <div className={cn("px-6 pb-3 pt-6", className)}>
      <div className={cn("flex flex-col gap-3", actionPlacement === "side" && "sm:flex-row sm:items-start sm:justify-between")}>
        <div className="min-w-0">
          <div className="text-lg font-semibold text-slate-950 dark:text-slate-50">{title}</div>
          {description ? <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</div> : null}
        </div>
        {action ? <div className={actionPlacement === "below" ? "mt-2 w-full" : "shrink-0"}>{action}</div> : null}
      </div>
    </div>
  );
}

export function ConsolePageHeader({
  eyebrow,
  icon,
  title,
  description,
  actions
}: {
  eyebrow?: string;
  icon?: ReactNode;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <ConsoleSurface>
      <div className="px-6 py-5 sm:px-7 sm:py-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0 flex-1">
            {eyebrow ? <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">{eyebrow}</div> : null}
            <div className="mt-1 flex items-center gap-3">
              {icon ? <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">{icon}</div> : null}
              <h1 className="text-[28px] font-semibold tracking-tight text-slate-950 sm:text-[34px] dark:text-slate-50">{title}</h1>
            </div>
            {description ? <div className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">{description}</div> : null}
          </div>
          {actions ? <div className="flex w-full flex-wrap items-center gap-3 xl:w-auto xl:justify-end">{actions}</div> : null}
        </div>
      </div>
    </ConsoleSurface>
  );
}

export function ConsoleStatusBar({
  message,
  meta,
  error
}: {
  message: string;
  meta?: string;
  error?: string | null;
}) {
  return (
    <ConsoleSurface className="px-6 py-4">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <div>{message}</div>
          {meta ? <div>{meta}</div> : null}
        </div>
        {error ? (
          <div className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}
      </div>
    </ConsoleSurface>
  );
}

export function ConsoleOutlineBadge({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <Badge className={cn("border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300", className)} variant="outline">
      {children}
    </Badge>
  );
}

export function ConsoleToolbar({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <ConsoleSurface className={cn("px-5 py-4 sm:px-6 sm:py-5", className)}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">{children}</div>
    </ConsoleSurface>
  );
}

export function ConsoleToolbarGroup({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("flex min-w-0 flex-wrap items-center gap-3", className)}>{children}</div>;
}

export function ConsoleSegmentedBar({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <ConsoleSurface className={cn("w-fit max-w-full px-2 py-2", className)}>
      <div className="flex flex-wrap gap-2">{children}</div>
    </ConsoleSurface>
  );
}

export function ConsoleSegmentButton({
  active,
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  active: boolean;
}) {
  return (
    <button
      className={cn(
        "inline-flex h-10 items-center justify-center rounded-2xl px-4 text-sm font-semibold transition",
        active
          ? "bg-slate-950 text-white shadow-sm hover:bg-slate-900 dark:bg-slate-50 dark:text-slate-950 dark:hover:bg-white"
          : "bg-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-slate-50",
        className
      )}
      type="button"
      {...props}
    >
      {children}
    </button>
  );
}

export function ConsoleMetricGrid({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("grid gap-4 md:grid-cols-2 xl:grid-cols-3", className)}>{children}</div>;
}

export function ConsoleMetricCard({
  label,
  value,
  detail,
  action,
  className
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <ConsoleSurface className={cn("px-5 py-5", className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</div>
          <div className="mt-3 text-[32px] font-semibold tracking-tight text-slate-950 dark:text-slate-50">{value}</div>
          {detail ? <div className="mt-2 text-sm leading-6 text-slate-500">{detail}</div> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </ConsoleSurface>
  );
}

export function ConsoleEmptyState({
  children,
  className,
  icon
}: {
  children: ReactNode;
  className?: string;
  icon?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex min-h-28 flex-col items-center justify-center gap-3 px-4 py-6 text-center text-sm leading-6 text-slate-500 dark:text-slate-400",
        className
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center text-slate-400">
        {icon ?? <Inbox className="h-9 w-9 stroke-[1.5]" />}
      </div>
      <div className="max-w-xl">{children}</div>
    </div>
  );
}
