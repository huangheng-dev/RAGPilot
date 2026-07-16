from __future__ import annotations

import argparse
import asyncio
import json
from pathlib import Path
from typing import Any

from ragpilot_api.application.retrieval.batch_evaluator import run_batch_evaluation, validate_evaluation_dataset


async def evaluate_contract(dataset: dict[str, Any]) -> dict[str, Any]:
    validate_evaluation_dataset(dataset, require_fixture_observations=True, require_queries=True)

    async def retrieve(case: dict[str, Any], top_k: int) -> dict[str, Any]:
        observation = dict(case["fixture_observation"])
        observation["ranked_ids"] = list(observation["ranked_ids"])[:top_k]
        return observation

    return await run_batch_evaluation(dataset=dataset, retriever=retrieve)


def main() -> None:
    parser = argparse.ArgumentParser(description="Run a deterministic versioned retrieval dataset contract gate.")
    parser.add_argument("dataset", type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    dataset = json.loads(args.dataset.read_text(encoding="utf-8"))
    report = asyncio.run(evaluate_contract(dataset))
    rendered = json.dumps(report, ensure_ascii=False, indent=2)
    if args.output:
        args.output.write_text(rendered + "\n", encoding="utf-8")
    print(rendered)
    raise SystemExit(0 if report["promotion"]["passed"] else 2)


if __name__ == "__main__":
    main()
