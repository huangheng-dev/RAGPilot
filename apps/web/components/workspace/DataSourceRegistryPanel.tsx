"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { DatabaseZap, Plus, RefreshCw, RotateCw } from "lucide-react";

import { ConsoleSurface, ConsoleSurfaceHeader } from "@/components/console/ConsolePrimitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DialogFormActions, DialogFormField, DialogFormLayout, FormDialog } from "@/components/ui/form-dialog";
import { Input } from "@/components/ui/input";
import {
  createPublicWebDataSource,
  listDataSources,
  listDataSourceSyncRuns,
  startDataSourceSync,
  type DataSource,
  type DataSourceSyncRun
} from "@/lib/data-sources";
import { useI18n } from "@/lib/i18n/provider";

type Props = {
  tenantId: string | null;
  knowledgeBaseId: string | null;
  canManageDocuments: boolean;
};

function statusClassName(status: string) {
  if (status === "completed") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "failed") return "border-rose-200 bg-rose-50 text-rose-700";
  if (status === "syncing" || status === "running") return "border-sky-200 bg-sky-50 text-sky-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

export function DataSourceRegistryPanel({ tenantId, knowledgeBaseId, canManageDocuments }: Props) {
  const { language, t } = useI18n();
  const [sources, setSources] = useState<DataSource[]>([]);
  const [latestRuns, setLatestRuns] = useState<Record<string, DataSourceSyncRun | undefined>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [runningSourceId, setRunningSourceId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [sourceUri, setSourceUri] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!tenantId || !knowledgeBaseId) {
      setSources([]);
      setLatestRuns({});
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const nextSources = await listDataSources(knowledgeBaseId);
      setSources(nextSources);
      const runs = await Promise.all(nextSources.map(async (source) => {
        const items = await listDataSourceSyncRuns(source.id, tenantId, 1);
        return [source.id, items[0]] as const;
      }));
      setLatestRuns(Object.fromEntries(runs));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t("workspace.documentsView.dataSources.loadFailed"));
    } finally {
      setIsLoading(false);
    }
  }, [knowledgeBaseId, t, tenantId]);

  useEffect(() => { void load(); }, [load]);

  const hasActiveSync = useMemo(
    () => sources.some((source) => source.sync_status === "syncing") || Object.values(latestRuns).some((run) => run?.run_status === "running"),
    [latestRuns, sources]
  );

  useEffect(() => {
    if (!hasActiveSync) return;
    const timer = window.setInterval(() => { void load(); }, 3000);
    return () => window.clearInterval(timer);
  }, [hasActiveSync, load]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!tenantId || !knowledgeBaseId) return;
    setIsLoading(true);
    setError(null);
    try {
      await createPublicWebDataSource({ tenantId, knowledgeBaseId, name: name.trim(), sourceUri: sourceUri.trim() });
      setName("");
      setSourceUri("");
      setIsCreateOpen(false);
      await load();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : t("workspace.documentsView.dataSources.createFailed"));
      setIsLoading(false);
    }
  }

  async function handleSync(source: DataSource) {
    if (!tenantId) return;
    setRunningSourceId(source.id);
    setError(null);
    try {
      const run = await startDataSourceSync(source.id, tenantId);
      setLatestRuns((current) => ({ ...current, [source.id]: run }));
      await load();
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : t("workspace.documentsView.dataSources.syncFailed"));
    } finally {
      setRunningSourceId(null);
    }
  }

  return (
    <>
      <ConsoleSurface>
        <ConsoleSurfaceHeader
          title={t("workspace.documentsView.dataSources.title")}
          description={t("workspace.documentsView.dataSources.description")}
          action={
            <div className="flex gap-2">
              <Button disabled={isLoading} onClick={() => void load()} size="sm" type="button" variant="outline">
                <RefreshCw className={isLoading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
                {t("workspace.documentsView.dataSources.refresh")}
              </Button>
              {canManageDocuments ? (
                <Button disabled={!tenantId || !knowledgeBaseId} onClick={() => setIsCreateOpen(true)} size="sm" type="button">
                  <Plus className="h-4 w-4" />
                  {t("workspace.documentsView.dataSources.add")}
                </Button>
              ) : null}
            </div>
          }
        />
        <div className="space-y-3 px-6 pb-6">
          {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
          {sources.length === 0 && !isLoading ? (
            <div className="flex items-center gap-3 rounded-xl border border-dashed border-slate-200 px-4 py-5 text-sm text-slate-500">
              <DatabaseZap className="h-5 w-5" />
              {t("workspace.documentsView.dataSources.empty")}
            </div>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {sources.map((source) => {
                const run = latestRuns[source.id];
                const active = source.sync_status === "syncing" || run?.run_status === "running";
                return (
                  <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800" key={source.id}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="truncate font-medium text-slate-950 dark:text-slate-50">{source.name}</div>
                        <div className="mt-1 truncate text-xs text-slate-500">{source.source_uri}</div>
                      </div>
                      <Badge className={statusClassName(active ? "syncing" : source.sync_status)} variant="outline">
                        {t(`workspace.documentsView.dataSources.status.${active ? "syncing" : source.sync_status}`)}
                      </Badge>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
                      <div>
                        {run ? t("workspace.documentsView.dataSources.runSummary", {
                          changed: run.documents_changed,
                          unchanged: run.documents_unchanged,
                          deleted: run.documents_deleted
                        }) : t("workspace.documentsView.dataSources.neverRun")}
                        {source.last_synced_at ? ` · ${new Date(source.last_synced_at).toLocaleString(language === "zh-CN" ? "zh-CN" : "en-US")}` : ""}
                      </div>
                      {canManageDocuments ? (
                        <Button disabled={active || runningSourceId === source.id} onClick={() => void handleSync(source)} size="sm" type="button" variant="outline">
                          <RotateCw className={active ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
                          {active ? t("workspace.documentsView.dataSources.syncing") : t("workspace.documentsView.dataSources.sync")}
                        </Button>
                      ) : null}
                    </div>
                    {source.last_sync_error ? <div className="mt-3 text-xs text-rose-600">{source.last_sync_error}</div> : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </ConsoleSurface>
      <FormDialog
        footer={<DialogFormActions><Button onClick={() => setIsCreateOpen(false)} type="button" variant="outline">{t("workspace.headerBar.cancel")}</Button><Button disabled={isLoading || !name.trim() || !sourceUri.trim()} form="create-data-source" type="submit">{t("workspace.documentsView.dataSources.create")}</Button></DialogFormActions>}
        onClose={() => setIsCreateOpen(false)}
        open={isCreateOpen}
        title={t("workspace.documentsView.dataSources.createTitle")}
      >
        <form id="create-data-source" onSubmit={handleCreate}>
          <DialogFormLayout>
            <DialogFormField label={t("workspace.documentsView.dataSources.name")}>
              <Input maxLength={240} onChange={(event) => setName(event.target.value)} required value={name} />
            </DialogFormField>
            <DialogFormField hint={t("workspace.documentsView.dataSources.urlHint")} label={t("workspace.documentsView.dataSources.url")} showHint>
              <Input onChange={(event) => setSourceUri(event.target.value)} placeholder="https://docs.example.com/handbook" required type="url" value={sourceUri} />
            </DialogFormField>
          </DialogFormLayout>
        </form>
      </FormDialog>
    </>
  );
}
