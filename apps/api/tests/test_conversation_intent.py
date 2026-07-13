from ragpilot_api.application.chat.conversation_intent import build_conversational_response


def test_chinese_greeting_skips_grounded_answer_generation() -> None:
    assert build_conversational_response("你好啊") == "你好！有什么可以帮你的吗？你可以直接询问当前知识库中的内容。"
    assert build_conversational_response("你好啊！") == "你好！有什么可以帮你的吗？你可以直接询问当前知识库中的内容。"


def test_english_greeting_skips_grounded_answer_generation() -> None:
    assert build_conversational_response("Hello!") == "Hello! How can I help? You can ask me about the current knowledge base."


def test_knowledge_question_is_not_classified_as_greeting() -> None:
    assert build_conversational_response("你好，请问差旅报销期限是多少？") is None
    assert build_conversational_response("客户投诉应该如何升级？") is None
