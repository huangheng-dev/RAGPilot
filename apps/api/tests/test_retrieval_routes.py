from datetime import datetime, timezone
from uuid import uuid4

from fastapi.testclient import TestClient

from ragpilot_api.infrastructure.database.session import get_database_session
from ragpilot_api.main import app
from ragpilot_api.presentation.http.v1 import retrieval_routes


async def override_database_session():
    yield None


def test_retrieval_route_returns_hybrid_retrieval_payload(monkeypatch) -> None:
    tenant_id = uuid4()
    knowledge_base_id = uuid4()
    document_chunk_id = uuid4()

    class FakeRetrievalService:
        async def retrieve_chunks(self, request):
            return {
                "tenant_id": str(request.tenant_id),
                "knowledge_base_id": str(request.knowledge_base_id),
                "query_text": request.query_text,
                "engine_name": "native",
                "retrieval_profile_id": str(uuid4()),
                "retrieval_profile_name": "Standard Hybrid Retrieval",
                "retrieval_profile_source": "knowledge_base",
                "retrieval_mode": "hybrid",
                "embedding_model": "text-embedding-test",
                "effective_top_k": 5,
                "rerank_applied": True,
                "rerank_strategy": "native_term_density_v1",
                "rerank_window": 12,
                "results": [
                    {
                        "document_chunk_id": str(document_chunk_id),
                        "document_id": str(uuid4()),
                        "document_version_id": str(uuid4()),
                        "knowledge_base_id": str(request.knowledge_base_id),
                        "document_title": "RagPilot Handbook",
                        "chunk_index": 0,
                        "content": "Temporal powers durable ingestion workflows.",
                        "token_count": 5,
                        "score": 0.91,
                        "vector_score": 0.88,
                        "lexical_score": 3.0,
                        "lexical_normalized_score": 1.0,
                        "rerank_score": 1.02,
                        "rerank_rank": 1,
                        "embedding_model": "text-embedding-test",
                        "retrieval_method": "hybrid",
                        "metadata_json": {},
                        "created_at": datetime.now(timezone.utc).isoformat(),
                    }
                ],
            }

    monkeypatch.setattr(retrieval_routes, "build_retrieval_service", lambda session: FakeRetrievalService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.post(
        "/api/v1/retrieve",
        json={
            "tenant_id": str(tenant_id),
            "knowledge_base_id": str(knowledge_base_id),
            "query_text": "temporal ingestion workflows",
            "top_k": 5,
        },
    )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    payload = response.json()
    assert payload["engine_name"] == "native"
    assert payload["retrieval_profile_name"] == "Standard Hybrid Retrieval"
    assert payload["retrieval_mode"] == "hybrid"
    assert payload["rerank_applied"] is True
    assert payload["results"][0]["retrieval_method"] == "hybrid"
    assert payload["results"][0]["vector_score"] == 0.88


def test_retrieval_compare_route_returns_engine_diagnostics(monkeypatch) -> None:
    tenant_id = uuid4()
    knowledge_base_id = uuid4()
    shared_chunk_id = uuid4()

    class FakeRetrievalService:
        async def compare_chunks(self, request):
            return {
                "tenant_id": str(request.tenant_id),
                "knowledge_base_id": str(request.knowledge_base_id),
                "query_text": request.query_text,
                "baseline": {
                    "engine_name": "native",
                    "retrieval_profile_id": None,
                    "retrieval_profile_name": "native profile",
                    "retrieval_profile_source": "settings_fallback",
                    "retrieval_mode": "hybrid",
                    "embedding_model": "text-embedding-test",
                    "effective_top_k": 2,
                    "rerank_applied": True,
                    "rerank_strategy": "native_term_density_v1",
                    "rerank_window": 12,
                    "result_count": 1,
                    "retrieval_method_breakdown": {"hybrid": 1},
                    "top_result_chunk_id": str(shared_chunk_id),
                    "top_result_document_title": "RagPilot Handbook",
                    "results": [],
                },
                "candidate": {
                    "engine_name": "llamaindex_pilot",
                    "retrieval_profile_id": None,
                    "retrieval_profile_name": "pilot profile",
                    "retrieval_profile_source": "settings_fallback",
                    "retrieval_mode": "hybrid",
                    "embedding_model": "text-embedding-test",
                    "effective_top_k": 2,
                    "rerank_applied": True,
                    "rerank_strategy": "native_term_density_v1",
                    "rerank_window": 12,
                    "result_count": 1,
                    "retrieval_method_breakdown": {"hybrid": 1},
                    "top_result_chunk_id": str(shared_chunk_id),
                    "top_result_document_title": "RagPilot Handbook",
                    "results": [],
                },
                "summary": {
                    "shared_chunk_ids": [str(shared_chunk_id)],
                    "baseline_only_chunk_ids": [],
                    "candidate_only_chunk_ids": [],
                    "shared_result_count": 1,
                    "baseline_only_count": 0,
                    "candidate_only_count": 0,
                    "top_result_matches": True,
                    "recommendation_status": "aligned",
                    "recommendation_reason": "Candidate retrieval currently matches the baseline across the compared ranked results.",
                },
            }

    monkeypatch.setattr(retrieval_routes, "build_retrieval_service", lambda session: FakeRetrievalService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.post(
        "/api/v1/retrieve/compare",
        json={
            "tenant_id": str(tenant_id),
            "knowledge_base_id": str(knowledge_base_id),
            "query_text": "temporal ingestion workflows",
            "top_k": 5,
            "baseline_engine": "native",
            "candidate_engine": "llamaindex_pilot",
        },
    )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    payload = response.json()
    assert payload["baseline"]["engine_name"] == "native"
    assert payload["candidate"]["engine_name"] == "llamaindex_pilot"
    assert payload["summary"]["shared_result_count"] == 1
    assert payload["summary"]["top_result_matches"] is True
    assert payload["summary"]["recommendation_status"] == "aligned"


def test_record_retrieval_evaluation_route_requires_actor_user(monkeypatch) -> None:
    class FakeRetrievalService:
        async def record_evaluation(self, request, *, created_by_user_id):
            raise AssertionError("record_evaluation should not run without actor user scope.")

    monkeypatch.setattr(retrieval_routes, "build_retrieval_service", lambda session: FakeRetrievalService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.post(
        "/api/v1/retrieve/evaluations",
        json={
            "tenant_id": str(uuid4()),
            "workspace_id": str(uuid4()),
            "knowledge_base_id": str(uuid4()),
            "evaluation_mode": "inspect",
            "validation_status": "ready",
            "query_text": "temporal ingestion workflows",
            "baseline_engine_name": "native",
            "result_count": 2,
            "evaluation_payload_json": {},
        },
        headers={"X-RagPilot-Role": "operator"},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 401


def test_record_retrieval_evaluation_route_forwards_payload(monkeypatch) -> None:
    captured: dict[str, object] = {}
    actor_user_id = uuid4()

    class FakeRetrievalService:
        async def record_evaluation(self, request, *, created_by_user_id):
            captured.update(
                {
                    "tenant_id": request.tenant_id,
                    "workspace_id": request.workspace_id,
                    "knowledge_base_id": request.knowledge_base_id,
                    "evaluation_mode": request.evaluation_mode,
                    "validation_status": request.validation_status,
                    "query_text": request.query_text,
                    "baseline_engine_name": request.baseline_engine_name,
                    "candidate_engine_name": request.candidate_engine_name,
                    "created_by_user_id": created_by_user_id,
                }
            )
            return {
                "id": str(uuid4()),
                "tenant_id": str(request.tenant_id),
                "workspace_id": str(request.workspace_id),
                "knowledge_base_id": str(request.knowledge_base_id),
                "evaluation_mode": request.evaluation_mode,
                "validation_status": request.validation_status,
                "query_text": request.query_text,
                "baseline_engine_name": request.baseline_engine_name,
                "candidate_engine_name": request.candidate_engine_name,
                "retrieval_profile_name": request.retrieval_profile_name,
                "retrieval_profile_source": request.retrieval_profile_source,
                "result_count": request.result_count,
                "shared_result_count": request.shared_result_count,
                "baseline_only_count": request.baseline_only_count,
                "candidate_only_count": request.candidate_only_count,
                "top_result_matches": request.top_result_matches,
                "recommendation_reason": request.recommendation_reason,
                "evaluation_payload_json": request.evaluation_payload_json,
                "created_by_user_id": str(created_by_user_id),
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }

    monkeypatch.setattr(retrieval_routes, "build_retrieval_service", lambda session: FakeRetrievalService())
    app.dependency_overrides[get_database_session] = override_database_session

    tenant_id = uuid4()
    workspace_id = uuid4()
    knowledge_base_id = uuid4()
    client = TestClient(app)
    response = client.post(
        "/api/v1/retrieve/evaluations",
        json={
            "tenant_id": str(tenant_id),
            "workspace_id": str(workspace_id),
            "knowledge_base_id": str(knowledge_base_id),
            "evaluation_mode": "compare",
            "validation_status": "review",
            "query_text": "temporal ingestion workflows",
            "baseline_engine_name": "native",
            "candidate_engine_name": "llamaindex_pilot",
            "retrieval_profile_name": "Standard Hybrid Retrieval",
            "retrieval_profile_source": "knowledge_base",
            "result_count": 2,
            "shared_result_count": 1,
            "baseline_only_count": 1,
            "candidate_only_count": 0,
            "top_result_matches": True,
            "recommendation_reason": "Needs review.",
            "evaluation_payload_json": {"summary": {"shared_result_count": 1}},
        },
        headers={
            "X-RagPilot-Role": "operator",
            "X-RagPilot-Actor-Id": str(actor_user_id),
        },
    )

    app.dependency_overrides.clear()

    assert response.status_code == 201
    assert captured == {
        "tenant_id": tenant_id,
        "workspace_id": workspace_id,
        "knowledge_base_id": knowledge_base_id,
        "evaluation_mode": "compare",
        "validation_status": "review",
        "query_text": "temporal ingestion workflows",
        "baseline_engine_name": "native",
        "candidate_engine_name": "llamaindex_pilot",
        "created_by_user_id": actor_user_id,
    }


def test_list_retrieval_evaluations_route_forwards_scope(monkeypatch) -> None:
    captured: dict[str, object] = {}
    tenant_id = uuid4()
    workspace_id = uuid4()
    knowledge_base_id = uuid4()

    class FakeRetrievalService:
        async def list_evaluations(self, *, tenant_id, workspace_id, knowledge_base_id=None, limit=10):
            captured.update(
                {
                    "tenant_id": tenant_id,
                    "workspace_id": workspace_id,
                    "knowledge_base_id": knowledge_base_id,
                    "limit": limit,
                }
            )
            return []

    monkeypatch.setattr(retrieval_routes, "build_retrieval_service", lambda session: FakeRetrievalService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.get(
        "/api/v1/retrieve/evaluations",
        params={
            "tenant_id": str(tenant_id),
            "workspace_id": str(workspace_id),
            "knowledge_base_id": str(knowledge_base_id),
            "limit": 5,
        },
        headers={"X-RagPilot-Role": "operator"},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert captured == {
        "tenant_id": tenant_id,
        "workspace_id": workspace_id,
        "knowledge_base_id": knowledge_base_id,
        "limit": 5,
    }


def test_summarize_retrieval_evaluations_route_forwards_scope(monkeypatch) -> None:
    captured: dict[str, object] = {}
    tenant_id = uuid4()
    workspace_id = uuid4()
    knowledge_base_id = uuid4()

    class FakeRetrievalService:
        async def summarize_evaluations(
            self,
            *,
            tenant_id,
            workspace_id,
            knowledge_base_id=None,
            limit=5,
            sample_size=120,
        ):
            captured.update(
                {
                    "tenant_id": tenant_id,
                    "workspace_id": workspace_id,
                    "knowledge_base_id": knowledge_base_id,
                    "limit": limit,
                    "sample_size": sample_size,
                }
            )
            return {
                "tenant_id": str(tenant_id),
                "workspace_id": str(workspace_id),
                "knowledge_base_id": str(knowledge_base_id),
                "total_evaluations": 2,
                "total_queries": 1,
                "status_breakdown": {
                    "ready": 0,
                    "review": 1,
                    "hold": 1,
                    "empty": 0,
                    "failed": 0,
                },
                "candidates": [
                    {
                        "query_text": "Temporal ingestion workflows",
                        "evaluation_count": 2,
                        "latest_evaluation_mode": "compare",
                        "latest_validation_status": "hold",
                        "ready_count": 0,
                        "review_count": 1,
                        "hold_count": 1,
                        "empty_count": 0,
                        "failed_count": 0,
                        "attention_score": 5,
                        "baseline_engine_name": "native",
                        "candidate_engine_name": "llamaindex_pilot",
                        "retrieval_profile_id": str(uuid4()),
                        "retrieval_profile_name": "Standard Hybrid Retrieval",
                        "retrieval_profile_source": "knowledge_base",
                        "recommendation_reason": "Top-ranked retrieval differs.",
                        "result_count": 1,
                        "shared_result_count": 0,
                        "baseline_only_count": 1,
                        "candidate_only_count": 1,
                        "top_result_matches": False,
                        "latest_source_documents": [
                            {
                                "document_id": str(uuid4()),
                                "document_title": "RagPilot Handbook",
                                "hit_count": 1,
                            }
                        ],
                        "last_evaluated_at": datetime.now(timezone.utc).isoformat(),
                    }
                ],
            }

    monkeypatch.setattr(retrieval_routes, "build_retrieval_service", lambda session: FakeRetrievalService())
    app.dependency_overrides[get_database_session] = override_database_session

    client = TestClient(app)
    response = client.get(
        "/api/v1/retrieve/evaluations/summary",
        params={
            "tenant_id": str(tenant_id),
            "workspace_id": str(workspace_id),
            "knowledge_base_id": str(knowledge_base_id),
            "limit": 4,
            "sample_size": 80,
        },
        headers={"X-RagPilot-Role": "operator"},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert captured == {
        "tenant_id": tenant_id,
        "workspace_id": workspace_id,
        "knowledge_base_id": knowledge_base_id,
        "limit": 4,
        "sample_size": 80,
    }
