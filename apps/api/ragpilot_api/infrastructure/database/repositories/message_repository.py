from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID

from sqlalchemy import case, func, select
from sqlalchemy.orm import aliased
from sqlalchemy.ext.asyncio import AsyncSession

from ragpilot_api.infrastructure.database.models import (
    Conversation,
    Document,
    DocumentChunk,
    DocumentVersion,
    Message,
    MessageCitation,
    MessageFeedbackEntry,
)


@dataclass(frozen=True)
class MessageCitationRecord:
    id: UUID
    message_id: UUID
    document_chunk_id: UUID
    document_id: UUID | None
    document_title: str | None
    document_version_id: UUID | None
    knowledge_base_id: UUID | None
    chunk_index: int | None
    rank: int
    score: Decimal | None
    quote: str | None


@dataclass(frozen=True)
class MessageFeedbackRecord:
    id: UUID
    message_id: UUID
    submitted_by_user_id: UUID
    answer_quality: str
    citation_quality: str
    issue_labels: list[str]
    feedback_notes: str | None
    created_at: datetime
    updated_at: datetime


@dataclass(frozen=True)
class MessageFeedbackSummaryRecord:
    id: UUID
    message_id: UUID
    conversation_id: UUID
    conversation_title: str
    knowledge_base_id: UUID | None
    submitted_by_user_id: UUID
    answer_quality: str
    citation_quality: str
    issue_labels: list[str]
    feedback_notes: str | None
    created_at: datetime
    updated_at: datetime
    assistant_excerpt: str
    latest_user_question: str | None
    retrieval_profile_id: UUID | None
    retrieval_profile_name: str | None


class MessageRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create_message(
        self,
        *,
        tenant_id: UUID,
        conversation_id: UUID,
        role: str,
        content: str,
        model_name: str | None,
        usage_json: dict,
    ) -> Message:
        message = Message(
            tenant_id=tenant_id,
            conversation_id=conversation_id,
            role=role,
            content=content,
            model_name=model_name,
            usage_json=usage_json,
        )
        self.session.add(message)
        await self.session.commit()
        await self.session.refresh(message)
        return message

    async def create_message_citations(
        self,
        *,
        tenant_id: UUID,
        message_id: UUID,
        citations: list[dict],
    ) -> list[MessageCitation]:
        items: list[MessageCitation] = []
        for citation in citations:
            item = MessageCitation(
                tenant_id=tenant_id,
                message_id=message_id,
                document_chunk_id=citation["document_chunk_id"],
                rank=citation["rank"],
                score=Decimal(str(citation["score"])) if citation["score"] is not None else None,
                quote=citation["quote"],
            )
            self.session.add(item)
            items.append(item)
        await self.session.commit()
        for item in items:
            await self.session.refresh(item)
        return items

    async def get_message(self, *, tenant_id: UUID, message_id: UUID) -> Message | None:
        result = await self.session.scalars(
            select(Message).where(
                Message.tenant_id == tenant_id,
                Message.id == message_id,
            )
        )
        return result.first()

    async def list_messages(self, *, tenant_id: UUID, conversation_id: UUID) -> list[Message]:
        result = await self.session.scalars(
            select(Message)
            .where(
                Message.tenant_id == tenant_id,
                Message.conversation_id == conversation_id,
            )
            .order_by(Message.created_at.asc())
        )
        return list(result)

    async def list_message_citations(self, *, tenant_id: UUID, message_ids: list[UUID]) -> list[MessageCitationRecord]:
        if not message_ids:
            return []

        result = await self.session.execute(
            select(
                MessageCitation.id,
                MessageCitation.message_id,
                MessageCitation.document_chunk_id,
                Document.id.label("document_id"),
                Document.title.label("document_title"),
                DocumentVersion.id.label("document_version_id"),
                Document.knowledge_base_id,
                DocumentChunk.chunk_index,
                MessageCitation.rank,
                MessageCitation.score,
                MessageCitation.quote,
            )
            .join(DocumentChunk, DocumentChunk.id == MessageCitation.document_chunk_id)
            .join(DocumentVersion, DocumentVersion.id == DocumentChunk.document_version_id)
            .join(Document, Document.id == DocumentVersion.document_id)
            .where(
                MessageCitation.tenant_id == tenant_id,
                MessageCitation.message_id.in_(message_ids),
            )
            .order_by(MessageCitation.message_id.asc(), MessageCitation.rank.asc())
        )
        return [
            MessageCitationRecord(
                id=row.id,
                message_id=row.message_id,
                document_chunk_id=row.document_chunk_id,
                document_id=row.document_id,
                document_title=row.document_title,
                document_version_id=row.document_version_id,
                knowledge_base_id=row.knowledge_base_id,
                chunk_index=row.chunk_index,
                rank=row.rank,
                score=row.score,
                quote=row.quote,
            )
            for row in result.all()
        ]

    async def upsert_message_feedback(
        self,
        *,
        tenant_id: UUID,
        message_id: UUID,
        submitted_by_user_id: UUID,
        answer_quality: str,
        citation_quality: str,
        issue_labels: list[str],
        feedback_notes: str | None,
    ) -> MessageFeedbackRecord:
        feedback_entry = await self.session.scalar(
            select(MessageFeedbackEntry).where(
                MessageFeedbackEntry.tenant_id == tenant_id,
                MessageFeedbackEntry.message_id == message_id,
                MessageFeedbackEntry.submitted_by_user_id == submitted_by_user_id,
            )
        )
        if feedback_entry is None:
            feedback_entry = MessageFeedbackEntry(
                tenant_id=tenant_id,
                message_id=message_id,
                submitted_by_user_id=submitted_by_user_id,
                answer_quality=answer_quality,
                citation_quality=citation_quality,
                issue_labels_json=issue_labels,
                feedback_notes=feedback_notes,
            )
            self.session.add(feedback_entry)
        else:
            feedback_entry.answer_quality = answer_quality
            feedback_entry.citation_quality = citation_quality
            feedback_entry.issue_labels_json = issue_labels
            feedback_entry.feedback_notes = feedback_notes
            feedback_entry.updated_at = datetime.now(timezone.utc)

        await self.session.commit()
        await self.session.refresh(feedback_entry)
        return build_message_feedback_record(feedback_entry)

    async def list_message_feedback(self, *, tenant_id: UUID, message_ids: list[UUID]) -> list[MessageFeedbackRecord]:
        if not message_ids:
            return []

        result = await self.session.scalars(
            select(MessageFeedbackEntry)
            .where(
                MessageFeedbackEntry.tenant_id == tenant_id,
                MessageFeedbackEntry.message_id.in_(message_ids),
            )
            .order_by(MessageFeedbackEntry.updated_at.desc(), MessageFeedbackEntry.created_at.desc())
        )
        return [build_message_feedback_record(entry) for entry in result]

    async def summarize_message_feedback(
        self,
        *,
        tenant_id: UUID,
        workspace_id: UUID,
        knowledge_base_id: UUID | None = None,
        recent_limit: int = 10,
    ) -> tuple[dict[str, int], list[MessageFeedbackSummaryRecord]]:
        preceding_user_message = aliased(Message)
        conditions = [
            MessageFeedbackEntry.tenant_id == tenant_id,
            Message.tenant_id == tenant_id,
            Conversation.tenant_id == tenant_id,
            Conversation.workspace_id == workspace_id,
        ]
        if knowledge_base_id is not None:
            conditions.append(Conversation.knowledge_base_id == knowledge_base_id)

        aggregate_result = await self.session.execute(
            select(
                func.count(MessageFeedbackEntry.id).label("total_feedback"),
                func.sum(case((MessageFeedbackEntry.answer_quality == "helpful", 1), else_=0)).label("helpful_feedback"),
                func.sum(case((MessageFeedbackEntry.answer_quality == "partially_helpful", 1), else_=0)).label(
                    "partially_helpful_feedback"
                ),
                func.sum(case((MessageFeedbackEntry.answer_quality == "not_helpful", 1), else_=0)).label(
                    "not_helpful_feedback"
                ),
                func.sum(case((MessageFeedbackEntry.citation_quality != "grounded", 1), else_=0)).label(
                    "citation_issue_feedback"
                ),
                func.sum(
                    case(
                        (
                            (MessageFeedbackEntry.answer_quality == "not_helpful")
                            | (MessageFeedbackEntry.citation_quality != "grounded"),
                            1,
                        ),
                        else_=0,
                    )
                ).label("retrieval_tuning_candidates"),
            )
            .select_from(MessageFeedbackEntry)
            .join(Message, Message.id == MessageFeedbackEntry.message_id)
            .join(Conversation, Conversation.id == Message.conversation_id)
            .where(*conditions)
        )
        aggregate_row = aggregate_result.one()

        recent_result = await self.session.execute(
            select(
                MessageFeedbackEntry.id,
                MessageFeedbackEntry.message_id,
                Message.conversation_id,
                Conversation.title.label("conversation_title"),
                Conversation.knowledge_base_id,
                MessageFeedbackEntry.submitted_by_user_id,
                MessageFeedbackEntry.answer_quality,
                MessageFeedbackEntry.citation_quality,
                MessageFeedbackEntry.issue_labels_json,
                MessageFeedbackEntry.feedback_notes,
                MessageFeedbackEntry.created_at,
                MessageFeedbackEntry.updated_at,
                Message.content.label("assistant_excerpt"),
                Message.usage_json,
                (
                    select(preceding_user_message.content)
                    .where(
                        preceding_user_message.tenant_id == tenant_id,
                        preceding_user_message.conversation_id == Message.conversation_id,
                        preceding_user_message.role == "user",
                        preceding_user_message.created_at <= Message.created_at,
                    )
                    .order_by(preceding_user_message.created_at.desc())
                    .limit(1)
                    .scalar_subquery()
                ).label("latest_user_question"),
            )
            .select_from(MessageFeedbackEntry)
            .join(Message, Message.id == MessageFeedbackEntry.message_id)
            .join(Conversation, Conversation.id == Message.conversation_id)
            .where(
                *conditions,
                (MessageFeedbackEntry.answer_quality == "not_helpful")
                | (MessageFeedbackEntry.citation_quality != "grounded"),
            )
            .order_by(MessageFeedbackEntry.updated_at.desc(), MessageFeedbackEntry.created_at.desc())
            .limit(recent_limit)
        )

        counts = {
            "total_feedback": int(aggregate_row.total_feedback or 0),
            "helpful_feedback": int(aggregate_row.helpful_feedback or 0),
            "partially_helpful_feedback": int(aggregate_row.partially_helpful_feedback or 0),
            "not_helpful_feedback": int(aggregate_row.not_helpful_feedback or 0),
            "citation_issue_feedback": int(aggregate_row.citation_issue_feedback or 0),
            "retrieval_tuning_candidates": int(aggregate_row.retrieval_tuning_candidates or 0),
        }
        recent_feedback = [
            MessageFeedbackSummaryRecord(
                id=row.id,
                message_id=row.message_id,
                conversation_id=row.conversation_id,
                conversation_title=row.conversation_title,
                knowledge_base_id=row.knowledge_base_id,
                submitted_by_user_id=row.submitted_by_user_id,
                answer_quality=row.answer_quality,
                citation_quality=row.citation_quality,
                issue_labels=list(row.issue_labels_json or []),
                feedback_notes=row.feedback_notes,
                created_at=row.created_at,
                updated_at=row.updated_at,
                assistant_excerpt=(row.assistant_excerpt or "")[:240],
                latest_user_question=(row.latest_user_question or "")[:240] or None,
                retrieval_profile_id=_parse_uuid_value((row.usage_json or {}).get("retrieval_profile_id")),
                retrieval_profile_name=_parse_string_value((row.usage_json or {}).get("retrieval_profile_name")),
            )
            for row in recent_result.all()
        ]
        return counts, recent_feedback


def _parse_uuid_value(value: object) -> UUID | None:
    if not isinstance(value, str) or not value.strip():
        return None
    try:
        return UUID(value)
    except ValueError:
        return None


def _parse_string_value(value: object) -> str | None:
    if not isinstance(value, str):
        return None
    normalized = value.strip()
    return normalized or None


def build_message_feedback_record(entry: MessageFeedbackEntry) -> MessageFeedbackRecord:
    return MessageFeedbackRecord(
        id=entry.id,
        message_id=entry.message_id,
        submitted_by_user_id=entry.submitted_by_user_id,
        answer_quality=entry.answer_quality,
        citation_quality=entry.citation_quality,
        issue_labels=list(entry.issue_labels_json or []),
        feedback_notes=entry.feedback_notes,
        created_at=entry.created_at,
        updated_at=entry.updated_at,
    )
