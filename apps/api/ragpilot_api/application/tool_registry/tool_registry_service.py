from datetime import datetime, timedelta, timezone
from uuid import UUID

from ragpilot_api.application.errors import ResourceConflictError
from ragpilot_api.application.mcp_connectors.mcp_connector_registry_service import (
    build_recent_preview_activity_by_resource_id,
)
from ragpilot_api.application.mcp_connectors.mcp_connector_registry_service import is_mcp_connector_runtime_ready
from ragpilot_api.contracts.http.tool_registration_contracts import (
    ToolGovernanceActionResponse,
    ToolGovernanceSummaryResponse,
    ToolGovernanceActionType,
    ToolRegistrationCreateRequest,
    ToolRegistrationResponse,
    ToolSurfaceGovernanceBreakdownResponse,
    ToolTransportGovernanceBreakdownResponse,
    ToolRegistrationUpdateRequest,
)
from ragpilot_api.infrastructure.database.models import ToolRegistration
from ragpilot_api.infrastructure.database.repositories.agent_repository import AgentRepository
from ragpilot_api.infrastructure.database.repositories.mcp_connector_repository import McpConnectorRepository
from ragpilot_api.infrastructure.observability import traced
from ragpilot_api.infrastructure.database.repositories.runtime_governance_event_repository import RuntimeGovernanceEventRepository
from ragpilot_api.infrastructure.database.repositories.tool_registration_repository import ToolRegistrationRepository
from ragpilot_api.shared.settings import Settings, get_settings


