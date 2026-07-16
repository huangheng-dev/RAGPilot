from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from ragpilot_api.application.errors import ResourceConflictError, ResourceNotFoundError
from ragpilot_api.application.runtime_governance.runtime_governance_event_service import RuntimeGovernanceEventService
from ragpilot_api.application.tool_registry.tool_registry_service import ToolRegistryService
from ragpilot_api.application.tool_runtime.tool_boundary_governance_service import ToolBoundaryGovernanceService
from ragpilot_api.application.tool_runtime.tool_runtime_audit_service import ToolRuntimeAuditService
from ragpilot_api.application.tool_runtime.tool_runtime_service import ToolRuntimeService
from ragpilot_api.contracts.http.tool_boundary_governance_contracts import ToolMcpBoundaryWorklistResponse
from ragpilot_api.contracts.http.tool_registration_contracts import (
    ToolGovernanceActionRequest,
    ToolGovernanceActionResponse,
    ToolGovernanceSummaryResponse,
    ToolRegistrationCreateRequest,
    ToolRegistrationResponse,
    ToolRegistrationUpdateRequest,
)
from ragpilot_api.contracts.http.tool_runtime_audit_contracts import ToolRuntimeAuditListResponse
from ragpilot_api.contracts.http.tool_runtime_contracts import (
    ToolInvocationPreviewRequest,
    ToolInvocationResponse,
)
from ragpilot_api.infrastructure.database.repositories.agent_repository import AgentRepository
from ragpilot_api.infrastructure.database.repositories.agent_execution_repository import AgentExecutionRepository
from ragpilot_api.infrastructure.database.repositories.conversation_repository import ConversationRepository
from ragpilot_api.infrastructure.database.repositories.document_repository import DocumentRepository
from ragpilot_api.infrastructure.database.repositories.mcp_connector_repository import McpConnectorRepository
from ragpilot_api.infrastructure.database.repositories.role_permission_repository import RolePermissionRepository
from ragpilot_api.infrastructure.database.repositories.runtime_governance_event_repository import (
    RuntimeGovernanceEventRepository,
)
from ragpilot_api.infrastructure.database.repositories.tool_registration_repository import ToolRegistrationRepository
from ragpilot_api.infrastructure.database.repositories.workflow_repository import WorkflowRepository
from ragpilot_api.infrastructure.database.repositories.knowledge_base_repository import KnowledgeBaseRepository
from ragpilot_api.infrastructure.database.repositories.workspace_repository import WorkspaceRepository
from ragpilot_api.infrastructure.database.session import get_database_session
from ragpilot_api.presentation.http.request_actor import (
    RequestActor,
    get_request_actor,
    require_actor_capability_from_policy,
    require_authenticated_actor,
    require_actor_knowledge_base_access,
    require_platform_wide_actor_scope,
    require_actor_tenant_access,
    require_actor_workspace_access,
)
from ragpilot_api.shared.settings import get_settings
from ragpilot_api.application.runtime_governance.runtime_credential_service import RuntimeCredentialService
from ragpilot_api.infrastructure.database.repositories.runtime_credential_repository import RuntimeCredentialRepository


router = APIRouter()


def build_tool_registry_service(session: AsyncSession) -> ToolRegistryService:
    return ToolRegistryService(
        ToolRegistrationRepository(session),
        AgentRepository(session),
        McpConnectorRepository(session),
        RuntimeGovernanceEventRepository(session),
    )


def build_tool_runtime_service(session: AsyncSession) -> ToolRuntimeService:
    return ToolRuntimeService(
        ToolRegistrationRepository(session),
        ConversationRepository(session),
        DocumentRepository(session),
        WorkflowRepository(session),
        get_settings(),
        mcp_connector_repository=McpConnectorRepository(session),
        runtime_credential_service=RuntimeCredentialService(RuntimeCredentialRepository(session), get_settings()),
    )


