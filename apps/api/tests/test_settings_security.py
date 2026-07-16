import pytest
from pydantic import ValidationError

from ragpilot_api.shared.settings import Settings


def production_settings(**overrides) -> Settings:
    values = {
        "environment": "production",
        "postgres_password": "postgres-production-secret",
        "minio_root_password": "minio-production-secret",
        "runtime_credential_master_key": "runtime-production-master-key-32-characters",
        "runtime_limit_redis_failure_mode": "closed",
        "cors_allowed_origins": "https://ragpilot.example.com",
    }
    values.update(overrides)
    return Settings(**values)


def test_database_url_encodes_reserved_password_characters() -> None:
    settings = Settings(
        postgres_host="postgres",
        postgres_port=5432,
        postgres_password="p@ss:/word?#[]",
    )

    assert "p%40ss%3A%2Fword%3F%23%5B%5D" in settings.database_url
    assert settings.database_url.endswith("@postgres:5432/ragpilot")


def test_production_settings_accept_hardened_values() -> None:
    settings = production_settings()

    assert settings.runtime_limit_redis_failure_mode == "closed"


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("postgres_password", "ragpilot"),
        ("minio_root_password", "ragpilot123"),
        ("runtime_credential_master_key", "change-me"),
        ("runtime_limit_redis_failure_mode", "local_fallback"),
        ("cors_allowed_origins", "http://ragpilot.example.com"),
        ("allow_legacy_actor_headers", True),
    ],
)
def test_production_settings_reject_unsafe_defaults(field: str, value: object) -> None:
    with pytest.raises(ValidationError):
        production_settings(**{field: value})
