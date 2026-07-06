from uuid import UUID

from sqlalchemy import text

from ragpilot_api.application.errors import ResourceConflictError, ResourceNotFoundError
from ragpilot_api.contracts.http.workflow_contracts import (
    WorkflowRunActionResponse,
    WorkflowRunDetailResponse,
    WorkflowRunEventResponse,
    WorkflowRecoveryActionResponse,
    WorkflowRunRecoverySummaryResponse,
    WorkflowMetricsResponse,
    WorkflowRunResponse,
    WorkflowStepResponse,
)
from ragpilot_api.infrastructure.database.models import WorkflowRun, WorkflowRunEvent, WorkflowStep
from ragpilot_api.infrastructure.database.repositories.document_repository import DocumentRepository
from ragpilot_api.infrastructure.database.repositories.workflow_event_repository import WorkflowEventRepository
from ragpilot_api.infrastructure.database.repositories.workflow_repository import WorkflowRepository
from ragpilot_api.infrastructure.workflows.temporal_client import TemporalWorkflowClient


MAX_WORKFLOW_RETRY_DEPTH = 3


class WorkflowService:
    def __init__(
        self,
        workflow_repository: WorkflowRepository,
        document_repository: DocumentRepository | None = None,
        temporal_workflow_client: TemporalWorkflowClient | None = None,
        workflow_event_repository: WorkflowEventRepository | None = None,
    ) -> None:
        self.workflow_repository = workflow_repository
        self.document_repository = document_repository
        self.temporal_workflow_client = temporal_workflow_client
        self.workflow_event_repository = workflow_event_repository

    async def list_workflow_runs(
        self,
        *,
        tenant_id: UUID,
        query: str | None = None,
        status_filter: str | None = None,
        workflow_type: str | None = None,
        retry_mode: str | None = None,
        subject_id: UUID | None = None,
        sort_order: str = "created-desc",
        limit: int = 100,
        offset: int = 0,
    ) -> tuple[list[WorkflowRunResponse], int]:
        workflow_runs, total_count = await self.workflow_repository.list_workflow_runs(
            tenant_id=tenant_id,
            query=query,
            status_filter=status_filter,
            workflow_type=workflow_type,
            retry_mode=retry_mode,
            subject_id=subject_id,
            sort_order=sort_order,
            limit=limit,
            offset=offset,
        )
        workflow_responses = [
            await build_workflow_run_response(self.workflow_repository, workflow_run, self.workflow_event_repository)
            for workflow_run in workflow_runs
        ]
        return workflow_responses, total_count

    async def get_workflow_metrics(self, *, tenant_id: UUID) -> WorkflowMetricsResponse:
        metrics = await self.workflow_repository.get_workflow_metrics(tenant_id=tenant_id)
        return WorkflowMetricsResponse(**metrics)

    async def get_workflow_run_detail(
        self,
        *,
        workflow_run_id: UUID,
        tenant_id: UUID,
    ) -> WorkflowRunDetailResponse | None:
        workflow_run = await self.workflow_repository.get_workflow_run(
            workflow_run_id=workflow_run_id,
            tenant_id=tenant_id,
        )
        if workflow_run is None:
            return None

        return await build_workflow_run_detail_response(
            self.workflow_repository,
            self.workflow_event_repository,
            workflow_run,
        )

    async def retry_workflow_run(
        self,
        *,
        workflow_run_id: UUID,
        tenant_id: UUID,
        actor_user_id: UUID | None = None,
        actor_role: str | None = None,
    ) -> WorkflowRunActionResponse:
        workflow_run = await self.workflow_repository.get_workflow_run(
            workflow_run_id=workflow_run_id,
            tenant_id=tenant_id,
        )
        if workflow_run is None:
            raise ResourceNotFoundError("Workflow run not found.")
        recovery_summary = await resolve_workflow_recovery_summary(
            self.workflow_repository,
            self.workflow_event_repository,
            workflow_run,
        )
        retry_state = await resolve_workflow_retry_state(
            self.workflow_repository,
            workflow_run,
            recovery_summary=recovery_summary,
        )
        if not bool(retry_state["is_retry_available"]):
            reason = str(retry_state["retry_unavailable_reason"] or "Workflow retry is unavailable.")
            await self._record_retry_blocked_event(
                workflow_run=workflow_run,
                actor_user_id=actor_user_id,
                actor_role=actor_role,
                reason=reason,
                recovery_summary=recovery_summary,
            )
            raise ResourceConflictError(reason)
        if self.document_repository is None:
            reason = "Workflow retry requires a document repository."
            await self._record_retry_blocked_event(
                workflow_run=workflow_run,
                actor_user_id=actor_user_id,
                actor_role=actor_role,
                reason=reason,
                recovery_summary=recovery_summary,
            )
            raise ResourceConflictError(reason)

        document_state = (
            await self.workflow_repository.session.execute(
                text(
                    """
                    SELECT knowledge_base_id, deleted_at
                    FROM documents
                    WHERE id = :document_id
                    """
            ),
            {"document_id": workflow_run.subject_id},
        )
        ).first()
        if document_state is None:
            reason = "Workflow document subject not found."
            await self._record_retry_blocked_event(
                workflow_run=workflow_run,
                actor_user_id=actor_user_id,
                actor_role=actor_role,
                reason=reason,
                recovery_summary=recovery_summary,
            )
            raise ResourceNotFoundError(reason)

        knowledge_base_id, deleted_at = document_state
        if deleted_at is not None:
            reason = "Workflow retry is unavailable because the source document has been deleted."
            await self._record_retry_blocked_event(
                workflow_run=workflow_run,
                actor_user_id=actor_user_id,
                actor_role=actor_role,
                reason=reason,
                recovery_summary=recovery_summary,
            )
            raise ResourceConflictError(reason)

        await self.workflow_repository.session.execute(
            text(
                """
                UPDATE documents
                SET ingestion_status = 'pending',
                    indexing_status = 'pending'
                WHERE id = :document_id
                """
            ),
            {"document_id": workflow_run.subject_id},
        )
        await self.workflow_repository.session.commit()

        reindex_result = await self.document_repository.create_reindex_workflow_run(
            document_id=workflow_run.subject_id,
            knowledge_base_id=knowledge_base_id,
            retry_of_workflow_run_id=workflow_run.id,
        )
        if reindex_result is None:
            reason = "Workflow retry could not resolve the current source document version."
            await self._record_retry_blocked_event(
                workflow_run=workflow_run,
                actor_user_id=actor_user_id,
                actor_role=actor_role,
                reason=reason,
                recovery_summary=recovery_summary,
            )
            raise ResourceConflictError(reason)

        _, _, retry_workflow_run = reindex_result
        temporal_workflow_client = self.temporal_workflow_client or TemporalWorkflowClient()

        try:
            temporal_workflow_id = await temporal_workflow_client.start_document_ingestion_workflow(
                workflow_run_id=str(retry_workflow_run.id),
                document_id=str(workflow_run.subject_id),
            )
            retry_workflow_run = await self.workflow_repository.mark_workflow_run_queued(
                workflow_run=retry_workflow_run,
                temporal_workflow_id=temporal_workflow_id,
            )
        except Exception as error:
            retry_workflow_run = await self.workflow_repository.mark_workflow_run_failed(
                workflow_run=retry_workflow_run,
                error_message=str(error),
            )

        await self._record_workflow_run_event(
            workflow_run_id=workflow_run.id,
            tenant_id=workflow_run.tenant_id,
            actor_user_id=actor_user_id,
            actor_role=actor_role,
            action_type="retry_requested",
            detail={
                "workflow_type": workflow_run.workflow_type,
                "workflow_status": workflow_run.workflow_status,
                "subject_type": workflow_run.subject_type,
                "subject_id": str(workflow_run.subject_id) if workflow_run.subject_id is not None else None,
                "retry_workflow_run_id": str(retry_workflow_run.id),
            },
        )
        await self._record_workflow_run_event(
            workflow_run_id=retry_workflow_run.id,
            tenant_id=retry_workflow_run.tenant_id,
            actor_user_id=actor_user_id,
            actor_role=actor_role,
            action_type="retry_spawned",
            detail={
                "retry_of_workflow_run_id": str(workflow_run.id),
                "workflow_status": retry_workflow_run.workflow_status,
                "temporal_workflow_id": retry_workflow_run.temporal_workflow_id,
                "subject_type": retry_workflow_run.subject_type,
                "subject_id": str(retry_workflow_run.subject_id) if retry_workflow_run.subject_id is not None else None,
            },
        )

        response_payload = (
            await build_workflow_run_response(
                self.workflow_repository,
                retry_workflow_run,
                self.workflow_event_repository,
            )
        ).model_dump()
        response_payload["retry_of_workflow_run_id"] = workflow_run.id
        return WorkflowRunActionResponse(**response_payload)

    async def cancel_workflow_run(
        self,
        *,
        workflow_run_id: UUID,
        tenant_id: UUID,
        actor_user_id: UUID | None = None,
        actor_role: str | None = None,
    ) -> WorkflowRunActionResponse:
        workflow_run = await self.workflow_repository.get_workflow_run(
            workflow_run_id=workflow_run_id,
            tenant_id=tenant_id,
        )
        if workflow_run is None:
            raise ResourceNotFoundError("Workflow run not found.")

        if workflow_run.workflow_status not in {"pending", "queued", "running"}:
            raise ResourceConflictError("Only pending, queued, or running workflow runs can be cancelled.")

        cancel_reason = "Cancelled by operator."
        temporal_workflow_client = self.temporal_workflow_client or TemporalWorkflowClient()

        if workflow_run.workflow_status in {"queued", "running"}:
            if not workflow_run.temporal_workflow_id:
                raise ResourceConflictError("Workflow cancellation requires an attached runtime workflow handle.")
            try:
                await temporal_workflow_client.cancel_workflow(
                    temporal_workflow_id=workflow_run.temporal_workflow_id,
                    reason=cancel_reason,
                )
            except Exception as error:
                raise ResourceConflictError(
                    "Workflow cancellation could not be confirmed against the runtime controller."
                ) from error

        if workflow_run.subject_type == "document" and workflow_run.subject_id is not None:
            await self.workflow_repository.session.execute(
                text(
                    """
                    UPDATE documents
                    SET ingestion_status = 'failed',
                        indexing_status = 'failed'
                    WHERE id = :document_id
                    """
                ),
                {"document_id": workflow_run.subject_id},
            )
            await self.workflow_repository.session.execute(
                text(
                    """
                    UPDATE document_versions
                    SET ingestion_status = 'failed'
                    WHERE id = CAST(:document_version_id AS uuid)
                    """
                ),
                {"document_version_id": workflow_run.input_json.get("document_version_id")},
            )

        previous_status = workflow_run.workflow_status
        cancelled_workflow_run = await self.workflow_repository.mark_workflow_run_cancelled(
            workflow_run=workflow_run,
            reason=cancel_reason,
        )
        await self._record_workflow_run_event(
            workflow_run_id=cancelled_workflow_run.id,
            tenant_id=cancelled_workflow_run.tenant_id,
            actor_user_id=actor_user_id,
            actor_role=actor_role,
            action_type="cancel_requested",
            detail={
                "from_status": previous_status,
                "to_status": cancelled_workflow_run.workflow_status,
                "reason": cancel_reason,
                "temporal_workflow_id": cancelled_workflow_run.temporal_workflow_id,
                "subject_type": cancelled_workflow_run.subject_type,
                "subject_id": str(cancelled_workflow_run.subject_id) if cancelled_workflow_run.subject_id is not None else None,
            },
        )
        response_payload = (
            await build_workflow_run_response(
                self.workflow_repository,
                cancelled_workflow_run,
                self.workflow_event_repository,
            )
        ).model_dump()
        response_payload["retry_of_workflow_run_id"] = workflow_run.input_json.get("retry_of_workflow_run_id")
        return WorkflowRunActionResponse(**response_payload)

    async def update_workflow_run_operator_notes(
        self,
        *,
        workflow_run_id: UUID,
        tenant_id: UUID,
        operator_notes: str | None,
        actor_user_id: UUID | None = None,
        actor_role: str | None = None,
    ) -> WorkflowRunDetailResponse:
        workflow_run = await self.workflow_repository.get_workflow_run(
            workflow_run_id=workflow_run_id,
            tenant_id=tenant_id,
        )
        if workflow_run is None:
            raise ResourceNotFoundError("Workflow run not found.")

        normalized_notes = operator_notes.strip() if operator_notes else None
        previous_notes = workflow_run.operator_notes
        updated_workflow_run = await self.workflow_repository.update_workflow_run_operator_notes(
            workflow_run=workflow_run,
            operator_notes=normalized_notes or None,
        )
        if previous_notes != updated_workflow_run.operator_notes:
            await self._record_workflow_run_event(
                workflow_run_id=updated_workflow_run.id,
                tenant_id=updated_workflow_run.tenant_id,
                actor_user_id=actor_user_id,
                actor_role=actor_role,
                action_type="operator_notes_updated",
                detail={
                    "had_notes_before": bool(previous_notes and previous_notes.strip()),
                    "has_notes_now": bool(updated_workflow_run.operator_notes and updated_workflow_run.operator_notes.strip()),
                    "note_excerpt": (updated_workflow_run.operator_notes or "")[:240],
                },
            )

        return await build_workflow_run_detail_response(
            self.workflow_repository,
            self.workflow_event_repository,
            updated_workflow_run,
        )

    async def _record_workflow_run_event(
        self,
        *,
        workflow_run_id: UUID,
        tenant_id: UUID,
        actor_user_id: UUID | None,
        actor_role: str | None,
        action_type: str,
        detail: dict[str, object],
    ) -> None:
        if self.workflow_event_repository is None:
            return

        await self.workflow_event_repository.create_workflow_run_event(
            workflow_run_id=workflow_run_id,
            tenant_id=tenant_id,
            actor_user_id=actor_user_id,
            actor_role=actor_role,
            action_type=action_type,
            detail_json=detail,
        )

    async def _record_retry_blocked_event(
        self,
        *,
        workflow_run: WorkflowRun,
        actor_user_id: UUID | None,
        actor_role: str | None,
        reason: str,
        recovery_summary: WorkflowRunRecoverySummaryResponse | None = None,
    ) -> None:
        if recovery_summary is None:
            recovery_summary = await resolve_workflow_recovery_summary(
                self.workflow_repository,
                self.workflow_event_repository,
                workflow_run,
            )

        await self._record_workflow_run_event(
            workflow_run_id=workflow_run.id,
            tenant_id=workflow_run.tenant_id,
            actor_user_id=actor_user_id,
            actor_role=actor_role,
            action_type="retry_blocked",
            detail={
                "reason": reason,
                "workflow_status": workflow_run.workflow_status,
                "workflow_type": workflow_run.workflow_type,
                "subject_type": workflow_run.subject_type,
                "subject_id": str(workflow_run.subject_id) if workflow_run.subject_id is not None else None,
                "retry_depth": recovery_summary.retry_depth,
                "max_retry_depth": recovery_summary.max_retry_depth,
                "remaining_retry_attempts": recovery_summary.remaining_retry_attempts,
                "latest_child_retry_run_id": str(recovery_summary.latest_child_retry_run_id)
                if recovery_summary.latest_child_retry_run_id is not None
                else None,
                "latest_child_retry_status": recovery_summary.latest_child_retry_status,
                "active_child_retry_run_id": str(recovery_summary.active_child_retry_run_id)
                if recovery_summary.active_child_retry_run_id is not None
                else None,
            },
        )

    async def list_workflow_run_events(
        self,
        *,
        workflow_run_id: UUID,
        tenant_id: UUID,
        action_type: str | None = None,
        actor_role: str | None = None,
        limit: int = 50,
    ) -> list[WorkflowRunEventResponse]:
        workflow_run = await self.workflow_repository.get_workflow_run(
            workflow_run_id=workflow_run_id,
            tenant_id=tenant_id,
        )
        if workflow_run is None:
            raise ResourceNotFoundError("Workflow run not found.")
        if self.workflow_event_repository is None:
            return []
        workflow_events = await self.workflow_event_repository.list_workflow_run_events(
            workflow_run_id=workflow_run_id,
            action_type=action_type,
            actor_role=actor_role,
            limit=limit,
        )
        return [build_workflow_run_event_response(workflow_event) for workflow_event in workflow_events]

    async def list_workflow_run_steps(
        self,
        *,
        workflow_run_id: UUID,
        tenant_id: UUID,
        status_filter: str | None = None,
        min_attempt_count: int | None = None,
        limit: int = 50,
    ) -> list[WorkflowStepResponse]:
        workflow_run = await self.workflow_repository.get_workflow_run(
            workflow_run_id=workflow_run_id,
            tenant_id=tenant_id,
        )
        if workflow_run is None:
            raise ResourceNotFoundError("Workflow run not found.")

        workflow_steps = await self.workflow_repository.list_workflow_steps(
            workflow_run_id=workflow_run_id,
            status_filter=status_filter,
            min_attempt_count=min_attempt_count,
            limit=limit,
        )
        recovery_summary = await resolve_workflow_recovery_summary(
            self.workflow_repository,
            self.workflow_event_repository,
            workflow_run,
        )
        retry_state = await resolve_workflow_retry_state(
            self.workflow_repository,
            workflow_run,
            recovery_summary=recovery_summary,
        )
        workflow_run = attach_workflow_recovery_summary(workflow_run, recovery_summary)
        failure_focus = resolve_workflow_failure_focus(
            workflow_run=workflow_run,
            retry_state=retry_state,
        )
        return [
            build_workflow_step_response(
                workflow_step,
                workflow_run=workflow_run,
                retry_state=retry_state,
                failure_focus_step_name=str(failure_focus["failure_focus_step_name"] or "") or None,
            )
            for workflow_step in workflow_steps
        ]


