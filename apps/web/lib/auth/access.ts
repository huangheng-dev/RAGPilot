import type { DirectoryMembership } from "@/lib/auth-directory";
import type { DirectoryCapabilityKey, DirectoryPermissions } from "@/lib/auth-directory";

export const AUTH_ROLES = ["super_admin", "operator", "reviewer"] as const;

export type AuthRole = (typeof AUTH_ROLES)[number];
export type MembershipAccessState = "bootstrap" | "ready" | "blocked";

export function canAccessAdminConsole(role: AuthRole) {
  return role === "super_admin" || role === "reviewer";
}

export function canManageAdminResources(role: AuthRole) {
  return role === "super_admin";
}

export function canManageAgentStudio(role: AuthRole) {
  return role === "super_admin" || role === "operator";
}

export function canRetryWorkflowRuns(role: AuthRole) {
  return role === "super_admin" || role === "operator";
}

export function canManageLocalSessionRole(role: AuthRole) {
  return role === "super_admin";
}

export function canAccessWorkspace(role: AuthRole) {
  return AUTH_ROLES.includes(role);
}

export function getMembershipAccessState(memberships?: DirectoryMembership[] | null): MembershipAccessState {
  if (!memberships || memberships.length === 0) {
    return "bootstrap";
  }

  return memberships.some((membership) => membership.membership_status === "active") ? "ready" : "blocked";
}

export function canUseDirectorySession(role: AuthRole, memberships?: DirectoryMembership[] | null) {
  const accessState = getMembershipAccessState(memberships);
  if (accessState === "ready") {
    return true;
  }

  if (accessState === "bootstrap") {
    return role === "super_admin";
  }

  return false;
}

type CapabilitySession = {
  role: AuthRole;
  memberships?: DirectoryMembership[] | null;
  permissions?: DirectoryPermissions | null;
};

function resolveLocalCapabilityFallback(session: CapabilitySession, capability: DirectoryCapabilityKey) {
  if (!canUseDirectorySession(session.role, session.memberships)) {
    return false;
  }

  if (capability === "access_admin_console") {
    return canAccessAdminConsole(session.role);
  }

  if (
    capability === "manage_admin_resources" ||
    capability === "manage_members" ||
    capability === "manage_runtime_governance" ||
    capability === "view_audit_events" ||
    capability === "manage_local_session_role"
  ) {
    return canManageAdminResources(session.role);
  }

  if (
    capability === "manage_agent_definitions" ||
    capability === "execute_agents"
  ) {
    return canManageAgentStudio(session.role);
  }

  if (
    capability === "manage_documents" ||
    capability === "send_chat_messages" ||
    capability === "retry_workflow_runs"
  ) {
    return canRetryWorkflowRuns(session.role);
  }

  return true;
}

export function hasDirectoryCapability(
  session: CapabilitySession | null | undefined,
  capability: DirectoryCapabilityKey
) {
  if (!session) {
    return false;
  }

  if (session.permissions) {
    return session.permissions.capabilities[capability] === true;
  }

  return resolveLocalCapabilityFallback(session, capability);
}
