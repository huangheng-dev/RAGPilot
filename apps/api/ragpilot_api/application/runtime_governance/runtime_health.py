from dataclasses import dataclass


@dataclass(frozen=True)
class RuntimeHealthClassification:
    category: str
    retryable: bool
    operator_action: str


def classify_runtime_health(*, status: str, summary: str | None, error_message: str | None) -> RuntimeHealthClassification:
    text = f"{summary or ''} {error_message or ''}".lower()
    if status == "completed":
        return RuntimeHealthClassification("healthy", False, "none")
    if any(token in text for token in ("credential", "authorization", "unauthorized", "401", "403")):
        return RuntimeHealthClassification("credential", False, "rotate_or_restore_credential")
    if any(token in text for token in ("disabled", "enable this")):
        return RuntimeHealthClassification("disabled", False, "review_enablement_policy")
    if any(token in text for token in ("base url", "configured", "configuration")):
        return RuntimeHealthClassification("configuration", False, "correct_runtime_configuration")
    if any(token in text for token in ("capability", "not supported", "unsupported")):
        return RuntimeHealthClassification("capability", False, "review_capability_binding")
    if any(token in text for token in ("protocol", "jsonrpc", "initialize")):
        return RuntimeHealthClassification("protocol", False, "review_protocol_compatibility")
    if any(token in text for token in ("429", "rate limit")):
        return RuntimeHealthClassification("rate_limit", True, "reduce_rate_or_request_quota")
    if any(token in text for token in ("timeout", "timed out")):
        return RuntimeHealthClassification("timeout", True, "inspect_latency_and_timeout_budget")
    if any(token in text for token in ("connection", "could not reach", "502", "503", "504")):
        return RuntimeHealthClassification("dependency", True, "inspect_dependency_availability")
    if status == "blocked":
        return RuntimeHealthClassification("governance", False, "review_governance_policy")
    return RuntimeHealthClassification("runtime", True, "inspect_runtime_failure")
