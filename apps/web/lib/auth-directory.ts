"use client";

import type { AuthRole } from "@/lib/auth/access";
import { authenticatedApiRequest } from "@/lib/authenticated-api";

export type DirectoryMembership = {
  id: string;
  tenant_id: string;
  tenant_name: string;
  tenant_slug: string;
  membership_status: "active" | "invited" | "suspended";
  invited_at: string | null;
  invitation_expires_at: string | null;
  activated_at: string | null;
  created_at: string;
  updated_at: string;
};

export type DirectoryUser = {
  id: string;
  email: string;
  display_name: string;
  is_active: boolean;
  role: AuthRole;
  last_signed_in_at: string | null;
  memberships: DirectoryMembership[];
  created_at: string;
  updated_at: string;
};

export type DirectorySession = {
  session_token: string;
  expires_at: string;
};

export type DirectoryActiveSession = {
  id: string;
  authentication_mode: string;
  user_agent: string | null;
  ip_address: string | null;
  device_label: string | null;
  created_at: string;
  updated_at: string;
  expires_at: string;
  is_current: boolean;
};

export type DirectorySessionSecurityModeCount = {
  authentication_mode: string;
  session_count: number;
};

export type DirectorySessionSecuritySummary = {
  total_active_sessions: number;
  other_active_sessions: number;
  expires_within_24_hours: number;
  distinct_device_count: number;
  distinct_ip_count: number;
  oldest_session_started_at: string | null;
  latest_session_expires_at: string | null;
  current_session_started_at: string | null;
  current_session_expires_at: string | null;
  mode_breakdown: DirectorySessionSecurityModeCount[];
};

export type DirectorySessionBulkRevocation = {
  user_id: string;
  revoked_session_count: number;
  remaining_active_sessions: number;
  preserved_current_session: boolean;
  revocation_scope: "other_sessions" | "all_sessions";
};

export type DirectoryCurrentAccessSummary = {
  membership_access_state: "bootstrap" | "ready" | "blocked";
  active_memberships: number;
  invited_memberships: number;
  suspended_memberships: number;
  expiring_invitations: number;
  expired_invitations: number;
  recent_failed_sign_in_events: number;
  recent_failed_invitation_activation_events: number;
  total_audit_events: number;
  sensitive_audit_events: number;
  active_sessions: number;
  sessions_expiring_within_24_hours: number;
  recent_sign_in_events: number;
  sign_in_lockout_active: boolean;
  sign_in_lockout_expires_at: string | null;
  session_spread_detected: boolean;
  latest_event_type: DirectoryAccessEvent["event_type"] | null;
  latest_event_at: string | null;
  event_breakdown: Array<{
    event_type: DirectoryAccessEvent["event_type"];
    event_count: number;
  }>;
  review_items: Array<{
    category:
      | "expired_invitations"
      | "expiring_invitations"
      | "dormant_accounts"
      | "suspended_memberships"
      | "failed_sign_in_pressure"
      | "invitation_activation_pressure"
      | "session_spread_pressure";
    severity: "healthy" | "review" | "attention";
    item_count: number;
    tenant_id?: string | null;
    user_id?: string | null;
    membership_id?: string | null;
    follow_up?: {
      tenant_id: string | null;
      user_id: string | null;
      membership_id: string | null;
      member_relationship_filter: "all" | "active" | "invited" | "suspended" | null;
      member_account_filter: "all" | "active" | "inactive" | null;
      management_panel: "user-edit" | null;
    } | null;
  }>;
};

