from functools import lru_cache
from typing import Literal

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import URL


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
    runtime_limit_redis_failure_mode: Literal["local_fallback", "closed"] = "local_fallback"
    runtime_limit_concurrency_lease_seconds: float = 300.0
    temporal_address: str = "temporal:7233"
    temporal_namespace: str = "default"
    temporal_task_queue: str = "ragpilot-ingestion"
    agent_temporal_task_queue: str = "ragpilot-agent-execution"
    minio_endpoint: str = "http://minio:9000"
    minio_root_user: str = "ragpilot"
    minio_root_password: str = "ragpilot123"
    minio_bucket: str = "ragpilot-documents"
    retrieval_engine: str = "native"
    agent_runtime_engine: str = "native"
    agent_approval_timeout_hours: int = 24
    agent_execution_max_tool_calls: int = 8
    agent_execution_max_runtime_seconds: int = 900
    agent_execution_max_output_bytes: int = 256000
    runtime_credential_master_key: str = "ragpilot-local-development-master-key-change-me"
    retrieval_embedding_model: str = "ragpilot-dev-1536"
    retrieval_embedding_dimension: int = 1536
    retrieval_rerank_enabled: bool = True
    retrieval_rerank_strategy: str = "native_term_density_v1"
    retrieval_rerank_window: int = 12
    retrieval_rerank_timeout_seconds: float = 2.0
    retrieval_candidate_limit: int = 50
    retrieval_evidence_validation_enabled: bool = True
    retrieval_evidence_minimum_term_coverage: float = 0.05
    retrieval_evidence_minimum_vector_score: float = 0.72
    retrieval_score_normalization_strategy: str = "rank_percentile_v1"
    elasticsearch_retrieval_enabled: bool = False
    elasticsearch_url: str = "http://elasticsearch:9200"
    elasticsearch_index_prefix: str = "ragpilot-document-chunks"
    elasticsearch_request_timeout_seconds: float = 5.0
    otel_enabled: bool = False
    otel_exporter_otlp_endpoint: str = "http://otel-collector:4317"
    otel_trace_sample_ratio: float = 1.0
    chat_model_provider: str = "deterministic"
    chat_model_name: str = "ragpilot-grounded-template"
    chat_model_api_base_url: str | None = None
    chat_model_api_key: str | None = None
    chat_model_request_timeout_seconds: int = 180
    model_runtime_concurrency_limit: int = 8
    model_runtime_requests_per_minute: int = 120
    model_runtime_max_attempts: int = 2
    model_runtime_retry_backoff_seconds: float = 0.25
    model_runtime_retryable_status_codes: str = "429,502,503,504"
    model_input_cost_per_1k_tokens_usd: float = 0.0
    model_output_cost_per_1k_tokens_usd: float = 0.0
    model_preview_review_window_hours: int = 24
    mcp_preview_review_window_hours: int = 24
    tool_preview_review_window_hours: int = 24
    tool_runtime_request_timeout_seconds: int = 30
    tool_runtime_max_attempts: int = 2
    tool_runtime_retryable_status_codes: str = "502,503,504"
    mcp_runtime_concurrency_limit: int = 16
    mcp_runtime_requests_per_minute: int = 240
    mcp_runtime_max_attempts: int = 2
    mcp_runtime_retry_backoff_seconds: float = 0.25
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
    cors_allowed_origins: str = "http://127.0.0.1:3000,http://localhost:3000"
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def database_url(self) -> str:
        return URL.create(
            "postgresql+asyncpg",
            username=self.postgres_user,
            password=self.postgres_password,
            host=self.postgres_host,
            port=self.postgres_port,
            database=self.postgres_db,
        ).render_as_string(hide_password=False)

    @model_validator(mode="after")
    def validate_production_security(self):
        if self.environment.strip().lower() != "production":
            return self
        forbidden_fragments = ("change-me", "replace-with", "ragpilot123")
        required_secrets = {
            "POSTGRES_PASSWORD": self.postgres_password,
            "MINIO_ROOT_PASSWORD": self.minio_root_password,
            "RUNTIME_CREDENTIAL_MASTER_KEY": self.runtime_credential_master_key,
        }
        for name, value in required_secrets.items():
            normalized = value.strip().lower()
            if len(value.strip()) < 16 or any(fragment in normalized for fragment in forbidden_fragments):
                raise ValueError(f"{name} must be replaced with a strong production secret.")
        if len(self.runtime_credential_master_key.strip()) < 32:
            raise ValueError("RUNTIME_CREDENTIAL_MASTER_KEY must contain at least 32 characters in production.")
        if self.allow_legacy_actor_headers:
            raise ValueError("ALLOW_LEGACY_ACTOR_HEADERS must remain false in production.")
        if self.runtime_limit_redis_failure_mode != "closed":
            raise ValueError("RUNTIME_LIMIT_REDIS_FAILURE_MODE must be closed in production.")
        if any(not origin.lower().startswith("https://") for origin in self.cors_origins):
            raise ValueError("Production CORS origins must use HTTPS.")
        return self

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

    @property
    def model_runtime_retryable_status_code_set(self) -> set[int]:
        return _parse_status_codes(self.model_runtime_retryable_status_codes)


def _parse_status_codes(raw_codes: str) -> set[int]:
    values: set[int] = set()
    for raw_value in raw_codes.split(","):
        try:
            values.add(int(raw_value.strip()))
        except ValueError:
            continue
    return values


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
