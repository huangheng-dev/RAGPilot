from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from ragpilot_api.application.agents.agent_run_service import AgentRunService


def build_agent_run(**overrides):
    now = datetime.now(timezone.utc)
    defaults = {
        "id": uuid4(),
        "tenant_id": uuid4(),
        "agent_definition_id": uuid4(),
        "workspace_id": uuid4(),
        "knowledge_base_id": uuid4(),
        "target_surface": "operations",
        "handoff_intent": "workflow_recovery",
        "run_status": "launched",
        "trigger_source": "operations",
        "launch_prompt": "Review failed workflow pressure.",
        "navigation_href": "/operations?lane=failed",
        "launched_by_user_id": uuid4(),
        "completed_at": None,
        "created_at": now,
        "updated_at": now,
    }
    return SimpleNamespace(**{**defaults, **overrides})


@pytest.mark.anyio
async def test_agent_run_service_forwards_filters_to_list_queries() -> None:
    tenant_id = uuid4()
    agent_definition_id = uuid4()
    repository = SimpleNamespace(
        list_agent_runs=AsyncMock(return_value=[]),
    )

    service = AgentRunService(SimpleNamespace(), repository)

    await service.list_agent_runs(
        tenant_id=tenant_id,
        agent_definition_id=agent_definition_id,
        target_surface="operations",
        trigger_source="operations",
        run_status="launched",
        limit=6,
    )

    repository.list_agent_runs.assert_awaited_once_with(
        tenant_id=tenant_id,
        agent_definition_id=agent_definition_id,
        target_surface="operations",
        trigger_source="operations",
        run_status="launched",
        limit=6,
    )


@pytest.mark.anyio
async def test_agent_run_service_builds_filtered_metrics() -> None:
    tenant_id = uuid4()
    latest_created_at = datetime.now(timezone.utc)
    repository = SimpleNamespace(
        list_agent_runs_for_metrics=AsyncMock(
            return_value=[
                build_agent_run(
                    target_surface="operations",
                    created_at=latest_created_at - timedelta(minutes=10),
                ),
                build_agent_run(
                    target_surface="operations",
                    created_at=latest_created_at,
                ),
            ]
        )
    )

    service = AgentRunService(SimpleNamespace(), repository)

    response = await service.get_agent_run_metrics(
        tenant_id=tenant_id,
        agent_definition_id=None,
        target_surface="operations",
        trigger_source="operations",
        run_status="launched",
    )

    repository.list_agent_runs_for_metrics.assert_awaited_once_with(
        tenant_id=tenant_id,
        agent_definition_id=None,
        target_surface="operations",
        trigger_source="operations",
        run_status="launched",
    )
    assert response.total_runs == 2
    assert response.operations_runs == 2
    assert response.chat_runs == 0
    assert response.latest_launched_at == latest_created_at
