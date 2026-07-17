"use client";

import { type ComponentProps, type FormEvent, type ReactNode, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Copy, Info, LoaderCircle, MessageSquareText, Send, ShieldAlert } from "lucide-react";
import { ConsoleEmptyState } from "@/components/console/ConsolePrimitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DialogFormActions, FormDialog } from "@/components/ui/form-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { WorkspaceRetrievalFollowUpCard } from "@/components/workspace/WorkspaceRetrievalFollowUpCard";
import { useI18n } from "@/lib/i18n/provider";
import type { RetrievalFollowUpActionDescriptor } from "@/lib/workspace-retrieval-follow-up";
import type {
  RetrievalEvaluationRecord,
  RetrievalEvaluationSummary,
} from "@/lib/retrieval-inspector";
import { useRuntimeHealth } from "@/lib/runtime-health";
import { formatRuntimeFallbackReason } from "@/lib/runtime-fallback";
import {
  resolveWorkflowSurfaceGuidance,
  selectPreferredWorkflowRun,
} from "@/lib/workspace-workflow-follow-up";
import { cn } from "@/lib/utils";
import {
  formatStatusLabel,
  formatTimestamp,
  formatWorkflowTypeLabel,
  getStatusBadgeClass,
} from "@/lib/workspace-formatters";
import type {
  BootstrapState,
  Citation,
  Conversation,
  ConversationMetrics,
  DocumentDetail,
  DocumentRecord,
  MessageFeedbackSummaryItem,
  MessageFeedbackSummary,
  Message,
  RetrievalValidationSummary,
  WorkspaceAgentContext,
  WorkflowRun,
  WorkflowRunDetail,
} from "@/components/workspace/workspace-types";

