from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from ragpilot_api.application.agents.agent_service import AgentService
from ragpilot_api.application.agents.agent_execution_service import AgentExecutionService
from ragpilot_api.application.agents.agent_runtime_governance_service import AgentRuntimeGovernanceService
from ragpilot_api.application.agents.agent_run_service import AgentRunService
from ragpilot_api.application.tool_runtime.tool_runtime_service import ToolRuntimeService
from ragpilot_api.application.errors import ResourceConflictError, ResourceNotFoundError
from ragpilot_api.contracts.http.agent_contracts import (
    AgentDefinitionCreateRequest,
    AgentDefinitionMetricsResponse,
    AgentDefinitionResponse,
    AgentRuntimeGovernanceDigestResponse,
    AgentRuntimeGovernanceItemResponse,
    AgentRuntimeGovernanceResponse,
    AgentDefinitionUpdateRequest,
)
from ragpilot_api.contracts.http.agent_execution_contracts import (
    AgentExecutionCreateRequest,
    AgentExecutionMetricsResponse,
    AgentExecutionMode,
    AgentExecutionResponse,
    AgentExecutionStatus,
)
from ragpilot_api.contracts.http.agent_run_contracts import (
    AgentRunCreateRequest,
    AgentRunMetricsResponse,
    AgentRunResponse,
    AgentRunStatus,
    AgentRunTargetSurface,
    AgentRunTriggerSource,
)
from ragpilot_api.infrastructure.database.repositories.agent_execution_repository import AgentExecutionRepository
from ragpilot_api.infrastructure.database.repositories.agent_repository import AgentRepository
from ragpilot_api.infrastructure.database.repositories.agent_run_repository import AgentRunRepository
from ragpilot_api.infrastructure.database.repositories.conversation_repository import ConversationRepository
from ragpilot_api.infrastructure.database.repositories.document_repository import DocumentRepository
from ragpilot_api.infrastructure.database.repositories.knowledge_base_repository import KnowledgeBaseRepository
from ragpilot_api.infrastructure.database.repositories.mcp_connector_repository import McpConnectorRepository
from ragpilot_api.infrastructure.database.repositories.model_endpoint_repository import ModelEndpointRepository
from ragpilot_api.infrastructure.database.repositories.retrieval_profile_repository import RetrievalProfileRepository
from ragpilot_api.infrastructure.database.repositories.runtime_governance_event_repository import RuntimeGovernanceEventRepository
from ragpilot_api.infrastructure.database.repositories.retrieval_repository import RetrievalRepository
from ragpilot_api.infrastructure.database.repositories.role_permission_repository import RolePermissionRepository
from ragpilot_api.infrastructure.database.repositories.tool_registration_repository import ToolRegistrationRepository
from ragpilot_api.infrastructure.database.repositories.workflow_repository import WorkflowRepository
from ragpilot_api.infrastructure.database.repositories.workspace_repository import WorkspaceRepository
from ragpilot_api.infrastructure.database.session import get_database_session
from ragpilot_api.presentation.http.request_actor import (
    RequestActor,
    get_request_actor,
    require_actor_capability_from_policy,
    require_authenticated_actor,
    require_actor_knowledge_base_access,
    require_actor_tenant_access,
    require_actor_workspace_access,
)
from ragpilot_api.shared.settings import get_settings
from ragpilot_api.infrastructure.workflows.temporal_client import TemporalWorkflowClient


router = APIRouter()


def build_agent_runtime_governance_digest(
    item: AgentRuntimeGovernanceItemResponse,
) -> AgentRuntimeGovernanceDigestResponse:
    return AgentRuntimeGovernanceDigestResponse(
        is_ready=item.is_ready,
        issues=list(item.issues),
        blocking_issues=list(item.blocking_issues),
        approval_required_tool_count=item.approval_required_tool_count,
        disabled_registered_tool_count=item.disabled_registered_tool_count,
        missing_tool_registration_count=item.missing_tool_registration_count,
        reserved_mcp_tool_count=item.reserved_mcp_tool_count,
        integration_pending_mcp_tool_count=item.integration_pending_mcp_tool_count,
        disabled_tool_registration_id=item.disabled_tool_registration_id,
        approval_required_tool_registration_id=item.approval_required_tool_registration_id,
        reserved_mcp_tool_registration_id=item.reserved_mcp_tool_registration_id,
        integration_pending_mcp_tool_registration_id=item.integration_pending_mcp_tool_registration_id,
        integration_pending_mcp_connector_reference=item.integration_pending_mcp_connector_reference,
        focus_tool_registration=item.focus_tool_registration,
        focus_mcp_connector=item.focus_mcp_connector,
        resolved_scope=item.resolved_scope,
        resolved_model_endpoint=item.resolved_model_endpoint,
        resolved_retrieval_profile=item.resolved_retrieval_profile,
    )


