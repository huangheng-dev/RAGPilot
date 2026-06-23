import asyncio
from unittest.mock import AsyncMock, patch

from ragpilot_api.application.model_gateway.contracts import RuntimeModelBinding
from ragpilot_api.application.model_gateway.model_gateway import ModelGateway
from ragpilot_api.application.model_gateway.prompt_builder import build_grounded_chat_messages
from ragpilot_api.shared.settings import Settings


def test_grounded_prompt_builder_includes_context() -> None:
    messages = build_grounded_chat_messages(
        question="Which system handles durable ingestion workflows?",
        retrieval_results=[
            {
                "document_title": "Smoke Document",
                "chunk_index": 0,
                "content": "RagPilot uses Temporal for durable ingestion workflows.",
            }
        ],
    )
    assert messages[1]["content"].find("Temporal") >= 0
    assert messages[1]["content"].find("Smoke Document") >= 0


def test_deterministic_model_gateway_returns_grounded_answer() -> None:
    gateway = ModelGateway(
        Settings(
            chat_model_provider="deterministic",
            chat_model_name="ragpilot-grounded-template",
        )
    )
    result = asyncio.run(
        gateway.generate_grounded_answer(
            question="Which system handles durable ingestion workflows?",
            retrieval_results=[
                {
                    "document_title": "Smoke Document",
                    "content": "RagPilot uses Temporal for durable ingestion workflows.",
                    "chunk_index": 0,
                }
            ],
        )
    )
    assert result.model_name == "ragpilot-grounded-template"
    assert "Temporal" in result.content
    assert result.usage_json["provider"] == "deterministic"


def test_model_gateway_allows_runtime_binding_override() -> None:
    gateway = ModelGateway(
        Settings(
            chat_model_provider="deterministic",
            chat_model_name="settings-default-model",
        )
    )
    result = asyncio.run(
        gateway.generate_grounded_answer(
            question="Which system handles durable ingestion workflows?",
            retrieval_results=[
                {
                    "document_title": "Smoke Document",
                    "content": "RagPilot uses Temporal for durable ingestion workflows.",
                    "chunk_index": 0,
                }
            ],
            runtime_binding=RuntimeModelBinding(
                provider_type="deterministic",
                model_name="agent-bound-runtime",
                source="model_endpoint",
            ),
        )
    )
    assert result.model_name == "agent-bound-runtime"
    assert result.usage_json["runtime_binding"]["source"] == "model_endpoint"


def test_model_gateway_routes_ollama_bindings_to_native_ollama_provider() -> None:
    gateway = ModelGateway(
        Settings(
            chat_model_provider="deterministic",
            chat_model_name="settings-default-model",
        )
    )

    with patch(
        "ragpilot_api.application.model_gateway.model_gateway.OllamaChatProvider.generate_chat_completion",
        new=AsyncMock(
            return_value=type(
                "OllamaResult",
                (),
                {
                    "content": "Temporal handles durable ingestion workflows.",
                    "model_name": "llama3.1",
                    "usage_json": {
                        "provider": "ollama",
                        "usage": {"prompt_eval_count": 12, "eval_count": 32},
                        "finish_reason": "stop",
                    },
                },
            )()
        ),
    ) as mocked_generate:
        result = asyncio.run(
            gateway.generate_grounded_answer(
                question="Which system handles durable ingestion workflows?",
                retrieval_results=[
                    {
                        "document_title": "Smoke Document",
                        "content": "RagPilot uses Temporal for durable ingestion workflows.",
                        "chunk_index": 0,
                    }
                ],
                runtime_binding=RuntimeModelBinding(
                    provider_type="ollama",
                    model_name="llama3.1",
                    source="model_endpoint",
                    api_base_url="http://127.0.0.1:11434",
                ),
            )
        )

    assert result.model_name == "llama3.1"
    assert "Temporal" in result.content
    assert result.usage_json["provider"] == "ollama"
    assert result.usage_json["runtime_binding"]["provider_type"] == "ollama"
    mocked_generate.assert_awaited_once()


def test_model_gateway_routes_vllm_bindings_through_openai_compatible_provider() -> None:
    gateway = ModelGateway(
        Settings(
            chat_model_provider="deterministic",
            chat_model_name="settings-default-model",
        )
    )

    with patch(
        "ragpilot_api.application.model_gateway.model_gateway.OpenAICompatibleChatProvider.generate_chat_completion",
        new=AsyncMock(
            return_value=type(
                "OpenAICompatibleResult",
                (),
                {
                    "content": "Temporal handles durable ingestion workflows.",
                    "model_name": "meta-llama/Llama-3.1-8B-Instruct",
                    "usage_json": {
                        "provider": "vllm",
                        "usage": {"prompt_tokens": 12, "completion_tokens": 18},
                        "finish_reason": "stop",
                    },
                },
            )()
        ),
    ) as mocked_generate:
        result = asyncio.run(
            gateway.generate_grounded_answer(
                question="Which system handles durable ingestion workflows?",
                retrieval_results=[
                    {
                        "document_title": "Smoke Document",
                        "content": "RagPilot uses Temporal for durable ingestion workflows.",
                        "chunk_index": 0,
                    }
                ],
                runtime_binding=RuntimeModelBinding(
                    provider_type="vllm",
                    model_name="meta-llama/Llama-3.1-8B-Instruct",
                    source="model_endpoint",
                    api_base_url="http://127.0.0.1:8001/v1",
                ),
            )
        )

    assert result.model_name == "meta-llama/Llama-3.1-8B-Instruct"
    assert "Temporal" in result.content
    assert result.usage_json["provider"] == "vllm"
    assert result.usage_json["runtime_binding"]["provider_type"] == "vllm"
    mocked_generate.assert_awaited_once()
