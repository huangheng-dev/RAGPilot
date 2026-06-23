from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field


AgentExecutionMode = Literal["grounded_chat", "document_intake", "workflow_recovery"]
AgentExecutionStatus = Literal["queued", "running", "completed", "failed", "cancelled"]
AgentExecutionTriggerSource = Literal["agents_console", "workspace", "home", "admin", "operations"]


class AgentExecutionCreateRequest(BaseModel):
    tenant_id: UUID
    agent_definition_id: UUID
    execution_input: str | None = Field(default=None, max_length=4000)
    trigger_source: AgentExecutionTriggerSource = "agents_console"


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
