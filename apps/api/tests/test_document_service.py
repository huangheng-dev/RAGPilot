from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock
from uuid import uuid4

import httpx
import pytest

from ragpilot_api.application.documents.document_service import DocumentService


@pytest.mark.anyio
async def test_get_document_detail_includes_chunk_and_token_aggregates() -> None:
    now = datetime.now(timezone.utc)
    document_id = uuid4()
    knowledge_base_id = uuid4()
    tenant_id = uuid4()
    version_id = uuid4()
    chunk_id = uuid4()

    document = SimpleNamespace(
        id=document_id,
        tenant_id=tenant_id,
        knowledge_base_id=knowledge_base_id,
        title="Operator Handbook",
        source_uri="s3://RAGPilot/operator-handbook.md",
        ingestion_status="completed",
        indexing_status="completed",
        deleted_at=None,
        created_at=now,
        updated_at=now,
    )
    chunk = SimpleNamespace(
        id=chunk_id,
        tenant_id=tenant_id,
        document_version_id=version_id,
        chunk_index=0,
        content="Grounded operations content",
        token_count=42,
        metadata_json={"section": "overview"},
        created_at=now,
    )
    repository = SimpleNamespace(
        get_document_detail=AsyncMock(
            return_value={
                "document": document,
                "document_version_id": version_id,
                "parser_name": "plain_text_parser",
                "version_number": 3,
                "version_ingestion_status": "completed",
                "content_hash": "abc123",
                "asset_file_name": "operator-handbook.md",
                "asset_content_type": "text/markdown",
                "asset_file_size_bytes": 1024,
                "storage_bucket": "ragpilot-documents",
                "storage_key": "tenants/demo/operator-handbook.md",
                "latest_completed_version_id": version_id,
                "latest_completed_version_number": 3,
                "latest_completed_version_ingestion_status": "completed",
                "latest_completed_parser_name": "plain_text_parser",
                "chunk_count": 1,
                "token_count_total": 42,
                "recent_versions": [
                    {
                        "id": version_id,
                        "version_number": 3,
                        "ingestion_status": "completed",
                        "parser_name": "plain_text_parser",
                        "chunk_count": 1,
                        "token_count_total": 42,
                        "created_at": now,
                        "updated_at": now,
                    }
                ],
                "chunks": [chunk],
            }
        )
    )

    service = DocumentService(document_repository=repository)

    detail = await service.get_document_detail(
        document_id=document_id,
        knowledge_base_id=knowledge_base_id,
        document_version_id=version_id,
    )

    assert detail is not None
    assert detail.chunk_count == 1
    assert detail.token_count_total == 42
    assert detail.recent_versions[0].token_count_total == 42
    assert detail.chunks[0].token_count == 42
    repository.get_document_detail.assert_awaited_once_with(
        document_id=document_id,
        knowledge_base_id=knowledge_base_id,
        document_version_id=version_id,
        include_deleted=False,
    )


@pytest.mark.anyio
async def test_list_documents_includes_latest_workflow_summary() -> None:
    now = datetime.now(timezone.utc)
    document_id = uuid4()
    knowledge_base_id = uuid4()
    tenant_id = uuid4()
    workflow_run_id = uuid4()

    document = SimpleNamespace(
        id=document_id,
        tenant_id=tenant_id,
        knowledge_base_id=knowledge_base_id,
        title="Policy Handbook",
        source_uri="s3://RAGPilot/policy-handbook.md",
        ingestion_status="completed",
        indexing_status="completed",
        deleted_at=None,
        created_at=now,
        updated_at=now,
    )
    repository = SimpleNamespace(
        list_documents=AsyncMock(return_value=([document], 1)),
        get_latest_version_summaries_for_documents=AsyncMock(
            return_value={
                document_id: {
                    "latest_version_number": 3,
                    "latest_version_parser_name": "plain_text_parser",
                    "latest_version_ingestion_status": "completed",
                    "latest_version_updated_at": now,
                    "latest_version_chunk_count": 4,
                    "latest_version_token_count_total": 128,
                }
            }
        ),
        get_latest_workflow_runs_for_documents=AsyncMock(
            return_value={
                document_id: {
                    "latest_workflow_run_id": workflow_run_id,
                    "latest_workflow_type": "document_ingestion",
                    "latest_workflow_status": "completed",
                    "latest_workflow_error_message": None,
                    "latest_workflow_updated_at": now,
                }
            }
        ),
    )

    service = DocumentService(document_repository=repository)

    documents, total_count = await service.list_documents(knowledge_base_id=knowledge_base_id)

    assert total_count == 1
    assert len(documents) == 1
    assert documents[0].latest_version_number == 3
    assert documents[0].latest_version_parser_name == "plain_text_parser"
    assert documents[0].latest_version_chunk_count == 4
    assert documents[0].latest_version_token_count_total == 128
    assert documents[0].latest_workflow_run_id == workflow_run_id
    assert documents[0].latest_workflow_status == "completed"
    repository.get_latest_version_summaries_for_documents.assert_awaited_once_with(document_ids=[document_id])
    repository.get_latest_workflow_runs_for_documents.assert_awaited_once_with(document_ids=[document_id])


