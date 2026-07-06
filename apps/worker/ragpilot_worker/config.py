from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class WorkerSettings(BaseSettings):
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
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def database_url(self) -> str:
        return (
            "postgresql+asyncpg://"
            f"{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )


@lru_cache(maxsize=1)
def get_settings() -> WorkerSettings:
    return WorkerSettings()
