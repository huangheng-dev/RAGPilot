"use client";

import { readApiErrorMessage } from "@/lib/api-errors";
import { buildSessionActorHeaders } from "@/lib/local-session";

export type RetrievalInspectorResult = {
  document_chunk_id: string;
  document_id: string;
  document_version_id: string;
  knowledge_base_id: string;
  document_title: string;
  chunk_index: number;
  content: string;
  token_count: number | null;
  score: number;
  vector_score: number | null;
  lexical_score: number | null;
  lexical_normalized_score: number | null;
  embedding_model: string | null;
  retrieval_method: string;
  metadata_json: Record<string, unknown>;
  created_at: string;
};

export type RetrievalInspectorResponse = {
  tenant_id: string;
  knowledge_base_id: string;
  query_text: string;
  engine_name: string;
  retrieval_profile_id: string | null;
  retrieval_profile_name: string | null;
  retrieval_profile_source: string | null;
  retrieval_mode: string;
  embedding_model: string;
  effective_top_k: number;
  results: RetrievalInspectorResult[];
};

export type RetrievalEngineDiagnostics = {
  engine_name: string;
  retrieval_profile_id: string | null;
  retrieval_profile_name: string | null;
  retrieval_profile_source: string | null;
  retrieval_mode: string;
  embedding_model: string;
  effective_top_k: number;
  result_count: number;
  retrieval_method_breakdown: Record<string, number>;
  top_result_chunk_id: string | null;
  top_result_document_title: string | null;
  results: RetrievalInspectorResult[];
};

export type RetrievalComparisonSummary = {
  shared_chunk_ids: string[];
  baseline_only_chunk_ids: string[];
  candidate_only_chunk_ids: string[];
  shared_result_count: number;
  baseline_only_count: number;
  candidate_only_count: number;
  top_result_matches: boolean;
  recommendation_status: "aligned" | "review" | "hold";
  recommendation_reason: string;
};

export type RetrievalComparisonResponse = {
  tenant_id: string;
  knowledge_base_id: string;
  query_text: string;
  baseline: RetrievalEngineDiagnostics;
  candidate: RetrievalEngineDiagnostics;
  summary: RetrievalComparisonSummary;
};

export type RetrievalEvaluationMode = "inspect" | "compare";
export type RetrievalEvaluationValidationStatus = "ready" | "review" | "hold" | "empty" | "failed";

export type RetrievalEvaluationRecord = {
  id: string;
  tenant_id: string;
  workspace_id: string;
  knowledge_base_id: string;
  evaluation_mode: RetrievalEvaluationMode;
  validation_status: RetrievalEvaluationValidationStatus;
  query_text: string;
  baseline_engine_name: string;
  candidate_engine_name: string | null;
  retrieval_profile_name: string | null;
  retrieval_profile_source: string | null;
  result_count: number;
  shared_result_count: number | null;
  baseline_only_count: number | null;
  candidate_only_count: number | null;
  top_result_matches: boolean | null;
  recommendation_reason: string | null;
  evaluation_payload_json: Record<string, unknown>;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
};

export type RetrievalEvaluationStatusBreakdown = {
  ready: number;
  review: number;
  hold: number;
  empty: number;
  failed: number;
};

export type RetrievalEvaluationTuningCandidate = {
  query_text: string;
  evaluation_count: number;
  latest_evaluation_mode: RetrievalEvaluationMode;
  latest_validation_status: RetrievalEvaluationValidationStatus;
  ready_count: number;
  review_count: number;
  hold_count: number;
  empty_count: number;
  failed_count: number;
  attention_score: number;
  baseline_engine_name: string;
  candidate_engine_name: string | null;
  retrieval_profile_id: string | null;
  retrieval_profile_name: string | null;
  retrieval_profile_source: string | null;
  recommendation_reason: string | null;
  result_count: number;
  shared_result_count: number | null;
  baseline_only_count: number | null;
  candidate_only_count: number | null;
  top_result_matches: boolean | null;
  latest_source_documents: Array<{
    document_id: string;
    document_title: string;
    hit_count: number;
  }>;
  last_evaluated_at: string;
};

export type RetrievalEvaluationSummary = {
  tenant_id: string;
  workspace_id: string;
  knowledge_base_id: string | null;
  total_evaluations: number;
  total_queries: number;
  status_breakdown: RetrievalEvaluationStatusBreakdown;
  candidates: RetrievalEvaluationTuningCandidate[];
};

function buildApiBaseUrl() {
  const configuredBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  const fallbackBaseUrl = "http://127.0.0.1:18000";
  const baseUrl = configuredBaseUrl && configuredBaseUrl.length > 0 ? configuredBaseUrl : fallbackBaseUrl;
  return baseUrl.endsWith("/api/v1") ? baseUrl : `${baseUrl}/api/v1`;
}

