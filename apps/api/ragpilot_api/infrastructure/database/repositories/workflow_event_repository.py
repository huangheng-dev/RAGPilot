from __future__ import annotations

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ragpilot_api.infrastructure.database.models import WorkflowRunEvent


class WorkflowEventRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create_workflow_run_event(
        self,
        *,
        tenant_id: UUID,
        workflow_run_id: UUID,
        actor_user_id: UUID | None,
        actor_role: str | None,
        action_type: str,
        detail_json: dict[str, object],
    ) -> WorkflowRunEvent:
        workflow_run_event = WorkflowRunEvent(
            tenant_id=tenant_id,
            workflow_run_id=workflow_run_id,
            actor_user_id=actor_user_id,
            actor_role=actor_role,
            action_type=action_type,
            detail_json=detail_json,
        )
        self.session.add(workflow_run_event)
        await self.session.commit()
        await self.session.refresh(workflow_run_event)
        return workflow_run_event

    async def list_workflow_run_events(
        self,
        *,
        workflow_run_id: UUID,
        action_type: str | None = None,
        actor_role: str | None = None,
        limit: int = 20,
    ) -> list[WorkflowRunEvent]:
        statement = select(WorkflowRunEvent).where(WorkflowRunEvent.workflow_run_id == workflow_run_id)
        if action_type is not None:
            statement = statement.where(WorkflowRunEvent.action_type == action_type)
        if actor_role is not None:
            statement = statement.where(WorkflowRunEvent.actor_role == actor_role)
        result = await self.session.scalars(statement.order_by(WorkflowRunEvent.created_at.desc()).limit(limit))
        return list(result)

    async def get_workflow_run_event_summary(
        self,
        *,
        workflow_run_id: UUID,
    ) -> dict[str, object]:
        row = (
            await self.session.execute(
                select(
                    func.count(WorkflowRunEvent.id).label("recovery_event_count"),
                    func.max(WorkflowRunEvent.created_at).label("latest_recovery_event_at"),
                ).where(WorkflowRunEvent.workflow_run_id == workflow_run_id)
            )
        ).one()
        return {
            "recovery_event_count": int(row.recovery_event_count or 0),
            "latest_recovery_event_at": row.latest_recovery_event_at,
        }
