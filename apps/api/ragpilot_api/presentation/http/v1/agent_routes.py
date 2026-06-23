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
from ragpilot_api.infrastructure.database.repositories.model_endpoint_repository import ModelEndpointRepository
from ragpilot_api.infrastructure.database.repositories.retrieval_profile_repository import RetrievalProfileRepository
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
)
from ragpilot_api.shared.settings import get_settings


router = APIRouter()


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
        AgentRepository(session),
        ModelEndpointRepository(session),
        ToolRegistrationRepository(session),
        RetrievalProfileRepository(session),
        WorkspaceRepository(session),
        KnowledgeBaseRepository(session),
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
        ),
    )


@router.post("", response_model=AgentDefinitionResponse, status_code=status.HTTP_201_CREATED)
async def create_agent_definition(
    request: AgentDefinitionCreateRequest,
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> AgentDefinitionResponse:
    await require_actor_capability_from_policy(
        actor,
        "manage_agent_definitions",
        RolePermissionRepository(session),
    )
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
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> list[AgentDefinitionResponse]:
    require_authenticated_actor(actor)
    return await build_agent_service(session).list_agent_definitions(
        tenant_id=tenant_id,
        status=status,
        mode=mode,
        query=query,
    )


@router.get("/metrics", response_model=AgentDefinitionMetricsResponse)
async def get_agent_definition_metrics(
    tenant_id: UUID | None = Query(default=None),
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> AgentDefinitionMetricsResponse:
    require_authenticated_actor(actor)
    return await build_agent_service(session).get_agent_definition_metrics(tenant_id=tenant_id)


@router.get("/runtime-governance", response_model=AgentRuntimeGovernanceResponse)
async def get_agent_runtime_governance(
    tenant_id: UUID | None = Query(default=None),
    status: str | None = Query(default=None, pattern=r"^(draft|active|paused)$"),
    mode: str | None = Query(default=None, pattern=r"^(grounded_chat|document_intake|workflow_recovery)$"),
    readiness: str | None = Query(default=None, pattern=r"^(ready|attention)$"),
    issue: str | None = Query(
        default=None,
        pattern=r"^(model_missing|model_disabled|retrieval_profile_missing|retrieval_profile_disabled|scope_missing|scope_invalid|tools_missing|tool_registration_disabled|tool_approval_required|tool_mcp_reserved|tool_mcp_integration_pending)$",
    ),
    model_endpoint_id: UUID | None = Query(default=None),
    tool_registration_id: UUID | None = Query(default=None),
    retrieval_profile_id: UUID | None = Query(default=None),
    query: str | None = Query(default=None, min_length=1, max_length=160),
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> AgentRuntimeGovernanceResponse:
    require_authenticated_actor(actor)
    return await build_agent_runtime_governance_service(session).get_runtime_governance_posture(
        tenant_id=tenant_id,
        status=status,
        mode=mode,
        readiness=readiness,
        issue=issue,
        model_endpoint_id=model_endpoint_id,
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
    await require_actor_capability_from_policy(
        actor,
        "execute_agents",
        RolePermissionRepository(session),
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
    await require_actor_capability_from_policy(
        actor,
        "execute_agents",
        RolePermissionRepository(session),
    )
    try:
        return await build_agent_execution_service(session).create_agent_execution(request, actor=actor)
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
    return await build_agent_execution_service(session).list_agent_executions(
        tenant_id=tenant_id,
        agent_definition_id=agent_definition_id,
        execution_mode=execution_mode,
        execution_status=execution_status,
        limit=limit,
    )


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
    await require_actor_capability_from_policy(
        actor,
        "manage_agent_definitions",
        RolePermissionRepository(session),
    )
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
    await require_actor_capability_from_policy(
        actor,
        "manage_agent_definitions",
        RolePermissionRepository(session),
    )
    deleted = await build_agent_service(session).delete_agent_definition(
        agent_definition_id=agent_definition_id,
        tenant_id=tenant_id,
    )
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent definition not found.")
