from types import SimpleNamespace

import pytest

from ragpilot_api.application.retrieval.retrieval_engines import (
    LlamaIndexPilotRetrievalEngine,
    LlamaIndexRuntime,
    NativeRetrievalEngine,
    build_retrieval_engine,
    normalize_retrieval_engine_name,
    run_llamaindex_pilot_postprocessing,
)


def test_build_retrieval_engine_returns_native_engine_by_default() -> None:
    settings = SimpleNamespace(retrieval_engine="native")

    engine = build_retrieval_engine(settings)

    assert isinstance(engine, NativeRetrievalEngine)


def test_build_retrieval_engine_returns_llamaindex_pilot_engine() -> None:
    settings = SimpleNamespace(retrieval_engine="llamaindex_pilot")

    engine = build_retrieval_engine(settings)

    assert isinstance(engine, LlamaIndexPilotRetrievalEngine)


def test_build_retrieval_engine_keeps_reserved_alias_compatible() -> None:
    settings = SimpleNamespace(retrieval_engine="llamaindex_reserved")

    engine = build_retrieval_engine(settings)

    assert isinstance(engine, LlamaIndexPilotRetrievalEngine)


def test_normalize_retrieval_engine_name_maps_reserved_alias_to_pilot() -> None:
    assert normalize_retrieval_engine_name("llamaindex_reserved") == "llamaindex_pilot"
    assert normalize_retrieval_engine_name(" native ") == "native"


def test_build_retrieval_engine_rejects_unknown_engine() -> None:
    settings = SimpleNamespace(retrieval_engine="unknown")

    with pytest.raises(ValueError, match="Unsupported retrieval engine"):
        build_retrieval_engine(settings)


def test_run_llamaindex_pilot_postprocessing_preserves_retrieval_order_and_rows() -> None:
    class FakeTextNode:
        def __init__(self, *, id_: str, text: str, metadata: dict[str, object]) -> None:
            self.node_id = id_
            self.text = text
            self.metadata = metadata

    class FakeNodeWithScore:
        def __init__(self, *, node: FakeTextNode, score: float | None = None) -> None:
            self.node = node
            self.score = score

    class FakeQueryBundle:
        def __init__(self, *, query_str: str) -> None:
            self.query_str = query_str

    class FakeBasePostprocessor:
        def postprocess_nodes(self, nodes, query_bundle=None):
            return self._postprocess_nodes(nodes, query_bundle=query_bundle)

    runtime = LlamaIndexRuntime(
        text_node_cls=FakeTextNode,
        node_with_score_cls=FakeNodeWithScore,
        query_bundle_cls=FakeQueryBundle,
        base_postprocessor_cls=FakeBasePostprocessor,
    )
    row_one = {"document_chunk_id": "chunk-1", "document_title": "One", "content": "alpha", "retrieval_method": "hybrid", "score": 0.9}
    row_two = {"document_chunk_id": "chunk-2", "document_title": "Two", "content": "beta", "retrieval_method": "lexical", "score": 0.7}

    processed = run_llamaindex_pilot_postprocessing(
        runtime=runtime,
        query_text="alpha beta",
        results=[row_one, row_two],
        top_k=2,
    )

    assert processed == [row_one, row_two]
