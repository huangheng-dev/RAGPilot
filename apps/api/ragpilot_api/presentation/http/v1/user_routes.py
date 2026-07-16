from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from ragpilot_api.application.errors import ResourceConflictError, ResourceNotFoundError
from ragpilot_api.application.identity.user_service import UserService, UserSessionTelemetry
from ragpilot_api.contracts.http.user_contracts import (
    UserAccessEventResponse,
    UserAccessGovernanceSummaryResponse,
    UserActiveSessionResponse,
    UserAuthenticationModeResponse,
    UserAuthenticatedSessionResponse,
    UserBootstrapRequest,
    UserBootstrapStatusResponse,
    UserCreateRequest,
    UserCurrentAccessSummaryResponse,
    UserCurrentPasswordChangeRequest,
    UserDirectoryResponse,
    UserInvitationActivationRequest,
    UserLoginAssessmentResponse,
    UserLoginRequest,
    UserMembershipCreateRequest,
    UserMembershipInvitationIssueRequest,
    UserMembershipInvitationRevokeRequest,
    UserMembershipInvitationResponse,
    UserMembershipUpdateRequest,
    UserPasswordResetRequest,
    UserPermissionResponse,
    UserSessionRevokeRequest,
    UserSessionBulkRevocationResponse,
    UserSessionSecuritySummaryResponse,
    UserUpdateRequest,
)
from ragpilot_api.infrastructure.database.repositories.role_permission_repository import RolePermissionRepository
from ragpilot_api.infrastructure.database.repositories.tenant_repository import TenantRepository
from ragpilot_api.infrastructure.database.repositories.user_repository import UserRepository
from ragpilot_api.infrastructure.database.repositories.user_session_repository import UserSessionRepository
from ragpilot_api.infrastructure.database.session import get_database_session
from ragpilot_api.presentation.http.request_actor import (
    SESSION_COOKIE_NAME,
    RequestActor,
    require_authenticated_actor,
    require_actor_membership_access,
    require_actor_capability_from_policy,
    require_current_session_actor,
    require_actor_tenant_access,
    require_actor_user_directory_access,
    require_explicit_tenant_scope_for_scoped_actor,
    require_actor_self_or_capability_from_policy,
    get_request_actor,
)
from ragpilot_api.shared.settings import get_settings


router = APIRouter()

AUDIT_EVENT_TYPE_PATTERN = (
    r"^(sign_in_failed|sign_in_succeeded|invitation_activation_failed|sign_out_succeeded|session_revoked|password_changed|password_reset|"
    r"invitation_issued|invitation_activated|invitation_revoked|membership_active|"
    r"membership_suspended|membership_deleted)$"
)


def _normalize_header_value(value: str | None, *, max_length: int) -> str | None:
    if value is None:
        return None
    normalized = value.strip()
    if not normalized:
        return None
    return normalized[:max_length]


def _resolve_request_ip_address(request: Request) -> str | None:
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        primary_forwarded_ip = forwarded_for.split(",")[0].strip()
        if primary_forwarded_ip:
            return primary_forwarded_ip[:128]
    if request.client is not None and request.client.host:
        return request.client.host[:128]
    return None


def _resolve_request_device_label(user_agent: str | None) -> str | None:
    normalized_user_agent = (user_agent or "").lower()
    if not normalized_user_agent:
        return None

    operating_system = None
    if "iphone" in normalized_user_agent or "ipad" in normalized_user_agent or "ios" in normalized_user_agent:
        operating_system = "iOS"
    elif "android" in normalized_user_agent:
        operating_system = "Android"
    elif "windows" in normalized_user_agent:
        operating_system = "Windows"
    elif "mac os" in normalized_user_agent or "macintosh" in normalized_user_agent:
        operating_system = "macOS"
    elif "linux" in normalized_user_agent:
        operating_system = "Linux"

    browser = None
    if "edg/" in normalized_user_agent:
        browser = "Edge"
    elif "chrome/" in normalized_user_agent and "chromium" not in normalized_user_agent:
        browser = "Chrome"
    elif "firefox/" in normalized_user_agent:
        browser = "Firefox"
    elif "safari/" in normalized_user_agent and "chrome/" not in normalized_user_agent:
        browser = "Safari"

    if operating_system and browser:
        return f"{operating_system} · {browser}"
    return operating_system or browser or "Unknown device"


