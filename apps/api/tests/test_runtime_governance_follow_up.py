from uuid import uuid4

from ragpilot_api.application.runtime_governance.runtime_governance_follow_up import (
    build_runtime_governance_event_follow_up,
    build_runtime_governance_worklist_follow_up,
)
from ragpilot_api.contracts.http.runtime_governance_event_contracts import (
    RuntimeGovernanceEventResponse,
    RuntimeGovernanceWorklistItemResponse,
)


def test_runtime_governance_event_follow_up_for_disabled_tool() -> None:
    tool_id = uuid4()
    follow_up = build_runtime_governance_event_follow_up(
        RuntimeGovernanceEventResponse(
            id=uuid4(),
            actor_user_id=None,
            actor_role="super_admin",
            resource_type="tool_registration",
            resource_id=tool_id,
            resource_name="Browser Tool",
            resource_slug="browser-tool",
            action_type="disable_tool",
            detail={},
            created_at="2026-06-24T00:00:00Z",
        )
    )

    assert follow_up is not None
    assert follow_up.settings_target is not None
    assert follow_up.settings_target.runtime_resource == "tool_registration"
    assert follow_up.settings_target.tool_registration_id == tool_id
    assert follow_up.settings_target.tool_list_filter == "disabled"
    assert follow_up.agents_target is not None
    assert follow_up.agents_target.issue == "tool_registration_disabled"


def test_runtime_governance_event_follow_up_for_disabled_model_preserves_provider_type() -> None:
    model_id = uuid4()
    follow_up = build_runtime_governance_event_follow_up(
        RuntimeGovernanceEventResponse(
            id=uuid4(),
            actor_user_id=None,
            actor_role="super_admin",
            resource_type="model_endpoint",
            resource_id=model_id,
            resource_name="Local Ollama",
            resource_slug="local-ollama",
            action_type="disable_endpoint",
            detail={"provider_type": "ollama_reserved"},
            created_at="2026-06-24T00:00:00Z",
        )
    )

    assert follow_up is not None
    assert follow_up.settings_target is not None
    assert follow_up.settings_target.runtime_resource == "model_endpoint"
    assert follow_up.settings_target.model_endpoint_id == model_id
    assert follow_up.settings_target.model_provider_type == "ollama"
    assert follow_up.agents_target is not None
    assert follow_up.agents_target.issue == "model_disabled"
    assert follow_up.agents_target.model_endpoint_id == model_id
    assert follow_up.agents_target.model_provider_type == "ollama"


def test_runtime_governance_event_follow_up_for_pending_mcp_integration() -> None:
    tool_id = uuid4()
    follow_up = build_runtime_governance_event_follow_up(
        RuntimeGovernanceEventResponse(
            id=uuid4(),
            actor_user_id=None,
            actor_role="super_admin",
            resource_type="tool_registration",
            resource_id=tool_id,
            resource_name="Docs Tool",
            resource_slug="docs-tool",
            action_type="ready_mcp_integration",
            detail={"connector_reference": "docs-gateway"},
            created_at="2026-06-24T00:00:00Z",
        )
    )

    assert follow_up is not None
    assert follow_up.settings_target is not None
    assert follow_up.settings_target.runtime_resource == "mcp_connector"
    assert follow_up.settings_target.mcp_connector_slug == "docs-gateway"
    assert follow_up.agents_target is not None
    assert follow_up.agents_target.issue == "tool_mcp_integration_pending"
    assert follow_up.agents_target.tool_registration_id == tool_id


def test_runtime_governance_event_follow_up_for_disabled_retrieval_profile() -> None:
    profile_id = uuid4()
    follow_up = build_runtime_governance_event_follow_up(
        RuntimeGovernanceEventResponse(
            id=uuid4(),
            actor_user_id=None,
            actor_role="super_admin",
            resource_type="retrieval_profile",
            resource_id=profile_id,
            resource_name="Hybrid Retrieval",
            resource_slug="hybrid-retrieval",
            action_type="disable_profile",
            detail={},
            created_at="2026-06-24T00:00:00Z",
        )
    )

    assert follow_up is not None
    assert follow_up.settings_target is not None
    assert follow_up.settings_target.runtime_resource == "retrieval_profile"
    assert follow_up.settings_target.retrieval_profile_id == profile_id
    assert follow_up.agents_target is not None
    assert follow_up.agents_target.issue == "retrieval_profile_disabled"


def test_runtime_governance_worklist_follow_up_for_blocked_connector() -> None:
    connector_id = uuid4()
    follow_up = build_runtime_governance_worklist_follow_up(
        RuntimeGovernanceWorklistItemResponse(
            category="integration_blocked_connector",
            severity="attention",
            resource_type="mcp_connector",
            resource_id=connector_id,
            resource_name="Docs Gateway",
            resource_slug="docs-gateway",
            action_hint="restore_connector_runtime",
            detail={},
        )
    )

    assert follow_up is not None
    assert follow_up.settings_target is not None
    assert follow_up.settings_target.runtime_resource == "mcp_connector"
    assert follow_up.settings_target.mcp_connector_id == connector_id
    assert follow_up.agents_target is None


def test_runtime_governance_worklist_follow_up_for_unconfigured_model() -> None:
    model_id = uuid4()
    follow_up = build_runtime_governance_worklist_follow_up(
        RuntimeGovernanceWorklistItemResponse(
            category="unconfigured_model_endpoint",
            severity="attention",
            resource_type="model_endpoint",
            resource_id=model_id,
            resource_name="Local Ollama",
            resource_slug="local-ollama",
            action_hint="complete_model_runtime",
            detail={"provider_type": "ollama_reserved"},
        )
    )

    assert follow_up is not None
    assert follow_up.settings_target is not None
    assert follow_up.settings_target.runtime_resource == "model_endpoint"
    assert follow_up.settings_target.model_endpoint_id == model_id
    assert follow_up.settings_target.model_provider_type == "ollama"
    assert follow_up.agents_target is not None
    assert follow_up.agents_target.issue == "model_runtime_unconfigured"
    assert follow_up.agents_target.model_provider_type == "ollama"


def test_runtime_governance_worklist_follow_up_for_approval_required_tool() -> None:
    tool_id = uuid4()
    follow_up = build_runtime_governance_worklist_follow_up(
        RuntimeGovernanceWorklistItemResponse(
            category="approval_required_tool",
            severity="review",
            resource_type="tool_registration",
            resource_id=tool_id,
            resource_name="Governed Browser",
            resource_slug="governed-browser",
            action_hint="review_tool_boundary",
            detail={},
        )
    )

    assert follow_up is not None
    assert follow_up.settings_target is not None
    assert follow_up.settings_target.runtime_resource == "tool_registration"
    assert follow_up.settings_target.tool_registration_id == tool_id
    assert follow_up.settings_target.tool_list_filter == "approval_required"
    assert follow_up.agents_target is not None
    assert follow_up.agents_target.issue == "tool_approval_required"
