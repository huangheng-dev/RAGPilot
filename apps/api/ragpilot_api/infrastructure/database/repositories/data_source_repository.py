from __future__ import annotations

import hashlib
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from ragpilot_api.infrastructure.database.models import DataSource, DataSourceSyncRun
from ragpilot_api.application.errors import ResourceConflictError, ResourceNotFoundError


class DataSourceRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_or_create(
        self, *, tenant_id: UUID, knowledge_base_id: UUID, name: str, source_type: str,
        source_uri: str | None, identity_key: str | None = None, metadata_json: dict | None = None,
    ) -> DataSource:
        resolved_identity = identity_key or build_data_source_identity(
            knowledge_base_id=knowledge_base_id, source_type=source_type, source_uri=source_uri, name=name,
        )
        item = await self.session.scalar(select(DataSource).where(
            DataSource.knowledge_base_id == knowledge_base_id, DataSource.identity_key == resolved_identity,
        ))
        if item is None:
            item = DataSource(
                tenant_id=tenant_id, knowledge_base_id=knowledge_base_id, name=name, source_type=source_type,
                source_uri=source_uri, identity_key=resolved_identity, metadata_json=metadata_json or {},
            )
            self.session.add(item)
        else:
            item.name = name
            item.source_uri = source_uri
            item.connection_status = "connected"
            item.deleted_at = None
            item.updated_at = datetime.now(timezone.utc)
        await self.session.commit()
        await self.session.refresh(item)
        return item

    async def list(self, *, knowledge_base_id: UUID, include_deleted: bool = False) -> list[DataSource]:
        statement = select(DataSource).where(DataSource.knowledge_base_id == knowledge_base_id)
        if not include_deleted:
            statement = statement.where(DataSource.deleted_at.is_(None))
        result = await self.session.scalars(statement.order_by(DataSource.updated_at.desc()))
        return list(result)

    async def start_sync(self, *, item: DataSource) -> DataSourceSyncRun:
        item.sync_status = "syncing"
        item.last_sync_error = None
        item.updated_at = datetime.now(timezone.utc)
        run = DataSourceSyncRun(
            data_source_id=item.id, tenant_id=item.tenant_id, run_status="running", cursor_before=item.sync_cursor,
        )
        self.session.add(run)
        await self.session.commit()
        await self.session.refresh(run)
        return run

    async def claim_sync(
        self, *, data_source_id: UUID, tenant_id: UUID, lease_seconds: int = 1800,
    ) -> tuple[DataSource, DataSourceSyncRun, UUID]:
        item = await self.session.scalar(
            select(DataSource).where(
                DataSource.id == data_source_id,
                DataSource.tenant_id == tenant_id,
                DataSource.deleted_at.is_(None),
            ).with_for_update()
        )
        if item is None:
            raise ResourceNotFoundError("Data source was not found in the current tenant scope.")
        if item.source_type not in {"web", "connector"}:
            raise ResourceConflictError("This data-source type does not provide a durable connector sync adapter.")
        now = datetime.now(timezone.utc)
        if item.sync_lease_token and item.sync_lease_expires_at and item.sync_lease_expires_at > now:
            raise ResourceConflictError("A data-source sync is already running.")
        if item.sync_lease_token:
            await self.session.execute(
                update(DataSourceSyncRun).where(
                    DataSourceSyncRun.data_source_id == item.id,
                    DataSourceSyncRun.run_status == "running",
                ).values(
                    run_status="failed",
                    error_message="The sync lease expired and was superseded by a new run.",
                    completed_at=now,
                )
            )
        lease_token = uuid4()
        run_id = uuid4()
        temporal_workflow_id = f"data-source-sync-{run_id}"
        item.sync_status = "syncing"
        item.last_sync_error = None
        item.sync_lease_token = lease_token
        item.sync_lease_expires_at = now + timedelta(seconds=max(lease_seconds, 60))
        item.updated_at = now
        run = DataSourceSyncRun(
            id=run_id,
            data_source_id=item.id,
            tenant_id=item.tenant_id,
            run_status="running",
            cursor_before=item.sync_cursor,
            temporal_workflow_id=temporal_workflow_id,
            heartbeat_at=now,
        )
        self.session.add(run)
        await self.session.commit()
        await self.session.refresh(run)
        return item, run, lease_token

    async def fail_workflow_start(
        self, *, item: DataSource, run: DataSourceSyncRun, lease_token: UUID, error: str,
    ) -> None:
        now = datetime.now(timezone.utc)
        if item.sync_lease_token == lease_token:
            item.sync_status = "failed"
            item.last_sync_error = error[:2000]
            item.sync_lease_token = None
            item.sync_lease_expires_at = None
            item.updated_at = now
        run.run_status = "failed"
        run.error_message = error[:2000]
        run.completed_at = now
        run.heartbeat_at = now
        await self.session.commit()

    async def complete_sync(self, *, item: DataSource, run: DataSourceSyncRun, cursor: str, changed: int) -> None:
        now = datetime.now(timezone.utc)
        item.sync_status = "completed"
        item.sync_cursor = cursor
        item.last_synced_at = now
        item.last_sync_error = None
        item.updated_at = now
        run.run_status = "completed"
        run.cursor_after = cursor
        run.documents_discovered = 1
        run.documents_changed = changed
        run.completed_at = now
        await self.session.commit()

    async def fail_sync(self, *, item: DataSource, run: DataSourceSyncRun, error: str) -> None:
        now = datetime.now(timezone.utc)
        item.sync_status = "failed"
        item.last_sync_error = error[:2000]
        item.updated_at = now
        run.run_status = "failed"
        run.error_message = error[:2000]
        run.completed_at = now
        await self.session.commit()

    async def list_runs(self, *, data_source_id: UUID, tenant_id: UUID, limit: int = 50) -> list[DataSourceSyncRun]:
        result = await self.session.scalars(select(DataSourceSyncRun).where(
            DataSourceSyncRun.data_source_id == data_source_id, DataSourceSyncRun.tenant_id == tenant_id,
        ).order_by(DataSourceSyncRun.started_at.desc()).limit(limit))
        return list(result)


def build_data_source_identity(*, knowledge_base_id: UUID, source_type: str, source_uri: str | None, name: str) -> str:
    canonical = f"{knowledge_base_id}:{source_type}:{(source_uri or name).strip().lower()}"
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()
