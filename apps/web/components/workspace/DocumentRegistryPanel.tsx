"use client";

import { useState } from "react";
import { CheckSquare, RotateCcw, Search, Square, Trash2, Undo2 } from "lucide-react";

import { PaginationControls } from "./PaginationControls";
import {
  formatNumber,
  formatParserLabel,
  formatStatusLabel,
  formatTimestamp,
  formatWorkflowTypeLabel,
  getStatusBadgeClass
} from "../../lib/workspace-formatters";
import { formatOperatorErrorMessage } from "../../lib/api-errors";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useI18n } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";
import type { DocumentLifecycleFilter, DocumentSourceFilter, WorkspaceAgentContext } from "@/components/workspace/workspace-types";

type DocumentRecord = {
  id: string;
  title: string;
  source_uri: string | null;
  source_kind: "file" | "web" | "other";
  ingestion_status: string;
  indexing_status: string;
  latest_version_number: number | null;
  latest_version_parser_name: string | null;
  latest_version_ingestion_status: string | null;
  latest_version_chunk_count: number | null;
  latest_version_token_count_total: number | null;
  latest_version_updated_at: string | null;
  latest_workflow_run_id: string | null;
  latest_workflow_type: string | null;
  latest_workflow_status: string | null;
  latest_workflow_error_message: string | null;
  latest_workflow_updated_at: string | null;
  deleted_at?: string | null;
  is_deleted?: boolean;
  updated_at: string;
};

type DocumentSortOrder =
  | "updated-desc"
  | "created-desc"
  | "created-asc"
  | "title-asc"
  | "title-desc"
  | "status-priority";

type DocumentRegistryPanelProps = {
  activeAgentContext: WorkspaceAgentContext | null;
  documentPage: number;
  documentPageCount: number;
  documentLifecycleFilter: DocumentLifecycleFilter;
  documentQuery: string;
  documentSourceFilter: DocumentSourceFilter;
  documentStatusFilter: string;
  documentSortOrder: DocumentSortOrder;
  filteredDocumentCount: number;
  canManageDocuments: boolean;
  isRunningDocumentAction: boolean;
  pageSize: number;
  paginatedDocuments: DocumentRecord[];
  selectedDocumentId: string | null;
  selectedDocumentIds: string[];
  onBulkDeleteDocuments: () => void | Promise<void>;
  onBulkReindexDocuments: () => void | Promise<void>;
  onBulkRestoreDocuments: () => void | Promise<void>;
  onClearDocumentSelection: () => void;
  onDocumentLifecycleFilterChange: (value: DocumentLifecycleFilter) => void;
  onDocumentPageChange: (nextPage: number) => void;
  onDocumentQueryChange: (value: string) => void;
  onDocumentSourceFilterChange: (value: DocumentSourceFilter) => void;
  onDocumentSortOrderChange: (value: DocumentSortOrder) => void;
  onDocumentStatusFilterChange: (value: string) => void;
  onOpenWorkflowView: () => void;
  onInspectWorkflowRun: (workflowRunId: string) => void | Promise<void>;
  onSelectDocument: (documentId: string) => void | Promise<void>;
  onShowFailedDocuments: () => void;
  onToggleDocumentSelection: (documentId: string) => void;
  onToggleSelectAllDocumentsOnPage: () => void;
};

