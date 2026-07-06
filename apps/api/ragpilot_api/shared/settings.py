from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


AuthPrimaryMode = Literal["directory_local", "password_local", "oidc", "saml"]
ExternalAuthPrimaryMode = Literal["oidc", "saml"]


class Settings(BaseSettings):
    service_name: str = "ragpilot-api"
    environment: str = "development"
    postgres_host: str = "postgres"
    postgres_port: int = 5432
    postgres_db: str = "ragpilot"
    postgres_user: str = "ragpilot"
    postgres_password: str = "ragpilot"
    redis_url: str = "redis://redis:6379/0"
    temporal_address: str = "temporal:7233"
    temporal_namespace: str = "default"
    temporal_task_queue: str = "ragpilot-ingestion"
    minio_endpoint: str = "http://minio:9000"
    minio_root_user: str = "ragpilot"
    minio_root_password: str = "ragpilot123"
    minio_bucket: str = "ragpilot-documents"
    retrieval_engine: str = "native"
    agent_runtime_engine: str = "native"
    retrieval_embedding_model: str = "ragpilot-dev-1536"
    retrieval_embedding_dimension: int = 1536
    retrieval_rerank_enabled: bool = True
    retrieval_rerank_strategy: str = "native_term_density_v1"
    retrieval_rerank_window: int = 12
    chat_model_provider: str = "deterministic"
    chat_model_name: str = "ragpilot-grounded-template"
    chat_model_api_base_url: str | None = None
    chat_model_api_key: str | None = None
    chat_model_request_timeout_seconds: int = 60
    model_preview_review_window_hours: int = 24
    mcp_preview_review_window_hours: int = 24
    tool_preview_review_window_hours: int = 24
    tool_runtime_request_timeout_seconds: int = 30
    tool_runtime_max_attempts: int = 2
    tool_runtime_retryable_status_codes: str = "502,503,504"
    auth_primary_mode: AuthPrimaryMode = "directory_local"
    auth_provider_display_name: str = "Enterprise Identity"
    auth_provider_sign_in_url: str | None = None
    auth_provider_post_sign_out_url: str | None = None
    auth_failed_sign_in_window_minutes: int = 15
    auth_failed_sign_in_max_attempts: int = 5
    auth_failed_sign_in_lockout_minutes: int = 15
    auth_session_review_max_active_sessions_per_user: int = 4
    auth_session_review_max_distinct_devices_per_user: int = 3
    allow_legacy_actor_headers: bool = False
    cors_allowed_origins: str = "http://127.0.0.1:3001,http://localhost:3001"
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def database_url(self) -> str:
        return (
            "postgresql+asyncpg://"
            f"{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_allowed_origins.split(",") if origin.strip()]

    @property
    def tool_runtime_retryable_status_code_set(self) -> set[int]:
        values: set[int] = set()
        for raw_value in self.tool_runtime_retryable_status_codes.split(","):
            normalized = raw_value.strip()
            if normalized == "":
                continue
            try:
                values.add(int(normalized))
            except ValueError:
                continue
        return values


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
