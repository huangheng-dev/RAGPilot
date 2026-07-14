from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from ragpilot_api.application.retrieval.retrieval_runtime import execute_retrieval
from ragpilot_api.infrastructure.search.elasticsearch_retrieval_repository import ElasticsearchRetrievalError


def build_settings(**overrides):
    values = {
        "retrieval_embedding_dimension": 8,
        "retrieval_embedding_model": "test-embedding",
        "retrieval_rerank_enabled": False,
        "elasticsearch_retrieval_enabled": True,
        "elasticsearch_url": "http://elasticsearch:9200",
        "elasticsearch_index_prefix": "ragpilot-document-chunks",
        "elasticsearch_request_timeout_seconds": 1.0,
    }
    values.update(overrides)
    return SimpleNamespace(**values)


@pytest.mark.anyio
async def test_execute_retrieval_uses_elasticsearch_bm25(monkeypatch) -> None:
    lexical_row = {
        "document_chunk_id": str(uuid4()),
        "document_id": str(uuid4()),
        "document_version_id": str(uuid4()),
        "knowledge_base_id": str(uuid4()),
        "document_title": "Operations",
        "chunk_index": 0,
        "content": "重大故障必须立即升级。",
        "lexical_score": 9.0,
    }
    elasticsearch_search = AsyncMock(return_value=[lexical_row])
    monkeypatch.setattr(
        "ragpilot_api.application.retrieval.retrieval_runtime.ElasticsearchRetrievalRepository.search_lexical_document_chunks",
        elasticsearch_search,
    )
    repository = SimpleNamespace(
        search_vector_document_chunks=AsyncMock(return_value=[]),
        search_lexical_document_chunks=AsyncMock(return_value=[]),
    )

    outcome = await execute_retrieval(
        retrieval_repository=repository,
        settings=build_settings(),
        tenant_id=uuid4(),
        knowledge_base_id=uuid4(),
        query_text="重大故障",
        requested_top_k=3,
    )

    assert outcome.results[0]["document_chunk_id"] == lexical_row["document_chunk_id"]
    elasticsearch_search.assert_awaited_once()
    repository.search_lexical_document_chunks.assert_not_awaited()


@pytest.mark.anyio
async def test_execute_retrieval_falls_back_to_postgresql_when_elasticsearch_fails(monkeypatch) -> None:
    monkeypatch.setattr(
        "ragpilot_api.application.retrieval.retrieval_runtime.ElasticsearchRetrievalRepository.search_lexical_document_chunks",
        AsyncMock(side_effect=ElasticsearchRetrievalError("unavailable")),
    )
    fallback_row = {
        "document_chunk_id": str(uuid4()),
        "document_id": str(uuid4()),
        "document_version_id": str(uuid4()),
        "knowledge_base_id": str(uuid4()),
        "document_title": "Fallback",
        "chunk_index": 0,
        "content": "PostgreSQL fallback",
        "lexical_score": 4.0,
    }
    repository = SimpleNamespace(
        search_vector_document_chunks=AsyncMock(return_value=[]),
        search_lexical_document_chunks=AsyncMock(return_value=[fallback_row]),
    )

    outcome = await execute_retrieval(
        retrieval_repository=repository,
        settings=build_settings(),
        tenant_id=uuid4(),
        knowledge_base_id=uuid4(),
        query_text="fallback",
        requested_top_k=3,
    )

    assert outcome.results[0]["document_chunk_id"] == fallback_row["document_chunk_id"]
    repository.search_lexical_document_chunks.assert_awaited_once()
