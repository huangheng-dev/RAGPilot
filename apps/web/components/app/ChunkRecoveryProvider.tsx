"use client";

import { useEffect, type ReactNode } from "react";

const RECOVERY_STORAGE_KEY = "ragpilot-chunk-recovery";
const RECOVERY_WINDOW_MS = 15000;

function readErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "";
}

function isChunkLoadFailure(message: string) {
  const normalizedMessage = message.trim().toLowerCase();
  if (!normalizedMessage) {
    return false;
  }

  return (
    normalizedMessage.includes("chunkloaderror") ||
    normalizedMessage.includes("loading chunk") ||
    normalizedMessage.includes("failed to fetch dynamically imported module")
  );
}

function shouldReloadOnce() {
  const currentTime = Date.now();
  const currentPath = window.location.pathname;

  try {
    const rawValue = window.sessionStorage.getItem(RECOVERY_STORAGE_KEY);
    if (!rawValue) {
      window.sessionStorage.setItem(
        RECOVERY_STORAGE_KEY,
        JSON.stringify({ path: currentPath, timestamp: currentTime })
      );
      return true;
    }

    const parsedValue = JSON.parse(rawValue) as { path?: string; timestamp?: number };
    const lastTimestamp =
      typeof parsedValue.timestamp === "number" && Number.isFinite(parsedValue.timestamp)
        ? parsedValue.timestamp
        : 0;

    if (parsedValue.path !== currentPath || currentTime - lastTimestamp > RECOVERY_WINDOW_MS) {
      window.sessionStorage.setItem(
        RECOVERY_STORAGE_KEY,
        JSON.stringify({ path: currentPath, timestamp: currentTime })
      );
      return true;
    }
  } catch {
    window.sessionStorage.setItem(
      RECOVERY_STORAGE_KEY,
      JSON.stringify({ path: currentPath, timestamp: currentTime })
    );
    return true;
  }

  return false;
}

export function ChunkRecoveryProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const handleChunkFailure = (message: string) => {
      if (!isChunkLoadFailure(message)) {
        return;
      }

      if (shouldReloadOnce()) {
        window.location.reload();
      }
    };

    const handleWindowError = (event: ErrorEvent) => {
      handleChunkFailure(readErrorMessage(event.error) || event.message);
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      handleChunkFailure(readErrorMessage(event.reason));
    };

    window.addEventListener("error", handleWindowError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      window.removeEventListener("error", handleWindowError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, []);

  return children;
}
