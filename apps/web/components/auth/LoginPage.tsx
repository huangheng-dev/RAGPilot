"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { Route } from "next";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, ShieldCheck } from "lucide-react";

import { PageTitleSync } from "@/components/console/PageTitleSync";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { canUseDirectorySession } from "@/lib/auth/access";
import {
  assessDirectoryLogin,
  activateDirectoryUserInvitations,
  getDirectoryBootstrapStatus,
  type LoginAssessment,
  loginDirectoryUser,
  type BootstrapStatus,
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

export function LoginPage({ defaultReturnTo = "/chat" }: LoginPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isReady, session, signIn } = useAuth();
  const { t } = useI18n();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [invitationToken, setInvitationToken] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isActivatingInvitation, setIsActivatingInvitation] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingActivationCandidate, setPendingActivationCandidate] = useState<ActivationCandidate | null>(null);
  const [bootstrapStatus, setBootstrapStatus] = useState<BootstrapStatus | null>(null);
  const [loginAssessment, setLoginAssessment] = useState<LoginAssessment | null>(null);
  const [isLoadingAssessment, setIsLoadingAssessment] = useState(false);

  const returnTo = useMemo(() => {
    const requestedPath = searchParams.get("return_to")?.trim();
    if (!requestedPath || !requestedPath.startsWith("/")) {
      return defaultReturnTo;
    }

    return requestedPath;
  }, [defaultReturnTo, searchParams]);
  const assessmentActionLabel =
    isLoadingAssessment
      ? t("auth.assessment.checking")
      : loginAssessment?.next_action === "bootstrap"
        ? t("auth.assessment.bootstrap")
        : loginAssessment?.next_action === "sign_in"
          ? t("auth.assessment.signIn")
          : loginAssessment?.next_action === "activate_invitation"
            ? t("auth.assessment.activateInvitation")
            : t("auth.assessment.contactAdmin");
  const normalizedEmail = email.trim().toLowerCase();
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

  useEffect(() => {
    let isCancelled = false;

    async function loadBootstrapStatus() {
      try {
        const status = await getDirectoryBootstrapStatus();
        if (!isCancelled) {
          setBootstrapStatus(status);
        }
      } catch {
        if (!isCancelled) {
          setBootstrapStatus(null);
        }
      }
    }

    void loadBootstrapStatus();
    return () => {
      isCancelled = true;
    };
  }, []);

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
  }, [email]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedDisplayName = displayName.trim();
    if (!normalizedDisplayName || !normalizedEmail) {
      setErrorMessage(t("auth.errors.requiredFields"));
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
        display_name: normalizedDisplayName,
        email: normalizedEmail
      });
      const directoryUser = authenticatedSession.user;

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
        sessionToken: authenticatedSession.session.session_token,
        sessionExpiresAt: authenticatedSession.session.expires_at,
        lastSignedInAt: directoryUser.last_signed_in_at,
        memberships: directoryUser.memberships
      });
      router.replace(returnTo as Route);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("auth.errors.directorySyncFailed"));
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

    try {
      setIsActivatingInvitation(true);
      setErrorMessage(null);
      const authenticatedSession = await activateDirectoryUserInvitations({
        email: activationCandidate.email,
        invitation_token: invitationToken,
      });
      const activatedUser = authenticatedSession.user;
      signIn({
        userId: activatedUser.id,
        displayName: activatedUser.display_name,
        email: activatedUser.email,
        role: activatedUser.role,
        sessionToken: authenticatedSession.session.session_token,
        sessionExpiresAt: authenticatedSession.session.expires_at,
        lastSignedInAt: activatedUser.last_signed_in_at,
        memberships: activatedUser.memberships
      });
      router.replace(returnTo as Route);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("auth.errors.directorySyncFailed"));
    } finally {
      setIsActivatingInvitation(false);
    }
  }

  return (
    <>
      <PageTitleSync title={t("auth.title")} />
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.08),transparent_30%),linear-gradient(180deg,#f8fbff_0%,#eef4fb_100%)]">
        <section className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col justify-center px-4 py-10 sm:px-6">
          <Card className="overflow-hidden rounded-[28px] border border-slate-200/90 bg-white shadow-[0_28px_90px_rgba(15,23,42,0.08)]">
            <CardHeader className="space-y-3 px-6 pb-2 pt-8 sm:px-8">
              <CardTitle className="text-[30px] font-semibold tracking-tight text-slate-950">
                {t("auth.heading")}
              </CardTitle>
              {bootstrapStatus?.allow_initial_super_admin ? (
                <div className="text-sm text-slate-500">{t("auth.bootstrap.firstAdmin")}</div>
              ) : null}
            </CardHeader>

            <CardContent className="space-y-5 px-6 pb-8 pt-4 sm:px-8">
              <form className="space-y-5" onSubmit={handleSubmit}>
                <div className="space-y-2.5">
                  <div className="text-sm font-medium text-slate-700">{t("auth.fields.displayName")}</div>
                  <Input
                    className="h-14 rounded-2xl border-slate-200 bg-slate-50 px-4 text-base shadow-none"
                    onChange={(event) => setDisplayName(event.target.value)}
                    placeholder={t("auth.fields.displayNamePlaceholder")}
                    value={displayName}
                  />
                </div>

                <div className="space-y-2.5">
                  <div className="text-sm font-medium text-slate-700">{t("auth.fields.email")}</div>
                  <Input
                    className="h-14 rounded-2xl border-slate-200 bg-slate-50 px-4 text-base shadow-none"
                    onChange={(event) => {
                      setEmail(event.target.value);
                      setPendingActivationCandidate(null);
                    }}
                    placeholder={t("auth.fields.emailPlaceholder")}
                    type="email"
                    value={email}
                  />
                </div>

                {loginAssessment ? (
                  <div className="rounded-[22px] border border-slate-200 bg-slate-50/90 px-4 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-slate-900">{t("auth.assessment.title")}</div>
                        <div className="mt-1 text-sm leading-6 text-slate-600">
                          {loginAssessment.account_state === "bootstrap_available"
                            ? t("auth.assessment.bootstrapAvailable")
                            : loginAssessment.account_state === "ready"
                              ? t("auth.assessment.ready")
                              : loginAssessment.account_state === "invited"
                                ? t("auth.assessment.invited")
                                : loginAssessment.account_state === "inactive_account"
                                  ? t("auth.assessment.inactiveAccount")
                                  : loginAssessment.account_state === "inactive_membership"
                                    ? t("auth.assessment.inactiveMembership")
                                    : t("auth.assessment.notFound")}
                        </div>
                      </div>
                      <Badge className="border-slate-200 bg-white text-slate-700" variant="outline">
                        {assessmentActionLabel}
                      </Badge>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Badge className="border-slate-200 bg-white text-slate-700" variant="outline">
                        {t("auth.assessment.activeMemberships", { count: String(loginAssessment.active_membership_count) })}
                      </Badge>
                      <Badge className="border-slate-200 bg-white text-slate-700" variant="outline">
                        {t("auth.assessment.invitedMemberships", { count: String(loginAssessment.invited_membership_count) })}
                      </Badge>
                      <Badge className="border-slate-200 bg-white text-slate-700" variant="outline">
                        {t("auth.assessment.suspendedMemberships", { count: String(loginAssessment.suspended_membership_count) })}
                      </Badge>
                      {loginAssessment.expiring_invitation_count > 0 || loginAssessment.expired_invitation_count > 0 ? (
                        <Badge className="border-amber-200 bg-amber-50 text-amber-800" variant="outline">
                          {t("auth.assessment.invitationRisk", {
                            count: String(loginAssessment.expiring_invitation_count + loginAssessment.expired_invitation_count),
                          })}
                        </Badge>
                      ) : null}
                    </div>

                    {loginAssessment.memberships.length > 0 ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {loginAssessment.memberships.map((membership) => (
                          <Badge className="border-slate-200 bg-white text-slate-700" key={membership.id} variant="outline">
                            {membership.tenant_name}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {errorMessage ? (
                  <div className="rounded-[22px] border border-rose-200 bg-rose-50 px-4 py-4 text-sm leading-6 text-rose-700">
                    {errorMessage}
                  </div>
                ) : null}

                <Button className="h-14 w-full rounded-2xl text-base" disabled={isSubmitting} type="submit">
                  <ShieldCheck className="h-4 w-4" />
                  {submitLabel}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </form>

              {activationCandidate ? (
                <div className="space-y-4 rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-4">
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
                    <div className="text-sm font-medium text-amber-900">{t("auth.fields.invitationToken")}</div>
                    <Input
                      className="h-14 rounded-2xl border-amber-200 bg-white px-4 text-base shadow-none"
                      onChange={(event) => setInvitationToken(event.target.value.toUpperCase())}
                      placeholder={t("auth.fields.invitationTokenPlaceholder")}
                      value={invitationToken}
                    />
                  </div>
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
