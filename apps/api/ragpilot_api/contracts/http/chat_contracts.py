from typing import Literal
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class ConversationCreateRequest(BaseModel):
    tenant_id: UUID
    workspace_id: UUID
    knowledge_base_id: UUID | None = None
    title: str = Field(min_length=1, max_length=240)
    created_by_user_id: UUID | None = None


class ConversationResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    workspace_id: UUID
    knowledge_base_id: UUID | None
    title: str
    created_by_user_id: UUID | None
    message_count: int = 0
    latest_activity_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class ConversationUpdateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=240)


class ConversationMetricsResponse(BaseModel):
    total_conversations: int
    active_conversations: int
    total_messages: int
    latest_activity_at: datetime | None


class MessageCitationResponse(BaseModel):
    id: UUID
    document_chunk_id: UUID
    document_id: UUID | None = None
    document_title: str | None = None
    document_version_id: UUID | None = None
    knowledge_base_id: UUID | None = None
    chunk_index: int | None = None
    rank: int
    score: float | None
    retrieval_method: str | None = None
    vector_score: float | None = None
    lexical_score: float | None = None
    lexical_normalized_score: float | None = None
    quote: str | None


MessageAnswerQuality = Literal["helpful", "partially_helpful", "not_helpful"]
MessageCitationQuality = Literal["grounded", "partial", "broken"]


class MessageFeedbackCreateRequest(BaseModel):
    answer_quality: MessageAnswerQuality
    citation_quality: MessageCitationQuality
    issue_labels: list[str] = Field(default_factory=list, max_length=8)
    feedback_notes: str | None = Field(default=None, max_length=2000)


class MessageFeedbackResponse(BaseModel):
    id: UUID
    message_id: UUID
    submitted_by_user_id: UUID
    answer_quality: MessageAnswerQuality
    citation_quality: MessageCitationQuality
    issue_labels: list[str] = Field(default_factory=list)
    feedback_notes: str | None
    created_at: datetime
    updated_at: datetime


class MessageFeedbackSummaryItemResponse(MessageFeedbackResponse):
    conversation_id: UUID
    conversation_title: str
    assistant_excerpt: str
    latest_user_question: str | None = None


class MessageFeedbackSummaryResponse(BaseModel):
    total_feedback: int
    helpful_feedback: int
    partially_helpful_feedback: int
    not_helpful_feedback: int
    citation_issue_feedback: int
    retrieval_tuning_candidates: int
    recent_feedback: list[MessageFeedbackSummaryItemResponse] = Field(default_factory=list)


class MessageResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    conversation_id: UUID
    role: str
    content: str
    model_name: str | None
    usage_json: dict
    created_at: datetime
    citations: list[MessageCitationResponse] = Field(default_factory=list)
    feedback_entries: list[MessageFeedbackResponse] = Field(default_factory=list)


class ChatAskRequest(BaseModel):
    tenant_id: UUID
    workspace_id: UUID
    knowledge_base_id: UUID
    agent_definition_id: UUID | None = None
    conversation_id: UUID | None = None
    created_by_user_id: UUID | None = None
    question: str = Field(min_length=1, max_length=8000)
    top_k: int = Field(default=3, ge=1, le=10)


class ChatAskResponse(BaseModel):
    conversation: ConversationResponse
    user_message: MessageResponse
    assistant_message: MessageResponse