@pytest.mark.anyio
async def test_list_documents_forwards_lifecycle_filter() -> None:
    now = datetime.now(timezone.utc)
    document_id = uuid4()
    knowledge_base_id = uuid4()
    tenant_id = uuid4()
    deleted_at = datetime.now(timezone.utc)

    document = SimpleNamespace(
        id=document_id,
        tenant_id=tenant_id,
        knowledge_base_id=knowledge_base_id,
        title="Archived Handbook",
        source_uri="s3://RAGPilot/archived-handbook.md",
        ingestion_status="completed",
        indexing_status="completed",
        deleted_at=deleted_at,
        created_at=now,
        updated_at=now,
    )
    repository = SimpleNamespace(
        list_documents=AsyncMock(return_value=([document], 1)),
        get_latest_version_summaries_for_documents=AsyncMock(return_value={}),
        get_latest_workflow_runs_for_documents=AsyncMock(return_value={}),
    )

    service = DocumentService(document_repository=repository)

    documents, total_count = await service.list_documents(
        knowledge_base_id=knowledge_base_id,
        lifecycle_filter="deleted",
    )

    assert total_count == 1
    assert documents[0].is_deleted is True
    assert documents[0].deleted_at == deleted_at
    repository.list_documents.assert_awaited_once_with(
        knowledge_base_id=knowledge_base_id,
        query=None,
        status_filter=None,
        source_kind_filter=None,
        lifecycle_filter="deleted",
        sort_order="created-desc",
        limit=100,
        offset=0,
    )


@pytest.mark.anyio
async def test_get_document_activity_returns_summary_and_events() -> None:
    now = datetime.now(timezone.utc)
    document_id = uuid4()
    knowledge_base_id = uuid4()

    repository = SimpleNamespace(
        get_document_activity=AsyncMock(
            return_value={
                "document_id": document_id,
                "title": "Policy Handbook",
                "asset_file_name": "policy-handbook.pdf",
                "summary": {
                    "total_events": 4,
                    "total_versions": 2,
                    "workflow_runs": 1,
                    "retry_runs": 0,
                    "failed_events": 1,
                    "latest_event_at": now,
                },
                "events": [
                    {
                        "id": "workflow-terminal-1",
                        "event_type": "workflow_failed",
                        "status": "failed",
                        "timestamp": now,
                        "workflow_run_id": uuid4(),
                        "retry_of_workflow_run_id": None,
                        "document_version_id": None,
                        "version_number": None,
                        "parser_name": None,
                        "chunk_count": None,
                        "token_count_total": None,
                        "error_message": "Embedding provider timeout",
                    }
                ],
            }
        )
    )

    service = DocumentService(document_repository=repository)

    activity = await service.get_document_activity(
        document_id=document_id,
        knowledge_base_id=knowledge_base_id,
    )

    assert activity is not None
    assert activity.summary.total_events == 4
    assert activity.summary.failed_events == 1
    assert activity.events[0].event_type == "workflow_failed"
    assert activity.events[0].error_message == "Embedding provider timeout"
    repository.get_document_activity.assert_awaited_once_with(
        document_id=document_id,
        knowledge_base_id=knowledge_base_id,
        include_deleted=False,
    )


