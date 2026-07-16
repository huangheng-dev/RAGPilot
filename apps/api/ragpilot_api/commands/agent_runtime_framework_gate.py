from __future__ import annotations

import argparse
import asyncio
import importlib.metadata
import json
import time
from pathlib import Path
from types import SimpleNamespace
from typing import Any

from ragpilot_api.application.agents.agent_runtime_engines import (
    LangGraphPilotAgentRuntimeEngine,
    NativeAgentRuntimeEngine,
)
from ragpilot_api.application.retrieval.batch_evaluator import percentile


class GateAgentService:
    def __init__(self, case: dict[str, Any]) -> None:
        self.case = case

    async def _build_document_intake_result(self, **_: Any) -> tuple[str, dict[str, Any]]:
        return "Document intake evidence prepared.", {
            "execution_lane": "document_intake",
            "document_metrics": dict(self.case.get("document_metrics") or {}),
            "recommended_actions": ["Review governed intake evidence."],
        }

    async def collect_workflow_recovery_context(self, **_: Any) -> tuple[dict[str, Any], list[Any]]:
        metrics = dict(self.case.get("workflow_metrics") or {})
        failed_runs = [
            SimpleNamespace(
                id=f"failed-run-{index}",
                workflow_type="document_ingestion",
                workflow_status="failed",
                subject_type="document",
                subject_id=f"document-{index}",
                error_message="Versioned runtime gate failure fixture.",
            )
            for index in range(int(metrics.get("failed_runs", 0)))
        ]
        return metrics, failed_runs

    def build_workflow_recovery_result_from_context(
        self, *, workflow_metrics: dict[str, Any], runtime_metadata: dict[str, Any], **_: Any
    ) -> tuple[str, dict[str, Any]]:
        return "Workflow recovery evidence prepared.", {
            "execution_lane": "workflow_recovery",
            "workflow_metrics": workflow_metrics,
            "recommended_actions": ["Review governed workflow evidence."],
            **runtime_metadata,
        }

    async def build_native_execution_result(self, **_: Any) -> tuple[str, dict[str, Any]]:
        mode = self.case["agent_mode"]
        if mode == "document_intake":
            return await self._build_document_intake_result()
        if mode == "workflow_recovery":
            metrics, _failed_runs = await self.collect_workflow_recovery_context()
            return "Workflow recovery evidence prepared.", {
                "execution_lane": "workflow_recovery",
                "workflow_metrics": metrics,
                "recommended_actions": ["Review governed workflow evidence."],
            }
        return "Grounded evidence prepared.", {
            "execution_lane": "grounded_chat",
            "recommended_actions": ["Continue grounded validation."],
        }


async def execute_case(*, case: dict[str, Any], engine: Any) -> tuple[float, str, dict[str, Any]]:
    started_at = time.perf_counter()
    summary, payload = await engine.execute(
        service=GateAgentService(case),
        agent_definition=SimpleNamespace(agent_mode=case["agent_mode"], name=case["case_id"]),
        resolved_scope=SimpleNamespace(knowledge_base_id="gate-knowledge-base"),
        execution_input=case.get("execution_input"),
        runtime_binding=None,
        tool_runtime_summary=None,
    )
    return (time.perf_counter() - started_at) * 1000, summary, payload


def validate_dataset(dataset: dict[str, Any]) -> None:
    for field in ("dataset_id", "version", "gates", "cases"):
        if field not in dataset:
            raise ValueError(f"Agent runtime dataset is missing {field}.")
    if dataset.get("schema_version") != "1" or not dataset["cases"]:
        raise ValueError("Agent runtime dataset must use schema version 1 and contain cases.")
    case_ids = [case.get("case_id") for case in dataset["cases"]]
    if any(not case_id for case_id in case_ids) or len(case_ids) != len(set(case_ids)):
        raise ValueError("Agent runtime dataset case IDs must be present and unique.")


