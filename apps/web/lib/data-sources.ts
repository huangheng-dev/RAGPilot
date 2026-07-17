import { authenticatedApiRequest } from "@/lib/authenticated-api";

export type DataSource = {
  id: string;
  tenant_id: string;
  knowledge_base_id: string;
  name: string;
  source_type: string;
  source_uri: string | null;
  identity_key: string;
  connection_status: string;
  sync_status: string;
  sync_cursor: string | null;
  last_synced_at: string | null;
  last_sync_error: string | null;
  metadata_json: Record<string, unknown>;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  latest_sync_run: DataSourceSyncRun | null;
  document_count: number;
};

export type DataSourceSyncRun = {
  id: string;
  data_source_id: string;
  tenant_id: string;
  run_status: string;
  cursor_before: string | null;
  cursor_after: string | null;
  documents_discovered: number;
  documents_changed: number;
  documents_unchanged: number;
  documents_deleted: number;
  temporal_workflow_id: string | null;
  heartbeat_at: string | null;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
};

export function listDataSources(
  knowledgeBaseId: string,
  sourceTypes: Array<"web" | "connector"> = ["web", "connector"],
) {
  const params = new URLSearchParams({ knowledge_base_id: knowledgeBaseId });
  sourceTypes.forEach((sourceType) => params.append("source_type", sourceType));
  return authenticatedApiRequest<DataSource[]>(
    `/data-sources?${params.toString()}`,
  );
}

export function startDataSourceSync(dataSourceId: string, tenantId: string) {
  const params = new URLSearchParams({ tenant_id: tenantId });
  return authenticatedApiRequest<DataSourceSyncRun>(
    `/data-sources/${dataSourceId}/sync?${params.toString()}`,
    { method: "POST" },
  );
}

export function listDataSourceSyncRuns(dataSourceId: string, tenantId: string, limit = 10) {
  const params = new URLSearchParams({ tenant_id: tenantId, limit: String(limit) });
  return authenticatedApiRequest<DataSourceSyncRun[]>(
    `/data-sources/${dataSourceId}/sync-runs?${params.toString()}`
  );
}
