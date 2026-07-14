from __future__ import annotations

import importlib
import inspect
from dataclasses import dataclass
from typing import Any, Protocol, TYPE_CHECKING


if TYPE_CHECKING:
    from ragpilot_api.application.agents.agent_execution_service import (
        AgentExecutionService,
        ResolvedAgentScope,
    )
    from ragpilot_api.infrastructure.database.models import AgentDefinition


class AgentRuntimeEngine(Protocol):
    async def execute(
        self,
        *,
        service: AgentExecutionService,
        agent_definition: AgentDefinition,
        resolved_scope: ResolvedAgentScope,
        execution_input: str | None,
        runtime_binding: Any,
        tool_runtime_summary: Any,
    ) -> tuple[str, dict[str, Any]]: ...


@dataclass(frozen=True)
class LangGraphRuntime:
    state_graph_cls: Any
    start_node: Any


@dataclass(frozen=True)
class NativeAgentRuntimeEngine:
    async def execute(
        self,
        *,
        service: AgentExecutionService,
        agent_definition: AgentDefinition,
        resolved_scope: ResolvedAgentScope,
        execution_input: str | None,
        runtime_binding: Any,
        tool_runtime_summary: Any,
    ) -> tuple[str, dict[str, Any]]:
        summary, result_payload_json = await service.build_native_execution_result(
            agent_definition=agent_definition,
            resolved_scope=resolved_scope,
            execution_input=execution_input,
            runtime_binding=runtime_binding,
            tool_runtime_summary=tool_runtime_summary,
        )
        return summary, {
            **result_payload_json,
            "agent_runtime_engine": "native",
            "agent_runtime_resolution": {
                "configured_engine": "native",
                "executed_engine": "native",
                "fallback_applied": False,
                "fallback_reason": None,
            },
        }


@dataclass(frozen=True)
class LangGraphPilotAgentRuntimeEngine:
    async def execute(
        self,
        *,
        service: AgentExecutionService,
        agent_definition: AgentDefinition,
        resolved_scope: ResolvedAgentScope,
        execution_input: str | None,
        runtime_binding: Any,
        tool_runtime_summary: Any,
    ) -> tuple[str, dict[str, Any]]:
        agent_mode = getattr(agent_definition, "agent_mode", None)
        if agent_mode == "document_intake":
            runtime = load_langgraph_runtime()
            graph = build_langgraph_document_intake_graph(
                runtime=runtime,
                service=service,
                agent_definition=agent_definition,
                resolved_scope=resolved_scope,
                execution_input=execution_input,
                runtime_binding=runtime_binding,
                tool_runtime_summary=tool_runtime_summary,
            )
            graph_result = await invoke_langgraph_graph(
                graph=graph,
                initial_state={"execution_input": execution_input, "graph_trace": []},
            )
            return graph_result["summary"], graph_result["result_payload_json"]

        if agent_mode != "workflow_recovery":
            summary, result_payload_json = await service.build_native_execution_result(
                agent_definition=agent_definition,
                resolved_scope=resolved_scope,
                execution_input=execution_input,
                runtime_binding=runtime_binding,
                tool_runtime_summary=tool_runtime_summary,
            )
            return summary, {
                **result_payload_json,
                "agent_runtime_engine": "native",
                "agent_runtime_resolution": {
                    "configured_engine": "langgraph_pilot",
                    "executed_engine": "native",
                    "fallback_applied": True,
                    "fallback_reason": "LangGraph pilot is currently limited to workflow_recovery executions.",
                },
            }

        runtime = load_langgraph_runtime()
        graph = build_langgraph_workflow_recovery_graph(
            runtime=runtime,
            service=service,
            agent_definition=agent_definition,
            execution_input=execution_input,
            runtime_binding=runtime_binding,
            tool_runtime_summary=tool_runtime_summary,
        )
        graph_result = await invoke_langgraph_graph(
            graph=graph,
            initial_state={
                "execution_input": execution_input,
                "graph_trace": [],
            },
        )
        return graph_result["summary"], graph_result["result_payload_json"]


