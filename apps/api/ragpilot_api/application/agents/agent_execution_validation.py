from __future__ import annotations

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


def validate_agent_result_payload(payload: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise ValueError("Agent result payload must be an object.")
    encoded = json.dumps(payload, ensure_ascii=False, default=str).encode("utf-8")
    if len(encoded) > MAX_RESULT_BYTES:
        raise ValueError("Agent result payload exceeds the governed size limit.")
    if _depth(payload) > MAX_RESULT_DEPTH:
        raise ValueError("Agent result payload exceeds the governed nesting limit.")
    return payload


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
