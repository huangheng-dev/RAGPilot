"use client";

import { useEffect, useRef } from "react";

import { useNotifications, type NotificationTone } from "@/lib/notifications/provider";

type UseStatusNotificationsOptions = {
  skipInitialStatus?: boolean;
  statusTone?: NotificationTone;
};

export function useStatusNotifications(
  statusMessage: string | null | undefined,
  errorMessage: string | null | undefined,
  options: UseStatusNotificationsOptions = {}
) {
  const { error, notify } = useNotifications();
  const lastStatusRef = useRef<string | null>(null);
  const lastErrorRef = useRef<string | null>(null);
  const initialStatusSkippedRef = useRef(false);
  const { skipInitialStatus = true, statusTone = "info" } = options;

  useEffect(() => {
    if (!errorMessage || errorMessage === lastErrorRef.current) {
      return;
    }

    error(errorMessage);
    lastErrorRef.current = errorMessage;
  }, [error, errorMessage]);

  useEffect(() => {
    if (!statusMessage || errorMessage || statusMessage === lastStatusRef.current) {
      return;
    }

    if (skipInitialStatus && !initialStatusSkippedRef.current) {
      initialStatusSkippedRef.current = true;
      lastStatusRef.current = statusMessage;
      return;
    }

    notify({
      description: statusMessage,
      tone: statusTone
    });
    lastStatusRef.current = statusMessage;
  }, [errorMessage, notify, skipInitialStatus, statusMessage, statusTone]);
}