async def build_workflow_run_response(
    workflow_repository: WorkflowRepository,
    workflow_run: WorkflowRun,
    workflow_event_repository: WorkflowEventRepository | None = None,
) -> WorkflowRunResponse:
    subject_context = await resolve_workflow_subject_context(workflow_repository, workflow_run)
    recovery_summary = await resolve_workflow_recovery_summary(
        workflow_repository,
        workflow_event_repository,
        workflow_run,
    )
    retry_state = await resolve_workflow_retry_state(
        workflow_repository,
        workflow_run,
        recovery_summary=recovery_summary,
    )
    workflow_run = attach_workflow_recovery_summary(workflow_run, recovery_summary)
    failure_focus = resolve_workflow_failure_focus(workflow_run=workflow_run, retry_state=retry_state)
    recovery_actions = build_workflow_recovery_actions(
        workflow_run=workflow_run,
        retry_state=retry_state,
        failure_focus=failure_focus,
    )
    recovery_guidance = resolve_workflow_recovery_guidance(
        workflow_run=workflow_run,
        retry_state=retry_state,
    )
    return WorkflowRunResponse(
        id=workflow_run.id,
        tenant_id=workflow_run.tenant_id,
        workflow_type=workflow_run.workflow_type,
        workflow_status=workflow_run.workflow_status,
        retry_of_workflow_run_id=workflow_run.input_json.get("retry_of_workflow_run_id"),
        temporal_workflow_id=workflow_run.temporal_workflow_id,
        subject_type=workflow_run.subject_type,
        subject_id=workflow_run.subject_id,
        subject_label=subject_context["subject_label"],
        subject_workspace_id=subject_context["subject_workspace_id"],
        subject_knowledge_base_id=subject_context["subject_knowledge_base_id"],
        root_workflow_run_id=recovery_summary.root_workflow_run_id,
        latest_child_retry_run_id=recovery_summary.latest_child_retry_run_id,
        latest_child_retry_status=recovery_summary.latest_child_retry_status,
        active_child_retry_run_id=recovery_summary.active_child_retry_run_id,
        has_active_retry_child=recovery_summary.has_active_retry_child,
        retry_depth=recovery_summary.retry_depth,
        child_retry_run_count=recovery_summary.child_retry_run_count,
        max_retry_depth=recovery_summary.max_retry_depth,
        remaining_retry_attempts=recovery_summary.remaining_retry_attempts,
        error_message=workflow_run.error_message,
        operator_notes=getattr(workflow_run, "operator_notes", None),
        is_retry_available=retry_state["is_retry_available"],
        retry_unavailable_reason=retry_state["retry_unavailable_reason"],
        total_step_count=recovery_summary.total_step_count,
        completed_step_count=recovery_summary.completed_step_count,
        failed_step_count=recovery_summary.failed_step_count,
        active_step_count=recovery_summary.active_step_count,
        pending_step_count=recovery_summary.pending_step_count,
        latest_active_step_name=recovery_summary.latest_active_step_name,
        latest_active_step_started_at=recovery_summary.latest_active_step_started_at,
        latest_completed_step_name=recovery_summary.latest_completed_step_name,
        latest_completed_step_completed_at=recovery_summary.latest_completed_step_completed_at,
        highest_attempt_step_name=recovery_summary.highest_attempt_step_name,
        highest_attempt_count=recovery_summary.highest_attempt_count,
        latest_failed_step_name=recovery_summary.latest_failed_step_name,
        latest_failed_step_error_message=recovery_summary.latest_failed_step_error_message,
        failure_category=failure_focus["failure_category"],
        failure_recommended_action=failure_focus["failure_recommended_action"],
        failure_recommended_view=failure_focus["failure_recommended_view"],
        failure_recommended_primary_action=failure_focus["failure_recommended_primary_action"],
        failure_focus_step_name=failure_focus["failure_focus_step_name"],
        failure_focus_error_message=failure_focus["failure_focus_error_message"],
        failure_focus_attempt_count=failure_focus["failure_focus_attempt_count"],
        recovery_actions=recovery_actions,
        recovery_event_count=recovery_summary.recovery_event_count,
        latest_recovery_event_at=recovery_summary.latest_recovery_event_at,
        recovery_stage=recovery_guidance["recovery_stage"],
        recommended_next_view=recovery_guidance["recommended_next_view"],
        recommended_primary_action=recovery_guidance["recommended_primary_action"],
        follow_up_reason=recovery_guidance["follow_up_reason"],
        started_at=workflow_run.started_at,
        completed_at=workflow_run.completed_at,
        created_at=workflow_run.created_at,
        updated_at=workflow_run.updated_at,
    )


