from __future__ import annotations

import os

from ragpilot_api.application.errors import ResourceConflictError
from ragpilot_api.application.model_gateway.contracts import RuntimeModelBinding
from ragpilot_api.infrastructure.database.repositories.model_endpoint_repository import ModelEndpointRepository
from ragpilot_api.shared.settings import Settings


class RuntimeBindingResolver:
    def __init__(
        self,
        model_endpoint_repository: ModelEndpointRepository,
        settings: Settings,
    ) -> None:
        self.model_endpoint_repository = model_endpoint_repository
        self.settings = settings

    async def resolve_chat_runtime_binding(
        self,
        *,
        agent_definition,
    ) -> RuntimeModelBinding:
        configured_model_endpoint_id = getattr(agent_definition, "model_endpoint_id", None)

        if configured_model_endpoint_id is None:
            return await self._resolve_default_or_settings_binding()

        configured_model_endpoint = await self.model_endpoint_repository.get_model_endpoint(
            model_endpoint_id=configured_model_endpoint_id
        )
        if configured_model_endpoint is None:
            return await self._resolve_fallback_binding(
                configured_model_endpoint_id=configured_model_endpoint_id,
                configured_model_endpoint_name=None,
                fallback_reason="configured_model_endpoint_missing",
            )

        try:
            return self._build_model_endpoint_binding(configured_model_endpoint)
        except ResourceConflictError as error:
            return await self._resolve_fallback_binding(
                configured_model_endpoint_id=configured_model_endpoint.id,
                configured_model_endpoint_name=configured_model_endpoint.name,
                fallback_reason=self._normalize_runtime_failure_reason(str(error)),
            )

    async def _resolve_default_or_settings_binding(self) -> RuntimeModelBinding:
        default_model_endpoint = await self.model_endpoint_repository.get_default_model_endpoint()
        if default_model_endpoint is None:
            return self._build_settings_binding(source="settings")

        try:
            return self._build_model_endpoint_binding(default_model_endpoint)
        except ResourceConflictError as error:
            return self._build_settings_binding(
                source="settings_fallback",
                configured_model_endpoint_id=default_model_endpoint.id,
                configured_model_endpoint_name=default_model_endpoint.name,
                fallback_applied=True,
                fallback_reason=self._normalize_runtime_failure_reason(str(error)),
            )

    async def _resolve_fallback_binding(
        self,
        *,
        configured_model_endpoint_id,
        configured_model_endpoint_name,
        fallback_reason: str,
    ) -> RuntimeModelBinding:
        default_model_endpoint = await self.model_endpoint_repository.get_default_model_endpoint()
        if (
            default_model_endpoint is not None
            and default_model_endpoint.id != configured_model_endpoint_id
        ):
            try:
                return self._build_model_endpoint_binding(
                    default_model_endpoint,
                    configured_model_endpoint_id=configured_model_endpoint_id,
                    configured_model_endpoint_name=configured_model_endpoint_name,
                    fallback_applied=True,
                    fallback_reason=f"{fallback_reason}:default_model_endpoint",
                )
            except ResourceConflictError:
                pass

        return self._build_settings_binding(
            source="settings_fallback",
            configured_model_endpoint_id=configured_model_endpoint_id,
            configured_model_endpoint_name=configured_model_endpoint_name,
            fallback_applied=True,
            fallback_reason=f"{fallback_reason}:settings",
        )

    def _build_model_endpoint_binding(
        self,
        model_endpoint,
        *,
        configured_model_endpoint_id=None,
        configured_model_endpoint_name: str | None = None,
        fallback_applied: bool = False,
        fallback_reason: str | None = None,
    ) -> RuntimeModelBinding:
        if not model_endpoint.is_enabled:
            raise ResourceConflictError("The selected runtime model endpoint is disabled.")

        capabilities = {capability.strip().lower() for capability in list(model_endpoint.capabilities_json or []) if capability}
        if capabilities and "chat" not in capabilities:
            raise ResourceConflictError("The selected runtime model endpoint does not support chat generation.")

        if not self._is_model_endpoint_runtime_ready(model_endpoint):
            raise ResourceConflictError("The selected runtime model endpoint is not fully configured.")

        return RuntimeModelBinding(
            provider_type=model_endpoint.provider_type,
            model_name=model_endpoint.model_name,
            source="model_endpoint",
            model_endpoint_id=model_endpoint.id,
            model_endpoint_name=model_endpoint.name,
            api_base_url=model_endpoint.base_url,
            api_key=self._resolve_api_key(
                credential_mode=model_endpoint.credential_mode,
                credential_key_hint=model_endpoint.credential_key_hint,
            ),
            request_timeout_seconds=self.settings.chat_model_request_timeout_seconds,
            configured_model_endpoint_id=configured_model_endpoint_id,
            configured_model_endpoint_name=configured_model_endpoint_name,
            fallback_applied=fallback_applied,
            fallback_reason=fallback_reason,
        )

    def _build_settings_binding(
        self,
        *,
        source: str,
        configured_model_endpoint_id=None,
        configured_model_endpoint_name: str | None = None,
        fallback_applied: bool = False,
        fallback_reason: str | None = None,
    ) -> RuntimeModelBinding:
        return RuntimeModelBinding(
            provider_type=self.settings.chat_model_provider.strip().lower(),
            model_name=self.settings.chat_model_name,
            source=source,
            api_base_url=self.settings.chat_model_api_base_url,
            api_key=self.settings.chat_model_api_key,
            request_timeout_seconds=self.settings.chat_model_request_timeout_seconds,
            configured_model_endpoint_id=configured_model_endpoint_id,
            configured_model_endpoint_name=configured_model_endpoint_name,
            fallback_applied=fallback_applied,
            fallback_reason=fallback_reason,
        )

    def _is_model_endpoint_runtime_ready(self, model_endpoint) -> bool:
        provider_type = model_endpoint.provider_type.strip().lower()
        if provider_type == "vllm_reserved":
            provider_type = "vllm"
        has_base_url = bool((model_endpoint.base_url or "").strip())
        credential_mode = model_endpoint.credential_mode.strip().lower()
        has_credential_hint = bool((model_endpoint.credential_key_hint or "").strip())

        if provider_type == "deterministic":
            return True
        if not has_base_url:
            return False
        if credential_mode == "managed_reserved":
            return False
        if credential_mode == "environment" and not has_credential_hint:
            return False
        return True

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
            return os.getenv(credential_key_hint.strip())

        if normalized_mode == "managed_reserved":
            return None

        raise ResourceConflictError(f"Unsupported credential mode: {credential_mode}")

    def _normalize_runtime_failure_reason(self, message: str) -> str:
        lowered = message.strip().lower()
        if "disabled" in lowered:
            return "model_endpoint_disabled"
        if "does not support chat" in lowered:
            return "model_endpoint_missing_chat_capability"
        if "not fully configured" in lowered:
            return "model_endpoint_not_runtime_ready"
        if "unsupported credential mode" in lowered:
            return "model_endpoint_unsupported_credential_mode"
        return "model_endpoint_unavailable"
