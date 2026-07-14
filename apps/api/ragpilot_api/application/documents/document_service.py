import hashlib
import re
import uuid
from datetime import datetime, timezone
from html import unescape
from urllib.parse import urlparse
from uuid import UUID

import httpx

from ragpilot_api.contracts.http.document_contracts import (
    DocumentActivityEventResponse,
    DocumentActivityResponse,
    DocumentActivitySummaryResponse,
    DocumentChunkResponse,
    DocumentCreateRequest,
    DocumentDeleteResponse,
    DocumentDetailResponse,
    DocumentMetricsResponse,
    DocumentPermanentDeleteResponse,
    DocumentResponse,
    DocumentRestoreResponse,
    DocumentUploadResponse,
    DocumentVersionSummaryResponse,
    DocumentWorkflowActionResponse,
    WebPageImportRequest,
)
from ragpilot_api.application.errors import ResourceConflictError, ResourceNotFoundError
from ragpilot_api.infrastructure.database.models import Document, DocumentChunk
from ragpilot_api.infrastructure.database.repositories.document_repository import DocumentRepository
from ragpilot_api.infrastructure.database.repositories.workflow_repository import WorkflowRepository
from ragpilot_api.infrastructure.object_storage.document_storage import DocumentStorage
from ragpilot_api.infrastructure.workflows.temporal_client import TemporalWorkflowClient


SUPPORTED_DOCUMENT_EXTENSIONS = {
    ".txt",
    ".md",
    ".markdown",
    ".html",
    ".htm",
    ".csv",
    ".json",
    ".pdf",
    ".docx",
    ".xlsx",
}
SUPPORTED_DOCUMENT_CONTENT_TYPES = {
    "text/plain",
    "text/markdown",
    "text/html",
    "application/xhtml+xml",
    "text/csv",
    "application/csv",
    "application/json",
    "text/json",
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}
SUPPORTED_DOCUMENT_TYPES_LABEL = "TXT, Markdown, HTML, CSV, JSON, PDF, DOCX, and XLSX"
SUPPORTED_WEB_IMPORT_CONTENT_TYPES = {
    "text/html",
    "application/xhtml+xml",
    "text/plain",
}
WEB_IMPORT_MAX_BYTES = 5 * 1024 * 1024


