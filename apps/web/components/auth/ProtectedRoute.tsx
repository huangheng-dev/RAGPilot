"use client";

import { useEffect, useMemo } from "react";
import type { Route } from "next";
import { ArrowRight, LoaderCircle, LockKeyhole, ShieldAlert } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

import { ConsoleShell } from "@/components/console/ConsoleShell";
import { PageTitleSync } from "@/components/console/PageTitleSync";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AuthRole } from "@/lib/auth/access";
import { hasDirectoryCapability } from "@/lib/auth/access";
import { useAuth } from "@/lib/auth/provider";
import type { DirectoryCapabilityKey } from "@/lib/auth-directory";
import { useI18n } from "@/lib/i18n/provider";

function resolveReturnTo(pathname: string, searchParams: string) {
  return searchParams.length > 0 ? `${pathname}?${searchParams}` : pathname;
}

function resolveLoginHref(returnTo: string) {
  const params = new URLSearchParams();
  if (returnTo.startsWith("/")) {
    params.set("return_to", returnTo);
  }

  const queryString = params.toString();
  return queryString.length > 0 ? `/login?${queryString}` : "/login";
}

export function ProtectedRoute({
  allowedRoles,
  requiredPermission,
  children
}: Readonly<{
  allowedRoles?: AuthRole[];
  requiredPermission?: DirectoryCapabilityKey;
  children: React.ReactNode;
}>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isReady, session } = useAuth();
  const { t } = useI18n();

  const returnTo = useMemo(() => resolveReturnTo(pathname, searchParams.toString()), [pathname, searchParams]);
  const hasRequiredPermission = !requiredPermission || hasDirectoryCapability(session, requiredPermission);
  const hasAllowedRole = !allowedRoles || (session ? allowedRoles.includes(session.role) : false);
  const isAuthorized = Boolean(session) && hasAllowedRole && hasRequiredPermission;
  const sessionRoleLabel =
    session?.role === "super_admin"
      ? t("auth.roles.superAdmin")
      : session?.role === "reviewer"
        ? t("auth.roles.reviewer")
        : t("auth.roles.operator");

  useEffect(() => {
    if (!isReady || session) {
      return;
    }

    router.replace(resolveLoginHref(returnTo) as Route);
  }, [isReady, returnTo, router, session]);

  if (isReady && session && isAuthorized) {
    return <>{children}</>;
  }

  if (isReady && session && !isAuthorized) {
    return (
      <ConsoleShell>
        <PageTitleSync title={t("auth.guard.unauthorizedPageTitle")} />
        <div className="mx-auto flex min-h-[calc(100vh-180px)] w-full max-w-[640px] items-center">
          <Card className="w-full rounded-[28px] border-slate-200 shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
            <CardHeader className="space-y-4 pb-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-[30px] font-semibold tracking-tight text-slate-950">
                  {t("auth.guard.unauthorizedTitle")}
                </CardTitle>
                <div className="mt-2 text-sm leading-6 text-slate-500">{t("auth.guard.unauthorizedDescription")}</div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {t("auth.guard.unauthorizedRole", { role: sessionRoleLabel })}
              </div>
              <div className="flex flex-wrap gap-3">
                <Button asChild type="button">
                  <Link href="/">
                    {t("shell.userMenu.home")}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild type="button" variant="outline">
                  <Link href="/chat">
                    {t("shell.nav.chat")}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </ConsoleShell>
    );
  }

  return (
    <ConsoleShell>
      <PageTitleSync title={t("auth.title")} />
      <div className="mx-auto flex min-h-[calc(100vh-180px)] w-full max-w-[560px] items-center">
        <Card className="w-full rounded-[28px] border-slate-200 shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
          <CardHeader className="space-y-4 pb-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              <LockKeyhole className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-[30px] font-semibold tracking-tight text-slate-950">
                {isReady ? t("auth.guard.redirectingTitle") : t("auth.guard.restoringTitle")}
              </CardTitle>
              <div className="mt-2 text-sm leading-6 text-slate-500">
                {isReady ? t("auth.guard.redirectingDescription") : t("auth.guard.restoringDescription")}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="inline-flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <LoaderCircle className="h-4 w-4 animate-spin text-blue-600" />
              {isReady ? t("auth.guard.redirectingStatus") : t("auth.guard.restoringStatus")}
            </div>
          </CardContent>
        </Card>
      </div>
    </ConsoleShell>
  );
}
