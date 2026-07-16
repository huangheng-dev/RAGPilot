from __future__ import annotations

from dataclasses import dataclass
from collections.abc import Awaitable, Callable
from typing import Any
from uuid import UUID

from ragpilot_api.application.chat.conversation_intent import build_conversational_response
from ragpilot_api.application.chat.response_builder import build_suggested_conversation_title
from ragpilot_api.application.errors import ResourceConflictError, ResourceNotFoundError
from ragpilot_api.application.model_gateway.model_gateway import ModelGateway
from ragpilot_api.application.model_gateway.runtime_binding_resolver import RuntimeBindingResolver
from ragpilot_api.application.retrieval.retrieval_engines import (
    build_retrieval_engine,
    normalize_retrieval_engine_name,
)
from ragpilot_api.application.retrieval.retrieval_runtime import resolve_retrieval_profile
from ragpilot_api.contracts.http.chat_contracts import (
    ChatAskRequest,
    ChatAskResponse,
    ConversationCreateRequest,
    ConversationMetricsResponse,
    ConversationResponse,
    ConversationUpdateRequest,
    MessageFeedbackCreateRequest,
    MessageFeedbackFollowUpActionResponse,
    MessageFeedbackResponse,
    MessageFeedbackSummaryItemResponse,
    MessageFeedbackSummaryResponse,
    MessageCitationResponse,
    MessageResponse,
)
from ragpilot_api.infrastructure.database.models import AgentDefinition
from ragpilot_api.infrastructure.database.models import Conversation, Message, MessageCitation
from ragpilot_api.infrastructure.database.repositories.agent_repository import AgentRepository
from ragpilot_api.infrastructure.database.repositories.conversation_repository import ConversationRepository
from ragpilot_api.infrastructure.database.repositories.knowledge_base_repository import KnowledgeBaseRepository
from ragpilot_api.infrastructure.database.repositories.model_endpoint_repository import ModelEndpointRepository
from ragpilot_api.infrastructure.database.repositories.message_repository import (
    MessageCitationRecord,
    MessageFeedbackRecord,
    MessageFeedbackSummaryRecord,
    MessageRepository,
)
from ragpilot_api.infrastructure.database.repositories.retrieval_profile_repository import RetrievalProfileRepository
from ragpilot_api.infrastructure.database.repositories.retrieval_evaluation_repository import RetrievalEvaluationRepository
from ragpilot_api.infrastructure.database.repositories.retrieval_repository import RetrievalRepository
from ragpilot_api.shared.settings import Settings


@dataclass(frozen=True)
class CitationSourceContext:
    document_id: UUID | None = None
    document_title: str | None = None
    document_version_id: UUID | None = None
    knowledge_base_id: UUID | None = None
    chunk_index: int | None = None
    retrieval_method: str | None = None
    vector_score: float | None = None
    lexical_score: float | None = None
    lexical_normalized_score: float | None = None
    source_location_type: str | None = None
    source_location_label: str | None = None
    source_page_number: int | None = None
    source_sheet_name: str | None = None
    source_table_number: int | None = None
    source_is_ocr: bool = False


