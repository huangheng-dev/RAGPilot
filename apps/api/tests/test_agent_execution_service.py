from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from ragpilot_api.application.model_gateway.contracts import RuntimeModelBinding
from ragpilot_api.application.agents.agent_execution_service import AgentExecutionService
from ragpilot_api.contracts.http.agent_execution_contracts import AgentExecutionCreateRequest


def build_agent_execution(**overrides):
    now = datetime.now(timezone.utc)
    defaults = {
        "id": uuid4(),
        "tenant_id": uuid4(),
        "agent_definition_id": uuid4(),
        "workspace_id": uuid4(),
        "knowledge_base_id": uuid4(),
        "execution_mode": "workflow_recovery",
        "execution_status": "completed",
        "trigger_source": "agents_console",
        "knowledge_base_scope": None,
        "model_endpoint_id": None,
        "tool_registration_ids_json": [],
        "execution_input": "Review failed workflow pressure.",
        "summary": "Execution completed.",
        "result_payload_json": {"recommended_actions": ["Review failed runs."]},
        "error_message": None,
        "launched_by_user_id": uuid4(),
        "started_at": now,
        "completed_at": now,
        "created_at": now,
        "updated_at": now,
    }
    return SimpleNamespace(**{**defaults, **overrides})


def build_agent_definition(**overrides):
    now = datetime.now(timezone.utc)
    defaults = {
        "id": uuid4(),
        "tenant_id": uuid4(),
        "name": "Workflow Recovery Coordinator",
        "agent_name": "Workflow Recovery Coordinator",
        "agent_mode": "workflow_recovery",
        "execution_mode": "workflow_recovery",
        "agent_status": "active",
        "objective": "Track failed workflow runs.",
        "instructions": "Stay inside the current workflow scope.",
        "knowledge_base_scope": None,
        "model_endpoint_id": None,
        "tool_registration_ids_json": [],
        "created_at": now,
        "updated_at": now,
    }
    return SimpleNamespace(**{**defaults, **overrides})


@pytest.mark.anyio
async def test_agent_execution_service_builds_filtered_metrics() -> None:
    tenant_id = uuid4()
    latest_created_at = datetime.now(timezone.utc)
    repository = SimpleNamespace(
        list_agent_executions_for_metrics=AsyncMock(
            return_value=[
                build_agent_execution(
                    execution_status="failed",
                    created_at=latest_created_at - timedelta(minutes=5),
                ),
                build_agent_execution(
                    execution_status="completed",
                    created_at=latest_created_at,
                ),
            ]
        )
    )

    service = AgentExecutionService(
        SimpleNamespace(),
        repository,
        SimpleNamespace(),
        SimpleNamespace(),
        SimpleNamespace(),
        SimpleNamespace(),
        SimpleNamespace(),
    )

    response = await service.get_agent_execution_metrics(
        tenant_id=tenant_id,
        agent_definition_id=None,
        execution_mode="workflow_recovery",
        execution_status=None,
    )

    repository.list_agent_executions_for_metrics.assert_awaited_once_with(
        tenant_id=tenant_id,
        agent_definition_id=None,
        execution_mode="workflow_recovery",
        execution_status=None,
    )
    assert response.total_executions == 2
    assert response.completed_executions == 1
    assert response.failed_executions == 1
    assert response.latest_execution_at == latest_created_at