async def build_workflow_run_detail_response(
    workflow_repository: WorkflowRepository,
    workflow_event_repository: WorkflowEventRepository | None,
    workflow_run: WorkflowRun,
) -> WorkflowRunDetailResponse:
    steps = await workflow_repository.list_workflow_steps(workflow_run_id=workflow_run.id)
    workflow_events = (
        await workflow_event_repository.list_workflow_run_events(workflow_run_id=workflow_run.id)
        if workflow_event_repository is not None
        else []
    )
    workflow_run_response = await build_workflow_run_response(workflow_repository, workflow_run, workflow_event_repository)
    retry_state = {
        "is_retry_available": workflow_run_response.is_retry_available,
        "retry_unavailable_reason": workflow_run_response.retry_unavailable_reason,
    }
    return WorkflowRunDetailResponse(
        **workflow_run_response.model_dump(),
        input_json=workflow_run.input_json,
        steps=[
            build_workflow_step_response(
                step,
                workflow_run=workflow_run,
                retry_state=retry_state,
                failure_focus_step_name=workflow_run_response.failure_focus_step_name,
            )
            for step in steps
        ],
        events=[build_workflow_run_event_response(workflow_event) for workflow_event in workflow_events],
    )


async def resolve_workflow_recovery_summary(
    workflow_repository: WorkflowRepository,
    workflow_event_repository: WorkflowEventRepository | None,
    workflow_run: WorkflowRun,
) -> WorkflowRunRecoverySummaryResponse:
    retry_lineage_summary = await resolve_workflow_retry_lineage_summary(workflow_repository, workflow_run)
    remaining_retry_attempts = max(MAX_WORKFLOW_RETRY_DEPTH - retry_lineage_summary["retry_depth"], 0)
    step_summary = await workflow_repository.get_workflow_step_summary(workflow_run_id=workflow_run.id)
    event_summary = (
        await workflow_event_repository.get_workflow_run_event_summary(workflow_run_id=workflow_run.id)
        if workflow_event_repository is not None
        else {"recovery_event_count": 0, "latest_recovery_event_at": None}
    )

    return WorkflowRunRecoverySummaryResponse(
        root_workflow_run_id=retry_lineage_summary["root_workflow_run_id"],
        latest_child_retry_run_id=retry_lineage_summary["latest_child_retry_run_id"],
        latest_child_retry_status=retry_lineage_summary["latest_child_retry_status"],
        active_child_retry_run_id=retry_lineage_summary["active_child_retry_run_id"],
        has_active_retry_child=retry_lineage_summary["has_active_retry_child"],
        retry_depth=retry_lineage_summary["retry_depth"],
        child_retry_run_count=retry_lineage_summary["child_retry_run_count"],
        max_retry_depth=MAX_WORKFLOW_RETRY_DEPTH,
        remaining_retry_attempts=remaining_retry_attempts,
        total_step_count=step_summary["total_step_count"],
        completed_step_count=step_summary["completed_step_count"],
        failed_step_count=step_summary["failed_step_count"],
        active_step_count=step_summary["active_step_count"],
        pending_step_count=step_summary["pending_step_count"],
        latest_active_step_name=step_summary["latest_active_step_name"],
        latest_active_step_started_at=step_summary["latest_active_step_started_at"],
        latest_completed_step_name=step_summary["latest_completed_step_name"],
        latest_completed_step_completed_at=step_summary["latest_completed_step_completed_at"],
        highest_attempt_step_name=step_summary["highest_attempt_step_name"],
        highest_attempt_count=step_summary["highest_attempt_count"],
        latest_failed_step_name=step_summary["latest_failed_step_name"],
        latest_failed_step_error_message=step_summary["latest_failed_step_error_message"],
        recovery_event_count=event_summary["recovery_event_count"],
        latest_recovery_event_at=event_summary["latest_recovery_event_at"],
    )


