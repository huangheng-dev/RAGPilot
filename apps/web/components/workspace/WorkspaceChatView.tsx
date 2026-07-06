"use client";

import type { ComponentProps, FormEvent } from "react";
import Link from "next/link";
import { CheckCircle2, MessageSquareText, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { SelectedDocumentPanel } from "@/components/workspace/SelectedDocumentPanel";
import { WorkspaceRetrievalFollowUpCard } from "@/components/workspace/WorkspaceRetrievalFollowUpCard";
import { SelectedWorkflowRunPanel } from "@/components/workspace/SelectedWorkflowRunPanel";
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
  const hasConversationSelection = selectedConversation !== null;
  const hasMessages = messages.length > 0;
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
    <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[minmax(0,1fr)_388px]">
      <div className="min-h-0 overflow-y-auto px-6 py-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-6">
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
                <Badge
                  className="border-slate-200 bg-white text-slate-700"
                  variant="outline"
                >
                  {isLoadingMessages
                    ? t("workspace.chatView.syncingHistory")
                    : t("workspace.chatView.loadedCount", {
                        count: String(messages.length),
                      })}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 p-4 sm:p-5">
              {isLoadingMessages && (
                <div className="rounded-lg border border-slate-200 bg-white px-4 py-4 text-sm text-slate-500">
                  {t("workspace.chatView.loadingConversationHistory")}
                </div>
              )}

              {!isLoadingMessages && !hasConversationSelection ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-6 text-sm text-slate-600">
                  <div className="text-base font-semibold text-slate-900">
                    {t("workspace.chatView.noConversationSelected")}
                  </div>
                  <div className="mt-2 leading-7">
                    {t("workspace.chatView.streamPlaceholderNoConversation")}
                  </div>
                </div>
              ) : null}

              {!isLoadingMessages &&
              hasConversationSelection &&
              !hasMessages ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-6 text-sm text-slate-600">
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
                </div>
              ) : null}

              {messages.map((message) => (
                <article
                  key={message.id}
                  className={cn(
                    "max-w-4xl rounded-xl border px-5 py-4 shadow-sm",
                    message.role === "assistant"
                      ? "border-slate-200 bg-white text-slate-900"
                      : "ml-auto border-blue-500 bg-blue-600 text-white",
                  )}
                >
                  <div className="mb-3 flex items-center justify-between gap-4">
                    <span
                      className={cn(
                        "text-xs font-semibold uppercase tracking-[0.16em]",
                        message.role === "assistant"
                          ? "text-primary"
                          : "text-blue-100",
                      )}
                    >
                      {message.role}
                    </span>
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
                  </div>
                  <div className="whitespace-pre-wrap text-sm leading-7">
                    {message.content}
                  </div>
                  {message.role === "assistant" ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(() => {
                        const runtimeSummary = extractRuntimeSummary(message);
                        const retrievalSummary =
                          extractRetrievalSummary(message);
                        if (!runtimeSummary?.modelName) {
                          return retrievalSummary?.engineName ? (
                            <Badge
                              className="border-slate-200 bg-slate-50 text-slate-600"
                              variant="outline"
                            >
                              {t("workspace.chatView.retrievalEngine", {
                                value: retrievalSummary.engineName,
                              })}
                            </Badge>
                          ) : null;
                        }

                        return (
                          <>
                            {retrievalSummary?.engineName ? (
                              <Badge
                                className="border-slate-200 bg-slate-50 text-slate-600"
                                variant="outline"
                              >
                                {t("workspace.chatView.retrievalEngine", {
                                  value: retrievalSummary.engineName,
                                })}
                              </Badge>
                            ) : null}
                            <Badge
                              className="border-slate-200 bg-slate-50 text-slate-700"
                              variant="outline"
                            >
                              {t("workspace.chatView.runtimeModelBadge", {
                                model: runtimeSummary.modelName,
                              })}
                            </Badge>
                            {runtimeSummary.providerType ? (
                              <Badge
                                className="border-slate-200 bg-slate-50 text-slate-600"
                                variant="outline"
                              >
                                {formatProviderLabel(
                                  runtimeSummary.providerType,
                                ) ?? runtimeSummary.providerType}
                              </Badge>
                            ) : null}
                            {runtimeSummary.source ? (
                              <Badge
                                className="border-slate-200 bg-slate-50 text-slate-600"
                                variant="outline"
                              >
                                {t("workspace.chatView.runtimeSource", {
                                  source:
                                    formatRuntimeSourceLabel(
                                      runtimeSummary.source,
                                    ) ?? runtimeSummary.source,
                                })}
                              </Badge>
                            ) : null}
                            {runtimeSummary.modelEndpointName ? (
                              <Badge
                                className="border-slate-200 bg-slate-50 text-slate-600"
                                variant="outline"
                              >
                                {t("workspace.chatView.runtimeEndpoint", {
                                  value: runtimeSummary.modelEndpointName,
                                })}
                              </Badge>
                            ) : null}
                            {runtimeSummary.fallbackApplied ? (
                              <Badge
                                className="border-amber-200 bg-amber-50 text-amber-800"
                                variant="outline"
                              >
                                {t("workspace.chatView.runtimeFallbackBadge")}
                              </Badge>
                            ) : null}
                            {runtimeSummary.apiBaseUrl ? (
                              <Badge
                                className="border-slate-200 bg-slate-50 text-slate-500"
                                variant="outline"
                              >
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
                        const currentFeedback =
                          readCurrentMessageFeedback(message);
                        return currentFeedback ? (
                          <Badge
                            className={cn(
                              "border",
                              currentFeedback.answer_quality === "helpful"
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-amber-200 bg-amber-50 text-amber-700",
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
                        <Badge
                          className="border-slate-200 bg-slate-50 text-slate-600"
                          variant="outline"
                        >
                          {t("workspace.chatView.feedbackCount", {
                            count: String(message.feedback_entries.length),
                          })}
                        </Badge>
                      ) : null}
                      {canSubmitMessageFeedback ? (
                        <>
                          <Button
                            className="bg-white"
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
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            {messageFeedbackPendingId === message.id
                              ? t("workspace.chatView.feedbackSubmitting")
                              : t("workspace.chatView.feedbackHelpful")}
                          </Button>
                          <Button
                            className="bg-white"
                            disabled={messageFeedbackPendingId === message.id}
                            onClick={() =>
                              void onSubmitMessageFeedback(message.id, "review")
                            }
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
                  {message.role === "assistant" &&
                    message.citations.length > 0 && (
                      <div className="mt-4 space-y-3 border-t border-slate-200 pt-4">
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
                        <div className="space-y-3">
                          {message.citations.map((citation) => (
                            <div
                              key={citation.id}
                              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm"
                            >
                              <div className="flex items-center justify-between gap-4">
                                <span className="font-medium text-slate-900">
                                  {t("workspace.chatView.sourceRank", {
                                    rank: String(citation.rank),
                                  })}
                                </span>
                                <span className="text-xs text-slate-500">
                                  {hasNumericScore(citation.score)
                                    ? t("workspace.chatView.score", {
                                        score:
                                          formatNumericScore(citation.score) ??
                                          "0.000",
                                      })
                                    : t("workspace.chatView.unscored")}
                                </span>
                              </div>
                              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                <Badge
                                  className="border-slate-200 bg-white text-slate-700"
                                  variant="outline"
                                >
                                  {citation.document_title ??
                                    `Chunk ${citation.document_chunk_id.slice(0, 8)}`}
                                </Badge>
                                {citation.retrieval_method ? (
                                  <Badge
                                    className="border-slate-200 bg-white text-slate-600"
                                    variant="outline"
                                  >
                                    {t("workspace.chatView.retrievalMethod", {
                                      method:
                                        formatCitationMethod(
                                          citation.retrieval_method,
                                        ) ?? citation.retrieval_method,
                                    })}
                                  </Badge>
                                ) : null}
                                {citation.chunk_index !== null ? (
                                  <Badge
                                    className="border-slate-200 bg-white text-slate-600"
                                    variant="outline"
                                  >
                                    {t("workspace.chatView.chunkIndex", {
                                      index: String(citation.chunk_index),
                                    })}
                                  </Badge>
                                ) : null}
                              </div>
                              {hasNumericScore(citation.vector_score) ||
                              hasNumericScore(citation.lexical_score) ||
                              hasNumericScore(
                                citation.lexical_normalized_score,
                              ) ? (
                                <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                                  {hasNumericScore(citation.vector_score) ? (
                                    <span>
                                      {t("workspace.chatView.vectorScore", {
                                        score:
                                          formatNumericScore(
                                            citation.vector_score,
                                          ) ?? "0.000",
                                      })}
                                    </span>
                                  ) : null}
                                  {hasNumericScore(citation.lexical_score) ? (
                                    <span>
                                      {t("workspace.chatView.lexicalScore", {
                                        score:
                                          formatNumericScore(
                                            citation.lexical_score,
                                          ) ?? "0.000",
                                      })}
                                    </span>
                                  ) : null}
                                  {hasNumericScore(
                                    citation.lexical_normalized_score,
                                  ) ? (
                                    <span>
                                      {t(
                                        "workspace.chatView.lexicalNormalizedScore",
                                        {
                                          score:
                                            formatNumericScore(
                                              citation.lexical_normalized_score,
                                            ) ?? "0.000",
                                        },
                                      )}
                                    </span>
                                  ) : null}
                                </div>
                              ) : null}
                              {citation.quote ? (
                                <p className="mt-2 whitespace-pre-wrap leading-6 text-slate-700">
                                  {citation.quote}
                                </p>
                              ) : (
                                <p className="mt-2 leading-6 text-slate-500">
                                  {t("workspace.chatView.citationWithoutQuote")}
                                </p>
                              )}
                              {citation.document_id ? (
                                <div className="mt-3 flex flex-wrap gap-2">
                                  <Button
                                    className="bg-white"
                                    onClick={() =>
                                      void onInspectCitationDocument(citation)
                                    }
                                    size="sm"
                                    type="button"
                                    variant="outline"
                                  >
                                    {t("workspace.chatView.inspectSource")}
                                  </Button>
                                  <Button
                                    className="bg-white"
                                    onClick={() =>
                                      void onOpenCitationDocumentView(citation)
                                    }
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
              <form
                className="flex flex-col gap-4"
                onSubmit={handleSendQuestion}
              >
                <Textarea
                  id="question"
                  className="min-h-32 rounded-xl bg-slate-50 px-4 py-3 leading-7 focus-visible:bg-white"
                  disabled={
                    isBusy ||
                    isSending ||
                    !hasConversationSelection ||
                    !canSendChatMessages
                  }
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
                        scope:
                          bootstrap?.knowledgeBase.slug ??
                          t("workspace.chatView.defaultScope"),
                      })}{" "}
                    </div>
                    {currentRuntimeSummary?.modelName ||
                    currentRetrievalEngineName ||
                    currentRetrievalProfileName ? (
                      <>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          {currentRetrievalEngineName ? (
                            <Badge
                              className="border-slate-200 bg-white text-slate-600"
                              variant="outline"
                            >
                              {t("workspace.chatView.retrievalEngine", {
                                value: currentRetrievalEngineName,
                              })}
                            </Badge>
                          ) : null}
                          {currentRetrievalProfileName ? (
                            <Badge
                              className="border-slate-200 bg-white text-slate-600"
                              variant="outline"
                            >
                              {t("workspace.chatView.validationProfile", {
                                value: currentRetrievalProfileName,
                              })}
                            </Badge>
                          ) : null}
                          {currentRuntimeSummary?.modelName ? (
                            <Badge
                              className="border-slate-200 bg-white text-slate-700"
                              variant="outline"
                            >
                              {t("workspace.chatView.runtimeModelBadge", {
                                model: currentRuntimeSummary.modelName,
                              })}
                            </Badge>
                          ) : null}
                          {currentRuntimeSummary?.providerType ? (
                            <Badge
                              className="border-slate-200 bg-white text-slate-600"
                              variant="outline"
                            >
                              {formatProviderLabel(
                                currentRuntimeSummary.providerType,
                              ) ?? currentRuntimeSummary.providerType}
                            </Badge>
                          ) : null}
                          {currentRuntimeSummary?.source ? (
                            <Badge
                              className="border-slate-200 bg-white text-slate-600"
                              variant="outline"
                            >
                              {t("workspace.chatView.runtimeSource", {
                                source:
                                  formatRuntimeSourceLabel(
                                    currentRuntimeSummary.source,
                                  ) ?? currentRuntimeSummary.source,
                              })}
                            </Badge>
                          ) : null}
                          {currentRuntimeSummary?.modelEndpointName ? (
                            <Badge
                              className="border-slate-200 bg-white text-slate-600"
                              variant="outline"
                            >
                              {t("workspace.chatView.runtimeEndpoint", {
                                value: currentRuntimeSummary.modelEndpointName,
                              })}
                            </Badge>
                          ) : null}
                          {latestRuntimeSummary?.fallbackApplied ? (
                            <Badge
                              className="border-amber-200 bg-amber-50 text-amber-800"
                              variant="outline"
                            >
                              {t("workspace.chatView.runtimeFallbackBadge")}
                            </Badge>
                          ) : null}
                        </div>
                        {latestRuntimeFallbackMessage ? (
                          <div className="text-xs leading-5 text-amber-700">
                            {latestRuntimeFallbackMessage}
                          </div>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                  <Button
                    disabled={
                      isBusy ||
                      isSending ||
                      !hasConversationSelection ||
                      !canSendChatMessages ||
                      !hasDocuments ||
                      question.trim().length === 0
                    }
                    size="lg"
                    type="submit"
                  >
                    {isSending
                      ? t("workspace.chatView.generating")
                      : t("workspace.chatView.sendQuestion")}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>

      <aside className="border-t border-slate-200 bg-slate-50/75 xl:border-l xl:border-t-0">
        <div className="space-y-5 px-5 py-5 xl:sticky xl:top-6 xl:px-6 xl:py-6">
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
                    .filter(
                      (workflowRun) =>
                        workflowRun.subject_id === selectedDocumentId,
                    )
                    .sort(
                      (left, right) =>
                        new Date(right.created_at).getTime() -
                        new Date(left.created_at).getTime(),
                    )
                : []
            }
            selectedDocumentVersionId={
              selectedDocumentDetail?.document_version_id ?? null
            }
          />

          <SelectedWorkflowRunPanel
            detail={selectedWorkflowRunDetail}
            emptyState={t("workspace.chatView.selectWorkflowToInspect")}
            emptyStepsMessage={t("workspace.chatView.workflowStepsAppear")}
            canEditOperatorNotes={canManageWorkflowRuns}
            isCancellingWorkflow={isCancellingWorkflow}
            isSavingOperatorNotes={isSavingWorkflowNotes}
            isRetryingWorkflow={isRetryingWorkflow}
            onCancelWorkflowRun={onCancelWorkflowRun}
            onOpenDocumentsView={onOpenDocumentsView}
            onOpenWorkflowView={onOpenWorkflowView}
            onSaveOperatorNotes={onSaveWorkflowOperatorNotes}
            onSelectDocument={onSelectDocument}
            onRetryWorkflowRun={onRetryWorkflowRun}
          />

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="gap-2 border-b border-slate-200 pb-5">
              <CardTitle>{t("workspace.chatView.answerReviewTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 px-4 pb-4 pt-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    {t("workspace.chatView.feedbackPendingMetric")}
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-slate-950">
                    {pendingFeedbackItems.length}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    {t("workspace.chatView.feedbackResolvedMetric")}
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-slate-950">
                    {resolvedFeedbackCount}
                  </div>
                </div>
              </div>

              {pendingFeedbackItems.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-600">
                  {t("workspace.chatView.feedbackQueueEmpty")}
                </div>
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
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="gap-2 border-b border-slate-200 pb-5">
              <CardTitle>
                {t("workspace.chatView.tuningCandidatesTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 px-4 pb-4 pt-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    {t("workspace.chatView.candidatePendingMetric")}
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-slate-950">
                    {retrievalEvaluationSummary?.follow_up_breakdown.pending ??
                      0}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    {t("workspace.chatView.candidateResolvedMetric")}
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-slate-950">
                    {retrievalEvaluationSummary?.follow_up_breakdown.resolved ??
                      0}
                  </div>
                </div>
              </div>

              {pendingRetrievalCandidates.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-600">
                  {t("workspace.chatView.tuningCandidatesEmpty")}
                </div>
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
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="gap-2 border-b border-slate-200 pb-4">
              <CardTitle>
                {t("workspace.retrievalInspector.recentEvaluationsTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-4">
              {recentEvaluations.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-600">
                  {t("workspace.retrievalInspector.recentEvaluationsEmpty")}
                </div>
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
            </CardContent>
          </Card>
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
