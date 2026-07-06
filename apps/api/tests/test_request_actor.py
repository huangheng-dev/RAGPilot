from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException

from ragpilot_api.presentation.http import request_actor
from ragpilot_api.shared.settings import Settings


@pytest.mark.anyio
async def test_get_request_actor_prefers_bearer_session_over_actor_headers(monkeypatch: pytest.MonkeyPatch) -> None:
    bearer_user_id = uuid4()
    bearer_session_id = uuid4()
    tenant_id = uuid4()

    class FakeUserSessionRepository:
        def __init__(self, session) -> None:
            self.session = session

        async def get_active_user_session_by_token(self, *, session_token: str):
            assert session_token == "valid-session-token"
            return SimpleNamespace(
                session=SimpleNamespace(id=bearer_session_id),
                user=SimpleNamespace(id=bearer_user_id),
            )

    class FakeUserRepository:
        def __init__(self, session) -> None:
            self.session = session

        async def get_user_directory_record(self, *, user_id):
            assert user_id == bearer_user_id
            return SimpleNamespace(
                user=SimpleNamespace(id=bearer_user_id, role="operator", is_active=True),
                memberships=[
                    SimpleNamespace(
                        membership=SimpleNamespace(
                            membership_status="active",
                            tenant_id=tenant_id,
                        )
                    )
                ],
            )

    monkeypatch.setattr(request_actor, "UserSessionRepository", FakeUserSessionRepository)
    monkeypatch.setattr(request_actor, "UserRepository", FakeUserRepository)

    actor = await request_actor.get_request_actor(
        authorization="Bearer valid-session-token",
        x_ragpilot_role="reviewer",
        x_ragpilot_actor_id=uuid4(),
        session=None,
    )

    assert actor.role == "operator"
    assert actor.user_id == bearer_user_id
    assert actor.session_id == bearer_session_id
    assert actor.active_tenant_ids == (tenant_id,)


@pytest.mark.anyio
async def test_get_request_actor_rejects_invalid_bearer_even_when_actor_headers_exist(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class FakeUserSessionRepository:
        def __init__(self, session) -> None:
            self.session = session

        async def get_active_user_session_by_token(self, *, session_token: str):
            assert session_token == "revoked-session-token"
            return None

    class FakeUserRepository:
        def __init__(self, session) -> None:
            self.session = session

    monkeypatch.setattr(request_actor, "UserSessionRepository", FakeUserSessionRepository)
    monkeypatch.setattr(request_actor, "UserRepository", FakeUserRepository)

    with pytest.raises(HTTPException) as exc_info:
        await request_actor.get_request_actor(
            authorization="Bearer revoked-session-token",
            x_ragpilot_role="super_admin",
            x_ragpilot_actor_id=uuid4(),
            session=None,
        )

    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == "Session is invalid or expired."


@pytest.mark.anyio
async def test_get_request_actor_rejects_legacy_actor_headers_when_disabled(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        request_actor,
        "get_settings",
        lambda: Settings(allow_legacy_actor_headers=False),
    )

    with pytest.raises(HTTPException) as exc_info:
        await request_actor.get_request_actor(
            authorization=None,
            x_ragpilot_role="operator",
            x_ragpilot_actor_id=uuid4(),
            session=None,
        )

    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == "Legacy actor headers are disabled. Use a bearer session token."


def test_require_actor_tenant_access_rejects_out_of_scope_tenant() -> None:
    actor = request_actor.RequestActor(
        role="operator",
        user_id=uuid4(),
        active_tenant_ids=(uuid4(),),
    )

    with pytest.raises(HTTPException) as exc_info:
        request_actor.require_actor_tenant_access(actor, uuid4())

    assert exc_info.value.status_code == 403
    assert exc_info.value.detail == "Actor does not have access to the requested tenant scope."
