"use client";

import { AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { DialogFormActions, FormDialog } from "@/components/ui/form-dialog";

type ConfirmDialogProps = {
  cancelLabel: string;
  confirmLabel: string;
  description: ReactNode;
  isLoading?: boolean;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
  open: boolean;
  title: string;
  tone?: "default" | "danger";
};

export function ConfirmDialog({
  cancelLabel,
  confirmLabel,
  description,
  isLoading = false,
  onCancel,
  onConfirm,
  open,
  title,
  tone = "danger"
}: ConfirmDialogProps) {
  return (
    <FormDialog
      onClose={onCancel}
      open={open}
      size="md"
      title={title}
      footer={
        <DialogFormActions>
          <Button className="rounded-xl bg-white" disabled={isLoading} onClick={onCancel} type="button" variant="outline">
            {cancelLabel}
          </Button>
          <Button
            className={tone === "danger" ? "rounded-xl bg-rose-600 text-white hover:bg-rose-700" : "rounded-xl"}
            disabled={isLoading}
            onClick={() => void onConfirm()}
            type="button"
          >
            {confirmLabel}
          </Button>
        </DialogFormActions>
      }
    >
      <div
        className={
          tone === "danger"
            ? "flex min-h-32 flex-col items-center justify-center gap-3 px-5 py-7 text-center text-sm leading-6 text-rose-800"
            : "flex min-h-32 flex-col items-center justify-center gap-3 px-5 py-7 text-center text-sm leading-6 text-slate-600"
        }
      >
        <AlertTriangle
          className={
            tone === "danger"
              ? "h-10 w-10 shrink-0 stroke-[1.5] text-rose-500"
              : "h-10 w-10 shrink-0 stroke-[1.5] text-slate-400"
          }
        />
        <div className="max-w-xl">{description}</div>
      </div>
    </FormDialog>
  );
}
