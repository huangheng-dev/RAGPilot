import pytest

from ragpilot_api.application.retrieval.retrieval_pipeline import (
    build_query_terms,
    merge_retrieval_results,
    normalize_ranked_scores,
    rerank_retrieval_results,
)


def test_rank_percentile_normalization_is_independent_of_bm25_score_scale() -> None:
    low_scale = normalize_ranked_scores(
        [{"document_chunk_id": "a", "lexical_score": 3}, {"document_chunk_id": "b", "lexical_score": 1}],
        score_key="lexical_score",
    )
    high_scale = normalize_ranked_scores(
        [{"document_chunk_id": "a", "lexical_score": 300}, {"document_chunk_id": "b", "lexical_score": 100}],
        score_key="lexical_score",
    )
    assert low_scale == high_scale == {"a": 1.0, "b": 0.5}


def test_build_query_terms_supports_english_and_cjk_queries() -> None:
    english_terms = build_query_terms("Which system powers durable ingestion workflows?")
    chinese_terms = build_query_terms("什么是沉没成本谬误？")

    assert "durable" in english_terms
    assert "ingestion" in english_terms
    assert "workflows" in english_terms

    assert "沉没成本谬误" in chinese_terms
    assert "沉没成本" in chinese_terms
    assert "成本谬误" in chinese_terms


def test_merge_retrieval_results_prefers_meaningful_lexical_signal_over_zero_score_vector_rows() -> None:
    merged = merge_retrieval_results(
        vector_rows=[
            {
                "document_chunk_id": "vector-zero",
                "document_title": "Irrelevant note",
                "content": "No useful lexical overlap.",
                "score": 0.0,
            }
        ],
        lexical_rows=[
            {
                "document_chunk_id": "lexical-hit",
                "document_title": "沉没成本谬误",
                "content": "沉没成本谬误是指...",
                "lexical_score": 6.0,
            }
        ],
        top_k=3,
        retrieval_mode="hybrid",
    )

    assert len(merged) == 1
    assert merged[0]["document_chunk_id"] == "lexical-hit"
    assert merged[0]["retrieval_method"] == "lexical"


def test_merge_retrieval_results_keeps_vector_only_rows_when_no_lexical_rows_exist() -> None:
    merged = merge_retrieval_results(
        vector_rows=[
            {
                "document_chunk_id": "vector-only",
                "document_title": "Fallback",
                "content": "Vector-only result.",
                "score": 0.0,
            }
        ],
        lexical_rows=[],
        top_k=3,
        retrieval_mode="hybrid",
    )

    assert len(merged) == 1
    assert merged[0]["document_chunk_id"] == "vector-only"
    assert merged[0]["retrieval_method"] == "vector"


def test_rerank_retrieval_results_promotes_query_aligned_candidate_within_window() -> None:
    reranked, applied = rerank_retrieval_results(
        rows=[
            {
                "document_chunk_id": "generic-high-score",
                "document_title": "General platform note",
                "content": "Overview of unrelated platform material.",
                "score": 0.91,
                "vector_score": 0.91,
                "lexical_score": None,
                "retrieval_method": "vector",
            },
            {
                "document_chunk_id": "query-aligned",
                "document_title": "Durable ingestion workflows",
                "content": "Temporal powers durable ingestion workflows in RAGPilot.",
                "score": 0.78,
                "vector_score": 0.7,
                "lexical_score": 3.0,
                "retrieval_method": "hybrid",
            },
        ],
        query_text="durable ingestion workflows",
        top_k=2,
        candidate_window=4,
    )

    assert applied is True
    assert reranked[0]["document_chunk_id"] == "query-aligned"
    assert reranked[0]["rerank_score"] > reranked[1]["rerank_score"]
    assert reranked[0]["rerank_rank"] == 1