const apiBaseUrl = buildApiBaseUrl();

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...buildSessionActorHeaders(init?.headers)
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response));
  }

  return (await response.json()) as T;
}

export async function inspectRetrieval(payload: {
  tenant_id: string;
  knowledge_base_id: string;
  query_text: string;
  top_k: number;
}) {
  return await apiRequest<RetrievalInspectorResponse>("/retrieve", {
    method: "POST",
    body: JSON.stringify({
      tenant_id: payload.tenant_id,
      knowledge_base_id: payload.knowledge_base_id,
      query_text: payload.query_text.trim(),
      top_k: payload.top_k
    })
  });
}

export async function compareRetrieval(payload: {
  tenant_id: string;
  knowledge_base_id: string;
  query_text: string;
  top_k: number;
  baseline_engine?: string;
  candidate_engine?: string;
}) {
  return await apiRequest<RetrievalComparisonResponse>("/retrieve/compare", {
    method: "POST",
    body: JSON.stringify({
      tenant_id: payload.tenant_id,
      knowledge_base_id: payload.knowledge_base_id,
      query_text: payload.query_text.trim(),
      top_k: payload.top_k,
      baseline_engine: payload.baseline_engine ?? "native",
      candidate_engine: payload.candidate_engine ?? "llamaindex_pilot"
    })
  });
}

export async function recordRetrievalEvaluation(payload: {
  tenant_id: string;
  workspace_id: string;
  knowledge_base_id: string;
  evaluation_mode: RetrievalEvaluationMode;
  validation_status: RetrievalEvaluationValidationStatus;
  query_text: string;
  baseline_engine_name: string;
  candidate_engine_name?: string | null;
  retrieval_profile_name?: string | null;
  retrieval_profile_source?: string | null;
  result_count: number;
  shared_result_count?: number | null;
  baseline_only_count?: number | null;
  candidate_only_count?: number | null;
  top_result_matches?: boolean | null;
  recommendation_reason?: string | null;
  evaluation_payload_json: Record<string, unknown>;
}) {
  return await apiRequest<RetrievalEvaluationRecord>("/retrieve/evaluations", {
    method: "POST",
    body: JSON.stringify({
      tenant_id: payload.tenant_id,
      workspace_id: payload.workspace_id,
      knowledge_base_id: payload.knowledge_base_id,
      evaluation_mode: payload.evaluation_mode,
      validation_status: payload.validation_status,
      query_text: payload.query_text.trim(),
      baseline_engine_name: payload.baseline_engine_name,
      candidate_engine_name: payload.candidate_engine_name ?? null,
      retrieval_profile_name: payload.retrieval_profile_name ?? null,
      retrieval_profile_source: payload.retrieval_profile_source ?? null,
      result_count: payload.result_count,
      shared_result_count: payload.shared_result_count ?? null,
      baseline_only_count: payload.baseline_only_count ?? null,
      candidate_only_count: payload.candidate_only_count ?? null,
      top_result_matches: payload.top_result_matches ?? null,
      recommendation_reason: payload.recommendation_reason ?? null,
      evaluation_payload_json: payload.evaluation_payload_json,
    })
  });
}

export async function listRetrievalEvaluations(payload: {
  tenant_id: string;
  workspace_id: string;
  knowledge_base_id?: string | null;
  limit?: number;
}) {
  const searchParams = new URLSearchParams({
    tenant_id: payload.tenant_id,
    workspace_id: payload.workspace_id,
    limit: String(payload.limit ?? 6),
  });
  if (payload.knowledge_base_id) {
    searchParams.set("knowledge_base_id", payload.knowledge_base_id);
  }

  return await apiRequest<RetrievalEvaluationRecord[]>(`/retrieve/evaluations?${searchParams.toString()}`);
}

export async function summarizeRetrievalEvaluations(payload: {
  tenant_id: string;
  workspace_id: string;
  knowledge_base_id?: string | null;
  limit?: number;
  sample_size?: number;
}) {
  const searchParams = new URLSearchParams({
    tenant_id: payload.tenant_id,
    workspace_id: payload.workspace_id,
    limit: String(payload.limit ?? 5),
    sample_size: String(payload.sample_size ?? 120),
  });
  if (payload.knowledge_base_id) {
    searchParams.set("knowledge_base_id", payload.knowledge_base_id);
  }

  return await apiRequest<RetrievalEvaluationSummary>(`/retrieve/evaluations/summary?${searchParams.toString()}`);
}
