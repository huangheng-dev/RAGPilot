import os
from datetime import datetime, timedelta, timezone
from uuid import UUID

import httpx

from ragpilot_api.application.mcp_connectors.mcp_connector_registry_service import (
    build_recent_preview_activity_by_resource_id,
)
from ragpilot_api.application.errors import ResourceConflictError, ResourceNotFoundError
from ragpilot_api.application.model_registry.runtime_configuration import (
    is_model_runtime_configured,
    model_provider_requires_base_url,
    normalize_model_endpoint_provider_name,
    read_model_runtime_configuration_issue,
)
from ragpilot_api.contracts.http.model_endpoint_contracts import (
    ModelCredentialGovernanceBreakdownResponse,
    ModelEndpointGovernanceActionResponse,
    ModelEndpointPreviewResponse,
    ModelGovernanceSummaryResponse,
    ModelProviderCompatibilityResponse,
    ModelProviderRuntimePostureResponse,
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
from ragpilot_api.infrastructure.database.repositories.runtime_governance_event_repository import RuntimeGovernanceEventRepository
from ragpilot_api.shared.settings import Settings
from ragpilot_api.application.runtime_governance.runtime_credential_service import RuntimeCredentialService


class ModelRegistryService:
    def __init__(
        self,
        model_endpoint_repository: ModelEndpointRepository,
        agent_repository: AgentRepository,
        settings: Settings,
        runtime_governance_event_repository: RuntimeGovernanceEventRepository | None = None,
        runtime_credential_service: RuntimeCredentialService | None = None,
    ) -> None:
        self.model_endpoint_repository = model_endpoint_repository
        self.agent_repository = agent_repository
        self.settings = settings
        self.runtime_governance_event_repository = runtime_governance_event_repository
        self.runtime_credential_service = runtime_credential_service

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
        preview_activity_by_model_endpoint_id = await self._build_recent_preview_activity_by_model_endpoint_id()
        responses = [
            build_model_endpoint_response(
                model_endpoint,
                bound_agent_count=binding_counts.get(str(model_endpoint.id), 0),
                preview_activity=preview_activity_by_model_endpoint_id.get(str(model_endpoint.id)),
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
        preview_activity_by_model_endpoint_id = await self._build_recent_preview_activity_by_model_endpoint_id()
        return build_model_endpoint_response(
            model_endpoint,
            bound_agent_count=bound_agent_count,
            preview_activity=preview_activity_by_model_endpoint_id.get(str(model_endpoint.id)),
        )

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

    async def apply_model_endpoint_governance_action(
        self,
        *,
        model_endpoint_id: UUID,
        action_type: str,
    ) -> ModelEndpointGovernanceActionResponse | None:
        model_endpoint = await self.model_endpoint_repository.get_model_endpoint(model_endpoint_id=model_endpoint_id)
        if model_endpoint is None:
            return None

        if action_type == "enable_endpoint":
            next_is_enabled = True
            next_is_default = model_endpoint.is_default
            summary = (
                "Model endpoint enabled for governed runtime routing."
                if not model_endpoint.is_enabled
                else "Model endpoint is already enabled."
            )
        elif action_type == "disable_endpoint":
            next_is_enabled = False
            next_is_default = model_endpoint.is_default
            summary = (
                "Model endpoint disabled until runtime governance follow-up is complete."
                if model_endpoint.is_enabled
                else "Model endpoint is already disabled."
            )
        elif action_type == "promote_default":
            if not model_endpoint.is_enabled:
                raise ResourceConflictError("Enable the model endpoint before promoting it as the governed default.")
            next_is_enabled = model_endpoint.is_enabled
            next_is_default = True
            summary = (
                "Model endpoint promoted as the governed default runtime."
                if not model_endpoint.is_default
                else "Model endpoint is already the governed default."
            )
        else:
            raise ResourceConflictError("Unsupported model endpoint governance action.")

        updated_model_endpoint = await self.model_endpoint_repository.update_model_endpoint(
            model_endpoint_id=model_endpoint_id,
            name=model_endpoint.name,
            slug=model_endpoint.slug,
            provider_type=model_endpoint.provider_type,
            model_name=model_endpoint.model_name,
            base_url=model_endpoint.base_url,
            credential_mode=model_endpoint.credential_mode,
            credential_key_hint=model_endpoint.credential_key_hint,
            capabilities=normalize_capabilities(list(model_endpoint.capabilities_json or [])),
            is_enabled=next_is_enabled,
            is_default=next_is_default,
            notes=model_endpoint.notes,
        )
        if updated_model_endpoint is None:
            return None

        bound_agent_count = await self.agent_repository.count_agents_using_model_endpoint(
            model_endpoint_id=updated_model_endpoint.id
        )
        return ModelEndpointGovernanceActionResponse(
            action_type=action_type,
            summary=summary,
            model_endpoint=build_model_endpoint_response(
                updated_model_endpoint,
                bound_agent_count=bound_agent_count,
                preview_activity=(await self._build_recent_preview_activity_by_model_endpoint_id()).get(
                    str(updated_model_endpoint.id)
                ),
            ),
        )

    async def get_model_governance_summary(self) -> ModelGovernanceSummaryResponse:
        model_endpoints = await self.model_endpoint_repository.list_model_endpoints()
        binding_counts = await self.agent_repository.list_model_endpoint_binding_counts()
        active_agent_definitions = await self.agent_repository.list_agent_definitions_for_governance(status="active")

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
        default_model_endpoint = self._resolve_default_model_endpoint(model_endpoints)

        for model_endpoint in model_endpoints:
            bound_agent_count = binding_counts.get(str(model_endpoint.id), 0)
            is_bound = bound_agent_count > 0
            requires_base_url = model_provider_requires_base_url(model_endpoint.provider_type)
            has_base_url = bool((model_endpoint.base_url or "").strip())
            has_credential_hint = bool((model_endpoint.credential_key_hint or "").strip())
            credential_mode = model_endpoint.credential_mode
            is_runtime_ready = model_endpoint.is_enabled and is_model_runtime_configured(
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
                if is_runtime_ready:
                    summary.runtime_ready_default_endpoints += 1
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
            if is_model_runtime_configured(
                provider_type=model_endpoint.provider_type,
                base_url=model_endpoint.base_url,
                credential_mode=credential_mode,
                credential_key_hint=model_endpoint.credential_key_hint,
            ):
                credential_entry.configured_endpoints += 1

        summary.provider_breakdown = list(provider_breakdown.values())
        summary.credential_breakdown = list(credential_breakdown.values())
        summary.provider_compatibility = self._build_provider_compatibility_summary()
        summary.provider_runtime_posture = await self._build_provider_runtime_posture_summary(
            model_endpoints=model_endpoints,
            binding_counts=binding_counts,
            active_agent_definitions=active_agent_definitions,
            default_model_endpoint=default_model_endpoint,
        )
        summary.settings_fallback_exposed = summary.runtime_ready_default_endpoints == 0
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
                concurrency_limit=int(getattr(self.settings, "model_runtime_concurrency_limit", 8)),
                requests_per_minute=int(getattr(self.settings, "model_runtime_requests_per_minute", 120)),
                max_attempts=int(getattr(self.settings, "model_runtime_max_attempts", 2)),
                retryable_status_codes=getattr(self.settings, "model_runtime_retryable_status_code_set", {429, 502, 503, 504}),
                retry_backoff_seconds=float(getattr(self.settings, "model_runtime_retry_backoff_seconds", 0.25)),
                redis_url=getattr(self.settings, "redis_url", None),
                redis_failure_mode=getattr(self.settings, "runtime_limit_redis_failure_mode", "local_fallback"),
                concurrency_lease_seconds=float(getattr(self.settings, "runtime_limit_concurrency_lease_seconds", 300)),
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

            api_key = await self._resolve_api_key(
                resource_id=model_endpoint.id,
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
                concurrency_limit=int(getattr(self.settings, "model_runtime_concurrency_limit", 8)),
                requests_per_minute=int(getattr(self.settings, "model_runtime_requests_per_minute", 120)),
                max_attempts=int(getattr(self.settings, "model_runtime_max_attempts", 2)),
                retryable_status_codes=getattr(self.settings, "model_runtime_retryable_status_code_set", {429, 502, 503, 504}),
                retry_backoff_seconds=float(getattr(self.settings, "model_runtime_retry_backoff_seconds", 0.25)),
                redis_url=getattr(self.settings, "redis_url", None),
                redis_failure_mode=getattr(self.settings, "runtime_limit_redis_failure_mode", "local_fallback"),
                concurrency_lease_seconds=float(getattr(self.settings, "runtime_limit_concurrency_lease_seconds", 300)),
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

    async def _resolve_api_key(
        self,
        *,
        resource_id: UUID,
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
        if normalized_mode == "managed_encrypted" and self.runtime_credential_service is not None:
            return await self.runtime_credential_service.resolve(resource_type="model_endpoint", resource_id=resource_id)
        return None

    def _matches_model_runtime_state(
        self,
        model_endpoint: ModelEndpointResponse,
        runtime_state: str,
    ) -> bool:
        is_runtime_ready = model_endpoint.is_enabled and is_model_runtime_configured(
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
            return read_model_runtime_configuration_issue(
                provider_type=model_endpoint.provider_type,
                base_url=model_endpoint.base_url,
                credential_mode=model_endpoint.credential_mode,
                credential_key_hint=model_endpoint.credential_key_hint,
            ) == "missing_base_url"
        if runtime_state == "missing_credential_hint":
            return read_model_runtime_configuration_issue(
                provider_type=model_endpoint.provider_type,
                base_url=model_endpoint.base_url,
                credential_mode=model_endpoint.credential_mode,
                credential_key_hint=model_endpoint.credential_key_hint,
            ) == "missing_credential_hint"
        if runtime_state == "runtime_ready":
            return is_runtime_ready
        return False

    def _resolve_default_model_endpoint(self, model_endpoints: list[ModelEndpoint]) -> ModelEndpoint | None:
        return next(
            (item for item in model_endpoints if item.is_enabled and item.is_default),
            next((item for item in model_endpoints if item.is_enabled), None),
        )

    async def _build_provider_runtime_posture_summary(
        self,
        *,
        model_endpoints: list[ModelEndpoint],
        binding_counts: dict[str, int],
        active_agent_definitions: list[object],
        default_model_endpoint: ModelEndpoint | None,
    ) -> list[ModelProviderRuntimePostureResponse]:
        posture_by_provider: dict[str, ModelProviderRuntimePostureResponse] = {
            "deterministic": ModelProviderRuntimePostureResponse(
                provider_type="deterministic",
                posture_status="setup_required",
            ),
            "openai_compatible": ModelProviderRuntimePostureResponse(
                provider_type="openai_compatible",
                posture_status="setup_required",
            ),
            "ollama": ModelProviderRuntimePostureResponse(
                provider_type="ollama",
                posture_status="setup_required",
            ),
            "vllm": ModelProviderRuntimePostureResponse(
                provider_type="vllm",
                posture_status="setup_required",
            ),
        }
        model_endpoint_by_id = {str(item.id): item for item in model_endpoints}
        if self.runtime_governance_event_repository is not None:
            recent_preview_events = await self.runtime_governance_event_repository.list_runtime_governance_events(
                resource_type="model_endpoint",
                created_after=datetime.now(timezone.utc).replace(microsecond=0)
                - timedelta(hours=max(self.settings.model_preview_review_window_hours, 1)),
                limit=200,
            )
            for event in recent_preview_events:
                if event.action_type not in {"preview_completed", "preview_blocked", "preview_failed"}:
                    continue
                provider_name = str(event.detail_json.get("provider_type") or "").strip().lower()
                if provider_name not in posture_by_provider:
                    continue
                posture = posture_by_provider[provider_name]
                if event.action_type == "preview_completed":
                    posture.recent_preview_completed_events += 1
                elif event.action_type == "preview_blocked":
                    posture.recent_preview_blocked_events += 1
                else:
                    posture.recent_preview_failed_events += 1
                if posture.last_preview_at is None or event.created_at >= posture.last_preview_at:
                    preview_status = str(event.detail_json.get("preview_status") or "").strip().lower()
                    if preview_status in {"completed", "blocked", "failed"}:
                        posture.last_preview_status = preview_status
                    posture.last_preview_at = event.created_at

        for model_endpoint in model_endpoints:
            normalized_provider = normalize_model_endpoint_provider_name(model_endpoint.provider_type)
            posture = posture_by_provider[normalized_provider]
            posture.total_endpoints += 1
            posture.bound_agent_count += binding_counts.get(str(model_endpoint.id), 0)
            if model_endpoint.is_enabled:
                posture.enabled_endpoints += 1
            if model_endpoint.is_default:
                posture.default_endpoints += 1

            runtime_issue = read_model_runtime_configuration_issue(
                provider_type=model_endpoint.provider_type,
                base_url=model_endpoint.base_url,
                credential_mode=model_endpoint.credential_mode,
                credential_key_hint=model_endpoint.credential_key_hint,
            )
            if runtime_issue == "missing_base_url":
                posture.missing_base_url_endpoints += 1
            elif runtime_issue == "missing_credential_hint":
                posture.missing_credential_hint_endpoints += 1

            is_runtime_ready = model_endpoint.is_enabled and runtime_issue is None
            if is_runtime_ready:
                posture.runtime_ready_endpoints += 1
                if model_endpoint.is_default:
                    posture.runtime_ready_default_endpoints += 1

        for agent_definition in active_agent_definitions:
            configured_model_endpoint = (
                model_endpoint_by_id.get(str(agent_definition.model_endpoint_id))
                if getattr(agent_definition, "model_endpoint_id", None) is not None
                else None
            )
            resolved_model_endpoint = configured_model_endpoint or default_model_endpoint
            if resolved_model_endpoint is None:
                continue

            normalized_provider = normalize_model_endpoint_provider_name(resolved_model_endpoint.provider_type)
            posture = posture_by_provider[normalized_provider]
            posture.active_agent_count += 1

            if (not resolved_model_endpoint.is_enabled) or not is_model_runtime_configured(
                provider_type=resolved_model_endpoint.provider_type,
                base_url=resolved_model_endpoint.base_url,
                credential_mode=resolved_model_endpoint.credential_mode,
                credential_key_hint=resolved_model_endpoint.credential_key_hint,
            ):
                posture.attention_active_agent_count += 1

        for posture in posture_by_provider.values():
            if posture.total_endpoints == 0:
                posture.posture_status = "setup_required"
            elif (
                posture.runtime_ready_endpoints == 0
                or posture.attention_active_agent_count > 0
                or posture.missing_base_url_endpoints > 0
                or posture.missing_credential_hint_endpoints > 0
                or posture.recent_preview_failed_events > 0
            ):
                posture.posture_status = "attention"
            else:
                posture.posture_status = "ready"

        return list(posture_by_provider.values())

    async def _build_recent_preview_activity_by_model_endpoint_id(self) -> dict[str, dict[str, object]]:
        if self.runtime_governance_event_repository is None:
            return {}

        recent_preview_events = await self.runtime_governance_event_repository.list_runtime_governance_events(
            resource_type="model_endpoint",
            action_types=["preview_completed", "preview_blocked", "preview_failed"],
            created_after=datetime.now(timezone.utc).replace(microsecond=0)
            - timedelta(hours=max(self.settings.model_preview_review_window_hours, 1)),
            limit=500,
        )
        return build_recent_preview_activity_by_resource_id(
            recent_preview_events,
            status_field_name="preview_status",
        )

    def _build_provider_compatibility_summary(self) -> list[ModelProviderCompatibilityResponse]:
        return [
            ModelProviderCompatibilityResponse(
                provider_type="deterministic",
                routing_style="builtin",
                requires_base_url=False,
                supports_no_credential=True,
                supports_environment_credential=False,
                supports_managed_reserved=False,
                preview_available=True,
                default_base_url_hint=None,
            ),
            ModelProviderCompatibilityResponse(
                provider_type="openai_compatible",
                routing_style="openai_compatible",
                requires_base_url=True,
                supports_no_credential=True,
                supports_environment_credential=True,
                supports_managed_reserved=True,
                preview_available=True,
                default_base_url_hint="https://api.openai.com/v1",
            ),
            ModelProviderCompatibilityResponse(
                provider_type="ollama",
                routing_style="native_http",
                requires_base_url=True,
                supports_no_credential=True,
                supports_environment_credential=False,
                supports_managed_reserved=False,
                preview_available=True,
                default_base_url_hint="http://127.0.0.1:11434",
            ),
            ModelProviderCompatibilityResponse(
                provider_type="vllm",
                routing_style="openai_compatible",
                requires_base_url=True,
                supports_no_credential=True,
                supports_environment_credential=True,
                supports_managed_reserved=True,
                preview_available=True,
                default_base_url_hint="http://127.0.0.1:8001/v1",
            ),
        ]


def normalize_capabilities(capabilities: list[str]) -> list[str]:
    normalized_capabilities: list[str] = []
    for capability in capabilities:
        normalized_capability = capability.strip().lower()
        if normalized_capability and normalized_capability not in normalized_capabilities:
            normalized_capabilities.append(normalized_capability)
    return normalized_capabilities


def build_model_endpoint_response(
    model_endpoint: ModelEndpoint,
    *,
    bound_agent_count: int = 0,
    preview_activity: dict[str, object] | None = None,
) -> ModelEndpointResponse:
    preview_activity = preview_activity or {}
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
        recent_preview_completed_events=int(preview_activity.get("completed", 0)),
        recent_preview_blocked_events=int(preview_activity.get("blocked", 0)),
        recent_preview_failed_events=int(preview_activity.get("failed", 0)),
        last_preview_status=preview_activity.get("last_status"),
        last_preview_at=preview_activity.get("last_at"),
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
