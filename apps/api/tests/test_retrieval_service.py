from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from ragpilot_api.application.retrieval.retrieval_runtime import RetrievalExecutionOutcome
from ragpilot_api.application.retrieval.retrieval_service import RetrievalService
from ragpilot_api.contracts.http.retrieval_contracts import (
    RetrievalCompareRequest,
    RetrievalEvaluationCreateRequest,
    RetrievalRequest,
)


@pytest.mark.anyio
async def test_retrieve_chunks_merges_vector_and_lexical_results_into_hybrid_order() -> None:
    tenant_id = uuid4()
    knowledge_base_id = uuid4()
    shared_chunk_id = uuid4()
    lexical_only_chunk_id = uuid4()
    now = datetime.now(timezone.utc)

    repository = SimpleNamespace(
        search_vector_document_chunks=AsyncMock(
            return_value=[
                {
                    "document_chunk_id": shared_chunk_id,
                    "document_id": uuid4(),
                    "document_version_id": uuid4(),
                    "knowledge_base_id": knowledge_base_id,
                    "document_title": "RagPilot Handbook",
                    "chunk_index": 0,
                    "content": "Temporal powers durable ingestion workflows.",
                    "token_count": 5,
                    "score": 0.82,
                    "embedding_model": "text-embedding-test",
                    "metadata_json": {},
                    "created_at": now,
                }
            ]
        ),
        search_lexical_document_chunks=AsyncMock(
            return_value=[
                {
                    "document_chunk_id": shared_chunk_id,
                    "document_id": uuid4(),
                    "document_version_id": uuid4(),
                    "knowledge_base_id": knowledge_base_id,
                    "document_title": "RagPilot Handbook",
                    "chunk_index": 0,
                    "content": "Temporal powers durable ingestion workflows.",
                    "token_count": 5,
                    "lexical_score": 3.0,
                    "embedding_model": None,
                    "metadata_json": {},
                    "created_at": now,
                },
                {
                    "document_chunk_id": lexical_only_chunk_id,
                    "document_id": uuid4(),
                    "document_version_id": uuid4(),
                    "knowledge_base_id": knowledge_base_id,
                    "document_title": "Operations Notes",
                    "chunk_index": 1,
                    "content": "Ingestion workflows are reviewed in operations.",
                    "token_count": 6,
                    "lexical_score": 2.0,
                    "embedding_model": None,
                    "metadata_json": {},
                    "created_at": now,
                },
            ]
        ),
    )

    service = RetrievalService(
        retrieval_repository=repository,
        settings=SimpleNamespace(
            retrieval_embedding_dimension=8,
            retrieval_embedding_model="text-embedding-test",
        ),
    )

    response = await service.retrieve_chunks(
        RetrievalRequest(
            tenant_id=tenant_id,
            knowledge_base_id=knowledge_base_id,
            query_text="temporal ingestion workflows",
            top_k=3,
        )
    )

    assert response.engine_name == "native"
    assert response.retrieval_mode == "hybrid"
    assert response.rerank_applied is True
    assert response.rerank_strategy == "native_term_density_v1"
    assert response.rerank_window == 12
    assert len(response.results) == 2
    assert response.results[0].document_chunk_id == shared_chunk_id
    assert response.results[0].retrieval_method == "hybrid"
    assert response.results[0].rerank_rank == 1
    assert response.results[0].rerank_score is not None
    assert response.results[0].embedding_model == "text-embedding-test"
    assert response.results[0].vector_score == 0.82
    assert response.results[0].lexical_score == 3.0
    assert response.results[0].lexical_normalized_score == 1.0
    assert response.results[1].document_chunk_id == lexical_only_chunk_id
    assert response.results[1].retrieval_method == "lexical"
    assert response.results[1].vector_score is None
    assert response.results[1].lexical_score == 2.0
    assert response.results[1].lexical_normalized_score == pytest.approx(2.0 / 3.0)
    repository.search_vector_document_chunks.assert_awaited_once()
    repository.search_lexical_document_chunks.assert_awaited_once()


