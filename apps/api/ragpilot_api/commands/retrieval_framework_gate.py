from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path
from typing import Any
from uuid import UUID

from sqlalchemy import text

from ragpilot_api.application.chat.response_builder import build_grounded_answer
from ragpilot_api.application.retrieval.batch_evaluator import run_batch_evaluation
from ragpilot_api.application.retrieval.retrieval_engines import (
    LlamaIndexPilotRetrievalEngine,
    NativeRetrievalEngine,
)
from ragpilot_api.application.retrieval.retrieval_runtime import ResolvedRetrievalProfile
from ragpilot_api.commands.retrieval_database_gate import GATE_LOCK_KEY, seed_gate_corpus
from ragpilot_api.infrastructure.database.repositories.knowledge_base_repository import (
    KnowledgeBaseRepository,
)
from ragpilot_api.infrastructure.database.repositories.retrieval_profile_repository import (
    RetrievalProfileRepository,
)
from ragpilot_api.infrastructure.database.repositories.retrieval_repository import RetrievalRepository
from ragpilot_api.infrastructure.database.session import async_session_factory
from ragpilot_api.shared.settings import get_settings


def build_profile(*, engine_name: str, top_k: int) -> ResolvedRetrievalProfile:
    return ResolvedRetrievalProfile(
        retrieval_profile_id=None,
        retrieval_profile_name=f"framework-gate-{engine_name}",
        retrieval_mode="hybrid",
        top_k=top_k,
        vector_weight=0.65,
        lexical_weight=0.35,
        hybrid_overlap_bonus=0.05,
        profile_source="versioned_framework_gate",
        engine_name=engine_name,
        engine_version=(
            "llamaindex_authorized_context_v1" if engine_name == "llamaindex_pilot" else "native_v1"
        ),
        llamaindex_similarity_cutoff=0.0,
        llamaindex_long_context_reorder_enabled=True,
    )


