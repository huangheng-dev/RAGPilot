from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from ragpilot_api.application.chat.chat_service import ChatService, build_citation_context_by_chunk_id
from ragpilot_api.application.model_gateway.contracts import RuntimeModelBinding
from ragpilot_api.application.errors import ResourceConflictError, ResourceNotFoundError
from ragpilot_api.contracts.http.chat_contracts import (
    ChatAskRequest,
    ConversationUpdateRequest,
    MessageFeedbackCreateRequest,
)


def build_conversation(**overrides):
    defaults = {
        "id": uuid4(),
        "tenant_id": uuid4(),
        "workspace_id": uuid4(),
        "knowledge_base_id": uuid4(),
        "title": "Existing Conversation",
        "created_by_user_id": None,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    return SimpleNamespace(**{**defaults, **overrides})


def build_message(**overrides):
    defaults = {
        "id": uuid4(),
        "tenant_id": uuid4(),
        "conversation_id": uuid4(),
        "role": "assistant",
        "content": "Generated response",
        "model_name": "test-model",
        "usage_json": {},
        "created_at": datetime.now(timezone.utc),
    }
    return SimpleNamespace(**{**defaults, **overrides})


def test_citation_context_normalizes_string_chunk_ids() -> None:
    chunk_id = uuid4()
    document_id = uuid4()
    contexts = build_citation_context_by_chunk_id(
        [
            {
                "document_chunk_id": str(chunk_id),
                "document_id": document_id,
                "document_title": "客户投诉受理流程",
                "document_version_id": uuid4(),
                "knowledge_base_id": uuid4(),
                "chunk_index": 2,
                "metadata_json": {"source_location_label": "第 3 页"},
            }
        ]
    )

    assert contexts[chunk_id].document_id == document_id
    assert contexts[chunk_id].document_title == "客户投诉受理流程"
    assert contexts[chunk_id].source_location_label == "第 3 页"


@pytest.mark.anyio
async def test_get_conversation_metrics_returns_repository_snapshot() -> None:
    tenant_id = uuid4()
    workspace_id = uuid4()
    latest_activity_at = datetime.now(timezone.utc)
    repository = SimpleNamespace(
        get_conversation_metrics=AsyncMock(
            return_value={
                "total_conversations": 7,
                "active_conversations": 4,
                "total_messages": 19,
                "latest_activity_at": latest_activity_at,
            }
        ),
    )

    service = ChatService(
        agent_repository=SimpleNamespace(),
        conversation_repository=repository,
        message_repository=SimpleNamespace(),
        retrieval_repository=SimpleNamespace(),
        settings=SimpleNamespace(),
        model_gateway=SimpleNamespace(),
    )

    response = await service.get_conversation_metrics(
        tenant_id=tenant_id,
        workspace_id=workspace_id,
    )

    assert response.total_conversations == 7
    assert response.active_conversations == 4
    assert response.total_messages == 19
    assert response.latest_activity_at == latest_activity_at
    repository.get_conversation_metrics.assert_awaited_once_with(
        tenant_id=tenant_id,
        workspace_id=workspace_id,
    )


@pytest.mark.anyio
async def test_list_conversations_forwards_query() -> None:
    tenant_id = uuid4()
    workspace_id = uuid4()
    query = "release"
    latest_activity_at = datetime.now(timezone.utc)
    repository = SimpleNamespace(
        list_conversations=AsyncMock(
            return_value=[
                {
                    "conversation": build_conversation(title="Release Readiness Review"),
                    "message_count": 8,
                    "latest_activity_at": latest_activity_at,
                }
            ]
        ),
    )

    service = ChatService(
        agent_repository=SimpleNamespace(),
        conversation_repository=repository,
        message_repository=SimpleNamespace(),
        retrieval_repository=SimpleNamespace(),
        settings=SimpleNamespace(),
        model_gateway=SimpleNamespace(),
    )

    response = await service.list_conversations(
        tenant_id=tenant_id,
        workspace_id=workspace_id,
        query=query,
        limit=12,
    )

    assert len(response) == 1
    assert response[0].title == "Release Readiness Review"
    assert response[0].message_count == 8
    assert response[0].latest_activity_at == latest_activity_at
    repository.list_conversations.assert_awaited_once_with(
        tenant_id=tenant_id,
        workspace_id=workspace_id,
        query=query,
        limit=12,
    )


@pytest.mark.anyio
async def test_update_conversation_returns_updated_title() -> None:
    conversation = build_conversation(title="Updated Title")
    repository = SimpleNamespace(
        update_conversation_title=AsyncMock(return_value=conversation),
    )

    service = ChatService(
        agent_repository=SimpleNamespace(),
        conversation_repository=repository,
        message_repository=SimpleNamespace(),
        retrieval_repository=SimpleNamespace(),
        settings=SimpleNamespace(),
        model_gateway=SimpleNamespace(),
    )

    response = await service.update_conversation(
        conversation_id=conversation.id,
        tenant_id=conversation.tenant_id,
        request=ConversationUpdateRequest(title="Updated Title"),
    )

    assert response.title == "Updated Title"
    repository.update_conversation_title.assert_awaited_once_with(
        conversation_id=conversation.id,
        tenant_id=conversation.tenant_id,
        title="Updated Title",
    )


@pytest.mark.anyio
async def test_delete_conversation_forwards_scope() -> None:
    conversation_id = uuid4()
    tenant_id = uuid4()
    repository = SimpleNamespace(
        delete_conversation=AsyncMock(return_value=True),
    )

    service = ChatService(
        agent_repository=SimpleNamespace(),
        conversation_repository=repository,
        message_repository=SimpleNamespace(),
        retrieval_repository=SimpleNamespace(),
        settings=SimpleNamespace(),
        model_gateway=SimpleNamespace(),
    )

    await service.delete_conversation(
        conversation_id=conversation_id,
        tenant_id=tenant_id,
    )

    repository.delete_conversation.assert_awaited_once_with(
        conversation_id=conversation_id,
        tenant_id=tenant_id,
    )


@pytest.mark.anyio
async def test_update_conversation_raises_not_found_when_missing() -> None:
    conversation_id = uuid4()
    tenant_id = uuid4()
    repository = SimpleNamespace(
        update_conversation_title=AsyncMock(return_value=None),
    )

    service = ChatService(
        agent_repository=SimpleNamespace(),
        conversation_repository=repository,
        message_repository=SimpleNamespace(),
        retrieval_repository=SimpleNamespace(),
        settings=SimpleNamespace(),
        model_gateway=SimpleNamespace(),
    )

    with pytest.raises(
        ResourceNotFoundError,
        match="Conversation was not found in the current tenant scope.",
    ):
        await service.update_conversation(
            conversation_id=conversation_id,
            tenant_id=tenant_id,
            request=ConversationUpdateRequest(title="Renamed Conversation"),
        )


@pytest.mark.anyio
async def test_delete_conversation_raises_not_found_when_missing() -> None:
    conversation_id = uuid4()
    tenant_id = uuid4()
    repository = SimpleNamespace(
        delete_conversation=AsyncMock(return_value=False),
    )

    service = ChatService(
        agent_repository=SimpleNamespace(),
        conversation_repository=repository,
        message_repository=SimpleNamespace(),
        retrieval_repository=SimpleNamespace(),
        settings=SimpleNamespace(),
        model_gateway=SimpleNamespace(),
    )

    with pytest.raises(
        ResourceNotFoundError,
        match="Conversation was not found in the current tenant scope.",
    ):
        await service.delete_conversation(
            conversation_id=conversation_id,
            tenant_id=tenant_id,
        )


@pytest.mark.anyio
async def test_list_messages_includes_citation_source_metadata() -> None:
    tenant_id = uuid4()
    conversation_id = uuid4()
    message = build_message(tenant_id=tenant_id, conversation_id=conversation_id)
    document_id = uuid4()
    document_version_id = uuid4()
    knowledge_base_id = uuid4()
    document_chunk_id = uuid4()

    message_repository = SimpleNamespace(
        list_messages=AsyncMock(return_value=[message]),
        list_message_citations=AsyncMock(
            return_value=[
                SimpleNamespace(
                    id=uuid4(),
                    message_id=message.id,
                    document_chunk_id=document_chunk_id,
                    document_id=document_id,
                    document_title="RAGPilot Handbook",
                    document_version_id=document_version_id,
                    knowledge_base_id=knowledge_base_id,
                    chunk_index=4,
                    rank=1,
                    score=0.982341,
                    retrieval_method=None,
                    vector_score=None,
                    lexical_score=None,
                    lexical_normalized_score=None,
                    quote="Temporal powers durable ingestion workflows.",
                )
            ]
        ),
        list_message_feedback=AsyncMock(return_value=[]),
    )

    service = ChatService(
        agent_repository=SimpleNamespace(),
        conversation_repository=SimpleNamespace(),
        message_repository=message_repository,
        retrieval_repository=SimpleNamespace(),
        settings=SimpleNamespace(),
        model_gateway=SimpleNamespace(),
    )

    response = await service.list_messages(
        tenant_id=tenant_id,
        conversation_id=conversation_id,
    )

    assert len(response) == 1
    assert len(response[0].citations) == 1
    citation = response[0].citations[0]
    assert citation.document_chunk_id == document_chunk_id
    assert citation.document_id == document_id
    assert citation.document_title == "RAGPilot Handbook"
    assert citation.document_version_id == document_version_id
    assert citation.knowledge_base_id == knowledge_base_id
    assert citation.chunk_index == 4
    message_repository.list_message_citations.assert_awaited_once_with(
        tenant_id=tenant_id,
        message_ids=[message.id],
    )


@pytest.mark.anyio
async def test_list_messages_recovers_retrieval_diagnostics_from_usage_json() -> None:
    tenant_id = uuid4()
    conversation_id = uuid4()
    document_chunk_id = uuid4()
    message = build_message(
        tenant_id=tenant_id,
        conversation_id=conversation_id,
        usage_json={
            "retrieval_diagnostics": [
                {
                    "document_chunk_id": str(document_chunk_id),
                    "retrieval_method": "hybrid",
                    "score": 0.95,
                    "vector_score": 0.88,
                    "lexical_score": 3.0,
                    "lexical_normalized_score": 1.0,
                }
            ]
        },
    )

    message_repository = SimpleNamespace(
        list_messages=AsyncMock(return_value=[message]),
        list_message_citations=AsyncMock(
            return_value=[
                SimpleNamespace(
                    id=uuid4(),
                    message_id=message.id,
                    document_chunk_id=document_chunk_id,
                    document_id=None,
                    document_title=None,
                    document_version_id=None,
                    knowledge_base_id=None,
                    chunk_index=None,
                    rank=1,
                    score=0.95,
                    quote="Temporal powers durable ingestion workflows.",
                )
            ]
        ),
        list_message_feedback=AsyncMock(return_value=[]),
    )

    service = ChatService(
        agent_repository=SimpleNamespace(),
        conversation_repository=SimpleNamespace(),
        message_repository=message_repository,
        retrieval_repository=SimpleNamespace(),
        settings=SimpleNamespace(),
        model_gateway=SimpleNamespace(),
    )

    response = await service.list_messages(
        tenant_id=tenant_id,
        conversation_id=conversation_id,
    )

    citation = response[0].citations[0]
    assert citation.retrieval_method == "hybrid"
    assert citation.vector_score == 0.88
    assert citation.lexical_score == 3.0
    assert citation.lexical_normalized_score == 1.0


@pytest.mark.anyio
async def test_list_messages_includes_feedback_entries() -> None:
    tenant_id = uuid4()
    conversation_id = uuid4()
    message_id = uuid4()
    submitted_by_user_id = uuid4()
    message = build_message(
        id=message_id,
        tenant_id=tenant_id,
        conversation_id=conversation_id,
        role="assistant",
    )

    message_repository = SimpleNamespace(
        list_messages=AsyncMock(return_value=[message]),
        list_message_citations=AsyncMock(return_value=[]),
        list_message_feedback=AsyncMock(
            return_value=[
                SimpleNamespace(
                    id=uuid4(),
                    message_id=message_id,
                    submitted_by_user_id=submitted_by_user_id,
                    answer_quality="not_helpful",
                    citation_quality="partial",
                    issue_labels=["answer_quality_review"],
                    feedback_notes="The answer missed the main source.",
                    created_at=datetime.now(timezone.utc),
                    updated_at=datetime.now(timezone.utc),
                )
            ]
        ),
    )

    service = ChatService(
        agent_repository=SimpleNamespace(),
        conversation_repository=SimpleNamespace(),
        message_repository=message_repository,
        retrieval_repository=SimpleNamespace(),
        settings=SimpleNamespace(),
        model_gateway=SimpleNamespace(),
    )

    response = await service.list_messages(
        tenant_id=tenant_id,
        conversation_id=conversation_id,
    )

    assert len(response[0].feedback_entries) == 1
    assert response[0].feedback_entries[0].answer_quality == "not_helpful"
    assert response[0].feedback_entries[0].citation_quality == "partial"


@pytest.mark.anyio
async def test_submit_message_feedback_upserts_assistant_feedback() -> None:
    tenant_id = uuid4()
    message_id = uuid4()
    submitted_by_user_id = uuid4()
    now = datetime.now(timezone.utc)
    message_repository = SimpleNamespace(
        get_message=AsyncMock(return_value=build_message(id=message_id, tenant_id=tenant_id, role="assistant")),
        upsert_message_feedback=AsyncMock(
            return_value=SimpleNamespace(
                id=uuid4(),
                message_id=message_id,
                submitted_by_user_id=submitted_by_user_id,
                answer_quality="not_helpful",
                citation_quality="partial",
                issue_labels=["answer_quality_review"],
                feedback_notes="Needs a stronger citation.",
                created_at=now,
                updated_at=now,
            )
        ),
    )
    service = ChatService(
        agent_repository=SimpleNamespace(),
        conversation_repository=SimpleNamespace(),
        message_repository=message_repository,
        retrieval_repository=SimpleNamespace(),
        settings=SimpleNamespace(),
        model_gateway=SimpleNamespace(),
    )

    response = await service.submit_message_feedback(
        tenant_id=tenant_id,
        message_id=message_id,
        submitted_by_user_id=submitted_by_user_id,
        request=MessageFeedbackCreateRequest(
            answer_quality="not_helpful",
            citation_quality="partial",
            issue_labels=["answer_quality_review"],
            feedback_notes="Needs a stronger citation.",
        ),
    )

    assert response.message_id == message_id
    assert response.submitted_by_user_id == submitted_by_user_id
    assert response.answer_quality == "not_helpful"
    message_repository.upsert_message_feedback.assert_awaited_once_with(
        tenant_id=tenant_id,
        message_id=message_id,
        submitted_by_user_id=submitted_by_user_id,
        answer_quality="not_helpful",
        citation_quality="partial",
        issue_labels=["answer_quality_review"],
        feedback_notes="Needs a stronger citation.",
    )


@pytest.mark.anyio
async def test_submit_message_feedback_rejects_user_message() -> None:
    tenant_id = uuid4()
    message_repository = SimpleNamespace(
        get_message=AsyncMock(return_value=build_message(role="user", tenant_id=tenant_id)),
    )
    service = ChatService(
        agent_repository=SimpleNamespace(),
        conversation_repository=SimpleNamespace(),
        message_repository=message_repository,
        retrieval_repository=SimpleNamespace(),
        settings=SimpleNamespace(),
        model_gateway=SimpleNamespace(),
    )

    with pytest.raises(ResourceConflictError):
        await service.submit_message_feedback(
            tenant_id=tenant_id,
            message_id=uuid4(),
            submitted_by_user_id=uuid4(),
            request=MessageFeedbackCreateRequest(
                answer_quality="not_helpful",
                citation_quality="broken",
            ),
        )


@pytest.mark.anyio
async def test_get_message_feedback_summary_returns_repository_counts() -> None:
    tenant_id = uuid4()
    workspace_id = uuid4()
    knowledge_base_id = uuid4()
    now = datetime.now(timezone.utc)
    message_repository = SimpleNamespace(
        summarize_message_feedback=AsyncMock(
            return_value=(
                {
                    "total_feedback": 4,
                    "helpful_feedback": 1,
                    "partially_helpful_feedback": 1,
                    "not_helpful_feedback": 2,
                    "citation_issue_feedback": 3,
                    "retrieval_tuning_candidates": 3,
                },
                [
                    SimpleNamespace(
                        id=uuid4(),
                        message_id=uuid4(),
                        conversation_id=uuid4(),
                        conversation_title="Grounded review thread",
                        knowledge_base_id=knowledge_base_id,
                        submitted_by_user_id=uuid4(),
                        answer_quality="not_helpful",
                        citation_quality="broken",
                        issue_labels=["citation_broken"],
                        feedback_notes="Source quote does not support the answer.",
                        created_at=now,
                        updated_at=now,
                        assistant_excerpt="Temporal was not mentioned in this answer.",
                        latest_user_question="Which system runs durable ingestion workflows?",
                        retrieval_profile_id=uuid4(),
                        retrieval_profile_name="RAGPilot-default",
                    )
                ],
            )
        )
    )
    retrieval_evaluation_repository = SimpleNamespace(
        get_latest_follow_up_status_by_queries=AsyncMock(
            return_value={"Which system runs durable ingestion workflows?": "resolved"}
        )
    )
    service = ChatService(
        agent_repository=SimpleNamespace(),
        conversation_repository=SimpleNamespace(),
        message_repository=message_repository,
        retrieval_repository=SimpleNamespace(),
        settings=SimpleNamespace(),
        model_gateway=SimpleNamespace(),
        retrieval_evaluation_repository=retrieval_evaluation_repository,
    )

    response = await service.get_message_feedback_summary(
        tenant_id=tenant_id,
        workspace_id=workspace_id,
        knowledge_base_id=knowledge_base_id,
    )

    assert response.total_feedback == 4
    assert response.retrieval_tuning_candidates == 3
    assert response.recent_feedback[0].citation_quality == "broken"
    assert response.recent_feedback[0].conversation_title == "Grounded review thread"
    assert response.recent_feedback[0].knowledge_base_id == knowledge_base_id
    assert response.recent_feedback[0].latest_user_question == "Which system runs durable ingestion workflows?"
    assert response.recent_feedback[0].retrieval_profile_name == "RAGPilot-default"
    assert response.recent_feedback[0].follow_up_status == "resolved"
    assert response.recent_feedback[0].recommended_actions[0].action_key == "review_knowledge_base_governance"
    assert response.recent_feedback[0].recommended_actions[1].action_key == "review_retrieval_profile_governance"
    assert response.recent_feedback[0].recommended_actions[2].action_key == "rerun_retrieval_comparison"
    assert response.recent_feedback[0].recommended_actions[3].action_key == "validate_in_chat"
    message_repository.summarize_message_feedback.assert_awaited_once_with(
        tenant_id=tenant_id,
        workspace_id=workspace_id,
        knowledge_base_id=knowledge_base_id,
    )
    retrieval_evaluation_repository.get_latest_follow_up_status_by_queries.assert_awaited_once_with(
        tenant_id=tenant_id,
        workspace_id=workspace_id,
        knowledge_base_id=knowledge_base_id,
        query_texts=["Which system runs durable ingestion workflows?"],
    )


@pytest.mark.anyio
async def test_ask_question_uses_persisted_retrieval_engine_and_includes_citation_source_metadata(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    tenant_id = uuid4()
    workspace_id = uuid4()
    knowledge_base_id = uuid4()
    agent_definition_id = uuid4()
    conversation = build_conversation(
        tenant_id=tenant_id,
        workspace_id=workspace_id,
        knowledge_base_id=knowledge_base_id,
        title="Durable ingestion",
    )
    user_message = build_message(
        tenant_id=tenant_id,
        conversation_id=conversation.id,
        role="user",
        content="Which system powers ingestion workflows?",
        model_name=None,
        usage_json={},
    )
    assistant_message = build_message(
        tenant_id=tenant_id,
        conversation_id=conversation.id,
        role="assistant",
        content="Temporal powers ingestion workflows.",
        model_name="test-model",
        usage_json={"prompt_tokens": 12},
    )
    document_id = uuid4()
    document_version_id = uuid4()
    document_chunk_id = uuid4()
    citation_id = uuid4()
    retrieval_profile_id = uuid4()
    captured_engine_names: list[str | None] = []

    from ragpilot_api.application.retrieval.retrieval_engines import NativeRetrievalEngine

    monkeypatch.setattr(
        "ragpilot_api.application.chat.chat_service.build_retrieval_engine",
        lambda settings, engine_name=None: (
            captured_engine_names.append(engine_name) or NativeRetrievalEngine()
        ),
    )

    conversation_repository = SimpleNamespace(
        get_conversation=AsyncMock(return_value=conversation),
        create_conversation=AsyncMock(),
    )
    message_repository = SimpleNamespace(
        create_message=AsyncMock(side_effect=[user_message, assistant_message]),
        create_message_citations=AsyncMock(
            return_value=[
                SimpleNamespace(
                    id=citation_id,
                    document_chunk_id=document_chunk_id,
                    rank=1,
                    score=0.991231,
                    quote="RAGPilot uses Temporal for durable ingestion workflows.",
                )
            ]
        ),
    )
    retrieval_repository = SimpleNamespace(
        search_vector_document_chunks=AsyncMock(
            return_value=[
                {
                    "document_chunk_id": document_chunk_id,
                    "document_id": document_id,
                    "document_version_id": document_version_id,
                    "knowledge_base_id": knowledge_base_id,
                    "document_title": "RAGPilot Web Demo",
                    "chunk_index": 2,
                    "content": "RAGPilot uses Temporal for durable ingestion workflows.",
                    "score": 0.991231,
                    "embedding_model": "text-embedding-test",
                    "metadata_json": {},
                    "created_at": datetime.now(timezone.utc),
                }
            ]
        ),
        search_lexical_document_chunks=AsyncMock(
            return_value=[
                {
                    "document_chunk_id": document_chunk_id,
                    "document_id": document_id,
                    "document_version_id": document_version_id,
                    "knowledge_base_id": knowledge_base_id,
                    "document_title": "RAGPilot Web Demo",
                    "chunk_index": 2,
                    "content": "RAGPilot uses Temporal for durable ingestion workflows.",
                    "token_count": 8,
                    "lexical_score": 3.0,
                    "embedding_model": None,
                    "metadata_json": {},
                    "created_at": datetime.now(timezone.utc),
                }
            ]
        ),
    )
    model_gateway = SimpleNamespace(
        generate_grounded_answer=AsyncMock(
            return_value=SimpleNamespace(
                content="Temporal powers ingestion workflows.",
                model_name="test-model",
                usage_json={"completion_tokens": 24},
            )
        )
    )
    runtime_binding = RuntimeModelBinding(
        provider_type="deterministic",
        model_name="agent-runtime-model",
        source="model_endpoint",
        configured_model_endpoint_id=agent_definition_id,
        configured_model_endpoint_name="Broken Runtime",
        fallback_applied=True,
        fallback_reason="model_endpoint_disabled:settings",
    )
    runtime_binding_resolver = SimpleNamespace(
        resolve_chat_runtime_binding=AsyncMock(return_value=runtime_binding)
    )
    agent_repository = SimpleNamespace(
        get_agent_definition=AsyncMock(
            return_value=SimpleNamespace(
                id=agent_definition_id,
                tenant_id=tenant_id,
                name="Grounded Support Agent",
                slug="grounded-support-agent",
                agent_mode="grounded_chat",
                agent_status="active",
                objective="Answer operational questions using grounded knowledge.",
                instructions="Keep the answer concise and rely on retrieved evidence.",
                knowledge_base_scope="ragpilot-operations/ragpilot-handbook",
                tool_bindings_json=["chat"],
                tool_registration_ids_json=[],
            )
        )
    )

    service = ChatService(
        agent_repository=agent_repository,
        conversation_repository=conversation_repository,
        message_repository=message_repository,
        retrieval_repository=retrieval_repository,
        settings=SimpleNamespace(
            retrieval_embedding_dimension=8,
            retrieval_embedding_model="text-embedding-test",
        ),
        model_gateway=model_gateway,
        runtime_binding_resolver=runtime_binding_resolver,
        knowledge_base_repository=SimpleNamespace(
            get_knowledge_base_by_id=AsyncMock(
                return_value=SimpleNamespace(retrieval_profile_id=retrieval_profile_id)
            )
        ),
        retrieval_profile_repository=SimpleNamespace(
            get_retrieval_profile=AsyncMock(
                return_value=SimpleNamespace(
                    id=retrieval_profile_id,
                    name="Authorized LlamaIndex",
                    is_enabled=True,
                    engine_name="llamaindex_pilot",
                    engine_version="llamaindex_authorized_context_v1",
                    retrieval_mode="hybrid",
                    top_k=8,
                    vector_weight=0.65,
                    lexical_weight=0.35,
                    hybrid_overlap_bonus=0.05,
                    llamaindex_similarity_cutoff=0.2,
                    llamaindex_long_context_reorder_enabled=True,
                )
            ),
            get_default_enabled_retrieval_profile=AsyncMock(),
        ),
    )

    response = await service.ask_question(
        ChatAskRequest(
            tenant_id=tenant_id,
            workspace_id=workspace_id,
            knowledge_base_id=knowledge_base_id,
            agent_definition_id=agent_definition_id,
            conversation_id=conversation.id,
            question="Which system powers ingestion workflows?",
            top_k=3,
        )
    )

    assert response.assistant_message.content == "Temporal powers ingestion workflows."
    assert len(response.assistant_message.citations) == 1
    citation = response.assistant_message.citations[0]
    assert citation.id == citation_id
    assert citation.document_id == document_id
    assert citation.document_title == "RAGPilot Web Demo"
    assert citation.document_version_id == document_version_id
    assert citation.knowledge_base_id == knowledge_base_id
    assert citation.chunk_index == 2
    assert citation.retrieval_method == "hybrid"
    assert citation.vector_score == 0.991231
    assert citation.lexical_score == 3.0
    assert citation.lexical_normalized_score == 1.0
    retrieval_repository.search_vector_document_chunks.assert_awaited_once()
    retrieval_repository.search_lexical_document_chunks.assert_awaited_once()
    agent_repository.get_agent_definition.assert_awaited_once_with(
        agent_definition_id=agent_definition_id,
        tenant_id=tenant_id,
    )
    model_gateway.generate_grounded_answer.assert_awaited_once()
    runtime_binding_resolver.resolve_chat_runtime_binding.assert_awaited_once()
    assert model_gateway.generate_grounded_answer.await_args.kwargs["agent_name"] == "Grounded Support Agent"
    assert model_gateway.generate_grounded_answer.await_args.kwargs["agent_mode"] == "grounded_chat"
    assert model_gateway.generate_grounded_answer.await_args.kwargs["runtime_binding"] == runtime_binding
    message_repository.create_message_citations.assert_awaited_once()
    assistant_create_call = message_repository.create_message.await_args_list[1]
    assert assistant_create_call.kwargs["usage_json"]["retrieval_mode"] == "hybrid"
    assert captured_engine_names == ["llamaindex_pilot"]
    assert assistant_create_call.kwargs["usage_json"]["retrieval_engine"] == "llamaindex_pilot"
    assert assistant_create_call.kwargs["usage_json"]["retrieval_engine_version"] == "llamaindex_authorized_context_v1"
    assert assistant_create_call.kwargs["usage_json"]["retrieval_method_breakdown"] == {
        "hybrid": 1,
        "vector": 0,
        "lexical": 0,
    }
    assert assistant_create_call.kwargs["usage_json"]["runtime_binding_resolution"] == {
        "configured_model_endpoint_id": str(agent_definition_id),
        "configured_model_endpoint_name": "Broken Runtime",
        "fallback_applied": True,
        "fallback_reason": "model_endpoint_disabled:settings",
    }
    assert assistant_create_call.kwargs["usage_json"]["agent_context"] == {
        "agent_definition_id": str(agent_definition_id),
        "name": "Grounded Support Agent",
        "slug": "grounded-support-agent",
        "mode": "grounded_chat",
        "knowledge_base_scope": "ragpilot-operations/ragpilot-handbook",
        "objective_attached": True,
        "instructions_attached": True,
        "tool_count": 1,
        "tool_registration_count": 0,
    }
    assert assistant_create_call.kwargs["usage_json"]["retrieval_diagnostics"][0]["retrieval_method"] == "hybrid"
