"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { BookOpen, Bot, Building2, FileText, PencilLine, Plus, RefreshCw, Search, SlidersHorizontal, Trash2 } from "lucide-react";

import { AgentRunButtonLink } from "@/components/agents/AgentRunButtonLink";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useI18n } from "@/lib/i18n/provider";
import type { AgentRunRecordInput } from "@/lib/agent-runs";
import type { WorkspaceSourceSurface } from "@/lib/workspace-navigation";
import type {
  BootstrapState,
  Conversation,
  ConversationMetrics,
  RetrievalValidationSummary,
  WorkspaceAgentContext
} from "@/components/workspace/workspace-types";

type LinkHref = ComponentProps<typeof Link>["href"];

type WorkspaceHeaderBarProps = {
  bootstrap: BootstrapState | null;
  conversationMetrics: ConversationMetrics;
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
  activeAgentContext: WorkspaceAgentContext | null;
  agentConsoleHref: LinkHref | null;
  isCurrentSurfaceRecommended: boolean | null;
  recommendedSurfaceHref: LinkHref | null;
  recommendedSurfaceRunRecord?: AgentRunRecordInput | null;
  sourceSurfaceHref: LinkHref | null;
  sourceSurface: WorkspaceSourceSurface | null;
  selectedConversationId: string | null;
  selectedConversationTitle: string | null;
  showConsoleControls: boolean;
  statusMessage: string;
  retrievalValidationSummary: RetrievalValidationSummary | null;
  workspaceView: "chat" | "documents" | "workflows";
};

