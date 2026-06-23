from collections import Counter
from uuid import UUID

from ragpilot_api.contracts.http.retrieval_contracts import (
    RetrievalCompareRequest,
    RetrievalCompareResponse,
    RetrievalComparisonSummaryResponse,
    RetrievalEvaluationCreateRequest,
    RetrievalEvaluationResponse,
    RetrievalEvaluationSourceDocumentResponse,
    RetrievalEvaluationStatusBreakdownResponse,
    RetrievalEvaluationSummaryResponse,
    RetrievalEvaluationTuningCandidateResponse,
    RetrievalEngineDiagnosticsResponse,
    RetrievalRequest,
    RetrievalResponse,
    RetrievalResultChunkResponse,
)
from ragpilot_api.application.retrieval.retrieval_engines import build_retrieval_engine, normalize_retrieval_engine_name
from ragpilot_api.infrastructure.database.models import RetrievalEvaluation
from ragpilot_api.infrastructure.database.repositories.retrieval_evaluation_repository import RetrievalEvaluationRepository
from ragpilot_api.infrastructure.database.repositories.retrieval_repository import RetrievalRepository
from ragpilot_api.infrastructure.database.repositories.knowledge_base_repository import KnowledgeBaseRepository
from ragpilot_api.infrastructure.database.repositories.retrieval_profile_repository import RetrievalProfileRepository
from ragpilot_api.shared.settings import Settings


