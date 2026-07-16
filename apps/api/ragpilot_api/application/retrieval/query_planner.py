from __future__ import annotations

import re
from dataclasses import dataclass

from ragpilot_api.application.retrieval.retrieval_pipeline import build_query_terms, normalize_query_text


@dataclass(frozen=True)
class RetrievalPlan:
    query_kind: str
    retrieval_mode: str
    candidate_top_k: int
    query_term_count: int
    reasons: tuple[str, ...]

    def as_metadata(self) -> dict[str, object]:
        return {
            "planner": "deterministic_query_plan_v1",
            "query_kind": self.query_kind,
            "retrieval_mode": self.retrieval_mode,
            "candidate_top_k": self.candidate_top_k,
            "query_term_count": self.query_term_count,
            "reasons": list(self.reasons),
        }


def build_retrieval_plan(
    *, query_text: str, retrieval_mode: str, top_k: int, rerank_window: int | None, candidate_limit: int = 50,
) -> RetrievalPlan:
    normalized = normalize_query_text(query_text)
    terms = build_query_terms(query_text)
    reasons: list[str] = ["governed_profile_mode_preserved"]
    has_exact_marker = bool(re.search(r"[`\"“”][^`\"“”]{2,}[`\"“”]", query_text))
    has_identifier = bool(re.search(r"\b[A-Z][A-Z0-9_-]{2,}\b|\b\d{4,}\b", query_text))
    broad_markers = ("compare", "versus", "difference", "summarize", "overview", "比较", "区别", "总结", "概述")
    is_broad = len(normalized) >= 160 or any(marker in normalized for marker in broad_markers)
    if has_exact_marker or has_identifier:
        query_kind = "exact_lookup"
        multiplier = 2
        reasons.append("exact_phrase_or_identifier_detected")
    elif is_broad:
        query_kind = "broad_synthesis"
        multiplier = 4
        reasons.append("broad_or_comparative_query_detected")
    else:
        query_kind = "focused_question"
        multiplier = 3
        reasons.append("focused_question_default")
    planned_candidates = max(top_k * multiplier, rerank_window or top_k)
    bounded_candidates = min(max(planned_candidates, top_k), max(candidate_limit, top_k))
    if bounded_candidates != planned_candidates:
        reasons.append("candidate_window_capped")
    return RetrievalPlan(
        query_kind=query_kind,
        retrieval_mode=retrieval_mode,
        candidate_top_k=bounded_candidates,
        query_term_count=len(terms),
        reasons=tuple(reasons),
    )
