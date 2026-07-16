"use client";

import { authenticatedApiRequest } from "@/lib/authenticated-api";

export type AccessGroup = {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  description: string | null;
  member_user_ids: string[];
  created_at: string;
  updated_at: string;
};

export type AccessGrant = {
  id?: string;
  user_id: string | null;
  group_id: string | null;
  permission?: "read";
};

export type ResourceAccessPolicy = {
  tenant_id: string;
  resource_type: "document" | "document_chunk";
  resource_id: string;
  access_scope: "tenant" | "inherit" | "restricted";
  grants: AccessGrant[];
};

export function listAccessGroups(tenantId: string) {
  return authenticatedApiRequest<AccessGroup[]>(`/access-control/groups?tenant_id=${encodeURIComponent(tenantId)}`);
}

export function createAccessGroup(payload: { tenant_id: string; name: string; slug: string; description?: string | null }) {
  return authenticatedApiRequest<AccessGroup>("/access-control/groups", { method: "POST", body: JSON.stringify(payload) });
}

export function setAccessGroupMember(tenantId: string, groupId: string, userId: string, enabled: boolean) {
  return authenticatedApiRequest<void>(`/access-control/groups/${groupId}/members/${userId}`, {
    method: enabled ? "PUT" : "DELETE",
    body: JSON.stringify({ tenant_id: tenantId })
  });
}

export function getResourceAccessPolicy(tenantId: string, resourceType: "document" | "chunk", resourceId: string) {
  return authenticatedApiRequest<ResourceAccessPolicy>(
    `/access-control/${resourceType === "document" ? "documents" : "chunks"}/${resourceId}?tenant_id=${encodeURIComponent(tenantId)}`
  );
}

export function updateResourceAccessPolicy(
  tenantId: string,
  resourceType: "document" | "chunk",
  resourceId: string,
  accessScope: "tenant" | "inherit" | "restricted",
  grants: AccessGrant[]
) {
  return authenticatedApiRequest<ResourceAccessPolicy>(
    `/access-control/${resourceType === "document" ? "documents" : "chunks"}/${resourceId}`,
    {
      method: "PUT",
      body: JSON.stringify({
        tenant_id: tenantId,
        access_scope: accessScope,
        grants: grants.map(({ user_id, group_id }) => ({ user_id, group_id }))
      })
    }
  );
}
