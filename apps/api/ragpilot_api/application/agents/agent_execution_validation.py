from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from typing import Any


MAX_RESULT_BYTES = 256_000
MAX_RESULT_DEPTH = 12


@dataclass(frozen=True)
class AgentFailureClassification:
    category: str
    retryable: bool


def validate_agent_execution_input(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip()
    if not normalized:
        return None
    if len(normalized) > 4_000:
        raise ValueError("Agent execution input exceeds the 4000-character limit.")
    return normalized


def validate_agent_result_payload(
    payload: dict[str, Any],
    *,
    max_result_bytes: int = MAX_RESULT_BYTES,
    output_schema_json: dict[str, Any] | None = None,
) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise ValueError("Agent result payload must be an object.")
    encoded = json.dumps(payload, ensure_ascii=False, default=str).encode("utf-8")
    if len(encoded) > min(max(int(max_result_bytes), 1024), MAX_RESULT_BYTES):
        raise ValueError("Agent result payload exceeds the governed size limit.")
    if _depth(payload) > MAX_RESULT_DEPTH:
        raise ValueError("Agent result payload exceeds the governed nesting limit.")
    if output_schema_json:
        try:
            from jsonschema import Draft202012Validator
            Draft202012Validator.check_schema(output_schema_json)
            Draft202012Validator(output_schema_json).validate(payload)
        except Exception as error:
            raise ValueError(f"Agent result payload does not satisfy the declared output schema: {error}") from error
    return payload


def build_execution_policy(
    *,
    request,
    settings,
    tool_registration_ids: list[str],
    agent_definition_snapshot: dict[str, Any] | None = None,
) -> dict[str, Any]:
    validate_output_schema(request.output_schema_json)
    configured_tool_cap = int(getattr(settings, "agent_execution_max_tool_calls", 8))
    configured_runtime_cap = int(getattr(settings, "agent_execution_max_runtime_seconds", 900))
    configured_output_cap = int(getattr(settings, "agent_execution_max_output_bytes", MAX_RESULT_BYTES))
    requested_tool_cap = request.max_tool_calls if request.max_tool_calls is not None else configured_tool_cap
    requested_runtime_cap = request.max_runtime_seconds if request.max_runtime_seconds is not None else configured_runtime_cap
    requested_output_cap = request.max_output_bytes if request.max_output_bytes is not None else configured_output_cap
    if requested_tool_cap > configured_tool_cap or requested_runtime_cap > configured_runtime_cap or requested_output_cap > configured_output_cap:
        raise ValueError("Agent execution request exceeds the deployment-owned runtime budget.")
    if len(tool_registration_ids) > requested_tool_cap:
        raise ValueError("Agent tool bindings exceed the execution tool-call budget.")
    policy = {
        "version": "agent_execution_policy_v1",
        "max_tool_calls": requested_tool_cap,
        "max_runtime_seconds": requested_runtime_cap,
        "max_output_bytes": requested_output_cap,
        "sandbox": {
            "shell_access": "none",
            "filesystem_access": "none",
            "network_access": "registered_tools_only",
            "allowed_tool_registration_ids": list(tool_registration_ids),
        },
    }
    if agent_definition_snapshot is not None:
        policy["agent_definition_snapshot"] = agent_definition_snapshot
        configured_engine = agent_definition_snapshot.get("runtime_engine")
        configured_version = agent_definition_snapshot.get("runtime_version")
        if configured_engine and configured_version:
            policy["runtime"] = {
                "engine": configured_engine,
                "version": configured_version,
            }
    return policy


def validate_output_schema(output_schema_json: dict[str, Any] | None) -> None:
    if output_schema_json is None:
        return
    encoded = json.dumps(output_schema_json, ensure_ascii=False).encode("utf-8")
    if len(encoded) > 32_000 or _depth(output_schema_json) > 8:
        raise ValueError("Agent output schema exceeds the governed size or nesting limit.")
    try:
        from jsonschema import Draft202012Validator
        Draft202012Validator.check_schema(output_schema_json)
    except Exception as error:
        raise ValueError(f"Agent output schema is invalid: {error}") from error


def build_replay_fingerprint(
    *,
    agent_definition_id: str,
    execution_input: str | None,
    prompt_snapshot_hash: str,
    execution_policy: dict,
    output_schema: dict | None,
) -> str:
    canonical = json.dumps(
        {
            "agent_definition_id": agent_definition_id,
            "execution_input": execution_input,
            "prompt_snapshot_hash": prompt_snapshot_hash,
            "execution_policy": execution_policy,
            "output_schema": output_schema,
        },
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def classify_agent_failure(error: Exception) -> AgentFailureClassification:
    name = type(error).__name__.lower()
    message = str(error).lower()
    if isinstance(error, (ValueError, TypeError)):
        return AgentFailureClassification("validation", False)
    if "cancel" in name or "cancel" in message:
        return AgentFailureClassification("cancelled", False)
    if "timeout" in name or "timeout" in message:
        return AgentFailureClassification("timeout", True)
    if "approval" in message or "governance" in message or "permission" in message:
        return AgentFailureClassification("governance", False)
    if any(token in message for token in ("connection", "unavailable", "503", "502", "429")):
        return AgentFailureClassification("dependency", True)
    return AgentFailureClassification("runtime", True)


def _depth(value: Any) -> int:
    if isinstance(value, dict):
        return 1 + max((_depth(item) for item in value.values()), default=0)
    if isinstance(value, list):
        return 1 + max((_depth(item) for item in value), default=0)
    return 0
