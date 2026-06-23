from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from ragpilot_api.application.errors import ResourceConflictError, ResourceNotFoundError
from ragpilot_api.application.identity.user_service import UserService
from ragpilot_api.contracts.http.user_contracts import (
    UserAccessEventResponse,
    UserAuthenticatedSessionResponse,
    UserBootstrapRequest,
    UserBootstrapStatusResponse,
    UserCreateRequest,
    UserDirectoryResponse,
    UserInvitationActivationRequest,
    UserLoginAssessmentResponse,
    UserLoginRequest,
    UserMembershipCreateRequest,
    UserMembershipInvitationIssueRequest,
    UserMembershipInvitationRevokeRequest,
    UserMembershipInvitationResponse,
    UserMembershipUpdateRequest,
    UserPermissionResponse,
    UserUpdateRequest,
)
from ragpilot_api.infrastructure.database.repositories.role_permission_repository import RolePermissionRepository
from ragpilot_api.infrastructure.database.repositories.tenant_repository import TenantRepository
from ragpilot_api.infrastructure.database.repositories.user_repository import UserRepository
from ragpilot_api.infrastructure.database.repositories.user_session_repository import UserSessionRepository
from ragpilot_api.infrastructure.database.session import get_database_session
from ragpilot_api.presentation.http.request_actor import (
    RequestActor,
    require_authenticated_actor,
    require_actor_capability_from_policy,
    require_actor_self_or_capability_from_policy,
    get_request_actor,
)


router = APIRouter()


def build_user_service(session: AsyncSession) -> UserService:
    return UserService(
        user_repository=UserRepository(session),
        user_session_repository=UserSessionRepository(session),
        tenant_repository=TenantRepository(session),
        role_permission_repository=RolePermissionRepository(session),
    )


