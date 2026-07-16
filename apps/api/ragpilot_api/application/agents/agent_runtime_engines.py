from __future__ import annotations

import importlib
import inspect
import time
from dataclasses import dataclass
from typing import Any, Protocol, TYPE_CHECKING
from typing_extensions import TypedDict


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
    end_node: Any


class WorkflowRecoveryGraphState(TypedDict, total=False):
    execution_input: str | None
    workflow_metrics: dict[str, Any]
    recent_failed_runs: list[Any]
    recovery_risk_level: str
    recovery_decision_reason: str
    summary: str
    result_payload_json: dict[str, Any]
    graph_trace: list[dict[str, Any]]


class DocumentIntakeGraphState(TypedDict, total=False):
    execution_input: str | None
    summary: str
    result_payload_json: dict[str, Any]
    decision_branch: str
    decision_reason: str
    risk_level: str
    graph_trace: list[dict[str, Any]]


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
                    "fallback_reason": (
                        "LangGraph pilot is currently limited to document_intake and "
                        "workflow_recovery executions."
                    ),
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
        end_node=graph_module.END,
    )


def build_graph_trace_entry(
    *, step: str, started_at: float, **metadata: Any,
) -> dict[str, Any]:
    return {
        "step": step,
        "status": "completed",
        "duration_ms": round(max((time.perf_counter() - started_at) * 1000, 0.0), 3),
        **metadata,
    }


def build_langgraph_workflow_recovery_graph(
    *,
    runtime: LangGraphRuntime,
    service: AgentExecutionService,
    agent_definition: AgentDefinition,
    execution_input: str | None,
    runtime_binding: Any,
    tool_runtime_summary: Any,
) -> Any:
    graph_builder = runtime.state_graph_cls(WorkflowRecoveryGraphState)

    async def collect_workflow_metrics(state: WorkflowRecoveryGraphState) -> WorkflowRecoveryGraphState:
        started_at = time.perf_counter()
        workflow_metrics, failed_runs = await service.collect_workflow_recovery_context(
            agent_definition=agent_definition
        )
        return {
            **state,
            "workflow_metrics": workflow_metrics,
            "recent_failed_runs": failed_runs,
            "graph_trace": [
                *list(state.get("graph_trace") or []),
                build_graph_trace_entry(
                    step="collect_workflow_metrics",
                    started_at=started_at,
                    failed_runs=int(workflow_metrics.get("failed_runs", 0)),
                    queued_runs=int(workflow_metrics.get("queued_runs", 0)),
                    retry_runs=int(workflow_metrics.get("retry_runs", 0)),
                ),
            ],
        }

    def classify_workflow_pressure(state: WorkflowRecoveryGraphState) -> WorkflowRecoveryGraphState:
        started_at = time.perf_counter()
        workflow_metrics = dict(state.get("workflow_metrics") or {})
        failed_runs = list(state.get("recent_failed_runs") or [])
        failed_count = int(workflow_metrics.get("failed_runs", 0))
        retry_count = int(workflow_metrics.get("retry_runs", 0))
        queued_count = int(workflow_metrics.get("queued_runs", 0))
        if failed_count > 0:
            risk_level = "high"
            reason = "Failed workflow runs require operator triage before broad retry."
        elif retry_count > 0 or queued_count > 0:
            risk_level = "medium"
            reason = "Workflow pressure is active and should be monitored before additional launches."
        else:
            risk_level = "low"
            reason = "No failed, retry-derived, or queued workflow pressure is currently visible."
        return {
            **state,
            "recovery_risk_level": risk_level,
            "recovery_decision_reason": reason,
            "graph_trace": [
                *list(state.get("graph_trace") or []),
                build_graph_trace_entry(
                    step="classify_workflow_pressure",
                    started_at=started_at,
                    failed_run_count=len(failed_runs),
                    risk_level=risk_level,
                    decision_reason=reason,
                ),
            ],
        }

    def compose_workflow_summary(state: WorkflowRecoveryGraphState) -> WorkflowRecoveryGraphState:
        started_at = time.perf_counter()
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
            },
        )
        trace = [
            *list(state.get("graph_trace") or []),
            build_graph_trace_entry(
                step="compose_workflow_summary",
                started_at=started_at,
            ),
        ]
        result_payload_json = {
            **result_payload_json,
            "agent_runtime_graph": {
                "engine": "langgraph_pilot",
                "workflow": "workflow_recovery",
                "risk_level": state.get("recovery_risk_level"),
                "decision_reason": state.get("recovery_decision_reason"),
                "trace": trace,
            },
        }
        return {
            **state,
            "summary": summary,
            "result_payload_json": result_payload_json,
        }

    graph_builder.add_node("collect_workflow_metrics", collect_workflow_metrics)
    graph_builder.add_node("classify_workflow_pressure", classify_workflow_pressure)
    graph_builder.add_node("compose_workflow_summary", compose_workflow_summary)
    graph_builder.add_edge(runtime.start_node, "collect_workflow_metrics")
    graph_builder.add_edge("collect_workflow_metrics", "classify_workflow_pressure")
    graph_builder.add_edge("classify_workflow_pressure", "compose_workflow_summary")
    graph_builder.add_edge("compose_workflow_summary", runtime.end_node)
    return graph_builder.compile()


