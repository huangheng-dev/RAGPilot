import pytest

from ragpilot_api.application.runtime_governance.runtime_health import classify_runtime_health


@pytest.mark.parametrize(("status", "message", "category", "retryable"), [
    ("completed", "READY", "healthy", False),
    ("blocked", "Environment credential is missing", "credential", False),
    ("blocked", "Set the base URL", "configuration", False),
    ("failed", "request timed out", "timeout", True),
    ("failed", "HTTP 429 rate limit", "rate_limit", True),
    ("failed", "invalid MCP protocol initialize result", "protocol", False),
    ("failed", "connection refused", "dependency", True),
])
def test_runtime_health_classification(status, message, category, retryable) -> None:
    result = classify_runtime_health(status=status, summary=message, error_message=None)
    assert (result.category, result.retryable) == (category, retryable)
    assert result.operator_action
