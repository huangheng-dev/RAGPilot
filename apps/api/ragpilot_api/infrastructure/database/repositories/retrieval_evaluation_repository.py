from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ragpilot_api.infrastructure.database.models import RetrievalEvaluation


class RetrievalEvaluationRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create_retrieval_evaluation(
        self,
        *,
        tenant_id: UUID,
        workspace_id: UUID,
        knowledge_base_id: UUID,
        evaluation_mode: str,
        validation_status: str,
        query_text: str,
        baseline_engine_name: str,
        candidate_engine_name: str | None,
        retrieval_profile_name: str | None,
        retrieval_profile_source: str | None,
        result_count: int,
        shared_result_count: int | None,
        baseline_only_count: int | None,
        candidate_only_count: int | None,
        top_result_matches: bool | None,
        recommendation_reason: str | None,
        evaluation_payload_json: dict,
        created_by_user_id: UUID | None,
    ) -> RetrievalEvaluation:
        retrieval_evaluation = RetrievalEvaluation(
            tenant_id=tenant_id,
            workspace_id=workspace_id,
            knowledge_base_id=knowledge_base_id,
            evaluation_mode=evaluation_mode,
            validation_status=validation_status,
            query_text=query_text,
            baseline_engine_name=baseline_engine_name,
            candidate_engine_name=candidate_engine_name,
            retrieval_profile_name=retrieval_profile_name,
            retrieval_profile_source=retrieval_profile_source,
            result_count=result_count,
            shared_result_count=shared_result_count,
            baseline_only_count=baseline_only_count,
            candidate_only_count=candidate_only_count,
            top_result_matches=top_result_matches,
            recommendation_reason=recommendation_reason,
            evaluation_payload_json=evaluation_payload_json,
            created_by_user_id=created_by_user_id,
        )
        self.session.add(retrieval_evaluation)
        await self.session.commit()
        await self.session.refresh(retrieval_evaluation)
        return retrieval_evaluation

    async def list_retrieval_evaluations(
        self,
        *,
        tenant_id: UUID,
        workspace_id: UUID,
        knowledge_base_id: UUID | None = None,
        limit: int = 10,
    ) -> list[RetrievalEvaluation]:
        statement = (
            select(RetrievalEvaluation)
            .where(
                RetrievalEvaluation.tenant_id == tenant_id,
                RetrievalEvaluation.workspace_id == workspace_id,
            )
            .order_by(RetrievalEvaluation.created_at.desc())
            .limit(limit)
        )
        if knowledge_base_id is not None:
            statement = statement.where(RetrievalEvaluation.knowledge_base_id == knowledge_base_id)

        result = await self.session.scalars(statement)
        return list(result)

    async def touch_retrieval_evaluation(
        self,
        *,
        retrieval_evaluation: RetrievalEvaluation,
    ) -> RetrievalEvaluation:
        retrieval_evaluation.updated_at = datetime.now(timezone.utc)
        await self.session.commit()
        await self.session.refresh(retrieval_evaluation)
        return retrieval_evaluation