export function WorkspaceHeaderBar({
  bootstrap,
  conversationMetrics,
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
  activeAgentContext,
  agentConsoleHref,
  isCurrentSurfaceRecommended,
  recommendedSurfaceHref,
  recommendedSurfaceRunRecord,
  sourceSurfaceHref,
  sourceSurface,
  selectedConversationId,
  selectedConversationTitle,
  showConsoleControls,
  statusMessage,
  retrievalValidationSummary,
  workspaceView
}: WorkspaceHeaderBarProps) {
  const { t } = useI18n();
  const sourceSurfaceLabel =
    sourceSurface === "admin"
      ? t("workspace.headerBar.sources.admin")
      : sourceSurface === "operations"
        ? t("workspace.headerBar.sources.operations")
          : sourceSurface === "agents"
            ? t("workspace.headerBar.sources.agents")
            : t("workspace.headerBar.sources.home");

  function getValidationStatusClassName() {
    switch (retrievalValidationSummary?.status) {
      case "ready":
        return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200";
      case "review":
        return "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200";
      case "hold":
        return "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200";
      case "empty":
      case "failed":
        return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200";
      default:
        return "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200";
    }
  }

  const validationStatusLabel = retrievalValidationSummary
    ? t(`workspace.chatView.validationStatuses.${retrievalValidationSummary.status}`)
    : null;

  return (
    <header className="border-b border-slate-200 bg-white/92 px-6 py-5 backdrop-blur dark:border-slate-800 dark:bg-slate-950/92">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-950 dark:text-slate-50">
                {workspaceView === "chat"
                  ? selectedConversationTitle ?? t("workspace.headerBar.groundedChat")
                  : workspaceView === "documents"
                    ? t("workspace.headerBar.documentOperations")
                    : t("workspace.headerBar.workflowOperations")}
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{statusMessage}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge className="border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200" variant="outline">
                <Building2 className="h-3.5 w-3.5" />
                {bootstrap?.tenant.name ?? t("workspace.headerBar.tenant")}
              </Badge>
              <Badge className="border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200" variant="outline">
                <FileText className="h-3.5 w-3.5" />
                {bootstrap?.workspace.name ?? t("workspace.headerBar.workspace")}
              </Badge>
              <Badge className="border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200" variant="outline">
                <BookOpen className="h-3.5 w-3.5" />
                {bootstrap?.knowledgeBase.slug ?? t("workspace.headerBar.knowledgeBase")}
              </Badge>
              {activeAgentContext ? (
                <Badge className="border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200" variant="outline">
                  <Bot className="h-3.5 w-3.5" />
                  {t("workspace.headerBar.agentHandoff", { name: activeAgentContext.name })}
                </Badge>
              ) : null}
              {sourceSurface ? (
                <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200" variant="outline">
                  {t("workspace.headerBar.launchedFrom", { surface: sourceSurfaceLabel })}
                </Badge>
              ) : null}
              {retrievalValidationSummary ? (
                <>
                  <Badge className={getValidationStatusClassName()} variant="outline">
                    <Search className="h-3.5 w-3.5" />
                    {t("workspace.headerBar.validation")}
                  </Badge>
                  <Badge className={getValidationStatusClassName()} variant="outline">
                    {validationStatusLabel}
                    <span className="ml-1 text-[11px] opacity-80">
                      {t("workspace.headerBar.validationHits", {
                        count: String(retrievalValidationSummary.resultCount)
                      })}
                    </span>
                  </Badge>
                </>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-3 xl:items-end">
            {workspaceView === "chat" ? (
              <div className="flex w-full flex-col gap-3 xl:w-[360px]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    className="bg-white pl-9 dark:border-slate-800 dark:bg-slate-900"
                    onChange={(event) => onConversationSearchQueryChange(event.target.value)}
                    placeholder={t("workspace.headerBar.searchConversations")}
                    value={conversationSearchQuery}
                  />
                </div>

                {conversations.length > 0 ? (
                  <Select onValueChange={onSelectConversation} value={selectedConversationId ?? ""}>
                    <SelectTrigger className="bg-white dark:border-slate-800 dark:bg-slate-900">
                      <SelectValue placeholder={t("workspace.headerBar.startConversationPlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {conversations.map((conversation) => (
                        <SelectItem key={conversation.id} value={conversation.id}>
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
                    onClick={() => void onDeleteConversation()}
                    type="button"
                    variant="outline"
                  >
                    <Trash2 className="h-4 w-4" />
                    {isDeletingConversation ? t("workspace.headerBar.deletingConversation") : t("workspace.headerBar.deleteConversation")}
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge className="border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300" variant="outline">
                    {conversationMetrics.total_conversations} {t("workspace.headerBar.conversations")}
                  </Badge>
                  <Badge className="border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300" variant="outline">
                    {conversationMetrics.active_conversations} {t("workspace.headerBar.active")}
                  </Badge>
                  <Badge className="border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300" variant="outline">
                    {conversationMetrics.total_messages} {t("workspace.headerBar.messages")}
                  </Badge>
                </div>

                {isConversationEditing ? (
                  <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900">
                    <Input
                      className="bg-white dark:border-slate-800 dark:bg-slate-950"
                      disabled={isBusy || isUpdatingConversation}
                      maxLength={240}
                      onChange={(event) => onConversationDraftTitleChange(event.target.value)}
                      placeholder={t("workspace.headerBar.conversationTitlePlaceholder")}
                      value={conversationDraftTitle}
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        disabled={isBusy || isUpdatingConversation || conversationDraftTitle.trim().length === 0}
                        onClick={() => void onSubmitConversationTitle()}
                        type="button"
                      >
                        {isUpdatingConversation ? t("workspace.headerBar.savingTitle") : t("workspace.headerBar.saveTitle")}
                      </Button>
                      <Button
                        className="bg-white dark:border-slate-800 dark:bg-slate-950"
                        disabled={isBusy || isUpdatingConversation}
                        onClick={onCancelConversationEditing}
                        type="button"
                        variant="outline"
                      >
                        {t("workspace.headerBar.cancel")}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {activeAgentContext ? (
              <div className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-left xl:w-[360px]">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  {t("workspace.headerBar.runtimePacket")}
                </div>
                <div className="mt-2 text-sm font-semibold text-slate-950">
                  {isCurrentSurfaceRecommended
                    ? t("workspace.headerBar.runtimeAligned")
                    : t("workspace.headerBar.runtimeRedirect", {
                        surface:
                          activeAgentContext.mode === "grounded_chat"
                            ? t("workspace.headerBar.groundedChat")
                            : activeAgentContext.mode === "document_intake"
                              ? t("workspace.headerBar.documentOperations")
                              : t("workspace.headerBar.workflowOperations")
                      })}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge className="border-slate-200 bg-white text-slate-700" variant="outline">
                    {t(`agents.modes.${activeAgentContext.mode}`)}
                  </Badge>
                  <Badge className="border-slate-200 bg-white text-slate-700" variant="outline">
                    {t(`agents.statuses.${activeAgentContext.status}`)}
                  </Badge>
                  <Badge className="border-slate-200 bg-white text-slate-700" variant="outline">
                    {t("workspace.headerBar.connectedCapabilities", {
                      count: String(activeAgentContext.tools.length)
                    })}
                  </Badge>
                </div>
                <div className="mt-3 text-sm leading-6 text-slate-600">
                  <span className="font-medium text-slate-900">{t("workspace.headerBar.objective")}</span>{" "}
                  {activeAgentContext.objective.trim().length > 0
                    ? activeAgentContext.objective
                    : t("workspace.headerBar.objectiveMissing")}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {recommendedSurfaceHref ? (
                    <AgentRunButtonLink
                      className="bg-white"
                      href={recommendedSurfaceHref}
                      runRecord={recommendedSurfaceRunRecord}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      {t("workspace.headerBar.openRecommendedSurface")}
                    </AgentRunButtonLink>
                  ) : null}
                  {agentConsoleHref ? (
                    <Button asChild className="bg-white" size="sm" type="button" variant="outline">
                      <Link href={agentConsoleHref}>{t("workspace.headerBar.openDefinition")}</Link>
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              {sourceSurface && sourceSurfaceHref ? (
                <Button asChild className="bg-white dark:border-slate-800 dark:bg-slate-900" type="button" variant="outline">
                  <Link href={sourceSurfaceHref}>{t("workspace.headerBar.returnTo", { surface: sourceSurfaceLabel })}</Link>
                </Button>
              ) : null}
              <Button className="bg-white dark:border-slate-800 dark:bg-slate-900" onClick={onToggleConsoleControls} type="button" variant="outline">
                <SlidersHorizontal className="h-4 w-4" />
                {showConsoleControls ? t("workspace.headerBar.hideControls") : t("workspace.headerBar.contextControls")}
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

        {errorMessage ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{errorMessage}</div>
        ) : null}
      </div>
    </header>
  );
}