export type DirectoryAccessGovernanceSummary = {
  total_members: number;
  active_accounts: number;
  inactive_accounts: number;
  active_memberships: number;
  invited_memberships: number;
  suspended_memberships: number;
  dormant_accounts: number;
  expiring_invitations: number;
  expired_invitations: number;
  recent_failed_sign_in_events: number;
  members_under_sign_in_lockout: number;
  recent_failed_invitation_activation_events: number;
  members_with_failed_invitation_activation: number;
  members_with_session_spread: number;
  total_audit_events: number;
  sensitive_audit_events: number;
  active_sessions: number;
  sessions_expiring_within_24_hours: number;
  review_queue_items: number;
  event_breakdown: Array<{
    event_type: string;
    event_count: number;
  }>;
  review_items: Array<{
    category:
      | "expired_invitations"
      | "expiring_invitations"
      | "dormant_accounts"
      | "suspended_memberships"
      | "failed_sign_in_pressure"
      | "invitation_activation_pressure"
      | "session_spread_pressure";
    severity: "healthy" | "review" | "attention";
    item_count: number;
    tenant_id: string | null;
    user_id: string | null;
    membership_id: string | null;
    follow_up: {
      tenant_id: string | null;
      user_id: string | null;
      membership_id: string | null;
      member_relationship_filter: "all" | "active" | "invited" | "suspended" | null;
      member_account_filter: "all" | "active" | "inactive" | null;
      management_panel: "user-edit" | null;
    } | null;
  }>;
};

export type AuthenticatedDirectorySession = {
  user: DirectoryUser;
  session: DirectorySession;
  permissions: DirectoryPermissions;
};

export type DirectoryCapabilityKey =
  | "access_home"
  | "access_chat"
  | "access_documents"
  | "access_agents"
  | "access_operations"
  | "access_settings"
  | "access_admin_console"
  | "manage_admin_resources"
  | "manage_members"
  | "manage_runtime_governance"
  | "review_runtime_governance"
  | "manage_agent_definitions"
  | "execute_agents"
  | "manage_documents"
  | "send_chat_messages"
  | "retry_workflow_runs"
  | "view_audit_events"
  | "manage_local_session_role";

export type DirectoryPermissions = {
  user_id: string;
  role: AuthRole;
  has_active_membership: boolean;
  active_tenant_ids: string[];
  capabilities: Record<DirectoryCapabilityKey, boolean>;
};

export type DirectoryAccessEvent = {
  id: string;
  tenant_id: string | null;
  user_id: string;
  membership_id: string | null;
  actor_user_id: string | null;
  actor_display_name: string | null;
  user_display_name: string | null;
  tenant_name: string | null;
  event_type:
    | "sign_in_failed"
    | "sign_in_succeeded"
    | "invitation_activation_failed"
    | "sign_out_succeeded"
    | "session_revoked"
    | "password_changed"
    | "password_reset"
    | "invitation_issued"
    | "invitation_activated"
    | "invitation_revoked"
    | "membership_active"
    | "membership_suspended"
    | "membership_deleted";
  detail_json: Record<string, unknown>;
  created_at: string;
};

export type BootstrapStatus = {
  has_users: boolean;
  allow_initial_super_admin: boolean;
};

export type AuthPrimaryMode = "directory_local" | "password_local" | "oidc" | "saml";

export type DirectoryAuthMode = {
  primary_mode: AuthPrimaryMode;
  sign_in_method: "local_form" | "external_redirect";
  session_transport: "bearer_session";
  supports_display_name_input: boolean;
  supports_password_input: boolean;
  supports_invitation_activation: boolean;
  allow_initial_super_admin: boolean;
  provider_protocol: "oidc" | "saml" | null;
  provider_display_name: string | null;
  provider_sign_in_url: string | null;
  provider_post_sign_out_url: string | null;
};

export type LoginAssessment = {
  email: string;
  has_users: boolean;
  user_exists: boolean;
  is_active: boolean | null;
  role: AuthRole | null;
  account_state:
    | "bootstrap_available"
    | "ready"
    | "invited"
    | "inactive_account"
    | "inactive_membership"
    | "not_found";
  allow_sign_in: boolean;
  next_action: "bootstrap" | "sign_in" | "activate_invitation" | "contact_admin";
  active_membership_count: number;
  invited_membership_count: number;
  suspended_membership_count: number;
  expired_invitation_count: number;
  expiring_invitation_count: number;
  memberships: DirectoryMembership[];
};

export type MembershipInvitationCredential = {
  membership_id: string;
  tenant_id: string;
  tenant_name: string;
  tenant_slug: string;
  membership_status: "active" | "invited" | "suspended";
  invitation_token: string;
  invited_at: string | null;
  invitation_expires_at: string | null;
  activated_at: string | null;
};

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  return await authenticatedApiRequest<T>(path, init);
}