class DocumentService:
    def __init__(
        self,
        document_repository: DocumentRepository,
        workflow_repository: WorkflowRepository | None = None,
        document_storage: DocumentStorage | None = None,
        temporal_workflow_client: TemporalWorkflowClient | None = None,
    ) -> None:
        self.document_repository = document_repository
        self.workflow_repository = workflow_repository
        self.document_storage = document_storage
        self.temporal_workflow_client = temporal_workflow_client

    async def create_document(self, request: DocumentCreateRequest) -> DocumentResponse:
        document = await self.document_repository.create_document(
            tenant_id=request.tenant_id,
            knowledge_base_id=request.knowledge_base_id,
            title=request.title,
            source_uri=request.source_uri,
        )
        return build_document_response(document)

    async def import_web_page(self, request: WebPageImportRequest) -> DocumentUploadResponse:
        normalized_url = validate_web_import_url(request.source_url)
        fetched_page = await fetch_web_page(normalized_url)
        derived_title = request.title.strip() if request.title else extract_web_page_title(fetched_page.text)
        document_title = derived_title or build_web_import_title_from_url(fetched_page.source_url)
        file_name = build_web_import_file_name(
            source_url=fetched_page.source_url,
            title=document_title,
            content_type=fetched_page.content_type,
        )
        return await self._store_document_ingestion_asset(
            tenant_id=request.tenant_id,
            knowledge_base_id=request.knowledge_base_id,
            title=document_title,
            file_name=file_name,
            content_type=fetched_page.content_type,
            content=fetched_page.content,
            source_uri=fetched_page.source_url,
        )

    async def list_documents(
        self,
        *,
        knowledge_base_id: UUID,
        query: str | None = None,
        status_filter: str | None = None,
        source_kind_filter: str | None = None,
        lifecycle_filter: str = "active",
        sort_order: str = "created-desc",
        limit: int = 100,
        offset: int = 0,
    ) -> tuple[list[DocumentResponse], int]:
        documents, total_count = await self.document_repository.list_documents(
            knowledge_base_id=knowledge_base_id,
            query=query,
            status_filter=status_filter,
            source_kind_filter=source_kind_filter,
            lifecycle_filter=lifecycle_filter,
            sort_order=sort_order,
            limit=limit,
            offset=offset,
        )
        latest_version_summaries = await self.document_repository.get_latest_version_summaries_for_documents(
            document_ids=[document.id for document in documents]
        )
        latest_workflow_runs = await self.document_repository.get_latest_workflow_runs_for_documents(
            document_ids=[document.id for document in documents]
        )
        return [
            build_document_response(
                document,
                latest_version_summary=latest_version_summaries.get(document.id),
                latest_workflow_summary=latest_workflow_runs.get(document.id),
            )
            for document in documents
        ], total_count

    async def get_document_metrics(self, *, knowledge_base_id: UUID) -> DocumentMetricsResponse:
        metrics = await self.document_repository.get_document_metrics(knowledge_base_id=knowledge_base_id)
        return DocumentMetricsResponse(**metrics)

    async def get_document_detail(
        self,
        *,
        document_id: UUID,
        knowledge_base_id: UUID,
        document_version_id: UUID | None = None,
        include_deleted: bool = False,
    ) -> DocumentDetailResponse | None:
        detail = await self.document_repository.get_document_detail(
            document_id=document_id,
            knowledge_base_id=knowledge_base_id,
            document_version_id=document_version_id,
            include_deleted=include_deleted,
        )
        if detail is None:
            return None

        return DocumentDetailResponse(
            document=build_document_response(detail["document"]),
            document_version_id=detail["document_version_id"],
            parser_name=detail["parser_name"],
            version_number=detail["version_number"],
            version_ingestion_status=detail["version_ingestion_status"],
            content_hash=detail["content_hash"],
            asset_file_name=detail["asset_file_name"],
            asset_content_type=detail["asset_content_type"],
            asset_file_size_bytes=detail["asset_file_size_bytes"],
            storage_bucket=detail["storage_bucket"],
            storage_key=detail["storage_key"],
            latest_completed_version_id=detail["latest_completed_version_id"],
            latest_completed_version_number=detail["latest_completed_version_number"],
            latest_completed_version_ingestion_status=detail["latest_completed_version_ingestion_status"],
            latest_completed_parser_name=detail["latest_completed_parser_name"],
            chunk_count=detail["chunk_count"],
            token_count_total=detail["token_count_total"],
            recent_versions=[
                DocumentVersionSummaryResponse(**version_summary) for version_summary in detail["recent_versions"]
            ],
            chunks=[build_document_chunk_response(chunk) for chunk in detail["chunks"]],
        )

    async def get_document_activity(
        self,
        *,
        document_id: UUID,
        knowledge_base_id: UUID,
        include_deleted: bool = False,
    ) -> DocumentActivityResponse | None:
        activity = await self.document_repository.get_document_activity(
            document_id=document_id,
            knowledge_base_id=knowledge_base_id,
            include_deleted=include_deleted,
        )
        if activity is None:
            return None

        return DocumentActivityResponse(
            document_id=activity["document_id"],
            title=activity["title"],
            asset_file_name=activity["asset_file_name"],
            summary=DocumentActivitySummaryResponse(**activity["summary"]),
            events=[DocumentActivityEventResponse(**event) for event in activity["events"]],
        )

    async def upload_document(
        self,
        *,
        tenant_id: UUID,
        knowledge_base_id: UUID,
        title: str,
        file_name: str,
        content_type: str | None,
        content: bytes,
    ) -> DocumentUploadResponse:
        validate_supported_document_type(file_name=file_name, content_type=content_type)
        return await self._store_document_ingestion_asset(
            tenant_id=tenant_id,
            knowledge_base_id=knowledge_base_id,
            title=title,
            file_name=file_name,
            content_type=content_type,
            content=content,
            source_uri=None,
        )

    async def _store_document_ingestion_asset(
        self,
        *,
        tenant_id: UUID,
        knowledge_base_id: UUID,
        title: str,
        file_name: str,
        content_type: str | None,
        content: bytes,
        source_uri: str | None,
    ) -> DocumentUploadResponse:
        storage = self.document_storage or DocumentStorage()
        content_hash = hashlib.sha256(content).hexdigest()
        safe_file_name = build_safe_file_name(file_name)
        storage_key = (
            f"tenants/{tenant_id}/knowledge-bases/{knowledge_base_id}/"
            f"documents/{uuid.uuid4()}/{safe_file_name}"
        )
        stored_object = storage.store_document_object(
            storage_key=storage_key,
            file_name=file_name,
            content_type=content_type,
            content=content,
        )

        document, document_version, document_asset, workflow_run = await self.document_repository.create_uploaded_document(
            tenant_id=tenant_id,
            knowledge_base_id=knowledge_base_id,
            title=title,
            source_uri=source_uri or f"s3://{stored_object.storage_bucket}/{stored_object.storage_key}",
            content_hash=content_hash,
            storage_bucket=stored_object.storage_bucket,
            storage_key=stored_object.storage_key,
            file_name=stored_object.file_name,
            content_type=stored_object.content_type,
            file_size_bytes=stored_object.file_size_bytes,
        )

        workflow_repository = self.workflow_repository or WorkflowRepository(self.document_repository.session)
        temporal_workflow_client = self.temporal_workflow_client or TemporalWorkflowClient()

        try:
            temporal_workflow_id = await temporal_workflow_client.start_document_ingestion_workflow(
                workflow_run_id=str(workflow_run.id),
                document_id=str(document.id),
            )
            workflow_run = await workflow_repository.mark_workflow_run_queued(
                workflow_run=workflow_run,
                temporal_workflow_id=temporal_workflow_id,
            )
        except Exception as error:
            workflow_run = await workflow_repository.mark_workflow_run_failed(
                workflow_run=workflow_run,
                error_message=str(error),
            )

        return DocumentUploadResponse(
            document=build_document_response(
                document,
                latest_version_summary={
                    "latest_version_number": document_version.version_number,
                    "latest_version_parser_name": document_version.parser_name,
                    "latest_version_ingestion_status": document_version.ingestion_status,
                    "latest_version_updated_at": document_version.updated_at,
                    "latest_version_chunk_count": 0,
                    "latest_version_token_count_total": 0,
                },
                latest_workflow_summary={
                    "latest_workflow_run_id": workflow_run.id,
                    "latest_workflow_type": workflow_run.workflow_type,
                    "latest_workflow_status": workflow_run.workflow_status,
                    "latest_workflow_error_message": workflow_run.error_message,
                    "latest_workflow_updated_at": workflow_run.updated_at,
                },
            ),
            document_version_id=document_version.id,
            document_asset_id=document_asset.id,
            workflow_run_id=workflow_run.id,
            workflow_status=workflow_run.workflow_status,
            temporal_workflow_id=workflow_run.temporal_workflow_id,
            storage_bucket=document_asset.storage_bucket,
            storage_key=document_asset.storage_key,
            file_name=document_asset.file_name,
            content_type=document_asset.content_type,
            file_size_bytes=document_asset.file_size_bytes,
            content_hash=document_version.content_hash,
        )

    async def reindex_document(
        self,
        *,
        document_id: UUID,
        knowledge_base_id: UUID,
    ) -> DocumentWorkflowActionResponse:
        reindex_result = await self.document_repository.create_reindex_workflow_run(
            document_id=document_id,
            knowledge_base_id=knowledge_base_id,
        )
        if reindex_result is None:
            raise ResourceNotFoundError("Document not found.")

        document, document_version, workflow_run = reindex_result
        workflow_repository = self.workflow_repository or WorkflowRepository(self.document_repository.session)
        temporal_workflow_client = self.temporal_workflow_client or TemporalWorkflowClient()

        try:
            temporal_workflow_id = await temporal_workflow_client.start_document_ingestion_workflow(
                workflow_run_id=str(workflow_run.id),
                document_id=str(document.id),
            )
            workflow_run = await workflow_repository.mark_workflow_run_queued(
                workflow_run=workflow_run,
                temporal_workflow_id=temporal_workflow_id,
            )
        except Exception as error:
            workflow_run = await workflow_repository.mark_workflow_run_failed(
                workflow_run=workflow_run,
                error_message=str(error),
            )

        refreshed_document = await self.document_repository.get_document(
            document_id=document.id,
            knowledge_base_id=knowledge_base_id,
        )
        if refreshed_document is None:
            raise ResourceNotFoundError("Document not found.")

        return DocumentWorkflowActionResponse(
            document=build_document_response(
                refreshed_document,
                latest_version_summary={
                    "latest_version_number": document_version.version_number,
                    "latest_version_parser_name": document_version.parser_name,
                    "latest_version_ingestion_status": document_version.ingestion_status,
                    "latest_version_updated_at": document_version.updated_at,
                    "latest_version_chunk_count": 0,
                    "latest_version_token_count_total": 0,
                },
                latest_workflow_summary={
                    "latest_workflow_run_id": workflow_run.id,
                    "latest_workflow_type": workflow_run.workflow_type,
                    "latest_workflow_status": workflow_run.workflow_status,
                    "latest_workflow_error_message": workflow_run.error_message,
                    "latest_workflow_updated_at": workflow_run.updated_at,
                },
            ),
            workflow_run_id=workflow_run.id,
            workflow_status=workflow_run.workflow_status,
            temporal_workflow_id=workflow_run.temporal_workflow_id,
        )

    async def delete_document(
        self,
        *,
        document_id: UUID,
        knowledge_base_id: UUID,
    ) -> DocumentDeleteResponse:
        deleted_document = await self.document_repository.soft_delete_document(
            document_id=document_id,
            knowledge_base_id=knowledge_base_id,
        )
        if deleted_document is None:
            raise ResourceNotFoundError("Document not found.")

        deleted_document_id, deleted_at, projection_event_id = deleted_document
        await self._dispatch_search_projection_event(projection_event_id)
        return DocumentDeleteResponse(document_id=deleted_document_id, deleted_at=deleted_at)

    async def restore_document(
        self,
        *,
        document_id: UUID,
        knowledge_base_id: UUID,
    ) -> DocumentRestoreResponse:
        restore_result = await self.document_repository.restore_document(
            document_id=document_id,
            knowledge_base_id=knowledge_base_id,
        )
        if restore_result is None:
            raise ResourceNotFoundError("Document not found.")
        restored_document, projection_event_id = restore_result
        if projection_event_id is not None:
            await self._dispatch_search_projection_event(projection_event_id)

        return DocumentRestoreResponse(
            document=build_document_response(restored_document),
            restored_at=restored_document.updated_at,
        )

    async def permanently_delete_document(
        self,
        *,
        document_id: UUID,
        knowledge_base_id: UUID,
        confirmation_title: str,
    ) -> DocumentPermanentDeleteResponse:
        candidate = await self.document_repository.get_permanent_delete_candidate(
            document_id=document_id,
            knowledge_base_id=knowledge_base_id,
        )
        if candidate is None:
            raise ResourceNotFoundError("Deleted document not found.")
        document = candidate["document"]
        if confirmation_title.strip() != document.title:
            raise ResourceConflictError("Document title confirmation does not match.")
        if candidate["citation_count"] > 0:
            raise ResourceConflictError("Document cannot be permanently deleted while answer citations still reference it.")
        storage = self.document_storage or DocumentStorage()
        for storage_bucket, storage_key in candidate["assets"]:
            storage.delete_document_object(storage_bucket=storage_bucket, storage_key=storage_key)
        projection_event_id = await self.document_repository.permanently_delete_document(document_id=document.id)
        await self._dispatch_search_projection_event(projection_event_id)
        return DocumentPermanentDeleteResponse(
            document_id=document.id,
            permanently_deleted_at=datetime.now(timezone.utc),
        )

    async def _dispatch_search_projection_event(self, projection_event_id: UUID) -> None:
        temporal_workflow_client = self.temporal_workflow_client or TemporalWorkflowClient()
        try:
            await temporal_workflow_client.start_search_projection_workflow(
                projection_event_id=str(projection_event_id),
            )
        except Exception:
            # The transactional Outbox event remains pending and can be reconciled
            # after Temporal connectivity returns. Document lifecycle writes must
            # not be rolled back because an external dispatcher is unavailable.
            return