def load_langgraph_runtime() -> LangGraphRuntime:
    try:
        graph_module = importlib.import_module("langgraph.graph")
    except ModuleNotFoundError as exc:
        raise RuntimeError(
            "The LangGraph pilot agent runtime requires the optional backend dependency. "
            "Install it from apps/api with: pip install -e \".[agent-langgraph]\""
        ) from exc

    return LangGraphRuntime(
        state_graph_cls=graph_module.StateGraph,
        start_node=graph_module.START,
    )


def build_langgraph_workflow_recovery_graph(
    *,
    runtime: LangGraphRuntime,
    service: AgentExecutionService,
    agent_definition: AgentDefinition,
    execution_input: str | None,
    runtime_binding: Any,
    tool_runtime_summary: Any,
) -> Any:
    graph_builder = runtime.state_graph_cls(dict)

    async def collect_workflow_metrics(state: dict[str, Any]) -> dict[str, Any]:
        workflow_metrics, failed_runs = await service.collect_workflow_recovery_context(
            agent_definition=agent_definition
        )
        return {
            **state,
            "workflow_metrics": workflow_metrics,
            "recent_failed_runs": failed_runs,
            "graph_trace": [
                *list(state.get("graph_trace") or []),
                {
                    "step": "collect_workflow_metrics",
                    "status": "completed",
                    "failed_runs": int(workflow_metrics.get("failed_runs", 0)),
                    "queued_runs": int(workflow_metrics.get("queued_runs", 0)),
                    "retry_runs": int(workflow_metrics.get("retry_runs", 0)),
                },
            ],
        }

    async def collect_failed_runs(state: dict[str, Any]) -> dict[str, Any]:
        failed_runs = list(state.get("recent_failed_runs") or [])
        return {
            **state,
            "graph_trace": [
                *list(state.get("graph_trace") or []),
                {
                    "step": "collect_failed_runs",
                    "status": "completed",
                    "failed_run_count": len(failed_runs),
                },
            ],
        }

    def compose_workflow_summary(state: dict[str, Any]) -> dict[str, Any]:
        summary, result_payload_json = service.build_workflow_recovery_result_from_context(
            agent_definition=agent_definition,
            execution_input=execution_input,
            runtime_binding=runtime_binding,
            tool_runtime_summary=tool_runtime_summary,
            workflow_metrics=dict(state.get("workflow_metrics") or {}),
            failed_runs=list(state.get("recent_failed_runs") or []),
            runtime_metadata={
                "agent_runtime_engine": "langgraph_pilot",
                "agent_runtime_resolution": {
                    "configured_engine": "langgraph_pilot",
                    "executed_engine": "langgraph_pilot",
                    "fallback_applied": False,
                    "fallback_reason": None,
                },
                "agent_runtime_graph": {
                    "engine": "langgraph_pilot",
                    "workflow": "workflow_recovery",
                    "trace": [
                        *list(state.get("graph_trace") or []),
                        {
                            "step": "compose_workflow_summary",
                            "status": "completed",
                        },
                    ],
                }
            },
        )
        return {
            **state,
            "summary": summary,
            "result_payload_json": result_payload_json,
        }

    graph_builder.add_node("collect_workflow_metrics", collect_workflow_metrics)
    graph_builder.add_node("collect_failed_runs", collect_failed_runs)
    graph_builder.add_node("compose_workflow_summary", compose_workflow_summary)
    graph_builder.add_edge(runtime.start_node, "collect_workflow_metrics")
    graph_builder.add_edge("collect_workflow_metrics", "collect_failed_runs")
    graph_builder.add_edge("collect_failed_runs", "compose_workflow_summary")
    return graph_builder.compile()


