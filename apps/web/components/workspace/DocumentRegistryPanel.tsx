"use client";

import { useMemo, useState } from "react";
import { CheckSquare, DatabaseZap, RotateCcw, Square, Trash2, Undo2 } from "lucide-react";

import { PaginationControls } from "./PaginationControls";
import {
  formatDateTimeWithYear,
  formatStatusLabel,
  getStatusBadgeClass
} from "../../lib/workspace-formatters";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useI18n } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";
import type { DataSource } from "@/lib/data-sources";
import type {
  DocumentLifecycleFilter,
  DocumentSourceFilter,
  WorkspaceAgentContext,
} from "@/components/workspace/workspace-types";

type DocumentRecord = {
  id: string;
  data_source_id: string | null;
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

type DocumentRegistryPanelProps = {
  activeAgentContext: WorkspaceAgentContext | null;
  documentPage: number;
  documentPageCount: number;
  documentLifecycleFilter: DocumentLifecycleFilter;
  documentQuery: string;
  documentSourceFilter: DocumentSourceFilter;
  documentStatusFilter: string;
  externalSources: DataSource[];
  filteredDocumentCount: number;
  canManageDocuments: boolean;
  isRunningDocumentAction: boolean;
  pageSize: number;
  paginatedDocuments: DocumentRecord[];
  selectedDocumentId: string | null;
  selectedDocumentIds: string[];
  sourceError: string | null;
  onBulkDeleteDocuments: () => void | Promise<void>;
  onBulkReindexDocuments: () => void | Promise<void>;
  onBulkRestoreDocuments: () => void | Promise<void>;
  onClearDocumentSelection: () => void;
  onDocumentPageChange: (nextPage: number) => void;
  onOpenWorkflowView: () => void;
  onInspectWorkflowRun: (workflowRunId: string) => void | Promise<void>;
  onSelectDocument: (documentId: string) => void | Promise<void>;
  onShowFailedDocuments: () => void;
  onToggleDocumentSelection: (documentId: string) => void;
  onToggleSelectAllDocumentsOnPage: () => void;
};

function getDocumentCoreStatus(document: DocumentRecord) {
  if (document.is_deleted) {
    return "deleted";
  }

  const statuses = [
    document.latest_workflow_status,
    document.indexing_status,
    document.ingestion_status,
  ].filter((status): status is string => Boolean(status));
  const priority = ["failed", "cancelled", "running", "processing", "queued", "pending"];

  return priority.find((status) => statuses.includes(status)) ??
    (statuses.every((status) => status === "completed") ? "completed" : statuses[0] ?? "pending");
}

function getDataSourceStatusClassName(status: string) {
  if (status === "completed") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "failed") return "border-rose-200 bg-rose-50 text-rose-700";
  if (status === "syncing" || status === "running") return "border-sky-200 bg-sky-50 text-sky-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

export function DocumentRegistryPanel({
  activeAgentContext,
  documentPage,
  documentPageCount,
  documentLifecycleFilter,
  documentQuery,
  documentSourceFilter,
  documentStatusFilter,
  externalSources,
  filteredDocumentCount,
  canManageDocuments,
  isRunningDocumentAction,
  pageSize,
  paginatedDocuments,
  selectedDocumentId,
  selectedDocumentIds,
  sourceError,
  onBulkDeleteDocuments,
  onBulkReindexDocuments,
  onBulkRestoreDocuments,
  onClearDocumentSelection,
  onDocumentPageChange,
  onOpenWorkflowView,
  onInspectWorkflowRun,
  onSelectDocument,
  onShowFailedDocuments,
  onToggleDocumentSelection,
  onToggleSelectAllDocumentsOnPage
}: DocumentRegistryPanelProps) {
  const { language, t } = useI18n();
  const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = useState(false);
  const [isBulkReindexConfirmOpen, setIsBulkReindexConfirmOpen] = useState(false);
  const [isBulkRestoreConfirmOpen, setIsBulkRestoreConfirmOpen] = useState(false);
  const allDocumentsOnPageSelected =
    paginatedDocuments.length > 0 && paginatedDocuments.every((document) => selectedDocumentIds.includes(document.id));
  const activeAgentModeLabel = activeAgentContext ? t(`agents.modes.${activeAgentContext.mode}`) : null;
  const isDeletedView = documentLifecycleFilter === "deleted";
  const isAllLifecycleView = documentLifecycleFilter === "all";
  const dataSourceById = useMemo(
    () => new Map(externalSources.map((source) => [source.id, source])),
    [externalSources],
  );
  const normalizedQuery = documentQuery.trim().toLowerCase();
  const standaloneSources = useMemo(
    () =>
      externalSources.filter((source) => {
        if (source.document_count > 0) return false;
        if (documentLifecycleFilter === "deleted") return false;
        if (documentSourceFilter === "file") return false;
        if (documentSourceFilter === "web" && source.source_type !== "web") return false;
        if (documentSourceFilter === "other" && source.source_type !== "connector") return false;
        if (documentStatusFilter !== "all") return false;
        if (!normalizedQuery) return true;
        return `${source.name} ${source.source_uri ?? ""}`.toLowerCase().includes(normalizedQuery);
      }),
    [
      documentLifecycleFilter,
      documentSourceFilter,
      documentStatusFilter,
      externalSources,
      normalizedQuery,
    ],
  );
  const displayedStandaloneSources = documentPage === 1 ? standaloneSources : [];

  return (
    <Card className="overflow-visible border-0 bg-transparent shadow-none">
      <CardHeader className="mb-4 !p-0">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <CardTitle className="text-lg leading-normal text-slate-950 dark:text-slate-50">{t("workspace.registry.title")}</CardTitle>
            <p className="mt-1 text-sm text-slate-500">{t("workspace.registry.description")}</p>
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
          <div className="flex flex-wrap items-center justify-end gap-2">
          {selectedDocumentIds.length > 0 ? <>
            <span className="text-sm font-medium text-blue-700">{t("workspace.registry.selectedCount", { count: String(selectedDocumentIds.length) })}</span>
            <Button
              className="bg-white"
              disabled={selectedDocumentIds.length === 0}
              onClick={onClearDocumentSelection}
              size="sm"
              type="button"
              variant="outline"
            >
              {t("workspace.registry.clearSelection")}
            </Button>
            {isDeletedView ? (
                <Button
                  disabled={!canManageDocuments || selectedDocumentIds.length === 0 || isRunningDocumentAction}
                  onClick={() => setIsBulkRestoreConfirmOpen(true)}
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
                  onClick={() => setIsBulkReindexConfirmOpen(true)}
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
          </> : null}
          {activeAgentContext ? <>
            <Button className="bg-white" onClick={onShowFailedDocuments} size="sm" type="button" variant="outline">{t("workspace.registry.openFailedQueue")}</Button>
            <Button className="bg-white" onClick={onOpenWorkflowView} size="sm" type="button" variant="outline">{t("workspace.registry.openWorkflowSupervision")}</Button>
          </> : null}
          </div>
        </div>
      </CardHeader>

      <CardContent className="bg-white !p-0">
        {sourceError ? (
          <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {sourceError}
          </div>
        ) : null}
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <Table className="min-w-[640px] border-separate border-spacing-0 lg:min-w-[840px]">
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead className="w-12 px-3">
                <button
                  aria-label={t("workspace.registry.selectAllAria")}
                  className={cn("flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-slate-100", allDocumentsOnPageSelected ? "text-blue-600" : "text-slate-400 hover:text-slate-600")}
                  onClick={onToggleSelectAllDocumentsOnPage}
                  type="button"
                >{allDocumentsOnPageSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}</button>
              </TableHead>
              <TableHead className="px-5">{t("workspace.registry.document")}</TableHead>
              <TableHead>{t("workspace.registry.status")}</TableHead>
              <TableHead>{t("workspace.registry.source")}</TableHead>
              <TableHead className="hidden lg:table-cell">{t("workspace.registry.updated")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="bg-white text-sm text-slate-700">
            {displayedStandaloneSources.map((source) => {
              const active =
                source.sync_status === "syncing" ||
                source.latest_sync_run?.run_status === "running";
              return (
                <TableRow className="border-b border-slate-100 bg-blue-50/30 [&>td]:py-[14px]" key={`source-${source.id}`}>
                  <TableCell className="px-3 align-middle text-blue-600">
                    <DatabaseZap className="mx-auto h-4 w-4" />
                  </TableCell>
                  <TableCell className="px-5 align-middle">
                    <div className="font-medium text-slate-900">{source.name}</div>
                  </TableCell>
                  <TableCell className="align-middle">
                    <Badge className={getDataSourceStatusClassName(active ? "syncing" : source.sync_status)} variant="outline">
                      {t("workspace.documentsView.dataSources.syncStatus", {
                        status: t(`workspace.documentsView.dataSources.status.${active ? "syncing" : source.sync_status}`),
                      })}
                    </Badge>
                  </TableCell>
                  <TableCell className="align-middle">
                    <Badge className="border-blue-200 bg-blue-50 text-blue-700" title={source.source_uri ?? undefined} variant="outline">
                      {t(`workspace.documentsView.dataSources.types.${source.source_type}`)}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden align-middle text-xs leading-5 text-muted-foreground lg:table-cell">
                    {formatDateTimeWithYear(source.last_synced_at ?? source.updated_at)}
                  </TableCell>
                </TableRow>
              );
            })}
            {paginatedDocuments.map((document) => {
              const source = document.data_source_id ? dataSourceById.get(document.data_source_id) ?? null : null;
              const sourceActive = Boolean(
                source &&
                (source.sync_status === "syncing" || source.latest_sync_run?.run_status === "running"),
              );
              const sourceStatus = sourceActive ? "syncing" : source?.sync_status ?? null;
              const shouldShowSourceStatus = Boolean(
                source && (sourceStatus !== "completed" || source.last_sync_error),
              );
              const coreStatus = getDocumentCoreStatus(document);
              const statusBadge = (
                <Badge className={cn("border", getStatusBadgeClass(coreStatus))} variant="outline">
                  {coreStatus === "deleted" ? t("workspace.registry.deletedBadge") : formatStatusLabel(coreStatus)}
                </Badge>
              );

              return (
                <TableRow
                  key={document.id}
                  className={cn(
                    "cursor-pointer border-b border-slate-100 transition hover:bg-slate-50 [&>td]:py-[14px]",
                    document.id === selectedDocumentId ? "bg-blue-50/70" : "bg-white"
                  )}
                  onClick={() => void onSelectDocument(document.id)}
                >
                  <TableCell className="px-3 align-middle">
                    <button
                      aria-label={`${t("workspace.registry.selectPage")} ${document.title}`}
                      className={cn("flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-slate-100", selectedDocumentIds.includes(document.id) ? "text-blue-600" : "text-slate-400 hover:text-slate-600")}
                      onClick={(event) => { event.stopPropagation(); onToggleDocumentSelection(document.id); }}
                      type="button"
                    >
                      {selectedDocumentIds.includes(document.id) ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                    </button>
                  </TableCell>
                  <TableCell className="px-5 align-middle">
                    <div className="font-medium text-slate-900">{document.title}</div>
                  </TableCell>
                  <TableCell className="align-middle">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {document.latest_workflow_run_id && coreStatus === document.latest_workflow_status ? (
                        <button onClick={(event) => { event.stopPropagation(); void onInspectWorkflowRun(document.latest_workflow_run_id!); }} type="button">
                          {statusBadge}
                        </button>
                      ) : statusBadge}
                      {source && sourceStatus && shouldShowSourceStatus ? (
                        <Badge className={getDataSourceStatusClassName(sourceStatus)} variant="outline">
                          {t("workspace.documentsView.dataSources.syncStatus", {
                            status: t(`workspace.documentsView.dataSources.status.${sourceStatus}`),
                          })}
                        </Badge>
                      ) : null}
                    </div>
                    {source?.last_sync_error ? (
                      <div className="mt-1 max-w-xs truncate text-xs text-rose-600" title={source.last_sync_error}>{source.last_sync_error}</div>
                    ) : null}
                  </TableCell>
                  <TableCell className="align-middle text-xs text-muted-foreground">
                    <Badge
                      className={cn("border", source ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-700")}
                      title={source?.source_uri ?? undefined}
                      variant="outline"
                    >
                      {source
                        ? t(`workspace.documentsView.dataSources.types.${source.source_type}`)
                        : document.source_kind === "web"
                          ? t("workspace.registry.sourceWeb")
                          : document.source_kind === "file"
                            ? t("workspace.registry.sourceFile")
                            : t("workspace.registry.sourceOther")}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden align-middle text-xs leading-5 text-muted-foreground lg:table-cell">{formatDateTimeWithYear(document.updated_at)}</TableCell>
                </TableRow>
              );
            })}
            {paginatedDocuments.length === 0 && displayedStandaloneSources.length === 0 && (
              <TableRow>
                <TableCell className="px-5 py-10 text-center text-sm text-muted-foreground" colSpan={5}>
                  {t("workspace.registry.noDocumentsMatch")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
          </Table>
          <PaginationControls
            currentPage={documentPage}
            onPageChange={onDocumentPageChange}
            pageCount={documentPageCount}
            pageSize={pageSize}
            totalItems={filteredDocumentCount}
          />
        </div>
      </CardContent>
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
      <ConfirmDialog
        cancelLabel={t("workspace.headerBar.cancel")}
        confirmLabel={t("workspace.registry.reindexSelected")}
        description={t("workspace.confirm.reindexSelectedDocuments", {
          count: String(selectedDocumentIds.length)
        })}
        isLoading={isRunningDocumentAction}
        onCancel={() => setIsBulkReindexConfirmOpen(false)}
        onConfirm={async () => {
          await onBulkReindexDocuments();
          setIsBulkReindexConfirmOpen(false);
        }}
        open={isBulkReindexConfirmOpen && selectedDocumentIds.length > 0}
        title={t("workspace.registry.reindexSelected")}
      />
      <ConfirmDialog
        cancelLabel={t("workspace.headerBar.cancel")}
        confirmLabel={t("workspace.registry.restoreSelected")}
        description={t("workspace.confirm.restoreSelectedDocuments", {
          count: String(selectedDocumentIds.length)
        })}
        isLoading={isRunningDocumentAction}
        onCancel={() => setIsBulkRestoreConfirmOpen(false)}
        onConfirm={async () => {
          await onBulkRestoreDocuments();
          setIsBulkRestoreConfirmOpen(false);
        }}
        open={isBulkRestoreConfirmOpen && selectedDocumentIds.length > 0}
        title={t("workspace.registry.restoreSelected")}
      />
    </Card>
  );
}
