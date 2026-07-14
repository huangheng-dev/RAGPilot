from __future__ import annotations

import re
from typing import Any


VECTOR_WEIGHT = 0.65
LEXICAL_WEIGHT = 0.35
HYBRID_OVERLAP_BONUS = 0.05
MAX_QUERY_TERMS = 24
DEFAULT_RERANK_STRATEGY = "native_term_density_v1"
DEFAULT_SCORE_NORMALIZATION_STRATEGY = "rank_percentile_v1"


def normalize_ranked_scores(rows: list[dict[str, Any]], *, score_key: str) -> dict[object, float]:
    """Return bounded rank-percentile scores so BM25 scales remain query-independent."""
    ranked = sorted(
        rows,
        key=lambda row: float(row.get(score_key) or 0.0),
        reverse=True,
    )
    count = len(ranked)
    if count == 0:
        return {}
    if count == 1:
        return {ranked[0]["document_chunk_id"]: 1.0}
    return {
        row["document_chunk_id"]: 1.0 - (rank / count)
        for rank, row in enumerate(ranked)
    }


def normalize_query_text(query_text: str) -> str:
    normalized = re.sub(r"\s+", " ", query_text.strip().lower())
    return normalized


def build_query_terms(query_text: str) -> list[str]:
    normalized = normalize_query_text(query_text)
    deduplicated_terms: list[str] = []

    def append_term(term: str) -> None:
        if len(term) < 2 or term in deduplicated_terms:
            return
        deduplicated_terms.append(term)

    for term in re.split(r"[^a-z0-9]+", normalized):
        append_term(term)

    for span in re.findall(r"[\u4e00-\u9fff]+", normalized):
        append_term(span)
        for prefix in ("什么是", "如何", "怎么", "请问"):
            if span.startswith(prefix):
                append_term(span[len(prefix) :])
        max_ngram_length = min(len(span), 8)
        # Preserve short CJK concepts first. Longest-first exhausted the bounded
        # term budget and made PostgreSQL fallback miss phrases such as 重大故障.
        for ngram_length in range(2, max_ngram_length + 1):
            for index in range(0, len(span) - ngram_length + 1):
                append_term(span[index : index + ngram_length])
                if len(deduplicated_terms) >= MAX_QUERY_TERMS:
                    return deduplicated_terms

    return deduplicated_terms[:MAX_QUERY_TERMS]


def build_rerank_score(
    *,
    row: dict[str, Any],
    normalized_query: str,
    query_terms: list[str],
) -> float:
    base_score = max(float(row.get("score") or 0.0), 0.0)
    title_text = normalize_query_text(str(row.get("document_title") or ""))
    content_text = normalize_query_text(str(row.get("content") or ""))
    combined_text = f"{title_text} {content_text}".strip()

    phrase_match = 1.0 if normalized_query and normalized_query in combined_text else 0.0
    title_phrase_match = 1.0 if normalized_query and normalized_query in title_text else 0.0

    if query_terms:
        matched_terms = sum(1 for term in query_terms if term in combined_text)
        matched_title_terms = sum(1 for term in query_terms if term in title_text)
        term_coverage = matched_terms / len(query_terms)
        title_term_coverage = matched_title_terms / len(query_terms)
    else:
        term_coverage = 0.0
        title_term_coverage = 0.0

    retrieval_method_bonus = {
        "hybrid": 0.05,
        "lexical": 0.03,
        "vector": 0.0,
    }.get(str(row.get("retrieval_method") or "").strip().lower(), 0.0)

    return (
        (base_score * 0.55)
        + (term_coverage * 0.22)
        + (title_term_coverage * 0.1)
        + (phrase_match * 0.08)
        + (title_phrase_match * 0.03)
        + retrieval_method_bonus
    )


def has_meaningful_vector_signal(score: float | None) -> bool:
    return score is not None and score > 0.0


def should_keep_vector_only_row(*, vector_score: float, lexical_rows_present: bool) -> bool:
    if not lexical_rows_present:
        return True
    return has_meaningful_vector_signal(vector_score)


