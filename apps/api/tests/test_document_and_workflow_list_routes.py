from datetime import datetime, timezone
from uuid import uuid4

from fastapi.testclient import TestClient

from ragpilot_api.main import app
from ragpilot_api.presentation.http import request_actor
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
            source_kind_filter,
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
                    "source_kind_filter": source_kind_filter,
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
                        "source_uri": "s3://RAGPilot/sample.md",
                        "source_kind": "file",
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
        headers={"X-RAGPilot-Role": "reviewer", "X-RAGPilot-Actor-Id": str(uuid4())},
        params={
            "knowledge_base_id": str(uuid4()),
            "query": "policy",
            "status": "completed",
            "source_kind": "file",
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
    assert captured["source_kind_filter"] == "file"
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
                        "temporal_workflow_id": "RAGPilot-workflow-1",
                        "subject_type": "document",
                    "subject_id": str(uuid4()),
                    "subject_label": "Policy Handbook",
                    "subject_workspace_id": str(uuid4()),
                    "subject_knowledge_base_id": str(uuid4()),
                    "root_workflow_run_id": str(uuid4()),
                    "latest_child_retry_run_id": None,
                    "retry_depth": 1,
                    "child_retry_run_count": 0,
                    "error_message": None,
                    "is_retry_available": False,
                    "retry_unavailable_reason": None,
                    "total_step_count": 4,
                    "completed_step_count": 2,
                    "failed_step_count": 1,
                    "active_step_count": 1,
                    "pending_step_count": 0,
                    "latest_failed_step_name": "embed_document",
                    "latest_failed_step_error_message": "Embedding provider timeout",
                    "recovery_event_count": 2,
                    "latest_recovery_event_at": datetime.now(timezone.utc).isoformat(),
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
        headers={"X-RAGPilot-Role": "reviewer", "X-RAGPilot-Actor-Id": str(uuid4())},
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


def test_workflow_list_route_rejects_scoped_actor_outside_active_tenant(monkeypatch) -> None:
    allowed_tenant_id = uuid4()
    requested_tenant_id = uuid4()

    class FakeWorkflowService:
        async def list_workflow_runs(self, **kwargs):
            raise AssertionError("list_workflow_runs should not run for an out-of-scope tenant.")

    async def override_request_actor():
        return request_actor.RequestActor(
            role="operator",
            user_id=uuid4(),
            active_tenant_ids=(allowed_tenant_id,),
        )

    monkeypatch.setattr(workflow_routes, "build_workflow_service", lambda session: FakeWorkflowService())
    app.dependency_overrides[get_database_session] = override_database_session
    app.dependency_overrides[request_actor.get_request_actor] = override_request_actor

    client = TestClient(app)
    response = client.get(
        "/api/v1/workflow-runs",
        params={"tenant_id": str(requested_tenant_id)},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 403
    assert response.json()["detail"] == "Actor does not have access to the requested tenant scope."


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
        headers={"X-RAGPilot-Role": "reviewer", "X-RAGPilot-Actor-Id": str(uuid4())},
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
            raise ValueError("Unsupported document type. RAGPilot currently accepts TXT, Markdown, HTML, CSV, JSON, PDF, DOCX, and XLSX files.")

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
        headers={"X-RAGPilot-Role": "operator", "X-RAGPilot-Actor-Id": str(uuid4())},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 400
    assert response.json() == {
        "detail": "Unsupported document type. RAGPilot currently accepts TXT, Markdown, HTML, CSV, JSON, PDF, DOCX, and XLSX files."
    }


def test_document_create_route_rejects_mismatched_knowledge_base_scope(monkeypatch) -> None:
    tenant_id = uuid4()
    knowledge_base_id = uuid4()
    other_tenant_id = uuid4()

    class FakeDocumentService:
        async def create_document(self, request):
            raise AssertionError("create_document should not run when tenant and knowledge base scope mismatch.")

    class FakeKnowledgeBaseRepository:
        def __init__(self, session) -> None:
            self.session = session

        async def get_knowledge_base_by_id(self, *, knowledge_base_id):
            return type("KnowledgeBase", (), {"tenant_id": other_tenant_id})()

    async def override_request_actor():
        return request_actor.RequestActor(
            role="operator",
            user_id=uuid4(),
            active_tenant_ids=(tenant_id, other_tenant_id),
        )

    monkeypatch.setattr(document_routes, "build_document_service", lambda session: FakeDocumentService())
    monkeypatch.setattr(document_routes, "KnowledgeBaseRepository", FakeKnowledgeBaseRepository)
    app.dependency_overrides[get_database_session] = override_database_session
    app.dependency_overrides[request_actor.get_request_actor] = override_request_actor

    client = TestClient(app)
    response = client.post(
        "/api/v1/documents",
        json={
            "tenant_id": str(tenant_id),
            "knowledge_base_id": str(knowledge_base_id),
            "title": "Policy Handbook",
            "source_uri": "s3://RAGPilot/policy.md",
        },
    )

    app.dependency_overrides.clear()

    assert response.status_code == 409
    assert response.json()["detail"] == "Tenant and knowledge base scope do not match."


def test_import_webpage_route_forwards_payload(monkeypatch) -> None:
    captured: dict[str, object] = {}
    now = datetime.now(timezone.utc).isoformat()

    class FakeDocumentService:
        async def import_web_page(self, request):
            captured.update(
                {
                    "tenant_id": request.tenant_id,
                    "knowledge_base_id": request.knowledge_base_id,
                    "source_url": request.source_url,
                    "title": request.title,
                }
            )
            return {
                "document": {
                    "id": str(uuid4()),
                    "tenant_id": str(request.tenant_id),
                        "knowledge_base_id": str(request.knowledge_base_id),
                        "title": request.title or "Imported page",
                        "source_uri": request.source_url,
                        "source_kind": "web",
                        "ingestion_status": "pending",
                    "indexing_status": "pending",
                    "latest_version_number": 1,
                    "latest_version_parser_name": None,
                    "latest_version_ingestion_status": "pending",
                    "latest_version_chunk_count": 0,
                    "latest_version_token_count_total": 0,
                    "latest_version_updated_at": now,
                    "latest_workflow_run_id": str(uuid4()),
                    "latest_workflow_type": "document_ingestion",
                    "latest_workflow_status": "queued",
                    "latest_workflow_error_message": None,
                    "latest_workflow_updated_at": now,
                    "deleted_at": None,
                    "is_deleted": False,
                    "created_at": now,
                    "updated_at": now,
                },
                "document_version_id": str(uuid4()),
                "document_asset_id": str(uuid4()),
                "workflow_run_id": str(uuid4()),
                "workflow_status": "queued",
                "temporal_workflow_id": "document-ingestion-imported",
                "storage_bucket": "ragpilot-documents",
                "storage_key": "tenants/demo/imported-page.html",
                "file_name": "imported-page.html",
                "content_type": "text/html",
                "file_size_bytes": 512,
                "content_hash": "abc123",
            }

    monkeypatch.setattr(document_routes, "build_document_service", lambda session: FakeDocumentService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    tenant_id = uuid4()
    knowledge_base_id = uuid4()
    response = client.post(
        "/api/v1/documents/import-webpage",
        headers={"X-RAGPilot-Role": "operator", "X-RAGPilot-Actor-Id": str(uuid4())},
        json={
            "tenant_id": str(tenant_id),
            "knowledge_base_id": str(knowledge_base_id),
            "source_url": "https://docs.example.com/ops",
            "title": "Operations Handbook",
        },
    )

    app.dependency_overrides.clear()

    assert response.status_code == 201
    assert captured["tenant_id"] == tenant_id
    assert captured["knowledge_base_id"] == knowledge_base_id
    assert captured["source_url"] == "https://docs.example.com/ops"
    assert captured["title"] == "Operations Handbook"
    assert response.json()["document"]["source_uri"] == "https://docs.example.com/ops"


def test_import_webpage_route_returns_400_for_invalid_source(monkeypatch) -> None:
    class FakeDocumentService:
        async def import_web_page(self, request):
            raise ValueError("Web import only accepts absolute http or https URLs.")

    monkeypatch.setattr(document_routes, "build_document_service", lambda session: FakeDocumentService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.post(
        "/api/v1/documents/import-webpage",
        headers={"X-RAGPilot-Role": "operator", "X-RAGPilot-Actor-Id": str(uuid4())},
        json={
            "tenant_id": str(uuid4()),
            "knowledge_base_id": str(uuid4()),
            "source_url": "file:///tmp/demo.html",
        },
    )

    app.dependency_overrides.clear()

    assert response.status_code == 400
    assert response.json() == {"detail": "Web import only accepts absolute http or https URLs."}


def test_import_webpage_route_rejects_extra_fields(monkeypatch) -> None:
    class FakeDocumentService:
        async def import_web_page(self, request):
            raise AssertionError("import_web_page should not run when extra fields are submitted.")

    monkeypatch.setattr(document_routes, "build_document_service", lambda session: FakeDocumentService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.post(
        "/api/v1/documents/import-webpage",
        headers={"X-RAGPilot-Role": "operator", "X-RAGPilot-Actor-Id": str(uuid4())},
        json={
            "tenant_id": str(uuid4()),
            "knowledge_base_id": str(uuid4()),
            "source_url": "https://docs.example.com/ops",
            "unexpected_field": "blocked",
        },
    )

    app.dependency_overrides.clear()

    assert response.status_code == 422


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
                    "source_uri": "s3://RAGPilot/sample.md",
                    "source_kind": "file",
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
        headers={"X-RAGPilot-Role": "reviewer", "X-RAGPilot-Actor-Id": str(uuid4())},
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
        headers={"X-RAGPilot-Role": "reviewer", "X-RAGPilot-Actor-Id": str(uuid4())},
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
                "cancelled_runs": 1,
            }

    monkeypatch.setattr(workflow_routes, "build_workflow_service", lambda session: FakeWorkflowService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.get(
        "/api/v1/workflow-runs/metrics",
        params={"tenant_id": str(uuid4())},
        headers={"X-RAGPilot-Role": "reviewer", "X-RAGPilot-Actor-Id": str(uuid4())},
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
        "cancelled_runs": 1,
    }


def test_workflow_cancel_route_returns_updated_run(monkeypatch) -> None:
    captured: dict[str, object] = {}
    workflow_run_id = uuid4()
    tenant_id = uuid4()
    now = datetime.now(timezone.utc).isoformat()

    class FakeWorkflowService:
        async def cancel_workflow_run(self, *, workflow_run_id, tenant_id, actor_user_id, actor_role):
            captured.update(
                {
                    "workflow_run_id": workflow_run_id,
                    "tenant_id": tenant_id,
                    "actor_user_id": actor_user_id,
                    "actor_role": actor_role,
                }
            )
            return {
                "id": str(workflow_run_id),
                "tenant_id": str(tenant_id),
                "workflow_type": "document_ingestion",
                "workflow_status": "cancelled",
                "retry_of_workflow_run_id": None,
                "temporal_workflow_id": "document-ingestion-example",
                "subject_type": "document",
                "subject_id": str(uuid4()),
                "subject_label": "Policy Handbook",
                "subject_workspace_id": str(uuid4()),
                "subject_knowledge_base_id": str(uuid4()),
                "error_message": "Cancelled by operator.",
                "is_retry_available": False,
                "retry_unavailable_reason": None,
                "recovery_stage": "review_workflow",
                "recommended_next_view": "documents",
                "recommended_primary_action": "open_document",
                "follow_up_reason": "This workflow was cancelled by an operator. Review the source document before relaunching ingestion.",
                "started_at": now,
                "completed_at": now,
                "created_at": now,
                "updated_at": now,
            }

    monkeypatch.setattr(workflow_routes, "build_workflow_service", lambda session: FakeWorkflowService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.post(
        f"/api/v1/workflow-runs/{workflow_run_id}/cancel",
        params={"tenant_id": str(tenant_id)},
        headers={"X-RAGPilot-Role": "operator", "X-RAGPilot-Actor-Id": str(uuid4())},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert captured == {
        "workflow_run_id": workflow_run_id,
        "tenant_id": tenant_id,
        "actor_role": "operator",
        "actor_user_id": captured["actor_user_id"],
    }
    assert captured["actor_user_id"] is not None
    assert response.json()["workflow_status"] == "cancelled"


def test_workflow_notes_route_returns_updated_detail(monkeypatch) -> None:
    captured: dict[str, object] = {}
    workflow_run_id = uuid4()
    tenant_id = uuid4()
    now = datetime.now(timezone.utc).isoformat()

    class FakeWorkflowService:
        async def update_workflow_run_operator_notes(self, *, workflow_run_id, tenant_id, operator_notes, actor_user_id, actor_role):
            captured.update(
                {
                    "workflow_run_id": workflow_run_id,
                    "tenant_id": tenant_id,
                    "operator_notes": operator_notes,
                    "actor_user_id": actor_user_id,
                    "actor_role": actor_role,
                }
            )
            return {
                "id": str(workflow_run_id),
                "tenant_id": str(tenant_id),
                "workflow_type": "document_ingestion",
                "workflow_status": "failed",
                "retry_of_workflow_run_id": None,
                "temporal_workflow_id": "document-ingestion-example",
                "subject_type": "document",
                "subject_id": str(uuid4()),
                "subject_label": "Policy Handbook",
                "subject_workspace_id": str(uuid4()),
                "subject_knowledge_base_id": str(uuid4()),
                "root_workflow_run_id": str(uuid4()),
                "latest_child_retry_run_id": None,
                "retry_depth": 0,
                "child_retry_run_count": 0,
                "error_message": "Embedding provider timeout",
                "operator_notes": "Need to recheck parser output.",
                "is_retry_available": True,
                "retry_unavailable_reason": None,
                "total_step_count": 3,
                "completed_step_count": 1,
                "failed_step_count": 1,
                "active_step_count": 0,
                "pending_step_count": 1,
                "latest_failed_step_name": "embed_document",
                "latest_failed_step_error_message": "Embedding provider timeout",
                "recovery_event_count": 4,
                "latest_recovery_event_at": now,
                "recovery_stage": "retry_available",
                "recommended_next_view": "workflows",
                "recommended_primary_action": "retry_workflow",
                "follow_up_reason": "The failed workflow is eligible for retry from the operations lane.",
                "started_at": now,
                "completed_at": now,
                "created_at": now,
                "updated_at": now,
                "input_json": {},
                "steps": [],
                "events": [],
            }

    monkeypatch.setattr(workflow_routes, "build_workflow_service", lambda session: FakeWorkflowService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.patch(
        f"/api/v1/workflow-runs/{workflow_run_id}/notes",
        params={"tenant_id": str(tenant_id)},
        headers={"X-RAGPilot-Role": "operator", "X-RAGPilot-Actor-Id": str(uuid4())},
        json={"operator_notes": "Need to recheck parser output."},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert captured == {
        "workflow_run_id": workflow_run_id,
        "tenant_id": tenant_id,
        "operator_notes": "Need to recheck parser output.",
        "actor_role": "operator",
        "actor_user_id": captured["actor_user_id"],
    }
    assert captured["actor_user_id"] is not None
    assert response.json()["operator_notes"] == "Need to recheck parser output."


def test_workflow_events_route_forwards_filters(monkeypatch) -> None:
    captured: dict[str, object] = {}
    workflow_run_id = uuid4()
    tenant_id = uuid4()
    now = datetime.now(timezone.utc).isoformat()

    class FakeWorkflowService:
        async def list_workflow_run_events(self, *, workflow_run_id, tenant_id, action_type, actor_role, limit):
            captured.update(
                {
                    "workflow_run_id": workflow_run_id,
                    "tenant_id": tenant_id,
                    "action_type": action_type,
                    "actor_role": actor_role,
                    "limit": limit,
                }
            )
            return [
                {
                    "id": str(uuid4()),
                    "tenant_id": str(tenant_id),
                    "workflow_run_id": str(workflow_run_id),
                    "actor_user_id": str(uuid4()),
                    "actor_role": "operator",
                    "action_type": "retry_requested",
                    "detail": {"retry_workflow_run_id": str(uuid4())},
                    "created_at": now,
                }
            ]

    monkeypatch.setattr(workflow_routes, "build_workflow_service", lambda session: FakeWorkflowService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.get(
        f"/api/v1/workflow-runs/{workflow_run_id}/events",
        params={
            "tenant_id": str(tenant_id),
            "action_type": "retry_requested",
            "actor_role": "operator",
            "limit": 10,
        },
        headers={"X-RAGPilot-Role": "reviewer", "X-RAGPilot-Actor-Id": str(uuid4())},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert captured == {
        "workflow_run_id": workflow_run_id,
        "tenant_id": tenant_id,
        "action_type": "retry_requested",
        "actor_role": "operator",
        "limit": 10,
    }
    assert response.json()[0]["action_type"] == "retry_requested"


def test_workflow_steps_route_forwards_filters(monkeypatch) -> None:
    captured: dict[str, object] = {}
    workflow_run_id = uuid4()
    tenant_id = uuid4()
    now = datetime.now(timezone.utc).isoformat()

    class FakeWorkflowService:
        async def list_workflow_run_steps(self, *, workflow_run_id, tenant_id, status_filter, min_attempt_count, limit):
            captured.update(
                {
                    "workflow_run_id": workflow_run_id,
                    "tenant_id": tenant_id,
                    "status_filter": status_filter,
                    "min_attempt_count": min_attempt_count,
                    "limit": limit,
                }
            )
            return [
                {
                    "id": str(uuid4()),
                    "tenant_id": str(tenant_id),
                    "workflow_run_id": str(workflow_run_id),
                    "step_name": "embed_document",
                    "step_status": "failed",
                    "attempt_count": 2,
                    "error_message": "Embedding provider timeout",
                    "started_at": now,
                    "completed_at": now,
                    "created_at": now,
                    "updated_at": now,
                }
            ]

    monkeypatch.setattr(workflow_routes, "build_workflow_service", lambda session: FakeWorkflowService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.get(
        f"/api/v1/workflow-runs/{workflow_run_id}/steps",
        params={
            "tenant_id": str(tenant_id),
            "status": "failed",
            "min_attempt_count": 2,
            "limit": 10,
        },
        headers={"X-RAGPilot-Role": "reviewer", "X-RAGPilot-Actor-Id": str(uuid4())},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert captured == {
        "workflow_run_id": workflow_run_id,
        "tenant_id": tenant_id,
        "status_filter": "failed",
        "min_attempt_count": 2,
        "limit": 10,
    }
    assert response.json()[0]["step_status"] == "failed"


def test_workflow_notes_route_rejects_extra_fields(monkeypatch) -> None:
    class FakeWorkflowService:
        async def update_workflow_run_operator_notes(self, *, workflow_run_id, tenant_id, operator_notes, actor_user_id, actor_role):
            raise AssertionError(
                "update_workflow_run_operator_notes should not run when extra fields are submitted."
            )

    monkeypatch.setattr(workflow_routes, "build_workflow_service", lambda session: FakeWorkflowService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.patch(
        f"/api/v1/workflow-runs/{uuid4()}/notes",
        params={"tenant_id": str(uuid4())},
        headers={"X-RAGPilot-Role": "operator", "X-RAGPilot-Actor-Id": str(uuid4())},
        json={"operator_notes": "Need review.", "unexpected_field": "blocked"},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 422


def test_document_list_route_exposes_paging_headers_to_browser_clients(monkeypatch) -> None:
    class FakeDocumentService:
        async def list_documents(
            self,
            *,
            knowledge_base_id,
            query,
            status_filter,
            source_kind_filter,
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
        headers={"Origin": "http://127.0.0.1:3000", "X-RAGPilot-Role": "reviewer", "X-RAGPilot-Actor-Id": str(uuid4())},
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
                        "title": "RAGPilot Web Demo",
                        "source_uri": "s3://RAGPilot/RAGPilot-web-demo.md",
                        "source_kind": "file",
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
        headers={"X-RAGPilot-Role": "operator", "X-RAGPilot-Actor-Id": str(uuid4())},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert captured == {
        "document_id": document_id,
        "knowledge_base_id": knowledge_base_id,
    }
    assert response.json()["document"]["id"] == str(document_id)
    assert response.json()["document"]["is_deleted"] is False
