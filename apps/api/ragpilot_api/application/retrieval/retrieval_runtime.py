from __future__ import annotations

from dataclasses import dataclass
from typing import Any
from uuid import UUID

from ragpilot_api.application.retrieval.retrieval_pipeline import (
    DEFAULT_RERANK_STRATEGY,
    build_query_terms,
    merge_retrieval_results,
    normalize_query_text,
    rerank_retrieval_results,
)
from ragpilot_api.infrastructure.database.repositories.knowledge_base_repository import KnowledgeBaseRepository
from ragpilot_api.infrastructure.database.repositories.retrieval_profile_repository import RetrievalProfileRepository
from ragpilot_api.infrastructure.database.repositories.retrieval_repository import RetrievalRepository
from ragpilot_api.infrastructure.embeddings import build_deterministic_embedding, format_vector_literal
from ragpilot_api.shared.settings import Settings


@dataclass(frozen=True)
class ResolvedRetrievalProfile:
    retrieval_profile_id: UUID | None
    retrieval_profile_name: str | None
    retrieval_mode: str
    top_k: int
    vector_weight: float
    lexical_weight: float
    hybrid_overlap_bonus: float
    profile_source: str


@dataclass(frozen=True)
class RetrievalExecutionOutcome:
    retrieval_profile_id: UUID | None
    retrieval_profile_name: str | None
    retrieval_profile_source: str
    retrieval_mode: str
    embedding_model: str
    effective_top_k: int
    rerank_applied: bool
    rerank_strategy: str | None
    rerank_window: int | None
    results: list[dict[str, Any]]


async def execute_retrieval(
    *,
    retrieval_repository: RetrievalRepository,
    settings: Settings,
    tenant_id: UUID,
    knowledge_base_id: UUID,
    query_text: str,
    requested_top_k: int,
    knowledge_base_repository: KnowledgeBaseRepository | None = None,
    retrieval_profile_repository: RetrievalProfileRepository | None = None,
) -> RetrievalExecutionOutcome:
    resolved_profile = await resolve_retrieval_profile(
        knowledge_base_id=knowledge_base_id,
        requested_top_k=requested_top_k,
        settings=settings,
        knowledge_base_repository=knowledge_base_repository,
        retrieval_profile_repository=retrieval_profile_repository,
    )
    rerank_strategy = resolve_rerank_strategy(settings)
    rerank_window = (
        resolve_rerank_window(
            settings=settings,
            minimum_top_k=resolved_profile.top_k,
        )
        if rerank_strategy is not None
        else None
    )
    candidate_top_k = rerank_window or resolved_profile.top_k

    vector_rows: list[dict[str, Any]] = []
    if resolved_profile.retrieval_mode in {"hybrid", "vector"}:
        query_embedding = build_deterministic_embedding(
            text=query_text,
            dimension=settings.retrieval_embedding_dimension,
        )
        vector_rows = await retrieval_repository.search_vector_document_chunks(
            tenant_id=tenant_id,
            knowledge_base_id=knowledge_base_id,
            query_embedding=format_vector_literal(query_embedding),
            embedding_model=settings.retrieval_embedding_model,
            top_k=candidate_top_k,
        )

    lexical_rows: list[dict[str, Any]] = []
    normalized_query = normalize_query_text(query_text)
    query_terms = build_query_terms(query_text)
    if resolved_profile.retrieval_mode in {"hybrid", "lexical"} and query_terms:
        lexical_rows = await retrieval_repository.search_lexical_document_chunks(
            tenant_id=tenant_id,
            knowledge_base_id=knowledge_base_id,
            normalized_query=normalized_query,
            query_terms_text=" ".join(query_terms),
            top_k=candidate_top_k,
        )

    results = merge_retrieval_results(
        vector_rows=vector_rows,
        lexical_rows=lexical_rows,
        top_k=candidate_top_k,
        retrieval_mode=resolved_profile.retrieval_mode,
        vector_weight=resolved_profile.vector_weight,
        lexical_weight=resolved_profile.lexical_weight,
        hybrid_overlap_bonus=resolved_profile.hybrid_overlap_bonus,
    )
    rerank_applied = False
    if rerank_strategy is not None and rerank_window is not None:
        results, rerank_applied = rerank_retrieval_results(
            rows=results,
            query_text=query_text,
            top_k=resolved_profile.top_k,
            candidate_window=rerank_window,
        )
    else:
        results = results[: resolved_profile.top_k]

    return RetrievalExecutionOutcome(
        retrieval_profile_id=resolved_profile.retrieval_profile_id,
        retrieval_profile_name=resolved_profile.retrieval_profile_name,
        retrieval_profile_source=resolved_profile.profile_source,
        retrieval_mode=resolved_profile.retrieval_mode,
        embedding_model=settings.retrieval_embedding_model,
        effective_top_k=resolved_profile.top_k,
        rerank_applied=rerank_applied,
        rerank_strategy=rerank_strategy,
        rerank_window=rerank_window,
        results=results,
    )


