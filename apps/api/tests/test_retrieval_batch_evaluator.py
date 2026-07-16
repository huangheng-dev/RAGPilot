import pytest

from ragpilot_api.application.retrieval.batch_evaluator import percentile, run_batch_evaluation


def test_percentile_uses_nearest_rank() -> None:
    assert percentile([1, 2, 3, 4, 5], 0.95) == 5


@pytest.mark.anyio
async def test_batch_evaluator_builds_category_report_and_promotion_result() -> None:
    dataset = {
        "dataset_id": "baseline", "version": "1", "top_k": 3,
        "gates": {"recall_at_k": 1, "mrr": 1, "ndcg_at_k": 1, "max_p95_latency_ms": 1000},
        "cases": [
            {"case_id": "zh-1", "category": "cjk", "relevant_chunk_ids": ["a"]},
            {"case_id": "isolation-1", "category": "tenant_isolation", "relevant_chunk_ids": []},
        ],
    }

    async def retrieve(case, top_k):
        return ["a"] if case["case_id"] == "zh-1" else []

    report = await run_batch_evaluation(dataset=dataset, retriever=retrieve)
    assert report["case_count"] == 2
    assert report["promotion"]["passed"] is True
    assert set(report["category_metrics"]) == {"cjk", "tenant_isolation"}


@pytest.mark.anyio
async def test_batch_evaluator_blocks_forbidden_cross_scope_or_deleted_chunks() -> None:
    dataset = {
        "dataset_id": "isolation", "version": "1", "top_k": 3,
        "gates": {"recall_at_k": 1, "mrr": 1, "ndcg_at_k": 1, "max_p95_latency_ms": 1000},
        "cases": [{"case_id": "deleted", "category": "deletion", "relevant_chunk_ids": [], "forbidden_chunk_ids": ["deleted-id"]}],
    }
    async def retrieve(case, top_k):
        return ["deleted-id"]
    report = await run_batch_evaluation(dataset=dataset, retriever=retrieve)
    assert report["promotion"]["passed"] is False
    assert report["cases"][0]["forbidden_hits"] == ["deleted-id"]
