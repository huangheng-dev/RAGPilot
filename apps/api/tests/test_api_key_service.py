from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from ragpilot_api.application.errors import ResourceConflictError
from ragpilot_api.application.identity.api_key_service import ApiKeyService, extract_api_key_prefix
from ragpilot_api.contracts.http.api_key_contracts import ApiKeyCreateRequest


@pytest.mark.anyio
async def test_api_key_secret_is_returned_once_and_only_hash_is_persisted() -> None:
    tenant_id = uuid4()
    user_id = uuid4()
    repository = SimpleNamespace(create=AsyncMock())

    async def create(**kwargs):
        assert kwargs["key_hash"] != ""
        assert not kwargs["key_hash"].startswith("rpk_")
        now = datetime.now(timezone.utc)
        return SimpleNamespace(
            id=uuid4(), tenant_id=tenant_id, name=kwargs["name"], key_prefix=kwargs["key_prefix"],
            role=kwargs["role"], scopes_json=kwargs["scopes"], created_by_user_id=user_id,
            expires_at=kwargs["expires_at"], last_used_at=None, revoked_at=None, created_at=now, updated_at=now,
        )

    repository.create.side_effect = create
    response = await ApiKeyService(repository).create(
        ApiKeyCreateRequest(
            tenant_id=tenant_id, name="automation", role="operator",
            scopes=["access_chat", "send_chat_messages"], expires_at=datetime.now(timezone.utc) + timedelta(days=1),
        ),
        actor_user_id=user_id,
    )

    assert response.secret.startswith("rpk_")
    assert response.key_prefix == f"rpk_{extract_api_key_prefix(response.secret)}"


@pytest.mark.anyio
async def test_api_key_scopes_cannot_exceed_selected_role() -> None:
    with pytest.raises(ResourceConflictError):
        await ApiKeyService(SimpleNamespace()).create(
            ApiKeyCreateRequest(
                tenant_id=uuid4(), name="overpowered", role="reviewer", scopes=["manage_admin_resources"],
            ),
            actor_user_id=uuid4(),
        )
