from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


AgentRunTargetSurface = Literal["chat", "documents", "operations", "admin"]
AgentRunStatus = Literal["launched", "completed", "failed", "cancelled"]
AgentRunTriggerSource = Literal["agents_console", "workspace", "home", "admin", "operations"]


class AgentRunCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    tenant_id: UUID
    agent_definition_id: UUID
    workspace_id: UUID | None = None
    knowledge_base_id: UUID | None = None
    target_surface: AgentRunTargetSurface
    handoff_intent: str | None = Field(default=None, max_length=80)
    run_status: AgentRunStatus = "launched"
    trigger_source: AgentRunTriggerSource = "agents_console"
    launch_prompt: str | None = Field(default=None, max_length=12000)
    navigation_href: str | None = Field(default=None, max_length=2000)


class AgentRunResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    agent_definition_id: UUID
    workspace_id: UUID | None
    knowledge_base_id: UUID | None
    target_surface: AgentRunTargetSurface
    handoff_intent: str | None
    run_status: AgentRunStatus
    trigger_source: AgentRunTriggerSource
    launch_prompt: str | None
    prompt_version_id: UUID | None = None
    prompt_snapshot_hash: str | None = None
    navigation_href: str | None
    launched_by_user_id: UUID | None
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime


class AgentRunMetricsResponse(BaseModel):
    total_runs: int
    chat_runs: int
    document_runs: int
    operations_runs: int
    admin_runs: int
    latest_launched_at: datetime | None
