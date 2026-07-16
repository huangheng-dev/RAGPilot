"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MoreHorizontal, PencilLine, Plus, Search, Trash2, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DialogFormActions, DialogFormField, DialogFormGrid, DialogFormLayout, FormDialog } from "@/components/ui/form-dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ConsoleEmptyState, ConsoleSurface, ConsoleSurfaceHeader } from "@/components/console/ConsolePrimitives";
import { PaginationControls } from "@/components/workspace/PaginationControls";
import { useI18n } from "@/lib/i18n/provider";
import {
  applyMcpConnectorGovernanceAction, applyModelEndpointGovernanceAction,
  applyRetrievalProfileGovernanceAction, applyToolGovernanceAction,
  createMcpConnector, createModelEndpoint, createRetrievalProfile, createToolRegistration,
  deleteMcpConnector, deleteModelEndpoint, deleteRetrievalProfile, deleteToolRegistration,
  listMcpConnectors, listModelEndpoints, listRetrievalProfiles, listToolRegistrations,
  previewMcpConnector, previewModelEndpoint, previewToolRegistration,
  updateMcpConnector, updateModelEndpoint, updateRetrievalProfile, updateToolRegistration,
  type PlatformMcpConnector, type PlatformModelEndpoint, type PlatformRetrievalProfile,
  type PlatformToolRegistration, type RuntimeGovernanceResourceType,
} from "@/lib/platform-governance";

type Resource = PlatformModelEndpoint | PlatformToolRegistration | PlatformMcpConnector | PlatformRetrievalProfile;
type Draft = Record<string, string | boolean | number>;
const kinds: RuntimeGovernanceResourceType[] = ["model_endpoint", "tool_registration", "mcp_connector", "retrieval_profile"];

