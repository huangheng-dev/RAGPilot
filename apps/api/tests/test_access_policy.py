from uuid import uuid4

import pytest
from fastapi import HTTPException

from ragpilot_api.application.identity.access_policy import (
    ROLE_CAPABILITY_GRANTS,
    SESSION_CAPABILITIES,
    build_session_capabilities,
    get_role_capabilities,
    role_has_capability,
)
from ragpilot_api.presentation.http.request_actor import (
    RequestActor,
    require_actor_capability,
    require_actor_self_or_capability,
)
from ragpilot_api.infrastructure.database.repositories.role_permission_repository import build_role_policy_seed


def test_role_capability_grants_are_exported_as_active_session_snapshots() -> None:
    for role, granted_capabilities in ROLE_CAPABILITY_GRANTS.items():
        snapshot = build_session_capabilities(role=role, can_use_session=True)

        assert set(snapshot) == set(SESSION_CAPABILITIES)
        assert {capability for capability, is_enabled in snapshot.items() if is_enabled} == set(granted_capabilities)


def test_inactive_session_snapshot_clears_every_capability() -> None:
    snapshot = build_session_capabilities(role="super_admin", can_use_session=False)

    assert set(snapshot) == set(SESSION_CAPABILITIES)
    assert all(is_enabled is False for is_enabled in snapshot.values())


def test_role_capability_lookup_rejects_unknown_roles_and_unknown_capabilities() -> None:
    assert get_role_capabilities("unknown") == frozenset()
    assert role_has_capability("operator", "manage_documents") is True
    assert role_has_capability("operator", "manage_members") is False
    assert role_has_capability("super_admin", "not_a_real_capability") is False


def test_route_capability_check_uses_the_policy_grants() -> None:
    require_actor_capability(RequestActor(role="operator", user_id=None), "manage_documents")

    with pytest.raises(HTTPException) as error:
        require_actor_capability(RequestActor(role="operator", user_id=None), "manage_members")

    assert error.value.status_code == 403


def test_self_or_capability_preserves_current_user_self_service_access() -> None:
    user_id = uuid4()
    require_actor_self_or_capability(RequestActor(role="operator", user_id=user_id), user_id, "manage_members")

    with pytest.raises(HTTPException) as error:
        require_actor_self_or_capability(RequestActor(role="operator", user_id=uuid4()), user_id, "manage_members")

    assert error.value.status_code == 403


def test_database_role_policy_seed_matches_the_code_policy_source() -> None:
    seed = build_role_policy_seed()

    assert set(seed.role_slugs) == set(ROLE_CAPABILITY_GRANTS)
    assert set(seed.permission_slugs) == set(SESSION_CAPABILITIES)
    assert set(seed.role_permissions) == {
        (role_slug, permission_slug)
        for role_slug, permission_slugs in ROLE_CAPABILITY_GRANTS.items()
        for permission_slug in permission_slugs
    }
