import pytest
from pydantic import ValidationError

from ragpilot_worker.config import WorkerSettings


def production_settings(**overrides) -> WorkerSettings:
    values = {
        "environment": "production",
        "postgres_password": "postgres-production-secret",
        "minio_root_password": "minio-production-secret",
        "embedding_provider": "openai_compatible",
        "embedding_api_base_url": "https://models.example.com/v1",
    }
    values.update(overrides)
    return WorkerSettings(**values)


def test_database_url_encodes_reserved_password_characters() -> None:
    settings = WorkerSettings(postgres_password="p@ss:/word?#[]")

    assert "p%40ss%3A%2Fword%3F%23%5B%5D" in settings.database_url


def test_production_worker_settings_accept_hardened_values() -> None:
    settings = production_settings()

    assert settings.embedding_provider == "openai_compatible"


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("postgres_password", "ragpilot"),
        ("minio_root_password", "ragpilot123"),
        ("embedding_provider", "deterministic"),
        ("embedding_api_base_url", None),
    ],
)
def test_production_worker_settings_reject_unsafe_defaults(field: str, value: object) -> None:
    with pytest.raises(ValidationError):
        production_settings(**{field: value})
