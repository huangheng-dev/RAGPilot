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


def test_run_llamaindex_pilot_postprocessing_uses_authorized_retriever_and_processors() -> None:
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

    class FakeBaseRetriever:
        def retrieve(self, query_bundle):
            return self._retrieve(query_bundle)

    class FakeSimilarityPostprocessor:
        def __init__(self, *, similarity_cutoff: float) -> None:
            self.similarity_cutoff = similarity_cutoff

        def postprocess_nodes(self, nodes, query_bundle=None):
            assert query_bundle.query_str == "alpha beta"
            return [node for node in nodes if float(node.score or 0.0) >= self.similarity_cutoff]

    class FakeLongContextReorder:
        def postprocess_nodes(self, nodes, query_bundle=None):
            assert query_bundle.query_str == "alpha beta"
            return list(reversed(nodes))

    runtime = LlamaIndexRuntime(
        text_node_cls=FakeTextNode,
        node_with_score_cls=FakeNodeWithScore,
        query_bundle_cls=FakeQueryBundle,
        base_retriever_cls=FakeBaseRetriever,
        similarity_postprocessor_cls=FakeSimilarityPostprocessor,
        long_context_reorder_cls=FakeLongContextReorder,
        version="test-version",
    )
    row_one = {"document_chunk_id": "chunk-1", "document_title": "One", "content": "alpha", "retrieval_method": "hybrid", "score": 0.9}
    row_two = {"document_chunk_id": "chunk-2", "document_title": "Two", "content": "beta", "retrieval_method": "lexical", "score": 0.7}
    row_three = {"document_chunk_id": "chunk-3", "document_title": "Three", "content": "gamma", "retrieval_method": "vector", "score": 0.5}

    processed = run_llamaindex_pilot_postprocessing(
        runtime=runtime,
        query_text="alpha beta",
        results=[row_one, row_two, row_three],
        top_k=3,
        similarity_cutoff=0.0,
        long_context_reorder_enabled=True,
    )

    assert processed.results == [row_three, row_two, row_one]
    assert processed.metadata == {
        "version": "llamaindex_authorized_context_v1",
        "llamaindex_core_version": "test-version",
        "processors": ["SimilarityPostprocessor", "LongContextReorder"],
        "similarity_cutoff": 0.0,
        "long_context_reorder_enabled": True,
        "input_result_count": 3,
        "processed_result_count": 3,
    }


def test_real_llamaindex_runtime_executes_context_processing_pipeline() -> None:
    from ragpilot_api.application.retrieval.retrieval_engines import load_llamaindex_runtime

    rows = [
        {
            "document_chunk_id": f"chunk-{index}",
            "document_title": f"Document {index}",
            "content": f"authorized context {index}",
            "retrieval_method": "hybrid",
            "score": 1.0 - (index * 0.1),
        }
        for index in range(4)
    ]

    processed = run_llamaindex_pilot_postprocessing(
        runtime=load_llamaindex_runtime(),
        query_text="authorized context",
        results=rows,
        top_k=4,
        similarity_cutoff=0.0,
        long_context_reorder_enabled=True,
    )

    assert {row["document_chunk_id"] for row in processed.results} == {
        row["document_chunk_id"] for row in rows
    }
    assert [row["document_chunk_id"] for row in processed.results] != [
        row["document_chunk_id"] for row in rows
    ]
    assert processed.metadata["llamaindex_core_version"]