@pytest.mark.anyio
async def test_agent_execution_service_creates_completed_workflow_recovery_execution() -> None:
    tenant_id = uuid4()
    agent_definition_id = uuid4()
    actor_user_id = uuid4()
    created_execution = build_agent_execution(
        tenant_id=tenant_id,
        agent_definition_id=agent_definition_id,
        execution_status="queued",
        summary=None,
        completed_at=None,
        started_at=None,
    )
    running_execution = build_agent_execution(
        id=created_execution.id,
        tenant_id=tenant_id,
        agent_definition_id=agent_definition_id,
        execution_status="running",
        summary=None,
        completed_at=None,
    )
    completed_execution = build_agent_execution(
        id=created_execution.id,
        tenant_id=tenant_id,
        agent_definition_id=agent_definition_id,
        execution_status="completed",
        summary="Workflow recovery coordinator reviewed current pressure.",
    )

    agent_repository = SimpleNamespace(
        get_agent_definition=AsyncMock(
            return_value=SimpleNamespace(
                id=agent_definition_id,
                tenant_id=tenant_id,
                name="Workflow Recovery Coordinator",
                agent_mode="workflow_recovery",
                agent_status="active",
                objective="Track failed workflow runs.",
                knowledge_base_scope=None,
                model_endpoint_id=None,
                tool_registration_ids_json=[],
            )
        )
    )
    execution_repository = SimpleNamespace(
        create_agent_execution=AsyncMock(return_value=created_execution),
        mark_agent_execution_running=AsyncMock(return_value=running_execution),
        complete_agent_execution=AsyncMock(return_value=completed_execution),
        fail_agent_execution=AsyncMock(),
    )
    workflow_repository = SimpleNamespace(
        get_workflow_metrics=AsyncMock(
            return_value={
                "total_runs": 5,
                "active_runs": 1,
                "queued_runs": 1,
                "running_runs": 0,
                "retry_runs": 2,
                "completed_runs": 1,
                "failed_runs": 1,
            }
        ),
        list_workflow_runs=AsyncMock(return_value=([], 0)),
    )

    service = AgentExecutionService(
        agent_repository,
        execution_repository,
        SimpleNamespace(),
        SimpleNamespace(),
        SimpleNamespace(),
        SimpleNamespace(),
        workflow_repository,
        tool_runtime_service=SimpleNamespace(
            execute_bound_tools=AsyncMock(
                return_value=SimpleNamespace(
                    model_dump=lambda: {
                        "total_bound_tools": 1,
                        "completed_tools": 1,
                        "blocked_tools": 0,
                        "reserved_tools": 0,
                        "unavailable_tools": 0,
                        "failed_tools": 0,
                        "skipped_tools": 0,
                        "traces": [],
                    }
                )
            )
        ),
    )

    response = await service.create_agent_execution(
        AgentExecutionCreateRequest(
            tenant_id=tenant_id,
            agent_definition_id=agent_definition_id,
            execution_input="Review failed workflow pressure.",
            trigger_source="agents_console",
        ),
        actor=SimpleNamespace(user_id=actor_user_id),
    )

    execution_repository.complete_agent_execution.assert_awaited_once()
    complete_call = execution_repository.complete_agent_execution.await_args.kwargs
    execution_repository.fail_agent_execution.assert_not_called()
    assert response.execution_status == "completed"
    assert complete_call["summary"] == (
        "Workflow Recovery Coordinator reviewed workflow pressure with "
        "1 failed runs, 1 queued runs, and 2 retry-derived runs."
    )
    assert complete_call["result_payload_json"]["workflow_metrics"]["failed_runs"] == 1
    assert complete_call["result_payload_json"]["tool_runtime"]["completed_tools"] == 1
    assert complete_call["result_payload_json"]["recommended_action_specs"][0]["action_key"] == "triage_failed_workflows"


