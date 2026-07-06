from __future__ import annotations

from ragpilot_api.application.model_registry.runtime_configuration import (
    normalize_model_endpoint_provider_name,
)
from ragpilot_api.contracts.http.runtime_governance_event_contracts import (
    RuntimeGovernanceAgentsTargetResponse,
    RuntimeGovernanceEventResponse,
    RuntimeGovernanceFollowUpResponse,
    RuntimeGovernanceSettingsTargetResponse,
    RuntimeGovernanceWorklistItemResponse,
)


def _read_detail_string(detail: dict[str, object], key: str) -> str | None:
    value = detail.get(key)
    if isinstance(value, str) and value.strip():
        return value
    return None


def _read_normalized_model_provider_type(detail: dict[str, object]) -> str | None:
    provider_type = _read_detail_string(detail, "provider_type")
    if provider_type is None:
        return None
    normalized_provider_type = normalize_model_endpoint_provider_name(provider_type)
    if normalized_provider_type in {"deterministic", "openai_compatible", "ollama", "vllm"}:
        return normalized_provider_type
    return None


def build_runtime_governance_event_follow_up(
    event: RuntimeGovernanceEventResponse,
) -> RuntimeGovernanceFollowUpResponse | None:
    if event.resource_type == "model_endpoint" and event.resource_id is not None:
        provider_type = _read_normalized_model_provider_type(event.detail)
        return RuntimeGovernanceFollowUpResponse(
            settings_target=RuntimeGovernanceSettingsTargetResponse(
                runtime_resource="model_endpoint",
                model_endpoint_id=event.resource_id,
                model_provider_type=provider_type,
            ),
            agents_target=(
                RuntimeGovernanceAgentsTargetResponse(
                    issue="model_disabled",
                    model_endpoint_id=event.resource_id,
                    model_provider_type=provider_type,
                )
                if event.action_type == "disable_endpoint"
                else None
            ),
        )

    if event.resource_type == "retrieval_profile" and event.resource_id is not None:
        return RuntimeGovernanceFollowUpResponse(
            settings_target=RuntimeGovernanceSettingsTargetResponse(
                runtime_resource="retrieval_profile",
                retrieval_profile_id=event.resource_id,
            ),
            agents_target=(
                RuntimeGovernanceAgentsTargetResponse(
                    issue="retrieval_profile_disabled",
                    retrieval_profile_id=event.resource_id,
                )
                if event.action_type == "disable_profile"
                else None
            ),
        )

    if event.resource_type == "mcp_connector" and event.resource_id is not None:
        return RuntimeGovernanceFollowUpResponse(
            settings_target=RuntimeGovernanceSettingsTargetResponse(
                runtime_resource="mcp_connector",
                mcp_connector_id=event.resource_id,
                mcp_connector_slug=event.resource_slug,
            ),
        )

    if event.resource_type != "tool_registration" or event.resource_id is None:
        return None

    connector_reference = _read_detail_string(event.detail, "connector_reference")
    settings_target = RuntimeGovernanceSettingsTargetResponse(
        runtime_resource="tool_registration",
        tool_registration_id=event.resource_id,
    )
    agents_target = None

    if event.action_type == "disable_tool":
        settings_target.tool_list_filter = "disabled"
        agents_target = RuntimeGovernanceAgentsTargetResponse(
            issue="tool_registration_disabled",
            tool_registration_id=event.resource_id,
        )
    elif event.action_type == "require_admin_approval":
        settings_target.tool_list_filter = "approval_required"
        agents_target = RuntimeGovernanceAgentsTargetResponse(
            issue="tool_approval_required",
            tool_registration_id=event.resource_id,
        )
    elif event.action_type in {"review_mcp_boundary", "quarantine_mcp_boundary"}:
        if connector_reference:
            settings_target = RuntimeGovernanceSettingsTargetResponse(
                runtime_resource="mcp_connector",
                mcp_connector_slug=connector_reference,
            )
        else:
            settings_target.tool_list_filter = "mcp_reserved_bound"
        agents_target = RuntimeGovernanceAgentsTargetResponse(
            issue="tool_mcp_reserved",
            tool_registration_id=event.resource_id,
        )
    elif event.action_type == "ready_mcp_integration":
        if connector_reference:
            settings_target = RuntimeGovernanceSettingsTargetResponse(
                runtime_resource="mcp_connector",
                mcp_connector_slug=connector_reference,
            )
        else:
            settings_target.tool_list_filter = "mcp_integration_pending"
        agents_target = RuntimeGovernanceAgentsTargetResponse(
            issue="tool_mcp_integration_pending",
            tool_registration_id=event.resource_id,
        )

    return RuntimeGovernanceFollowUpResponse(
        settings_target=settings_target,
        agents_target=agents_target,
    )


def build_runtime_governance_worklist_follow_up(
    item: RuntimeGovernanceWorklistItemResponse,
) -> RuntimeGovernanceFollowUpResponse | None:
    if item.resource_type == "model_endpoint":
        provider_type = _read_normalized_model_provider_type(item.detail)
        if item.category == "disabled_bound_model_endpoint":
            return RuntimeGovernanceFollowUpResponse(
                settings_target=RuntimeGovernanceSettingsTargetResponse(
                    runtime_resource="model_endpoint",
                    model_endpoint_id=item.resource_id,
                    model_provider_type=provider_type,
                ),
                agents_target=RuntimeGovernanceAgentsTargetResponse(
                    issue="model_disabled",
                    model_endpoint_id=item.resource_id,
                    model_provider_type=provider_type,
                ),
            )
        if item.category == "unconfigured_model_endpoint":
            return RuntimeGovernanceFollowUpResponse(
                settings_target=RuntimeGovernanceSettingsTargetResponse(
                    runtime_resource="model_endpoint",
                    model_endpoint_id=item.resource_id,
                    model_provider_type=provider_type,
                ),
                agents_target=RuntimeGovernanceAgentsTargetResponse(
                    issue="model_runtime_unconfigured",
                    model_endpoint_id=item.resource_id,
                    model_provider_type=provider_type,
                ),
            )
        return None

    if item.resource_type == "mcp_connector":
        return RuntimeGovernanceFollowUpResponse(
            settings_target=RuntimeGovernanceSettingsTargetResponse(
                runtime_resource="mcp_connector",
                mcp_connector_id=item.resource_id,
                mcp_connector_slug=item.resource_slug,
            ),
        )

    connector_reference = _read_detail_string(item.detail, "connector_reference")

    if item.category == "approval_required_tool":
        return RuntimeGovernanceFollowUpResponse(
            settings_target=RuntimeGovernanceSettingsTargetResponse(
                runtime_resource="tool_registration",
                tool_registration_id=item.resource_id,
                tool_list_filter="approval_required",
            ),
            agents_target=RuntimeGovernanceAgentsTargetResponse(
                issue="tool_approval_required",
                tool_registration_id=item.resource_id,
            ),
        )

    if item.category == "mcp_integration_pending_tool":
        return RuntimeGovernanceFollowUpResponse(
            settings_target=(
                RuntimeGovernanceSettingsTargetResponse(
                    runtime_resource="mcp_connector",
                    mcp_connector_slug=connector_reference,
                )
                if connector_reference
                else RuntimeGovernanceSettingsTargetResponse(
                    runtime_resource="tool_registration",
                    tool_registration_id=item.resource_id,
                    tool_list_filter="mcp_integration_pending",
                )
            ),
            agents_target=RuntimeGovernanceAgentsTargetResponse(
                issue="tool_mcp_integration_pending",
                tool_registration_id=item.resource_id,
            ),
        )

    return None