def merge_retrieval_results(
    *,
    vector_rows: list[dict[str, Any]],
    lexical_rows: list[dict[str, Any]],
    top_k: int,
    retrieval_mode: str = "hybrid",
    vector_weight: float = VECTOR_WEIGHT,
    lexical_weight: float = LEXICAL_WEIGHT,
    hybrid_overlap_bonus: float = HYBRID_OVERLAP_BONUS,
    score_normalization_strategy: str = DEFAULT_SCORE_NORMALIZATION_STRATEGY,
) -> list[dict[str, Any]]:
    if retrieval_mode == "vector":
        return build_vector_results(vector_rows=vector_rows, top_k=top_k)
    if retrieval_mode == "lexical":
        return build_lexical_results(lexical_rows=lexical_rows, top_k=top_k)

    lexical_max_score = max((max(float(row.get("lexical_score") or 0.0), 0.0) for row in lexical_rows), default=0.0)
    lexical_rank_scores = normalize_ranked_scores(lexical_rows, score_key="lexical_score")
    lexical_rows_present = lexical_max_score > 0.0 or len(lexical_rows) > 0
    merged_by_chunk_id: dict[object, dict[str, Any]] = {}

    for row in vector_rows:
        chunk_id = row["document_chunk_id"]
        vector_score = max(float(row.get("score") or 0.0), 0.0)
        if not should_keep_vector_only_row(vector_score=vector_score, lexical_rows_present=lexical_rows_present):
            continue
        merged_by_chunk_id[chunk_id] = {
            **row,
            "score": vector_score,
            "vector_score": vector_score,
            "lexical_score": None,
            "lexical_normalized_score": None,
            "retrieval_method": "vector",
        }

    for row in lexical_rows:
        chunk_id = row["document_chunk_id"]
        lexical_score = max(float(row.get("lexical_score") or 0.0), 0.0)
        lexical_normalized_score = (
            lexical_rank_scores.get(chunk_id, 0.0)
            if score_normalization_strategy == DEFAULT_SCORE_NORMALIZATION_STRATEGY
            else (lexical_score / lexical_max_score) if lexical_max_score > 0 else 0.0
        )

        if chunk_id in merged_by_chunk_id:
            existing = merged_by_chunk_id[chunk_id]
            vector_score = max(float(existing.get("vector_score") or 0.0), 0.0)
            fused_score = (vector_weight * vector_score) + (lexical_weight * lexical_normalized_score) + hybrid_overlap_bonus
            existing.update(
                {
                    **{key: value for key, value in row.items() if key not in {"score", "lexical_score"}},
                    "score": fused_score,
                    "vector_score": vector_score,
                    "lexical_score": lexical_score,
                    "lexical_normalized_score": lexical_normalized_score,
                    "retrieval_method": "hybrid",
                    "embedding_model": existing.get("embedding_model") or row.get("embedding_model"),
                }
            )
            continue

        merged_by_chunk_id[chunk_id] = {
            **row,
            "score": lexical_normalized_score,
            "vector_score": None,
            "lexical_score": lexical_score,
            "lexical_normalized_score": lexical_normalized_score,
            "retrieval_method": "lexical",
            "embedding_model": row.get("embedding_model"),
        }

    merged_rows = list(merged_by_chunk_id.values())
    merged_rows.sort(
        key=lambda row: (
            float(row.get("score") or 0.0),
            float(row.get("vector_score") or 0.0),
            float(row.get("lexical_score") or 0.0),
        ),
        reverse=True,
    )
    return merged_rows[:top_k]


def rerank_retrieval_results(
    *,
    rows: list[dict[str, Any]],
    query_text: str,
    top_k: int,
    candidate_window: int,
) -> tuple[list[dict[str, Any]], bool]:
    if not rows:
        return [], False

    normalized_query = normalize_query_text(query_text)
    query_terms = build_query_terms(query_text)
    if normalized_query == "" and not query_terms:
        return rows[:top_k], False

    window = max(top_k, candidate_window)
    rerank_candidates: list[dict[str, Any]] = []
    for row in rows[:window]:
        rerank_score = build_rerank_score(
            row=row,
            normalized_query=normalized_query,
            query_terms=query_terms,
        )
        rerank_candidates.append(
            {
                **row,
                "rerank_score": rerank_score,
            }
        )

    rerank_candidates.sort(
        key=lambda row: (
            float(row.get("rerank_score") or 0.0),
            float(row.get("score") or 0.0),
            float(row.get("vector_score") or 0.0),
            float(row.get("lexical_score") or 0.0),
        ),
        reverse=True,
    )

    for index, row in enumerate(rerank_candidates, start=1):
        row["rerank_rank"] = index

    return rerank_candidates[:top_k], True


def build_vector_results(*, vector_rows: list[dict[str, Any]], top_k: int) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    for row in vector_rows[:top_k]:
        vector_score = max(float(row.get("score") or 0.0), 0.0)
        results.append(
            {
                **row,
                "score": vector_score,
                "vector_score": vector_score,
                "lexical_score": None,
                "lexical_normalized_score": None,
                "retrieval_method": "vector",
            }
        )
    return results


def build_lexical_results(*, lexical_rows: list[dict[str, Any]], top_k: int) -> list[dict[str, Any]]:
    lexical_max_score = max((max(float(row.get("lexical_score") or 0.0), 0.0) for row in lexical_rows), default=0.0)
    results: list[dict[str, Any]] = []
    for row in lexical_rows[:top_k]:
        lexical_score = max(float(row.get("lexical_score") or 0.0), 0.0)
        lexical_normalized_score = (lexical_score / lexical_max_score) if lexical_max_score > 0 else 0.0
        results.append(
            {
                **row,
                "score": lexical_normalized_score,
                "vector_score": None,
                "lexical_score": lexical_score,
                "lexical_normalized_score": lexical_normalized_score,
                "retrieval_method": "lexical",
                "embedding_model": row.get("embedding_model"),
            }
        )

    results.sort(
        key=lambda row: (
            float(row.get("score") or 0.0),
            float(row.get("lexical_score") or 0.0),
        ),
        reverse=True,
    )
    return results[:top_k]
