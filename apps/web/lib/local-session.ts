"use client";

import type { AuthRole } from "@/lib/auth/access";


export const AUTH_STORAGE_KEY = "ragpilot-auth-session";
export const AUTH_EXIT_REASON_KEY = "ragpilot-auth-exit-reason";

export type AuthExitReason =
  | "session_revoked"
  | "inactive_account"
  | "inactive_membership"
  | "missing_directory_user";


type StoredAuthSession = {
  userId?: string | null;
  role?: AuthRole | null;
  sessionToken?: string | null;
  sessionExpiresAt?: string | null;
};


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


export function buildSessionActorHeaders(headers?: HeadersInit): Record<string, string> {
  const mergedHeaders = new Headers(headers ?? {});
  const session = readStoredAuthSession();

  if (session?.sessionToken) {
    mergedHeaders.set("Authorization", `Bearer ${session.sessionToken}`);
  }
  if (session?.role) {
    mergedHeaders.set("X-RagPilot-Role", session.role);
  }
  if (session?.userId) {
    mergedHeaders.set("X-RagPilot-Actor-Id", session.userId);
  }

  const nextHeaders: Record<string, string> = {};
  mergedHeaders.forEach((value, key) => {
    nextHeaders[key] = value;
  });
  return nextHeaders;
}
