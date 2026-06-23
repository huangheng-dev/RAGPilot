"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Clock3,
  Github,
  LayoutDashboard,
  MessageSquareText,
  Moon,
  RefreshCw,
  Settings,
  ShieldCheck,
  SunMedium,
  UserCircle2
} from "lucide-react";

import { ConsoleOutlineBadge, ConsolePageHeader, ConsoleSurface, ConsoleSurfaceHeader } from "@/components/console/ConsolePrimitives";
import { ConsoleShell } from "@/components/console/ConsoleShell";
import { PageTitleSync } from "@/components/console/PageTitleSync";
import { PlatformGovernanceSection } from "@/components/settings/PlatformGovernanceSection";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  listCurrentUserAccessEvents,
  revokeCurrentDirectorySession,
  type DirectoryAccessEvent,
  updateDirectoryUser
} from "@/lib/auth-directory";
import { getMembershipAccessState, hasDirectoryCapability } from "@/lib/auth/access";
import { useAuth } from "@/lib/auth/provider";
import { useI18n } from "@/lib/i18n/provider";
import { usePreferences } from "@/lib/preferences/provider";
import { useRuntimeHealth } from "@/lib/runtime-health";

const repositoryUrl = process.env.NEXT_PUBLIC_GIT_REPOSITORY_URL?.trim() || null;
const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || "http://127.0.0.1:18000/api/v1";

function buildEventBadgeClassName(eventType: DirectoryAccessEvent["event_type"]) {
  if (eventType === "sign_in_succeeded" || eventType === "invitation_activated" || eventType === "membership_active") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (eventType === "invitation_revoked" || eventType === "membership_suspended" || eventType === "membership_deleted") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  return "border-amber-200 bg-amber-50 text-amber-700";
}

function buildRuntimeReadinessClassName(isReady: boolean) {
  return isReady
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-amber-200 bg-amber-50 text-amber-800";
}

