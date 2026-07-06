"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type FormDialogProps = {
  children: ReactNode;
  description?: string;
  footer?: ReactNode;
  onClose: () => void;
  open: boolean;
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
  description,
  footer,
  onClose,
  open,
  size = "lg",
  title
}: FormDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <>
      <button
        aria-label={title}
        className="fixed inset-0 z-[80] bg-slate-950/45 backdrop-blur-sm"
        onClick={onClose}
        type="button"
      />
      <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 sm:p-6">
        <div
          className={cn(
            "flex max-h-[calc(100vh-2rem)] w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:max-h-[calc(100vh-3rem)]",
            SIZE_CLASSNAME[size]
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
            <div>
              <div className="text-base font-semibold text-slate-950">{title}</div>
              {description ? <div className="mt-1 text-sm text-slate-600">{description}</div> : null}
            </div>
            <Button onClick={onClose} size="icon" type="button" variant="ghost">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">{children}</div>
          {footer ? <div className="border-t border-slate-200 px-5 py-4 sm:px-6">{footer}</div> : null}
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
