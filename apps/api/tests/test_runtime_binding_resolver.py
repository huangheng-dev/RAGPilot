from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from ragpilot_api.application.model_gateway.runtime_binding_resolver import RuntimeBindingResolver


@pytest.mark.anyio
async def test_runtime_binding_resolver_returns_settings_binding_without_agent_endpoint() -> None:
    resolver = RuntimeBindingResolver(
        model_endpoint_repository=SimpleNamespace(get_default_model_endpoint=AsyncMock(return_value=None)),
        settings=SimpleNamespace(
            chat_model_provider="deterministic",
            chat_model_name="settings-model",
            chat_model_api_base_url=None,
            chat_model_api_key=None,
            chat_model_request_timeout_seconds=45,
        ),
    )

    binding = await resolver.resolve_chat_runtime_binding(agent_definition=None)

    assert binding.provider_type == "deterministic"
    assert binding.model_name == "settings-model"
    assert binding.source == "settings"


@pytest.mark.anyio
async def test_runtime_binding_resolver_uses_default_model_endpoint_without_agent_binding() -> None:
    default_model_endpoint_id = uuid4()
    resolver = RuntimeBindingResolver(
        model_endpoint_repository=SimpleNamespace(
            get_default_model_endpoint=AsyncMock(
                return_value=SimpleNamespace(
                    id=default_model_endpoint_id,
                    name="Local Ollama",
                    provider_type="ollama",
                    model_name="llama3.1",
                    base_url="http://127.0.0.1:11434",
                    credential_mode="none",
                    credential_key_hint=None,
                    capabilities_json=["chat"],
                    is_enabled=True,
                )
            )
        ),
        settings=SimpleNamespace(
            chat_model_provider="deterministic",
            chat_model_name="settings-model",
            chat_model_api_base_url=None,
            chat_model_api_key=None,
            chat_model_request_timeout_seconds=45,
        ),
    )

    binding = await resolver.resolve_chat_runtime_binding(agent_definition=None)

    assert binding.provider_type == "ollama"
    assert binding.model_name == "llama3.1"
    assert binding.source == "model_endpoint"
    assert binding.model_endpoint_id == default_model_endpoint_id
    assert binding.model_endpoint_name == "Local Ollama"
    assert binding.api_base_url == "http://127.0.0.1:11434"


@pytest.mark.anyio
async def test_runtime_binding_resolver_rejects_disabled_endpoint() -> None:
    resolver = RuntimeBindingResolver(
        model_endpoint_repository=SimpleNamespace(
            get_default_model_endpoint=AsyncMock(return_value=None),
            get_model_endpoint=AsyncMock(
                return_value=SimpleNamespace(
                    id=uuid4(),
                    name="Disabled Runtime",
                    provider_type="openai_compatible",
                    model_name="gpt-4.1-mini",
                    base_url="http://127.0.0.1:11434/v1",
                    credential_mode="none",
                    credential_key_hint=None,
                    capabilities_json=["chat"],
                    is_enabled=False,
                )
            )
        ),
        settings=SimpleNamespace(
            chat_model_provider="deterministic",
            chat_model_name="settings-model",
            chat_model_api_base_url=None,
            chat_model_api_key=None,
            chat_model_request_timeout_seconds=45,
        ),
    )

    binding = await resolver.resolve_chat_runtime_binding(
        agent_definition=SimpleNamespace(model_endpoint_id=uuid4())
    )

    assert binding.provider_type == "deterministic"
    assert binding.model_name == "settings-model"
    assert binding.source == "settings_fallback"
    assert binding.fallback_applied is True
    assert binding.fallback_reason == "model_endpoint_disabled:settings"


@pytest.mark.anyio
async def test_runtime_binding_resolver_rejects_disabled_default_endpoint() -> None:
    resolver = RuntimeBindingResolver(
        model_endpoint_repository=SimpleNamespace(
            get_default_model_endpoint=AsyncMock(
                return_value=SimpleNamespace(
                    id=uuid4(),
                    name="Disabled Default Runtime",
                    provider_type="ollama",
                    model_name="llama3.1",
                    base_url="http://127.0.0.1:11434",
                    credential_mode="none",
                    credential_key_hint=None,
                    capabilities_json=["chat"],
                    is_enabled=False,
                )
            )
        ),
        settings=SimpleNamespace(
            chat_model_provider="deterministic",
            chat_model_name="settings-model",
            chat_model_api_base_url=None,
            chat_model_api_key=None,
            chat_model_request_timeout_seconds=45,
        ),
    )

    binding = await resolver.resolve_chat_runtime_binding(agent_definition=None)

    assert binding.provider_type == "deterministic"
    assert binding.model_name == "settings-model"
    assert binding.source == "settings_fallback"
    assert binding.fallback_applied is True
    assert binding.fallback_reason == "model_endpoint_disabled"


@pytest.mark.anyio
async def test_runtime_binding_resolver_falls_back_to_default_endpoint_when_configured_endpoint_is_unavailable() -> None:
    configured_model_endpoint_id = uuid4()
    default_model_endpoint_id = uuid4()
    resolver = RuntimeBindingResolver(
        model_endpoint_repository=SimpleNamespace(
            get_default_model_endpoint=AsyncMock(
                return_value=SimpleNamespace(
                    id=default_model_endpoint_id,
                    name="Healthy Default Runtime",
                    provider_type="ollama",
                    model_name="llama3.1",
                    base_url="http://127.0.0.1:11434",
                    credential_mode="none",
                    credential_key_hint=None,
                    capabilities_json=["chat"],
                    is_enabled=True,
                )
            ),
            get_model_endpoint=AsyncMock(
                return_value=SimpleNamespace(
                    id=configured_model_endpoint_id,
                    name="Broken Configured Runtime",
                    provider_type="vllm",
                    model_name="meta-llama/Llama-3.1-8B-Instruct",
                    base_url=None,
                    credential_mode="none",
                    credential_key_hint=None,
                    capabilities_json=["chat"],
                    is_enabled=True,
                )
            ),
        ),
        settings=SimpleNamespace(
            chat_model_provider="deterministic",
            chat_model_name="settings-model",
            chat_model_api_base_url=None,
            chat_model_api_key=None,
            chat_model_request_timeout_seconds=45,
        ),
    )

    binding = await resolver.resolve_chat_runtime_binding(
        agent_definition=SimpleNamespace(model_endpoint_id=configured_model_endpoint_id)
    )

    assert binding.provider_type == "ollama"
    assert binding.model_name == "llama3.1"
    assert binding.source == "model_endpoint"
    assert binding.model_endpoint_id == default_model_endpoint_id
    assert binding.configured_model_endpoint_id == configured_model_endpoint_id
    assert binding.configured_model_endpoint_name == "Broken Configured Runtime"
    assert binding.fallback_applied is True
    assert binding.fallback_reason == "model_endpoint_not_runtime_ready:default_model_endpoint"
