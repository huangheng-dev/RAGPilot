from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from ragpilot_api.application.errors import ResourceConflictError, ResourceNotFoundError
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
from ragpilot_api.infrastructure.database.repositories.tool_registration_repository import ToolRegistrationRepository
from ragpilot_api.infrastructure.database.repositories.workflow_repository import WorkflowRepository
from ragpilot_api.infrastructure.database.session import get_database_session
from ragpilot_api.presentation.http.request_actor import (
    RequestActor,
    get_request_actor,
    require_actor_capability,
    require_actor_capability_from_policy,
)
from ragpilot_api.shared.settings import get_settings


router = APIRouter()


def build_tool_registry_service(session: AsyncSession) -> ToolRegistryService:
    return ToolRegistryService(
        ToolRegistrationRepository(session),
        AgentRepository(session),
        McpConnectorRepository(session),
    )


def build_tool_runtime_service(session: AsyncSession) -> ToolRuntimeService:
    return ToolRuntimeService(
        ToolRegistrationRepository(session),
        ConversationRepository(session),
        DocumentRepository(session),
        WorkflowRepository(session),
        get_settings(),
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


@router.post("", response_model=ToolRegistrationResponse, status_code=status.HTTP_201_CREATED)
async def create_tool_registration(
    request: ToolRegistrationCreateRequest,
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> ToolRegistrationResponse:
    await require_actor_capability_from_policy(actor, "manage_runtime_governance", RolePermissionRepository(session))
    try:
        return await build_tool_registry_service(session).create_tool_registration(request)
    except ResourceConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error


@router.get("", response_model=list[ToolRegistrationResponse])
async def list_tool_registrations(
    transport_type: str | None = Query(default=None, pattern=r"^(native|http|mcp_reserved)$"),
    surface_area: str | None = Query(default=None, pattern=r"^(chat|documents|operations|admin|agents)$"),
    is_enabled: bool | None = Query(default=None),
    requires_admin_approval: bool | None = Query(default=None),
    runtime_state: str | None = Query(
        default=None,
        pattern=r"^(approval_required|disabled|missing_endpoint|mcp_reserved|mcp_reserved_bound|mcp_integration_pending|mcp_connector_configured|runtime_ready)$",
    ),
    query: str | None = Query(default=None, min_length=1, max_length=160),
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> list[ToolRegistrationResponse]:
    await require_actor_capability_from_policy(actor, "review_runtime_governance", RolePermissionRepository(session))
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
    await require_actor_capability_from_policy(actor, "review_runtime_governance", RolePermissionRepository(session))
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
    await require_actor_capability_from_policy(actor, "review_runtime_governance", RolePermissionRepository(session))
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
    await require_actor_capability_from_policy(actor, "review_runtime_governance", RolePermissionRepository(session))
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
    await require_actor_capability_from_policy(actor, "review_runtime_governance", RolePermissionRepository(session))
    try:
        return await build_tool_runtime_service(session).preview_tool_invocation(
            tool_registration_id=tool_registration_id,
            tenant_id=request.tenant_id,
            workspace_id=request.workspace_id,
            knowledge_base_id=request.knowledge_base_id,
            execution_input=request.execution_input,
            actor=actor,
        )
    except ResourceNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error


@router.patch("/{tool_registration_id}", response_model=ToolRegistrationResponse)
async def update_tool_registration(
    tool_registration_id: UUID,
    request: ToolRegistrationUpdateRequest,
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> ToolRegistrationResponse:
    await require_actor_capability_from_policy(actor, "manage_runtime_governance", RolePermissionRepository(session))
    try:
        tool_registration = await build_tool_registry_service(session).update_tool_registration(
            tool_registration_id=tool_registration_id,
            request=request,
        )
    except ResourceConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error

    if tool_registration is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tool registration not found.")

    return tool_registration


@router.post("/{tool_registration_id}/governance-action", response_model=ToolGovernanceActionResponse)
async def apply_tool_governance_action(
    tool_registration_id: UUID,
    request: ToolGovernanceActionRequest,
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> ToolGovernanceActionResponse:
    await require_actor_capability_from_policy(actor, "manage_runtime_governance", RolePermissionRepository(session))
    try:
        response = await build_tool_registry_service(session).apply_tool_governance_action(
            tool_registration_id=tool_registration_id,
            action_type=request.action_type,
        )
    except ResourceConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    if response is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tool registration not found.")
    return response


@router.delete("/{tool_registration_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tool_registration(
    tool_registration_id: UUID,
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> None:
    await require_actor_capability_from_policy(actor, "manage_runtime_governance", RolePermissionRepository(session))
    try:
        deleted = await build_tool_registry_service(session).delete_tool_registration(tool_registration_id=tool_registration_id)
    except ResourceConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tool registration not found.")
