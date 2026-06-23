import os
from datetime import datetime, timezone
from uuid import UUID

import httpx

from ragpilot_api.application.errors import ResourceConflictError, ResourceNotFoundError
from ragpilot_api.contracts.http.model_endpoint_contracts import (
    ModelCredentialGovernanceBreakdownResponse,
    ModelEndpointPreviewResponse,
    ModelGovernanceSummaryResponse,
)
from ragpilot_api.contracts.http.model_endpoint_contracts import (
    ModelEndpointCreateRequest,
    ModelProviderGovernanceBreakdownResponse,
    ModelEndpointResponse,
    ModelEndpointUpdateRequest,
)
from ragpilot_api.infrastructure.model_gateway.ollama_provider import OllamaChatProvider
from ragpilot_api.infrastructure.model_gateway.openai_compatible_provider import OpenAICompatibleChatProvider
from ragpilot_api.infrastructure.database.models import ModelEndpoint
from ragpilot_api.infrastructure.database.repositories.agent_repository import AgentRepository
from ragpilot_api.infrastructure.database.repositories.model_endpoint_repository import ModelEndpointRepository
from ragpilot_api.shared.settings import Settings


def normalize_model_endpoint_provider_name(provider_name: str) -> str:
    normalized = provider_name.strip().lower()
    if normalized == "vllm_reserved":
        return "vllm"
    return normalized


