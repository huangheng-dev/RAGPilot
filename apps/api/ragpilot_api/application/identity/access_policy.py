from __future__ import annotations

from collections.abc import Iterable, Mapping


SUPPORTED_ACTOR_ROLES = frozenset({"super_admin", "operator", "reviewer"})

SESSION_CAPABILITIES = (
    "access_home",
    "access_chat",
    "access_documents",
    "access_agents",
    "access_operations",
    "access_settings",
    "access_admin_console",
    "manage_admin_resources",
    "manage_members",
    "manage_runtime_governance",
    "review_runtime_governance",
    "manage_agent_definitions",
    "execute_agents",
    "manage_documents",
    "send_chat_messages",
    "retry_workflow_runs",
    "view_audit_events",
    "manage_local_session_role",
)

ROLE_CAPABILITY_GRANTS: dict[str, frozenset[str]] = {
    "super_admin": frozenset(SESSION_CAPABILITIES),
    "operator": frozenset(
        {
            "access_home",
            "access_chat",
            "access_documents",
            "access_agents",
            "access_operations",
            "access_settings",
            "execute_agents",
            "manage_agent_definitions",
            "manage_documents",
            "review_runtime_governance",
            "retry_workflow_runs",
            "send_chat_messages",
        }
    ),
    "reviewer": frozenset(
        {
            "access_home",
            "access_chat",
            "access_documents",
            "access_agents",
            "access_operations",
            "access_settings",
            "access_admin_console",
            "review_runtime_governance",
        }
    ),
}


def get_role_capabilities(role: str | None) -> frozenset[str]:
    if role is None:
        return frozenset()
    return ROLE_CAPABILITY_GRANTS.get(role, frozenset())


def role_has_capability(role: str | None, capability: str) -> bool:
    return capability in get_role_capabilities(role)


def build_session_capabilities(*, role: str, can_use_session: bool) -> dict[str, bool]:
    role_capabilities = get_role_capabilities(role) if can_use_session else frozenset()
    return {capability: capability in role_capabilities for capability in SESSION_CAPABILITIES}


def build_session_capabilities_from_grants(
    *,
    role: str,
    can_use_session: bool,
    role_capability_grants: Mapping[str, Iterable[str]],
) -> dict[str, bool]:
    role_capabilities = set(role_capability_grants.get(role, set())) if can_use_session else set()
    return {capability: capability in role_capabilities for capability in SESSION_CAPABILITIES}
