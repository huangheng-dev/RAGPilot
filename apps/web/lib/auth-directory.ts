"use client";

import { readApiErrorMessage } from "@/lib/api-errors";
import type { AuthRole } from "@/lib/auth/access";
import { buildSessionActorHeaders } from "@/lib/local-session";

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

export type AuthenticatedDirectorySession = {
  user: DirectoryUser;
  session: DirectorySession;
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
    | "sign_in_succeeded"
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

function buildApiBaseUrl() {
  const configuredBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  const fallbackBaseUrl = "http://127.0.0.1:18000";
  const baseUrl = configuredBaseUrl && configuredBaseUrl.length > 0 ? configuredBaseUrl : fallbackBaseUrl;
  return baseUrl.endsWith("/api/v1") ? baseUrl : `${baseUrl}/api/v1`;
}

const apiBaseUrl = buildApiBaseUrl();

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...buildSessionActorHeaders(init?.headers)
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response));
  }

  return (await response.json()) as T;
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
  limit = 10,
  eventType?: DirectoryAccessEvent["event_type"]
) {
  const query = new URLSearchParams({ limit: String(limit) });
  if (eventType) {
    query.set("event_type", eventType);
  }

  return await apiRequest<DirectoryAccessEvent[]>(`/users/me/access-events?${query.toString()}`);
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

export async function assessDirectoryLogin(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const query = new URLSearchParams({ email: normalizedEmail }).toString();
  return await apiRequest<LoginAssessment>(`/users/login-assessment?${query}`);
}

export async function loginDirectoryUser(payload: { email: string; display_name: string }) {
  return await apiRequest<AuthenticatedDirectorySession>("/users/login", {
    method: "POST",
    body: JSON.stringify({
      email: payload.email.trim().toLowerCase(),
      display_name: payload.display_name.trim()
    })
  });
}

export async function activateDirectoryUserInvitations(payload: { email: string; invitation_token: string }) {
  return await apiRequest<AuthenticatedDirectorySession>("/users/activate-invitations", {
    method: "POST",
    body: JSON.stringify({
      email: payload.email.trim().toLowerCase(),
      invitation_token: payload.invitation_token.trim().toUpperCase()
    })
  });
}

export async function revokeCurrentDirectorySession() {
  await apiRequest<void>("/users/me/sign-out", {
    method: "POST"
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
