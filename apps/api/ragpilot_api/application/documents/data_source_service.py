from __future__ import annotations

from uuid import UUID

from ragpilot_api.contracts.http.data_source_contracts import DataSourceCreateRequest, DataSourceResponse, DataSourceSyncRunResponse
from ragpilot_api.infrastructure.database.models import DataSource, DataSourceSyncRun
from ragpilot_api.infrastructure.database.repositories.data_source_repository import DataSourceRepository
from ragpilot_api.infrastructure.workflows.temporal_client import TemporalWorkflowClient


class DataSourceService:
    def __init__(self, repository: DataSourceRepository) -> None:
        self.repository = repository

    async def create(self, request: DataSourceCreateRequest) -> DataSourceResponse:
        item = await self.repository.get_or_create(
            tenant_id=request.tenant_id, knowledge_base_id=request.knowledge_base_id, name=request.name.strip(),
            source_type=request.source_type, source_uri=request.source_uri.strip() if request.source_uri else None,
            identity_key=request.identity_key, metadata_json=request.metadata_json,
        )
        return build_data_source_response(item)

    async def list(self, *, knowledge_base_id: UUID, include_deleted: bool = False) -> list[DataSourceResponse]:
        return [build_data_source_response(item) for item in await self.repository.list(
            knowledge_base_id=knowledge_base_id, include_deleted=include_deleted,
        )]

    async def list_runs(self, *, data_source_id: UUID, tenant_id: UUID, limit: int) -> list[DataSourceSyncRunResponse]:
        return [build_sync_run_response(item) for item in await self.repository.list_runs(
            data_source_id=data_source_id, tenant_id=tenant_id, limit=limit,
        )]

    async def start_sync(
        self, *, data_source_id: UUID, tenant_id: UUID, workflow_client: TemporalWorkflowClient,
    ) -> DataSourceSyncRunResponse:
        item, run, lease_token = await self.repository.claim_sync(
            data_source_id=data_source_id, tenant_id=tenant_id,
        )
        try:
            await workflow_client.start_data_source_sync_workflow(
                temporal_workflow_id=str(run.temporal_workflow_id),
                data_source_id=str(item.id),
                sync_run_id=str(run.id),
                lease_token=str(lease_token),
            )
        except Exception as error:
            await self.repository.fail_workflow_start(
                item=item, run=run, lease_token=lease_token, error=f"Unable to start sync workflow: {error}",
            )
            raise
        return build_sync_run_response(run)


def build_data_source_response(item: DataSource) -> DataSourceResponse:
    return DataSourceResponse(
        id=item.id, tenant_id=item.tenant_id, knowledge_base_id=item.knowledge_base_id, name=item.name,
        source_type=item.source_type, source_uri=item.source_uri, identity_key=item.identity_key,
        connection_status=item.connection_status, sync_status=item.sync_status, sync_cursor=item.sync_cursor,
        last_synced_at=item.last_synced_at, last_sync_error=item.last_sync_error,
        metadata_json=dict(item.metadata_json or {}), deleted_at=item.deleted_at,
        created_at=item.created_at, updated_at=item.updated_at,
    )


def build_sync_run_response(item: DataSourceSyncRun) -> DataSourceSyncRunResponse:
    return DataSourceSyncRunResponse(
        id=item.id, data_source_id=item.data_source_id, tenant_id=item.tenant_id, run_status=item.run_status,
        cursor_before=item.cursor_before, cursor_after=item.cursor_after,
        documents_discovered=item.documents_discovered, documents_changed=item.documents_changed,
        documents_unchanged=item.documents_unchanged, documents_deleted=item.documents_deleted,
        temporal_workflow_id=item.temporal_workflow_id, heartbeat_at=item.heartbeat_at,
        error_message=item.error_message, started_at=item.started_at, completed_at=item.completed_at,
    )