@pytest.mark.anyio
async def test_agent_execution_service_generates_grounded_chat_preview() -> None:
    tenant_id = uuid4()
    agent_definition_id = uuid4()
    workspace_id = uuid4()
    knowledge_base_id = uuid4()
    actor_user_id = uuid4()
    created_execution = build_agent_execution(
        tenant_id=tenant_id,
        agent_definition_id=agent_definition_id,
        execution_mode="grounded_chat",
        execution_status="queued",
        knowledge_base_scope="ragpilot-operations/ragpilot-handbook",
        summary=None,
        completed_at=None,
        started_at=None,
    )
    running_execution = build_agent_execution(
        id=created_execution.id,
        tenant_id=tenant_id,
        agent_definition_id=agent_definition_id,
        execution_mode="grounded_chat",
        execution_status="running",
        knowledge_base_scope="ragpilot-operations/ragpilot-handbook",
        summary=None,
        completed_at=None,
    )
    completed_execution = build_agent_execution(
        id=created_execution.id,
        tenant_id=tenant_id,
        agent_definition_id=agent_definition_id,
        execution_mode="grounded_chat",
        execution_status="completed",
        knowledge_base_scope="ragpilot-operations/ragpilot-handbook",
        summary="Grounded runtime preview completed.",
    )

    execution_repository = SimpleNamespace(
        create_agent_execution=AsyncMock(return_value=created_execution),
        mark_agent_execution_running=AsyncMock(return_value=running_execution),
        complete_agent_execution=AsyncMock(return_value=completed_execution),
        fail_agent_execution=AsyncMock(),
    )
    model_gateway = SimpleNamespace(
        generate_grounded_answer=AsyncMock(
            return_value=SimpleNamespace(
                content="Temporal powers ingestion workflows.",
                model_name="fallback-runtime-model",
                usage_json={"provider": "deterministic"},
            )
        )
    )
    configured_model_endpoint_id = uuid4()
    default_model_endpoint_id = uuid4()

    service = AgentExecutionService(
        agent_repository=SimpleNamespace(
            get_agent_definition=AsyncMock(
                return_value=SimpleNamespace(
                    id=agent_definition_id,
                    tenant_id=tenant_id,
                    name="Grounded Chat Operator",
                    agent_mode="grounded_chat",
                        agent_status="active",
                        objective="Answer grounded workflow questions.",
                        instructions="Use retrieved evidence only.",
                        knowledge_base_scope="ragpilot-operations/ragpilot-handbook",
                        model_endpoint_id=configured_model_endpoint_id,
                        tool_registration_ids_json=[],
                    )
                )
            ),
        agent_execution_repository=execution_repository,
        workspace_repository=SimpleNamespace(
            get_workspace_by_slug=AsyncMock(
                return_value=SimpleNamespace(id=workspace_id)
            )
        ),
        knowledge_base_repository=SimpleNamespace(
            get_knowledge_base_by_slug=AsyncMock(
                return_value=SimpleNamespace(id=knowledge_base_id)
            )
        ),
        conversation_repository=SimpleNamespace(
            get_conversation_metrics=AsyncMock(
                return_value={
                    "total_conversations": 4,
                    "active_conversations": 2,
                    "total_messages": 10,
                    "latest_activity_at": None,
                }
            )
        ),
        document_repository=SimpleNamespace(
            get_document_metrics=AsyncMock(
                return_value={
                    "total_documents": 3,
                    "active_documents": 0,
                    "completed_documents": 3,
                    "failed_documents": 0,
                    "draft_documents": 0,
                }
            )
        ),
        workflow_repository=SimpleNamespace(),
        retrieval_repository=SimpleNamespace(
            search_vector_document_chunks=AsyncMock(
                return_value=[
                    {
                        "document_chunk_id": uuid4(),
                        "document_id": uuid4(),
                        "document_version_id": uuid4(),
                        "knowledge_base_id": knowledge_base_id,
                        "document_title": "RagPilot Handbook",
                        "chunk_index": 0,
                        "content": "Temporal powers ingestion workflows.",
                        "score": 0.97,
                    }
                ]
            ),
            search_lexical_document_chunks=AsyncMock(return_value=[]),
        ),
        settings=SimpleNamespace(
            retrieval_embedding_dimension=8,
            retrieval_embedding_model="text-embedding-test",
            chat_model_provider="deterministic",
            chat_model_name="settings-model",
            chat_model_api_base_url=None,
            chat_model_api_key=None,
            chat_model_request_timeout_seconds=45,
        ),
        model_gateway=model_gateway,
        model_endpoint_repository=SimpleNamespace(
            get_model_endpoint=AsyncMock(
                return_value=SimpleNamespace(
                    id=configured_model_endpoint_id,
                    name="Agent Runtime",
                    provider_type="vllm",
                    model_name="broken-runtime-model",
                    base_url=None,
                    credential_mode="none",
                    credential_key_hint=None,
                    capabilities_json=["chat"],
                    is_enabled=True,
                )
            ),
            get_default_model_endpoint=AsyncMock(
                return_value=SimpleNamespace(
                    id=default_model_endpoint_id,
                    name="Default Runtime",
                    provider_type="deterministic",
                    model_name="fallback-runtime-model",
                    base_url=None,
                    credential_mode="none",
                    credential_key_hint=None,
                    capabilities_json=["chat"],
                    is_enabled=True,
                )
            )
        ),
    )

    await service.create_agent_execution(
        AgentExecutionCreateRequest(
            tenant_id=tenant_id,
            agent_definition_id=agent_definition_id,
            execution_input="Which system powers ingestion workflows?",
            trigger_source="agents_console",
        ),
        actor=SimpleNamespace(user_id=actor_user_id),
    )

    execution_repository.complete_agent_execution.assert_awaited_once()
    payload = execution_repository.complete_agent_execution.await_args.kwargs["result_payload_json"]
    assert payload["agent_runtime_engine"] == "native"
    assert payload["configured_agent_runtime_engine"] == "native"
    assert payload["agent_runtime_resolution"]["fallback_applied"] is True
    assert payload["agent_runtime_resolution"]["fallback_reason"] == "model_endpoint_not_runtime_ready:default_model_endpoint"
    assert payload["agent_runtime_resolution"]["configured_model_endpoint_id"] == str(configured_model_endpoint_id)
    assert payload["agent_runtime_resolution"]["configured_model_endpoint_name"] == "Agent Runtime"
    assert payload["retrieval_engine"] == "native"
    assert payload["runtime_binding"]["model_name"] == "fallback-runtime-model"
    assert payload["runtime_binding"]["model_endpoint_id"] == str(default_model_endpoint_id)
    assert payload["answer_preview"] == "Temporal powers ingestion workflows."
    assert payload["retrieval_result_count"] == 1
    assert payload["recommended_action_specs"][0]["action_key"] == "review_model_runtime"
    assert payload["recommended_action_specs"][0]["model_endpoint_id"] == str(configured_model_endpoint_id)
    assert payload["recommended_action_specs"][1]["action_key"] == "resume_grounded_chat"
    model_gateway.generate_grounded_answer.assert_awaited_once()