def build_user_session_telemetry(request: Request) -> UserSessionTelemetry:
    user_agent = _normalize_header_value(request.headers.get("user-agent"), max_length=512)
    ip_address = _resolve_request_ip_address(request)
    return UserSessionTelemetry(
        user_agent=user_agent,
        ip_address=ip_address,
        device_label=_resolve_request_device_label(user_agent),
    )


def build_user_service(session: AsyncSession) -> UserService:
    return UserService(
        user_repository=UserRepository(session),
        user_session_repository=UserSessionRepository(session),
        tenant_repository=TenantRepository(session),
        role_permission_repository=RolePermissionRepository(session),
        settings=get_settings(),
    )


@router.post("", response_model=UserDirectoryResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    request: UserCreateRequest,
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> UserDirectoryResponse:
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(
        actor,
        "manage_members",
        RolePermissionRepository(session),
    )
    if request.tenant_id is None and actor.active_tenant_ids is not None and actor.role not in {"super_admin", "reviewer"}:
        require_explicit_tenant_scope_for_scoped_actor(
            actor,
            detail="Tenant scope is required when creating a governed member.",
        )
    if request.tenant_id is not None:
        require_actor_tenant_access(actor, request.tenant_id)
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


@router.get("/auth-mode", response_model=UserAuthenticationModeResponse)
async def get_authentication_mode(
    return_to: str | None = Query(default=None),
    session: AsyncSession = Depends(get_database_session),
) -> UserAuthenticationModeResponse:
    return await build_user_service(session).get_authentication_mode(return_to=return_to)


@router.post("/login", response_model=UserAuthenticatedSessionResponse)
async def login_user(
    request: UserLoginRequest,
    http_request: Request,
    response: Response,
    session: AsyncSession = Depends(get_database_session),
) -> UserAuthenticatedSessionResponse:
    try:
        authenticated = await build_user_service(session).login_user(
            request,
            session_telemetry=build_user_session_telemetry(http_request),
        )
        _set_browser_session_cookie(response, _resolve_authenticated_session_token(authenticated))
        return authenticated
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
    http_request: Request,
    response: Response,
    session: AsyncSession = Depends(get_database_session),
) -> UserAuthenticatedSessionResponse:
    try:
        authenticated = await build_user_service(session).activate_user_invitations(
            request,
            session_telemetry=build_user_session_telemetry(http_request),
        )
        _set_browser_session_cookie(response, _resolve_authenticated_session_token(authenticated))
        return authenticated
    except ResourceConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    except ResourceNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error


@router.post("/me/sign-out", status_code=status.HTTP_204_NO_CONTENT)
async def sign_out_current_user(
    response: Response,
    request: UserSessionRevokeRequest | None = None,
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
            actor_user_id=actor.user_id,
            reason=request.reason if request is not None else None,
        )
        settings = get_settings()
        response.delete_cookie(
            key=SESSION_COOKIE_NAME,
            path="/",
            secure=settings.environment.strip().lower() == "production",
            httponly=True,
            samesite="lax",
        )
    except ResourceNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error


def _set_browser_session_cookie(response: Response, session_token: str) -> None:
    settings = get_settings()
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=session_token,
        max_age=14 * 24 * 60 * 60,
        path="/",
        secure=settings.environment.strip().lower() == "production",
        httponly=True,
        samesite="lax",
    )


