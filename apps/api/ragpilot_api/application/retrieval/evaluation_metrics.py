from __future__ import annotations

import math
from dataclasses import dataclass
from statistics import mean
from typing import Sequence


@dataclass(frozen=True)
class QueryQualityMetrics:
    recall_at_k: float
    reciprocal_rank: float
    ndcg_at_k: float


def evaluate_ranked_ids(*, ranked_ids: Sequence[str], relevant_ids: set[str], k: int) -> QueryQualityMetrics:
    ranked = list(ranked_ids[:k])
    if not relevant_ids:
        return QueryQualityMetrics(1.0, 1.0, 1.0)
    hits = [1 if item in relevant_ids else 0 for item in ranked]
    recall = len(set(ranked) & relevant_ids) / len(relevant_ids)
    first_rank = next((index for index, hit in enumerate(hits, 1) if hit), None)
    reciprocal_rank = 1.0 / first_rank if first_rank else 0.0
    dcg = sum(hit / math.log2(index + 1) for index, hit in enumerate(hits, 1))
    ideal_hits = min(len(relevant_ids), k)
    ideal_dcg = sum(1.0 / math.log2(index + 1) for index in range(1, ideal_hits + 1))
    return QueryQualityMetrics(recall, reciprocal_rank, dcg / ideal_dcg if ideal_dcg else 0.0)


def summarize_metrics(rows: Sequence[QueryQualityMetrics]) -> dict[str, float]:
    if not rows:
        return {"recall_at_k": 0.0, "mrr": 0.0, "ndcg_at_k": 0.0}
    return {
        "recall_at_k": mean(row.recall_at_k for row in rows),
        "mrr": mean(row.reciprocal_rank for row in rows),
        "ndcg_at_k": mean(row.ndcg_at_k for row in rows),
    }


def evaluate_promotion_gates(
    *, metrics: dict[str, float], p95_latency_ms: float, gates: dict[str, float], groundedness: float = 1.0, citation_coverage: float = 1.0, total_cost_usd: float = 0.0
) -> tuple[bool, list[str]]:
    failures: list[str] = []
    for key in ("recall_at_k", "mrr", "ndcg_at_k"):
        if metrics.get(key, 0.0) < gates[key]:
            failures.append(f"{key}={metrics.get(key, 0.0):.4f} < {gates[key]:.4f}")
    if p95_latency_ms > gates["max_p95_latency_ms"]:
        failures.append(f"p95_latency_ms={p95_latency_ms:.2f} > {gates['max_p95_latency_ms']:.2f}")
    return not failures, failures
    if groundedness < gates.get("min_groundedness", 0.0):
        failures.append(f"groundedness={groundedness:.4f} < {gates['min_groundedness']:.4f}")
    if citation_coverage < gates.get("min_citation_coverage", 0.0):
        failures.append(f"citation_coverage={citation_coverage:.4f} < {gates['min_citation_coverage']:.4f}")
    if total_cost_usd > gates.get("max_total_cost_usd", float("inf")):
        failures.append(f"total_cost_usd={total_cost_usd:.6f} > {gates['max_total_cost_usd']:.6f}")