async def resolve_retrieval_profile(
    *,
    knowledge_base_id: UUID,
    requested_top_k: int,
    settings: Settings,
    knowledge_base_repository: KnowledgeBaseRepository | None,
    retrieval_profile_repository: RetrievalProfileRepository | None,
) -> ResolvedRetrievalProfile:
    if knowledge_base_repository is not None and retrieval_profile_repository is not None:
        knowledge_base = await knowledge_base_repository.get_knowledge_base_by_id(
            knowledge_base_id=knowledge_base_id
        )
        if knowledge_base is not None and knowledge_base.retrieval_profile_id is not None:
            assigned_profile = await retrieval_profile_repository.get_retrieval_profile(
                retrieval_profile_id=knowledge_base.retrieval_profile_id
            )
            if assigned_profile is not None and assigned_profile.is_enabled:
                return ResolvedRetrievalProfile(
                    retrieval_profile_id=assigned_profile.id,
                    retrieval_profile_name=assigned_profile.name,
                    retrieval_mode=assigned_profile.retrieval_mode,
                    top_k=max(1, min(requested_top_k, assigned_profile.top_k)),
                    vector_weight=float(assigned_profile.vector_weight),
                    lexical_weight=float(assigned_profile.lexical_weight),
                    hybrid_overlap_bonus=float(assigned_profile.hybrid_overlap_bonus),
                    profile_source="knowledge_base",
                )

        default_profile = await retrieval_profile_repository.get_default_enabled_retrieval_profile()
        if default_profile is not None:
            return ResolvedRetrievalProfile(
                retrieval_profile_id=default_profile.id,
                retrieval_profile_name=default_profile.name,
                retrieval_mode=default_profile.retrieval_mode,
                top_k=max(1, min(requested_top_k, default_profile.top_k)),
                vector_weight=float(default_profile.vector_weight),
                lexical_weight=float(default_profile.lexical_weight),
                hybrid_overlap_bonus=float(default_profile.hybrid_overlap_bonus),
                profile_source="default",
            )

    return ResolvedRetrievalProfile(
        retrieval_profile_id=None,
        retrieval_profile_name=None,
        retrieval_mode="hybrid",
        top_k=max(1, requested_top_k),
        vector_weight=0.65,
        lexical_weight=0.35,
        hybrid_overlap_bonus=0.05,
        profile_source="settings_fallback",
    )


def resolve_rerank_strategy(settings: Settings) -> str | None:
    if not bool(getattr(settings, "retrieval_rerank_enabled", True)):
        return None

    raw_strategy = str(
        getattr(
            settings,
            "retrieval_rerank_strategy",
            DEFAULT_RERANK_STRATEGY,
        )
        or ""
    ).strip().lower()
    if raw_strategy in {"", "none", "off", "disabled"}:
        return None
    return DEFAULT_RERANK_STRATEGY


def resolve_rerank_window(*, settings: Settings, minimum_top_k: int) -> int:
    raw_window = getattr(settings, "retrieval_rerank_window", 12)
    try:
        parsed_window = int(raw_window)
    except (TypeError, ValueError):
        parsed_window = minimum_top_k
    return min(max(parsed_window, minimum_top_k), 50)
