from __future__ import annotations

import re


_GREETING_PATTERNS = {
    "hi",
    "hello",
    "hey",
    "hello there",
    "hi there",
    "你好",
    "你好啊",
    "你好呀",
    "您好",
    "您好啊",
    "嗨",
    "哈喽",
    "在吗",
    "早上好",
    "上午好",
    "中午好",
    "下午好",
    "晚上好",
}
def _normalize(value: str) -> str:
    return re.sub(r"[^0-9a-z\u3400-\u9fff]+", "", value.strip().lower())


_NORMALIZED_GREETING_PATTERNS = frozenset(_normalize(pattern) for pattern in _GREETING_PATTERNS)


def build_conversational_response(question: str) -> str | None:
    if _normalize(question) not in _NORMALIZED_GREETING_PATTERNS:
        return None

    if re.search(r"[\u3400-\u9fff]", question):
        return "你好！有什么可以帮你的吗？你可以直接询问当前知识库中的内容。"
    return "Hello! How can I help? You can ask me about the current knowledge base."