export function DocumentRegistryPanel({
  activeAgentContext,
  documentPage,
  documentPageCount,
  documentLifecycleFilter,
  documentQuery,
  documentSourceFilter,
  documentStatusFilter,
  documentSortOrder,
  filteredDocumentCount,
  canManageDocuments,
  isRunningDocumentAction,
  pageSize,
  paginatedDocuments,
  selectedDocumentId,
  selectedDocumentIds,
  onBulkDeleteDocuments,
  onBulkReindexDocuments,
  onBulkRestoreDocuments,
  onClearDocumentSelection,
  onDocumentLifecycleFilterChange,
  onDocumentPageChange,
  onDocumentQueryChange,
  onDocumentSourceFilterChange,
  onDocumentSortOrderChange,
  onDocumentStatusFilterChange,
  onOpenWorkflowView,
  onInspectWorkflowRun,
  onSelectDocument,
  onShowFailedDocuments,
  onToggleDocumentSelection,
  onToggleSelectAllDocumentsOnPage
}: DocumentRegistryPanelProps) {
  const { t } = useI18n();
  const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = useState(false);
  const allDocumentsOnPageSelected =
    paginatedDocuments.length > 0 && paginatedDocuments.every((document) => selectedDocumentIds.includes(document.id));
  const activeAgentModeLabel = activeAgentContext ? t(`agents.modes.${activeAgentContext.mode}`) : null;
  const isDeletedView = documentLifecycleFilter === "deleted";
  const isAllLifecycleView = documentLifecycleFilter === "all";

  return (
    <Card className="overflow-hidden border-slate-200 shadow-sm">
      <CardHeader className="gap-4 border-b border-slate-200">
        <div className="flex flex-col gap-4">
          <div>
            <CardTitle>{t("workspace.registry.title")}</CardTitle>
            {activeAgentContext ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge className="border-blue-200 bg-blue-50 text-blue-700" variant="outline">
                  {t("workspace.registry.activeAgent", { name: activeAgentContext.name })}
                </Badge>
                {activeAgentModeLabel ? (
                  <Badge className="border-slate-200 bg-white text-slate-700" variant="outline">
                    {activeAgentModeLabel}
                  </Badge>
                ) : null}
                {activeAgentContext.knowledge_base_scope ? (
                  <Badge className="border-slate-200 bg-white text-slate-700" variant="outline">
                    {t("workspace.registry.agentScope", { scope: activeAgentContext.knowledge_base_scope })}
                  </Badge>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1.6fr)_repeat(4,minmax(0,180px))]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
                className="min-w-64 bg-white pl-9"
              onChange={(event) => onDocumentQueryChange(event.target.value)}
              placeholder={t("workspace.registry.searchPlaceholder")}
              value={documentQuery}
            />
            </div>
            <Select onValueChange={onDocumentStatusFilterChange} value={documentStatusFilter}>
              <SelectTrigger className="w-full min-w-[160px] bg-white">
                <SelectValue placeholder={t("workspace.registry.status")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("workspace.registry.allStatuses")}</SelectItem>
                <SelectItem value="completed">{t("workspace.registry.completed")}</SelectItem>
                <SelectItem value="running">{t("workspace.registry.running")}</SelectItem>
                <SelectItem value="queued">{t("workspace.registry.queued")}</SelectItem>
                <SelectItem value="failed">{t("workspace.registry.failed")}</SelectItem>
                <SelectItem value="pending">{t("workspace.registry.pending")}</SelectItem>
              </SelectContent>
            </Select>
            <Select
              onValueChange={(value) => onDocumentSourceFilterChange(value as DocumentSourceFilter)}
              value={documentSourceFilter}
            >
              <SelectTrigger className="w-full min-w-[170px] bg-white">
                <SelectValue placeholder={t("workspace.registry.sourceType")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("workspace.registry.allSources")}</SelectItem>
                <SelectItem value="file">{t("workspace.registry.sourceFile")}</SelectItem>
                <SelectItem value="web">{t("workspace.registry.sourceWeb")}</SelectItem>
                <SelectItem value="other">{t("workspace.registry.sourceOther")}</SelectItem>
              </SelectContent>
            </Select>
            <Select
              onValueChange={(value) => onDocumentLifecycleFilterChange(value as DocumentLifecycleFilter)}
              value={documentLifecycleFilter}
            >
              <SelectTrigger className="w-full min-w-[170px] bg-white">
                <SelectValue placeholder={t("workspace.registry.lifecycle")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">{t("workspace.registry.lifecycleActive")}</SelectItem>
                <SelectItem value="deleted">{t("workspace.registry.lifecycleDeleted")}</SelectItem>
                <SelectItem value="all">{t("workspace.registry.lifecycleAll")}</SelectItem>
              </SelectContent>
            </Select>
            <Select onValueChange={(value) => onDocumentSortOrderChange(value as DocumentSortOrder)} value={documentSortOrder}>
              <SelectTrigger className="w-full min-w-[190px] bg-white">
                <SelectValue placeholder={t("workspace.registry.sortDocuments")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="updated-desc">{t("workspace.registry.recentlyUpdated")}</SelectItem>
                <SelectItem value="created-desc">{t("workspace.registry.recentlyCreated")}</SelectItem>
                <SelectItem value="created-asc">{t("workspace.registry.oldestCreated")}</SelectItem>
                <SelectItem value="title-asc">{t("workspace.registry.titleAsc")}</SelectItem>
                <SelectItem value="title-desc">{t("workspace.registry.titleDesc")}</SelectItem>
                <SelectItem value="status-priority">{t("workspace.registry.statusPriority")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {activeAgentContext ? (
            <div className="flex flex-wrap gap-2">
              <Button className="bg-white" onClick={onShowFailedDocuments} size="sm" type="button" variant="outline">
                {t("workspace.registry.openFailedQueue")}
              </Button>
              <Button className="bg-white" onClick={onOpenWorkflowView} size="sm" type="button" variant="outline">
                {t("workspace.registry.openWorkflowSupervision")}
              </Button>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <Button
              className="bg-white"
              disabled={paginatedDocuments.length === 0}
              onClick={onToggleSelectAllDocumentsOnPage}
              size="sm"
              type="button"
              variant="outline"
            >
              {allDocumentsOnPageSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
              {allDocumentsOnPageSelected ? t("workspace.registry.unselectPage") : t("workspace.registry.selectPage")}
            </Button>
            <Button
              className="bg-white"
              disabled={selectedDocumentIds.length === 0}
              onClick={onClearDocumentSelection}
              size="sm"
              type="button"
              variant="outline"
            >
              {`${t("workspace.registry.clearSelection")} (${selectedDocumentIds.length})`}
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isDeletedView ? (
                <Button
                  disabled={!canManageDocuments || selectedDocumentIds.length === 0 || isRunningDocumentAction}
                  onClick={() => void onBulkRestoreDocuments()}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <Undo2 className="h-4 w-4" />
                  {`${t("workspace.registry.restoreSelected")} (${selectedDocumentIds.length})`}
                </Button>
              ) : !isAllLifecycleView ? (
              <>
                <Button
                  disabled={!canManageDocuments || selectedDocumentIds.length === 0 || isRunningDocumentAction}
                  onClick={() => void onBulkReindexDocuments()}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <RotateCcw className="h-4 w-4" />
                  {`${t("workspace.registry.reindexSelected")} (${selectedDocumentIds.length})`}
                </Button>
                <Button
                  className="border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-700"
                  disabled={!canManageDocuments || selectedDocumentIds.length === 0 || isRunningDocumentAction}
                  onClick={() => setIsBulkDeleteConfirmOpen(true)}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <Trash2 className="h-4 w-4" />
                  {`${t("workspace.registry.deleteSelected")} (${selectedDocumentIds.length})`}
                </Button>
              </>
            ) : null}
          </div>
        </div>
      </CardHeader>

      <CardContent className="overflow-hidden bg-white p-0">
        <Table className="border-separate border-spacing-0">
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead className="w-14 px-5">
                <input
                  aria-label={t("workspace.registry.selectAllAria")}
                  checked={allDocumentsOnPageSelected}
                  className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                  onChange={() => onToggleSelectAllDocumentsOnPage()}
                  type="checkbox"
                />
              </TableHead>
              <TableHead className="px-5">{t("workspace.registry.document")}</TableHead>
              <TableHead>{t("workspace.registry.ingestion")}</TableHead>
              <TableHead>{t("workspace.registry.indexing")}</TableHead>
              <TableHead>{t("workspace.registry.version")}</TableHead>
              <TableHead>{t("workspace.registry.latestWorkflow")}</TableHead>
              <TableHead>{t("workspace.registry.source")}</TableHead>
              <TableHead>{t("workspace.registry.updated")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="bg-white text-sm text-slate-700">
            {paginatedDocuments.map((document) => (
              <TableRow
                key={document.id}
                className={cn(
                  "cursor-pointer border-b border-slate-100 transition hover:bg-slate-50",
                  document.id === selectedDocumentId ? "bg-blue-50/70" : "bg-white"
                )}
                onClick={() => void onSelectDocument(document.id)}
              >
                <TableCell className="px-5 align-top">
                  <input
                    aria-label={`${t("workspace.registry.selectPage")} ${document.title}`}
                    checked={selectedDocumentIds.includes(document.id)}
                    className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                    onChange={() => onToggleDocumentSelection(document.id)}
                    onClick={(event) => event.stopPropagation()}
                    type="checkbox"
                  />
                </TableCell>
                <TableCell className="px-5 align-top">
                  <div className="font-medium text-slate-900">{document.title}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{document.id}</div>
                  {document.is_deleted ? (
                    <div className="mt-2">
                      <Badge className="border-slate-200 bg-slate-100 text-slate-700" variant="outline">
                        {t("workspace.registry.deletedBadge")}
                      </Badge>
                    </div>
                  ) : null}
                  {document.latest_version_number ? (
                    <div className="mt-2 text-xs text-muted-foreground">
                      v{document.latest_version_number}
                      {document.latest_version_updated_at ? ` · ${formatTimestamp(document.latest_version_updated_at)}` : ""}
                    </div>
                  ) : null}
                </TableCell>
                <TableCell className="align-top">
                  <Badge className={cn("border", getStatusBadgeClass(document.ingestion_status))} variant="outline">
                    {formatStatusLabel(document.ingestion_status)}
                  </Badge>
                </TableCell>
                <TableCell className="align-top">
                  <Badge className={cn("border", getStatusBadgeClass(document.indexing_status))} variant="outline">
                    {formatStatusLabel(document.indexing_status)}
                  </Badge>
                </TableCell>
                <TableCell className="align-top text-xs">
                  {document.latest_version_number ? (
                    <div className="space-y-2 text-muted-foreground">
                      <div>{document.latest_version_parser_name ? formatParserLabel(document.latest_version_parser_name) : t("workspace.registry.parserPending")}</div>
                      <div>
                        {t("workspace.registry.chunksTokens", {
                          chunkCount: String(document.latest_version_chunk_count ?? 0),
                          tokenCount: formatNumber(document.latest_version_token_count_total)
                        })}
                      </div>
                      {document.latest_version_ingestion_status ? (
                        <Badge className={cn("border", getStatusBadgeClass(document.latest_version_ingestion_status))} variant="outline">
                          {formatStatusLabel(document.latest_version_ingestion_status)}
                        </Badge>
                      ) : null}
                    </div>
                  ) : (
                    <div className="text-muted-foreground">{t("workspace.registry.noVersionYet")}</div>
                  )}
                </TableCell>
                <TableCell className="align-top text-xs">
                  {document.latest_workflow_status ? (
                    <div className="space-y-2">
                      <Badge className={cn("border", getStatusBadgeClass(document.latest_workflow_status))} variant="outline">
                        {formatStatusLabel(document.latest_workflow_status)}
                      </Badge>
                      <div className="text-muted-foreground">{formatWorkflowTypeLabel(document.latest_workflow_type) ?? t("workspace.registry.workflowFallback")}</div>
                      {document.latest_workflow_updated_at ? (
                        <div className="text-muted-foreground">{formatTimestamp(document.latest_workflow_updated_at)}</div>
                      ) : null}
                      {document.latest_workflow_error_message ? (
                        <div className="line-clamp-2 rounded-md bg-rose-50 px-2 py-1 text-rose-700">
                          {formatOperatorErrorMessage(document.latest_workflow_error_message)}
                        </div>
                      ) : null}
                      {document.latest_workflow_run_id ? (
                        <Button
                          className="h-7 px-2"
                          onClick={(event) => {
                            event.stopPropagation();
                            void onInspectWorkflowRun(document.latest_workflow_run_id!);
                          }}
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          {t("workspace.registry.inspectRun")}
                        </Button>
                      ) : null}
                    </div>
                  ) : (
                    <div className="text-muted-foreground">{t("workspace.registry.noWorkflowRecorded")}</div>
                  )}
                </TableCell>
                <TableCell className="align-top text-xs text-muted-foreground">
                  <div className="space-y-2">
                    <Badge className="border-slate-200 bg-white text-slate-700" variant="outline">
                      {document.source_kind === "web"
                        ? t("workspace.registry.sourceWeb")
                        : document.source_kind === "file"
                          ? t("workspace.registry.sourceFile")
                          : t("workspace.registry.sourceOther")}
                    </Badge>
                    <div className="max-w-[260px] break-all">{document.source_uri ?? t("workspace.registry.sourceUnavailable")}</div>
                  </div>
                </TableCell>
                <TableCell className="align-top text-xs text-muted-foreground">{formatTimestamp(document.updated_at)}</TableCell>
              </TableRow>
            ))}
            {paginatedDocuments.length === 0 && (
              <TableRow>
                <TableCell className="px-5 py-10 text-center text-sm text-muted-foreground" colSpan={8}>
                  {t("workspace.registry.noDocumentsMatch")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
      <PaginationControls
        currentPage={documentPage}
        onPageChange={onDocumentPageChange}
        pageCount={documentPageCount}
        pageSize={pageSize}
        totalItems={filteredDocumentCount}
      />
      <ConfirmDialog
        cancelLabel={t("workspace.headerBar.cancel")}
        confirmLabel={t("workspace.registry.deleteSelected")}
        description={t("workspace.confirm.deleteSelectedDocuments", {
          count: String(selectedDocumentIds.length)
        })}
        isLoading={isRunningDocumentAction}
        onCancel={() => setIsBulkDeleteConfirmOpen(false)}
        onConfirm={async () => {
          await onBulkDeleteDocuments();
          setIsBulkDeleteConfirmOpen(false);
        }}
        open={isBulkDeleteConfirmOpen && selectedDocumentIds.length > 0}
        title={t("workspace.registry.deleteSelected")}
      />
    </Card>
  );
}
