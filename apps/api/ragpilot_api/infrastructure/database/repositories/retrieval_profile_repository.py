from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID

from sqlalchemy import func, or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from ragpilot_api.application.errors import ResourceConflictError
from ragpilot_api.infrastructure.database.models import KnowledgeBase, RetrievalProfile


class RetrievalProfileRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create_retrieval_profile(
        self,
        *,
        name: str,
        slug: str,
        retrieval_mode: str,
        top_k: int,
        vector_weight: Decimal,
        lexical_weight: Decimal,
        hybrid_overlap_bonus: Decimal,
        is_enabled: bool,
        is_default: bool,
        notes: str | None,
    ) -> RetrievalProfile:
        if is_default:
            await self.clear_default_retrieval_profile()

        retrieval_profile = RetrievalProfile(
            name=name,
            slug=slug,
            retrieval_mode=retrieval_mode,
            top_k=top_k,
            vector_weight=vector_weight,
            lexical_weight=lexical_weight,
            hybrid_overlap_bonus=hybrid_overlap_bonus,
            is_enabled=is_enabled,
            is_default=is_default,
            notes=notes,
        )
        self.session.add(retrieval_profile)

        try:
            await self.session.commit()
        except IntegrityError as error:
            await self.session.rollback()
            raise ResourceConflictError("Retrieval profile slug already exists.") from error

        await self.session.refresh(retrieval_profile)
        return retrieval_profile

    async def list_retrieval_profiles(
        self,
        *,
        retrieval_mode: str | None = None,
        is_enabled: bool | None = None,
        query: str | None = None,
    ) -> list[RetrievalProfile]:
        statement = select(RetrievalProfile).where(RetrievalProfile.deleted_at.is_(None)).order_by(
            RetrievalProfile.is_default.desc(),
            RetrievalProfile.created_at.desc(),
        )
        if retrieval_mode is not None:
            statement = statement.where(RetrievalProfile.retrieval_mode == retrieval_mode)
        if is_enabled is not None:
            statement = statement.where(RetrievalProfile.is_enabled == is_enabled)
        if query is not None and query.strip():
            normalized_query = f"%{query.strip()}%"
            statement = statement.where(
                or_(
                    RetrievalProfile.name.ilike(normalized_query),
                    RetrievalProfile.slug.ilike(normalized_query),
                    RetrievalProfile.notes.ilike(normalized_query),
                )
            )

        result = await self.session.scalars(statement)
        return list(result)

    async def list_retrieval_profiles_by_ids(self, *, retrieval_profile_ids: list[UUID]) -> list[RetrievalProfile]:
        if not retrieval_profile_ids:
            return []

        result = await self.session.scalars(
            select(RetrievalProfile).where(
                RetrievalProfile.id.in_(retrieval_profile_ids),
                RetrievalProfile.deleted_at.is_(None),
            )
        )
        return list(result)

    async def get_retrieval_profile(self, *, retrieval_profile_id: UUID) -> RetrievalProfile | None:
        return await self.session.scalar(
            select(RetrievalProfile).where(
                RetrievalProfile.id == retrieval_profile_id,
                RetrievalProfile.deleted_at.is_(None),
            )
        )

    async def get_default_enabled_retrieval_profile(self) -> RetrievalProfile | None:
        return await self.session.scalar(
            select(RetrievalProfile).where(
                RetrievalProfile.deleted_at.is_(None),
                RetrievalProfile.is_enabled.is_(True),
                RetrievalProfile.is_default.is_(True),
            )
        )

    async def update_retrieval_profile(
        self,
        *,
        retrieval_profile_id: UUID,
        name: str,
        slug: str,
        retrieval_mode: str,
        top_k: int,
        vector_weight: Decimal,
        lexical_weight: Decimal,
        hybrid_overlap_bonus: Decimal,
        is_enabled: bool,
        is_default: bool,
        notes: str | None,
    ) -> RetrievalProfile | None:
        retrieval_profile = await self.get_retrieval_profile(retrieval_profile_id=retrieval_profile_id)
        if retrieval_profile is None:
            return None

        if is_default and not retrieval_profile.is_default:
            await self.clear_default_retrieval_profile()

        retrieval_profile.name = name
        retrieval_profile.slug = slug
        retrieval_profile.retrieval_mode = retrieval_mode
        retrieval_profile.top_k = top_k
        retrieval_profile.vector_weight = vector_weight
        retrieval_profile.lexical_weight = lexical_weight
        retrieval_profile.hybrid_overlap_bonus = hybrid_overlap_bonus
        retrieval_profile.is_enabled = is_enabled
        retrieval_profile.is_default = is_default
        retrieval_profile.notes = notes
        retrieval_profile.updated_at = datetime.now(timezone.utc)

        try:
            await self.session.commit()
        except IntegrityError as error:
            await self.session.rollback()
            raise ResourceConflictError("Retrieval profile slug already exists.") from error

        await self.session.refresh(retrieval_profile)
        return retrieval_profile

    async def delete_retrieval_profile(self, *, retrieval_profile_id: UUID) -> bool:
        retrieval_profile = await self.get_retrieval_profile(retrieval_profile_id=retrieval_profile_id)
        if retrieval_profile is None:
            return False

        now = datetime.now(timezone.utc)
        retrieval_profile.deleted_at = now
        retrieval_profile.updated_at = now
        await self.session.commit()
        return True

    async def clear_default_retrieval_profile(self) -> None:
        await self.session.execute(
            update(RetrievalProfile)
            .where(RetrievalProfile.deleted_at.is_(None), RetrievalProfile.is_default.is_(True))
            .values(is_default=False, updated_at=datetime.now(timezone.utc))
        )
        await self.session.flush()

    async def count_knowledge_bases_using_retrieval_profile(self, *, retrieval_profile_id: UUID) -> int:
        return int(
            await self.session.scalar(
                select(func.count())
                .select_from(KnowledgeBase)
                .where(
                    KnowledgeBase.deleted_at.is_(None),
                    KnowledgeBase.retrieval_profile_id == retrieval_profile_id,
                )
            )
            or 0
        )

    async def list_retrieval_profile_binding_counts(self) -> dict[str, int]:
        result = await self.session.execute(
            select(KnowledgeBase.retrieval_profile_id, func.count())
            .where(
                KnowledgeBase.deleted_at.is_(None),
                KnowledgeBase.retrieval_profile_id.is_not(None),
            )
            .group_by(KnowledgeBase.retrieval_profile_id)
        )
        return {
            str(retrieval_profile_id): int(binding_count)
            for retrieval_profile_id, binding_count in result.all()
            if retrieval_profile_id is not None
        }
