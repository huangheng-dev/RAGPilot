"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { KeyRound, LockKeyhole, MonitorSmartphone, RefreshCw, ShieldCheck, UserCircle2 } from "lucide-react";

import {
  ConsoleEmptyState,
  ConsoleOutlineBadge,
  ConsolePage,
  ConsoleSurface,
  ConsoleSurfaceHeader,
} from "@/components/console/ConsolePrimitives";
import { ConsoleShell } from "@/components/console/ConsoleShell";
import { PageTitleSync } from "@/components/console/PageTitleSync";
import {
  DialogFormActions,
  DialogFormField,
  DialogFormLayout,
  FormDialog
} from "@/components/ui/form-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  changeCurrentUserPassword,
  getDirectoryAuthMode,
  getCurrentUserAccessSummary,
  listCurrentUserSessions,
  revokeCurrentUserSession,
  type DirectoryActiveSession,
  type DirectoryCurrentAccessSummary,
  updateDirectoryUser,
} from "@/lib/auth-directory";
import { hasDirectoryCapability } from "@/lib/auth/access";
import { useAuth } from "@/lib/auth/provider";
import { useI18n } from "@/lib/i18n/provider";
import { useNotifications } from "@/lib/notifications/provider";

function normalizeAccessSummary(
  summary: DirectoryCurrentAccessSummary | null | undefined
): DirectoryCurrentAccessSummary | null {
  if (!summary) {
    return null;
  }

  return {
    ...summary,
    review_items: Array.isArray(summary.review_items) ? summary.review_items : [],
  };
}

function normalizeSessions(value: DirectoryActiveSession[] | null | undefined) {
  return Array.isArray(value) ? value : [];
}

