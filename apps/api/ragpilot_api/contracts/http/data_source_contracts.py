from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class DataSourceCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    tenant_id: UUID
    knowledge_base_id: UUID
    name: str = Field(min_length=1, max_length=240)
    source_type: Literal["file", "web", "connector", "manual"]
    source_uri: str | None = Field(default=None, max_length=2000)
    identity_key: str | None = Field(default=None, max_length=128)
    metadata_json: dict = Field(default_factory=dict)


class DataSourceResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    knowledge_base_id: UUID
    name: str
    source_type: str
    source_uri: str | None
    identity_key: str
    connection_status: str
    sync_status: str
    sync_cursor: str | None
    last_synced_at: datetime | None
    last_sync_error: str | None
    metadata_json: dict
    deleted_at: datetime | None
    created_at: datetime
    updated_at: datetime


class DataSourceSyncRunResponse(BaseModel):
    id: UUID
    data_source_id: UUID
    tenant_id: UUID
    run_status: str
    cursor_before: str | None
    cursor_after: str | None
    documents_discovered: int
    documents_changed: int
    documents_unchanged: int
    documents_deleted: int
    temporal_workflow_id: str | None
    heartbeat_at: datetime | None
    error_message: str | None
    started_at: datetime
    completed_at: datetime | None


class DataSourceSyncRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    tenant_id: UUID