def build_document_response(
    document: Document,
    latest_version_summary: dict | None = None,
    latest_workflow_summary: dict | None = None,
) -> DocumentResponse:
    latest_version_summary = latest_version_summary or {}
    latest_workflow_summary = latest_workflow_summary or {}
    return DocumentResponse(
        id=document.id,
        tenant_id=document.tenant_id,
        knowledge_base_id=document.knowledge_base_id,
        title=document.title,
        source_uri=document.source_uri,
        source_kind=detect_document_source_kind(document.source_uri),
        ingestion_status=document.ingestion_status,
        indexing_status=document.indexing_status,
        latest_version_number=latest_version_summary.get("latest_version_number"),
        latest_version_parser_name=latest_version_summary.get("latest_version_parser_name"),
        latest_version_ingestion_status=latest_version_summary.get("latest_version_ingestion_status"),
        latest_version_chunk_count=latest_version_summary.get("latest_version_chunk_count"),
        latest_version_token_count_total=latest_version_summary.get("latest_version_token_count_total"),
        latest_version_updated_at=latest_version_summary.get("latest_version_updated_at"),
        latest_workflow_run_id=latest_workflow_summary.get("latest_workflow_run_id"),
        latest_workflow_type=latest_workflow_summary.get("latest_workflow_type"),
        latest_workflow_status=latest_workflow_summary.get("latest_workflow_status"),
        latest_workflow_error_message=latest_workflow_summary.get("latest_workflow_error_message"),
        latest_workflow_updated_at=latest_workflow_summary.get("latest_workflow_updated_at"),
        deleted_at=document.deleted_at,
        is_deleted=document.deleted_at is not None,
        created_at=document.created_at,
        updated_at=document.updated_at,
    )