class ChatService:
    def __init__(
        self,
        agent_repository: AgentRepository,
        conversation_repository: ConversationRepository,
        message_repository: MessageRepository,
        retrieval_repository: RetrievalRepository,
        settings: Settings,
        model_gateway: ModelGateway | None = None,
        model_endpoint_repository: ModelEndpointRepository | None = None,
        knowledge_base_repository: KnowledgeBaseRepository | None = None,
        retrieval_profile_repository: RetrievalProfileRepository | None = None,
        retrieval_evaluation_repository: RetrievalEvaluationRepository | None = None,
        runtime_binding_resolver: RuntimeBindingResolver | None = None,
    ) -> None:
        self.agent_repository = agent_repository
        self.conversation_repository = conversation_repository
        self.message_repository = message_repository
        self.retrieval_repository = retrieval_repository
        self.settings = settings
        self.model_gateway = model_gateway or ModelGateway(settings)
        self.knowledge_base_repository = knowledge_base_repository
        self.retrieval_profile_repository = retrieval_profile_repository
        self.retrieval_evaluation_repository = retrieval_evaluation_repository
        self.runtime_binding_resolver = runtime_binding_resolver or (
            RuntimeBindingResolver(model_endpoint_repository, settings)
            if model_endpoint_repository is not None
            else None
        )

    async def create_conversation(self, request: ConversationCreateRequest) -> ConversationResponse:
        conversation = await self.conversation_repository.create_conversation(
            tenant_id=request.tenant_id,
            workspace_id=request.workspace_id,
            knowledge_base_id=request.knowledge_base_id,
            title=request.title,
            created_by_user_id=request.created_by_user_id,
        )
        return build_conversation_response(conversation)

    async def list_conversations(
        self,
        *,
        tenant_id: UUID,
        workspace_id: UUID,
        query: str | None = None,
        limit: int = 100,
    ) -> list[ConversationResponse]:
        conversations = await self.conversation_repository.list_conversations(
            tenant_id=tenant_id,
            workspace_id=workspace_id,
            query=query,
            limit=limit,
        )
        return [
            build_conversation_response(
                item["conversation"],
                message_count=int(item["message_count"]),
                latest_activity_at=item["latest_activity_at"],
            )
            for item in conversations
        ]

    async def get_conversation_metrics(
        self,
        *,
        tenant_id: UUID,
        workspace_id: UUID | None = None,
    ) -> ConversationMetricsResponse:
        metrics = await self.conversation_repository.get_conversation_metrics(
            tenant_id=tenant_id,
            workspace_id=workspace_id,
        )
        return ConversationMetricsResponse(**metrics)

    async def update_conversation(
        self,
        *,
        conversation_id: UUID,
        tenant_id: UUID,
        request: ConversationUpdateRequest,
    ) -> ConversationResponse:
        conversation = await self.conversation_repository.update_conversation_title(
            conversation_id=conversation_id,
            tenant_id=tenant_id,
            title=request.title,
        )
        if conversation is None:
            raise ResourceNotFoundError("Conversation was not found in the current tenant scope.")

        return build_conversation_response(conversation)

    async def delete_conversation(self, *, conversation_id: UUID, tenant_id: UUID) -> None:
        deleted = await self.conversation_repository.delete_conversation(
            conversation_id=conversation_id,
            tenant_id=tenant_id,
        )
        if not deleted:
            raise ResourceNotFoundError("Conversation was not found in the current tenant scope.")

    async def list_messages(self, *, tenant_id: UUID, conversation_id: UUID) -> list[MessageResponse]:
        messages = await self.message_repository.list_messages(
            tenant_id=tenant_id,
            conversation_id=conversation_id,
        )
        citations = await self.message_repository.list_message_citations(
            tenant_id=tenant_id,
            message_ids=[message.id for message in messages],
        )
        citations_by_message_id: dict[UUID, list[MessageCitationRecord]] = {}
        for citation in citations:
            citations_by_message_id.setdefault(citation.message_id, []).append(citation)
        feedback_entries = await self.message_repository.list_message_feedback(
            tenant_id=tenant_id,
            message_ids=[message.id for message in messages],
        )
        feedback_by_message_id: dict[UUID, list[MessageFeedbackRecord]] = {}
        for feedback_entry in feedback_entries:
            feedback_by_message_id.setdefault(feedback_entry.message_id, []).append(feedback_entry)

        return [
            build_message_response(
                message,
                citations_by_message_id.get(message.id, []),
                feedback_entries=feedback_by_message_id.get(message.id, []),
                citation_context_by_chunk_id=build_citation_context_by_chunk_id_from_usage_json(message.usage_json),
            )
            for message in messages
        ]

    async def submit_message_feedback(
        self,
        *,
        tenant_id: UUID,
        message_id: UUID,
        submitted_by_user_id: UUID,
        request: MessageFeedbackCreateRequest,
    ) -> MessageFeedbackResponse:
        message = await self.message_repository.get_message(
            tenant_id=tenant_id,
            message_id=message_id,
        )
        if message is None:
            raise ResourceNotFoundError("Message was not found in the current tenant scope.")
        if message.role != "assistant":
            raise ResourceConflictError("Feedback can only be attached to assistant messages.")

        feedback_entry = await self.message_repository.upsert_message_feedback(
            tenant_id=tenant_id,
            message_id=message_id,
            submitted_by_user_id=submitted_by_user_id,
            answer_quality=request.answer_quality,
            citation_quality=request.citation_quality,
            issue_labels=request.issue_labels,
            feedback_notes=request.feedback_notes,
        )
        return build_message_feedback_response(feedback_entry)

    async def get_message_feedback_summary(
        self,
        *,
        tenant_id: UUID,
        workspace_id: UUID,
        knowledge_base_id: UUID | None = None,
    ) -> MessageFeedbackSummaryResponse:
        counts, recent_feedback = await self.message_repository.summarize_message_feedback(
            tenant_id=tenant_id,
            workspace_id=workspace_id,
            knowledge_base_id=knowledge_base_id,
        )
        follow_up_status_by_query = await self._load_feedback_follow_up_status_by_query(
            tenant_id=tenant_id,
            workspace_id=workspace_id,
            knowledge_base_id=knowledge_base_id,
            recent_feedback=recent_feedback,
        )
        return MessageFeedbackSummaryResponse(
            total_feedback=counts["total_feedback"],
            helpful_feedback=counts["helpful_feedback"],
            partially_helpful_feedback=counts["partially_helpful_feedback"],
            not_helpful_feedback=counts["not_helpful_feedback"],
            citation_issue_feedback=counts["citation_issue_feedback"],
            retrieval_tuning_candidates=counts["retrieval_tuning_candidates"],
            recent_feedback=[
                build_message_feedback_summary_item_response(
                    item,
                    knowledge_base_id=knowledge_base_id,
                    follow_up_status=follow_up_status_by_query.get(item.latest_user_question.strip(), "pending")
                    if item.latest_user_question and item.latest_user_question.strip()
                    else "pending",
                )
                for item in recent_feedback
            ],
        )

    async def _load_feedback_follow_up_status_by_query(
        self,
        *,
        tenant_id: UUID,
        workspace_id: UUID,
        knowledge_base_id: UUID | None,
        recent_feedback: list[MessageFeedbackSummaryRecord],
    ) -> dict[str, str]:
        if self.retrieval_evaluation_repository is None:
            return {}

        query_texts = [
            item.latest_user_question.strip()
            for item in recent_feedback
            if item.latest_user_question and item.latest_user_question.strip()
        ]
        if not query_texts:
            return {}

        return await self.retrieval_evaluation_repository.get_latest_follow_up_status_by_queries(
            tenant_id=tenant_id,
            workspace_id=workspace_id,
            knowledge_base_id=knowledge_base_id,
            query_texts=query_texts,
        )

    async def ask_question(
        self,
        request: ChatAskRequest,
        *,
        on_delta: Callable[[str], Awaitable[None]] | None = None,
        retrieval_acl_bypass: bool = False,
    ) -> ChatAskResponse:
        active_agent_definition = await self._resolve_active_agent_definition(request)
        conversation = await self._resolve_conversation(request)
        user_message = await self.message_repository.create_message(
            tenant_id=request.tenant_id,
            conversation_id=conversation.id,
            role="user",
            content=request.question,
            model_name=None,
            usage_json={},
        )

        conversational_response = build_conversational_response(request.question)
        if conversational_response is not None:
            assistant_message = await self.message_repository.create_message(
                tenant_id=request.tenant_id,
                conversation_id=conversation.id,
                role="assistant",
                content=conversational_response,
                model_name="ragpilot-intent-router",
                usage_json={
                    "provider": "intent_router",
                    "intent": "greeting",
                    "retrieval_skipped": True,
                    "retrieval_result_count": 0,
                },
            )
            if on_delta is not None:
                for offset in range(0, len(conversational_response), 24):
                    await on_delta(conversational_response[offset:offset + 24])
            return ChatAskResponse(
                conversation=build_conversation_response(conversation),
                user_message=build_message_response(user_message, []),
                assistant_message=build_message_response(assistant_message, []),
            )

        resolved_retrieval_profile = await resolve_retrieval_profile(
            knowledge_base_id=request.knowledge_base_id,
            requested_top_k=request.top_k,
            settings=self.settings,
            knowledge_base_repository=self.knowledge_base_repository,
            retrieval_profile_repository=self.retrieval_profile_repository,
        )
        configured_retrieval_engine = normalize_retrieval_engine_name(
            resolved_retrieval_profile.engine_name
        )
        retrieval_engine = build_retrieval_engine(
            self.settings,
            engine_name=configured_retrieval_engine,
        )
        retrieval_outcome = await retrieval_engine.execute(
            retrieval_repository=self.retrieval_repository,
            settings=self.settings,
            tenant_id=request.tenant_id,
            knowledge_base_id=request.knowledge_base_id,
            query_text=request.question,
            requested_top_k=request.top_k,
            principal_user_id=request.created_by_user_id,
            acl_bypass=retrieval_acl_bypass,
            knowledge_base_repository=self.knowledge_base_repository,
            retrieval_profile_repository=self.retrieval_profile_repository,
            resolved_profile=resolved_retrieval_profile,
        )
        retrieved_chunks = retrieval_outcome.results
        runtime_binding = (
            await self.runtime_binding_resolver.resolve_chat_runtime_binding(agent_definition=active_agent_definition)
            if self.runtime_binding_resolver is not None
            else None
        )

        generation = await self.model_gateway.generate_grounded_answer(
            question=request.question,
            retrieval_results=retrieved_chunks,
            runtime_binding=runtime_binding,
            agent_name=active_agent_definition.name if active_agent_definition else None,
            agent_mode=active_agent_definition.agent_mode if active_agent_definition else None,
            agent_objective=active_agent_definition.objective if active_agent_definition else None,
            agent_instructions=active_agent_definition.instructions if active_agent_definition else None,
            knowledge_base_scope=active_agent_definition.knowledge_base_scope if active_agent_definition else None,
            on_delta=on_delta,
        )
        assistant_message = await self.message_repository.create_message(
            tenant_id=request.tenant_id,
            conversation_id=conversation.id,
            role="assistant",
            content=generation.content,
            model_name=generation.model_name,
            usage_json={
                **generation.usage_json,
                "retrieval_result_count": len(retrieved_chunks),
                "retrieval_engine": retrieval_outcome.engine_name,
                "retrieval_engine_version": retrieval_outcome.engine_version,
                "retrieval_mode": retrieval_outcome.retrieval_mode,
                "retrieval_profile_id": str(retrieval_outcome.retrieval_profile_id) if retrieval_outcome.retrieval_profile_id else None,
                "retrieval_profile_name": retrieval_outcome.retrieval_profile_name,
                "retrieval_profile_source": retrieval_outcome.retrieval_profile_source,
                "retrieval_effective_top_k": retrieval_outcome.effective_top_k,
                "retrieval_rerank_applied": retrieval_outcome.rerank_applied,
                "retrieval_rerank_strategy": retrieval_outcome.rerank_strategy,
                "retrieval_rerank_window": retrieval_outcome.rerank_window,
                "retrieval_plan": retrieval_outcome.retrieval_plan_metadata,
                "retrieval_evidence_validation": retrieval_outcome.evidence_validation_metadata,
                "retrieval_method_breakdown": {
                    "hybrid": sum(1 for row in retrieved_chunks if row.get("retrieval_method") == "hybrid"),
                    "vector": sum(1 for row in retrieved_chunks if row.get("retrieval_method") == "vector"),
                    "lexical": sum(1 for row in retrieved_chunks if row.get("retrieval_method") == "lexical"),
                },
                "retrieval_embedding_model": retrieval_outcome.embedding_model,
                "agent_context": (
                    {
                        "agent_definition_id": str(active_agent_definition.id),
                        "name": active_agent_definition.name,
                        "slug": active_agent_definition.slug,
                        "mode": active_agent_definition.agent_mode,
                        "knowledge_base_scope": active_agent_definition.knowledge_base_scope,
                        "objective_attached": bool(active_agent_definition.objective.strip()),
                        "instructions_attached": bool(active_agent_definition.instructions.strip()),
                        "tool_count": len(active_agent_definition.tool_bindings_json or []),
                        "tool_registration_count": len(active_agent_definition.tool_registration_ids_json or []),
                    }
                    if active_agent_definition is not None
                    else None
                ),
                "runtime_binding_resolution": (
                    {
                        "configured_model_endpoint_id": (
                            str(runtime_binding.configured_model_endpoint_id)
                            if runtime_binding is not None and runtime_binding.configured_model_endpoint_id is not None
                            else None
                        ),
                        "configured_model_endpoint_name": (
                            runtime_binding.configured_model_endpoint_name if runtime_binding is not None else None
                        ),
                        "fallback_applied": runtime_binding.fallback_applied if runtime_binding is not None else False,
                        "fallback_reason": runtime_binding.fallback_reason if runtime_binding is not None else None,
                    }
                    if runtime_binding is not None
                    else None
                ),
                "retrieval_diagnostics": [
                    {
                        "document_chunk_id": str(row["document_chunk_id"]),
                        "retrieval_method": row.get("retrieval_method"),
                        "score": float(row["score"]) if row.get("score") is not None else None,
                        "vector_score": float(row["vector_score"]) if row.get("vector_score") is not None else None,
                        "lexical_score": float(row["lexical_score"]) if row.get("lexical_score") is not None else None,
                        "lexical_normalized_score": float(row["lexical_normalized_score"]) if row.get("lexical_normalized_score") is not None else None,
                        "rerank_score": float(row["rerank_score"]) if row.get("rerank_score") is not None else None,
                        "rerank_rank": int(row["rerank_rank"]) if row.get("rerank_rank") is not None else None,
                        "source_locator": {
                            key: value for key, value in dict(row.get("metadata_json") or {}).items()
                            if key.startswith("source_")
                        },
                    }
                    for row in retrieved_chunks
                ],
            },
        )
        assistant_citations = await self.message_repository.create_message_citations(
            tenant_id=request.tenant_id,
            message_id=assistant_message.id,
            citations=[
                {
                    "document_chunk_id": row["document_chunk_id"],
                    "rank": index + 1,
                    "score": float(row["score"]),
                    "quote": row["content"][:320],
                }
                for index, row in enumerate(retrieved_chunks)
            ],
        )
        citation_context_by_chunk_id = build_citation_context_by_chunk_id(retrieved_chunks)

        return ChatAskResponse(
            conversation=build_conversation_response(conversation),
            user_message=build_message_response(user_message, []),
            assistant_message=build_message_response(
                assistant_message,
                assistant_citations,
                citation_context_by_chunk_id=citation_context_by_chunk_id,
            ),
        )

    async def _resolve_conversation(self, request: ChatAskRequest) -> Conversation:
        if request.conversation_id is not None:
            conversation = await self.conversation_repository.get_conversation(
                conversation_id=request.conversation_id,
                tenant_id=request.tenant_id,
            )
            if conversation is not None:
                return conversation

        return await self.conversation_repository.create_conversation(
            tenant_id=request.tenant_id,
            workspace_id=request.workspace_id,
            knowledge_base_id=request.knowledge_base_id,
            title=build_suggested_conversation_title(request.question),
            created_by_user_id=request.created_by_user_id,
        )

    async def _resolve_active_agent_definition(
        self,
        request: ChatAskRequest,
    ) -> AgentDefinition | None:
        if request.agent_definition_id is None:
            return None

        agent_definition = await self.agent_repository.get_agent_definition(
            agent_definition_id=request.agent_definition_id,
            tenant_id=request.tenant_id,
        )
        if agent_definition is None or agent_definition.agent_status != "active":
            raise ResourceNotFoundError("Active agent definition was not found in the current tenant scope.")

        return agent_definition