async def resolve_workflow_retry_state(
    workflow_repository: WorkflowRepository,
    workflow_run: WorkflowRun,
    recovery_summary: WorkflowRunRecoverySummaryResponse | None = None,
) -> dict[str, bool | str | None]:
    if workflow_run.workflow_status != "failed":
        return {
            "is_retry_available": False,
            "retry_unavailable_reason": "Only failed workflow runs can be retried.",
        }

    if workflow_run.workflow_type != "document_ingestion":
        return {
            "is_retry_available": False,
            "retry_unavailable_reason": "Retry is only supported for failed document-ingestion workflows.",
        }

    if workflow_run.subject_type != "document" or workflow_run.subject_id is None:
        return {
            "is_retry_available": False,
            "retry_unavailable_reason": "Retry requires a workflow run that is attached to a document.",
        }

    if recovery_summary is None:
        recovery_summary = await resolve_workflow_recovery_summary(
            workflow_repository,
            None,
            workflow_run,
        )

    if recovery_summary.retry_depth >= recovery_summary.max_retry_depth:
        return {
            "is_retry_available": False,
            "retry_unavailable_reason": "Retry is unavailable because this workflow has already reached the retry depth limit.",
        }

    if recovery_summary.has_active_retry_child and recovery_summary.active_child_retry_run_id is not None:
        return {
            "is_retry_available": False,
            "retry_unavailable_reason": "Retry is unavailable because another retry run is already active for this workflow.",
        }

    document_state = (
        await workflow_repository.session.execute(
            text(
                """
                SELECT deleted_at
                FROM documents
                WHERE id = :document_id
                """
            ),
            {"document_id": workflow_run.subject_id},
        )
    ).first()
    if document_state is None:
        return {
            "is_retry_available": False,
            "retry_unavailable_reason": "Retry is unavailable because the source document no longer exists.",
        }

    deleted_at = document_state[0]
    if deleted_at is not None:
        return {
            "is_retry_available": False,
            "retry_unavailable_reason": "Retry is unavailable because the source document is no longer active in this knowledge base.",
        }

    return {
        "is_retry_available": True,
        "retry_unavailable_reason": None,
    }