def build_agent_service(session: AsyncSession) -> AgentService:
    return AgentService(
        AgentRepository(session),
        ModelEndpointRepository(session),
        ToolRegistrationRepository(session),
    )


def build_agent_run_service(session: AsyncSession) -> AgentRunService:
    return AgentRunService(
        AgentRepository(session),
        AgentRunRepository(session),
    )


def build_agent_runtime_governance_service(session: AsyncSession) -> AgentRuntimeGovernanceService:
    return AgentRuntimeGovernanceService(
        agent_repository=AgentRepository(session),
        model_endpoint_repository=ModelEndpointRepository(session),
        tool_registration_repository=ToolRegistrationRepository(session),
        retrieval_profile_repository=RetrievalProfileRepository(session),
        workspace_repository=WorkspaceRepository(session),
        knowledge_base_repository=KnowledgeBaseRepository(session),
        runtime_governance_event_repository=RuntimeGovernanceEventRepository(session),
        settings=get_settings(),
        mcp_connector_repository=McpConnectorRepository(session),
    )


def build_agent_execution_service(session: AsyncSession) -> AgentExecutionService:
    return AgentExecutionService(
        AgentRepository(session),
        AgentExecutionRepository(session),
        WorkspaceRepository(session),
        KnowledgeBaseRepository(session),
        ConversationRepository(session),
        DocumentRepository(session),
        WorkflowRepository(session),
        ModelEndpointRepository(session),
        RetrievalRepository(session),
        RetrievalProfileRepository(session),
        get_settings(),
        tool_runtime_service=ToolRuntimeService(
            ToolRegistrationRepository(session),
            ConversationRepository(session),
            DocumentRepository(session),
            WorkflowRepository(session),
            get_settings(),
            mcp_connector_repository=McpConnectorRepository(session),
        ),
        temporal_workflow_client=TemporalWorkflowClient(get_settings()),
    )