export function RuntimeResourcesPanel({ tenantId }: { tenantId: string | null }) {
  const { t } = useI18n();
  const [kind, setKind] = useState<RuntimeGovernanceResourceType>("model_endpoint");
  const [models, setModels] = useState<PlatformModelEndpoint[]>([]);
  const [tools, setTools] = useState<PlatformToolRegistration[]>([]);
  const [connectors, setConnectors] = useState<PlatformMcpConnector[]>([]);
  const [profiles, setProfiles] = useState<PlatformRetrievalProfile[]>([]);
  const [query, setQuery] = useState("");
  const [deepLinkTarget, setDeepLinkTarget] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Resource | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Resource | null>(null);
  const [disabling, setDisabling] = useState<Resource | null>(null);
  const [draft, setDraft] = useState<Draft>({});
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [loadedKinds, setLoadedKinds] = useState<RuntimeGovernanceResourceType[]>([]);
  const [resourceNotices, setResourceNotices] = useState<Record<string, { tone: "success" | "error"; text: string }>>({});

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      if (kind === "model_endpoint") setModels(await listModelEndpoints());
      else if (kind === "tool_registration") setTools(await listToolRegistrations());
      else if (kind === "mcp_connector") setConnectors(await listMcpConnectors());
      else setProfiles(await listRetrievalProfiles());
      setLoadedKinds((current) => current.includes(kind) ? current : [...current, kind]);
    } catch (e) { setError(e instanceof Error ? e.message : t("admin.runtimeResources.loadFailed")); }
    finally { setLoading(false); }
  }, [kind, t]);

  useEffect(() => {
    if (!loadedKinds.includes(kind)) void load();
  }, [kind, load, loadedKinds]);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const requested = p.get("runtime_resource") as RuntimeGovernanceResourceType | null;
    if (requested && kinds.includes(requested)) setKind(requested);
    const id = p.get("model_endpoint_id") || p.get("tool_registration_id") || p.get("mcp_connector_id") || p.get("retrieval_profile_id");
    const slug = p.get("mcp_connector_slug");
    if (id || slug) { setQuery(id || slug || ""); setDeepLinkTarget(id || slug || ""); }
  }, []);

  const resources = useMemo<Resource[]>(() => kind === "model_endpoint" ? models : kind === "tool_registration" ? tools : kind === "mcp_connector" ? connectors : profiles, [connectors, kind, models, profiles, tools]);
  const visible = resources.filter((item) => `${item.id} ${item.name} ${item.slug}`.toLowerCase().includes(query.trim().toLowerCase()));
  const pageSize = 10;
  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
  const paginatedResources = visible.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => { setPage(1); }, [kind, query]);
  useEffect(() => { setPage((current) => Math.min(current, pageCount)); }, [pageCount]);

  function openCreate() {
    setCreating(true); setEditing(null); setMessage(null); setError(null);
    setDraft(kind === "model_endpoint" ? { name: "", slug: "", provider_type: "ollama", model_name: "", base_url: "http://host.docker.internal:11434", credential_mode: "none", credential_key_hint: "", capabilities: "chat", is_enabled: true, is_default: false, notes: "" }
      : kind === "tool_registration" ? { name: "", slug: "", transport_type: "http", surface_area: "agents", endpoint_url: "", connector_reference: "", description: "", capabilities: "", requires_admin_approval: true, is_enabled: false }
      : kind === "mcp_connector" ? { name: "", slug: "", connector_type: "streamable_http", base_url: "", auth_mode: "none", credential_key_hint: "", notes: "", is_enabled: false }
      : { name: "", slug: "", retrieval_mode: "hybrid", engine_name: "native", engine_version: "native_v1", top_k: 8, vector_weight: 0.7, lexical_weight: 0.3, hybrid_overlap_bonus: 0.1, llamaindex_similarity_cutoff: 0, llamaindex_long_context_reorder_enabled: true, is_enabled: true, is_default: false, notes: "" });
  }

  function openEdit(item: Resource) {
    setCreating(false); setEditing(item); setMessage(null); setError(null);
    if (kind === "model_endpoint") { const x=item as PlatformModelEndpoint; setDraft({ name:x.name,slug:x.slug,provider_type:x.provider_type,model_name:x.model_name,base_url:x.base_url??"",credential_mode:x.credential_mode,credential_key_hint:x.credential_key_hint??"",capabilities:x.capabilities.join(","),is_enabled:x.is_enabled,is_default:x.is_default,notes:x.notes??"" }); }
    else if (kind === "tool_registration") { const x=item as PlatformToolRegistration; setDraft({ name:x.name,slug:x.slug,transport_type:x.transport_type,surface_area:x.surface_area,endpoint_url:x.endpoint_url??"",connector_reference:x.connector_reference??"",description:x.description??"",capabilities:x.capabilities.join(","),requires_admin_approval:x.requires_admin_approval,is_enabled:x.is_enabled }); }
    else if (kind === "mcp_connector") { const x=item as PlatformMcpConnector; setDraft({ name:x.name,slug:x.slug,connector_type:x.connector_type,base_url:x.base_url??"",auth_mode:x.auth_mode,credential_key_hint:x.credential_key_hint??"",notes:x.notes??"",is_enabled:x.is_enabled }); }
    else { const x=item as PlatformRetrievalProfile; setDraft({ name:x.name,slug:x.slug,retrieval_mode:x.retrieval_mode,engine_name:x.engine_name??"native",engine_version:x.engine_version??"native_v1",top_k:x.top_k,vector_weight:x.vector_weight,lexical_weight:x.lexical_weight,hybrid_overlap_bonus:x.hybrid_overlap_bonus,llamaindex_similarity_cutoff:x.llamaindex_similarity_cutoff??0,llamaindex_long_context_reorder_enabled:x.llamaindex_long_context_reorder_enabled??true,is_enabled:x.is_enabled,is_default:x.is_default,notes:x.notes??"" }); }
  }

  useEffect(() => {
    if (!deepLinkTarget || editing || creating) return;
    const target = resources.find((item) => item.id === deepLinkTarget || item.slug === deepLinkTarget);
    if (target) { openEdit(target); setDeepLinkTarget(""); }
  }, [creating, deepLinkTarget, editing, resources]);

  const text = (key: string) => String(draft[key] ?? "");
  const bool = (key: string) => Boolean(draft[key]);
  const number = (key: string) => Number(draft[key] ?? 0);
  const set = (key: string, value: string | boolean | number) => setDraft((d) => ({ ...d, [key]: value }));
  const list = (key: string) => text(key).split(",").map((x) => x.trim()).filter(Boolean);

  async function save() {
    setBusy(true); setError(null);
    try {
      if (kind === "model_endpoint") {
        const payload = { name:text("name"),slug:text("slug"),provider_type:text("provider_type") as PlatformModelEndpoint["provider_type"],model_name:text("model_name"),base_url:text("base_url")||null,credential_mode:text("credential_mode") as PlatformModelEndpoint["credential_mode"],credential_key_hint:text("credential_key_hint")||null,capabilities:list("capabilities") as PlatformModelEndpoint["capabilities"],is_enabled:bool("is_enabled"),is_default:bool("is_default"),notes:text("notes")||null };
        creating ? await createModelEndpoint(payload as never) : await updateModelEndpoint(editing!.id, payload as never);
      } else if (kind === "tool_registration") {
        const payload={name:text("name"),slug:text("slug"),transport_type:text("transport_type") as PlatformToolRegistration["transport_type"],surface_area:text("surface_area") as PlatformToolRegistration["surface_area"],endpoint_url:text("endpoint_url")||null,connector_reference:text("connector_reference")||null,description:text("description")||null,capabilities:list("capabilities"),requires_admin_approval:bool("requires_admin_approval"),is_enabled:bool("is_enabled")};
        creating ? await createToolRegistration(payload) : await updateToolRegistration(editing!.id,payload);
      } else if (kind === "mcp_connector") {
        const payload={name:text("name"),slug:text("slug"),connector_type:text("connector_type") as PlatformMcpConnector["connector_type"],base_url:text("base_url")||null,auth_mode:text("auth_mode") as PlatformMcpConnector["auth_mode"],credential_key_hint:text("credential_key_hint")||null,notes:text("notes")||null,is_enabled:bool("is_enabled")};
        creating ? await createMcpConnector(payload as never) : await updateMcpConnector(editing!.id,payload as never);
      } else {
        const payload={name:text("name"),slug:text("slug"),retrieval_mode:text("retrieval_mode") as PlatformRetrievalProfile["retrieval_mode"],engine_name:text("engine_name") as PlatformRetrievalProfile["engine_name"],engine_version:text("engine_version"),top_k:number("top_k"),vector_weight:number("vector_weight"),lexical_weight:number("lexical_weight"),hybrid_overlap_bonus:number("hybrid_overlap_bonus"),llamaindex_similarity_cutoff:number("llamaindex_similarity_cutoff"),llamaindex_long_context_reorder_enabled:bool("llamaindex_long_context_reorder_enabled"),is_enabled:bool("is_enabled"),is_default:bool("is_default"),notes:text("notes")||null};
        creating ? await createRetrievalProfile(payload) : await updateRetrievalProfile(editing!.id,payload);
      }
      setEditing(null); setCreating(false); setMessage(t("admin.runtimeResources.saved")); await load();
    } catch(e) { setError(e instanceof Error ? e.message : t("admin.runtimeResources.saveFailed")); }
    finally { setBusy(false); }
  }

  async function runAction(item: Resource, action: "toggle"|"preview"|"default") {
    setBusy(true); setError(null); setMessage(null);
    try {
      let previewSummary: string | null = null;
      if (kind === "model_endpoint") { const x=item as PlatformModelEndpoint; if(action==="preview") previewSummary=(await previewModelEndpoint(x.id)).summary; else await applyModelEndpointGovernanceAction(x.id,action==="default"?"promote_default":x.is_enabled?"disable_endpoint":"enable_endpoint"); }
      else if(kind === "tool_registration") { const x=item as PlatformToolRegistration; if(action==="preview") { if(!tenantId) throw new Error(t("admin.runtimeResources.selectTenant")); previewSummary=(await previewToolRegistration(x.id,{tenant_id:tenantId,execution_input:"Runtime resource connectivity test"})).summary; } else await applyToolGovernanceAction(x.id,x.is_enabled?"disable_tool":"enable_tool"); }
      else if(kind === "mcp_connector") { const x=item as PlatformMcpConnector; if(action==="preview") previewSummary=(await previewMcpConnector(x.id)).summary; else await applyMcpConnectorGovernanceAction(x.id,x.is_enabled?"disable_connector":"enable_connector"); }
      else { const x=item as PlatformRetrievalProfile; await applyRetrievalProfileGovernanceAction(x.id,action==="default"?"promote_default":x.is_enabled?"disable_profile":"enable_profile"); }
      if (action === "preview") setResourceNotices((current) => ({...current, [item.id]: {tone:"success", text:previewSummary || t("admin.runtimeResources.previewComplete")}}));
      else setMessage(t("admin.runtimeResources.actionComplete"));
      await load();
    } catch(e){const failure=e instanceof Error?e.message:t("admin.runtimeResources.actionFailed");if(action==="preview")setResourceNotices((current)=>({...current,[item.id]:{tone:"error",text:failure}}));else setError(failure);} finally{setBusy(false);}
  }

  function getBindingCount(item: Resource) {
    if ("bound_agent_count" in item) return item.bound_agent_count;
    if ("referenced_tool_count" in item) return item.referenced_tool_count;
    if ("bound_knowledge_base_count" in item) return item.bound_knowledge_base_count;
    return 0;
  }

  async function remove() { if(!deleting)return; setBusy(true); try { if(kind==="model_endpoint")await deleteModelEndpoint(deleting.id);else if(kind==="tool_registration")await deleteToolRegistration(deleting.id);else if(kind==="mcp_connector")await deleteMcpConnector(deleting.id);else await deleteRetrievalProfile(deleting.id);setDeleting(null);await load();}catch(e){setError(e instanceof Error?e.message:t("admin.runtimeResources.deleteFailed"));}finally{setBusy(false);} }

  return <div className="space-y-6">
    <ConsoleSurface className="overflow-visible rounded-none border-0 bg-transparent shadow-none"><ConsoleSurfaceHeader className="px-0 pb-4 pt-0" title={t("admin.runtimeResources.title")} description={t("admin.runtimeResources.description")} action={<Button className="rounded-xl" onClick={openCreate}><Plus className="h-4 w-4"/>{t("admin.runtimeResources.create")}</Button>}/>
      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4"><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{kinds.map((x)=><Button className="w-full rounded-xl" key={x} variant={kind===x?"default":"outline"} onClick={()=>{setKind(x);setQuery("");}}>{t(`admin.runtimeResources.kinds.${x}`)}</Button>)}</div><div className="relative mt-3"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/><Input className="bg-white pl-9" value={query} onChange={(e)=>setQuery(e.target.value)} placeholder={t("admin.runtimeResources.search")}/></div></div>
    </ConsoleSurface>
    {message?<div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</div>:null}{error?<div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>:null}
    <div className="grid gap-3">{paginatedResources.length?paginatedResources.map((item)=><ConsoleSurface className="overflow-visible" key={item.id}><div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="font-semibold text-slate-950">{item.name}</span><Badge variant="outline">{item.is_enabled?t("admin.runtimeResources.enabled"):t("admin.runtimeResources.disabled")}</Badge>{"is_default" in item&&item.is_default?<Badge>{t("admin.runtimeResources.default")}</Badge>:null}{"runtime_ready" in item&&!item.runtime_ready?<Badge variant="destructive">{t("admin.runtimeResources.runtimeUnavailable")}</Badge>:null}</div><div className="mt-1 truncate text-sm text-slate-500">{item.slug} · {item.id}</div>{resourceNotices[item.id]?<div className={`mt-2 text-xs ${resourceNotices[item.id].tone==="success"?"text-emerald-700":"text-rose-700"}`}>{resourceNotices[item.id].text}</div>:null}</div><div className="flex shrink-0 items-center gap-2"><Button size="sm" variant="outline" onClick={()=>openEdit(item)}><PencilLine className="h-4 w-4"/>{t("admin.runtimeResources.edit")}</Button><details className="relative open:z-40"><summary aria-label={t("admin.runtimeResources.moreActions")} className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"><MoreHorizontal className="h-4 w-4"/></summary><div className="absolute right-0 top-full z-50 mt-2 min-w-44 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">{kind!=="retrieval_profile"?<button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50" disabled={busy} onClick={(event)=>{event.currentTarget.closest("details")?.removeAttribute("open");void runAction(item,"preview");}} type="button"><Zap className="h-4 w-4"/>{t("admin.runtimeResources.testConnection")}</button>:null}{"is_default" in item&&!item.is_default?<button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={(event)=>{event.currentTarget.closest("details")?.removeAttribute("open");void runAction(item,"default");}} type="button">{t("admin.runtimeResources.makeDefault")}</button>:null}<button className={`flex w-full items-center rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50 ${item.is_enabled?"text-amber-700":"text-slate-700"}`} disabled={busy || ("is_default" in item && item.is_default && item.is_enabled)} onClick={(event)=>{event.currentTarget.closest("details")?.removeAttribute("open");if(item.is_enabled)setDisabling(item);else void runAction(item,"toggle");}} type="button">{item.is_enabled?t("admin.runtimeResources.disable"):t("admin.runtimeResources.enable")}</button><div className="my-1 border-t border-slate-100"/><button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50" onClick={(event)=>{event.currentTarget.closest("details")?.removeAttribute("open");setDeleting(item);}} type="button"><Trash2 className="h-4 w-4"/>{t("admin.runtimeResources.delete")}</button></div></details></div></div></ConsoleSurface>):loading?<div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">{t("admin.runtimeResources.loading")}</div>:<ConsoleEmptyState>{t("admin.runtimeResources.empty")}</ConsoleEmptyState>}</div>
    {visible.length > pageSize ? <ConsoleSurface><PaginationControls currentPage={page} onPageChange={setPage} pageCount={pageCount} pageSize={pageSize} totalItems={visible.length} /></ConsoleSurface> : null}
    <FormDialog
      description={t(`admin.runtimeResources.kinds.${kind}`)}
      focusContainerOnOpen
      footer={<DialogFormActions><Button className="bg-white" variant="outline" onClick={()=>{setCreating(false);setEditing(null);}}>{t("admin.runtimeResources.cancel")}</Button><Button disabled={busy||!text("name")||!text("slug")} onClick={()=>void save()}>{busy?t("admin.runtimeResources.saving"):t("admin.runtimeResources.save")}</Button></DialogFormActions>}
      onClose={()=>{setCreating(false);setEditing(null);}}
      open={creating||Boolean(editing)}
      presentation="side"
      size="xl"
      title={creating?t("admin.runtimeResources.createTitle"):t("admin.runtimeResources.editTitle")}
      titleClassName="text-base"
    >
      <DialogFormLayout>
        <DialogFormGrid className="xl:grid-cols-3">
          <div className="xl:col-span-2"><DialogFormField label={t("admin.runtimeResources.fields.name")}><Input placeholder={t("admin.runtimeResources.fields.name")} value={text("name")} onChange={(e)=>set("name",e.target.value)}/></DialogFormField></div>
          <DialogFormField label={t("admin.runtimeResources.fields.slug")}><Input placeholder={t("admin.runtimeResources.fields.slug")} value={text("slug")} onChange={(e)=>set("slug",e.target.value)}/></DialogFormField>
        </DialogFormGrid>

        {kind==="model_endpoint"?<>
          <DialogFormGrid className="xl:grid-cols-3"><Choice label={t("admin.runtimeResources.fields.provider")} value={text("provider_type")} values={["deterministic","openai_compatible","ollama","vllm"]} onChange={(v)=>set("provider_type",v)}/><div className="xl:col-span-2"><DialogFormField label={t("admin.runtimeResources.fields.modelName")}><Input value={text("model_name")} onChange={(e)=>set("model_name",e.target.value)}/></DialogFormField></div></DialogFormGrid>
          <DialogFormField label={t("admin.runtimeResources.fields.baseUrl")}><Input value={text("base_url")} onChange={(e)=>set("base_url",e.target.value)}/></DialogFormField>
          <DialogFormGrid className="xl:grid-cols-3"><Choice label={t("admin.runtimeResources.fields.credentialMode")} value={text("credential_mode")} values={["none","environment","managed_reserved"]} onChange={(v)=>set("credential_mode",v)}/><div className="xl:col-span-2"><DialogFormField label={t("admin.runtimeResources.fields.credentialKey")}><Input value={text("credential_key_hint")} onChange={(e)=>set("credential_key_hint",e.target.value)}/></DialogFormField></div></DialogFormGrid>
          <DialogFormField label={t("admin.runtimeResources.fields.capabilities")}><Input value={text("capabilities")} onChange={(e)=>set("capabilities",e.target.value)}/></DialogFormField>
        </>:null}

        {kind==="tool_registration"?<>
          <DialogFormGrid><Choice label={t("admin.runtimeResources.fields.transport")} value={text("transport_type")} values={["native","http","mcp_reserved"]} onChange={(v)=>set("transport_type",v)}/><Choice label={t("admin.runtimeResources.fields.surface")} value={text("surface_area")} values={["chat","documents","operations","admin","agents"]} onChange={(v)=>set("surface_area",v)}/></DialogFormGrid>
          <DialogFormGrid><DialogFormField label={t("admin.runtimeResources.fields.endpointUrl")}><Input value={text("endpoint_url")} onChange={(e)=>set("endpoint_url",e.target.value)}/></DialogFormField><DialogFormField label={t("admin.runtimeResources.fields.connectorReference")}><Input value={text("connector_reference")} onChange={(e)=>set("connector_reference",e.target.value)}/></DialogFormField></DialogFormGrid>
          <DialogFormField label={t("admin.runtimeResources.fields.capabilities")}><Input value={text("capabilities")} onChange={(e)=>set("capabilities",e.target.value)}/></DialogFormField>
        </>:null}

        {kind==="mcp_connector"?<>
          <DialogFormGrid><Choice label={t("admin.runtimeResources.fields.connectorType")} value={text("connector_type")} values={["streamable_http","sse","managed_reserved"]} onChange={(v)=>set("connector_type",v)}/><DialogFormField label={t("admin.runtimeResources.fields.baseUrl")}><Input value={text("base_url")} onChange={(e)=>set("base_url",e.target.value)}/></DialogFormField></DialogFormGrid>
          <DialogFormGrid><Choice label={t("admin.runtimeResources.fields.authMode")} value={text("auth_mode")} values={["none","environment","managed_reserved"]} onChange={(v)=>set("auth_mode",v)}/><DialogFormField label={t("admin.runtimeResources.fields.credentialKey")}><Input value={text("credential_key_hint")} onChange={(e)=>set("credential_key_hint",e.target.value)}/></DialogFormField></DialogFormGrid>
        </>:null}

        {kind==="retrieval_profile"?<>
          <DialogFormGrid><Choice label={t("admin.runtimeResources.fields.retrievalMode")} value={text("retrieval_mode")} values={["hybrid","vector","lexical"]} onChange={(v)=>set("retrieval_mode",v)}/><Choice label={t("admin.runtimeResources.fields.retrievalEngine")} value={text("engine_name")} values={["native","llamaindex_pilot"]} onChange={(v)=>{setDraft((current)=>({...current,engine_name:v,engine_version:v==="llamaindex_pilot"?"llamaindex_authorized_context_v1":"native_v1"}));}}/></DialogFormGrid>
          <DialogFormField label={t("admin.runtimeResources.fields.engineVersion")}><Input disabled value={text("engine_version")}/></DialogFormField>
          <DialogFormGrid>{["top_k","vector_weight","lexical_weight","hybrid_overlap_bonus"].map((x)=><DialogFormField key={x} label={t(`admin.runtimeResources.fields.${x}`)}><Input type="number" step="0.1" value={text(x)} onChange={(e)=>set(x,Number(e.target.value))}/></DialogFormField>)}</DialogFormGrid>
          {text("engine_name")==="llamaindex_pilot"?<DialogFormGrid><DialogFormField label={t("admin.runtimeResources.fields.llamaindexSimilarityCutoff")}><Input max="1" min="0" step="0.05" type="number" value={text("llamaindex_similarity_cutoff")} onChange={(e)=>set("llamaindex_similarity_cutoff",Number(e.target.value))}/></DialogFormField><label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm font-medium text-slate-700"><input type="checkbox" checked={bool("llamaindex_long_context_reorder_enabled")} onChange={(e)=>set("llamaindex_long_context_reorder_enabled",e.target.checked)}/>{t("admin.runtimeResources.fields.llamaindexLongContextReorder")}</label></DialogFormGrid>:null}
        </>:null}

        <DialogFormField label={t("admin.runtimeResources.fields.notes")}><Textarea className="min-h-[112px] resize-y" placeholder={t("admin.runtimeResources.fields.notes")} value={text("notes")||text("description")} onChange={(e)=>set(kind==="tool_registration"?"description":"notes",e.target.value)}/></DialogFormField>
        <div className="grid gap-3 sm:grid-cols-2">
          <DialogFormField label={t("admin.runtimeResources.enabled")}><Select value={bool("is_enabled")?"enabled":"disabled"} onValueChange={(value)=>set("is_enabled",value==="enabled")}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="enabled">{t("admin.runtimeResources.enabled")}</SelectItem><SelectItem value="disabled">{t("admin.runtimeResources.disabled")}</SelectItem></SelectContent></Select></DialogFormField>
          {kind==="tool_registration"?<label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm font-medium text-slate-700"><input type="checkbox" checked={bool("requires_admin_approval")} onChange={(e)=>set("requires_admin_approval",e.target.checked)}/>{t("admin.runtimeResources.fields.approval")}</label>:null}
        </div>
      </DialogFormLayout>
    </FormDialog>
    <ConfirmDialog open={Boolean(disabling)} title={t("admin.runtimeResources.disableTitle")} description={t("admin.runtimeResources.disableDescription",{name:disabling?.name??"",count:String(disabling?getBindingCount(disabling):0)})} confirmLabel={t("admin.runtimeResources.confirmDisable")} cancelLabel={t("admin.runtimeResources.cancel")} isLoading={busy} onCancel={()=>setDisabling(null)} onConfirm={async()=>{if(!disabling)return;await runAction(disabling,"toggle");setDisabling(null);}}/>
    <ConfirmDialog open={Boolean(deleting)} title={t("admin.runtimeResources.deleteTitle")} description={t("admin.runtimeResources.deleteDescription",{name:deleting?.name??""})} confirmLabel={t("admin.runtimeResources.delete")} cancelLabel={t("admin.runtimeResources.cancel")} isLoading={busy} onCancel={()=>setDeleting(null)} onConfirm={()=>void remove()}/>
  </div>;
}

function Choice({label,value,values,onChange}:{label:string;value:string;values:string[];onChange:(value:string)=>void}){return <DialogFormField label={label}><Select value={value} onValueChange={onChange}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{values.map((x)=><SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select></DialogFormField>}
