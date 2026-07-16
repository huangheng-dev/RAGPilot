from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ragpilot_api.infrastructure.database.models import AgentApprovalRequest


class AgentApprovalRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create_request(self, *, tenant_id: UUID, agent_execution_id: UUID, tool_registration_id: UUID,
                             requested_by_user_id: UUID | None, expires_at: datetime) -> AgentApprovalRequest:
        request = AgentApprovalRequest(
            tenant_id=tenant_id, agent_execution_id=agent_execution_id,
            tool_registration_id=tool_registration_id, requested_by_user_id=requested_by_user_id,
            expires_at=expires_at,
        )
        self.session.add(request)
        await self.session.commit()
        await self.session.refresh(request)
        return request

    async def get(self, *, approval_request_id: UUID, tenant_id: UUID) -> AgentApprovalRequest | None:
        return await self.session.scalar(select(AgentApprovalRequest).where(
            AgentApprovalRequest.id == approval_request_id, AgentApprovalRequest.tenant_id == tenant_id,
        ))

    async def list_for_execution(self, *, agent_execution_id: UUID, tenant_id: UUID) -> list[AgentApprovalRequest]:
        rows = await self.session.scalars(select(AgentApprovalRequest).where(
            AgentApprovalRequest.agent_execution_id == agent_execution_id,
            AgentApprovalRequest.tenant_id == tenant_id,
        ).order_by(AgentApprovalRequest.created_at))
        return list(rows)

    async def decide(self, *, request: AgentApprovalRequest, status: str, actor_user_id: UUID | None,
                     reason: str) -> AgentApprovalRequest:
        now = datetime.now(timezone.utc)
        if request.approval_status != "pending":
            return request
        request.approval_status = status
        request.decided_by_user_id = actor_user_id
        request.decision_reason = reason
        request.decided_at = now
        request.updated_at = now
        await self.session.commit()
        await self.session.refresh(request)
        return request
