import inspect
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from ragpilot_api.application.agents.agent_runtime_engines import (
    LangGraphPilotAgentRuntimeEngine,
    NativeAgentRuntimeEngine,
    build_agent_runtime_engine,
    normalize_agent_runtime_engine_name,
)
from ragpilot_api.application.agents.agent_service import validate_agent_runtime_policy
from ragpilot_api.application.errors import ResourceConflictError


def test_build_agent_runtime_engine_returns_native_engine_by_default() -> None:
    settings = SimpleNamespace(agent_runtime_engine="native")

    engine = build_agent_runtime_engine(settings)

    assert isinstance(engine, NativeAgentRuntimeEngine)


def test_build_agent_runtime_engine_returns_langgraph_pilot_engine() -> None:
    settings = SimpleNamespace(agent_runtime_engine="langgraph_pilot")

    engine = build_agent_runtime_engine(settings)

    assert isinstance(engine, LangGraphPilotAgentRuntimeEngine)


def test_build_agent_runtime_engine_keeps_reserved_alias_compatible() -> None:
    settings = SimpleNamespace(agent_runtime_engine="langgraph_reserved")

    engine = build_agent_runtime_engine(settings)

    assert isinstance(engine, LangGraphPilotAgentRuntimeEngine)


def test_normalize_agent_runtime_engine_name_maps_reserved_alias_to_pilot() -> None:
    assert normalize_agent_runtime_engine_name("langgraph_reserved") == "langgraph_pilot"
    assert normalize_agent_runtime_engine_name(" native ") == "native"


def test_build_agent_runtime_engine_rejects_unknown_engine() -> None:
    settings = SimpleNamespace(agent_runtime_engine="unknown")

    with pytest.raises(ValueError, match="Unsupported agent runtime engine"):
        build_agent_runtime_engine(settings)


def test_active_langgraph_agent_requires_deployment_capability(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "ragpilot_api.application.agents.agent_service.build_runtime_readiness_snapshot",
        lambda: SimpleNamespace(langgraph_pilot_ready=False),
    )

    with pytest.raises(ResourceConflictError, match="deployment profile"):
        validate_agent_runtime_policy(
            mode="workflow_recovery",
            status="active",
            runtime_engine="langgraph_pilot",
            runtime_version="langgraph_v1",
        )

    validate_agent_runtime_policy(
        mode="workflow_recovery",
        status="draft",
        runtime_engine="langgraph_pilot",
        runtime_version="langgraph_v1",
    )


@pytest.mark.anyio
async def test_langgraph_pilot_agent_runtime_executes_bounded_workflow_recovery_graph(monkeypatch) -> None:
    class FakeCompiledGraph:
        def __init__(self, nodes, edges, start_node, end_node) -> None:
            self.nodes = nodes
            self.edges = edges
            self.start_node = start_node
            self.end_node = end_node

        async def ainvoke(self, initial_state):
            state = dict(initial_state)
            current_node = self.edges[self.start_node]
            while current_node is not None and current_node != self.end_node:
                node_handler = self.nodes[current_node]
                update = node_handler(state)
                if inspect.isawaitable(update):
                    update = await update
                if update:
                    state.update(update)
                current_node = self.edges.get(current_node)
            return state

    class FakeStateGraph:
        def __init__(self, _state_type) -> None:
            self.nodes = {}
            self.edges = {}

        def add_node(self, name, handler) -> None:
            self.nodes[name] = handler

        def add_edge(self, source, target) -> None:
            self.edges[source] = target

        def compile(self):
            return FakeCompiledGraph(self.nodes, self.edges, "__start__", "__end__")

    fake_graph_module = SimpleNamespace(
        StateGraph=FakeStateGraph,
        START="__start__",
        END="__end__",
    )

    monkeypatch.setattr(
        "ragpilot_api.application.agents.agent_runtime_engines.importlib.import_module",
        lambda module_name: fake_graph_module if module_name == "langgraph.graph" else None,
    )

    engine = LangGraphPilotAgentRuntimeEngine()
    service = SimpleNamespace(
        collect_workflow_recovery_context=AsyncMock(
            return_value=(
                {
                    "failed_runs": 2,
                    "queued_runs": 1,
                    "retry_runs": 3,
                },
                [
                    SimpleNamespace(
                        id="run-1",
                        workflow_type="document_ingestion",
                        workflow_status="failed",
                        subject_type="document",
                        subject_id="doc-1",
                        error_message="Failure one",
                    ),
                    SimpleNamespace(
                        id="run-2",
                        workflow_type="document_ingestion",
                        workflow_status="failed",
                        subject_type="document",
                        subject_id="doc-2",
                        error_message="Failure two",
                    ),
                ],
            )
        ),
        build_workflow_recovery_result_from_context=lambda **kwargs: (
            "Workflow recovery graph completed.",
            {
                "execution_lane": "workflow_recovery",
                "recommended_actions": ["Review failed queue."],
                **(kwargs.get("runtime_metadata") or {}),
            },
        ),
    )
    agent_definition = SimpleNamespace(
        agent_mode="workflow_recovery",
        name="Workflow Recovery Coordinator",
    )

    summary, payload = await engine.execute(
        service=service,
        agent_definition=agent_definition,
        resolved_scope=SimpleNamespace(),
        execution_input="Review workflow pressure.",
        runtime_binding=None,
        tool_runtime_summary=None,
    )

    assert summary == "Workflow recovery graph completed."
    assert payload["agent_runtime_engine"] == "langgraph_pilot"
    assert payload["agent_runtime_resolution"]["fallback_applied"] is False
    assert payload["agent_runtime_graph"]["engine"] == "langgraph_pilot"
    assert payload["agent_runtime_graph"]["workflow"] == "workflow_recovery"
    trace = payload["agent_runtime_graph"]["trace"]
    assert [entry["step"] for entry in trace] == [
        "collect_workflow_metrics",
        "classify_workflow_pressure",
        "compose_workflow_summary",
    ]
    assert payload["agent_runtime_graph"]["risk_level"] == "high"
    assert all(float(entry["duration_ms"]) >= 0 for entry in trace)


