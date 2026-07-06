from datetime import datetime
from typing import Any
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


MembershipStatus = Literal["active", "invited", "suspended"]
UserRole = Literal["super_admin", "operator", "reviewer"]
AuthPrimaryMode = Literal["directory_local", "password_local", "oidc", "saml"]
ExternalAuthPrimaryMode = Literal["oidc", "saml"]
AuthSignInMethod = Literal["local_form", "external_redirect"]
MembershipAccessState = Literal["bootstrap", "ready", "blocked"]
AccessGovernanceReviewCategory = Literal[
    "expired_invitations",
    "expiring_invitations",
    "dormant_accounts",
    "suspended_memberships",
    "failed_sign_in_pressure",
    "invitation_activation_pressure",
    "session_spread_pressure",
]
AccessGovernanceReviewSeverity = Literal["healthy", "review", "attention"]


class UserCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: str = Field(min_length=3, max_length=320)
    display_name: str = Field(min_length=1, max_length=160)
    password: str | None = Field(default=None, min_length=8, max_length=160)
    is_active: bool = True
    role: UserRole = "operator"
    tenant_id: UUID | None = None
    membership_status: MembershipStatus = "active"


class UserBootstrapRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: str = Field(min_length=3, max_length=320)
    display_name: str = Field(min_length=1, max_length=160)
    password: str | None = Field(default=None, min_length=8, max_length=160)


class UserBootstrapStatusResponse(BaseModel):
    has_users: bool
    allow_initial_super_admin: bool


class UserAuthenticationModeResponse(BaseModel):
    primary_mode: AuthPrimaryMode
    sign_in_method: AuthSignInMethod
    session_transport: Literal["bearer_session"]
    supports_display_name_input: bool
    supports_password_input: bool
    supports_invitation_activation: bool
    allow_initial_super_admin: bool
    provider_protocol: ExternalAuthPrimaryMode | None = None
    provider_display_name: str | None = None
    provider_sign_in_url: str | None = None
    provider_post_sign_out_url: str | None = None


class UserLoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: str = Field(min_length=3, max_length=320)
    display_name: str = Field(min_length=1, max_length=160)
    password: str | None = Field(default=None, min_length=8, max_length=160)


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
    model_config = ConfigDict(extra="forbid")
    email: str = Field(min_length=3, max_length=320)
    invitation_token: str = Field(min_length=4, max_length=80)
    password: str | None = Field(default=None, min_length=8, max_length=160)


class UserCurrentPasswordChangeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    current_password: str = Field(min_length=8, max_length=160)
    new_password: str = Field(min_length=8, max_length=160)


class UserPasswordResetRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    new_password: str = Field(min_length=8, max_length=160)
    reason: str | None = Field(default=None, min_length=1, max_length=240)


class UserMembershipCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    tenant_id: UUID
    membership_status: MembershipStatus = "active"


class UserUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: str = Field(min_length=3, max_length=320)
    display_name: str = Field(min_length=1, max_length=160)
    is_active: bool = True
    role: UserRole | None = None


class UserMembershipUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    membership_status: MembershipStatus
    reason: str | None = Field(default=None, min_length=1, max_length=240)


class UserMembershipInvitationIssueRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    reason: str | None = Field(default=None, min_length=1, max_length=240)


class UserMembershipInvitationRevokeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    reason: str | None = Field(default=None, min_length=1, max_length=240)


class UserSessionRevokeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
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


class UserActiveSessionResponse(BaseModel):
    id: UUID
    authentication_mode: str
    user_agent: str | None = None
    ip_address: str | None = None
    device_label: str | None = None
    created_at: datetime
    updated_at: datetime
    expires_at: datetime
    is_current: bool = False


class UserSessionSecurityModeCountResponse(BaseModel):
    authentication_mode: str
    session_count: int


class UserSessionSecuritySummaryResponse(BaseModel):
    total_active_sessions: int
    other_active_sessions: int
    expires_within_24_hours: int
    distinct_device_count: int = 0
    distinct_ip_count: int = 0
    oldest_session_started_at: datetime | None
    latest_session_expires_at: datetime | None
    current_session_started_at: datetime | None
    current_session_expires_at: datetime | None
    mode_breakdown: list[UserSessionSecurityModeCountResponse] = Field(default_factory=list)


class UserSessionBulkRevocationResponse(BaseModel):
    user_id: UUID
    revoked_session_count: int
    remaining_active_sessions: int
    preserved_current_session: bool = False
    revocation_scope: Literal["other_sessions", "all_sessions"]


class UserAccessGovernanceEventCountResponse(BaseModel):
    event_type: str
    event_count: int


class UserAccessGovernanceReviewFollowUpResponse(BaseModel):
    tenant_id: UUID | None = None
    user_id: UUID | None = None
    membership_id: UUID | None = None
    member_relationship_filter: Literal["all", "active", "invited", "suspended"] | None = None
    member_account_filter: Literal["all", "active", "inactive"] | None = None
    management_panel: Literal["user-edit"] | None = None


class UserAccessGovernanceReviewItemResponse(BaseModel):
    category: AccessGovernanceReviewCategory
    severity: AccessGovernanceReviewSeverity
    item_count: int
    tenant_id: UUID | None = None
    user_id: UUID | None = None
    membership_id: UUID | None = None
    follow_up: UserAccessGovernanceReviewFollowUpResponse | None = None


class UserAccessGovernanceSummaryResponse(BaseModel):
    total_members: int
    active_accounts: int
    inactive_accounts: int
    active_memberships: int
    invited_memberships: int
    suspended_memberships: int
    dormant_accounts: int
    expiring_invitations: int
    expired_invitations: int
    recent_failed_sign_in_events: int
    members_under_sign_in_lockout: int
    recent_failed_invitation_activation_events: int
    members_with_failed_invitation_activation: int
    members_with_session_spread: int
    total_audit_events: int
    sensitive_audit_events: int
    active_sessions: int
    sessions_expiring_within_24_hours: int
    review_queue_items: int
    event_breakdown: list[UserAccessGovernanceEventCountResponse] = Field(default_factory=list)
    review_items: list[UserAccessGovernanceReviewItemResponse] = Field(default_factory=list)


class UserCurrentAccessSummaryResponse(BaseModel):
    membership_access_state: MembershipAccessState
    active_memberships: int
    invited_memberships: int
    suspended_memberships: int
    expiring_invitations: int
    expired_invitations: int
    recent_failed_sign_in_events: int
    recent_failed_invitation_activation_events: int
    total_audit_events: int
    sensitive_audit_events: int
    active_sessions: int
    sessions_expiring_within_24_hours: int
    recent_sign_in_events: int
    sign_in_lockout_active: bool = False
    sign_in_lockout_expires_at: datetime | None = None
    session_spread_detected: bool = False
    latest_event_type: str | None = None
    latest_event_at: datetime | None = None
    event_breakdown: list[UserAccessGovernanceEventCountResponse] = Field(default_factory=list)
    review_items: list[UserAccessGovernanceReviewItemResponse] = Field(default_factory=list)


class UserAuthenticatedSessionResponse(BaseModel):
    user: UserDirectoryResponse
    session: UserSessionResponse
    permissions: "UserPermissionResponse"


class UserPermissionResponse(BaseModel):
    user_id: UUID
    role: UserRole
    has_active_membership: bool
    active_tenant_ids: list[UUID]
    capabilities: dict[str, bool]
