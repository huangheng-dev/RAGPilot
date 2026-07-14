from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable


@dataclass(frozen=True)
class AgentEvaluationReport:
    sample_size: int
    completion_rate: float
    failure_rate: float
    cancellation_rate: float
    fallback_rate: float
    approval_block_rate: float
    promotion_ready: bool
    failed_gates: tuple[str, ...]


def evaluate_agent_executions(executions: Iterable[object], *, minimum_samples: int = 20) -> AgentEvaluationReport:
    rows = list(executions)
    total = len(rows)
    if total == 0:
        return AgentEvaluationReport(0, 0, 0, 0, 0, 0, False, ("minimum_samples",))

    def ratio(count: int) -> float:
        return round(count / total, 4)

    completed = sum(getattr(row, "execution_status", None) == "completed" for row in rows)
    failed = sum(getattr(row, "execution_status", None) == "failed" for row in rows)
    cancelled = sum(getattr(row, "execution_status", None) == "cancelled" for row in rows)
    payloads = [getattr(row, "result_payload_json", {}) or {} for row in rows]
    fallback = sum(bool((payload.get("agent_runtime_resolution") or {}).get("fallback_applied")) for payload in payloads)
    approval_blocked = sum(
        any(trace.get("governance_issue") == "approval_required" for trace in ((payload.get("tool_runtime") or {}).get("traces") or []))
        for payload in payloads
    )
    gates = {
        "minimum_samples": total >= minimum_samples,
        "completion_rate": ratio(completed) >= 0.95,
        "failure_rate": ratio(failed) <= 0.03,
        "fallback_rate": ratio(fallback) <= 0.05,
        "approval_block_rate": ratio(approval_blocked) <= 0.05,
    }
    failed_gates = tuple(name for name, passed in gates.items() if not passed)
    return AgentEvaluationReport(
        total, ratio(completed), ratio(failed), ratio(cancelled), ratio(fallback), ratio(approval_blocked),
        not failed_gates, failed_gates,
    )
