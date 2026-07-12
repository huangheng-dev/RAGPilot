"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { Route } from "next";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, CheckCircle2, LockKeyhole, Mail, ShieldCheck, Sparkles, UserRound } from "lucide-react";

import { PageTitleSync } from "@/components/console/PageTitleSync";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { canUseDirectorySession } from "@/lib/auth/access";
import {
  assessDirectoryLogin,
  activateDirectoryUserInvitations,
  getDirectoryAuthMode,
  type DirectoryAuthMode,
  type LoginAssessment,
  loginDirectoryUser,
  type DirectoryMembership
} from "@/lib/auth-directory";
import { useAuth } from "@/lib/auth/provider";
import { useI18n } from "@/lib/i18n/provider";
import { consumeAuthExitReason } from "@/lib/local-session";

type LoginPageProps = {
  defaultReturnTo?: string;
};

type ActivationCandidate = {
  email: string;
  memberships: DirectoryMembership[];
};

type LoginProfile = "admin" | "operator";

const DEFAULT_ADMIN_DISPLAY_NAME = "Platform Owner";
const DEFAULT_ADMIN_EMAIL = "admin@ragpilot.local";
const DEFAULT_OPERATOR_DISPLAY_NAME = "Workspace Operator";
const DEFAULT_OPERATOR_EMAIL = "operator@ragpilot.local";

function getProfileDefaults(profile: LoginProfile) {
  if (profile === "admin") {
    return {
      displayName: DEFAULT_ADMIN_DISPLAY_NAME,
      email: DEFAULT_ADMIN_EMAIL,
    };
  }

  return {
    displayName: DEFAULT_OPERATOR_DISPLAY_NAME,
    email: DEFAULT_OPERATOR_EMAIL,
  };
}

function isDirectoryMembershipList(value: unknown): value is DirectoryMembership[] {
  return Array.isArray(value);
}

function hasDirectoryUserShape(
  value: unknown
): value is {
  id: string;
  email: string;
  display_name: string;
  role: "super_admin" | "operator" | "reviewer";
  memberships: DirectoryMembership[];
  last_signed_in_at: string | null;
} {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.email === "string" &&
    typeof candidate.display_name === "string" &&
    typeof candidate.role === "string" &&
    ["super_admin", "operator", "reviewer"].includes(candidate.role) &&
    isDirectoryMembershipList(candidate.memberships)
  );
}

function resolveAuthErrorMessage(rawMessage: string, t: ReturnType<typeof useI18n>["t"]) {
  if (rawMessage.includes("Email or password is incorrect.")) {
    return t("auth.errors.invalidCredentials");
  }
  if (rawMessage.includes("Too many failed sign-in attempts.")) {
    return t("auth.errors.signInRateLimited");
  }
  if (rawMessage.includes("No invited memberships are available to activate.")) {
    return t("auth.errors.noInvitedMemberships");
  }
  if (rawMessage.includes("Invitation token is not valid for this member.")) {
    return t("auth.errors.invalidInvitationToken");
  }
  if (rawMessage.includes("Invitation token has expired.")) {
    return t("auth.errors.expiredInvitationToken");
  }
  if (rawMessage.includes("This member account is inactive.")) {
    return t("auth.errors.inactiveAccount");
  }
  if (rawMessage.includes("This member does not currently have an active tenant membership.")) {
    return t("auth.errors.inactiveMembership");
  }
  if (rawMessage.includes("This member only has invited tenant access right now.")) {
    return t("auth.errors.invitedMembership");
  }
  return rawMessage;
}

