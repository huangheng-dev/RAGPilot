"use client";

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
      description={typeof description === "string" ? description : undefined}
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
      {typeof description === "string" ? null : description}
    </FormDialog>
  );
}
