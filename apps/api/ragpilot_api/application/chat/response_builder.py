from __future__ import annotations

import re

from ragpilot_api.application.model_gateway.prompt_builder import question_prefers_simplified_chinese


COMMON_TITLE_PREFIXES = (
    "please ",
    "can you ",
    "could you ",
    "would you ",
    "tell me about ",
    "show me ",
    "explain ",
    "summarize ",
    "how to ",
    "how do i ",
    "what is ",
    "what are ",
)


def _strip_title_prefix(text: str) -> str:
    normalized = text.strip()
    while normalized:
        lowered = normalized.lower()
        matched_prefix = next((prefix for prefix in COMMON_TITLE_PREFIXES if lowered.startswith(prefix)), None)
        if not matched_prefix:
            break
        normalized = normalized[len(matched_prefix):].strip()

    which_pattern = re.match(r"^which\s+\w+\s+does\s+(.+)$", normalized, flags=re.IGNORECASE)
    if which_pattern:
        candidate = which_pattern.group(1).strip()
        candidate = re.sub(r"\buse\b", "", candidate, count=1, flags=re.IGNORECASE).strip()
        return candidate

    return normalized


def build_suggested_conversation_title(question: str) -> str:
    compact = " ".join(question.replace("`", " ").strip().split())
    if not compact:
        return "New Conversation"
    compact = compact.splitlines()[0].strip()
    compact = compact.strip(" -:;,.!?")
    compact = _strip_title_prefix(compact)

    if " for " in compact.lower() and len(compact) > 24:
        parts = re.split(r"\bfor\b", compact, maxsplit=1, flags=re.IGNORECASE)
        if len(parts) == 2 and len(parts[1].strip()) >= 8:
            compact = parts[1].strip()

    compact = re.sub(r"\s+", " ", compact).strip(" -:;,.!?")
    if not compact:
        return "New Conversation"
    if len(compact) <= 72:
        return compact[0].upper() + compact[1:]
    compact = compact[:69].rstrip(" -:;,.")
    return compact + "..."


def build_grounded_answer(*, question: str, retrieval_results: list[dict]) -> str:
    use_chinese = question_prefers_simplified_chinese(question)
    if not retrieval_results:
        if use_chinese:
            return "当前知识库中没有找到与这个问题直接相关的内容。请上传相关文件，或扩大知识库范围后再试。"
        return (
            "I could not find grounded context in the selected knowledge base for this question. "
            "Please upload relevant documents or broaden the knowledge base scope."
        )

    lead = retrieval_results[0]
    supporting_documents = ", ".join(
        sorted({result["document_title"] for result in retrieval_results[:3]})
    )
    if use_chinese:
        return (
            f"根据知识库检索结果，回答主要依据《{lead['document_title']}》。"
            f"最相关的内容是：{lead['content'][:400]}\n\n"
            f"参考文件：{supporting_documents}。"
        )
    return (
        f"Based on the retrieved knowledge base content, the best answer to '{question}' is grounded in "
        f"'{lead['document_title']}'. The most relevant passage says: {lead['content'][:400]}\n\n"
        f"Supporting documents considered: {supporting_documents}."
    )