def build_langgraph_document_intake_graph(
    *, runtime: LangGraphRuntime, service: AgentExecutionService, agent_definition: AgentDefinition,
    resolved_scope: ResolvedAgentScope, execution_input: str | None, runtime_binding: Any,
    tool_runtime_summary: Any,
) -> Any:
    graph_builder = runtime.state_graph_cls(DocumentIntakeGraphState)

    async def collect_document_context(state: DocumentIntakeGraphState) -> DocumentIntakeGraphState:
        started_at = time.perf_counter()
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
            "graph_trace": [
                *list(state.get("graph_trace") or []),
                build_graph_trace_entry(
                    step="collect_document_context",
                    started_at=started_at,
                    document_count=int((payload.get("document_metrics") or {}).get("total_documents", 0)),
                ),
            ],
        }

    def classify_intake_posture(state: DocumentIntakeGraphState) -> DocumentIntakeGraphState:
        started_at = time.perf_counter()
        metrics = dict((state.get("result_payload_json") or {}).get("document_metrics") or {})
        failed_documents = int(metrics.get("failed_documents", 0))
        active_documents = int(metrics.get("active_documents", 0))
        completed_documents = int(metrics.get("completed_documents", 0))
        if failed_documents > 0:
            branch = "recover_failed"
            risk_level = "high"
            reason = f"{failed_documents} failed documents require recovery before release."
        elif active_documents > 0:
            branch = "review_processing"
            risk_level = "medium"
            reason = f"{active_documents} documents are still processing and require monitoring."
        else:
            branch = "release_ready"
            risk_level = "low"
            reason = f"No failed or active documents remain; {completed_documents} completed documents are available."
        return {
            **state,
            "decision_branch": branch,
            "decision_reason": reason,
            "risk_level": risk_level,
            "graph_trace": [
                *list(state.get("graph_trace") or []),
                build_graph_trace_entry(
                    step="classify_intake_posture",
                    started_at=started_at,
                    selected_branch=branch,
                    risk_level=risk_level,
                    decision_reason=reason,
                ),
            ],
        }

    def route_intake(state: DocumentIntakeGraphState) -> str:
        return str(state["decision_branch"])

    branch_plans = {
        "recover_failed": [
            "Open failed documents and verify whether source correction or reindex is required.",
            "Inspect failed ingestion workflows before retrying the intake chain.",
        ],
        "review_processing": [
            "Monitor active intake items until parsing, embedding, and indexing reach terminal state.",
            "Delay knowledge-base release decisions while document processing remains active.",
        ],
        "release_ready": [
            "Validate retrieval and citation quality against the completed document set.",
            "Proceed with knowledge-base release review when evaluation evidence is satisfactory.",
        ],
    }

    def build_branch_plan(branch: str):
        def handler(state: DocumentIntakeGraphState) -> DocumentIntakeGraphState:
            started_at = time.perf_counter()
            payload = dict(state.get("result_payload_json") or {})
            payload["recommended_actions"] = list(branch_plans[branch])
            payload["intake_decision"] = {
                "branch": branch,
                "risk_level": state.get("risk_level"),
                "reason": state.get("decision_reason"),
            }
            return {
                **state,
                "result_payload_json": payload,
                "graph_trace": [
                    *list(state.get("graph_trace") or []),
                    build_graph_trace_entry(
                        step=branch,
                        started_at=started_at,
                        action_count=len(branch_plans[branch]),
                        decision_reason=state.get("decision_reason"),
                    ),
                ],
            }
        return handler

    def validate_intake_result(state: DocumentIntakeGraphState) -> DocumentIntakeGraphState:
        started_at = time.perf_counter()
        payload = dict(state.get("result_payload_json") or {})
        decision = payload.get("intake_decision")
        actions = payload.get("recommended_actions")
        if not isinstance(decision, dict) or decision.get("branch") not in branch_plans:
            raise RuntimeError("LangGraph document intake result is missing a governed decision branch.")
        if not isinstance(actions, list) or len(actions) == 0:
            raise RuntimeError("LangGraph document intake result is missing actionable recommendations.")
        payload["intake_validation"] = {
            "status": "passed",
            "checks": ["decision_branch", "recommended_actions", "document_metrics"],
        }
        return {
            **state,
            "result_payload_json": payload,
            "graph_trace": [
                *list(state.get("graph_trace") or []),
                build_graph_trace_entry(
                    step="validate_intake_result",
                    started_at=started_at,
                    validation_status="passed",
                ),
            ],
        }

    def compose_result(state: DocumentIntakeGraphState) -> DocumentIntakeGraphState:
        started_at = time.perf_counter()
        payload = dict(state.get("result_payload_json") or {})
        trace = [
            *list(state.get("graph_trace") or []),
            build_graph_trace_entry(
                step="compose_document_intake",
                started_at=started_at,
            ),
        ]
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
                    "selected_branch": state.get("decision_branch"),
                    "risk_level": state.get("risk_level"),
                    "decision_reason": state.get("decision_reason"),
                    "trace": trace,
                },
            },
        }

    graph_builder.add_node("collect_document_context", collect_document_context)
    graph_builder.add_node("classify_intake_posture", classify_intake_posture)
    for branch in ("recover_failed", "review_processing", "release_ready"):
        graph_builder.add_node(branch, build_branch_plan(branch))
        graph_builder.add_edge(branch, "validate_intake_result")
    graph_builder.add_node("validate_intake_result", validate_intake_result)
    graph_builder.add_node("compose_document_intake", compose_result)
    graph_builder.add_edge(runtime.start_node, "collect_document_context")
    graph_builder.add_edge("collect_document_context", "classify_intake_posture")
    graph_builder.add_conditional_edges("classify_intake_posture", route_intake, {
        "recover_failed": "recover_failed",
        "review_processing": "review_processing",
        "release_ready": "release_ready",
    })
    graph_builder.add_edge("validate_intake_result", "compose_document_intake")
    graph_builder.add_edge("compose_document_intake", runtime.end_node)
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