def build_conversation_response(
    conversation: Conversation,
    *,
    message_count: int = 0,
    latest_activity_at=None,
) -> ConversationResponse:
    return ConversationResponse(
        id=conversation.id,
        tenant_id=conversation.tenant_id,
        workspace_id=conversation.workspace_id,
        knowledge_base_id=conversation.knowledge_base_id,
        title=conversation.title,
        created_by_user_id=conversation.created_by_user_id,
        message_count=message_count,
        latest_activity_at=latest_activity_at or conversation.updated_at,
        created_at=conversation.created_at,
        updated_at=conversation.updated_at,
    )


def build_citation_context_by_chunk_id(retrieved_chunks: list[dict[str, Any]]) -> dict[UUID, CitationSourceContext]:
    contexts: dict[UUID, CitationSourceContext] = {}
    for row in retrieved_chunks:
        document_chunk_id = row.get("document_chunk_id")
        if document_chunk_id is None:
            continue
        contexts[document_chunk_id] = CitationSourceContext(
            document_id=row.get("document_id"),
            document_title=row.get("document_title"),
            document_version_id=row.get("document_version_id"),
            knowledge_base_id=row.get("knowledge_base_id"),
            chunk_index=row.get("chunk_index"),
            retrieval_method=row.get("retrieval_method"),
            vector_score=float(row["vector_score"]) if row.get("vector_score") is not None else None,
            lexical_score=float(row["lexical_score"]) if row.get("lexical_score") is not None else None,
            lexical_normalized_score=float(row["lexical_normalized_score"]) if row.get("lexical_normalized_score") is not None else None,
            **build_citation_locator(dict(row.get("metadata_json") or {})),
        )
    return contexts