@router.post("", response_model=AgentDefinitionResponse, status_code=status.HTTP_201_CREATED)
async def create_agent_definition(
    request: AgentDefinitionCreateRequest,
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> AgentDefinitionResponse:
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(
        actor,
        "manage_agent_definitions",
        RolePermissionRepository(session),
    )
    require_actor_tenant_access(actor, request.tenant_id)
    try:
        return await build_agent_service(session).create_agent_definition(request)
    except ResourceConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    except ResourceNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error


@router.get("", response_model=list[AgentDefinitionResponse])
async def list_agent_definitions(
    tenant_id: UUID = Query(...),
    status: str | None = Query(default=None, pattern=r"^(draft|active|paused)$"),
    mode: str | None = Query(default=None, pattern=r"^(grounded_chat|document_intake|workflow_recovery)$"),
    query: str | None = Query(default=None, min_length=1, max_length=160),
    include_runtime_governance: bool = Query(default=False),
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> list[AgentDefinitionResponse]:
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(
        actor,
        "access_agents",
        RolePermissionRepository(session),
    )
    require_actor_tenant_access(actor, tenant_id)
    agent_definitions = await build_agent_service(session).list_agent_definitions(
        tenant_id=tenant_id,
        status=status,
        mode=mode,
        query=query,
    )
    normalized_agent_definitions = [
        item
        if isinstance(item, AgentDefinitionResponse)
        else AgentDefinitionResponse.model_validate(item)
        for item in agent_definitions
    ]
    if not include_runtime_governance:
        return normalized_agent_definitions

    runtime_governance = await build_agent_runtime_governance_service(session).get_runtime_governance_posture(
        tenant_id=tenant_id,
        status=status,
        mode=mode,
        query=query,
    )
    runtime_item_by_id = {item.id: item for item in runtime_governance.items}
    return [
        agent_definition.model_copy(
            update={
                "runtime_governance": build_agent_runtime_governance_digest(runtime_item_by_id[agent_definition.id])
                if agent_definition.id in runtime_item_by_id
                else None
            }
        )
        for agent_definition in normalized_agent_definitions
    ]


@router.get("/metrics", response_model=AgentDefinitionMetricsResponse)
async def get_agent_definition_metrics(
    tenant_id: UUID | None = Query(default=None),
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> AgentDefinitionMetricsResponse:
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(
        actor,
        "access_agents",
        RolePermissionRepository(session),
    )
    if tenant_id is None and actor.active_tenant_ids is not None and actor.role not in {"super_admin", "reviewer"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tenant scope is required for scoped agent metrics.",
        )
    if tenant_id is not None:
        require_actor_tenant_access(actor, tenant_id)
    return await build_agent_service(session).get_agent_definition_metrics(tenant_id=tenant_id)


@router.get("/runtime-governance", response_model=AgentRuntimeGovernanceResponse)
async def get_agent_runtime_governance(
    tenant_id: UUID | None = Query(default=None),
    status: str | None = Query(default=None, pattern=r"^(draft|active|paused)$"),
    mode: str | None = Query(default=None, pattern=r"^(grounded_chat|document_intake|workflow_recovery)$"),
    readiness: str | None = Query(default=None, pattern=r"^(ready|attention)$"),
    issue: str | None = Query(
        default=None,
        pattern=r"^(model_missing|model_disabled|model_runtime_unconfigured|retrieval_profile_missing|retrieval_profile_disabled|scope_missing|scope_invalid|tools_missing|tool_registration_disabled|tool_approval_required|tool_mcp_reserved|tool_mcp_integration_pending)$",
    ),
    model_endpoint_id: UUID | None = Query(default=None),
    model_provider_type: str | None = Query(default=None, pattern=r"^(deterministic|openai_compatible|ollama|vllm)$"),
    tool_registration_id: UUID | None = Query(default=None),
    retrieval_profile_id: UUID | None = Query(default=None),
    query: str | None = Query(default=None, min_length=1, max_length=160),
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> AgentRuntimeGovernanceResponse:
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(
        actor,
        "access_agents",
        RolePermissionRepository(session),
    )
    if tenant_id is None and actor.active_tenant_ids is not None and actor.role not in {"super_admin", "reviewer"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tenant scope is required for agent runtime governance.",
        )
    if tenant_id is not None:
        require_actor_tenant_access(actor, tenant_id)
    return await build_agent_runtime_governance_service(session).get_runtime_governance_posture(
        tenant_id=tenant_id,
        status=status,
        mode=mode,
        readiness=readiness,
        issue=issue,
        model_endpoint_id=model_endpoint_id,
        model_provider_type=model_provider_type,
        tool_registration_id=tool_registration_id,
        retrieval_profile_id=retrieval_profile_id,
        query=query,
    )


@router.post("/runs", response_model=AgentRunResponse, status_code=status.HTTP_201_CREATED)
async def create_agent_run(
    request: AgentRunCreateRequest,
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> AgentRunResponse:
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(
        actor,
        "execute_agents",
        RolePermissionRepository(session),
    )
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
        return await build_agent_run_service(session).create_agent_run(request, actor=actor)
    except ResourceNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error


@router.get("/runs", response_model=list[AgentRunResponse])
async def list_agent_runs(
    tenant_id: UUID = Query(...),
    agent_definition_id: UUID | None = Query(default=None),
    target_surface: AgentRunTargetSurface | None = Query(default=None),
    trigger_source: AgentRunTriggerSource | None = Query(default=None),
    run_status: AgentRunStatus | None = Query(default=None),
    limit: int = Query(default=8, ge=1, le=50),
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> list[AgentRunResponse]:
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(
        actor,
        "access_agents",
        RolePermissionRepository(session),
    )
    require_actor_tenant_access(actor, tenant_id)
    return await build_agent_run_service(session).list_agent_runs(
        tenant_id=tenant_id,
        agent_definition_id=agent_definition_id,
        target_surface=target_surface,
        trigger_source=trigger_source,
        run_status=run_status,
        limit=limit,
    )


@router.get("/runs/metrics", response_model=AgentRunMetricsResponse)
async def get_agent_run_metrics(
    tenant_id: UUID = Query(...),
    agent_definition_id: UUID | None = Query(default=None),
    target_surface: AgentRunTargetSurface | None = Query(default=None),
    trigger_source: AgentRunTriggerSource | None = Query(default=None),
    run_status: AgentRunStatus | None = Query(default=None),
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> AgentRunMetricsResponse:
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(
        actor,
        "access_agents",
        RolePermissionRepository(session),
    )
    require_actor_tenant_access(actor, tenant_id)
    return await build_agent_run_service(session).get_agent_run_metrics(
        tenant_id=tenant_id,
        agent_definition_id=agent_definition_id,
        target_surface=target_surface,
        trigger_source=trigger_source,
        run_status=run_status,
    )


@router.post("/executions", response_model=AgentExecutionResponse, status_code=status.HTTP_201_CREATED)
async def create_agent_execution(
    request: AgentExecutionCreateRequest,
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> AgentExecutionResponse:
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(
        actor,
        "execute_agents",
        RolePermissionRepository(session),
    )
    require_actor_tenant_access(actor, request.tenant_id)
    try:
        return await build_agent_execution_service(session).queue_agent_execution(request, actor=actor)
    except ResourceConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    except ResourceNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error


@router.get("/executions", response_model=list[AgentExecutionResponse])
async def list_agent_executions(
    tenant_id: UUID = Query(...),
    agent_definition_id: UUID | None = Query(default=None),
    execution_mode: AgentExecutionMode | None = Query(default=None),
    execution_status: AgentExecutionStatus | None = Query(default=None),
    limit: int = Query(default=8, ge=1, le=50),
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> list[AgentExecutionResponse]:
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(
        actor,
        "access_agents",
        RolePermissionRepository(session),
    )
    require_actor_tenant_access(actor, tenant_id)
    return await build_agent_execution_service(session).list_agent_executions(
        tenant_id=tenant_id,
        agent_definition_id=agent_definition_id,
        execution_mode=execution_mode,
        execution_status=execution_status,
        limit=limit,
    )


@router.post("/executions/actions/{execution_id}/cancel", response_model=AgentExecutionResponse)
async def cancel_agent_execution(
    execution_id: UUID, tenant_id: UUID = Query(...), actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> AgentExecutionResponse:
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(actor, "execute_agents", RolePermissionRepository(session))
    require_actor_tenant_access(actor, tenant_id)
    return await build_agent_execution_service(session).cancel_agent_execution(
        execution_id=execution_id, tenant_id=tenant_id,
    )


@router.post("/executions/actions/{execution_id}/retry", response_model=AgentExecutionResponse, status_code=status.HTTP_201_CREATED)
async def retry_agent_execution(
    execution_id: UUID, tenant_id: UUID = Query(...), actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> AgentExecutionResponse:
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(actor, "execute_agents", RolePermissionRepository(session))
    require_actor_tenant_access(actor, tenant_id)
    try:
        return await build_agent_execution_service(session).retry_agent_execution(
            execution_id=execution_id, tenant_id=tenant_id, actor=actor,
        )
    except RuntimeError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error


@router.get("/executions/metrics", response_model=AgentExecutionMetricsResponse)
async def get_agent_execution_metrics(
    tenant_id: UUID = Query(...),
    agent_definition_id: UUID | None = Query(default=None),
    execution_mode: AgentExecutionMode | None = Query(default=None),
    execution_status: AgentExecutionStatus | None = Query(default=None),
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> AgentExecutionMetricsResponse:
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(
        actor,
        "access_agents",
        RolePermissionRepository(session),
    )
    require_actor_tenant_access(actor, tenant_id)
    return await build_agent_execution_service(session).get_agent_execution_metrics(
        tenant_id=tenant_id,
        agent_definition_id=agent_definition_id,
        execution_mode=execution_mode,
        execution_status=execution_status,
    )


@router.patch("/{agent_definition_id}", response_model=AgentDefinitionResponse)
async def update_agent_definition(
    agent_definition_id: UUID,
    request: AgentDefinitionUpdateRequest,
    tenant_id: UUID = Query(...),
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> AgentDefinitionResponse:
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(
        actor,
        "manage_agent_definitions",
        RolePermissionRepository(session),
    )
    require_actor_tenant_access(actor, tenant_id)
    try:
        agent_definition = await build_agent_service(session).update_agent_definition(
            agent_definition_id=agent_definition_id,
            tenant_id=tenant_id,
            request=request,
        )
    except ResourceConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    except ResourceNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error

    if agent_definition is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent definition not found.")

    return agent_definition


@router.delete("/{agent_definition_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_agent_definition(
    agent_definition_id: UUID,
    tenant_id: UUID = Query(...),
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> None:
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(
        actor,
        "manage_agent_definitions",
        RolePermissionRepository(session),
    )
    require_actor_tenant_access(actor, tenant_id)
    deleted = await build_agent_service(session).delete_agent_definition(
        agent_definition_id=agent_definition_id,
        tenant_id=tenant_id,
    )
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent definition not found.")
