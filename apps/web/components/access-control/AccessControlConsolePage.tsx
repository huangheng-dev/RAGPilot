"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Database,
  FileKey2,
  LoaderCircle,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  UserPlus,
  UsersRound,
  X
} from "lucide-react";

import {
  ConsoleEmptyState,
  ConsoleMetricCard,
  ConsoleMetricGrid,
  ConsolePage,
  ConsolePageHeader,
  ConsoleStatusBar,
  ConsoleSurface,
  ConsoleSurfaceHeader
} from "@/components/console/ConsolePrimitives";
import { ConsoleShell } from "@/components/console/ConsoleShell";
import { PageTitleSync } from "@/components/console/PageTitleSync";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { DirectoryUser } from "@/lib/auth-directory";
import {
  createAccessGroup,
  getAccessControlDocumentDetail,
  getResourceAccessPolicy,
  listAccessGroups,
  listAccessControlDocuments,
  loadAccessControlResourceCatalog,
  setAccessGroupMember,
  updateResourceAccessPolicy,
  type AccessControlDocumentChunk,
  type AccessControlResourceCatalog,
  type AccessGrant,
  type AccessGroup,
  type ResourceAccessPolicy
} from "@/lib/access-control";
import { authenticatedApiRequest } from "@/lib/authenticated-api";
import { useI18n } from "@/lib/i18n/provider";
import { useNotifications } from "@/lib/notifications/provider";
import { readCurrentTenantId, writeCurrentTenantId } from "@/lib/tenant-scope";
import { cn } from "@/lib/utils";

type Tenant = { id: string; name: string };
type ResourceType = "document" | "chunk";

const EMPTY_CATALOG: AccessControlResourceCatalog = { workspaces: [], knowledgeBases: [], documents: [] };