export default function SettingsConsolePage() {
  const { session, signIn, signOut, refreshSession } = useAuth();
  const { language, setLanguage, t } = useI18n();
  const { themeMode, setThemeMode } = usePreferences();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saved">("idle");
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [accessEvents, setAccessEvents] = useState<DirectoryAccessEvent[]>([]);
  const [isLoadingAccessEvents, setIsLoadingAccessEvents] = useState(false);
  const [accessEventsErrorMessage, setAccessEventsErrorMessage] = useState<string | null>(null);
  const [isRefreshingSession, setIsRefreshingSession] = useState(false);
  const { runtimeHealth, runtimeHealthErrorMessage } = useRuntimeHealth();

  useEffect(() => {
    setDisplayName(session?.displayName ?? "");
    setEmail(session?.email ?? "");
    setSaveState("idle");
    setSaveErrorMessage(null);
  }, [session]);

  const loadCurrentUserAccessEvents = useCallback(async () => {
    if (!session?.userId) {
      setAccessEvents([]);
      setAccessEventsErrorMessage(null);
      setIsLoadingAccessEvents(false);
      return;
    }

    try {
      setIsLoadingAccessEvents(true);
      setAccessEventsErrorMessage(null);
      const events = await listCurrentUserAccessEvents(12);
      setAccessEvents(events);
    } catch (error) {
      setAccessEventsErrorMessage(error instanceof Error ? error.message : t("settings.status.accessEventsFailed"));
    } finally {
      setIsLoadingAccessEvents(false);
    }
  }, [session?.userId, t]);

  useEffect(() => {
    void loadCurrentUserAccessEvents();
  }, [loadCurrentUserAccessEvents]);

  const hasAdminAccess = hasDirectoryCapability(session, "access_admin_console");
  const canManageGovernance = hasDirectoryCapability(session, "manage_runtime_governance");
  const roleLabel =
    session?.role === "super_admin"
      ? t("auth.roles.superAdmin")
      : session?.role === "reviewer"
        ? t("auth.roles.reviewer")
        : t("auth.roles.operator");
  const canSaveProfile = displayName.trim().length > 0 && email.trim().length > 0;
  const isDarkMode = themeMode === "dark";
  const sessionMemberships = session?.memberships ?? [];
  const membershipAccessState = getMembershipAccessState(sessionMemberships);
  const latestAccessEvent = accessEvents[0] ?? null;
  const loginEvents = useMemo(
    () => accessEvents.filter((event) => event.event_type === "sign_in_succeeded"),
    [accessEvents]
  );
  const expiredMembershipInvitations = useMemo(
    () =>
      sessionMemberships.filter(
        (membership) =>
          membership.membership_status === "invited" &&
          membership.invitation_expires_at &&
          new Date(membership.invitation_expires_at).getTime() < Date.now()
      ).length,
    [sessionMemberships]
  );
  const expiringMembershipInvitations = useMemo(
    () =>
      sessionMemberships.filter((membership) => {
        if (membership.membership_status !== "invited" || !membership.invitation_expires_at) {
          return false;
        }

        const expiresAt = new Date(membership.invitation_expires_at).getTime();
        const now = Date.now();
        return expiresAt >= now && expiresAt - now <= 1000 * 60 * 60 * 24 * 3;
      }).length,
    [sessionMemberships]
  );

  function renderMembershipStatusLabel(status: "active" | "invited" | "suspended") {
    if (status === "active") {
      return t("admin.members.activeMembership");
    }

    if (status === "invited") {
      return t("admin.members.invitedMembership");
    }

    return t("admin.members.suspendedMembership");
  }

  function renderEventTypeLabel(eventType: DirectoryAccessEvent["event_type"]) {
    if (eventType === "sign_in_succeeded") {
      return t("settings.eventTypes.signInSucceeded");
    }

    if (eventType === "invitation_issued") {
      return t("settings.eventTypes.invitationIssued");
    }

    if (eventType === "invitation_activated") {
      return t("settings.eventTypes.invitationActivated");
    }

    if (eventType === "invitation_revoked") {
      return t("settings.eventTypes.invitationRevoked");
    }

    if (eventType === "membership_active") {
      return t("settings.eventTypes.membershipActive");
    }

    if (eventType === "membership_suspended") {
      return t("settings.eventTypes.membershipSuspended");
    }

    return t("settings.eventTypes.membershipDeleted");
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

  function formatTimestamp(value: string | null) {
    if (!value) {
      return t("settings.activity.notAvailable");
    }

    const timestamp = new Date(value);
    return timestamp.toLocaleString(language === "zh-CN" ? "zh-CN" : "en-US", {
      dateStyle: "medium",
      timeStyle: "short"
    });
  }

  async function handleSaveProfile() {
    if (!canSaveProfile) {
      return;
    }

    try {
      setIsSavingProfile(true);
      setSaveErrorMessage(null);
      const normalizedDisplayName = displayName.trim();
      const normalizedEmail = email.trim().toLowerCase();

      if (session?.userId) {
        const directoryUser = await updateDirectoryUser(session.userId, {
          display_name: normalizedDisplayName,
          email: normalizedEmail,
          is_active: true
        });
        signIn({
          userId: directoryUser.id,
          displayName: directoryUser.display_name,
          email: directoryUser.email,
          role: directoryUser.role,
          lastSignedInAt: directoryUser.last_signed_in_at,
          memberships: directoryUser.memberships
        });
      } else {
        signIn({
          displayName: normalizedDisplayName,
          email: normalizedEmail,
          role: "operator"
        });
      }

      setSaveState("saved");
    } catch (error) {
      setSaveState("idle");
      setSaveErrorMessage(error instanceof Error ? error.message : t("settings.status.profileSaveFailed"));
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function handleRefreshSession() {
    try {
      setIsRefreshingSession(true);
      setSaveErrorMessage(null);
      await refreshSession();
      await loadCurrentUserAccessEvents();
    } catch (error) {
      setSaveErrorMessage(error instanceof Error ? error.message : t("settings.status.sessionRefreshFailed"));
    } finally {
      setIsRefreshingSession(false);
    }
  }

  async function handleSignOut() {
    try {
      if (session?.sessionToken) {
        await revokeCurrentDirectorySession();
      }
    } catch {
      // Clear the local session even if the backend token has already expired or been revoked.
    } finally {
      signOut();
    }
  }

  return (
    <ConsoleShell activeHref="/settings">
      <PageTitleSync title={t("settings.title")} />
      <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-6">
        <ConsolePageHeader
          description={t("settings.header.description")}
          eyebrow={t("settings.header.eyebrow")}
          icon={<Settings className="h-4 w-4" />}
          title={t("settings.header.title")}
        />

        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr_0.9fr]">
          <ConsoleSurface>
            <ConsoleSurfaceHeader
              description={t("settings.sections.sessionDescription")}
              title={t("settings.sections.sessionTitle")}
            />
            <div className="space-y-4 p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <UserCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-base font-semibold text-slate-950">{session?.displayName ?? "RagPilot Operator"}</div>
                  <div className="text-sm text-slate-500">{session?.email ?? "operator@ragpilot.local"}</div>
                  <div className="mt-1 text-xs text-slate-400">
                    {session?.userId ? t("settings.fields.directoryLinked") : t("settings.fields.directoryUnlinked")}
                  </div>
                </div>
              </div>
              <div className="grid gap-4">
                <div className="space-y-2">
                  <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">{t("settings.fields.name")}</div>
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
                  <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">{t("settings.fields.email")}</div>
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
                <div className="space-y-2">
                  <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">{t("settings.fields.role")}</div>
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900">
                    {roleLabel}
                  </div>
                  <div className="text-sm text-slate-500">{t("settings.fields.roleManaged")}</div>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-slate-900">{t("settings.fields.adminAccess")}</div>
                      <div className="mt-1 text-sm text-slate-500">{roleLabel}</div>
                    </div>
                    <ConsoleOutlineBadge className={hasAdminAccess ? "border-emerald-200 bg-emerald-50 text-emerald-700" : ""}>
                      {hasAdminAccess ? t("settings.fields.adminAllowed") : t("settings.fields.adminDenied")}
                    </ConsoleOutlineBadge>
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-4">
                  <div className="text-sm font-medium text-slate-900">{t("settings.fields.memberships")}</div>
                  {sessionMemberships.length > 0 ? (
                    <div className="mt-3 space-y-3">
                      {sessionMemberships.map((membership) => (
                        <div
                          className="flex items-start justify-between gap-3 rounded-xl border border-slate-200/80 bg-white px-3 py-3"
                          key={membership.id}
                        >
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-slate-900">{membership.tenant_name}</div>
                            <div className="mt-1 truncate text-xs text-slate-500">{membership.tenant_slug}</div>
                          </div>
                          <Badge className="shrink-0 border-slate-200 bg-slate-50 text-slate-700" variant="outline">
                            {renderMembershipStatusLabel(membership.membership_status)}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-2 text-sm text-slate-500">{t("settings.fields.noMemberships")}</div>
                  )}
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-slate-900">{t("settings.fields.membershipAccess")}</div>
                      <div className="mt-1 text-sm text-slate-500">
                        {membershipAccessState === "ready"
                          ? t("settings.fields.membershipAccessReadyDescription")
                          : membershipAccessState === "blocked"
                            ? t("settings.fields.membershipAccessBlockedDescription")
                            : t("settings.fields.membershipAccessBootstrapDescription")}
                      </div>
                    </div>
                    <ConsoleOutlineBadge
                      className={
                        membershipAccessState === "ready"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : membershipAccessState === "blocked"
                            ? "border-rose-200 bg-rose-50 text-rose-700"
                            : "border-slate-200 bg-slate-50 text-slate-700"
                      }
                    >
                      {membershipAccessState === "ready"
                        ? t("settings.fields.membershipAccessReady")
                        : membershipAccessState === "blocked"
                          ? t("settings.fields.membershipAccessBlocked")
                          : t("settings.fields.membershipAccessBootstrap")}
                    </ConsoleOutlineBadge>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button disabled={!canSaveProfile || isSavingProfile} onClick={() => void handleSaveProfile()} type="button">
                  {isSavingProfile ? t("settings.actions.savingProfile") : t("settings.actions.saveProfile")}
                </Button>
                <Button disabled={!session?.userId || isRefreshingSession} onClick={() => void handleRefreshSession()} type="button" variant="outline">
                  <RefreshCw className={isRefreshingSession ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
                  {isRefreshingSession ? t("settings.actions.refreshingSession") : t("settings.actions.refreshSession")}
                </Button>
                {saveState === "saved" ? <div className="text-sm text-emerald-600">{t("settings.status.profileSaved")}</div> : null}
                {saveErrorMessage ? <div className="text-sm text-rose-600">{saveErrorMessage}</div> : null}
              </div>
            </div>
          </ConsoleSurface>

          <ConsoleSurface>
            <ConsoleSurfaceHeader
              description={t("settings.sections.roleDescription")}
              title={t("settings.sections.roleTitle")}
            />
            <div className="space-y-4 p-6">
              <div className="space-y-2">
                <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">{t("settings.fields.language")}</div>
                <Select onValueChange={(value) => setLanguage(value as "en" | "zh-CN")} value={language}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder={t("settings.fields.language")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">{t("shell.languages.en")}</SelectItem>
                    <SelectItem value="zh-CN">{t("shell.languages.zhCN")}</SelectItem>
                  </SelectContent>
                </Select>
                <div className="text-sm text-slate-500">{t("settings.fields.languageValue")}</div>
              </div>
              <div className="space-y-2">
                <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">{t("settings.fields.theme")}</div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Button
                    className="justify-start rounded-xl"
                    onClick={() => setThemeMode("light")}
                    type="button"
                    variant={isDarkMode ? "outline" : "default"}
                  >
                    <SunMedium className="h-4 w-4" />
                    {t("settings.fields.themeLight")}
                  </Button>
                  <Button
                    className="justify-start rounded-xl"
                    onClick={() => setThemeMode("dark")}
                    type="button"
                    variant={isDarkMode ? "default" : "outline"}
                  >
                    <Moon className="h-4 w-4" />
                    {t("settings.fields.themeDark")}
                  </Button>
                </div>
                <div className="text-sm text-slate-500">{t("settings.fields.themeValue")}</div>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-slate-900">{t("settings.fields.pendingRole")}</div>
                    <div className="mt-1 text-sm text-slate-500">{roleLabel}</div>
                  </div>
                  <ConsoleOutlineBadge className={hasAdminAccess ? "border-emerald-200 bg-emerald-50 text-emerald-700" : ""}>
                    {hasAdminAccess ? t("settings.fields.adminAllowed") : t("settings.fields.adminDenied")}
                  </ConsoleOutlineBadge>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button asChild className="rounded-xl" variant="outline">
                  <Link href="/login">{t("shell.userMenu.signIn")}</Link>
                </Button>
                <Button className="rounded-xl" onClick={() => void handleSignOut()} type="button" variant="outline">
                  {t("settings.actions.signOut")}
                </Button>
              </div>
            </div>
          </ConsoleSurface>

          <ConsoleSurface>
            <ConsoleSurfaceHeader
              description={t("settings.sections.platformDescription")}
              title={t("settings.sections.platformTitle")}
            />
            <div className="flex flex-col gap-3 p-6">
              <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-4">
                <div className="text-sm font-medium text-slate-900">{t("settings.fields.apiBaseUrl")}</div>
                <div className="mt-1 break-all text-sm text-slate-500">{apiBaseUrl}</div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-4">
                  <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
                    {t("settings.fields.retrievalEngine")}
                  </div>
                  <div className="mt-2 text-sm font-semibold text-slate-950">
                    {runtimeHealth?.retrieval_engine ?? t("settings.fields.runtimeUnavailable")}
                  </div>
                  <div className="mt-1 text-sm text-slate-500">{t("settings.fields.retrievalEngineHint")}</div>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-4">
                  <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
                    {t("settings.fields.agentRuntimeEngine")}
                  </div>
                  <div className="mt-2 text-sm font-semibold text-slate-950">
                    {runtimeHealth?.agent_runtime_engine ?? t("settings.fields.runtimeUnavailable")}
                  </div>
                  <div className="mt-1 text-sm text-slate-500">{t("settings.fields.agentRuntimeEngineHint")}</div>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-4">
                  <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
                    {t("settings.fields.chatProvider")}
                  </div>
                  <div className="mt-2 text-sm font-semibold text-slate-950">
                    {runtimeHealth?.chat_model_provider ?? t("settings.fields.runtimeUnavailable")}
                  </div>
                  <div className="mt-1 text-sm text-slate-500">{t("settings.fields.chatProviderHint")}</div>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-4">
                  <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
                    {t("settings.fields.chatModel")}
                  </div>
                  <div className="mt-2 break-all text-sm font-semibold text-slate-950">
                    {runtimeHealth?.chat_model_name ?? t("settings.fields.runtimeUnavailable")}
                  </div>
                  <div className="mt-1 text-sm text-slate-500">{t("settings.fields.chatModelHint")}</div>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-slate-900">{t("settings.fields.optionalRuntimes")}</div>
                    <div className="mt-1 text-sm text-slate-500">{t("settings.fields.optionalRuntimesHint")}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge
                      className={buildRuntimeReadinessClassName(Boolean(runtimeHealth?.llamaindex_pilot_ready))}
                      variant="outline"
                    >
                      {`LlamaIndex · ${
                        runtimeHealth?.llamaindex_pilot_ready
                          ? t("settings.fields.runtimeReady")
                          : t("settings.fields.runtimePending")
                      }`}
                    </Badge>
                    <Badge
                      className={buildRuntimeReadinessClassName(Boolean(runtimeHealth?.langgraph_pilot_ready))}
                      variant="outline"
                    >
                      {`LangGraph · ${
                        runtimeHealth?.langgraph_pilot_ready
                          ? t("settings.fields.runtimeReady")
                          : t("settings.fields.runtimePending")
                      }`}
                    </Badge>
                  </div>
                </div>
              </div>
              {runtimeHealthErrorMessage ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
                  {runtimeHealthErrorMessage}
                </div>
              ) : null}
              <Button asChild className="justify-start rounded-xl" variant="outline">
                <Link href="/">
                  <LayoutDashboard className="h-4 w-4" />
                  {t("settings.actions.openHome")}
                </Link>
              </Button>
              <Button asChild className="justify-start rounded-xl" variant="outline">
                <Link href="/chat">
                  <MessageSquareText className="h-4 w-4" />
                  {t("settings.actions.openChat")}
                </Link>
              </Button>
              {hasAdminAccess ? (
                <Button asChild className="justify-start rounded-xl" variant="outline">
                  <Link href="/admin">
                    <ShieldCheck className="h-4 w-4" />
                    {t("settings.actions.openAdmin")}
                  </Link>
                </Button>
              ) : null}
              {repositoryUrl ? (
                <Button asChild className="justify-start rounded-xl" variant="outline">
                  <a href={repositoryUrl} rel="noreferrer" target="_blank">
                    <Github className="h-4 w-4" />
                    {t("settings.actions.openRepository")}
                  </a>
                </Button>
              ) : null}
            </div>
          </ConsoleSurface>
        </div>

        <ConsoleSurface>
          <ConsoleSurfaceHeader
            description={t("settings.sections.accessDescription")}
            title={t("settings.sections.accessTitle")}
          />
          <div className="space-y-6 p-6">
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-4">
                <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">{t("settings.activity.latestEvent")}</div>
                <div className="mt-3 text-sm font-semibold text-slate-950">
                  {latestAccessEvent ? renderEventTypeLabel(latestAccessEvent.event_type) : t("settings.activity.empty")}
                </div>
                <div className="mt-2 text-sm text-slate-500">
                  {latestAccessEvent ? formatTimestamp(latestAccessEvent.created_at) : t("settings.activity.scopedToCurrentUser")}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-4">
                <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">{t("settings.activity.lastSignIn")}</div>
                <div className="mt-3 text-sm font-semibold text-slate-950">
                  {session?.lastSignedInAt ? formatTimestamp(session.lastSignedInAt) : t("settings.activity.notAvailable")}
                </div>
                <div className="mt-2 text-sm text-slate-500">
                  {loginEvents.length > 0
                    ? t("settings.activity.loadedLoginEvents", { count: loginEvents.length })
                    : t("settings.activity.noLoginEvents")}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-4">
                <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">{t("settings.activity.directoryState")}</div>
                <div className="mt-3 text-sm font-semibold text-slate-950">
                  {session?.userId ? t("settings.activity.directoryUser") : t("settings.activity.localSession")}
                </div>
                <div className="mt-2 text-sm text-slate-500">
                  {session?.userId ? t("settings.activity.scopedToCurrentUser") : t("settings.activity.localOnly")}
                </div>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-4">
              <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-4">
                <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">{t("settings.posture.activeMemberships")}</div>
                <div className="mt-3 text-2xl font-semibold text-slate-950">
                  {sessionMemberships.filter((membership) => membership.membership_status === "active").length}
                </div>
                <div className="mt-2 text-sm text-slate-500">{t("settings.posture.activeMembershipsHint")}</div>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-4">
                <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">{t("settings.posture.invitedMemberships")}</div>
                <div className="mt-3 text-2xl font-semibold text-slate-950">
                  {sessionMemberships.filter((membership) => membership.membership_status === "invited").length}
                </div>
                <div className="mt-2 text-sm text-slate-500">{t("settings.posture.invitedMembershipsHint")}</div>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-4">
                <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">{t("settings.posture.expiringInvitations")}</div>
                <div className="mt-3 text-2xl font-semibold text-slate-950">
                  {expiringMembershipInvitations + expiredMembershipInvitations}
                </div>
                <div className="mt-2 text-sm text-slate-500">{t("settings.posture.expiringInvitationsHint")}</div>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-4">
                <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">{t("settings.posture.sensitiveEvents")}</div>
                <div className="mt-3 text-2xl font-semibold text-slate-950">
                  {accessEvents.filter((event) =>
                    event.event_type === "invitation_revoked" ||
                    event.event_type === "membership_suspended" ||
                    event.event_type === "membership_deleted"
                  ).length}
                </div>
                <div className="mt-2 text-sm text-slate-500">{t("settings.posture.sensitiveEventsHint")}</div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-slate-950">{t("settings.activity.eventFeed")}</div>
                <div className="mt-1 text-sm text-slate-500">{t("settings.activity.scopedToCurrentUser")}</div>
              </div>
              <Button
                className="rounded-xl"
                disabled={!session?.userId || isLoadingAccessEvents}
                onClick={() => void loadCurrentUserAccessEvents()}
                type="button"
                variant="outline"
              >
                <RefreshCw className={isLoadingAccessEvents ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
                {isLoadingAccessEvents ? t("settings.actions.refreshingActivity") : t("settings.actions.refreshActivity")}
              </Button>
            </div>

            {!session?.userId ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-4 text-sm text-slate-500">
                {t("settings.activity.localOnly")}
              </div>
            ) : accessEventsErrorMessage ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
                {accessEventsErrorMessage}
              </div>
            ) : accessEvents.length === 0 && !isLoadingAccessEvents ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-4 text-sm text-slate-500">
                {t("settings.activity.empty")}
              </div>
            ) : (
              <div className="space-y-3">
                {accessEvents.map((event) => {
                  const membershipStatus =
                    typeof event.detail_json.membership_status === "string" ? event.detail_json.membership_status : null;
                  const reason = typeof event.detail_json.reason === "string" ? event.detail_json.reason : null;
                  const loginMode = typeof event.detail_json.login_mode === "string" ? event.detail_json.login_mode : null;
                  const invitationIssueCount =
                    typeof event.detail_json.invitation_issue_count === "number"
                      ? event.detail_json.invitation_issue_count
                      : null;

                  return (
                    <div
                      className="rounded-2xl border border-slate-200/80 bg-white px-4 py-4 shadow-sm shadow-slate-950/5"
                      key={event.id}
                    >
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge className={buildEventBadgeClassName(event.event_type)} variant="outline">
                              {renderEventTypeLabel(event.event_type)}
                            </Badge>
                            <Badge className="border-slate-200 bg-slate-50 text-slate-700" variant="outline">
                              {event.tenant_name ?? t("settings.activity.noTenant")}
                            </Badge>
                          </div>
                          <div className="grid gap-2 text-sm text-slate-600 md:grid-cols-2">
                            <div className="flex items-center gap-2">
                              <Clock3 className="h-4 w-4 text-slate-400" />
                              <span>{formatTimestamp(event.created_at)}</span>
                            </div>
                            <div>
                              <span className="font-medium text-slate-900">{t("settings.activity.issuedBy")}</span>
                              <span className="ml-2">{event.actor_display_name ?? t("settings.activity.noActor")}</span>
                            </div>
                            {membershipStatus ? (
                              <div>
                                <span className="font-medium text-slate-900">{t("settings.activity.membershipStatus")}</span>
                                <span className="ml-2">{renderMembershipStatusLabel(membershipStatus as "active" | "invited" | "suspended")}</span>
                              </div>
                            ) : null}
                            {loginMode ? (
                              <div>
                                <span className="font-medium text-slate-900">{t("settings.activity.loginMode")}</span>
                                <span className="ml-2">{renderLoginModeLabel(loginMode)}</span>
                              </div>
                            ) : null}
                            {invitationIssueCount !== null ? (
                              <div>
                                <span className="font-medium text-slate-900">{t("settings.activity.invitationIssueCount")}</span>
                                <span className="ml-2">{invitationIssueCount}</span>
                              </div>
                            ) : null}
                            {reason ? (
                              <div className="md:col-span-2">
                                <span className="font-medium text-slate-900">{t("settings.activity.reason")}</span>
                                <span className="ml-2">{reason}</span>
                              </div>
                            ) : null}
                          </div>
                        </div>
                        <div className="shrink-0 text-xs text-slate-400">{event.user_display_name ?? session?.displayName}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </ConsoleSurface>

        <PlatformGovernanceSection canManage={canManageGovernance} isVisible={hasAdminAccess} />
      </div>
    </ConsoleShell>
  );
}