@pytest.mark.anyio
async def test_agent_execution_service_adds_tool_governance_follow_up_when_execution_hits_approval_boundary() -> None:
    tenant_id = uuid4()
    agent_definition_id = uuid4()
    actor_user_id = uuid4()
    tool_registration_id = uuid4()
    created_execution = build_agent_execution(
        tenant_id=tenant_id,
        agent_definition_id=agent_definition_id,
        execution_status="queued",
        summary=None,
        completed_at=None,
        started_at=None,
    )
    running_execution = build_agent_execution(
        id=created_execution.id,
        tenant_id=tenant_id,
        agent_definition_id=agent_definition_id,
        execution_status="running",
        summary=None,
        completed_at=None,
    )
    completed_execution = build_agent_execution(
        id=created_execution.id,
        tenant_id=tenant_id,
        agent_definition_id=agent_definition_id,
        execution_status="completed",
        summary="Workflow recovery coordinator reviewed current pressure.",
    )

    service = AgentExecutionService(
        agent_repository=SimpleNamespace(
            get_agent_definition=AsyncMock(
                return_value=SimpleNamespace(
                    id=agent_definition_id,
                    tenant_id=tenant_id,
                    name="Workflow Recovery Coordinator",
                    agent_mode="workflow_recovery",
                    agent_status="active",
                    objective="Track failed workflow runs.",
                    instructions="Stay inside the current workflow scope.",
                    knowledge_base_scope=None,
                    model_endpoint_id=None,
                    tool_registration_ids_json=[str(tool_registration_id)],
                )
            )
        ),
        agent_execution_repository=SimpleNamespace(
            create_agent_execution=AsyncMock(return_value=created_execution),
            mark_agent_execution_running=AsyncMock(return_value=running_execution),
            complete_agent_execution=AsyncMock(return_value=completed_execution),
            fail_agent_execution=AsyncMock(),
        ),
        workspace_repository=SimpleNamespace(),
        knowledge_base_repository=SimpleNamespace(),
        conversation_repository=SimpleNamespace(),
        document_repository=SimpleNamespace(),
        workflow_repository=SimpleNamespace(
            get_workflow_metrics=AsyncMock(
                return_value={
                    "total_runs": 5,
                    "active_runs": 0,
                    "queued_runs": 1,
                    "running_runs": 0,
                    "retry_runs": 1,
                    "completed_runs": 2,
                    "failed_runs": 1,
                }
            ),
            list_workflow_runs=AsyncMock(return_value=([], 0)),
        ),
        tool_runtime_service=SimpleNamespace(
            execute_bound_tools=AsyncMock(
                return_value=SimpleNamespace(
                    model_dump=lambda: {
                        "total_bound_tools": 1,
                        "completed_tools": 0,
                        "blocked_tools": 1,
                        "reserved_tools": 0,
                        "unavailable_tools": 0,
                        "failed_tools": 0,
                        "skipped_tools": 0,
                        "traces": [
                            {
                                "tool_registration_id": str(tool_registration_id),
                                "invocation_status": "blocked",
                                "governance_issue": "approval_required",
                            }
                        ],
                    }
                )
            )
        ),
    )

    await service.create_agent_execution(
        AgentExecutionCreateRequest(
            tenant_id=tenant_id,
            agent_definition_id=agent_definition_id,
            execution_input="Review failed workflow pressure.",
            trigger_source="agents_console",
        ),
        actor=SimpleNamespace(user_id=actor_user_id, role="operator"),
    )

    payload = service.agent_execution_repository.complete_agent_execution.await_args.kwargs["result_payload_json"]
    assert payload["recommended_action_specs"][0]["action_key"] == "review_tool_approval"
    assert payload["recommended_action_specs"][0]["tool_registration_id"] == str(tool_registration_id)
    assert payload["recommended_action_specs"][1]["action_key"] == "triage_failed_workflows"


