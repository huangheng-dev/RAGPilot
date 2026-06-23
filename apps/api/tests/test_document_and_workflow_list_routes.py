from datetime import datetime, timezone
from uuid import uuid4

from fastapi.testclient import TestClient

from ragpilot_api.main import app
from ragpilot_api.presentation.http.v1 import document_routes, workflow_routes
from ragpilot_api.infrastructure.database.session import get_database_session


async def override_database_session():
    yield None


def test_document_list_route_exposes_filtering_and_paging_headers(monkeypatch) -> None:
    captured: dict[str, object] = {}

    class FakeDocumentService:
        async def list_documents(
            self,
            *,
            knowledge_base_id,
            query,
            status_filter,
            lifecycle_filter,
            sort_order,
            limit,
            offset,
        ):
            captured.update(
                {
                    "knowledge_base_id": knowledge_base_id,
                    "query": query,
                    "status_filter": status_filter,
                    "lifecycle_filter": lifecycle_filter,
                    "sort_order": sort_order,
                    "limit": limit,
                    "offset": offset,
                }
            )
            return (
                [
                    {
                        "id": str(uuid4()),
                        "tenant_id": str(uuid4()),
                        "knowledge_base_id": str(knowledge_base_id),
                        "title": "Policy Handbook",
                        "source_uri": "s3://ragpilot/sample.md",
                        "ingestion_status": "completed",
                        "indexing_status": "completed",
                        "latest_version_number": 3,
                        "latest_version_parser_name": "plain_text_parser",
                        "latest_version_ingestion_status": "completed",
                        "latest_version_chunk_count": 4,
                        "latest_version_token_count_total": 128,
                        "latest_version_updated_at": datetime.now(timezone.utc).isoformat(),
                        "latest_workflow_run_id": str(uuid4()),
                        "latest_workflow_type": "document_ingestion",
                        "latest_workflow_status": "completed",
                        "latest_workflow_error_message": None,
                        "latest_workflow_updated_at": datetime.now(timezone.utc).isoformat(),
                        "created_at": datetime.now(timezone.utc).isoformat(),
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                    }
                ],
                7,
            )

    monkeypatch.setattr(document_routes, "build_document_service", lambda session: FakeDocumentService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.get(
        "/api/v1/documents",
        headers={"X-RagPilot-Role": "reviewer"},
        params={
            "knowledge_base_id": str(uuid4()),
            "query": "policy",
            "status": "completed",
            "lifecycle": "deleted",
            "sort": "updated-desc",
            "limit": 2,
            "offset": 4,
        },
    )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.headers["X-Total-Count"] == "7"
    assert response.headers["X-Limit"] == "2"
    assert response.headers["X-Offset"] == "4"
    assert response.headers["X-Result-Count"] == "1"
    assert captured["query"] == "policy"
    assert captured["status_filter"] == "completed"
    assert captured["lifecycle_filter"] == "deleted"
    assert captured["sort_order"] == "updated-desc"
    assert captured["limit"] == 2
    assert captured["offset"] == 4


def test_workflow_list_route_exposes_filtering_and_paging_headers(monkeypatch) -> None:
    captured: dict[str, object] = {}

    class FakeWorkflowService:
        async def list_workflow_runs(
            self,
            *,
            tenant_id,
            query,
            status_filter,
            workflow_type,
            retry_mode,
            subject_id,
            sort_order,
            limit,
            offset,
        ):
            captured.update(
                {
                    "tenant_id": tenant_id,
                    "query": query,
                    "status_filter": status_filter,
                    "workflow_type": workflow_type,
                    "retry_mode": retry_mode,
                    "subject_id": subject_id,
                    "sort_order": sort_order,
                    "limit": limit,
                    "offset": offset,
                }
            )
            return (
                [
                    {
                        "id": str(uuid4()),
                        "tenant_id": str(tenant_id),
                        "workflow_type": "document_ingestion",
                        "workflow_status": "queued",
                        "retry_of_workflow_run_id": None,
                        "temporal_workflow_id": "ragpilot-workflow-1",
                        "subject_type": "document",
                        "subject_id": str(uuid4()),
                        "subject_label": "Policy Handbook",
                        "subject_workspace_id": str(uuid4()),
                        "subject_knowledge_base_id": str(uuid4()),
                        "error_message": None,
                        "is_retry_available": False,
                        "retry_unavailable_reason": None,
                        "started_at": datetime.now(timezone.utc).isoformat(),
                        "completed_at": None,
                        "created_at": datetime.now(timezone.utc).isoformat(),
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                    }
                ],
                3,
            )

    monkeypatch.setattr(workflow_routes, "build_workflow_service", lambda session: FakeWorkflowService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.get(
        "/api/v1/workflow-runs",
        headers={"X-RagPilot-Role": "reviewer"},
        params={
            "tenant_id": str(uuid4()),
            "query": "document_ingestion",
            "status": "queued",
            "workflow_type": "document_ingestion",
            "retry_mode": "retries",
            "subject_id": str(uuid4()),
            "sort": "updated-desc",
            "limit": 5,
            "offset": 0,
        },
    )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.headers["X-Total-Count"] == "3"
    assert response.headers["X-Limit"] == "5"
    assert response.headers["X-Offset"] == "0"
    assert response.headers["X-Result-Count"] == "1"
    assert captured["query"] == "document_ingestion"
    assert captured["status_filter"] == "queued"
    assert captured["workflow_type"] == "document_ingestion"
    assert captured["retry_mode"] == "retries"
    assert captured["subject_id"] is not None
    assert captured["sort_order"] == "updated-desc"
    assert captured["limit"] == 5
    assert captured["offset"] == 0


def test_document_metrics_route_returns_service_summary(monkeypatch) -> None:
    class FakeDocumentService:
        async def get_document_metrics(self, *, knowledge_base_id):
            return {
                "total_documents": 12,
                "completed_documents": 8,
                "active_documents": 3,
                "failed_documents": 1,
            }

    monkeypatch.setattr(document_routes, "build_document_service", lambda session: FakeDocumentService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.get(
        "/api/v1/documents/metrics",
        params={"knowledge_base_id": str(uuid4())},
        headers={"X-RagPilot-Role": "reviewer"},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json() == {
        "total_documents": 12,
        "completed_documents": 8,
        "active_documents": 3,
        "failed_documents": 1,
    }


def test_document_metrics_route_requires_document_access(monkeypatch) -> None:
    class FakeDocumentService:
        async def get_document_metrics(self, *, knowledge_base_id):
            raise AssertionError("get_document_metrics should not run without document access.")

    monkeypatch.setattr(document_routes, "build_document_service", lambda session: FakeDocumentService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.get("/api/v1/documents/metrics", params={"knowledge_base_id": str(uuid4())})

    app.dependency_overrides.clear()

    assert response.status_code == 401


def test_document_upload_route_returns_400_for_unsupported_document_types(monkeypatch) -> None:
    class FakeDocumentService:
        async def upload_document(self, *, tenant_id, knowledge_base_id, title, file_name, content_type, content):
            raise ValueError("Unsupported document type. RagPilot currently accepts TXT, Markdown, HTML, CSV, JSON, PDF, DOCX, and XLSX files.")

    monkeypatch.setattr(document_routes, "build_document_service", lambda session: FakeDocumentService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.post(
        "/api/v1/documents/upload",
        data={
            "tenant_id": str(uuid4()),
            "knowledge_base_id": str(uuid4()),
            "title": "Reference Image",
        },
        files={"file": ("reference.png", b"\x89PNG\r\n", "image/png")},
        headers={"X-RagPilot-Role": "operator"},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 400
    assert response.json() == {
        "detail": "Unsupported document type. RagPilot currently accepts TXT, Markdown, HTML, CSV, JSON, PDF, DOCX, and XLSX files."
    }


def test_document_detail_route_forwards_document_version_scope(monkeypatch) -> None:
    captured: dict[str, object] = {}
    document_id = uuid4()
    knowledge_base_id = uuid4()
    document_version_id = uuid4()

    class FakeDocumentService:
        async def get_document_detail(self, *, document_id, knowledge_base_id, document_version_id, include_deleted):
            captured.update(
                {
                    "document_id": document_id,
                    "knowledge_base_id": knowledge_base_id,
                    "document_version_id": document_version_id,
                    "include_deleted": include_deleted,
                }
            )
            now = datetime.now(timezone.utc).isoformat()
            return {
                "document": {
                    "id": str(document_id),
                    "tenant_id": str(uuid4()),
                    "knowledge_base_id": str(knowledge_base_id),
                    "title": "Policy Handbook",
                    "source_uri": "s3://ragpilot/sample.md",
                    "ingestion_status": "completed",
                    "indexing_status": "completed",
                    "latest_version_number": 3,
                    "latest_version_parser_name": "plain_text_parser",
                    "latest_version_ingestion_status": "completed",
                    "latest_version_chunk_count": 4,
                    "latest_version_token_count_total": 128,
                    "latest_version_updated_at": now,
                    "latest_workflow_run_id": str(uuid4()),
                    "latest_workflow_type": "document_ingestion",
                    "latest_workflow_status": "completed",
                    "latest_workflow_error_message": None,
                    "latest_workflow_updated_at": now,
                    "deleted_at": None,
                    "is_deleted": False,
                    "created_at": now,
                    "updated_at": now,
                },
                "document_version_id": str(document_version_id),
                "parser_name": "plain_text_parser",
                "version_number": 2,
                "version_ingestion_status": "completed",
                "content_hash": "abc123",
                "asset_file_name": "policy.md",
                "asset_content_type": "text/markdown",
                "asset_file_size_bytes": 512,
                "storage_bucket": "ragpilot-documents",
                "storage_key": "tenants/demo/policy.md",
                "latest_completed_version_id": str(document_version_id),
                "latest_completed_version_number": 2,
                "latest_completed_version_ingestion_status": "completed",
                "latest_completed_parser_name": "plain_text_parser",
                "chunk_count": 1,
                "token_count_total": 24,
                "recent_versions": [
                    {
                        "id": str(document_version_id),
                        "version_number": 2,
                        "ingestion_status": "completed",
                        "parser_name": "plain_text_parser",
                        "chunk_count": 1,
                        "token_count_total": 24,
                        "created_at": now,
                        "updated_at": now,
                    }
                ],
                "chunks": [
                    {
                        "id": str(uuid4()),
                        "tenant_id": str(uuid4()),
                        "document_version_id": str(document_version_id),
                        "chunk_index": 0,
                        "content": "Grounded operations content",
                        "token_count": 24,
                        "metadata_json": {},
                        "created_at": now,
                    }
                ],
            }

    monkeypatch.setattr(document_routes, "build_document_service", lambda session: FakeDocumentService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.get(
        f"/api/v1/documents/{document_id}",
        headers={"X-RagPilot-Role": "reviewer"},
        params={
            "knowledge_base_id": str(knowledge_base_id),
            "document_version_id": str(document_version_id),
            "include_deleted": "true",
        },
    )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert captured == {
        "document_id": document_id,
        "knowledge_base_id": knowledge_base_id,
        "document_version_id": document_version_id,
        "include_deleted": True,
    }
    assert response.json()["document_version_id"] == str(document_version_id)


def test_document_activity_route_returns_aggregated_activity(monkeypatch) -> None:
    captured: dict[str, object] = {}
    document_id = uuid4()
    knowledge_base_id = uuid4()
    workflow_run_id = uuid4()
    now = datetime.now(timezone.utc).isoformat()

    class FakeDocumentService:
        async def get_document_activity(self, *, document_id, knowledge_base_id, include_deleted):
            captured.update(
                {
                    "document_id": document_id,
                    "knowledge_base_id": knowledge_base_id,
                    "include_deleted": include_deleted,
                }
            )
            return {
                "document_id": str(document_id),
                "title": "Policy Handbook",
                "asset_file_name": "policy-handbook.pdf",
                "summary": {
                    "total_events": 5,
                    "total_versions": 2,
                    "workflow_runs": 2,
                    "retry_runs": 1,
                    "failed_events": 1,
                    "latest_event_at": now,
                },
                "events": [
                    {
                        "id": "workflow-terminal-1",
                        "event_type": "workflow_failed",
                        "status": "failed",
                        "timestamp": now,
                        "workflow_run_id": str(workflow_run_id),
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

    monkeypatch.setattr(document_routes, "build_document_service", lambda session: FakeDocumentService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.get(
        f"/api/v1/documents/{document_id}/activity",
        headers={"X-RagPilot-Role": "reviewer"},
        params={"knowledge_base_id": str(knowledge_base_id), "include_deleted": "true"},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert captured == {
        "document_id": document_id,
        "knowledge_base_id": knowledge_base_id,
        "include_deleted": True,
    }
    assert response.json()["summary"]["total_events"] == 5
    assert response.json()["summary"]["total_versions"] == 2
    assert response.json()["summary"]["workflow_runs"] == 2
    assert response.json()["summary"]["retry_runs"] == 1
    assert response.json()["summary"]["failed_events"] == 1
    assert response.json()["summary"]["latest_event_at"].startswith(now.replace("+00:00", ""))
    assert response.json()["events"][0]["event_type"] == "workflow_failed"


def test_workflow_metrics_route_returns_service_summary(monkeypatch) -> None:
    class FakeWorkflowService:
        async def get_workflow_metrics(self, *, tenant_id):
            return {
                "total_runs": 9,
                "active_runs": 4,
                "queued_runs": 2,
                "running_runs": 2,
                "retry_runs": 3,
                "completed_runs": 3,
                "failed_runs": 2,
            }

    monkeypatch.setattr(workflow_routes, "build_workflow_service", lambda session: FakeWorkflowService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.get(
        "/api/v1/workflow-runs/metrics",
        params={"tenant_id": str(uuid4())},
        headers={"X-RagPilot-Role": "reviewer"},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json() == {
        "total_runs": 9,
        "active_runs": 4,
        "queued_runs": 2,
        "running_runs": 2,
        "retry_runs": 3,
        "completed_runs": 3,
        "failed_runs": 2,
    }


def test_document_list_route_exposes_paging_headers_to_browser_clients(monkeypatch) -> None:
    class FakeDocumentService:
        async def list_documents(
            self,
            *,
            knowledge_base_id,
            query,
            status_filter,
            lifecycle_filter,
            sort_order,
            limit,
            offset,
        ):
            return ([], 0)

    monkeypatch.setattr(document_routes, "build_document_service", lambda session: FakeDocumentService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.get(
        "/api/v1/documents",
        headers={"Origin": "http://127.0.0.1:3001", "X-RagPilot-Role": "reviewer"},
        params={"knowledge_base_id": str(uuid4())},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    exposed_headers = response.headers.get("access-control-expose-headers", "")
    assert "X-Total-Count" in exposed_headers
    assert "X-Limit" in exposed_headers
    assert "X-Offset" in exposed_headers
    assert "X-Result-Count" in exposed_headers


def test_document_restore_route_returns_restored_document(monkeypatch) -> None:
    captured: dict[str, object] = {}
    document_id = uuid4()
    knowledge_base_id = uuid4()
    now = datetime.now(timezone.utc).isoformat()

    class FakeDocumentService:
        async def restore_document(self, *, document_id, knowledge_base_id):
            captured.update(
                {
                    "document_id": document_id,
                    "knowledge_base_id": knowledge_base_id,
                }
            )
            return {
                "document": {
                    "id": str(document_id),
                    "tenant_id": str(uuid4()),
                    "knowledge_base_id": str(knowledge_base_id),
                    "title": "RagPilot Web Demo",
                    "source_uri": "s3://ragpilot/ragpilot-web-demo.md",
                    "ingestion_status": "completed",
                    "indexing_status": "completed",
                    "latest_version_number": 1,
                    "latest_version_parser_name": "plain_text_parser",
                    "latest_version_ingestion_status": "completed",
                    "latest_version_chunk_count": 1,
                    "latest_version_token_count_total": 12,
                    "latest_version_updated_at": now,
                    "latest_workflow_run_id": None,
                    "latest_workflow_type": None,
                    "latest_workflow_status": None,
                    "latest_workflow_error_message": None,
                    "latest_workflow_updated_at": None,
                    "deleted_at": None,
                    "is_deleted": False,
                    "created_at": now,
                    "updated_at": now,
                },
                "restored_at": now,
            }

    monkeypatch.setattr(document_routes, "build_document_service", lambda session: FakeDocumentService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.post(
        f"/api/v1/documents/{document_id}/restore",
        params={"knowledge_base_id": str(knowledge_base_id)},
        headers={"X-RagPilot-Role": "operator"},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert captured == {
        "document_id": document_id,
        "knowledge_base_id": knowledge_base_id,
    }
    assert response.json()["document"]["id"] == str(document_id)
    assert response.json()["document"]["is_deleted"] is False
