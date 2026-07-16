from __future__ import annotations

import importlib
import importlib.metadata
from dataclasses import dataclass, replace
from typing import Any, Protocol
from uuid import UUID

from ragpilot_api.application.retrieval.retrieval_runtime import RetrievalExecutionOutcome, execute_retrieval
from ragpilot_api.infrastructure.database.repositories.knowledge_base_repository import KnowledgeBaseRepository
from ragpilot_api.infrastructure.database.repositories.retrieval_profile_repository import RetrievalProfileRepository
from ragpilot_api.infrastructure.database.repositories.retrieval_repository import RetrievalRepository
from ragpilot_api.shared.settings import Settings


class RetrievalEngine(Protocol):
    async def execute(
        self,
        *,
        retrieval_repository: RetrievalRepository,
        settings: Settings,
        tenant_id: UUID,
        knowledge_base_id: UUID,
        query_text: str,
        requested_top_k: int,
        principal_user_id: UUID | None = None,
        acl_bypass: bool = False,
        knowledge_base_repository: KnowledgeBaseRepository | None = None,
        retrieval_profile_repository: RetrievalProfileRepository | None = None,
    ) -> RetrievalExecutionOutcome: ...


@dataclass(frozen=True)
class LlamaIndexRuntime:
    text_node_cls: type[Any]
    node_with_score_cls: type[Any]
    query_bundle_cls: type[Any]
    base_retriever_cls: type[Any]
    similarity_postprocessor_cls: type[Any]
    long_context_reorder_cls: type[Any]
    version: str


@dataclass(frozen=True)
class LlamaIndexPostprocessingOutcome:
    results: list[dict[str, Any]]
    metadata: dict[str, Any]


@dataclass(frozen=True)
class NativeRetrievalEngine:
    async def execute(
        self,
        *,
        retrieval_repository: RetrievalRepository,
        settings: Settings,
        tenant_id: UUID,
        knowledge_base_id: UUID,
        query_text: str,
        requested_top_k: int,
        principal_user_id: UUID | None = None,
        acl_bypass: bool = False,
        knowledge_base_repository: KnowledgeBaseRepository | None = None,
        retrieval_profile_repository: RetrievalProfileRepository | None = None,
    ) -> RetrievalExecutionOutcome:
        return await execute_retrieval(
            retrieval_repository=retrieval_repository,
            settings=settings,
            tenant_id=tenant_id,
            knowledge_base_id=knowledge_base_id,
            query_text=query_text,
            requested_top_k=requested_top_k,
            principal_user_id=principal_user_id,
            acl_bypass=acl_bypass,
            knowledge_base_repository=knowledge_base_repository,
            retrieval_profile_repository=retrieval_profile_repository,
        )


@dataclass(frozen=True)
class LlamaIndexPilotRetrievalEngine:
    async def execute(
        self,
        *,
        retrieval_repository: RetrievalRepository,
        settings: Settings,
        tenant_id: UUID,
        knowledge_base_id: UUID,
        query_text: str,
        requested_top_k: int,
        principal_user_id: UUID | None = None,
        acl_bypass: bool = False,
        knowledge_base_repository: KnowledgeBaseRepository | None = None,
        retrieval_profile_repository: RetrievalProfileRepository | None = None,
    ) -> RetrievalExecutionOutcome:
        runtime = load_llamaindex_runtime()
        native_outcome = await execute_retrieval(
            retrieval_repository=retrieval_repository,
            settings=settings,
            tenant_id=tenant_id,
            knowledge_base_id=knowledge_base_id,
            query_text=query_text,
            requested_top_k=requested_top_k,
            principal_user_id=principal_user_id,
            acl_bypass=acl_bypass,
            knowledge_base_repository=knowledge_base_repository,
            retrieval_profile_repository=retrieval_profile_repository,
        )
        processed_results = run_llamaindex_pilot_postprocessing(
            runtime=runtime,
            query_text=query_text,
            results=native_outcome.results,
            top_k=native_outcome.effective_top_k,
            similarity_cutoff=float(getattr(settings, "llamaindex_similarity_cutoff", 0.0)),
            long_context_reorder_enabled=bool(
                getattr(settings, "llamaindex_long_context_reorder_enabled", True)
            ),
        )
        authorized_chunk_ids = await retrieval_repository.filter_authorized_document_chunk_ids(
            tenant_id=tenant_id,
            knowledge_base_id=knowledge_base_id,
            document_chunk_ids=[
                UUID(str(row["document_chunk_id"])) for row in processed_results.results
            ],
            principal_user_id=principal_user_id,
            acl_bypass=acl_bypass,
        )
        authorized_results = [
            row
            for row in processed_results.results
            if UUID(str(row["document_chunk_id"])) in authorized_chunk_ids
        ]
        return replace(
            native_outcome,
            results=authorized_results,
            rerank_metadata={
                **native_outcome.rerank_metadata,
                "llamaindex_adapter": {
                    **processed_results.metadata,
                    "reauthorized_result_count": len(authorized_results),
                },
            },
        )


