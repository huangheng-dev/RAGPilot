from types import SimpleNamespace

import pytest

from ragpilot_api.application.agents.agent_evaluation import evaluate_agent_executions
from ragpilot_api.application.agents.agent_execution_validation import (
    classify_agent_failure,
    validate_agent_execution_input,
    validate_agent_result_payload,
)


def test_agent_execution_validation_normalizes_input_and_bounds_payload() -> None:
    assert validate_agent_execution_input("  recover workflow  ") == "recover workflow"
    assert validate_agent_execution_input("   ") is None
    assert validate_agent_result_payload({"answer": "ready"}) == {"answer": "ready"}
    with pytest.raises(ValueError, match="size limit"):
        validate_agent_result_payload({"answer": "x" * 256_001})


@pytest.mark.parametrize(
    ("error", "category", "retryable"),
    [
        (ValueError("bad output"), "validation", False),
        (TimeoutError("model timeout"), "timeout", True),
        (RuntimeError("dependency unavailable"), "dependency", True),
        (RuntimeError("approval required"), "governance", False),
    ],
)
def test_agent_failure_classification(error, category: str, retryable: bool) -> None:
    result = classify_agent_failure(error)
    assert (result.category, result.retryable) == (category, retryable)


def test_agent_evaluation_gates_promote_only_evidenced_lane() -> None:
    healthy = [
        SimpleNamespace(execution_status="completed", result_payload_json={"agent_runtime_resolution": {"fallback_applied": False}})
        for _ in range(20)
    ]
    report = evaluate_agent_executions(healthy)
    assert report.promotion_ready is True
    degraded = healthy[:18] + [
        SimpleNamespace(execution_status="failed", result_payload_json={}),
        SimpleNamespace(execution_status="completed", result_payload_json={"agent_runtime_resolution": {"fallback_applied": True}}),
    ]
    report = evaluate_agent_executions(degraded)
    assert report.promotion_ready is False
    assert "failure_rate" in report.failed_gates
