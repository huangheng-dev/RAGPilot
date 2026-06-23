"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Search, Sparkles } from "lucide-react";

import { ConsoleOutlineBadge, ConsoleSurfaceHeader } from "@/components/console/ConsolePrimitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { buildAdminHref, buildSettingsHref } from "@/lib/console-route-builders";
import { useI18n } from "@/lib/i18n/provider";
import {
  compareRetrieval,
  inspectRetrieval,
  listRetrievalEvaluations,
  recordRetrievalEvaluation,
  summarizeRetrievalEvaluations,
  type RetrievalEvaluationRecord,
  type RetrievalEvaluationSummary,
  type RetrievalComparisonResponse,
  type RetrievalEngineDiagnostics,
  type RetrievalInspectorResponse
} from "@/lib/retrieval-inspector";
import { cn } from "@/lib/utils";
import type { RetrievalValidationSummary } from "@/components/workspace/workspace-types";

type RetrievalSuggestion = {
  key: string;
  label: string;
  query: string;
};

type WorkspaceRetrievalInspectorPanelProps = {
  tenantId: string | null;
  workspaceId: string | null;
  knowledgeBaseId: string | null;
  draftQuery?: string | null;
  focusToken?: number;
  autoRunMode?: "inspect" | "compare" | null;
  onOpenChatWithQuery: (query: string) => void | Promise<void>;
  onOpenDocument: (documentId: string) => void | Promise<void>;
  onValidationSummaryChange?: (summary: RetrievalValidationSummary | null) => void;
  suggestions: RetrievalSuggestion[];
};

