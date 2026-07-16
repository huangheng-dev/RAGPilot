from __future__ import annotations

from typing import Any

from ragpilot_api.application.retrieval.evaluation_metrics import evaluate_ranked_ids, summarize_metrics
from ragpilot_api.application.retrieval.retrieval_pipeline import merge_retrieval_results, rerank_retrieval_results


def calibrate_fusion(*, cases: list[dict[str, Any]], top_k: int, weight_grid: list[float], bonus_grid: list[float], current: tuple[float, float]) -> dict[str, Any]:
    candidates = []
    for vector_weight in weight_grid:
        lexical_weight = round(1.0 - vector_weight, 6)
        for bonus in bonus_grid:
            rows_metrics = []
            forbidden_hits = 0
            for case in cases:
                merged = merge_retrieval_results(
                    vector_rows=case["vector_rows"], lexical_rows=case["lexical_rows"], top_k=max(top_k, 12),
                    vector_weight=vector_weight, lexical_weight=lexical_weight, hybrid_overlap_bonus=bonus,
                )
                ranked, _ = rerank_retrieval_results(rows=merged, query_text=case["query"], top_k=top_k, candidate_window=12)
                ids = [str(row["document_chunk_id"]) for row in ranked]
                rows_metrics.append(evaluate_ranked_ids(ranked_ids=ids, relevant_ids=set(case["relevant_chunk_ids"]), k=top_k))
                forbidden_hits += len(set(ids) & set(case.get("forbidden_chunk_ids", [])))
            metrics = summarize_metrics(rows_metrics)
            distance = abs(vector_weight - current[0]) + abs(bonus - current[1])
            candidates.append({"vector_weight": vector_weight, "lexical_weight": lexical_weight, "hybrid_overlap_bonus": bonus, **metrics, "forbidden_hits": forbidden_hits, "distance_from_current": round(distance, 6)})
    candidates.sort(key=lambda row: (row["forbidden_hits"] == 0, row["recall_at_k"], row["mrr"], row["ndcg_at_k"], -row["distance_from_current"]), reverse=True)
    return {"recommended": candidates[0], "current": {"vector_weight": current[0], "hybrid_overlap_bonus": current[1]}, "candidates": candidates}
