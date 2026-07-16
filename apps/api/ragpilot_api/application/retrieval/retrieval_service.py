from collections import Counter
from datetime import datetime, timezone
from uuid import UUID

from ragpilot_api.contracts.http.retrieval_contracts import (
    RetrievalCompareRequest,
    RetrievalCompareResponse,
    RetrievalComparisonSummaryResponse,
    RetrievalEvaluationFollowUpActionResponse,
    RetrievalEvaluationFollowUpBreakdownResponse,
    RetrievalEvaluationCreateRequest,
    RetrievalEvaluationQueryFollowUpUpdateRequest,
    RetrievalEvaluationQueryFollowUpUpdateResponse,
    RetrievalEvaluationFollowUpUpdateRequest,
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

    async def retrieve_chunks(
        self, request: RetrievalRequest, *, principal_user_id: UUID | None = None, acl_bypass: bool = False,
    ) -> RetrievalResponse:
        engine_name = normalize_retrieval_engine_name(getattr(self.settings, "retrieval_engine", "native"))
        retrieval_engine = build_retrieval_engine(self.settings, engine_name=engine_name)
        retrieval_outcome = await retrieval_engine.execute(
            retrieval_repository=self.retrieval_repository,
            settings=self.settings,
            tenant_id=request.tenant_id,
            knowledge_base_id=request.knowledge_base_id,
            query_text=request.query_text,
            requested_top_k=request.top_k,
            principal_user_id=principal_user_id,
            acl_bypass=acl_bypass,
            knowledge_base_repository=self.knowledge_base_repository,
            retrieval_profile_repository=self.retrieval_profile_repository,
        )
        return self._build_retrieval_response(
            request=request,
            engine_name=engine_name,
            retrieval_outcome=retrieval_outcome,
        )

    async def compare_chunks(
        self, request: RetrievalCompareRequest, *, principal_user_id: UUID | None = None, acl_bypass: bool = False,
    ) -> RetrievalCompareResponse:
        baseline = await self._run_engine_diagnostics(
            request=request,
            engine_name=request.baseline_engine,
            principal_user_id=principal_user_id,
            acl_bypass=acl_bypass,
        )
        candidate = await self._run_engine_diagnostics(
            request=request,
            engine_name=request.candidate_engine,
            principal_user_id=principal_user_id,
            acl_bypass=acl_bypass,
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
        return self._build_retrieval_evaluation_response(evaluation)

    async def list_evaluations(
        self,
        *,
        tenant_id,
        workspace_id,
        knowledge_base_id=None,
        evaluation_mode=None,
        validation_status=None,
        follow_up_status=None,
        query: str | None = None,
        limit: int = 10,
    ) -> list[RetrievalEvaluationResponse]:
        if self.retrieval_evaluation_repository is None:
            raise RuntimeError("Retrieval evaluation repository is not configured.")

        evaluations = await self.retrieval_evaluation_repository.list_retrieval_evaluations(
            tenant_id=tenant_id,
            workspace_id=workspace_id,
            knowledge_base_id=knowledge_base_id,
            evaluation_mode=evaluation_mode,
            validation_status=validation_status,
            follow_up_status=follow_up_status,
            query=query,
            limit=limit,
        )
        return [self._build_retrieval_evaluation_response(item) for item in evaluations]

    async def summarize_evaluations(
        self,
        *,
        tenant_id,
        workspace_id,
        knowledge_base_id=None,
        evaluation_mode=None,
        validation_status=None,
        follow_up_status=None,
        query: str | None = None,
        limit: int = 5,
        sample_size: int = 120,
    ) -> RetrievalEvaluationSummaryResponse:
        if self.retrieval_evaluation_repository is None:
            raise RuntimeError("Retrieval evaluation repository is not configured.")

        evaluations = await self.retrieval_evaluation_repository.list_retrieval_evaluations(
            tenant_id=tenant_id,
            workspace_id=workspace_id,
            knowledge_base_id=knowledge_base_id,
            evaluation_mode=evaluation_mode,
            validation_status=validation_status,
            follow_up_status=follow_up_status,
            query=query,
            limit=sample_size,
        )
        status_breakdown_counter = Counter(item.validation_status for item in evaluations)
        follow_up_breakdown_counter = Counter(item.follow_up_status for item in evaluations)
        grouped_evaluations: dict[str, list[RetrievalEvaluation]] = {}
        for evaluation in evaluations:
            query_key = evaluation.query_text.strip().lower()
            grouped_evaluations.setdefault(query_key, []).append(evaluation)

        candidate_rows: list[RetrievalEvaluationTuningCandidateResponse] = []
        for grouped_items in grouped_evaluations.values():
            latest_item = grouped_items[0]
            grouped_status_counter = Counter(item.validation_status for item in grouped_items)
            grouped_follow_up_counter = Counter(item.follow_up_status for item in grouped_items)
            attention_score = (
                grouped_status_counter.get("hold", 0) * 3
                + grouped_status_counter.get("failed", 0) * 3
                + grouped_status_counter.get("review", 0) * 2
                + grouped_status_counter.get("empty", 0)
            )
            if attention_score == 0:
                continue

            retrieval_profile_id = self._extract_retrieval_profile_id(latest_item.evaluation_payload_json)
            source_documents = self._extract_source_documents(latest_item.evaluation_payload_json)
            candidate_rows.append(
                RetrievalEvaluationTuningCandidateResponse(
                    query_text=latest_item.query_text,
                    evaluation_count=len(grouped_items),
                    latest_evaluation_mode=latest_item.evaluation_mode,
                    latest_validation_status=latest_item.validation_status,
                    follow_up_status=latest_item.follow_up_status,
                    ready_count=grouped_status_counter.get("ready", 0),
                    review_count=grouped_status_counter.get("review", 0),
                    hold_count=grouped_status_counter.get("hold", 0),
                    empty_count=grouped_status_counter.get("empty", 0),
                    failed_count=grouped_status_counter.get("failed", 0),
                    pending_evaluation_count=grouped_follow_up_counter.get("pending", 0),
                    resolved_evaluation_count=grouped_follow_up_counter.get("resolved", 0),
                    attention_score=attention_score,
                    baseline_engine_name=latest_item.baseline_engine_name,
                    candidate_engine_name=latest_item.candidate_engine_name,
                    retrieval_profile_id=retrieval_profile_id,
                    retrieval_profile_name=latest_item.retrieval_profile_name,
                    retrieval_profile_source=latest_item.retrieval_profile_source,
                    recommendation_reason=latest_item.recommendation_reason,
                    result_count=latest_item.result_count,
                    shared_result_count=latest_item.shared_result_count,
                    baseline_only_count=latest_item.baseline_only_count,
                    candidate_only_count=latest_item.candidate_only_count,
                    top_result_matches=latest_item.top_result_matches,
                    latest_source_documents=source_documents,
                    recommended_actions=self._build_tuning_candidate_actions(
                        latest_item=latest_item,
                        grouped_status_counter=grouped_status_counter,
                        retrieval_profile_id=retrieval_profile_id,
                        source_document_count=len(source_documents),
                    ),
                    last_evaluated_at=latest_item.created_at,
                )
            )

        candidate_rows.sort(
            key=lambda item: (item.attention_score, item.evaluation_count, item.last_evaluated_at),
            reverse=True,
        )

        intelligence_status, intelligence_reason = self._build_retrieval_intelligence_summary(
            evaluations=evaluations,
            candidate_rows=candidate_rows,
            status_breakdown_counter=status_breakdown_counter,
            follow_up_breakdown_counter=follow_up_breakdown_counter,
        )
        primary_candidate = candidate_rows[0] if candidate_rows else None

        return RetrievalEvaluationSummaryResponse(
            tenant_id=tenant_id,
            workspace_id=workspace_id,
            knowledge_base_id=knowledge_base_id,
            total_evaluations=len(evaluations),
            total_queries=len(grouped_evaluations),
            intelligence_status=intelligence_status,
            intelligence_reason=intelligence_reason,
            primary_query_text=primary_candidate.query_text if primary_candidate is not None else None,
            primary_baseline_engine_name=primary_candidate.baseline_engine_name if primary_candidate is not None else None,
            primary_candidate_engine_name=primary_candidate.candidate_engine_name if primary_candidate is not None else None,
            primary_retrieval_profile_name=primary_candidate.retrieval_profile_name if primary_candidate is not None else None,
            status_breakdown=RetrievalEvaluationStatusBreakdownResponse(
                ready=status_breakdown_counter.get("ready", 0),
                review=status_breakdown_counter.get("review", 0),
                hold=status_breakdown_counter.get("hold", 0),
                empty=status_breakdown_counter.get("empty", 0),
                failed=status_breakdown_counter.get("failed", 0),
            ),
            follow_up_breakdown=RetrievalEvaluationFollowUpBreakdownResponse(
                pending=follow_up_breakdown_counter.get("pending", 0),
                resolved=follow_up_breakdown_counter.get("resolved", 0),
            ),
            primary_recommended_actions=primary_candidate.recommended_actions if primary_candidate is not None else [],
            candidates=candidate_rows[:limit],
            recent_evaluations=[
                self._build_retrieval_evaluation_response(item)
                for item in evaluations[:limit]
            ],
        )

    async def update_evaluation_follow_up(
        self,
        *,
        retrieval_evaluation_id,
        request: RetrievalEvaluationFollowUpUpdateRequest,
        actor_user_id,
    ) -> RetrievalEvaluationResponse:
        if self.retrieval_evaluation_repository is None:
            raise RuntimeError("Retrieval evaluation repository is not configured.")

        evaluation = await self.retrieval_evaluation_repository.get_retrieval_evaluation_by_id(
            retrieval_evaluation_id=retrieval_evaluation_id,
        )
        if evaluation is None:
            raise ValueError("Retrieval evaluation not found.")

        updated = await self.retrieval_evaluation_repository.update_follow_up_status(
            retrieval_evaluation=evaluation,
            follow_up_status=request.follow_up_status,
            resolved_by_user_id=actor_user_id,
        )
        return self._build_retrieval_evaluation_response(updated)

    async def update_query_follow_up(
        self,
        *,
        request: RetrievalEvaluationQueryFollowUpUpdateRequest,
        actor_user_id,
    ) -> RetrievalEvaluationQueryFollowUpUpdateResponse:
        if self.retrieval_evaluation_repository is None:
            raise RuntimeError("Retrieval evaluation repository is not configured.")

        normalized_query = request.query_text.strip()
        updated_count = await self.retrieval_evaluation_repository.update_follow_up_status_for_query(
            tenant_id=request.tenant_id,
            workspace_id=request.workspace_id,
            knowledge_base_id=request.knowledge_base_id,
            query_text=normalized_query,
            follow_up_status=request.follow_up_status,
            resolved_by_user_id=actor_user_id,
        )
        if updated_count == 0:
            raise ValueError("Retrieval evaluation candidate not found.")

        return RetrievalEvaluationQueryFollowUpUpdateResponse(
            tenant_id=request.tenant_id,
            workspace_id=request.workspace_id,
            knowledge_base_id=request.knowledge_base_id,
            query_text=normalized_query,
            follow_up_status=request.follow_up_status,
            updated_count=updated_count,
            acted_at=datetime.now(timezone.utc),
            acted_by_user_id=actor_user_id,
        )

    def _build_retrieval_evaluation_response(
        self,
        evaluation: RetrievalEvaluation,
    ) -> RetrievalEvaluationResponse:
        retrieval_profile_id = self._extract_retrieval_profile_id(evaluation.evaluation_payload_json)
        source_documents = self._extract_source_documents(evaluation.evaluation_payload_json)
        recommended_actions = self._build_tuning_candidate_actions(
            latest_item=evaluation,
            grouped_status_counter=Counter([evaluation.validation_status]),
            retrieval_profile_id=retrieval_profile_id,
            source_document_count=len(source_documents),
        )
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
            retrieval_profile_id=retrieval_profile_id,
            retrieval_profile_name=evaluation.retrieval_profile_name,
            retrieval_profile_source=evaluation.retrieval_profile_source,
            result_count=evaluation.result_count,
            shared_result_count=evaluation.shared_result_count,
            baseline_only_count=evaluation.baseline_only_count,
            candidate_only_count=evaluation.candidate_only_count,
            top_result_matches=evaluation.top_result_matches,
            recommendation_reason=evaluation.recommendation_reason,
            evaluation_payload_json=evaluation.evaluation_payload_json,
            follow_up_status=evaluation.follow_up_status,
            resolved_at=evaluation.resolved_at,
            resolved_by_user_id=evaluation.resolved_by_user_id,
            source_documents=source_documents,
            recommended_actions=recommended_actions,
            created_by_user_id=evaluation.created_by_user_id,
            created_at=evaluation.created_at,
            updated_at=evaluation.updated_at,
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

    def _build_tuning_candidate_actions(
        self,
        *,
        latest_item: RetrievalEvaluation,
        grouped_status_counter: Counter,
        retrieval_profile_id: UUID | None,
        source_document_count: int,
    ) -> list[RetrievalEvaluationFollowUpActionResponse]:
        actions: list[RetrievalEvaluationFollowUpActionResponse] = []

        def add_action(
            *,
            action_key: str,
            action_category: str,
            action_label: str,
            action_reason: str,
        ) -> None:
            if any(item.action_key == action_key for item in actions):
                return
            actions.append(
                RetrievalEvaluationFollowUpActionResponse(
                    action_key=action_key,
                    action_category=action_category,
                    action_label=action_label,
                    action_reason=action_reason,
                )
            )

        has_blocked_evidence = grouped_status_counter.get("failed", 0) > 0 or grouped_status_counter.get("empty", 0) > 0
        has_review_pressure = grouped_status_counter.get("hold", 0) > 0 or grouped_status_counter.get("review", 0) > 0
        has_ready_signal = grouped_status_counter.get("ready", 0) > 0

        if has_blocked_evidence:
            add_action(
                action_key="review_knowledge_base_governance",
                action_category="governance",
                action_label="Review source scope",
                action_reason=(
                    "Recent retrieval evaluations produced empty or failed evidence, so the knowledge-base source scope should be reviewed before more rollout."
                ),
            )

        if retrieval_profile_id is not None and has_review_pressure:
            add_action(
                action_key="review_retrieval_profile_governance",
                action_category="governance",
                action_label="Review retrieval profile",
                action_reason=(
                    "Repeated review or hold outcomes suggest the governed retrieval profile needs adjustment before this query can be treated as stable."
                ),
            )

        if latest_item.candidate_engine_name:
            add_action(
                action_key="rerun_retrieval_comparison",
                action_category="analysis",
                action_label="Compare engines again",
                action_reason=(
                    "Run a fresh engine comparison on the same query to confirm whether the candidate still diverges from the baseline."
                ),
            )
        else:
            add_action(
                action_key="rerun_retrieval_inspection",
                action_category="analysis",
                action_label="Inspect retrieval again",
                action_reason=(
                    "Run the same retrieval inspection again after source or profile review so the evidence posture can be re-validated."
                ),
            )

        if has_ready_signal:
            add_action(
                action_key="validate_in_chat",
                action_category="validation",
                action_label="Validate in chat",
                action_reason=(
                    "This query already has some ready evidence, so the grounded-chat lane can be used to confirm whether answer quality is now stable."
                ),
            )

        if not actions:
            add_action(
                action_key="rerun_retrieval_inspection",
                action_category="analysis",
                action_label="Inspect retrieval again",
                action_reason="Re-run this retrieval query to confirm the current evidence posture.",
            )

        if source_document_count == 0 and all(item.action_key != "review_knowledge_base_governance" for item in actions):
            actions.insert(
                0,
                RetrievalEvaluationFollowUpActionResponse(
                    action_key="review_knowledge_base_governance",
                    action_category="governance",
                    action_label="Review source scope",
                    action_reason=(
                        "No recent source documents were preserved in this evaluation history, so the governed knowledge-base scope should be reviewed directly."
                    ),
                ),
            )

        return actions[:3]

    def _build_retrieval_intelligence_summary(
        self,
        *,
        evaluations: list[RetrievalEvaluation],
        candidate_rows: list[RetrievalEvaluationTuningCandidateResponse],
        status_breakdown_counter: Counter,
        follow_up_breakdown_counter: Counter,
    ) -> tuple[str, str]:
        primary_candidate = candidate_rows[0] if candidate_rows else None
        if primary_candidate is not None:
            if primary_candidate.latest_validation_status in {"hold", "failed", "empty"}:
                engine_label = (
                    f"{primary_candidate.baseline_engine_name} versus {primary_candidate.candidate_engine_name}"
                    if primary_candidate.candidate_engine_name
                    else primary_candidate.baseline_engine_name
                )
                return (
                    "hold",
                    primary_candidate.recommendation_reason
                    or (
                        f"The current highest-attention retrieval candidate still needs to stay on hold. "
                        f"Review the evidence gap for '{primary_candidate.query_text}' before trusting {engine_label} in a broader lane."
                    ),
                )

            if primary_candidate.latest_validation_status == "review":
                return (
                    "review",
                    primary_candidate.recommendation_reason
                    or (
                        f"The current highest-attention retrieval candidate for '{primary_candidate.query_text}' "
                        "still needs operator review before it can be treated as stable."
                    ),
                )

        if follow_up_breakdown_counter.get("pending", 0) > 0:
            return (
                "review",
                "Retrieval follow-up work is still pending in this scope, so answer trust should keep flowing through review before broader rollout.",
            )

        if status_breakdown_counter.get("hold", 0) > 0 or status_breakdown_counter.get("failed", 0) > 0:
            return (
                "hold",
                "Recent retrieval evaluation history still includes hold or failed outcomes, so this scope should remain under a governed evidence posture.",
            )

        if status_breakdown_counter.get("review", 0) > 0 or status_breakdown_counter.get("empty", 0) > 0:
            return (
                "review",
                "Recent retrieval evaluation history still includes review-oriented outcomes, so keep validating evidence before treating the lane as stable.",
            )

        if evaluations:
            return (
                "stable",
                "Recent retrieval validation history is currently stable, and no high-attention follow-up candidate is waiting in this scope.",
            )

        return (
            "stable",
            "No retrieval evaluation history has been recorded in this scope yet. Run a governed validation query when you need to inspect trust posture.",
        )

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
        principal_user_id: UUID | None,
        acl_bypass: bool,
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
            principal_user_id=principal_user_id,
            acl_bypass=acl_bypass,
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
            rerank_metadata=retrieval_outcome.rerank_metadata,
            retrieval_plan_metadata=retrieval_outcome.retrieval_plan_metadata,
            evidence_validation_metadata=retrieval_outcome.evidence_validation_metadata,
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
            rerank_metadata=retrieval_outcome.rerank_metadata,
            retrieval_plan_metadata=retrieval_outcome.retrieval_plan_metadata,
            evidence_validation_metadata=retrieval_outcome.evidence_validation_metadata,
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
                evidence_score=float(row["evidence_score"]) if row.get("evidence_score") is not None else None,
                evidence_status=row.get("evidence_status"),
                evidence_reasons=list(row.get("evidence_reasons") or []),
                embedding_model=row.get("embedding_model"),
                retrieval_method=row["retrieval_method"],
                metadata_json=row["metadata_json"],
                created_at=row["created_at"],
            )
            for row in rows
        ]
