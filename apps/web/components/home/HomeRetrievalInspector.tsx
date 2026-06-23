"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Search, Sparkles } from "lucide-react";

import { ConsoleOutlineBadge, ConsoleSurface, ConsoleSurfaceHeader } from "@/components/console/ConsolePrimitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  compareRetrieval,
  inspectRetrieval,
  type RetrievalComparisonResponse,
  type RetrievalEngineDiagnostics,
  type RetrievalInspectorResponse
} from "@/lib/retrieval-inspector";
import { useI18n } from "@/lib/i18n/provider";
import { buildHomeWorkspaceHref } from "@/lib/workspace-handoffs";
import { cn } from "@/lib/utils";
import type { RetrievalValidationSummary } from "@/components/workspace/workspace-types";

type HomeRetrievalInspectorProps = {
  tenantId: string | null;
  workspaceId: string | null;
  knowledgeBaseId: string | null;
  onValidationSummaryChange?: (summary: RetrievalValidationSummary | null) => void;
};

function hasNumericValue(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value);
}

function formatNumericValue(value: number | null | undefined) {
  if (!hasNumericValue(value)) {
    return null;
  }

  const numericValue = Number(value);
  return numericValue.toFixed(3);
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

export function HomeRetrievalInspector({
  tenantId,
  workspaceId,
  knowledgeBaseId,
  onValidationSummaryChange
}: HomeRetrievalInspectorProps) {
  const { t } = useI18n();
  const [queryText, setQueryText] = useState("");
  const [topK, setTopK] = useState("5");
  const [response, setResponse] = useState<RetrievalInspectorResponse | null>(null);
  const [comparisonResponse, setComparisonResponse] = useState<RetrievalComparisonResponse | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isComparing, setIsComparing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState(t("home.retrievalInspector.statusIdle"));

  const isScopeReady = Boolean(tenantId && workspaceId && knowledgeBaseId);
  const normalizedQuery = queryText.trim();
  const canRun = isScopeReady && normalizedQuery.length > 0;
  const validationSummary = useMemo<RetrievalValidationSummary | null>(() => {
    if (response) {
      return {
        mode: "inspect",
        status: response.results.length > 0 ? "ready" : "empty",
        queryText: normalizedQuery,
        detail:
          response.results.length > 0
            ? t("home.retrievalInspector.validationReady", {
                count: String(response.results.length)
              })
            : t("home.retrievalInspector.validationEmpty"),
        engineName: response.engine_name,
        candidateEngineName: null,
        retrievalProfileName: response.retrieval_profile_name,
        resultCount: response.results.length,
        updatedAt: new Date().toISOString()
      };
    }

    if (comparisonResponse) {
      return {
        mode: "compare",
        status:
          comparisonResponse.summary.recommendation_status === "aligned"
            ? "ready"
            : comparisonResponse.summary.recommendation_status === "review"
              ? "review"
              : "hold",
        queryText: normalizedQuery,
        detail: comparisonResponse.summary.recommendation_reason,
        engineName: comparisonResponse.baseline.engine_name,
        candidateEngineName: comparisonResponse.candidate.engine_name,
        retrievalProfileName:
          comparisonResponse.baseline.retrieval_profile_name ??
          comparisonResponse.candidate.retrieval_profile_name,
        resultCount: comparisonResponse.summary.shared_result_count,
        updatedAt: new Date().toISOString()
      };
    }

    return null;
  }, [comparisonResponse, normalizedQuery, response, t]);

  const validationBlocksGroundedChat =
    validationSummary?.status === "hold" ||
    validationSummary?.status === "empty" ||
    validationSummary?.status === "failed";

  const chatHref = useMemo(
    () =>
      buildHomeWorkspaceHref({
        view: validationBlocksGroundedChat ? "documents" : "chat",
        tenantId,
        workspaceId,
        knowledgeBaseId,
        handoffIntent: "grounded_validation",
        draftQuestion: normalizedQuery || null
      }),
    [knowledgeBaseId, normalizedQuery, tenantId, validationBlocksGroundedChat, workspaceId]
  );

  useEffect(() => {
    onValidationSummaryChange?.(validationSummary);
  }, [onValidationSummaryChange, validationSummary]);

  async function handleRunRetrieval() {
    if (!tenantId || !knowledgeBaseId || !workspaceId || !normalizedQuery) {
      return;
    }

    try {
      setIsRunning(true);
      setErrorMessage(null);
      setStatusMessage(t("home.retrievalInspector.statusRunning"));
      const nextResponse = await inspectRetrieval({
        tenant_id: tenantId,
        knowledge_base_id: knowledgeBaseId,
        query_text: normalizedQuery,
        top_k: Number(topK)
      });
      setResponse(nextResponse);
      setComparisonResponse(null);
      setStatusMessage(
        nextResponse.results.length > 0
          ? t("home.retrievalInspector.statusLoaded", { count: String(nextResponse.results.length) })
          : t("home.retrievalInspector.statusEmpty")
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("home.retrievalInspector.statusFailed"));
      setStatusMessage(t("home.retrievalInspector.statusFailed"));
    } finally {
      setIsRunning(false);
    }
  }

  async function handleCompareRetrieval() {
    if (!tenantId || !knowledgeBaseId || !workspaceId || !normalizedQuery) {
      return;
    }

    try {
      setIsComparing(true);
      setErrorMessage(null);
      setStatusMessage(t("home.retrievalInspector.compareStatusRunning"));
      const nextResponse = await compareRetrieval({
        tenant_id: tenantId,
        knowledge_base_id: knowledgeBaseId,
        query_text: normalizedQuery,
        top_k: Number(topK)
      });
      setComparisonResponse(nextResponse);
      setResponse(null);
      setStatusMessage(
        t("home.retrievalInspector.compareStatusLoaded", {
          shared: String(nextResponse.summary.shared_result_count)
        })
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("home.retrievalInspector.statusFailed"));
      setStatusMessage(t("home.retrievalInspector.statusFailed"));
    } finally {
      setIsComparing(false);
    }
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
                ? t("home.retrievalInspector.baselineEngine")
                : t("home.retrievalInspector.candidateEngine")}
            </div>
            <div className="mt-1 text-sm text-slate-500">{diagnostics.engine_name}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <ConsoleOutlineBadge>
              {t("home.retrievalInspector.resultCount", { count: String(diagnostics.result_count) })}
            </ConsoleOutlineBadge>
            <ConsoleOutlineBadge>
              {t("home.retrievalInspector.effectiveTopK", { value: String(diagnostics.effective_top_k) })}
            </ConsoleOutlineBadge>
          </div>
        </div>
        <div className="mt-4 space-y-3">
          {topResults.map((result, index) => (
            <div className="rounded-[16px] border border-slate-200 bg-white px-4 py-4" key={`${diagnostics.engine_name}-${result.document_chunk_id}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-950">{result.document_title}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {t("home.retrievalInspector.chunkLabel", { index: String(result.chunk_index) })}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge className={cn("border", getMethodBadgeClassName(result.retrieval_method))} variant="outline">
                    {t("home.retrievalInspector.sourceRank", { rank: String(index + 1) })}
                  </Badge>
                  <Badge className="border-slate-200 bg-slate-50 text-slate-700" variant="outline">
                    {t("home.retrievalInspector.score", { score: formatNumericValue(result.score) ?? "0.000" })}
                  </Badge>
                </div>
              </div>
              <div className="mt-3 text-sm leading-7 text-slate-700">{formatContentPreview(result.content)}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <ConsoleSurface>
      <ConsoleSurfaceHeader
        action={
          comparisonResponse ? (
            <ConsoleOutlineBadge>
              {t("home.retrievalInspector.compareResultCount", {
                baseline: String(comparisonResponse.baseline.result_count),
                candidate: String(comparisonResponse.candidate.result_count)
              })}
            </ConsoleOutlineBadge>
          ) : response ? (
            <ConsoleOutlineBadge>
              {t("home.retrievalInspector.resultCount", { count: String(response.results.length) })}
            </ConsoleOutlineBadge>
          ) : null
        }
        description={t("home.retrievalInspector.description")}
        title={t("home.retrievalInspector.title")}
      />
      <div className="grid gap-6 p-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-4">
          <div className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-blue-600 shadow-sm">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-950">{t("home.retrievalInspector.queryTitle")}</div>
                <div className="mt-1 text-sm text-slate-500">{t("home.retrievalInspector.queryDescription")}</div>
              </div>
            </div>
            <div className="mt-5 space-y-4">
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  {t("home.retrievalInspector.queryLabel")}
                </div>
                <Input
                  className="bg-white"
                  disabled={!isScopeReady || isRunning}
                  onChange={(event) => setQueryText(event.target.value)}
                  placeholder={t("home.retrievalInspector.queryPlaceholder")}
                  value={queryText}
                />
              </div>
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  {t("home.retrievalInspector.topKLabel")}
                </div>
                <Select disabled={!isScopeReady || isRunning} onValueChange={setTopK} value={topK}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder={t("home.retrievalInspector.topKLabel")} />
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
                  {isRunning ? t("home.retrievalInspector.running") : t("home.retrievalInspector.run")}
                </Button>
                <Button
                  className="bg-white"
                  disabled={!canRun || isRunning || isComparing}
                  onClick={() => void handleCompareRetrieval()}
                  type="button"
                  variant="outline"
                >
                  {isComparing ? t("home.retrievalInspector.comparing") : t("home.retrievalInspector.compare")}
                </Button>
                <Button asChild className="bg-white" disabled={!canRun} type="button" variant="outline">
                  <Link href={chatHref}>
                    {validationBlocksGroundedChat
                      ? t("home.retrievalInspector.reviewEvidence")
                      : t("home.retrievalInspector.openChat")}
                  </Link>
                </Button>
              </div>
            </div>
          </div>

          <div className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-5">
            <div className="text-sm font-semibold text-slate-950">{t("home.retrievalInspector.statusTitle")}</div>
            <div className="mt-3 text-sm leading-6 text-slate-500">
              {!isScopeReady ? t("home.retrievalInspector.scopeRequired") : statusMessage}
            </div>
            {response ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {response.retrieval_profile_name ? (
                  <ConsoleOutlineBadge>
                    {t("home.retrievalInspector.retrievalProfile", { value: response.retrieval_profile_name })}
                  </ConsoleOutlineBadge>
                ) : null}
                <ConsoleOutlineBadge>
                  {t("home.retrievalInspector.engineLabel", { value: response.engine_name })}
                </ConsoleOutlineBadge>
                {response.retrieval_profile_source ? (
                  <ConsoleOutlineBadge>
                    {t("home.retrievalInspector.profileSource", { value: response.retrieval_profile_source })}
                  </ConsoleOutlineBadge>
                ) : null}
                <ConsoleOutlineBadge>
                  {t("home.retrievalInspector.retrievalMode", { value: response.retrieval_mode })}
                </ConsoleOutlineBadge>
                <ConsoleOutlineBadge>
                  {t("home.retrievalInspector.effectiveTopK", { value: String(response.effective_top_k) })}
                </ConsoleOutlineBadge>
                <ConsoleOutlineBadge>
                  {t("home.retrievalInspector.embeddingModel", { value: response.embedding_model })}
                </ConsoleOutlineBadge>
              </div>
            ) : comparisonResponse ? (
              <>
                <div className="mt-4 flex flex-wrap gap-2">
                  <ConsoleOutlineBadge>
                    {t("home.retrievalInspector.compareShared", {
                      count: String(comparisonResponse.summary.shared_result_count)
                    })}
                  </ConsoleOutlineBadge>
                  <ConsoleOutlineBadge>
                    {t("home.retrievalInspector.compareBaselineOnly", {
                      count: String(comparisonResponse.summary.baseline_only_count)
                    })}
                  </ConsoleOutlineBadge>
                  <ConsoleOutlineBadge>
                    {t("home.retrievalInspector.compareCandidateOnly", {
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
                      ? t("home.retrievalInspector.recommendationAligned")
                      : comparisonResponse.summary.recommendation_status === "review"
                        ? t("home.retrievalInspector.recommendationReview")
                        : t("home.retrievalInspector.recommendationHold")}
                  </Badge>
                  <Badge
                    className={cn(
                      "border",
                      validationSummary?.status === "ready"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : validationSummary?.status === "review"
                          ? "border-blue-200 bg-blue-50 text-blue-700"
                          : "border-amber-200 bg-amber-50 text-amber-800"
                    )}
                    variant="outline"
                  >
                    {validationSummary
                      ? t(`workspace.chatView.validationStatuses.${validationSummary.status}`)
                      : t("workspace.chatView.validationStatuses.pending")}
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
        </div>

        <div className="space-y-4">
          {!isScopeReady ? (
            <div className="rounded-[20px] border border-dashed border-slate-200 bg-slate-50/70 px-5 py-10 text-sm text-slate-500">
              {t("home.retrievalInspector.scopeRequired")}
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
                      {t("home.retrievalInspector.chunkLabel", { index: String(result.chunk_index) })}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge className={cn("border", getMethodBadgeClassName(result.retrieval_method))} variant="outline">
                      {t("home.retrievalInspector.sourceRank", { rank: String(index + 1) })}
                    </Badge>
                    <Badge className="border-slate-200 bg-white text-slate-700" variant="outline">
                      {t("home.retrievalInspector.score", {
                        score: formatNumericValue(result.score) ?? "0.000"
                      })}
                    </Badge>
                  </div>
                </div>

                <div className="mt-4 text-sm leading-7 text-slate-700">{formatContentPreview(result.content)}</div>

                <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
                  {hasNumericValue(result.vector_score) ? (
                    <ConsoleOutlineBadge>
                      {t("home.retrievalInspector.vectorScore", {
                        score: formatNumericValue(result.vector_score) ?? "0.000"
                      })}
                    </ConsoleOutlineBadge>
                  ) : null}
                  {hasNumericValue(result.lexical_score) ? (
                    <ConsoleOutlineBadge>
                      {t("home.retrievalInspector.lexicalScore", {
                        score: formatNumericValue(result.lexical_score) ?? "0.000"
                      })}
                    </ConsoleOutlineBadge>
                  ) : null}
                  {hasNumericValue(result.lexical_normalized_score) ? (
                    <ConsoleOutlineBadge>
                      {t("home.retrievalInspector.lexicalNormalizedScore", {
                        score: formatNumericValue(result.lexical_normalized_score) ?? "0.000"
                      })}
                    </ConsoleOutlineBadge>
                  ) : null}
                  {result.token_count !== null ? (
                    <ConsoleOutlineBadge>
                      {t("home.retrievalInspector.tokenCount", { count: String(result.token_count) })}
                    </ConsoleOutlineBadge>
                  ) : null}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button asChild className="bg-white" size="sm" type="button" variant="outline">
                    <Link
                      href={buildHomeWorkspaceHref({
                        view: "documents",
                        tenantId,
                        workspaceId,
                        knowledgeBaseId,
                        documentId: result.document_id
                      })}
                    >
                      {t("home.retrievalInspector.openDocument")}
                    </Link>
                  </Button>
                  <Button asChild size="sm" type="button">
                    <Link
                      href={buildHomeWorkspaceHref({
                        view: "chat",
                        tenantId,
                        workspaceId,
                        knowledgeBaseId,
                        draftQuestion: normalizedQuery || null
                      })}
                    >
                      {t("home.retrievalInspector.askWithThisQuery")}
                    </Link>
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-[20px] border border-dashed border-slate-200 bg-slate-50/70 px-5 py-10 text-sm text-slate-500">
              {response ? t("home.retrievalInspector.noResults") : t("home.retrievalInspector.waiting")}
            </div>
          )}
        </div>
      </div>
    </ConsoleSurface>
  );
}