@pytest.mark.anyio
async def test_restore_document_returns_restored_document_response() -> None:
    now = datetime.now(timezone.utc)
    document_id = uuid4()
    knowledge_base_id = uuid4()
    tenant_id = uuid4()
    projection_event_id = uuid4()

    restored_document = SimpleNamespace(
        id=document_id,
        tenant_id=tenant_id,
        knowledge_base_id=knowledge_base_id,
        title="RAGPilot Web Demo",
        source_uri="s3://RAGPilot/RAGPilot-web-demo.md",
        ingestion_status="completed",
        indexing_status="completed",
        deleted_at=None,
        created_at=now,
        updated_at=now,
    )
    repository = SimpleNamespace(
        restore_document=AsyncMock(return_value=(restored_document, projection_event_id)),
    )
    temporal_client = SimpleNamespace(start_search_projection_workflow=AsyncMock(return_value="search-projection-1"))

    service = DocumentService(document_repository=repository, temporal_workflow_client=temporal_client)

    response = await service.restore_document(
        document_id=document_id,
        knowledge_base_id=knowledge_base_id,
    )

    assert response.document.id == document_id
    assert response.document.is_deleted is False
    assert response.restored_at == now
    repository.restore_document.assert_awaited_once_with(
        document_id=document_id,
        knowledge_base_id=knowledge_base_id,
    )
    temporal_client.start_search_projection_workflow.assert_awaited_once_with(
        projection_event_id=str(projection_event_id)
    )


@pytest.mark.anyio
async def test_delete_document_dispatches_transactional_projection_event() -> None:
    document_id = uuid4()
    knowledge_base_id = uuid4()
    projection_event_id = uuid4()
    deleted_at = datetime.now(timezone.utc)
    repository = SimpleNamespace(
        soft_delete_document=AsyncMock(return_value=(document_id, deleted_at, projection_event_id)),
    )
    temporal_client = SimpleNamespace(start_search_projection_workflow=AsyncMock(return_value="search-projection-1"))
    service = DocumentService(document_repository=repository, temporal_workflow_client=temporal_client)

    response = await service.delete_document(document_id=document_id, knowledge_base_id=knowledge_base_id)

    assert response.document_id == document_id
    assert response.deleted_at == deleted_at
    temporal_client.start_search_projection_workflow.assert_awaited_once_with(
        projection_event_id=str(projection_event_id)
    )


@pytest.mark.anyio
async def test_delete_document_succeeds_when_temporal_dispatch_is_temporarily_unavailable() -> None:
    document_id = uuid4()
    knowledge_base_id = uuid4()
    projection_event_id = uuid4()
    deleted_at = datetime.now(timezone.utc)
    repository = SimpleNamespace(
        soft_delete_document=AsyncMock(return_value=(document_id, deleted_at, projection_event_id)),
    )
    temporal_client = SimpleNamespace(
        start_search_projection_workflow=AsyncMock(side_effect=RuntimeError("Temporal unavailable"))
    )
    service = DocumentService(document_repository=repository, temporal_workflow_client=temporal_client)

    response = await service.delete_document(document_id=document_id, knowledge_base_id=knowledge_base_id)

    assert response.document_id == document_id
    assert response.deleted_at == deleted_at


@pytest.mark.anyio
async def test_upload_document_rejects_unsupported_document_type_before_storage() -> None:
    repository = SimpleNamespace(create_uploaded_document=AsyncMock())
    storage = SimpleNamespace(store_document_object=Mock())
    service = DocumentService(
        document_repository=repository,
        document_storage=storage,
    )

    with pytest.raises(
        ValueError,
        match="Unsupported document type. RAGPilot currently accepts TXT, Markdown, HTML, CSV, JSON, PDF, DOCX, and XLSX files.",
    ):
        await service.upload_document(
            tenant_id=uuid4(),
            knowledge_base_id=uuid4(),
            title="Reference Image",
            file_name="reference.png",
            content_type="image/png",
            content=b"\x89PNG\r\n",
        )

    storage.store_document_object.assert_not_called()
    repository.create_uploaded_document.assert_not_awaited()