class ToolRegistryService:
    def __init__(
        self,
        tool_registration_repository: ToolRegistrationRepository,
        agent_repository: AgentRepository,
        mcp_connector_repository: McpConnectorRepository | None = None,
        runtime_governance_event_repository: RuntimeGovernanceEventRepository | None = None,
        settings: Settings | None = None,
    ) -> None:
        self.tool_registration_repository = tool_registration_repository
        self.agent_repository = agent_repository
        self.mcp_connector_repository = mcp_connector_repository
        self.runtime_governance_event_repository = runtime_governance_event_repository
        self.settings = settings or get_settings()

    async def create_tool_registration(self, request: ToolRegistrationCreateRequest) -> ToolRegistrationResponse:
        tool_registration = await self.tool_registration_repository.create_tool_registration(
            name=request.name,
            slug=request.slug,
            transport_type=request.transport_type,
            surface_area=request.surface_area,
            endpoint_url=normalize_endpoint_url(request.endpoint_url),
            connector_reference=normalize_connector_reference(
                transport_type=request.transport_type,
                connector_reference=request.connector_reference,
            ),
            description=request.description,
            capabilities=normalize_capabilities(request.capabilities),
            requires_admin_approval=request.requires_admin_approval,
            is_enabled=request.is_enabled,
        )
        return build_tool_registration_response(tool_registration)

    async def list_tool_registrations(
        self,
        *,
        transport_type: str | None = None,
        surface_area: str | None = None,
        is_enabled: bool | None = None,
        requires_admin_approval: bool | None = None,
        runtime_state: str | None = None,
        query: str | None = None,
    ) -> list[ToolRegistrationResponse]:
        tool_registrations = await self.tool_registration_repository.list_tool_registrations(
            transport_type=transport_type,
            surface_area=surface_area,
            is_enabled=is_enabled,
            requires_admin_approval=requires_admin_approval,
            query=query,
        )
        binding_counts = await self.agent_repository.list_tool_registration_binding_counts()
        connector_runtime_by_slug = await self._build_mcp_connector_runtime_by_slug()
        preview_activity_by_tool_id = await self._build_recent_preview_activity_by_tool_id()
        responses = [
            build_tool_registration_response(
                tool_registration,
                bound_agent_count=binding_counts.get(str(tool_registration.id), 0),
                preview_activity=preview_activity_by_tool_id.get(str(tool_registration.id)),
            )
            for tool_registration in tool_registrations
        ]
        if runtime_state is None:
            return responses
        return [
            response
            for response in responses
            if _matches_tool_runtime_state(
                response,
                runtime_state,
                connector_runtime_by_slug=connector_runtime_by_slug,
            )
        ]

    async def update_tool_registration(
        self,
        *,
        tool_registration_id: UUID,
        request: ToolRegistrationUpdateRequest,
    ) -> ToolRegistrationResponse | None:
        tool_registration = await self.tool_registration_repository.update_tool_registration(
            tool_registration_id=tool_registration_id,
            name=request.name,
            slug=request.slug,
            transport_type=request.transport_type,
            surface_area=request.surface_area,
            endpoint_url=normalize_endpoint_url(request.endpoint_url),
            connector_reference=normalize_connector_reference(
                transport_type=request.transport_type,
                connector_reference=request.connector_reference,
            ),
            description=request.description,
            capabilities=normalize_capabilities(request.capabilities),
            requires_admin_approval=request.requires_admin_approval,
            is_enabled=request.is_enabled,
        )
        if tool_registration is None:
            return None
        bound_agent_count = await self.agent_repository.count_agents_using_tool_registration(
            tool_registration_id=tool_registration.id
        )
        preview_activity_by_tool_id = await self._build_recent_preview_activity_by_tool_id()
        return build_tool_registration_response(
            tool_registration,
            bound_agent_count=bound_agent_count,
            preview_activity=preview_activity_by_tool_id.get(str(tool_registration.id)),
        )

    @traced("approval.tool_governance.decision")
    async def apply_tool_governance_action(
        self,
        *,
        tool_registration_id: UUID,
        action_type: ToolGovernanceActionType,
    ) -> ToolGovernanceActionResponse | None:
        tool_registration = await self.tool_registration_repository.get_tool_registration(
            tool_registration_id=tool_registration_id
        )
        if tool_registration is None:
            return None

        next_requires_admin_approval = tool_registration.requires_admin_approval
        next_is_enabled = tool_registration.is_enabled

        if action_type == "disable_tool":
            next_is_enabled = False
            summary = "Tool registration disabled. Bound agents will now treat this tool as unavailable."
        elif action_type == "enable_tool":
            next_is_enabled = True
            summary = "Tool registration enabled. Bound agents can resume using this tool when other runtime conditions are ready."
        elif action_type == "require_admin_approval":
            next_requires_admin_approval = True
            summary = "Tool registration now requires super-admin approval before invocation."
        elif action_type == "allow_direct_use":
            next_requires_admin_approval = False
            summary = "Tool registration no longer requires super-admin approval for direct invocation."
        elif action_type == "review_mcp_boundary":
            ensure_mcp_boundary_action(tool_registration=tool_registration, action_type=action_type)
            next_is_enabled = True
            next_requires_admin_approval = True
            summary = "Reserved MCP boundary moved into reviewing. Invocations remain approval-gated until the integration boundary is cleared."
        elif action_type == "ready_mcp_integration":
            ensure_mcp_boundary_action(tool_registration=tool_registration, action_type=action_type)
            await self.ensure_mcp_connector_ready(tool_registration=tool_registration, action_type=action_type)
            next_is_enabled = True
            next_requires_admin_approval = False
            summary = "Reserved MCP boundary marked ready for integration. The tool remains reserved, but the governance boundary is now cleared for direct runtime use."
        elif action_type == "quarantine_mcp_boundary":
            ensure_mcp_boundary_action(tool_registration=tool_registration, action_type=action_type)
            next_is_enabled = False
            next_requires_admin_approval = True
            summary = "Reserved MCP boundary quarantined. Invocations are blocked until governance review moves it back into review or integration-ready status."
        else:
            next_is_enabled = False
            next_requires_admin_approval = True
            summary = "Tool registration quarantined. Invocation is blocked until governance review re-enables it."

        updated_tool_registration = await self.tool_registration_repository.update_tool_registration(
            tool_registration_id=tool_registration.id,
            name=tool_registration.name,
            slug=tool_registration.slug,
            transport_type=tool_registration.transport_type,
            surface_area=tool_registration.surface_area,
            endpoint_url=normalize_endpoint_url(tool_registration.endpoint_url),
            connector_reference=normalize_connector_reference(
                transport_type=tool_registration.transport_type,
                connector_reference=getattr(tool_registration, "connector_reference", None),
            ),
            description=tool_registration.description,
            capabilities=normalize_capabilities(list(tool_registration.capabilities_json or [])),
            requires_admin_approval=next_requires_admin_approval,
            is_enabled=next_is_enabled,
        )
        if updated_tool_registration is None:
            return None

        bound_agent_count = await self.agent_repository.count_agents_using_tool_registration(
            tool_registration_id=updated_tool_registration.id
        )
        return ToolGovernanceActionResponse(
            action_type=action_type,
            summary=summary,
            tool_registration=build_tool_registration_response(
                updated_tool_registration,
                bound_agent_count=bound_agent_count,
            ),
        )

    async def delete_tool_registration(self, *, tool_registration_id: UUID) -> bool:
        bound_agent_count = await self.agent_repository.count_agents_using_tool_registration(
            tool_registration_id=tool_registration_id
        )
        if bound_agent_count > 0:
            noun = "agent" if bound_agent_count == 1 else "agents"
            raise ResourceConflictError(
                f"Tool registration is still assigned to {bound_agent_count} {noun}. Remove those agent bindings before deleting it."
            )
        return await self.tool_registration_repository.delete_tool_registration(tool_registration_id=tool_registration_id)

    async def get_tool_governance_summary(self) -> ToolGovernanceSummaryResponse:
        tool_registrations = await self.tool_registration_repository.list_tool_registrations()
        binding_counts = await self.agent_repository.list_tool_registration_binding_counts()
        connector_runtime_by_slug = await self._build_mcp_connector_runtime_by_slug()

        transport_breakdown: dict[str, ToolTransportGovernanceBreakdownResponse] = {
            "native": ToolTransportGovernanceBreakdownResponse(transport_type="native"),
            "http": ToolTransportGovernanceBreakdownResponse(transport_type="http"),
            "mcp_reserved": ToolTransportGovernanceBreakdownResponse(transport_type="mcp_reserved"),
        }
        surface_breakdown: dict[str, ToolSurfaceGovernanceBreakdownResponse] = {
            "chat": ToolSurfaceGovernanceBreakdownResponse(surface_area="chat"),
            "documents": ToolSurfaceGovernanceBreakdownResponse(surface_area="documents"),
            "operations": ToolSurfaceGovernanceBreakdownResponse(surface_area="operations"),
            "admin": ToolSurfaceGovernanceBreakdownResponse(surface_area="admin"),
            "agents": ToolSurfaceGovernanceBreakdownResponse(surface_area="agents"),
        }
        summary = ToolGovernanceSummaryResponse()

        if self.runtime_governance_event_repository is not None:
            recent_preview_events = await self.runtime_governance_event_repository.list_runtime_governance_events(
                resource_type="tool_registration",
                action_types=["preview_completed", "preview_blocked", "preview_failed"],
                created_after=datetime.now(timezone.utc).replace(microsecond=0)
                - timedelta(hours=max(self.settings.tool_preview_review_window_hours, 1)),
                limit=500,
            )
            for event in recent_preview_events:
                if event.action_type == "preview_completed":
                    summary.recent_preview_completed_events += 1
                elif event.action_type == "preview_blocked":
                    summary.recent_preview_blocked_events += 1
                else:
                    summary.recent_preview_failed_events += 1
                if summary.last_preview_at is None or event.created_at >= summary.last_preview_at:
                    invocation_status = str(event.detail_json.get("invocation_status") or "").strip().lower()
                    summary.last_preview_status = invocation_status or None
                    summary.last_preview_at = event.created_at

        for tool_registration in tool_registrations:
            bound_agent_count = binding_counts.get(str(tool_registration.id), 0)
            is_bound = bound_agent_count > 0
            has_http_endpoint = bool((tool_registration.endpoint_url or "").strip())
            runtime_ready = tool_registration.is_enabled and (
                tool_registration.transport_type == "native"
                or (tool_registration.transport_type == "http" and has_http_endpoint)
            )

            summary.total_tools += 1
            if tool_registration.is_enabled:
                summary.enabled_tools += 1
            else:
                summary.disabled_tools += 1
            if is_bound:
                summary.bound_tools += 1
            if tool_registration.requires_admin_approval:
                summary.approval_required_tools += 1
            if runtime_ready:
                summary.runtime_ready_tools += 1

            transport_entry = transport_breakdown[tool_registration.transport_type]
            transport_entry.total_tools += 1
            if tool_registration.is_enabled:
                transport_entry.enabled_tools += 1
            if is_bound:
                transport_entry.bound_tools += 1
            if tool_registration.requires_admin_approval:
                transport_entry.approval_required_tools += 1
            if tool_registration.transport_type == "http" and not has_http_endpoint:
                transport_entry.missing_endpoint_tools += 1
            if bool(normalize_connector_reference(
                transport_type=tool_registration.transport_type,
                connector_reference=getattr(tool_registration, "connector_reference", None),
            )):
                transport_entry.connector_configured_tools += 1
            if runtime_ready:
                transport_entry.runtime_ready_tools += 1

            surface_entry = surface_breakdown[tool_registration.surface_area]
            surface_entry.total_tools += 1
            if tool_registration.is_enabled:
                surface_entry.enabled_tools += 1
            if is_bound:
                surface_entry.bound_tools += 1
            if tool_registration.requires_admin_approval:
                surface_entry.approval_required_tools += 1

            if tool_registration.transport_type == "native":
                summary.native_tools += 1
            elif tool_registration.transport_type == "http":
                summary.http_tools += 1
                if not has_http_endpoint:
                    summary.http_tools_missing_endpoint_tools += 1
            else:
                summary.mcp_reserved_tools += 1
                if is_bound:
                    summary.mcp_reserved_bound_tools += 1
                if tool_registration.is_enabled and not tool_registration.requires_admin_approval:
                    summary.mcp_integration_pending_tools += 1
                if bool(normalize_connector_reference(
                    transport_type=tool_registration.transport_type,
                    connector_reference=getattr(tool_registration, "connector_reference", None),
                )):
                    summary.mcp_connector_configured_tools += 1
                    connector_reference = normalize_connector_reference(
                        transport_type=tool_registration.transport_type,
                        connector_reference=getattr(tool_registration, "connector_reference", None),
                    )
                    if connector_reference and connector_runtime_by_slug.get(connector_reference) is not True:
                        summary.mcp_connector_unhealthy_tools += 1

        summary.transport_breakdown = list(transport_breakdown.values())
        summary.surface_breakdown = list(surface_breakdown.values())
        return summary

    async def _build_mcp_connector_runtime_by_slug(self) -> dict[str, bool]:
        if self.mcp_connector_repository is None:
            return {}

        mcp_connectors = await self.mcp_connector_repository.list_mcp_connectors()
        return {
            mcp_connector.slug: is_mcp_connector_runtime_ready(mcp_connector)
            for mcp_connector in mcp_connectors
        }

    async def _build_recent_preview_activity_by_tool_id(self) -> dict[str, dict[str, object]]:
        if self.runtime_governance_event_repository is None:
            return {}

        recent_preview_events = await self.runtime_governance_event_repository.list_runtime_governance_events(
            resource_type="tool_registration",
            action_types=["preview_completed", "preview_blocked", "preview_failed"],
            created_after=datetime.now(timezone.utc).replace(microsecond=0)
            - timedelta(hours=max(self.settings.tool_preview_review_window_hours, 1)),
            limit=500,
        )
        return build_recent_preview_activity_by_resource_id(
            recent_preview_events,
            status_field_name="invocation_status",
        )

    async def ensure_mcp_connector_ready(
        self,
        *,
        tool_registration: ToolRegistration,
        action_type: ToolGovernanceActionType,
    ) -> None:
        connector_reference = ensure_mcp_connector_reference(
            tool_registration=tool_registration,
            action_type=action_type,
        )
        if self.mcp_connector_repository is None:
            return
        mcp_connector = await self.mcp_connector_repository.get_mcp_connector_by_slug(
            connector_slug=connector_reference,
        )
        if mcp_connector is None:
            raise ResourceConflictError(
                f"{action_type} requires connector_reference '{connector_reference}' to resolve to a managed MCP connector."
            )
        if not mcp_connector.is_enabled:
            raise ResourceConflictError(
                f"{action_type} requires the resolved MCP connector '{connector_reference}' to be enabled."
            )
        if not is_mcp_connector_runtime_ready(mcp_connector):
            raise ResourceConflictError(
                f"{action_type} requires the resolved MCP connector '{connector_reference}' to be runtime-ready before the reserved MCP tool can enter integration-ready state."
            )