async def resolve_workflow_retry_lineage_summary(
    workflow_repository: WorkflowRepository,
    workflow_run: WorkflowRun,
) -> dict[str, object]:
    retry_depth = 0
    root_workflow_run_id = workflow_run.id
    current_parent_id = workflow_run.input_json.get("retry_of_workflow_run_id")
    visited_parent_ids: set[str] = set()

    while isinstance(current_parent_id, str) and current_parent_id and current_parent_id not in visited_parent_ids:
        visited_parent_ids.add(current_parent_id)
        try:
            parent_uuid = UUID(current_parent_id)
        except ValueError:
            break

        parent_run = await workflow_repository.get_workflow_run_by_id(workflow_run_id=parent_uuid)
        if parent_run is None:
            break

        retry_depth += 1
        root_workflow_run_id = parent_run.id
        current_parent_id = parent_run.input_json.get("retry_of_workflow_run_id")
        if retry_depth >= 20:
            break

    child_retry_summary = await workflow_repository.get_child_retry_summary(workflow_run_id=workflow_run.id)
    active_child_retry_run_id = child_retry_summary.get("active_child_retry_run_id")

    return {
        "root_workflow_run_id": root_workflow_run_id,
        "latest_child_retry_run_id": child_retry_summary.get("latest_child_retry_run_id"),
        "latest_child_retry_status": child_retry_summary.get("latest_child_retry_status"),
        "active_child_retry_run_id": active_child_retry_run_id,
        "has_active_retry_child": active_child_retry_run_id is not None,
        "retry_depth": retry_depth,
        "child_retry_run_count": int(child_retry_summary.get("child_retry_run_count") or 0),
    }


async def resolve_workflow_subject_context(
    workflow_repository: WorkflowRepository,
    workflow_run: WorkflowRun,
) -> dict[str, UUID | str | None]:
    if workflow_run.subject_type != "document" or workflow_run.subject_id is None:
        return {
            "subject_label": None,
            "subject_workspace_id": None,
            "subject_knowledge_base_id": None,
        }

    subject_row = (
        await workflow_repository.session.execute(
            text(
                """
                SELECT documents.title, knowledge_bases.workspace_id, documents.knowledge_base_id
                FROM documents
                JOIN knowledge_bases ON knowledge_bases.id = documents.knowledge_base_id
                WHERE documents.id = :document_id
                """
            ),
            {"document_id": workflow_run.subject_id},
        )
    ).first()
    if subject_row is None:
        return {
            "subject_label": None,
            "subject_workspace_id": None,
            "subject_knowledge_base_id": None,
        }

    subject_label = str(subject_row[0]) if len(subject_row) > 0 and subject_row[0] is not None else None
    subject_workspace_id = subject_row[1] if len(subject_row) > 1 else None
    subject_knowledge_base_id = subject_row[2] if len(subject_row) > 2 else None

    return {
        "subject_label": subject_label,
        "subject_workspace_id": subject_workspace_id,
        "subject_knowledge_base_id": subject_knowledge_base_id,
    }


