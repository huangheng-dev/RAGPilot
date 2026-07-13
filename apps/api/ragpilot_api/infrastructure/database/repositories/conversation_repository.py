from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from ragpilot_api.application.errors import ResourceConflictError
from ragpilot_api.infrastructure.database.models import Conversation, Message, MessageCitation, MessageFeedbackEntry


class ConversationRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create_conversation(
        self,
        *,
        tenant_id: UUID,
        workspace_id: UUID,
        knowledge_base_id: UUID | None,
        title: str,
        created_by_user_id: UUID | None,
    ) -> Conversation:
        conversation = Conversation(
            tenant_id=tenant_id,
            workspace_id=workspace_id,
            knowledge_base_id=knowledge_base_id,
            title=title,
            created_by_user_id=created_by_user_id,
        )
        self.session.add(conversation)
        try:
            await self.session.commit()
        except IntegrityError as error:
            await self.session.rollback()
            raise ResourceConflictError("Conversation references an unknown tenant, workspace, knowledge base, or user.") from error
        await self.session.refresh(conversation)
        return conversation

    async def get_conversation(self, *, conversation_id: UUID, tenant_id: UUID) -> Conversation | None:
        result = await self.session.scalar(
            select(Conversation).where(
                Conversation.id == conversation_id,
                Conversation.tenant_id == tenant_id,
            )
        )
        return result

    async def list_conversations(
        self,
        *,
        tenant_id: UUID,
        workspace_id: UUID,
        query: str | None = None,
        limit: int = 100,
    ) -> list[dict[str, object]]:
        filters = [
            Conversation.tenant_id == tenant_id,
            Conversation.workspace_id == workspace_id,
        ]
        normalized_query = (query or "").strip()
        if normalized_query:
            filters.append(Conversation.title.ilike(f"%{normalized_query}%"))

        latest_activity_at = func.coalesce(
            func.max(Message.created_at),
            Conversation.updated_at,
            Conversation.created_at,
        )
        conversation_scope = (
            select(
                Conversation.id.label("conversation_id"),
                func.count(Message.id).label("message_count"),
                latest_activity_at.label("latest_activity_at"),
            )
            .select_from(Conversation)
            .outerjoin(
                Message,
                (Message.conversation_id == Conversation.id) & (Message.tenant_id == Conversation.tenant_id),
            )
            .where(*filters)
            .group_by(Conversation.id)
            .order_by(latest_activity_at.desc(), Conversation.created_at.desc())
            .limit(limit)
            .subquery()
        )

        result = await self.session.execute(
            select(
                Conversation,
                conversation_scope.c.message_count,
                conversation_scope.c.latest_activity_at,
            )
            .join(conversation_scope, conversation_scope.c.conversation_id == Conversation.id)
            .order_by(conversation_scope.c.latest_activity_at.desc(), Conversation.created_at.desc())
        )
        return [
            {
                "conversation": row[0],
                "message_count": int(row[1] or 0),
                "latest_activity_at": row[2],
            }
            for row in result.all()
        ]

    async def get_conversation_metrics(
        self,
        *,
        tenant_id: UUID,
        workspace_id: UUID | None = None,
    ) -> dict[str, int | datetime | None]:
        filters = [Conversation.tenant_id == tenant_id]
        if workspace_id is not None:
            filters.append(Conversation.workspace_id == workspace_id)

        result = await self.session.execute(
            select(
                func.count(func.distinct(Conversation.id)).label("total_conversations"),
                func.count(Message.id).label("total_messages"),
                func.count(func.distinct(Conversation.id)).filter(Message.id.is_not(None)).label("active_conversations"),
                func.max(Conversation.updated_at).label("latest_conversation_updated_at"),
                func.max(Message.created_at).label("latest_message_created_at"),
            )
            .select_from(Conversation)
            .outerjoin(
                Message,
                (Message.conversation_id == Conversation.id) & (Message.tenant_id == Conversation.tenant_id),
            )
            .where(*filters)
        )
        metrics = result.mappings().one()
        latest_candidates = [
            metrics["latest_conversation_updated_at"],
            metrics["latest_message_created_at"],
        ]
        latest_activity_at = max((value for value in latest_candidates if value is not None), default=None)

        return {
            "total_conversations": int(metrics["total_conversations"] or 0),
            "active_conversations": int(metrics["active_conversations"] or 0),
            "total_messages": int(metrics["total_messages"] or 0),
            "latest_activity_at": latest_activity_at,
        }

    async def update_conversation_title(self, *, conversation_id: UUID, tenant_id: UUID, title: str) -> Conversation | None:
        conversation = await self.get_conversation(conversation_id=conversation_id, tenant_id=tenant_id)
        if conversation is None:
            return None

        conversation.title = title
        await self.session.commit()
        await self.session.refresh(conversation)
        return conversation

    async def delete_conversation(self, *, conversation_id: UUID, tenant_id: UUID) -> bool:
        conversation = await self.get_conversation(conversation_id=conversation_id, tenant_id=tenant_id)
        if conversation is None:
            return False

        message_ids = (
            select(Message.id)
            .where(
                Message.tenant_id == tenant_id,
                Message.conversation_id == conversation_id,
            )
        )

        await self.session.execute(
            delete(MessageFeedbackEntry).where(
                MessageFeedbackEntry.tenant_id == tenant_id,
                MessageFeedbackEntry.message_id.in_(message_ids),
            )
        )
        await self.session.execute(
            delete(MessageCitation).where(
                MessageCitation.tenant_id == tenant_id,
                MessageCitation.message_id.in_(message_ids),
            )
        )
        await self.session.execute(
            delete(Message).where(
                Message.tenant_id == tenant_id,
                Message.conversation_id == conversation_id,
            )
        )
        await self.session.execute(
            delete(Conversation).where(
                Conversation.id == conversation_id,
                Conversation.tenant_id == tenant_id,
            )
        )
        await self.session.commit()
        return True
