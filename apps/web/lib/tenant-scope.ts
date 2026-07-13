"use client";

const CURRENT_TENANT_STORAGE_KEY = "ragpilot-current-tenant";

export function readCurrentTenantId() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(CURRENT_TENANT_STORAGE_KEY)?.trim() ?? "";
}

export function writeCurrentTenantId(tenantId: string | null | undefined) {
  if (typeof window === "undefined") return;
  const normalizedTenantId = tenantId?.trim() ?? "";
  if (normalizedTenantId) window.localStorage.setItem(CURRENT_TENANT_STORAGE_KEY, normalizedTenantId);
  else window.localStorage.removeItem(CURRENT_TENANT_STORAGE_KEY);
}
