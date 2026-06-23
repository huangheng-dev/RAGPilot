from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class DocumentCreateRequest(BaseModel):
    tenant_id: UUID
    knowledge_base_id: UUID
    title: str = Field(min_length=1, max_length=240)
    source_uri: str | None = Field(default=None, max_length=2000)


class DocumentResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    knowledge_base_id: UUID
    title: str
    source_uri: str | None
    ingestion_status: str
    indexing_status: str
    latest_version_number: int | None = None
    latest_version_parser_name: str | None = None
    latest_version_ingestion_status: str | None = None
    latest_version_chunk_count: int | None = None
    latest_version_token_count_total: int | None = None
    latest_version_updated_at: datetime | None = None
    latest_workflow_run_id: UUID | None = None
    latest_workflow_type: str | None = None
    latest_workflow_status: str | None = None
    latest_workflow_error_message: str | None = None
    latest_workflow_updated_at: datetime | None = None
    deleted_at: datetime | None = None
    is_deleted: bool = False
    created_at: datetime
    updated_at: datetime


class DocumentMetricsResponse(BaseModel):
    total_documents: int
    completed_documents: int
    active_documents: int
    failed_documents: int


class DocumentChunkResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    document_version_id: UUID
    chunk_index: int
    content: str
    token_count: int | None
    metadata_json: dict
    created_at: datetime


class DocumentVersionSummaryResponse(BaseModel):
    id: UUID
    version_number: int
    ingestion_status: str
    parser_name: str | None
    chunk_count: int
    token_count_total: int
    created_at: datetime
    updated_at: datetime


class DocumentDetailResponse(BaseModel):
    document: DocumentResponse
    document_version_id: UUID | None
    parser_name: str | None
    version_number: int | None
    version_ingestion_status: str | None
    content_hash: str | None
    asset_file_name: str | None
    asset_content_type: str | None
    asset_file_size_bytes: int | None
    storage_bucket: str | None
    storage_key: str | None
    latest_completed_version_id: UUID | None
    latest_completed_version_number: int | None
    latest_completed_version_ingestion_status: str | None
    latest_completed_parser_name: str | None
    chunk_count: int
    token_count_total: int
    recent_versions: list[DocumentVersionSummaryResponse]
    chunks: list[DocumentChunkResponse]


class DocumentActivityEventResponse(BaseModel):
    id: str
    event_type: str
    status: str
    timestamp: datetime
    workflow_run_id: UUID | None = None
    retry_of_workflow_run_id: UUID | None = None
    document_version_id: UUID | None = None
    version_number: int | None = None
    parser_name: str | None = None
    chunk_count: int | None = None
    token_count_total: int | None = None
    error_message: str | None = None


class DocumentActivitySummaryResponse(BaseModel):
    total_events: int
    total_versions: int
    workflow_runs: int
    retry_runs: int
    failed_events: int
    latest_event_at: datetime | None


class DocumentActivityResponse(BaseModel):
    document_id: UUID
    title: str
    asset_file_name: str | None
    summary: DocumentActivitySummaryResponse
    events: list[DocumentActivityEventResponse]


class DocumentUploadResponse(BaseModel):
    document: DocumentResponse
    document_version_id: UUID
    document_asset_id: UUID
    workflow_run_id: UUID
    workflow_status: str
    temporal_workflow_id: str | None
    storage_bucket: str
    storage_key: str
    file_name: str
    content_type: str | None
    file_size_bytes: int
    content_hash: str


class DocumentWorkflowActionResponse(BaseModel):
    document: DocumentResponse
    workflow_run_id: UUID
    workflow_status: str
    temporal_workflow_id: str | None


class DocumentDeleteResponse(BaseModel):
    document_id: UUID
    deleted_at: datetime


class DocumentRestoreResponse(BaseModel):
    document: DocumentResponse
    restored_at: datetime
