from __future__ import annotations

import argparse
import asyncio
import json
from pathlib import Path
from uuid import UUID

from ragpilot_api.application.retrieval.batch_evaluator import run_batch_evaluation, validate_evaluation_dataset
from ragpilot_api.application.retrieval.retrieval_runtime import execute_retrieval
from ragpilot_api.infrastructure.database.repositories.knowledge_base_repository import KnowledgeBaseRepository
from ragpilot_api.infrastructure.database.repositories.retrieval_profile_repository import RetrievalProfileRepository
from ragpilot_api.infrastructure.database.repositories.retrieval_repository import RetrievalRepository
from ragpilot_api.infrastructure.database.session import async_session_factory
from ragpilot_api.shared.settings import get_settings
from ragpilot_api.application.chat.response_builder import build_grounded_answer


async def evaluate(dataset: dict, *, gate_profile: str) -> dict:
    validate_evaluation_dataset(dataset, require_queries=True)
    settings = get_settings()
    async with async_session_factory() as session:
        repository = RetrievalRepository(session)

        async def retrieve(case: dict, top_k: int) -> list[str]:
            outcome = await execute_retrieval(
                retrieval_repository=repository, settings=settings,
                tenant_id=UUID(case["tenant_id"]), knowledge_base_id=UUID(case["knowledge_base_id"]),
                query_text=case["query"], requested_top_k=top_k,
                knowledge_base_repository=KnowledgeBaseRepository(session),
                retrieval_profile_repository=RetrievalProfileRepository(session),
            )
            ranked_ids = [str(row["document_chunk_id"]) for row in outcome.results]
            answer = build_grounded_answer(question=case["query"], retrieval_results=outcome.results)
            estimated_tokens = (sum(len(str(row.get("content", ""))) for row in outcome.results) + len(answer)) / 4
            return {"ranked_ids": ranked_ids, "cited_chunk_ids": ranked_ids, "answer_text": answer, "cost_usd": estimated_tokens / 1000 * float(dataset.get("estimated_cost_per_1k_tokens_usd", 0.0))}

        return await run_batch_evaluation(dataset=dataset, retriever=retrieve, gate_profile=gate_profile)


def main() -> None:
    parser = argparse.ArgumentParser(description="Run a versioned RAGPilot retrieval regression dataset.")
    parser.add_argument("dataset", type=Path)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--gate-profile", default="normal", choices=("normal", "fallback"))
    args = parser.parse_args()
    dataset = json.loads(args.dataset.read_text(encoding="utf-8"))
    report = asyncio.run(evaluate(dataset, gate_profile=args.gate_profile))
    rendered = json.dumps(report, ensure_ascii=False, indent=2)
    if args.output:
        args.output.write_text(rendered + "\n", encoding="utf-8")
    print(rendered)
    raise SystemExit(0 if report["promotion"]["passed"] else 2)


if __name__ == "__main__":
    main()
