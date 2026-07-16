"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FileKey2, Plus, ShieldCheck, UserPlus, UsersRound } from "lucide-react";

import { ConsoleEmptyState, ConsolePage, ConsoleSurface, ConsoleSurfaceHeader } from "@/components/console/ConsolePrimitives";
import { ConsoleShell } from "@/components/console/ConsoleShell";
import { PageTitleSync } from "@/components/console/PageTitleSync";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { DirectoryUser } from "@/lib/auth-directory";
import {
  createAccessGroup,
  getResourceAccessPolicy,
  listAccessGroups,
  setAccessGroupMember,
  updateResourceAccessPolicy,
  type AccessGrant,
  type AccessGroup,
  type ResourceAccessPolicy
} from "@/lib/access-control";
import { authenticatedApiRequest } from "@/lib/authenticated-api";
import { useI18n } from "@/lib/i18n/provider";
import { useNotifications } from "@/lib/notifications/provider";
import { readCurrentTenantId, writeCurrentTenantId } from "@/lib/tenant-scope";

type Tenant = { id: string; name: string };
type ResourceType = "document" | "chunk";

function normalizeSlug(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export default function AccessControlConsolePage() {
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const { error: notifyError, success: notifySuccess } = useNotifications();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tenantId, setTenantId] = useState("");
  const [users, setUsers] = useState<DirectoryUser[]>([]);
  const [groups, setGroups] = useState<AccessGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [memberUserId, setMemberUserId] = useState("");
  const [groupName, setGroupName] = useState("");
  const [groupSlug, setGroupSlug] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [resourceType, setResourceType] = useState<ResourceType>("document");
  const [resourceId, setResourceId] = useState("");
  const [policy, setPolicy] = useState<ResourceAccessPolicy | null>(null);
  const [grantType, setGrantType] = useState<"user" | "group">("group");
  const [grantSubjectId, setGrantSubjectId] = useState("");

  const selectedGroup = groups.find((group) => group.id === selectedGroupId) ?? null;
  const userById = useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);
  const groupById = useMemo(() => new Map(groups.map((group) => [group.id, group])), [groups]);

  const loadTenantData = useCallback(async (nextTenantId: string) => {
    if (!nextTenantId) return;
    const [nextGroups, nextUsers] = await Promise.all([
      listAccessGroups(nextTenantId),
      authenticatedApiRequest<DirectoryUser[]>(`/users?tenant_id=${encodeURIComponent(nextTenantId)}`)
    ]);
    setGroups(Array.isArray(nextGroups) ? nextGroups : []);
    setUsers(Array.isArray(nextUsers) ? nextUsers : []);
    setSelectedGroupId((current) => nextGroups.some((group) => group.id === current) ? current : (nextGroups[0]?.id ?? ""));
  }, []);

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
    setResourceId("");
    if (!tenantId) return;
    void loadTenantData(tenantId).catch((error) => notifyError(error instanceof Error ? error.message : t("accessControl.status.loadFailed")));
  }, [loadTenantData, notifyError, t, tenantId]);

  async function handleCreateGroup() {
    if (!tenantId || !groupName.trim() || !normalizeSlug(groupSlug || groupName)) return;
    try {
      setIsBusy(true);
      const created = await createAccessGroup({
        tenant_id: tenantId,
        name: groupName.trim(),
        slug: normalizeSlug(groupSlug || groupName),
        description: groupDescription.trim() || null
      });
      setGroupName(""); setGroupSlug(""); setGroupDescription("");
      await loadTenantData(tenantId);
      setSelectedGroupId(created.id);
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
      await loadTenantData(tenantId);
      setSelectedGroupId(selectedGroup.id);
      setMemberUserId("");
      notifySuccess(t(enabled ? "accessControl.status.memberAdded" : "accessControl.status.memberRemoved"));
    } catch (error) {
      notifyError(error instanceof Error ? error.message : t("accessControl.status.saveFailed"));
    } finally { setIsBusy(false); }
  }

  async function handleLoadPolicy() {
    if (!tenantId || !resourceId.trim()) return;
    try {
      setIsBusy(true);
      setPolicy(await getResourceAccessPolicy(tenantId, resourceType, resourceId.trim()));
    } catch (error) {
      setPolicy(null);
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
      notifySuccess(t("accessControl.status.policySaved"));
    } catch (error) {
      notifyError(error instanceof Error ? error.message : t("accessControl.status.saveFailed"));
    } finally { setIsBusy(false); }
  }

  return (
    <ConsoleShell activeHref="/access-control">
      <PageTitleSync title={t("accessControl.title")} />
      <ConsolePage className="gap-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><h1 className="text-2xl font-semibold">{t("accessControl.title")}</h1><p className="mt-1 text-sm text-slate-500">{t("accessControl.description")}</p></div>
          <div className="w-64"><Select value={tenantId} onValueChange={(value) => { setTenantId(value); writeCurrentTenantId(value); }}><SelectTrigger><SelectValue placeholder={t("accessControl.fields.tenant")} /></SelectTrigger><SelectContent>{tenants.map((tenant) => <SelectItem key={tenant.id} value={tenant.id}>{tenant.name}</SelectItem>)}</SelectContent></Select></div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[1fr_1.25fr]">
          <ConsoleSurface>
            <ConsoleSurfaceHeader title={t("accessControl.groups.title")} description={t("accessControl.groups.description")} />
            <div className="grid gap-3 p-5 pt-0">
              <Input placeholder={t("accessControl.fields.groupName")} value={groupName} onChange={(event) => { setGroupName(event.target.value); if (!groupSlug) setGroupSlug(normalizeSlug(event.target.value)); }} />
              <Input placeholder={t("accessControl.fields.groupSlug")} value={groupSlug} onChange={(event) => setGroupSlug(event.target.value)} />
              <Input placeholder={t("accessControl.fields.description")} value={groupDescription} onChange={(event) => setGroupDescription(event.target.value)} />
              <Button disabled={isBusy || !groupName.trim()} onClick={() => void handleCreateGroup()}><Plus className="h-4 w-4" />{t("accessControl.actions.createGroup")}</Button>
              <div className="mt-2 grid gap-2">{groups.length === 0 ? <ConsoleEmptyState>{t("accessControl.groups.empty")}</ConsoleEmptyState> : groups.map((group) => <button type="button" key={group.id} onClick={() => setSelectedGroupId(group.id)} className={`rounded-xl border p-3 text-left ${selectedGroupId === group.id ? "border-blue-300 bg-blue-50" : "border-slate-200"}`}><div className="flex items-center justify-between"><span className="font-medium">{group.name}</span><Badge variant="outline">{group.member_user_ids.length}</Badge></div><div className="mt-1 text-xs text-slate-500">{group.slug}</div></button>)}</div>
            </div>
          </ConsoleSurface>

          <ConsoleSurface>
            <ConsoleSurfaceHeader title={t("accessControl.members.title")} description={selectedGroup?.description || t("accessControl.members.description")} />
            <div className="space-y-4 p-5 pt-0">
              {!selectedGroup ? <ConsoleEmptyState>{t("accessControl.members.selectGroup")}</ConsoleEmptyState> : <>
                <div className="flex gap-2"><Select value={memberUserId} onValueChange={setMemberUserId}><SelectTrigger><SelectValue placeholder={t("accessControl.fields.member")} /></SelectTrigger><SelectContent>{users.filter((user) => !selectedGroup.member_user_ids.includes(user.id)).map((user) => <SelectItem key={user.id} value={user.id}>{user.display_name} · {user.email}</SelectItem>)}</SelectContent></Select><Button disabled={!memberUserId || isBusy} onClick={() => void handleMembership(memberUserId, true)}><UserPlus className="h-4 w-4" />{t("accessControl.actions.add")}</Button></div>
                <div className="grid gap-2">{selectedGroup.member_user_ids.length === 0 ? <ConsoleEmptyState>{t("accessControl.members.empty")}</ConsoleEmptyState> : selectedGroup.member_user_ids.map((userId) => <div className="flex items-center justify-between rounded-xl border border-slate-200 p-3" key={userId}><div><div className="text-sm font-medium">{userById.get(userId)?.display_name || userId}</div><div className="text-xs text-slate-500">{userById.get(userId)?.email}</div></div><Button variant="outline" disabled={isBusy} onClick={() => void handleMembership(userId, false)}>{t("accessControl.actions.remove")}</Button></div>)}</div>
              </>}
            </div>
          </ConsoleSurface>
        </div>

        <ConsoleSurface>
          <ConsoleSurfaceHeader title={t("accessControl.policy.title")} description={t("accessControl.policy.description")} />
          <div className="grid gap-4 p-5 pt-0 lg:grid-cols-[220px_1fr_auto]">
            <Select value={resourceType} onValueChange={(value) => { setResourceType(value as ResourceType); setPolicy(null); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="document">{t("accessControl.fields.document")}</SelectItem><SelectItem value="chunk">{t("accessControl.fields.chunk")}</SelectItem></SelectContent></Select>
            <Input placeholder={t("accessControl.fields.resourceId")} value={resourceId} onChange={(event) => setResourceId(event.target.value)} />
            <Button variant="outline" disabled={!resourceId.trim() || isBusy} onClick={() => void handleLoadPolicy()}><FileKey2 className="h-4 w-4" />{t("accessControl.actions.loadPolicy")}</Button>
          </div>
          {policy ? <div className="space-y-4 border-t border-slate-200 p-5">
            <div className="flex flex-wrap items-center gap-3"><ShieldCheck className="h-5 w-5 text-blue-600" /><Select value={policy.access_scope} onValueChange={(value) => setPolicy({ ...policy, access_scope: value as ResourceAccessPolicy["access_scope"] })}><SelectTrigger className="w-56"><SelectValue /></SelectTrigger><SelectContent>{resourceType === "document" ? <SelectItem value="tenant">{t("accessControl.scope.tenant")}</SelectItem> : <SelectItem value="inherit">{t("accessControl.scope.inherit")}</SelectItem>}<SelectItem value="restricted">{t("accessControl.scope.restricted")}</SelectItem></SelectContent></Select><span className="text-xs text-slate-500">{policy.resource_id}</span></div>
            <div className="flex flex-wrap gap-2"><Select value={grantType} onValueChange={(value) => { setGrantType(value as "user" | "group"); setGrantSubjectId(""); }}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="group">{t("accessControl.fields.group")}</SelectItem><SelectItem value="user">{t("accessControl.fields.user")}</SelectItem></SelectContent></Select><Select value={grantSubjectId} onValueChange={setGrantSubjectId}><SelectTrigger className="min-w-72 flex-1"><SelectValue placeholder={t("accessControl.fields.grantSubject")} /></SelectTrigger><SelectContent>{grantType === "group" ? groups.map((group) => <SelectItem key={group.id} value={group.id}>{group.name}</SelectItem>) : users.map((user) => <SelectItem key={user.id} value={user.id}>{user.display_name} · {user.email}</SelectItem>)}</SelectContent></Select><Button variant="outline" disabled={!grantSubjectId} onClick={addGrant}><Plus className="h-4 w-4" />{t("accessControl.actions.addGrant")}</Button></div>
            <div className="flex flex-wrap gap-2">{policy.grants.length === 0 ? <span className="text-sm text-slate-500">{t("accessControl.policy.noGrants")}</span> : policy.grants.map((grant, index) => <Badge className="gap-2 py-1.5" variant="outline" key={`${grant.user_id || grant.group_id}-${index}`}>{grant.user_id ? (userById.get(grant.user_id)?.display_name || grant.user_id) : (groupById.get(grant.group_id || "")?.name || grant.group_id)}<button type="button" onClick={() => setPolicy({ ...policy, grants: policy.grants.filter((_, itemIndex) => itemIndex !== index) })}>×</button></Badge>)}</div>
            <Button disabled={isBusy} onClick={() => void handleSavePolicy()}><ShieldCheck className="h-4 w-4" />{t("accessControl.actions.savePolicy")}</Button>
          </div> : null}
        </ConsoleSurface>
      </ConsolePage>
    </ConsoleShell>
  );
}
