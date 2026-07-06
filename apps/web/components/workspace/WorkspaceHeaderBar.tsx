"use client";
import { useState } from "react";
import {
  PencilLine,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  DialogFormActions,
  DialogFormField,
  FormDialog,
} from "@/components/ui/form-dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/lib/i18n/provider";
import type { Conversation } from "@/components/workspace/workspace-types";

type WorkspaceHeaderBarProps = {
  conversationDraftTitle: string;
  conversationSearchQuery: string;
  conversations: Conversation[];
  errorMessage: string | null;
  isBusy: boolean;
  isConversationEditing: boolean;
  isDeletingConversation: boolean;
  isUpdatingConversation: boolean;
  onCancelConversationEditing: () => void;
  onConversationDraftTitleChange: (value: string) => void;
  onConversationSearchQueryChange: (value: string) => void;
  onDeleteConversation: () => void | Promise<void>;
  onOpenConversationEditor: () => void;
  onRefreshWorkspace: () => void | Promise<void>;
  onSelectConversation: (conversationId: string) => void;
  onStartNewConversation: () => void;
  onSubmitConversationTitle: () => void | Promise<void>;
  onToggleConsoleControls: () => void;
  selectedConversationId: string | null;
  showConsoleControls: boolean;
  workspaceView: "chat" | "documents" | "workflows";
};