def build_tool_runtime_audit_service(session: AsyncSession) -> ToolRuntimeAuditService:
    return ToolRuntimeAuditService(
        AgentExecutionRepository(session)
    )


def build_tool_boundary_governance_service(session: AsyncSession) -> ToolBoundaryGovernanceService:
    return ToolBoundaryGovernanceService(
        ToolRegistrationRepository(session),
        AgentRepository(session),
        AgentExecutionRepository(session),
    )


def build_runtime_governance_event_service(session: AsyncSession) -> RuntimeGovernanceEventService:
    return RuntimeGovernanceEventService(RuntimeGovernanceEventRepository(session))


def read_response_field(payload: object, field_name: str):
    if isinstance(payload, dict):
        return payload.get(field_name)
    return getattr(payload, field_name, None)


def resolve_tool_preview_action_type(invocation_status: object) -> str:
    normalized_status = str(invocation_status or "").strip().lower()
    if normalized_status == "completed":
        return "preview_completed"
    if normalized_status == "failed":
        return "preview_failed"
    return "preview_blocked"


@router.post("", response_model=ToolRegistrationResponse, status_code=status.HTTP_201_CREATED)
async def create_tool_registration(
    request: ToolRegistrationCreateRequest,
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> ToolRegistrationResponse:
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(actor, "manage_runtime_governance", RolePermissionRepository(session))
    require_platform_wide_actor_scope(actor, detail="Platform tool governance requires platform-wide access.")
    try:
        response = await build_tool_registry_service(session).create_tool_registration(request)
    except ResourceConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    await build_runtime_governance_event_service(session).create_runtime_governance_event(
        actor_user_id=actor.user_id,
        actor_role=actor.role,
        resource_type="tool_registration",
        resource_id=read_response_field(response, "id"),
        resource_name=read_response_field(response, "name"),
        resource_slug=read_response_field(response, "slug"),
        action_type="created",
        detail={
            "transport_type": request.transport_type,
            "surface_area": request.surface_area,
            "requires_admin_approval": request.requires_admin_approval,
            "is_enabled": request.is_enabled,
            "connector_reference": request.connector_reference,
        },
    )
    return response


@router.get("", response_model=list[ToolRegistrationResponse])
async def list_tool_registrations(
    transport_type: str | None = Query(default=None, pattern=r"^(native|http|mcp_reserved)$"),
    surface_area: str | None = Query(default=None, pattern=r"^(chat|documents|operations|admin|agents)$"),
    is_enabled: bool | None = Query(default=None),
    requires_admin_approval: bool | None = Query(default=None),
    runtime_state: str | None = Query(
        default=None,
        pattern=r"^(approval_required|disabled|missing_endpoint|mcp_reserved|mcp_reserved_bound|mcp_integration_pending|mcp_connector_configured|mcp_connector_unhealthy|runtime_ready)$",
    ),
    query: str | None = Query(default=None, min_length=1, max_length=160),
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> list[ToolRegistrationResponse]:
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(actor, "review_runtime_governance", RolePermissionRepository(session))
    require_platform_wide_actor_scope(actor, detail="Platform tool governance requires platform-wide access.")
    return await build_tool_registry_service(session).list_tool_registrations(
        transport_type=transport_type,
        surface_area=surface_area,
        is_enabled=is_enabled,
        requires_admin_approval=requires_admin_approval,
        runtime_state=runtime_state,
        query=query,
    )


@router.get("/governance-summary", response_model=ToolGovernanceSummaryResponse)
async def get_tool_governance_summary(
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> ToolGovernanceSummaryResponse:
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(actor, "review_runtime_governance", RolePermissionRepository(session))
    require_platform_wide_actor_scope(actor, detail="Platform tool governance requires platform-wide access.")
    return await build_tool_registry_service(session).get_tool_governance_summary()


@router.get("/runtime-audit", response_model=ToolRuntimeAuditListResponse)
async def list_tool_runtime_audit(
    tenant_id: UUID,
    tool_registration_id: UUID | None = Query(default=None),
    invocation_status: str | None = Query(
        default=None,
        pattern=r"^(completed|blocked|reserved|unavailable|failed|skipped)$",
    ),
    limit: int = Query(default=20, ge=1, le=100),
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> ToolRuntimeAuditListResponse:
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(actor, "review_runtime_governance", RolePermissionRepository(session))
    require_actor_tenant_access(actor, tenant_id)
    return await build_tool_runtime_audit_service(session).list_tool_runtime_audit_records(
        tenant_id=tenant_id,
        tool_registration_id=tool_registration_id,
        invocation_status=invocation_status,
        limit=limit,
    )


@router.get("/mcp-boundary-worklist", response_model=ToolMcpBoundaryWorklistResponse)
async def list_tool_mcp_boundary_worklist(
    tenant_id: UUID,
    limit: int = Query(default=12, ge=1, le=50),
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> ToolMcpBoundaryWorklistResponse:
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(actor, "review_runtime_governance", RolePermissionRepository(session))
    require_actor_tenant_access(actor, tenant_id)
    return await build_tool_boundary_governance_service(session).list_mcp_boundary_worklist(
        tenant_id=tenant_id,
        limit=limit,
    )


@router.post("/{tool_registration_id}/preview", response_model=ToolInvocationResponse)
async def preview_tool_registration(
    tool_registration_id: UUID,
    request: ToolInvocationPreviewRequest,
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> ToolInvocationResponse:
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(actor, "review_runtime_governance", RolePermissionRepository(session))
    require_actor_tenant_access(actor, request.tenant_id)
    resolved_workspace_tenant_id = None
    if request.workspace_id is not None:
        resolved_workspace_tenant_id = await require_actor_workspace_access(
            actor,
            request.workspace_id,
            WorkspaceRepository(session),
        )
    resolved_knowledge_base_tenant_id = None
    if request.knowledge_base_id is not None:
        resolved_knowledge_base_tenant_id = await require_actor_knowledge_base_access(
            actor,
            request.knowledge_base_id,
            KnowledgeBaseRepository(session),
        )
    for resolved_tenant_id in (resolved_workspace_tenant_id, resolved_knowledge_base_tenant_id):
        if resolved_tenant_id is not None and resolved_tenant_id != request.tenant_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Tenant scope does not match the selected workspace or knowledge base.",
            )
    try:
        response = await build_tool_runtime_service(session).preview_tool_invocation(
            tool_registration_id=tool_registration_id,
            tenant_id=request.tenant_id,
            workspace_id=request.workspace_id,
            knowledge_base_id=request.knowledge_base_id,
            execution_input=request.execution_input,
            actor=actor,
        )
    except ResourceNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    await build_runtime_governance_event_service(session).create_runtime_governance_event(
        actor_user_id=actor.user_id,
        actor_role=actor.role,
        resource_type="tool_registration",
        resource_id=read_response_field(response, "tool_registration_id"),
        resource_name=read_response_field(response, "name"),
        resource_slug=read_response_field(response, "slug"),
        action_type=resolve_tool_preview_action_type(read_response_field(response, "invocation_status")),
        detail={
            "transport_type": read_response_field(response, "transport_type"),
            "surface_area": read_response_field(response, "surface_area"),
            "invocation_status": read_response_field(response, "invocation_status"),
            "governance_issue": read_response_field(response, "governance_issue"),
            "summary": read_response_field(response, "summary"),
            "error_message": read_response_field(response, "error_message"),
            "request_metadata": read_response_field(response, "request_metadata"),
            "response_metadata": read_response_field(response, "response_metadata"),
        },
    )
    return response


@router.patch("/{tool_registration_id}", response_model=ToolRegistrationResponse)
async def update_tool_registration(
    tool_registration_id: UUID,
    request: ToolRegistrationUpdateRequest,
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> ToolRegistrationResponse:
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(actor, "manage_runtime_governance", RolePermissionRepository(session))
    require_platform_wide_actor_scope(actor, detail="Platform tool governance requires platform-wide access.")
    try:
        tool_registration = await build_tool_registry_service(session).update_tool_registration(
            tool_registration_id=tool_registration_id,
            request=request,
        )
    except ResourceConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error

    if tool_registration is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tool registration not found.")
    await build_runtime_governance_event_service(session).create_runtime_governance_event(
        actor_user_id=actor.user_id,
        actor_role=actor.role,
        resource_type="tool_registration",
        resource_id=read_response_field(tool_registration, "id"),
        resource_name=read_response_field(tool_registration, "name"),
        resource_slug=read_response_field(tool_registration, "slug"),
        action_type="updated",
        detail={
            "transport_type": request.transport_type,
            "surface_area": request.surface_area,
            "requires_admin_approval": request.requires_admin_approval,
            "is_enabled": request.is_enabled,
            "connector_reference": request.connector_reference,
        },
    )
    return tool_registration


@router.post("/{tool_registration_id}/governance-action", response_model=ToolGovernanceActionResponse)
async def apply_tool_governance_action(
    tool_registration_id: UUID,
    request: ToolGovernanceActionRequest,
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> ToolGovernanceActionResponse:
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(actor, "manage_runtime_governance", RolePermissionRepository(session))
    require_platform_wide_actor_scope(actor, detail="Platform tool governance requires platform-wide access.")
    try:
        response = await build_tool_registry_service(session).apply_tool_governance_action(
            tool_registration_id=tool_registration_id,
            action_type=request.action_type,
        )
    except ResourceConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    if response is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tool registration not found.")
    await build_runtime_governance_event_service(session).create_runtime_governance_event(
        actor_user_id=actor.user_id,
        actor_role=actor.role,
        resource_type="tool_registration",
        resource_id=read_response_field(read_response_field(response, "tool_registration"), "id"),
        resource_name=read_response_field(read_response_field(response, "tool_registration"), "name"),
        resource_slug=read_response_field(read_response_field(response, "tool_registration"), "slug"),
        action_type=request.action_type,
        detail={
            "summary": read_response_field(response, "summary"),
            "transport_type": read_response_field(read_response_field(response, "tool_registration"), "transport_type"),
            "surface_area": read_response_field(read_response_field(response, "tool_registration"), "surface_area"),
            "requires_admin_approval": read_response_field(
                read_response_field(response, "tool_registration"),
                "requires_admin_approval",
            ),
            "is_enabled": read_response_field(read_response_field(response, "tool_registration"), "is_enabled"),
            "connector_reference": read_response_field(
                read_response_field(response, "tool_registration"),
                "connector_reference",
            ),
        },
    )
    return response


@router.delete("/{tool_registration_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tool_registration(
    tool_registration_id: UUID,
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> None:
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(actor, "manage_runtime_governance", RolePermissionRepository(session))
    require_platform_wide_actor_scope(actor, detail="Platform tool governance requires platform-wide access.")
    existing_tool_registration = await ToolRegistrationRepository(session).get_tool_registration(
        tool_registration_id=tool_registration_id
    )
    if existing_tool_registration is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tool registration not found.")
    try:
        deleted = await build_tool_registry_service(session).delete_tool_registration(tool_registration_id=tool_registration_id)
    except ResourceConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tool registration not found.")
    await build_runtime_governance_event_service(session).create_runtime_governance_event(
        actor_user_id=actor.user_id,
        actor_role=actor.role,
        resource_type="tool_registration",
        resource_id=existing_tool_registration.id,
        resource_name=existing_tool_registration.name,
        resource_slug=existing_tool_registration.slug,
        action_type="deleted",
        detail={
            "transport_type": existing_tool_registration.transport_type,
            "surface_area": existing_tool_registration.surface_area,
            "requires_admin_approval": existing_tool_registration.requires_admin_approval,
            "was_enabled": existing_tool_registration.is_enabled,
            "connector_reference": existing_tool_registration.connector_reference,
        },
    )
