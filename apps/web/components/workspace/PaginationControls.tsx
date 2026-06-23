"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/provider";

type PaginationControlsProps = {
  currentPage: number;
  pageCount: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (nextPage: number) => void;
};

export function PaginationControls({
  currentPage,
  pageCount,
  pageSize,
  totalItems,
  onPageChange
}: PaginationControlsProps) {
  const { t } = useI18n();
  if (totalItems === 0) {
    return null;
  }

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <div>
        {t("workspace.pagination.showing", {
          end: String(endItem),
          start: String(startItem),
          total: String(totalItems)
        })}
      </div>
      <div className="flex items-center gap-2">
        <Button
          disabled={currentPage === 1}
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          size="sm"
          type="button"
          variant="outline"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          {t("workspace.pagination.previous")}
        </Button>
        <span className="text-xs text-muted-foreground">
          {t("workspace.pagination.page", {
            current: String(currentPage),
            total: String(pageCount)
          })}
        </span>
        <Button
          disabled={currentPage === pageCount}
          onClick={() => onPageChange(Math.min(pageCount, currentPage + 1))}
          size="sm"
          type="button"
          variant="outline"
        >
          {t("workspace.pagination.next")}
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
