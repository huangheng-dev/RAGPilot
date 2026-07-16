from ragpilot_api.application.retrieval.fusion_calibrator import calibrate_fusion


def test_calibrator_prefers_quality_then_smallest_change() -> None:
    base = {"document_id": "d", "document_version_id": "v", "knowledge_base_id": "k", "document_title": "", "chunk_index": 0, "content": "", "token_count": 1, "metadata_json": {}, "created_at": "2026-01-01"}
    cases = [{"query": "target", "relevant_chunk_ids": ["target"], "vector_rows": [{**base, "document_chunk_id": "noise", "score": .9}, {**base, "document_chunk_id": "target", "score": .2}], "lexical_rows": [{**base, "document_chunk_id": "target", "lexical_score": 10}]}]
    report = calibrate_fusion(cases=cases, top_k=1, weight_grid=[.3, .7], bonus_grid=[.05], current=(.65, .05))
    assert report["recommended"]["vector_weight"] == .3
    assert report["recommended"]["recall_at_k"] == 1
