from __future__ import annotations

import asyncio

from ragpilot_api.application.model_registry.runtime_configuration import (
    read_model_runtime_configuration_issue,
)
from ragpilot_api.contracts.http.runtime_governance_event_contracts import (
    RuntimeGovernanceWorklistItemResponse,
    RuntimeGovernanceWorklistResponse,
)
from ragpilot_api.application.model_registry.model_registry_service import ModelRegistryService
from ragpilot_api.application.runtime_governance.runtime_governance_follow_up import (
    build_runtime_governance_worklist_follow_up,
)
from ragpilot_api.application.mcp_connectors.mcp_connector_registry_service import (
    McpConnectorRegistryService,
    is_mcp_connector_response_configured,
)
from ragpilot_api.application.tool_registry.tool_registry_service import ToolRegistryService


class RuntimeGovernanceWorklistService:
    def __init__(
        self,
        model_registry_service: ModelRegistryService,
        tool_registry_service: ToolRegistryService,
        mcp_connector_registry_service: McpConnectorRegistryService,
    ) -> None:
        self.model_registry_service = model_registry_service
        self.tool_registry_service = tool_registry_service
        self.mcp_connector_registry_service = mcp_connector_registry_service

    async def get_runtime_governance_worklist(
        self,
        *,
        limit: int = 12,
        category: str | None = None,
        severity: str | None = None,
        resource_type: str | None = None,
        query: str | None = None,
    ) -> RuntimeGovernanceWorklistResponse:
        (
            missing_base_url_model_endpoints,
            missing_credential_hint_model_endpoints,
            disabled_bound_model_endpoints,
            approval_required_tools,
            mcp_integration_pending_tools,
            integration_blocked_connectors,
            all_mcp_connectors,
        ) = await _load_worklist_inputs(
            self.model_registry_service,
            self.tool_registry_service,
            self.mcp_connector_registry_service,
        )
        unconfigured_model_endpoints = _merge_model_endpoint_results(
            missing_base_url_model_endpoints,
            missing_credential_hint_model_endpoints,
        )
        mcp_connectors_by_slug = {
            connector.slug: connector
            for connector in all_mcp_connectors
        }

        items: list[RuntimeGovernanceWorklistItemResponse] = []

        for model_endpoint in unconfigured_model_endpoints:
            runtime_issue = read_model_runtime_configuration_issue(
                provider_type=model_endpoint.provider_type,
                base_url=model_endpoint.base_url,
                credential_mode=model_endpoint.credential_mode,
                credential_key_hint=model_endpoint.credential_key_hint,
            )
            item = RuntimeGovernanceWorklistItemResponse(
                category="unconfigured_model_endpoint",
                severity="attention",
                resource_type="model_endpoint",
                resource_id=model_endpoint.id,
                resource_name=model_endpoint.name,
                resource_slug=model_endpoint.slug,
                action_hint="complete_model_runtime",
                recent_preview_completed_events=getattr(model_endpoint, "recent_preview_completed_events", 0),
                recent_preview_blocked_events=getattr(model_endpoint, "recent_preview_blocked_events", 0),
                recent_preview_failed_events=getattr(model_endpoint, "recent_preview_failed_events", 0),
                last_preview_status=getattr(model_endpoint, "last_preview_status", None),
                last_preview_at=getattr(model_endpoint, "last_preview_at", None),
                detail={
                    "provider_type": model_endpoint.provider_type,
                    "model_name": model_endpoint.model_name,
                    "runtime_issue": runtime_issue,
                    "is_enabled": model_endpoint.is_enabled,
                    "bound_agent_count": getattr(model_endpoint, "bound_agent_count", 0),
                    "base_url": model_endpoint.base_url,
                    "credential_mode": model_endpoint.credential_mode,
                    "credential_key_hint": model_endpoint.credential_key_hint,
                },
            )
            item.follow_up = build_runtime_governance_worklist_follow_up(item)
            items.append(item)

        for model_endpoint in disabled_bound_model_endpoints:
            item = RuntimeGovernanceWorklistItemResponse(
                category="disabled_bound_model_endpoint",
                severity="attention",
                resource_type="model_endpoint",
                resource_id=model_endpoint.id,
                resource_name=model_endpoint.name,
                resource_slug=model_endpoint.slug,
                action_hint="restore_model_runtime",
                recent_preview_completed_events=getattr(model_endpoint, "recent_preview_completed_events", 0),
                recent_preview_blocked_events=getattr(model_endpoint, "recent_preview_blocked_events", 0),
                recent_preview_failed_events=getattr(model_endpoint, "recent_preview_failed_events", 0),
                last_preview_status=getattr(model_endpoint, "last_preview_status", None),
                last_preview_at=getattr(model_endpoint, "last_preview_at", None),
                detail={
                    "provider_type": model_endpoint.provider_type,
                    "model_name": model_endpoint.model_name,
                    "is_enabled": model_endpoint.is_enabled,
                    "bound_agent_count": getattr(model_endpoint, "bound_agent_count", 0),
                    "base_url": model_endpoint.base_url,
                    "credential_mode": model_endpoint.credential_mode,
                    "credential_key_hint": model_endpoint.credential_key_hint,
                },
            )
            item.follow_up = build_runtime_governance_worklist_follow_up(item)
            items.append(item)

        for connector in integration_blocked_connectors:
            item = RuntimeGovernanceWorklistItemResponse(
                category="integration_blocked_connector",
                severity="attention",
                resource_type="mcp_connector",
                resource_id=connector.id,
                resource_name=connector.name,
                resource_slug=connector.slug,
                action_hint="restore_connector_runtime",
                recent_preview_completed_events=getattr(connector, "recent_preview_completed_events", 0),
                recent_preview_blocked_events=getattr(connector, "recent_preview_blocked_events", 0),
                recent_preview_failed_events=getattr(connector, "recent_preview_failed_events", 0),
                last_preview_status=getattr(connector, "last_preview_status", None),
                last_preview_at=getattr(connector, "last_preview_at", None),
                detail={
                    "connector_type": connector.connector_type,
                    "auth_mode": connector.auth_mode,
                    "is_enabled": getattr(connector, "is_enabled", False),
                    "integration_ready_tool_count": connector.integration_ready_tool_count,
                    "referenced_tool_count": connector.referenced_tool_count,
                    "base_url": connector.base_url,
                    "credential_key_hint": connector.credential_key_hint,
                },
            )
            item.follow_up = build_runtime_governance_worklist_follow_up(item)
            items.append(item)

        for tool in approval_required_tools:
            preview_failed_events = getattr(tool, "recent_preview_failed_events", 0)
            last_preview_status = getattr(tool, "last_preview_status", None)
            item = RuntimeGovernanceWorklistItemResponse(
                category="approval_required_tool",
                severity="attention" if preview_failed_events > 0 or last_preview_status == "failed" else "review",
                resource_type="tool_registration",
                resource_id=tool.id,
                resource_name=tool.name,
                resource_slug=tool.slug,
                action_hint="review_tool_boundary",
                recent_preview_completed_events=getattr(tool, "recent_preview_completed_events", 0),
                recent_preview_blocked_events=getattr(tool, "recent_preview_blocked_events", 0),
                recent_preview_failed_events=preview_failed_events,
                last_preview_status=last_preview_status,
                last_preview_at=getattr(tool, "last_preview_at", None),
                detail={
                    "transport_type": tool.transport_type,
                    "surface_area": tool.surface_area,
                    "bound_agent_count": getattr(tool, "bound_agent_count", 0),
                    "connector_reference": tool.connector_reference,
                },
            )
            item.follow_up = build_runtime_governance_worklist_follow_up(item)
            items.append(item)

        for tool in mcp_integration_pending_tools:
            connector = mcp_connectors_by_slug.get(tool.connector_reference) if tool.connector_reference else None
            connector_runtime_ready = (
                connector.is_enabled and is_mcp_connector_response_configured(connector)
                if connector is not None
                else False
            )
            preview_failed_events = getattr(tool, "recent_preview_failed_events", 0)
            last_preview_status = getattr(tool, "last_preview_status", None)
            item = RuntimeGovernanceWorklistItemResponse(
                category="mcp_integration_pending_tool",
                severity="attention" if preview_failed_events > 0 or last_preview_status == "failed" else "review",
                resource_type="tool_registration",
                resource_id=tool.id,
                resource_name=tool.name,
                resource_slug=tool.slug,
                action_hint="complete_mcp_integration",
                recent_preview_completed_events=getattr(tool, "recent_preview_completed_events", 0),
                recent_preview_blocked_events=getattr(tool, "recent_preview_blocked_events", 0),
                recent_preview_failed_events=preview_failed_events,
                last_preview_status=last_preview_status,
                last_preview_at=getattr(tool, "last_preview_at", None),
                detail={
                    "transport_type": tool.transport_type,
                    "surface_area": tool.surface_area,
                    "bound_agent_count": getattr(tool, "bound_agent_count", 0),
                    "connector_reference": tool.connector_reference,
                    "connector_enabled": connector.is_enabled if connector is not None else None,
                    "connector_runtime_ready": connector_runtime_ready,
                },
            )
            item.follow_up = build_runtime_governance_worklist_follow_up(item)
            items.append(item)

        filtered_items = [
            item
            for item in items
            if _matches_worklist_filters(
                item,
                category=category,
                severity=severity,
                resource_type=resource_type,
                query=query,
            )
        ]
        sorted_items = _sort_worklist_items(filtered_items)

        return RuntimeGovernanceWorklistResponse(
            total_items=len(sorted_items),
            unconfigured_model_endpoints=_count_worklist_category(sorted_items, "unconfigured_model_endpoint"),
            disabled_bound_model_endpoints=_count_worklist_category(sorted_items, "disabled_bound_model_endpoint"),
            approval_required_tools=_count_worklist_category(sorted_items, "approval_required_tool"),
            mcp_integration_pending_tools=_count_worklist_category(sorted_items, "mcp_integration_pending_tool"),
            integration_blocked_connectors=_count_worklist_category(sorted_items, "integration_blocked_connector"),
            items=sorted_items[:limit],
        )


