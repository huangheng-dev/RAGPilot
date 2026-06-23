from uuid import UUID

from sqlalchemy import text

from ragpilot_api.application.errors import ResourceConflictError, ResourceNotFoundError
from ragpilot_api.contracts.http.workflow_contracts import (
    WorkflowRunActionResponse,
    WorkflowRunDetailResponse,
    WorkflowMetricsResponse,
    WorkflowRunResponse,
    WorkflowStepResponse,
)
from ragpilot_api.infrastructure.database.models import WorkflowRun, WorkflowStep
from ragpilot_api.infrastructure.database.repositories.document_repository import DocumentRepository
from ragpilot_api.infrastructure.database.repositories.workflow_repository import WorkflowRepository
from ragpilot_api.infrastructure.workflows.temporal_client import TemporalWorkflowClient


class WorkflowService:
    def __init__(
        self,
        workflow_repository: WorkflowRepository,
        document_repository: DocumentRepository | None = None,
        temporal_workflow_client: TemporalWorkflowClient | None = None,
    ) -> None:
        self.workflow_repository = workflow_repository
        self.document_repository = document_repository
        self.temporal_workflow_client = temporal_workflow_client

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
            await build_workflow_run_response(self.workflow_repository, workflow_run) for workflow_run in workflow_runs
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

        steps = await self.workflow_repository.list_workflow_steps(workflow_run_id=workflow_run.id)
        workflow_run_response = await build_workflow_run_response(self.workflow_repository, workflow_run)
        return WorkflowRunDetailResponse(
            **workflow_run_response.model_dump(),
            input_json=workflow_run.input_json,
            steps=[build_workflow_step_response(step) for step in steps],
        )

    async def retry_workflow_run(
        self,
        *,
        workflow_run_id: UUID,
        tenant_id: UUID,
    ) -> WorkflowRunActionResponse:
        workflow_run = await self.workflow_repository.get_workflow_run(
            workflow_run_id=workflow_run_id,
            tenant_id=tenant_id,
        )
        if workflow_run is None:
            raise ResourceNotFoundError("Workflow run not found.")
        if workflow_run.workflow_status != "failed":
            raise ResourceConflictError("Only failed workflow runs can be retried.")
        if workflow_run.workflow_type != "document_ingestion":
            raise ResourceConflictError("Retry is currently supported for document ingestion workflows only.")
        if workflow_run.subject_type != "document" or workflow_run.subject_id is None:
            raise ResourceConflictError("Workflow run is not attached to a retryable document subject.")
        if self.document_repository is None:
            raise ResourceConflictError("Workflow retry requires a document repository.")

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
            raise ResourceNotFoundError("Workflow document subject not found.")

        knowledge_base_id, deleted_at = document_state
        if deleted_at is not None:
            raise ResourceConflictError("Workflow retry is unavailable because the source document has been deleted.")

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
            raise ResourceConflictError("Workflow retry could not resolve the current source document version.")

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

        return WorkflowRunActionResponse(
            **(await build_workflow_run_response(self.workflow_repository, retry_workflow_run)).model_dump(),
            retry_of_workflow_run_id=workflow_run.id,
        )


async def build_workflow_run_response(
    workflow_repository: WorkflowRepository,
    workflow_run: WorkflowRun,
) -> WorkflowRunResponse:
    retry_state = await resolve_workflow_retry_state(workflow_repository, workflow_run)
    subject_context = await resolve_workflow_subject_context(workflow_repository, workflow_run)
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
        error_message=workflow_run.error_message,
        is_retry_available=retry_state["is_retry_available"],
        retry_unavailable_reason=retry_state["retry_unavailable_reason"],
        recovery_stage=recovery_guidance["recovery_stage"],
        recommended_next_view=recovery_guidance["recommended_next_view"],
        recommended_primary_action=recovery_guidance["recommended_primary_action"],
        follow_up_reason=recovery_guidance["follow_up_reason"],
        started_at=workflow_run.started_at,
        completed_at=workflow_run.completed_at,
        created_at=workflow_run.created_at,
        updated_at=workflow_run.updated_at,
    )


async def resolve_workflow_retry_state(
    workflow_repository: WorkflowRepository,
    workflow_run: WorkflowRun,
) -> dict[str, bool | str | None]:
    if workflow_run.workflow_status != "failed":
        return {
            "is_retry_available": False,
            "retry_unavailable_reason": None,
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

    if workflow_status == "failed":
        if bool(retry_state["is_retry_available"]):
            return {
                "recovery_stage": "retry_available",
                "recommended_next_view": "workflows",
                "recommended_primary_action": "retry_workflow",
                "follow_up_reason": "The failed workflow is eligible for retry from the operations lane.",
            }

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
            "follow_up_reason": "Keep monitoring execution progress before moving to downstream chat or document review.",
        }

    if workflow_status == "completed":
        return {
            "recovery_stage": "completed_ready_for_chat",
            "recommended_next_view": "chat",
            "recommended_primary_action": "open_chat",
            "follow_up_reason": "The workflow completed successfully and the scope is ready for grounded chat follow-up.",
        }

    return {
        "recovery_stage": "review_workflow",
        "recommended_next_view": "workflows",
        "recommended_primary_action": "open_workflows",
        "follow_up_reason": "Review the workflow timeline before taking the next operator action.",
    }


def build_workflow_step_response(workflow_step: WorkflowStep) -> WorkflowStepResponse:
    return WorkflowStepResponse(
        id=workflow_step.id,
        tenant_id=workflow_step.tenant_id,
        workflow_run_id=workflow_step.workflow_run_id,
        step_name=workflow_step.step_name,
        step_status=workflow_step.step_status,
        attempt_count=workflow_step.attempt_count,
        error_message=workflow_step.error_message,
        started_at=workflow_step.started_at,
        completed_at=workflow_step.completed_at,
        created_at=workflow_step.created_at,
        updated_at=workflow_step.updated_at,
    )
