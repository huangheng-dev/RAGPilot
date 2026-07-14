from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from ragpilot_api.application.agents.agent_execution_service import AgentExecutionService
from ragpilot_api.contracts.http.agent_execution_contracts import AgentApprovalDecisionRequest
from ragpilot_api.application.errors import ResourceNotFoundError


def build_service(*, approval, execution):
    approval_repository = SimpleNamespace(
        get=AsyncMock(return_value=approval),
        decide=AsyncMock(side_effect=lambda **kwargs: SimpleNamespace(
            **{**approval.__dict__, "approval_status": kwargs["status"],
               "decided_by_user_id": kwargs["actor_user_id"], "decision_reason": kwargs["reason"],
               "decided_at": datetime.now(timezone.utc)}
        )),
    )
    temporal = SimpleNamespace(signal_agent_approval=AsyncMock())
    service = AgentExecutionService(
        SimpleNamespace(),
        SimpleNamespace(get_agent_execution=AsyncMock(return_value=execution)),
        SimpleNamespace(), SimpleNamespace(), SimpleNamespace(), SimpleNamespace(), SimpleNamespace(),
        temporal_workflow_client=temporal,
        agent_approval_repository=approval_repository,
    )
    return service, approval_repository, temporal


@pytest.mark.anyio
async def test_agent_approval_decision_persists_actor_reason_and_signals_temporal() -> None:
    tenant_id, execution_id, approval_id, actor_id, tool_id, token = [uuid4() for _ in range(6)]
    now = datetime.now(timezone.utc)
    approval = SimpleNamespace(
        id=approval_id, tenant_id=tenant_id, agent_execution_id=execution_id,
        tool_registration_id=tool_id, approval_status="pending", requested_by_user_id=uuid4(),
        decided_by_user_id=None, decision_reason=None, resume_token=token,
        expires_at=now + timedelta(hours=1), decided_at=None, created_at=now, updated_at=now,
    )
    execution = SimpleNamespace(id=execution_id, execution_status="awaiting_approval", temporal_workflow_id="agent-1")
    service, repository, temporal = build_service(approval=approval, execution=execution)

    response = await service.decide_agent_approval(
        approval_request_id=approval_id,
        request=AgentApprovalDecisionRequest(
            tenant_id=tenant_id, decision="approved", reason="Approved for governed recovery.", resume_token=token,
        ),
        actor=SimpleNamespace(user_id=actor_id),
    )

    assert response.approval_status == "approved"
    repository.decide.assert_awaited_once_with(
        request=approval, status="approved", actor_user_id=actor_id,
        reason="Approved for governed recovery.",
    )
    temporal.signal_agent_approval.assert_awaited_once_with(
        temporal_workflow_id="agent-1", decision="approved", reason="Approved for governed recovery.",
    )


@pytest.mark.anyio
async def test_agent_approval_rejects_invalid_resume_token() -> None:
    tenant_id, execution_id, approval_id, actor_id, tool_id = [uuid4() for _ in range(5)]
    now = datetime.now(timezone.utc)
    approval = SimpleNamespace(
        id=approval_id, tenant_id=tenant_id, agent_execution_id=execution_id,
        tool_registration_id=tool_id, approval_status="pending", requested_by_user_id=None,
        decided_by_user_id=None, decision_reason=None, resume_token=uuid4(),
        expires_at=now + timedelta(hours=1), decided_at=None, created_at=now, updated_at=now,
    )
    service, repository, temporal = build_service(
        approval=approval,
        execution=SimpleNamespace(id=execution_id, execution_status="awaiting_approval", temporal_workflow_id="agent-1"),
    )
    with pytest.raises(RuntimeError, match="resume token"):
        await service.decide_agent_approval(
            approval_request_id=approval_id,
            request=AgentApprovalDecisionRequest(
                tenant_id=tenant_id, decision="approved", reason="Approved with wrong token.", resume_token=uuid4(),
            ),
            actor=SimpleNamespace(user_id=actor_id),
        )
    repository.decide.assert_not_awaited()
    temporal.signal_agent_approval.assert_not_awaited()


@pytest.mark.anyio
async def test_agent_approval_rejects_cross_tenant_lookup() -> None:
    tenant_id, actor_id = uuid4(), uuid4()
    service, repository, temporal = build_service(
        approval=SimpleNamespace(), execution=SimpleNamespace(),
    )
    repository.get.return_value = None
    with pytest.raises(ResourceNotFoundError):
        await service.decide_agent_approval(
            approval_request_id=uuid4(),
            request=AgentApprovalDecisionRequest(
                tenant_id=tenant_id, decision="approved", reason="Cross tenant attempt.", resume_token=uuid4(),
            ),
            actor=SimpleNamespace(user_id=actor_id),
        )
    repository.get.assert_awaited_once_with(approval_request_id=repository.get.await_args.kwargs["approval_request_id"], tenant_id=tenant_id)
    temporal.signal_agent_approval.assert_not_awaited()


@pytest.mark.anyio
async def test_late_agent_approval_is_marked_expired_without_signal() -> None:
    tenant_id, execution_id, approval_id, actor_id, tool_id, token = [uuid4() for _ in range(6)]
    now = datetime.now(timezone.utc)
    approval = SimpleNamespace(
        id=approval_id, tenant_id=tenant_id, agent_execution_id=execution_id,
        tool_registration_id=tool_id, approval_status="pending", requested_by_user_id=None,
        decided_by_user_id=None, decision_reason=None, resume_token=token,
        expires_at=now - timedelta(seconds=1), decided_at=None, created_at=now, updated_at=now,
    )
    service, repository, temporal = build_service(
        approval=approval,
        execution=SimpleNamespace(id=execution_id, execution_status="awaiting_approval", temporal_workflow_id="agent-1"),
    )
    with pytest.raises(RuntimeError, match="expired"):
        await service.decide_agent_approval(
            approval_request_id=approval_id,
            request=AgentApprovalDecisionRequest(
                tenant_id=tenant_id, decision="approved", reason="This decision arrived late.", resume_token=token,
            ),
            actor=SimpleNamespace(user_id=actor_id),
        )
    repository.decide.assert_awaited_once()
    assert repository.decide.await_args.kwargs["status"] == "expired"
    temporal.signal_agent_approval.assert_not_awaited()
