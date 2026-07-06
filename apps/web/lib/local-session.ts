"use client";

import type { AuthRole } from "@/lib/auth/access";


export const AUTH_STORAGE_KEY = "ragpilot-auth-session";
export const AUTH_EXIT_REASON_KEY = "ragpilot-auth-exit-reason";

export type AuthExitReason =
  | "session_revoked"
  | "inactive_account"
  | "inactive_membership"
  | "missing_directory_user";

const AUTH_EXIT_MESSAGE_PATTERNS: Array<{
  pattern: string;
  reason: AuthExitReason;
}> = [
  { pattern: "session account is inactive", reason: "inactive_account" },
  { pattern: "session membership access is inactive", reason: "inactive_membership" },
  { pattern: "not allowed", reason: "inactive_membership" },
  { pattern: "session is invalid or expired", reason: "session_revoked" },
  { pattern: "missing bearer session token", reason: "session_revoked" },
  { pattern: "unsupported authorization scheme", reason: "session_revoked" },
  { pattern: "legacy actor headers are disabled", reason: "session_revoked" },
  { pattern: "user not found", reason: "missing_directory_user" },
  { pattern: "missing actor", reason: "missing_directory_user" },
];


type StoredAuthSession = {
  userId?: string | null;
  role?: AuthRole | null;
  sessionToken?: string | null;
  sessionExpiresAt?: string | null;
};

export type { StoredAuthSession };


export function readStoredAuthSession(): StoredAuthSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  const storedSession = window.localStorage.getItem(AUTH_STORAGE_KEY);
  if (!storedSession) {
    return null;
  }

  try {
    return JSON.parse(storedSession) as StoredAuthSession;
  } catch {
    return null;
  }
}

export function writeStoredAuthSession(session: StoredAuthSession) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

export function clearStoredAuthSession() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(AUTH_STORAGE_KEY);
}

export function clearStoredAuthSessionWithReason(reason: AuthExitReason) {
  clearStoredAuthSession();
  setAuthExitReason(reason);
}

export function isStoredAuthSessionExpired(session: StoredAuthSession | null) {
  if (!session?.sessionToken || !session.sessionExpiresAt) {
    return false;
  }

  const expiresAtTimestamp = new Date(session.sessionExpiresAt).getTime();
  if (!Number.isFinite(expiresAtTimestamp)) {
    return false;
  }

  return expiresAtTimestamp <= Date.now();
}

export function setAuthExitReason(reason: AuthExitReason) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(AUTH_EXIT_REASON_KEY, reason);
}

export function clearAuthExitReason() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(AUTH_EXIT_REASON_KEY);
}

export function consumeAuthExitReason(): AuthExitReason | null {
  if (typeof window === "undefined") {
    return null;
  }

  const reason = window.localStorage.getItem(AUTH_EXIT_REASON_KEY) as AuthExitReason | null;
  if (!reason) {
    return null;
  }

  window.localStorage.removeItem(AUTH_EXIT_REASON_KEY);
  return reason;
}

export function resolveAuthExitReasonFromErrorMessage(errorMessage: string | null | undefined): AuthExitReason | null {
  const normalizedMessage = errorMessage?.trim().toLowerCase();
  if (!normalizedMessage) {
    return null;
  }

  for (const entry of AUTH_EXIT_MESSAGE_PATTERNS) {
    if (normalizedMessage.includes(entry.pattern)) {
      return entry.reason;
    }
  }

  return null;
}


export function buildSessionAuthHeaders(headers?: HeadersInit): Record<string, string> {
  const mergedHeaders = new Headers(headers ?? {});
  const session = readStoredAuthSession();

  if (isStoredAuthSessionExpired(session)) {
    clearStoredAuthSessionWithReason("session_revoked");
  } else if (session?.sessionToken) {
    mergedHeaders.set("Authorization", `Bearer ${session.sessionToken}`);
  }

  const nextHeaders: Record<string, string> = {};
  mergedHeaders.forEach((value, key) => {
    nextHeaders[key] = value;
  });
  return nextHeaders;
}
