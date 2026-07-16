from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from ragpilot_api.application.identity.access_control_service import AccessControlService
from ragpilot_api.contracts.http.access_control_contracts import (
    AccessGroupCreateRequest,
    AccessGroupMembershipMutationRequest,
    AccessGroupResponse,
    ChunkAccessPolicyUpdateRequest,
    DocumentAccessPolicyUpdateRequest,
    ResourceAccessPolicyResponse,
)
from ragpilot_api.infrastructure.database.repositories.access_control_repository import AccessControlRepository
from ragpilot_api.infrastructure.database.repositories.role_permission_repository import RolePermissionRepository
from ragpilot_api.infrastructure.database.repositories.runtime_governance_event_repository import RuntimeGovernanceEventRepository
from ragpilot_api.infrastructure.database.session import get_database_session
from ragpilot_api.presentation.http.request_actor import (
    RequestActor,
    get_request_actor,
    require_actor_capability_from_policy,
    require_actor_tenant_access,
    require_authenticated_actor,
)


router = APIRouter()


def build_service(session: AsyncSession) -> AccessControlService:
    return AccessControlService(AccessControlRepository(session), RuntimeGovernanceEventRepository(session))


async def authorize(actor: RequestActor, tenant_id: UUID, session: AsyncSession) -> None:
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(actor, "manage_admin_resources", RolePermissionRepository(session))
    require_actor_tenant_access(actor, tenant_id)


@router.post("/groups", response_model=AccessGroupResponse, status_code=status.HTTP_201_CREATED)
async def create_group(
    request: AccessGroupCreateRequest,
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> AccessGroupResponse:
    await authorize(actor, request.tenant_id, session)
    try:
        return await build_service(session).create_group(request, actor_user_id=actor.user_id, actor_role=actor.role)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error


@router.get("/groups", response_model=list[AccessGroupResponse])
async def list_groups(
    tenant_id: UUID = Query(...),
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> list[AccessGroupResponse]:
    await authorize(actor, tenant_id, session)
    return await build_service(session).list_groups(tenant_id=tenant_id)


@router.put("/groups/{group_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def add_group_member(
    group_id: UUID, user_id: UUID, request: AccessGroupMembershipMutationRequest,
    actor: RequestActor = Depends(get_request_actor), session: AsyncSession = Depends(get_database_session),
) -> None:
    await authorize(actor, request.tenant_id, session)
    try:
        found = await build_service(session).set_group_member(
            tenant_id=request.tenant_id, group_id=group_id, user_id=user_id, enabled=True,
            actor_user_id=actor.user_id, actor_role=actor.role,
        )
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error
    if not found:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Access group not found.")


@router.delete("/groups/{group_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_group_member(
    group_id: UUID, user_id: UUID, request: AccessGroupMembershipMutationRequest,
    actor: RequestActor = Depends(get_request_actor), session: AsyncSession = Depends(get_database_session),
) -> None:
    await authorize(actor, request.tenant_id, session)
    found = await build_service(session).set_group_member(
        tenant_id=request.tenant_id, group_id=group_id, user_id=user_id, enabled=False,
        actor_user_id=actor.user_id, actor_role=actor.role,
    )
    if not found:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Access group not found.")


@router.get("/documents/{document_id}", response_model=ResourceAccessPolicyResponse)
async def get_document_policy(
    document_id: UUID, tenant_id: UUID = Query(...), actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> ResourceAccessPolicyResponse:
    await authorize(actor, tenant_id, session)
    result = await build_service(session).get_document_policy(tenant_id=tenant_id, document_id=document_id)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")
    return result


@router.put("/documents/{document_id}", response_model=ResourceAccessPolicyResponse)
async def update_document_policy(
    document_id: UUID, request: DocumentAccessPolicyUpdateRequest, actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> ResourceAccessPolicyResponse:
    await authorize(actor, request.tenant_id, session)
    try:
        result = await build_service(session).update_document_policy(
            document_id=document_id, request=request, actor_user_id=actor.user_id, actor_role=actor.role,
        )
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")
    return result


@router.get("/chunks/{chunk_id}", response_model=ResourceAccessPolicyResponse)
async def get_chunk_policy(
    chunk_id: UUID, tenant_id: UUID = Query(...), actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> ResourceAccessPolicyResponse:
    await authorize(actor, tenant_id, session)
    result = await build_service(session).get_chunk_policy(tenant_id=tenant_id, chunk_id=chunk_id)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document chunk not found.")
    return result


@router.put("/chunks/{chunk_id}", response_model=ResourceAccessPolicyResponse)
async def update_chunk_policy(
    chunk_id: UUID, request: ChunkAccessPolicyUpdateRequest, actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> ResourceAccessPolicyResponse:
    await authorize(actor, request.tenant_id, session)
    try:
        result = await build_service(session).update_chunk_policy(
            chunk_id=chunk_id, request=request, actor_user_id=actor.user_id, actor_role=actor.role,
        )
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document chunk not found.")
    return result
