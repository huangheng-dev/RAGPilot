"use client";

import type { ReactNode } from "react";
import { AlertCircle } from "lucide-react";

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
        "rounded-[22px] border border-white/80 bg-white shadow-[0_16px_48px_rgba(15,23,42,0.06)]",
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
  return <div className={cn("mx-auto flex w-full max-w-[1520px] flex-col gap-5", className)}>{children}</div>;
}

export function ConsoleSurfaceHeader({
  title,
  description,
  action,
  className
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("border-b border-slate-100 px-6 py-5", className)}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-lg font-semibold text-slate-950">{title}</div>
          {description ? <div className="mt-1 text-sm text-slate-500">{description}</div> : null}
        </div>
        {action}
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
    <section className="rounded-[22px] border border-white/80 bg-white shadow-[0_16px_48px_rgba(15,23,42,0.06)]">
      <div className="px-6 py-5 sm:px-7 sm:py-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0 flex-1">
            {eyebrow ? <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{eyebrow}</div> : null}
            <div className="mt-1 flex items-center gap-3">
              {icon ? <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">{icon}</div> : null}
            <h1 className="text-[28px] font-semibold tracking-tight text-slate-950 sm:text-[34px]">{title}</h1>
            </div>
            {description ? <div className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">{description}</div> : null}
          </div>
          {actions ? <div className="flex w-full flex-wrap items-center gap-3 xl:w-auto xl:justify-end">{actions}</div> : null}
        </div>
      </div>
    </section>
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
    <Badge className={cn("border-slate-200 bg-slate-50 text-slate-600", className)} variant="outline">
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
    <ConsoleSurface className={cn("px-5 py-4", className)}>
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">{children}</div>
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
  return <div className={cn("flex flex-wrap items-center gap-3", className)}>{children}</div>;
}

export function ConsoleSegmentedBar({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <ConsoleSurface className={cn("px-2 py-2", className)}>
      <div className="flex flex-wrap gap-2">{children}</div>
    </ConsoleSurface>
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
          <div className="mt-3 text-[32px] font-semibold tracking-tight text-slate-950">{value}</div>
          {detail ? <div className="mt-2 text-sm leading-6 text-slate-500">{detail}</div> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </ConsoleSurface>
  );
}

export function ConsoleEmptyState({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[18px] border border-dashed border-slate-200 bg-slate-50/80 px-4 py-6 text-sm leading-6 text-slate-500",
        className
      )}
    >
      {children}
    </div>
  );
}
