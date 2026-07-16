import asyncio

import pytest

from ragpilot_api.application.retrieval.reranker import NativeReranker, run_reranker


class EmptyReranker:
    name = "empty-provider"
    async def rerank(self, **kwargs):
        return [], True


class SlowReranker:
    name = "slow-provider"
    async def rerank(self, **kwargs):
        await asyncio.sleep(0.05)
        return kwargs["rows"], True


@pytest.mark.anyio
@pytest.mark.parametrize("provider", [EmptyReranker(), SlowReranker()])
async def test_reranker_timeout_or_empty_evidence_falls_back(provider) -> None:
    rows = [{"document_chunk_id": "a", "document_title": "alpha", "content": "alpha", "score": 1, "retrieval_method": "hybrid"}]
    result, applied, metadata = await run_reranker(
        reranker=provider, fallback=NativeReranker(), timeout_seconds=0.01,
        rows=rows, query_text="alpha", top_k=1, candidate_window=1,
    )
    assert result
    assert applied is True
    assert metadata["fallback_applied"] is True
    assert metadata["provider"] == "native_term_density_v1"
