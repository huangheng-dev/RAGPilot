from __future__ import annotations


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
        context_blocks.append(
            f"[{index}] title={result['document_title']}\n"
            f"chunk_index={result['chunk_index']}\n"
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
            "content": (
                "You are RAGPilot. Answer only from the provided knowledge base context. "
                "First decide whether the retrieved context is directly relevant to the user's question. "
                "Never summarize or reuse context that does not answer the question. "
                "If the context is irrelevant or insufficient, say that the current knowledge base does not contain enough relevant information. "
                "When agent context is provided, follow its objective and instructions without inventing facts beyond the retrieved evidence."
            ),
        },
        {
            "role": "user",
            "content": (
                f"Question:\n{question}\n\n"
                f"Agent context:\n{agent_context_text}\n\n"
                f"Retrieved context:\n{context_text}\n\n"
                "Write a concise grounded answer. Use only evidence that directly addresses the question."
            ),
        },
    ]
