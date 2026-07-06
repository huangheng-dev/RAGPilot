from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from uuid import UUID

from ragpilot_api.contracts.http.agent_contracts import (
    AgentRuntimeFocusMcpConnectorResponse,
    AgentRuntimeFocusToolRegistrationResponse,
    AgentRuntimeGovernanceItemResponse,
    AgentRuntimeGovernanceResponse,
    AgentRuntimeGovernanceSummaryResponse,
    AgentRuntimeIssueCountsResponse,
    AgentRuntimeReadinessIssue,
    AgentRuntimeResolvedModelEndpointResponse,
    AgentRuntimeResolvedRetrievalProfileResponse,
    AgentRuntimeResolvedScopeResponse,
)
from ragpilot_api.application.model_registry.runtime_configuration import (
    is_model_runtime_configured,
    normalize_model_endpoint_provider_name,
    read_model_runtime_configuration_issue,
)
from ragpilot_api.application.mcp_connectors.mcp_connector_registry_service import (
    build_recent_preview_activity_by_resource_id,
)
from ragpilot_api.infrastructure.database.models import (
    AgentDefinition,
    KnowledgeBase,
    McpConnector,
    ModelEndpoint,
    RetrievalProfile,
    ToolRegistration,
    Workspace,
)
from ragpilot_api.infrastructure.database.repositories.agent_repository import AgentRepository
from ragpilot_api.infrastructure.database.repositories.knowledge_base_repository import KnowledgeBaseRepository
from ragpilot_api.infrastructure.database.repositories.mcp_connector_repository import McpConnectorRepository
from ragpilot_api.infrastructure.database.repositories.model_endpoint_repository import ModelEndpointRepository
from ragpilot_api.infrastructure.database.repositories.retrieval_profile_repository import RetrievalProfileRepository
from ragpilot_api.infrastructure.database.repositories.tool_registration_repository import ToolRegistrationRepository
from ragpilot_api.infrastructure.database.repositories.workspace_repository import WorkspaceRepository
from ragpilot_api.infrastructure.database.repositories.runtime_governance_event_repository import RuntimeGovernanceEventRepository
from ragpilot_api.shared.settings import Settings


@dataclass(frozen=True)
class ResolvedGovernanceScope:
    workspace: Workspace | None
    knowledge_base: KnowledgeBase | None
    scope_issue: str | None


