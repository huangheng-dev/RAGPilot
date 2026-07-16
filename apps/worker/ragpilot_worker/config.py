from functools import lru_cache

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import URL


class WorkerSettings(BaseSettings):
    environment: str = "development"
    temporal_address: str = "temporal:7233"
    temporal_namespace: str = "default"
    temporal_task_queue: str = "ragpilot-ingestion"
    temporal_connect_max_attempts: int = 30
    temporal_connect_retry_seconds: float = 2.0
    postgres_host: str = "postgres"
    postgres_port: int = 5432
    postgres_db: str = "ragpilot"
    postgres_user: str = "ragpilot"
    postgres_password: str = "ragpilot"
    minio_endpoint: str = "http://minio:9000"
    minio_root_user: str = "ragpilot"
    minio_root_password: str = "ragpilot123"
    minio_bucket: str = "ragpilot-documents"
    ingestion_chunk_size: int = 1200
    ingestion_chunk_overlap: int = 150
    embedding_provider: str = "deterministic"
    embedding_model: str = "ragpilot-dev-1536"
    embedding_dimension: int = 1536
    embedding_api_base_url: str | None = None
    embedding_api_key: str | None = None
    embedding_request_timeout_seconds: int = 60
    elasticsearch_projection_enabled: bool = False
    elasticsearch_url: str = "http://elasticsearch:9200"
    elasticsearch_request_timeout_seconds: int = 30
    elasticsearch_index_prefix: str = "ragpilot-document-chunks"
    elasticsearch_index_version: int = 1
    otel_enabled: bool = False
    otel_exporter_otlp_endpoint: str = "http://otel-collector:4317"
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
        for name, value in {
            "POSTGRES_PASSWORD": self.postgres_password,
            "MINIO_ROOT_PASSWORD": self.minio_root_password,
        }.items():
            normalized = value.strip().lower()
            if len(value.strip()) < 16 or any(fragment in normalized for fragment in ("replace-with", "ragpilot123")):
                raise ValueError(f"{name} must be replaced with a strong production secret.")
        if self.embedding_provider == "deterministic":
            raise ValueError("Production Worker deployments require a non-deterministic embedding provider.")
        if not (self.embedding_api_base_url or "").strip():
            raise ValueError("EMBEDDING_API_BASE_URL is required for the production embedding provider.")
        return self


@lru_cache(maxsize=1)
def get_settings() -> WorkerSettings:
    return WorkerSettings()
