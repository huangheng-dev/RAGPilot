from datetime import datetime
from typing import Literal
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


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
WorkflowRunEventActionType = Literal[
    "retry_requested",
    "retry_blocked",
    "retry_spawned",
    "cancel_requested",
    "operator_notes_updated",
]
WorkflowFailureCategory = Literal[
    "source_deleted",
    "source_missing",
    "parser_failure",
    "embedding_failure",
    "indexing_failure",
    "runtime_timeout",
    "runtime_capacity",
    "unknown",
]
WorkflowFailureAction = Literal[
    "review_document_source",
    "review_parser_path",
    "review_runtime",
    "review_indexing",
    "retry_when_ready",
    "inspect_workflow",
]


class WorkflowRecoveryActionResponse(BaseModel):
    action_key: WorkflowFailureAction
    target_view: WorkflowRecommendedView | None = None
    target_primary_action: WorkflowRecommendedPrimaryAction | None = None
    is_primary: bool = False
    is_enabled: bool = True
    disabled_reason: str | None = None


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
    root_workflow_run_id: UUID | None = None
    latest_child_retry_run_id: UUID | None = None
    latest_child_retry_status: str | None = None
    active_child_retry_run_id: UUID | None = None
    has_active_retry_child: bool = False
    retry_depth: int = 0
    child_retry_run_count: int = 0
    max_retry_depth: int = 0
    remaining_retry_attempts: int = 0
    error_message: str | None
    operator_notes: str | None = None
    is_retry_available: bool = False
    retry_unavailable_reason: str | None = None
    total_step_count: int = 0
    completed_step_count: int = 0
    failed_step_count: int = 0
    active_step_count: int = 0
    pending_step_count: int = 0
    latest_active_step_name: str | None = None
    latest_active_step_started_at: datetime | None = None
    latest_completed_step_name: str | None = None
    latest_completed_step_completed_at: datetime | None = None
    highest_attempt_step_name: str | None = None
    highest_attempt_count: int = 0
    latest_failed_step_name: str | None = None
    latest_failed_step_error_message: str | None = None
    failure_category: WorkflowFailureCategory | None = None
    failure_recommended_action: WorkflowFailureAction | None = None
    failure_recommended_view: WorkflowRecommendedView | None = None
    failure_recommended_primary_action: WorkflowRecommendedPrimaryAction | None = None
    failure_focus_step_name: str | None = None
    failure_focus_error_message: str | None = None
    failure_focus_attempt_count: int = 0
    recovery_actions: list[WorkflowRecoveryActionResponse] = Field(default_factory=list)
    recovery_event_count: int = 0
    latest_recovery_event_at: datetime | None = None
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
    cancelled_runs: int


class WorkflowStepResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    workflow_run_id: UUID
    step_name: str
    step_status: str
    attempt_count: int
    error_message: str | None
    failure_category: WorkflowFailureCategory | None = None
    failure_recommended_action: WorkflowFailureAction | None = None
    failure_recommended_view: WorkflowRecommendedView | None = None
    failure_recommended_primary_action: WorkflowRecommendedPrimaryAction | None = None
    recovery_actions: list[WorkflowRecoveryActionResponse] = Field(default_factory=list)
    is_failure_focus: bool = False
    started_at: datetime | None
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime


class WorkflowRunEventResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    workflow_run_id: UUID
    actor_user_id: UUID | None
    actor_role: str | None
    action_type: WorkflowRunEventActionType
    detail: dict[str, Any] = Field(default_factory=dict, validation_alias="detail_json")
    created_at: datetime

    model_config = {
        "from_attributes": True,
        "populate_by_name": True,
    }


class WorkflowRunRecoverySummaryResponse(BaseModel):
    root_workflow_run_id: UUID | None = None
    latest_child_retry_run_id: UUID | None = None
    latest_child_retry_status: str | None = None
    active_child_retry_run_id: UUID | None = None
    has_active_retry_child: bool = False
    retry_depth: int = 0
    child_retry_run_count: int = 0
    max_retry_depth: int = 0
    remaining_retry_attempts: int = 0
    total_step_count: int = 0
    completed_step_count: int = 0
    failed_step_count: int = 0
    active_step_count: int = 0
    pending_step_count: int = 0
    latest_active_step_name: str | None = None
    latest_active_step_started_at: datetime | None = None
    latest_completed_step_name: str | None = None
    latest_completed_step_completed_at: datetime | None = None
    highest_attempt_step_name: str | None = None
    highest_attempt_count: int = 0
    latest_failed_step_name: str | None = None
    latest_failed_step_error_message: str | None = None
    failure_category: WorkflowFailureCategory | None = None
    failure_recommended_action: WorkflowFailureAction | None = None
    failure_focus_step_name: str | None = None
    failure_focus_error_message: str | None = None
    failure_focus_attempt_count: int = 0
    recovery_event_count: int = 0
    latest_recovery_event_at: datetime | None = None


class WorkflowRunDetailResponse(WorkflowRunResponse):
    input_json: dict[str, Any]
    steps: list[WorkflowStepResponse]
    events: list[WorkflowRunEventResponse]


class WorkflowRunActionResponse(WorkflowRunResponse):
    retry_of_workflow_run_id: UUID | None = None


class WorkflowRunNotesUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    operator_notes: str | None = Field(default=None, max_length=4000)
