from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID


@dataclass(frozen=True)
class ChatGenerationResult:
    content: str
    model_name: str
    usage_json: dict


@dataclass(frozen=True)
class RuntimeModelBinding:
    provider_type: str
    model_name: str
    source: str
    model_endpoint_id: UUID | None = None
    model_endpoint_name: str | None = None
    api_base_url: str | None = None
    api_key: str | None = None
    request_timeout_seconds: int = 60
    configured_model_endpoint_id: UUID | None = None
    configured_model_endpoint_name: str | None = None
    fallback_applied: bool = False
    fallback_reason: str | None = None

    def to_usage_json(self) -> dict[str, str | None]:
        return {
            "provider_type": self.provider_type,
            "model_name": self.model_name,
            "source": self.source,
            "model_endpoint_id": str(self.model_endpoint_id) if self.model_endpoint_id is not None else None,
            "model_endpoint_name": self.model_endpoint_name,
            "api_base_url": self.api_base_url,
            "configured_model_endpoint_id": (
                str(self.configured_model_endpoint_id) if self.configured_model_endpoint_id is not None else None
            ),
            "configured_model_endpoint_name": self.configured_model_endpoint_name,
            "fallback_applied": self.fallback_applied,
            "fallback_reason": self.fallback_reason,
        }
