from ragpilot_api.application.retrieval.evidence_validator import validate_retrieval_evidence
from ragpilot_api.application.retrieval.query_planner import build_retrieval_plan


def test_query_planner_expands_broad_queries_without_overriding_governed_mode() -> None:
    plan = build_retrieval_plan(
        query_text="Compare the incident response policy versus the disaster recovery policy and summarize the differences.",
        retrieval_mode="hybrid", top_k=5, rerank_window=12,
    )
    assert plan.query_kind == "broad_synthesis"
    assert plan.retrieval_mode == "hybrid"
    assert plan.candidate_top_k == 20


def test_query_planner_caps_candidate_fanout() -> None:
    plan = build_retrieval_plan(
        query_text="Summarize everything about the platform", retrieval_mode="hybrid",
        top_k=20, rerank_window=12, candidate_limit=50,
    )
    assert plan.candidate_top_k == 50
    assert "candidate_window_capped" in plan.reasons


def test_evidence_validator_accepts_lexically_aligned_evidence() -> None:
    row = {
        "document_id": "doc-1", "document_title": "Incident response policy",
        "content": "The incident response policy requires paging the duty manager.",
        "retrieval_method": "hybrid", "lexical_score": 3.2, "vector_score": 0.61,
    }
    outcome = validate_retrieval_evidence(rows=[row], query_text="What does the incident response policy require?")
    assert outcome.metadata["status"] == "sufficient"
    assert outcome.rows[0]["evidence_status"] == "accepted"
    assert "lexical_signal" in outcome.rows[0]["evidence_reasons"]


def test_evidence_validator_rejects_unrelated_weak_vector_candidate() -> None:
    row = {
        "document_id": "doc-1", "document_title": "Cafeteria menu",
        "content": "Lunch is served at noon.", "retrieval_method": "vector",
        "lexical_score": None, "vector_score": 0.31,
    }
    outcome = validate_retrieval_evidence(rows=[row], query_text="How do we rotate production encryption keys?")
    assert outcome.rows == []
    assert outcome.metadata["status"] == "rejected"
    assert outcome.metadata["rejected_count"] == 1


def test_evidence_validator_preserves_high_confidence_semantic_candidate() -> None:
    row = {
        "document_id": "doc-1", "document_title": "Credential lifecycle",
        "content": "Secrets must be renewed every quarter.", "retrieval_method": "vector",
        "lexical_score": None, "vector_score": 0.86,
    }
    outcome = validate_retrieval_evidence(rows=[row], query_text="When should authentication keys be rotated?")
    assert len(outcome.rows) == 1
    assert "strong_vector_signal" in outcome.rows[0]["evidence_reasons"]
