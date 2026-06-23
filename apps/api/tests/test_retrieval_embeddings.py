from ragpilot_api.infrastructure.embeddings import build_deterministic_embedding


def test_deterministic_embedding_is_stable_and_normalized() -> None:
    first = build_deterministic_embedding(text="RagPilot retrieval smoke", dimension=1536)
    second = build_deterministic_embedding(text="RagPilot retrieval smoke", dimension=1536)

    assert first == second
    assert len(first) == 1536
    assert round(sum(value * value for value in first), 6) == 1.0