def resolve_workflow_recovery_guidance(
    *,
    workflow_run: WorkflowRun,
    retry_state: dict[str, bool | str | None],
) -> dict[str, str | None]:
    workflow_status = workflow_run.workflow_status
    retry_unavailable_reason = retry_state["retry_unavailable_reason"]
    failure_focus = resolve_workflow_failure_focus(workflow_run=workflow_run, retry_state=retry_state)

    if workflow_status == "failed":
        if failure_focus["failure_category"] == "source_deleted":
            return {
                "recovery_stage": "retry_blocked_document_deleted",
                "recommended_next_view": "documents",
                "recommended_primary_action": "open_document",
                "follow_up_reason": str(retry_unavailable_reason)
                or "The source document is no longer active in this knowledge base.",
            }

        if failure_focus["failure_category"] == "source_missing":
            return {
                "recovery_stage": "retry_blocked_document_missing",
                "recommended_next_view": "documents",
                "recommended_primary_action": "open_document",
                "follow_up_reason": str(retry_unavailable_reason)
                or "The source document can no longer be resolved from this scope.",
            }

        if bool(retry_state["is_retry_available"]):
            return build_retry_ready_failed_workflow_guidance(
                workflow_run=workflow_run,
                failure_focus=failure_focus,
            )

        normalized_reason = str(retry_unavailable_reason or "").lower()
        if "no longer active" in normalized_reason or "deleted" in normalized_reason:
            return {
                "recovery_stage": "retry_blocked_document_deleted",
                "recommended_next_view": "documents",
                "recommended_primary_action": "open_document",
                "follow_up_reason": str(retry_unavailable_reason),
            }

        if "no longer exists" in normalized_reason or "not found" in normalized_reason:
            return {
                "recovery_stage": "retry_blocked_document_missing",
                "recommended_next_view": "documents",
                "recommended_primary_action": "open_document",
                "follow_up_reason": str(retry_unavailable_reason),
            }

        return {
            "recovery_stage": "retry_blocked_unsupported",
            "recommended_next_view": "workflows",
            "recommended_primary_action": "open_workflows",
            "follow_up_reason": str(retry_unavailable_reason) or "Retry is unavailable for this workflow run.",
        }

    if workflow_status in {"queued", "running", "pending"}:
        return {
            "recovery_stage": "active_monitoring",
            "recommended_next_view": "workflows",
            "recommended_primary_action": "monitor_workflow",
            "follow_up_reason": build_active_workflow_follow_up_reason(workflow_run),
        }

    if workflow_status == "completed":
        return {
            "recovery_stage": "completed_ready_for_chat",
            "recommended_next_view": "chat",
            "recommended_primary_action": "open_chat",
            "follow_up_reason": "The workflow completed successfully and the scope is ready for grounded chat follow-up.",
        }

    if workflow_status == "cancelled":
        if workflow_run.subject_type == "document" and workflow_run.subject_id is not None:
            return {
                "recovery_stage": "review_workflow",
                "recommended_next_view": "documents",
                "recommended_primary_action": "open_document",
                "follow_up_reason": "This workflow was cancelled by an operator. Review the source document before relaunching ingestion.",
            }

        return {
            "recovery_stage": "review_workflow",
            "recommended_next_view": "workflows",
            "recommended_primary_action": "open_workflows",
            "follow_up_reason": "This workflow was cancelled by an operator. Review the execution context before relaunching it.",
        }

    return {
        "recovery_stage": "review_workflow",
        "recommended_next_view": "workflows",
        "recommended_primary_action": "open_workflows",
        "follow_up_reason": "Review the workflow timeline before taking the next operator action.",
    }


def build_retry_ready_failed_workflow_guidance(
    *,
    workflow_run: WorkflowRun,
    failure_focus: dict[str, str | int | None],
) -> dict[str, str | None]:
    failure_category = failure_focus["failure_category"]
    follow_up_reason = build_failed_workflow_follow_up_reason(workflow_run)

    if failure_category == "parser_failure":
        return {
            "recovery_stage": "review_workflow",
            "recommended_next_view": "documents",
            "recommended_primary_action": "open_document",
            "follow_up_reason": f"{follow_up_reason} Review the document source and parser path before retrying.",
        }

    if failure_category in {"embedding_failure", "indexing_failure", "unknown"}:
        return {
            "recovery_stage": "review_workflow",
            "recommended_next_view": "workflows",
            "recommended_primary_action": "open_workflows",
            "follow_up_reason": follow_up_reason,
        }

    if failure_category in {"runtime_timeout", "runtime_capacity"}:
        return {
            "recovery_stage": "retry_available",
            "recommended_next_view": "workflows",
            "recommended_primary_action": "retry_workflow",
            "follow_up_reason": follow_up_reason,
        }

    return {
        "recovery_stage": "retry_available",
        "recommended_next_view": "workflows",
        "recommended_primary_action": "retry_workflow",
        "follow_up_reason": follow_up_reason,
    }


def build_failed_workflow_follow_up_reason(workflow_run: WorkflowRun) -> str:
    latest_failed_step_name = getattr(workflow_run, "latest_failed_step_name", None)
    latest_failed_step_error_message = getattr(workflow_run, "latest_failed_step_error_message", None)
    highest_attempt_step_name = getattr(workflow_run, "highest_attempt_step_name", None)
    highest_attempt_count = int(getattr(workflow_run, "highest_attempt_count", 0) or 0)

    if latest_failed_step_name:
        reason = f"The latest failed step is {latest_failed_step_name}."
        if latest_failed_step_error_message:
            reason = f"{reason} Error: {latest_failed_step_error_message}"
        if highest_attempt_step_name and highest_attempt_count > 1:
            reason = f"{reason} Highest retry pressure is on {highest_attempt_step_name} ({highest_attempt_count} attempts)."
        return reason

    if highest_attempt_step_name and highest_attempt_count > 1:
        return f"The failed workflow is eligible for retry, and {highest_attempt_step_name} already reached {highest_attempt_count} attempts."

    return "The failed workflow is eligible for retry from the operations lane."


