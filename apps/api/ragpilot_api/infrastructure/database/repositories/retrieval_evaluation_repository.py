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
        evaluation_mode: str | None = None,
        validation_status: str | None = None,
        follow_up_status: str | None = None,
        query: str | None = None,
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
        if evaluation_mode is not None:
            statement = statement.where(RetrievalEvaluation.evaluation_mode == evaluation_mode)
        if validation_status is not None:
            statement = statement.where(RetrievalEvaluation.validation_status == validation_status)
        if follow_up_status is not None:
            statement = statement.where(RetrievalEvaluation.follow_up_status == follow_up_status)
        if query is not None and query.strip():
            statement = statement.where(RetrievalEvaluation.query_text.ilike(f"%{query.strip()}%"))

        result = await self.session.scalars(statement)
        return list(result)

    async def get_retrieval_evaluation_by_id(
        self,
        *,
        retrieval_evaluation_id: UUID,
    ) -> RetrievalEvaluation | None:
        return await self.session.get(RetrievalEvaluation, retrieval_evaluation_id)

    async def update_follow_up_status(
        self,
        *,
        retrieval_evaluation: RetrievalEvaluation,
        follow_up_status: str,
        resolved_by_user_id: UUID | None,
    ) -> RetrievalEvaluation:
        retrieval_evaluation.follow_up_status = follow_up_status
        retrieval_evaluation.resolved_at = datetime.now(timezone.utc) if follow_up_status == "resolved" else None
        retrieval_evaluation.resolved_by_user_id = resolved_by_user_id if follow_up_status == "resolved" else None
        retrieval_evaluation.updated_at = datetime.now(timezone.utc)
        await self.session.commit()
        await self.session.refresh(retrieval_evaluation)
        return retrieval_evaluation

    async def update_follow_up_status_for_query(
        self,
        *,
        tenant_id: UUID,
        workspace_id: UUID,
        knowledge_base_id: UUID | None,
        query_text: str,
        follow_up_status: str,
        resolved_by_user_id: UUID | None,
    ) -> int:
        statement = select(RetrievalEvaluation).where(
            RetrievalEvaluation.tenant_id == tenant_id,
            RetrievalEvaluation.workspace_id == workspace_id,
            RetrievalEvaluation.query_text == query_text,
        )
        if knowledge_base_id is not None:
            statement = statement.where(RetrievalEvaluation.knowledge_base_id == knowledge_base_id)

        evaluations = list(await self.session.scalars(statement))
        if not evaluations:
            return 0

        timestamp = datetime.now(timezone.utc)
        for evaluation in evaluations:
            evaluation.follow_up_status = follow_up_status
            evaluation.resolved_at = timestamp if follow_up_status == "resolved" else None
            evaluation.resolved_by_user_id = resolved_by_user_id if follow_up_status == "resolved" else None
            evaluation.updated_at = timestamp

        await self.session.commit()
        return len(evaluations)

    async def get_latest_follow_up_status_by_queries(
        self,
        *,
        tenant_id: UUID,
        workspace_id: UUID,
        knowledge_base_id: UUID | None,
        query_texts: list[str],
    ) -> dict[str, str]:
        normalized_queries = [query_text.strip() for query_text in query_texts if query_text.strip()]
        if not normalized_queries:
            return {}

        statement = (
            select(RetrievalEvaluation)
            .where(
                RetrievalEvaluation.tenant_id == tenant_id,
                RetrievalEvaluation.workspace_id == workspace_id,
                RetrievalEvaluation.query_text.in_(normalized_queries),
            )
            .order_by(RetrievalEvaluation.updated_at.desc(), RetrievalEvaluation.created_at.desc())
        )
        if knowledge_base_id is not None:
            statement = statement.where(RetrievalEvaluation.knowledge_base_id == knowledge_base_id)

        evaluations = list(await self.session.scalars(statement))
        latest_by_query: dict[str, str] = {}
        for evaluation in evaluations:
            normalized_query = evaluation.query_text.strip()
            if normalized_query and normalized_query not in latest_by_query:
                latest_by_query[normalized_query] = evaluation.follow_up_status

        return latest_by_query

    async def touch_retrieval_evaluation(
        self,
        *,
        retrieval_evaluation: RetrievalEvaluation,
    ) -> RetrievalEvaluation:
        retrieval_evaluation.updated_at = datetime.now(timezone.utc)
        await self.session.commit()
        await self.session.refresh(retrieval_evaluation)
        return retrieval_evaluation
