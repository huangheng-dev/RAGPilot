"use client";

import type { ComponentProps, FormEvent } from "react";
import { Bot, CheckCircle2, FileText, MessageSquareText, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { RecentWorkflowRunsPanel } from "@/components/workspace/RecentWorkflowRunsPanel";
import { WorkspaceAgentContextCard } from "@/components/workspace/WorkspaceAgentContextCard";
import { SelectedDocumentPanel } from "@/components/workspace/SelectedDocumentPanel";
import { SelectedWorkflowRunPanel } from "@/components/workspace/SelectedWorkflowRunPanel";
import { useI18n } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";
import { formatStatusLabel, formatTimestamp, getStatusBadgeClass } from "@/lib/workspace-formatters";
import type {
  BootstrapState,
  Citation,
  Conversation,
  ConversationMetrics,
  DocumentDetail,
  DocumentRecord,
  MessageFeedbackSummary,
  Message,
  RetrievalValidationSummary,
  WorkspaceAgentContext,
  WorkflowRun,
  WorkflowRunDetail
} from "@/components/workspace/workspace-types";

type LinkHref = ComponentProps<typeof import("next/link").default>["href"];

type WorkspaceChatViewProps = {
  activeAgentContext: WorkspaceAgentContext | null;
  bootstrap: BootstrapState | null;
  errorMessage: string | null;
  conversationMetrics: ConversationMetrics;
  currentConversationStats: {
    assistantMessageCount: number;
    firstMessageAt: string | null;
    latestMessageAt: string | null;
    messageCount: number;
    userMessageCount: number;
  };
  documents: DocumentRecord[];
  documentTotalCount: number;
  focusedChunkId: string | null;
  canManageDocuments: boolean;
  canSendChatMessages: boolean;
  canSubmitMessageFeedback: boolean;
  currentUserId: string | null;
  handleSendQuestion: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  agentConsoleHref: LinkHref;
  isGroundedValidationFlow: boolean;
  isBusy: boolean;
  isCurrentSurfaceRecommended: boolean;
  isLoadingMessages: boolean;
  isRetryingWorkflow: boolean;
  isRunningDocumentAction: boolean;
  isSending: boolean;
  messageFeedbackSummary: MessageFeedbackSummary;
  messageFeedbackPendingId: string | null;
  messages: Message[];
  onDeleteDocument: () => void | Promise<void>;
  onInspectCitationDocument: (citation: Citation) => void | Promise<void>;
  onOpenDocumentsView: () => void;
  onOpenCitationDocumentView: (citation: Citation) => void | Promise<void>;
  onOpenFeedbackConversation: (conversationId: string) => void;
  onRefreshWorkspace: () => void | Promise<void>;
  onReindexDocument: () => void | Promise<void>;
  onRestoreDocument: () => void | Promise<void>;
  onOpenWorkflowView: () => void;
  onPrepareValidationQuery: (query: string) => void;
  onRunFeedbackValidationQuery: (query: string, mode: "inspect" | "compare") => void;
  onSubmitMessageFeedback: (messageId: string, signal: "helpful" | "review") => void | Promise<void>;
  onFocusQueuedWorkflowRuns: () => void;
  onFocusRetryWorkflowRuns: () => void;
  onSelectDocumentVersion: (documentVersionId: string) => void | Promise<void>;
  onRetryWorkflowRun: () => void | Promise<void>;
  onSelectDocument: (documentId: string) => void | Promise<void>;
  onSelectWorkflowRun: (workflowRunId: string) => void | Promise<void>;
  onStartNewConversation: () => void | Promise<void>;
  onToggleConsoleControls: () => void;
  question: string;
  retrievalValidationSummary: RetrievalValidationSummary | null;
  selectedConversation: Conversation | null;
  selectedDocumentDetail: DocumentDetail | null;
  selectedDocumentId: string | null;
  selectedWorkflowRunDetail: WorkflowRunDetail | null;
  selectedWorkflowRunId: string | null;
  setQuestion: (value: string) => void;
  validationQueryPrompt: string;
  workflowRuns: WorkflowRun[];
};

export function WorkspaceChatView({
  activeAgentContext,
  bootstrap,
  errorMessage,
  conversationMetrics,
  currentConversationStats,
  documents,
  documentTotalCount,
  focusedChunkId,
  canManageDocuments,
  canSendChatMessages,
  canSubmitMessageFeedback,
  currentUserId,
  handleSendQuestion,
  agentConsoleHref,
  isGroundedValidationFlow,
  isBusy,
  isCurrentSurfaceRecommended,
  isLoadingMessages,
  isRetryingWorkflow,
  isRunningDocumentAction,
  isSending,
  messageFeedbackSummary,
  messageFeedbackPendingId,
  messages,
  onDeleteDocument,
  onInspectCitationDocument,
  onOpenDocumentsView,
  onOpenCitationDocumentView,
  onOpenFeedbackConversation,
  onRefreshWorkspace,
  onReindexDocument,
  onRestoreDocument,
  onOpenWorkflowView,
  onPrepareValidationQuery,
  onRunFeedbackValidationQuery,
  onSubmitMessageFeedback,
  onFocusQueuedWorkflowRuns,
  onFocusRetryWorkflowRuns,
  onSelectDocumentVersion,
  onRetryWorkflowRun,
  onSelectDocument,
  onSelectWorkflowRun,
  onStartNewConversation,
  onToggleConsoleControls,
  question,
  retrievalValidationSummary,
  selectedConversation,
  selectedDocumentDetail,
  selectedDocumentId,
  selectedWorkflowRunDetail,
  selectedWorkflowRunId,
  setQuestion,
  validationQueryPrompt,
  workflowRuns
}: WorkspaceChatViewProps) {
  const { t } = useI18n();
  const hasDocuments = documents.length > 0;

  function readCurrentMessageFeedback(message: Message) {
    if (!currentUserId) {
      return null;
    }

    return message.feedback_entries.find((entry) => entry.submitted_by_user_id === currentUserId) ?? null;
  }
  const hasConversationSelection = selectedConversation !== null;
  const hasMessages = messages.length > 0;
  const activeAgentModeLabel = activeAgentContext ? t(`agents.modes.${activeAgentContext.mode}`) : null;
  const latestAssistantMessage = [...messages].reverse().find((message) => message.role === "assistant") ?? null;
  const latestRuntimeSummary = latestAssistantMessage ? extractRuntimeSummary(latestAssistantMessage) : null;
  const latestRetrievalSummary = latestAssistantMessage ? extractRetrievalSummary(latestAssistantMessage) : null;
  const trimmedValidationQueryPrompt = validationQueryPrompt.trim();
  const showValidationGuide = isGroundedValidationFlow || retrievalValidationSummary !== null;

  function getValidationStatusClassName() {
    switch (retrievalValidationSummary?.status) {
      case "ready":
        return "border-emerald-200 bg-emerald-50 text-emerald-700";
      case "review":
        return "border-blue-200 bg-blue-50 text-blue-700";
      case "hold":
        return "border-amber-200 bg-amber-50 text-amber-800";
      case "empty":
      case "failed":
        return "border-rose-200 bg-rose-50 text-rose-700";
      default:
        return "border-slate-200 bg-slate-50 text-slate-700";
    }
  }

  function getValidationStatusLabel() {
    if (!retrievalValidationSummary) {
      return t("workspace.chatView.validationStatuses.pending");
    }

    return t(`workspace.chatView.validationStatuses.${retrievalValidationSummary.status}`);
  }

  function getValidationDescription() {
    if (retrievalValidationSummary) {
      return retrievalValidationSummary.detail;
    }

    return t("workspace.chatView.validationPendingDescription");
  }

  function formatCitationMethod(method: Citation["retrieval_method"]) {
    if (method === "hybrid") {
      return t("workspace.chatView.hybridMethod");
    }
    if (method === "vector") {
      return t("workspace.chatView.vectorMethod");
    }
    if (method === "lexical") {
      return t("workspace.chatView.lexicalMethod");
    }
    return null;
  }

  function hasNumericScore(value: number | null | undefined): value is number {
    return typeof value === "number" && Number.isFinite(value);
  }

  function formatNumericScore(value: number | null | undefined) {
    return hasNumericScore(value) ? value.toFixed(3) : null;
  }

  function formatProviderLabel(providerType: string | null) {
    if (!providerType) {
      return null;
    }
    return t(`settings.models.providers.${providerType}`);
  }

  function formatRuntimeSourceLabel(source: string | null) {
    if (!source) {
      return null;
    }

    if (source === "settings") {
      return t("workspace.chatView.runtimeSources.settings");
    }

    return t(`workspace.chatView.runtimeSources.${source}`);
  }

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-h-0 overflow-y-auto px-6 py-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-6">
          <div className="grid gap-3 md:grid-cols-4">
            <Card className="border-slate-200 bg-slate-50/50 shadow-sm">
              <CardContent className="p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{t("workspace.chatView.workspaceConversations")}</div>
                <div className="mt-3 text-2xl font-semibold text-slate-950">{conversationMetrics.total_conversations}</div>
                <div className="mt-1 text-sm text-slate-500">{t("workspace.chatView.activeInScope", { count: String(conversationMetrics.active_conversations) })}</div>
              </CardContent>
            </Card>
            <Card className="border-slate-200 bg-slate-50/50 shadow-sm">
              <CardContent className="p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{t("workspace.chatView.workspaceMessages")}</div>
                <div className="mt-3 text-2xl font-semibold text-slate-950">{conversationMetrics.total_messages}</div>
                <div className="mt-1 text-sm text-slate-500">
                  {conversationMetrics.latest_activity_at
                    ? t("workspace.chatView.latestActivity", {
                        timestamp: formatTimestamp(conversationMetrics.latest_activity_at)
                      })
                    : t("workspace.chatView.noPersistedActivity")}
                </div>
              </CardContent>
            </Card>
            <Card className="border-slate-200 bg-slate-50/50 shadow-sm">
              <CardContent className="p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{t("workspace.chatView.currentThread")}</div>
                <div className="mt-3 text-2xl font-semibold text-slate-950">{currentConversationStats.messageCount}</div>
                <div className="mt-1 text-sm text-slate-500">
                  {t("workspace.chatView.userAssistantSplit", {
                    userCount: String(currentConversationStats.userMessageCount),
                    assistantCount: String(currentConversationStats.assistantMessageCount)
                  })}
                </div>
              </CardContent>
            </Card>
            <Card className="border-slate-200 bg-slate-50/50 shadow-sm">
              <CardContent className="p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{t("workspace.chatView.currentActivity")}</div>
                <div className="mt-3 text-base font-semibold text-slate-950">
                  {currentConversationStats.latestMessageAt
                    ? formatTimestamp(currentConversationStats.latestMessageAt)
                    : t("workspace.chatView.noReplies")}
                </div>
                <div className="mt-1 text-sm text-slate-500">
                  {currentConversationStats.firstMessageAt
                    ? t("workspace.chatView.startedAt", {
                        timestamp: formatTimestamp(currentConversationStats.firstMessageAt)
                      })
                    : t("workspace.chatView.startConversationToPersist")}
                </div>
              </CardContent>
            </Card>
          </div>

          {activeAgentContext ? (
            <WorkspaceAgentContextCard
              activeAgentContext={activeAgentContext}
              agentConsoleHref={agentConsoleHref}
              onPrimaryAction={
                activeAgentContext.mode === "workflow_recovery" ? onOpenWorkflowView : onOpenDocumentsView
              }
              onSecondaryAction={
                activeAgentContext.mode === "workflow_recovery" ? onOpenDocumentsView : onOpenWorkflowView
              }
              primaryActionLabel={
                activeAgentContext.mode === "workflow_recovery"
                  ? t("workspace.chatView.openWorkflowSurface")
                  : t("workspace.chatView.openDocumentsSurface")
              }
              secondaryActionLabel={
                activeAgentContext.mode === "workflow_recovery"
                  ? t("workspace.chatView.openDocumentsSurface")
                  : t("workspace.chatView.openWorkflowSurface")
              }
              surface="chat"
              surfaceAligned={isCurrentSurfaceRecommended}
            />
          ) : null}

          <Card className="border-slate-200 bg-slate-50/50 shadow-sm">
            <CardHeader className="gap-3 border-b border-slate-200 pb-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    <MessageSquareText className="h-4 w-4 text-primary" />
                    {t("workspace.chatView.conversationStream")}
                  </div>
                  <div className="text-base font-semibold text-slate-950">
                    {selectedConversation?.title ?? t("workspace.chatView.groundedResponseConsole")}
                  </div>
                </div>
                <Badge className="border-slate-200 bg-white text-slate-700" variant="outline">
                  {isLoadingMessages ? t("workspace.chatView.syncingHistory") : t("workspace.chatView.loadedCount", { count: String(messages.length) })}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 p-4 sm:p-5">
              {errorMessage ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm leading-6 text-rose-700">
                  <div className="font-medium">{t("workspace.chatView.attentionTitle")}</div>
                  <div className="mt-1">{errorMessage}</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button className="bg-white text-rose-700 hover:bg-rose-100" onClick={() => void onRefreshWorkspace()} size="sm" type="button" variant="outline">
                      {t("workspace.chatView.refreshWorkspace")}
                    </Button>
                    <Button className="bg-white text-rose-700 hover:bg-rose-100" onClick={onToggleConsoleControls} size="sm" type="button" variant="outline">
                      {t("workspace.chatView.openContextControls")}
                    </Button>
                  </div>
                </div>
              ) : null}

              {isLoadingMessages && (
                <div className="rounded-lg border border-slate-200 bg-white px-4 py-4 text-sm text-slate-500">
                  {t("workspace.chatView.loadingConversationHistory")}
                </div>
              )}

              {!isLoadingMessages && !hasConversationSelection ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-8 text-sm text-slate-600">
                  <div className="text-base font-semibold text-slate-900">{t("workspace.chatView.noConversationSelected")}</div>
                  <div className="mt-2 leading-7">
                    {t("workspace.chatView.noConversationSelectedDescription")}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button onClick={() => void onStartNewConversation()} size="sm" type="button">
                      {t("workspace.chatView.startConversation")}
                    </Button>
                    <Button className="bg-white" onClick={onOpenDocumentsView} size="sm" type="button" variant="outline">
                      {t("workspace.chatView.openDocumentsSurface")}
                    </Button>
                    <Button className="bg-white" onClick={() => void onRefreshWorkspace()} size="sm" type="button" variant="outline">
                      {t("workspace.chatView.refreshWorkspace")}
                    </Button>
                  </div>
                </div>
              ) : null}

              {!isLoadingMessages && hasConversationSelection && !hasMessages ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-8 text-sm text-slate-600">
                  <div className="text-base font-semibold text-slate-900">{t("workspace.chatView.firstTurnReady")}</div>
                  <div className="mt-2 leading-7">
                    {t("workspace.chatView.firstTurnReadyDescription")}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {!hasDocuments ? (
                      <Button className="bg-white" onClick={onOpenDocumentsView} size="sm" type="button" variant="outline">
                        {t("workspace.chatView.openDocumentsSurface")}
                      </Button>
                    ) : (
                      <Button className="bg-white" onClick={onOpenWorkflowView} size="sm" type="button" variant="outline">
                        {t("workspace.chatView.openWorkflowSurface")}
                      </Button>
                    )}
                  </div>
                  {!hasDocuments ? (
                    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
                      {t("workspace.chatView.noIndexedDocumentsWarning")}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {messages.map((message) => (
                <article
                  key={message.id}
                  className={cn(
                    "max-w-4xl rounded-xl border px-5 py-4 shadow-sm",
                    message.role === "assistant"
                      ? "border-slate-200 bg-white text-slate-900"
                      : "ml-auto border-blue-500 bg-blue-600 text-white"
                  )}
                >
                  <div className="mb-3 flex items-center justify-between gap-4">
                    <span
                      className={cn(
                        "text-xs font-semibold uppercase tracking-[0.16em]",
                        message.role === "assistant" ? "text-primary" : "text-blue-100"
                      )}
                    >
                      {message.role}
                    </span>
                    <span className={cn("text-xs", message.role === "assistant" ? "text-slate-500" : "text-blue-100")}>
                      {formatTimestamp(message.created_at)}
                    </span>
                  </div>
                  <div className="whitespace-pre-wrap text-sm leading-7">{message.content}</div>
                  {message.role === "assistant" ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(() => {
                        const runtimeSummary = extractRuntimeSummary(message);
                        const retrievalSummary = extractRetrievalSummary(message);
                        if (!runtimeSummary?.modelName) {
                          return retrievalSummary?.engineName ? (
                            <Badge className="border-slate-200 bg-slate-50 text-slate-600" variant="outline">
                              {t("workspace.chatView.retrievalEngine", { value: retrievalSummary.engineName })}
                            </Badge>
                          ) : null;
                        }

                        return (
                          <>
                             {retrievalSummary?.engineName ? (
                               <Badge className="border-slate-200 bg-slate-50 text-slate-600" variant="outline">
                                 {t("workspace.chatView.retrievalEngine", { value: retrievalSummary.engineName })}
                               </Badge>
                             ) : null}
                             <Badge className="border-slate-200 bg-slate-50 text-slate-700" variant="outline">
                               {t("workspace.chatView.runtimeModelBadge", { model: runtimeSummary.modelName })}
                              </Badge>
                              {runtimeSummary.providerType ? (
                                <Badge className="border-slate-200 bg-slate-50 text-slate-600" variant="outline">
                                  {formatProviderLabel(runtimeSummary.providerType) ?? runtimeSummary.providerType}
                                </Badge>
                              ) : null}
                              {runtimeSummary.source ? (
                                <Badge className="border-slate-200 bg-slate-50 text-slate-600" variant="outline">
                                  {t("workspace.chatView.runtimeSource", {
                                  source: formatRuntimeSourceLabel(runtimeSummary.source) ?? runtimeSummary.source
                                  })}
                                </Badge>
                              ) : null}
                              {runtimeSummary.modelEndpointName ? (
                                <Badge className="border-slate-200 bg-slate-50 text-slate-600" variant="outline">
                                  {runtimeSummary.modelEndpointName}
                                </Badge>
                              ) : null}
                              {runtimeSummary.fallbackApplied ? (
                                <Badge className="border-amber-200 bg-amber-50 text-amber-800" variant="outline">
                                  {t("workspace.chatView.runtimeFallbackBadge")}
                                </Badge>
                              ) : null}
                              {runtimeSummary.apiBaseUrl ? (
                                <Badge className="border-slate-200 bg-slate-50 text-slate-500" variant="outline">
                                  {runtimeSummary.apiBaseUrl}
                                </Badge>
                              ) : null}
                            </>
                          );
                        })()}
                    </div>
                  ) : null}
                  {message.role === "assistant" ? (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {(() => {
                        const currentFeedback = readCurrentMessageFeedback(message);
                        return currentFeedback ? (
                          <Badge
                            className={cn(
                              "border",
                              currentFeedback.answer_quality === "helpful"
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-amber-200 bg-amber-50 text-amber-700"
                            )}
                            variant="outline"
                          >
                            {currentFeedback.answer_quality === "helpful"
                              ? t("workspace.chatView.feedbackSubmittedHelpful")
                              : t("workspace.chatView.feedbackSubmittedReview")}
                          </Badge>
                        ) : null;
                      })()}
                      {message.feedback_entries.length > 1 ? (
                        <Badge className="border-slate-200 bg-slate-50 text-slate-600" variant="outline">
                          {t("workspace.chatView.feedbackCount", { count: String(message.feedback_entries.length) })}
                        </Badge>
                      ) : null}
                      {canSubmitMessageFeedback ? (
                        <>
                          <Button
                            className="bg-white"
                            disabled={messageFeedbackPendingId === message.id}
                            onClick={() => void onSubmitMessageFeedback(message.id, "helpful")}
                            size="sm"
                            type="button"
                            variant="outline"
                          >
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            {messageFeedbackPendingId === message.id
                              ? t("workspace.chatView.feedbackSubmitting")
                              : t("workspace.chatView.feedbackHelpful")}
                          </Button>
                          <Button
                            className="bg-white"
                            disabled={messageFeedbackPendingId === message.id}
                            onClick={() => void onSubmitMessageFeedback(message.id, "review")}
                            size="sm"
                            type="button"
                            variant="outline"
                          >
                            <ShieldAlert className="mr-2 h-4 w-4" />
                            {messageFeedbackPendingId === message.id
                              ? t("workspace.chatView.feedbackSubmitting")
                              : t("workspace.chatView.feedbackReview")}
                          </Button>
                        </>
                      ) : null}
                    </div>
                  ) : null}
                  {message.role === "assistant" && message.citations.length > 0 && (
                    <div className="mt-4 space-y-3 border-t border-slate-200 pt-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{t("workspace.chatView.citations")}</div>
                        <Badge className="border-slate-200 bg-slate-50 text-slate-600" variant="outline">
                          {t("workspace.chatView.sourcesCount", { count: String(message.citations.length) })}
                        </Badge>
                      </div>
                      <div className="space-y-3">
                        {message.citations.map((citation) => (
                          <div key={citation.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm">
                            <div className="flex items-center justify-between gap-4">
                              <span className="font-medium text-slate-900">{t("workspace.chatView.sourceRank", { rank: String(citation.rank) })}</span>
                              <span className="text-xs text-slate-500">
                                {hasNumericScore(citation.score)
                                  ? t("workspace.chatView.score", { score: formatNumericScore(citation.score) ?? "0.000" })
                                  : t("workspace.chatView.unscored")}
                              </span>
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                              <Badge className="border-slate-200 bg-white text-slate-700" variant="outline">
                                {citation.document_title ?? `Chunk ${citation.document_chunk_id.slice(0, 8)}`}
                              </Badge>
                              {citation.retrieval_method ? (
                                <Badge className="border-slate-200 bg-white text-slate-600" variant="outline">
                                  {t("workspace.chatView.retrievalMethod", {
                                    method: formatCitationMethod(citation.retrieval_method) ?? citation.retrieval_method
                                  })}
                                </Badge>
                              ) : null}
                              {citation.chunk_index !== null ? (
                                <Badge className="border-slate-200 bg-white text-slate-600" variant="outline">
                                  {t("workspace.chatView.chunkIndex", { index: String(citation.chunk_index) })}
                                </Badge>
                              ) : null}
                            </div>
                            {hasNumericScore(citation.vector_score) ||
                            hasNumericScore(citation.lexical_score) ||
                            hasNumericScore(citation.lexical_normalized_score) ? (
                              <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                                {hasNumericScore(citation.vector_score) ? (
                                  <span>{t("workspace.chatView.vectorScore", { score: formatNumericScore(citation.vector_score) ?? "0.000" })}</span>
                                ) : null}
                                {hasNumericScore(citation.lexical_score) ? (
                                  <span>{t("workspace.chatView.lexicalScore", { score: formatNumericScore(citation.lexical_score) ?? "0.000" })}</span>
                                ) : null}
                                {hasNumericScore(citation.lexical_normalized_score) ? (
                                  <span>{t("workspace.chatView.lexicalNormalizedScore", { score: formatNumericScore(citation.lexical_normalized_score) ?? "0.000" })}</span>
                                ) : null}
                              </div>
                            ) : null}
                            {citation.quote ? (
                              <p className="mt-2 whitespace-pre-wrap leading-6 text-slate-700">{citation.quote}</p>
                            ) : (
                              <p className="mt-2 leading-6 text-slate-500">{t("workspace.chatView.citationWithoutQuote")}</p>
                            )}
                            {citation.document_id ? (
                              <div className="mt-3 flex flex-wrap gap-2">
                                <Button
                                  className="bg-white"
                                  onClick={() => void onInspectCitationDocument(citation)}
                                  size="sm"
                                  type="button"
                                  variant="outline"
                                >
                                  {t("workspace.chatView.inspectSource")}
                                </Button>
                                <Button
                                  className="bg-white"
                                  onClick={() => void onOpenCitationDocumentView(citation)}
                                  size="sm"
                                  type="button"
                                  variant="outline"
                                >
                                  {t("workspace.chatView.openDocumentView")}
                                </Button>
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </article>
              ))}
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="gap-2">
              <CardTitle>{t("workspace.chatView.askKnowledgeBase")}</CardTitle>
              <p className="text-sm text-slate-600">
                {t("workspace.chatView.askKnowledgeBaseDescription")}
              </p>
            </CardHeader>
            <CardContent>
              {showValidationGuide ? (
                <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-2">
                      <div className="text-sm font-semibold text-slate-950">{t("workspace.chatView.validationTitle")}</div>
                      <div className="text-sm leading-7 text-slate-600">{getValidationDescription()}</div>
                    </div>
                    <Badge className={cn("border", getValidationStatusClassName())} variant="outline">
                      {getValidationStatusLabel()}
                    </Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                    {retrievalValidationSummary?.mode ? (
                      <Badge className="border-slate-200 bg-white text-slate-700" variant="outline">
                        {t(`workspace.chatView.validationModes.${retrievalValidationSummary.mode}`)}
                      </Badge>
                    ) : null}
                    {retrievalValidationSummary?.queryText ? (
                      <Badge className="border-slate-200 bg-white text-slate-700" variant="outline">
                        {t("workspace.chatView.validationQuery", {
                          value: retrievalValidationSummary.queryText
                        })}
                      </Badge>
                    ) : null}
                    {retrievalValidationSummary ? (
                      <Badge className="border-slate-200 bg-white text-slate-700" variant="outline">
                        {t("workspace.chatView.validationResultCount", {
                          count: String(retrievalValidationSummary.resultCount)
                        })}
                      </Badge>
                    ) : null}
                    {retrievalValidationSummary?.engineName ? (
                      <Badge className="border-slate-200 bg-white text-slate-700" variant="outline">
                        {t("workspace.chatView.validationEngine", {
                          value: retrievalValidationSummary.engineName
                        })}
                      </Badge>
                    ) : null}
                    {retrievalValidationSummary?.candidateEngineName ? (
                      <Badge className="border-slate-200 bg-white text-slate-700" variant="outline">
                        {t("workspace.chatView.validationCandidateEngine", {
                          value: retrievalValidationSummary.candidateEngineName
                        })}
                      </Badge>
                    ) : null}
                    {retrievalValidationSummary?.retrievalProfileName ? (
                      <Badge className="border-slate-200 bg-white text-slate-700" variant="outline">
                        {t("workspace.chatView.validationProfile", {
                          value: retrievalValidationSummary.retrievalProfileName
                        })}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {trimmedValidationQueryPrompt ? (
                      <Button
                        className="bg-white"
                        onClick={() => onPrepareValidationQuery(trimmedValidationQueryPrompt)}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        {t("workspace.chatView.validationUseSuggestedQuery")}
                      </Button>
                    ) : null}
                    {(retrievalValidationSummary?.status === "empty" ||
                      retrievalValidationSummary?.status === "failed" ||
                      retrievalValidationSummary?.status === "hold" ||
                      !retrievalValidationSummary) && (
                      <>
                        <Button className="bg-white" onClick={onOpenDocumentsView} size="sm" type="button" variant="outline">
                          {t("workspace.chatView.openDocumentsSurface")}
                        </Button>
                        <Button className="bg-white" onClick={onOpenWorkflowView} size="sm" type="button" variant="outline">
                          {t("workspace.chatView.openWorkflowSurface")}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ) : null}
              {activeAgentContext ? (
                <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="border-blue-200 bg-white text-blue-700" variant="outline">
                      {t("workspace.chatView.answeringAsAgent", { name: activeAgentContext.name })}
                    </Badge>
                    <Badge className="border-slate-200 bg-white text-slate-700" variant="outline">
                      {activeAgentModeLabel ?? activeAgentContext.mode}
                    </Badge>
                    {activeAgentContext.knowledge_base_scope ? (
                      <Badge className="border-slate-200 bg-white text-slate-700" variant="outline">
                        {t("workspace.chatView.agentScope", { scope: activeAgentContext.knowledge_base_scope })}
                      </Badge>
                    ) : null}
                  </div>
                  {activeAgentContext.objective.trim() ? (
                    <div className="mt-3 text-sm leading-7 text-slate-600">
                      <span className="font-medium text-slate-900">{t("workspace.chatView.agentObjective")}</span>{" "}
                      {activeAgentContext.objective}
                    </div>
                  ) : (
                    <div className="mt-3 text-sm leading-7 text-slate-500">
                      {t("workspace.chatView.agentObjectiveMissing")}
                    </div>
                  )}
                </div>
              ) : null}
              <form className="flex flex-col gap-4" onSubmit={handleSendQuestion}>
                <Textarea
                  id="question"
                  className="min-h-32 rounded-xl bg-slate-50 px-4 py-3 leading-7 focus-visible:bg-white"
                  disabled={isBusy || isSending || !hasConversationSelection || !canSendChatMessages}
                  onChange={(event) => setQuestion(event.target.value)}
                  placeholder={
                    !hasConversationSelection
                      ? t("workspace.chatView.startOrSelectConversation")
                      : !hasDocuments
                        ? t("workspace.chatView.uploadContentBeforeAsk")
                        : t("workspace.chatView.askGroundedQuestion")
                  }
                  value={question}
                />
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1 text-sm text-slate-500">
                    <div>
                      {t("workspace.chatView.scopeLimitedTo", {
                        scope: bootstrap?.knowledgeBase.slug ?? t("workspace.chatView.defaultScope")
                      })}{" "}
                    </div>
                    {latestRuntimeSummary?.modelName ? (
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        {latestRetrievalSummary?.engineName ? (
                          <Badge className="border-slate-200 bg-white text-slate-600" variant="outline">
                            {t("workspace.chatView.retrievalEngine", { value: latestRetrievalSummary.engineName })}
                          </Badge>
                        ) : null}
                        <Badge className="border-slate-200 bg-white text-slate-700" variant="outline">
                          {t("workspace.chatView.runtimeModelBadge", { model: latestRuntimeSummary.modelName })}
                        </Badge>
                        {latestRuntimeSummary.providerType ? (
                          <Badge className="border-slate-200 bg-white text-slate-600" variant="outline">
                            {formatProviderLabel(latestRuntimeSummary.providerType) ?? latestRuntimeSummary.providerType}
                          </Badge>
                        ) : null}
                        {latestRuntimeSummary.source ? (
                          <Badge className="border-slate-200 bg-white text-slate-600" variant="outline">
                            {t("workspace.chatView.runtimeSource", {
                              source: formatRuntimeSourceLabel(latestRuntimeSummary.source) ?? latestRuntimeSummary.source
                            })}
                          </Badge>
                        ) : null}
                        {latestRuntimeSummary.modelEndpointName ? (
                          <Badge className="border-slate-200 bg-white text-slate-600" variant="outline">
                            {latestRuntimeSummary.modelEndpointName}
                          </Badge>
                        ) : null}
                        {latestRuntimeSummary.fallbackApplied ? (
                          <Badge className="border-amber-200 bg-amber-50 text-amber-800" variant="outline">
                            {t("workspace.chatView.runtimeFallbackBadge")}
                          </Badge>
                        ) : null}
                      </div>
                    ) : latestRetrievalSummary?.engineName ? (
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <Badge className="border-slate-200 bg-white text-slate-600" variant="outline">
                          {t("workspace.chatView.retrievalEngine", { value: latestRetrievalSummary.engineName })}
                        </Badge>
                      </div>
                    ) : null}
                  </div>
                  <Button disabled={isBusy || isSending || !hasConversationSelection || !canSendChatMessages || !hasDocuments || question.trim().length === 0} size="lg" type="submit">
                    {isSending ? t("workspace.chatView.generating") : t("workspace.chatView.sendQuestion")}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>

      <aside className="border-t border-slate-200 bg-white xl:border-l xl:border-t-0">
        <div className="space-y-5 px-6 py-6">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  {t("workspace.chatView.answerReviewQueue")}
                </div>
                <Badge className="border-slate-200 bg-slate-50 text-slate-600" variant="outline">
                  {messageFeedbackSummary.retrieval_tuning_candidates}
                </Badge>
              </div>
              <CardTitle className="text-base">{t("workspace.chatView.answerReviewTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    {t("workspace.chatView.feedbackHelpfulMetric")}
                  </div>
                  <div className="mt-2 text-xl font-semibold text-slate-950">
                    {messageFeedbackSummary.helpful_feedback}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    {t("workspace.chatView.feedbackReviewMetric")}
                  </div>
                  <div className="mt-2 text-xl font-semibold text-slate-950">
                    {messageFeedbackSummary.not_helpful_feedback}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    {t("workspace.chatView.feedbackCitationMetric")}
                  </div>
                  <div className="mt-2 text-xl font-semibold text-slate-950">
                    {messageFeedbackSummary.citation_issue_feedback}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    {t("workspace.chatView.feedbackTotalMetric")}
                  </div>
                  <div className="mt-2 text-xl font-semibold text-slate-950">
                    {messageFeedbackSummary.total_feedback}
                  </div>
                </div>
              </div>

              {messageFeedbackSummary.recent_feedback.length > 0 ? (
                <div className="space-y-3">
                  {messageFeedbackSummary.recent_feedback.map((feedbackItem) => (
                    <button
                      key={feedbackItem.id}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-left transition hover:bg-white"
                      onClick={() => onOpenFeedbackConversation(feedbackItem.conversation_id)}
                      type="button"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <Badge
                          className={cn(
                            "border",
                            feedbackItem.answer_quality === "not_helpful" || feedbackItem.citation_quality !== "grounded"
                              ? "border-amber-200 bg-amber-50 text-amber-700"
                              : "border-emerald-200 bg-emerald-50 text-emerald-700"
                          )}
                          variant="outline"
                        >
                          {feedbackItem.answer_quality === "not_helpful"
                            ? t("workspace.chatView.feedbackSubmittedReview")
                            : t("workspace.chatView.feedbackSubmittedHelpful")}
                        </Badge>
                        <span className="text-xs text-slate-500">{formatTimestamp(feedbackItem.updated_at)}</span>
                      </div>
                      <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-700">
                        {feedbackItem.assistant_excerpt || t("workspace.chatView.feedbackNoExcerpt")}
                      </p>
                      {feedbackItem.latest_user_question ? (
                        <div className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-3">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                            {t("workspace.chatView.feedbackSourceQuestion")}
                          </div>
                          <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-700">
                            {feedbackItem.latest_user_question}
                          </p>
                        </div>
                      ) : null}
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <div className="flex flex-wrap gap-2">
                          <Badge className="border-slate-200 bg-white text-slate-600" variant="outline">
                            {feedbackItem.conversation_title}
                          </Badge>
                          <Badge className="border-slate-200 bg-white text-slate-600" variant="outline">
                            {t("workspace.chatView.feedbackAnswerQuality", {
                              value: t(`workspace.chatView.feedbackAnswerQualities.${feedbackItem.answer_quality}`)
                            })}
                          </Badge>
                          <Badge className="border-slate-200 bg-white text-slate-600" variant="outline">
                            {t("workspace.chatView.feedbackCitationQuality", {
                              value: t(`workspace.chatView.feedbackCitationQualities.${feedbackItem.citation_quality}`)
                            })}
                          </Badge>
                        </div>
                        <span className="text-xs font-medium text-slate-700">
                          {t("workspace.chatView.openFeedbackThread")}
                        </span>
                      </div>
                      {feedbackItem.latest_user_question ? (
                        <div className="mt-3">
                          <div className="grid gap-2 sm:grid-cols-2">
                            <Button
                              className="w-full bg-white"
                              onClick={(event) => {
                                event.stopPropagation();
                                onPrepareValidationQuery(feedbackItem.latest_user_question ?? "");
                              }}
                              size="sm"
                              type="button"
                              variant="outline"
                            >
                              {t("workspace.chatView.feedbackUseValidationQuery")}
                            </Button>
                            <Button
                              className="w-full bg-white"
                              onClick={(event) => {
                                event.stopPropagation();
                                onRunFeedbackValidationQuery(feedbackItem.latest_user_question ?? "", "compare");
                              }}
                              size="sm"
                              type="button"
                              variant="outline"
                            >
                              {t("workspace.chatView.feedbackRunComparison")}
                            </Button>
                          </div>
                        </div>
                      ) : null}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-sm text-slate-500">
                  {t("workspace.chatView.feedbackQueueEmpty")}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  <FileText className="h-4 w-4 text-primary" />
                  {t("workspace.chatView.documentSignals")}
                </div>
                <Badge className="border-slate-200 bg-slate-50 text-slate-600" variant="outline">
                  {documentTotalCount}
                </Badge>
              </div>
              <CardTitle className="text-base">{t("workspace.chatView.indexedDocuments")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {documents.slice(0, 5).map((document) => (
                <button
                  key={document.id}
                  className={cn(
                    "w-full rounded-lg border px-3 py-3 text-left transition",
                    document.id === selectedDocumentId
                      ? "border-slate-950 bg-slate-950 text-white"
                      : "border-slate-200 bg-slate-50 text-slate-900 hover:bg-white"
                  )}
                  onClick={() => void onSelectDocument(document.id)}
                  type="button"
                >
                  <div className="truncate text-sm font-medium">{document.title}</div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <span
                      className={cn(
                        "rounded-full border px-2 py-1",
                        document.id === selectedDocumentId
                          ? "border-slate-700 bg-slate-900 text-slate-100"
                          : getStatusBadgeClass(document.ingestion_status)
                      )}
                    >
                      {t("workspace.chatView.ingestionStatus", { status: formatStatusLabel(document.ingestion_status) })}
                    </span>
                    <span
                      className={cn(
                        "rounded-full border px-2 py-1",
                        document.id === selectedDocumentId
                          ? "border-slate-700 bg-slate-900 text-slate-100"
                          : getStatusBadgeClass(document.indexing_status)
                      )}
                    >
                      {t("workspace.chatView.indexingStatus", { status: formatStatusLabel(document.indexing_status) })}
                    </span>
                  </div>
                  <div className={cn("mt-2 text-xs", document.id === selectedDocumentId ? "text-slate-300" : "text-slate-500")}>
                    {formatTimestamp(document.updated_at)}
                  </div>
                </button>
              ))}
              {documents.length === 0 && (
                <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-sm text-slate-500">
                  {t("workspace.chatView.noIndexedDocuments")}
                </div>
              )}
            </CardContent>
          </Card>

          <SelectedDocumentPanel
            chunkPreviewClassName="line-clamp-5"
            detail={selectedDocumentDetail}
            emptyState={t("workspace.chatView.selectDocumentToInspect")}
            focusedChunkId={focusedChunkId}
            canManageDocuments={canManageDocuments}
            isRunningDocumentAction={isRunningDocumentAction}
            onDeleteDocument={onDeleteDocument}
            onOpenWorkflowView={onOpenWorkflowView}
            onInspectWorkflowRun={onSelectWorkflowRun}
            onReindexDocument={onReindexDocument}
            onRestoreDocument={onRestoreDocument}
            onSelectVersion={onSelectDocumentVersion}
            relatedWorkflowRuns={
              selectedDocumentId
                ? workflowRuns
                    .filter((workflowRun) => workflowRun.subject_id === selectedDocumentId)
                    .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
                : []
            }
            selectedDocumentVersionId={selectedDocumentDetail?.document_version_id ?? null}
          />

          <SelectedWorkflowRunPanel
            detail={selectedWorkflowRunDetail}
            emptyState={t("workspace.chatView.selectWorkflowToInspect")}
            emptyStepsMessage={t("workspace.chatView.workflowStepsAppear")}
            isRetryingWorkflow={isRetryingWorkflow}
            onOpenDocumentsView={onOpenDocumentsView}
            onOpenWorkflowView={onOpenWorkflowView}
            onSelectDocument={onSelectDocument}
            onRetryWorkflowRun={onRetryWorkflowRun}
            showWorkflowInput
          />

          <RecentWorkflowRunsPanel
            emptyState={t("workspace.chatView.noWorkflowRuns")}
            limit={5}
            selectedWorkflowRunId={selectedWorkflowRunId}
            showErrorMessage
            showIdentifier
            title={t("workspace.chatView.workflowRuns")}
            workflowRuns={workflowRuns}
            onSelectWorkflowRun={onSelectWorkflowRun}
          />

        </div>
      </aside>
    </div>
  );
}

function extractRuntimeSummary(message: Message): {
  modelName: string | null;
  providerType: string | null;
  source: string | null;
  modelEndpointName: string | null;
  apiBaseUrl: string | null;
  fallbackApplied: boolean;
  fallbackReason: string | null;
} | null {
  const runtimeBinding =
    message.usage_json && typeof message.usage_json === "object" && !Array.isArray(message.usage_json)
      ? message.usage_json.runtime_binding
      : null;

  if (!runtimeBinding || typeof runtimeBinding !== "object" || Array.isArray(runtimeBinding)) {
    return message.model_name
      ? {
          modelName: message.model_name,
          providerType: null,
          source: null,
          modelEndpointName: null,
          apiBaseUrl: null,
          fallbackApplied: false,
          fallbackReason: null,
        }
      : null;
  }

  const runtimeBindingRecord = runtimeBinding as Record<string, unknown>;
  const modelName =
    typeof runtimeBindingRecord["model_name"] === "string" && runtimeBindingRecord["model_name"].trim().length > 0
      ? runtimeBindingRecord["model_name"]
      : message.model_name;
  const providerType =
    typeof runtimeBindingRecord["provider_type"] === "string" &&
    runtimeBindingRecord["provider_type"].trim().length > 0
      ? runtimeBindingRecord["provider_type"]
      : null;
  const source =
    typeof runtimeBindingRecord["source"] === "string" && runtimeBindingRecord["source"].trim().length > 0
      ? runtimeBindingRecord["source"]
      : null;
  const modelEndpointName =
    typeof runtimeBindingRecord["model_endpoint_name"] === "string" &&
    runtimeBindingRecord["model_endpoint_name"].trim().length > 0
      ? runtimeBindingRecord["model_endpoint_name"]
      : null;
  const apiBaseUrl =
    typeof runtimeBindingRecord["api_base_url"] === "string" &&
    runtimeBindingRecord["api_base_url"].trim().length > 0
      ? runtimeBindingRecord["api_base_url"]
      : null;
  const fallbackApplied =
    typeof runtimeBindingRecord["fallback_applied"] === "boolean" ? runtimeBindingRecord["fallback_applied"] : false;
  const fallbackReason =
    typeof runtimeBindingRecord["fallback_reason"] === "string" &&
    runtimeBindingRecord["fallback_reason"].trim().length > 0
      ? runtimeBindingRecord["fallback_reason"].trim()
      : null;

  return {
    modelName,
    providerType,
    source,
    modelEndpointName,
    apiBaseUrl,
    fallbackApplied,
    fallbackReason,
  };
}

function extractRetrievalSummary(message: Message): {
  engineName: string | null;
} | null {
  const usagePayload =
    message.usage_json && typeof message.usage_json === "object" && !Array.isArray(message.usage_json)
      ? (message.usage_json as Record<string, unknown>)
      : null;

  if (!usagePayload) {
    return null;
  }

  const engineName =
    typeof usagePayload["retrieval_engine"] === "string" && usagePayload["retrieval_engine"].trim().length > 0
      ? usagePayload["retrieval_engine"]
      : null;

  if (!engineName) {
    return null;
  }

  return {
    engineName,
  };
}