def build_citation_context_by_chunk_id_from_usage_json(usage_json: dict[str, Any] | None) -> dict[UUID, CitationSourceContext]:
    if not usage_json:
        return {}

    diagnostics = usage_json.get("retrieval_diagnostics")
    if not isinstance(diagnostics, list):
        return {}

    contexts: dict[UUID, CitationSourceContext] = {}
    for item in diagnostics:
        if not isinstance(item, dict):
            continue

        document_chunk_id = item.get("document_chunk_id")
        if not document_chunk_id:
            continue

        try:
            parsed_chunk_id = UUID(str(document_chunk_id))
        except (TypeError, ValueError):
            continue

        contexts[parsed_chunk_id] = CitationSourceContext(
            retrieval_method=item.get("retrieval_method"),
            vector_score=float(item["vector_score"]) if item.get("vector_score") is not None else None,
            lexical_score=float(item["lexical_score"]) if item.get("lexical_score") is not None else None,
            lexical_normalized_score=float(item["lexical_normalized_score"]) if item.get("lexical_normalized_score") is not None else None,
            **build_citation_locator(item.get("source_locator") if isinstance(item.get("source_locator"), dict) else {}),
        )

    return contexts


def build_message_response(
    message: Message,
    citations: list[MessageCitation | MessageCitationRecord],
    *,
    feedback_entries: list[MessageFeedbackRecord] | None = None,
    citation_context_by_chunk_id: dict[UUID, CitationSourceContext] | None = None,
) -> MessageResponse:
    return MessageResponse(
        id=message.id,
        tenant_id=message.tenant_id,
        conversation_id=message.conversation_id,
        role=message.role,
        content=message.content,
        model_name=message.model_name,
        usage_json=message.usage_json,
        prompt_version_id=getattr(message, "prompt_version_id", None),
        prompt_snapshot_hash=getattr(message, "prompt_snapshot_hash", None),
        created_at=message.created_at,
        citations=[
            build_message_citation_response(
                citation,
                citation_context_by_chunk_id=citation_context_by_chunk_id,
            )
            for citation in citations
        ],
        feedback_entries=[
            build_message_feedback_response(feedback_entry)
            for feedback_entry in (feedback_entries or [])
        ],
    )