function normalizeSlug(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function sortGroups(groups: AccessGroup[]) {
  return [...groups].sort((left, right) => left.name.localeCompare(right.name));
}

function policyFingerprint(policy: ResourceAccessPolicy | null) {
  if (!policy) return "";
  const grants = policy.grants
    .map((grant) => `${grant.user_id ? `user:${grant.user_id}` : `group:${grant.group_id ?? ""}`}`)
    .sort();
  return JSON.stringify({ access_scope: policy.access_scope, grants });
}

function formatChunkPreview(chunk: AccessControlDocumentChunk) {
  const compact = chunk.content.replace(/\s+/g, " ").trim();
  return compact.length > 72 ? `${compact.slice(0, 72)}…` : compact;
}

export default function AccessControlConsolePage() {
  const searchParams = useSearchParams();
  const { language, t } = useI18n();
  const { error: notifyError, success: notifySuccess } = useNotifications();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tenantId, setTenantId] = useState("");
  const [users, setUsers] = useState<DirectoryUser[]>([]);
  const [groups, setGroups] = useState<AccessGroup[]>([]);
  const [catalog, setCatalog] = useState<AccessControlResourceCatalog>(EMPTY_CATALOG);
  const [catalogRevision, setCatalogRevision] = useState(0);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [memberUserId, setMemberUserId] = useState("");
  const [groupName, setGroupName] = useState("");
  const [groupSlug, setGroupSlug] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const [resourceType, setResourceType] = useState<ResourceType>("document");
  const [selectedKnowledgeBaseId, setSelectedKnowledgeBaseId] = useState("");
  const [selectedDocumentId, setSelectedDocumentId] = useState("");
  const [selectedChunkId, setSelectedChunkId] = useState("");
  const [documentSearch, setDocumentSearch] = useState("");
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
  const [chunks, setChunks] = useState<AccessControlDocumentChunk[]>([]);
  const [isLoadingChunks, setIsLoadingChunks] = useState(false);
  const [policy, setPolicy] = useState<ResourceAccessPolicy | null>(null);
  const [savedPolicy, setSavedPolicy] = useState<ResourceAccessPolicy | null>(null);
  const [grantType, setGrantType] = useState<"user" | "group">("group");
  const [grantSubjectId, setGrantSubjectId] = useState("");

  const selectedGroup = groups.find((group) => group.id === selectedGroupId) ?? null;
  const activeUsers = useMemo(() => users.filter((user) => (
    user.is_active && user.memberships.some((membership) => (
      membership.tenant_id === tenantId && membership.membership_status === "active"
    ))
  )), [tenantId, users]);
  const userById = useMemo(() => new Map(activeUsers.map((user) => [user.id, user])), [activeUsers]);
  const groupById = useMemo(() => new Map(groups.map((group) => [group.id, group])), [groups]);
  const workspaceById = useMemo(() => new Map(catalog.workspaces.map((workspace) => [workspace.id, workspace])), [catalog.workspaces]);
  const selectedDocument = catalog.documents.find((item) => item.id === selectedDocumentId) ?? null;
  const normalizedDocumentSearch = documentSearch.trim().toLowerCase();
  const visibleDocuments = useMemo(() => catalog.documents.filter((document) => (
    document.knowledge_base_id === selectedKnowledgeBaseId
    && (!normalizedDocumentSearch || document.title.toLowerCase().includes(normalizedDocumentSearch))
  )), [catalog.documents, normalizedDocumentSearch, selectedKnowledgeBaseId]);
  const selectedResourceId = resourceType === "document" ? selectedDocumentId : selectedChunkId;
  const isPolicyDirty = policyFingerprint(policy) !== policyFingerprint(savedPolicy);

  const loadTenantData = useCallback(async (nextTenantId: string, announce = false) => {
    if (!nextTenantId) return;
    setIsRefreshing(true);
    setLoadError(null);
    try {
      const [nextGroups, nextUsers, nextCatalog] = await Promise.all([
        listAccessGroups(nextTenantId),
        authenticatedApiRequest<DirectoryUser[]>(`/users?tenant_id=${encodeURIComponent(nextTenantId)}`),
        loadAccessControlResourceCatalog(nextTenantId)
      ]);
      setGroups(sortGroups(Array.isArray(nextGroups) ? nextGroups : []));
      setUsers(Array.isArray(nextUsers) ? nextUsers : []);
      setCatalog(nextCatalog);
      setCatalogRevision((current) => current + 1);
      setSelectedGroupId((current) => nextGroups.some((group) => group.id === current) ? current : (nextGroups[0]?.id ?? ""));
      setSelectedKnowledgeBaseId((current) => (
        nextCatalog.knowledgeBases.some((item) => item.id === current)
          ? current
          : (nextCatalog.knowledgeBases[0]?.id ?? "")
      ));
      setLastRefreshedAt(new Date());
      if (announce) notifySuccess(t("accessControl.status.refreshed"));
    } catch (error) {
      const message = error instanceof Error ? error.message : t("accessControl.status.loadFailed");
      setLoadError(message);
      notifyError(message);
    } finally {
      setIsRefreshing(false);
    }
  }, [notifyError, notifySuccess, t]);

  useEffect(() => {
    let mounted = true;
    authenticatedApiRequest<Tenant[]>("/tenants").then((items) => {
      if (!mounted) return;
      setTenants(items);
      const requested = searchParams.get("tenant_id") || readCurrentTenantId();
      const next = items.some((item) => item.id === requested) ? requested : (items[0]?.id ?? "");
      setTenantId(next);
      if (next) writeCurrentTenantId(next);
    }).catch((error) => notifyError(error instanceof Error ? error.message : t("accessControl.status.loadFailed")));
    return () => { mounted = false; };
  }, [notifyError, searchParams, t]);

  useEffect(() => {
    setPolicy(null);
    setSavedPolicy(null);
    setSelectedKnowledgeBaseId("");
    setSelectedDocumentId("");
    setSelectedChunkId("");
    setChunks([]);
    if (!tenantId) return;
    void loadTenantData(tenantId);
  }, [loadTenantData, tenantId]);

  useEffect(() => {
    if (!selectedKnowledgeBaseId) {
      setCatalog((current) => current.documents.length === 0 ? current : { ...current, documents: [] });
      setSelectedDocumentId("");
      return;
    }
    let cancelled = false;
    setIsLoadingDocuments(true);
    listAccessControlDocuments(selectedKnowledgeBaseId)
      .then((documents) => {
        if (cancelled) return;
        setCatalog((current) => ({ ...current, documents }));
        setSelectedDocumentId((current) => documents.some((document) => document.id === current) ? current : "");
      })
      .catch((error) => {
        if (!cancelled) notifyError(error instanceof Error ? error.message : t("accessControl.status.documentLoadFailed"));
      })
      .finally(() => { if (!cancelled) setIsLoadingDocuments(false); });
    return () => { cancelled = true; };
  }, [catalogRevision, notifyError, selectedKnowledgeBaseId, t]);

  useEffect(() => {
    if (!selectedKnowledgeBaseId) return;
    if (selectedDocument && selectedDocument.knowledge_base_id !== selectedKnowledgeBaseId) {
      setSelectedDocumentId("");
      setSelectedChunkId("");
      setPolicy(null);
      setSavedPolicy(null);
    }
  }, [selectedDocument, selectedKnowledgeBaseId]);

  useEffect(() => {
    if (resourceType !== "chunk" || !selectedDocument) {
      setChunks([]);
      setSelectedChunkId("");
      return;
    }
    let cancelled = false;
    setIsLoadingChunks(true);
    getAccessControlDocumentDetail(selectedDocument.id, selectedDocument.knowledge_base_id)
      .then((detail) => {
        if (cancelled) return;
        const nextChunks = Array.isArray(detail.chunks) ? detail.chunks : [];
        setChunks(nextChunks);
        setSelectedChunkId((current) => nextChunks.some((chunk) => chunk.id === current) ? current : "");
      })
      .catch((error) => {
        if (!cancelled) notifyError(error instanceof Error ? error.message : t("accessControl.status.chunkLoadFailed"));
      })
      .finally(() => { if (!cancelled) setIsLoadingChunks(false); });
    return () => { cancelled = true; };
  }, [notifyError, resourceType, selectedDocument, t]);

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible" && tenantId && !isBusy && !isRefreshing) {
        void loadTenantData(tenantId);
      }
    };
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [isBusy, isRefreshing, loadTenantData, tenantId]);

  async function handleCreateGroup() {
    const normalizedGroupSlug = normalizeSlug(groupSlug || groupName);
    if (!tenantId || !groupName.trim() || !normalizedGroupSlug) return;
    try {
      setIsBusy(true);
      const created = await createAccessGroup({
        tenant_id: tenantId,
        name: groupName.trim(),
        slug: normalizedGroupSlug,
        description: groupDescription.trim() || null
      });
      setGroups((current) => sortGroups([...current.filter((group) => group.id !== created.id), created]));
      setSelectedGroupId(created.id);
      setGroupName("");
      setGroupSlug("");
      setGroupDescription("");
      setLastRefreshedAt(new Date());
      notifySuccess(t("accessControl.status.groupCreated"));
    } catch (error) {
      notifyError(error instanceof Error ? error.message : t("accessControl.status.saveFailed"));
    } finally { setIsBusy(false); }
  }

  async function handleMembership(userId: string, enabled: boolean) {
    if (!tenantId || !selectedGroup) return;
    try {
      setIsBusy(true);
      await setAccessGroupMember(tenantId, selectedGroup.id, userId, enabled);
      setGroups((current) => current.map((group) => {
        if (group.id !== selectedGroup.id) return group;
        const memberIds = enabled
          ? Array.from(new Set([...group.member_user_ids, userId]))
          : group.member_user_ids.filter((memberId) => memberId !== userId);
        return { ...group, member_user_ids: memberIds, updated_at: new Date().toISOString() };
      }));
      setMemberUserId("");
      setLastRefreshedAt(new Date());
      notifySuccess(t(enabled ? "accessControl.status.memberAdded" : "accessControl.status.memberRemoved"));
    } catch (error) {
      notifyError(error instanceof Error ? error.message : t("accessControl.status.saveFailed"));
    } finally { setIsBusy(false); }
  }

  async function handleLoadPolicy() {
    if (!tenantId || !selectedResourceId) return;
    try {
      setIsBusy(true);
      const loaded = await getResourceAccessPolicy(tenantId, resourceType, selectedResourceId);
      setPolicy(loaded);
      setSavedPolicy(loaded);
      setGrantSubjectId("");
    } catch (error) {
      setPolicy(null);
      setSavedPolicy(null);
      notifyError(error instanceof Error ? error.message : t("accessControl.status.policyLoadFailed"));
    } finally { setIsBusy(false); }
  }

  function addGrant() {
    if (!policy || !grantSubjectId) return;
    const grant: AccessGrant = grantType === "user"
      ? { user_id: grantSubjectId, group_id: null }
      : { user_id: null, group_id: grantSubjectId };
    if (policy.grants.some((item) => item.user_id === grant.user_id && item.group_id === grant.group_id)) return;
    setPolicy({ ...policy, grants: [...policy.grants, grant] });
    setGrantSubjectId("");
  }

  async function handleSavePolicy() {
    if (!policy) return;
    try {
      setIsBusy(true);
      const saved = await updateResourceAccessPolicy(
        tenantId, resourceType, policy.resource_id, policy.access_scope, policy.grants
      );
      setPolicy(saved);
      setSavedPolicy(saved);
      setLastRefreshedAt(new Date());
      notifySuccess(t("accessControl.status.policySaved"));
    } catch (error) {
      notifyError(error instanceof Error ? error.message : t("accessControl.status.saveFailed"));
    } finally { setIsBusy(false); }
  }

  function resetResourceSelection(nextType: ResourceType) {
    setResourceType(nextType);
    setSelectedChunkId("");
    setPolicy(null);
    setSavedPolicy(null);
    setGrantSubjectId("");
  }

  const refreshedLabel = lastRefreshedAt
    ? lastRefreshedAt.toLocaleTimeString(language === "zh-CN" ? "zh-CN" : "en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : null;

  return (
    <ConsoleShell activeHref="/access-control">
      <PageTitleSync title={t("accessControl.title")} />
      <ConsolePage>
        <ConsolePageHeader
          eyebrow={t("accessControl.eyebrow")}
          icon={<ShieldCheck className="h-5 w-5" />}
          title={t("accessControl.title")}
          description={t("accessControl.description")}
          actions={<>
            <div className="min-w-64 flex-1 xl:w-72 xl:flex-none">
              <Select value={tenantId} onValueChange={(value) => { setTenantId(value); writeCurrentTenantId(value); }}>
                <SelectTrigger aria-label={t("accessControl.fields.tenant")}><SelectValue placeholder={t("accessControl.fields.tenant")} /></SelectTrigger>
                <SelectContent>{tenants.map((tenant) => <SelectItem key={tenant.id} value={tenant.id}>{tenant.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button disabled={!tenantId || isRefreshing} onClick={() => void loadTenantData(tenantId, true)} type="button" variant="outline">
              <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
              {t("accessControl.actions.refresh")}
            </Button>
          </>}
        />

        <ConsoleStatusBar
          error={loadError}
          message={isRefreshing ? t("accessControl.status.refreshing") : t("accessControl.status.ready")}
          meta={refreshedLabel ? t("accessControl.status.lastRefreshed", { time: refreshedLabel }) : undefined}
        />

        <ConsoleMetricGrid>
          <ConsoleMetricCard detail={t("accessControl.metrics.groupsDetail")} label={t("accessControl.metrics.groups")} value={groups.length} />
          <ConsoleMetricCard detail={t("accessControl.metrics.membersDetail")} label={t("accessControl.metrics.members")} value={activeUsers.length} />
          <ConsoleMetricCard detail={t("accessControl.metrics.resourcesDetail")} label={t("accessControl.metrics.resources")} value={catalog.knowledgeBases.length} />
        </ConsoleMetricGrid>

        <ConsoleSurface>
          <ConsoleSurfaceHeader title={t("accessControl.groups.title")} description={t("accessControl.groups.description")} />
          <div className="grid gap-0 border-t border-slate-200 xl:grid-cols-[0.9fr_1.1fr] dark:border-slate-800">
            <div className="space-y-5 p-5 sm:p-6 xl:border-r xl:border-slate-200 dark:xl:border-slate-800">
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/50">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-950 dark:text-slate-50">
                  <Plus className="h-4 w-4 text-blue-600" />{t("accessControl.groups.createTitle")}
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                    {t("accessControl.fields.groupName")}
                    <Input value={groupName} onChange={(event) => { setGroupName(event.target.value); if (!groupSlug) setGroupSlug(normalizeSlug(event.target.value)); }} />
                  </label>
                  <label className="grid gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                    {t("accessControl.fields.groupSlug")}
                    <Input value={groupSlug} onChange={(event) => setGroupSlug(normalizeSlug(event.target.value))} />
                  </label>
                  <label className="grid gap-1.5 text-xs font-medium text-slate-600 sm:col-span-2 dark:text-slate-300">
                    {t("accessControl.fields.description")}
                    <Input value={groupDescription} onChange={(event) => setGroupDescription(event.target.value)} />
                  </label>
                </div>
                <Button className="mt-3 w-full" disabled={isBusy || !groupName.trim() || !normalizeSlug(groupSlug || groupName)} onClick={() => void handleCreateGroup()} type="button">
                  {isBusy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  {t("accessControl.actions.createGroup")}
                </Button>
              </div>

              <div className="grid gap-2">
                {groups.length === 0 ? <ConsoleEmptyState><UsersRound className="mx-auto mb-2 h-8 w-8 text-slate-400" />{t("accessControl.groups.empty")}</ConsoleEmptyState> : groups.map((group) => (
                  <button
                    type="button"
                    key={group.id}
                    onClick={() => { setSelectedGroupId(group.id); setMemberUserId(""); }}
                    className={cn(
                      "rounded-xl border p-4 text-left transition",
                      selectedGroupId === group.id
                        ? "border-blue-300 bg-blue-50/80 ring-2 ring-blue-100 dark:border-blue-700 dark:bg-blue-950/30 dark:ring-blue-950"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-900"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0"><div className="truncate text-sm font-semibold text-slate-950 dark:text-slate-50">{group.name}</div><div className="mt-1 text-xs text-slate-500">{group.slug}</div></div>
                      <Badge variant="outline">{t("accessControl.groups.memberCount", { count: group.member_user_ids.length })}</Badge>
                    </div>
                    {group.description ? <div className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">{group.description}</div> : null}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div><div className="text-base font-semibold text-slate-950 dark:text-slate-50">{t("accessControl.members.title")}</div><div className="mt-1 text-sm text-slate-500">{selectedGroup?.description || t("accessControl.members.description")}</div></div>
                {selectedGroup ? <Badge variant="outline">{selectedGroup.name}</Badge> : null}
              </div>
              {!selectedGroup ? <ConsoleEmptyState>{t("accessControl.members.selectGroup")}</ConsoleEmptyState> : <div className="mt-5 space-y-4">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Select value={memberUserId} onValueChange={setMemberUserId}>
                    <SelectTrigger aria-label={t("accessControl.fields.member")} className="flex-1"><SelectValue placeholder={t("accessControl.fields.member")} /></SelectTrigger>
                    <SelectContent>{activeUsers.filter((user) => !selectedGroup.member_user_ids.includes(user.id)).map((user) => <SelectItem key={user.id} value={user.id}>{user.display_name} · {user.email}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button disabled={!memberUserId || isBusy} onClick={() => void handleMembership(memberUserId, true)} type="button"><UserPlus className="h-4 w-4" />{t("accessControl.actions.add")}</Button>
                </div>
                <div className="grid gap-2">
                  {selectedGroup.member_user_ids.length === 0 ? <ConsoleEmptyState>{t("accessControl.members.empty")}</ConsoleEmptyState> : selectedGroup.member_user_ids.map((userId) => (
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-900/40" key={userId}>
                      <div className="min-w-0"><div className="truncate text-sm font-medium text-slate-950 dark:text-slate-50">{userById.get(userId)?.display_name || userId}</div><div className="truncate text-xs text-slate-500">{userById.get(userId)?.email || t("accessControl.members.inactiveMember")}</div></div>
                      <Button aria-label={t("accessControl.actions.removeMember", { name: userById.get(userId)?.display_name || userId })} disabled={isBusy} onClick={() => void handleMembership(userId, false)} size="sm" type="button" variant="outline"><X className="h-4 w-4" />{t("accessControl.actions.remove")}</Button>
                    </div>
                  ))}
                </div>
              </div>}
            </div>
          </div>
        </ConsoleSurface>

        <ConsoleSurface>
          <ConsoleSurfaceHeader title={t("accessControl.policy.title")} description={t("accessControl.policy.description")} />
          <div className="space-y-5 border-t border-slate-200 p-5 sm:p-6 dark:border-slate-800">
            <div className="grid gap-4 xl:grid-cols-[180px_1fr_1.35fr]">
              <label className="grid gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                {t("accessControl.fields.resourceType")}
                <Select value={resourceType} onValueChange={(value) => resetResourceSelection(value as ResourceType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="document">{t("accessControl.fields.document")}</SelectItem><SelectItem value="chunk">{t("accessControl.fields.chunk")}</SelectItem></SelectContent>
                </Select>
              </label>
              <label className="grid gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                {t("accessControl.fields.knowledgeBase")}
                <Select value={selectedKnowledgeBaseId} onValueChange={(value) => { setSelectedKnowledgeBaseId(value); setSelectedDocumentId(""); setSelectedChunkId(""); setPolicy(null); setSavedPolicy(null); }}>
                  <SelectTrigger><SelectValue placeholder={t("accessControl.fields.selectKnowledgeBase")} /></SelectTrigger>
                  <SelectContent>{catalog.knowledgeBases.map((knowledgeBase) => <SelectItem key={knowledgeBase.id} value={knowledgeBase.id}>{workspaceById.get(knowledgeBase.workspace_id)?.name || t("accessControl.fields.workspace")} / {knowledgeBase.name}</SelectItem>)}</SelectContent>
                </Select>
              </label>
              <label className="grid gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                {t("accessControl.fields.searchDocuments")}
                <div className="relative"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" /><Input className="pl-9" disabled={!selectedKnowledgeBaseId} placeholder={t("accessControl.fields.searchDocumentsPlaceholder")} value={documentSearch} onChange={(event) => setDocumentSearch(event.target.value)} /></div>
              </label>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
              <div className={cn("grid gap-4", resourceType === "chunk" && "lg:grid-cols-2")}>
                <label className="grid gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                  {t("accessControl.fields.document")}
                  <Select value={selectedDocumentId} onValueChange={(value) => { setSelectedDocumentId(value); setSelectedChunkId(""); setPolicy(null); setSavedPolicy(null); }}>
                    <SelectTrigger disabled={!selectedKnowledgeBaseId || isLoadingDocuments || visibleDocuments.length === 0}><SelectValue placeholder={isLoadingDocuments ? t("accessControl.status.loadingDocuments") : visibleDocuments.length > 0 ? t("accessControl.fields.selectDocument") : t("accessControl.policy.noDocuments")} /></SelectTrigger>
                    <SelectContent>{visibleDocuments.map((document) => <SelectItem key={document.id} value={document.id}>{document.title}</SelectItem>)}</SelectContent>
                  </Select>
                </label>
                {resourceType === "chunk" ? <label className="grid gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                  {t("accessControl.fields.chunk")}
                  <Select value={selectedChunkId} onValueChange={(value) => { setSelectedChunkId(value); setPolicy(null); setSavedPolicy(null); }}>
                    <SelectTrigger disabled={!selectedDocumentId || isLoadingChunks || chunks.length === 0}><SelectValue placeholder={isLoadingChunks ? t("accessControl.status.loadingChunks") : chunks.length > 0 ? t("accessControl.fields.selectChunk") : t("accessControl.policy.noChunks")} /></SelectTrigger>
                    <SelectContent>{chunks.map((chunk) => <SelectItem key={chunk.id} value={chunk.id}>#{chunk.chunk_index + 1} · {formatChunkPreview(chunk)}</SelectItem>)}</SelectContent>
                  </Select>
                </label> : null}
              </div>
              <Button className="self-end" disabled={!selectedResourceId || isBusy} onClick={() => void handleLoadPolicy()} type="button" variant="outline"><FileKey2 className="h-4 w-4" />{t("accessControl.actions.loadPolicy")}</Button>
            </div>

            {!policy ? <ConsoleEmptyState icon={<Database className="h-9 w-9 stroke-[1.5]" />}>{selectedResourceId ? t("accessControl.policy.loadHint") : t("accessControl.policy.selectHint")}</ConsoleEmptyState> : <div className="space-y-5 rounded-xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5 dark:border-slate-800 dark:bg-slate-900/40">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-950 dark:text-slate-50"><ShieldCheck className="h-4 w-4 text-blue-600" />{resourceType === "document" ? selectedDocument?.title : `${selectedDocument?.title ?? ""} · ${t("accessControl.fields.chunk")}`}</div>
                  <div className="mt-1 truncate text-xs text-slate-500" title={policy.resource_id}>{policy.resource_id}</div>
                </div>
                <label className="grid min-w-60 gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                  {t("accessControl.fields.accessScope")}
                  <Select value={policy.access_scope} onValueChange={(value) => setPolicy({ ...policy, access_scope: value as ResourceAccessPolicy["access_scope"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{resourceType === "document" ? <SelectItem value="tenant">{t("accessControl.scope.tenant")}</SelectItem> : <SelectItem value="inherit">{t("accessControl.scope.inherit")}</SelectItem>}<SelectItem value="restricted">{t("accessControl.scope.restricted")}</SelectItem></SelectContent>
                  </Select>
                </label>
              </div>

              <div className={cn("space-y-3", policy.access_scope !== "restricted" && "opacity-60")}>
                <div><div className="text-sm font-semibold text-slate-950 dark:text-slate-50">{t("accessControl.policy.grantsTitle")}</div><div className="mt-1 text-xs leading-5 text-slate-500">{policy.access_scope === "restricted" ? t("accessControl.policy.grantsDescription") : t("accessControl.policy.grantsInactive")}</div></div>
                <div className="flex flex-col gap-2 md:flex-row">
                  <Select disabled={policy.access_scope !== "restricted"} value={grantType} onValueChange={(value) => { setGrantType(value as "user" | "group"); setGrantSubjectId(""); }}>
                    <SelectTrigger className="md:w-40"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="group">{t("accessControl.fields.group")}</SelectItem><SelectItem value="user">{t("accessControl.fields.user")}</SelectItem></SelectContent>
                  </Select>
                  <Select disabled={policy.access_scope !== "restricted"} value={grantSubjectId} onValueChange={setGrantSubjectId}>
                    <SelectTrigger className="flex-1"><SelectValue placeholder={t("accessControl.fields.grantSubject")} /></SelectTrigger>
                    <SelectContent>{grantType === "group" ? groups.map((group) => <SelectItem key={group.id} value={group.id}>{group.name}</SelectItem>) : activeUsers.map((user) => <SelectItem key={user.id} value={user.id}>{user.display_name} · {user.email}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button disabled={policy.access_scope !== "restricted" || !grantSubjectId} onClick={addGrant} type="button" variant="outline"><Plus className="h-4 w-4" />{t("accessControl.actions.addGrant")}</Button>
                </div>
                <div className="flex min-h-10 flex-wrap gap-2 rounded-xl border border-dashed border-slate-300 bg-white p-3 dark:border-slate-700 dark:bg-slate-950">
                  {policy.grants.length === 0
                    ? <span className="text-sm text-slate-500">{t("accessControl.policy.noGrants")}</span>
                    : policy.grants.map((grant, index) => (
                      <Badge className="gap-2 py-1.5" variant="outline" key={`${grant.user_id || grant.group_id}-${index}`}>
                        {grant.user_id
                          ? (userById.get(grant.user_id)?.display_name || grant.user_id)
                          : (groupById.get(grant.group_id || "")?.name || grant.group_id)}
                        <button
                          aria-label={t("accessControl.actions.removeGrant")}
                          type="button"
                          onClick={() => setPolicy({ ...policy, grants: policy.grants.filter((_, itemIndex) => itemIndex !== index) })}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </Badge>
                    ))}
                </div>
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
                <div className="text-xs text-slate-500">{isPolicyDirty ? t("accessControl.policy.unsaved") : t("accessControl.policy.saved")}</div>
                <div className="flex gap-2">
                  <Button disabled={!isPolicyDirty || isBusy} onClick={() => setPolicy(savedPolicy)} type="button" variant="outline">{t("accessControl.actions.discard")}</Button>
                  <Button disabled={!isPolicyDirty || isBusy} onClick={() => void handleSavePolicy()} type="button"><ShieldCheck className="h-4 w-4" />{t("accessControl.actions.savePolicy")}</Button>
                </div>
              </div>
            </div>}
          </div>
        </ConsoleSurface>
      </ConsolePage>
    </ConsoleShell>
  );
}
