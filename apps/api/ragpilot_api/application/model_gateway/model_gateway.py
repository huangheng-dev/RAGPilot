from __future__ import annotations

from ragpilot_api.application.model_gateway.contracts import ChatGenerationResult, RuntimeModelBinding
from ragpilot_api.application.model_gateway.prompt_builder import build_grounded_chat_messages
from ragpilot_api.application.chat.response_builder import build_grounded_answer
from ragpilot_api.infrastructure.model_gateway.ollama_provider import OllamaChatProvider
from ragpilot_api.infrastructure.model_gateway.openai_compatible_provider import OpenAICompatibleChatProvider
from ragpilot_api.shared.settings import Settings
from ragpilot_api.infrastructure.observability import traced
from ragpilot_api.application.model_gateway.usage_accounting import account_model_usage
from time import perf_counter


def normalize_provider_name(provider_name: str) -> str:
    normalized = provider_name.strip().lower()
    if normalized == "vllm_reserved":
        return "vllm"
    return normalized


class ModelGateway:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    @traced("model.generate_grounded_answer")
    async def generate_grounded_answer(
        self,
        *,
        question: str,
        retrieval_results: list[dict],
        runtime_binding: RuntimeModelBinding | None = None,
        agent_name: str | None = None,
        agent_mode: str | None = None,
        agent_objective: str | None = None,
        agent_instructions: str | None = None,
        knowledge_base_scope: str | None = None,
    ) -> ChatGenerationResult:
        started_at = perf_counter()
        resolved_runtime_binding = runtime_binding or RuntimeModelBinding(
            provider_type=self.settings.chat_model_provider.strip().lower(),
            model_name=self.settings.chat_model_name,
            source="settings",
            api_base_url=self.settings.chat_model_api_base_url,
            api_key=self.settings.chat_model_api_key,
            request_timeout_seconds=self.settings.chat_model_request_timeout_seconds,
        )
        provider_name = normalize_provider_name(resolved_runtime_binding.provider_type)

        if provider_name == "deterministic":
            return self._account(ChatGenerationResult(
                content=build_grounded_answer(
                    question=question,
                    retrieval_results=retrieval_results,
                ),
                model_name=resolved_runtime_binding.model_name,
                usage_json={
                    "provider": "deterministic",
                    "runtime_binding": resolved_runtime_binding.to_usage_json(),
                    "retrieval_result_count": len(retrieval_results),
                },
            ), started_at=started_at)

        if provider_name == "ollama":
            if not resolved_runtime_binding.api_base_url:
                raise ValueError("A base URL is required for the ollama chat provider.")
            provider = OllamaChatProvider(
                provider_label=provider_name,
                model_name=resolved_runtime_binding.model_name,
                api_base_url=resolved_runtime_binding.api_base_url,
                request_timeout_seconds=resolved_runtime_binding.request_timeout_seconds,
                concurrency_limit=int(getattr(self.settings, "model_runtime_concurrency_limit", 8)),
                requests_per_minute=int(getattr(self.settings, "model_runtime_requests_per_minute", 120)),
                max_attempts=int(getattr(self.settings, "model_runtime_max_attempts", 2)),
                retryable_status_codes=getattr(self.settings, "model_runtime_retryable_status_code_set", {429, 502, 503, 504}),
                retry_backoff_seconds=float(getattr(self.settings, "model_runtime_retry_backoff_seconds", 0.25)),
            )
            result = await provider.generate_chat_completion(
                messages=build_grounded_chat_messages(
                    question=question,
                    retrieval_results=retrieval_results,
                    agent_name=agent_name,
                    agent_mode=agent_mode,
                    agent_objective=agent_objective,
                    agent_instructions=agent_instructions,
                    knowledge_base_scope=knowledge_base_scope,
                )
            )
            return self._account(ChatGenerationResult(
                content=result.content,
                model_name=result.model_name,
                usage_json={
                    **result.usage_json,
                    "runtime_binding": resolved_runtime_binding.to_usage_json(),
                },
            ), started_at=started_at)

        if provider_name in {"openai_compatible", "ollama_reserved", "vllm"}:
            if not resolved_runtime_binding.api_base_url:
                raise ValueError(f"A base URL is required for the {provider_name} chat provider.")
            provider = OpenAICompatibleChatProvider(
                provider_label=provider_name,
                model_name=resolved_runtime_binding.model_name,
                api_base_url=resolved_runtime_binding.api_base_url,
                api_key=resolved_runtime_binding.api_key,
                request_timeout_seconds=resolved_runtime_binding.request_timeout_seconds,
                concurrency_limit=int(getattr(self.settings, "model_runtime_concurrency_limit", 8)),
                requests_per_minute=int(getattr(self.settings, "model_runtime_requests_per_minute", 120)),
                max_attempts=int(getattr(self.settings, "model_runtime_max_attempts", 2)),
                retryable_status_codes=getattr(self.settings, "model_runtime_retryable_status_code_set", {429, 502, 503, 504}),
                retry_backoff_seconds=float(getattr(self.settings, "model_runtime_retry_backoff_seconds", 0.25)),
            )
            result = await provider.generate_chat_completion(
                messages=build_grounded_chat_messages(
                    question=question,
                    retrieval_results=retrieval_results,
                    agent_name=agent_name,
                    agent_mode=agent_mode,
                    agent_objective=agent_objective,
                    agent_instructions=agent_instructions,
                    knowledge_base_scope=knowledge_base_scope,
                )
            )
            return self._account(ChatGenerationResult(
                content=result.content,
                model_name=result.model_name,
                usage_json={
                    **result.usage_json,
                    "runtime_binding": resolved_runtime_binding.to_usage_json(),
                },
            ), started_at=started_at)

        raise ValueError(f"Unsupported chat model provider: {resolved_runtime_binding.provider_type}")

    def _account(self, result: ChatGenerationResult, *, started_at: float) -> ChatGenerationResult:
        return ChatGenerationResult(
            content=result.content,
            model_name=result.model_name,
            usage_json=account_model_usage(
                result.usage_json,
                latency_ms=(perf_counter() - started_at) * 1000,
                input_cost_per_1k_tokens_usd=float(getattr(self.settings, "model_input_cost_per_1k_tokens_usd", 0)),
                output_cost_per_1k_tokens_usd=float(getattr(self.settings, "model_output_cost_per_1k_tokens_usd", 0)),
            ),
        )