class ModelRegistryService:
    def __init__(
        self,
        model_endpoint_repository: ModelEndpointRepository,
        agent_repository: AgentRepository,
        settings: Settings,
    ) -> None:
        self.model_endpoint_repository = model_endpoint_repository
        self.agent_repository = agent_repository
        self.settings = settings

    async def create_model_endpoint(self, request: ModelEndpointCreateRequest) -> ModelEndpointResponse:
        model_endpoint = await self.model_endpoint_repository.create_model_endpoint(
            name=request.name,
            slug=request.slug,
            provider_type=request.provider_type,
            model_name=request.model_name,
            base_url=request.base_url,
            credential_mode=request.credential_mode,
            credential_key_hint=request.credential_key_hint,
            capabilities=normalize_capabilities(request.capabilities),
            is_enabled=request.is_enabled,
            is_default=request.is_default,
            notes=request.notes,
        )
        return build_model_endpoint_response(model_endpoint)

    async def list_model_endpoints(
        self,
        *,
        provider_type: str | None = None,
        is_enabled: bool | None = None,
        runtime_state: str | None = None,
        query: str | None = None,
    ) -> list[ModelEndpointResponse]:
        model_endpoints = await self.model_endpoint_repository.list_model_endpoints(
            provider_type=provider_type,
            is_enabled=is_enabled,
            query=query,
        )
        binding_counts = await self.agent_repository.list_model_endpoint_binding_counts()
        responses = [
            build_model_endpoint_response(
                model_endpoint,
                bound_agent_count=binding_counts.get(str(model_endpoint.id), 0),
            )
            for model_endpoint in model_endpoints
        ]
        if runtime_state is None:
            return responses
        return [response for response in responses if self._matches_model_runtime_state(response, runtime_state)]

    async def update_model_endpoint(
        self,
        *,
        model_endpoint_id: UUID,
        request: ModelEndpointUpdateRequest,
    ) -> ModelEndpointResponse | None:
        model_endpoint = await self.model_endpoint_repository.update_model_endpoint(
            model_endpoint_id=model_endpoint_id,
            name=request.name,
            slug=request.slug,
            provider_type=request.provider_type,
            model_name=request.model_name,
            base_url=request.base_url,
            credential_mode=request.credential_mode,
            credential_key_hint=request.credential_key_hint,
            capabilities=normalize_capabilities(request.capabilities),
            is_enabled=request.is_enabled,
            is_default=request.is_default,
            notes=request.notes,
        )
        if model_endpoint is None:
            return None
        bound_agent_count = await self.agent_repository.count_agents_using_model_endpoint(
            model_endpoint_id=model_endpoint.id
        )
        return build_model_endpoint_response(model_endpoint, bound_agent_count=bound_agent_count)

    async def delete_model_endpoint(self, *, model_endpoint_id: UUID) -> bool:
        bound_agent_count = await self.agent_repository.count_agents_using_model_endpoint(
            model_endpoint_id=model_endpoint_id
        )
        if bound_agent_count > 0:
            noun = "agent" if bound_agent_count == 1 else "agents"
            raise ResourceConflictError(
                f"Model endpoint is still assigned to {bound_agent_count} {noun}. Remove those agent bindings before deleting it."
            )
        return await self.model_endpoint_repository.delete_model_endpoint(model_endpoint_id=model_endpoint_id)

    async def get_model_governance_summary(self) -> ModelGovernanceSummaryResponse:
        model_endpoints = await self.model_endpoint_repository.list_model_endpoints()
        binding_counts = await self.agent_repository.list_model_endpoint_binding_counts()

        provider_breakdown: dict[str, ModelProviderGovernanceBreakdownResponse] = {
            "deterministic": ModelProviderGovernanceBreakdownResponse(provider_type="deterministic"),
            "openai_compatible": ModelProviderGovernanceBreakdownResponse(provider_type="openai_compatible"),
            "ollama": ModelProviderGovernanceBreakdownResponse(provider_type="ollama"),
            "ollama_reserved": ModelProviderGovernanceBreakdownResponse(provider_type="ollama_reserved"),
            "vllm": ModelProviderGovernanceBreakdownResponse(provider_type="vllm"),
            "vllm_reserved": ModelProviderGovernanceBreakdownResponse(provider_type="vllm_reserved"),
        }
        credential_breakdown: dict[str, ModelCredentialGovernanceBreakdownResponse] = {
            "none": ModelCredentialGovernanceBreakdownResponse(credential_mode="none"),
            "environment": ModelCredentialGovernanceBreakdownResponse(credential_mode="environment"),
            "managed_reserved": ModelCredentialGovernanceBreakdownResponse(credential_mode="managed_reserved"),
        }
        summary = ModelGovernanceSummaryResponse()

        for model_endpoint in model_endpoints:
            bound_agent_count = binding_counts.get(str(model_endpoint.id), 0)
            is_bound = bound_agent_count > 0
            requires_base_url = normalize_model_endpoint_provider_name(model_endpoint.provider_type) != "deterministic"
            has_base_url = bool((model_endpoint.base_url or "").strip())
            has_credential_hint = bool((model_endpoint.credential_key_hint or "").strip())
            credential_mode = model_endpoint.credential_mode
            is_runtime_ready = model_endpoint.is_enabled and self._is_model_runtime_configured(
                provider_type=model_endpoint.provider_type,
                base_url=model_endpoint.base_url,
                credential_mode=credential_mode,
                credential_key_hint=model_endpoint.credential_key_hint,
            )

            summary.total_endpoints += 1
            if model_endpoint.is_enabled:
                summary.enabled_endpoints += 1
            else:
                summary.disabled_endpoints += 1
            if is_bound:
                summary.bound_endpoints += 1
            if model_endpoint.is_default:
                summary.default_endpoints += 1
                if model_endpoint.is_enabled:
                    summary.enabled_default_endpoints += 1
            if is_bound and not model_endpoint.is_enabled:
                summary.disabled_bound_endpoints += 1
            if is_runtime_ready:
                summary.runtime_ready_endpoints += 1
            if requires_base_url and not has_base_url:
                summary.missing_base_url_endpoints += 1

            if credential_mode == "environment":
                summary.environment_credential_endpoints += 1
                if not has_credential_hint:
                    summary.missing_credential_hint_endpoints += 1
            elif credential_mode == "managed_reserved":
                summary.managed_reserved_credential_endpoints += 1
            else:
                summary.no_credential_endpoints += 1

            normalized_provider = normalize_model_endpoint_provider_name(model_endpoint.provider_type)
            if normalized_provider == "deterministic":
                summary.deterministic_endpoints += 1
            elif normalized_provider == "ollama":
                summary.ollama_endpoints += 1
            elif normalized_provider == "vllm":
                summary.vllm_endpoints += 1
            else:
                summary.openai_compatible_endpoints += 1

            provider_entry = provider_breakdown[model_endpoint.provider_type]
            provider_entry.total_endpoints += 1
            if model_endpoint.is_enabled:
                provider_entry.enabled_endpoints += 1
            if is_bound:
                provider_entry.bound_endpoints += 1
            if model_endpoint.is_default:
                provider_entry.default_endpoints += 1
            if is_runtime_ready:
                provider_entry.runtime_ready_endpoints += 1

            credential_entry = credential_breakdown[credential_mode]
            credential_entry.total_endpoints += 1
            if model_endpoint.is_enabled:
                credential_entry.enabled_endpoints += 1
            if self._is_model_runtime_configured(
                provider_type=model_endpoint.provider_type,
                base_url=model_endpoint.base_url,
                credential_mode=credential_mode,
                credential_key_hint=model_endpoint.credential_key_hint,
            ):
                credential_entry.configured_endpoints += 1

        summary.provider_breakdown = list(provider_breakdown.values())
        summary.credential_breakdown = list(credential_breakdown.values())
        return summary

    async def preview_model_endpoint(self, *, model_endpoint_id: UUID) -> ModelEndpointPreviewResponse:
        model_endpoint = await self.model_endpoint_repository.get_model_endpoint(model_endpoint_id=model_endpoint_id)
        if model_endpoint is None:
            raise ResourceNotFoundError("Model endpoint not found.")

        capabilities = normalize_capabilities(list(model_endpoint.capabilities_json or []))
        if not model_endpoint.is_enabled:
            return build_model_endpoint_preview_response(
                model_endpoint,
                preview_status="blocked",
                summary="Model endpoint is disabled and cannot be previewed.",
                error_message="Enable this model endpoint before running a preview.",
                request_metadata={"provider_type": model_endpoint.provider_type},
            )
        if capabilities and "chat" not in capabilities:
            return build_model_endpoint_preview_response(
                model_endpoint,
                preview_status="blocked",
                summary="Model endpoint does not expose chat capability.",
                error_message="Preview currently requires chat capability on the selected model endpoint.",
                request_metadata={"provider_type": model_endpoint.provider_type, "capabilities": capabilities},
            )

        provider_name = normalize_model_endpoint_provider_name(model_endpoint.provider_type)
        preview_messages = [
            {"role": "system", "content": "Reply with one short sentence that includes READY and the active model name."},
            {"role": "user", "content": "Preview this model endpoint."},
        ]
        request_metadata = {
            "provider_type": provider_name,
            "base_url": model_endpoint.base_url,
            "credential_mode": model_endpoint.credential_mode,
            "credential_key_hint": model_endpoint.credential_key_hint,
            "message_count": len(preview_messages),
        }

        if provider_name == "deterministic":
            return build_model_endpoint_preview_response(
                model_endpoint,
                preview_status="completed",
                summary="Deterministic provider is ready for local preview.",
                response_excerpt=f"READY {model_endpoint.model_name}",
                request_metadata=request_metadata,
                response_metadata={"provider": "deterministic"},
            )

        if provider_name == "ollama":
            if not model_endpoint.base_url:
                return build_model_endpoint_preview_response(
                    model_endpoint,
                    preview_status="blocked",
                    summary="Ollama preview requires a base URL.",
                    error_message="Set the Ollama base URL before running a preview.",
                    request_metadata=request_metadata,
                )
            provider = OllamaChatProvider(
                provider_label=provider_name,
                model_name=model_endpoint.model_name,
                api_base_url=model_endpoint.base_url,
                request_timeout_seconds=self.settings.chat_model_request_timeout_seconds,
            )
            try:
                result = await provider.generate_chat_completion(messages=preview_messages)
            except httpx.HTTPError as error:
                return build_model_endpoint_preview_response(
                    model_endpoint,
                    preview_status="failed",
                    summary="Ollama preview request failed.",
                    error_message=str(error),
                    request_metadata=request_metadata,
                )
            return build_model_endpoint_preview_response(
                model_endpoint,
                preview_status="completed",
                summary="Ollama preview completed successfully.",
                response_excerpt=result.content,
                request_metadata=request_metadata,
                response_metadata=result.usage_json,
            )

        if provider_name in {"openai_compatible", "ollama_reserved", "vllm"}:
            if not model_endpoint.base_url:
                return build_model_endpoint_preview_response(
                    model_endpoint,
                    preview_status="blocked",
                    summary="Model endpoint preview requires a base URL.",
                    error_message="Set the model endpoint base URL before running a preview.",
                    request_metadata=request_metadata,
                )

            api_key = self._resolve_api_key(
                credential_mode=model_endpoint.credential_mode,
                credential_key_hint=model_endpoint.credential_key_hint,
            )
            if model_endpoint.credential_mode == "managed_reserved":
                return build_model_endpoint_preview_response(
                    model_endpoint,
                    preview_status="blocked",
                    summary="Managed credential mode is reserved and cannot be previewed yet.",
                    error_message="Switch to environment or no-credential mode before previewing this model endpoint.",
                    request_metadata=request_metadata,
                )
            if model_endpoint.credential_mode == "environment" and not api_key:
                return build_model_endpoint_preview_response(
                    model_endpoint,
                    preview_status="blocked",
                    summary="Environment credential is not available for preview.",
                    error_message="The configured credential environment variable is missing or empty.",
                    request_metadata=request_metadata,
                )
            provider = OpenAICompatibleChatProvider(
                provider_label=provider_name,
                model_name=model_endpoint.model_name,
                api_base_url=model_endpoint.base_url,
                api_key=api_key,
                request_timeout_seconds=self.settings.chat_model_request_timeout_seconds,
            )
            try:
                result = await provider.generate_chat_completion(messages=preview_messages)
            except httpx.HTTPError as error:
                return build_model_endpoint_preview_response(
                    model_endpoint,
                    preview_status="failed",
                    summary="OpenAI-compatible preview request failed.",
                    error_message=str(error),
                    request_metadata=request_metadata,
                )
            return build_model_endpoint_preview_response(
                model_endpoint,
                preview_status="completed",
                summary=(
                    "vLLM preview completed successfully."
                    if provider_name == "vllm"
                    else "Model endpoint preview completed successfully."
                ),
                response_excerpt=result.content,
                request_metadata=request_metadata,
                response_metadata=result.usage_json,
            )

        return build_model_endpoint_preview_response(
            model_endpoint,
            preview_status="failed",
            summary="Model endpoint provider is not supported for preview.",
            error_message=f"Unsupported provider type: {model_endpoint.provider_type}",
            request_metadata=request_metadata,
        )

    def _resolve_api_key(
        self,
        *,
        credential_mode: str,
        credential_key_hint: str | None,
    ) -> str | None:
        normalized_mode = credential_mode.strip().lower()
        if normalized_mode == "none":
            return None
        if normalized_mode == "environment":
            if credential_key_hint is None or credential_key_hint.strip() == "":
                return None
            resolved = os.getenv(credential_key_hint.strip())
            return resolved.strip() if resolved and resolved.strip() else None
        if normalized_mode == "managed_reserved":
            return None
        return None

    def _is_model_runtime_configured(
        self,
        *,
        provider_type: str,
        base_url: str | None,
        credential_mode: str,
        credential_key_hint: str | None,
    ) -> bool:
        normalized_provider = normalize_model_endpoint_provider_name(provider_type)
        normalized_credential_mode = credential_mode.strip().lower()
        has_base_url = bool((base_url or "").strip())
        has_credential_hint = bool((credential_key_hint or "").strip())

        if normalized_provider == "deterministic":
            return True
        if not has_base_url:
            return False
        if normalized_credential_mode == "managed_reserved":
            return False
        if normalized_credential_mode == "environment" and not has_credential_hint:
            return False
        return True

    def _matches_model_runtime_state(
        self,
        model_endpoint: ModelEndpointResponse,
        runtime_state: str,
    ) -> bool:
        normalized_provider = normalize_model_endpoint_provider_name(model_endpoint.provider_type)
        requires_base_url = normalized_provider != "deterministic"
        has_base_url = bool((model_endpoint.base_url or "").strip())
        has_credential_hint = bool((model_endpoint.credential_key_hint or "").strip())
        is_runtime_ready = model_endpoint.is_enabled and self._is_model_runtime_configured(
            provider_type=model_endpoint.provider_type,
            base_url=model_endpoint.base_url,
            credential_mode=model_endpoint.credential_mode,
            credential_key_hint=model_endpoint.credential_key_hint,
        )

        if runtime_state == "disabled_bound":
            return (not model_endpoint.is_enabled) and model_endpoint.bound_agent_count > 0
        if runtime_state == "managed_reserved":
            return model_endpoint.credential_mode == "managed_reserved"
        if runtime_state == "missing_base_url":
            return requires_base_url and not has_base_url
        if runtime_state == "missing_credential_hint":
            return model_endpoint.credential_mode == "environment" and not has_credential_hint
        if runtime_state == "runtime_ready":
            return is_runtime_ready
        return False