@pytest.mark.anyio
async def test_retrieve_chunks_uses_vector_profile_when_knowledge_base_assigns_it() -> None:
    tenant_id = uuid4()
    knowledge_base_id = uuid4()
    chunk_id = uuid4()
    now = datetime.now(timezone.utc)

    repository = SimpleNamespace(
        search_vector_document_chunks=AsyncMock(
            return_value=[
                {
                    "document_chunk_id": chunk_id,
                    "document_id": uuid4(),
                    "document_version_id": uuid4(),
                    "knowledge_base_id": knowledge_base_id,
                    "document_title": "RagPilot Handbook",
                    "chunk_index": 0,
                    "content": "Temporal powers durable ingestion workflows.",
                    "token_count": 5,
                    "score": 0.82,
                    "embedding_model": "text-embedding-test",
                    "metadata_json": {},
                    "created_at": now,
                }
            ]
        ),
        search_lexical_document_chunks=AsyncMock(return_value=[]),
    )
    knowledge_base_repository = SimpleNamespace(
        get_knowledge_base_by_id=AsyncMock(
            return_value=SimpleNamespace(retrieval_profile_id=uuid4())
        )
    )
    retrieval_profile_repository = SimpleNamespace(
        get_retrieval_profile=AsyncMock(
            return_value=SimpleNamespace(
                id=uuid4(),
                name="Vector Retrieval",
                retrieval_mode="vector",
                top_k=2,
                vector_weight=0.75,
                lexical_weight=0.25,
                hybrid_overlap_bonus=0.1,
                is_enabled=True,
            )
        ),
        get_default_enabled_retrieval_profile=AsyncMock(return_value=None),
    )

    service = RetrievalService(
        retrieval_repository=repository,
        settings=SimpleNamespace(
            retrieval_embedding_dimension=8,
            retrieval_embedding_model="text-embedding-test",
        ),
        knowledge_base_repository=knowledge_base_repository,
        retrieval_profile_repository=retrieval_profile_repository,
    )

    response = await service.retrieve_chunks(
        RetrievalRequest(
            tenant_id=tenant_id,
            knowledge_base_id=knowledge_base_id,
            query_text="temporal ingestion workflows",
            top_k=5,
        )
    )

    assert response.engine_name == "native"
    assert response.retrieval_profile_name == "Vector Retrieval"
    assert response.retrieval_profile_source == "knowledge_base"
    assert response.retrieval_mode == "vector"
    assert response.effective_top_k == 2
    assert len(response.results) == 1
    assert response.results[0].retrieval_method == "vector"
    repository.search_vector_document_chunks.assert_awaited_once()
    repository.search_lexical_document_chunks.assert_not_awaited()