def _resolve_authenticated_session_token(authenticated: UserAuthenticatedSessionResponse | dict) -> str:
    if isinstance(authenticated, dict):
        return str(authenticated["session"]["session_token"])
    return authenticated.session.session_token


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
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(
        actor,
        "access_admin_console",
        RolePermissionRepository(session),
    )
    if tenant_id is None and actor.active_tenant_ids is not None and actor.role not in {"super_admin", "reviewer"}:
        require_explicit_tenant_scope_for_scoped_actor(
            actor,
            detail="Tenant scope is required for scoped member directory queries.",
        )
    if tenant_id is not None:
        require_actor_tenant_access(actor, tenant_id)
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
        pattern=AUDIT_EVENT_TYPE_PATTERN,
    ),
    query: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> list[UserAccessEventResponse]:
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(
        actor,
        "view_audit_events",
        RolePermissionRepository(session),
    )
    if tenant_id is None and actor.active_tenant_ids is not None and actor.role not in {"super_admin", "reviewer"}:
        require_explicit_tenant_scope_for_scoped_actor(
            actor,
            detail="Tenant scope is required for scoped access-audit queries.",
        )
    if tenant_id is not None:
        require_actor_tenant_access(actor, tenant_id)
    return await build_user_service(session).list_user_access_events(
        tenant_id=tenant_id,
        user_id=user_id,
        event_type=event_type,
        query=query,
        limit=limit,
    )