def build_message_citation_response(
    citation: MessageCitation | MessageCitationRecord,
    *,
    citation_context_by_chunk_id: dict[UUID, CitationSourceContext] | None = None,
) -> MessageCitationResponse:
    citation_context = CitationSourceContext(
        document_id=getattr(citation, "document_id", None),
        document_title=getattr(citation, "document_title", None),
        document_version_id=getattr(citation, "document_version_id", None),
        knowledge_base_id=getattr(citation, "knowledge_base_id", None),
        chunk_index=getattr(citation, "chunk_index", None),
    )

    if (
        citation_context.document_id is None
        and citation_context.document_title is None
        and citation_context.document_version_id is None
        and citation_context.knowledge_base_id is None
        and citation_context.chunk_index is None
        and citation_context_by_chunk_id is not None
    ):
        citation_context = citation_context_by_chunk_id.get(
            citation.document_chunk_id,
            CitationSourceContext(),
        )
    elif citation_context_by_chunk_id is not None:
        diagnostic_context = citation_context_by_chunk_id.get(citation.document_chunk_id)
        if diagnostic_context is not None:
            citation_context = CitationSourceContext(
                document_id=citation_context.document_id,
                document_title=citation_context.document_title,
                document_version_id=citation_context.document_version_id,
                knowledge_base_id=citation_context.knowledge_base_id,
                chunk_index=citation_context.chunk_index,
                retrieval_method=diagnostic_context.retrieval_method,
                vector_score=diagnostic_context.vector_score,
                lexical_score=diagnostic_context.lexical_score,
                lexical_normalized_score=diagnostic_context.lexical_normalized_score,
                source_location_type=diagnostic_context.source_location_type,
                source_location_label=diagnostic_context.source_location_label,
                source_page_number=diagnostic_context.source_page_number,
                source_sheet_name=diagnostic_context.source_sheet_name,
                source_table_number=diagnostic_context.source_table_number,
                source_is_ocr=diagnostic_context.source_is_ocr,
            )

    return MessageCitationResponse(
        id=citation.id,
        document_chunk_id=citation.document_chunk_id,
        document_id=citation_context.document_id,
        document_title=citation_context.document_title,
        document_version_id=citation_context.document_version_id,
        knowledge_base_id=citation_context.knowledge_base_id,
        chunk_index=citation_context.chunk_index,
        rank=citation.rank,
        score=float(citation.score) if citation.score is not None else None,
        retrieval_method=citation_context.retrieval_method,
        vector_score=citation_context.vector_score,
        lexical_score=citation_context.lexical_score,
        lexical_normalized_score=citation_context.lexical_normalized_score,
        source_location_type=citation_context.source_location_type,
        source_location_label=citation_context.source_location_label,
        source_page_number=citation_context.source_page_number,
        source_sheet_name=citation_context.source_sheet_name,
        source_table_number=citation_context.source_table_number,
        source_is_ocr=citation_context.source_is_ocr,
        quote=citation.quote,
    )