async def _load_worklist_inputs(
    model_registry_service: ModelRegistryService,
    tool_registry_service: ToolRegistryService,
    mcp_connector_registry_service: McpConnectorRegistryService,
):
    return await asyncio.gather(
        model_registry_service.list_model_endpoints(runtime_state="missing_base_url"),
        model_registry_service.list_model_endpoints(runtime_state="missing_credential_hint"),
        model_registry_service.list_model_endpoints(runtime_state="disabled_bound"),
        tool_registry_service.list_tool_registrations(runtime_state="approval_required"),
        tool_registry_service.list_tool_registrations(runtime_state="mcp_integration_pending"),
        mcp_connector_registry_service.list_mcp_connectors(runtime_state="integration_blocked"),
        mcp_connector_registry_service.list_mcp_connectors(),
    )


def _merge_model_endpoint_results(*groups):
    items_by_id: dict[str, object] = {}
    for group in groups:
        for item in group:
            items_by_id[str(item.id)] = item
    return list(items_by_id.values())


def _count_worklist_category(items: list[RuntimeGovernanceWorklistItemResponse], category: str) -> int:
    return sum(1 for item in items if item.category == category)


def _read_worklist_item_detail_int(
    item: RuntimeGovernanceWorklistItemResponse,
    key: str,
) -> int:
    value = item.detail.get(key)
    return value if isinstance(value, int) else 0


