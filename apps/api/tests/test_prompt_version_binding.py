from ragpilot_api.application.model_gateway.prompt_builder import (
    GROUNDED_CHAT_PROMPT_VERSION_ID,
    build_grounded_chat_messages,
    build_grounded_chat_prompt_binding,
)


def test_grounded_prompt_binding_is_versioned_and_snapshot_sensitive() -> None:
    first_messages = build_grounded_chat_messages(question="first", retrieval_results=[])
    second_messages = build_grounded_chat_messages(question="second", retrieval_results=[])

    first = build_grounded_chat_prompt_binding(first_messages)
    second = build_grounded_chat_prompt_binding(second_messages)

    assert first["prompt_version_id"] == GROUNDED_CHAT_PROMPT_VERSION_ID
    assert first["prompt_version"] == "1.1.0"
    assert first["template_hash"] == second["template_hash"]
    assert first["rendered_snapshot_hash"] != second["rendered_snapshot_hash"]