@pytest.mark.anyio
async def test_import_web_page_fetches_html_and_reuses_document_ingestion_chain(monkeypatch) -> None:
    now = datetime.now(timezone.utc)
    tenant_id = uuid4()
    knowledge_base_id = uuid4()
    document_id = uuid4()
    document_version_id = uuid4()
    document_asset_id = uuid4()
    workflow_run_id = uuid4()
    captured_storage: dict[str, object] = {}

    class FakeAsyncClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return None

        async def get(self, url, headers):
            return httpx.Response(
                200,
                headers={"content-type": "text/html; charset=utf-8"},
                content=b"<html><head><title>Operations Handbook</title></head><body><main>Grounded ops</main></body></html>",
                request=httpx.Request("GET", url),
            )

    monkeypatch.setattr("ragpilot_api.application.documents.document_service.httpx.AsyncClient", lambda *args, **kwargs: FakeAsyncClient())

    storage = SimpleNamespace(
        store_document_object=Mock(
            side_effect=lambda *, storage_key, file_name, content_type, content: captured_storage.update(
                {
                    "storage_key": storage_key,
                    "file_name": file_name,
                    "content_type": content_type,
                    "content": content,
                }
            )
            or SimpleNamespace(
                storage_bucket="ragpilot-documents",
                storage_key=storage_key,
                file_name=file_name,
                content_type=content_type,
                file_size_bytes=len(content),
            )
        )
    )
    repository = SimpleNamespace(
        create_uploaded_document=AsyncMock(
            return_value=(
                SimpleNamespace(
                    id=document_id,
                    tenant_id=tenant_id,
                    knowledge_base_id=knowledge_base_id,
                    title="Operations Handbook",
                    source_uri="https://docs.example.com/ops",
                    ingestion_status="pending",
                    indexing_status="pending",
                    deleted_at=None,
                    created_at=now,
                    updated_at=now,
                ),
                SimpleNamespace(
                    id=document_version_id,
                    version_number=1,
                    parser_name=None,
                    ingestion_status="pending",
                    content_hash="hash",
                    updated_at=now,
                ),
                SimpleNamespace(
                    id=document_asset_id,
                    storage_bucket="ragpilot-documents",
                    storage_key="tenants/demo/imports/operations-handbook.html",
                    file_name="operations-handbook.html",
                    content_type="text/html",
                    file_size_bytes=96,
                ),
                SimpleNamespace(
                    id=workflow_run_id,
                    workflow_type="document_ingestion",
                    workflow_status="pending",
                    error_message=None,
                    temporal_workflow_id=None,
                    updated_at=now,
                ),
            )
        ),
        session=None,
    )
    workflow_repository = SimpleNamespace(
        mark_workflow_run_queued=AsyncMock(
            side_effect=lambda *, workflow_run, temporal_workflow_id: SimpleNamespace(
                **{
                    **workflow_run.__dict__,
                    "workflow_status": "queued",
                    "temporal_workflow_id": temporal_workflow_id,
                }
            )
        ),
        mark_workflow_run_failed=AsyncMock(),
    )
    temporal_client = SimpleNamespace(start_document_ingestion_workflow=AsyncMock(return_value="document-ingestion-demo"))

    service = DocumentService(
        document_repository=repository,
        workflow_repository=workflow_repository,
        document_storage=storage,
        temporal_workflow_client=temporal_client,
    )

    response = await service.import_web_page(
        SimpleNamespace(
            tenant_id=tenant_id,
            knowledge_base_id=knowledge_base_id,
            source_url="https://docs.example.com/ops",
            title=None,
        )
    )

    assert response.document.title == "Operations Handbook"
    assert response.document.source_uri == "https://docs.example.com/ops"
    assert response.file_name == "operations-handbook.html"
    assert response.workflow_status == "queued"
    assert response.temporal_workflow_id == "document-ingestion-demo"
    assert captured_storage["content_type"] == "text/html"
    assert captured_storage["file_name"] == "operations-handbook.html"
    repository.create_uploaded_document.assert_awaited_once()
    temporal_client.start_document_ingestion_workflow.assert_awaited_once()


@pytest.mark.anyio
async def test_import_web_page_rejects_non_http_urls() -> None:
    service = DocumentService(document_repository=SimpleNamespace())

    with pytest.raises(ValueError, match="Web import only accepts absolute http or https URLs."):
        await service.import_web_page(
            SimpleNamespace(
                tenant_id=uuid4(),
                knowledge_base_id=uuid4(),
                source_url="file:///tmp/demo.html",
                title=None,
            )
        )