@pytest.mark.anyio
async def test_agent_execution_service_adds_mcp_connector_follow_up_when_execution_hits_integration_pending() -> None:
    tenant_id = uuid4()
    agent_definition_id = uuid4()
    actor_user_id = uuid4()
    tool_registration_id = uuid4()
    created_execution = build_agent_execution(
        tenant_id=tenant_id,
        agent_definition_id=agent_definition_id,
        execution_status="queued",
        summary=None,
        completed_at=None,
        started_at=None,
    )
    running_execution = build_agent_execution(
        id=created_execution.id,
        tenant_id=tenant_id,
        agent_definition_id=agent_definition_id,
        execution_status="running",
        summary=None,
        completed_at=None,
    )
    completed_execution = build_agent_execution(
        id=created_execution.id,
        tenant_id=tenant_id,
        agent_definition_id=agent_definition_id,
        execution_status="completed",
        summary="Workflow recovery coordinator reviewed current pressure.",
    )

    service = AgentExecutionService(
        agent_repository=SimpleNamespace(
            get_agent_definition=AsyncMock(
                return_value=build_agent_definition(
                    id=agent_definition_id,
                    tenant_id=tenant_id,
                    agent_name="Workflow Recovery Coordinator",
                    execution_mode="workflow_recovery",
                    agent_status="active",
                    objective="Track failed workflow runs.",
                    instructions="Stay inside the current workflow scope.",
                    knowledge_base_scope=None,
                    model_endpoint_id=None,
                    tool_registration_ids_json=[str(tool_registration_id)],
                )
            )
        ),
        agent_execution_repository=SimpleNamespace(
            create_agent_execution=AsyncMock(return_value=created_execution),
            mark_agent_execution_running=AsyncMock(return_value=running_execution),
            complete_agent_execution=AsyncMock(return_value=completed_execution),
            fail_agent_execution=AsyncMock(),
        ),
        workspace_repository=SimpleNamespace(),
        knowledge_base_repository=SimpleNamespace(),
        conversation_repository=SimpleNamespace(),
        document_repository=SimpleNamespace(),
        workflow_repository=SimpleNamespace(
            get_workflow_metrics=AsyncMock(
                return_value={
                    "total_runs": 5,
                    "active_runs": 0,
                    "queued_runs": 1,
                    "running_runs": 0,
                    "retry_runs": 1,
                    "completed_runs": 2,
                    "failed_runs": 1,
                }
            ),
            list_workflow_runs=AsyncMock(return_value=([], 0)),
        ),
        tool_runtime_service=SimpleNamespace(
            execute_bound_tools=AsyncMock(
                return_value=SimpleNamespace(
                    model_dump=lambda: {
                        "total_bound_tools": 1,
                        "completed_tools": 0,
                        "blocked_tools": 1,
                        "reserved_tools": 0,
                        "unavailable_tools": 0,
                        "failed_tools": 0,
                        "skipped_tools": 0,
                        "traces": [
                            {
                                "tool_registration_id": str(tool_registration_id),
                                "invocation_status": "blocked",
                                "governance_issue": "mcp_integration_pending",
                                "response_metadata": {
                                    "connector_reference": "mcp-browser-primary",
                                },
                            }
                        ],
                    }
                )
            )
        ),
    )

    await service.create_agent_execution(
        AgentExecutionCreateRequest(
            tenant_id=tenant_id,
            agent_definition_id=agent_definition_id,
            execution_input="Review MCP runtime posture.",
            trigger_source="agents_console",
        ),
        actor=SimpleNamespace(user_id=actor_user_id, role="operator"),
    )

    payload = service.agent_execution_repository.complete_agent_execution.await_args.kwargs["result_payload_json"]
    assert payload["recommended_action_specs"][0]["action_key"] == "review_mcp_connector_integration"
    assert payload["recommended_action_specs"][0]["tool_registration_id"] == str(tool_registration_id)
    assert payload["recommended_action_specs"][0]["mcp_connector_slug"] == "mcp-browser-primary"
    assert payload["recommended_action_specs"][1]["action_key"] == "triage_failed_workflows"