class AgentRuntimeGovernanceService:
    def __init__(
        self,
        agent_repository: AgentRepository,
        model_endpoint_repository: ModelEndpointRepository,
        tool_registration_repository: ToolRegistrationRepository,
        retrieval_profile_repository: RetrievalProfileRepository,
        workspace_repository: WorkspaceRepository,
        knowledge_base_repository: KnowledgeBaseRepository,
        runtime_governance_event_repository: RuntimeGovernanceEventRepository | None = None,
        settings: Settings | None = None,
        mcp_connector_repository: McpConnectorRepository | None = None,
    ) -> None:
        self.agent_repository = agent_repository
        self.model_endpoint_repository = model_endpoint_repository
        self.tool_registration_repository = tool_registration_repository
        self.mcp_connector_repository = mcp_connector_repository
        self.retrieval_profile_repository = retrieval_profile_repository
        self.workspace_repository = workspace_repository
        self.knowledge_base_repository = knowledge_base_repository
        self.runtime_governance_event_repository = runtime_governance_event_repository
        self.settings = settings

    async def get_runtime_governance_posture(
        self,
        *,
        tenant_id: UUID | None = None,
        status: str | None = None,
        mode: str | None = None,
        query: str | None = None,
        readiness: str | None = None,
        issue: AgentRuntimeReadinessIssue | None = None,
        model_endpoint_id: UUID | None = None,
        model_provider_type: str | None = None,
        tool_registration_id: UUID | None = None,
        retrieval_profile_id: UUID | None = None,
    ) -> AgentRuntimeGovernanceResponse:
        agent_definitions = await self.agent_repository.list_agent_definitions_for_governance(
            tenant_id=tenant_id,
            status=status,
            mode=mode,
            query=query,
        )
        model_endpoints = await self.model_endpoint_repository.list_model_endpoints()
        tool_registrations = await self.tool_registration_repository.list_tool_registrations()
        mcp_connectors = (
            await self.mcp_connector_repository.list_mcp_connectors()
            if self.mcp_connector_repository is not None
            else []
        )
        retrieval_profiles = await self.retrieval_profile_repository.list_retrieval_profiles()

        tenant_workspace_map, workspace_knowledge_base_map = await self._load_scope_maps(agent_definitions)
        model_endpoint_by_id = {str(item.id): item for item in model_endpoints}
        tool_registration_by_id = {str(item.id): item for item in tool_registrations}
        mcp_connector_by_slug = {str(item.slug): item for item in mcp_connectors}
        retrieval_profile_by_id = {str(item.id): item for item in retrieval_profiles}
        preview_activity_by_model_endpoint_id = await self._build_recent_preview_activity_by_model_endpoint_id()
        preview_activity_by_tool_registration_id = await self._build_recent_preview_activity_by_tool_registration_id()
        preview_activity_by_mcp_connector_id = await self._build_recent_preview_activity_by_mcp_connector_id()
        default_model_endpoint = self._resolve_default_model_endpoint(model_endpoints)
        default_retrieval_profile = self._resolve_default_retrieval_profile(retrieval_profiles)

        items: list[AgentRuntimeGovernanceItemResponse] = []

        for agent_definition in agent_definitions:
            item = self._build_governance_item(
                agent_definition=agent_definition,
                model_endpoint_by_id=model_endpoint_by_id,
                tool_registration_by_id=tool_registration_by_id,
                mcp_connector_by_slug=mcp_connector_by_slug,
                retrieval_profile_by_id=retrieval_profile_by_id,
                tenant_workspace_map=tenant_workspace_map,
                workspace_knowledge_base_map=workspace_knowledge_base_map,
                preview_activity_by_model_endpoint_id=preview_activity_by_model_endpoint_id,
                preview_activity_by_tool_registration_id=preview_activity_by_tool_registration_id,
                preview_activity_by_mcp_connector_id=preview_activity_by_mcp_connector_id,
                default_model_endpoint=default_model_endpoint,
                default_retrieval_profile=default_retrieval_profile,
            )
            if self._matches_runtime_filters(
                item=item,
                readiness=readiness,
                issue=issue,
                model_endpoint_id=model_endpoint_id,
                model_provider_type=model_provider_type,
                tool_registration_id=tool_registration_id,
                retrieval_profile_id=retrieval_profile_id,
            ):
                items.append(item)

        issue_counts = AgentRuntimeIssueCountsResponse()
        for item in items:
            for current_issue in set(item.issues):
                setattr(issue_counts, current_issue, getattr(issue_counts, current_issue) + 1)

        active_items = [item for item in items if item.status == "active"]
        summary = AgentRuntimeGovernanceSummaryResponse(
            total_agents=len(items),
            active_agents=len(active_items),
            paused_agents=sum(1 for item in items if item.status == "paused"),
            draft_agents=sum(1 for item in items if item.status == "draft"),
            attention_agents=sum(1 for item in active_items if not item.is_ready),
            ready_agents=sum(1 for item in active_items if item.is_ready),
            active_agents_without_scope=sum(
                1 for item in active_items if "scope_missing" in item.issues
            ),
            agents_missing_model=sum(1 for item in active_items if "model_missing" in item.issues),
            agents_using_disabled_model=sum(1 for item in active_items if "model_disabled" in item.issues),
            agents_using_unconfigured_model=sum(
                1 for item in active_items if "model_runtime_unconfigured" in item.issues
            ),
            agents_missing_retrieval_profile=sum(
                1 for item in active_items if "retrieval_profile_missing" in item.issues
            ),
            agents_using_disabled_retrieval_profile=sum(
                1 for item in active_items if "retrieval_profile_disabled" in item.issues
            ),
            agents_missing_tool_registration=sum(
                1 for item in active_items if item.missing_tool_registration_count > 0
            ),
            agents_using_disabled_tool_registration=sum(
                1 for item in active_items if item.disabled_registered_tool_count > 0
            ),
            model_endpoints=len(model_endpoints),
            enabled_models=sum(1 for item in model_endpoints if item.is_enabled),
            disabled_bound_models=sum(1 for item in model_endpoints if (not item.is_enabled) and self._is_model_bound(item, items)),
            unbound_enabled_models=sum(1 for item in model_endpoints if item.is_enabled and not self._is_model_bound(item, items)),
            tool_registrations=len(tool_registrations),
            enabled_tools=sum(1 for item in tool_registrations if item.is_enabled),
            approval_gated_tools=sum(1 for item in tool_registrations if item.requires_admin_approval),
            disabled_bound_tools=sum(
                1 for item in tool_registrations if (not item.is_enabled) and self._is_tool_bound(item, items)
            ),
            unbound_enabled_tools=sum(
                1 for item in tool_registrations if item.is_enabled and not self._is_tool_bound(item, items)
            ),
            issue_counts=issue_counts,
        )
        return AgentRuntimeGovernanceResponse(summary=summary, items=items)

    def _matches_runtime_filters(
        self,
        *,
        item: AgentRuntimeGovernanceItemResponse,
        readiness: str | None,
        issue: AgentRuntimeReadinessIssue | None,
        model_endpoint_id: UUID | None,
        model_provider_type: str | None,
        tool_registration_id: UUID | None,
        retrieval_profile_id: UUID | None,
    ) -> bool:
        if readiness == "ready" and not item.is_ready:
            return False
        if readiness == "attention" and item.is_ready:
            return False
        if issue is not None and issue not in item.issues:
            return False
        if model_endpoint_id is not None:
            resolved_model_endpoint_id = item.resolved_model_endpoint.id if item.resolved_model_endpoint is not None else None
            if resolved_model_endpoint_id != model_endpoint_id:
                return False
        if model_provider_type is not None:
            resolved_provider_type = (
                normalize_model_endpoint_provider_name(item.resolved_model_endpoint.provider_type)
                if item.resolved_model_endpoint is not None
                else None
            )
            if resolved_provider_type != model_provider_type:
                return False
        if tool_registration_id is not None and tool_registration_id not in item.tool_registration_ids:
            return False
        if retrieval_profile_id is not None:
            resolved_retrieval_profile_id = (
                item.resolved_retrieval_profile.id if item.resolved_retrieval_profile is not None else None
            )
            if resolved_retrieval_profile_id != retrieval_profile_id:
                return False
        return True

    async def _load_scope_maps(
        self,
        agent_definitions: list[AgentDefinition],
    ) -> tuple[dict[str, list[Workspace]], dict[str, list[KnowledgeBase]]]:
        tenant_workspace_map: dict[str, list[Workspace]] = {}
        workspace_knowledge_base_map: dict[str, list[KnowledgeBase]] = {}
        for tenant_id in sorted({str(item.tenant_id) for item in agent_definitions}):
            workspaces = await self.workspace_repository.list_workspaces(tenant_id=UUID(tenant_id))
            tenant_workspace_map[tenant_id] = workspaces
            for workspace in workspaces:
                workspace_knowledge_base_map[str(workspace.id)] = await self.knowledge_base_repository.list_knowledge_bases(
                    workspace_id=workspace.id
                )
        return tenant_workspace_map, workspace_knowledge_base_map

    def _build_governance_item(
        self,
        *,
        agent_definition: AgentDefinition,
        model_endpoint_by_id: dict[str, ModelEndpoint],
        tool_registration_by_id: dict[str, ToolRegistration],
        mcp_connector_by_slug: dict[str, McpConnector],
        retrieval_profile_by_id: dict[str, RetrievalProfile],
        tenant_workspace_map: dict[str, list[Workspace]],
        workspace_knowledge_base_map: dict[str, list[KnowledgeBase]],
        preview_activity_by_model_endpoint_id: dict[str, dict[str, object]],
        preview_activity_by_tool_registration_id: dict[str, dict[str, object]],
        preview_activity_by_mcp_connector_id: dict[str, dict[str, object]],
        default_model_endpoint: ModelEndpoint | None,
        default_retrieval_profile: RetrievalProfile | None,
    ) -> AgentRuntimeGovernanceItemResponse:
        issues: list[AgentRuntimeReadinessIssue] = []
        selected_model_endpoint = (
            model_endpoint_by_id.get(str(agent_definition.model_endpoint_id))
            if agent_definition.model_endpoint_id is not None
            else None
        )
        resolved_model_endpoint = selected_model_endpoint or default_model_endpoint
        resolved_model_runtime_issue = (
            read_model_runtime_configuration_issue(
                provider_type=resolved_model_endpoint.provider_type,
                base_url=resolved_model_endpoint.base_url,
                credential_mode=resolved_model_endpoint.credential_mode,
                credential_key_hint=resolved_model_endpoint.credential_key_hint,
            )
            if resolved_model_endpoint is not None
            else None
        )
        resolved_model_runtime_ready = (
            resolved_model_endpoint.is_enabled
            and is_model_runtime_configured(
                provider_type=resolved_model_endpoint.provider_type,
                base_url=resolved_model_endpoint.base_url,
                credential_mode=resolved_model_endpoint.credential_mode,
                credential_key_hint=resolved_model_endpoint.credential_key_hint,
            )
            if resolved_model_endpoint is not None
            else False
        )
        resolved_model_preview_activity = (
            preview_activity_by_model_endpoint_id.get(str(resolved_model_endpoint.id), {})
            if resolved_model_endpoint is not None
            else {}
        )
        requires_knowledge_scope = agent_definition.agent_mode in {"grounded_chat", "document_intake"}
        resolved_scope = self._resolve_scope(
            agent_definition=agent_definition,
            workspaces=tenant_workspace_map.get(str(agent_definition.tenant_id), []),
            workspace_knowledge_base_map=workspace_knowledge_base_map,
        )
        assigned_retrieval_profile = None
        resolved_retrieval_profile = None
        retrieval_profile_source = None
        if resolved_scope.knowledge_base is not None:
            assigned_retrieval_profile_id = str(resolved_scope.knowledge_base.retrieval_profile_id or "").strip()
            if assigned_retrieval_profile_id:
                assigned_retrieval_profile = retrieval_profile_by_id.get(assigned_retrieval_profile_id)
                resolved_retrieval_profile = assigned_retrieval_profile
                retrieval_profile_source = "knowledge_base"
            elif default_retrieval_profile is not None:
                resolved_retrieval_profile = default_retrieval_profile
                retrieval_profile_source = "platform_default"

        has_connected_capabilities = self._count_connected_capabilities(agent_definition) > 0
        tool_registration_ids = self._normalize_tool_registration_ids(agent_definition)
        disabled_tool_registration_id = next(
            (
                UUID(tool_registration_id)
                for tool_registration_id in tool_registration_ids
                if tool_registration_id in tool_registration_by_id
                and not tool_registration_by_id[tool_registration_id].is_enabled
            ),
            None,
        )
        approval_required_tool_registration_id = next(
            (
                UUID(tool_registration_id)
                for tool_registration_id in tool_registration_ids
                if tool_registration_id in tool_registration_by_id
                and tool_registration_by_id[tool_registration_id].requires_admin_approval
            ),
            None,
        )
        reserved_mcp_tool_registration_id = next(
            (
                UUID(tool_registration_id)
                for tool_registration_id in tool_registration_ids
                if tool_registration_id in tool_registration_by_id
                and tool_registration_by_id[tool_registration_id].is_enabled
                and tool_registration_by_id[tool_registration_id].transport_type == "mcp_reserved"
                and not str(getattr(tool_registration_by_id[tool_registration_id], "connector_reference", "") or "").strip()
            ),
            None,
        )
        integration_pending_mcp_tool_registration_id = next(
            (
                UUID(tool_registration_id)
                for tool_registration_id in tool_registration_ids
                if tool_registration_id in tool_registration_by_id
                and tool_registration_by_id[tool_registration_id].is_enabled
                and tool_registration_by_id[tool_registration_id].transport_type == "mcp_reserved"
                and bool(str(getattr(tool_registration_by_id[tool_registration_id], "connector_reference", "") or "").strip())
            ),
            None,
        )
        integration_pending_mcp_connector_reference = next(
            (
                str(getattr(tool_registration_by_id[tool_registration_id], "connector_reference", "") or "").strip()
                for tool_registration_id in tool_registration_ids
                if tool_registration_id in tool_registration_by_id
                and tool_registration_by_id[tool_registration_id].is_enabled
                and tool_registration_by_id[tool_registration_id].transport_type == "mcp_reserved"
                and bool(str(getattr(tool_registration_by_id[tool_registration_id], "connector_reference", "") or "").strip())
            ),
            None,
        )
        missing_tool_registration_count = sum(
            1 for tool_registration_id in tool_registration_ids if tool_registration_id not in tool_registration_by_id
        )
        disabled_registered_tool_count = sum(
            1
            for tool_registration_id in tool_registration_ids
            if tool_registration_id in tool_registration_by_id and not tool_registration_by_id[tool_registration_id].is_enabled
        )
        approval_required_tool_count = sum(
            1
            for tool_registration_id in tool_registration_ids
            if tool_registration_id in tool_registration_by_id
            and tool_registration_by_id[tool_registration_id].requires_admin_approval
        )
        reserved_mcp_tool_count = sum(
            1
            for tool_registration_id in tool_registration_ids
            if tool_registration_id in tool_registration_by_id
            and tool_registration_by_id[tool_registration_id].is_enabled
            and tool_registration_by_id[tool_registration_id].transport_type == "mcp_reserved"
            and not str(getattr(tool_registration_by_id[tool_registration_id], "connector_reference", "") or "").strip()
        )
        integration_pending_mcp_tool_count = sum(
            1
            for tool_registration_id in tool_registration_ids
            if tool_registration_id in tool_registration_by_id
            and tool_registration_by_id[tool_registration_id].is_enabled
            and tool_registration_by_id[tool_registration_id].transport_type == "mcp_reserved"
                and bool(str(getattr(tool_registration_by_id[tool_registration_id], "connector_reference", "") or "").strip())
        )
        focus_tool_registration_id = (
            str(disabled_tool_registration_id)
            if disabled_tool_registration_id is not None
            else str(approval_required_tool_registration_id)
            if approval_required_tool_registration_id is not None
            else str(integration_pending_mcp_tool_registration_id)
            if integration_pending_mcp_tool_registration_id is not None
            else str(reserved_mcp_tool_registration_id)
            if reserved_mcp_tool_registration_id is not None
            else None
        )
        focus_tool_registration = (
            tool_registration_by_id.get(focus_tool_registration_id)
            if focus_tool_registration_id is not None
            else None
        )
        focus_tool_preview_activity = (
            preview_activity_by_tool_registration_id.get(str(focus_tool_registration.id), {})
            if focus_tool_registration is not None
            else {}
        )
        focus_mcp_connector_reference = (
            str(getattr(focus_tool_registration, "connector_reference", "") or "").strip()
            if focus_tool_registration is not None
            else ""
        )
        focus_mcp_connector = (
            mcp_connector_by_slug.get(focus_mcp_connector_reference)
            if focus_mcp_connector_reference
            else None
        )
        focus_mcp_connector_preview_activity = (
            preview_activity_by_mcp_connector_id.get(str(focus_mcp_connector.id), {})
            if focus_mcp_connector is not None
            else {}
        )

        if resolved_model_endpoint is None:
            issues.append("model_missing")
        elif not resolved_model_endpoint.is_enabled:
            issues.append("model_disabled")
        elif not resolved_model_runtime_ready:
            issues.append("model_runtime_unconfigured")

        if requires_knowledge_scope:
            if resolved_scope.scope_issue == "scope_missing":
                issues.append("scope_missing")
            elif resolved_scope.scope_issue == "scope_invalid":
                issues.append("scope_invalid")
            elif resolved_retrieval_profile is None:
                issues.append("retrieval_profile_missing")
            elif not resolved_retrieval_profile.is_enabled:
                issues.append("retrieval_profile_disabled")

        if not has_connected_capabilities:
            issues.append("tools_missing")

        if missing_tool_registration_count > 0 or disabled_registered_tool_count > 0:
            issues.append("tool_registration_disabled")

        if approval_required_tool_count > 0:
            issues.append("tool_approval_required")
        if reserved_mcp_tool_count > 0:
            issues.append("tool_mcp_reserved")
        if integration_pending_mcp_tool_count > 0:
            issues.append("tool_mcp_integration_pending")

        blocking_issues = [issue for issue in issues if issue != "tool_approval_required"]
        return AgentRuntimeGovernanceItemResponse(
            id=agent_definition.id,
            tenant_id=agent_definition.tenant_id,
            name=agent_definition.name,
            slug=agent_definition.slug,
            mode=agent_definition.agent_mode,
            status=agent_definition.agent_status,
            objective=agent_definition.objective,
            knowledge_base_scope=agent_definition.knowledge_base_scope,
            model_endpoint_id=agent_definition.model_endpoint_id,
            tool_registration_ids=[UUID(item) for item in tool_registration_ids],
            tools=list(agent_definition.tool_bindings_json or []),
            created_at=agent_definition.created_at,
            updated_at=agent_definition.updated_at,
            is_ready=len(blocking_issues) == 0,
            issues=issues,
            blocking_issues=blocking_issues,
            has_connected_capabilities=has_connected_capabilities,
            approval_required_tool_count=approval_required_tool_count,
            disabled_registered_tool_count=disabled_registered_tool_count,
            missing_tool_registration_count=missing_tool_registration_count,
            reserved_mcp_tool_count=reserved_mcp_tool_count,
            integration_pending_mcp_tool_count=integration_pending_mcp_tool_count,
            disabled_tool_registration_id=disabled_tool_registration_id,
            approval_required_tool_registration_id=approval_required_tool_registration_id,
            reserved_mcp_tool_registration_id=reserved_mcp_tool_registration_id,
            integration_pending_mcp_tool_registration_id=integration_pending_mcp_tool_registration_id,
            integration_pending_mcp_connector_reference=integration_pending_mcp_connector_reference,
            focus_tool_registration=(
                AgentRuntimeFocusToolRegistrationResponse(
                    id=focus_tool_registration.id,
                    name=focus_tool_registration.name,
                    slug=focus_tool_registration.slug,
                    transport_type=focus_tool_registration.transport_type,
                    surface_area=focus_tool_registration.surface_area,
                    endpoint_url=focus_tool_registration.endpoint_url,
                    connector_reference=focus_tool_registration.connector_reference,
                    requires_admin_approval=focus_tool_registration.requires_admin_approval,
                    is_enabled=focus_tool_registration.is_enabled,
                    recent_preview_completed_events=int(focus_tool_preview_activity.get("completed", 0)),
                    recent_preview_blocked_events=int(focus_tool_preview_activity.get("blocked", 0)),
                    recent_preview_failed_events=int(focus_tool_preview_activity.get("failed", 0)),
                    last_preview_status=focus_tool_preview_activity.get("last_status"),
                    last_preview_at=focus_tool_preview_activity.get("last_at"),
                )
                if focus_tool_registration is not None
                else None
            ),
            focus_mcp_connector=(
                AgentRuntimeFocusMcpConnectorResponse(
                    id=focus_mcp_connector.id,
                    name=focus_mcp_connector.name,
                    slug=focus_mcp_connector.slug,
                    connector_type=focus_mcp_connector.connector_type,
                    base_url=focus_mcp_connector.base_url,
                    auth_mode=focus_mcp_connector.auth_mode,
                    credential_key_hint=focus_mcp_connector.credential_key_hint,
                    is_enabled=focus_mcp_connector.is_enabled,
                    recent_preview_completed_events=int(focus_mcp_connector_preview_activity.get("completed", 0)),
                    recent_preview_blocked_events=int(focus_mcp_connector_preview_activity.get("blocked", 0)),
                    recent_preview_failed_events=int(focus_mcp_connector_preview_activity.get("failed", 0)),
                    last_preview_status=focus_mcp_connector_preview_activity.get("last_status"),
                    last_preview_at=focus_mcp_connector_preview_activity.get("last_at"),
                )
                if focus_mcp_connector is not None
                else None
            ),
            resolved_scope=AgentRuntimeResolvedScopeResponse(
                workspace_id=resolved_scope.workspace.id if resolved_scope.workspace is not None else None,
                workspace_slug=resolved_scope.workspace.slug if resolved_scope.workspace is not None else None,
                workspace_name=resolved_scope.workspace.name if resolved_scope.workspace is not None else None,
                knowledge_base_id=resolved_scope.knowledge_base.id if resolved_scope.knowledge_base is not None else None,
                knowledge_base_slug=resolved_scope.knowledge_base.slug if resolved_scope.knowledge_base is not None else None,
                knowledge_base_name=resolved_scope.knowledge_base.name if resolved_scope.knowledge_base is not None else None,
                scope_issue=resolved_scope.scope_issue,
            ),
            resolved_model_endpoint=(
                AgentRuntimeResolvedModelEndpointResponse(
                    id=resolved_model_endpoint.id,
                    name=resolved_model_endpoint.name,
                    slug=resolved_model_endpoint.slug,
                    provider_type=resolved_model_endpoint.provider_type,
                    model_name=resolved_model_endpoint.model_name,
                    base_url=resolved_model_endpoint.base_url,
                    credential_mode=resolved_model_endpoint.credential_mode,
                    credential_key_hint=resolved_model_endpoint.credential_key_hint,
                    capabilities=list(resolved_model_endpoint.capabilities_json or []),
                    is_enabled=resolved_model_endpoint.is_enabled,
                    is_default=resolved_model_endpoint.is_default,
                    runtime_ready=resolved_model_runtime_ready,
                    runtime_issue=resolved_model_runtime_issue,
                    recent_preview_completed_events=int(resolved_model_preview_activity.get("completed", 0)),
                    recent_preview_blocked_events=int(resolved_model_preview_activity.get("blocked", 0)),
                    recent_preview_failed_events=int(resolved_model_preview_activity.get("failed", 0)),
                    last_preview_status=resolved_model_preview_activity.get("last_status"),
                    last_preview_at=resolved_model_preview_activity.get("last_at"),
                )
                if resolved_model_endpoint is not None
                else None
            ),
            resolved_retrieval_profile=(
                AgentRuntimeResolvedRetrievalProfileResponse(
                    id=resolved_retrieval_profile.id,
                    name=resolved_retrieval_profile.name,
                    slug=resolved_retrieval_profile.slug,
                    retrieval_mode=resolved_retrieval_profile.retrieval_mode,
                    is_enabled=resolved_retrieval_profile.is_enabled,
                    is_default=resolved_retrieval_profile.is_default,
                    source=retrieval_profile_source,
                )
                if resolved_retrieval_profile is not None and retrieval_profile_source is not None
                else None
            ),
        )

    def _resolve_scope(
        self,
        *,
        agent_definition: AgentDefinition,
        workspaces: list[Workspace],
        workspace_knowledge_base_map: dict[str, list[KnowledgeBase]],
    ) -> ResolvedGovernanceScope:
        normalized_scope = (agent_definition.knowledge_base_scope or "").strip()
        if normalized_scope == "":
            return ResolvedGovernanceScope(workspace=None, knowledge_base=None, scope_issue="scope_missing")

        workspace_slug, separator, knowledge_base_slug = normalized_scope.partition("/")
        if separator == "" or workspace_slug.strip() == "" or knowledge_base_slug.strip() == "":
            return ResolvedGovernanceScope(workspace=None, knowledge_base=None, scope_issue="scope_invalid")

        workspace = next((item for item in workspaces if item.slug == workspace_slug.strip()), None)
        if workspace is None:
            return ResolvedGovernanceScope(workspace=None, knowledge_base=None, scope_issue="scope_invalid")

        knowledge_base = next(
            (
                item
                for item in workspace_knowledge_base_map.get(str(workspace.id), [])
                if item.slug == knowledge_base_slug.strip()
            ),
            None,
        )
        if knowledge_base is None:
            return ResolvedGovernanceScope(workspace=workspace, knowledge_base=None, scope_issue="scope_invalid")

        return ResolvedGovernanceScope(workspace=workspace, knowledge_base=knowledge_base, scope_issue=None)

    def _resolve_default_model_endpoint(self, model_endpoints: list[ModelEndpoint]) -> ModelEndpoint | None:
        return next(
            (
                item
                for item in model_endpoints
                if item.is_enabled and item.is_default
            ),
            next((item for item in model_endpoints if item.is_enabled), None),
        )

    async def _build_recent_preview_activity_by_model_endpoint_id(self) -> dict[str, dict[str, object]]:
        if self.runtime_governance_event_repository is None or self.settings is None:
            return {}

        preview_window_hours = max(getattr(self.settings, "model_preview_review_window_hours", 24), 1)
        recent_preview_events = await self.runtime_governance_event_repository.list_runtime_governance_events(
            resource_type="model_endpoint",
            action_types=["preview_completed", "preview_blocked", "preview_failed"],
            created_after=datetime.now(timezone.utc).replace(microsecond=0)
            - timedelta(hours=preview_window_hours),
            limit=500,
        )
        return build_recent_preview_activity_by_resource_id(
            recent_preview_events,
            status_field_name="preview_status",
        )

    async def _build_recent_preview_activity_by_tool_registration_id(self) -> dict[str, dict[str, object]]:
        if self.runtime_governance_event_repository is None or self.settings is None:
            return {}

        preview_window_hours = max(getattr(self.settings, "tool_preview_review_window_hours", 24), 1)
        recent_preview_events = await self.runtime_governance_event_repository.list_runtime_governance_events(
            resource_type="tool_registration",
            action_types=["preview_completed", "preview_blocked", "preview_failed"],
            created_after=datetime.now(timezone.utc).replace(microsecond=0)
            - timedelta(hours=preview_window_hours),
            limit=500,
        )
        return build_recent_preview_activity_by_resource_id(
            recent_preview_events,
            status_field_name="invocation_status",
        )

    async def _build_recent_preview_activity_by_mcp_connector_id(self) -> dict[str, dict[str, object]]:
        if self.runtime_governance_event_repository is None or self.settings is None:
            return {}

        preview_window_hours = max(getattr(self.settings, "mcp_preview_review_window_hours", 24), 1)
        recent_preview_events = await self.runtime_governance_event_repository.list_runtime_governance_events(
            resource_type="mcp_connector",
            action_types=["preview_completed", "preview_blocked", "preview_failed"],
            created_after=datetime.now(timezone.utc).replace(microsecond=0)
            - timedelta(hours=preview_window_hours),
            limit=500,
        )
        return build_recent_preview_activity_by_resource_id(
            recent_preview_events,
            status_field_name="preview_status",
        )

    def _resolve_default_retrieval_profile(
        self,
        retrieval_profiles: list[RetrievalProfile],
    ) -> RetrievalProfile | None:
        return next(
            (
                item
                for item in retrieval_profiles
                if item.is_enabled and item.is_default
            ),
            next((item for item in retrieval_profiles if item.is_enabled), None),
        )

    def _count_connected_capabilities(self, agent_definition: AgentDefinition) -> int:
        values = {
            value.strip()
            for value in [*(agent_definition.tool_bindings_json or []), *(agent_definition.tool_registration_ids_json or [])]
            if value and value.strip()
        }
        return len(values)

    def _normalize_tool_registration_ids(self, agent_definition: AgentDefinition) -> list[str]:
        return list(
            {
                value.strip()
                for value in list(agent_definition.tool_registration_ids_json or [])
                if value and value.strip()
            }
        )

    def _is_model_bound(
        self,
        model_endpoint: ModelEndpoint,
        items: list[AgentRuntimeGovernanceItemResponse],
    ) -> bool:
        return any(item.model_endpoint_id == model_endpoint.id for item in items)

    def _is_tool_bound(
        self,
        tool_registration: ToolRegistration,
        items: list[AgentRuntimeGovernanceItemResponse],
    ) -> bool:
        return any(tool_registration.id in item.tool_registration_ids for item in items)
