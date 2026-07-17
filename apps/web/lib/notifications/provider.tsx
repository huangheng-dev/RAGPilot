"use client";

import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";

import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/provider";

export type NotificationTone = "success" | "error" | "info";

type NotificationInput = {
  description: string;
  durationMs?: number;
  title?: string;
  tone?: NotificationTone;
};

type NotificationRecord = NotificationInput & {
  id: string;
  tone: NotificationTone;
};

type NotificationContextValue = {
  dismiss: (id: string) => void;
  error: (input: Omit<NotificationInput, "tone"> | string) => string;
  info: (input: Omit<NotificationInput, "tone"> | string) => string;
  notify: (input: NotificationInput) => string;
  success: (input: Omit<NotificationInput, "tone"> | string) => string;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

function readNotificationInput(
  input: Omit<NotificationInput, "tone"> | string,
  tone: NotificationTone
): NotificationInput {
  return typeof input === "string" ? { description: input, tone } : { ...input, tone };
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const timerMapRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    const timer = timerMapRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timerMapRef.current.delete(id);
    }
    setNotifications((current) => current.filter((notification) => notification.id !== id));
  }, []);

  const notify = useCallback(
    ({ description, durationMs = 3200, title, tone = "info" }: NotificationInput) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setNotifications((current) => [...current, { id, description, durationMs, title, tone }]);
      const timer = setTimeout(() => dismiss(id), durationMs);
      timerMapRef.current.set(id, timer);
      return id;
    },
    [dismiss]
  );

  const value = useMemo<NotificationContextValue>(
    () => ({
      dismiss,
      error: (input) => notify(readNotificationInput(input, "error")),
      info: (input) => notify(readNotificationInput(input, "info")),
      notify,
      success: (input) => notify(readNotificationInput(input, "success"))
    }),
    [dismiss, notify]
  );

  useEffect(
    () => () => {
      for (const timer of timerMapRef.current.values()) {
        clearTimeout(timer);
      }
      timerMapRef.current.clear();
    },
    []
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex justify-center px-4">
        <div className="flex w-full max-w-2xl flex-col gap-3">
          {notifications.map((notification) => {
            const Icon =
              notification.tone === "success"
                ? CheckCircle2
                : notification.tone === "error"
                  ? AlertCircle
                  : Info;

            return (
              <div
                className={cn(
                  "pointer-events-auto flex items-start gap-3 rounded-2xl border bg-white/95 px-4 py-3 shadow-lg backdrop-blur animate-in fade-in slide-in-from-top-3",
                  notification.tone === "success" && "border-emerald-200 text-emerald-900",
                  notification.tone === "error" && "border-rose-200 text-rose-900",
                  notification.tone === "info" && "border-slate-200 text-slate-900"
                )}
                key={notification.id}
                role={notification.tone === "error" ? "alert" : "status"}
              >
                <div
                  className={cn(
                    "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                    notification.tone === "success" && "bg-emerald-50 text-emerald-600",
                    notification.tone === "error" && "bg-rose-50 text-rose-600",
                    notification.tone === "info" && "bg-slate-100 text-slate-600"
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  {notification.title ? (
                    <div className="text-sm font-semibold leading-6">{notification.title}</div>
                  ) : null}
                  <div className="text-sm leading-6 text-slate-600">{notification.description}</div>
                </div>
                <button
                  className="rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                  onClick={() => dismiss(notification.id)}
                  type="button"
                >
                  <span className="sr-only">{t("shell.actions.dismissNotification")}</span>
                  <span aria-hidden="true" className="text-base leading-none">
                    ×
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);

  if (!context) {
    throw new Error("useNotifications must be used within NotificationProvider.");
  }

  return context;
}
