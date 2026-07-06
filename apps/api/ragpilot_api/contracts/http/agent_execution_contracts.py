from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


AgentExecutionMode = Literal["grounded_chat", "document_intake", "workflow_recovery"]
AgentExecutionStatus = Literal["queued", "running", "completed", "failed", "cancelled"]
AgentExecutionTriggerSource = Literal["agents_console", "workspace", "home", "admin", "operations"]
AgentExecutionTaskStage = Literal[
    "queued_for_execution",
    "running_execution",
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
    created_at: datetime
    updated_at: datetime


class AgentExecutionMetricsResponse(BaseModel):
    total_executions: int
    queued_executions: int
    running_executions: int
    completed_executions: int
    failed_executions: int
    latest_execution_at: datetime | None
