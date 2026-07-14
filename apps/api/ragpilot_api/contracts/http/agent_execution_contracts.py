from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


AgentExecutionMode = Literal["grounded_chat", "document_intake", "workflow_recovery"]
AgentExecutionStatus = Literal["queued", "running", "awaiting_approval", "completed", "failed", "cancelled"]
AgentExecutionTriggerSource = Literal["agents_console", "workspace", "home", "admin", "operations"]
AgentExecutionTaskStage = Literal[
    "queued_for_execution",
    "running_execution",
    "waiting_for_approval",
    "grounded_answer_ready",
    "intake_review_ready",
    "recovery_brief_ready",
    "execution_failed",
    "execution_completed",
]
AgentExecutionOutputKind = Literal[
    "answer_preview",
    "retrieval_evidence",
    "document_intake",
    "workflow_recovery",
    "tool_runtime",
]
AgentExecutionOutputStatus = Literal["ready", "attention", "pending"]
AgentApprovalStatus = Literal["pending", "approved", "rejected", "expired", "cancelled"]


class AgentExecutionCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    tenant_id: UUID
    agent_definition_id: UUID
    execution_input: str | None = Field(default=None, max_length=4000)
    trigger_source: AgentExecutionTriggerSource = "agents_console"


class AgentExecutionTaskStateResponse(BaseModel):
    lane: AgentExecutionMode
    stage_key: AgentExecutionTaskStage
    output_count: int = Field(default=0, ge=0)
    recommended_action_count: int = Field(default=0, ge=0)
    tool_trace_count: int = Field(default=0, ge=0)
    retrieval_result_count: int | None = Field(default=None, ge=0)
    fallback_applied: bool = False
    duration_seconds: int | None = Field(default=None, ge=0)


class AgentExecutionOutputResponse(BaseModel):
    output_key: str
    kind: AgentExecutionOutputKind
    status: AgentExecutionOutputStatus
    metric_value: str | None = None
    preview: str | None = None


class AgentExecutionResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    agent_definition_id: UUID
    workspace_id: UUID | None
    knowledge_base_id: UUID | None
    execution_mode: AgentExecutionMode
    execution_status: AgentExecutionStatus
    trigger_source: AgentExecutionTriggerSource
    knowledge_base_scope: str | None
    model_endpoint_id: UUID | None
    tool_registration_ids: list[UUID]
    execution_input: str | None
    summary: str | None
    result_payload_json: dict[str, Any]
    task_state: AgentExecutionTaskStateResponse | None = None
    generated_outputs: list[AgentExecutionOutputResponse] = Field(default_factory=list)
    error_message: str | None
    launched_by_user_id: UUID | None
    started_at: datetime | None
    completed_at: datetime | None
    temporal_workflow_id: str | None = None
    retry_of_execution_id: UUID | None = None
    cancellation_requested_at: datetime | None = None
    cancelled_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class AgentExecutionMetricsResponse(BaseModel):
    total_executions: int
    queued_executions: int
    running_executions: int
    awaiting_approval_executions: int = 0
    completed_executions: int
    failed_executions: int
    latest_execution_at: datetime | None


class AgentExecutionEvaluationResponse(BaseModel):
    sample_size: int = Field(ge=0)
    completion_rate: float = Field(ge=0, le=1)
    failure_rate: float = Field(ge=0, le=1)
    cancellation_rate: float = Field(ge=0, le=1)
    fallback_rate: float = Field(ge=0, le=1)
    approval_block_rate: float = Field(ge=0, le=1)
    promotion_ready: bool
    failed_gates: list[str] = Field(default_factory=list)


class AgentApprovalDecisionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    tenant_id: UUID
    decision: Literal["approved", "rejected"]
    reason: str = Field(min_length=3, max_length=1000)
    resume_token: UUID


class AgentApprovalResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    agent_execution_id: UUID
    tool_registration_id: UUID
    approval_status: AgentApprovalStatus
    requested_by_user_id: UUID | None
    decided_by_user_id: UUID | None
    decision_reason: str | None
    resume_token: UUID
    expires_at: datetime
    decided_at: datetime | None
    created_at: datetime
    updated_at: datetime