export function WorkspaceHeaderBar({
  conversationDraftTitle,
  conversationSearchQuery,
  conversations,
  errorMessage,
  isBusy,
  isConversationEditing,
  isDeletingConversation,
  isUpdatingConversation,
  onCancelConversationEditing,
  onConversationDraftTitleChange,
  onConversationSearchQueryChange,
  onDeleteConversation,
  onOpenConversationEditor,
  onRefreshWorkspace,
  onSelectConversation,
  onStartNewConversation,
  onSubmitConversationTitle,
  onToggleConsoleControls,
  selectedConversationId,
  showConsoleControls,
  workspaceView,
}: WorkspaceHeaderBarProps) {
  const { t } = useI18n();
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const selectedConversationTitle =
    conversations.find(
      (conversation) => conversation.id === selectedConversationId,
    )?.title ?? t("workspace.headerBar.startConversationPlaceholder");
  return (
    <>
      <header className="border-b border-slate-200 bg-white/92 px-6 py-5 backdrop-blur dark:border-slate-800 dark:bg-slate-950/92">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            {workspaceView === "chat" ? (
              <div className="flex w-full flex-col gap-3 xl:max-w-[760px]">
                <div className="grid gap-3 xl:grid-cols-[minmax(0,1.15fr)_minmax(260px,0.85fr)]">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      className="bg-white pl-9 dark:border-slate-800 dark:bg-slate-900"
                      onChange={(event) =>
                        onConversationSearchQueryChange(event.target.value)
                      }
                      placeholder={t("workspace.headerBar.searchConversations")}
                      value={conversationSearchQuery}
                    />
                  </div>

                  {conversations.length > 0 ? (
                    <Select
                      onValueChange={onSelectConversation}
                      value={selectedConversationId ?? ""}
                    >
                      <SelectTrigger className="bg-white dark:border-slate-800 dark:bg-slate-900">
                        <SelectValue
                          placeholder={t(
                            "workspace.headerBar.startConversationPlaceholder",
                          )}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {conversations.map((conversation) => (
                          <SelectItem
                            key={conversation.id}
                            value={conversation.id}
                          >
                            {conversation.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                      {conversationSearchQuery.trim().length > 0
                        ? t("workspace.headerBar.noMatchingConversations")
                        : t("workspace.headerBar.noConversations")}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    className="bg-white dark:border-slate-800 dark:bg-slate-900"
                    disabled={isBusy}
                    onClick={onStartNewConversation}
                    type="button"
                    variant="outline"
                  >
                    <Plus className="h-4 w-4" />
                    {t("workspace.headerBar.newConversation")}
                  </Button>
                  <Button
                    className="bg-white dark:border-slate-800 dark:bg-slate-900"
                    disabled={isBusy || !selectedConversationId}
                    onClick={onOpenConversationEditor}
                    type="button"
                    variant="outline"
                  >
                    <PencilLine className="h-4 w-4" />
                    {t("workspace.headerBar.renameTitle")}
                  </Button>
                  <Button
                    className="bg-white text-rose-600 dark:border-slate-800 dark:bg-slate-900"
                    disabled={isBusy || !selectedConversationId}
                    onClick={() => setIsDeleteConfirmOpen(true)}
                    type="button"
                    variant="outline"
                  >
                    <Trash2 className="h-4 w-4" />
                    {isDeletingConversation
                      ? t("workspace.headerBar.deletingConversation")
                      : t("workspace.headerBar.deleteConversation")}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="hidden xl:block" />
            )}

            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 xl:justify-end">
              <Button
                className="bg-white dark:border-slate-800 dark:bg-slate-900"
                onClick={onToggleConsoleControls}
                type="button"
                variant="outline"
              >
                <SlidersHorizontal className="h-4 w-4" />
                {showConsoleControls
                  ? t("workspace.headerBar.hideControls")
                  : t("workspace.headerBar.contextControls")}
              </Button>
              <Button
                className="bg-white dark:border-slate-800 dark:bg-slate-900"
                disabled={isBusy}
                onClick={() => void onRefreshWorkspace()}
                type="button"
                variant="outline"
              >
                <RefreshCw className="h-4 w-4" />
                {t("workspace.headerBar.refreshWorkspace")}
              </Button>
            </div>
          </div>
        </div>
      </header>

      <FormDialog
        description={t("workspace.headerBar.conversationTitlePlaceholder")}
        footer={
          <DialogFormActions>
            <Button
              className="bg-white dark:border-slate-800 dark:bg-slate-950"
              disabled={isBusy || isUpdatingConversation}
              onClick={onCancelConversationEditing}
              type="button"
              variant="outline"
            >
              {t("workspace.headerBar.cancel")}
            </Button>
            <Button
              disabled={
                isBusy ||
                isUpdatingConversation ||
                conversationDraftTitle.trim().length === 0
              }
              onClick={() => void onSubmitConversationTitle()}
              type="button"
            >
              {isUpdatingConversation
                ? t("workspace.headerBar.savingTitle")
                : t("workspace.headerBar.saveTitle")}
            </Button>
          </DialogFormActions>
        }
        onClose={onCancelConversationEditing}
        open={isConversationEditing}
        size="md"
        title={t("workspace.headerBar.renameTitle")}
      >
        <DialogFormField label={t("workspace.headerBar.renameTitle")}>
          <Input
            className="bg-white dark:border-slate-800 dark:bg-slate-950"
            disabled={isBusy || isUpdatingConversation}
            maxLength={240}
            onChange={(event) =>
              onConversationDraftTitleChange(event.target.value)
            }
            placeholder={t("workspace.headerBar.conversationTitlePlaceholder")}
            value={conversationDraftTitle}
          />
        </DialogFormField>
      </FormDialog>

      <ConfirmDialog
        cancelLabel={t("workspace.headerBar.cancel")}
        confirmLabel={
          isDeletingConversation
            ? t("workspace.headerBar.deletingConversation")
            : t("workspace.headerBar.deleteConversation")
        }
        description={t("workspace.confirm.deleteConversation", {
          title: selectedConversationTitle,
        })}
        isLoading={isDeletingConversation}
        onCancel={() => setIsDeleteConfirmOpen(false)}
        onConfirm={async () => {
          await onDeleteConversation();
          setIsDeleteConfirmOpen(false);
        }}
        open={isDeleteConfirmOpen}
        title={t("workspace.headerBar.deleteConversation")}
      />
    </>
  );
}
