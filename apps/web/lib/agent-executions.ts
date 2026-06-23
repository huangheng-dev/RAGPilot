import { readApiErrorMessage } from "@/lib/api-errors";
import { buildSessionActorHeaders } from "@/lib/local-session";

export type AgentExecutionMode = "grounded_chat" | "document_intake" | "workflow_recovery";
export type AgentExecutionStatus = "queued" | "running" | "completed" | "failed" | "cancelled";
export type AgentExecutionTriggerSource = "agents_console" | "workspace" | "home" | "admin" | "operations";

export type AgentExecutionResponse = {
  id: string;
  tenant_id: string;
  agent_definition_id: string;
  workspace_id: string | null;
  knowledge_base_id: string | null;
  execution_mode: AgentExecutionMode;
  execution_status: AgentExecutionStatus;
  trigger_source: AgentExecutionTriggerSource;
  knowledge_base_scope: string | null;
  model_endpoint_id: string | null;
  tool_registration_ids: string[];
  execution_input: string | null;
  summary: string | null;
  result_payload_json: Record<string, unknown>;
  error_message: string | null;
  launched_by_user_id: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AgentExecutionMetricsResponse = {
  total_executions: number;
  queued_executions: number;
  running_executions: number;
  completed_executions: number;
  failed_executions: number;
  latest_execution_at: string | null;
};

export type CreateAgentExecutionRequest = {
  tenant_id: string;
  agent_definition_id: string;
  execution_input?: string | null;
  trigger_source: AgentExecutionTriggerSource;
};

export type AgentExecutionListFilters = {
  executionMode?: AgentExecutionMode | null;
  executionStatus?: AgentExecutionStatus | null;
};

export const EMPTY_AGENT_EXECUTION_METRICS: AgentExecutionMetricsResponse = {
  total_executions: 0,
  queued_executions: 0,
  running_executions: 0,
  completed_executions: 0,
  failed_executions: 0,
  latest_execution_at: null
};

export type AgentExecutionRetrievalSummary = {
  retrievalEngine: string | null;
  retrievalProfileId: string | null;
  retrievalProfileName: string | null;
  retrievalProfileSource: string | null;
  retrievalMode: string | null;
  effectiveTopK: number | null;
};

export type AgentExecutionEvidenceSource = {
  documentChunkId: string | null;
  documentId: string | null;
  documentVersionId: string | null;
  documentTitle: string | null;
  chunkIndex: number | null;
  retrievalMethod: string | null;
  score: number | null;
};

export type AgentExecutionMethodBreakdown = {
  method: string;
  count: number;
};

export type AgentExecutionRecommendedActionSpec = {
  actionKey: string;
  actionLabel: string | null;
  targetSurface: "workspace" | "settings" | "agents";
  actionCategory: "continue" | "validation" | "recovery" | "governance";
  targetView: "chat" | "documents" | "workflows" | "agents";
  priority: "primary" | "secondary";
  handoffIntent: string | null;
  documentStatus: string | null;
  workflowStatus: string | null;
  modelEndpointId: string | null;
  toolRegistrationId: string | null;
  retrievalProfileId: string | null;
  mcpConnectorId: string | null;
  mcpConnectorSlug: string | null;
};

export type AgentExecutionEvidenceSummary = {
  executionInput: string | null;
  answerPreview: string | null;
  retrievalResultCount: number | null;
  recommendedActions: string[];
  recommendedActionSpecs: AgentExecutionRecommendedActionSpec[];
  retrievalSources: AgentExecutionEvidenceSource[];
  retrievalMethodBreakdown: AgentExecutionMethodBreakdown[];
};

export type AgentExecutionRuntimeSummary = {
  agentRuntimeEngine: string | null;
  configuredAgentRuntimeEngine: string | null;
  graphWorkflow: string | null;
  graphTraceCount: number;
  fallbackApplied: boolean;
  fallbackReason: string | null;
  configuredModelEndpointId: string | null;
  configuredModelEndpointName: string | null;
  graphTrace: Array<{
    step: string;
    status: string;
  }>;
};

export type AgentExecutionRuntimeBindingSummary = {
  providerType: string | null;
  modelName: string | null;
  source: string | null;
  modelEndpointId: string | null;
  modelEndpointName: string | null;
  apiBaseUrl: string | null;
};

function buildApiBaseUrl() {
  const configuredBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  const fallbackBaseUrl = "http://127.0.0.1:18000";
  const baseUrl = configuredBaseUrl && configuredBaseUrl.length > 0 ? configuredBaseUrl : fallbackBaseUrl;
  return baseUrl.endsWith("/api/v1") ? baseUrl : `${baseUrl}/api/v1`;
}

const apiBaseUrl = buildApiBaseUrl();

async function agentExecutionApiRequest<T>(path: string, init?: RequestInit): Promise<T> {
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

export async function listAgentExecutions(
  tenantId: string,
  agentDefinitionId?: string | null,
  limit = 8,
  filters?: AgentExecutionListFilters
) {
  const searchParams = new URLSearchParams({
    tenant_id: tenantId,
    limit: String(limit)
  });
  if (agentDefinitionId) {
    searchParams.set("agent_definition_id", agentDefinitionId);
  }
  if (filters?.executionMode) {
    searchParams.set("execution_mode", filters.executionMode);
  }
  if (filters?.executionStatus) {
    searchParams.set("execution_status", filters.executionStatus);
  }

  return await agentExecutionApiRequest<AgentExecutionResponse[]>(`/agents/executions?${searchParams.toString()}`);
}

export async function listAgentExecutionMetrics(
  tenantId: string,
  agentDefinitionId?: string | null,
  filters?: AgentExecutionListFilters
) {
  const searchParams = new URLSearchParams({
    tenant_id: tenantId
  });
  if (agentDefinitionId) {
    searchParams.set("agent_definition_id", agentDefinitionId);
  }
  if (filters?.executionMode) {
    searchParams.set("execution_mode", filters.executionMode);
  }
  if (filters?.executionStatus) {
    searchParams.set("execution_status", filters.executionStatus);
  }

  return await agentExecutionApiRequest<AgentExecutionMetricsResponse>(`/agents/executions/metrics?${searchParams.toString()}`);
}

export async function createAgentExecution(request: CreateAgentExecutionRequest) {
  return await agentExecutionApiRequest<AgentExecutionResponse>("/agents/executions", {
    method: "POST",
    body: JSON.stringify(request)
  });
}

export function readAgentExecutionRetrievalSummary(
  payload: Record<string, unknown> | null | undefined
): AgentExecutionRetrievalSummary | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const retrievalEngine =
    typeof payload.retrieval_engine === "string" && payload.retrieval_engine.trim().length > 0
      ? payload.retrieval_engine.trim()
      : null;
  const retrievalProfileId =
    typeof payload.retrieval_profile_id === "string" && payload.retrieval_profile_id.trim().length > 0
      ? payload.retrieval_profile_id
      : null;
  const retrievalProfileName =
    typeof payload.retrieval_profile_name === "string" && payload.retrieval_profile_name.trim().length > 0
      ? payload.retrieval_profile_name
      : null;
  const retrievalProfileSource =
    typeof payload.retrieval_profile_source === "string" && payload.retrieval_profile_source.trim().length > 0
      ? payload.retrieval_profile_source
      : null;
  const retrievalMode =
    typeof payload.retrieval_mode === "string" && payload.retrieval_mode.trim().length > 0
      ? payload.retrieval_mode
      : null;
  const effectiveTopK =
    typeof payload.retrieval_effective_top_k === "number"
      ? payload.retrieval_effective_top_k
      : typeof payload.retrieval_effective_top_k === "string"
        ? Number.parseInt(payload.retrieval_effective_top_k, 10)
        : null;

  if (
    !retrievalEngine &&
    !retrievalProfileId &&
    !retrievalProfileName &&
    !retrievalProfileSource &&
    !retrievalMode &&
    effectiveTopK === null
  ) {
    return null;
  }

  return {
    retrievalEngine,
    retrievalProfileId,
    retrievalProfileName,
    retrievalProfileSource,
    retrievalMode,
    effectiveTopK: Number.isFinite(effectiveTopK) ? effectiveTopK : null
  };
}

export function readAgentExecutionEvidenceSummary(
  payload: Record<string, unknown> | null | undefined
): AgentExecutionEvidenceSummary | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const executionInput =
    typeof payload.execution_input === "string" && payload.execution_input.trim().length > 0
      ? payload.execution_input.trim()
      : null;
  const answerPreview =
    typeof payload.answer_preview === "string" && payload.answer_preview.trim().length > 0
      ? payload.answer_preview.trim()
      : null;
  const retrievalResultCount =
    typeof payload.retrieval_result_count === "number"
      ? payload.retrieval_result_count
      : typeof payload.retrieval_result_count === "string"
        ? Number.parseInt(payload.retrieval_result_count, 10)
        : null;
  const recommendedActions = Array.isArray(payload.recommended_actions)
    ? payload.recommended_actions.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    : [];
  const recommendedActionSpecs = Array.isArray(payload.recommended_action_specs)
    ? payload.recommended_action_specs
        .filter(
          (value): value is Record<string, unknown> =>
            Boolean(value) && typeof value === "object" && !Array.isArray(value)
        )
        .map((value) => {
          const targetView =
            value.target_view === "chat" ||
            value.target_view === "documents" ||
            value.target_view === "workflows" ||
            value.target_view === "agents"
              ? value.target_view
              : null;
          const targetSurface =
            value.target_surface === "settings" || value.target_surface === "agents" ? value.target_surface : "workspace";
          const actionCategory =
            value.action_category === "validation" ||
            value.action_category === "recovery" ||
            value.action_category === "governance"
              ? value.action_category
              : "continue";
          const priority = value.priority === "primary" ? "primary" : "secondary";

          if (!targetView && targetSurface === "workspace") {
            return null;
          }

          return {
            actionKey:
              typeof value.action_key === "string" && value.action_key.trim().length > 0
                ? value.action_key.trim()
                : "open_execution_surface",
            actionLabel:
              typeof value.action_label === "string" && value.action_label.trim().length > 0
                ? value.action_label.trim()
                : null,
            targetSurface,
            actionCategory,
            targetView: targetView ?? "agents",
            priority,
            handoffIntent:
              typeof value.handoff_intent === "string" && value.handoff_intent.trim().length > 0
                ? value.handoff_intent.trim()
                : null,
            documentStatus:
              typeof value.document_status === "string" && value.document_status.trim().length > 0
                ? value.document_status.trim()
                : null,
            workflowStatus:
              typeof value.workflow_status === "string" && value.workflow_status.trim().length > 0
                ? value.workflow_status.trim()
                : null,
            modelEndpointId:
              typeof value.model_endpoint_id === "string" && value.model_endpoint_id.trim().length > 0
                ? value.model_endpoint_id.trim()
                : null,
            toolRegistrationId:
              typeof value.tool_registration_id === "string" && value.tool_registration_id.trim().length > 0
                ? value.tool_registration_id.trim()
                : null,
            retrievalProfileId:
              typeof value.retrieval_profile_id === "string" && value.retrieval_profile_id.trim().length > 0
                ? value.retrieval_profile_id.trim()
                : null,
            mcpConnectorId:
              typeof value.mcp_connector_id === "string" && value.mcp_connector_id.trim().length > 0
                ? value.mcp_connector_id.trim()
                : null,
            mcpConnectorSlug:
              typeof value.mcp_connector_slug === "string" && value.mcp_connector_slug.trim().length > 0
                ? value.mcp_connector_slug.trim()
                : null,
          } satisfies AgentExecutionRecommendedActionSpec;
        })
        .filter((value): value is AgentExecutionRecommendedActionSpec => value !== null)
    : [];

  const retrievalResults = Array.isArray(payload.retrieval_results)
    ? payload.retrieval_results.filter(
        (value): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value)
      )
    : [];

  const retrievalSources = retrievalResults.slice(0, 3).map((row) => {
    const chunkIndex =
      typeof row.chunk_index === "number"
        ? row.chunk_index
        : typeof row.chunk_index === "string"
          ? Number.parseInt(row.chunk_index, 10)
          : null;
    const score =
      typeof row.score === "number"
        ? row.score
        : typeof row.score === "string"
          ? Number.parseFloat(row.score)
          : null;

    return {
      documentChunkId: typeof row.document_chunk_id === "string" ? row.document_chunk_id : null,
      documentId: typeof row.document_id === "string" ? row.document_id : null,
      documentVersionId: typeof row.document_version_id === "string" ? row.document_version_id : null,
      documentTitle: typeof row.document_title === "string" && row.document_title.trim().length > 0 ? row.document_title.trim() : null,
      chunkIndex: Number.isFinite(chunkIndex) ? chunkIndex : null,
      retrievalMethod:
        typeof row.retrieval_method === "string" && row.retrieval_method.trim().length > 0 ? row.retrieval_method.trim() : null,
      score: Number.isFinite(score) ? score : null
    } satisfies AgentExecutionEvidenceSource;
  });

  const retrievalMethodCounts = retrievalResults.reduce<Map<string, number>>((counts, row) => {
    const method =
      typeof row.retrieval_method === "string" && row.retrieval_method.trim().length > 0 ? row.retrieval_method.trim() : null;
    if (!method) {
      return counts;
    }
    counts.set(method, (counts.get(method) ?? 0) + 1);
    return counts;
  }, new Map<string, number>());

  const retrievalMethodBreakdown = Array.from(retrievalMethodCounts.entries())
    .sort((left, right) => right[1] - left[1])
    .map(([method, count]) => ({ method, count }));

  if (
    !executionInput &&
    !answerPreview &&
    retrievalResultCount === null &&
    recommendedActions.length === 0 &&
    recommendedActionSpecs.length === 0 &&
    retrievalSources.length === 0 &&
    retrievalMethodBreakdown.length === 0
  ) {
    return null;
  }

  return {
    executionInput,
    answerPreview,
    retrievalResultCount: Number.isFinite(retrievalResultCount) ? retrievalResultCount : null,
    recommendedActions,
    recommendedActionSpecs,
    retrievalSources,
    retrievalMethodBreakdown
  };
}