export async function findDirectoryUserByEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) {
    return null;
  }

  const query = new URLSearchParams({ email: normalizedEmail }).toString();
  const users = await apiRequest<DirectoryUser[]>(`/users?${query}`);
  return users[0] ?? null;
}

export async function getDirectoryUserById(userId: string) {
  const normalizedUserId = userId.trim();
  if (!normalizedUserId) {
    return null;
  }

  return await apiRequest<DirectoryUser>(`/users/${normalizedUserId}`);
}

export async function getCurrentDirectoryUser() {
  return await apiRequest<DirectoryUser>("/users/me");
}

export async function getCurrentUserPermissions() {
  return await apiRequest<DirectoryPermissions>("/users/me/permissions");
}

export async function listCurrentUserAccessEvents(
  options?: {
    limit?: number;
    eventType?: DirectoryAccessEvent["event_type"];
    query?: string;
  }
) {
  const query = new URLSearchParams({ limit: String(options?.limit ?? 10) });
  if (options?.eventType) {
    query.set("event_type", options.eventType);
  }
  if (options?.query && options.query.trim().length > 0) {
    query.set("query", options.query.trim());
  }

  return await apiRequest<DirectoryAccessEvent[]>(`/users/me/access-events?${query.toString()}`);
}

export async function getCurrentUserAccessSummary() {
  return await apiRequest<DirectoryCurrentAccessSummary>("/users/me/access-summary");
}

export async function changeCurrentUserPassword(payload: {
  current_password: string;
  new_password: string;
}) {
  return await apiRequest<DirectoryUser>("/users/me/change-password", {
    method: "POST",
    body: JSON.stringify({
      current_password: payload.current_password,
      new_password: payload.new_password
    })
  });
}

export async function getUserAccessSummary(userId: string) {
  return await apiRequest<DirectoryCurrentAccessSummary>(`/users/${userId}/access-summary`);
}

export async function listUserAccessEvents(
  userId: string,
  options?: {
    limit?: number;
    eventType?: DirectoryAccessEvent["event_type"] | "all" | null;
    query?: string;
  }
) {
  const query = new URLSearchParams({ limit: String(options?.limit ?? 12) });
  if (options?.eventType && options.eventType !== "all") {
    query.set("event_type", options.eventType);
  }
  if (options?.query && options.query.trim().length > 0) {
    query.set("query", options.query.trim());
  }

  return await apiRequest<DirectoryAccessEvent[]>(`/users/${userId}/access-events?${query.toString()}`);
}

export async function listCurrentUserSessions() {
  return await apiRequest<DirectoryActiveSession[]>("/users/me/sessions");
}

export async function getCurrentUserSessionSecuritySummary() {
  return await apiRequest<DirectorySessionSecuritySummary>("/users/me/session-security");
}

export async function getUserAccessGovernanceSummary(filters?: {
  tenantId?: string | null;
  membershipStatus?: "active" | "invited" | "suspended" | "all" | null;
  isActive?: "active" | "inactive" | "all" | null;
  query?: string | null;
}) {
  const searchParams = new URLSearchParams();
  if (filters?.tenantId && filters.tenantId !== "all") {
    searchParams.set("tenant_id", filters.tenantId);
  }
  if (filters?.membershipStatus && filters.membershipStatus !== "all") {
    searchParams.set("membership_status", filters.membershipStatus);
  }
  if (filters?.isActive && filters.isActive !== "all") {
    searchParams.set("is_active", filters.isActive === "active" ? "true" : "false");
  }
  if (filters?.query && filters.query.trim().length > 0) {
    searchParams.set("query", filters.query.trim());
  }

  const queryString = searchParams.toString();
  return await apiRequest<DirectoryAccessGovernanceSummary>(
    queryString.length > 0 ? `/users/access-governance-summary?${queryString}` : "/users/access-governance-summary"
  );
}

