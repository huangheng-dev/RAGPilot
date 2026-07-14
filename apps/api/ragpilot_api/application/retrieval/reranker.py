from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass
from typing import Any, Protocol

from ragpilot_api.application.retrieval.retrieval_pipeline import rerank_retrieval_results
from ragpilot_api.infrastructure.observability import traced


class Reranker(Protocol):
    name: str
    async def rerank(self, *, rows: list[dict[str, Any]], query_text: str, top_k: int, candidate_window: int) -> tuple[list[dict[str, Any]], bool]: ...


@dataclass(frozen=True)
class NativeReranker:
    name: str = "native_term_density_v1"
    async def rerank(self, *, rows, query_text, top_k, candidate_window):
        return rerank_retrieval_results(rows=rows, query_text=query_text, top_k=top_k, candidate_window=candidate_window)


@traced("retrieval.rerank")
async def run_reranker(*, reranker: Reranker, fallback: Reranker, timeout_seconds: float, **kwargs) -> tuple[list[dict[str, Any]], bool, dict[str, Any]]:
    started = time.perf_counter()
    try:
        rows, applied = await asyncio.wait_for(reranker.rerank(**kwargs), timeout=timeout_seconds)
        if not rows and kwargs["rows"]:
            raise RuntimeError("reranker_removed_all_evidence")
        return rows, applied, {"provider": reranker.name, "fallback_applied": False, "latency_ms": (time.perf_counter() - started) * 1000}
    except Exception as exc:
        rows, applied = await fallback.rerank(**kwargs)
        return rows, applied, {"provider": fallback.name, "fallback_applied": True, "fallback_reason": type(exc).__name__, "latency_ms": (time.perf_counter() - started) * 1000}