async def evaluate_frameworks(dataset: dict[str, Any]) -> dict[str, Any]:
    base_settings = get_settings()
    settings = base_settings.model_copy(
        update={"elasticsearch_retrieval_enabled": False, "retrieval_rerank_enabled": False}
    )
    adapter_case_ids: set[str] = set()
    adapter_versions: set[str] = set()

    async with async_session_factory() as session:
        transaction = await session.begin()
        try:
            print("retrieval framework gate: acquiring isolated transaction lock", file=sys.stderr)
            await session.execute(text("SET LOCAL lock_timeout = '5s'"))
            await session.execute(text("SET LOCAL statement_timeout = '15s'"))
            await session.execute(
                text("SELECT pg_advisory_xact_lock(:lock_key)"), {"lock_key": GATE_LOCK_KEY}
            )
            await seed_gate_corpus(
                session,
                embedding_model=settings.retrieval_embedding_model,
                dimension=settings.retrieval_embedding_dimension,
            )
            retrieval_repository = RetrievalRepository(session)
            knowledge_base_repository = KnowledgeBaseRepository(session)
            retrieval_profile_repository = RetrievalProfileRepository(session)

            def build_retriever(*, engine: Any, engine_name: str):
                async def retrieve(case: dict[str, Any], top_k: int) -> dict[str, Any]:
                    outcome = await engine.execute(
                        retrieval_repository=retrieval_repository,
                        settings=settings,
                        tenant_id=UUID(case["tenant_id"]),
                        knowledge_base_id=UUID(case["knowledge_base_id"]),
                        query_text=case["query"],
                        requested_top_k=top_k,
                        principal_user_id=(
                            UUID(case["principal_user_id"])
                            if case.get("principal_user_id")
                            else None
                        ),
                        acl_bypass=bool(case.get("acl_bypass", False)),
                        knowledge_base_repository=knowledge_base_repository,
                        retrieval_profile_repository=retrieval_profile_repository,
                        resolved_profile=build_profile(engine_name=engine_name, top_k=top_k),
                    )
                    ranked_ids = [str(row["document_chunk_id"]) for row in outcome.results]
                    if engine_name == "llamaindex_pilot":
                        adapter = outcome.rerank_metadata.get("llamaindex_adapter")
                        if isinstance(adapter, dict):
                            adapter_case_ids.add(case["case_id"])
                            adapter_versions.add(str(adapter.get("llamaindex_core_version") or "unknown"))
                    return {
                        "ranked_ids": ranked_ids,
                        "cited_chunk_ids": ranked_ids,
                        "answer_text": build_grounded_answer(
                            question=case["query"], retrieval_results=outcome.results
                        ),
                        "cost_usd": 0.0,
                    }

                return retrieve

            print("retrieval framework gate: evaluating native baseline", file=sys.stderr)
            native_report = await run_batch_evaluation(
                dataset=dataset,
                retriever=build_retriever(engine=NativeRetrievalEngine(), engine_name="native"),
            )
            print("retrieval framework gate: evaluating LlamaIndex candidate", file=sys.stderr)
            llamaindex_report = await run_batch_evaluation(
                dataset=dataset,
                retriever=build_retriever(
                    engine=LlamaIndexPilotRetrievalEngine(), engine_name="llamaindex_pilot"
                ),
            )
        finally:
            await transaction.rollback()

    gates = dataset.get(
        "framework_comparison_gates",
        {
            "max_recall_regression": 0.0,
            "max_mrr_regression": 0.0,
            "max_ndcg_regression": 0.0,
            "max_p95_overhead_ms": 250.0,
            "required_adapter_coverage": 1.0,
        },
    )
    deltas = {
        metric: llamaindex_report["metrics"][metric] - native_report["metrics"][metric]
        for metric in ("recall_at_k", "mrr", "ndcg_at_k")
    }
    p95_overhead_ms = llamaindex_report["p95_latency_ms"] - native_report["p95_latency_ms"]
    expected_case_ids = {case["case_id"] for case in dataset["cases"]}
    adapter_coverage = len(adapter_case_ids & expected_case_ids) / len(expected_case_ids)
    failures: list[str] = []
    if not native_report["promotion"]["passed"]:
        failures.append("native baseline failed its release gates")
    if not llamaindex_report["promotion"]["passed"]:
        failures.append("LlamaIndex candidate failed the shared release gates")
    for metric in ("recall_at_k", "mrr", "ndcg_at_k"):
        maximum = float(gates[f"max_{metric.replace('_at_k', '')}_regression"])
        if deltas[metric] < -maximum:
            failures.append(f"{metric} regression={-deltas[metric]:.4f} > {maximum:.4f}")
    if p95_overhead_ms > float(gates["max_p95_overhead_ms"]):
        failures.append(
            f"p95 overhead={p95_overhead_ms:.2f}ms > {float(gates['max_p95_overhead_ms']):.2f}ms"
        )
    if adapter_coverage < float(gates["required_adapter_coverage"]):
        failures.append(
            f"adapter coverage={adapter_coverage:.4f} < {float(gates['required_adapter_coverage']):.4f}"
        )

    return {
        "dataset_id": dataset["dataset_id"],
        "dataset_version": dataset["version"],
        "comparison": "native_vs_llamaindex_pilot",
        "gates": gates,
        "native": native_report,
        "llamaindex_pilot": llamaindex_report,
        "quality_deltas": deltas,
        "p95_overhead_ms": round(p95_overhead_ms, 3),
        "adapter_coverage": adapter_coverage,
        "llamaindex_core_versions": sorted(adapter_versions),
        "promotion": {"passed": not failures, "failures": failures},
    }


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Compare Native and LlamaIndex retrieval on the same release corpus."
    )
    parser.add_argument("dataset", type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    dataset = json.loads(args.dataset.read_text(encoding="utf-8"))
    report = asyncio.run(evaluate_frameworks(dataset))
    rendered = json.dumps(report, ensure_ascii=False, indent=2)
    if args.output:
        args.output.write_text(rendered + "\n", encoding="utf-8")
    print(rendered)
    raise SystemExit(0 if report["promotion"]["passed"] else 2)


if __name__ == "__main__":
    main()
