"use client";

import { ChangeEvent, Dispatch, ReactNode, SetStateAction } from "react";
import { BookOpen, Building2, FileText, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/lib/i18n/provider";
import type { PlatformRetrievalProfile } from "@/lib/platform-governance";
import { cn } from "@/lib/utils";
import { slugifyValue } from "@/lib/workspace-formatters";
import type {
  BootstrapState,
  ContextManagementPanel,
  WorkspaceCatalog,
  WorkspaceSelection
} from "@/components/workspace/workspace-types";

type TenantFormControls = {
  editName: string;
  editSlug: string;
  newName: string;
  newSlug: string;
  onCreate: () => void | Promise<void>;
  onOpenEdit: () => void;
  onUpdate: () => void | Promise<void>;
  setEditName: Dispatch<SetStateAction<string>>;
  setEditSlug: Dispatch<SetStateAction<string>>;
  setNewName: Dispatch<SetStateAction<string>>;
  setNewSlug: Dispatch<SetStateAction<string>>;
};

type WorkspaceFormControls = {
  editDescription: string;
  editName: string;
  editSlug: string;
  newDescription: string;
  newName: string;
  newSlug: string;
  onCreate: () => void | Promise<void>;
  onOpenEdit: () => void;
  onToggleArchive: () => void | Promise<void>;
  onUpdate: () => void | Promise<void>;
  setEditDescription: Dispatch<SetStateAction<string>>;
  setEditName: Dispatch<SetStateAction<string>>;
  setEditSlug: Dispatch<SetStateAction<string>>;
  setNewDescription: Dispatch<SetStateAction<string>>;
  setNewName: Dispatch<SetStateAction<string>>;
  setNewSlug: Dispatch<SetStateAction<string>>;
};

type KnowledgeBaseFormControls = {
  editDescription: string;
  editName: string;
  editRetrievalProfileId: string;
  editSlug: string;
  newDescription: string;
  newName: string;
  newRetrievalProfileId: string;
  newSlug: string;
  onCreate: () => void | Promise<void>;
  onOpenCreate: () => void;
  onOpenEdit: () => void;
  onTogglePublication: () => void | Promise<void>;
  onUpdate: () => void | Promise<void>;
  setEditDescription: Dispatch<SetStateAction<string>>;
  setEditName: Dispatch<SetStateAction<string>>;
  setEditRetrievalProfileId: Dispatch<SetStateAction<string>>;
  setEditSlug: Dispatch<SetStateAction<string>>;
  setNewDescription: Dispatch<SetStateAction<string>>;
  setNewName: Dispatch<SetStateAction<string>>;
  setNewRetrievalProfileId: Dispatch<SetStateAction<string>>;
  setNewSlug: Dispatch<SetStateAction<string>>;
};

type WorkspaceSidebarProps = {
  bootstrap: BootstrapState | null;
  canManageAdminResources: boolean;
  canManageDocuments: boolean;
  catalog: WorkspaceCatalog;
  isBootstrapping: boolean;
  isCreatingContext: boolean;
  isRunningContextLifecycleAction: boolean;
  isSwitchingContext: boolean;
  isUpdatingContext: boolean;
  isUploading: boolean;
  knowledgeBaseForm: KnowledgeBaseFormControls;
  managementPanel: ContextManagementPanel;
  onFileSelection: (event: ChangeEvent<HTMLInputElement>) => void;
  onSwitchWorkspaceContext: (selection: WorkspaceSelection) => void | Promise<void>;
  onUploadDocument: () => void | Promise<void>;
  retrievalProfiles: PlatformRetrievalProfile[];
  setManagementPanel: Dispatch<SetStateAction<ContextManagementPanel>>;
  setShowConsoleControls: Dispatch<SetStateAction<boolean>>;
  showConsoleControls: boolean;
  tenantForm: TenantFormControls;
  uploadFile: File | null;
  workspaceForm: WorkspaceFormControls;
};

type ManagementDialogProps = {
  children: ReactNode;
  description: string;
  onClose: () => void;
  title: string;
};

type ManagementFieldProps = {
  children: ReactNode;
  label: string;
  hint?: string;
};

function resolveDisplayDescription(
  description: string | null | undefined,
  slug: string | null | undefined,
  type: "workspace" | "knowledgeBase",
  t: (key: string, variables?: Record<string, string>) => string
) {
  if (slug === "ragpilot-operations") {
    return t("workspace.sidebar.demoWorkspaceDescription");
  }

  if (slug === "ragpilot-handbook") {
    return t("workspace.sidebar.demoKnowledgeBaseDescription");
  }

  return description ?? slug ?? (type === "workspace" ? t("workspace.sidebar.waitingWorkspaceScope") : t("workspace.sidebar.waitingKnowledgeScope"));
}

function ManagementDialog({
  children,
  description,
  onClose,
  title
}: ManagementDialogProps) {
  const { t } = useI18n();

  return (
    <>
      <button
        aria-label={`${t("workspace.sidebar.closeContextControls")} ${title}`}
        className="fixed inset-0 z-[60] bg-slate-950/45 backdrop-blur-sm"
        onClick={onClose}
        type="button"
      />
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6">
        <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-[680px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950 sm:max-h-[calc(100vh-3rem)]">
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
            <div>
              <div className="text-base font-semibold text-slate-950 dark:text-slate-50">{title}</div>
              <div className="mt-1 text-sm text-slate-600 dark:text-slate-400">{description}</div>
            </div>
            <Button onClick={onClose} size="icon" type="button" variant="ghost">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">{children}</div>
        </div>
      </div>
    </>
  );
}

function ManagementField({
  children,
  hint,
  label
}: ManagementFieldProps) {
  const { language } = useI18n();

  return (
    <div className="space-y-2">
      <div>
        <div className={cn("text-xs font-semibold tracking-[0.16em] text-slate-500 dark:text-slate-400", language === "en" && "uppercase")}>{label}</div>
        {hint ? <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</div> : null}
      </div>
      {children}
    </div>
  );
}

export function WorkspaceSidebar({
  bootstrap,
  canManageAdminResources,
  canManageDocuments,
  catalog,
  isBootstrapping,
  isCreatingContext,
  isRunningContextLifecycleAction,
  isSwitchingContext,
  isUpdatingContext,
  isUploading,
  knowledgeBaseForm,
  managementPanel,
  onFileSelection,
  onSwitchWorkspaceContext,
  onUploadDocument,
  retrievalProfiles,
  setManagementPanel,
  setShowConsoleControls,
  showConsoleControls,
  tenantForm,
  uploadFile,
  workspaceForm
}: WorkspaceSidebarProps) {
  const { t } = useI18n();
  const isContextControlDisabled =
    isBootstrapping || isSwitchingContext || isCreatingContext || isUpdatingContext || isRunningContextLifecycleAction;

  if (!showConsoleControls) {
    return null;
  }

  return (
    <>
      <button
        aria-label={t("workspace.sidebar.closeContextControls")}
        className="fixed inset-0 z-40 bg-slate-950/35 backdrop-blur-sm"
        onClick={() => setShowConsoleControls(false)}
        type="button"
      />

      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-[480px] overflow-y-auto border-l border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950">
        <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-950 dark:text-slate-50">{t("workspace.sidebar.contextControls")}</div>
              <div className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                {t("workspace.sidebar.contextControlsDescription")}
              </div>
            </div>
            <Button onClick={() => setShowConsoleControls(false)} size="icon" type="button" variant="ghost">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-5 px-5 py-5">
          <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/70">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                <Building2 className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-slate-950 dark:text-slate-50">{bootstrap?.tenant.name ?? t("workspace.sidebar.loadingTenant")}</div>
                <div className="truncate text-xs text-slate-500 dark:text-slate-400">{bootstrap?.tenant.slug ?? t("workspace.sidebar.waitingTenantScope")}</div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                <FileText className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-slate-950 dark:text-slate-50">{bootstrap?.workspace.name ?? t("workspace.sidebar.loadingWorkspace")}</div>
                <div className="truncate text-xs text-slate-500 dark:text-slate-400">
                  {resolveDisplayDescription(bootstrap?.workspace.description, bootstrap?.workspace.slug, "workspace", t)}
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                <BookOpen className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-slate-950 dark:text-slate-50">
                  {bootstrap?.knowledgeBase.name ?? t("workspace.sidebar.loadingKnowledgeBase")}
                </div>
                <div className="truncate text-xs text-slate-500 dark:text-slate-400">
                  {resolveDisplayDescription(
                    bootstrap?.knowledgeBase.description,
                    bootstrap?.knowledgeBase.slug,
                    "knowledgeBase",
                    t
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge
                className={cn(
                  "border",
                  bootstrap?.workspace.is_archived
                    ? "border-amber-200 bg-amber-50 text-amber-700"
                    : "border-emerald-200 bg-emerald-50 text-emerald-700"
                )}
                variant="outline"
              >
                {bootstrap?.workspace.is_archived ? t("workspace.sidebar.archivedWorkspace") : t("workspace.sidebar.activeWorkspace")}
              </Badge>
              <Badge
                className={cn(
                  "border",
                  bootstrap?.knowledgeBase.publication_status === "published"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 bg-slate-100 text-slate-700"
                )}
                variant="outline"
              >
                {bootstrap?.knowledgeBase.publication_status === "published" ? t("workspace.sidebar.publishedKb") : t("workspace.sidebar.draftKb")}
              </Badge>
            </div>
          </div>

          <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/60">
            <div className="flex items-start justify-between gap-3">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{t("workspace.sidebar.sectionTenant")}</div>
              <div className="flex items-center gap-2">
                <Button
                  className="bg-white dark:border-slate-700 dark:bg-slate-950"
                  disabled={!canManageAdminResources || isContextControlDisabled}
                  onClick={tenantForm.onOpenEdit}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  {t("workspace.sidebar.edit")}
                </Button>
                <Button
                  className="bg-white dark:border-slate-700 dark:bg-slate-950"
                  disabled={!canManageAdminResources || isContextControlDisabled}
                  onClick={() => setManagementPanel((currentValue) => (currentValue === "tenant-create" ? null : "tenant-create"))}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  {t("workspace.sidebar.new")}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Select
                disabled={isContextControlDisabled || catalog.tenants.length === 0}
                onValueChange={(value) => void onSwitchWorkspaceContext({ tenantId: value })}
                value={bootstrap?.tenant.id ?? ""}
              >
                <SelectTrigger className="bg-white dark:border-slate-700 dark:bg-slate-950">
                  <SelectValue placeholder={t("workspace.sidebar.selectTenant")} />
                </SelectTrigger>
                <SelectContent>
                  {catalog.tenants.map((tenant) => (
                    <SelectItem key={tenant.id} value={tenant.id}>
                      {tenant.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="truncate text-xs text-slate-500 dark:text-slate-400">{bootstrap?.tenant.slug ?? t("workspace.sidebar.loadingTenant")}</div>
            </div>
          </div>

          <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/60">
            <div className="flex items-start justify-between gap-3">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{t("workspace.sidebar.sectionWorkspace")}</div>
              <div className="flex items-center gap-2">
                <Button
                  className="bg-white dark:border-slate-700 dark:bg-slate-950"
                  disabled={!canManageAdminResources || isContextControlDisabled || !bootstrap}
                  onClick={workspaceForm.onOpenEdit}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  {t("workspace.sidebar.edit")}
                </Button>
                <Button
                  className="bg-white dark:border-slate-700 dark:bg-slate-950"
                  disabled={!canManageAdminResources || isContextControlDisabled || !bootstrap}
                  onClick={() => setManagementPanel((currentValue) => (currentValue === "workspace-create" ? null : "workspace-create"))}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  {t("workspace.sidebar.new")}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Select
                disabled={isContextControlDisabled || catalog.workspaces.length === 0}
                onValueChange={(value) => void onSwitchWorkspaceContext({ tenantId: bootstrap?.tenant.id, workspaceId: value })}
                value={bootstrap?.workspace.id ?? ""}
              >
                <SelectTrigger className="bg-white dark:border-slate-700 dark:bg-slate-950">
                  <SelectValue placeholder={t("workspace.sidebar.selectWorkspace")} />
                </SelectTrigger>
                <SelectContent>
                  {catalog.workspaces.map((workspace) => (
                    <SelectItem key={workspace.id} value={workspace.id}>
                      {workspace.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="truncate text-xs text-slate-500 dark:text-slate-400">
                {resolveDisplayDescription(bootstrap?.workspace.description, bootstrap?.workspace.slug, "workspace", t)}
              </div>
              <div className="flex items-center justify-between gap-2">
                <Badge
                  className={cn(
                    "border",
                    bootstrap?.workspace.is_archived
                      ? "border-amber-200 bg-amber-50 text-amber-700"
                      : "border-emerald-200 bg-emerald-50 text-emerald-700"
                  )}
                  variant="outline"
                >
                  {bootstrap?.workspace.is_archived ? t("workspace.sidebar.archived") : t("workspace.sidebar.active")}
                </Badge>
                <Button
                  className="bg-white dark:border-slate-700 dark:bg-slate-950"
                  disabled={!canManageAdminResources || isContextControlDisabled || !bootstrap}
                  onClick={() => void workspaceForm.onToggleArchive()}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  {isRunningContextLifecycleAction ? t("workspace.sidebar.working") : bootstrap?.workspace.is_archived ? t("workspace.sidebar.unarchive") : t("workspace.sidebar.archive")}
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/60">
            <div className="flex items-start justify-between gap-3">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{t("workspace.sidebar.sectionKnowledgeBase")}</div>
              <div className="flex items-center gap-2">
                <Button
                  className="bg-white dark:border-slate-700 dark:bg-slate-950"
                  disabled={!canManageAdminResources || isContextControlDisabled || !bootstrap}
                  onClick={knowledgeBaseForm.onOpenEdit}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  {t("workspace.sidebar.edit")}
                </Button>
                <Button
                  className="bg-white dark:border-slate-700 dark:bg-slate-950"
                  disabled={!canManageAdminResources || isContextControlDisabled || !bootstrap}
                  onClick={knowledgeBaseForm.onOpenCreate}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  {t("workspace.sidebar.new")}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Select
                disabled={isContextControlDisabled || catalog.knowledgeBases.length === 0}
                onValueChange={(value) =>
                  void onSwitchWorkspaceContext({
                    tenantId: bootstrap?.tenant.id,
                    workspaceId: bootstrap?.workspace.id,
                    knowledgeBaseId: value
                  })
                }
                value={bootstrap?.knowledgeBase.id ?? ""}
              >
                <SelectTrigger className="bg-white dark:border-slate-700 dark:bg-slate-950">
                  <SelectValue placeholder={t("workspace.sidebar.selectKnowledgeBase")} />
                </SelectTrigger>
                <SelectContent>
                  {catalog.knowledgeBases.map((knowledgeBase) => (
                    <SelectItem key={knowledgeBase.id} value={knowledgeBase.id}>
                      {knowledgeBase.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="truncate text-xs text-slate-500 dark:text-slate-400">
                {resolveDisplayDescription(
                  bootstrap?.knowledgeBase.description,
                  bootstrap?.knowledgeBase.slug,
                  "knowledgeBase",
                  t
                )}
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-wrap gap-2">
                  <Badge
                    className={cn(
                      "border",
                      bootstrap?.knowledgeBase.publication_status === "published"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-slate-200 bg-slate-50 text-slate-600"
                    )}
                    variant="outline"
                  >
                    {bootstrap?.knowledgeBase.publication_status === "published" ? t("workspace.sidebar.published") : t("workspace.sidebar.draft")}
                  </Badge>
                  {bootstrap?.knowledgeBase.retrieval_profile_name ? (
                    <Badge className="border-blue-200 bg-blue-50 text-blue-700" variant="outline">
                      {bootstrap.knowledgeBase.retrieval_profile_name}
                    </Badge>
                  ) : null}
                </div>
                <Button
                  className="bg-white dark:border-slate-700 dark:bg-slate-950"
                  disabled={!canManageAdminResources || isContextControlDisabled || !bootstrap}
                  onClick={() => void knowledgeBaseForm.onTogglePublication()}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  {isRunningContextLifecycleAction
                    ? t("workspace.sidebar.working")
                    : bootstrap?.knowledgeBase.publication_status === "published"
                      ? t("workspace.sidebar.moveToDraft")
                      : t("workspace.sidebar.publish")}
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/60">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t("workspace.sidebar.documentIngestion")}</h2>
              <span className="text-xs text-slate-500 dark:text-slate-400">{t("workspace.sidebar.supportedFormats")}</span>
            </div>
            <div className="space-y-3">
              <label className="flex min-h-24 cursor-pointer items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-4 py-4 text-center text-sm text-slate-600 transition hover:border-blue-400 hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-900">
                <input
                  accept=".txt,.md,.markdown,.html,.htm,.csv,.json,.pdf,.docx,.xlsx,text/plain,text/markdown,text/html,application/xhtml+xml,text/csv,application/csv,application/json,text/json,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="hidden"
                  disabled={!canManageDocuments || isContextControlDisabled || isUploading}
                  onChange={onFileSelection}
                  type="file"
                />
                <span>{uploadFile ? uploadFile.name : t("workspace.sidebar.chooseFile")}</span>
              </label>
              <Button
                className="w-full"
                disabled={!canManageDocuments || !uploadFile || isUploading || isContextControlDisabled}
                onClick={onUploadDocument}
                type="button"
              >
                {isUploading ? t("workspace.sidebar.indexingDocument") : t("workspace.sidebar.uploadAndIndex")}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {managementPanel === "tenant-edit" ? (
        <ManagementDialog
          description={t("workspace.sidebar.modal.tenantEditDescription")}
          onClose={() => setManagementPanel(null)}
          title={t("workspace.sidebar.modal.tenantEditTitle")}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <ManagementField label={t("workspace.sidebar.modal.tenantName")}>
              <Input onChange={(event) => tenantForm.setEditName(event.target.value)} placeholder={t("workspace.sidebar.modal.tenantNamePlaceholder")} value={tenantForm.editName} />
            </ManagementField>
            <ManagementField hint={t("workspace.sidebar.modal.tenantSlugHint")} label={t("workspace.sidebar.modal.tenantSlug")}>
              <Input
                onChange={(event) => tenantForm.setEditSlug(slugifyValue(event.target.value))}
                placeholder={t("workspace.sidebar.modal.tenantSlugPlaceholder")}
                value={tenantForm.editSlug}
              />
            </ManagementField>
          </div>
          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
            <Button onClick={() => setManagementPanel(null)} type="button" variant="outline">
              {t("workspace.sidebar.modal.cancel")}
            </Button>
            <Button
              disabled={!canManageAdminResources || isUpdatingContext || !tenantForm.editName.trim() || !tenantForm.editSlug.trim()}
              onClick={() => void tenantForm.onUpdate()}
              type="button"
            >
              {isUpdatingContext ? t("workspace.sidebar.modal.saving") : t("workspace.sidebar.modal.saveTenant")}
            </Button>
          </div>
        </ManagementDialog>
      ) : null}

      {managementPanel === "tenant-create" ? (
        <ManagementDialog
          description={t("workspace.sidebar.modal.tenantCreateDescription")}
          onClose={() => setManagementPanel(null)}
          title={t("workspace.sidebar.modal.tenantCreateTitle")}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <ManagementField label={t("workspace.sidebar.modal.tenantName")}>
              <Input
                onChange={(event) => {
                  const nextValue = event.target.value;
                  tenantForm.setNewName(nextValue);
                  if (!tenantForm.newSlug.trim()) {
                    tenantForm.setNewSlug(slugifyValue(nextValue));
                  }
                }}
                placeholder={t("workspace.sidebar.modal.tenantNamePlaceholder")}
                value={tenantForm.newName}
              />
            </ManagementField>
            <ManagementField hint={t("workspace.sidebar.modal.tenantSlugHint")} label={t("workspace.sidebar.modal.tenantSlug")}>
              <Input
                onChange={(event) => tenantForm.setNewSlug(slugifyValue(event.target.value))}
                placeholder={t("workspace.sidebar.modal.tenantSlugPlaceholder")}
                value={tenantForm.newSlug}
              />
            </ManagementField>
          </div>
          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
            <Button onClick={() => setManagementPanel(null)} type="button" variant="outline">
              {t("workspace.sidebar.modal.cancel")}
            </Button>
            <Button
              disabled={!canManageAdminResources || isCreatingContext || !tenantForm.newName.trim() || !tenantForm.newSlug.trim()}
              onClick={() => void tenantForm.onCreate()}
              type="button"
            >
              {isCreatingContext ? t("workspace.sidebar.modal.creating") : t("workspace.sidebar.modal.createTenant")}
            </Button>
          </div>
        </ManagementDialog>
      ) : null}

      {managementPanel === "workspace-edit" ? (
        <ManagementDialog
          description={t("workspace.sidebar.modal.workspaceEditDescription")}
          onClose={() => setManagementPanel(null)}
          title={t("workspace.sidebar.modal.workspaceEditTitle")}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <ManagementField label={t("workspace.sidebar.modal.workspaceName")}>
              <Input onChange={(event) => workspaceForm.setEditName(event.target.value)} placeholder={t("workspace.sidebar.modal.workspaceNamePlaceholder")} value={workspaceForm.editName} />
            </ManagementField>
            <ManagementField hint={t("workspace.sidebar.modal.workspaceSlugHint")} label={t("workspace.sidebar.modal.workspaceSlug")}>
              <Input
                onChange={(event) => workspaceForm.setEditSlug(slugifyValue(event.target.value))}
                placeholder={t("workspace.sidebar.modal.workspaceSlugPlaceholder")}
                value={workspaceForm.editSlug}
              />
            </ManagementField>
          </div>
          <ManagementField hint={t("workspace.sidebar.modal.workspaceDescriptionHint")} label={t("workspace.sidebar.modal.workspaceDescription")}>
            <Textarea
              className="min-h-28"
              onChange={(event) => workspaceForm.setEditDescription(event.target.value)}
              placeholder={t("workspace.sidebar.modal.workspaceDescriptionPlaceholder")}
              value={workspaceForm.editDescription}
            />
          </ManagementField>
          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
            <Button onClick={() => setManagementPanel(null)} type="button" variant="outline">
              {t("workspace.sidebar.modal.cancel")}
            </Button>
            <Button
              disabled={!canManageAdminResources || isUpdatingContext || !workspaceForm.editName.trim() || !workspaceForm.editSlug.trim()}
              onClick={() => void workspaceForm.onUpdate()}
              type="button"
            >
              {isUpdatingContext ? t("workspace.sidebar.modal.saving") : t("workspace.sidebar.modal.saveWorkspace")}
            </Button>
          </div>
        </ManagementDialog>
      ) : null}

      {managementPanel === "workspace-create" ? (
        <ManagementDialog
          description={t("workspace.sidebar.modal.workspaceCreateDescription")}
          onClose={() => setManagementPanel(null)}
          title={t("workspace.sidebar.modal.workspaceCreateTitle")}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <ManagementField label={t("workspace.sidebar.modal.workspaceName")}>
              <Input
                onChange={(event) => {
                  const nextValue = event.target.value;
                  workspaceForm.setNewName(nextValue);
                  if (!workspaceForm.newSlug.trim()) {
                    workspaceForm.setNewSlug(slugifyValue(nextValue));
                  }
                }}
                placeholder={t("workspace.sidebar.modal.workspaceNamePlaceholder")}
                value={workspaceForm.newName}
              />
            </ManagementField>
            <ManagementField hint={t("workspace.sidebar.modal.workspaceSlugHint")} label={t("workspace.sidebar.modal.workspaceSlug")}>
              <Input
                onChange={(event) => workspaceForm.setNewSlug(slugifyValue(event.target.value))}
                placeholder={t("workspace.sidebar.modal.workspaceSlugPlaceholder")}
                value={workspaceForm.newSlug}
              />
            </ManagementField>
          </div>
          <ManagementField hint={t("workspace.sidebar.modal.workspaceDescriptionHint")} label={t("workspace.sidebar.modal.workspaceDescription")}>
            <Textarea
              className="min-h-28"
              onChange={(event) => workspaceForm.setNewDescription(event.target.value)}
              placeholder={t("workspace.sidebar.modal.workspaceDescriptionPlaceholder")}
              value={workspaceForm.newDescription}
            />
          </ManagementField>
          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
            <Button onClick={() => setManagementPanel(null)} type="button" variant="outline">
              {t("workspace.sidebar.modal.cancel")}
            </Button>
            <Button
              disabled={!canManageAdminResources || isCreatingContext || !workspaceForm.newName.trim() || !workspaceForm.newSlug.trim()}
              onClick={() => void workspaceForm.onCreate()}
              type="button"
            >
              {isCreatingContext ? t("workspace.sidebar.modal.creating") : t("workspace.sidebar.modal.createWorkspace")}
            </Button>
          </div>
        </ManagementDialog>
      ) : null}

      {managementPanel === "knowledge-base-edit" ? (
        <ManagementDialog
          description={t("workspace.sidebar.modal.knowledgeBaseEditDescription")}
          onClose={() => setManagementPanel(null)}
          title={t("workspace.sidebar.modal.knowledgeBaseEditTitle")}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <ManagementField label={t("workspace.sidebar.modal.knowledgeBaseName")}>
              <Input
                onChange={(event) => knowledgeBaseForm.setEditName(event.target.value)}
                placeholder={t("workspace.sidebar.modal.knowledgeBaseNamePlaceholder")}
                value={knowledgeBaseForm.editName}
              />
            </ManagementField>
            <ManagementField hint={t("workspace.sidebar.modal.knowledgeBaseSlugHint")} label={t("workspace.sidebar.modal.knowledgeBaseSlug")}>
              <Input
                onChange={(event) => knowledgeBaseForm.setEditSlug(slugifyValue(event.target.value))}
                placeholder={t("workspace.sidebar.modal.knowledgeBaseSlugPlaceholder")}
                value={knowledgeBaseForm.editSlug}
              />
            </ManagementField>
          </div>
          <ManagementField hint={t("workspace.sidebar.modal.knowledgeBaseDescriptionHint")} label={t("workspace.sidebar.modal.knowledgeBaseDescription")}>
            <Textarea
              className="min-h-28"
              onChange={(event) => knowledgeBaseForm.setEditDescription(event.target.value)}
              placeholder={t("workspace.sidebar.modal.knowledgeBaseDescriptionPlaceholder")}
              value={knowledgeBaseForm.editDescription}
            />
          </ManagementField>
          <ManagementField
            hint={t("workspace.sidebar.modal.knowledgeBaseRetrievalProfileHint")}
            label={t("workspace.sidebar.modal.knowledgeBaseRetrievalProfile")}
          >
            <Select
              onValueChange={(value) => knowledgeBaseForm.setEditRetrievalProfileId(value === "none" ? "" : value)}
              value={knowledgeBaseForm.editRetrievalProfileId || "none"}
            >
              <SelectTrigger className="bg-white dark:border-slate-700 dark:bg-slate-950">
                <SelectValue placeholder={t("workspace.sidebar.modal.knowledgeBaseRetrievalProfile")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("workspace.sidebar.modal.knowledgeBaseRetrievalProfileDefault")}</SelectItem>
                {retrievalProfiles.map((retrievalProfile) => (
                  <SelectItem key={retrievalProfile.id} value={retrievalProfile.id}>
                    {retrievalProfile.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </ManagementField>
          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
            <Button onClick={() => setManagementPanel(null)} type="button" variant="outline">
              {t("workspace.sidebar.modal.cancel")}
            </Button>
            <Button
              disabled={!canManageAdminResources || isUpdatingContext || !knowledgeBaseForm.editName.trim() || !knowledgeBaseForm.editSlug.trim()}
              onClick={() => void knowledgeBaseForm.onUpdate()}
              type="button"
            >
              {isUpdatingContext ? t("workspace.sidebar.modal.saving") : t("workspace.sidebar.modal.saveKnowledgeBase")}
            </Button>
          </div>
        </ManagementDialog>
      ) : null}

      {managementPanel === "knowledge-base-create" ? (
        <ManagementDialog
          description={t("workspace.sidebar.modal.knowledgeBaseCreateDescription")}
          onClose={() => setManagementPanel(null)}
          title={t("workspace.sidebar.modal.knowledgeBaseCreateTitle")}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <ManagementField label={t("workspace.sidebar.modal.knowledgeBaseName")}>
              <Input
                onChange={(event) => {
                  const nextValue = event.target.value;
                  knowledgeBaseForm.setNewName(nextValue);
                  if (!knowledgeBaseForm.newSlug.trim()) {
                    knowledgeBaseForm.setNewSlug(slugifyValue(nextValue));
                  }
                }}
                placeholder={t("workspace.sidebar.modal.knowledgeBaseNamePlaceholder")}
                value={knowledgeBaseForm.newName}
              />
            </ManagementField>
            <ManagementField hint={t("workspace.sidebar.modal.knowledgeBaseSlugHint")} label={t("workspace.sidebar.modal.knowledgeBaseSlug")}>
              <Input
                onChange={(event) => knowledgeBaseForm.setNewSlug(slugifyValue(event.target.value))}
                placeholder={t("workspace.sidebar.modal.knowledgeBaseSlugPlaceholder")}
                value={knowledgeBaseForm.newSlug}
              />
            </ManagementField>
          </div>
          <ManagementField hint={t("workspace.sidebar.modal.knowledgeBaseDescriptionHint")} label={t("workspace.sidebar.modal.knowledgeBaseDescription")}>
            <Textarea
              className="min-h-28"
              onChange={(event) => knowledgeBaseForm.setNewDescription(event.target.value)}
              placeholder={t("workspace.sidebar.modal.knowledgeBaseDescriptionPlaceholder")}
              value={knowledgeBaseForm.newDescription}
            />
          </ManagementField>
          <ManagementField
            hint={t("workspace.sidebar.modal.knowledgeBaseRetrievalProfileHint")}
            label={t("workspace.sidebar.modal.knowledgeBaseRetrievalProfile")}
          >
            <Select
              onValueChange={(value) => knowledgeBaseForm.setNewRetrievalProfileId(value === "none" ? "" : value)}
              value={knowledgeBaseForm.newRetrievalProfileId || "none"}
            >
              <SelectTrigger className="bg-white dark:border-slate-700 dark:bg-slate-950">
                <SelectValue placeholder={t("workspace.sidebar.modal.knowledgeBaseRetrievalProfile")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("workspace.sidebar.modal.knowledgeBaseRetrievalProfileDefault")}</SelectItem>
                {retrievalProfiles.map((retrievalProfile) => (
                  <SelectItem key={retrievalProfile.id} value={retrievalProfile.id}>
                    {retrievalProfile.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </ManagementField>
          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
            <Button onClick={() => setManagementPanel(null)} type="button" variant="outline">
              {t("workspace.sidebar.modal.cancel")}
            </Button>
            <Button
              disabled={!canManageAdminResources || isCreatingContext || !knowledgeBaseForm.newName.trim() || !knowledgeBaseForm.newSlug.trim()}
              onClick={() => void knowledgeBaseForm.onCreate()}
              type="button"
            >
              {isCreatingContext ? t("workspace.sidebar.modal.creating") : t("workspace.sidebar.modal.createKnowledgeBase")}
            </Button>
          </div>
        </ManagementDialog>
      ) : null}
    </>
  );
}
