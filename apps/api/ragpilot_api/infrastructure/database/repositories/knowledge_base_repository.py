from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from ragpilot_api.application.errors import ResourceConflictError
from ragpilot_api.infrastructure.database.models import KnowledgeBase


class KnowledgeBaseRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create_knowledge_base(
        self,
        *,
        tenant_id: UUID,
        workspace_id: UUID,
        name: str,
        slug: str,
        description: str | None,
        retrieval_profile_id: UUID | None,
    ) -> KnowledgeBase:
        knowledge_base = KnowledgeBase(
            tenant_id=tenant_id,
            workspace_id=workspace_id,
            name=name,
            slug=slug,
            description=description,
            retrieval_profile_id=retrieval_profile_id,
        )
        self.session.add(knowledge_base)

        try:
            await self.session.commit()
        except IntegrityError as error:
            await self.session.rollback()
            raise ResourceConflictError("Knowledge base slug already exists for this workspace.") from error

        await self.session.refresh(knowledge_base)
        return knowledge_base

    async def list_knowledge_bases(self, *, workspace_id: UUID) -> list[KnowledgeBase]:
        result = await self.list_knowledge_bases_with_filters(workspace_id=workspace_id)
        return result

    async def list_knowledge_bases_with_filters(
        self,
        *,
        workspace_id: UUID,
        publication_status: str | None = None,
    ) -> list[KnowledgeBase]:
        statement = (
            select(KnowledgeBase)
            .where(KnowledgeBase.workspace_id == workspace_id, KnowledgeBase.deleted_at.is_(None))
            .order_by(KnowledgeBase.created_at.desc())
        )
        if publication_status is not None:
            statement = statement.where(KnowledgeBase.publication_status == publication_status)

        result = await self.session.scalars(
            statement
        )
        return list(result)

    async def get_knowledge_base(self, *, knowledge_base_id: UUID, workspace_id: UUID) -> KnowledgeBase | None:
        return await self.session.scalar(
            select(KnowledgeBase).where(
                KnowledgeBase.id == knowledge_base_id,
                KnowledgeBase.workspace_id == workspace_id,
                KnowledgeBase.deleted_at.is_(None),
            )
        )

    async def get_knowledge_base_by_id(self, *, knowledge_base_id: UUID) -> KnowledgeBase | None:
        return await self.session.scalar(
            select(KnowledgeBase).where(
                KnowledgeBase.id == knowledge_base_id,
                KnowledgeBase.deleted_at.is_(None),
            )
        )

    async def get_knowledge_base_by_slug(self, *, workspace_id: UUID, slug: str) -> KnowledgeBase | None:
        return await self.session.scalar(
            select(KnowledgeBase).where(
                KnowledgeBase.workspace_id == workspace_id,
                KnowledgeBase.slug == slug,
                KnowledgeBase.deleted_at.is_(None),
            )
        )

    async def update_knowledge_base(
        self,
        *,
        knowledge_base_id: UUID,
        workspace_id: UUID,
        name: str,
        slug: str,
        description: str | None,
        retrieval_profile_id: UUID | None,
    ) -> KnowledgeBase | None:
        knowledge_base = await self.get_knowledge_base(knowledge_base_id=knowledge_base_id, workspace_id=workspace_id)
        if knowledge_base is None:
            return None

        knowledge_base.name = name
        knowledge_base.slug = slug
        knowledge_base.description = description
        knowledge_base.retrieval_profile_id = retrieval_profile_id

        try:
            await self.session.commit()
        except IntegrityError as error:
            await self.session.rollback()
            raise ResourceConflictError("Knowledge base slug already exists for this workspace.") from error

        await self.session.refresh(knowledge_base)
        return knowledge_base

    async def set_publication_status(
        self,
        *,
        knowledge_base_id: UUID,
        workspace_id: UUID,
        publication_status: str,
    ) -> KnowledgeBase | None:
        knowledge_base = await self.get_knowledge_base(knowledge_base_id=knowledge_base_id, workspace_id=workspace_id)
        if knowledge_base is None:
            return None

        knowledge_base.publication_status = publication_status
        await self.session.commit()
        await self.session.refresh(knowledge_base)
        return knowledge_base