export function LoginPage({ defaultReturnTo = "/" }: LoginPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isReady, refreshSession, session, signIn } = useAuth();
  const { t } = useI18n();
  const [loginProfile, setLoginProfile] = useState<LoginProfile>("admin");
  const [displayName, setDisplayName] = useState(DEFAULT_ADMIN_DISPLAY_NAME);
  const [email, setEmail] = useState(DEFAULT_ADMIN_EMAIL);
  const [password, setPassword] = useState("");
  const [invitationToken, setInvitationToken] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isActivatingInvitation, setIsActivatingInvitation] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingActivationCandidate, setPendingActivationCandidate] = useState<ActivationCandidate | null>(null);
  const [authMode, setAuthMode] = useState<DirectoryAuthMode | null>(null);
  const [loginAssessment, setLoginAssessment] = useState<LoginAssessment | null>(null);
  const [isLoadingAssessment, setIsLoadingAssessment] = useState(false);

  const returnTo = useMemo(() => {
    const requestedPath = searchParams.get("return_to")?.trim();
    if (!requestedPath || !requestedPath.startsWith("/")) {
      return defaultReturnTo;
    }

    return requestedPath;
  }, [defaultReturnTo, searchParams]);
  const normalizedEmail = email.trim().toLowerCase();
  const isProviderManagedSignIn = authMode?.sign_in_method === "external_redirect";
  const activationCandidate =
    pendingActivationCandidate ??
    (loginAssessment?.next_action === "activate_invitation" && normalizedEmail
      ? {
          email: normalizedEmail,
          memberships: loginAssessment.memberships,
        }
      : null);
  const submitLabel =
    loginAssessment?.next_action === "activate_invitation"
      ? t("auth.assessment.activateInvitation")
      : isSubmitting
        ? t("auth.submitting")
        : t("auth.submit");

  useEffect(() => {
    if (isReady && session) {
      router.replace(returnTo as Route);
    }
  }, [isReady, returnTo, router, session]);

  function applyProfile(profile: LoginProfile) {
    const defaults = getProfileDefaults(profile);
    setLoginProfile(profile);
    setDisplayName(defaults.displayName);
    setEmail(defaults.email);
    setPassword("");
    setInvitationToken("");
    setPendingActivationCandidate(null);
    setErrorMessage(null);
  }

  useEffect(() => {
    let isCancelled = false;

    async function loadAuthMode() {
      try {
        const mode = await getDirectoryAuthMode(returnTo);
        if (!isCancelled) {
          setAuthMode(mode);
        }
      } catch {
        if (!isCancelled) {
          setAuthMode(null);
        }
      }
    }

    void loadAuthMode();
    return () => {
      isCancelled = true;
    };
  }, [returnTo]);

  useEffect(() => {
    const exitReason = consumeAuthExitReason();
    if (!exitReason) {
      return;
    }

    setPendingActivationCandidate(null);
    setErrorMessage(
      exitReason === "inactive_account"
        ? t("auth.errors.sessionInactiveAccount")
        : exitReason === "inactive_membership"
          ? t("auth.errors.sessionInactiveMembership")
          : exitReason === "session_revoked"
            ? t("auth.errors.sessionRevoked")
            : t("auth.errors.sessionMissingDirectoryUser")
    );
  }, [t]);

  useEffect(() => {
    if (authMode && authMode.sign_in_method !== "local_form") {
      setLoginAssessment(null);
      setIsLoadingAssessment(false);
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (normalizedEmail.length < 3) {
      setLoginAssessment(null);
      setIsLoadingAssessment(false);
      return;
    }

    let isCancelled = false;
    const timeoutId = window.setTimeout(async () => {
      try {
        setIsLoadingAssessment(true);
        const assessment = await assessDirectoryLogin(normalizedEmail);
        if (!isCancelled) {
          setLoginAssessment(assessment);
        }
      } catch {
        if (!isCancelled) {
          setLoginAssessment(null);
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingAssessment(false);
        }
      }
    }, 250);

    return () => {
      isCancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [authMode, email]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isProviderManagedSignIn) {
      setErrorMessage(t("auth.errors.providerManagedOnly"));
      return;
    }

    const rawDisplayName = displayName.trim();
    const resolvedDisplayName =
      authMode?.supports_display_name_input === false
        ? rawDisplayName || normalizedEmail.split("@")[0] || "Workspace Member"
        : rawDisplayName;
    if ((!resolvedDisplayName && authMode?.supports_display_name_input !== false) || !normalizedEmail) {
      setErrorMessage(t("auth.errors.requiredFields"));
      return;
    }
    if (authMode?.supports_password_input && !password.trim()) {
      setErrorMessage(t("auth.errors.passwordRequired"));
      return;
    }

    if (loginAssessment?.next_action === "activate_invitation") {
      setPendingActivationCandidate({
        email: normalizedEmail,
        memberships: loginAssessment.memberships,
      });
      setErrorMessage(null);
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      setPendingActivationCandidate(null);
      setInvitationToken("");
      const authenticatedSession = await loginDirectoryUser({
        display_name: resolvedDisplayName,
        email: normalizedEmail,
        password,
      });
      const directoryUser = authenticatedSession?.user;
      const authenticatedDirectorySession = authenticatedSession?.session;

      if (!hasDirectoryUserShape(directoryUser) || !authenticatedDirectorySession?.session_token || !authenticatedDirectorySession?.expires_at) {
        throw new Error(t("auth.errors.directorySyncFailed"));
      }

      if (!canUseDirectorySession(directoryUser.role, directoryUser.memberships)) {
        if (directoryUser.memberships.some((membership) => membership.membership_status === "invited")) {
          setPendingActivationCandidate({
            email: directoryUser.email,
            memberships: directoryUser.memberships,
          });
          setErrorMessage(null);
          return;
        }

        setErrorMessage(t("auth.errors.inactiveMembership"));
        return;
      }

      signIn({
        userId: directoryUser.id,
        displayName: directoryUser.display_name,
        email: directoryUser.email,
        role: directoryUser.role,
        sessionToken: authenticatedDirectorySession.session_token,
        sessionExpiresAt: authenticatedDirectorySession.expires_at,
        lastSignedInAt: directoryUser.last_signed_in_at,
        memberships: directoryUser.memberships,
        permissions: authenticatedSession.permissions ?? null,
      });
      const refreshedSession = await refreshSession();
      if (!refreshedSession) {
        throw new Error(t("auth.errors.directorySyncFailed"));
      }
      router.replace(returnTo as Route);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? resolveAuthErrorMessage(error.message, t) : t("auth.errors.directorySyncFailed")
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleActivateInvitation() {
    if (!activationCandidate) {
      return;
    }
    if (!invitationToken.trim()) {
      setErrorMessage(t("auth.errors.invitationTokenRequired"));
      return;
    }
    if (authMode?.supports_password_input && !password.trim()) {
      setErrorMessage(t("auth.errors.passwordRequired"));
      return;
    }

    try {
      setIsActivatingInvitation(true);
      setErrorMessage(null);
      const authenticatedSession = await activateDirectoryUserInvitations({
        email: activationCandidate.email,
        invitation_token: invitationToken,
        password,
      });
      const activatedUser = authenticatedSession?.user;
      const activatedDirectorySession = authenticatedSession?.session;

      if (!hasDirectoryUserShape(activatedUser) || !activatedDirectorySession?.session_token || !activatedDirectorySession?.expires_at) {
        throw new Error(t("auth.errors.directorySyncFailed"));
      }

      signIn({
        userId: activatedUser.id,
        displayName: activatedUser.display_name,
        email: activatedUser.email,
        role: activatedUser.role,
        sessionToken: activatedDirectorySession.session_token,
        sessionExpiresAt: activatedDirectorySession.expires_at,
        lastSignedInAt: activatedUser.last_signed_in_at,
        memberships: activatedUser.memberships,
        permissions: authenticatedSession.permissions ?? null,
      });
      const refreshedSession = await refreshSession();
      if (!refreshedSession) {
        throw new Error(t("auth.errors.directorySyncFailed"));
      }
      router.replace(returnTo as Route);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? resolveAuthErrorMessage(error.message, t) : t("auth.errors.directorySyncFailed")
      );
    } finally {
      setIsActivatingInvitation(false);
    }
  }

  return (
    <>
      <PageTitleSync title={t("auth.title")} />
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.10),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.07),transparent_26%),linear-gradient(180deg,#f7faff_0%,#eef4fb_100%)]">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.10)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.10)_1px,transparent_1px)] bg-[size:32px_32px]" />
        <section className="relative mx-auto flex min-h-screen w-full max-w-[860px] flex-col justify-center px-4 py-10 sm:px-6">
          <Card className="overflow-hidden rounded-[32px] border border-white/70 bg-white/88 shadow-[0_30px_100px_rgba(15,23,42,0.10)] backdrop-blur">
            <CardHeader className="space-y-4 px-6 pb-1 pt-8 sm:px-8 sm:pt-9">
              <div className="flex items-center justify-between gap-3">
                <Badge
                  className="h-11 rounded-full border-slate-200/90 bg-white px-4 text-sm font-semibold text-slate-700 shadow-[0_8px_24px_rgba(15,23,42,0.08)]"
                  variant="outline"
                >
                  <Sparkles className="h-4 w-4 text-violet-500" />
                  {t("auth.eyebrow")}
                </Badge>
                <Badge className="h-9 rounded-full border-emerald-200 bg-emerald-50 px-3 text-sm font-medium text-emerald-700" variant="outline">
                  {t("auth.badge")}
                </Badge>
              </div>

              <div className="space-y-3">
                <CardTitle className="text-[32px] font-bold tracking-tight text-slate-950 sm:text-[38px]">
                  {t("auth.heading")}
                </CardTitle>
                <div className="max-w-xl text-[16px] leading-8 text-slate-500 sm:text-[17px]">
                  {t("auth.description")}
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-6 px-6 pb-8 pt-5 sm:px-8">
              {isProviderManagedSignIn ? (
                <div className="rounded-[24px] border border-slate-200 bg-slate-50/90 px-5 py-5">
                  <div className="text-sm font-semibold text-slate-900">{t("auth.providerManaged.title")}</div>
                  <div className="mt-2 text-sm leading-6 text-slate-600">{t("auth.providerManaged.description")}</div>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <Badge className="border-slate-200 bg-white text-slate-700" variant="outline">
                      {authMode?.provider_display_name ?? t("auth.providerManaged.defaultProvider")}
                    </Badge>
                    {authMode?.provider_sign_in_url ? (
                      <Button asChild className="h-11 rounded-2xl px-5" type="button">
                        <a href={authMode.provider_sign_in_url}>
                          {t("auth.providerManaged.continue", {
                            provider: authMode.provider_display_name ?? t("auth.providerManaged.defaultProvider"),
                          })}
                          <ArrowRight className="h-4 w-4" />
                        </a>
                      </Button>
                    ) : (
                      <div className="text-sm text-slate-500">{t("auth.providerManaged.unavailable")}</div>
                    )}
                  </div>
                </div>
              ) : (
                <form className="space-y-5" onSubmit={handleSubmit}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      className={`rounded-[24px] border px-4 py-4 text-left transition ${
                        loginProfile === "admin"
                          ? "border-blue-200 bg-blue-50/80 shadow-[0_14px_34px_rgba(59,130,246,0.12)]"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                      }`}
                      onClick={() => applyProfile("admin")}
                      type="button"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div
                            className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
                              loginProfile === "admin" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            <ShieldCheck className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                              {t("auth.profiles.admin")}
                            </div>
                            <div className="mt-2 text-base font-semibold text-slate-900">{DEFAULT_ADMIN_DISPLAY_NAME}</div>
                          </div>
                        </div>
                        {loginProfile === "admin" ? <CheckCircle2 className="h-5 w-5 text-blue-600" /> : null}
                      </div>
                      <div className="mt-3 text-sm text-slate-500">{DEFAULT_ADMIN_EMAIL}</div>
                    </button>
                    <button
                      className={`rounded-[24px] border px-4 py-4 text-left transition ${
                        loginProfile === "operator"
                          ? "border-blue-200 bg-blue-50/80 shadow-[0_14px_34px_rgba(59,130,246,0.12)]"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                      }`}
                      onClick={() => applyProfile("operator")}
                      type="button"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div
                            className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
                              loginProfile === "operator" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            <UserRound className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                              {t("auth.profiles.operator")}
                            </div>
                            <div className="mt-2 text-base font-semibold text-slate-900">{DEFAULT_OPERATOR_DISPLAY_NAME}</div>
                          </div>
                        </div>
                        {loginProfile === "operator" ? <CheckCircle2 className="h-5 w-5 text-blue-600" /> : null}
                      </div>
                      <div className="mt-3 text-sm text-slate-500">{DEFAULT_OPERATOR_EMAIL}</div>
                    </button>
                  </div>

                  <div className="rounded-[28px] border border-slate-200 bg-slate-50/85 p-6 sm:p-7">
                    <div className="space-y-4">
                      {authMode?.supports_display_name_input !== false ? (
                        <div className="space-y-2.5">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                            {t("auth.fields.displayName")}
                          </div>
                          <div className="relative">
                            <UserRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <Input
                              className="h-14 rounded-2xl border-slate-200 bg-white pl-11 pr-4 text-base shadow-none"
                              onChange={(event) => setDisplayName(event.target.value)}
                              placeholder={t("auth.fields.displayNamePlaceholder")}
                              value={displayName}
                            />
                          </div>
                        </div>
                      ) : null}

                      <div className="space-y-2.5">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                          {t("auth.fields.email")}
                        </div>
                        <div className="relative">
                          <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <Input
                            className="h-14 rounded-2xl border-slate-200 bg-white pl-11 pr-4 text-base shadow-none"
                            onChange={(event) => {
                              setEmail(event.target.value);
                              setPendingActivationCandidate(null);
                            }}
                            placeholder={t("auth.fields.emailPlaceholder")}
                            type="email"
                            value={email}
                          />
                        </div>
                      </div>

                      {authMode?.supports_password_input ? (
                        <div className="space-y-2.5">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                            {t("auth.fields.password")}
                          </div>
                          <div className="relative">
                            <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <Input
                              className="h-14 rounded-2xl border-slate-200 bg-white pl-11 pr-4 text-base shadow-none"
                              onChange={(event) => setPassword(event.target.value)}
                              placeholder={t("auth.fields.passwordPlaceholder")}
                              type="password"
                              value={password}
                            />
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {errorMessage ? (
                    <div className="rounded-[22px] border border-rose-200 bg-rose-50 px-4 py-4 text-sm leading-6 text-rose-700">
                      {errorMessage}
                    </div>
                  ) : null}

                  <div className="flex justify-end pt-1">
                    <Button className="h-14 rounded-2xl px-6 text-base sm:min-w-[240px]" disabled={isSubmitting} type="submit">
                      <ShieldCheck className="h-4 w-4" />
                      {submitLabel}
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </form>
              )}

              {activationCandidate ? (
                <div className="space-y-4 rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-4">
                  <div>
                    <div className="text-sm font-semibold text-amber-900">{t("auth.invitation.title")}</div>
                    <div className="mt-1 text-sm leading-6 text-amber-800">{t("auth.invitation.description")}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {activationCandidate.memberships
                      .filter((membership) => membership.membership_status === "invited")
                      .map((membership) => (
                        <Badge className="border-amber-200 bg-white text-amber-800" key={membership.id} variant="outline">
                          {membership.tenant_name}
                        </Badge>
                      ))}
                  </div>
                  <div className="space-y-2.5">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-900">
                      {t("auth.fields.invitationToken")}
                    </div>
                    <Input
                      className="h-14 rounded-2xl border-amber-200 bg-white px-4 text-base shadow-none"
                      onChange={(event) => setInvitationToken(event.target.value.toUpperCase())}
                      placeholder={t("auth.fields.invitationTokenPlaceholder")}
                      value={invitationToken}
                    />
                  </div>
                  {authMode?.supports_password_input ? (
                    <div className="space-y-2.5">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-900">
                        {t("auth.fields.password")}
                      </div>
                      <div className="relative">
                        <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-500" />
                        <Input
                          className="h-14 rounded-2xl border-amber-200 bg-white pl-11 pr-4 text-base shadow-none"
                          onChange={(event) => setPassword(event.target.value)}
                          placeholder={t("auth.fields.passwordPlaceholder")}
                          type="password"
                          value={password}
                        />
                      </div>
                    </div>
                  ) : null}
                  <Button
                    className="h-12 w-full rounded-2xl"
                    disabled={isActivatingInvitation}
                    onClick={() => void handleActivateInvitation()}
                    type="button"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    {isActivatingInvitation ? t("auth.invitation.activating") : t("auth.invitation.activate")}
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </section>
      </div>
    </>
  );
}
