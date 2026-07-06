from ragpilot_api.application.chat.response_builder import build_suggested_conversation_title


def test_build_suggested_conversation_title_strips_common_prefix() -> None:
    title = build_suggested_conversation_title("Please explain document ingestion workflow retry behavior.")

    assert title == "Document ingestion workflow retry behavior"


def test_build_suggested_conversation_title_extracts_focus_from_long_question() -> None:
    title = build_suggested_conversation_title(
        "Which system does RAGPilot use for durable ingestion workflows?"
    )

    assert title == "Durable ingestion workflows"


def test_build_suggested_conversation_title_returns_fallback_for_blank_input() -> None:
    title = build_suggested_conversation_title("   ")

    assert title == "New Conversation"