def ensure_mcp_boundary_action(*, tool_registration: ToolRegistration, action_type: ToolGovernanceActionType) -> None:
    if tool_registration.transport_type != "mcp_reserved":
        raise ResourceConflictError(
            f"{action_type} is only available for reserved MCP tool registrations."
        )


def ensure_mcp_connector_reference(*, tool_registration: ToolRegistration, action_type: ToolGovernanceActionType) -> str:
    connector_reference = normalize_connector_reference(
        transport_type=tool_registration.transport_type,
        connector_reference=getattr(tool_registration, "connector_reference", None),
    )
    if not connector_reference:
        raise ResourceConflictError(
            f"{action_type} requires a connector_reference before the reserved MCP tool can move into integration-ready state."
        )
    return connector_reference


def normalize_capabilities(capabilities: list[str]) -> list[str]:
    normalized_capabilities: list[str] = []
    for capability in capabilities:
        normalized_capability = capability.strip()
        if normalized_capability and normalized_capability not in normalized_capabilities:
            normalized_capabilities.append(normalized_capability)
    return normalized_capabilities


def normalize_endpoint_url(endpoint_url: str | None) -> str | None:
    if endpoint_url is None:
        return None
    normalized = endpoint_url.strip()
    return normalized or None


def normalize_connector_reference(*, transport_type: str, connector_reference: str | None) -> str | None:
    if transport_type != "mcp_reserved":
        return None
    if connector_reference is None:
        return None
    normalized = connector_reference.strip()
    return normalized or None


