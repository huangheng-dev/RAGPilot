"use client";

import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { ChevronDown, FileUp, Globe2, MoreHorizontal, PencilLine, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DialogFormActions, DialogFormField, FormDialog } from "@/components/ui/form-dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useI18n } from "@/lib/i18n/provider";
import type { Conversation, DocumentLifecycleFilter, DocumentSourceFilter, DocumentSortOrder, KnowledgeBase, Workspace, WorkspaceSelection } from "./workspace-types";

type Props = {
  conversationDraftTitle: string; conversationSearchQuery: string; conversations: Conversation[];
  currentWorkspaceName: string; currentKnowledgeBaseName: string;
  currentWorkspaceId: string; currentKnowledgeBaseId: string; availableWorkspaces: Workspace[]; availableKnowledgeBases: KnowledgeBase[];
  hasMoreConversations: boolean; isLoadingMoreConversations: boolean;
  documentLifecycleFilter: DocumentLifecycleFilter; documentQuery: string; documentSourceFilter: DocumentSourceFilter;
  documentSortOrder: DocumentSortOrder; documentStatusFilter: string; isBusy: boolean;
  isConversationEditing: boolean; isDeletingConversation: boolean; isUpdatingConversation: boolean; isUploading: boolean;
  onCancelConversationEditing: () => void; onConversationDraftTitleChange: (value: string) => void;
  onSwitchKnowledgeScope: (selection: WorkspaceSelection) => void | Promise<void>;
  onLoadMoreConversations: () => void | Promise<void>;
  onConversationSearchQueryChange: (value: string) => void; onDeleteConversation: () => void | Promise<void>;
  onFileSelection: (event: ChangeEvent<HTMLInputElement>) => void; onImportWebPage: () => void | Promise<void>;
  onDocumentLifecycleFilterChange: (value: DocumentLifecycleFilter) => void; onDocumentQueryChange: (value: string) => void;
  onDocumentSourceFilterChange: (value: DocumentSourceFilter) => void; onDocumentSortOrderChange: (value: DocumentSortOrder) => void;
  onDocumentStatusFilterChange: (value: string) => void; onOpenConversationEditor: (conversationId?: string) => void;
  onSelectConversation: (conversationId: string) => void;
  onStartNewConversation: () => void; onSubmitConversationTitle: () => void | Promise<void>;
  selectedConversationId: string | null; workspaceView: "chat" | "documents" | "workflows";
  onUploadDocument: () => void | Promise<void>; onUploadFileSelected: (files: File[]) => void; onRemoveUploadFile: (index: number) => void;
  onWebImportTitleChange: (value: string) => void; onWebImportUrlChange: (value: string) => void;
  uploadFiles: File[]; uploadProgress: number | null; webImportTitle: string; webImportUrl: string;
};