@pytest.mark.anyio
async def test_langgraph_pilot_agent_runtime_falls_back_to_native_for_other_modes(monkeypatch) -> None:
    engine = LangGraphPilotAgentRuntimeEngine()

    async def fake_native(**kwargs):
        return "Native fallback", {"execution_lane": "grounded_chat"}

    service = SimpleNamespace(
        build_native_execution_result=fake_native,
    )

    summary, payload = await engine.execute(
        service=service,
        agent_definition=SimpleNamespace(agent_mode="grounded_chat"),
        resolved_scope=SimpleNamespace(),
        execution_input="Question",
        runtime_binding=None,
        tool_runtime_summary=None,
    )

    assert summary == "Native fallback"
    assert payload["execution_lane"] == "grounded_chat"
    assert payload["agent_runtime_engine"] == "native"
    assert payload["agent_runtime_resolution"]["configured_engine"] == "langgraph_pilot"
    assert payload["agent_runtime_resolution"]["executed_engine"] == "native"
    assert payload["agent_runtime_resolution"]["fallback_applied"] is True


@pytest.mark.anyio
@pytest.mark.parametrize(
    ("metrics", "expected_branch"),
    [
        ({"failed_documents": 2, "active_documents": 3}, "recover_failed"),
        ({"failed_documents": 0, "active_documents": 3}, "review_processing"),
        ({"failed_documents": 0, "active_documents": 0}, "release_ready"),
    ],
)
async def test_langgraph_document_intake_uses_governed_branch(metrics, expected_branch) -> None:
    engine = LangGraphPilotAgentRuntimeEngine()
    service = SimpleNamespace(
        _build_document_intake_result=AsyncMock(return_value=(
            "Document intake graph completed.",
            {"execution_lane": "document_intake", "document_metrics": metrics},
        )),
    )

    summary, payload = await engine.execute(
        service=service,
        agent_definition=SimpleNamespace(agent_mode="document_intake"),
        resolved_scope=SimpleNamespace(knowledge_base_id="kb-1"),
        execution_input="Review document intake.",
        runtime_binding=None,
        tool_runtime_summary=None,
    )

    assert summary == "Document intake graph completed."
    assert payload["agent_runtime_engine"] == "langgraph_pilot"
    assert payload["agent_runtime_resolution"]["fallback_applied"] is False
    assert payload["agent_runtime_graph"]["workflow"] == "document_intake"
    assert payload["agent_runtime_graph"]["selected_branch"] == expected_branch
    assert payload["intake_decision"]["branch"] == expected_branch
    assert payload["intake_validation"]["status"] == "passed"
    assert len(payload["recommended_actions"]) == 2
    assert [entry["step"] for entry in payload["agent_runtime_graph"]["trace"]] == [
        "collect_document_context",
        "classify_intake_posture",
        expected_branch,
        "validate_intake_result",
        "compose_document_intake",
    ]