def build_citation_locator(metadata: dict[str, Any]) -> dict[str, Any]:
    return {
        "source_location_type": metadata.get("source_location_type"),
        "source_location_label": metadata.get("source_location_label"),
        "source_page_number": metadata.get("source_page_number"),
        "source_sheet_name": metadata.get("source_sheet_name"),
        "source_table_number": metadata.get("source_table_number"),
        "source_is_ocr": bool(metadata.get("source_is_ocr", False)),
    }


def build_message_feedback_response(feedback_entry: MessageFeedbackRecord) -> MessageFeedbackResponse:
    return MessageFeedbackResponse(
        id=feedback_entry.id,
        message_id=feedback_entry.message_id,
        submitted_by_user_id=feedback_entry.submitted_by_user_id,
        answer_quality=feedback_entry.answer_quality,
        citation_quality=feedback_entry.citation_quality,
        issue_labels=feedback_entry.issue_labels,
        feedback_notes=feedback_entry.feedback_notes,
        created_at=feedback_entry.created_at,
        updated_at=feedback_entry.updated_at,
    )


def build_message_feedback_summary_item_response(
    feedback_entry: MessageFeedbackSummaryRecord,
    *,
    knowledge_base_id: UUID | None,
    follow_up_status: str = "pending",
) -> MessageFeedbackSummaryItemResponse:
    return MessageFeedbackSummaryItemResponse(
        id=feedback_entry.id,
        message_id=feedback_entry.message_id,
        conversation_id=feedback_entry.conversation_id,
        conversation_title=feedback_entry.conversation_title,
        knowledge_base_id=feedback_entry.knowledge_base_id,
        submitted_by_user_id=feedback_entry.submitted_by_user_id,
        answer_quality=feedback_entry.answer_quality,
        citation_quality=feedback_entry.citation_quality,
        issue_labels=feedback_entry.issue_labels,
        feedback_notes=feedback_entry.feedback_notes,
        created_at=feedback_entry.created_at,
        updated_at=feedback_entry.updated_at,
        assistant_excerpt=feedback_entry.assistant_excerpt,
        latest_user_question=feedback_entry.latest_user_question,
        retrieval_profile_id=feedback_entry.retrieval_profile_id,
        retrieval_profile_name=feedback_entry.retrieval_profile_name,
        follow_up_status=follow_up_status,
        recommended_actions=build_message_feedback_follow_up_actions(
            feedback_entry,
            knowledge_base_id=knowledge_base_id,
        ),
    )


