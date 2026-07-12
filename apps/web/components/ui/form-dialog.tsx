"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type FormDialogProps = {
  children: ReactNode;
  description?: string;
  eyebrow?: string;
  footer?: ReactNode;
  onClose: () => void;
  open: boolean;
  presentation?: "center" | "side" | "inline";
  size?: "md" | "lg" | "xl";
  title: string;
};

type DialogFormFieldProps = {
  children: ReactNode;
  hint?: ReactNode;
  label: ReactNode;
};

const SIZE_CLASSNAME: Record<NonNullable<FormDialogProps["size"]>, string> = {
  md: "max-w-[640px]",
  lg: "max-w-[760px]",
  xl: "max-w-[960px]"
};

export function FormDialog({
  children,
  eyebrow,
  footer,
  onClose,
  open,
  presentation = "center",
  size = "lg",
  title
}: FormDialogProps) {
  if (!open) {
    return null;
  }

  if (presentation === "inline") {
    return (
      <div className="flex min-h-0 h-full w-full flex-col overflow-hidden bg-white dark:bg-slate-950">
        <div className="flex min-h-16 items-center justify-between gap-4 border-b border-slate-200 px-5 py-3 sm:px-6 dark:border-slate-800">
          <div className="min-w-0">
            {eyebrow ? <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{eyebrow}</div> : null}
            <div className={cn("truncate font-semibold text-slate-950 dark:text-slate-50", eyebrow ? "mt-1 text-sm" : "text-base")}>{title}</div>
          </div>
          <Button aria-label={title} onClick={onClose} size="icon" type="button" variant="ghost">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
          {children}
        </div>
        {footer ? <div className="shrink-0 border-t border-slate-200 px-5 py-4 sm:px-6 dark:border-slate-800">{footer}</div> : null}
      </div>
    );
  }

  return (
    <>
      <button
        aria-label={title}
        className="fixed inset-0 z-[80] bg-slate-950/45 backdrop-blur-sm"
        onClick={onClose}
        type="button"
      />
      <div
        className={cn(
          "fixed inset-0 z-[90] flex",
          presentation === "side"
            ? "items-stretch justify-end"
            : "items-center justify-center p-4 sm:p-6",
        )}
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) {
            onClose();
          }
        }}
      >
        <div
          className={cn(
            "flex max-h-[calc(100vh-2rem)] w-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl sm:max-h-[calc(100vh-3rem)] dark:border-slate-800 dark:bg-slate-950",
            presentation === "side"
              ? "h-full max-h-none max-w-4xl rounded-none border-y-0 border-r-0 sm:max-h-none"
              : SIZE_CLASSNAME[size],
          )}
        >
          <div className="flex min-h-16 items-center justify-between gap-4 border-b border-slate-200 px-5 py-3 sm:px-6 dark:border-slate-800">
            <div className="min-w-0">
              {eyebrow ? <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{eyebrow}</div> : null}
              <div className={cn("truncate font-semibold text-slate-950 dark:text-slate-50", eyebrow ? "mt-1 text-sm" : "text-base")}>{title}</div>
            </div>
            <Button aria-label={title} onClick={onClose} size="icon" type="button" variant="ghost">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
            {children}
          </div>
          {footer ? <div className="border-t border-slate-200 px-5 py-4 sm:px-6 dark:border-slate-800">{footer}</div> : null}
        </div>
      </div>
    </>
  );
}

export function DialogFormLayout({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("space-y-5", className)}>{children}</div>;
}

export function DialogFormGrid({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("grid gap-4 sm:grid-cols-2", className)}>{children}</div>;
}

export function DialogFormField({
  children,
  hint,
  label
}: DialogFormFieldProps) {
  return (
    <div className="space-y-2.5">
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</div>
        {hint ? <div className="mt-1 text-xs leading-5 text-slate-500">{hint}</div> : null}
      </div>
      {children}
    </div>
  );
}

export function DialogFormActions({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("flex flex-wrap justify-end gap-3", className)}>{children}</div>;
}