@pytest.mark.anyio
async def test_agent_execution_service_marks_langgraph_grounded_chat_as_native_fallback() -> None:
    tenant_id = uuid4()
    agent_definition_id = uuid4()
    workspace_id = uuid4()
    knowledge_base_id = uuid4()
    actor_user_id = uuid4()
    created_execution = build_agent_execution(
        tenant_id=tenant_id,
        agent_definition_id=agent_definition_id,
        execution_mode="grounded_chat",
        execution_status="queued",
        knowledge_base_scope="ragpilot-operations/ragpilot-handbook",
        summary=None,
        completed_at=None,
        started_at=None,
    )
    running_execution = build_agent_execution(
        id=created_execution.id,
        tenant_id=tenant_id,
        agent_definition_id=agent_definition_id,
        execution_mode="grounded_chat",
        execution_status="running",
        knowledge_base_scope="ragpilot-operations/ragpilot-handbook",
        summary=None,
        completed_at=None,
    )
    completed_execution = build_agent_execution(
        id=created_execution.id,
        tenant_id=tenant_id,
        agent_definition_id=agent_definition_id,
        execution_mode="grounded_chat",
        execution_status="completed",
        knowledge_base_scope="ragpilot-operations/ragpilot-handbook",
        summary="Grounded runtime preview completed.",
    )

    execution_repository = SimpleNamespace(
        create_agent_execution=AsyncMock(return_value=created_execution),
        mark_agent_execution_running=AsyncMock(return_value=running_execution),
        complete_agent_execution=AsyncMock(return_value=completed_execution),
        fail_agent_execution=AsyncMock(),
    )
    model_gateway = SimpleNamespace(
        generate_grounded_answer=AsyncMock(
            return_value=SimpleNamespace(
                content="Temporal powers ingestion workflows.",
                model_name="agent-runtime-model",
                usage_json={"provider": "deterministic"},
            )
        )
    )

    service = AgentExecutionService(
        agent_repository=SimpleNamespace(
            get_agent_definition=AsyncMock(
                return_value=SimpleNamespace(
                    id=agent_definition_id,
                    tenant_id=tenant_id,
                    name="Grounded Chat Operator",
                    agent_mode="grounded_chat",
                    agent_status="active",
                    objective="Answer grounded workflow questions.",
                    instructions="Use retrieved evidence only.",
                    knowledge_base_scope="ragpilot-operations/ragpilot-handbook",
                    model_endpoint_id=None,
                    tool_registration_ids_json=[],
                )
            )
        ),
        agent_execution_repository=execution_repository,
        workspace_repository=SimpleNamespace(
            get_workspace_by_slug=AsyncMock(return_value=SimpleNamespace(id=workspace_id))
        ),
        knowledge_base_repository=SimpleNamespace(
            get_knowledge_base_by_slug=AsyncMock(return_value=SimpleNamespace(id=knowledge_base_id))
        ),
        conversation_repository=SimpleNamespace(
            get_conversation_metrics=AsyncMock(
                return_value={
                    "total_conversations": 4,
                    "active_conversations": 2,
                    "total_messages": 10,
                    "latest_activity_at": None,
                }
            )
        ),
        document_repository=SimpleNamespace(
            get_document_metrics=AsyncMock(
                return_value={
                    "total_documents": 3,
                    "active_documents": 0,
                    "completed_documents": 3,
                    "failed_documents": 0,
                    "draft_documents": 0,
                }
            )
        ),
        workflow_repository=SimpleNamespace(),
        retrieval_repository=SimpleNamespace(
            search_vector_document_chunks=AsyncMock(
                return_value=[
                    {
                        "document_chunk_id": uuid4(),
                        "document_id": uuid4(),
                        "document_version_id": uuid4(),
                        "knowledge_base_id": knowledge_base_id,
                        "document_title": "RagPilot Handbook",
                        "chunk_index": 0,
                        "content": "Temporal powers ingestion workflows.",
                        "score": 0.97,
                    }
                ]
            ),
            search_lexical_document_chunks=AsyncMock(return_value=[]),
        ),
        settings=SimpleNamespace(
            agent_runtime_engine="langgraph_pilot",
            retrieval_embedding_dimension=8,
            retrieval_embedding_model="text-embedding-test",
            retrieval_engine="native",
            chat_model_provider="deterministic",
            chat_model_name="settings-model",
            chat_model_api_base_url=None,
            chat_model_api_key=None,
            chat_model_request_timeout_seconds=45,
        ),
        model_gateway=model_gateway,
    )

    await service.create_agent_execution(
        AgentExecutionCreateRequest(
            tenant_id=tenant_id,
            agent_definition_id=agent_definition_id,
            execution_input="Which system powers ingestion workflows?",
            trigger_source="agents_console",
        ),
        actor=SimpleNamespace(user_id=actor_user_id),
    )

    payload = execution_repository.complete_agent_execution.await_args.kwargs["result_payload_json"]
    assert payload["agent_runtime_engine"] == "native"
    assert payload["configured_agent_runtime_engine"] == "langgraph_pilot"
    assert payload["agent_runtime_resolution"]["fallback_applied"] is True
    assert "workflow_recovery" in payload["agent_runtime_resolution"]["fallback_reason"]


