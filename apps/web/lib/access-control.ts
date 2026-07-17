"use client";

import { authenticatedApiRequest, authenticatedApiRequestWithHeaders } from "@/lib/authenticated-api";

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

export type AccessControlWorkspace = {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  is_archived?: boolean;
};

export type AccessControlKnowledgeBase = {
  id: string;
  tenant_id: string;
  workspace_id: string;
  name: string;
  slug: string;
};

export type AccessControlDocument = {
  id: string;
  tenant_id: string;
  knowledge_base_id: string;
  title: string;
  source_kind: "file" | "web" | "other";
  ingestion_status: string;
  indexing_status: string;
  updated_at: string;
};

export type AccessControlDocumentChunk = {
  id: string;
  document_version_id: string;
  chunk_index: number;
  content: string;
  token_count: number | null;
};

export type AccessControlDocumentDetail = {
  document: AccessControlDocument;
  chunks: AccessControlDocumentChunk[];
};

export type AccessControlResourceCatalog = {
  workspaces: AccessControlWorkspace[];
  knowledgeBases: AccessControlKnowledgeBase[];
  documents: AccessControlDocument[];
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

export async function listAccessControlDocuments(knowledgeBaseId: string) {
  const pageSize = 200;
  const documents: AccessControlDocument[] = [];
  let offset = 0;
  let totalCount = Number.POSITIVE_INFINITY;

  while (documents.length < totalCount) {
    const query = new URLSearchParams({
      knowledge_base_id: knowledgeBaseId,
      lifecycle: "active",
      sort: "title-asc",
      limit: String(pageSize),
      offset: String(offset)
    });
    const response = await authenticatedApiRequestWithHeaders<AccessControlDocument[]>(`/documents?${query.toString()}`);
    documents.push(...response.data);
    totalCount = Number.parseInt(response.headers.get("X-Total-Count") ?? String(response.data.length), 10);
    if (response.data.length === 0) break;
    offset += response.data.length;
  }

  return documents;
}

export async function loadAccessControlResourceCatalog(tenantId: string): Promise<AccessControlResourceCatalog> {
  const workspaces = await authenticatedApiRequest<AccessControlWorkspace[]>(
    `/workspaces?tenant_id=${encodeURIComponent(tenantId)}&is_archived=false`
  );
  const knowledgeBaseLists = await Promise.all(
    workspaces.map((workspace) => authenticatedApiRequest<AccessControlKnowledgeBase[]>(
      `/knowledge-bases?workspace_id=${encodeURIComponent(workspace.id)}`
    ))
  );
  const knowledgeBases = knowledgeBaseLists.flat();

  return {
    workspaces,
    knowledgeBases,
    documents: []
  };
}

export function getAccessControlDocumentDetail(documentId: string, knowledgeBaseId: string) {
  const query = new URLSearchParams({ knowledge_base_id: knowledgeBaseId });
  return authenticatedApiRequest<AccessControlDocumentDetail>(
    `/documents/${encodeURIComponent(documentId)}?${query.toString()}`
  );
}