export default function SettingsConsolePage() {
  const { session, signOut, refreshSession } = useAuth();
  const { language, t } = useI18n();
  const { error: notifyError, success: notifySuccess } = useNotifications();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saved">("idle");
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [currentAccessSummary, setCurrentAccessSummary] = useState<DirectoryCurrentAccessSummary | null>(null);
  const [activeSessions, setActiveSessions] = useState<DirectoryActiveSession[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [activeSessionsErrorMessage, setActiveSessionsErrorMessage] = useState<string | null>(null);
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [supportsPasswordInput, setSupportsPasswordInput] = useState(false);
  const [settingsSection, setSettingsSection] = useState<"profile" | "sessions" | "security">("profile");

  useEffect(() => {
    setDisplayName(session?.displayName ?? "");
    setEmail(session?.email ?? "");
    setSaveState("idle");
    setSaveErrorMessage(null);
  }, [session]);

  useEffect(() => {
    let isMounted = true;

    async function loadAuthMode() {
      try {
        const authMode = await getDirectoryAuthMode();
        if (isMounted) {
          setSupportsPasswordInput(Boolean(authMode?.supports_password_input));
        }
      } catch {
        if (isMounted) {
          setSupportsPasswordInput(false);
        }
      }
    }

    void loadAuthMode();

    return () => {
      isMounted = false;
    };
  }, []);

  const loadCurrentUserAccessSummary = useCallback(async () => {
    if (!session?.userId) {
      setCurrentAccessSummary(null);
      return;
    }

    try {
      const summary = await getCurrentUserAccessSummary();
      setCurrentAccessSummary(normalizeAccessSummary(summary));
    } catch {
      setCurrentAccessSummary(null);
    }
  }, [session?.userId]);

  const loadCurrentUserSessions = useCallback(async () => {
    if (!session?.userId) {
      setActiveSessions([]);
      setActiveSessionsErrorMessage(null);
      setIsLoadingSessions(false);
      return;
    }

    try {
      setIsLoadingSessions(true);
      setActiveSessionsErrorMessage(null);
      const sessions = await listCurrentUserSessions();
      setActiveSessions(normalizeSessions(sessions));
    } catch (error) {
      setActiveSessions([]);
      setActiveSessionsErrorMessage(error instanceof Error ? error.message : t("settings.status.activeSessionsFailed"));
    } finally {
      setIsLoadingSessions(false);
    }
  }, [session?.userId, t]);

  useEffect(() => {
    void loadCurrentUserAccessSummary();
    void loadCurrentUserSessions();
  }, [loadCurrentUserAccessSummary, loadCurrentUserSessions]);

  const hasAdminAccess = hasDirectoryCapability(session, "access_admin_console");
  const roleLabel =
    session?.role === "super_admin"
      ? t("auth.roles.superAdmin")
      : session?.role === "reviewer"
        ? t("auth.roles.reviewer")
        : t("auth.roles.operator");
  const canSaveProfile = displayName.trim().length > 0 && email.trim().length > 0;
  const canChangePassword =
    currentPassword.trim().length >= 8 &&
    newPassword.trim().length >= 8 &&
    confirmPassword.trim().length >= 8 &&
    !isChangingPassword;
  const sessionMemberships = Array.isArray(session?.memberships) ? session.memberships : [];

  const sessionSummary = useMemo(
    () => ({
      activeSessions: currentAccessSummary?.active_sessions ?? activeSessions.length,
      recentFailedSignIns: currentAccessSummary?.recent_failed_sign_in_events ?? 0,
      activeMemberships: currentAccessSummary?.active_memberships ?? sessionMemberships.length,
    }),
    [activeSessions.length, currentAccessSummary, sessionMemberships.length]
  );

  function resetPasswordDialogState() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setIsChangingPassword(false);
  }

  function formatTimestamp(value: string | null) {
    if (!value) {
      return t("settings.activity.notAvailable");
    }

    const timestamp = new Date(value);
    return timestamp.toLocaleString(language === "zh-CN" ? "zh-CN" : "en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  function formatSessionValue(value: string | null) {
    if (!value?.trim()) {
      return t("settings.activity.notAvailable");
    }

    return value;
  }

  function renderMembershipStatusLabel(status: "active" | "invited" | "suspended") {
    if (status === "active") {
      return t("admin.members.activeMembership");
    }
    if (status === "invited") {
      return t("admin.members.invitedMembership");
    }
    return t("admin.members.suspendedMembership");
  }

  function renderLoginModeLabel(value: string) {
    if (value === "bootstrap") {
      return t("settings.activity.loginModeBootstrap");
    }
    if (value === "invitation_activation") {
      return t("settings.activity.loginModeInvitationActivation");
    }
    return t("settings.activity.loginModeDirectory");
  }

  async function handleSaveProfile() {
    if (!canSaveProfile || !session?.userId) {
      notifyError(t("settings.status.profileSaveUnavailable"));
      return;
    }

    try {
      setIsSavingProfile(true);
      setSaveErrorMessage(null);
      await updateDirectoryUser(session.userId, {
        display_name: displayName.trim(),
        email: email.trim().toLowerCase(),
      });
      await refreshSession();
      setSaveState("saved");
    } catch (error) {
      setSaveState("idle");
      setSaveErrorMessage(error instanceof Error ? error.message : t("settings.status.profileSaveFailed"));
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function handleChangePassword() {
    if (!session?.userId) {
      notifyError(t("settings.status.passwordChangeUnavailable"));
      return;
    }

    if (newPassword.trim() !== confirmPassword.trim()) {
      notifyError(t("settings.status.passwordConfirmationMismatch"));
      return;
    }

    try {
      setIsChangingPassword(true);
      await changeCurrentUserPassword({
        current_password: currentPassword.trim(),
        new_password: newPassword.trim(),
      });
      await refreshSession();
      await loadCurrentUserAccessSummary();
      await loadCurrentUserSessions();
      setIsPasswordDialogOpen(false);
      resetPasswordDialogState();
      notifySuccess(t("settings.status.passwordChanged"));
    } catch (error) {
      notifyError(error instanceof Error ? error.message : t("settings.status.passwordChangeFailed"));
      setIsChangingPassword(false);
    }
  }

  async function handleRevokeTrackedSession(targetSession: DirectoryActiveSession) {
    try {
      setRevokingSessionId(targetSession.id);
      setActiveSessionsErrorMessage(null);
      await revokeCurrentUserSession(
        targetSession.id,
        targetSession.is_current
          ? t("settings.activity.currentSessionRevokeReason")
          : t("settings.activity.otherSessionRevokeReason")
      );
      await loadCurrentUserSessions();
      await loadCurrentUserAccessSummary();
      if (targetSession.is_current) {
        signOut("session_revoked");
      }
    } catch (error) {
      setActiveSessionsErrorMessage(error instanceof Error ? error.message : t("settings.status.activeSessionsFailed"));
    } finally {
      setRevokingSessionId(null);
    }
  }

  return (
    <ConsoleShell activeHref="/settings">
      <PageTitleSync title={t("settings.title")} />
      <ConsolePage className="gap-5">
        <div className="grid h-[calc(100dvh-128px)] min-h-0 overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-[0_18px_52px_rgba(15,23,42,0.06)] xl:grid-cols-[292px_minmax(0,1fr)]">
          <aside className="min-h-0 overflow-y-auto border-b border-slate-200 bg-slate-50/70 xl:border-b-0 xl:border-r dark:border-slate-800 dark:bg-slate-950/70">
            <div className="p-4 text-lg font-semibold text-slate-950 dark:text-slate-50">{t("settings.title")}</div>
            <div className="space-y-1 border-t border-slate-200 p-4">
              {(["profile", "sessions", "security"] as const).map((section) => (
                <button className={`w-full rounded-xl px-3 py-2.5 text-left text-sm ${settingsSection === section ? "bg-blue-50 font-medium text-blue-700" : "text-slate-600 hover:bg-white"}`} key={section} onClick={() => setSettingsSection(section)} type="button">
                  {t(`settings.navigation.${section}`)}
                </button>
              ))}
            </div>
          </aside>
          <div className="min-h-0 overflow-y-auto p-5">
          {settingsSection === "profile" ? (
          <ConsoleSurface>
            <ConsoleSurfaceHeader title={t("settings.sections.sessionTitle")} />
            <div className="space-y-5 p-6">
              <div className="flex items-center gap-4 rounded-[18px] border border-slate-100 bg-slate-50/80 p-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <UserCircle2 className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-base font-semibold text-slate-950">
                    {session?.displayName ?? t("settings.fields.noActiveSession")}
                  </div>
                  <div className="truncate text-sm text-slate-500">
                    {session?.email ?? t("settings.activity.notAvailable")}
                  </div>
                </div>
                <ConsoleOutlineBadge
                  className={hasAdminAccess ? "border-emerald-200 bg-emerald-50 text-emerald-700" : undefined}
                >
                  {roleLabel}
                </ConsoleOutlineBadge>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
                    {t("settings.fields.name")}
                  </div>
                  <Input
                    className="bg-white"
                    onChange={(event) => {
                      setDisplayName(event.target.value);
                      setSaveState("idle");
                    }}
                    value={displayName}
                  />
                </div>
                <div className="space-y-2">
                  <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
                    {t("settings.fields.email")}
                  </div>
                  <Input
                    className="bg-white"
                    onChange={(event) => {
                      setEmail(event.target.value);
                      setSaveState("idle");
                    }}
                    type="email"
                    value={email}
                  />
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-[18px] border border-slate-100 bg-slate-50/80 p-4">
                  <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
                    {t("settings.posture.recentFailedSignIns")}
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-slate-950">
                    {sessionSummary.recentFailedSignIns}
                  </div>
                </div>
                <div className="rounded-[18px] border border-slate-100 bg-slate-50/80 p-4">
                  <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
                    {t("settings.fields.membershipAccess")}
                  </div>
                  <div className="mt-2 text-sm font-medium text-slate-950">
                    {currentAccessSummary?.membership_access_state === "ready"
                      ? t("settings.fields.membershipAccessReady")
                      : currentAccessSummary?.membership_access_state === "blocked"
                        ? t("settings.fields.membershipAccessBlocked")
                        : currentAccessSummary?.membership_access_state === "bootstrap"
                          ? t("settings.fields.membershipAccessBootstrap")
                          : t("settings.activity.notAvailable")}
                  </div>
                </div>
              </div>

              {sessionMemberships.length > 0 ? (
                <div className="space-y-3">
                  <div className="text-sm font-semibold text-slate-950">{t("settings.fields.memberships")}</div>
                  <div className="grid gap-3">
                    {sessionMemberships.map((membership) => (
                      <div
                        className="flex items-start justify-between gap-3 rounded-[18px] border border-slate-100 bg-slate-50/80 p-4"
                        key={membership.id}
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-slate-950">{membership.tenant_name}</div>
                          <div className="mt-1 truncate text-xs text-slate-500">{membership.tenant_slug}</div>
                        </div>
                        <Badge className="border-slate-200 bg-white text-slate-700" variant="outline">
                          {renderMembershipStatusLabel(membership.membership_status)}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="flex flex-wrap items-center gap-3">
                <Button disabled={!canSaveProfile || isSavingProfile} onClick={() => void handleSaveProfile()} type="button">
                  {isSavingProfile ? t("settings.actions.savingProfile") : t("settings.actions.saveProfile")}
                </Button>
              </div>

              {saveState === "saved" ? <div className="text-sm text-emerald-600">{t("settings.status.profileSaved")}</div> : null}
              {saveErrorMessage ? <div className="text-sm text-rose-600">{saveErrorMessage}</div> : null}
            </div>
          </ConsoleSurface>
          ) : null}

          {settingsSection === "sessions" ? (
          <ConsoleSurface>
            <ConsoleSurfaceHeader
              action={
                <Button
                  className="bg-white"
                  disabled={!session?.userId || isLoadingSessions}
                  onClick={() => void loadCurrentUserSessions()}
                  type="button"
                  variant="outline"
                >
                  <RefreshCw className={isLoadingSessions ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
                  {isLoadingSessions ? t("settings.actions.refreshingSessions") : t("settings.actions.refreshSessions")}
                </Button>
              }
              title={t("settings.sessions.title")}
            />
            <div className="space-y-4 p-6">
              {activeSessionsErrorMessage ? (
                <div className="rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
                  {activeSessionsErrorMessage}
                </div>
              ) : null}

              {activeSessions.length === 0 && !isLoadingSessions ? (
                <ConsoleEmptyState>
                  {t("settings.sessions.empty")}
                </ConsoleEmptyState>
              ) : (
                activeSessions.map((trackedSession) => (
                  <div className="rounded-[18px] border border-slate-100 bg-slate-50/80 p-4" key={trackedSession.id}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge
                            className={
                              trackedSession.is_current
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-slate-200 bg-white text-slate-700"
                            }
                            variant="outline"
                          >
                            {trackedSession.is_current ? t("settings.sessions.current") : t("settings.sessions.other")}
                          </Badge>
                          <Badge className="border-slate-200 bg-white text-slate-700" variant="outline">
                            {renderLoginModeLabel(trackedSession.authentication_mode)}
                          </Badge>
                        </div>
                        <div className="grid gap-1 text-sm text-slate-600">
                          <div>{t("settings.sessions.startedAt")}: {formatTimestamp(trackedSession.created_at)}</div>
                          <div>{t("settings.sessions.expiresAt")}: {formatTimestamp(trackedSession.expires_at)}</div>
                          <div>{t("settings.sessions.deviceLabel")}: {formatSessionValue(trackedSession.device_label)}</div>
                          <div>{t("settings.sessions.ipAddress")}: {formatSessionValue(trackedSession.ip_address)}</div>
                        </div>
                      </div>
                      <Button
                        className="bg-white"
                        disabled={trackedSession.is_current || revokingSessionId === trackedSession.id}
                        onClick={() => void handleRevokeTrackedSession(trackedSession)}
                        type="button"
                        variant="outline"
                      >
                        {revokingSessionId === trackedSession.id
                          ? t("settings.actions.revokingSession")
                          : t("settings.actions.revokeSession")}
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ConsoleSurface>
          ) : null}
          {settingsSection === "security" ? (
            <ConsoleSurface>
              <ConsoleSurfaceHeader
                description={t("settings.security.description")}
                title={t("settings.security.title")}
              />
              <div className="space-y-5 p-6 text-sm text-slate-600">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-[18px] border border-emerald-100 bg-emerald-50/70 p-4">
                    <ShieldCheck className="h-5 w-5 text-emerald-600" />
                    <div className="mt-3 text-xs font-medium uppercase tracking-[0.14em] text-emerald-700">
                      {t("settings.security.accountStatus")}
                    </div>
                    <div className="mt-1 text-base font-semibold text-slate-950">
                      {session ? t("settings.security.verified") : t("settings.security.signedOut")}
                    </div>
                  </div>
                  <div className="rounded-[18px] border border-slate-100 bg-slate-50/80 p-4">
                    <MonitorSmartphone className="h-5 w-5 text-blue-600" />
                    <div className="mt-3 text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
                      {t("settings.security.activeSessions")}
                    </div>
                    <div className="mt-1 text-2xl font-semibold text-slate-950">{sessionSummary.activeSessions}</div>
                  </div>
                  <div className="rounded-[18px] border border-slate-100 bg-slate-50/80 p-4">
                    <LockKeyhole className="h-5 w-5 text-amber-600" />
                    <div className="mt-3 text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
                      {t("settings.security.recentFailedSignIns")}
                    </div>
                    <div className="mt-1 text-2xl font-semibold text-slate-950">{sessionSummary.recentFailedSignIns}</div>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-[18px] border border-slate-200 p-5">
                    <div className="flex items-center gap-3">
                      <KeyRound className="h-5 w-5 text-slate-700" />
                      <div className="font-semibold text-slate-950">{t("settings.security.credentials")}</div>
                    </div>
                    <div className="mt-3 leading-6 text-slate-500">
                      {supportsPasswordInput
                        ? t("settings.security.passwordManaged")
                        : t("settings.security.externallyManaged")}
                    </div>
                    {supportsPasswordInput ? (
                      <Button className="mt-4" onClick={() => setIsPasswordDialogOpen(true)} type="button">
                        {t("settings.actions.changePassword")}
                      </Button>
                    ) : null}
                  </div>
                  <div className="rounded-[18px] border border-slate-200 p-5">
                    <div className="font-semibold text-slate-950">{t("settings.security.currentSignIn")}</div>
                    <div className="mt-4 grid gap-3">
                      <div className="flex items-center justify-between gap-4"><span>{t("settings.security.role")}</span><Badge variant="outline">{roleLabel}</Badge></div>
                      <div className="flex items-center justify-between gap-4"><span>{t("settings.security.lastSignedIn")}</span><span className="text-right font-medium text-slate-800">{formatTimestamp(session?.lastSignedInAt ?? null)}</span></div>
                      <div className="flex items-center justify-between gap-4"><span>{t("settings.security.sessionExpires")}</span><span className="text-right font-medium text-slate-800">{formatTimestamp(session?.sessionExpiresAt ?? null)}</span></div>
                    </div>
                    <Button className="mt-4 bg-white" onClick={() => setSettingsSection("sessions")} type="button" variant="outline">
                      {t("settings.security.manageSessions")}
                    </Button>
                  </div>
                </div>
              </div>
            </ConsoleSurface>
          ) : null}
          </div>
        </div>
      </ConsolePage>

      <FormDialog
        description={t("settings.passwordDialog.description")}
        footer={
          <DialogFormActions>
            <Button
              className="bg-white"
              disabled={isChangingPassword}
              onClick={() => {
                setIsPasswordDialogOpen(false);
                resetPasswordDialogState();
              }}
              type="button"
              variant="outline"
            >
              {t("settings.passwordDialog.cancel")}
            </Button>
            <Button disabled={!canChangePassword} onClick={() => void handleChangePassword()} type="button">
              {isChangingPassword ? t("settings.passwordDialog.saving") : t("settings.passwordDialog.submit")}
            </Button>
          </DialogFormActions>
        }
        onClose={() => {
          setIsPasswordDialogOpen(false);
          resetPasswordDialogState();
        }}
        open={isPasswordDialogOpen}
        size="md"
        title={t("settings.passwordDialog.title")}
      >
        <DialogFormLayout className="space-y-4">
          <DialogFormField label={t("settings.passwordDialog.currentPassword")}>
            <Input
              className="bg-white"
              onChange={(event) => setCurrentPassword(event.target.value)}
              placeholder={t("settings.passwordDialog.currentPasswordPlaceholder")}
              type="password"
              value={currentPassword}
            />
          </DialogFormField>
          <DialogFormField label={t("settings.passwordDialog.newPassword")}>
            <Input
              className="bg-white"
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder={t("settings.passwordDialog.newPasswordPlaceholder")}
              type="password"
              value={newPassword}
            />
          </DialogFormField>
          <DialogFormField label={t("settings.passwordDialog.confirmPassword")}>
            <Input
              className="bg-white"
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder={t("settings.passwordDialog.confirmPasswordPlaceholder")}
              type="password"
              value={confirmPassword}
            />
          </DialogFormField>
        </DialogFormLayout>
      </FormDialog>
    </ConsoleShell>
  );
}