def _matches_tool_runtime_state(
    tool_registration: ToolRegistrationResponse,
    runtime_state: str,
    *,
    connector_runtime_by_slug: dict[str, bool] | None = None,
) -> bool:
    if runtime_state == "approval_required":
        return tool_registration.requires_admin_approval
    if runtime_state == "disabled":
        return not tool_registration.is_enabled
    if runtime_state == "missing_endpoint":
        return tool_registration.transport_type == "http" and not (tool_registration.endpoint_url or "").strip()
    if runtime_state == "mcp_reserved":
        return tool_registration.transport_type == "mcp_reserved"
    if runtime_state == "mcp_reserved_bound":
        return tool_registration.transport_type == "mcp_reserved" and tool_registration.bound_agent_count > 0
    if runtime_state == "mcp_integration_pending":
        return (
            tool_registration.transport_type == "mcp_reserved"
            and tool_registration.is_enabled
            and not tool_registration.requires_admin_approval
        )
    if runtime_state == "mcp_connector_configured":
        return (
            tool_registration.transport_type == "mcp_reserved"
            and bool(normalize_connector_reference(
                transport_type=tool_registration.transport_type,
                connector_reference=tool_registration.connector_reference,
            ))
        )
    if runtime_state == "mcp_connector_unhealthy":
        connector_reference = normalize_connector_reference(
            transport_type=tool_registration.transport_type,
            connector_reference=tool_registration.connector_reference,
        )
        return (
            tool_registration.transport_type == "mcp_reserved"
            and bool(connector_reference)
            and (connector_runtime_by_slug or {}).get(connector_reference) is not True
        )
    if runtime_state == "runtime_ready":
        return tool_registration.is_enabled and (
            tool_registration.transport_type == "native"
            or (
                tool_registration.transport_type == "http"
                and bool((tool_registration.endpoint_url or "").strip())
            )
        )
    return True


def build_tool_registration_response(
    tool_registration: ToolRegistration,
    *,
    bound_agent_count: int = 0,
    preview_activity: dict[str, object] | None = None,
) -> ToolRegistrationResponse:
    preview_activity = preview_activity or {}
    return ToolRegistrationResponse(
        id=tool_registration.id,
        name=tool_registration.name,
        slug=tool_registration.slug,
        transport_type=tool_registration.transport_type,
        surface_area=tool_registration.surface_area,
        endpoint_url=tool_registration.endpoint_url,
        connector_reference=getattr(tool_registration, "connector_reference", None),
        description=tool_registration.description,
        capabilities=list(tool_registration.capabilities_json or []),
        requires_admin_approval=tool_registration.requires_admin_approval,
        is_enabled=tool_registration.is_enabled,
        bound_agent_count=bound_agent_count,
        recent_preview_completed_events=int(preview_activity.get("completed", 0)),
        recent_preview_blocked_events=int(preview_activity.get("blocked", 0)),
        recent_preview_failed_events=int(preview_activity.get("failed", 0)),
        last_preview_status=preview_activity.get("last_status"),
        last_preview_at=preview_activity.get("last_at"),
        created_at=tool_registration.created_at,
        updated_at=tool_registration.updated_at,
    )