def _sort_worklist_items(
    items: list[RuntimeGovernanceWorklistItemResponse],
) -> list[RuntimeGovernanceWorklistItemResponse]:
    return sorted(
        items,
        key=lambda item: (
            0 if item.severity == "attention" else 1,
            -item.recent_preview_failed_events,
            -_read_worklist_item_detail_int(item, "bound_agent_count"),
            -_read_worklist_item_detail_int(item, "integration_ready_tool_count"),
            item.resource_name.lower(),
            item.resource_slug.lower(),
        ),
    )


def _matches_worklist_filters(
    item: RuntimeGovernanceWorklistItemResponse,
    *,
    category: str | None,
    severity: str | None,
    resource_type: str | None,
    query: str | None,
) -> bool:
    if category is not None and item.category != category:
        return False
    if severity is not None and item.severity != severity:
        return False
    if resource_type is not None and item.resource_type != resource_type:
        return False
    normalized_query = (query or "").strip().lower()
    if normalized_query:
        haystacks = [
            item.resource_name,
            item.resource_slug,
            item.category,
            item.action_hint,
            item.resource_type,
            " ".join(f"{key}:{value}" for key, value in item.detail.items()),
        ]
        if not any(normalized_query in str(value).lower() for value in haystacks):
            return False
    return True