export function WorkspaceHeaderBar(props: Props) {
  const { t } = useI18n();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [documentSourceDialogOpen, setDocumentSourceDialogOpen] = useState(false);
  const [knowledgeScopeDialogOpen, setKnowledgeScopeDialogOpen] = useState(false);
  const [documentSourceTab, setDocumentSourceTab] = useState<"files" | "web">("files");
  const [openConversationMenuId, setOpenConversationMenuId] = useState<string | null>(null);
  const conversationMenuRef = useRef<HTMLDivElement>(null);
  const selectedTitle = props.conversations.find((item) => item.id === props.selectedConversationId)?.title ?? "";
  useEffect(() => {
    if (!openConversationMenuId) return;
    const closeMenu = (event: MouseEvent) => {
      if (!conversationMenuRef.current?.contains(event.target as Node)) setOpenConversationMenuId(null);
    };
    const closeMenuWithKeyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenConversationMenuId(null);
    };
    document.addEventListener("mousedown", closeMenu);
    document.addEventListener("keydown", closeMenuWithKeyboard);
    return () => {
      document.removeEventListener("mousedown", closeMenu);
      document.removeEventListener("keydown", closeMenuWithKeyboard);
    };
  }, [openConversationMenuId]);
  const filterLabel = (value: string) => {
    const keyByValue: Record<string, string> = {
      all: "all", completed: "completed", running: "running", failed: "failed", pending: "pending",
      file: "file", web: "web", other: "other", active: "active", deleted: "deleted",
      "updated-desc": "updatedDesc", "created-desc": "createdDesc", "created-asc": "createdAsc",
      "title-asc": "titleAsc", "title-desc": "titleDesc", "status-priority": "statusPriority"
    };
    return t(`workspace.headerBar.filters.${keyByValue[value] ?? value}`);
  };

  return <>
    {props.workspaceView === "chat" ? <aside className="flex max-h-72 w-full shrink-0 flex-col border-b border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-950/70 xl:max-h-none xl:w-[292px] xl:border-b-0 xl:border-r">
      <div className="border-b border-slate-200 p-4 dark:border-slate-800">
        <div className="mb-4 text-lg font-semibold">{t("shell.nav.chat")}</div>
        <Button className="w-full" disabled={props.isBusy} onClick={props.onStartNewConversation} type="button"><Plus className="h-4 w-4" />{t("workspace.headerBar.newConversation")}</Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4" onScroll={(event) => { const element = event.currentTarget; if (element.scrollHeight - element.scrollTop - element.clientHeight < 80 && props.hasMoreConversations && !props.isLoadingMoreConversations) void props.onLoadMoreConversations(); }}><div className="mb-2 flex items-center justify-between gap-3 px-1 text-xs font-semibold uppercase tracking-[.14em] text-slate-500"><span>{t("workspace.headerBar.conversations")}</span><span className="rounded-full bg-slate-200/70 px-2 py-0.5 text-[11px] tabular-nums text-slate-600">{props.conversations.length}</span></div><div className="relative mb-3"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input className="bg-white pl-9" value={props.conversationSearchQuery} onChange={(e) => props.onConversationSearchQueryChange(e.target.value)} placeholder={t("workspace.headerBar.searchConversations")} /></div><div className="space-y-0.5">
        {props.conversations.length ? props.conversations.map((item) => {
          const isSelected = item.id === props.selectedConversationId;
          const isMenuOpen = item.id === openConversationMenuId;
          return <div key={item.id} className={`group relative flex min-h-10 items-center gap-1 rounded-xl border px-2 py-1 transition ${isSelected ? "border-blue-200 bg-blue-50" : "border-transparent hover:border-slate-200 hover:bg-white"}`}>
            <button className="min-w-0 flex-1 truncate px-1 text-left text-sm font-medium" onClick={() => { props.onSelectConversation(item.id); setOpenConversationMenuId(null); }} type="button">{item.title}</button>
            <div className="w-7 shrink-0" ref={isMenuOpen ? conversationMenuRef : undefined}>
              <button aria-expanded={isMenuOpen} aria-haspopup="menu" aria-label={t("workspace.headerBar.conversationActions")} className={`rounded-md p-1.5 text-slate-400 transition hover:bg-white hover:text-slate-700 focus:opacity-100 ${isSelected || isMenuOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`} onClick={() => { if (!isSelected) props.onSelectConversation(item.id); setOpenConversationMenuId(isMenuOpen ? null : item.id); }} type="button"><MoreHorizontal className="h-4 w-4" /></button>
              {isMenuOpen ? <div className="absolute right-2 top-[calc(100%-4px)] z-30 min-w-32 rounded-xl border border-slate-200 bg-white p-1 shadow-lg" role="menu">
                <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50" onClick={() => { setOpenConversationMenuId(null); props.onOpenConversationEditor(item.id); }} role="menuitem" type="button"><PencilLine className="h-4 w-4" />{t("workspace.headerBar.renameTitle")}</button>
                <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50" onClick={() => { setOpenConversationMenuId(null); setDeleteOpen(true); }} role="menuitem" type="button"><Trash2 className="h-4 w-4" />{t("workspace.headerBar.deleteConversation")}</button>
              </div> : null}
            </div>
          </div>;
        }) : <div className="rounded-xl border border-dashed p-3 text-sm text-slate-500">{t("workspace.headerBar.noConversations")}</div>}
      </div>{props.isLoadingMoreConversations ? <div className="py-3 text-center text-xs text-slate-400">{t("workspace.headerBar.loadingMoreConversations")}</div> : null}</div>
    </aside> : null}

    {props.workspaceView === "documents" ? <aside className="flex max-h-80 w-full shrink-0 flex-col border-b border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-950/70 xl:max-h-none xl:w-[292px] xl:border-b-0 xl:border-r"><div className="p-4">
      <div><div className="mb-4 text-lg font-semibold">{t("shell.nav.documents")}</div><div className="mb-2 px-1 text-xs font-semibold uppercase tracking-[.14em] text-slate-500">{t("workspace.headerBar.knowledgeScope")}</div><Button className="h-auto w-full justify-start bg-white px-3 py-2.5 text-left" onClick={() => setKnowledgeScopeDialogOpen(true)} type="button" variant="outline"><div className="min-w-0 flex-1"><div className="truncate text-sm font-medium text-slate-800">{props.currentWorkspaceName}</div><div className="mt-0.5 truncate text-xs font-normal text-slate-500">{props.currentKnowledgeBaseName}</div></div><ChevronDown className="h-4 w-4 shrink-0 text-slate-400" /></Button><Button className="mt-3 w-full" disabled={props.isBusy} onClick={() => setDocumentSourceDialogOpen(true)} type="button"><Plus className="h-4 w-4" />{t("workspace.headerBar.addDocument")}</Button></div>
    </div><div className="min-h-0 flex-1 space-y-2 overflow-y-auto border-t border-slate-200 p-4"><div className="px-1 text-xs font-semibold uppercase tracking-[.14em] text-slate-500">{t("workspace.headerBar.documentFilters")}</div><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input className="bg-white pl-9" value={props.documentQuery} onChange={(e) => props.onDocumentQueryChange(e.target.value)} placeholder={t("workspace.headerBar.documentSearch")} /></div>
      <Select value={props.documentStatusFilter} onValueChange={props.onDocumentStatusFilterChange}><SelectTrigger className="bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{t("workspace.headerBar.filters.allStatuses")}</SelectItem>{["completed","running","failed","pending"].map(v=><SelectItem key={v} value={v}>{filterLabel(v)}</SelectItem>)}</SelectContent></Select>
      <Select value={props.documentSourceFilter} onValueChange={(v)=>props.onDocumentSourceFilterChange(v as DocumentSourceFilter)}><SelectTrigger className="bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{t("workspace.headerBar.filters.allSources")}</SelectItem>{["file","web","other"].map(v=><SelectItem key={v} value={v}>{filterLabel(v)}</SelectItem>)}</SelectContent></Select>
      <Select value={props.documentLifecycleFilter} onValueChange={(v)=>props.onDocumentLifecycleFilterChange(v as DocumentLifecycleFilter)}><SelectTrigger className="bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{t("workspace.headerBar.filters.allLifecycles")}</SelectItem>{["active","deleted"].map(v=><SelectItem key={v} value={v}>{filterLabel(v)}</SelectItem>)}</SelectContent></Select>
      <Select value={props.documentSortOrder} onValueChange={(v)=>props.onDocumentSortOrderChange(v as DocumentSortOrder)}><SelectTrigger className="bg-white"><SelectValue /></SelectTrigger><SelectContent>{["updated-desc","created-desc","created-asc","title-asc","title-desc","status-priority"].map(v=><SelectItem key={v} value={v}>{filterLabel(v)}</SelectItem>)}</SelectContent></Select>
    </div></aside> : null}

    <FormDialog open={knowledgeScopeDialogOpen} onClose={() => setKnowledgeScopeDialogOpen(false)} title={t("workspace.headerBar.chooseKnowledgeScope")} description={t("workspace.headerBar.chooseKnowledgeScopeDescription")} footer={<DialogFormActions><Button onClick={() => setKnowledgeScopeDialogOpen(false)} type="button">{t("workspace.headerBar.done")}</Button></DialogFormActions>}>
      <div className="space-y-4"><DialogFormField label={t("workspace.headerBar.workspaceLabel")}><Select disabled={props.isBusy} onValueChange={(workspaceId) => void props.onSwitchKnowledgeScope({workspaceId})} value={props.currentWorkspaceId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{props.availableWorkspaces.map((workspace)=><SelectItem key={workspace.id} value={workspace.id}>{workspace.name}</SelectItem>)}</SelectContent></Select></DialogFormField><DialogFormField hint={t("workspace.headerBar.knowledgeBaseHint")} label={t("workspace.headerBar.knowledgeBaseLabel")}><Select disabled={props.isBusy} onValueChange={async (knowledgeBaseId) => { await props.onSwitchKnowledgeScope({workspaceId: props.currentWorkspaceId, knowledgeBaseId}); setKnowledgeScopeDialogOpen(false); }} value={props.currentKnowledgeBaseId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{props.availableKnowledgeBases.map((knowledgeBase)=><SelectItem key={knowledgeBase.id} value={knowledgeBase.id}>{knowledgeBase.name}</SelectItem>)}</SelectContent></Select></DialogFormField></div>
    </FormDialog>

    <FormDialog open={documentSourceDialogOpen} onClose={() => setDocumentSourceDialogOpen(false)} title={t("workspace.headerBar.addDocument")} footer={<DialogFormActions><Button onClick={() => setDocumentSourceDialogOpen(false)} type="button" variant="outline">{t("workspace.headerBar.cancel")}</Button>{documentSourceTab === "files" ? <Button disabled={props.isBusy || props.uploadFiles.length === 0} onClick={() => void props.onUploadDocument()} type="button">{props.isUploading ? t("workspace.headerBar.uploadingFile") : t("workspace.headerBar.uploadSelectedFiles", {count: String(props.uploadFiles.length)})}</Button> : <Button disabled={props.isBusy || !props.webImportUrl.trim()} onClick={() => void props.onImportWebPage()} type="button">{t("workspace.headerBar.importPage")}</Button>}</DialogFormActions>}>
      <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3"><div className="text-xs font-medium text-blue-600">{t("workspace.headerBar.uploadTarget")}</div><div className="mt-1 truncate text-sm font-semibold text-slate-900">{props.currentWorkspaceName} / {props.currentKnowledgeBaseName}</div></div>
      <div className="mb-5 grid grid-cols-2 rounded-xl bg-slate-100 p-1"><button className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm ${documentSourceTab === "files" ? "bg-white font-medium shadow-sm" : "text-slate-500"}`} onClick={() => setDocumentSourceTab("files")} type="button"><FileUp className="h-4 w-4" />{t("workspace.headerBar.uploadFile")}</button><button className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm ${documentSourceTab === "web" ? "bg-white font-medium shadow-sm" : "text-slate-500"}`} onClick={() => setDocumentSourceTab("web")} type="button"><Globe2 className="h-4 w-4" />{t("workspace.headerBar.importPage")}</button></div>
      {documentSourceTab === "files" ? <div className="space-y-3"><label className={`block cursor-pointer rounded-xl border border-dashed px-4 py-8 text-center text-sm ${dragActive ? "border-blue-400 bg-blue-50" : "border-slate-300 bg-slate-50"}`} onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }} onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); setDragActive(false); props.onUploadFileSelected(Array.from(e.dataTransfer.files)); }}><Input accept=".txt,.md,.markdown,.html,.htm,.csv,.json,.pdf,.docx,.xlsx" className="hidden" disabled={props.isBusy} multiple onChange={props.onFileSelection} type="file" /><FileUp className="mx-auto mb-2 h-6 w-6 text-slate-400" /><span>{t("workspace.headerBar.dropFiles")}</span></label>{props.uploadFiles.length ? <div className="max-h-52 space-y-2 overflow-y-auto">{props.uploadFiles.map((file,index)=><div className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2" key={`${file.name}-${file.size}`}><FileUp className="h-4 w-4 shrink-0 text-slate-400"/><div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{file.name}</div><div className="text-xs text-slate-400">{(file.size/1024/1024).toFixed(2)} MB</div></div><Button aria-label={t("workspace.headerBar.removeFile")} onClick={()=>props.onRemoveUploadFile(index)} size="icon" type="button" variant="ghost"><Trash2 className="h-4 w-4"/></Button></div>)}</div>:null}{props.uploadProgress !== null ? <div><div className="h-1.5 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-blue-600" style={{width:`${props.uploadProgress}%`}} /></div><div className="mt-1 text-right text-xs text-slate-500">{props.uploadProgress}%</div></div>:null}</div> : <div className="space-y-3"><DialogFormField label={t("workspace.headerBar.webUrl")}><Input value={props.webImportUrl} onChange={(e)=>props.onWebImportUrlChange(e.target.value)} placeholder="https://example.com" /></DialogFormField><DialogFormField label={t("workspace.headerBar.webImportTitlePlaceholder")}><Input value={props.webImportTitle} onChange={(e)=>props.onWebImportTitleChange(e.target.value)} /></DialogFormField></div>}
    </FormDialog>

    <FormDialog open={props.isConversationEditing} onClose={props.onCancelConversationEditing} title={t("workspace.headerBar.renameTitle")} description={t("workspace.headerBar.conversationTitlePlaceholder")} footer={<DialogFormActions><Button onClick={props.onCancelConversationEditing} type="button" variant="outline">{t("workspace.headerBar.cancel")}</Button><Button disabled={props.isBusy || !props.conversationDraftTitle.trim()} onClick={()=>void props.onSubmitConversationTitle()} type="button">{t("workspace.headerBar.saveTitle")}</Button></DialogFormActions>}><DialogFormField label={t("workspace.headerBar.renameTitle")}><Input value={props.conversationDraftTitle} onChange={(e)=>props.onConversationDraftTitleChange(e.target.value)} /></DialogFormField></FormDialog>
    <ConfirmDialog open={deleteOpen} title={t("workspace.headerBar.deleteConversation")} description={t("workspace.confirm.deleteConversation",{title:selectedTitle})} confirmLabel={t("workspace.headerBar.deleteConversation")} cancelLabel={t("workspace.headerBar.cancel")} isLoading={props.isDeletingConversation} onCancel={()=>setDeleteOpen(false)} onConfirm={async()=>{await props.onDeleteConversation();setDeleteOpen(false);}} />
  </>;
}