export async function getUserSessionSecuritySummary(userId: string) {
  return await apiRequest<DirectorySessionSecuritySummary>(`/users/${userId}/session-security`);
}

export async function bootstrapDirectoryUser(payload: {
  display_name: string;
  email: string;
}) {
  return await apiRequest<DirectoryUser>("/users/bootstrap", {
    method: "POST",
    body: JSON.stringify({
      email: payload.email.trim().toLowerCase(),
      display_name: payload.display_name.trim()
    })
  });
}

export async function getDirectoryBootstrapStatus() {
  return await apiRequest<BootstrapStatus>("/users/bootstrap/status");
}

export async function getDirectoryAuthMode(returnTo?: string) {
  const query = new URLSearchParams();
  if (returnTo && returnTo.startsWith("/")) {
    query.set("return_to", returnTo);
  }

  const queryString = query.toString();
  return await apiRequest<DirectoryAuthMode>(
    queryString.length > 0 ? `/users/auth-mode?${queryString}` : "/users/auth-mode"
  );
}

export async function assessDirectoryLogin(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const query = new URLSearchParams({ email: normalizedEmail }).toString();
  return await apiRequest<LoginAssessment>(`/users/login-assessment?${query}`);
}

export async function loginDirectoryUser(payload: { email: string; display_name: string; password?: string }) {
  return await apiRequest<AuthenticatedDirectorySession>("/users/login", {
    method: "POST",
    body: JSON.stringify({
      email: payload.email.trim().toLowerCase(),
      display_name: payload.display_name.trim(),
      password: payload.password?.trim() || null,
    })
  });
}

export async function activateDirectoryUserInvitations(payload: { email: string; invitation_token: string; password?: string }) {
  return await apiRequest<AuthenticatedDirectorySession>("/users/activate-invitations", {
    method: "POST",
    body: JSON.stringify({
      email: payload.email.trim().toLowerCase(),
      invitation_token: payload.invitation_token.trim().toUpperCase(),
      password: payload.password?.trim() || null,
    })
  });
}

export async function revokeCurrentDirectorySession(reason?: string) {
  await apiRequest<void>("/users/me/sign-out", {
    method: "POST",
    body: JSON.stringify({ reason: reason ?? null })
  });
}

export async function revokeCurrentUserSession(sessionId: string, reason?: string) {
  await apiRequest<void>(`/users/me/sessions/${sessionId}`, {
    method: "DELETE",
    body: JSON.stringify({ reason: reason ?? null })
  });
}

export async function revokeOtherCurrentUserSessions(reason?: string) {
  return await apiRequest<DirectorySessionBulkRevocation>("/users/me/sessions/revoke-others", {
    method: "POST",
    body: JSON.stringify({ reason: reason ?? null })
  });
}

export async function revokeAllUserSessions(userId: string, reason?: string) {
  return await apiRequest<DirectorySessionBulkRevocation>(`/users/${userId}/sessions/revoke-all`, {
    method: "POST",
    body: JSON.stringify({ reason: reason ?? null })
  });
}

export async function issueDirectoryMembershipInvitation(userId: string, membershipId: string, reason?: string) {
  return await apiRequest<MembershipInvitationCredential>(`/users/${userId}/memberships/${membershipId}/invitation`, {
    method: "POST",
    body: JSON.stringify({ reason: reason ?? null })
  });
}

export async function updateDirectoryUser(
  userId: string,
  payload: {
    display_name: string;
    email: string;
    is_active?: boolean;
    role?: AuthRole;
  }
) {
  return await apiRequest<DirectoryUser>(`/users/${userId}`, {
    method: "PATCH",
    body: JSON.stringify({
      is_active: true,
      ...payload,
      email: payload.email.trim().toLowerCase(),
      display_name: payload.display_name.trim()
    })
  });
}

export async function resetDirectoryUserPassword(
  userId: string,
  payload: {
    new_password: string;
    reason?: string | null;
  }
) {
  return await apiRequest<DirectoryUser>(`/users/${userId}/reset-password`, {
    method: "POST",
    body: JSON.stringify({
      new_password: payload.new_password,
      reason: payload.reason ?? null
    })
  });
}
