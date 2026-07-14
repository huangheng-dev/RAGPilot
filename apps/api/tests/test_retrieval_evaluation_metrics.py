import pytest

from ragpilot_api.application.retrieval.evaluation_metrics import (
    evaluate_promotion_gates,
    evaluate_ranked_ids,
    summarize_metrics,
)


def test_quality_metrics_calculate_recall_mrr_and_ndcg() -> None:
    metrics = evaluate_ranked_ids(ranked_ids=["noise", "b", "a"], relevant_ids={"a", "b"}, k=3)
    assert metrics.recall_at_k == 1.0
    assert metrics.reciprocal_rank == 0.5
    assert metrics.ndcg_at_k == pytest.approx(0.693426, rel=1e-5)


def test_empty_expected_results_enforce_isolation_and_deletion_regressions() -> None:
    assert evaluate_ranked_ids(ranked_ids=[], relevant_ids=set(), k=5).recall_at_k == 1.0
    assert evaluate_ranked_ids(ranked_ids=["unrelated"], relevant_ids=set(), k=5).recall_at_k == 1.0


def test_promotion_gates_return_machine_readable_failures() -> None:
    rows = [evaluate_ranked_ids(ranked_ids=["a"], relevant_ids={"a"}, k=5)]
    passed, failures = evaluate_promotion_gates(
        metrics=summarize_metrics(rows),
        p95_latency_ms=250,
        gates={"recall_at_k": 0.9, "mrr": 0.8, "ndcg_at_k": 0.8, "max_p95_latency_ms": 200},
    )
    assert passed is False
    assert failures == ["p95_latency_ms=250.00 > 200.00"]
