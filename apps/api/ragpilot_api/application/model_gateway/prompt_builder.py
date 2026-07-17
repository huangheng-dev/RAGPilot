from __future__ import annotations

import hashlib
import json


GROUNDED_CHAT_PROMPT_KEY = "grounded-chat"
GROUNDED_CHAT_PROMPT_VERSION = "1.1.0"
GROUNDED_CHAT_PROMPT_VERSION_ID = "10000000-0000-0000-0000-000000000003"
GROUNDED_CHAT_SYSTEM_TEMPLATE = (
    "You are RAGPilot. Answer only from the provided knowledge base context. "
    "Always answer in the same language as the user's question unless the user explicitly requests another language. "
    "First decide whether the retrieved context is directly relevant to the user's question. "
    "Never summarize or reuse context that does not answer the question. "
    "If the context is irrelevant or insufficient, say that the current knowledge base does not contain enough relevant information. "
    "When agent context is provided, follow its objective and instructions without inventing facts beyond the retrieved evidence."
)


def question_prefers_simplified_chinese(question: str) -> bool:
    return any("\u3400" <= character <= "\u9fff" for character in question)


def build_response_language_instruction(question: str) -> str:
    if question_prefers_simplified_chinese(question):
        return "Respond in Simplified Chinese. Keep product names, code, and identifiers unchanged when appropriate."
    return "Respond in the same language as the user's question unless they explicitly request another language."


def build_grounded_chat_messages(
    *,
    question: str,
    retrieval_results: list[dict],
    agent_name: str | None = None,
    agent_mode: str | None = None,
    agent_objective: str | None = None,
    agent_instructions: str | None = None,
    knowledge_base_scope: str | None = None,
) -> list[dict[str, str]]:
    context_blocks = []
    for index, result in enumerate(retrieval_results, start=1):
        source_location = dict(result.get("metadata_json") or {}).get("source_location_label")
        context_blocks.append(
            f"[{index}] title={result['document_title']}\n"
            f"chunk_index={result['chunk_index']}\n"
            f"source_location={source_location or 'not available'}\n"
            f"content={result['content']}"
        )
    context_text = "\n\n".join(context_blocks) if context_blocks else "No grounded context was retrieved."
    agent_context_lines = []
    if agent_name:
        agent_context_lines.append(f"Agent name: {agent_name}")
    if agent_mode:
        agent_context_lines.append(f"Agent mode: {agent_mode}")
    if knowledge_base_scope:
        agent_context_lines.append(f"Agent scope: {knowledge_base_scope}")
    if agent_objective:
        agent_context_lines.append(f"Agent objective: {agent_objective}")
    if agent_instructions:
        agent_context_lines.append(f"Agent instructions: {agent_instructions}")
    agent_context_text = (
        "\n".join(agent_context_lines)
        if agent_context_lines
        else "No explicit agent context is attached to this request."
    )
    return [
        {
            "role": "system",
            "content": GROUNDED_CHAT_SYSTEM_TEMPLATE,
        },
        {
            "role": "user",
            "content": (
                f"Question:\n{question}\n\n"
                f"Response language:\n{build_response_language_instruction(question)}\n\n"
                f"Agent context:\n{agent_context_text}\n\n"
                f"Retrieved context:\n{context_text}\n\n"
                "Write a concise grounded answer. Use only evidence that directly addresses the question."
            ),
        },
    ]


def build_grounded_chat_prompt_binding(messages: list[dict[str, str]]) -> dict[str, str]:
    rendered = json.dumps(messages, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return {
        "prompt_key": GROUNDED_CHAT_PROMPT_KEY,
        "prompt_version": GROUNDED_CHAT_PROMPT_VERSION,
        "prompt_version_id": GROUNDED_CHAT_PROMPT_VERSION_ID,
        "template_hash": hashlib.sha256(GROUNDED_CHAT_SYSTEM_TEMPLATE.encode("utf-8")).hexdigest(),
        "rendered_snapshot_hash": hashlib.sha256(rendered.encode("utf-8")).hexdigest(),
    }