def build_active_workflow_follow_up_reason(workflow_run: WorkflowRun) -> str:
    latest_active_step_name = getattr(workflow_run, "latest_active_step_name", None)
    latest_completed_step_name = getattr(workflow_run, "latest_completed_step_name", None)

    if latest_active_step_name and latest_completed_step_name:
        return (
            f"The workflow is still in progress. Active step: {latest_active_step_name}. "
            f"Latest completed step: {latest_completed_step_name}."
        )

    if latest_active_step_name:
        return f"The workflow is still in progress. Active step: {latest_active_step_name}."

    if latest_completed_step_name:
        return f"The workflow is still in progress. Latest completed step: {latest_completed_step_name}."

    return "Keep monitoring execution progress before moving to downstream chat or document review."


def resolve_workflow_failure_focus(
    *,
    workflow_run: WorkflowRun,
    retry_state: dict[str, bool | str | None],
) -> dict[str, str | int | None]:
    if workflow_run.workflow_status != "failed":
        return {
            "failure_category": None,
            "failure_recommended_action": None,
            "failure_recommended_view": None,
            "failure_recommended_primary_action": None,
            "failure_focus_step_name": None,
            "failure_focus_error_message": None,
            "failure_focus_attempt_count": 0,
        }

    retry_reason = str(retry_state.get("retry_unavailable_reason") or "").lower()
    focus_step_name = getattr(workflow_run, "latest_failed_step_name", None) or getattr(workflow_run, "highest_attempt_step_name", None)
    focus_error_message = (
        getattr(workflow_run, "latest_failed_step_error_message", None)
        or getattr(workflow_run, "error_message", None)
    )
    focus_attempt_count = int(getattr(workflow_run, "highest_attempt_count", 0) or 0)

    return resolve_workflow_failure_focus_from_signals(
        retry_state=retry_state,
        focus_step_name=focus_step_name,
        focus_error_message=focus_error_message,
        focus_attempt_count=focus_attempt_count,
        retry_reason=retry_reason,
    )


def resolve_workflow_failure_focus_from_signals(
    *,
    retry_state: dict[str, bool | str | None],
    focus_step_name: str | None,
    focus_error_message: str | None,
    focus_attempt_count: int,
    retry_reason: str | None = None,
) -> dict[str, str | int | None]:
    retry_reason = str(retry_reason or retry_state.get("retry_unavailable_reason") or "").lower()

    if "no longer active" in retry_reason or "deleted" in retry_reason:
        return {
            "failure_category": "source_deleted",
            "failure_recommended_action": "review_document_source",
            "failure_recommended_view": "documents",
            "failure_recommended_primary_action": "open_document",
            "failure_focus_step_name": focus_step_name,
            "failure_focus_error_message": focus_error_message,
            "failure_focus_attempt_count": focus_attempt_count,
        }

    if "no longer exists" in retry_reason or "not found" in retry_reason:
        return {
            "failure_category": "source_missing",
            "failure_recommended_action": "review_document_source",
            "failure_recommended_view": "documents",
            "failure_recommended_primary_action": "open_document",
            "failure_focus_step_name": focus_step_name,
            "failure_focus_error_message": focus_error_message,
            "failure_focus_attempt_count": focus_attempt_count,
        }

    normalized_step_name = str(focus_step_name or "").lower()
    normalized_error_message = str(focus_error_message or "").lower()

    if any(keyword in normalized_step_name for keyword in ("parse", "extract", "normalize", "chunk")) or any(
        keyword in normalized_error_message
        for keyword in ("parser", "unsupported", "format", "content type", "decode", "encoding")
    ):
        return {
            "failure_category": "parser_failure",
            "failure_recommended_action": "review_parser_path",
            "failure_recommended_view": "documents",
            "failure_recommended_primary_action": "open_document",
            "failure_focus_step_name": focus_step_name,
            "failure_focus_error_message": focus_error_message,
            "failure_focus_attempt_count": focus_attempt_count,
        }

    if any(keyword in normalized_error_message for keyword in ("timeout", "timed out", "deadline exceeded")):
        return {
            "failure_category": "runtime_timeout",
            "failure_recommended_action": "retry_when_ready",
            "failure_recommended_view": "workflows",
            "failure_recommended_primary_action": "retry_workflow"
            if bool(retry_state.get("is_retry_available"))
            else "open_workflows",
            "failure_focus_step_name": focus_step_name,
            "failure_focus_error_message": focus_error_message,
            "failure_focus_attempt_count": focus_attempt_count,
        }

    if any(keyword in normalized_error_message for keyword in ("rate limit", "too many requests", "capacity", "unavailable")):
        return {
            "failure_category": "runtime_capacity",
            "failure_recommended_action": "retry_when_ready",
            "failure_recommended_view": "workflows",
            "failure_recommended_primary_action": "retry_workflow"
            if bool(retry_state.get("is_retry_available"))
            else "open_workflows",
            "failure_focus_step_name": focus_step_name,
            "failure_focus_error_message": focus_error_message,
            "failure_focus_attempt_count": focus_attempt_count,
        }

    if any(keyword in normalized_step_name for keyword in ("embed", "vector")) or "embedding" in normalized_error_message:
        return {
            "failure_category": "embedding_failure",
            "failure_recommended_action": "review_runtime",
            "failure_recommended_view": "workflows",
            "failure_recommended_primary_action": "open_workflows",
            "failure_focus_step_name": focus_step_name,
            "failure_focus_error_message": focus_error_message,
            "failure_focus_attempt_count": focus_attempt_count,
        }

    if any(keyword in normalized_step_name for keyword in ("index", "search")):
        return {
            "failure_category": "indexing_failure",
            "failure_recommended_action": "review_indexing",
            "failure_recommended_view": "workflows",
            "failure_recommended_primary_action": "open_workflows",
            "failure_focus_step_name": focus_step_name,
            "failure_focus_error_message": focus_error_message,
            "failure_focus_attempt_count": focus_attempt_count,
        }

    return {
        "failure_category": "unknown",
        "failure_recommended_action": "inspect_workflow",
        "failure_recommended_view": "workflows",
        "failure_recommended_primary_action": "open_workflows",
        "failure_focus_step_name": focus_step_name,
        "failure_focus_error_message": focus_error_message,
        "failure_focus_attempt_count": focus_attempt_count,
    }


