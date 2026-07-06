"use client";

import { authenticatedApiRequest } from "@/lib/authenticated-api";

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
export type RetrievalEvaluationFollowUpStatus = "pending" | "resolved";
export type RetrievalEvaluationFollowUpAction = {
  action_key:
    | "review_knowledge_base_governance"
    | "review_retrieval_profile_governance"
    | "rerun_retrieval_inspection"
    | "rerun_retrieval_comparison"
    | "validate_in_chat";
  action_category: "governance" | "analysis" | "validation";
  action_label: string;
  action_reason: string;
};

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
  retrieval_profile_id: string | null;
  retrieval_profile_name: string | null;
  retrieval_profile_source: string | null;
  result_count: number;
  shared_result_count: number | null;
  baseline_only_count: number | null;
  candidate_only_count: number | null;
  top_result_matches: boolean | null;
  recommendation_reason: string | null;
  evaluation_payload_json: Record<string, unknown>;
  follow_up_status: RetrievalEvaluationFollowUpStatus;
  resolved_at: string | null;
  resolved_by_user_id: string | null;
  source_documents: Array<{
    document_id: string;
    document_title: string;
    hit_count: number;
  }>;
  recommended_actions: RetrievalEvaluationFollowUpAction[];
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

export type RetrievalEvaluationFollowUpBreakdown = {
  pending: number;
  resolved: number;
};

export type RetrievalEvaluationTuningCandidate = {
  recommended_actions: Array<{
    action_key:
      | "review_knowledge_base_governance"
      | "review_retrieval_profile_governance"
      | "rerun_retrieval_inspection"
      | "rerun_retrieval_comparison"
      | "validate_in_chat";
    action_category: "governance" | "analysis" | "validation";
    action_label: string;
    action_reason: string;
  }>;
  query_text: string;
  evaluation_count: number;
  latest_evaluation_mode: RetrievalEvaluationMode;
  latest_validation_status: RetrievalEvaluationValidationStatus;
  follow_up_status: RetrievalEvaluationFollowUpStatus;
  ready_count: number;
  review_count: number;
  hold_count: number;
  empty_count: number;
  failed_count: number;
  pending_evaluation_count: number;
  resolved_evaluation_count: number;
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
  intelligence_status: "stable" | "review" | "hold";
  intelligence_reason: string;
  primary_query_text: string | null;
  primary_baseline_engine_name: string | null;
  primary_candidate_engine_name: string | null;
  primary_retrieval_profile_name: string | null;
  status_breakdown: RetrievalEvaluationStatusBreakdown;
  follow_up_breakdown: RetrievalEvaluationFollowUpBreakdown;
  primary_recommended_actions: RetrievalEvaluationFollowUpAction[];
  candidates: RetrievalEvaluationTuningCandidate[];
  recent_evaluations: RetrievalEvaluationRecord[];
};

export type RetrievalEvaluationQueryFollowUpUpdate = {
  tenant_id: string;
  workspace_id: string;
  knowledge_base_id: string | null;
  query_text: string;
  follow_up_status: RetrievalEvaluationFollowUpStatus;
  updated_count: number;
  acted_at: string;
  acted_by_user_id: string | null;
};

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  return await authenticatedApiRequest<T>(path, init);
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
  evaluation_mode?: RetrievalEvaluationMode | null;
  validation_status?: RetrievalEvaluationValidationStatus | null;
  follow_up_status?: RetrievalEvaluationFollowUpStatus | null;
  query?: string | null;
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
  if (payload.evaluation_mode) {
    searchParams.set("evaluation_mode", payload.evaluation_mode);
  }
  if (payload.validation_status) {
    searchParams.set("validation_status", payload.validation_status);
  }
  if (payload.follow_up_status) {
    searchParams.set("follow_up_status", payload.follow_up_status);
  }
  if (payload.query?.trim()) {
    searchParams.set("query", payload.query.trim());
  }

  return await apiRequest<RetrievalEvaluationRecord[]>(`/retrieve/evaluations?${searchParams.toString()}`);
}

export async function summarizeRetrievalEvaluations(payload: {
  tenant_id: string;
  workspace_id: string;
  knowledge_base_id?: string | null;
  evaluation_mode?: RetrievalEvaluationMode | null;
  validation_status?: RetrievalEvaluationValidationStatus | null;
  follow_up_status?: RetrievalEvaluationFollowUpStatus | null;
  query?: string | null;
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
  if (payload.evaluation_mode) {
    searchParams.set("evaluation_mode", payload.evaluation_mode);
  }
  if (payload.validation_status) {
    searchParams.set("validation_status", payload.validation_status);
  }
  if (payload.follow_up_status) {
    searchParams.set("follow_up_status", payload.follow_up_status);
  }
  if (payload.query?.trim()) {
    searchParams.set("query", payload.query.trim());
  }

  return await apiRequest<RetrievalEvaluationSummary>(`/retrieve/evaluations/summary?${searchParams.toString()}`);
}

export async function updateRetrievalEvaluationFollowUpStatus(payload: {
  retrieval_evaluation_id: string;
  follow_up_status: RetrievalEvaluationFollowUpStatus;
}) {
  return await apiRequest<RetrievalEvaluationRecord>(`/retrieve/evaluations/${payload.retrieval_evaluation_id}/follow-up`, {
    method: "PATCH",
    body: JSON.stringify({
      follow_up_status: payload.follow_up_status,
    })
  });
}

export async function updateRetrievalQueryFollowUpStatus(payload: {
  tenant_id: string;
  workspace_id: string;
  knowledge_base_id?: string | null;
  query_text: string;
  follow_up_status: RetrievalEvaluationFollowUpStatus;
}) {
  return await apiRequest<RetrievalEvaluationQueryFollowUpUpdate>("/retrieve/evaluations/follow-up/query", {
    method: "PATCH",
    body: JSON.stringify({
      tenant_id: payload.tenant_id,
      workspace_id: payload.workspace_id,
      knowledge_base_id: payload.knowledge_base_id ?? null,
      query_text: payload.query_text.trim(),
      follow_up_status: payload.follow_up_status,
    })
  });
}
