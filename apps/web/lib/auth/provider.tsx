"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { canUseDirectorySession, type AuthRole } from "@/lib/auth/access";
import {
  getCurrentDirectoryUser,
  getCurrentUserPermissions,
  type DirectoryMembership,
  type DirectoryPermissions
} from "@/lib/auth-directory";
import {
  AUTH_STORAGE_KEY,
  clearAuthExitReason,
  setAuthExitReason,
  type AuthExitReason
} from "@/lib/local-session";

export type AuthSession = {
  userId?: string | null;
  displayName: string;
  email: string;
  role: AuthRole;
  sessionToken?: string | null;
  sessionExpiresAt?: string | null;
  lastSignedInAt?: string | null;
  memberships?: DirectoryMembership[];
  permissions?: DirectoryPermissions | null;
};

type AuthContextValue = {
  isReady: boolean;
  session: AuthSession | null;
  signIn: (session: AuthSession) => void;
  signOut: (reason?: AuthExitReason) => void;
  refreshSession: () => Promise<AuthSession | null>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [isReady, setIsReady] = useState(false);
  const [session, setSession] = useState<AuthSession | null>(null);

  const refreshSession = useCallback(async () => {
    const storedSession = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!storedSession) {
      setSession(null);
      return null;
    }

    try {
      const parsedSession = JSON.parse(storedSession) as AuthSession;
      if (!parsedSession.userId) {
        setSession(parsedSession);
        return parsedSession;
      }

      try {
        const directoryUser = await getCurrentDirectoryUser();
        if (!directoryUser || !directoryUser.is_active || !canUseDirectorySession(directoryUser.role, directoryUser.memberships)) {
          window.localStorage.removeItem(AUTH_STORAGE_KEY);
          if (!directoryUser) {
            setAuthExitReason("missing_directory_user");
          } else if (!directoryUser.is_active) {
            setAuthExitReason("inactive_account");
          } else {
            setAuthExitReason("inactive_membership");
          }
          setSession(null);
          return null;
        }

        const permissions = await getCurrentUserPermissions();
        const nextSession = {
          ...parsedSession,
          userId: directoryUser.id,
          displayName: directoryUser.display_name,
          email: directoryUser.email,
          role: directoryUser.role,
          sessionToken: parsedSession.sessionToken ?? null,
          sessionExpiresAt: parsedSession.sessionExpiresAt ?? null,
          lastSignedInAt: directoryUser.last_signed_in_at,
          memberships: directoryUser.memberships,
          permissions,
        } satisfies AuthSession;
        setSession(nextSession);
        window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextSession));
        return nextSession;
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        const normalizedMessage = message.toLowerCase();
        if (
          normalizedMessage.includes("user not found") ||
          normalizedMessage.includes("missing actor") ||
          normalizedMessage.includes("not allowed") ||
          normalizedMessage.includes("session is invalid or expired") ||
          normalizedMessage.includes("unsupported authorization scheme") ||
          normalizedMessage.includes("missing bearer session token") ||
          normalizedMessage.includes("session account is inactive") ||
          normalizedMessage.includes("session membership access is inactive")
        ) {
          window.localStorage.removeItem(AUTH_STORAGE_KEY);
          setAuthExitReason(
            normalizedMessage.includes("session account is inactive")
              ? "inactive_account"
              : normalizedMessage.includes("session membership access is inactive") ||
                  normalizedMessage.includes("not allowed")
                ? "inactive_membership"
                : normalizedMessage.includes("session")
                  ? "session_revoked"
                  : "missing_directory_user"
          );
          setSession(null);
          return null;
        }

        setSession(parsedSession);
        return parsedSession;
      }
    } catch {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
      setSession(null);
      return null;
    }
  }, []);

  useEffect(() => {
    let isCancelled = false;

    async function restoreSession() {
      await refreshSession();
      if (!isCancelled) {
        setIsReady(true);
      }
    }

    void restoreSession();

    return () => {
      isCancelled = true;
    };
  }, [refreshSession]);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    function handleVisibilityRefresh() {
      if (document.visibilityState === "visible") {
        void refreshSession();
      }
    }

    window.addEventListener("focus", handleVisibilityRefresh);
    document.addEventListener("visibilitychange", handleVisibilityRefresh);

    return () => {
      window.removeEventListener("focus", handleVisibilityRefresh);
      document.removeEventListener("visibilitychange", handleVisibilityRefresh);
    };
  }, [isReady, refreshSession]);

  const signIn = useCallback((nextSession: AuthSession) => {
    const mergedSession = {
      ...session,
      ...nextSession,
      sessionToken: nextSession.sessionToken ?? session?.sessionToken ?? null,
      sessionExpiresAt: nextSession.sessionExpiresAt ?? session?.sessionExpiresAt ?? null,
    } satisfies AuthSession;
    setSession(mergedSession);
    clearAuthExitReason();
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(mergedSession));
  }, [session]);

  const signOut = useCallback((reason?: AuthExitReason) => {
    setSession(null);
    if (reason) {
      setAuthExitReason(reason);
    } else {
      clearAuthExitReason();
    }
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
  }, []);

  const value = useMemo(
    () => ({
      isReady,
      session,
      signIn,
      signOut,
      refreshSession
    }),
    [isReady, refreshSession, session, signIn, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const contextValue = useContext(AuthContext);
  if (!contextValue) {
    throw new Error("useAuth must be used within an AuthProvider.");
  }

  return contextValue;
}