@router.post("", response_model=UserDirectoryResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    request: UserCreateRequest,
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> UserDirectoryResponse:
    await require_actor_capability_from_policy(
        actor,
        "manage_members",
        RolePermissionRepository(session),
    )
    try:
        return await build_user_service(session).create_user(request, actor_user_id=actor.user_id)
    except ResourceConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    except ResourceNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error


@router.post("/bootstrap", response_model=UserDirectoryResponse, status_code=status.HTTP_201_CREATED)
async def bootstrap_user(
    request: UserBootstrapRequest,
    session: AsyncSession = Depends(get_database_session),
) -> UserDirectoryResponse:
    try:
        return await build_user_service(session).bootstrap_user(request)
    except ResourceConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    except ResourceNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error


@router.get("/bootstrap/status", response_model=UserBootstrapStatusResponse)
async def get_bootstrap_status(
    session: AsyncSession = Depends(get_database_session),
) -> UserBootstrapStatusResponse:
    return await build_user_service(session).get_bootstrap_status()


@router.post("/login", response_model=UserAuthenticatedSessionResponse)
async def login_user(
    request: UserLoginRequest,
    session: AsyncSession = Depends(get_database_session),
) -> UserAuthenticatedSessionResponse:
    try:
        return await build_user_service(session).login_user(request)
    except ResourceConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    except ResourceNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error


@router.get("/login-assessment", response_model=UserLoginAssessmentResponse)
async def assess_login_user(
    email: str = Query(min_length=3, max_length=320),
    session: AsyncSession = Depends(get_database_session),
) -> UserLoginAssessmentResponse:
    return await build_user_service(session).assess_login_user(email=email)


@router.post("/activate-invitations", response_model=UserAuthenticatedSessionResponse)
async def activate_user_invitations(
    request: UserInvitationActivationRequest,
    session: AsyncSession = Depends(get_database_session),
) -> UserAuthenticatedSessionResponse:
    try:
        return await build_user_service(session).activate_user_invitations(request)
    except ResourceConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    except ResourceNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error


@router.post("/me/sign-out", status_code=status.HTTP_204_NO_CONTENT)
async def sign_out_current_user(
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> None:
    require_authenticated_actor(actor)
    if actor.session_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Current bearer session is required to sign out.",
        )

    try:
        await build_user_service(session).revoke_current_session(
            user_id=actor.user_id,
            session_id=actor.session_id,
        )
    except ResourceNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error


@router.get("", response_model=list[UserDirectoryResponse])
async def list_users(
    tenant_id: UUID | None = Query(default=None),
    membership_status: str | None = Query(default=None, pattern=r"^(active|invited|suspended)$"),
    query: str | None = Query(default=None),
    email: str | None = Query(default=None),
    is_active: bool | None = Query(default=None),
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> list[UserDirectoryResponse]:
    await require_actor_capability_from_policy(
        actor,
        "access_admin_console",
        RolePermissionRepository(session),
    )
    return await build_user_service(session).list_users(
        tenant_id=tenant_id,
        membership_status=membership_status,
        query=query,
        email=email,
        is_active=is_active,
    )


@router.get("/audit-events", response_model=list[UserAccessEventResponse])
async def list_user_access_events(
    tenant_id: UUID | None = Query(default=None),
    user_id: UUID | None = Query(default=None),
    event_type: str | None = Query(
        default=None,
        pattern=r"^(sign_in_succeeded|invitation_issued|invitation_activated|invitation_revoked|membership_active|membership_suspended|membership_deleted)$",
    ),
    limit: int = Query(default=20, ge=1, le=100),
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> list[UserAccessEventResponse]:
    await require_actor_capability_from_policy(
        actor,
        "view_audit_events",
        RolePermissionRepository(session),
    )
    return await build_user_service(session).list_user_access_events(
        tenant_id=tenant_id,
        user_id=user_id,
        event_type=event_type,
        limit=limit,
    )


@router.get("/me", response_model=UserDirectoryResponse)
async def get_current_user(
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> UserDirectoryResponse:
    require_authenticated_actor(actor)
    try:
        return await build_user_service(session).get_user(user_id=actor.user_id)
    except ResourceNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error


@router.get("/me/permissions", response_model=UserPermissionResponse)
async def get_current_user_permissions(
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> UserPermissionResponse:
    require_authenticated_actor(actor)
    try:
        user_service = build_user_service(session)
        directory_user = await user_service.get_user(user_id=actor.user_id)
        return await user_service.build_user_permissions_from_policy(directory_user)
    except ResourceNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error


@router.get("/me/access-events", response_model=list[UserAccessEventResponse])
async def list_current_user_access_events(
    event_type: str | None = Query(
        default=None,
        pattern=r"^(sign_in_succeeded|invitation_issued|invitation_activated|invitation_revoked|membership_active|membership_suspended|membership_deleted)$",
    ),
    limit: int = Query(default=10, ge=1, le=50),
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> list[UserAccessEventResponse]:
    require_authenticated_actor(actor)
    return await build_user_service(session).list_user_access_events(
        user_id=actor.user_id,
        event_type=event_type,
        limit=limit,
    )


@router.get("/{user_id}", response_model=UserDirectoryResponse)
async def get_user(
    user_id: UUID,
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> UserDirectoryResponse:
    await require_actor_self_or_capability_from_policy(
        actor,
        user_id,
        "access_admin_console",
        RolePermissionRepository(session),
    )
    try:
        return await build_user_service(session).get_user(user_id=user_id)
    except ResourceNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error


@router.patch("/{user_id}", response_model=UserDirectoryResponse)
async def update_user(
    user_id: UUID,
    request: UserUpdateRequest,
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> UserDirectoryResponse:
    if request.role is not None:
        await require_actor_capability_from_policy(
            actor,
            "manage_members",
            RolePermissionRepository(session),
        )
    else:
        await require_actor_self_or_capability_from_policy(
            actor,
            user_id,
            "manage_members",
            RolePermissionRepository(session),
        )
    try:
        return await build_user_service(session).update_user(user_id=user_id, request=request)
    except ResourceConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    except ResourceNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error


@router.post("/{user_id}/memberships", response_model=UserDirectoryResponse, status_code=status.HTTP_201_CREATED)
async def create_user_membership(
    user_id: UUID,
    request: UserMembershipCreateRequest,
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> UserDirectoryResponse:
    await require_actor_capability_from_policy(
        actor,
        "manage_members",
        RolePermissionRepository(session),
    )
    try:
        return await build_user_service(session).create_user_membership(
            user_id=user_id,
            request=request,
            actor_user_id=actor.user_id,
        )
    except ResourceConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    except ResourceNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error


@router.patch("/{user_id}/memberships/{membership_id}", response_model=UserDirectoryResponse)
async def update_user_membership(
    user_id: UUID,
    membership_id: UUID,
    request: UserMembershipUpdateRequest,
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> UserDirectoryResponse:
    await require_actor_capability_from_policy(
        actor,
        "manage_members",
        RolePermissionRepository(session),
    )
    try:
        return await build_user_service(session).update_user_membership(
            user_id=user_id,
            membership_id=membership_id,
            request=request,
            actor_user_id=actor.user_id,
        )
    except ResourceNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error


@router.delete("/{user_id}/memberships/{membership_id}", response_model=UserDirectoryResponse)
async def delete_user_membership(
    user_id: UUID,
    membership_id: UUID,
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> UserDirectoryResponse:
    await require_actor_capability_from_policy(
        actor,
        "manage_members",
        RolePermissionRepository(session),
    )
    try:
        return await build_user_service(session).delete_user_membership(
            user_id=user_id,
            membership_id=membership_id,
            actor_user_id=actor.user_id,
        )
    except ResourceNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error


@router.post(
    "/{user_id}/memberships/{membership_id}/invitation",
    response_model=UserMembershipInvitationResponse,
)
async def issue_user_membership_invitation(
    user_id: UUID,
    membership_id: UUID,
    request: UserMembershipInvitationIssueRequest,
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> UserMembershipInvitationResponse:
    await require_actor_capability_from_policy(
        actor,
        "manage_members",
        RolePermissionRepository(session),
    )
    try:
        return await build_user_service(session).issue_user_membership_invitation(
            user_id=user_id,
            membership_id=membership_id,
            request=request,
            actor_user_id=actor.user_id,
        )
    except ResourceConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    except ResourceNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error


@router.post("/{user_id}/memberships/{membership_id}/revoke-invitation", response_model=UserDirectoryResponse)
async def revoke_user_membership_invitation(
    user_id: UUID,
    membership_id: UUID,
    request: UserMembershipInvitationRevokeRequest,
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> UserDirectoryResponse:
    await require_actor_capability_from_policy(
        actor,
        "manage_members",
        RolePermissionRepository(session),
    )
    try:
        return await build_user_service(session).revoke_user_membership_invitation(
            user_id=user_id,
            membership_id=membership_id,
            request=request,
            actor_user_id=actor.user_id,
        )
    except ResourceConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    except ResourceNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
