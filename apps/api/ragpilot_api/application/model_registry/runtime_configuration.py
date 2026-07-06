from typing import Literal


NormalizedModelProviderType = Literal["deterministic", "openai_compatible", "ollama", "vllm"]
ModelRuntimeConfigurationIssue = Literal["missing_base_url", "missing_credential_hint", "managed_reserved"]


def normalize_model_endpoint_provider_name(provider_name: str) -> NormalizedModelProviderType:
    normalized = provider_name.strip().lower()
    if normalized in {"vllm_reserved", "vllm"}:
        return "vllm"
    if normalized in {"ollama_reserved", "ollama"}:
        return "ollama"
    if normalized == "deterministic":
        return "deterministic"
    return "openai_compatible"


def model_provider_requires_base_url(provider_type: str) -> bool:
    return normalize_model_endpoint_provider_name(provider_type) != "deterministic"


def read_model_runtime_configuration_issue(
    *,
    provider_type: str,
    base_url: str | None,
    credential_mode: str,
    credential_key_hint: str | None,
) -> ModelRuntimeConfigurationIssue | None:
    if model_provider_requires_base_url(provider_type) and not str(base_url or "").strip():
        return "missing_base_url"

    if credential_mode == "managed_reserved":
        return "managed_reserved"

    if credential_mode == "environment" and not str(credential_key_hint or "").strip():
        return "missing_credential_hint"

    return None


def is_model_runtime_configured(
    *,
    provider_type: str,
    base_url: str | None,
    credential_mode: str,
    credential_key_hint: str | None,
) -> bool:
    return (
        read_model_runtime_configuration_issue(
            provider_type=provider_type,
            base_url=base_url,
            credential_mode=credential_mode,
            credential_key_hint=credential_key_hint,
        )
        is None
    )
