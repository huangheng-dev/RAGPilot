"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PencilLine, Plus, RefreshCw, Search, Trash2, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DialogFormActions, DialogFormField, DialogFormGrid, FormDialog } from "@/components/ui/form-dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ConsoleEmptyState, ConsoleSurface, ConsoleSurfaceHeader } from "@/components/console/ConsolePrimitives";
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
  const [draft, setDraft] = useState<Draft>({});
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [m, x, c, r] = await Promise.all([listModelEndpoints(), listToolRegistrations(), listMcpConnectors(), listRetrievalProfiles()]);
      setModels(m); setTools(x); setConnectors(c); setProfiles(r);
    } catch (e) { setError(e instanceof Error ? e.message : t("admin.runtimeResources.loadFailed")); }
    finally { setLoading(false); }
  }, [t]);

  useEffect(() => { void load(); }, [load]);
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

  function openCreate() {
    setCreating(true); setEditing(null); setMessage(null); setError(null);
    setDraft(kind === "model_endpoint" ? { name: "", slug: "", provider_type: "ollama", model_name: "", base_url: "http://host.docker.internal:11434", credential_mode: "none", credential_key_hint: "", capabilities: "chat", is_enabled: true, is_default: false, notes: "" }
      : kind === "tool_registration" ? { name: "", slug: "", transport_type: "http", surface_area: "agents", endpoint_url: "", connector_reference: "", description: "", capabilities: "", requires_admin_approval: true, is_enabled: false }
      : kind === "mcp_connector" ? { name: "", slug: "", connector_type: "streamable_http", base_url: "", auth_mode: "none", credential_key_hint: "", notes: "", is_enabled: false }
      : { name: "", slug: "", retrieval_mode: "hybrid", top_k: 8, vector_weight: 0.7, lexical_weight: 0.3, hybrid_overlap_bonus: 0.1, is_enabled: true, is_default: false, notes: "" });
  }

  function openEdit(item: Resource) {
    setCreating(false); setEditing(item); setMessage(null); setError(null);
    if (kind === "model_endpoint") { const x=item as PlatformModelEndpoint; setDraft({ name:x.name,slug:x.slug,provider_type:x.provider_type,model_name:x.model_name,base_url:x.base_url??"",credential_mode:x.credential_mode,credential_key_hint:x.credential_key_hint??"",capabilities:x.capabilities.join(","),is_enabled:x.is_enabled,is_default:x.is_default,notes:x.notes??"" }); }
    else if (kind === "tool_registration") { const x=item as PlatformToolRegistration; setDraft({ name:x.name,slug:x.slug,transport_type:x.transport_type,surface_area:x.surface_area,endpoint_url:x.endpoint_url??"",connector_reference:x.connector_reference??"",description:x.description??"",capabilities:x.capabilities.join(","),requires_admin_approval:x.requires_admin_approval,is_enabled:x.is_enabled }); }
    else if (kind === "mcp_connector") { const x=item as PlatformMcpConnector; setDraft({ name:x.name,slug:x.slug,connector_type:x.connector_type,base_url:x.base_url??"",auth_mode:x.auth_mode,credential_key_hint:x.credential_key_hint??"",notes:x.notes??"",is_enabled:x.is_enabled }); }
    else { const x=item as PlatformRetrievalProfile; setDraft({ name:x.name,slug:x.slug,retrieval_mode:x.retrieval_mode,top_k:x.top_k,vector_weight:x.vector_weight,lexical_weight:x.lexical_weight,hybrid_overlap_bonus:x.hybrid_overlap_bonus,is_enabled:x.is_enabled,is_default:x.is_default,notes:x.notes??"" }); }
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
        const payload={name:text("name"),slug:text("slug"),retrieval_mode:text("retrieval_mode") as PlatformRetrievalProfile["retrieval_mode"],top_k:number("top_k"),vector_weight:number("vector_weight"),lexical_weight:number("lexical_weight"),hybrid_overlap_bonus:number("hybrid_overlap_bonus"),is_enabled:bool("is_enabled"),is_default:bool("is_default"),notes:text("notes")||null};
        creating ? await createRetrievalProfile(payload) : await updateRetrievalProfile(editing!.id,payload);
      }
      setEditing(null); setCreating(false); setMessage(t("admin.runtimeResources.saved")); await load();
    } catch(e) { setError(e instanceof Error ? e.message : t("admin.runtimeResources.saveFailed")); }
    finally { setBusy(false); }
  }

  async function runAction(item: Resource, action: "toggle"|"preview"|"default") {
    setBusy(true); setError(null); setMessage(null);
    try {
      if (kind === "model_endpoint") { const x=item as PlatformModelEndpoint; if(action==="preview") await previewModelEndpoint(x.id); else await applyModelEndpointGovernanceAction(x.id,action==="default"?"promote_default":x.is_enabled?"disable_endpoint":"enable_endpoint"); }
      else if(kind === "tool_registration") { const x=item as PlatformToolRegistration; if(action==="preview") { if(!tenantId) throw new Error(t("admin.runtimeResources.selectTenant")); await previewToolRegistration(x.id,{tenant_id:tenantId,execution_input:"Runtime resource connectivity test"}); } else await applyToolGovernanceAction(x.id,x.is_enabled?"disable_tool":"enable_tool"); }
      else if(kind === "mcp_connector") { const x=item as PlatformMcpConnector; if(action==="preview") await previewMcpConnector(x.id); else await applyMcpConnectorGovernanceAction(x.id,x.is_enabled?"disable_connector":"enable_connector"); }
      else { const x=item as PlatformRetrievalProfile; await applyRetrievalProfileGovernanceAction(x.id,action==="default"?"promote_default":x.is_enabled?"disable_profile":"enable_profile"); }
      setMessage(action==="preview"?t("admin.runtimeResources.previewComplete"):t("admin.runtimeResources.actionComplete")); await load();
    } catch(e){setError(e instanceof Error?e.message:t("admin.runtimeResources.actionFailed"));} finally{setBusy(false);}
  }

  async function remove() { if(!deleting)return; setBusy(true); try { if(kind==="model_endpoint")await deleteModelEndpoint(deleting.id);else if(kind==="tool_registration")await deleteToolRegistration(deleting.id);else if(kind==="mcp_connector")await deleteMcpConnector(deleting.id);else await deleteRetrievalProfile(deleting.id);setDeleting(null);await load();}catch(e){setError(e instanceof Error?e.message:t("admin.runtimeResources.deleteFailed"));}finally{setBusy(false);} }

  return <div className="space-y-5">
    <ConsoleSurface><ConsoleSurfaceHeader title={t("admin.runtimeResources.title")} description={t("admin.runtimeResources.description")} action={<div className="flex gap-2"><Button variant="outline" onClick={()=>void load()} disabled={loading}><RefreshCw className={loading?"h-4 w-4 animate-spin":"h-4 w-4"}/>{t("admin.runtimeResources.refresh")}</Button><Button onClick={openCreate}><Plus className="h-4 w-4"/>{t("admin.runtimeResources.create")}</Button></div>}/>
      <div className="border-t border-slate-100 p-5"><div className="flex flex-wrap gap-2">{kinds.map((x)=><Button key={x} variant={kind===x?"default":"outline"} onClick={()=>{setKind(x);setQuery("");}}>{t(`admin.runtimeResources.kinds.${x}`)}</Button>)}</div><div className="relative mt-4"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/><Input className="pl-9" value={query} onChange={(e)=>setQuery(e.target.value)} placeholder={t("admin.runtimeResources.search")}/></div></div>
    </ConsoleSurface>
    {message?<div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</div>:null}{error?<div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>:null}
    <div className="grid gap-3">{visible.length?visible.map((item)=><ConsoleSurface key={item.id}><div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between"><div><div className="flex flex-wrap items-center gap-2"><span className="font-semibold text-slate-950">{item.name}</span><Badge variant="outline">{item.is_enabled?t("admin.runtimeResources.enabled"):t("admin.runtimeResources.disabled")}</Badge>{"is_default" in item&&item.is_default?<Badge>{t("admin.runtimeResources.default")}</Badge>:null}</div><div className="mt-1 text-sm text-slate-500">{item.slug} · {item.id}</div></div><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={()=>openEdit(item)}><PencilLine className="h-4 w-4"/>{t("admin.runtimeResources.edit")}</Button>{kind!=="retrieval_profile"?<Button size="sm" variant="outline" disabled={busy} onClick={()=>void runAction(item,"preview")}><Zap className="h-4 w-4"/>{t("admin.runtimeResources.test")}</Button>:null}<Button size="sm" variant="outline" disabled={busy} onClick={()=>void runAction(item,"toggle")}>{item.is_enabled?t("admin.runtimeResources.disable"):t("admin.runtimeResources.enable")}</Button>{"is_default" in item&&!item.is_default?<Button size="sm" variant="outline" onClick={()=>void runAction(item,"default")}>{t("admin.runtimeResources.makeDefault")}</Button>:null}<Button size="sm" variant="outline" onClick={()=>setDeleting(item)}><Trash2 className="h-4 w-4"/></Button></div></div></ConsoleSurface>):<ConsoleEmptyState>{t("admin.runtimeResources.empty")}</ConsoleEmptyState>}</div>
    <FormDialog open={creating||Boolean(editing)} onClose={()=>{setCreating(false);setEditing(null);}} title={creating?t("admin.runtimeResources.createTitle"):t("admin.runtimeResources.editTitle")} description={t(`admin.runtimeResources.kinds.${kind}`)} footer={<DialogFormActions><Button variant="outline" onClick={()=>{setCreating(false);setEditing(null);}}>{t("admin.runtimeResources.cancel")}</Button><Button disabled={busy||!text("name")||!text("slug")} onClick={()=>void save()}>{busy?t("admin.runtimeResources.saving"):t("admin.runtimeResources.save")}</Button></DialogFormActions>}>
      <DialogFormGrid><DialogFormField label={t("admin.runtimeResources.fields.name")}><Input value={text("name")} onChange={(e)=>set("name",e.target.value)}/></DialogFormField><DialogFormField label={t("admin.runtimeResources.fields.slug")}><Input value={text("slug")} onChange={(e)=>set("slug",e.target.value)}/></DialogFormField></DialogFormGrid>
      {kind==="model_endpoint"?<><DialogFormGrid><Choice label={t("admin.runtimeResources.fields.provider")} value={text("provider_type")} values={["deterministic","openai_compatible","ollama","vllm"]} onChange={(v)=>set("provider_type",v)}/><DialogFormField label={t("admin.runtimeResources.fields.modelName")}><Input value={text("model_name")} onChange={(e)=>set("model_name",e.target.value)}/></DialogFormField></DialogFormGrid><DialogFormField label={t("admin.runtimeResources.fields.baseUrl")}><Input value={text("base_url")} onChange={(e)=>set("base_url",e.target.value)}/></DialogFormField><Choice label={t("admin.runtimeResources.fields.credentialMode")} value={text("credential_mode")} values={["none","environment","managed_reserved"]} onChange={(v)=>set("credential_mode",v)}/><DialogFormField label={t("admin.runtimeResources.fields.credentialKey")}><Input value={text("credential_key_hint")} onChange={(e)=>set("credential_key_hint",e.target.value)}/></DialogFormField><DialogFormField label={t("admin.runtimeResources.fields.capabilities")}><Input value={text("capabilities")} onChange={(e)=>set("capabilities",e.target.value)}/></DialogFormField></>:null}
      {kind==="tool_registration"?<><DialogFormGrid><Choice label={t("admin.runtimeResources.fields.transport")} value={text("transport_type")} values={["native","http","mcp_reserved"]} onChange={(v)=>set("transport_type",v)}/><Choice label={t("admin.runtimeResources.fields.surface")} value={text("surface_area")} values={["chat","documents","operations","admin","agents"]} onChange={(v)=>set("surface_area",v)}/></DialogFormGrid><DialogFormField label={t("admin.runtimeResources.fields.endpointUrl")}><Input value={text("endpoint_url")} onChange={(e)=>set("endpoint_url",e.target.value)}/></DialogFormField><DialogFormField label={t("admin.runtimeResources.fields.connectorReference")}><Input value={text("connector_reference")} onChange={(e)=>set("connector_reference",e.target.value)}/></DialogFormField><DialogFormField label={t("admin.runtimeResources.fields.capabilities")}><Input value={text("capabilities")} onChange={(e)=>set("capabilities",e.target.value)}/></DialogFormField></>:null}
      {kind==="mcp_connector"?<><Choice label={t("admin.runtimeResources.fields.connectorType")} value={text("connector_type")} values={["streamable_http","sse","managed_reserved"]} onChange={(v)=>set("connector_type",v)}/><DialogFormField label={t("admin.runtimeResources.fields.baseUrl")}><Input value={text("base_url")} onChange={(e)=>set("base_url",e.target.value)}/></DialogFormField><Choice label={t("admin.runtimeResources.fields.authMode")} value={text("auth_mode")} values={["none","environment","managed_reserved"]} onChange={(v)=>set("auth_mode",v)}/><DialogFormField label={t("admin.runtimeResources.fields.credentialKey")}><Input value={text("credential_key_hint")} onChange={(e)=>set("credential_key_hint",e.target.value)}/></DialogFormField></>:null}
      {kind==="retrieval_profile"?<><Choice label={t("admin.runtimeResources.fields.retrievalMode")} value={text("retrieval_mode")} values={["hybrid","vector","lexical"]} onChange={(v)=>set("retrieval_mode",v)}/><DialogFormGrid>{["top_k","vector_weight","lexical_weight","hybrid_overlap_bonus"].map((x)=><DialogFormField key={x} label={t(`admin.runtimeResources.fields.${x}`)}><Input type="number" step="0.1" value={text(x)} onChange={(e)=>set(x,Number(e.target.value))}/></DialogFormField>)}</DialogFormGrid></>:null}
      <DialogFormField label={t("admin.runtimeResources.fields.notes")}><Textarea value={text("notes")||text("description")} onChange={(e)=>set(kind==="tool_registration"?"description":"notes",e.target.value)}/></DialogFormField><div className="flex gap-4"><label className="flex items-center gap-2"><input type="checkbox" checked={bool("is_enabled")} onChange={(e)=>set("is_enabled",e.target.checked)}/>{t("admin.runtimeResources.enabled")}</label>{kind==="tool_registration"?<label className="flex items-center gap-2"><input type="checkbox" checked={bool("requires_admin_approval")} onChange={(e)=>set("requires_admin_approval",e.target.checked)}/>{t("admin.runtimeResources.fields.approval")}</label>:null}</div>
    </FormDialog>
    <ConfirmDialog open={Boolean(deleting)} title={t("admin.runtimeResources.deleteTitle")} description={t("admin.runtimeResources.deleteDescription",{name:deleting?.name??""})} confirmLabel={t("admin.runtimeResources.delete")} cancelLabel={t("admin.runtimeResources.cancel")} isLoading={busy} onCancel={()=>setDeleting(null)} onConfirm={()=>void remove()}/>
  </div>;
}

function Choice({label,value,values,onChange}:{label:string;value:string;values:string[];onChange:(value:string)=>void}){return <DialogFormField label={label}><Select value={value} onValueChange={onChange}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{values.map((x)=><SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select></DialogFormField>}