@router.get("/access-governance-summary", response_model=UserAccessGovernanceSummaryResponse)
async def get_user_access_governance_summary(
    tenant_id: UUID | None = Query(default=None),
    membership_status: str | None = Query(default=None, pattern=r"^(active|invited|suspended)$"),
    query: str | None = Query(default=None),
    is_active: bool | None = Query(default=None),
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> UserAccessGovernanceSummaryResponse:
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(
        actor,
        "access_admin_console",
        RolePermissionRepository(session),
    )
    if tenant_id is None and actor.active_tenant_ids is not None and actor.role not in {"super_admin", "reviewer"}:
        require_explicit_tenant_scope_for_scoped_actor(
            actor,
            detail="Tenant scope is required for scoped access-governance summary queries.",
        )
    if tenant_id is not None:
        require_actor_tenant_access(actor, tenant_id)
    return await build_user_service(session).get_user_access_governance_summary(
        tenant_id=tenant_id,
        membership_status=membership_status,
        query=query,
        is_active=is_active,
    )


@router.get("/me", response_model=UserDirectoryResponse)
async def get_current_user(
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> UserDirectoryResponse:
    require_current_session_actor(actor, detail="Current bearer session is required to load the signed-in profile.")
    try:
        return await build_user_service(session).get_user(user_id=actor.user_id)
    except ResourceNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error


@router.get("/me/permissions", response_model=UserPermissionResponse)
async def get_current_user_permissions(
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> UserPermissionResponse:
    require_current_session_actor(actor, detail="Current bearer session is required to load the permission snapshot.")
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
        pattern=AUDIT_EVENT_TYPE_PATTERN,
    ),
    query: str | None = Query(default=None),
    limit: int = Query(default=10, ge=1, le=50),
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> list[UserAccessEventResponse]:
    require_current_session_actor(actor, detail="Current bearer session is required to review self-service access events.")
    return await build_user_service(session).list_user_access_events(
        user_id=actor.user_id,
        event_type=event_type,
        query=query,
        limit=limit,
    )


@router.get("/me/access-summary", response_model=UserCurrentAccessSummaryResponse)
async def get_current_user_access_summary(
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> UserCurrentAccessSummaryResponse:
    require_current_session_actor(actor, detail="Current bearer session is required to review self-service access posture.")
    return await build_user_service(session).get_user_access_summary(
        user_id=actor.user_id,
    )


@router.post("/me/change-password", response_model=UserDirectoryResponse)
async def change_current_user_password(
    request: UserCurrentPasswordChangeRequest,
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> UserDirectoryResponse:
    require_current_session_actor(actor, detail="Current bearer session is required to change the signed-in password.")
    try:
        return await build_user_service(session).change_current_user_password(
            user_id=actor.user_id,
            request=request,
            actor_user_id=actor.user_id,
            current_session_id=actor.session_id,
        )
    except ResourceConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    except ResourceNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error


@router.get("/me/sessions", response_model=list[UserActiveSessionResponse])
async def list_current_user_sessions(
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> list[UserActiveSessionResponse]:
    require_current_session_actor(actor, detail="Current bearer session is required to review active sessions.")
    return await build_user_service(session).list_current_user_sessions(
        user_id=actor.user_id,
        current_session_id=actor.session_id,
    )


@router.get("/me/session-security", response_model=UserSessionSecuritySummaryResponse)
async def get_current_user_session_security_summary(
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> UserSessionSecuritySummaryResponse:
    require_current_session_actor(actor, detail="Current bearer session is required to review session security.")
    return await build_user_service(session).get_user_session_security_summary(
        user_id=actor.user_id,
        current_session_id=actor.session_id,
    )


@router.delete("/me/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_current_user_session(
    session_id: UUID,
    request: UserSessionRevokeRequest | None = None,
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> None:
    require_current_session_actor(actor, detail="Current bearer session is required to revoke a session from self-service settings.")
    try:
        await build_user_service(session).revoke_user_session_for_user(
            user_id=actor.user_id,
            session_id=session_id,
            actor_user_id=actor.user_id,
            reason=request.reason if request is not None else None,
        )
    except ResourceNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error


@router.post("/me/sessions/revoke-others", response_model=UserSessionBulkRevocationResponse)
async def revoke_other_current_user_sessions(
    request: UserSessionRevokeRequest | None = None,
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> UserSessionBulkRevocationResponse:
    require_current_session_actor(actor, detail="Current bearer session is required to revoke other active sessions.")
    if actor.session_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Current bearer session is required to preserve the active session.",
        )

    return await build_user_service(session).revoke_other_sessions_for_current_user(
        user_id=actor.user_id,
        current_session_id=actor.session_id,
        actor_user_id=actor.user_id,
        reason=request.reason if request is not None else None,
    )


@router.get("/{user_id}", response_model=UserDirectoryResponse)
async def get_user(
    user_id: UUID,
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> UserDirectoryResponse:
    require_authenticated_actor(actor)
    await require_actor_self_or_capability_from_policy(
        actor,
        user_id,
        "access_admin_console",
        RolePermissionRepository(session),
    )
    await require_actor_user_directory_access(actor, user_id, UserRepository(session))
    try:
        return await build_user_service(session).get_user(user_id=user_id)
    except ResourceNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error


@router.get("/{user_id}/access-summary", response_model=UserCurrentAccessSummaryResponse)
async def get_user_access_summary(
    user_id: UUID,
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> UserCurrentAccessSummaryResponse:
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(
        actor,
        "manage_members",
        RolePermissionRepository(session),
    )
    await require_actor_user_directory_access(actor, user_id, UserRepository(session))
    try:
        return await build_user_service(session).get_user_access_summary(user_id=user_id)
    except ResourceNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error


@router.get("/{user_id}/access-events", response_model=list[UserAccessEventResponse])
async def list_user_member_access_events(
    user_id: UUID,
    event_type: str | None = Query(
        default=None,
        pattern=AUDIT_EVENT_TYPE_PATTERN,
    ),
    query: str | None = Query(default=None),
    limit: int = Query(default=12, ge=1, le=50),
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> list[UserAccessEventResponse]:
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(
        actor,
        "manage_members",
        RolePermissionRepository(session),
    )
    await require_actor_user_directory_access(actor, user_id, UserRepository(session))
    return await build_user_service(session).list_user_access_events(
        user_id=user_id,
        event_type=event_type,
        query=query,
        limit=limit,
    )


@router.get("/{user_id}/sessions", response_model=list[UserActiveSessionResponse])
async def list_user_sessions(
    user_id: UUID,
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> list[UserActiveSessionResponse]:
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(
        actor,
        "manage_members",
        RolePermissionRepository(session),
    )
    await require_actor_user_directory_access(actor, user_id, UserRepository(session))
    return await build_user_service(session).list_current_user_sessions(
        user_id=user_id,
        current_session_id=actor.session_id if actor.user_id == user_id else None,
    )


@router.get("/{user_id}/session-security", response_model=UserSessionSecuritySummaryResponse)
async def get_user_session_security_summary(
    user_id: UUID,
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> UserSessionSecuritySummaryResponse:
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(
        actor,
        "manage_members",
        RolePermissionRepository(session),
    )
    await require_actor_user_directory_access(actor, user_id, UserRepository(session))
    return await build_user_service(session).get_user_session_security_summary(
        user_id=user_id,
        current_session_id=actor.session_id if actor.user_id == user_id else None,
    )


@router.delete("/{user_id}/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_user_session(
    user_id: UUID,
    session_id: UUID,
    request: UserSessionRevokeRequest | None = None,
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> None:
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(
        actor,
        "manage_members",
        RolePermissionRepository(session),
    )
    await require_actor_user_directory_access(actor, user_id, UserRepository(session))
    try:
        await build_user_service(session).revoke_user_session_for_user(
            user_id=user_id,
            session_id=session_id,
            actor_user_id=actor.user_id,
            reason=request.reason if request is not None else None,
        )
    except ResourceNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error


@router.post("/{user_id}/sessions/revoke-all", response_model=UserSessionBulkRevocationResponse)
async def revoke_all_user_sessions(
    user_id: UUID,
    request: UserSessionRevokeRequest | None = None,
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> UserSessionBulkRevocationResponse:
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(
        actor,
        "manage_members",
        RolePermissionRepository(session),
    )
    await require_actor_user_directory_access(actor, user_id, UserRepository(session))
    return await build_user_service(session).revoke_all_sessions_for_user(
        user_id=user_id,
        actor_user_id=actor.user_id,
        reason=request.reason if request is not None else None,
    )


@router.patch("/{user_id}", response_model=UserDirectoryResponse)
async def update_user(
    user_id: UUID,
    request: UserUpdateRequest,
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> UserDirectoryResponse:
    require_authenticated_actor(actor)
    user_service = build_user_service(session)

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
        get_user_handler = getattr(user_service, "get_user", None)
        if actor.user_id == user_id and get_user_handler is not None:
            try:
                existing_user = await get_user_handler(user_id=user_id)
            except ResourceNotFoundError as error:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error

            existing_is_active = (
                existing_user.is_active
                if hasattr(existing_user, "is_active")
                else bool(existing_user.get("is_active"))
            )
            if request.is_active != existing_is_active:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Self-service profile updates cannot change account activity.",
                )
    await require_actor_user_directory_access(actor, user_id, UserRepository(session))
    try:
        return await user_service.update_user(
            user_id=user_id,
            request=request,
            actor_user_id=actor.user_id,
        )
    except ResourceConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    except ResourceNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error


@router.post("/{user_id}/reset-password", response_model=UserDirectoryResponse)
async def reset_user_password(
    user_id: UUID,
    request: UserPasswordResetRequest,
    actor: RequestActor = Depends(get_request_actor),
    session: AsyncSession = Depends(get_database_session),
) -> UserDirectoryResponse:
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(
        actor,
        "manage_members",
        RolePermissionRepository(session),
    )
    await require_actor_user_directory_access(actor, user_id, UserRepository(session))
    try:
        return await build_user_service(session).reset_user_password(
            user_id=user_id,
            request=request,
            actor_user_id=actor.user_id,
        )
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
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(
        actor,
        "manage_members",
        RolePermissionRepository(session),
    )
    require_actor_tenant_access(actor, request.tenant_id)
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
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(
        actor,
        "manage_members",
        RolePermissionRepository(session),
    )
    await require_actor_membership_access(actor, membership_id, UserRepository(session))
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
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(
        actor,
        "manage_members",
        RolePermissionRepository(session),
    )
    await require_actor_membership_access(actor, membership_id, UserRepository(session))
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
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(
        actor,
        "manage_members",
        RolePermissionRepository(session),
    )
    await require_actor_membership_access(actor, membership_id, UserRepository(session))
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
    require_authenticated_actor(actor)
    await require_actor_capability_from_policy(
        actor,
        "manage_members",
        RolePermissionRepository(session),
    )
    await require_actor_membership_access(actor, membership_id, UserRepository(session))
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