@pytest.mark.anyio
async def test_agent_execution_service_uses_configured_agent_runtime_engine_boundary(monkeypatch) -> None:
    tenant_id = uuid4()
    agent_definition_id = uuid4()
    actor_user_id = uuid4()
    created_execution = build_agent_execution(
        tenant_id=tenant_id,
        agent_definition_id=agent_definition_id,
        execution_status="queued",
        summary=None,
        completed_at=None,
        started_at=None,
    )
    running_execution = build_agent_execution(
        id=created_execution.id,
        tenant_id=tenant_id,
        agent_definition_id=agent_definition_id,
        execution_status="running",
        summary=None,
        completed_at=None,
    )
    completed_execution = build_agent_execution(
        id=created_execution.id,
        tenant_id=tenant_id,
        agent_definition_id=agent_definition_id,
        execution_status="completed",
        summary="Graph runtime completed.",
    )

    class FakeAgentRuntimeEngine:
        async def execute(
            self,
            *,
            service,
            agent_definition,
            resolved_scope,
            execution_input,
            runtime_binding,
            tool_runtime_summary,
        ):
            assert service.agent_runtime_engine_name == "langgraph_pilot"
            assert execution_input == "Review workflow pressure."
            return "Graph runtime completed.", {
                "execution_lane": "workflow_recovery",
                "recommended_actions": ["Keep the graph pilot scoped."],
            }

    monkeypatch.setattr(
        "ragpilot_api.application.agents.agent_execution_service.build_agent_runtime_engine",
        lambda settings, engine_name=None: FakeAgentRuntimeEngine(),
    )

    service = AgentExecutionService(
        agent_repository=SimpleNamespace(
            get_agent_definition=AsyncMock(
                return_value=SimpleNamespace(
                    id=agent_definition_id,
                    tenant_id=tenant_id,
                    name="Workflow Recovery Coordinator",
                    agent_mode="workflow_recovery",
                    agent_status="active",
                    objective="Track failed workflow runs.",
                    instructions="Stay inside current workflow scope.",
                    knowledge_base_scope=None,
                    model_endpoint_id=None,
                    tool_registration_ids_json=[],
                )
            )
        ),
        agent_execution_repository=SimpleNamespace(
            create_agent_execution=AsyncMock(return_value=created_execution),
            mark_agent_execution_running=AsyncMock(return_value=running_execution),
            complete_agent_execution=AsyncMock(return_value=completed_execution),
            fail_agent_execution=AsyncMock(),
        ),
        workspace_repository=SimpleNamespace(),
        knowledge_base_repository=SimpleNamespace(),
        conversation_repository=SimpleNamespace(),
        document_repository=SimpleNamespace(),
        workflow_repository=SimpleNamespace(),
        settings=SimpleNamespace(
            agent_runtime_engine="langgraph_reserved",
        ),
        model_gateway=SimpleNamespace(),
    )

    response = await service.create_agent_execution(
        AgentExecutionCreateRequest(
            tenant_id=tenant_id,
            agent_definition_id=agent_definition_id,
            execution_input="Review workflow pressure.",
            trigger_source="agents_console",
        ),
        actor=SimpleNamespace(user_id=actor_user_id),
    )

    assert response.execution_status == "completed"
    payload = (
        service.agent_execution_repository.complete_agent_execution.await_args.kwargs["result_payload_json"]
    )
    assert payload["agent_runtime_engine"] == "langgraph_pilot"
    assert payload["configured_agent_runtime_engine"] == "langgraph_pilot"
    assert payload["agent_runtime_resolution"]["fallback_applied"] is False
    assert payload["execution_lane"] == "workflow_recovery"
    assert payload["recommended_action_specs"][0]["action_key"] == "triage_failed_workflows"