def build_document_chunk_response(chunk: DocumentChunk) -> DocumentChunkResponse:
    return DocumentChunkResponse(
        id=chunk.id,
        tenant_id=chunk.tenant_id,
        document_version_id=chunk.document_version_id,
        chunk_index=chunk.chunk_index,
        content=chunk.content,
        token_count=chunk.token_count,
        metadata_json=chunk.metadata_json,
        created_at=chunk.created_at,
    )


def build_safe_file_name(file_name: str) -> str:
    cleaned_name = re.sub(r"[^A-Za-z0-9._-]+", "-", file_name).strip("-")
    return cleaned_name or "document"


def validate_supported_document_type(*, file_name: str, content_type: str | None) -> None:
    lower_name = file_name.lower()
    normalized_content_type = normalize_content_type(content_type)

    if any(lower_name.endswith(extension) for extension in SUPPORTED_DOCUMENT_EXTENSIONS):
        return
    if normalized_content_type in SUPPORTED_DOCUMENT_CONTENT_TYPES:
        return

    raise ValueError(
        f"Unsupported document type. RAGPilot currently accepts {SUPPORTED_DOCUMENT_TYPES_LABEL} files."
    )


def normalize_content_type(content_type: str | None) -> str | None:
    if not content_type:
        return None
    return content_type.split(";", 1)[0].strip().lower() or None


