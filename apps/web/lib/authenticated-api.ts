"use client";

import { readApiErrorMessage } from "@/lib/api-errors";
import {
  buildSessionAuthHeaders,
  clearStoredAuthSessionWithReason,
  resolveAuthExitReasonFromErrorMessage
} from "@/lib/local-session";

export function buildApiBaseUrl() {
  const configuredBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (configuredBaseUrl && configuredBaseUrl.length > 0) {
    return configuredBaseUrl.endsWith("/api/v1") ? configuredBaseUrl : `${configuredBaseUrl}/api/v1`;
  }

  if (typeof window !== "undefined") {
    const hostname = window.location.hostname.toLowerCase();
    const isLocalHost = hostname === "localhost" || hostname === "127.0.0.1";
    const baseUrl = isLocalHost ? "http://127.0.0.1:18000" : window.location.origin;
    return `${baseUrl}/api/v1`;
  }

  const fallbackBaseUrl = "http://127.0.0.1:18000";
  const baseUrl = fallbackBaseUrl;
  return baseUrl.endsWith("/api/v1") ? baseUrl : `${baseUrl}/api/v1`;
}

export const apiBaseUrl = buildApiBaseUrl();

async function handleApiFailure(response: Response): Promise<never> {
  const errorMessage = await readApiErrorMessage(response);

  if (response.status === 401) {
    const exitReason = resolveAuthExitReasonFromErrorMessage(errorMessage) ?? "session_revoked";
    clearStoredAuthSessionWithReason(exitReason);
  }

  throw new Error(errorMessage);
}

export async function authenticatedFetch(path: string, init?: RequestInit) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      headers: {
        ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
        ...buildSessionAuthHeaders(init?.headers)
      },
      cache: "no-store"
  });

  if (!response.ok) {
    return await handleApiFailure(response);
  }

  return response;
}

export async function authenticatedApiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await authenticatedFetch(path, init);
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export async function authenticatedApiRequestWithHeaders<T>(
  path: string,
  init?: RequestInit
): Promise<{ data: T; headers: Headers }> {
  const response = await authenticatedFetch(path, init);
  return {
    data: (await response.json()) as T,
    headers: response.headers
  };
}

export function authenticatedUpload<T>(
  path: string,
  body: FormData,
  onProgress: (percent: number) => void,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", `${apiBaseUrl}${path}`);
    Object.entries(buildSessionAuthHeaders()).forEach(([key, value]) => request.setRequestHeader(key, value));
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
      }
    });
    request.addEventListener("load", () => {
      if (request.status >= 200 && request.status < 300) {
        try {
          resolve(JSON.parse(request.responseText) as T);
        } catch {
          reject(new Error("Upload completed with an invalid response."));
        }
        return;
      }
      try {
        const payload = JSON.parse(request.responseText) as { detail?: string; message?: string };
        reject(new Error(payload.detail ?? payload.message ?? `Upload failed with status ${request.status}.`));
      } catch {
        reject(new Error(`Upload failed with status ${request.status}.`));
      }
    });
    request.addEventListener("error", () => reject(new Error("Upload failed because the network connection was interrupted.")));
    request.addEventListener("abort", () => reject(new Error("Upload was cancelled.")));
    request.send(body);
  });
}