class RetrievalService:
    def __init__(
        self,
        retrieval_repository: RetrievalRepository,
        settings: Settings,
        knowledge_base_repository: KnowledgeBaseRepository | None = None,
        retrieval_profile_repository: RetrievalProfileRepository | None = None,
        retrieval_evaluation_repository: RetrievalEvaluationRepository | None = None,
    ) -> None:
        self.retrieval_repository = retrieval_repository
        self.settings = settings
        self.knowledge_base_repository = knowledge_base_repository
        self.retrieval_profile_repository = retrieval_profile_repository
        self.retrieval_evaluation_repository = retrieval_evaluation_repository

    async def retrieve_chunks(self, request: RetrievalRequest) -> RetrievalResponse:
        engine_name = normalize_retrieval_engine_name(getattr(self.settings, "retrieval_engine", "native"))
        retrieval_engine = build_retrieval_engine(self.settings, engine_name=engine_name)
        retrieval_outcome = await retrieval_engine.execute(
            retrieval_repository=self.retrieval_repository,
            settings=self.settings,
            tenant_id=request.tenant_id,
            knowledge_base_id=request.knowledge_base_id,
            query_text=request.query_text,
            requested_top_k=request.top_k,
            knowledge_base_repository=self.knowledge_base_repository,
            retrieval_profile_repository=self.retrieval_profile_repository,
        )
        return self._build_retrieval_response(
            request=request,
            engine_name=engine_name,
            retrieval_outcome=retrieval_outcome,
        )

    async def compare_chunks(self, request: RetrievalCompareRequest) -> RetrievalCompareResponse:
        baseline = await self._run_engine_diagnostics(
            request=request,
            engine_name=request.baseline_engine,
        )
        candidate = await self._run_engine_diagnostics(
            request=request,
            engine_name=request.candidate_engine,
        )
        baseline_chunk_ids = [result.document_chunk_id for result in baseline.results]
        candidate_chunk_ids = [result.document_chunk_id for result in candidate.results]
        baseline_chunk_id_set = set(baseline_chunk_ids)
        candidate_chunk_id_set = set(candidate_chunk_ids)
        shared_chunk_ids = [chunk_id for chunk_id in baseline_chunk_ids if chunk_id in candidate_chunk_id_set]
        baseline_only_chunk_ids = [chunk_id for chunk_id in baseline_chunk_ids if chunk_id not in candidate_chunk_id_set]
        candidate_only_chunk_ids = [chunk_id for chunk_id in candidate_chunk_ids if chunk_id not in baseline_chunk_id_set]
        recommendation_status, recommendation_reason = self._build_comparison_recommendation(
            baseline=baseline,
            candidate=candidate,
            shared_result_count=len(shared_chunk_ids),
            baseline_only_count=len(baseline_only_chunk_ids),
            candidate_only_count=len(candidate_only_chunk_ids),
        )
        return RetrievalCompareResponse(
            tenant_id=request.tenant_id,
            knowledge_base_id=request.knowledge_base_id,
            query_text=request.query_text,
            baseline=baseline,
            candidate=candidate,
            summary=RetrievalComparisonSummaryResponse(
                shared_chunk_ids=shared_chunk_ids,
                baseline_only_chunk_ids=baseline_only_chunk_ids,
                candidate_only_chunk_ids=candidate_only_chunk_ids,
                shared_result_count=len(shared_chunk_ids),
                baseline_only_count=len(baseline_only_chunk_ids),
                candidate_only_count=len(candidate_only_chunk_ids),
                top_result_matches=(
                    baseline.top_result_chunk_id is not None
                    and baseline.top_result_chunk_id == candidate.top_result_chunk_id
                ),
                recommendation_status=recommendation_status,
                recommendation_reason=recommendation_reason,
            ),
        )

    async def record_evaluation(
        self,
        request: RetrievalEvaluationCreateRequest,
        *,
        created_by_user_id,
    ) -> RetrievalEvaluationResponse:
        if self.retrieval_evaluation_repository is None:
            raise RuntimeError("Retrieval evaluation repository is not configured.")

        evaluation = await self.retrieval_evaluation_repository.create_retrieval_evaluation(
            tenant_id=request.tenant_id,
            workspace_id=request.workspace_id,
            knowledge_base_id=request.knowledge_base_id,
            evaluation_mode=request.evaluation_mode,
            validation_status=request.validation_status,
            query_text=request.query_text,
            baseline_engine_name=request.baseline_engine_name,
            candidate_engine_name=request.candidate_engine_name,
            retrieval_profile_name=request.retrieval_profile_name,
            retrieval_profile_source=request.retrieval_profile_source,
            result_count=request.result_count,
            shared_result_count=request.shared_result_count,
            baseline_only_count=request.baseline_only_count,
            candidate_only_count=request.candidate_only_count,
            top_result_matches=request.top_result_matches,
            recommendation_reason=request.recommendation_reason,
            evaluation_payload_json=request.evaluation_payload_json,
            created_by_user_id=created_by_user_id,
        )
        return build_retrieval_evaluation_response(evaluation)

    async def list_evaluations(
        self,
        *,
        tenant_id,
        workspace_id,
        knowledge_base_id=None,
        limit: int = 10,
    ) -> list[RetrievalEvaluationResponse]:
        if self.retrieval_evaluation_repository is None:
            raise RuntimeError("Retrieval evaluation repository is not configured.")

        evaluations = await self.retrieval_evaluation_repository.list_retrieval_evaluations(
            tenant_id=tenant_id,
            workspace_id=workspace_id,
            knowledge_base_id=knowledge_base_id,
            limit=limit,
        )
        return [build_retrieval_evaluation_response(item) for item in evaluations]

    async def summarize_evaluations(
        self,
        *,
        tenant_id,
        workspace_id,
        knowledge_base_id=None,
        limit: int = 5,
        sample_size: int = 120,
    ) -> RetrievalEvaluationSummaryResponse:
        if self.retrieval_evaluation_repository is None:
            raise RuntimeError("Retrieval evaluation repository is not configured.")

        evaluations = await self.retrieval_evaluation_repository.list_retrieval_evaluations(
            tenant_id=tenant_id,
            workspace_id=workspace_id,
            knowledge_base_id=knowledge_base_id,
            limit=sample_size,
        )
        status_breakdown_counter = Counter(item.validation_status for item in evaluations)
        grouped_evaluations: dict[str, list[RetrievalEvaluation]] = {}
        for evaluation in evaluations:
            query_key = evaluation.query_text.strip().lower()
            grouped_evaluations.setdefault(query_key, []).append(evaluation)

        candidate_rows: list[RetrievalEvaluationTuningCandidateResponse] = []
        for grouped_items in grouped_evaluations.values():
            latest_item = grouped_items[0]
            grouped_status_counter = Counter(item.validation_status for item in grouped_items)
            attention_score = (
                grouped_status_counter.get("hold", 0) * 3
                + grouped_status_counter.get("failed", 0) * 3
                + grouped_status_counter.get("review", 0) * 2
                + grouped_status_counter.get("empty", 0)
            )
            if attention_score == 0:
                continue

            candidate_rows.append(
                RetrievalEvaluationTuningCandidateResponse(
                    query_text=latest_item.query_text,
                    evaluation_count=len(grouped_items),
                    latest_evaluation_mode=latest_item.evaluation_mode,
                    latest_validation_status=latest_item.validation_status,
                    ready_count=grouped_status_counter.get("ready", 0),
                    review_count=grouped_status_counter.get("review", 0),
                    hold_count=grouped_status_counter.get("hold", 0),
                    empty_count=grouped_status_counter.get("empty", 0),
                    failed_count=grouped_status_counter.get("failed", 0),
                    attention_score=attention_score,
                    baseline_engine_name=latest_item.baseline_engine_name,
                    candidate_engine_name=latest_item.candidate_engine_name,
                    retrieval_profile_id=self._extract_retrieval_profile_id(latest_item.evaluation_payload_json),
                    retrieval_profile_name=latest_item.retrieval_profile_name,
                    retrieval_profile_source=latest_item.retrieval_profile_source,
                    recommendation_reason=latest_item.recommendation_reason,
                    result_count=latest_item.result_count,
                    shared_result_count=latest_item.shared_result_count,
                    baseline_only_count=latest_item.baseline_only_count,
                    candidate_only_count=latest_item.candidate_only_count,
                    top_result_matches=latest_item.top_result_matches,
                    latest_source_documents=self._extract_source_documents(latest_item.evaluation_payload_json),
                    last_evaluated_at=latest_item.created_at,
                )
            )

        candidate_rows.sort(
            key=lambda item: (item.attention_score, item.evaluation_count, item.last_evaluated_at),
            reverse=True,
        )

        return RetrievalEvaluationSummaryResponse(
            tenant_id=tenant_id,
            workspace_id=workspace_id,
            knowledge_base_id=knowledge_base_id,
            total_evaluations=len(evaluations),
            total_queries=len(grouped_evaluations),
            status_breakdown=RetrievalEvaluationStatusBreakdownResponse(
                ready=status_breakdown_counter.get("ready", 0),
                review=status_breakdown_counter.get("review", 0),
                hold=status_breakdown_counter.get("hold", 0),
                empty=status_breakdown_counter.get("empty", 0),
                failed=status_breakdown_counter.get("failed", 0),
            ),
            candidates=candidate_rows[:limit],
        )

    def _extract_retrieval_profile_id(self, evaluation_payload_json: dict | None) -> UUID | None:
        if not isinstance(evaluation_payload_json, dict):
            return None

        candidate_payload = evaluation_payload_json.get("candidate")
        if isinstance(candidate_payload, dict):
            candidate_profile_id = candidate_payload.get("retrieval_profile_id")
            if isinstance(candidate_profile_id, str) and candidate_profile_id.strip():
                try:
                    return UUID(candidate_profile_id.strip())
                except ValueError:
                    pass

        baseline_payload = evaluation_payload_json.get("baseline")
        if isinstance(baseline_payload, dict):
            baseline_profile_id = baseline_payload.get("retrieval_profile_id")
            if isinstance(baseline_profile_id, str) and baseline_profile_id.strip():
                try:
                    return UUID(baseline_profile_id.strip())
                except ValueError:
                    pass

        profile_id = evaluation_payload_json.get("retrieval_profile_id")
        if isinstance(profile_id, str) and profile_id.strip():
            try:
                return UUID(profile_id.strip())
            except ValueError:
                return None

        return None

    def _extract_source_documents(
        self,
        evaluation_payload_json: dict | None,
        *,
        limit: int = 3,
    ) -> list[RetrievalEvaluationSourceDocumentResponse]:
        if not isinstance(evaluation_payload_json, dict):
            return []

        document_hit_counter: Counter[str] = Counter()
        document_titles: dict[str, str] = {}
        document_order: list[str] = []

        def collect_rows(rows: object) -> None:
            if not isinstance(rows, list):
                return

            for row in rows:
                if not isinstance(row, dict):
                    continue

                document_id = row.get("document_id")
                document_title = row.get("document_title")
                if not isinstance(document_id, str) or not document_id.strip():
                    continue
                if not isinstance(document_title, str) or not document_title.strip():
                    continue

                normalized_document_id = document_id.strip()
                if normalized_document_id not in document_titles:
                    document_titles[normalized_document_id] = document_title.strip()
                    document_order.append(normalized_document_id)
                document_hit_counter[normalized_document_id] += 1

        collect_rows(evaluation_payload_json.get("results"))

        baseline_payload = evaluation_payload_json.get("baseline")
        if isinstance(baseline_payload, dict):
            collect_rows(baseline_payload.get("results"))

        candidate_payload = evaluation_payload_json.get("candidate")
        if isinstance(candidate_payload, dict):
            collect_rows(candidate_payload.get("results"))

        document_positions = {document_id: index for index, document_id in enumerate(document_order)}
        ranked_document_ids = sorted(
            document_order,
            key=lambda document_id: (
                document_hit_counter.get(document_id, 0),
                -document_positions.get(document_id, 0),
            ),
            reverse=True,
        )

        source_documents: list[RetrievalEvaluationSourceDocumentResponse] = []
        for document_id in ranked_document_ids[:limit]:
            source_documents.append(
                RetrievalEvaluationSourceDocumentResponse(
                    document_id=document_id,
                    document_title=document_titles[document_id],
                    hit_count=document_hit_counter.get(document_id, 0),
                )
            )

        return source_documents

    def _build_comparison_recommendation(
        self,
        *,
        baseline: RetrievalEngineDiagnosticsResponse,
        candidate: RetrievalEngineDiagnosticsResponse,
        shared_result_count: int,
        baseline_only_count: int,
        candidate_only_count: int,
    ) -> tuple[str, str]:
        top_result_matches = (
            baseline.top_result_chunk_id is not None
            and baseline.top_result_chunk_id == candidate.top_result_chunk_id
        )

        if not top_result_matches:
            return (
                "hold",
                "Top-ranked retrieval differs between the baseline and candidate engines, so the candidate should not be promoted yet.",
            )

        if baseline_only_count == 0 and candidate_only_count == 0:
            return (
                "aligned",
                "Candidate retrieval currently matches the baseline across the compared ranked results.",
            )

        if candidate_only_count > 0 and baseline_only_count == 0:
            return (
                "review",
                "Candidate retrieval preserved the top result and introduced additional unique evidence that should be reviewed before promotion.",
            )

        if baseline_only_count > candidate_only_count:
            return (
                "hold",
                "Baseline retrieval still returns more unique ranked evidence than the candidate in this comparison.",
            )

        if shared_result_count == 0:
            return (
                "hold",
                "The compared engines do not currently share ranked evidence, so the candidate remains too unstable to trust.",
            )

        return (
            "review",
            "Candidate retrieval preserved the leading result, but the ranked overlap still needs operator review before any engine switch.",
        )

    async def _run_engine_diagnostics(
        self,
        *,
        request: RetrievalCompareRequest,
        engine_name: str,
    ) -> RetrievalEngineDiagnosticsResponse:
        normalized_engine_name = normalize_retrieval_engine_name(engine_name)
        retrieval_engine = build_retrieval_engine(self.settings, engine_name=normalized_engine_name)
        retrieval_outcome = await retrieval_engine.execute(
            retrieval_repository=self.retrieval_repository,
            settings=self.settings,
            tenant_id=request.tenant_id,
            knowledge_base_id=request.knowledge_base_id,
            query_text=request.query_text,
            requested_top_k=request.top_k,
            knowledge_base_repository=self.knowledge_base_repository,
            retrieval_profile_repository=self.retrieval_profile_repository,
        )
        results = self._build_result_rows(retrieval_outcome.results)
        retrieval_method_breakdown: dict[str, int] = {}
        for result in results:
            retrieval_method_breakdown[result.retrieval_method] = (
                retrieval_method_breakdown.get(result.retrieval_method, 0) + 1
            )
        top_result = results[0] if results else None
        return RetrievalEngineDiagnosticsResponse(
            engine_name=normalized_engine_name,
            retrieval_profile_id=retrieval_outcome.retrieval_profile_id,
            retrieval_profile_name=retrieval_outcome.retrieval_profile_name,
            retrieval_profile_source=retrieval_outcome.retrieval_profile_source,
            retrieval_mode=retrieval_outcome.retrieval_mode,
            embedding_model=retrieval_outcome.embedding_model,
            effective_top_k=retrieval_outcome.effective_top_k,
            rerank_applied=retrieval_outcome.rerank_applied,
            rerank_strategy=retrieval_outcome.rerank_strategy,
            rerank_window=retrieval_outcome.rerank_window,
            result_count=len(results),
            retrieval_method_breakdown=retrieval_method_breakdown,
            top_result_chunk_id=top_result.document_chunk_id if top_result is not None else None,
            top_result_document_title=top_result.document_title if top_result is not None else None,
            results=results,
        )

    def _build_retrieval_response(self, *, request: RetrievalRequest, engine_name: str, retrieval_outcome) -> RetrievalResponse:
        return RetrievalResponse(
            tenant_id=request.tenant_id,
            knowledge_base_id=request.knowledge_base_id,
            query_text=request.query_text,
            engine_name=engine_name,
            retrieval_profile_id=retrieval_outcome.retrieval_profile_id,
            retrieval_profile_name=retrieval_outcome.retrieval_profile_name,
            retrieval_profile_source=retrieval_outcome.retrieval_profile_source,
            retrieval_mode=retrieval_outcome.retrieval_mode,
            embedding_model=retrieval_outcome.embedding_model,
            effective_top_k=retrieval_outcome.effective_top_k,
            rerank_applied=retrieval_outcome.rerank_applied,
            rerank_strategy=retrieval_outcome.rerank_strategy,
            rerank_window=retrieval_outcome.rerank_window,
            results=self._build_result_rows(retrieval_outcome.results),
        )

    def _build_result_rows(self, rows: list[dict]) -> list[RetrievalResultChunkResponse]:
        return [
            RetrievalResultChunkResponse(
                document_chunk_id=row["document_chunk_id"],
                document_id=row["document_id"],
                document_version_id=row["document_version_id"],
                knowledge_base_id=row["knowledge_base_id"],
                document_title=row["document_title"],
                chunk_index=row["chunk_index"],
                content=row["content"],
                token_count=row["token_count"],
                score=float(row["score"]),
                vector_score=float(row["vector_score"]) if row.get("vector_score") is not None else None,
                lexical_score=float(row["lexical_score"]) if row.get("lexical_score") is not None else None,
                lexical_normalized_score=float(row["lexical_normalized_score"]) if row.get("lexical_normalized_score") is not None else None,
                rerank_score=float(row["rerank_score"]) if row.get("rerank_score") is not None else None,
                rerank_rank=int(row["rerank_rank"]) if row.get("rerank_rank") is not None else None,
                embedding_model=row.get("embedding_model"),
                retrieval_method=row["retrieval_method"],
                metadata_json=row["metadata_json"],
                created_at=row["created_at"],
            )
            for row in rows
        ]


def build_retrieval_evaluation_response(evaluation: RetrievalEvaluation) -> RetrievalEvaluationResponse:
    return RetrievalEvaluationResponse(
        id=evaluation.id,
        tenant_id=evaluation.tenant_id,
        workspace_id=evaluation.workspace_id,
        knowledge_base_id=evaluation.knowledge_base_id,
        evaluation_mode=evaluation.evaluation_mode,
        validation_status=evaluation.validation_status,
        query_text=evaluation.query_text,
        baseline_engine_name=evaluation.baseline_engine_name,
        candidate_engine_name=evaluation.candidate_engine_name,
        retrieval_profile_name=evaluation.retrieval_profile_name,
        retrieval_profile_source=evaluation.retrieval_profile_source,
        result_count=evaluation.result_count,
        shared_result_count=evaluation.shared_result_count,
        baseline_only_count=evaluation.baseline_only_count,
        candidate_only_count=evaluation.candidate_only_count,
        top_result_matches=evaluation.top_result_matches,
        recommendation_reason=evaluation.recommendation_reason,
        evaluation_payload_json=evaluation.evaluation_payload_json,
        created_by_user_id=evaluation.created_by_user_id,
        created_at=evaluation.created_at,
        updated_at=evaluation.updated_at,
    )