def build_langgraph_document_intake_graph(
    *, runtime: LangGraphRuntime, service: AgentExecutionService, agent_definition: AgentDefinition,
    resolved_scope: ResolvedAgentScope, execution_input: str | None, runtime_binding: Any,
    tool_runtime_summary: Any,
) -> Any:
    graph_builder = runtime.state_graph_cls(dict)

    async def collect_document_context(state: dict[str, Any]) -> dict[str, Any]:
        summary, payload = await service._build_document_intake_result(
            agent_definition=agent_definition,
            resolved_scope=resolved_scope,
            execution_input=execution_input,
            runtime_binding=runtime_binding,
            tool_runtime_summary=tool_runtime_summary,
        )
        return {
            **state,
            "summary": summary,
            "result_payload_json": payload,
            "graph_trace": [*list(state.get("graph_trace") or []), {
                "step": "collect_document_context", "status": "completed",
            }],
        }

    def route_intake(state: dict[str, Any]) -> str:
        metrics = dict((state.get("result_payload_json") or {}).get("document_metrics") or {})
        if int(metrics.get("failed_documents", 0)) > 0:
            return "recover_failed"
        if int(metrics.get("active_documents", 0)) > 0:
            return "review_processing"
        return "release_ready"

    def record_branch(branch: str):
        def handler(state: dict[str, Any]) -> dict[str, Any]:
            return {**state, "graph_trace": [*list(state.get("graph_trace") or []), {
                "step": branch, "status": "completed",
            }]}
        return handler

    def compose_result(state: dict[str, Any]) -> dict[str, Any]:
        payload = dict(state.get("result_payload_json") or {})
        trace = [*list(state.get("graph_trace") or []), {
            "step": "compose_document_intake", "status": "completed",
        }]
        return {
            **state,
            "summary": state["summary"],
            "result_payload_json": {
                **payload,
                "agent_runtime_engine": "langgraph_pilot",
                "agent_runtime_resolution": {
                    "configured_engine": "langgraph_pilot", "executed_engine": "langgraph_pilot",
                    "fallback_applied": False, "fallback_reason": None,
                },
                "agent_runtime_graph": {
                    "engine": "langgraph_pilot", "workflow": "document_intake",
                    "selected_branch": trace[-2]["step"], "trace": trace,
                },
            },
        }

    graph_builder.add_node("collect_document_context", collect_document_context)
    for branch in ("recover_failed", "review_processing", "release_ready"):
        graph_builder.add_node(branch, record_branch(branch))
        graph_builder.add_edge(branch, "compose_document_intake")
    graph_builder.add_node("compose_document_intake", compose_result)
    graph_builder.add_edge(runtime.start_node, "collect_document_context")
    graph_builder.add_conditional_edges("collect_document_context", route_intake, {
        "recover_failed": "recover_failed",
        "review_processing": "review_processing",
        "release_ready": "release_ready",
    })
    return graph_builder.compile()


async def invoke_langgraph_graph(*, graph: Any, initial_state: dict[str, Any]) -> dict[str, Any]:
    if hasattr(graph, "ainvoke"):
        return await graph.ainvoke(initial_state)

    result = graph.invoke(initial_state)
    if inspect.isawaitable(result):
        return await result
    return result


def normalize_agent_runtime_engine_name(engine_name: str | None) -> str:
    configured_engine = (engine_name or "native").strip().lower()
    if configured_engine == "langgraph_reserved":
        return "langgraph_pilot"
    return configured_engine


def build_agent_runtime_engine(settings: Any | None, engine_name: str | None = None) -> AgentRuntimeEngine:
    configured_engine = normalize_agent_runtime_engine_name(
        engine_name if engine_name is not None else getattr(settings, "agent_runtime_engine", "native")
    )

    if configured_engine == "native":
        return NativeAgentRuntimeEngine()
    if configured_engine == "langgraph_pilot":
        return LangGraphPilotAgentRuntimeEngine()

    raise ValueError(
        f"Unsupported agent runtime engine '{configured_engine}'. "
        "Expected 'native' or 'langgraph_pilot'."
    )
