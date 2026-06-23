from datetime import datetime
from typing import Any
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


MembershipStatus = Literal["active", "invited", "suspended"]
UserRole = Literal["super_admin", "operator", "reviewer"]


class UserCreateRequest(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    display_name: str = Field(min_length=1, max_length=160)
    is_active: bool = True
    role: UserRole = "operator"
    tenant_id: UUID | None = None
    membership_status: MembershipStatus = "active"


class UserBootstrapRequest(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    display_name: str = Field(min_length=1, max_length=160)


class UserBootstrapStatusResponse(BaseModel):
    has_users: bool
    allow_initial_super_admin: bool


class UserLoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    display_name: str = Field(min_length=1, max_length=160)


class UserLoginAssessmentResponse(BaseModel):
    email: str
    has_users: bool
    user_exists: bool
    is_active: bool | None = None
    role: UserRole | None = None
    account_state: Literal[
        "bootstrap_available",
        "ready",
        "invited",
        "inactive_account",
        "inactive_membership",
        "not_found",
    ]
    allow_sign_in: bool
    next_action: Literal["bootstrap", "sign_in", "activate_invitation", "contact_admin"]
    active_membership_count: int = 0
    invited_membership_count: int = 0
    suspended_membership_count: int = 0
    expired_invitation_count: int = 0
    expiring_invitation_count: int = 0
    memberships: list["UserMembershipResponse"] = Field(default_factory=list)


class UserInvitationActivationRequest(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    invitation_token: str = Field(min_length=4, max_length=80)


class UserMembershipCreateRequest(BaseModel):
    tenant_id: UUID
    membership_status: MembershipStatus = "active"


class UserUpdateRequest(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    display_name: str = Field(min_length=1, max_length=160)
    is_active: bool = True
    role: UserRole | None = None


class UserMembershipUpdateRequest(BaseModel):
    membership_status: MembershipStatus
    reason: str | None = Field(default=None, min_length=1, max_length=240)


class UserMembershipInvitationIssueRequest(BaseModel):
    reason: str | None = Field(default=None, min_length=1, max_length=240)


class UserMembershipInvitationRevokeRequest(BaseModel):
    reason: str | None = Field(default=None, min_length=1, max_length=240)


class UserMembershipResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    tenant_name: str
    tenant_slug: str
    membership_status: MembershipStatus
    invitation_issue_count: int
    last_invitation_issued_by_user_id: UUID | None
    last_invitation_issued_by_display_name: str | None
    invited_at: datetime | None
    invitation_expires_at: datetime | None
    activated_at: datetime | None
    created_at: datetime
    updated_at: datetime


class UserMembershipInvitationResponse(BaseModel):
    membership_id: UUID
    tenant_id: UUID
    tenant_name: str
    tenant_slug: str
    membership_status: MembershipStatus
    invitation_token: str
    invitation_issue_count: int
    last_invitation_issued_by_user_id: UUID | None
    last_invitation_issued_by_display_name: str | None
    invited_at: datetime | None
    invitation_expires_at: datetime | None
    activated_at: datetime | None


class UserAccessEventResponse(BaseModel):
    id: UUID
    tenant_id: UUID | None
    user_id: UUID
    membership_id: UUID | None
    actor_user_id: UUID | None
    actor_display_name: str | None
    user_display_name: str | None
    tenant_name: str | None
    event_type: str
    detail_json: dict[str, Any]
    created_at: datetime


class UserDirectoryResponse(BaseModel):
    id: UUID
    email: str
    display_name: str
    is_active: bool
    role: UserRole
    last_signed_in_at: datetime | None
    memberships: list[UserMembershipResponse]
    created_at: datetime
    updated_at: datetime


class UserSessionResponse(BaseModel):
    session_token: str
    expires_at: datetime


class UserAuthenticatedSessionResponse(BaseModel):
    user: UserDirectoryResponse
    session: UserSessionResponse


class UserPermissionResponse(BaseModel):
    user_id: UUID
    role: UserRole
    has_active_membership: bool
    active_tenant_ids: list[UUID]
    capabilities: dict[str, bool]