export function readAgentExecutionRuntimeSummary(
  payload: Record<string, unknown> | null | undefined
): AgentExecutionRuntimeSummary | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const agentRuntimeEngine =
    typeof payload.agent_runtime_engine === "string" && payload.agent_runtime_engine.trim().length > 0
      ? payload.agent_runtime_engine.trim()
      : null;
  const configuredAgentRuntimeEngine =
    typeof payload.configured_agent_runtime_engine === "string" &&
    payload.configured_agent_runtime_engine.trim().length > 0
      ? payload.configured_agent_runtime_engine.trim()
      : null;

  const runtimeResolution =
    payload.agent_runtime_resolution &&
    typeof payload.agent_runtime_resolution === "object" &&
    !Array.isArray(payload.agent_runtime_resolution)
      ? (payload.agent_runtime_resolution as Record<string, unknown>)
      : null;

  const graphPayload =
    payload.agent_runtime_graph && typeof payload.agent_runtime_graph === "object" && !Array.isArray(payload.agent_runtime_graph)
      ? (payload.agent_runtime_graph as Record<string, unknown>)
      : null;
  const graphWorkflow =
    graphPayload && typeof graphPayload.workflow === "string" && graphPayload.workflow.trim().length > 0
      ? graphPayload.workflow.trim()
      : null;
  const graphTraceCount =
    graphPayload && Array.isArray(graphPayload.trace)
      ? graphPayload.trace.filter((entry) => Boolean(entry) && typeof entry === "object").length
      : 0;
  const graphTrace =
    graphPayload && Array.isArray(graphPayload.trace)
      ? graphPayload.trace
          .filter(
            (entry): entry is Record<string, unknown> =>
              Boolean(entry) && typeof entry === "object" && !Array.isArray(entry)
          )
          .map((entry) => ({
            step: typeof entry.step === "string" && entry.step.trim().length > 0 ? entry.step.trim() : "step",
            status: typeof entry.status === "string" && entry.status.trim().length > 0 ? entry.status.trim() : "unknown"
          }))
      : [];
  const fallbackApplied =
    runtimeResolution && typeof runtimeResolution.fallback_applied === "boolean"
      ? runtimeResolution.fallback_applied
      : Boolean(configuredAgentRuntimeEngine && agentRuntimeEngine && configuredAgentRuntimeEngine !== agentRuntimeEngine);
  const fallbackReason =
    runtimeResolution && typeof runtimeResolution.fallback_reason === "string" && runtimeResolution.fallback_reason.trim().length > 0
      ? runtimeResolution.fallback_reason.trim()
      : null;
  const configuredModelEndpointId =
    runtimeResolution &&
    typeof runtimeResolution.configured_model_endpoint_id === "string" &&
    runtimeResolution.configured_model_endpoint_id.trim().length > 0
      ? runtimeResolution.configured_model_endpoint_id.trim()
      : null;
  const configuredModelEndpointName =
    runtimeResolution &&
    typeof runtimeResolution.configured_model_endpoint_name === "string" &&
    runtimeResolution.configured_model_endpoint_name.trim().length > 0
      ? runtimeResolution.configured_model_endpoint_name.trim()
      : null;

  if (
    !agentRuntimeEngine &&
    !configuredAgentRuntimeEngine &&
    !graphWorkflow &&
    graphTraceCount === 0 &&
    !fallbackReason &&
    !configuredModelEndpointId &&
    !configuredModelEndpointName
  ) {
    return null;
  }

  return {
    agentRuntimeEngine,
    configuredAgentRuntimeEngine,
    graphWorkflow,
    graphTraceCount,
    fallbackApplied,
    fallbackReason,
    configuredModelEndpointId,
    configuredModelEndpointName,
    graphTrace
  };
}

