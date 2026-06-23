from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from ragpilot_api.application.system.health_service import build_health_response


@pytest.mark.anyio
async def test_health_builder(monkeypatch) -> None:
    monkeypatch.setattr(
        "ragpilot_api.application.system.health_service.build_runtime_readiness_snapshot",
        lambda: type(
            "RuntimeReadinessSnapshot",
            (),
            {
                "llamaindex_pilot_ready": True,
                "langgraph_pilot_ready": False,
            },
        )(),
    )
    monkeypatch.setattr(
        "ragpilot_api.application.system.health_service.RuntimeBindingResolver",
        lambda repository, settings: SimpleNamespace(
            resolve_chat_runtime_binding=AsyncMock(
                return_value=SimpleNamespace(
                    provider_type="ollama",
                    model_name="llama3.1",
                    source="model_endpoint",
                    model_endpoint_name="Local Ollama Chat",
                    api_base_url="http://127.0.0.1:11434",
                )
            )
        ),
    )
    response = await build_health_response(SimpleNamespace())
    assert response.status == "ok"
    assert response.service == "ragpilot-api"
    assert response.retrieval_engine == "native"
    assert response.agent_runtime_engine == "native"
    assert response.llamaindex_pilot_ready is True
    assert response.langgraph_pilot_ready is False
    assert response.chat_model_provider == "deterministic"
    assert response.chat_model_name == "ragpilot-grounded-template"
    assert response.effective_chat_model_provider == "ollama"
    assert response.effective_chat_model_name == "llama3.1"
    assert response.effective_chat_model_source == "model_endpoint"
    assert response.effective_chat_model_endpoint_name == "Local Ollama Chat"
    assert response.effective_chat_model_api_base_url == "http://127.0.0.1:11434"


@pytest.mark.anyio
async def test_health_builder_normalizes_reserved_langgraph_alias(monkeypatch) -> None:
    monkeypatch.setattr(
        "ragpilot_api.application.system.health_service.build_runtime_readiness_snapshot",
        lambda: type(
            "RuntimeReadinessSnapshot",
            (),
            {
                "llamaindex_pilot_ready": False,
                "langgraph_pilot_ready": True,
            },
        )(),
    )
    monkeypatch.setattr(
        "ragpilot_api.application.system.health_service.get_settings",
        lambda: SimpleNamespace(
            service_name="ragpilot-api",
            environment="local",
            retrieval_engine="native",
            agent_runtime_engine="langgraph_reserved",
            chat_model_provider="deterministic",
            chat_model_name="ragpilot-grounded-template",
        ),
    )
    monkeypatch.setattr(
        "ragpilot_api.application.system.health_service.RuntimeBindingResolver",
        lambda repository, settings: SimpleNamespace(
            resolve_chat_runtime_binding=AsyncMock(
                return_value=SimpleNamespace(
                    provider_type="deterministic",
                    model_name="ragpilot-grounded-template",
                    source="settings",
                    model_endpoint_name=None,
                    api_base_url=None,
                )
            )
        ),
    )

    response = await build_health_response(SimpleNamespace())

    assert response.agent_runtime_engine == "langgraph_pilot"