async def evaluate_runtime_frameworks(dataset: dict[str, Any]) -> dict[str, Any]:
    validate_dataset(dataset)
    native = NativeAgentRuntimeEngine()
    langgraph = LangGraphPilotAgentRuntimeEngine()
    warmup_runs = int(dataset.get("warmup_runs", 0))
    warmup_latencies: list[float] = []
    for _ in range(warmup_runs):
        latency, _summary, _payload = await execute_case(case=dataset["cases"][0], engine=langgraph)
        warmup_latencies.append(latency)

    native_latencies: list[float] = []
    langgraph_latencies: list[float] = []
    case_reports: list[dict[str, Any]] = []
    native_contract_hits = 0
    branch_hits = 0
    branch_cases = 0
    validation_hits = 0
    validation_cases = 0
    trace_hits = 0
    trace_cases = 0
    fallback_hits = 0
    fallback_cases = 0

    for case in dataset["cases"]:
        native_latency, native_summary, native_payload = await execute_case(case=case, engine=native)
        candidate_latency, candidate_summary, candidate_payload = await execute_case(
            case=case, engine=langgraph
        )
        native_latencies.append(native_latency)
        langgraph_latencies.append(candidate_latency)
        native_contract_ok = bool(native_summary) and (
            native_payload.get("execution_lane") == case["agent_mode"]
        )
        native_contract_hits += int(native_contract_ok)

        resolution = dict(candidate_payload.get("agent_runtime_resolution") or {})
        executed_engine = resolution.get("executed_engine")
        graph = dict(candidate_payload.get("agent_runtime_graph") or {})
        trace = list(graph.get("trace") or [])
        expected_steps = list(case.get("expected_trace_steps") or [])
        trace_ok = [entry.get("step") for entry in trace] == expected_steps and all(
            entry.get("status") == "completed" and float(entry.get("duration_ms", -1)) >= 0
            for entry in trace
        )
        if expected_steps:
            trace_cases += 1
            trace_hits += int(trace_ok)

        branch_ok: bool | None = None
        if case.get("expected_branch"):
            branch_cases += 1
            branch_ok = (
                graph.get("selected_branch") == case["expected_branch"]
                and (candidate_payload.get("intake_decision") or {}).get("branch")
                == case["expected_branch"]
                and graph.get("risk_level") == case["expected_risk_level"]
            )
            branch_hits += int(branch_ok)

        validation_ok: bool | None = None
        if case["agent_mode"] == "document_intake":
            validation_cases += 1
            validation_ok = (candidate_payload.get("intake_validation") or {}).get("status") == "passed"
            validation_hits += int(validation_ok)

        if case["agent_mode"] == "workflow_recovery":
            branch_cases += 1
            branch_ok = graph.get("risk_level") == case["expected_risk_level"]
            branch_hits += int(branch_ok)

        fallback_ok: bool | None = None
        if case.get("expected_fallback") is not None:
            fallback_cases += 1
            fallback_ok = (
                bool(resolution.get("fallback_applied")) is bool(case["expected_fallback"])
                and executed_engine == case["expected_executed_engine"]
                and candidate_payload.get("execution_lane") == native_payload.get("execution_lane")
            )
            fallback_hits += int(fallback_ok)

        case_reports.append(
            {
                "case_id": case["case_id"],
                "agent_mode": case["agent_mode"],
                "native_latency_ms": round(native_latency, 3),
                "langgraph_latency_ms": round(candidate_latency, 3),
                "native_contract_ok": native_contract_ok,
                "executed_engine": executed_engine,
                "branch_ok": branch_ok,
                "validation_ok": validation_ok,
                "trace_ok": trace_ok if expected_steps else None,
                "fallback_ok": fallback_ok,
                "trace_steps": [entry.get("step") for entry in trace],
                "summary_contract_preserved": bool(candidate_summary),
            }
        )

    case_count = len(dataset["cases"])
    metrics = {
        "native_contract_coverage": native_contract_hits / case_count,
        "branch_accuracy": branch_hits / branch_cases if branch_cases else 1.0,
        "validation_coverage": validation_hits / validation_cases if validation_cases else 1.0,
        "trace_coverage": trace_hits / trace_cases if trace_cases else 1.0,
        "fallback_accuracy": fallback_hits / fallback_cases if fallback_cases else 1.0,
    }
    native_p95 = percentile(native_latencies, 0.95)
    langgraph_p95 = percentile(langgraph_latencies, 0.95)
    p95_overhead = langgraph_p95 - native_p95
    gates = dataset["gates"]
    failures = []
    for metric in (
        "native_contract_coverage",
        "branch_accuracy",
        "validation_coverage",
        "trace_coverage",
        "fallback_accuracy",
    ):
        minimum = float(gates[f"required_{metric}"])
        if metrics[metric] < minimum:
            failures.append(f"{metric}={metrics[metric]:.4f} < {minimum:.4f}")
    if p95_overhead > float(gates["max_p95_overhead_ms"]):
        failures.append(
            f"p95 overhead={p95_overhead:.2f}ms > {float(gates['max_p95_overhead_ms']):.2f}ms"
        )

    return {
        "dataset_id": dataset["dataset_id"],
        "dataset_version": dataset["version"],
        "comparison": "native_vs_langgraph_pilot",
        "case_count": case_count,
        "warmup_latency_ms": [round(value, 3) for value in warmup_latencies],
        "langgraph_version": importlib.metadata.version("langgraph"),
        "metrics": metrics,
        "native_p95_latency_ms": round(native_p95, 3),
        "langgraph_p95_latency_ms": round(langgraph_p95, 3),
        "p95_overhead_ms": round(p95_overhead, 3),
        "gates": gates,
        "promotion": {"passed": not failures, "failures": failures},
        "cases": case_reports,
    }


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Compare Native and LangGraph agent runtimes on versioned branch contracts."
    )
    parser.add_argument("dataset", type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    dataset = json.loads(args.dataset.read_text(encoding="utf-8"))
    report = asyncio.run(evaluate_runtime_frameworks(dataset))
    rendered = json.dumps(report, ensure_ascii=False, indent=2)
    if args.output:
        args.output.write_text(rendered + "\n", encoding="utf-8")
    print(rendered)
    raise SystemExit(0 if report["promotion"]["passed"] else 2)


if __name__ == "__main__":
    main()
