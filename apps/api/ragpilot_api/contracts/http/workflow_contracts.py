from datetime import datetime
from typing import Literal
from typing import Any
from uuid import UUID

from pydantic import BaseModel


WorkflowRecoveryStage = Literal[
    "retry_available",
    "retry_blocked_document_deleted",
    "retry_blocked_document_missing",
    "retry_blocked_unsupported",
    "active_monitoring",
    "completed_ready_for_chat",
    "review_workflow",
]
WorkflowRecommendedView = Literal["chat", "documents", "workflows"]
WorkflowRecommendedPrimaryAction = Literal[
    "retry_workflow",
    "open_workflows",
    "open_document",
    "open_chat",
    "monitor_workflow",
]


class WorkflowRunResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    workflow_type: str
    workflow_status: str
    retry_of_workflow_run_id: UUID | None = None
    temporal_workflow_id: str | None
    subject_type: str | None
    subject_id: UUID | None
    subject_label: str | None = None
    subject_workspace_id: UUID | None = None
    subject_knowledge_base_id: UUID | None = None
    error_message: str | None
    is_retry_available: bool = False
    retry_unavailable_reason: str | None = None
    recovery_stage: WorkflowRecoveryStage | None = None
    recommended_next_view: WorkflowRecommendedView | None = None
    recommended_primary_action: WorkflowRecommendedPrimaryAction | None = None
    follow_up_reason: str | None = None
    started_at: datetime | None
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime


class WorkflowMetricsResponse(BaseModel):
    total_runs: int
    active_runs: int
    queued_runs: int
    running_runs: int
    retry_runs: int
    completed_runs: int
    failed_runs: int


class WorkflowStepResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    workflow_run_id: UUID
    step_name: str
    step_status: str
    attempt_count: int
    error_message: str | None
    started_at: datetime | None
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime


class WorkflowRunDetailResponse(WorkflowRunResponse):
    input_json: dict[str, Any]
    steps: list[WorkflowStepResponse]


class WorkflowRunActionResponse(WorkflowRunResponse):
    retry_of_workflow_run_id: UUID | None = None
