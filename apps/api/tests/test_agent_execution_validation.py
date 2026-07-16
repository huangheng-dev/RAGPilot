from types import SimpleNamespace

import pytest

from ragpilot_api.application.agents.agent_evaluation import evaluate_agent_executions
from ragpilot_api.application.agents.agent_execution_validation import (
    build_execution_policy,
    build_replay_fingerprint,
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


def test_agent_output_schema_is_enforced() -> None:
    schema = {
        "type": "object",
        "required": ["answer"],
        "properties": {"answer": {"type": "string"}},
        "additionalProperties": False,
    }
    assert validate_agent_result_payload({"answer": "ready"}, output_schema_json=schema) == {
        "answer": "ready"
    }
    with pytest.raises(ValueError, match="declared output schema"):
        validate_agent_result_payload({"answer": 42}, output_schema_json=schema)


def test_agent_execution_policy_enforces_deployment_caps_and_snapshots_sandbox() -> None:
    request = SimpleNamespace(
        max_tool_calls=2,
        max_runtime_seconds=60,
        max_output_bytes=4096,
        output_schema_json=None,
    )
    settings = SimpleNamespace(
        agent_execution_max_tool_calls=4,
        agent_execution_max_runtime_seconds=120,
        agent_execution_max_output_bytes=8192,
    )
    snapshot = {"name": "Research agent", "objective": "Ground every answer."}
    policy = build_execution_policy(
        request=request,
        settings=settings,
        tool_registration_ids=["tool-a", "tool-b"],
        agent_definition_snapshot=snapshot,
    )
    assert policy["max_tool_calls"] == 2
    assert policy["sandbox"]["network_access"] == "registered_tools_only"
    assert policy["sandbox"]["allowed_tool_registration_ids"] == ["tool-a", "tool-b"]
    assert policy["agent_definition_snapshot"] == snapshot

    request.max_runtime_seconds = 121
    with pytest.raises(ValueError, match="deployment-owned"):
        build_execution_policy(
            request=request,
            settings=settings,
            tool_registration_ids=[],
        )


def test_agent_replay_fingerprint_is_canonical_and_policy_sensitive() -> None:
    base = {
        "agent_definition_id": "agent-1",
        "execution_input": "question",
        "prompt_snapshot_hash": "prompt-hash",
        "output_schema": None,
    }
    first = build_replay_fingerprint(
        **base,
        execution_policy={"max_runtime_seconds": 60, "max_tool_calls": 2},
    )
    same = build_replay_fingerprint(
        **base,
        execution_policy={"max_tool_calls": 2, "max_runtime_seconds": 60},
    )
    changed = build_replay_fingerprint(
        **base,
        execution_policy={"max_tool_calls": 2, "max_runtime_seconds": 61},
    )
    assert first == same
    assert first != changed


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