def build_message_feedback_follow_up_actions(
    feedback_entry: MessageFeedbackSummaryRecord,
    *,
    knowledge_base_id: UUID | None,
) -> list[MessageFeedbackFollowUpActionResponse]:
    actions: list[MessageFeedbackFollowUpActionResponse] = []
    requires_governance_review = (
        feedback_entry.answer_quality == "not_helpful"
        or feedback_entry.citation_quality != "grounded"
    )

    if knowledge_base_id is not None and feedback_entry.citation_quality != "grounded":
        actions.append(
            MessageFeedbackFollowUpActionResponse(
                action_key="review_knowledge_base_governance",
                action_category="governance",
                action_label="Review knowledge base scope",
                action_reason=(
                    "Recent answer feedback reported citation grounding issues, so the current knowledge-base source scope should be reviewed."
                ),
            )
        )

    if requires_governance_review:
        actions.append(
            MessageFeedbackFollowUpActionResponse(
                action_key="review_retrieval_profile_governance",
                action_category="governance",
                action_label="Review retrieval profile",
                action_reason=(
                    "Recent answer feedback suggests the governed retrieval posture may need tuning before broader operator reuse."
                ),
            )
        )

    if feedback_entry.latest_user_question:
        actions.append(
            MessageFeedbackFollowUpActionResponse(
                action_key="rerun_retrieval_comparison",
                action_category="analysis",
                action_label="Run compare check",
                action_reason=(
                    "Re-run retrieval comparison on the same source question to confirm whether the current retrieval path is still drifting."
                ),
            )
        )
        actions.append(
            MessageFeedbackFollowUpActionResponse(
                action_key="validate_in_chat",
                action_category="validation",
                action_label="Validate in chat",
                action_reason=(
                    "Return to grounded validation with the same question after governance or retrieval adjustments are ready."
                ),
            )
        )

    return actions