def normalize_capabilities(capabilities: list[str]) -> list[str]:
    normalized_capabilities: list[str] = []
    for capability in capabilities:
        normalized_capability = capability.strip().lower()
        if normalized_capability and normalized_capability not in normalized_capabilities:
            normalized_capabilities.append(normalized_capability)
    return normalized_capabilities


def build_model_endpoint_response(model_endpoint: ModelEndpoint, *, bound_agent_count: int = 0) -> ModelEndpointResponse:
    return ModelEndpointResponse(
        id=model_endpoint.id,
        name=model_endpoint.name,
        slug=model_endpoint.slug,
        provider_type=model_endpoint.provider_type,
        model_name=model_endpoint.model_name,
        base_url=model_endpoint.base_url,
        credential_mode=model_endpoint.credential_mode,
        credential_key_hint=model_endpoint.credential_key_hint,
        capabilities=list(model_endpoint.capabilities_json or []),
        is_enabled=model_endpoint.is_enabled,
        is_default=model_endpoint.is_default,
        notes=model_endpoint.notes,
        bound_agent_count=bound_agent_count,
        created_at=model_endpoint.created_at,
        updated_at=model_endpoint.updated_at,
    )


def build_model_endpoint_preview_response(
    model_endpoint: ModelEndpoint,
    *,
    preview_status: str,
    summary: str,
    response_excerpt: str | None = None,
    request_metadata: dict[str, object] | None = None,
    response_metadata: dict[str, object] | None = None,
    error_message: str | None = None,
) -> ModelEndpointPreviewResponse:
    return ModelEndpointPreviewResponse(
        model_endpoint_id=model_endpoint.id,
        name=model_endpoint.name,
        slug=model_endpoint.slug,
        provider_type=model_endpoint.provider_type,
        model_name=model_endpoint.model_name,
        preview_status=preview_status,
        summary=summary,
        response_excerpt=response_excerpt,
        request_metadata=request_metadata or {},
        response_metadata=response_metadata or {},
        error_message=error_message,
        executed_at=datetime.now(timezone.utc),
    )
