"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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
      // Local session cleanup should still complete even when the backend session is already unavailable.
    } finally {
      signOut();
      setIsUserMenuOpen(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f4f8ff] text-slate-950 transition-colors dark:bg-slate-950 dark:text-slate-50">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/92 backdrop-blur dark:border-slate-800 dark:bg-slate-950/92">
        <div className="relative flex min-h-[78px] w-full items-center justify-between gap-4 px-2.5 sm:px-3 md:px-4">
          <Link className="flex min-w-0 items-center gap-3" href="/">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-400 text-white shadow-sm">
              <Sparkles className="h-5 w-5" />
            </div>
            <span className="text-[30px] font-semibold tracking-tight text-slate-950 dark:text-slate-50">RagPilot</span>
          </Link>

          <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-2 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:flex">
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
                    "h-10 min-w-[112px] rounded-xl px-4",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:text-primary-foreground"
                      : "bg-transparent text-slate-600 hover:bg-white hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-50"
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

          <div className="flex items-center gap-2">
            <Button
              className="h-10 w-10 rounded-xl bg-white dark:border-slate-800 dark:bg-slate-900"
              onClick={toggleThemeMode}
              size="icon"
              type="button"
              variant="outline"
            >
              {themeMode === "dark" ? <SunMedium className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>

            <Select onValueChange={(value) => setLanguage(value as "en" | "zh-CN")} value={language}>
              <SelectTrigger className="h-10 w-[144px] rounded-xl bg-white dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                  <SelectValue placeholder={t("shell.languagePlaceholder")} />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">{t("shell.languages.en")}</SelectItem>
                <SelectItem value="zh-CN">{t("shell.languages.zhCN")}</SelectItem>
              </SelectContent>
            </Select>

            {repositoryUrl ? (
              <Button asChild className="h-10 w-10 rounded-xl bg-white dark:border-slate-800 dark:bg-slate-900" size="icon" type="button" variant="outline">
                <a aria-label={t("shell.actions.openRepository")} href={repositoryUrl} rel="noreferrer" target="_blank">
                  <Github className="h-4 w-4" />
                </a>
              </Button>
            ) : null}

            {session ? (
              <div className="relative" ref={userMenuRef}>
                <Button
                  className="h-10 rounded-xl bg-white px-2.5 dark:border-slate-800 dark:bg-slate-900"
                  onClick={() => setIsUserMenuOpen((currentValue) => !currentValue)}
                  type="button"
                  variant="outline"
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {userInitials || <UserCircle2 className="h-4 w-4" />}
                  </div>
                  <ChevronDown className="h-4 w-4 text-slate-500" />
                </Button>

                {isUserMenuOpen ? (
                  <div className="absolute right-0 top-[calc(100%+10px)] w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_20px_60px_rgba(15,23,42,0.16)] dark:border-slate-800 dark:bg-slate-950">
                    <div className="rounded-xl bg-slate-50 px-3 py-3 dark:bg-slate-900">
                      <div className="text-sm font-semibold text-slate-950 dark:text-slate-50">{session.displayName}</div>
                      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{session.email}</div>
                    </div>

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
              <Button asChild className="h-10 rounded-xl bg-white px-4 dark:border-slate-800 dark:bg-slate-900" variant="outline">
                <Link href="/login">
                  <UserCircle2 className="h-4 w-4" />
                  {t("shell.userMenu.signIn")}
                </Link>
              </Button>
            )}
          </div>
        </div>

        <div className="border-t border-slate-200/80 px-2.5 py-3 dark:border-slate-800 md:hidden">
          <div className="flex w-full items-center gap-2 overflow-x-auto">
            <nav className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-800 dark:bg-slate-900">
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
                      "h-10 shrink-0 rounded-xl px-4",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:text-primary-foreground"
                        : "bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-950 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
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

      <div className="flex-1 overflow-y-auto px-5 py-6 md:px-8">{children}</div>
    </div>
  );
}
