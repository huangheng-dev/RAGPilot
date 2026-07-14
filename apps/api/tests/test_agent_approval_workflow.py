import os
from uuid import uuid4

import pytest
from temporalio import activity
from temporalio.client import Client
from temporalio.worker import Worker
from temporalio.worker import Replayer

from ragpilot_api.workflows.agent_execution import AgentExecutionWorkflow


activity_calls = 0
activity_mode = "approval"
temporal_test_address = os.getenv("TEMPORAL_TEST_ADDRESS", "localhost:7234")


@activity.defn(name="execute_agent_execution")
async def fake_execute_agent_execution(payload: dict) -> dict[str, str]:
    global activity_calls
    activity_calls += 1
    if activity_mode == "retry" and activity_calls == 1:
        raise RuntimeError("transient activity failure")
    if activity_mode == "retry":
        return {"agent_execution_id": payload["agent_execution_id"], "execution_status": "completed"}
    if activity_calls == 1:
        return {
            "agent_execution_id": payload["agent_execution_id"],
            "execution_status": "awaiting_approval",
            "approval_request_id": "approval-1",
            "tool_registration_id": "00000000-0000-0000-0000-000000000001",
            "approval_timeout_seconds": "1" if activity_mode == "timeout" else "3600",
        }
    assert payload["approved_tool_registration_ids"] == ["00000000-0000-0000-0000-000000000001"]
    return {"agent_execution_id": payload["agent_execution_id"], "execution_status": "completed"}


@activity.defn(name="finalize_agent_approval")
async def fake_finalize_agent_approval(payload: dict) -> dict[str, str]:
    return {
        "agent_execution_id": payload["agent_execution_id"],
        "execution_status": "failed",
        "decision": payload["decision"],
    }


@pytest.mark.anyio
async def test_agent_workflow_durably_waits_and_resumes_after_approval() -> None:
    global activity_calls
    global activity_mode
    activity_calls = 0
    activity_mode = "approval"
    client = await Client.connect(temporal_test_address)
    task_queue = f"agent-approval-{uuid4()}"
    async with Worker(
            client,
            task_queue=task_queue,
            workflows=[AgentExecutionWorkflow],
            activities=[fake_execute_agent_execution, fake_finalize_agent_approval],
        ):
            handle = await client.start_workflow(
                AgentExecutionWorkflow.run,
                {"agent_execution_id": "execution-1", "tenant_id": "tenant-1"},
                id=f"workflow-{uuid4()}",
                task_queue=task_queue,
            )
            await handle.signal(AgentExecutionWorkflow.decide_approval, {
                "decision": "approved", "reason": "Approved for the recovery drill.",
            })
            result = await handle.result()
            history = await handle.fetch_history()
            replay = await Replayer(workflows=[AgentExecutionWorkflow]).replay_workflow(history)
    assert result["execution_status"] == "completed"
    assert activity_calls == 2
    assert replay.replay_failure is None


@pytest.mark.anyio
async def test_agent_workflow_rejection_finishes_without_reinvoking_tool() -> None:
    global activity_calls
    global activity_mode
    activity_calls = 0
    activity_mode = "approval"
    client = await Client.connect(temporal_test_address)
    task_queue = f"agent-rejection-{uuid4()}"
    async with Worker(
            client,
            task_queue=task_queue,
            workflows=[AgentExecutionWorkflow],
            activities=[fake_execute_agent_execution, fake_finalize_agent_approval],
        ):
            handle = await client.start_workflow(
                AgentExecutionWorkflow.run,
                {"agent_execution_id": "execution-2", "tenant_id": "tenant-1"},
                id=f"workflow-{uuid4()}",
                task_queue=task_queue,
            )
            await handle.signal(AgentExecutionWorkflow.decide_approval, {
                "decision": "rejected", "reason": "Rejected by governance review.",
            })
            result = await handle.result()
    assert result["execution_status"] == "failed"
    assert result["decision"] == "rejected"
    assert activity_calls == 1


@pytest.mark.anyio
async def test_agent_workflow_first_decision_wins_when_signal_is_duplicated() -> None:
    global activity_calls, activity_mode
    activity_calls, activity_mode = 0, "approval"
    client = await Client.connect(temporal_test_address)
    task_queue = f"agent-duplicate-{uuid4()}"
    async with Worker(client, task_queue=task_queue, workflows=[AgentExecutionWorkflow],
                      activities=[fake_execute_agent_execution, fake_finalize_agent_approval]):
        handle = await client.start_workflow(
            AgentExecutionWorkflow.run,
            {"agent_execution_id": "execution-3", "tenant_id": "tenant-1"},
            id=f"workflow-{uuid4()}", task_queue=task_queue,
        )
        await handle.signal(AgentExecutionWorkflow.decide_approval, {"decision": "approved", "reason": "first"})
        await handle.signal(AgentExecutionWorkflow.decide_approval, {"decision": "rejected", "reason": "duplicate"})
        result = await handle.result()
    assert result["execution_status"] == "completed"
    assert activity_calls == 2


@pytest.mark.anyio
async def test_agent_workflow_approval_timeout_closes_wait() -> None:
    global activity_calls, activity_mode
    activity_calls, activity_mode = 0, "timeout"
    client = await Client.connect(temporal_test_address)
    task_queue = f"agent-timeout-{uuid4()}"
    async with Worker(client, task_queue=task_queue, workflows=[AgentExecutionWorkflow],
                      activities=[fake_execute_agent_execution, fake_finalize_agent_approval]):
        handle = await client.start_workflow(
            AgentExecutionWorkflow.run,
            {"agent_execution_id": "execution-4", "tenant_id": "tenant-1"},
            id=f"workflow-{uuid4()}", task_queue=task_queue,
        )
        result = await handle.result()
    assert result["execution_status"] == "failed"
    assert result["decision"] == "expired"


@pytest.mark.anyio
async def test_agent_workflow_retries_transient_activity_failure() -> None:
    global activity_calls, activity_mode
    activity_calls, activity_mode = 0, "retry"
    client = await Client.connect(temporal_test_address)
    task_queue = f"agent-retry-{uuid4()}"
    async with Worker(client, task_queue=task_queue, workflows=[AgentExecutionWorkflow],
                      activities=[fake_execute_agent_execution, fake_finalize_agent_approval]):
        handle = await client.start_workflow(
            AgentExecutionWorkflow.run,
            {"agent_execution_id": "execution-5", "tenant_id": "tenant-1"},
            id=f"workflow-{uuid4()}", task_queue=task_queue,
        )
        result = await handle.result()
    assert result["execution_status"] == "completed"
    assert activity_calls == 2