def load_llamaindex_runtime() -> LlamaIndexRuntime:
    try:
        schema_module = importlib.import_module("llama_index.core.schema")
        retriever_module = importlib.import_module("llama_index.core.retrievers")
        postprocessor_module = importlib.import_module("llama_index.core.postprocessor")
    except ModuleNotFoundError as exc:
        raise RuntimeError(
            "The LlamaIndex pilot retrieval engine requires the optional backend dependency. "
            "Install it from apps/api with: pip install -e \".[retrieval-llamaindex]\""
        ) from exc

    return LlamaIndexRuntime(
        text_node_cls=schema_module.TextNode,
        node_with_score_cls=schema_module.NodeWithScore,
        query_bundle_cls=schema_module.QueryBundle,
        base_retriever_cls=retriever_module.BaseRetriever,
        similarity_postprocessor_cls=postprocessor_module.SimilarityPostprocessor,
        long_context_reorder_cls=postprocessor_module.LongContextReorder,
        version=importlib.metadata.version("llama-index-core"),
    )


def run_llamaindex_pilot_postprocessing(
    *,
    runtime: LlamaIndexRuntime,
    query_text: str,
    results: list[dict[str, Any]],
    top_k: int,
    similarity_cutoff: float,
    long_context_reorder_enabled: bool,
) -> LlamaIndexPostprocessingOutcome:
    row_by_node_id: dict[str, dict[str, Any]] = {}
    nodes: list[Any] = []

    for row in results:
        node_id = str(row["document_chunk_id"])
        row_by_node_id[node_id] = row
        node = runtime.text_node_cls(
            id_=node_id,
            text=row["content"],
            metadata={
                "document_title": row["document_title"],
                "retrieval_method": row["retrieval_method"],
            },
        )
        nodes.append(
            runtime.node_with_score_cls(
                node=node,
                score=float(row["score"]),
            )
        )

    query_bundle = runtime.query_bundle_cls(query_str=query_text)
    retriever = build_llamaindex_authorized_retriever(runtime=runtime, nodes=nodes)
    processed_nodes = retriever.retrieve(query_bundle)
    similarity_postprocessor = runtime.similarity_postprocessor_cls(
        similarity_cutoff=max(float(similarity_cutoff), 0.0)
    )
    processed_nodes = similarity_postprocessor.postprocess_nodes(
        processed_nodes,
        query_bundle=query_bundle,
    )
    processors = ["SimilarityPostprocessor"]
    if long_context_reorder_enabled and len(processed_nodes) > 2:
        long_context_reorder = runtime.long_context_reorder_cls()
        processed_nodes = long_context_reorder.postprocess_nodes(
            processed_nodes,
            query_bundle=query_bundle,
        )
        processors.append("LongContextReorder")

    processed_results: list[dict[str, Any]] = []
    for node_with_score in processed_nodes[:top_k]:
        node_id = str(node_with_score.node.node_id)
        source_row = dict(row_by_node_id[node_id])
        if node_with_score.score is not None:
            source_row["score"] = float(node_with_score.score)
        processed_results.append(source_row)
    return LlamaIndexPostprocessingOutcome(
        results=processed_results,
        metadata={
            "version": "llamaindex_authorized_context_v1",
            "llamaindex_core_version": runtime.version,
            "processors": processors,
            "similarity_cutoff": max(float(similarity_cutoff), 0.0),
            "long_context_reorder_enabled": bool(long_context_reorder_enabled),
            "input_result_count": len(results),
            "processed_result_count": len(processed_results),
        },
    )


def build_llamaindex_authorized_retriever(
    *, runtime: LlamaIndexRuntime, nodes: list[Any],
) -> Any:
    class RAGPilotAuthorizedRetriever(runtime.base_retriever_cls):
        def __init__(self, authorized_nodes: list[Any]) -> None:
            self._authorized_nodes = list(authorized_nodes)
            super().__init__()

        def _retrieve(self, query_bundle: Any) -> list[Any]:
            del query_bundle
            return list(self._authorized_nodes)

    return RAGPilotAuthorizedRetriever(nodes)


def normalize_retrieval_engine_name(engine_name: str | None) -> str:
    configured_engine = (engine_name or "native").strip().lower()
    if configured_engine == "llamaindex_reserved":
        return "llamaindex_pilot"
    return configured_engine


def build_retrieval_engine(settings: Settings, engine_name: str | None = None) -> RetrievalEngine:
    configured_engine = normalize_retrieval_engine_name(
        engine_name if engine_name is not None else getattr(settings, "retrieval_engine", "native")
    )

    if configured_engine == "native":
        return NativeRetrievalEngine()
    if configured_engine == "llamaindex_pilot":
        return LlamaIndexPilotRetrievalEngine()

    raise ValueError(
        f"Unsupported retrieval engine '{configured_engine}'. "
        "Expected 'native' or 'llamaindex_pilot'."
    )
