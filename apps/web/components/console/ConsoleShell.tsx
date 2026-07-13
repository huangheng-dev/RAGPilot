"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  ChevronDown,
  FileText,
  Globe,
  Github,
  LayoutDashboard,
  MessageSquareText,
  Moon,
  Settings,
  ShieldCheck,
  Sparkles,
  SunMedium,
  UserCircle2,
  Waypoints
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { revokeCurrentDirectorySession } from "@/lib/auth-directory";
import { hasDirectoryCapability } from "@/lib/auth/access";
import { useAuth } from "@/lib/auth/provider";
import { useI18n } from "@/lib/i18n/provider";
import { usePreferences } from "@/lib/preferences/provider";
import { cn } from "@/lib/utils";
import { readWorkspaceView } from "@/lib/workspace-navigation";
import { readCurrentTenantId, writeCurrentTenantId } from "@/lib/tenant-scope";

type ConsoleShellProps = {
  activeHref?: "/" | "/workspace" | "/chat" | "/documents" | "/agents" | "/operations" | "/admin" | "/settings";
  children: React.ReactNode;
};

type WorkspaceView = "chat" | "documents" | "workflows";

const repositoryUrl = process.env.NEXT_PUBLIC_GIT_REPOSITORY_URL?.trim() || null;

export function ConsoleShell({ activeHref, children }: ConsoleShellProps) {
  const pathname = usePathname();
  const { language, setLanguage, t } = useI18n();
  const { session, signOut } = useAuth();
  const { themeMode, toggleThemeMode } = usePreferences();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [locationSearch, setLocationSearch] = useState("");
  const [currentTenantId, setCurrentTenantId] = useState("");
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  const primaryNavigation: Array<{
    href: "/" | "/chat" | "/documents" | "/agents";
    icon: typeof MessageSquareText;
    label: string;
    match: "home" | "chat" | "documents" | "agents";
  }> = [
    { href: "/", icon: LayoutDashboard, label: t("shell.nav.home"), match: "home" },
    { href: "/chat", icon: MessageSquareText, label: t("shell.nav.chat"), match: "chat" },
    { href: "/documents", icon: FileText, label: t("shell.nav.documents"), match: "documents" },
    { href: "/agents", icon: Bot, label: t("shell.nav.agents"), match: "agents" }
  ];

  const activeWorkspaceView = readWorkspaceView(new URLSearchParams(locationSearch).get("view"));

  useEffect(() => {
    const nextLocationSearch = window.location.search;
    setLocationSearch((currentValue) => (currentValue === nextLocationSearch ? currentValue : nextLocationSearch));
  });

  useEffect(() => {
    setIsUserMenuOpen(false);
  }, [locationSearch, pathname]);

  useEffect(() => {
    if (!isUserMenuOpen) {
      return;
    }

    function handleOutsidePointerDown(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsidePointerDown);
    return () => {
      document.removeEventListener("mousedown", handleOutsidePointerDown);
    };
  }, [isUserMenuOpen]);

  const activeMemberships = useMemo(
    () => (session?.memberships ?? []).filter((membership) => membership.membership_status === "active"),
    [session?.memberships],
  );

  useEffect(() => {
    const storedTenantId = readCurrentTenantId();
    const nextTenantId = activeMemberships.some((membership) => membership.tenant_id === storedTenantId)
      ? storedTenantId
      : (activeMemberships[0]?.tenant_id ?? "");
    setCurrentTenantId(nextTenantId);
    if (nextTenantId) writeCurrentTenantId(nextTenantId);
  }, [activeMemberships]);

  function handleTenantChange(tenantId: string) {
    setCurrentTenantId(tenantId);
    writeCurrentTenantId(tenantId);
    const nextUrl = new URL(window.location.href);
    const tenantAwarePaths = ["/", "/chat", "/documents", "/agents", "/operations"];
    if (!tenantAwarePaths.includes(pathname)) {
      nextUrl.pathname = "/";
      nextUrl.search = "";
    }
    nextUrl.searchParams.set("tenant_id", tenantId);
    ["workspace_id", "knowledge_base_id", "conversation_id", "document_id", "agent_id", "workflow_run_id"].forEach((key) => nextUrl.searchParams.delete(key));
    window.location.assign(nextUrl.toString());
  }

  const userInitials = session?.displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  async function handleSignOut() {
    try {
      if (session?.sessionToken) {
        await revokeCurrentDirectorySession();
      }
    } catch {
      // Let local sign-out finish even if the backend session is already gone.
    } finally {
      signOut();
      setIsUserMenuOpen(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f4f8ff] text-slate-950 transition-colors dark:bg-slate-950 dark:text-slate-50">
      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/85 shadow-[0_1px_0_rgba(15,23,42,0.02)] backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-950/85">
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-blue-300/50 to-transparent dark:via-blue-700/40" />
        <div className="relative flex h-16 w-full items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <Link className="group flex min-w-0 items-center gap-2.5" href="/">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 via-blue-500 to-cyan-400 text-white shadow-[0_8px_24px_rgba(37,99,235,0.24)] transition-transform group-hover:scale-[1.03]">
              <Sparkles className="h-[18px] w-[18px]" />
            </div>
            <span className="hidden text-xl font-semibold tracking-[-0.025em] text-slate-950 sm:inline dark:text-slate-50">RAGPilot</span>
          </Link>

          <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 rounded-xl bg-slate-100/80 p-1 ring-1 ring-slate-200/60 dark:bg-slate-900/80 dark:ring-slate-800 lg:flex">
            {primaryNavigation.map((item) => {
              const Icon = item.icon;
              const isActive = (() => {
                if (item.match === "home") {
                  return pathname === "/";
                }

                if (item.match === "agents") {
                  return pathname === "/agents";
                }

                if (pathname === item.href) {
                  return true;
                }

                return pathname === "/workspace" && activeWorkspaceView === item.match;
              })();

              return (
                <Button
                  asChild
                  className={cn(
                    "h-9 min-w-[96px] rounded-lg px-3 text-sm font-medium xl:min-w-[108px]",
                    isActive
                      ? "bg-white text-blue-700 shadow-[0_1px_4px_rgba(15,23,42,0.09)] hover:bg-white hover:text-blue-700 dark:bg-slate-800 dark:text-blue-300"
                      : "bg-transparent text-slate-500 hover:bg-white/70 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-800/70 dark:hover:text-slate-50"
                  )}
                  key={item.label}
                  variant="ghost"
                >
                  <Link aria-current={isActive ? "page" : undefined} href={item.href}>
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                </Button>
              );
            })}
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <Button
              aria-label={themeMode === "dark" ? "Light mode" : "Dark mode"}
              className="h-9 w-9 rounded-lg border-transparent bg-transparent text-slate-500 shadow-none hover:bg-slate-100 hover:text-slate-900 dark:bg-transparent dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-50"
              onClick={toggleThemeMode}
              size="icon"
              type="button"
              variant="outline"
            >
              {themeMode === "dark" ? <SunMedium className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>

            <Select onValueChange={(value) => setLanguage(value as "en" | "zh-CN")} value={language}>
              <SelectTrigger aria-label={t("shell.languagePlaceholder")} className="h-9 w-9 rounded-lg border-transparent bg-transparent px-0 shadow-none sm:w-[126px] sm:px-2.5 dark:bg-transparent">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                  <span className="hidden sm:inline">
                    <SelectValue placeholder={t("shell.languagePlaceholder")} />
                  </span>
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">{t("shell.languages.en")}</SelectItem>
                <SelectItem value="zh-CN">{t("shell.languages.zhCN")}</SelectItem>
              </SelectContent>
            </Select>

            {repositoryUrl ? (
              <Button asChild className="hidden h-9 w-9 rounded-lg border-transparent bg-transparent text-slate-500 shadow-none hover:bg-slate-100 hover:text-slate-900 dark:bg-transparent dark:text-slate-400 dark:hover:bg-slate-800 md:inline-flex" size="icon" type="button" variant="outline">
                <a aria-label={t("shell.actions.openRepository")} href={repositoryUrl} rel="noreferrer" target="_blank">
                  <Github className="h-4 w-4" />
                </a>
              </Button>
            ) : null}

            {session ? (
              <div className="relative" ref={userMenuRef}>
                <Button
                  className="h-9 rounded-lg border-transparent bg-slate-100/80 px-1.5 shadow-none hover:bg-slate-200/70 dark:bg-slate-900 dark:hover:bg-slate-800"
                  onClick={() => setIsUserMenuOpen((currentValue) => !currentValue)}
                  type="button"
                  variant="outline"
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-xs font-semibold text-blue-700 shadow-sm dark:bg-slate-800 dark:text-blue-300">
                    {userInitials || <UserCircle2 className="h-4 w-4" />}
                  </div>
                  <ChevronDown className="h-4 w-4 text-slate-500" />
                </Button>

                {isUserMenuOpen ? (
                  <div className="absolute right-0 top-[calc(100%+10px)] w-64 rounded-xl border border-slate-200/80 bg-white/95 p-2 shadow-[0_20px_60px_rgba(15,23,42,0.16)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/95">
                    <div className="rounded-xl bg-slate-50 px-3 py-3 dark:bg-slate-900">
                      <div className="text-sm font-semibold text-slate-950 dark:text-slate-50">{session.displayName}</div>
                      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{session.email}</div>
                    </div>

                    {activeMemberships.length > 0 ? (
                      <div className="mt-2 rounded-xl border border-slate-200/80 p-2 dark:border-slate-800">
                        <div className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                          {t("shell.userMenu.currentTenant")}
                        </div>
                        {activeMemberships.length > 1 ? (
                          <Select onValueChange={handleTenantChange} value={currentTenantId}>
                            <SelectTrigger className="h-9 w-full bg-white"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {activeMemberships.map((membership) => (
                                <SelectItem key={membership.id} value={membership.tenant_id}>{membership.tenant_name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="truncate px-1 pb-1 text-sm font-medium text-slate-700 dark:text-slate-200">
                            {activeMemberships[0].tenant_name}
                          </div>
                        )}
                      </div>
                    ) : null}

                    <div className="mt-2 space-y-1">
                      <Link
                        className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-600 transition hover:bg-slate-50 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-slate-50"
                        href="/operations"
                      >
                        <Waypoints className="h-4 w-4" />
                        {t("shell.userMenu.operations")}
                      </Link>
                      {hasDirectoryCapability(session, "access_admin_console") ? (
                        <Link
                          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-600 transition hover:bg-slate-50 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-slate-50"
                          href="/admin"
                        >
                          <ShieldCheck className="h-4 w-4" />
                          {t("shell.userMenu.admin")}
                        </Link>
                      ) : null}
                      <Link
                        className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-600 transition hover:bg-slate-50 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-slate-50"
                        href="/settings"
                      >
                        <Settings className="h-4 w-4" />
                        {t("shell.userMenu.settings")}
                      </Link>
                      <button
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-slate-600 transition hover:bg-slate-50 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-slate-50"
                        onClick={() => void handleSignOut()}
                        type="button"
                      >
                        <UserCircle2 className="h-4 w-4" />
                        {t("shell.userMenu.signOut")}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <Button asChild className="h-9 rounded-lg px-3" variant="outline">
                <Link href="/login">
                  <UserCircle2 className="h-4 w-4" />
                  {t("shell.userMenu.signIn")}
                </Link>
              </Button>
            )}
          </div>
        </div>

        <div className="border-t border-slate-200/60 px-2 py-2 dark:border-slate-800 lg:hidden sm:px-4">
          <div className="flex w-full items-center overflow-x-auto">
            <nav className="flex min-w-full items-center justify-start gap-1 overflow-x-auto rounded-xl bg-slate-100/70 p-1 dark:bg-slate-900/70 sm:justify-center">
              {primaryNavigation.map((item) => {
                const Icon = item.icon;
                const isActive = (() => {
                  if (item.match === "home") {
                    return pathname === "/";
                  }

                  if (item.match === "agents") {
                    return pathname === "/agents";
                  }

                  if (pathname === item.href) {
                    return true;
                  }

                  return pathname === "/workspace" && activeWorkspaceView === item.match;
                })();

                return (
                  <Button
                    asChild
                    className={cn(
                      "h-9 shrink-0 rounded-lg border-transparent px-3 text-sm font-medium shadow-none",
                      isActive
                        ? "bg-white text-blue-700 shadow-sm hover:bg-white hover:text-blue-700 dark:bg-slate-800 dark:text-blue-300"
                        : "bg-transparent text-slate-500 hover:bg-white/70 hover:text-slate-950 dark:bg-transparent dark:text-slate-400"
                    )}
                    key={`${item.label}-mobile`}
                    variant="outline"
                  >
                    <Link aria-current={isActive ? "page" : undefined} href={item.href}>
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  </Button>
                );
              })}
            </nav>
          </div>
        </div>
      </header>

      <div className="min-w-0 flex-1 overflow-y-auto px-3 py-4 sm:px-5 sm:py-5 md:px-8 md:py-6">{children}</div>
    </div>
  );
}
