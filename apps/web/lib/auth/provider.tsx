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
  AUTH_EXIT_REASON_KEY,
  clearStoredAuthSession,
  clearAuthExitReason,
  clearStoredAuthSessionWithReason,
  isStoredAuthSessionExpired,
  resolveAuthExitReasonFromErrorMessage,
  writeStoredAuthSession,
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
      if (isStoredAuthSessionExpired(parsedSession)) {
        setSession(parsedSession);
        return parsedSession;
      }

      if (!parsedSession.sessionToken || !parsedSession.sessionExpiresAt) {
        clearStoredAuthSessionWithReason("session_revoked");
        setSession(null);
        return null;
      }

      if (!parsedSession.userId) {
        clearAuthExitReason();
        clearStoredAuthSession();
        setSession(null);
        return null;
      }

      try {
        const directoryUser = await getCurrentDirectoryUser();
        if (!directoryUser || !directoryUser.is_active || !canUseDirectorySession(directoryUser.role, directoryUser.memberships)) {
          if (!directoryUser) {
            clearStoredAuthSessionWithReason("missing_directory_user");
          } else if (!directoryUser.is_active) {
            clearStoredAuthSessionWithReason("inactive_account");
          } else {
            clearStoredAuthSessionWithReason("inactive_membership");
          }
          setSession(null);
          return null;
        }

        let permissions = parsedSession.permissions ?? null;
        try {
          permissions = await getCurrentUserPermissions();
        } catch (error) {
          const permissionsMessage = error instanceof Error ? error.message : "";
          const permissionsExitReason = resolveAuthExitReasonFromErrorMessage(permissionsMessage);
          if (permissionsExitReason) {
            clearStoredAuthSessionWithReason(permissionsExitReason);
            setSession(null);
            return null;
          }
        }

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
        writeStoredAuthSession(nextSession);
        return nextSession;
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        const exitReason = resolveAuthExitReasonFromErrorMessage(message);
        if (exitReason) {
          clearStoredAuthSessionWithReason(exitReason);
          setSession(null);
          return null;
        }

        clearStoredAuthSessionWithReason("session_revoked");
        setSession(null);
        return null;
      }
    } catch {
      clearStoredAuthSession();
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

  useEffect(() => {
    if (!isReady) {
      return;
    }

    function handleStorageSync(event: StorageEvent) {
      if (event.key && event.key !== AUTH_STORAGE_KEY && event.key !== AUTH_EXIT_REASON_KEY) {
        return;
      }

      void refreshSession();
    }

    window.addEventListener("storage", handleStorageSync);
    return () => {
      window.removeEventListener("storage", handleStorageSync);
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
    writeStoredAuthSession(mergedSession);
  }, [session]);

  const signOut = useCallback((reason?: AuthExitReason) => {
    setSession(null);
    if (reason) {
      clearStoredAuthSessionWithReason(reason);
    } else {
      clearAuthExitReason();
      clearStoredAuthSession();
    }
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
