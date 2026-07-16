from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from ragpilot_api.application.retrieval.retrieval_pipeline import build_query_terms, normalize_query_text


@dataclass(frozen=True)
class EvidenceValidationOutcome:
    rows: list[dict[str, Any]]
    metadata: dict[str, Any]


def validate_retrieval_evidence(
    *, rows: list[dict[str, Any]], query_text: str, minimum_term_coverage: float = 0.05,
    minimum_vector_score: float = 0.72, enabled: bool = True,
) -> EvidenceValidationOutcome:
    if not enabled:
        return EvidenceValidationOutcome(rows=rows, metadata={
            "validator": "disabled", "status": "not_applied", "candidate_count": len(rows),
            "accepted_count": len(rows), "rejected_count": 0,
        })
    if not rows:
        return EvidenceValidationOutcome(rows=[], metadata={
            "validator": "deterministic_evidence_guard_v1", "status": "empty", "candidate_count": 0,
            "accepted_count": 0, "rejected_count": 0, "minimum_term_coverage": minimum_term_coverage,
            "minimum_vector_score": minimum_vector_score,
        })

    normalized_query = normalize_query_text(query_text)
    query_terms = build_query_terms(query_text)
    accepted: list[dict[str, Any]] = []
    rejected_reasons: dict[str, int] = {}
    for row in rows:
        searchable = normalize_query_text(f"{row.get('document_title') or ''} {row.get('content') or ''}")
        matched_terms = sum(1 for term in query_terms if term in searchable)
        term_coverage = matched_terms / len(query_terms) if query_terms else 0.0
        phrase_match = bool(normalized_query and normalized_query in searchable)
        vector_score = float(row.get("vector_score") or 0.0)
        lexical_score = float(row.get("lexical_score") or 0.0)
        retrieval_method = str(row.get("retrieval_method") or "")
        reasons: list[str] = []
        if phrase_match:
            reasons.append("query_phrase_match")
        if term_coverage >= minimum_term_coverage and matched_terms > 0:
            reasons.append("term_coverage")
        if retrieval_method in {"lexical", "hybrid"} and lexical_score > 0:
            reasons.append("lexical_signal")
        if vector_score >= minimum_vector_score:
            reasons.append("strong_vector_signal")
        evidence_score = min(
            1.0,
            (0.45 if phrase_match else 0.0)
            + min(term_coverage, 1.0) * 0.3
            + (0.15 if lexical_score > 0 else 0.0)
            + (0.1 if vector_score >= minimum_vector_score else 0.0),
        )
        if reasons:
            accepted.append({
                **row,
                "evidence_score": evidence_score,
                "evidence_status": "accepted",
                "evidence_reasons": reasons,
            })
        else:
            rejected_reasons["insufficient_query_alignment"] = rejected_reasons.get("insufficient_query_alignment", 0) + 1

    distinct_documents = len({row.get("document_id") for row in accepted})
    status = "sufficient" if accepted else "rejected"
    return EvidenceValidationOutcome(rows=accepted, metadata={
        "validator": "deterministic_evidence_guard_v1",
        "status": status,
        "candidate_count": len(rows),
        "accepted_count": len(accepted),
        "rejected_count": len(rows) - len(accepted),
        "distinct_document_count": distinct_documents,
        "minimum_term_coverage": minimum_term_coverage,
        "minimum_vector_score": minimum_vector_score,
        "rejected_reasons": rejected_reasons,
    })
