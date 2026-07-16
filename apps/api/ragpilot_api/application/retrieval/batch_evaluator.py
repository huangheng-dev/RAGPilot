from __future__ import annotations

import time
from collections import defaultdict
from typing import Any, Awaitable, Callable

from ragpilot_api.application.retrieval.evaluation_metrics import (
    evaluate_promotion_gates,
    evaluate_ranked_ids,
    summarize_metrics,
)

Retriever = Callable[[dict[str, Any], int], Awaitable[Any]]


def validate_evaluation_dataset(
    dataset: dict[str, Any], *, require_fixture_observations: bool = False, require_queries: bool = False,
) -> None:
    required_root_fields = ("dataset_id", "version", "top_k", "gates", "cases")
    missing_root_fields = [field for field in required_root_fields if field not in dataset]
    if missing_root_fields:
        raise ValueError(f"Evaluation dataset is missing required fields: {', '.join(missing_root_fields)}")
    if dataset.get("schema_version") not in (None, "1"):
        raise ValueError("Unsupported evaluation dataset schema_version.")
    if not isinstance(dataset["cases"], list) or not dataset["cases"]:
        raise ValueError("Evaluation dataset must contain at least one case.")
    required_gate_fields = ("recall_at_k", "mrr", "ndcg_at_k", "max_p95_latency_ms")
    missing_gate_fields = [field for field in required_gate_fields if field not in dataset["gates"]]
    if missing_gate_fields:
        raise ValueError(f"Evaluation dataset gates are missing required fields: {', '.join(missing_gate_fields)}")
    seen_case_ids: set[str] = set()
    for case in dataset["cases"]:
        required_case_fields = ("case_id", "category", "relevant_chunk_ids") + (("query",) if require_queries else ())
        missing_case_fields = [field for field in required_case_fields if field not in case]
        if missing_case_fields:
            raise ValueError(f"Evaluation case is missing required fields: {', '.join(missing_case_fields)}")
        if case["case_id"] in seen_case_ids:
            raise ValueError(f"Evaluation dataset contains duplicate case_id: {case['case_id']}")
        seen_case_ids.add(case["case_id"])
        if require_fixture_observations and "fixture_observation" not in case:
            raise ValueError(f"Evaluation case {case['case_id']} is missing fixture_observation.")


def percentile(values: list[float], percentile_value: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    index = max(0, min(len(ordered) - 1, int((len(ordered) - 1) * percentile_value + 0.999999)))
    return ordered[index]


async def run_batch_evaluation(*, dataset: dict[str, Any], retriever: Retriever, gate_profile: str = "normal") -> dict[str, Any]:
    validate_evaluation_dataset(dataset)
    top_k = int(dataset["top_k"])
    warmup_latencies: list[float] = []
    if dataset.get("cases"):
        for _ in range(int(dataset.get("warmup_runs", 0))):
            started = time.perf_counter()
            await retriever(dataset["cases"][0], top_k)
            warmup_latencies.append((time.perf_counter() - started) * 1000)
    case_reports: list[dict[str, Any]] = []
    metrics = []
    latencies: list[float] = []
    by_category: dict[str, list] = defaultdict(list)
    forbidden_failures: list[str] = []
    for case in dataset["cases"]:
        started = time.perf_counter()
        observation = await retriever(case, top_k)
        if isinstance(observation, dict):
            ranked_ids = observation["ranked_ids"]
        else:
            ranked_ids = observation
            observation = {"ranked_ids": ranked_ids}
        latency_ms = (time.perf_counter() - started) * 1000
        row = evaluate_ranked_ids(
            ranked_ids=ranked_ids,
            relevant_ids=set(case["relevant_chunk_ids"]),
            k=top_k,
        )
        forbidden_hits = sorted(set(ranked_ids) & set(case.get("forbidden_chunk_ids", [])))
        if forbidden_hits:
            forbidden_failures.append(f"{case['case_id']}: forbidden chunks returned: {','.join(forbidden_hits)}")
        metrics.append(row)
        by_category[case["category"]].append(row)
        latencies.append(latency_ms)
        expected_facts = case.get("expected_facts", [])
        answer = str(observation.get("answer_text", "")).lower()
        groundedness = (sum(1 for fact in expected_facts if fact.lower() in answer) / len(expected_facts)) if expected_facts else 1.0
        cited = set(observation.get("cited_chunk_ids", ranked_ids))
        relevant = set(case["relevant_chunk_ids"])
        citation_coverage = (len(cited & relevant) / len(relevant)) if relevant else 1.0
        cost_usd = float(observation.get("cost_usd", 0.0))
        case_reports.append({
            "case_id": case["case_id"], "category": case["category"],
            "latency_ms": round(latency_ms, 3), "ranked_chunk_ids": ranked_ids,
            "forbidden_hits": forbidden_hits, "groundedness": groundedness, "citation_coverage": citation_coverage, "cost_usd": cost_usd, **summarize_metrics([row]),
        })
    summary = summarize_metrics(metrics)
    p95 = percentile(latencies, 0.95)
    gates = dataset.get("gate_profiles", {}).get(gate_profile, dataset["gates"])
    groundedness = sum(row["groundedness"] for row in case_reports) / len(case_reports)
    citation_coverage = sum(row["citation_coverage"] for row in case_reports) / len(case_reports)
    total_cost = sum(row["cost_usd"] for row in case_reports)
    passed, failures = evaluate_promotion_gates(metrics=summary, p95_latency_ms=p95, gates=gates, groundedness=groundedness, citation_coverage=citation_coverage, total_cost_usd=total_cost)
    failures.extend(forbidden_failures)
    passed = passed and not forbidden_failures
    return {
        "dataset_id": dataset["dataset_id"], "dataset_version": dataset["version"],
        "case_count": len(case_reports), "top_k": top_k, "gate_profile": gate_profile, "gates": gates,
        "warmup_runs": len(warmup_latencies), "warmup_latency_ms": [round(value, 3) for value in warmup_latencies], "metrics": summary,
        "p95_latency_ms": round(p95, 3), "groundedness": groundedness, "citation_coverage": citation_coverage, "total_cost_usd": total_cost, "category_metrics": {
            key: summarize_metrics(value) for key, value in sorted(by_category.items())
        },
        "promotion": {"passed": passed, "failures": failures}, "cases": case_reports,
    }