def detect_document_source_kind(source_uri: str | None) -> str:
    normalized_source_uri = (source_uri or "").strip().lower()
    if normalized_source_uri.startswith("http://") or normalized_source_uri.startswith("https://"):
        return "web"
    if normalized_source_uri:
        return "file"
    return "other"


class FetchedWebPage:
    def __init__(self, *, source_url: str, content_type: str | None, content: bytes, text: str) -> None:
        self.source_url = source_url
        self.content_type = content_type
        self.content = content
        self.text = text


def validate_web_import_url(source_url: str) -> str:
    normalized_url = source_url.strip()
    parsed_url = urlparse(normalized_url)
    if parsed_url.scheme not in {"http", "https"} or not parsed_url.netloc:
        raise ValueError("Web import only accepts absolute http or https URLs.")
    return normalized_url


async def fetch_web_page(source_url: str) -> FetchedWebPage:
    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            response = await client.get(
                source_url,
                headers={"Accept": "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.1"},
            )
            response.raise_for_status()
    except httpx.HTTPError as error:
        raise ValueError(f"Unable to fetch web page content from {source_url}.") from error

    normalized_content_type = normalize_content_type(response.headers.get("content-type"))
    if normalized_content_type not in SUPPORTED_WEB_IMPORT_CONTENT_TYPES:
        raise ValueError("Web import currently accepts only single-page HTML or plain-text content.")
    if not response.content:
        raise ValueError("The requested web page returned empty content.")
    if len(response.content) > WEB_IMPORT_MAX_BYTES:
        raise ValueError("The requested web page is too large to import into RAGPilot.")

    return FetchedWebPage(
        source_url=str(response.url),
        content_type=normalized_content_type,
        content=response.content,
        text=response.text,
    )


def extract_web_page_title(content: str) -> str | None:
    match = re.search(r"<title[^>]*>(.*?)</title>", content, flags=re.IGNORECASE | re.DOTALL)
    if not match:
        return None
    normalized_title = re.sub(r"\s+", " ", unescape(match.group(1))).strip()
    return normalized_title or None


def build_web_import_title_from_url(source_url: str) -> str:
    parsed_url = urlparse(source_url)
    path_tail = parsed_url.path.rstrip("/").split("/")[-1].strip()
    if path_tail:
        return path_tail
    return parsed_url.netloc


def build_web_import_file_name(*, source_url: str, title: str, content_type: str | None) -> str:
    parsed_url = urlparse(source_url)
    raw_name = title.strip() or parsed_url.netloc or "web-page"
    safe_name = (build_safe_file_name(raw_name).rstrip(".") or "web-page").lower()
    if content_type == "text/plain":
        if safe_name.lower().endswith(".txt"):
            return safe_name
        return f"{safe_name}.txt"
    if safe_name.lower().endswith(".html") or safe_name.lower().endswith(".htm"):
        return safe_name
    return f"{safe_name}.html"