function hasNumericValue(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function formatNumericValue(value: number | null | undefined) {
  if (!hasNumericValue(value)) {
    return null;
  }

  return Number(value).toFixed(3);
}

function formatContentPreview(content: string) {
  const normalized = content.trim();
  if (normalized.length <= 320) {
    return normalized;
  }

  return `${normalized.slice(0, 320)}...`;
}

function getMethodBadgeClassName(method: string) {
  if (method === "hybrid") {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }

  if (method === "vector") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (method === "lexical") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
}

export function WorkspaceRetrievalInspectorPanel({
  tenantId,
  workspaceId,
  knowledgeBaseId,
  draftQuery = null,
  focusToken = 0,
  autoRunMode = null,
  onOpenChatWithQuery,
  onOpenDocument,
  onValidationSummaryChange,
  suggestions
}: WorkspaceRetrievalInspectorPanelProps) {
  const { t } = useI18n();
  const [queryText, setQueryText] = useState("");
  const [topK, setTopK] = useState("5");
  const [response, setResponse] = useState<RetrievalInspectorResponse | null>(null);
  const [comparisonResponse, setComparisonResponse] = useState<RetrievalComparisonResponse | null>(null);
  const [recentEvaluations, setRecentEvaluations] = useState<RetrievalEvaluationRecord[]>([]);
  const [evaluationSummary, setEvaluationSummary] = useState<RetrievalEvaluationSummary | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isComparing, setIsComparing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "running" | "comparing" | "loaded" | "compare_loaded" | "empty" | "failed">("idle");
  const lastHandledFocusTokenRef = useRef(0);

  const isScopeReady = Boolean(tenantId && workspaceId && knowledgeBaseId);
  const normalizedQuery = queryText.trim();
  const canRun = isScopeReady && normalizedQuery.length > 0;
  const availableSuggestions = suggestions.filter((item) => item.query.trim().length > 0);

  const loadRecentEvaluations = useCallback(async () => {
    if (!tenantId || !workspaceId || !knowledgeBaseId) {
      setRecentEvaluations([]);
      return;
    }

    try {
      const items = await listRetrievalEvaluations({
        tenant_id: tenantId,
        workspace_id: workspaceId,
        knowledge_base_id: knowledgeBaseId,
        limit: 6,
      });
      setRecentEvaluations(items);
    } catch {
      setRecentEvaluations([]);
    }
  }, [knowledgeBaseId, tenantId, workspaceId]);

  const loadEvaluationSummary = useCallback(async () => {
    if (!tenantId || !workspaceId || !knowledgeBaseId) {
      setEvaluationSummary(null);
      return;
    }

    try {
      const summary = await summarizeRetrievalEvaluations({
        tenant_id: tenantId,
        workspace_id: workspaceId,
        knowledge_base_id: knowledgeBaseId,
        limit: 4,
        sample_size: 120,
      });
      setEvaluationSummary(summary);
    } catch {
      setEvaluationSummary(null);
    }
  }, [knowledgeBaseId, tenantId, workspaceId]);

  useEffect(() => {
    void loadRecentEvaluations();
    void loadEvaluationSummary();
  }, [loadEvaluationSummary, loadRecentEvaluations]);

  const handleRunRetrieval = useCallback(async (queryOverride?: string) => {
    const effectiveQuery = (queryOverride ?? normalizedQuery).trim();
    if (!tenantId || !knowledgeBaseId || !workspaceId || !effectiveQuery) {
      return;
    }

    try {
      setIsRunning(true);
      setErrorMessage(null);
      setStatus("running");
      const nextResponse = await inspectRetrieval({
        tenant_id: tenantId,
        knowledge_base_id: knowledgeBaseId,
        query_text: effectiveQuery,
        top_k: Number(topK)
      });
      setResponse(nextResponse);
      setComparisonResponse(null);
      const nextStatus = nextResponse.results.length > 0 ? "loaded" : "empty";
      setStatus(nextStatus);
      onValidationSummaryChange?.({
        mode: "inspect",
        status: nextResponse.results.length > 0 ? "ready" : "empty",
        queryText: effectiveQuery,
        detail:
          nextResponse.results.length > 0
            ? t("workspace.retrievalInspector.statusLoaded", {
                count: String(nextResponse.results.length)
              })
            : t("workspace.retrievalInspector.statusEmpty"),
        engineName: nextResponse.engine_name,
        candidateEngineName: null,
        retrievalProfileName: nextResponse.retrieval_profile_name,
        resultCount: nextResponse.results.length,
        updatedAt: new Date().toISOString()
      });
      try {
        await recordRetrievalEvaluation({
          tenant_id: tenantId,
          workspace_id: workspaceId,
          knowledge_base_id: knowledgeBaseId,
          evaluation_mode: "inspect",
          validation_status: nextResponse.results.length > 0 ? "ready" : "empty",
          query_text: effectiveQuery,
          baseline_engine_name: nextResponse.engine_name,
          retrieval_profile_name: nextResponse.retrieval_profile_name,
          retrieval_profile_source: nextResponse.retrieval_profile_source,
          result_count: nextResponse.results.length,
          recommendation_reason:
            nextResponse.results.length > 0
              ? t("workspace.retrievalInspector.statusLoaded", { count: String(nextResponse.results.length) })
              : t("workspace.retrievalInspector.statusEmpty"),
          evaluation_payload_json: nextResponse,
        });
        await Promise.all([loadRecentEvaluations(), loadEvaluationSummary()]);
      } catch {
        // Keep the live diagnostics result visible even if persistence fails.
      }
    } catch (error) {
      const nextErrorMessage =
        error instanceof Error ? error.message : t("workspace.retrievalInspector.statusFailed");
      setErrorMessage(nextErrorMessage);
      setStatus("failed");
      onValidationSummaryChange?.({
        mode: "inspect",
        status: "failed",
        queryText: effectiveQuery,
        detail: nextErrorMessage,
        engineName: null,
        candidateEngineName: null,
        retrievalProfileName: null,
        resultCount: 0,
        updatedAt: new Date().toISOString()
      });
    } finally {
      setIsRunning(false);
    }
  }, [knowledgeBaseId, normalizedQuery, onValidationSummaryChange, t, tenantId, workspaceId, topK]);

  const handleCompareRetrieval = useCallback(async (queryOverride?: string) => {
    const effectiveQuery = (queryOverride ?? normalizedQuery).trim();
    if (!tenantId || !knowledgeBaseId || !workspaceId || !effectiveQuery) {
      return;
    }

    try {
      setIsComparing(true);
      setErrorMessage(null);
      setStatus("comparing");
      const nextResponse = await compareRetrieval({
        tenant_id: tenantId,
        knowledge_base_id: knowledgeBaseId,
        query_text: effectiveQuery,
        top_k: Number(topK)
      });
      setComparisonResponse(nextResponse);
      setResponse(null);
      setStatus("compare_loaded");
      onValidationSummaryChange?.({
        mode: "compare",
        status:
          nextResponse.summary.recommendation_status === "aligned"
            ? "ready"
            : nextResponse.summary.recommendation_status,
        queryText: effectiveQuery,
        detail: nextResponse.summary.recommendation_reason,
        engineName: nextResponse.baseline.engine_name,
        candidateEngineName: nextResponse.candidate.engine_name,
        retrievalProfileName:
          nextResponse.candidate.retrieval_profile_name ?? nextResponse.baseline.retrieval_profile_name,
        resultCount: nextResponse.summary.shared_result_count,
        updatedAt: new Date().toISOString()
      });
      try {
        await recordRetrievalEvaluation({
          tenant_id: tenantId,
          workspace_id: workspaceId,
          knowledge_base_id: knowledgeBaseId,
          evaluation_mode: "compare",
          validation_status:
            nextResponse.summary.recommendation_status === "aligned"
              ? "ready"
              : nextResponse.summary.recommendation_status,
          query_text: effectiveQuery,
          baseline_engine_name: nextResponse.baseline.engine_name,
          candidate_engine_name: nextResponse.candidate.engine_name,
          retrieval_profile_name:
            nextResponse.candidate.retrieval_profile_name ?? nextResponse.baseline.retrieval_profile_name,
          retrieval_profile_source:
            nextResponse.candidate.retrieval_profile_source ?? nextResponse.baseline.retrieval_profile_source,
          result_count: nextResponse.summary.shared_result_count,
          shared_result_count: nextResponse.summary.shared_result_count,
          baseline_only_count: nextResponse.summary.baseline_only_count,
          candidate_only_count: nextResponse.summary.candidate_only_count,
          top_result_matches: nextResponse.summary.top_result_matches,
          recommendation_reason: nextResponse.summary.recommendation_reason,
          evaluation_payload_json: nextResponse,
        });
        await Promise.all([loadRecentEvaluations(), loadEvaluationSummary()]);
      } catch {
        // Keep the live comparison visible even if persistence fails.
      }
    } catch (error) {
      const nextErrorMessage =
        error instanceof Error ? error.message : t("workspace.retrievalInspector.statusFailed");
      setErrorMessage(nextErrorMessage);
      setStatus("failed");
      onValidationSummaryChange?.({
        mode: "compare",
        status: "failed",
        queryText: effectiveQuery,
        detail: nextErrorMessage,
        engineName: null,
        candidateEngineName: null,
        retrievalProfileName: null,
        resultCount: 0,
        updatedAt: new Date().toISOString()
      });
    } finally {
      setIsComparing(false);
    }
  }, [knowledgeBaseId, normalizedQuery, onValidationSummaryChange, t, tenantId, workspaceId, topK]);

  useEffect(() => {
    const normalizedDraftQuery = draftQuery?.trim() ?? "";
    if (!normalizedDraftQuery) {
      return;
    }

    setQueryText(normalizedDraftQuery);
  }, [draftQuery]);

  useEffect(() => {
    if (!focusToken || focusToken === lastHandledFocusTokenRef.current) {
      return;
    }

    lastHandledFocusTokenRef.current = focusToken;

    if (!autoRunMode || !isScopeReady) {
      return;
    }

    const autoQuery = draftQuery?.trim() ?? "";
    if (!autoQuery) {
      return;
    }

    if (autoRunMode === "compare") {
      void handleCompareRetrieval(autoQuery);
      return;
    }

    void handleRunRetrieval(autoQuery);
  }, [autoRunMode, draftQuery, focusToken, handleCompareRetrieval, handleRunRetrieval, isScopeReady]);

  function renderStatusMessage() {
    if (!isScopeReady) {
      return t("workspace.retrievalInspector.scopeRequired");
    }

    if (status === "running") {
      return t("workspace.retrievalInspector.statusRunning");
    }

    if (status === "comparing") {
      return t("workspace.retrievalInspector.compareStatusRunning");
    }

    if (status === "loaded") {
      return t("workspace.retrievalInspector.statusLoaded", {
        count: String(response?.results.length ?? 0)
      });
    }

    if (status === "compare_loaded") {
      return t("workspace.retrievalInspector.compareStatusLoaded", {
        shared: String(comparisonResponse?.summary.shared_result_count ?? 0)
      });
    }

    if (status === "empty") {
      return t("workspace.retrievalInspector.statusEmpty");
    }

    if (status === "failed") {
      return t("workspace.retrievalInspector.statusFailed");
    }

    return t("workspace.retrievalInspector.statusIdle");
  }

  function renderEngineDiagnosticsCard(
    diagnostics: RetrievalEngineDiagnostics,
    comparisonType: "baseline" | "candidate"
  ) {
    const topResults = diagnostics.results.slice(0, 3);
    return (
      <div className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-950">
              {comparisonType === "baseline"
                ? t("workspace.retrievalInspector.baselineEngine")
                : t("workspace.retrievalInspector.candidateEngine")}
            </div>
            <div className="mt-1 text-sm text-slate-500">{diagnostics.engine_name}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <ConsoleOutlineBadge>
              {t("workspace.retrievalInspector.resultCount", { count: String(diagnostics.result_count) })}
            </ConsoleOutlineBadge>
            <ConsoleOutlineBadge>
              {t("workspace.retrievalInspector.effectiveTopK", { value: String(diagnostics.effective_top_k) })}
            </ConsoleOutlineBadge>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {diagnostics.retrieval_profile_name ? (
            <ConsoleOutlineBadge>
              {t("workspace.retrievalInspector.retrievalProfile", { value: diagnostics.retrieval_profile_name })}
            </ConsoleOutlineBadge>
          ) : null}
          <ConsoleOutlineBadge>
            {t("workspace.retrievalInspector.retrievalMode", { value: diagnostics.retrieval_mode })}
          </ConsoleOutlineBadge>
          <ConsoleOutlineBadge>
            {t("workspace.retrievalInspector.embeddingModel", { value: diagnostics.embedding_model })}
          </ConsoleOutlineBadge>
        </div>
        {Object.keys(diagnostics.retrieval_method_breakdown).length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {Object.entries(diagnostics.retrieval_method_breakdown).map(([method, count]) => (
              <Badge className={cn("border", getMethodBadgeClassName(method))} key={`${diagnostics.engine_name}-${method}`} variant="outline">
                {`${method} x${count}`}
              </Badge>
            ))}
          </div>
        ) : null}
        <div className="mt-4 space-y-3">
          {topResults.map((result, index) => (
            <div className="rounded-[16px] border border-slate-200 bg-white px-4 py-4" key={`${diagnostics.engine_name}-${result.document_chunk_id}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-950">{result.document_title}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {t("workspace.retrievalInspector.chunkLabel", { index: String(result.chunk_index) })}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge className={cn("border", getMethodBadgeClassName(result.retrieval_method))} variant="outline">
                    {t("workspace.retrievalInspector.sourceRank", { rank: String(index + 1) })}
                  </Badge>
                  <Badge className="border-slate-200 bg-slate-50 text-slate-700" variant="outline">
                    {t("workspace.retrievalInspector.score", { score: formatNumericValue(result.score) ?? "0.000" })}
                  </Badge>
                </div>
              </div>
              <div className="mt-3 text-sm leading-7 text-slate-700">{formatContentPreview(result.content)}</div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button className="bg-white" onClick={() => void onOpenDocument(result.document_id)} size="sm" type="button" variant="outline">
                  {t("workspace.retrievalInspector.openDocument")}
                </Button>
                <Button onClick={() => void onOpenChatWithQuery(normalizedQuery)} size="sm" type="button">
                  {t("workspace.retrievalInspector.askWithThisQuery")}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function renderValidationBadge(status: "ready" | "review" | "hold" | "empty" | "failed") {
    return (
      <Badge
        className={cn(
          "border",
          status === "ready"
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : status === "review"
              ? "border-blue-200 bg-blue-50 text-blue-700"
              : status === "hold"
                ? "border-amber-200 bg-amber-50 text-amber-800"
                : status === "failed"
                  ? "border-rose-200 bg-rose-50 text-rose-700"
                  : "border-slate-200 bg-slate-50 text-slate-700"
        )}
        variant="outline"
      >
        {t(`workspace.chatView.validationStatuses.${status}`)}
      </Badge>
    );
  }

  return (
    <div className="border-b border-slate-100 px-6 py-5 dark:border-slate-800">
      <ConsoleSurfaceHeader
        action={
          comparisonResponse ? (
            <ConsoleOutlineBadge>
              {t("workspace.retrievalInspector.compareResultCount", {
                baseline: String(comparisonResponse.baseline.result_count),
                candidate: String(comparisonResponse.candidate.result_count)
              })}
            </ConsoleOutlineBadge>
          ) : response ? (
            <ConsoleOutlineBadge>
              {t("workspace.retrievalInspector.resultCount", { count: String(response.results.length) })}
            </ConsoleOutlineBadge>
          ) : null
        }
        description={t("workspace.retrievalInspector.description")}
        title={t("workspace.retrievalInspector.title")}
      />
      <div className="mt-4 grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-4">
          <div className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-blue-600 shadow-sm">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-950">{t("workspace.retrievalInspector.queryTitle")}</div>
                <div className="mt-1 text-sm text-slate-500">{t("workspace.retrievalInspector.queryDescription")}</div>
              </div>
            </div>

            {availableSuggestions.length > 0 ? (
              <div className="mt-5 space-y-2">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  {t("workspace.retrievalInspector.quickFillTitle")}
                </div>
                <div className="flex flex-wrap gap-2">
                  {availableSuggestions.map((item) => (
                    <Button
                      className="bg-white"
                      key={item.key}
                      onClick={() => setQueryText(item.query)}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      {item.label}
                    </Button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-5 space-y-4">
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  {t("workspace.retrievalInspector.queryLabel")}
                </div>
                <Input
                  className="bg-white"
                  disabled={!isScopeReady || isRunning}
                  onChange={(event) => setQueryText(event.target.value)}
                  placeholder={t("workspace.retrievalInspector.queryPlaceholder")}
                  value={queryText}
                />
              </div>
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  {t("workspace.retrievalInspector.topKLabel")}
                </div>
                <Select disabled={!isScopeReady || isRunning} onValueChange={setTopK} value={topK}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder={t("workspace.retrievalInspector.topKLabel")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">3</SelectItem>
                    <SelectItem value="5">5</SelectItem>
                    <SelectItem value="8">8</SelectItem>
                    <SelectItem value="10">10</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button disabled={!canRun || isRunning || isComparing} onClick={() => void handleRunRetrieval()} type="button">
                  <Search className="h-4 w-4" />
                  {isRunning ? t("workspace.retrievalInspector.running") : t("workspace.retrievalInspector.run")}
                </Button>
                <Button
                  className="bg-white"
                  disabled={!canRun || isRunning || isComparing}
                  onClick={() => void handleCompareRetrieval()}
                  type="button"
                  variant="outline"
                >
                  {isComparing ? t("workspace.retrievalInspector.comparing") : t("workspace.retrievalInspector.compare")}
                </Button>
                <Button
                  className="bg-white"
                  disabled={!canRun}
                  onClick={() => void onOpenChatWithQuery(normalizedQuery)}
                  type="button"
                  variant="outline"
                >
                  {t("workspace.retrievalInspector.openChat")}
                </Button>
              </div>
            </div>
          </div>

          <div className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-5">
            <div className="text-sm font-semibold text-slate-950">{t("workspace.retrievalInspector.statusTitle")}</div>
            <div className="mt-3 text-sm leading-6 text-slate-500">{renderStatusMessage()}</div>
            {response ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {response.retrieval_profile_name ? (
                  <ConsoleOutlineBadge>
                    {t("workspace.retrievalInspector.retrievalProfile", { value: response.retrieval_profile_name })}
                  </ConsoleOutlineBadge>
                ) : null}
                <ConsoleOutlineBadge>
                  {t("workspace.retrievalInspector.engineLabel", { value: response.engine_name })}
                </ConsoleOutlineBadge>
                {response.retrieval_profile_source ? (
                  <ConsoleOutlineBadge>
                    {t("workspace.retrievalInspector.profileSource", { value: response.retrieval_profile_source })}
                  </ConsoleOutlineBadge>
                ) : null}
                <ConsoleOutlineBadge>
                  {t("workspace.retrievalInspector.retrievalMode", { value: response.retrieval_mode })}
                </ConsoleOutlineBadge>
                <ConsoleOutlineBadge>
                  {t("workspace.retrievalInspector.effectiveTopK", { value: String(response.effective_top_k) })}
                </ConsoleOutlineBadge>
                <ConsoleOutlineBadge>
                  {t("workspace.retrievalInspector.embeddingModel", { value: response.embedding_model })}
                </ConsoleOutlineBadge>
              </div>
            ) : comparisonResponse ? (
              <>
                <div className="mt-4 flex flex-wrap gap-2">
                  <ConsoleOutlineBadge>
                    {t("workspace.retrievalInspector.compareShared", {
                      count: String(comparisonResponse.summary.shared_result_count)
                    })}
                  </ConsoleOutlineBadge>
                  <ConsoleOutlineBadge>
                    {t("workspace.retrievalInspector.compareBaselineOnly", {
                      count: String(comparisonResponse.summary.baseline_only_count)
                    })}
                  </ConsoleOutlineBadge>
                  <ConsoleOutlineBadge>
                    {t("workspace.retrievalInspector.compareCandidateOnly", {
                      count: String(comparisonResponse.summary.candidate_only_count)
                    })}
                  </ConsoleOutlineBadge>
                  <Badge
                    className={cn(
                      "border",
                      comparisonResponse.summary.recommendation_status === "aligned"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : comparisonResponse.summary.recommendation_status === "review"
                          ? "border-blue-200 bg-blue-50 text-blue-700"
                          : "border-amber-200 bg-amber-50 text-amber-800"
                    )}
                    variant="outline"
                  >
                    {comparisonResponse.summary.recommendation_status === "aligned"
                      ? t("workspace.retrievalInspector.recommendationAligned")
                      : comparisonResponse.summary.recommendation_status === "review"
                        ? t("workspace.retrievalInspector.recommendationReview")
                        : t("workspace.retrievalInspector.recommendationHold")}
                  </Badge>
                </div>
                <div className="mt-4 rounded-[16px] border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-600">
                  {comparisonResponse.summary.recommendation_reason}
                </div>
              </>
            ) : null}
            {errorMessage ? (
              <div className="mt-4 rounded-[16px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {errorMessage}
              </div>
            ) : null}
          </div>

          <div className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-slate-950">{t("workspace.retrievalInspector.recentEvaluationsTitle")}</div>
              <ConsoleOutlineBadge>
                {t("workspace.retrievalInspector.resultCount", { count: String(recentEvaluations.length) })}
              </ConsoleOutlineBadge>
            </div>
            {recentEvaluations.length > 0 ? (
              <div className="mt-4 space-y-3">
                {recentEvaluations.map((item) => (
                  <button
                    className="w-full rounded-[16px] border border-slate-200 bg-white px-4 py-3 text-left"
                    key={item.id}
                    onClick={() => setQueryText(item.query_text)}
                    type="button"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-medium text-slate-950">{item.query_text}</div>
                      {renderValidationBadge(item.validation_status)}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                      <span>{item.evaluation_mode === "compare" ? t("workspace.retrievalInspector.compare") : t("workspace.retrievalInspector.run")}</span>
                      <span>{item.baseline_engine_name}</span>
                      {item.candidate_engine_name ? <span>{`vs ${item.candidate_engine_name}`}</span> : null}
                    </div>
                    {item.recommendation_reason ? (
                      <div className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">{item.recommendation_reason}</div>
                    ) : null}
                  </button>
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-[16px] border border-dashed border-slate-200 bg-white px-4 py-4 text-sm text-slate-500">
                {t("workspace.retrievalInspector.recentEvaluationsEmpty")}
              </div>
            )}
          </div>

          <div className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-slate-950">{t("workspace.retrievalInspector.tuningCandidatesTitle")}</div>
              <ConsoleOutlineBadge>
                {t("workspace.retrievalInspector.queryCount", {
                  count: String(evaluationSummary?.total_queries ?? 0)
                })}
              </ConsoleOutlineBadge>
            </div>
            {evaluationSummary ? (
              <>
                <div className="mt-4 flex flex-wrap gap-2">
                  <ConsoleOutlineBadge>
                    {t("workspace.retrievalInspector.summaryEvaluations", {
                      count: String(evaluationSummary.total_evaluations)
                    })}
                  </ConsoleOutlineBadge>
                  <ConsoleOutlineBadge>
                    {t("workspace.retrievalInspector.summaryReady", {
                      count: String(evaluationSummary.status_breakdown.ready)
                    })}
                  </ConsoleOutlineBadge>
                  <ConsoleOutlineBadge>
                    {t("workspace.retrievalInspector.summaryReview", {
                      count: String(evaluationSummary.status_breakdown.review)
                    })}
                  </ConsoleOutlineBadge>
                  <ConsoleOutlineBadge>
                    {t("workspace.retrievalInspector.summaryHold", {
                      count: String(evaluationSummary.status_breakdown.hold)
                    })}
                  </ConsoleOutlineBadge>
                </div>
                {evaluationSummary.candidates.length > 0 ? (
                  <div className="mt-4 space-y-3">
                    {evaluationSummary.candidates.map((candidate) => (
                      <div className="rounded-[16px] border border-slate-200 bg-white px-4 py-4" key={candidate.query_text}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-slate-950">{candidate.query_text}</div>
                            <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                              <span>
                                {t("workspace.retrievalInspector.evaluationCount", {
                                  count: String(candidate.evaluation_count)
                                })}
                              </span>
                              <span>{candidate.baseline_engine_name}</span>
                              {candidate.candidate_engine_name ? <span>{`vs ${candidate.candidate_engine_name}`}</span> : null}
                            </div>
                          </div>
                          {renderValidationBadge(candidate.latest_validation_status)}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {candidate.review_count > 0 ? (
                            <ConsoleOutlineBadge>
                              {t("workspace.retrievalInspector.summaryReview", {
                                count: String(candidate.review_count)
                              })}
                            </ConsoleOutlineBadge>
                          ) : null}
                          {candidate.hold_count > 0 ? (
                            <ConsoleOutlineBadge>
                              {t("workspace.retrievalInspector.summaryHold", {
                                count: String(candidate.hold_count)
                              })}
                            </ConsoleOutlineBadge>
                          ) : null}
                          {candidate.failed_count > 0 ? (
                            <ConsoleOutlineBadge>
                              {t("workspace.retrievalInspector.summaryFailed", {
                                count: String(candidate.failed_count)
                              })}
                            </ConsoleOutlineBadge>
                          ) : null}
                          {candidate.empty_count > 0 ? (
                            <ConsoleOutlineBadge>
                              {t("workspace.retrievalInspector.summaryEmpty", {
                                count: String(candidate.empty_count)
                              })}
                            </ConsoleOutlineBadge>
                          ) : null}
                        </div>
                        {candidate.recommendation_reason ? (
                          <div className="mt-3 text-sm leading-6 text-slate-600">{candidate.recommendation_reason}</div>
                        ) : null}
                        <div className="mt-3 flex flex-wrap gap-2">
                          {tenantId && knowledgeBaseId ? (
                            <Button asChild className="bg-white" size="sm" variant="outline">
                              <Link
                                href={buildAdminHref({
                                  tenantId,
                                  section: "directory",
                                  knowledgeBaseId,
                                  managementPanel: "knowledge-base-edit",
                                })}
                              >
                                {t("workspace.retrievalInspector.openKnowledgeBaseGovernance")}
                              </Link>
                            </Button>
                          ) : null}
                          <Button asChild className="bg-white" size="sm" variant="outline">
                            <Link
                              href={
                                candidate.retrieval_profile_id
                                  ? buildSettingsHref({
                                      runtimeResource: "retrieval_profile",
                                      retrievalProfileId: candidate.retrieval_profile_id,
                                    })
                                  : buildSettingsHref({
                                      runtimeResource: "retrieval_profile",
                                    })
                              }
                            >
                              {t("workspace.retrievalInspector.openRetrievalGovernance")}
                            </Link>
                          </Button>
                        </div>
                        {candidate.latest_source_documents.length > 0 ? (
                          <div className="mt-3 space-y-2">
                            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                              {t("workspace.retrievalInspector.sourceDocumentsTitle")}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {candidate.latest_source_documents.map((document) => (
                                <Button
                                  className="bg-white"
                                  key={`${candidate.query_text}-${document.document_id}`}
                                  onClick={() => void onOpenDocument(document.document_id)}
                                  size="sm"
                                  type="button"
                                  variant="outline"
                                >
                                  {t("workspace.retrievalInspector.openSourceDocument", {
                                    title: document.document_title
                                  })}
                                </Button>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Button
                            className="bg-white"
                            onClick={() => {
                              setQueryText(candidate.query_text);
                              void handleRunRetrieval(candidate.query_text);
                            }}
                            size="sm"
                            type="button"
                            variant="outline"
                          >
                            {t("workspace.retrievalInspector.inspectAgain")}
                          </Button>
                          <Button
                            className="bg-white"
                            onClick={() => {
                              setQueryText(candidate.query_text);
                              void handleCompareRetrieval(candidate.query_text);
                            }}
                            size="sm"
                            type="button"
                            variant="outline"
                          >
                            {t("workspace.retrievalInspector.compareAgain")}
                          </Button>
                          <Button onClick={() => void onOpenChatWithQuery(candidate.query_text)} size="sm" type="button">
                            {t("workspace.retrievalInspector.openChat")}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 rounded-[16px] border border-dashed border-slate-200 bg-white px-4 py-4 text-sm text-slate-500">
                    {t("workspace.retrievalInspector.tuningCandidatesEmpty")}
                  </div>
                )}
              </>
            ) : (
              <div className="mt-4 rounded-[16px] border border-dashed border-slate-200 bg-white px-4 py-4 text-sm text-slate-500">
                {t("workspace.retrievalInspector.tuningCandidatesEmpty")}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {!isScopeReady ? (
            <div className="rounded-[20px] border border-dashed border-slate-200 bg-slate-50/70 px-5 py-10 text-sm text-slate-500">
              {t("workspace.retrievalInspector.scopeRequired")}
            </div>
          ) : comparisonResponse ? (
            <div className="grid gap-4 xl:grid-cols-2">
              {renderEngineDiagnosticsCard(comparisonResponse.baseline, "baseline")}
              {renderEngineDiagnosticsCard(comparisonResponse.candidate, "candidate")}
            </div>
          ) : response?.results.length ? (
            response.results.map((result, index) => (
              <div className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-5" key={result.document_chunk_id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-base font-semibold text-slate-950">{result.document_title}</div>
                    <div className="mt-1 text-sm text-slate-500">
                      {t("workspace.retrievalInspector.chunkLabel", { index: String(result.chunk_index) })}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge className={cn("border", getMethodBadgeClassName(result.retrieval_method))} variant="outline">
                      {t("workspace.retrievalInspector.sourceRank", { rank: String(index + 1) })}
                    </Badge>
                    <Badge className="border-slate-200 bg-white text-slate-700" variant="outline">
                      {t("workspace.retrievalInspector.score", {
                        score: formatNumericValue(result.score) ?? "0.000"
                      })}
                    </Badge>
                  </div>
                </div>

                <div className="mt-4 text-sm leading-7 text-slate-700">{formatContentPreview(result.content)}</div>

                <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
                  {hasNumericValue(result.vector_score) ? (
                    <ConsoleOutlineBadge>
                      {t("workspace.retrievalInspector.vectorScore", {
                        score: formatNumericValue(result.vector_score) ?? "0.000"
                      })}
                    </ConsoleOutlineBadge>
                  ) : null}
                  {hasNumericValue(result.lexical_score) ? (
                    <ConsoleOutlineBadge>
                      {t("workspace.retrievalInspector.lexicalScore", {
                        score: formatNumericValue(result.lexical_score) ?? "0.000"
                      })}
                    </ConsoleOutlineBadge>
                  ) : null}
                  {hasNumericValue(result.lexical_normalized_score) ? (
                    <ConsoleOutlineBadge>
                      {t("workspace.retrievalInspector.lexicalNormalizedScore", {
                        score: formatNumericValue(result.lexical_normalized_score) ?? "0.000"
                      })}
                    </ConsoleOutlineBadge>
                  ) : null}
                  {result.token_count !== null ? (
                    <ConsoleOutlineBadge>
                      {t("workspace.retrievalInspector.tokenCount", { count: String(result.token_count) })}
                    </ConsoleOutlineBadge>
                  ) : null}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    className="bg-white"
                    onClick={() => void onOpenDocument(result.document_id)}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    {t("workspace.retrievalInspector.openDocument")}
                  </Button>
                  <Button onClick={() => void onOpenChatWithQuery(normalizedQuery)} size="sm" type="button">
                    {t("workspace.retrievalInspector.askWithThisQuery")}
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-[20px] border border-dashed border-slate-200 bg-slate-50/70 px-5 py-10 text-sm text-slate-500">
              {response ? t("workspace.retrievalInspector.noResults") : t("workspace.retrievalInspector.waiting")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