def build_workflow_recovery_actions(
    *,
    workflow_run: WorkflowRun,
    retry_state: dict[str, bool | str | None],
    failure_focus: dict[str, str | int | None],
) -> list[WorkflowRecoveryActionResponse]:
    if workflow_run.workflow_status != "failed":
        return []

    failure_category = failure_focus["failure_category"]
    actions: list[WorkflowRecoveryActionResponse] = []

    def append_action(
        *,
        action_key: str,
        target_view: str | None,
        target_primary_action: str | None,
        is_primary: bool = False,
        is_enabled: bool = True,
        disabled_reason: str | None = None,
    ) -> None:
        actions.append(
            WorkflowRecoveryActionResponse(
                action_key=action_key,  # type: ignore[arg-type]
                target_view=target_view,  # type: ignore[arg-type]
                target_primary_action=target_primary_action,  # type: ignore[arg-type]
                is_primary=is_primary,
                is_enabled=is_enabled,
                disabled_reason=disabled_reason,
            )
        )

    retry_disabled_reason = str(retry_state.get("retry_unavailable_reason") or "").strip() or None
    retry_enabled = bool(retry_state.get("is_retry_available"))

    if failure_category in {"source_deleted", "source_missing", "parser_failure"}:
        append_action(
            action_key="review_document_source" if failure_category != "parser_failure" else "review_parser_path",
            target_view="documents",
            target_primary_action="open_document",
            is_primary=True,
        )
        append_action(
            action_key="inspect_workflow",
            target_view="workflows",
            target_primary_action="open_workflows",
        )
        if retry_enabled:
            append_action(
                action_key="retry_when_ready",
                target_view="workflows",
                target_primary_action="retry_workflow",
            )
        return actions

    if failure_category in {"runtime_timeout", "runtime_capacity"}:
        append_action(
            action_key="retry_when_ready",
            target_view="workflows",
            target_primary_action="retry_workflow" if retry_enabled else "open_workflows",
            is_primary=True,
            is_enabled=retry_enabled,
            disabled_reason=None if retry_enabled else retry_disabled_reason,
        )
        append_action(
            action_key="review_runtime",
            target_view="workflows",
            target_primary_action="open_workflows",
        )
        return actions

    if failure_category == "indexing_failure":
        append_action(
            action_key="review_indexing",
            target_view="workflows",
            target_primary_action="open_workflows",
            is_primary=True,
        )
        if retry_enabled:
            append_action(
                action_key="retry_when_ready",
                target_view="workflows",
                target_primary_action="retry_workflow",
            )
        return actions

    if failure_category == "embedding_failure":
        append_action(
            action_key="review_runtime",
            target_view="workflows",
            target_primary_action="open_workflows",
            is_primary=True,
        )
        if retry_enabled:
            append_action(
                action_key="retry_when_ready",
                target_view="workflows",
                target_primary_action="retry_workflow",
            )
        return actions

    append_action(
        action_key="inspect_workflow",
        target_view="workflows",
        target_primary_action="open_workflows",
        is_primary=True,
    )
    if retry_enabled:
        append_action(
            action_key="retry_when_ready",
            target_view="workflows",
            target_primary_action="retry_workflow",
        )
    return actions


def build_workflow_step_response(
    workflow_step: WorkflowStep,
    *,
    workflow_run: WorkflowRun | None = None,
    retry_state: dict[str, bool | str | None] | None = None,
    failure_focus_step_name: str | None = None,
) -> WorkflowStepResponse:
    failure_focus: dict[str, str | int | None] | None = None
    recovery_actions: list[WorkflowRecoveryActionResponse] = []
    is_failure_focus = False

    if (
        workflow_run is not None
        and workflow_run.workflow_status == "failed"
        and workflow_step.step_status == "failed"
    ):
        effective_retry_state = retry_state or {
            "is_retry_available": False,
            "retry_unavailable_reason": None,
        }
        failure_focus = resolve_workflow_failure_focus_from_signals(
            retry_state=effective_retry_state,
            focus_step_name=workflow_step.step_name,
            focus_error_message=workflow_step.error_message,
            focus_attempt_count=workflow_step.attempt_count,
        )
        recovery_actions = build_workflow_recovery_actions(
            workflow_run=workflow_run,
            retry_state=effective_retry_state,
            failure_focus=failure_focus,
        )
        is_failure_focus = failure_focus_step_name == workflow_step.step_name

    return WorkflowStepResponse(
        id=workflow_step.id,
        tenant_id=workflow_step.tenant_id,
        workflow_run_id=workflow_step.workflow_run_id,
        step_name=workflow_step.step_name,
        step_status=workflow_step.step_status,
        attempt_count=workflow_step.attempt_count,
        error_message=workflow_step.error_message,
        failure_category=failure_focus["failure_category"] if failure_focus is not None else None,
        failure_recommended_action=failure_focus["failure_recommended_action"] if failure_focus is not None else None,
        failure_recommended_view=failure_focus["failure_recommended_view"] if failure_focus is not None else None,
        failure_recommended_primary_action=(
            failure_focus["failure_recommended_primary_action"] if failure_focus is not None else None
        ),
        recovery_actions=recovery_actions,
        is_failure_focus=is_failure_focus,
        started_at=workflow_step.started_at,
        completed_at=workflow_step.completed_at,
        created_at=workflow_step.created_at,
        updated_at=workflow_step.updated_at,
    )


def build_workflow_run_event_response(workflow_run_event: WorkflowRunEvent) -> WorkflowRunEventResponse:
    return WorkflowRunEventResponse.model_validate(workflow_run_event)


def attach_workflow_recovery_summary(
    workflow_run: WorkflowRun,
    recovery_summary: WorkflowRunRecoverySummaryResponse,
) -> WorkflowRun:
    workflow_run.latest_active_step_name = recovery_summary.latest_active_step_name
    workflow_run.latest_active_step_started_at = recovery_summary.latest_active_step_started_at
    workflow_run.latest_completed_step_name = recovery_summary.latest_completed_step_name
    workflow_run.latest_completed_step_completed_at = recovery_summary.latest_completed_step_completed_at
    workflow_run.highest_attempt_step_name = recovery_summary.highest_attempt_step_name
    workflow_run.highest_attempt_count = recovery_summary.highest_attempt_count
    workflow_run.latest_failed_step_name = recovery_summary.latest_failed_step_name
    workflow_run.latest_failed_step_error_message = recovery_summary.latest_failed_step_error_message
    return workflow_run