export function readAgentExecutionRuntimeBindingSummary(
  payload: Record<string, unknown> | null | undefined
): AgentExecutionRuntimeBindingSummary | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const runtimeBinding =
    payload.runtime_binding && typeof payload.runtime_binding === "object" && !Array.isArray(payload.runtime_binding)
      ? (payload.runtime_binding as Record<string, unknown>)
      : null;

  if (!runtimeBinding) {
    return null;
  }

  const providerType =
    typeof runtimeBinding.provider_type === "string" && runtimeBinding.provider_type.trim().length > 0
      ? runtimeBinding.provider_type.trim()
      : null;
  const modelName =
    typeof runtimeBinding.model_name === "string" && runtimeBinding.model_name.trim().length > 0
      ? runtimeBinding.model_name.trim()
      : null;
  const source =
    typeof runtimeBinding.source === "string" && runtimeBinding.source.trim().length > 0
      ? runtimeBinding.source.trim()
      : null;
  const modelEndpointId =
    typeof runtimeBinding.model_endpoint_id === "string" && runtimeBinding.model_endpoint_id.trim().length > 0
      ? runtimeBinding.model_endpoint_id.trim()
      : null;
  const modelEndpointName =
    typeof runtimeBinding.model_endpoint_name === "string" && runtimeBinding.model_endpoint_name.trim().length > 0
      ? runtimeBinding.model_endpoint_name.trim()
      : null;
  const apiBaseUrl =
    typeof runtimeBinding.api_base_url === "string" && runtimeBinding.api_base_url.trim().length > 0
      ? runtimeBinding.api_base_url.trim()
      : null;

  if (!providerType && !modelName && !source && !modelEndpointName && !apiBaseUrl) {
    return null;
  }

  return {
    providerType,
    modelName,
    source,
    modelEndpointId,
    modelEndpointName,
    apiBaseUrl
  };
}