type LinkHref = ComponentProps<typeof Link>["href"];

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
  focusedChunkId: string | null;
  canManageDocuments: boolean;
  canManageWorkflowRuns: boolean;
  canSendChatMessages: boolean;
  canSubmitMessageFeedback: boolean;
  candidateFollowUpActionsByQuery: Record<
    string,
    RetrievalFollowUpActionDescriptor[]
  >;
  currentUserId: string | null;
  feedbackFollowUpActionsByItemId: Record<
    string,
    RetrievalFollowUpActionDescriptor[]
  >;
  recentEvaluationFollowUpActionsById: Record<
    string,
    RetrievalFollowUpActionDescriptor[]
  >;
  knowledgeBaseId: string | null;
  handleSendQuestion: (
    event: FormEvent<HTMLFormElement>,
  ) => void | Promise<void>;
  agentConsoleHref: LinkHref;
  isGroundedValidationFlow: boolean;
  isBusy: boolean;
  isCurrentSurfaceRecommended: boolean;
  isCancellingWorkflow: boolean;
  isSavingWorkflowNotes: boolean;
  isLoadingMessages: boolean;
  isRetryingWorkflow: boolean;
  isRunningDocumentAction: boolean;
  isSending: boolean;
  activeRetrievalEvaluationId: string | null;
  activeRetrievalFollowUpQuery: string | null;
  messageFeedbackPendingId: string | null;
  messageFeedbackSummary: MessageFeedbackSummary | null;
  messages: Message[];
  onDeleteDocument: () => void | Promise<void>;
  onPermanentlyDeleteDocument: (confirmationTitle: string) => void | Promise<void>;
  onOpenFeedbackConversation: (conversationId: string) => void;
  onInspectCitationDocument: (citation: Citation) => void | Promise<void>;
  onOpenDocumentsView: () => void;
  onOpenCitationDocumentView: (citation: Citation) => void | Promise<void>;
  onRefreshWorkspace: () => void | Promise<void>;
  onReindexDocument: () => void | Promise<void>;
  onRestoreDocument: () => void | Promise<void>;
  onSaveWorkflowOperatorNotes: (
    operatorNotes: string | null,
  ) => void | Promise<void>;
  onOpenWorkflowView: () => void;
  onCancelWorkflowRun: () => void | Promise<void>;
  onPrepareValidationQuery: (query: string) => void;
  onSetRetrievalEvaluationFollowUpStatus: (
    evaluation: RetrievalEvaluationRecord,
    nextStatus: "pending" | "resolved",
  ) => void | Promise<void>;
  onSetRetrievalQueryFollowUpStatus: (
    query: string,
    nextStatus: "pending" | "resolved",
  ) => void | Promise<void>;
  onSubmitMessageFeedback: (
    messageId: string,
    signal: "helpful" | "review",
  ) => void | Promise<void>;
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
  selectedDocumentWorkflowRuns: WorkflowRun[];
  selectedDocumentId: string | null;
  selectedWorkflowRunDetail: WorkflowRunDetail | null;
  selectedWorkflowRunId: string | null;
  setQuestion: (value: string) => void;
  tenantId: string | null;
  retrievalEvaluationSummary: RetrievalEvaluationSummary | null;
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
  focusedChunkId,
  canManageDocuments,
  canManageWorkflowRuns,
  canSendChatMessages,
  canSubmitMessageFeedback,
  candidateFollowUpActionsByQuery,
  currentUserId,
  feedbackFollowUpActionsByItemId,
  recentEvaluationFollowUpActionsById,
  knowledgeBaseId,
  handleSendQuestion,
  agentConsoleHref,
  isGroundedValidationFlow,
  isBusy,
  isCurrentSurfaceRecommended,
  isCancellingWorkflow,
  isSavingWorkflowNotes,
  isLoadingMessages,
  isRetryingWorkflow,
  isRunningDocumentAction,
  isSending,
  activeRetrievalEvaluationId,
  activeRetrievalFollowUpQuery,
  messageFeedbackPendingId,
  messageFeedbackSummary,
  messages,
  onDeleteDocument,
  onPermanentlyDeleteDocument,
  onOpenFeedbackConversation,
  onInspectCitationDocument,
  onOpenDocumentsView,
  onOpenCitationDocumentView,
  onRefreshWorkspace,
  onReindexDocument,
  onRestoreDocument,
  onSaveWorkflowOperatorNotes,
  onOpenWorkflowView,
  onCancelWorkflowRun,
  onPrepareValidationQuery,
  onSetRetrievalEvaluationFollowUpStatus,
  onSetRetrievalQueryFollowUpStatus,
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
  selectedDocumentWorkflowRuns,
  selectedDocumentId,
  selectedWorkflowRunDetail,
  selectedWorkflowRunId,
  setQuestion,
  tenantId,
  retrievalEvaluationSummary,
  validationQueryPrompt,
  workflowRuns,
}: WorkspaceChatViewProps) {
  const { t } = useI18n();
  const [detailMessage, setDetailMessage] = useState<Message | null>(null);
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const messageEndRef = useRef<HTMLDivElement | null>(null);
  const welcomeInputRef = useRef<HTMLTextAreaElement | null>(null);
  const latestMessageContent = messages.at(-1)?.content ?? "";

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({
      behavior: isSending ? "auto" : "smooth",
      block: "end",
    });
  }, [isLoadingMessages, isSending, latestMessageContent, messages.length, selectedConversation?.id]);

  async function copyAnswer(message: Message) {
    await navigator.clipboard.writeText(message.content);
    setCopiedMessageId(message.id);
    window.setTimeout(() => setCopiedMessageId((current) => current === message.id ? null : current), 1600);
  }
  const { runtimeHealth } = useRuntimeHealth({
    enabled: Boolean(tenantId && knowledgeBaseId),
  });
  const hasDocuments = documents.length > 0;

  function readCurrentMessageFeedback(message: Message) {
    if (!currentUserId) {
      return null;
    }

    return (
      message.feedback_entries.find(
        (entry) => entry.submitted_by_user_id === currentUserId,
      ) ?? null
    );
  }
  function isStreamingAssistantMessage(message: Message) {
    return message.role === "assistant" && message.id.startsWith("streaming-");
  }
  function formatMessageRole(message: Message) {
    return message.role === "assistant"
      ? t("workspace.chatView.messageRoles.assistant")
      : t("workspace.chatView.messageRoles.user");
  }
  const hasConversationSelection = selectedConversation !== null;
  const hasMessages = messages.length > 0;
  const hasStreamingAssistantMessage = messages.some(isStreamingAssistantMessage);
  const hasActiveConversationView =
    hasConversationSelection || hasMessages || isSending;
  useEffect(() => {
    if (!hasActiveConversationView && !isBusy && !isSending && canSendChatMessages) {
      welcomeInputRef.current?.focus();
    }
  }, [canSendChatMessages, hasActiveConversationView, isBusy, isSending]);
  const activeAgentModeLabel = activeAgentContext
    ? t(`agents.modes.${activeAgentContext.mode}`)
    : null;
  const latestAssistantMessage =
    [...messages].reverse().find((message) => message.role === "assistant") ??
    null;
  const latestRuntimeSummary = latestAssistantMessage
    ? extractRuntimeSummary(latestAssistantMessage)
    : null;
  const latestRetrievalSummary = latestAssistantMessage
    ? extractRetrievalSummary(latestAssistantMessage)
    : null;
  const latestRuntimeFallbackMessage = formatRuntimeFallbackReason(
    latestRuntimeSummary?.fallbackReason ?? null,
    t,
  );
  const trimmedValidationQueryPrompt = validationQueryPrompt.trim();
  const showValidationGuide =
    isGroundedValidationFlow || retrievalValidationSummary !== null;
  const currentRuntimeSummary = runtimeHealth
    ? {
        modelName:
          runtimeHealth.effective_chat_model_name ||
          runtimeHealth.chat_model_name ||
          null,
        providerType:
          runtimeHealth.effective_chat_model_provider ||
          runtimeHealth.chat_model_provider ||
          null,
        source: runtimeHealth.effective_chat_model_source || null,
        modelEndpointName:
          runtimeHealth.effective_chat_model_endpoint_name || null,
        apiBaseUrl: runtimeHealth.effective_chat_model_api_base_url || null,
        fallbackApplied: false,
        fallbackReason: null,
      }
    : latestRuntimeSummary;
  const currentRetrievalEngineName =
    runtimeHealth?.retrieval_engine ??
    latestRetrievalSummary?.engineName ??
    null;
  const currentRetrievalProfileName =
    bootstrap?.knowledgeBase.retrieval_profile_name ?? null;
  const feedbackItems = messageFeedbackSummary?.recent_feedback ?? [];
  const retrievalCandidates = retrievalEvaluationSummary?.candidates ?? [];
  const recentEvaluations =
    retrievalEvaluationSummary?.recent_evaluations ?? [];
  const pendingFeedbackItems = feedbackItems.filter(
    (item) => readFeedbackFollowUpStatus(item) === "pending",
  );
  const pendingRetrievalCandidates = retrievalCandidates.filter(
    (candidate) => candidate.follow_up_status === "pending",
  );
  const primaryRetrievalQuery =
    retrievalEvaluationSummary?.primary_query_text?.trim() ?? "";
  const primaryRetrievalRecentEvaluation =
    primaryRetrievalQuery.length > 0
      ? (recentEvaluations.find(
          (evaluation) =>
            evaluation.query_text.trim() === primaryRetrievalQuery,
        ) ?? null)
      : null;
  const primaryRetrievalFollowUpActions =
    (primaryRetrievalQuery.length > 0
      ? candidateFollowUpActionsByQuery[primaryRetrievalQuery]
      : null) ??
    (primaryRetrievalRecentEvaluation
      ? recentEvaluationFollowUpActionsById[primaryRetrievalRecentEvaluation.id]
      : null) ??
    [];
  const resolvedFeedbackCount =
    feedbackItems.length - pendingFeedbackItems.length;
  const selectedDocumentReady =
    selectedDocumentDetail !== null &&
    selectedDocumentDetail.document.ingestion_status === "completed" &&
    selectedDocumentDetail.document.indexing_status === "completed" &&
    !selectedDocumentDetail.document.is_deleted;
  const selectedDocumentFocusWorkflowRun = (() => {
    if (
      selectedWorkflowRunDetail?.subject_type === "document" &&
      selectedWorkflowRunDetail.subject_id === selectedDocumentId
    ) {
      return selectedWorkflowRunDetail;
    }

    const candidateWorkflowRuns = selectedDocumentWorkflowRuns.filter(
      (workflowRun) => workflowRun.subject_id === selectedDocumentId,
    );

    return selectPreferredWorkflowRun(candidateWorkflowRuns);
  })();
  const hasValidatedChatReadiness =
    retrievalValidationSummary?.status === "ready";

  const selectedChatContextState = (() => {
    if (selectedWorkflowRunDetail) {
      const workflowGuidance = resolveWorkflowSurfaceGuidance(
        selectedWorkflowRunDetail,
      );
      const workflowStage = workflowGuidance.stage;

      if (workflowStage === "recovery" || workflowStage === "cancelled") {
        return {
          tone: "attention" as const,
          title: t("workspace.workflowsView.recoveryStateTitle"),
          description:
            selectedWorkflowRunDetail.follow_up_reason ??
            t("workspace.workflowsView.recoveryStateDescription"),
          showDocuments: workflowGuidance.showDocuments,
          showWorkflows: workflowGuidance.showWorkflows,
        };
      }

      if (workflowStage === "monitoring") {
        return {
          tone: "review" as const,
          title: t("workspace.workflowsView.monitoringStateTitle"),
          description:
            selectedWorkflowRunDetail.follow_up_reason ??
            t("workspace.workflowsView.monitoringStateDescription"),
          showDocuments: workflowGuidance.showDocuments,
          showWorkflows: workflowGuidance.showWorkflows,
        };
      }

      if (workflowStage === "ready") {
        return {
          tone: "healthy" as const,
          title: t("workspace.chatView.flowStateReadyTitle"),
          description:
            selectedWorkflowRunDetail.follow_up_reason ??
            t("workspace.chatView.flowStateReadyDescription"),
          showDocuments: false,
          showWorkflows: false,
        };
      }
    }

    if (selectedDocumentDetail) {
      const isSelectedDocumentDeleted = Boolean(
        selectedDocumentDetail.document.is_deleted,
      );
      const isSelectedDocumentFailed =
        selectedDocumentDetail.document.ingestion_status === "failed" ||
        selectedDocumentDetail.document.indexing_status === "failed";
      const workflowGuidance = resolveWorkflowSurfaceGuidance(
        selectedDocumentFocusWorkflowRun,
      );
      const workflowStage = workflowGuidance.stage;

      if (isSelectedDocumentDeleted || isSelectedDocumentFailed) {
        return {
          tone: "attention" as const,
          title: t("workspace.documentsView.recoveryStateTitle"),
          description:
            selectedDocumentFocusWorkflowRun?.follow_up_reason ??
            t("workspace.documentsView.recoveryStateDescription"),
          showDocuments: true,
          showWorkflows: true,
        };
      }

      if (workflowStage === "recovery" || workflowStage === "cancelled") {
        return {
          tone: "attention" as const,
          title: t("workspace.documentsView.recoveryStateTitle"),
          description:
            selectedDocumentFocusWorkflowRun?.follow_up_reason ??
            t("workspace.documentsView.recoveryStateDescription"),
          showDocuments: workflowGuidance.showDocuments,
          showWorkflows: workflowGuidance.showWorkflows,
        };
      }

      if (workflowStage === "monitoring") {
        return {
          tone: "review" as const,
          title: t("workspace.documentsView.monitoringStateTitle"),
          description:
            selectedDocumentFocusWorkflowRun?.follow_up_reason ??
            t("workspace.documentsView.monitoringStateDescription"),
          showDocuments: workflowGuidance.showDocuments,
          showWorkflows: workflowGuidance.showWorkflows,
        };
      }

      if (workflowStage === "ready") {
        return {
          tone: "healthy" as const,
          title: hasValidatedChatReadiness
            ? t("workspace.chatView.flowStateValidatedTitle")
            : t("workspace.chatView.flowStateReadyTitle"),
          description: hasValidatedChatReadiness
            ? t("workspace.chatView.flowStateValidatedDescription")
            : (selectedDocumentFocusWorkflowRun?.follow_up_reason ??
              t("workspace.chatView.flowStateReadyDescription")),
          showDocuments: false,
          showWorkflows: false,
        };
      }

      if (!selectedDocumentReady) {
        return {
          tone: "review" as const,
          title: t("workspace.documentsView.monitoringStateTitle"),
          description:
            selectedDocumentFocusWorkflowRun?.follow_up_reason ??
            t("workspace.documentsView.monitoringStateDescription"),
          showDocuments: true,
          showWorkflows: true,
        };
      }

      return {
        tone: "healthy" as const,
        title: hasValidatedChatReadiness
          ? t("workspace.chatView.flowStateValidatedTitle")
          : t("workspace.chatView.flowStateReadyTitle"),
        description: hasValidatedChatReadiness
          ? t("workspace.chatView.flowStateValidatedDescription")
          : t("workspace.chatView.flowStateReadyDescription"),
        showDocuments: false,
        showWorkflows: false,
      };
    }

    return null;
  })();

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

    return t(
      `workspace.chatView.validationStatuses.${retrievalValidationSummary.status}`,
    );
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

  function readFeedbackFollowUpStatus(item: MessageFeedbackSummaryItem) {
    return item.follow_up_status;
  }

  function getFollowUpBadgeClassName(status: "pending" | "resolved") {
    return status === "resolved"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : "border-amber-200 bg-amber-50 text-amber-800";
  }

  function formatEvaluationModeLabel(
    mode: RetrievalEvaluationRecord["evaluation_mode"],
  ) {
    return t(`workspace.chatView.evaluationModes.${mode}`);
  }

  function getRetrievalIntelligenceStatusClassName(
    status: "stable" | "review" | "hold",
  ) {
    switch (status) {
      case "stable":
        return "border-emerald-200 bg-emerald-50 text-emerald-700";
      case "review":
        return "border-blue-200 bg-blue-50 text-blue-700";
      case "hold":
        return "border-amber-200 bg-amber-50 text-amber-800";
      default:
        return "border-slate-200 bg-slate-50 text-slate-700";
    }
  }

  return (
    <div className="console-split-content flex min-w-0 flex-1 flex-col">
      {!hasActiveConversationView ? (
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-3 py-10 sm:px-5">
          <div className="w-full max-w-2xl text-center">
            <div className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
              {t("workspace.chatView.welcomeTitle")}
            </div>
            <div className="mt-3 text-sm leading-6 text-slate-500">
              {t("workspace.chatView.welcomeDescription")}
            </div>
            <form className="mt-7" onSubmit={handleSendQuestion}>
              <div className="relative text-left">
                <Textarea
                  autoFocus
                  ref={welcomeInputRef}
                  className="max-h-40 min-h-[88px] w-full resize-none rounded-xl bg-slate-50 px-4 pb-9 pr-14 pt-3 text-base leading-6 shadow-sm focus-visible:bg-white"
                  disabled={isBusy || isSending || !canSendChatMessages}
                  onChange={(event) => setQuestion(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                      event.preventDefault();
                      if (!event.currentTarget.disabled && question.trim().length > 0 && hasDocuments) {
                        event.currentTarget.form?.requestSubmit();
                      }
                    }
                  }}
                  placeholder={hasDocuments ? t("workspace.chatView.welcomePlaceholder") : t("workspace.chatView.uploadContentBeforeAsk")}
                  value={question}
                />
                <div className="pointer-events-none absolute bottom-3 left-4 flex max-w-[calc(100%-4.5rem)] items-center gap-1.5 truncate text-[11px] leading-none text-slate-400">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                  <span className="truncate">{t("workspace.chatView.scopeLimitedTo", {
                    scope: bootstrap?.knowledgeBase.slug ?? bootstrap?.knowledgeBase.name ?? t("workspace.chatView.defaultScope"),
                  })}</span>
                </div>
                <Button
                  aria-label={isSending ? t("workspace.chatView.generating") : t("workspace.chatView.sendQuestion")}
                  className="absolute bottom-2 right-2 h-9 w-9 rounded-lg p-0"
                  disabled={isBusy || isSending || !canSendChatMessages || !hasDocuments || question.trim().length === 0}
                  size="icon"
                  type="submit"
                >
                  {isSending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
      <div className={cn("console-split-content-padding min-h-0 flex-1 overflow-y-auto", !hasActiveConversationView && "hidden")}>
        <div className="flex w-full flex-col gap-3">
          <Card className="border-slate-200 bg-slate-50/50 shadow-sm">
            <CardHeader className="gap-3 border-b border-slate-200 pb-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    <MessageSquareText className="h-4 w-4 text-primary" />
                    {t("workspace.chatView.conversationStream")}
                  </div>
                  <div className="text-base font-semibold text-slate-950">
                    {selectedConversation?.title ??
                      t("workspace.chatView.groundedResponseConsole")}
                  </div>
                </div>
                <Button onClick={() => setIsDiagnosticsOpen(true)} size="sm" type="button" variant="outline">
                  <Info className="h-4 w-4" />
                  {t("workspace.chatView.openDiagnostics")}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 p-4 sm:p-5">
              {isLoadingMessages && (
                <div className="rounded-lg border border-slate-200 bg-white px-4 py-4 text-sm text-slate-500">
                  {t("workspace.chatView.loadingConversationHistory")}
                </div>
              )}

              {!isLoadingMessages && !hasActiveConversationView ? (
                <ConsoleEmptyState icon={<MessageSquareText className="h-9 w-9 stroke-[1.5]" />}>
                  <div className="text-base font-semibold text-slate-900">
                    {t("workspace.chatView.noConversationSelected")}
                  </div>
                  <div className="mt-2 leading-7">
                    {t("workspace.chatView.streamPlaceholderNoConversation")}
                  </div>
                </ConsoleEmptyState>
              ) : null}

              {!isLoadingMessages &&
              hasActiveConversationView &&
              !hasMessages ? (
                <ConsoleEmptyState icon={<MessageSquareText className="h-9 w-9 stroke-[1.5]" />}>
                  <div className="text-base font-semibold text-slate-900">
                    {t("workspace.chatView.firstTurnReady")}
                  </div>
                  <div className="mt-2 leading-7">
                    {t("workspace.chatView.streamPlaceholderFirstTurn")}
                  </div>
                  {!hasDocuments ? (
                    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
                      {t("workspace.chatView.noIndexedDocumentsWarning")}
                    </div>
                  ) : null}
                </ConsoleEmptyState>
              ) : null}

              {messages.map((message) => (
                <article
                  key={message.id}
                  data-message-role={message.role}
                  data-streaming={isStreamingAssistantMessage(message) ? "true" : "false"}
                  className={cn(
                    "rounded-xl border px-5 py-4 shadow-sm",
                    message.role === "assistant"
                      ? "w-full max-w-4xl self-start border-slate-200 bg-white text-slate-900"
                      : "ml-auto w-fit min-w-56 max-w-[88%] self-end border-blue-500 bg-blue-600 text-white sm:max-w-2xl",
                  )}
                >
                  <div className="mb-3 flex items-center justify-between gap-4">
                    <span
                      className={cn(
                        "text-xs font-semibold tracking-[0.12em]",
                        message.role === "assistant"
                          ? "text-primary"
                          : "text-blue-100",
                      )}
                    >
                      {formatMessageRole(message)}
                    </span>
                    {!isStreamingAssistantMessage(message) || message.content.trim().length > 0 ? (
                      <span
                        className={cn(
                          "text-xs",
                          message.role === "assistant"
                            ? "text-slate-500"
                            : "text-blue-100",
                        )}
                      >
                        {formatTimestamp(message.created_at)}
                      </span>
                    ) : null}
                  </div>
                  {message.content.trim().length > 0 ? (
                    <div className="whitespace-pre-wrap text-sm leading-7">
                      {message.content}
                    </div>
                  ) : null}
                  {isStreamingAssistantMessage(message) ? (
                    <div
                      aria-live="polite"
                      className={cn(
                        "flex items-center gap-2 text-sm font-medium text-slate-500",
                        message.content.trim().length > 0 && "mt-3",
                      )}
                      role="status"
                    >
                      <LoaderCircle className="h-4 w-4 animate-spin text-primary" />
                      {t("workspace.chatView.generating")}
                    </div>
                  ) : null}
                  {message.role === "assistant" &&
                  !isStreamingAssistantMessage(message) &&
                  message.content.trim().length > 0 ? (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Button
                        className="bg-white"
                        onClick={() => setDetailMessage(message)}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        <Info className="h-4 w-4" />
                        {t("workspace.chatView.answerDetails")}
                      </Button>
                      <Button
                        className="bg-white"
                        onClick={() => void copyAnswer(message)}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        <Copy className="h-4 w-4" />
                        {copiedMessageId === message.id
                          ? t("workspace.chatView.answerCopied")
                          : t("workspace.chatView.copyAnswer")}
                      </Button>
                      {canSubmitMessageFeedback ? (
                        <>
                          <Button
                            className={cn(
                              "bg-white",
                              readCurrentMessageFeedback(message)?.answer_quality === "helpful" &&
                                "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800",
                            )}
                            disabled={messageFeedbackPendingId === message.id}
                            onClick={() =>
                              void onSubmitMessageFeedback(
                                message.id,
                                "helpful",
                              )
                            }
                            size="sm"
                            type="button"
                            variant="outline"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            {messageFeedbackPendingId === message.id
                              ? t("workspace.chatView.feedbackSubmitting")
                              : readCurrentMessageFeedback(message)?.answer_quality === "helpful"
                                ? t("workspace.chatView.feedbackSubmittedHelpful")
                                : t("workspace.chatView.feedbackHelpful")}
                          </Button>
                          <Button
                            className={cn(
                              "bg-white",
                              readCurrentMessageFeedback(message) !== null &&
                                readCurrentMessageFeedback(message)?.answer_quality !== "helpful" &&
                                "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:text-amber-800",
                            )}
                            disabled={messageFeedbackPendingId === message.id}
                            onClick={() =>
                              void onSubmitMessageFeedback(message.id, "review")
                            }
                            size="sm"
                            type="button"
                            variant="outline"
                          >
                            <ShieldAlert className="h-4 w-4" />
                            {messageFeedbackPendingId === message.id
                              ? t("workspace.chatView.feedbackSubmitting")
                              : readCurrentMessageFeedback(message) !== null &&
                                  readCurrentMessageFeedback(message)?.answer_quality !== "helpful"
                                ? t("workspace.chatView.feedbackSubmittedReview")
                                : t("workspace.chatView.feedbackReview")}
                          </Button>
                        </>
                      ) : null}
                      {message.feedback_entries.length > 1 ? (
                        <Badge
                          className="ml-auto border-slate-200 bg-slate-50 text-slate-600"
                          variant="outline"
                        >
                          {t("workspace.chatView.feedbackCount", {
                            count: String(message.feedback_entries.length),
                          })}
                        </Badge>
                      ) : null}
                    </div>
                  ) : null}
                  {message.role === "assistant" &&
                    !isStreamingAssistantMessage(message) &&
                    message.citations.length > 0 && (
                      <div className="mt-4 space-y-2.5 border-t border-slate-200 pt-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                            {t("workspace.chatView.citations")}
                          </div>
                          <Badge
                            className="border-slate-200 bg-slate-50 text-slate-600"
                            variant="outline"
                          >
                            {t("workspace.chatView.sourcesCount", {
                              count: String(message.citations.length),
                            })}
                          </Badge>
                        </div>
                        <div className="space-y-2">
                          {message.citations.map((citation) => (
                            <div
                              key={citation.id}
                              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <div className="truncate font-medium text-slate-900">
                                    {citation.document_title ??
                                      t("workspace.chatView.sourceRank", {
                                        rank: String(citation.rank),
                                      })}
                                    {citation.source_location_label ? ` · ${citation.source_location_label}` : ""}
                                  </div>
                                  {citation.quote ? (
                                    <p className="mt-1 truncate text-xs leading-5 text-slate-600">
                                      {citation.quote}
                                    </p>
                                  ) : (
                                    <p className="mt-1 text-xs leading-5 text-slate-500">
                                      {t("workspace.chatView.citationWithoutQuote")}
                                    </p>
                                  )}
                                </div>
                                {citation.document_id ? (
                                  <Button
                                    className="h-8 shrink-0 bg-white px-3"
                                    onClick={() =>
                                      void onInspectCitationDocument(citation)
                                    }
                                    size="sm"
                                    type="button"
                                    variant="outline"
                                  >
                                    {t("workspace.chatView.inspectSource")}
                                  </Button>
                                ) : null}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                </article>
              ))}
              {isSending && !hasStreamingAssistantMessage ? (
                <article
                  className="w-full max-w-4xl self-start rounded-xl border border-slate-200 bg-white px-5 py-4 text-slate-600 shadow-sm"
                  data-message-role="assistant"
                  data-streaming="true"
                >
                  <div className="mb-3 text-xs font-semibold tracking-[0.12em] text-primary">
                    {t("workspace.chatView.messageRoles.assistant")}
                  </div>
                  <div aria-live="polite" className="flex items-center gap-2 text-sm font-medium" role="status">
                    <LoaderCircle className="h-4 w-4 animate-spin text-primary" />
                    {t("workspace.chatView.generating")}
                  </div>
                </article>
              ) : null}
              <div aria-hidden="true" ref={messageEndRef} />
            </CardContent>
          </Card>

          <Card className="hidden border-slate-200 shadow-sm">
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
                      <div className="text-sm font-semibold text-slate-950">
                        {t("workspace.chatView.validationTitle")}
                      </div>
                      <div className="text-sm leading-7 text-slate-600">
                        {getValidationDescription()}
                      </div>
                    </div>
                    <Badge
                      className={cn("border", getValidationStatusClassName())}
                      variant="outline"
                    >
                      {getValidationStatusLabel()}
                    </Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                    {retrievalValidationSummary?.mode ? (
                      <Badge
                        className="border-slate-200 bg-white text-slate-700"
                        variant="outline"
                      >
                        {t(
                          `workspace.chatView.validationModes.${retrievalValidationSummary.mode}`,
                        )}
                      </Badge>
                    ) : null}
                    {retrievalValidationSummary?.queryText ? (
                      <Badge
                        className="border-slate-200 bg-white text-slate-700"
                        variant="outline"
                      >
                        {t("workspace.chatView.validationQuery", {
                          value: retrievalValidationSummary.queryText,
                        })}
                      </Badge>
                    ) : null}
                    {retrievalValidationSummary ? (
                      <Badge
                        className="border-slate-200 bg-white text-slate-700"
                        variant="outline"
                      >
                        {t("workspace.chatView.validationResultCount", {
                          count: String(retrievalValidationSummary.resultCount),
                        })}
                      </Badge>
                    ) : null}
                    {retrievalValidationSummary?.engineName ? (
                      <Badge
                        className="border-slate-200 bg-white text-slate-700"
                        variant="outline"
                      >
                        {t("workspace.chatView.validationEngine", {
                          value: retrievalValidationSummary.engineName,
                        })}
                      </Badge>
                    ) : null}
                    {retrievalValidationSummary?.candidateEngineName ? (
                      <Badge
                        className="border-slate-200 bg-white text-slate-700"
                        variant="outline"
                      >
                        {t("workspace.chatView.validationCandidateEngine", {
                          value: retrievalValidationSummary.candidateEngineName,
                        })}
                      </Badge>
                    ) : null}
                    {retrievalValidationSummary?.retrievalProfileName ? (
                      <Badge
                        className="border-slate-200 bg-white text-slate-700"
                        variant="outline"
                      >
                        {t("workspace.chatView.validationProfile", {
                          value:
                            retrievalValidationSummary.retrievalProfileName,
                        })}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {trimmedValidationQueryPrompt ? (
                      <Button
                        className="bg-white"
                        onClick={() =>
                          onPrepareValidationQuery(trimmedValidationQueryPrompt)
                        }
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
                        <Button
                          className="bg-white"
                          onClick={onOpenDocumentsView}
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          {t("workspace.chatView.openDocumentsSurface")}
                        </Button>
                        <Button
                          className="bg-white"
                          onClick={onOpenWorkflowView}
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          {t("workspace.chatView.openWorkflowSurface")}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ) : null}
              {retrievalEvaluationSummary ? (
                <div className="mb-4">
                  <WorkspaceRetrievalFollowUpCard
                    actions={primaryRetrievalFollowUpActions.slice(0, 2)}
                    badges={[
                      {
                        label: t(
                          `workspace.chatView.retrievalIntelligenceStatuses.${retrievalEvaluationSummary.intelligence_status}`,
                        ),
                        tone: "status",
                        className: getRetrievalIntelligenceStatusClassName(
                          retrievalEvaluationSummary.intelligence_status,
                        ),
                      },
                    ]}
                    body={
                      <>
                        <p className="text-sm leading-6 text-slate-700">
                          {retrievalEvaluationSummary.intelligence_reason}
                        </p>
                        <div className="mt-3 grid gap-3 sm:grid-cols-3">
                          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                              {t(
                                "workspace.chatView.retrievalIntelligenceEvaluations",
                              )}
                            </div>
                            <div className="mt-2 text-2xl font-semibold text-slate-950">
                              {retrievalEvaluationSummary.total_evaluations}
                            </div>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                              {t(
                                "workspace.chatView.retrievalIntelligenceQueries",
                              )}
                            </div>
                            <div className="mt-2 text-2xl font-semibold text-slate-950">
                              {retrievalEvaluationSummary.total_queries}
                            </div>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                              {t(
                                "workspace.chatView.retrievalIntelligencePending",
                              )}
                            </div>
                            <div className="mt-2 text-2xl font-semibold text-slate-950">
                              {
                                retrievalEvaluationSummary.follow_up_breakdown
                                  .pending
                              }
                            </div>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {retrievalEvaluationSummary.primary_query_text ? (
                            <Badge
                              className="border-slate-200 bg-slate-50 text-slate-700"
                              variant="outline"
                            >
                              {t(
                                "workspace.chatView.retrievalIntelligencePrimaryQuery",
                                {
                                  value:
                                    retrievalEvaluationSummary.primary_query_text,
                                },
                              )}
                            </Badge>
                          ) : null}
                          {retrievalEvaluationSummary.primary_baseline_engine_name ? (
                            <Badge
                              className="border-slate-200 bg-slate-50 text-slate-700"
                              variant="outline"
                            >
                              {t("workspace.chatView.validationEngine", {
                                value:
                                  retrievalEvaluationSummary.primary_baseline_engine_name,
                              })}
                            </Badge>
                          ) : null}
                          {retrievalEvaluationSummary.primary_candidate_engine_name ? (
                            <Badge
                              className="border-slate-200 bg-slate-50 text-slate-700"
                              variant="outline"
                            >
                              {t(
                                "workspace.chatView.validationCandidateEngine",
                                {
                                  value:
                                    retrievalEvaluationSummary.primary_candidate_engine_name,
                                },
                              )}
                            </Badge>
                          ) : null}
                          {retrievalEvaluationSummary.primary_retrieval_profile_name ? (
                            <Badge
                              className="border-slate-200 bg-slate-50 text-slate-700"
                              variant="outline"
                            >
                              {t("workspace.chatView.validationProfile", {
                                value:
                                  retrievalEvaluationSummary.primary_retrieval_profile_name,
                              })}
                            </Badge>
                          ) : null}
                        </div>
                      </>
                    }
                    meta={
                      primaryRetrievalRecentEvaluation
                        ? formatTimestamp(
                            primaryRetrievalRecentEvaluation.updated_at,
                          )
                        : null
                    }
                    pendingLabel={t("workspace.chatView.feedbackSubmitting")}
                    title={t("workspace.chatView.retrievalIntelligenceTitle")}
                  />
                </div>
              ) : null}
              {activeAgentContext ? (
                <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      className="border-blue-200 bg-white text-blue-700"
                      variant="outline"
                    >
                      {t("workspace.chatView.answeringAsAgent", {
                        name: activeAgentContext.name,
                      })}
                    </Badge>
                    <Badge
                      className="border-slate-200 bg-white text-slate-700"
                      variant="outline"
                    >
                      {activeAgentModeLabel ?? activeAgentContext.mode}
                    </Badge>
                    {activeAgentContext.knowledge_base_scope ? (
                      <Badge
                        className="border-slate-200 bg-white text-slate-700"
                        variant="outline"
                      >
                        {t("workspace.chatView.agentScope", {
                          scope: activeAgentContext.knowledge_base_scope,
                        })}
                      </Badge>
                    ) : null}
                  </div>
                  {activeAgentContext.objective.trim() ? (
                    <div className="mt-3 text-sm leading-7 text-slate-600">
                      <span className="font-medium text-slate-900">
                        {t("workspace.chatView.agentObjective")}
                      </span>{" "}
                      {activeAgentContext.objective}
                    </div>
                  ) : (
                    <div className="mt-3 text-sm leading-7 text-slate-500">
                      {t("workspace.chatView.agentObjectiveMissing")}
                    </div>
                  )}
                </div>
              ) : null}
              {selectedChatContextState ? (
                <div
                  className={cn(
                    "mb-4 rounded-xl border px-4 py-4",
                    selectedChatContextState.tone === "attention" &&
                      "border-amber-200 bg-amber-50 text-amber-900",
                    selectedChatContextState.tone === "review" &&
                      "border-sky-200 bg-sky-50/70 text-slate-800",
                    selectedChatContextState.tone === "healthy" &&
                      "border-emerald-200 bg-emerald-50/70 text-slate-800",
                  )}
                >
                  <div className="text-sm font-semibold">
                    {selectedChatContextState.title}
                  </div>
                  <div className="mt-2 text-sm leading-7">
                    {selectedChatContextState.description}
                  </div>
                  {selectedChatContextState.showDocuments ||
                  selectedChatContextState.showWorkflows ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {selectedChatContextState.showDocuments ? (
                        <Button
                          className="bg-white"
                          onClick={onOpenDocumentsView}
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          {t("workspace.chatView.openDocumentsSurface")}
                        </Button>
                      ) : null}
                      {selectedChatContextState.showWorkflows ? (
                        <Button
                          className="bg-white"
                          onClick={onOpenWorkflowView}
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          {t("workspace.chatView.openWorkflowSurface")}
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>

      <form
        className={cn("shrink-0 border-t border-slate-200 bg-white/95 px-3 py-2 backdrop-blur sm:px-5 dark:border-slate-800 dark:bg-slate-950/95", !hasActiveConversationView && "hidden")}
                onSubmit={handleSendQuestion}
              >
        <div className="w-full">
          <div className="relative">
                <Textarea
                  id="question"
                  className="max-h-28 min-h-[60px] w-full resize-none rounded-xl bg-slate-50 px-3 pb-8 pr-12 pt-2.5 leading-5 focus-visible:bg-white"
                  disabled={
                    isBusy ||
                    isSending ||
                    !hasActiveConversationView ||
                    !canSendChatMessages
                  }
                  onChange={(event) => setQuestion(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                      event.preventDefault();
                      if (!event.currentTarget.disabled && question.trim().length > 0 && hasDocuments) {
                        event.currentTarget.form?.requestSubmit();
                      }
                    }
                  }}
                  placeholder={
                    !hasActiveConversationView
                      ? t("workspace.chatView.startOrSelectConversation")
                      : !hasDocuments
                        ? t("workspace.chatView.uploadContentBeforeAsk")
                        : t("workspace.chatView.askGroundedQuestion")
                  }
                  value={question}
                />
                  <div className="pointer-events-none absolute bottom-2.5 left-3 flex max-w-[calc(100%-4rem)] items-center gap-1.5 truncate text-[11px] leading-none text-slate-400 dark:text-slate-500">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                    <span className="truncate">{t("workspace.chatView.scopeLimitedTo", {
                      scope:
                        bootstrap?.knowledgeBase.slug ??
                        bootstrap?.knowledgeBase.name ??
                        t("workspace.chatView.defaultScope"),
                    })}</span>
                  </div>
                  <Button
                    aria-label={
                      isSending
                        ? t("workspace.chatView.generating")
                        : t("workspace.chatView.sendQuestion")
                    }
                    className="absolute bottom-1.5 right-1.5 h-8 w-8 rounded-lg p-0"
                    disabled={
                      isBusy ||
                      isSending ||
                      !hasActiveConversationView ||
                      !canSendChatMessages ||
                      !hasDocuments ||
                      question.trim().length === 0
                    }
                    size="icon"
                    type="submit"
                    title={
                      isSending
                        ? t("workspace.chatView.generating")
                        : t("workspace.chatView.sendQuestion")
                    }
                  >
                    {isSending ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
          </div>
        </div>
      </form>

      {detailMessage ? (
        <FormDialog
          eyebrow={t("workspace.chatView.answerDetails")}
          footer={<DialogFormActions><Button className="rounded-xl" onClick={() => setDetailMessage(null)} type="button" variant="outline">{t("workspace.headerBar.cancel")}</Button></DialogFormActions>}
          onClose={() => setDetailMessage(null)}
          open
          presentation="side"
          size="xl"
          title={formatTimestamp(detailMessage.created_at)}
          titleClassName="text-base"
        >
            <div className="space-y-5">
              {(() => {
                const runtime = extractRuntimeSummary(detailMessage);
                const retrieval = extractRetrievalSummary(detailMessage);
                const details = [
                  [t("workspace.chatView.detailRetrievalEngine"), retrieval?.engineName],
                  [t("workspace.chatView.detailModel"), runtime?.modelName],
                  [t("workspace.chatView.detailProvider"), runtime?.providerType ? formatProviderLabel(runtime.providerType) ?? runtime.providerType : null],
                  [t("workspace.chatView.detailEndpoint"), runtime?.modelEndpointName],
                  [t("workspace.chatView.detailRuntimeSource"), runtime?.source ? formatRuntimeSourceLabel(runtime.source) ?? runtime.source : null],
                  [t("workspace.chatView.detailApiBase"), runtime?.apiBaseUrl],
                ].filter((item): item is [string, string] => Boolean(item[1]));

                return details.length > 0 ? (
                  <AgentAlignedDrawerSection title={t("workspace.chatView.runtimeDetails")}>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {details.map(([label, value]) => (
                      <DrawerMetric key={label} label={label} value={value} />
                    ))}
                    {runtime?.fallbackApplied ? (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-800">
                        {t("workspace.chatView.runtimeFallbackBadge")}
                      </div>
                    ) : null}
                  </div>
                  </AgentAlignedDrawerSection>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-700">
                    {t("workspace.chatView.noRuntimeDetails")}
                  </div>
                );
              })()}
              <AgentAlignedDrawerSection badge={<Badge className="border-blue-200 bg-blue-50 text-blue-700" variant="outline">{t("workspace.chatView.citationCount", { count: String(detailMessage.citations.length) })}</Badge>} title={t("workspace.chatView.citations")}>
                <div className="space-y-2">
                  {detailMessage.citations.length > 0 ? detailMessage.citations.map((citation) => (
                    <button
                      className="w-full rounded-xl border border-slate-200 p-4 text-left transition hover:border-blue-300 hover:bg-blue-50/50 dark:border-slate-800 dark:hover:border-blue-800 dark:hover:bg-blue-950/20"
                      key={citation.id}
                      onClick={() => void onInspectCitationDocument(citation)}
                      type="button"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{citation.document_title ?? `Chunk ${citation.document_chunk_id.slice(0, 8)}`}{citation.source_location_label ? ` · ${citation.source_location_label}` : ""}</span>
                        <span className="shrink-0 text-xs text-slate-500">{hasNumericScore(citation.score) ? formatNumericScore(citation.score) : t("workspace.chatView.unscored")}</span>
                      </div>
                      {citation.quote ? <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{citation.quote}</p> : null}
                    </button>
                  )) : (
                    <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-700">
                      {t("workspace.chatView.noCitations")}
                    </div>
                  )}
                </div>
              </AgentAlignedDrawerSection>
            </div>
        </FormDialog>
      ) : null}

      {isDiagnosticsOpen ? <FormDialog
        eyebrow={t("workspace.chatView.diagnosticsTitle")}
        footer={<DialogFormActions><Button className="rounded-xl" onClick={() => setIsDiagnosticsOpen(false)} type="button" variant="outline">{t("workspace.headerBar.cancel")}</Button></DialogFormActions>}
        onClose={() => setIsDiagnosticsOpen(false)}
        open
        presentation="side"
        size="xl"
        title={t("workspace.chatView.answerReviewTitle")}
        titleClassName="text-base"
      >
        <div className="space-y-5">
          {retrievalEvaluationSummary ? (
            <AgentAlignedDrawerSection
              badge={<Badge className={cn("shrink-0 border", getRetrievalIntelligenceStatusClassName(retrievalEvaluationSummary.intelligence_status))} variant="outline">{t(`workspace.chatView.retrievalIntelligenceStatuses.${retrievalEvaluationSummary.intelligence_status}`)}</Badge>}
              description={retrievalEvaluationSummary.intelligence_reason}
              title={t("workspace.chatView.retrievalIntelligenceTitle")}
            >
              <div className="grid grid-cols-3 gap-3">
                {[
                  {
                    label: t("workspace.chatView.retrievalIntelligenceEvaluations"),
                    value: retrievalEvaluationSummary.total_evaluations,
                  },
                  {
                    label: t("workspace.chatView.retrievalIntelligenceQueries"),
                    value: retrievalEvaluationSummary.total_queries,
                  },
                  {
                    label: t("workspace.chatView.retrievalIntelligencePending"),
                    value: retrievalEvaluationSummary.follow_up_breakdown.pending,
                  },
                ].map((metric) => (
                  <DrawerMetric key={metric.label} label={metric.label} value={metric.value} />
                ))}
              </div>
            </AgentAlignedDrawerSection>
          ) : null}

          {(selectedDocumentDetail || selectedWorkflowRunDetail) ? <AgentAlignedDrawerSection title={t("workspace.chatView.reviewContext")}>
            <div className="grid gap-3 sm:grid-cols-2">
              {selectedDocumentDetail ? <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3"><div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{t("workspace.selectedDocument.selectedDocument")}</div><div className="mt-2 truncate text-sm font-semibold text-slate-950">{selectedDocumentDetail.document.title}</div><Button className="mt-3 bg-white" onClick={onOpenDocumentsView} size="sm" type="button" variant="outline">{t("workspace.selectedDocument.openDocumentRegistry")}</Button></div> : null}
              {selectedWorkflowRunDetail ? <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3"><div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{t("workspace.selectedDocument.latestWorkflow")}</div><div className="mt-2 text-sm font-semibold text-slate-950">{formatWorkflowTypeLabel(selectedWorkflowRunDetail.workflow_type)}</div><Button className="mt-3 bg-white" onClick={onOpenWorkflowView} size="sm" type="button" variant="outline">{t("workspace.selectedDocument.openWorkflowSupervision")}</Button></div> : null}
            </div>
          </AgentAlignedDrawerSection> : null}

          <AgentAlignedDrawerSection title={t("workspace.chatView.answerReviewTitle")}>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <DrawerMetric label={t("workspace.chatView.feedbackPendingMetric")} value={pendingFeedbackItems.length} />
                <DrawerMetric label={t("workspace.chatView.feedbackResolvedMetric")} value={resolvedFeedbackCount} />
              </div>

              {pendingFeedbackItems.length === 0 ? (
                <ConsoleEmptyState>
                  {t("workspace.chatView.feedbackQueueEmpty")}
                </ConsoleEmptyState>
              ) : (
                <div className="space-y-3">
                  {pendingFeedbackItems.map((item) => {
                    const followUpActions =
                      feedbackFollowUpActionsByItemId[item.id] ?? [];
                    const followUpStatus = readFeedbackFollowUpStatus(item);
                    const normalizedQuery =
                      item.latest_user_question?.trim() ?? "";
                    const isUpdatingFollowUp =
                      normalizedQuery.length > 0 &&
                      activeRetrievalFollowUpQuery === normalizedQuery;

                    return (
                      <WorkspaceRetrievalFollowUpCard
                        key={item.id}
                        actions={followUpActions}
                        badges={[
                          {
                            label:
                              followUpStatus === "resolved"
                                ? t("workspace.chatView.followUpResolved")
                                : t("workspace.chatView.followUpPending"),
                            tone: "status",
                            className:
                              getFollowUpBadgeClassName(followUpStatus),
                          },
                          {
                            label:
                              item.retrieval_profile_name ??
                              t("workspace.chatView.defaultScope"),
                          },
                        ]}
                        body={
                          <>
                            <p className="text-sm leading-6 text-slate-700">
                              {item.assistant_excerpt?.trim() ||
                                t("workspace.chatView.feedbackNoExcerpt")}
                            </p>
                            {item.latest_user_question ? (
                              <div className="mt-3 text-xs leading-6 text-slate-500">
                                <span className="font-medium text-slate-700">
                                  {t(
                                    "workspace.chatView.feedbackSourceQuestion",
                                  )}
                                </span>{" "}
                                {item.latest_user_question}
                              </div>
                            ) : null}
                            <div className="mt-3 flex flex-wrap gap-2">
                              <Badge
                                className="border-slate-200 bg-slate-50 text-slate-700"
                                variant="outline"
                              >
                                {t("workspace.chatView.feedbackAnswerQuality", {
                                  value: t(
                                    `workspace.chatView.feedbackAnswerQualities.${item.answer_quality}`,
                                  ),
                                })}
                              </Badge>
                              <Badge
                                className="border-slate-200 bg-slate-50 text-slate-700"
                                variant="outline"
                              >
                                {t(
                                  "workspace.chatView.feedbackCitationQuality",
                                  {
                                    value: t(
                                      `workspace.chatView.feedbackCitationQualities.${item.citation_quality}`,
                                    ),
                                  },
                                )}
                              </Badge>
                            </div>
                          </>
                        }
                        isResolving={isUpdatingFollowUp}
                        meta={formatTimestamp(item.updated_at)}
                        onOpenThread={() =>
                          onOpenFeedbackConversation(item.conversation_id)
                        }
                        onResolve={
                          normalizedQuery
                            ? () =>
                                void onSetRetrievalQueryFollowUpStatus(
                                  normalizedQuery,
                                  followUpStatus === "resolved"
                                    ? "pending"
                                    : "resolved",
                                )
                            : undefined
                        }
                        openThreadLabel={t(
                          "workspace.chatView.openFeedbackThread",
                        )}
                        pendingLabel={t(
                          "workspace.chatView.feedbackSubmitting",
                        )}
                        resolveLabel={
                          followUpStatus === "resolved"
                            ? t("workspace.chatView.reopenFollowUp")
                            : t("workspace.chatView.resolveFollowUp")
                        }
                        title={item.conversation_title}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </AgentAlignedDrawerSection>

          <AgentAlignedDrawerSection title={t("workspace.chatView.tuningCandidatesTitle")}>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <DrawerMetric label={t("workspace.chatView.candidatePendingMetric")} value={retrievalEvaluationSummary?.follow_up_breakdown.pending ?? 0} />
                <DrawerMetric label={t("workspace.chatView.candidateResolvedMetric")} value={retrievalEvaluationSummary?.follow_up_breakdown.resolved ?? 0} />
              </div>

              {pendingRetrievalCandidates.length === 0 ? (
                <ConsoleEmptyState>
                  {t("workspace.chatView.tuningCandidatesEmpty")}
                </ConsoleEmptyState>
              ) : (
                <div className="space-y-3">
                  {pendingRetrievalCandidates.slice(0, 3).map((candidate) => {
                    const isUpdating =
                      activeRetrievalFollowUpQuery ===
                      candidate.query_text.trim();
                    const followUpActions =
                      candidateFollowUpActionsByQuery[
                        candidate.query_text.trim()
                      ] ?? [];

                    return (
                      <WorkspaceRetrievalFollowUpCard
                        key={candidate.query_text}
                        actions={followUpActions}
                        badges={[
                          {
                            label:
                              candidate.follow_up_status === "resolved"
                                ? t("workspace.chatView.followUpResolved")
                                : t("workspace.chatView.followUpPending"),
                            tone: "status",
                            className: getFollowUpBadgeClassName(
                              candidate.follow_up_status,
                            ),
                          },
                        ]}
                        body={
                          <>
                            <div className="flex flex-wrap gap-2">
                              <Badge
                                className="border-slate-200 bg-slate-50 text-slate-700"
                                variant="outline"
                              >
                                {t("workspace.chatView.feedbackCount", {
                                  count: String(candidate.evaluation_count),
                                })}
                              </Badge>
                              <Badge
                                className="border-slate-200 bg-slate-50 text-slate-700"
                                variant="outline"
                              >
                                {t(
                                  `workspace.chatView.validationStatuses.${candidate.latest_validation_status}`,
                                )}
                              </Badge>
                              {candidate.retrieval_profile_name ? (
                                <Badge
                                  className="border-slate-200 bg-slate-50 text-slate-700"
                                  variant="outline"
                                >
                                  {candidate.retrieval_profile_name}
                                </Badge>
                              ) : null}
                            </div>
                            {candidate.recommendation_reason ? (
                              <p className="mt-3 text-sm leading-6 text-slate-700">
                                {candidate.recommendation_reason}
                              </p>
                            ) : null}
                          </>
                        }
                        isResolving={isUpdating}
                        meta={formatTimestamp(candidate.last_evaluated_at)}
                        onResolve={() =>
                          void onSetRetrievalQueryFollowUpStatus(
                            candidate.query_text,
                            candidate.follow_up_status === "resolved"
                              ? "pending"
                              : "resolved",
                          )
                        }
                        pendingLabel={t(
                          "workspace.chatView.feedbackSubmitting",
                        )}
                        resolveLabel={
                          candidate.follow_up_status === "resolved"
                            ? t("workspace.chatView.reopenCandidate")
                            : t("workspace.chatView.resolveCandidate")
                        }
                        title={candidate.query_text}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </AgentAlignedDrawerSection>

          <AgentAlignedDrawerSection title={t("workspace.retrievalInspector.recentEvaluationsTitle")}>
            <div className="space-y-3">
              {recentEvaluations.length === 0 ? (
                <ConsoleEmptyState>
                  {t("workspace.retrievalInspector.recentEvaluationsEmpty")}
                </ConsoleEmptyState>
              ) : (
                recentEvaluations.slice(0, 3).map((evaluation) => {
                  const followUpActions =
                    recentEvaluationFollowUpActionsById[evaluation.id] ?? [];
                  const isUpdating =
                    activeRetrievalEvaluationId === evaluation.id;

                  return (
                    <WorkspaceRetrievalFollowUpCard
                      key={evaluation.id}
                      actions={followUpActions}
                      badges={[
                        {
                          label:
                            evaluation.follow_up_status === "resolved"
                              ? t("workspace.chatView.followUpResolved")
                              : t("workspace.chatView.followUpPending"),
                          tone: "status",
                          className: getFollowUpBadgeClassName(
                            evaluation.follow_up_status,
                          ),
                        },
                      ]}
                      body={
                        <>
                          <div className="flex flex-wrap gap-2">
                            <Badge
                              className="border-slate-200 bg-slate-50 text-slate-700"
                              variant="outline"
                            >
                              {formatEvaluationModeLabel(
                                evaluation.evaluation_mode,
                              )}
                            </Badge>
                            <Badge
                              className="border-slate-200 bg-slate-50 text-slate-700"
                              variant="outline"
                            >
                              {t(
                                `workspace.chatView.validationStatuses.${evaluation.validation_status}`,
                              )}
                            </Badge>
                            {evaluation.retrieval_profile_name ? (
                              <Badge
                                className="border-slate-200 bg-slate-50 text-slate-700"
                                variant="outline"
                              >
                                {evaluation.retrieval_profile_name}
                              </Badge>
                            ) : null}
                          </div>
                          {evaluation.recommendation_reason ? (
                            <p className="mt-3 text-sm leading-6 text-slate-700">
                              {evaluation.recommendation_reason}
                            </p>
                          ) : null}
                        </>
                      }
                      isResolving={isUpdating}
                      meta={formatTimestamp(evaluation.updated_at)}
                      onResolve={() =>
                        void onSetRetrievalEvaluationFollowUpStatus(
                          evaluation,
                          evaluation.follow_up_status === "resolved"
                            ? "pending"
                            : "resolved",
                        )
                      }
                      pendingLabel={t(
                        "workspace.retrievalInspector.followUpUpdating",
                      )}
                      resolveLabel={
                        evaluation.follow_up_status === "resolved"
                          ? t("workspace.chatView.reopenFollowUp")
                          : t("workspace.chatView.resolveFollowUp")
                      }
                      title={evaluation.query_text}
                    />
                  );
                })
              )}
            </div>
          </AgentAlignedDrawerSection>
        </div>
      </FormDialog> : null}
    </div>
  );
}

function AgentAlignedDrawerSection({
  badge,
  children,
  description,
  title,
}: {
  badge?: ReactNode;
  children: ReactNode;
  description?: ReactNode;
  title: ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-950 dark:text-slate-50">{title}</div>
          {description ? <div className="mt-1 text-sm leading-6 text-slate-500">{description}</div> : null}
        </div>
        {badge}
      </div>
      {children}
    </section>
  );
}

function DrawerMetric({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900">
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</div>
      <div className="mt-2 break-words text-sm font-semibold text-slate-950 dark:text-slate-50">{value}</div>
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
    message.usage_json &&
    typeof message.usage_json === "object" &&
    !Array.isArray(message.usage_json)
      ? message.usage_json.runtime_binding
      : null;

  if (
    !runtimeBinding ||
    typeof runtimeBinding !== "object" ||
    Array.isArray(runtimeBinding)
  ) {
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
    typeof runtimeBindingRecord["model_name"] === "string" &&
    runtimeBindingRecord["model_name"].trim().length > 0
      ? runtimeBindingRecord["model_name"]
      : message.model_name;
  const providerType =
    typeof runtimeBindingRecord["provider_type"] === "string" &&
    runtimeBindingRecord["provider_type"].trim().length > 0
      ? runtimeBindingRecord["provider_type"]
      : null;
  const source =
    typeof runtimeBindingRecord["source"] === "string" &&
    runtimeBindingRecord["source"].trim().length > 0
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
    typeof runtimeBindingRecord["fallback_applied"] === "boolean"
      ? runtimeBindingRecord["fallback_applied"]
      : false;
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
    message.usage_json &&
    typeof message.usage_json === "object" &&
    !Array.isArray(message.usage_json)
      ? (message.usage_json as Record<string, unknown>)
      : null;

  if (!usagePayload) {
    return null;
  }

  const engineName =
    typeof usagePayload["retrieval_engine"] === "string" &&
    usagePayload["retrieval_engine"].trim().length > 0
      ? usagePayload["retrieval_engine"]
      : null;

  if (!engineName) {
    return null;
  }

  return {
    engineName,
  };
}
