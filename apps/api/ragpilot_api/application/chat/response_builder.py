from __future__ import annotations

import re


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
    if not retrieval_results:
        return (
            "I could not find grounded context in the selected knowledge base for this question. "
            "Please upload relevant documents or broaden the knowledge base scope."
        )

    lead = retrieval_results[0]
    supporting_documents = ", ".join(
        sorted({result["document_title"] for result in retrieval_results[:3]})
    )
    return (
        f"Based on the retrieved knowledge base content, the best answer to '{question}' is grounded in "
        f"'{lead['document_title']}'. The most relevant passage says: {lead['content'][:400]}\n\n"
        f"Supporting documents considered: {supporting_documents}."
    )