@pytest.mark.anyio
async def test_retrieve_chunks_uses_configured_retrieval_engine_boundary(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    tenant_id = uuid4()
    knowledge_base_id = uuid4()
    chunk_id = uuid4()
    now = datetime.now(timezone.utc)

    captured_arguments: dict[str, object] = {}

    class FakeRetrievalEngine:
        async def execute(self, **kwargs):
            captured_arguments.update(kwargs)
            return RetrievalExecutionOutcome(
                retrieval_profile_id=None,
                retrieval_profile_name="Reserved Pilot",
                retrieval_profile_source="settings_fallback",
                retrieval_mode="hybrid",
                embedding_model="boundary-test-model",
                effective_top_k=1,
                rerank_applied=False,
                rerank_strategy=None,
                rerank_window=None,
                results=[
                    {
                        "document_chunk_id": chunk_id,
                        "document_id": uuid4(),
                        "document_version_id": uuid4(),
                        "knowledge_base_id": knowledge_base_id,
                        "document_title": "Boundary Test",
                        "chunk_index": 0,
                        "content": "The retrieval engine boundary is active.",
                        "token_count": 7,
                        "score": 0.99,
                        "vector_score": 0.99,
                        "lexical_score": None,
                        "lexical_normalized_score": None,
                        "embedding_model": "boundary-test-model",
                        "retrieval_method": "vector",
                        "metadata_json": {},
                        "created_at": now,
                    }
                ],
            )

    fake_engine = FakeRetrievalEngine()
    monkeypatch.setattr(
        "ragpilot_api.application.retrieval.retrieval_service.build_retrieval_engine",
        lambda settings, engine_name=None: fake_engine,
    )

    repository = SimpleNamespace()
    settings = SimpleNamespace(
        retrieval_engine="llamaindex_reserved",
        retrieval_embedding_dimension=8,
        retrieval_embedding_model="boundary-test-model",
    )
    service = RetrievalService(
        retrieval_repository=repository,
        settings=settings,
    )

    response = await service.retrieve_chunks(
        RetrievalRequest(
            tenant_id=tenant_id,
            knowledge_base_id=knowledge_base_id,
            query_text="boundary activation",
            top_k=1,
        )
    )

    assert response.engine_name == "llamaindex_pilot"
    assert response.retrieval_profile_name == "Reserved Pilot"
    assert response.results[0].document_chunk_id == chunk_id
    assert captured_arguments["retrieval_repository"] is repository
    assert captured_arguments["settings"] is settings
    assert captured_arguments["tenant_id"] == tenant_id
    assert captured_arguments["knowledge_base_id"] == knowledge_base_id
    assert captured_arguments["query_text"] == "boundary activation"
    assert captured_arguments["requested_top_k"] == 1


@pytest.mark.anyio
async def test_compare_chunks_returns_structured_engine_diagnostics(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    tenant_id = uuid4()
    knowledge_base_id = uuid4()
    shared_chunk_id = uuid4()
    native_only_chunk_id = uuid4()
    pilot_only_chunk_id = uuid4()
    now = datetime.now(timezone.utc)

    class FakeRetrievalEngine:
        def __init__(self, engine_name: str) -> None:
            self.engine_name = engine_name

        async def execute(self, **kwargs):
            if self.engine_name == "native":
                rows = [
                    {
                        "document_chunk_id": shared_chunk_id,
                        "document_id": uuid4(),
                        "document_version_id": uuid4(),
                        "knowledge_base_id": knowledge_base_id,
                        "document_title": "RagPilot Handbook",
                        "chunk_index": 0,
                        "content": "Temporal powers durable ingestion workflows.",
                        "token_count": 5,
                        "score": 0.91,
                        "vector_score": 0.9,
                        "lexical_score": 3.0,
                        "lexical_normalized_score": 1.0,
                        "embedding_model": "text-embedding-test",
                        "retrieval_method": "hybrid",
                        "metadata_json": {},
                        "created_at": now,
                    },
                    {
                        "document_chunk_id": native_only_chunk_id,
                        "document_id": uuid4(),
                        "document_version_id": uuid4(),
                        "knowledge_base_id": knowledge_base_id,
                        "document_title": "Native Only",
                        "chunk_index": 1,
                        "content": "Native retrieval found this row only.",
                        "token_count": 6,
                        "score": 0.72,
                        "vector_score": 0.72,
                        "lexical_score": None,
                        "lexical_normalized_score": None,
                        "embedding_model": "text-embedding-test",
                        "retrieval_method": "vector",
                        "metadata_json": {},
                        "created_at": now,
                    },
                ]
            else:
                rows = [
                    {
                        "document_chunk_id": shared_chunk_id,
                        "document_id": uuid4(),
                        "document_version_id": uuid4(),
                        "knowledge_base_id": knowledge_base_id,
                        "document_title": "RagPilot Handbook",
                        "chunk_index": 0,
                        "content": "Temporal powers durable ingestion workflows.",
                        "token_count": 5,
                        "score": 0.91,
                        "vector_score": 0.9,
                        "lexical_score": 3.0,
                        "lexical_normalized_score": 1.0,
                        "embedding_model": "text-embedding-test",
                        "retrieval_method": "hybrid",
                        "metadata_json": {},
                        "created_at": now,
                    },
                    {
                        "document_chunk_id": pilot_only_chunk_id,
                        "document_id": uuid4(),
                        "document_version_id": uuid4(),
                        "knowledge_base_id": knowledge_base_id,
                        "document_title": "Pilot Only",
                        "chunk_index": 2,
                        "content": "Pilot retrieval found this row only.",
                        "token_count": 4,
                        "score": 0.7,
                        "vector_score": None,
                        "lexical_score": 2.4,
                        "lexical_normalized_score": 0.8,
                        "embedding_model": "text-embedding-test",
                        "retrieval_method": "lexical",
                        "metadata_json": {},
                        "created_at": now,
                    },
                ]
            return RetrievalExecutionOutcome(
                retrieval_profile_id=None,
                retrieval_profile_name=f"{self.engine_name} profile",
                retrieval_profile_source="settings_fallback",
                retrieval_mode="hybrid",
                embedding_model="text-embedding-test",
                effective_top_k=2,
                rerank_applied=True,
                rerank_strategy="native_term_density_v1",
                rerank_window=12,
                results=rows,
            )

    monkeypatch.setattr(
        "ragpilot_api.application.retrieval.retrieval_service.build_retrieval_engine",
        lambda settings, engine_name=None: FakeRetrievalEngine(engine_name or "native"),
    )

    service = RetrievalService(
        retrieval_repository=SimpleNamespace(),
        settings=SimpleNamespace(
            retrieval_engine="native",
            retrieval_embedding_dimension=8,
            retrieval_embedding_model="text-embedding-test",
        ),
    )

    response = await service.compare_chunks(
        RetrievalCompareRequest(
            tenant_id=tenant_id,
            knowledge_base_id=knowledge_base_id,
            query_text="durable ingestion workflows",
            top_k=2,
            baseline_engine="native",
            candidate_engine="llamaindex_pilot",
        )
    )

    assert response.baseline.engine_name == "native"
    assert response.candidate.engine_name == "llamaindex_pilot"
    assert response.baseline.rerank_applied is True
    assert response.candidate.rerank_strategy == "native_term_density_v1"
    assert response.baseline.retrieval_method_breakdown == {"hybrid": 1, "vector": 1}
    assert response.candidate.retrieval_method_breakdown == {"hybrid": 1, "lexical": 1}
    assert response.summary.shared_result_count == 1
    assert response.summary.baseline_only_count == 1
    assert response.summary.candidate_only_count == 1
    assert response.summary.top_result_matches is True
    assert response.summary.recommendation_status == "review"
    assert response.summary.shared_chunk_ids == [shared_chunk_id]
    assert response.summary.baseline_only_chunk_ids == [native_only_chunk_id]
    assert response.summary.candidate_only_chunk_ids == [pilot_only_chunk_id]


@pytest.mark.anyio
async def test_compare_chunks_holds_candidate_when_top_result_differs(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    tenant_id = uuid4()
    knowledge_base_id = uuid4()
    baseline_chunk_id = uuid4()
    candidate_chunk_id = uuid4()
    now = datetime.now(timezone.utc)

    class FakeRetrievalEngine:
        def __init__(self, engine_name: str) -> None:
            self.engine_name = engine_name

        async def execute(self, **kwargs):
            rows = [
                {
                    "document_chunk_id": baseline_chunk_id if self.engine_name == "native" else candidate_chunk_id,
                    "document_id": uuid4(),
                    "document_version_id": uuid4(),
                    "knowledge_base_id": knowledge_base_id,
                    "document_title": "Comparison Row",
                    "chunk_index": 0,
                    "content": "Comparison row content.",
                    "token_count": 5,
                    "score": 0.91,
                    "vector_score": 0.9,
                    "lexical_score": 3.0,
                    "lexical_normalized_score": 1.0,
                    "embedding_model": "text-embedding-test",
                    "retrieval_method": "hybrid",
                    "metadata_json": {},
                    "created_at": now,
                }
            ]
            return RetrievalExecutionOutcome(
                retrieval_profile_id=None,
                retrieval_profile_name=f"{self.engine_name} profile",
                retrieval_profile_source="settings_fallback",
                retrieval_mode="hybrid",
                embedding_model="text-embedding-test",
                effective_top_k=1,
                rerank_applied=True,
                rerank_strategy="native_term_density_v1",
                rerank_window=12,
                results=rows,
            )

    monkeypatch.setattr(
        "ragpilot_api.application.retrieval.retrieval_service.build_retrieval_engine",
        lambda settings, engine_name=None: FakeRetrievalEngine(engine_name or "native"),
    )

    service = RetrievalService(
        retrieval_repository=SimpleNamespace(),
        settings=SimpleNamespace(
            retrieval_engine="native",
            retrieval_embedding_dimension=8,
            retrieval_embedding_model="text-embedding-test",
        ),
    )

    response = await service.compare_chunks(
        RetrievalCompareRequest(
            tenant_id=tenant_id,
            knowledge_base_id=knowledge_base_id,
            query_text="comparison drift",
            top_k=1,
            baseline_engine="native",
            candidate_engine="llamaindex_pilot",
        )
    )

    assert response.summary.top_result_matches is False
    assert response.summary.recommendation_status == "hold"
    assert "Top-ranked retrieval differs" in response.summary.recommendation_reason


@pytest.mark.anyio
async def test_record_evaluation_persists_retrieval_review_record() -> None:
    tenant_id = uuid4()
    workspace_id = uuid4()
    knowledge_base_id = uuid4()
    actor_user_id = uuid4()
    now = datetime.now(timezone.utc)
    evaluation_repository = SimpleNamespace(
        create_retrieval_evaluation=AsyncMock(
            return_value=SimpleNamespace(
                id=uuid4(),
                tenant_id=tenant_id,
                workspace_id=workspace_id,
                knowledge_base_id=knowledge_base_id,
                evaluation_mode="compare",
                validation_status="review",
                query_text="Which system runs durable ingestion workflows?",
                baseline_engine_name="native",
                candidate_engine_name="llamaindex_pilot",
                retrieval_profile_name="Standard Hybrid Retrieval",
                retrieval_profile_source="knowledge_base",
                result_count=2,
                shared_result_count=1,
                baseline_only_count=1,
                candidate_only_count=0,
                top_result_matches=True,
                recommendation_reason="Candidate retrieval preserved the top result but needs review.",
                evaluation_payload_json={"summary": {"shared_result_count": 1}},
                created_by_user_id=actor_user_id,
                created_at=now,
                updated_at=now,
            )
        )
    )
    service = RetrievalService(
        retrieval_repository=SimpleNamespace(),
        settings=SimpleNamespace(retrieval_embedding_model="test-embedding"),
        retrieval_evaluation_repository=evaluation_repository,
    )

    response = await service.record_evaluation(
        RetrievalEvaluationCreateRequest(
            tenant_id=tenant_id,
            workspace_id=workspace_id,
            knowledge_base_id=knowledge_base_id,
            evaluation_mode="compare",
            validation_status="review",
            query_text="Which system runs durable ingestion workflows?",
            baseline_engine_name="native",
            candidate_engine_name="llamaindex_pilot",
            retrieval_profile_name="Standard Hybrid Retrieval",
            retrieval_profile_source="knowledge_base",
            result_count=2,
            shared_result_count=1,
            baseline_only_count=1,
            candidate_only_count=0,
            top_result_matches=True,
            recommendation_reason="Candidate retrieval preserved the top result but needs review.",
            evaluation_payload_json={"summary": {"shared_result_count": 1}},
        ),
        created_by_user_id=actor_user_id,
    )

    assert response.validation_status == "review"
    assert response.candidate_engine_name == "llamaindex_pilot"
    evaluation_repository.create_retrieval_evaluation.assert_awaited_once()


@pytest.mark.anyio
async def test_list_evaluations_returns_recent_records() -> None:
    tenant_id = uuid4()
    workspace_id = uuid4()
    knowledge_base_id = uuid4()
    now = datetime.now(timezone.utc)
    evaluation_repository = SimpleNamespace(
        list_retrieval_evaluations=AsyncMock(
            return_value=[
                SimpleNamespace(
                    id=uuid4(),
                    tenant_id=tenant_id,
                    workspace_id=workspace_id,
                    knowledge_base_id=knowledge_base_id,
                    evaluation_mode="inspect",
                    validation_status="ready",
                    query_text="Temporal ingestion workflows",
                    baseline_engine_name="native",
                    candidate_engine_name=None,
                    retrieval_profile_name="Standard Hybrid Retrieval",
                    retrieval_profile_source="knowledge_base",
                    result_count=3,
                    shared_result_count=None,
                    baseline_only_count=None,
                    candidate_only_count=None,
                    top_result_matches=None,
                    recommendation_reason="Three matching chunks were found.",
                    evaluation_payload_json={"results": []},
                    created_by_user_id=uuid4(),
                    created_at=now,
                    updated_at=now,
                )
            ]
        )
    )
    service = RetrievalService(
        retrieval_repository=SimpleNamespace(),
        settings=SimpleNamespace(retrieval_embedding_model="test-embedding"),
        retrieval_evaluation_repository=evaluation_repository,
    )

    response = await service.list_evaluations(
        tenant_id=tenant_id,
        workspace_id=workspace_id,
        knowledge_base_id=knowledge_base_id,
        limit=5,
    )

    assert len(response) == 1
    assert response[0].evaluation_mode == "inspect"
    assert response[0].result_count == 3
    evaluation_repository.list_retrieval_evaluations.assert_awaited_once_with(
        tenant_id=tenant_id,
        workspace_id=workspace_id,
        knowledge_base_id=knowledge_base_id,
        limit=5,
    )


@pytest.mark.anyio
async def test_summarize_evaluations_groups_attention_queries() -> None:
    tenant_id = uuid4()
    workspace_id = uuid4()
    knowledge_base_id = uuid4()
    retrieval_profile_id = uuid4()
    now = datetime.now(timezone.utc)
    repeated_query = "Temporal ingestion workflows"
    evaluation_repository = SimpleNamespace(
        list_retrieval_evaluations=AsyncMock(
            return_value=[
                SimpleNamespace(
                    id=uuid4(),
                    tenant_id=tenant_id,
                    workspace_id=workspace_id,
                    knowledge_base_id=knowledge_base_id,
                    evaluation_mode="compare",
                    validation_status="hold",
                    query_text=repeated_query,
                    baseline_engine_name="native",
                    candidate_engine_name="llamaindex_pilot",
                    retrieval_profile_name="Standard Hybrid Retrieval",
                    retrieval_profile_source="knowledge_base",
                    result_count=1,
                    shared_result_count=0,
                    baseline_only_count=1,
                    candidate_only_count=1,
                    top_result_matches=False,
                    recommendation_reason="Top-ranked retrieval differs.",
                    evaluation_payload_json={
                        "baseline": {
                            "retrieval_profile_id": str(retrieval_profile_id),
                            "results": [
                                {
                                    "document_id": str(uuid4()),
                                    "document_title": "RagPilot Handbook",
                                }
                            ]
                        },
                        "candidate": {
                            "results": [
                                {
                                    "document_id": str(uuid4()),
                                    "document_title": "Operations Notes",
                                }
                            ]
                        },
                    },
                    created_by_user_id=uuid4(),
                    created_at=now,
                    updated_at=now,
                ),
                SimpleNamespace(
                    id=uuid4(),
                    tenant_id=tenant_id,
                    workspace_id=workspace_id,
                    knowledge_base_id=knowledge_base_id,
                    evaluation_mode="compare",
                    validation_status="review",
                    query_text=repeated_query,
                    baseline_engine_name="native",
                    candidate_engine_name="llamaindex_pilot",
                    retrieval_profile_name="Standard Hybrid Retrieval",
                    retrieval_profile_source="knowledge_base",
                    result_count=2,
                    shared_result_count=1,
                    baseline_only_count=1,
                    candidate_only_count=0,
                    top_result_matches=True,
                    recommendation_reason="Needs review.",
                    evaluation_payload_json={},
                    created_by_user_id=uuid4(),
                    created_at=now,
                    updated_at=now,
                ),
                SimpleNamespace(
                    id=uuid4(),
                    tenant_id=tenant_id,
                    workspace_id=workspace_id,
                    knowledge_base_id=knowledge_base_id,
                    evaluation_mode="inspect",
                    validation_status="ready",
                    query_text="Published knowledge base",
                    baseline_engine_name="native",
                    candidate_engine_name=None,
                    retrieval_profile_name="Standard Hybrid Retrieval",
                    retrieval_profile_source="knowledge_base",
                    result_count=3,
                    shared_result_count=None,
                    baseline_only_count=None,
                    candidate_only_count=None,
                    top_result_matches=None,
                    recommendation_reason="Ready.",
                    evaluation_payload_json={},
                    created_by_user_id=uuid4(),
                    created_at=now,
                    updated_at=now,
                ),
            ]
        )
    )
    service = RetrievalService(
        retrieval_repository=SimpleNamespace(),
        settings=SimpleNamespace(retrieval_embedding_model="test-embedding"),
        retrieval_evaluation_repository=evaluation_repository,
    )

    response = await service.summarize_evaluations(
        tenant_id=tenant_id,
        workspace_id=workspace_id,
        knowledge_base_id=knowledge_base_id,
        limit=3,
        sample_size=100,
    )

    assert response.total_evaluations == 3
    assert response.total_queries == 2
    assert response.status_breakdown.ready == 1
    assert response.status_breakdown.review == 1
    assert response.status_breakdown.hold == 1
    assert len(response.candidates) == 1
    assert response.candidates[0].query_text == repeated_query
    assert response.candidates[0].evaluation_count == 2
    assert response.candidates[0].attention_score == 5
    assert response.candidates[0].retrieval_profile_id == retrieval_profile_id
    assert response.candidates[0].latest_source_documents[0].document_title == "RagPilot Handbook"
    evaluation_repository.list_retrieval_evaluations.assert_awaited_once_with(
        tenant_id=tenant_id,
        workspace_id=workspace_id,
        knowledge_base_id=knowledge_base_id,
        limit=100,
    )
