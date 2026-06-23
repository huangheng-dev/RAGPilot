"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Blocks, KeyRound, Play, Plus, Save, Server, ShieldCheck, Trash2, Wrench } from "lucide-react";

import { ConsoleActionPacketCard } from "@/components/console/ConsoleActionPacketCard";
import { ConsoleOutlineBadge, ConsoleSurface, ConsoleSurfaceHeader } from "@/components/console/ConsolePrimitives";
import {
  readToolTraceConnectorReference,
  ToolRuntimeSummaryCard,
  type ToolRuntimeTraceRecord
} from "@/components/runtime/ToolRuntimeSummaryCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  buildAdminHref,
  buildAgentsHref,
  buildSettingsHref,
  buildToolTraceSettingsHref
} from "@/lib/console-route-builders";
import { useI18n } from "@/lib/i18n/provider";
import {
  applyToolGovernanceAction,
  createMcpConnector,
  createRetrievalProfile,
  createModelEndpoint,
  createToolRegistration,
  deleteMcpConnector,
  deleteRetrievalProfile,
  deleteModelEndpoint,
  deleteToolRegistration,
  formatPlatformGovernanceIssues,
  listMcpConnectors,
  listModelEndpoints,
  listToolRegistrations,
  loadMcpConnectorGovernanceSummary,
  loadToolMcpBoundaryWorklist,
  loadToolRuntimeAudit,
  loadModelGovernanceSummary,
  loadPlatformGovernanceSnapshot,
  loadToolGovernanceSummary,
  type McpConnectorAuthMode,
  type McpConnectorPreviewResponse,
  type McpConnectorGovernanceSummary,
  type McpConnectorType,
  type ModelCapability,
  type ModelGovernanceSummary,
  type ModelEndpointPreviewResponse,
  type ModelProviderType,
  type PlatformMcpConnector,
  type PlatformModelEndpoint,
  type PlatformRetrievalProfile,
  type PlatformToolRegistration,
  previewModelEndpoint,
  previewMcpConnector,
  type RetrievalMode,
  type ToolGovernanceSummary,
  type ToolGovernanceActionType,
  type ToolMcpBoundaryStatus,
  previewToolRegistration,
  type ToolMcpBoundaryWorklistResponse,
  type ToolRuntimeAuditListResponse,
  type ToolRuntimeGovernanceIssue,
  type ToolInvocationResponse,
  type ToolSurfaceArea,
  type ToolTransportType,
  updateRetrievalProfile,
  updateMcpConnector,
  updateModelEndpoint,
  updateToolRegistration
} from "@/lib/platform-governance";
import {
  listGovernanceTenants,
  loadAgentRuntimeGovernance,
  type AgentRuntimeGovernanceItem,
  type AgentRuntimeGovernanceResponse,
  type AgentRuntimeGovernanceSummary,
  type GovernanceTenantScope
} from "@/lib/runtime-governance";
import { cn } from "@/lib/utils";

type ModelEndpointDraft = Omit<
  PlatformModelEndpoint,
  "created_at" | "updated_at" | "base_url" | "credential_key_hint" | "notes"
> & {
  base_url: string;
  credential_key_hint: string;
  notes: string;
};
type ToolRegistrationDraft = Omit<PlatformToolRegistration, "created_at" | "updated_at" | "endpoint_url" | "description"> & {
  endpoint_url: string;
  connector_reference: string;
  description: string;
};
type McpConnectorDraft = Omit<
  PlatformMcpConnector,
  "created_at" | "updated_at" | "base_url" | "credential_key_hint" | "notes"
> & {
  base_url: string;
  credential_key_hint: string;
  notes: string;
};
type ModelEndpointListFilter =
  | "all"
  | "runtime_ready"
  | "disabled_bound"
  | "missing_base_url"
  | "managed_reserved";
type McpConnectorListFilter =
  | "all"
  | "referenced"
  | "runtime_ready"
  | "missing_base_url"
  | "managed_reserved";
type ToolRegistrationListFilter =
  | "all"
  | "approval_required"
  | "disabled"
  | "missing_endpoint"
  | "mcp_reserved_bound"
  | "mcp_integration_pending"
  | "mcp_connector_configured";
type ToolRuntimeAuditFilter = "all" | "failed" | "blocked" | "reserved" | "unavailable";
type RetrievalProfileDraft = Omit<
  PlatformRetrievalProfile,
  "created_at" | "updated_at" | "notes"
> & {
  notes: string;
};

function slugifyValue(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function createModelDraft(sequence: number): ModelEndpointDraft {
  return {
    id: `new-model-${sequence}`,
    name: "",
    slug: `model-endpoint-${sequence}`,
    provider_type: "openai_compatible",
    model_name: "",
    base_url: "",
    credential_mode: "environment",
    credential_key_hint: "",
    capabilities: ["chat"],
    is_enabled: true,
    is_default: false,
    notes: "",
    bound_agent_count: 0
  };
}

function createOllamaModelDraft(sequence: number, isDefault: boolean): ModelEndpointDraft {
  return {
    id: `new-model-${sequence}`,
    name: "Local Ollama Chat",
    slug: "local-ollama-chat",
    provider_type: "ollama",
    model_name: "llama3.1",
    base_url: "http://127.0.0.1:11434",
    credential_mode: "none",
    credential_key_hint: "",
    capabilities: ["chat"],
    is_enabled: true,
    is_default: isDefault,
    notes: "Native Ollama chat runtime for local grounded-answer generation.",
    bound_agent_count: 0
  };
}

function createVllmModelDraft(sequence: number, isDefault: boolean): ModelEndpointDraft {
  return {
    id: `new-model-${sequence}`,
    name: "Local vLLM Chat",
    slug: "local-vllm-chat",
    provider_type: "vllm",
    model_name: "meta-llama/Llama-3.1-8B-Instruct",
    base_url: "http://127.0.0.1:8001/v1",
    credential_mode: "none",
    credential_key_hint: "",
    capabilities: ["chat"],
    is_enabled: true,
    is_default: isDefault,
    notes: "OpenAI-compatible vLLM runtime for private or higher-throughput chat serving.",
    bound_agent_count: 0
  };
}

function createToolDraft(sequence: number): ToolRegistrationDraft {
  return {
    id: `new-tool-${sequence}`,
    name: "",
    slug: `tool-registration-${sequence}`,
    transport_type: "native",
    surface_area: "agents",
    endpoint_url: "",
    connector_reference: "",
    description: "",
    capabilities: [],
    requires_admin_approval: false,
    is_enabled: true,
    bound_agent_count: 0
  };
}

function createMcpConnectorDraft(sequence: number): McpConnectorDraft {
  return {
    id: `new-mcp-connector-${sequence}`,
    name: "",
    slug: `mcp-connector-${sequence}`,
    connector_type: "streamable_http",
    base_url: "",
    auth_mode: "none",
    credential_key_hint: "",
    notes: "",
    is_enabled: true,
    referenced_tool_count: 0,
    integration_ready_tool_count: 0
  };
}

function createRetrievalProfileDraft(sequence: number): RetrievalProfileDraft {
  return {
    id: `new-retrieval-profile-${sequence}`,
    name: "",
    slug: `retrieval-profile-${sequence}`,
    retrieval_mode: "hybrid",
    top_k: 5,
    vector_weight: 0.65,
    lexical_weight: 0.35,
    hybrid_overlap_bonus: 0.05,
    is_enabled: true,
    is_default: false,
    notes: "",
    bound_knowledge_base_count: 0
  };
}

function mapModelEndpointToDraft(modelEndpoint: PlatformModelEndpoint): ModelEndpointDraft {
  return {
    id: modelEndpoint.id,
    name: modelEndpoint.name,
    slug: modelEndpoint.slug,
    provider_type: modelEndpoint.provider_type,
    model_name: modelEndpoint.model_name,
    base_url: modelEndpoint.base_url ?? "",
    credential_mode: modelEndpoint.credential_mode,
    credential_key_hint: modelEndpoint.credential_key_hint ?? "",
    capabilities: modelEndpoint.capabilities,
    is_enabled: modelEndpoint.is_enabled,
    is_default: modelEndpoint.is_default,
    notes: modelEndpoint.notes ?? "",
    bound_agent_count: modelEndpoint.bound_agent_count
  };
}

function mapToolRegistrationToDraft(toolRegistration: PlatformToolRegistration): ToolRegistrationDraft {
  return {
    id: toolRegistration.id,
    name: toolRegistration.name,
    slug: toolRegistration.slug,
    transport_type: toolRegistration.transport_type,
    surface_area: toolRegistration.surface_area,
    endpoint_url: toolRegistration.endpoint_url ?? "",
    connector_reference: toolRegistration.connector_reference ?? "",
    description: toolRegistration.description ?? "",
    capabilities: toolRegistration.capabilities,
    requires_admin_approval: toolRegistration.requires_admin_approval,
    is_enabled: toolRegistration.is_enabled,
    bound_agent_count: toolRegistration.bound_agent_count
  };
}

function mapMcpConnectorToDraft(mcpConnector: PlatformMcpConnector): McpConnectorDraft {
  return {
    id: mcpConnector.id,
    name: mcpConnector.name,
    slug: mcpConnector.slug,
    connector_type: mcpConnector.connector_type,
    base_url: mcpConnector.base_url ?? "",
    auth_mode: mcpConnector.auth_mode,
    credential_key_hint: mcpConnector.credential_key_hint ?? "",
    notes: mcpConnector.notes ?? "",
    is_enabled: mcpConnector.is_enabled,
    referenced_tool_count: mcpConnector.referenced_tool_count,
    integration_ready_tool_count: mcpConnector.integration_ready_tool_count
  };
}

function mapRetrievalProfileToDraft(retrievalProfile: PlatformRetrievalProfile): RetrievalProfileDraft {
  return {
    id: retrievalProfile.id,
    name: retrievalProfile.name,
    slug: retrievalProfile.slug,
    retrieval_mode: retrievalProfile.retrieval_mode,
    top_k: retrievalProfile.top_k,
    vector_weight: retrievalProfile.vector_weight,
    lexical_weight: retrievalProfile.lexical_weight,
    hybrid_overlap_bonus: retrievalProfile.hybrid_overlap_bonus,
    is_enabled: retrievalProfile.is_enabled,
    is_default: retrievalProfile.is_default,
    notes: retrievalProfile.notes ?? "",
    bound_knowledge_base_count: retrievalProfile.bound_knowledge_base_count
  };
}

function buildModelEndpointPayload(draft: ModelEndpointDraft) {
  return {
    name: draft.name.trim(),
    slug: slugifyValue(draft.slug),
    provider_type: draft.provider_type,
    model_name: draft.model_name.trim(),
    base_url: draft.base_url.trim() || null,
    credential_mode: draft.credential_mode,
    credential_key_hint: draft.credential_key_hint.trim() || null,
    capabilities: draft.capabilities,
    is_enabled: draft.is_enabled,
    is_default: draft.is_default,
    notes: draft.notes.trim() || null
  };
}

function buildToolRegistrationPayload(draft: ToolRegistrationDraft) {
  return {
    name: draft.name.trim(),
    slug: slugifyValue(draft.slug),
    transport_type: draft.transport_type,
    surface_area: draft.surface_area,
    endpoint_url: draft.endpoint_url.trim() || null,
    connector_reference: draft.connector_reference.trim() || null,
    description: draft.description.trim() || null,
    capabilities: draft.capabilities.map((item) => item.trim()).filter(Boolean),
    requires_admin_approval: draft.requires_admin_approval,
    is_enabled: draft.is_enabled
  };
}

function buildMcpConnectorPayload(draft: McpConnectorDraft) {
  return {
    name: draft.name.trim(),
    slug: slugifyValue(draft.slug),
    connector_type: draft.connector_type,
    base_url: draft.base_url.trim() || null,
    auth_mode: draft.auth_mode,
    credential_key_hint: draft.credential_key_hint.trim() || null,
    notes: draft.notes.trim() || null,
    is_enabled: draft.is_enabled
  };
}

function buildRetrievalProfilePayload(draft: RetrievalProfileDraft) {
  return {
    name: draft.name.trim(),
    slug: slugifyValue(draft.slug),
    retrieval_mode: draft.retrieval_mode,
    top_k: draft.top_k,
    vector_weight: draft.vector_weight,
    lexical_weight: draft.lexical_weight,
    hybrid_overlap_bonus: draft.hybrid_overlap_bonus,
    is_enabled: draft.is_enabled,
    is_default: draft.is_default,
    notes: draft.notes.trim() || null
  };
}

function buildToolRegistrationFilters(filter: ToolRegistrationListFilter) {
  if (filter === "approval_required") {
    return { runtime_state: "approval_required" as const };
  }
  if (filter === "disabled") {
    return { runtime_state: "disabled" as const };
  }
  if (filter === "missing_endpoint") {
    return { runtime_state: "missing_endpoint" as const };
  }
  if (filter === "mcp_reserved_bound") {
    return { runtime_state: "mcp_reserved_bound" as const };
  }
  if (filter === "mcp_integration_pending") {
    return { runtime_state: "mcp_integration_pending" as const };
  }
  if (filter === "mcp_connector_configured") {
    return { runtime_state: "mcp_connector_configured" as const };
  }
  return {};
}

function buildModelEndpointFilters(filter: ModelEndpointListFilter) {
  if (filter === "runtime_ready") {
    return { runtime_state: "runtime_ready" as const };
  }
  if (filter === "disabled_bound") {
    return { runtime_state: "disabled_bound" as const };
  }
  if (filter === "missing_base_url") {
    return { runtime_state: "missing_base_url" as const };
  }
  if (filter === "managed_reserved") {
    return { runtime_state: "managed_reserved" as const };
  }
  return {};
}

function buildMcpConnectorFilters(filter: McpConnectorListFilter) {
  if (filter === "referenced") {
    return { runtime_state: "referenced" as const };
  }
  if (filter === "runtime_ready") {
    return { runtime_state: "runtime_ready" as const };
  }
  if (filter === "missing_base_url") {
    return { runtime_state: "missing_base_url" as const };
  }
  if (filter === "managed_reserved") {
    return { runtime_state: "managed_reserved" as const };
  }
  return {};
}

function buildToolRuntimeAuditFilters(
  filter: ToolRuntimeAuditFilter
): { invocation_status?: "failed" | "blocked" | "reserved" | "unavailable" } {
  if (filter === "failed") {
    return { invocation_status: "failed" };
  }
  if (filter === "blocked") {
    return { invocation_status: "blocked" };
  }
  if (filter === "reserved") {
    return { invocation_status: "reserved" };
  }
  if (filter === "unavailable") {
    return { invocation_status: "unavailable" };
  }
  return {};
}

function getToolAuditIssueClass(issue: ToolRuntimeGovernanceIssue | null) {
  switch (issue) {
    case "approval_required":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "tool_disabled":
      return "border-slate-200 bg-slate-100 text-slate-700";
    case "mcp_reserved":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "mcp_integration_pending":
      return "border-indigo-200 bg-indigo-50 text-indigo-700";
    case "endpoint_failure":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "runtime_failure":
      return "border-violet-200 bg-violet-50 text-violet-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

function getToolInvocationStatusClass(status: ToolInvocationResponse["invocation_status"]) {
  switch (status) {
    case "completed":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "blocked":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "reserved":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "unavailable":
      return "border-slate-200 bg-slate-50 text-slate-700";
    case "failed":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "skipped":
      return "border-violet-200 bg-violet-50 text-violet-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

function getMcpBoundaryStatusClass(status: ToolMcpBoundaryStatus) {
  switch (status) {
    case "reviewing":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "quarantined":
      return "border-rose-200 bg-rose-50 text-rose-700";
    default:
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
}

const EMPTY_RUNTIME_GOVERNANCE_SUMMARY: AgentRuntimeGovernanceSummary = {
  totalAgents: 0,
  activeAgents: 0,
  pausedAgents: 0,
  draftAgents: 0,
  attentionAgents: 0,
  readyAgents: 0,
  activeAgentsWithoutScope: 0,
  agentsMissingModel: 0,
  agentsUsingDisabledModel: 0,
  agentsMissingRetrievalProfile: 0,
  agentsUsingDisabledRetrievalProfile: 0,
  agentsMissingToolRegistration: 0,
  agentsUsingDisabledToolRegistration: 0,
  modelEndpoints: 0,
  enabledModels: 0,
  disabledBoundModels: 0,
  unboundEnabledModels: 0,
  toolRegistrations: 0,
  enabledTools: 0,
  approvalGatedTools: 0,
  disabledBoundTools: 0,
  unboundEnabledTools: 0,
  issue_counts: {
    model_missing: 0,
    model_disabled: 0,
    retrieval_profile_missing: 0,
    retrieval_profile_disabled: 0,
    scope_missing: 0,
    scope_invalid: 0,
    tools_missing: 0,
    tool_registration_disabled: 0,
    tool_approval_required: 0,
    tool_mcp_reserved: 0,
    tool_mcp_integration_pending: 0
  }
};

const EMPTY_TOOL_GOVERNANCE_SUMMARY: ToolGovernanceSummary = {
  total_tools: 0,
  enabled_tools: 0,
  disabled_tools: 0,
  bound_tools: 0,
  approval_required_tools: 0,
  native_tools: 0,
  http_tools: 0,
  http_tools_missing_endpoint_tools: 0,
  mcp_reserved_tools: 0,
  mcp_reserved_bound_tools: 0,
  mcp_integration_pending_tools: 0,
  mcp_connector_configured_tools: 0,
  runtime_ready_tools: 0,
  transport_breakdown: [],
  surface_breakdown: []
};

const EMPTY_MCP_CONNECTOR_GOVERNANCE_SUMMARY: McpConnectorGovernanceSummary = {
  total_connectors: 0,
  enabled_connectors: 0,
  disabled_connectors: 0,
  referenced_connectors: 0,
  integration_ready_connectors: 0,
  runtime_ready_connectors: 0,
  missing_base_url_connectors: 0,
  environment_auth_connectors: 0,
  missing_credential_hint_connectors: 0,
  managed_reserved_connectors: 0,
  type_breakdown: [],
  auth_breakdown: []
};

const EMPTY_TOOL_RUNTIME_AUDIT: ToolRuntimeAuditListResponse = {
  summary: {
    total_traces: 0,
    completed_traces: 0,
    blocked_traces: 0,
    reserved_traces: 0,
    unavailable_traces: 0,
    failed_traces: 0,
    skipped_traces: 0,
    approval_required_traces: 0,
    disabled_traces: 0,
    mcp_reserved_traces: 0,
    mcp_integration_pending_traces: 0,
    endpoint_failure_traces: 0,
    runtime_failure_traces: 0
  },
  items: []
};

const EMPTY_TOOL_MCP_BOUNDARY_WORKLIST: ToolMcpBoundaryWorklistResponse = {
  total_reserved_tools: 0,
  bound_reserved_tools: 0,
  reserved_trace_count: 0,
  reviewing_tools: 0,
  quarantined_tools: 0,
  ready_for_integration_tools: 0,
  items: []
};

const EMPTY_MODEL_GOVERNANCE_SUMMARY: ModelGovernanceSummary = {
  total_endpoints: 0,
  enabled_endpoints: 0,
  disabled_endpoints: 0,
  bound_endpoints: 0,
  default_endpoints: 0,
  enabled_default_endpoints: 0,
  disabled_bound_endpoints: 0,
  runtime_ready_endpoints: 0,
  missing_base_url_endpoints: 0,
  environment_credential_endpoints: 0,
  missing_credential_hint_endpoints: 0,
  managed_reserved_credential_endpoints: 0,
  no_credential_endpoints: 0,
  deterministic_endpoints: 0,
  ollama_endpoints: 0,
  openai_compatible_endpoints: 0,
  vllm_endpoints: 0,
  provider_breakdown: [],
  credential_breakdown: []
};

type RuntimeObjectFollowUp = {
  activeAgentCount: number;
  attentionAgentCount: number;
  approvalAgentCount: number;
};

type ConnectorObjectFollowUp = {
  referencedToolCount: number;
  boundToolCount: number;
  activeAgentCount: number;
  reservedAgentCount: number;
  integrationPendingAgentCount: number;
};

const EMPTY_RUNTIME_OBJECT_FOLLOW_UP: RuntimeObjectFollowUp = {
  activeAgentCount: 0,
  attentionAgentCount: 0,
  approvalAgentCount: 0
};

const EMPTY_CONNECTOR_OBJECT_FOLLOW_UP: ConnectorObjectFollowUp = {
  referencedToolCount: 0,
  boundToolCount: 0,
  activeAgentCount: 0,
  reservedAgentCount: 0,
  integrationPendingAgentCount: 0
};

export function PlatformGovernanceSection({
  canManage,
  isVisible
}: {
  canManage: boolean;
  isVisible: boolean;
}) {
  const { t } = useI18n();
  const [modelEndpoints, setModelEndpoints] = useState<ModelEndpointDraft[]>([]);
  const [modelEndpointListFilter, setModelEndpointListFilter] = useState<ModelEndpointListFilter>("all");
  const [mcpConnectors, setMcpConnectors] = useState<McpConnectorDraft[]>([]);
  const [mcpConnectorListFilter, setMcpConnectorListFilter] = useState<McpConnectorListFilter>("all");
  const [toolRegistrations, setToolRegistrations] = useState<ToolRegistrationDraft[]>([]);
  const [toolRegistrationListFilter, setToolRegistrationListFilter] = useState<ToolRegistrationListFilter>("all");
  const [toolRuntimeAuditFilter, setToolRuntimeAuditFilter] = useState<ToolRuntimeAuditFilter>("all");
  const [retrievalProfiles, setRetrievalProfiles] = useState<RetrievalProfileDraft[]>([]);
  const [governanceTenants, setGovernanceTenants] = useState<GovernanceTenantScope[]>([]);
  const [selectedModelEndpointId, setSelectedModelEndpointId] = useState("");
  const [selectedMcpConnectorId, setSelectedMcpConnectorId] = useState("");
  const [selectedToolRegistrationId, setSelectedToolRegistrationId] = useState("");
  const [selectedRetrievalProfileId, setSelectedRetrievalProfileId] = useState("");
  const [activeGovernanceAgents, setActiveGovernanceAgents] = useState<AgentRuntimeGovernanceItem[]>([]);
  const [governancePosture, setGovernancePosture] = useState<AgentRuntimeGovernanceSummary>(
    EMPTY_RUNTIME_GOVERNANCE_SUMMARY
  );
  const [modelGovernanceSummary, setModelGovernanceSummary] = useState<ModelGovernanceSummary>(
    EMPTY_MODEL_GOVERNANCE_SUMMARY
  );
  const [toolGovernanceSummary, setToolGovernanceSummary] = useState<ToolGovernanceSummary>(
    EMPTY_TOOL_GOVERNANCE_SUMMARY
  );
  const [mcpConnectorGovernanceSummary, setMcpConnectorGovernanceSummary] = useState<McpConnectorGovernanceSummary>(
    EMPTY_MCP_CONNECTOR_GOVERNANCE_SUMMARY
  );
  const [toolRuntimeAudit, setToolRuntimeAudit] = useState<ToolRuntimeAuditListResponse>(
    EMPTY_TOOL_RUNTIME_AUDIT
  );
  const [toolMcpBoundaryWorklist, setToolMcpBoundaryWorklist] = useState<ToolMcpBoundaryWorklistResponse>(
    EMPTY_TOOL_MCP_BOUNDARY_WORKLIST
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isMutatingModel, setIsMutatingModel] = useState(false);
  const [isMutatingMcpConnector, setIsMutatingMcpConnector] = useState(false);
  const [isMutatingTool, setIsMutatingTool] = useState(false);
  const [isMutatingRetrievalProfile, setIsMutatingRetrievalProfile] = useState(false);
  const [isPreviewingModel, setIsPreviewingModel] = useState(false);
  const [isPreviewingMcpConnector, setIsPreviewingMcpConnector] = useState(false);
  const [isPreviewingTool, setIsPreviewingTool] = useState(false);
  const [modelPreviewResult, setModelPreviewResult] = useState<ModelEndpointPreviewResponse | null>(null);
  const [mcpConnectorPreviewResult, setMcpConnectorPreviewResult] = useState<McpConnectorPreviewResponse | null>(null);
  const [toolPreviewResult, setToolPreviewResult] = useState<ToolInvocationResponse | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [modelRuntimeFollowUp, setModelRuntimeFollowUp] = useState<RuntimeObjectFollowUp>(
    EMPTY_RUNTIME_OBJECT_FOLLOW_UP
  );
  const [toolRuntimeFollowUp, setToolRuntimeFollowUp] = useState<RuntimeObjectFollowUp>(
    EMPTY_RUNTIME_OBJECT_FOLLOW_UP
  );
  const [retrievalRuntimeFollowUp, setRetrievalRuntimeFollowUp] = useState<RuntimeObjectFollowUp>(
    EMPTY_RUNTIME_OBJECT_FOLLOW_UP
  );
  const [selectedMcpConnectorScopedTools, setSelectedMcpConnectorScopedTools] = useState<PlatformToolRegistration[]>([]);
  const modelSectionRef = useRef<HTMLDivElement | null>(null);
  const toolSectionRef = useRef<HTMLDivElement | null>(null);
  const retrievalSectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isVisible) {
      return;
    }

    let isMounted = true;

    async function loadGovernanceState() {
      try {
        setIsLoading(true);
        setErrorMessage(null);
        const [
          governanceSnapshot,
          governanceTenants,
          runtimeGovernance,
          modelGovernanceSummary,
          mcpConnectorGovernanceSummary,
          toolGovernanceSummary,
          visibleMcpConnectors,
          visibleModelEndpoints,
          visibleToolRegistrations
        ] = await Promise.all([
          loadPlatformGovernanceSnapshot(),
          listGovernanceTenants(),
          loadAgentRuntimeGovernance({ status: "active" }),
          loadModelGovernanceSummary(),
          loadMcpConnectorGovernanceSummary(),
          loadToolGovernanceSummary(),
          listMcpConnectors(buildMcpConnectorFilters(mcpConnectorListFilter)),
          listModelEndpoints(buildModelEndpointFilters(modelEndpointListFilter)),
          listToolRegistrations(buildToolRegistrationFilters(toolRegistrationListFilter))
        ]);
        if (!isMounted) {
          return;
        }

        const mcpConnectorDrafts = visibleMcpConnectors.map(mapMcpConnectorToDraft);
        const modelDrafts = visibleModelEndpoints.map(mapModelEndpointToDraft);
        const toolDrafts = visibleToolRegistrations.map(mapToolRegistrationToDraft);
        const retrievalProfileDrafts = governanceSnapshot.retrievalProfiles.map(mapRetrievalProfileToDraft);
        const searchParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
        const requestedRuntimeResource = searchParams?.get("runtime_resource");
        const requestedModelEndpointId = searchParams?.get("model_endpoint_id") ?? "";
        const resolvedRequestedModelEndpointId =
          requestedRuntimeResource === "model_endpoint" &&
          requestedModelEndpointId &&
          modelDrafts.some((item) => item.id === requestedModelEndpointId)
            ? requestedModelEndpointId
            : "";
        const requestedToolRegistrationId = searchParams?.get("tool_registration_id") ?? "";
        const resolvedRequestedToolRegistrationId =
          requestedRuntimeResource === "tool_registration" &&
          requestedToolRegistrationId &&
          toolDrafts.some((item) => item.id === requestedToolRegistrationId)
            ? requestedToolRegistrationId
            : "";
        const requestedMcpConnectorId = searchParams?.get("mcp_connector_id") ?? "";
        const resolvedRequestedMcpConnectorId =
          requestedRuntimeResource === "mcp_connector" &&
          requestedMcpConnectorId &&
          mcpConnectorDrafts.some((item) => item.id === requestedMcpConnectorId)
            ? requestedMcpConnectorId
            : "";
        const requestedMcpConnectorSlug = searchParams?.get("mcp_connector_slug") ?? "";
        const requestedMcpConnectorSlugMatch =
          requestedRuntimeResource === "mcp_connector" && requestedMcpConnectorSlug
            ? mcpConnectorDrafts.find((item) => item.slug === requestedMcpConnectorSlug) ?? null
            : null;
        const resolvedRequestedMcpConnectorSlugId =
          requestedMcpConnectorSlugMatch?.id ?? "";
        const requestedRetrievalProfileId = searchParams?.get("retrieval_profile_id") ?? "";
        const resolvedRequestedRetrievalProfileId =
          requestedRuntimeResource === "retrieval_profile" &&
          requestedRetrievalProfileId &&
          retrievalProfileDrafts.some((item) => item.id === requestedRetrievalProfileId)
            ? requestedRetrievalProfileId
            : "";
        setMcpConnectors(mcpConnectorDrafts);
        setModelEndpoints(modelDrafts);
        setToolRegistrations(toolDrafts);
        setRetrievalProfiles(retrievalProfileDrafts);
        setGovernanceTenants(governanceTenants);
        setActiveGovernanceAgents(runtimeGovernance.items);
        setGovernancePosture(runtimeGovernance.summary);
        setModelGovernanceSummary(modelGovernanceSummary);
        setMcpConnectorGovernanceSummary(mcpConnectorGovernanceSummary);
        setToolGovernanceSummary(toolGovernanceSummary);
        setSelectedMcpConnectorId((currentValue) =>
          resolvedRequestedMcpConnectorId ||
          resolvedRequestedMcpConnectorSlugId ||
          (currentValue && mcpConnectorDrafts.some((item) => item.id === currentValue) ? currentValue : mcpConnectorDrafts[0]?.id ?? "")
        );
        setSelectedModelEndpointId((currentValue) =>
          resolvedRequestedModelEndpointId ||
          (currentValue && modelDrafts.some((item) => item.id === currentValue) ? currentValue : modelDrafts[0]?.id ?? "")
        );
        setSelectedToolRegistrationId((currentValue) =>
          resolvedRequestedToolRegistrationId ||
          (currentValue && toolDrafts.some((item) => item.id === currentValue) ? currentValue : toolDrafts[0]?.id ?? "")
        );
        setSelectedRetrievalProfileId((currentValue) =>
          resolvedRequestedRetrievalProfileId ||
          (currentValue && retrievalProfileDrafts.some((item) => item.id === currentValue)
            ? currentValue
            : retrievalProfileDrafts[0]?.id ?? "")
        );
        if (requestedRuntimeResource === "model_endpoint") {
          window.setTimeout(() => {
            modelSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
          }, 0);
        } else if (requestedRuntimeResource === "mcp_connector" || requestedRuntimeResource === "tool_registration") {
          window.setTimeout(() => {
            toolSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
          }, 0);
        } else if (requestedRuntimeResource === "retrieval_profile") {
          window.setTimeout(() => {
            retrievalSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
          }, 0);
        }
        if (governanceSnapshot.issues.length > 0) {
          setErrorMessage(formatPlatformGovernanceIssues(governanceSnapshot.issues));
        }
        setStatusMessage(
          governanceSnapshot.issues.length > 0
            ? `${t("settings.governance.loaded", {
                models: String(modelDrafts.length),
                tools: String(toolDrafts.length)
              })} · ${formatPlatformGovernanceIssues(governanceSnapshot.issues)}`
            : t("settings.governance.loaded", {
                models: String(modelDrafts.length),
                tools: String(toolDrafts.length)
              })
        );
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setErrorMessage(error instanceof Error ? error.message : t("settings.governance.loadFailed"));
        setStatusMessage(t("settings.governance.loadFailed"));
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadGovernanceState();

    return () => {
      isMounted = false;
    };
  }, [isVisible, t, mcpConnectorListFilter, modelEndpointListFilter, toolRegistrationListFilter]);

  const selectedMcpConnector = useMemo(
    () => mcpConnectors.find((item) => item.id === selectedMcpConnectorId) ?? null,
    [mcpConnectors, selectedMcpConnectorId]
  );
  const selectedModelEndpoint = useMemo(
    () => modelEndpoints.find((item) => item.id === selectedModelEndpointId) ?? null,
    [modelEndpoints, selectedModelEndpointId]
  );
  const selectedToolRegistration = useMemo(
    () => toolRegistrations.find((item) => item.id === selectedToolRegistrationId) ?? null,
    [selectedToolRegistrationId, toolRegistrations]
  );
  const visibleMcpConnectors = useMemo(() => mcpConnectors, [mcpConnectors]);
  const visibleToolRegistrations = useMemo(() => toolRegistrations, [toolRegistrations]);
  const selectedRetrievalProfile = useMemo(
    () => retrievalProfiles.find((item) => item.id === selectedRetrievalProfileId) ?? null,
    [retrievalProfiles, selectedRetrievalProfileId]
  );
  const selectedToolLinkedConnector = useMemo(() => {
    const connectorReference = selectedToolRegistration?.connector_reference?.trim() ?? "";
    if (!connectorReference) {
      return null;
    }

    return mcpConnectors.find((item) => item.slug === connectorReference) ?? null;
  }, [mcpConnectors, selectedToolRegistration]);
  const selectedToolPreviewTenantId = useMemo(() => {
    if (selectedToolRegistration == null) {
      return null;
    }

    const boundAgent = activeGovernanceAgents.find((agent) =>
      agent.tool_registration_ids.includes(selectedToolRegistration.id)
    );
    return boundAgent?.tenant_id ?? governanceTenants[0]?.id ?? null;
  }, [activeGovernanceAgents, governanceTenants, selectedToolRegistration]);
  const mcpBoundaryTenantId = useMemo(() => governanceTenants[0]?.id ?? null, [governanceTenants]);
  const toolAuditActionCounts = useMemo(
    () => ({
      approval: toolRuntimeAudit.summary.approval_required_traces,
      disabled: toolRuntimeAudit.summary.disabled_traces,
      reserved: toolRuntimeAudit.summary.mcp_reserved_traces,
      integrationPending: toolRuntimeAudit.summary.mcp_integration_pending_traces,
      failed:
        toolRuntimeAudit.summary.endpoint_failure_traces + toolRuntimeAudit.summary.runtime_failure_traces
    }),
    [toolRuntimeAudit]
  );
  const selectedToolGovernanceSettingsHref = useMemo(() => {
    if (!selectedToolRegistration) {
      return buildSettingsHref();
    }

    return buildToolTraceSettingsHref({
      toolRegistrationId: selectedToolRegistration.id,
      governanceIssue:
        toolAuditActionCounts.reserved > 0
          ? "mcp_reserved"
          : toolAuditActionCounts.integrationPending > 0
            ? "mcp_integration_pending"
            : null,
      connectorReference: selectedToolRegistration.connector_reference
    });
  }, [selectedToolRegistration, toolAuditActionCounts.integrationPending, toolAuditActionCounts.reserved]);
  const selectedMcpConnectorScopedToolIds = useMemo(
    () => new Set(selectedMcpConnectorScopedTools.map((item) => item.id)),
    [selectedMcpConnectorScopedTools]
  );
  const selectedMcpConnectorFollowUp = useMemo<ConnectorObjectFollowUp>(() => {
    if (!selectedMcpConnector || selectedMcpConnectorScopedToolIds.size === 0) {
      return EMPTY_CONNECTOR_OBJECT_FOLLOW_UP;
    }

    const activeConnectorAgents = activeGovernanceAgents.filter((agent) =>
      agent.tool_registration_ids.some((toolRegistrationId) => selectedMcpConnectorScopedToolIds.has(toolRegistrationId))
    );

    return {
      referencedToolCount: selectedMcpConnectorScopedTools.length,
      boundToolCount: selectedMcpConnectorScopedTools.filter((item) => item.bound_agent_count > 0).length,
      activeAgentCount: activeConnectorAgents.length,
      reservedAgentCount: activeConnectorAgents.filter((agent) => agent.issues.includes("tool_mcp_reserved")).length,
      integrationPendingAgentCount: activeConnectorAgents.filter((agent) =>
        agent.issues.includes("tool_mcp_integration_pending")
      ).length
    };
  }, [activeGovernanceAgents, selectedMcpConnector, selectedMcpConnectorScopedToolIds, selectedMcpConnectorScopedTools]);
  const selectedToolBoundAgentsHref = useMemo(
    () =>
      selectedToolRegistration
        ? buildAgentsHref({
            status: "active",
            toolRegistrationId: selectedToolRegistration.id
          })
        : buildAgentsHref({ status: "active" }),
    [selectedToolRegistration]
  );
  const selectedToolApprovalAgentsHref = useMemo(
    () =>
      selectedToolRegistration
        ? buildAgentsHref({
            status: "active",
            issue: "tool_approval_required",
            toolRegistrationId: selectedToolRegistration.id
          })
        : buildAgentsHref({ status: "active", issue: "tool_approval_required" }),
    [selectedToolRegistration]
  );
  const selectedToolDisabledAgentsHref = useMemo(
    () =>
      selectedToolRegistration
        ? buildAgentsHref({
            status: "active",
            readiness: "attention",
            issue: "tool_registration_disabled",
            toolRegistrationId: selectedToolRegistration.id
          })
        : buildAgentsHref({ status: "active", readiness: "attention", issue: "tool_registration_disabled" }),
    [selectedToolRegistration]
  );
  const selectedMcpConnectorLinkedToolHref = useMemo(
    () =>
      buildSettingsHref({
        runtimeResource: "tool_registration",
        toolRegistrationId: selectedMcpConnectorScopedTools[0]?.id ?? null
      }),
    [selectedMcpConnectorScopedTools]
  );
  const selectedMcpConnectorBoundAgentsHref = useMemo(
    () =>
      buildAgentsHref({
        status: "active",
        ...(selectedMcpConnectorScopedTools.length === 1
          ? { toolRegistrationId: selectedMcpConnectorScopedTools[0].id }
          : {})
      }),
    [selectedMcpConnectorScopedTools]
  );
  const selectedMcpConnectorPendingAgentsHref = useMemo(
    () =>
      buildAgentsHref({
        status: "active",
        readiness: "attention",
        issue: "tool_mcp_integration_pending",
        ...(selectedMcpConnectorScopedTools.length === 1
          ? { toolRegistrationId: selectedMcpConnectorScopedTools[0].id }
          : {})
      }),
    [selectedMcpConnectorScopedTools]
  );
  const selectedMcpConnectorReservedAgentsHref = useMemo(
    () =>
      buildAgentsHref({
        status: "active",
        readiness: "attention",
        issue: "tool_mcp_reserved",
        ...(selectedMcpConnectorScopedTools.length === 1
          ? { toolRegistrationId: selectedMcpConnectorScopedTools[0].id }
          : {})
      }),
    [selectedMcpConnectorScopedTools]
  );
  const selectedToolRuntimePacket = useMemo(() => {
    if (!selectedToolRegistration) {
      return null;
    }

    let status: "attention" | "review" | "healthy" = "healthy";
    let statusLabel = t("settings.governance.enabled");
    let detail = t("settings.tools.runtimePacket.healthyDetail");
    let metricValue = t("settings.tools.runtimePacket.metricReady");
    let primaryActionLabel = t("settings.tools.runtimePacket.primaryOpenSettings");
    let primaryActionHref = selectedToolGovernanceSettingsHref;

    if (toolAuditActionCounts.disabled > 0) {
      status = "attention";
      statusLabel = t("settings.tools.runtimePacket.statusAttention");
      detail = t("settings.tools.runtimePacket.disabledDetail");
      metricValue = t("settings.tools.runtimePacket.metricDisabled", {
        count: String(toolAuditActionCounts.disabled)
      });
      primaryActionLabel = t("settings.tools.runtimePacket.primaryOpenImpactedAgents");
      primaryActionHref = selectedToolDisabledAgentsHref;
    } else if (toolAuditActionCounts.approval > 0) {
      status = "review";
      statusLabel = t("settings.tools.runtimePacket.statusReview");
      detail = t("settings.tools.runtimePacket.approvalDetail");
      metricValue = t("settings.tools.runtimePacket.metricApproval", {
        count: String(toolAuditActionCounts.approval)
      });
      primaryActionLabel = t("settings.tools.runtimePacket.primaryOpenApprovalAgents");
      primaryActionHref = selectedToolApprovalAgentsHref;
    } else if (toolAuditActionCounts.reserved > 0 || toolAuditActionCounts.integrationPending > 0) {
      status = "review";
      statusLabel = t("settings.tools.runtimePacket.statusReview");
      detail =
        toolAuditActionCounts.integrationPending > 0
          ? t("settings.tools.runtimePacket.integrationPendingDetail")
          : t("settings.tools.runtimePacket.reservedDetail");
      metricValue =
        toolAuditActionCounts.integrationPending > 0
          ? t("settings.tools.runtimePacket.metricIntegrationPending", {
              count: String(toolAuditActionCounts.integrationPending)
            })
          : t("settings.tools.runtimePacket.metricReserved", {
              count: String(toolAuditActionCounts.reserved)
            });
      primaryActionLabel = t("settings.tools.runtimePacket.primaryOpenSettings");
      primaryActionHref = selectedToolGovernanceSettingsHref;
    } else if (toolAuditActionCounts.failed > 0) {
      status = "attention";
      statusLabel = t("settings.tools.runtimePacket.statusAttention");
      detail = t("settings.tools.runtimePacket.failedDetail");
      metricValue = t("settings.tools.runtimePacket.metricFailed", {
        count: String(toolAuditActionCounts.failed)
      });
      primaryActionLabel = t("settings.tools.runtimePacket.primaryOpenSettings");
      primaryActionHref = selectedToolGovernanceSettingsHref;
    }

    const secondaryActions = [
      {
        label: t("settings.tools.openBoundAgents"),
        href: selectedToolBoundAgentsHref
      },
      ...(primaryActionHref !== selectedToolGovernanceSettingsHref
        ? [
            {
              label: t("settings.tools.auditActions.openToolSettings"),
              href: selectedToolGovernanceSettingsHref
            }
          ]
        : [])
    ];

    return {
      detail,
      metricValue,
      primaryActionHref,
      primaryActionLabel,
      secondaryActions,
      status,
      statusLabel,
      title: t("settings.tools.runtimePacket.title")
    };
  }, [
    selectedToolApprovalAgentsHref,
    selectedToolBoundAgentsHref,
    selectedToolDisabledAgentsHref,
    selectedToolGovernanceSettingsHref,
    selectedToolRegistration,
    t,
    toolAuditActionCounts.approval,
    toolAuditActionCounts.disabled,
    toolAuditActionCounts.failed,
    toolAuditActionCounts.integrationPending,
    toolAuditActionCounts.reserved
  ]);
  const selectedMcpConnectorPacket = useMemo(() => {
    if (!selectedMcpConnector) {
      return null;
    }

    let status: "attention" | "review" | "healthy" = "healthy";
    let statusLabel = t("settings.governance.enabled");
    let detail = t("settings.mcpConnectors.runtimePacket.healthyDetail");
    let metricValue = t("settings.mcpConnectors.runtimePacket.metricReady", {
      count: String(selectedMcpConnectorFollowUp.referencedToolCount)
    });
    let primaryActionLabel =
      selectedMcpConnectorScopedTools.length > 0
        ? t("settings.mcpConnectors.runtimePacket.primaryOpenLinkedTools")
        : t("settings.mcpConnectors.runtimePacket.primaryPreviewConnector");
    let primaryActionHref =
      selectedMcpConnectorScopedTools.length > 0
        ? selectedMcpConnectorLinkedToolHref
        : buildSettingsHref({
            runtimeResource: "mcp_connector",
            mcpConnectorId: selectedMcpConnector.id,
            mcpConnectorSlug: selectedMcpConnector.slug
          });

    if (selectedMcpConnectorFollowUp.reservedAgentCount > 0) {
      status = "review";
      statusLabel = t("settings.mcpConnectors.runtimePacket.statusReview");
      detail = t("settings.mcpConnectors.runtimePacket.reservedDetail");
      metricValue = t("settings.mcpConnectors.runtimePacket.metricReserved", {
        count: String(selectedMcpConnectorFollowUp.reservedAgentCount)
      });
      primaryActionLabel = t("settings.mcpConnectors.followUp.openReservedAgents");
      primaryActionHref = selectedMcpConnectorReservedAgentsHref;
    } else if (selectedMcpConnectorFollowUp.integrationPendingAgentCount > 0) {
      status = "review";
      statusLabel = t("settings.mcpConnectors.runtimePacket.statusReview");
      detail = t("settings.mcpConnectors.runtimePacket.pendingDetail");
      metricValue = t("settings.mcpConnectors.runtimePacket.metricPending", {
        count: String(selectedMcpConnectorFollowUp.integrationPendingAgentCount)
      });
      primaryActionLabel = t("settings.mcpConnectors.followUp.openPendingAgents");
      primaryActionHref = selectedMcpConnectorPendingAgentsHref;
    } else if (!selectedMcpConnector.is_enabled || !selectedMcpConnector.base_url.trim()) {
      status = "attention";
      statusLabel = t("settings.mcpConnectors.runtimePacket.statusAttention");
      detail = t("settings.mcpConnectors.runtimePacket.configurationDetail");
      metricValue = t("settings.mcpConnectors.runtimePacket.metricConfiguration");
      primaryActionLabel = t("settings.mcpConnectors.runtimePacket.primaryPreviewConnector");
    }

    const secondaryActions = [
      ...(selectedMcpConnectorScopedTools.length > 0
        ? [
            {
              label: t("settings.mcpConnectors.followUp.openLinkedTools"),
              href: selectedMcpConnectorLinkedToolHref
            }
          ]
        : []),
      ...(selectedMcpConnectorFollowUp.activeAgentCount > 0
        ? [
            {
              label: t("settings.mcpConnectors.followUp.openBoundAgents"),
              href: selectedMcpConnectorBoundAgentsHref
            }
          ]
        : []),
      ...(selectedMcpConnectorFollowUp.integrationPendingAgentCount > 0
        ? [
            {
              label: t("settings.mcpConnectors.followUp.openPendingAgents"),
              href: selectedMcpConnectorPendingAgentsHref
            }
          ]
        : []),
      ...(selectedMcpConnectorFollowUp.reservedAgentCount > 0
        ? [
            {
              label: t("settings.mcpConnectors.followUp.openReservedAgents"),
              href: selectedMcpConnectorReservedAgentsHref
            }
          ]
        : [])
    ].filter((action) => action.href !== primaryActionHref);

    return {
      detail,
      metricValue,
      primaryActionHref,
      primaryActionLabel,
      secondaryActions,
      status,
      statusLabel,
      title: t("settings.mcpConnectors.runtimePacket.title")
    };
  }, [
    selectedMcpConnector,
    selectedMcpConnectorFollowUp.activeAgentCount,
    selectedMcpConnectorFollowUp.integrationPendingAgentCount,
    selectedMcpConnectorFollowUp.referencedToolCount,
    selectedMcpConnectorFollowUp.reservedAgentCount,
    selectedMcpConnectorBoundAgentsHref,
    selectedMcpConnectorLinkedToolHref,
    selectedMcpConnectorPendingAgentsHref,
    selectedMcpConnectorReservedAgentsHref,
    selectedMcpConnectorScopedTools,
    t
  ]);

  useEffect(() => {
    if (!isVisible) {
      return;
    }

    let isMounted = true;

    async function loadObjectFollowUp() {
      async function readAgentCount(
        filters: Parameters<typeof loadAgentRuntimeGovernance>[0]
      ): Promise<number> {
        const response: AgentRuntimeGovernanceResponse = await loadAgentRuntimeGovernance(filters);
        return response.summary.totalAgents;
      }

      try {
        const nextModelFollowUp = selectedModelEndpoint && !selectedModelEndpoint.id.startsWith("new-model-")
          ? {
              activeAgentCount: await readAgentCount({
                status: "active",
                model_endpoint_id: selectedModelEndpoint.id
              }),
              attentionAgentCount: selectedModelEndpoint.is_enabled
                ? 0
                : await readAgentCount({
                    status: "active",
                    readiness: "attention",
                    issue: "model_disabled",
                    model_endpoint_id: selectedModelEndpoint.id
                  }),
              approvalAgentCount: 0
            }
          : EMPTY_RUNTIME_OBJECT_FOLLOW_UP;

        const nextToolFollowUp = selectedToolRegistration && !selectedToolRegistration.id.startsWith("new-tool-")
          ? {
              activeAgentCount: await readAgentCount({
                status: "active",
                tool_registration_id: selectedToolRegistration.id
              }),
              attentionAgentCount: selectedToolRegistration.is_enabled
                ? 0
                : await readAgentCount({
                    status: "active",
                    readiness: "attention",
                    issue: "tool_registration_disabled",
                    tool_registration_id: selectedToolRegistration.id
                  }),
              approvalAgentCount: selectedToolRegistration.requires_admin_approval
                ? await readAgentCount({
                    status: "active",
                    issue: "tool_approval_required",
                    tool_registration_id: selectedToolRegistration.id
                  })
                : 0
            }
          : EMPTY_RUNTIME_OBJECT_FOLLOW_UP;

        const nextRetrievalFollowUp =
          selectedRetrievalProfile && !selectedRetrievalProfile.id.startsWith("new-retrieval-profile-")
            ? {
                activeAgentCount: await readAgentCount({
                  status: "active",
                  retrieval_profile_id: selectedRetrievalProfile.id
                }),
                attentionAgentCount: selectedRetrievalProfile.is_enabled
                  ? 0
                  : await readAgentCount({
                      status: "active",
                      readiness: "attention",
                      issue: "retrieval_profile_disabled",
                      retrieval_profile_id: selectedRetrievalProfile.id
                    }),
                approvalAgentCount: 0
              }
            : EMPTY_RUNTIME_OBJECT_FOLLOW_UP;

        if (!isMounted) {
          return;
        }

        setModelRuntimeFollowUp(nextModelFollowUp);
        setToolRuntimeFollowUp(nextToolFollowUp);
        setRetrievalRuntimeFollowUp(nextRetrievalFollowUp);
      } catch {
        if (!isMounted) {
          return;
        }

        setModelRuntimeFollowUp(EMPTY_RUNTIME_OBJECT_FOLLOW_UP);
        setToolRuntimeFollowUp(EMPTY_RUNTIME_OBJECT_FOLLOW_UP);
        setRetrievalRuntimeFollowUp(EMPTY_RUNTIME_OBJECT_FOLLOW_UP);
      }
    }

    void loadObjectFollowUp();

    return () => {
      isMounted = false;
    };
  }, [isVisible, selectedModelEndpoint, selectedRetrievalProfile, selectedToolRegistration]);

  useEffect(() => {
    if (!isVisible || !selectedMcpConnector) {
      setSelectedMcpConnectorScopedTools([]);
      setMcpConnectorPreviewResult(null);
      return;
    }

    if (selectedMcpConnector.id.startsWith("new-mcp-connector-")) {
      setSelectedMcpConnectorScopedTools([]);
      setMcpConnectorPreviewResult(null);
      return;
    }

    const normalizedConnectorReference = selectedMcpConnector.slug.trim();

    let isMounted = true;

    async function loadConnectorScopedTools() {
      try {
        const allToolRegistrations = await listToolRegistrations();
        if (!isMounted) {
          return;
        }

        setSelectedMcpConnectorScopedTools(
          allToolRegistrations.filter(
            (item) => (item.connector_reference?.trim() ?? "") === normalizedConnectorReference
          )
        );
      } catch {
        if (!isMounted) {
          return;
        }

        setSelectedMcpConnectorScopedTools([]);
      }
    }

    void loadConnectorScopedTools();

    return () => {
      isMounted = false;
    };
  }, [isVisible, selectedMcpConnector]);

  useEffect(() => {
    if (!isVisible || !selectedToolRegistration || selectedToolRegistration.id.startsWith("new-tool-") || !selectedToolPreviewTenantId) {
      setToolRuntimeAudit(EMPTY_TOOL_RUNTIME_AUDIT);
      return;
    }

    let isMounted = true;

    async function loadToolAuditState() {
      const tenantId = selectedToolPreviewTenantId;
      const selectedTool = selectedToolRegistration;
      if (!tenantId || !selectedTool) {
        setToolRuntimeAudit(EMPTY_TOOL_RUNTIME_AUDIT);
        return;
      }

      try {
        const response = await loadToolRuntimeAudit({
          tenant_id: tenantId,
          tool_registration_id: selectedTool.id,
          limit: 6,
          ...buildToolRuntimeAuditFilters(toolRuntimeAuditFilter)
        });
        if (!isMounted) {
          return;
        }
        setToolRuntimeAudit(response);
      } catch {
        if (!isMounted) {
          return;
        }
        setToolRuntimeAudit(EMPTY_TOOL_RUNTIME_AUDIT);
      }
    }

    void loadToolAuditState();

    return () => {
      isMounted = false;
    };
  }, [isVisible, selectedToolPreviewTenantId, selectedToolRegistration, toolRuntimeAuditFilter]);

  useEffect(() => {
    if (!isVisible || !mcpBoundaryTenantId) {
      setToolMcpBoundaryWorklist(EMPTY_TOOL_MCP_BOUNDARY_WORKLIST);
      return;
    }

    let isMounted = true;

    async function loadMcpBoundaryState() {
      try {
        const response = await loadToolMcpBoundaryWorklist({
          tenant_id: mcpBoundaryTenantId,
          limit: 6,
        });
        if (!isMounted) {
          return;
        }
        setToolMcpBoundaryWorklist(response);
      } catch {
        if (!isMounted) {
          return;
        }
        setToolMcpBoundaryWorklist(EMPTY_TOOL_MCP_BOUNDARY_WORKLIST);
      }
    }

    void loadMcpBoundaryState();

    return () => {
      isMounted = false;
    };
  }, [isVisible, mcpBoundaryTenantId]);

  function renderToolAuditTraceActions(trace: ToolRuntimeTraceRecord) {
    const settingsHref = buildToolTraceSettingsHref({
      toolRegistrationId: trace.tool_registration_id,
      governanceIssue: trace.governance_issue ?? null,
      connectorReference: readToolTraceConnectorReference(trace)
    });
    const boundAgentsHref = buildAgentsHref({
      status: "active",
      toolRegistrationId: trace.tool_registration_id
    });

    if (trace.governance_issue === "approval_required") {
      return (
        <>
          <Button asChild className="bg-white" size="sm" type="button" variant="outline">
            <Link
              href={buildAgentsHref({
                status: "active",
                issue: "tool_approval_required",
                toolRegistrationId: trace.tool_registration_id
              })}
            >
              {t("settings.tools.auditActions.openApprovalAgents")}
            </Link>
          </Button>
          <Button asChild className="bg-white" size="sm" type="button" variant="outline">
            <Link href={settingsHref}>{t("settings.tools.auditActions.openToolSettings")}</Link>
          </Button>
        </>
      );
    }

    if (trace.governance_issue === "tool_disabled") {
      return (
        <>
          <Button asChild className="bg-white" size="sm" type="button" variant="outline">
            <Link
              href={buildAgentsHref({
                status: "active",
                readiness: "attention",
                issue: "tool_registration_disabled",
                toolRegistrationId: trace.tool_registration_id
              })}
            >
              {t("settings.tools.auditActions.openImpactedAgents")}
            </Link>
          </Button>
          <Button asChild className="bg-white" size="sm" type="button" variant="outline">
            <Link href={settingsHref}>{t("settings.tools.auditActions.openToolSettings")}</Link>
          </Button>
        </>
      );
    }

    if (trace.governance_issue === "mcp_reserved") {
      return (
        <>
          <Button asChild className="bg-white" size="sm" type="button" variant="outline">
            <Link href={settingsHref}>{t("settings.tools.auditActions.reviewReservedTransport")}</Link>
          </Button>
          <Button asChild className="bg-white" size="sm" type="button" variant="outline">
            <Link href={boundAgentsHref}>{t("settings.tools.auditActions.openBoundAgents")}</Link>
          </Button>
        </>
      );
    }

    if (trace.governance_issue === "mcp_integration_pending") {
      return (
        <>
          <Button asChild className="bg-white" size="sm" type="button" variant="outline">
            <Link href={settingsHref}>{t("settings.tools.auditActions.reviewIntegrationPending")}</Link>
          </Button>
          <Button asChild className="bg-white" size="sm" type="button" variant="outline">
            <Link
              href={buildAgentsHref({
                status: "active",
                toolRegistrationId: trace.tool_registration_id
              })}
            >
              {t("settings.tools.auditActions.openBoundAgents")}
            </Link>
          </Button>
        </>
      );
    }

    if (trace.governance_issue === "endpoint_failure" || trace.governance_issue === "runtime_failure") {
      return (
        <>
          <Button asChild className="bg-white" size="sm" type="button" variant="outline">
            <Link href={settingsHref}>{t("settings.tools.auditActions.reviewToolRuntime")}</Link>
          </Button>
          <Button asChild className="bg-white" size="sm" type="button" variant="outline">
            <Link href={boundAgentsHref}>{t("settings.tools.auditActions.openBoundAgents")}</Link>
          </Button>
        </>
      );
    }

    return null;
  }

  useEffect(() => {
    setModelPreviewResult(null);
  }, [selectedModelEndpointId]);

  useEffect(() => {
    setToolPreviewResult(null);
  }, [selectedToolRegistrationId]);

  useEffect(() => {
    if (visibleMcpConnectors.length === 0) {
      return;
    }

    if (!visibleMcpConnectors.some((item) => item.id === selectedMcpConnectorId)) {
      setSelectedMcpConnectorId(visibleMcpConnectors[0]?.id ?? "");
    }
  }, [selectedMcpConnectorId, visibleMcpConnectors]);

  useEffect(() => {
    if (visibleToolRegistrations.length === 0) {
      return;
    }

    if (!visibleToolRegistrations.some((item) => item.id === selectedToolRegistrationId)) {
      setSelectedToolRegistrationId(visibleToolRegistrations[0]?.id ?? "");
    }
  }, [selectedToolRegistrationId, visibleToolRegistrations]);

  useEffect(() => {
    if (!isVisible || typeof window === "undefined") {
      return;
    }

    const nextUrl = new URL(window.location.href);
    const runtimeResource = nextUrl.searchParams.get("runtime_resource");
    if (runtimeResource === "mcp_connector") {
      if (selectedMcpConnectorId) {
        nextUrl.searchParams.set("mcp_connector_id", selectedMcpConnectorId);
        const selectedMcpConnectorSlug = mcpConnectors.find((item) => item.id === selectedMcpConnectorId)?.slug ?? "";
        if (selectedMcpConnectorSlug) {
          nextUrl.searchParams.set("mcp_connector_slug", selectedMcpConnectorSlug);
        } else {
          nextUrl.searchParams.delete("mcp_connector_slug");
        }
      } else {
        nextUrl.searchParams.delete("mcp_connector_id");
        nextUrl.searchParams.delete("mcp_connector_slug");
      }
    } else if (runtimeResource === "model_endpoint") {
      if (selectedModelEndpointId) {
        nextUrl.searchParams.set("model_endpoint_id", selectedModelEndpointId);
      } else {
        nextUrl.searchParams.delete("model_endpoint_id");
      }
    } else if (runtimeResource === "tool_registration") {
      if (selectedToolRegistrationId) {
        nextUrl.searchParams.set("tool_registration_id", selectedToolRegistrationId);
      } else {
        nextUrl.searchParams.delete("tool_registration_id");
      }
    } else if (runtimeResource === "retrieval_profile") {
      if (selectedRetrievalProfileId) {
        nextUrl.searchParams.set("retrieval_profile_id", selectedRetrievalProfileId);
      } else {
        nextUrl.searchParams.delete("retrieval_profile_id");
      }
    } else {
      return;
    }

    window.history.replaceState({}, "", nextUrl);
  }, [isVisible, selectedMcpConnectorId, selectedModelEndpointId, selectedRetrievalProfileId, selectedToolRegistrationId]);

  function updateSelectedMcpConnector(updater: (draft: McpConnectorDraft) => McpConnectorDraft) {
    if (!selectedMcpConnectorId) {
      return;
    }

    setMcpConnectors((currentValue) =>
      currentValue.map((item) => (item.id === selectedMcpConnectorId ? updater(item) : item))
    );
    setErrorMessage(null);
  }

  function updateSelectedModelEndpoint(updater: (draft: ModelEndpointDraft) => ModelEndpointDraft) {
    if (!selectedModelEndpointId) {
      return;
    }

    setModelEndpoints((currentValue) =>
      currentValue.map((item) => (item.id === selectedModelEndpointId ? updater(item) : item))
    );
    setErrorMessage(null);
  }

  function updateSelectedToolRegistration(updater: (draft: ToolRegistrationDraft) => ToolRegistrationDraft) {
    if (!selectedToolRegistrationId) {
      return;
    }

    setToolRegistrations((currentValue) =>
      currentValue.map((item) => (item.id === selectedToolRegistrationId ? updater(item) : item))
    );
    setErrorMessage(null);
    setToolPreviewResult(null);
  }

  function updateSelectedRetrievalProfile(updater: (draft: RetrievalProfileDraft) => RetrievalProfileDraft) {
    if (!selectedRetrievalProfileId) {
      return;
    }

    setRetrievalProfiles((currentValue) =>
      currentValue.map((item) => (item.id === selectedRetrievalProfileId ? updater(item) : item))
    );
    setErrorMessage(null);
  }

  function handleCreateModelEndpoint() {
    if (!canManage) {
      return;
    }

    const nextDraft = createModelDraft(modelEndpoints.length + 1);
    setModelEndpoints((currentValue) => [nextDraft, ...currentValue]);
    setSelectedModelEndpointId(nextDraft.id);
    setStatusMessage(t("settings.models.createdDraft"));
  }

  function handleCreateOllamaModelEndpoint() {
    if (!canManage) {
      return;
    }

    const nextDraft = createOllamaModelDraft(modelEndpoints.length + 1, modelEndpoints.length === 0);
    setModelEndpoints((currentValue) =>
      nextDraft.is_default
        ? [nextDraft, ...currentValue.map((item) => ({ ...item, is_default: false }))]
        : [nextDraft, ...currentValue]
    );
    setSelectedModelEndpointId(nextDraft.id);
    setStatusMessage(t("settings.models.createdOllamaDraft"));
  }

  function handleCreateVllmModelEndpoint() {
    if (!canManage) {
      return;
    }

    const nextDraft = createVllmModelDraft(modelEndpoints.length + 1, modelEndpoints.length === 0);
    setModelEndpoints((currentValue) =>
      nextDraft.is_default
        ? [nextDraft, ...currentValue.map((item) => ({ ...item, is_default: false }))]
        : [nextDraft, ...currentValue]
    );
    setSelectedModelEndpointId(nextDraft.id);
    setStatusMessage(t("settings.models.createdVllmDraft"));
  }

  function handleCreateToolRegistration() {
    if (!canManage) {
      return;
    }

    const nextDraft = createToolDraft(toolRegistrations.length + 1);
    setToolRegistrations((currentValue) => [nextDraft, ...currentValue]);
    setSelectedToolRegistrationId(nextDraft.id);
    setStatusMessage(t("settings.tools.createdDraft"));
  }

  function handleCreateMcpConnector() {
    if (!canManage) {
      return;
    }

    const nextDraft = createMcpConnectorDraft(mcpConnectors.length + 1);
    setMcpConnectors((currentValue) => [nextDraft, ...currentValue]);
    setSelectedMcpConnectorId(nextDraft.id);
    setStatusMessage(t("settings.mcpConnectors.createdDraft"));
  }

  function handleCreateRetrievalProfile() {
    if (!canManage) {
      return;
    }

    const nextDraft = createRetrievalProfileDraft(retrievalProfiles.length + 1);
    setRetrievalProfiles((currentValue) => [nextDraft, ...currentValue]);
    setSelectedRetrievalProfileId(nextDraft.id);
    setStatusMessage(t("settings.retrievalProfiles.createdDraft"));
  }

  function handleOpenConnectorLinkedTools() {
    if (selectedMcpConnectorScopedTools.length === 0) {
      return;
    }

    setToolRegistrationListFilter("mcp_connector_configured");
    setSelectedToolRegistrationId(selectedMcpConnectorScopedTools[0].id);
    window.setTimeout(() => {
      toolSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  function handleFocusToolRegistration(toolRegistrationId: string) {
    setToolRegistrationListFilter("mcp_connector_configured");
    setSelectedToolRegistrationId(toolRegistrationId);
    window.setTimeout(() => {
      toolSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  function handleOpenLinkedConnector(connectorId: string) {
    setSelectedMcpConnectorId(connectorId);
    window.setTimeout(() => {
      toolSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  async function handleSaveModelEndpoint() {
    if (!canManage || !selectedModelEndpoint) {
      return;
    }

    const payload = buildModelEndpointPayload(selectedModelEndpoint);

    if (!payload.name || !payload.slug || !payload.model_name) {
      setErrorMessage(t("settings.governance.validationFailed"));
      setStatusMessage(t("settings.governance.validationFailed"));
      return;
    }

    try {
      setIsMutatingModel(true);
      setErrorMessage(null);
      const savedModelEndpoint = selectedModelEndpoint.id.startsWith("new-model-")
        ? await createModelEndpoint(payload)
        : await updateModelEndpoint(selectedModelEndpoint.id, payload);
      const savedDraft = mapModelEndpointToDraft(savedModelEndpoint);
      setModelEndpoints((currentValue) => {
        const withoutPreviousDefault = savedDraft.is_default
          ? currentValue.map((item) => ({ ...item, is_default: item.id === savedDraft.id ? item.is_default : false }))
          : currentValue;
        const hasExisting = withoutPreviousDefault.some((item) => item.id === selectedModelEndpoint.id);
        return hasExisting
          ? withoutPreviousDefault.map((item) =>
              item.id === selectedModelEndpoint.id ? savedDraft : savedDraft.is_default ? { ...item, is_default: false } : item
            )
          : [savedDraft, ...withoutPreviousDefault];
      });
      setSelectedModelEndpointId(savedDraft.id);
      setStatusMessage(t("settings.models.saved", { name: savedDraft.name }));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("settings.models.saveFailed"));
      setStatusMessage(t("settings.models.saveFailed"));
    } finally {
      setIsMutatingModel(false);
    }
  }

  async function handleSaveToolRegistration() {
    if (!canManage || !selectedToolRegistration) {
      return;
    }

    const payload = buildToolRegistrationPayload(selectedToolRegistration);

    if (!payload.name || !payload.slug) {
      setErrorMessage(t("settings.governance.validationFailed"));
      setStatusMessage(t("settings.governance.validationFailed"));
      return;
    }

    try {
      setIsMutatingTool(true);
      setErrorMessage(null);
      const savedToolRegistration = selectedToolRegistration.id.startsWith("new-tool-")
        ? await createToolRegistration(payload)
        : await updateToolRegistration(selectedToolRegistration.id, payload);
      const savedDraft = mapToolRegistrationToDraft(savedToolRegistration);
      const [nextConnectorSummary, nextConnectors] = await Promise.all([
        loadMcpConnectorGovernanceSummary(),
        listMcpConnectors(buildMcpConnectorFilters(mcpConnectorListFilter))
      ]);
      setToolRegistrations((currentValue) =>
        currentValue.some((item) => item.id === selectedToolRegistration.id)
          ? currentValue.map((item) => (item.id === selectedToolRegistration.id ? savedDraft : item))
          : [savedDraft, ...currentValue]
      );
      setMcpConnectorGovernanceSummary(nextConnectorSummary);
      setMcpConnectors(nextConnectors.map(mapMcpConnectorToDraft));
      setSelectedToolRegistrationId(savedDraft.id);
      setStatusMessage(t("settings.tools.saved", { name: savedDraft.name }));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("settings.tools.saveFailed"));
      setStatusMessage(t("settings.tools.saveFailed"));
    } finally {
      setIsMutatingTool(false);
    }
  }

  async function handleSaveMcpConnector() {
    if (!canManage || !selectedMcpConnector) {
      return;
    }

    const payload = buildMcpConnectorPayload(selectedMcpConnector);

    if (!payload.name || !payload.slug) {
      setErrorMessage(t("settings.governance.validationFailed"));
      setStatusMessage(t("settings.governance.validationFailed"));
      return;
    }

    try {
      setIsMutatingMcpConnector(true);
      setErrorMessage(null);
      const savedMcpConnector = selectedMcpConnector.id.startsWith("new-mcp-connector-")
        ? await createMcpConnector(payload)
        : await updateMcpConnector(selectedMcpConnector.id, payload);
      const savedDraft = mapMcpConnectorToDraft(savedMcpConnector);
      const [nextSummary, refreshedConnectors] = await Promise.all([
        loadMcpConnectorGovernanceSummary(),
        listMcpConnectors(buildMcpConnectorFilters(mcpConnectorListFilter))
      ]);
      setMcpConnectorGovernanceSummary(nextSummary);
      setMcpConnectors(
        refreshedConnectors.length > 0
          ? refreshedConnectors.map(mapMcpConnectorToDraft)
          : [savedDraft]
      );
      setSelectedMcpConnectorId(savedDraft.id);
      setStatusMessage(t("settings.mcpConnectors.saved", { name: savedDraft.name }));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("settings.mcpConnectors.saveFailed"));
      setStatusMessage(t("settings.mcpConnectors.saveFailed"));
    } finally {
      setIsMutatingMcpConnector(false);
    }
  }

  async function handlePreviewSelectedMcpConnector() {
    if (!selectedMcpConnector || selectedMcpConnector.id.startsWith("new-mcp-connector-")) {
      return;
    }

    try {
      setIsPreviewingMcpConnector(true);
      setErrorMessage(null);
      const previewResult = await previewMcpConnector(selectedMcpConnector.id);
      setMcpConnectorPreviewResult(previewResult);
      setStatusMessage(
        previewResult.error_message
          ? previewResult.error_message
          : previewResult.summary
      );
    } catch (error) {
      setMcpConnectorPreviewResult(null);
      setErrorMessage(error instanceof Error ? error.message : t("settings.mcpConnectors.previewFailed"));
      setStatusMessage(t("settings.mcpConnectors.previewFailed"));
    } finally {
      setIsPreviewingMcpConnector(false);
    }
  }

  async function handleApplyToolGovernanceAction(
    actionType: ToolGovernanceActionType,
    toolRegistrationId?: string
  ) {
    const targetToolRegistrationId = toolRegistrationId ?? selectedToolRegistration?.id;
    if (!canManage || !targetToolRegistrationId || targetToolRegistrationId.startsWith("new-tool-")) {
      return;
    }

    try {
      setIsMutatingTool(true);
      setErrorMessage(null);
      const response = await applyToolGovernanceAction(targetToolRegistrationId, actionType);
      const savedDraft = mapToolRegistrationToDraft(response.tool_registration);
      const [nextToolGovernanceSummary, nextMcpConnectorSummary, nextMcpConnectors, visibleToolRegistrations, boundaryWorklist] = await Promise.all([
        loadToolGovernanceSummary(),
        loadMcpConnectorGovernanceSummary(),
        listMcpConnectors(buildMcpConnectorFilters(mcpConnectorListFilter)),
        listToolRegistrations(buildToolRegistrationFilters(toolRegistrationListFilter)),
        mcpBoundaryTenantId
          ? loadToolMcpBoundaryWorklist({
              tenant_id: mcpBoundaryTenantId,
              limit: 6
            })
          : Promise.resolve(null)
      ]);

      setToolGovernanceSummary(nextToolGovernanceSummary);
      setMcpConnectorGovernanceSummary(nextMcpConnectorSummary);
      setMcpConnectors(nextMcpConnectors.map(mapMcpConnectorToDraft));
      setToolRegistrations(visibleToolRegistrations.map(mapToolRegistrationToDraft));
      setSelectedToolRegistrationId(savedDraft.id);

      if (boundaryWorklist) {
        setToolMcpBoundaryWorklist(boundaryWorklist);
      }

      const actionMessageKey: Record<ToolGovernanceActionType, string> = {
        disable_tool: "settings.tools.governanceActions.disabledApplied",
        enable_tool: "settings.tools.governanceActions.enabledApplied",
        require_admin_approval: "settings.tools.governanceActions.approvalApplied",
        allow_direct_use: "settings.tools.governanceActions.directUseApplied",
        quarantine_tool: "settings.tools.governanceActions.quarantineApplied",
        review_mcp_boundary: "settings.tools.governanceActions.reviewBoundaryApplied",
        ready_mcp_integration: "settings.tools.governanceActions.readyBoundaryApplied",
        quarantine_mcp_boundary: "settings.tools.governanceActions.quarantineBoundaryApplied",
      };
      setStatusMessage(t(actionMessageKey[actionType], { name: savedDraft.name || savedDraft.slug }));
    } catch (error) {
      const errorMessage =
        error instanceof Error &&
        error.message.includes("connector_reference")
          ? t("settings.tools.governanceActions.connectorRequired")
          : error instanceof Error
            ? error.message
            : t("settings.tools.governanceActions.applyFailed");
      setErrorMessage(errorMessage);
      setStatusMessage(t("settings.tools.governanceActions.applyFailed"));
    } finally {
      setIsMutatingTool(false);
    }
  }

  async function handleSaveRetrievalProfile() {
    if (!canManage || !selectedRetrievalProfile) {
      return;
    }

    const payload = buildRetrievalProfilePayload(selectedRetrievalProfile);
    if (!payload.name || !payload.slug) {
      setErrorMessage(t("settings.governance.validationFailed"));
      setStatusMessage(t("settings.governance.validationFailed"));
      return;
    }

    try {
      setIsMutatingRetrievalProfile(true);
      setErrorMessage(null);
      const savedRetrievalProfile = selectedRetrievalProfile.id.startsWith("new-retrieval-profile-")
        ? await createRetrievalProfile(payload)
        : await updateRetrievalProfile(selectedRetrievalProfile.id, payload);
      const savedDraft = mapRetrievalProfileToDraft(savedRetrievalProfile);
      setRetrievalProfiles((currentValue) => {
        const withoutPreviousDefault = savedDraft.is_default
          ? currentValue.map((item) => ({ ...item, is_default: item.id === savedDraft.id ? item.is_default : false }))
          : currentValue;
        const hasExisting = withoutPreviousDefault.some((item) => item.id === selectedRetrievalProfile.id);
        return hasExisting
          ? withoutPreviousDefault.map((item) =>
              item.id === selectedRetrievalProfile.id ? savedDraft : savedDraft.is_default ? { ...item, is_default: false } : item
            )
          : [savedDraft, ...withoutPreviousDefault];
      });
      setSelectedRetrievalProfileId(savedDraft.id);
      setStatusMessage(t("settings.retrievalProfiles.saved", { name: savedDraft.name }));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("settings.retrievalProfiles.saveFailed"));
      setStatusMessage(t("settings.retrievalProfiles.saveFailed"));
    } finally {
      setIsMutatingRetrievalProfile(false);
    }
  }

  async function handleDeleteModelEndpoint() {
    if (!canManage || !selectedModelEndpoint) {
      return;
    }
    if (selectedModelEndpoint.bound_agent_count > 0 && !selectedModelEndpoint.id.startsWith("new-model-")) {
      setErrorMessage(t("settings.governance.deleteBlockedInUse"));
      setStatusMessage(t("settings.governance.deleteBlockedInUse"));
      return;
    }

    if (!window.confirm(t("settings.models.deleteConfirm", { name: selectedModelEndpoint.name || selectedModelEndpoint.slug }))) {
      return;
    }

    try {
      setIsMutatingModel(true);
      setErrorMessage(null);
      if (!selectedModelEndpoint.id.startsWith("new-model-")) {
        await deleteModelEndpoint(selectedModelEndpoint.id);
      }
      setModelEndpoints((currentValue) => currentValue.filter((item) => item.id !== selectedModelEndpoint.id));
      setSelectedModelEndpointId((currentValue) =>
        currentValue === selectedModelEndpoint.id
          ? modelEndpoints.find((item) => item.id !== selectedModelEndpoint.id)?.id ?? ""
          : currentValue
      );
      setStatusMessage(t("settings.models.deleted", { name: selectedModelEndpoint.name || selectedModelEndpoint.slug }));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("settings.models.deleteFailed"));
      setStatusMessage(t("settings.models.deleteFailed"));
    } finally {
      setIsMutatingModel(false);
    }
  }

  async function handleDeleteToolRegistration() {
    if (!canManage || !selectedToolRegistration) {
      return;
    }
    if (selectedToolRegistration.bound_agent_count > 0 && !selectedToolRegistration.id.startsWith("new-tool-")) {
      setErrorMessage(t("settings.governance.deleteBlockedInUse"));
      setStatusMessage(t("settings.governance.deleteBlockedInUse"));
      return;
    }

    if (!window.confirm(t("settings.tools.deleteConfirm", { name: selectedToolRegistration.name || selectedToolRegistration.slug }))) {
      return;
    }

    try {
      setIsMutatingTool(true);
      setErrorMessage(null);
      if (!selectedToolRegistration.id.startsWith("new-tool-")) {
        await deleteToolRegistration(selectedToolRegistration.id);
      }
      const [nextConnectorSummary, nextConnectors] = await Promise.all([
        loadMcpConnectorGovernanceSummary(),
        listMcpConnectors(buildMcpConnectorFilters(mcpConnectorListFilter))
      ]);
      setToolRegistrations((currentValue) => currentValue.filter((item) => item.id !== selectedToolRegistration.id));
      setMcpConnectorGovernanceSummary(nextConnectorSummary);
      setMcpConnectors(nextConnectors.map(mapMcpConnectorToDraft));
      setSelectedToolRegistrationId((currentValue) =>
        currentValue === selectedToolRegistration.id
          ? toolRegistrations.find((item) => item.id !== selectedToolRegistration.id)?.id ?? ""
          : currentValue
      );
      setStatusMessage(t("settings.tools.deleted", { name: selectedToolRegistration.name || selectedToolRegistration.slug }));
      setToolPreviewResult(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("settings.tools.deleteFailed"));
      setStatusMessage(t("settings.tools.deleteFailed"));
    } finally {
      setIsMutatingTool(false);
    }
  }

  async function handleDeleteMcpConnector() {
    if (!canManage || !selectedMcpConnector) {
      return;
    }
    if (
      selectedMcpConnector.referenced_tool_count > 0 &&
      !selectedMcpConnector.id.startsWith("new-mcp-connector-")
    ) {
      setErrorMessage(t("settings.governance.deleteBlockedInUse"));
      setStatusMessage(t("settings.governance.deleteBlockedInUse"));
      return;
    }

    if (!window.confirm(t("settings.mcpConnectors.deleteConfirm", { name: selectedMcpConnector.name || selectedMcpConnector.slug }))) {
      return;
    }

    try {
      setIsMutatingMcpConnector(true);
      setErrorMessage(null);
      if (!selectedMcpConnector.id.startsWith("new-mcp-connector-")) {
        await deleteMcpConnector(selectedMcpConnector.id);
      }
      const removedId = selectedMcpConnector.id;
      setMcpConnectors((currentValue) => currentValue.filter((item) => item.id !== removedId));
      setSelectedMcpConnectorId((currentValue) =>
        currentValue === removedId
          ? mcpConnectors.find((item) => item.id !== removedId)?.id ?? ""
          : currentValue
      );
      setMcpConnectorGovernanceSummary(await loadMcpConnectorGovernanceSummary());
      setStatusMessage(t("settings.mcpConnectors.deleted", { name: selectedMcpConnector.name || selectedMcpConnector.slug }));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("settings.mcpConnectors.deleteFailed"));
      setStatusMessage(t("settings.mcpConnectors.deleteFailed"));
    } finally {
      setIsMutatingMcpConnector(false);
    }
  }

  async function handleDeleteRetrievalProfile() {
    if (!canManage || !selectedRetrievalProfile) {
      return;
    }
    if (selectedRetrievalProfile.bound_knowledge_base_count > 0 && !selectedRetrievalProfile.id.startsWith("new-retrieval-profile-")) {
      setErrorMessage(t("settings.governance.deleteBlockedInUse"));
      setStatusMessage(t("settings.governance.deleteBlockedInUse"));
      return;
    }

    if (!window.confirm(t("settings.retrievalProfiles.deleteConfirm", { name: selectedRetrievalProfile.name || selectedRetrievalProfile.slug }))) {
      return;
    }

    try {
      setIsMutatingRetrievalProfile(true);
      setErrorMessage(null);
      if (!selectedRetrievalProfile.id.startsWith("new-retrieval-profile-")) {
        await deleteRetrievalProfile(selectedRetrievalProfile.id);
      }
      setRetrievalProfiles((currentValue) => currentValue.filter((item) => item.id !== selectedRetrievalProfile.id));
      setSelectedRetrievalProfileId((currentValue) =>
        currentValue === selectedRetrievalProfile.id
          ? retrievalProfiles.find((item) => item.id !== selectedRetrievalProfile.id)?.id ?? ""
          : currentValue
      );
      setStatusMessage(
        t("settings.retrievalProfiles.deleted", { name: selectedRetrievalProfile.name || selectedRetrievalProfile.slug })
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("settings.retrievalProfiles.deleteFailed"));
      setStatusMessage(t("settings.retrievalProfiles.deleteFailed"));
    } finally {
      setIsMutatingRetrievalProfile(false);
    }
  }

  async function handlePreviewToolRegistration() {
    if (!selectedToolRegistration || selectedToolRegistration.id.startsWith("new-tool-")) {
      return;
    }
    if (!selectedToolPreviewTenantId) {
      setErrorMessage(t("settings.tools.previewScopeMissing"));
      setStatusMessage(t("settings.tools.previewScopeMissing"));
      return;
    }

    try {
      setIsPreviewingTool(true);
      setErrorMessage(null);
      const previewResult = await previewToolRegistration(selectedToolRegistration.id, {
        tenant_id: selectedToolPreviewTenantId,
        execution_input: selectedToolRegistration.description || selectedToolRegistration.name || null
      });
      setToolPreviewResult(previewResult);
      setStatusMessage(
        t("settings.tools.previewLoaded", {
          name: previewResult.name
        })
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("settings.tools.previewFailed"));
      setStatusMessage(t("settings.tools.previewFailed"));
    } finally {
      setIsPreviewingTool(false);
    }
  }

  async function handlePreviewModelEndpoint() {
    if (!selectedModelEndpoint || selectedModelEndpoint.id.startsWith("new-model-")) {
      setErrorMessage(t("settings.models.previewSaveFirst"));
      setStatusMessage(t("settings.models.previewSaveFirst"));
      return;
    }

    try {
      setIsPreviewingModel(true);
      setErrorMessage(null);
      const previewResult = await previewModelEndpoint(selectedModelEndpoint.id);
      setModelPreviewResult(previewResult);
      setStatusMessage(
        t("settings.models.previewLoaded", {
          name: previewResult.name
        })
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("settings.models.previewFailed"));
      setStatusMessage(t("settings.models.previewFailed"));
    } finally {
      setIsPreviewingModel(false);
    }
  }

  function toggleModelCapability(capability: ModelCapability) {
    if (!canManage) {
      return;
    }

    updateSelectedModelEndpoint((draft) => ({
      ...draft,
      capabilities: draft.capabilities.includes(capability)
        ? draft.capabilities.filter((item) => item !== capability)
        : [...draft.capabilities, capability]
    }));
  }

  if (!isVisible) {
    return null;
  }

  return (
    <div className="grid gap-6">
      <ConsoleSurface>
        <ConsoleSurfaceHeader
          action={
            <ConsoleOutlineBadge>
              {t("settings.governance.counts", {
                models: String(modelEndpoints.length),
                tools: String(toolRegistrations.length),
                retrievalProfiles: String(retrievalProfiles.length)
              })}
            </ConsoleOutlineBadge>
          }
          description={t("settings.governance.description")}
          title={t("settings.governance.title")}
        />
        <div className="space-y-3 px-6 pb-6">
          <div className="grid gap-4 lg:grid-cols-5">
            <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-4">
              <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">{t("settings.governance.metrics.modelEndpoints")}</div>
              <div className="mt-3 text-2xl font-semibold text-slate-950">{modelEndpoints.length}</div>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-4">
              <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">{t("settings.governance.metrics.defaultModel")}</div>
              <div className="mt-3 text-sm font-semibold text-slate-950">
                {modelEndpoints.find((item) => item.is_default)?.name || t("settings.governance.empty")}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-4">
              <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">{t("settings.governance.metrics.enabledTools")}</div>
              <div className="mt-3 text-2xl font-semibold text-slate-950">{toolGovernanceSummary.enabled_tools}</div>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-4">
              <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">{t("settings.governance.metrics.retrievalProfiles")}</div>
              <div className="mt-3 text-2xl font-semibold text-slate-950">{retrievalProfiles.length}</div>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-4">
              <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">{t("settings.governance.metrics.adminApproval")}</div>
              <div className="mt-3 text-2xl font-semibold text-slate-950">
                {toolGovernanceSummary.approval_required_tools}
              </div>
            </div>
          </div>
          <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-4">
                <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
                  {t("settings.governance.posture.disabledBoundModels")}
                </div>
                <div className="mt-3 text-2xl font-semibold text-slate-950">{governancePosture.disabledBoundModels}</div>
                <div className="mt-2 text-sm text-slate-500">{t("settings.governance.posture.disabledBoundModelsHint")}</div>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-4">
                <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
                  {t("settings.governance.posture.disabledBoundTools")}
                </div>
                <div className="mt-3 text-2xl font-semibold text-slate-950">{governancePosture.disabledBoundTools}</div>
                <div className="mt-2 text-sm text-slate-500">{t("settings.governance.posture.disabledBoundToolsHint")}</div>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-4">
                <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
                  {t("settings.governance.posture.approvalGatedTools")}
                </div>
                <div className="mt-3 text-2xl font-semibold text-slate-950">{governancePosture.approvalGatedTools}</div>
                <div className="mt-2 text-sm text-slate-500">{t("settings.governance.posture.approvalGatedToolsHint")}</div>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-4">
                <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
                  {t("settings.governance.posture.unboundEnabledRuntime")}
                </div>
                <div className="mt-3 text-2xl font-semibold text-slate-950">
                  {governancePosture.unboundEnabledModels + governancePosture.unboundEnabledTools}
                </div>
                <div className="mt-2 text-sm text-slate-500">{t("settings.governance.posture.unboundEnabledRuntimeHint")}</div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-4">
              <div className="text-sm font-semibold text-slate-950">{t("settings.governance.posture.quickActions")}</div>
              <div className="mt-2 text-sm leading-6 text-slate-500">{t("settings.governance.posture.quickActionsDescription")}</div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button asChild className="bg-white" size="sm" type="button" variant="outline">
                  <Link href={buildAgentsHref({ status: "active", readiness: "attention" })}>
                    {t("settings.governance.posture.openAttentionAgents")}
                  </Link>
                </Button>
                <Button asChild className="bg-white" size="sm" type="button" variant="outline">
                  <Link href={buildAdminHref({ section: "overview" })}>{t("settings.governance.posture.openAdminOverview")}</Link>
                </Button>
                <Button asChild className="bg-white" size="sm" type="button" variant="outline">
                  <Link href={buildAgentsHref({ status: "active" })}>{t("settings.governance.posture.openActiveAgents")}</Link>
                </Button>
              </div>
              <div className="mt-5 text-sm font-semibold text-slate-950">{t("settings.governance.posture.issueActions")}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button asChild className="bg-white" size="sm" type="button" variant="outline">
                  <Link href={buildAgentsHref({ status: "active", readiness: "attention", issue: "scope_missing" })}>
                    {t("agents.readiness.issueLabels.scope_missing")}
                  </Link>
                </Button>
                <Button asChild className="bg-white" size="sm" type="button" variant="outline">
                  <Link href={buildAgentsHref({ status: "active", readiness: "attention", issue: "model_missing" })}>
                    {t("agents.readiness.issueLabels.model_missing")}
                  </Link>
                </Button>
                <Button asChild className="bg-white" size="sm" type="button" variant="outline">
                  <Link href={buildAgentsHref({ status: "active", readiness: "attention", issue: "model_disabled" })}>
                    {t("agents.readiness.issueLabels.model_disabled")}
                  </Link>
                </Button>
                <Button asChild className="bg-white" size="sm" type="button" variant="outline">
                  <Link href={buildAgentsHref({ status: "active", readiness: "attention", issue: "retrieval_profile_missing" })}>
                    {t("agents.readiness.issueLabels.retrieval_profile_missing")}
                  </Link>
                </Button>
                <Button asChild className="bg-white" size="sm" type="button" variant="outline">
                  <Link href={buildAgentsHref({ status: "active", readiness: "attention", issue: "retrieval_profile_disabled" })}>
                    {t("agents.readiness.issueLabels.retrieval_profile_disabled")}
                  </Link>
                </Button>
                <Button asChild className="bg-white" size="sm" type="button" variant="outline">
                  <Link href={buildAgentsHref({ status: "active", readiness: "attention", issue: "tools_missing" })}>
                    {t("agents.readiness.issueLabels.tools_missing")}
                  </Link>
                </Button>
                <Button asChild className="bg-white" size="sm" type="button" variant="outline">
                  <Link href={buildAgentsHref({ status: "active", readiness: "attention", issue: "tool_registration_disabled" })}>
                    {t("agents.readiness.issueLabels.tool_registration_disabled")}
                  </Link>
                </Button>
                <Button asChild className="bg-white" size="sm" type="button" variant="outline">
                  <Link href={buildAgentsHref({ status: "active", issue: "tool_approval_required" })}>
                    {t("agents.readiness.issueLabels.tool_approval_required")}
                  </Link>
                </Button>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-4 text-sm text-slate-600">
            {isLoading ? t("settings.governance.loading") : statusMessage || t("settings.governance.ready")}
          </div>
          {errorMessage ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">{errorMessage}</div> : null}
        </div>
      </ConsoleSurface>

      <div className="grid gap-6 xl:grid-cols-3">
        <div ref={modelSectionRef}>
        <ConsoleSurface>
          <ConsoleSurfaceHeader
            action={
              canManage ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Button className="rounded-xl" onClick={handleCreateOllamaModelEndpoint} type="button" variant="outline">
                    <Server className="h-4 w-4" />
                    {t("settings.models.newOllama")}
                  </Button>
                  <Button className="rounded-xl" onClick={handleCreateVllmModelEndpoint} type="button" variant="outline">
                    <Server className="h-4 w-4" />
                    {t("settings.models.newVllm")}
                  </Button>
                  <Button className="rounded-xl" onClick={handleCreateModelEndpoint} type="button" variant="outline">
                    <Plus className="h-4 w-4" />
                    {t("settings.models.new")}
                  </Button>
                </div>
              ) : (
                <ConsoleOutlineBadge>{t("settings.governance.readOnly")}</ConsoleOutlineBadge>
              )
            }
            description={t("settings.models.description")}
            title={t("settings.models.title")}
          />
          <div className="grid gap-4 px-6 pt-2 pb-0 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-4">
              <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
                {t("settings.models.governance.runtimeReady")}
              </div>
              <div className="mt-3 text-2xl font-semibold text-slate-950">{modelGovernanceSummary.runtime_ready_endpoints}</div>
              <div className="mt-2 text-sm text-slate-500">
                {t("settings.models.governance.disabledBound", {
                  count: String(modelGovernanceSummary.disabled_bound_endpoints)
                })}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-4">
              <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
                {t("settings.models.governance.localOllama")}
              </div>
              <div className="mt-3 text-2xl font-semibold text-slate-950">{modelGovernanceSummary.ollama_endpoints}</div>
              <div className="mt-2 text-sm text-slate-500">
                {t("settings.models.governance.localVllm", {
                  count: String(modelGovernanceSummary.vllm_endpoints)
                })}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-4">
              <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
                {t("settings.models.governance.missingBaseUrl")}
              </div>
              <div className="mt-3 text-2xl font-semibold text-slate-950">{modelGovernanceSummary.missing_base_url_endpoints}</div>
              <div className="mt-2 text-sm text-slate-500">
                {t("settings.models.governance.envCredential", {
                  count: String(modelGovernanceSummary.environment_credential_endpoints)
                })}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-4">
              <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
                {t("settings.models.governance.managedReserved")}
              </div>
              <div className="mt-3 text-2xl font-semibold text-slate-950">
                {modelGovernanceSummary.managed_reserved_credential_endpoints}
              </div>
              <div className="mt-2 text-sm text-slate-500">
                {t("settings.models.governance.enabledDefaults", {
                  count: String(modelGovernanceSummary.enabled_default_endpoints)
                })}
              </div>
            </div>
          </div>
          <div className="px-6 pt-4 pb-0">
            <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-950">{t("settings.tools.mcpWorklist.title")}</div>
                  <div className="mt-1 text-sm text-slate-500">
                    {mcpBoundaryTenantId
                      ? t("settings.tools.mcpWorklist.ready", {
                          count: String(toolMcpBoundaryWorklist.bound_reserved_tools),
                          traces: String(toolMcpBoundaryWorklist.reserved_trace_count)
                        })
                      : t("settings.tools.mcpWorklist.scopeMissing")}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <ConsoleOutlineBadge>
                    {t("settings.tools.mcpWorklist.total", { count: String(toolMcpBoundaryWorklist.total_reserved_tools) })}
                  </ConsoleOutlineBadge>
                  <ConsoleOutlineBadge>
                    {t("settings.tools.mcpWorklist.bound", { count: String(toolMcpBoundaryWorklist.bound_reserved_tools) })}
                  </ConsoleOutlineBadge>
                  <ConsoleOutlineBadge>
                    {t("settings.tools.mcpWorklist.reviewing", { count: String(toolMcpBoundaryWorklist.reviewing_tools) })}
                  </ConsoleOutlineBadge>
                  <ConsoleOutlineBadge>
                    {t("settings.tools.mcpWorklist.readyForIntegration", {
                      count: String(toolMcpBoundaryWorklist.ready_for_integration_tools)
                    })}
                  </ConsoleOutlineBadge>
                  <ConsoleOutlineBadge>
                    {t("settings.tools.mcpWorklist.quarantined", {
                      count: String(toolMcpBoundaryWorklist.quarantined_tools)
                    })}
                  </ConsoleOutlineBadge>
                </div>
              </div>
              {toolMcpBoundaryWorklist.items.length > 0 ? (
                <div className="mt-4 grid gap-3 xl:grid-cols-2">
                  {toolMcpBoundaryWorklist.items.map((item) => (
                    <div className="rounded-xl border border-slate-200 bg-white px-4 py-4" key={item.tool_registration_id}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-slate-950">{item.name}</div>
                          <div className="mt-1 truncate text-xs text-slate-400">{item.slug}</div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge className={cn("border", getMcpBoundaryStatusClass(item.boundary_status))} variant="outline">
                            {t(`settings.tools.mcpWorklist.statuses.${item.boundary_status}`)}
                          </Badge>
                          <Badge className={cn("border", getToolAuditIssueClass(item.latest_governance_issue))} variant="outline">
                            {t("settings.tools.transports.mcp_reserved")}
                          </Badge>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <ConsoleOutlineBadge>{t("settings.tools.mcpWorklist.bound", { count: String(item.bound_agent_count) })}</ConsoleOutlineBadge>
                        <ConsoleOutlineBadge>
                          {t("settings.tools.mcpWorklist.reservedTraces", { count: String(item.reserved_trace_count) })}
                        </ConsoleOutlineBadge>
                        <ConsoleOutlineBadge>{t(`settings.tools.surfaces.${item.surface_area}`)}</ConsoleOutlineBadge>
                        {item.connector_reference ? (
                          <ConsoleOutlineBadge className="border-indigo-200 bg-indigo-50 text-indigo-700">
                            {t("settings.tools.connectorConfiguredBadge")}
                          </ConsoleOutlineBadge>
                        ) : null}
                        {item.requires_admin_approval ? (
                          <ConsoleOutlineBadge>{t("settings.tools.adminApproval")}</ConsoleOutlineBadge>
                        ) : null}
                      </div>
                      <div className="mt-3 text-sm leading-6 text-slate-600">
                        {item.latest_summary ?? t("settings.tools.mcpWorklist.noRecentTrace")}
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {canManage && item.available_actions.includes("review_mcp_boundary") ? (
                          <Button
                            className="bg-white"
                            disabled={isMutatingTool}
                            onClick={() => void handleApplyToolGovernanceAction("review_mcp_boundary", item.tool_registration_id)}
                            size="sm"
                            type="button"
                            variant="outline"
                          >
                            {t("settings.tools.mcpWorklist.actions.review")}
                          </Button>
                        ) : null}
                        {canManage && item.available_actions.includes("ready_mcp_integration") ? (
                          <Button
                            className="bg-white"
                            disabled={isMutatingTool}
                            onClick={() => void handleApplyToolGovernanceAction("ready_mcp_integration", item.tool_registration_id)}
                            size="sm"
                            type="button"
                            variant="outline"
                          >
                            {t("settings.tools.mcpWorklist.actions.ready")}
                          </Button>
                        ) : null}
                        {canManage && item.available_actions.includes("quarantine_mcp_boundary") ? (
                          <Button
                            className="bg-white"
                            disabled={isMutatingTool}
                            onClick={() => void handleApplyToolGovernanceAction("quarantine_mcp_boundary", item.tool_registration_id)}
                            size="sm"
                            type="button"
                            variant="outline"
                          >
                            {t("settings.tools.mcpWorklist.actions.quarantine")}
                          </Button>
                        ) : null}
                        <Button asChild className="bg-white" size="sm" type="button" variant="outline">
                          <Link
                            href={buildToolTraceSettingsHref({
                              toolRegistrationId: item.tool_registration_id,
                              governanceIssue:
                                item.boundary_status === "ready_for_integration"
                                  ? "mcp_integration_pending"
                                  : "mcp_reserved",
                              connectorReference: item.connector_reference
                            })}
                          >
                            {t("settings.tools.auditActions.openToolSettings")}
                          </Link>
                        </Button>
                        {item.bound_agent_count > 0 ? (
                          <Button asChild className="bg-white" size="sm" type="button" variant="outline">
                            <Link
                              href={buildAgentsHref({
                                status: "active",
                                toolRegistrationId: item.tool_registration_id
                              })}
                            >
                              {t("settings.tools.auditActions.openBoundAgents")}
                            </Link>
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-white px-3 py-4 text-sm text-slate-500">
                  {t("settings.tools.mcpWorklist.empty")}
                </div>
              )}
            </div>
          </div>
          <div className="px-6 pt-6">
            <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-950">{t("settings.mcpConnectors.title")}</div>
                  <div className="mt-1 text-sm text-slate-500">{t("settings.mcpConnectors.description")}</div>
                </div>
                {canManage ? (
                  <Button className="rounded-xl bg-white" onClick={handleCreateMcpConnector} type="button" variant="outline">
                    <Plus className="h-4 w-4" />
                    {t("settings.mcpConnectors.new")}
                  </Button>
                ) : null}
              </div>
              <div className="mt-4 grid gap-4 lg:grid-cols-4">
                <div className="rounded-2xl border border-slate-100 bg-white px-4 py-4">
                  <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
                    {t("settings.mcpConnectors.governance.total")}
                  </div>
                  <div className="mt-3 text-2xl font-semibold text-slate-950">{mcpConnectorGovernanceSummary.total_connectors}</div>
                  <div className="mt-2 text-sm text-slate-500">
                    {t("settings.mcpConnectors.governance.referenced", {
                      count: String(mcpConnectorGovernanceSummary.referenced_connectors)
                    })}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-white px-4 py-4">
                  <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
                    {t("settings.mcpConnectors.governance.runtimeReadyLabel")}
                  </div>
                  <div className="mt-3 text-2xl font-semibold text-slate-950">{mcpConnectorGovernanceSummary.runtime_ready_connectors}</div>
                  <div className="mt-2 text-sm text-slate-500">
                    {t("settings.mcpConnectors.governance.integrationReady", {
                      count: String(mcpConnectorGovernanceSummary.integration_ready_connectors)
                    })}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-white px-4 py-4">
                  <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
                    {t("settings.mcpConnectors.governance.missingBaseUrlLabel")}
                  </div>
                  <div className="mt-3 text-2xl font-semibold text-slate-950">{mcpConnectorGovernanceSummary.missing_base_url_connectors}</div>
                  <div className="mt-2 text-sm text-slate-500">
                    {t("settings.mcpConnectors.governance.missingCredentialHint", {
                      count: String(mcpConnectorGovernanceSummary.missing_credential_hint_connectors)
                    })}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-white px-4 py-4">
                  <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
                    {t("settings.mcpConnectors.governance.managedReservedLabel")}
                  </div>
                  <div className="mt-3 text-2xl font-semibold text-slate-950">{mcpConnectorGovernanceSummary.managed_reserved_connectors}</div>
                  <div className="mt-2 text-sm text-slate-500">
                    {t("settings.mcpConnectors.governance.enabled", {
                      count: String(mcpConnectorGovernanceSummary.enabled_connectors)
                    })}
                  </div>
                </div>
              </div>
              <div className="mt-4 grid gap-6 xl:grid-cols-[220px_minmax(0,1fr)]">
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      className="rounded-xl bg-white"
                      onClick={() => setMcpConnectorListFilter("all")}
                      size="sm"
                      type="button"
                      variant={mcpConnectorListFilter === "all" ? "default" : "outline"}
                    >
                      {t("settings.mcpConnectors.filters.all")}
                    </Button>
                    <Button
                      className="rounded-xl bg-white"
                      onClick={() => setMcpConnectorListFilter("referenced")}
                      size="sm"
                      type="button"
                      variant={mcpConnectorListFilter === "referenced" ? "default" : "outline"}
                    >
                      {t("settings.mcpConnectors.filters.referenced")}
                    </Button>
                    <Button
                      className="rounded-xl bg-white"
                      onClick={() => setMcpConnectorListFilter("runtime_ready")}
                      size="sm"
                      type="button"
                      variant={mcpConnectorListFilter === "runtime_ready" ? "default" : "outline"}
                    >
                      {t("settings.mcpConnectors.filters.runtimeReady")}
                    </Button>
                    <Button
                      className="rounded-xl bg-white"
                      onClick={() => setMcpConnectorListFilter("missing_base_url")}
                      size="sm"
                      type="button"
                      variant={mcpConnectorListFilter === "missing_base_url" ? "default" : "outline"}
                    >
                      {t("settings.mcpConnectors.filters.missingBaseUrl")}
                    </Button>
                    <Button
                      className="rounded-xl bg-white"
                      onClick={() => setMcpConnectorListFilter("managed_reserved")}
                      size="sm"
                      type="button"
                      variant={mcpConnectorListFilter === "managed_reserved" ? "default" : "outline"}
                    >
                      {t("settings.mcpConnectors.filters.managedReserved")}
                    </Button>
                  </div>
                  {visibleMcpConnectors.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">
                      {mcpConnectors.length === 0
                        ? t("settings.mcpConnectors.empty")
                        : t("settings.mcpConnectors.filters.empty")}
                    </div>
                  ) : (
                    visibleMcpConnectors.map((item) => (
                      <button
                        className={cn(
                          "w-full rounded-[18px] border px-4 py-4 text-left transition",
                          selectedMcpConnectorId === item.id
                            ? "border-blue-200 bg-blue-50/70"
                            : "border-slate-200 bg-white hover:border-slate-300"
                        )}
                        key={item.id}
                        onClick={() => setSelectedMcpConnectorId(item.id)}
                        type="button"
                      >
                        <div className="truncate text-sm font-semibold text-slate-950">{item.name || t("settings.governance.unsaved")}</div>
                        <div className="mt-1 truncate text-xs text-slate-400">{item.slug}</div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <ConsoleOutlineBadge>{t(`settings.mcpConnectors.types.${item.connector_type}`)}</ConsoleOutlineBadge>
                          <ConsoleOutlineBadge>{t(`settings.mcpConnectors.authModes.${item.auth_mode}`)}</ConsoleOutlineBadge>
                          {item.referenced_tool_count > 0 ? (
                            <ConsoleOutlineBadge className="border-cyan-200 bg-cyan-50 text-cyan-700">
                              {t("settings.mcpConnectors.governance.referenced", { count: String(item.referenced_tool_count) })}
                            </ConsoleOutlineBadge>
                          ) : null}
                          {!item.is_enabled ? (
                            <ConsoleOutlineBadge className="border-slate-200 bg-slate-50 text-slate-700">
                              {t("settings.tools.filters.disabled")}
                            </ConsoleOutlineBadge>
                          ) : null}
                        </div>
                      </button>
                    ))
                  )}
                </div>
                {selectedMcpConnector ? (
                  <div className="space-y-4 rounded-2xl border border-slate-100 bg-white p-4">
                    {selectedMcpConnectorPacket ? (
                      <ConsoleActionPacketCard
                        detail={selectedMcpConnectorPacket.detail}
                        metricLabel={t("settings.governance.followUpMetric")}
                        metricValue={selectedMcpConnectorPacket.metricValue}
                        primaryActionHref={selectedMcpConnectorPacket.primaryActionHref}
                        primaryActionLabel={selectedMcpConnectorPacket.primaryActionLabel}
                        secondaryActions={selectedMcpConnectorPacket.secondaryActions}
                        status={selectedMcpConnectorPacket.status}
                        statusLabel={selectedMcpConnectorPacket.statusLabel}
                        title={selectedMcpConnectorPacket.title}
                      />
                    ) : null}
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">{t("settings.mcpConnectors.name")}</div>
                        <Input
                          disabled={!canManage}
                          onChange={(event) => updateSelectedMcpConnector((draft) => ({ ...draft, name: event.target.value }))}
                          value={selectedMcpConnector.name}
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">{t("settings.mcpConnectors.slug")}</div>
                        <Input
                          disabled={!canManage}
                          onChange={(event) => updateSelectedMcpConnector((draft) => ({ ...draft, slug: slugifyValue(event.target.value) }))}
                          value={selectedMcpConnector.slug}
                        />
                      </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">{t("settings.mcpConnectors.connectorType")}</div>
                        <Select
                          disabled={!canManage}
                          onValueChange={(value) =>
                            updateSelectedMcpConnector((draft) => ({ ...draft, connector_type: value as McpConnectorType }))
                          }
                          value={selectedMcpConnector.connector_type}
                        >
                          <SelectTrigger className="bg-white">
                            <SelectValue placeholder={t("settings.mcpConnectors.connectorType")} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="streamable_http">{t("settings.mcpConnectors.types.streamable_http")}</SelectItem>
                            <SelectItem value="sse">{t("settings.mcpConnectors.types.sse")}</SelectItem>
                            <SelectItem value="managed_reserved">{t("settings.mcpConnectors.types.managed_reserved")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">{t("settings.mcpConnectors.authMode")}</div>
                        <Select
                          disabled={!canManage}
                          onValueChange={(value) =>
                            updateSelectedMcpConnector((draft) => ({ ...draft, auth_mode: value as McpConnectorAuthMode }))
                          }
                          value={selectedMcpConnector.auth_mode}
                        >
                          <SelectTrigger className="bg-white">
                            <SelectValue placeholder={t("settings.mcpConnectors.authMode")} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">{t("settings.mcpConnectors.authModes.none")}</SelectItem>
                            <SelectItem value="environment">{t("settings.mcpConnectors.authModes.environment")}</SelectItem>
                            <SelectItem value="managed_reserved">{t("settings.mcpConnectors.authModes.managed_reserved")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">{t("settings.mcpConnectors.baseUrl")}</div>
                      <Input
                        disabled={!canManage}
                        onChange={(event) => updateSelectedMcpConnector((draft) => ({ ...draft, base_url: event.target.value }))}
                        value={selectedMcpConnector.base_url}
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">{t("settings.mcpConnectors.credentialKeyHint")}</div>
                      <Input
                        disabled={!canManage}
                        onChange={(event) =>
                          updateSelectedMcpConnector((draft) => ({ ...draft, credential_key_hint: event.target.value }))
                        }
                        value={selectedMcpConnector.credential_key_hint}
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">{t("settings.mcpConnectors.notes")}</div>
                      <Textarea
                        className="min-h-[84px] resize-y bg-white"
                        disabled={!canManage}
                        onChange={(event) => updateSelectedMcpConnector((draft) => ({ ...draft, notes: event.target.value }))}
                        value={selectedMcpConnector.notes}
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge className="border-slate-200 bg-white text-slate-700" variant="outline">
                        {t("settings.mcpConnectors.governance.referenced", {
                          count: String(selectedMcpConnector.referenced_tool_count)
                        })}
                      </Badge>
                      <Badge className="border-slate-200 bg-white text-slate-700" variant="outline">
                        {t("settings.mcpConnectors.governance.integrationReady", {
                          count: String(selectedMcpConnector.integration_ready_tool_count)
                        })}
                      </Badge>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-3">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                          {t("settings.mcpConnectors.followUp.referencedTools")}
                        </div>
                        <div className="mt-2 text-lg font-semibold text-slate-950">
                          {selectedMcpConnectorFollowUp.referencedToolCount}
                        </div>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-3">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                          {t("settings.mcpConnectors.followUp.boundTools")}
                        </div>
                        <div className="mt-2 text-lg font-semibold text-slate-950">
                          {selectedMcpConnectorFollowUp.boundToolCount}
                        </div>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-3">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                          {t("settings.mcpConnectors.followUp.activeAgents")}
                        </div>
                        <div className="mt-2 text-lg font-semibold text-slate-950">
                          {selectedMcpConnectorFollowUp.activeAgentCount}
                        </div>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-3">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                          {t("settings.mcpConnectors.followUp.integrationPendingAgents")}
                        </div>
                        <div className="mt-2 text-lg font-semibold text-slate-950">
                          {selectedMcpConnectorFollowUp.integrationPendingAgentCount}
                        </div>
                      </div>
                    </div>
                    {(selectedMcpConnectorFollowUp.referencedToolCount > 0 ||
                      selectedMcpConnectorFollowUp.activeAgentCount > 0) ? (
                      <div className="space-y-3">
                        {selectedMcpConnectorScopedTools.length > 0 ? (
                          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                              {t("settings.mcpConnectors.followUp.linkedToolsTitle")}
                            </div>
                            <div className="mt-3 space-y-2">
                              {selectedMcpConnectorScopedTools.slice(0, 3).map((item) => (
                                <button
                                  className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-left transition hover:border-slate-300"
                                  key={item.id}
                                  onClick={() => handleFocusToolRegistration(item.id)}
                                  type="button"
                                >
                                  <div className="min-w-0">
                                    <div className="truncate text-sm font-medium text-slate-900">{item.name}</div>
                                    <div className="mt-1 truncate text-xs text-slate-400">{item.slug}</div>
                                  </div>
                                  <div className="ml-3 shrink-0">
                                    <ConsoleOutlineBadge>{t("settings.governance.boundAgents", { count: String(item.bound_agent_count) })}</ConsoleOutlineBadge>
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Button
                        className="justify-start rounded-xl"
                        disabled={!canManage}
                        onClick={() => updateSelectedMcpConnector((draft) => ({ ...draft, is_enabled: !draft.is_enabled }))}
                        type="button"
                        variant={selectedMcpConnector.is_enabled ? "default" : "outline"}
                      >
                        <Server className="h-4 w-4" />
                        {selectedMcpConnector.is_enabled ? t("settings.governance.enabled") : t("settings.governance.disabled")}
                      </Button>
                      <Button
                        className="justify-start rounded-xl"
                        disabled={!canManage}
                        onClick={() =>
                          updateSelectedMcpConnector((draft) => ({
                            ...draft,
                            auth_mode: draft.auth_mode === "environment" ? "none" : "environment"
                          }))
                        }
                        type="button"
                        variant={selectedMcpConnector.auth_mode === "environment" ? "default" : "outline"}
                      >
                        <KeyRound className="h-4 w-4" />
                        {t("settings.mcpConnectors.authModes.environment")}
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {canManage ? (
                        <>
                          <Button disabled={isMutatingMcpConnector} onClick={() => void handleSaveMcpConnector()} type="button">
                            <Save className="h-4 w-4" />
                            {t("settings.governance.save")}
                          </Button>
                          <Button
                            disabled={
                              isMutatingMcpConnector ||
                              (selectedMcpConnector.referenced_tool_count > 0 && !selectedMcpConnector.id.startsWith("new-mcp-connector-"))
                            }
                            onClick={() => void handleDeleteMcpConnector()}
                            type="button"
                            variant="outline"
                          >
                            <Trash2 className="h-4 w-4" />
                            {t("settings.governance.delete")}
                          </Button>
                        </>
                      ) : null}
                      <Button
                        className="bg-white"
                        disabled={isPreviewingMcpConnector || selectedMcpConnector.id.startsWith("new-mcp-connector-")}
                        onClick={() => void handlePreviewSelectedMcpConnector()}
                        type="button"
                        variant="outline"
                      >
                        <Play className="h-4 w-4" />
                        {isPreviewingMcpConnector ? t("settings.mcpConnectors.previewing") : t("settings.mcpConnectors.preview")}
                      </Button>
                    </div>
                    <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-slate-950">{t("settings.mcpConnectors.previewTitle")}</div>
                          <div className="mt-1 text-sm text-slate-500">{t("settings.mcpConnectors.description")}</div>
                        </div>
                        {mcpConnectorPreviewResult ? (
                          <Badge className="border-slate-200 bg-white text-slate-700" variant="outline">
                            {t(`settings.mcpConnectors.previewStatuses.${mcpConnectorPreviewResult.preview_status}`)}
                          </Badge>
                        ) : null}
                      </div>
                      {mcpConnectorPreviewResult ? (
                        <div className="mt-4 space-y-3">
                          <div className="text-sm leading-6 text-slate-600">{mcpConnectorPreviewResult.summary}</div>
                          {mcpConnectorPreviewResult.error_message ? (
                            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-3 text-sm text-rose-700">
                              {mcpConnectorPreviewResult.error_message}
                            </div>
                          ) : null}
                          <div className="grid gap-3 xl:grid-cols-2">
                            <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                                {t("settings.mcpConnectors.previewRequestMeta")}
                              </div>
                              <pre className="mt-2 overflow-x-auto text-xs leading-6 text-slate-600">
                                {JSON.stringify(mcpConnectorPreviewResult.request_metadata, null, 2)}
                              </pre>
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                                {t("settings.mcpConnectors.previewResponseMeta")}
                              </div>
                              <pre className="mt-2 overflow-x-auto text-xs leading-6 text-slate-600">
                                {JSON.stringify(mcpConnectorPreviewResult.response_metadata, null, 2)}
                              </pre>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-white px-3 py-4 text-sm text-slate-500">
                          {t("settings.mcpConnectors.previewEmpty")}
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
          <div className="grid gap-6 p-6 xl:grid-cols-[240px_minmax(0,1fr)]">
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Button
                  className="rounded-full"
                  onClick={() => setModelEndpointListFilter("all")}
                  size="sm"
                  type="button"
                  variant={modelEndpointListFilter === "all" ? "default" : "outline"}
                >
                  {t("settings.models.filters.all")}
                </Button>
                <Button
                  className="rounded-full bg-white"
                  onClick={() => setModelEndpointListFilter("runtime_ready")}
                  size="sm"
                  type="button"
                  variant={modelEndpointListFilter === "runtime_ready" ? "default" : "outline"}
                >
                  {t("settings.models.filters.runtimeReady")}
                </Button>
                <Button
                  className="rounded-full bg-white"
                  onClick={() => setModelEndpointListFilter("disabled_bound")}
                  size="sm"
                  type="button"
                  variant={modelEndpointListFilter === "disabled_bound" ? "default" : "outline"}
                >
                  {t("settings.models.filters.disabledBound")}
                </Button>
                <Button
                  className="rounded-full bg-white"
                  onClick={() => setModelEndpointListFilter("missing_base_url")}
                  size="sm"
                  type="button"
                  variant={modelEndpointListFilter === "missing_base_url" ? "default" : "outline"}
                >
                  {t("settings.models.filters.missingBaseUrl")}
                </Button>
                <Button
                  className="rounded-full bg-white"
                  onClick={() => setModelEndpointListFilter("managed_reserved")}
                  size="sm"
                  type="button"
                  variant={modelEndpointListFilter === "managed_reserved" ? "default" : "outline"}
                >
                  {t("settings.models.filters.managedReserved")}
                </Button>
              </div>
              {modelEndpoints.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-6 text-sm text-slate-500">
                  {modelEndpointListFilter === "all" ? t("settings.models.empty") : t("settings.models.filters.empty")}
                </div>
              ) : (
                modelEndpoints.map((item) => (
                  <button
                    className={cn(
                      "w-full rounded-[18px] border px-4 py-4 text-left transition",
                      selectedModelEndpointId === item.id
                        ? "border-blue-200 bg-blue-50/70"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    )}
                    key={item.id}
                    onClick={() => setSelectedModelEndpointId(item.id)}
                    type="button"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-950">{item.name || t("settings.governance.unsaved")}</div>
                        <div className="mt-1 truncate text-xs text-slate-400">{item.slug}</div>
                      </div>
                      <Badge className={cn("border", item.is_enabled ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-700")} variant="outline">
                        {item.is_enabled ? t("settings.governance.enabled") : t("settings.governance.disabled")}
                      </Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <ConsoleOutlineBadge>{t(`settings.models.providers.${item.provider_type}`)}</ConsoleOutlineBadge>
                      {item.is_default ? <ConsoleOutlineBadge className="border-blue-200 bg-blue-50 text-blue-700">{t("settings.models.default")}</ConsoleOutlineBadge> : null}
                      <ConsoleOutlineBadge>{t("settings.governance.boundAgents", { count: String(item.bound_agent_count) })}</ConsoleOutlineBadge>
                    </div>
                  </button>
                ))
              )}
            </div>

            {selectedModelEndpoint ? (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">{t("settings.models.name")}</div>
                    <Input
                      disabled={!canManage}
                      onChange={(event) => updateSelectedModelEndpoint((draft) => ({ ...draft, name: event.target.value }))}
                      value={selectedModelEndpoint.name}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">{t("settings.models.slug")}</div>
                    <Input
                      disabled={!canManage}
                      onChange={(event) => updateSelectedModelEndpoint((draft) => ({ ...draft, slug: slugifyValue(event.target.value) }))}
                      value={selectedModelEndpoint.slug}
                    />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">{t("settings.models.provider")}</div>
                    <Select
                      disabled={!canManage}
                      onValueChange={(value) =>
                        updateSelectedModelEndpoint((draft) => ({ ...draft, provider_type: value as ModelProviderType }))
                      }
                      value={selectedModelEndpoint.provider_type}
                    >
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder={t("settings.models.provider")} />
                      </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="deterministic">{t("settings.models.providers.deterministic")}</SelectItem>
                          <SelectItem value="openai_compatible">{t("settings.models.providers.openai_compatible")}</SelectItem>
                          <SelectItem value="ollama">{t("settings.models.providers.ollama")}</SelectItem>
                          <SelectItem value="vllm">{t("settings.models.providers.vllm")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  <div className="space-y-2">
                    <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">{t("settings.models.modelName")}</div>
                    <Input
                      disabled={!canManage}
                      onChange={(event) => updateSelectedModelEndpoint((draft) => ({ ...draft, model_name: event.target.value }))}
                      value={selectedModelEndpoint.model_name}
                    />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">{t("settings.models.baseUrl")}</div>
                    <Input
                      disabled={!canManage}
                      onChange={(event) => updateSelectedModelEndpoint((draft) => ({ ...draft, base_url: event.target.value }))}
                      value={selectedModelEndpoint.base_url}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">{t("settings.models.credentialMode")}</div>
                    <Select
                      disabled={!canManage}
                      onValueChange={(value) =>
                        updateSelectedModelEndpoint((draft) => ({ ...draft, credential_mode: value as PlatformModelEndpoint["credential_mode"] }))
                      }
                      value={selectedModelEndpoint.credential_mode}
                    >
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder={t("settings.models.credentialMode")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t("settings.models.credentialModes.none")}</SelectItem>
                        <SelectItem value="environment">{t("settings.models.credentialModes.environment")}</SelectItem>
                        <SelectItem value="managed_reserved">{t("settings.models.credentialModes.managed_reserved")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {selectedModelEndpoint.provider_type === "ollama" ? (
                  <div className="rounded-2xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-sm text-blue-700">
                    {t("settings.models.ollamaHint")}
                  </div>
                ) : null}
                {selectedModelEndpoint.provider_type === "vllm" ? (
                  <div className="rounded-2xl border border-violet-100 bg-violet-50/70 px-4 py-3 text-sm text-violet-700">
                    {t("settings.models.vllmHint")}
                  </div>
                ) : null}
                <div className="space-y-2">
                  <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">{t("settings.models.credentialKeyHint")}</div>
                  <Input
                    disabled={!canManage}
                    onChange={(event) =>
                      updateSelectedModelEndpoint((draft) => ({ ...draft, credential_key_hint: event.target.value }))
                    }
                    value={selectedModelEndpoint.credential_key_hint}
                  />
                </div>
                <div className="space-y-3">
                  <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">{t("settings.models.capabilities")}</div>
                  <div className="flex flex-wrap gap-3">
                    {(["chat", "embeddings"] as ModelCapability[]).map((capability) => {
                      const isActive = selectedModelEndpoint.capabilities.includes(capability);
                      return (
                        <button
                          className={cn(
                            "rounded-full border px-4 py-2 text-sm transition",
                            isActive
                              ? "border-blue-200 bg-blue-50 text-blue-700"
                              : "border-slate-200 bg-white text-slate-700"
                          )}
                          disabled={!canManage}
                          key={capability}
                          onClick={() => toggleModelCapability(capability)}
                          type="button"
                        >
                          {t(`settings.models.capabilityLabels.${capability}`)}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Button
                    className="justify-start rounded-xl"
                    disabled={!canManage}
                    onClick={() => updateSelectedModelEndpoint((draft) => ({ ...draft, is_enabled: !draft.is_enabled }))}
                    type="button"
                    variant={selectedModelEndpoint.is_enabled ? "default" : "outline"}
                  >
                    <Server className="h-4 w-4" />
                    {selectedModelEndpoint.is_enabled ? t("settings.governance.enabled") : t("settings.governance.disabled")}
                  </Button>
                  <Button
                    className="justify-start rounded-xl"
                    disabled={!canManage}
                    onClick={() =>
                      setModelEndpoints((currentValue) =>
                        currentValue.map((item) =>
                          item.id === selectedModelEndpoint.id ? { ...item, is_default: !item.is_default } : { ...item, is_default: false }
                        )
                      )
                    }
                    type="button"
                    variant={selectedModelEndpoint.is_default ? "default" : "outline"}
                  >
                    <ShieldCheck className="h-4 w-4" />
                    {t("settings.models.default")}
                  </Button>
                  <Button
                    className="justify-start rounded-xl"
                    disabled={!canManage}
                    onClick={() =>
                      updateSelectedModelEndpoint((draft) => ({
                        ...draft,
                        credential_mode: draft.credential_mode === "environment" ? "none" : "environment"
                      }))
                    }
                    type="button"
                    variant="outline"
                  >
                    <KeyRound className="h-4 w-4" />
                    {t(`settings.models.credentialModes.${selectedModelEndpoint.credential_mode}`)}
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge className="border-slate-200 bg-white text-slate-700" variant="outline">
                    {t("settings.governance.boundAgents", { count: String(selectedModelEndpoint.bound_agent_count) })}
                  </Badge>
                  {selectedModelEndpoint.bound_agent_count > 0 ? (
                    <Badge className="border-amber-200 bg-amber-50 text-amber-800" variant="outline">
                      {t("settings.governance.deleteBlockedBadge")}
                    </Badge>
                  ) : null}
                </div>
                {modelRuntimeFollowUp.activeAgentCount > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    <Button asChild className="bg-white" size="sm" type="button" variant="outline">
                      <Link
                        href={buildAgentsHref({
                          status: "active",
                          modelEndpointId: selectedModelEndpoint.id
                        })}
                      >
                        {t("settings.models.openBoundAgents")}
                      </Link>
                    </Button>
                    {modelRuntimeFollowUp.attentionAgentCount > 0 ? (
                      <Button asChild className="bg-white" size="sm" type="button" variant="outline">
                        <Link
                          href={buildAgentsHref({
                            status: "active",
                            readiness: "attention",
                            issue: "model_disabled",
                            modelEndpointId: selectedModelEndpoint.id
                          })}
                        >
                          {t("settings.models.openImpactedAgents")}
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                ) : null}
                <div className="space-y-2">
                  <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">{t("settings.models.notes")}</div>
                  <Textarea
                    className="min-h-[96px] resize-y bg-white"
                    disabled={!canManage}
                    onChange={(event) => updateSelectedModelEndpoint((draft) => ({ ...draft, notes: event.target.value }))}
                    value={selectedModelEndpoint.notes}
                  />
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-950">{t("settings.models.previewTitle")}</div>
                      <div className="mt-1 text-sm text-slate-500">
                        {selectedModelEndpoint.id.startsWith("new-model-")
                          ? t("settings.models.previewSaveFirst")
                          : t("settings.models.previewHint")}
                      </div>
                    </div>
                    {modelPreviewResult ? (
                      <Badge className={cn("border", getToolInvocationStatusClass(modelPreviewResult.preview_status))} variant="outline">
                        {t(`settings.models.previewStatuses.${modelPreviewResult.preview_status}`)}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <Button
                      className="rounded-xl"
                      disabled={isPreviewingModel || selectedModelEndpoint.id.startsWith("new-model-")}
                      onClick={() => void handlePreviewModelEndpoint()}
                      type="button"
                      variant="outline"
                    >
                      <Play className="h-4 w-4" />
                      {isPreviewingModel ? t("settings.models.previewing") : t("settings.models.preview")}
                    </Button>
                  </div>
                  {modelPreviewResult ? (
                    <div className="mt-4 space-y-3">
                      <div className="text-sm leading-6 text-slate-600">{modelPreviewResult.summary}</div>
                      {modelPreviewResult.error_message ? (
                        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-3 text-sm text-rose-700">
                          {modelPreviewResult.error_message}
                        </div>
                      ) : null}
                      {modelPreviewResult.response_excerpt ? (
                        <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700">
                          {modelPreviewResult.response_excerpt}
                        </div>
                      ) : null}
                      <div className="grid gap-3 xl:grid-cols-2">
                        <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                            {t("settings.models.previewRequestMeta")}
                          </div>
                          <pre className="mt-2 overflow-x-auto text-xs leading-6 text-slate-600">
                            {JSON.stringify(modelPreviewResult.request_metadata, null, 2)}
                          </pre>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                            {t("settings.models.previewResponseMeta")}
                          </div>
                          <pre className="mt-2 overflow-x-auto text-xs leading-6 text-slate-600">
                            {JSON.stringify(modelPreviewResult.response_metadata, null, 2)}
                          </pre>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-white px-3 py-4 text-sm text-slate-500">
                      {t("settings.models.previewEmpty")}
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {canManage ? (
                    <>
                      <Button disabled={isMutatingModel} onClick={() => void handleSaveModelEndpoint()} type="button">
                        <Save className="h-4 w-4" />
                        {t("settings.governance.save")}
                      </Button>
                      <Button
                        disabled={isMutatingModel || (selectedModelEndpoint.bound_agent_count > 0 && !selectedModelEndpoint.id.startsWith("new-model-"))}
                        onClick={() => void handleDeleteModelEndpoint()}
                        type="button"
                        variant="outline"
                      >
                        <Trash2 className="h-4 w-4" />
                        {t("settings.governance.delete")}
                      </Button>
                    </>
                  ) : null}
                  {!selectedModelEndpoint.id.startsWith("new-model-") ? (
                    <div className="text-xs text-slate-400">{t("settings.governance.ready")}</div>
                  ) : (
                    <div className="text-xs text-slate-400">{t("settings.governance.unsaved")}</div>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-6 text-sm text-slate-500">
                {t("settings.models.empty")}
              </div>
            )}
          </div>
        </ConsoleSurface>
        </div>

        <div ref={toolSectionRef}>
        <ConsoleSurface>
          <ConsoleSurfaceHeader
            action={
              canManage ? (
                <Button className="rounded-xl" onClick={handleCreateToolRegistration} type="button" variant="outline">
                  <Plus className="h-4 w-4" />
                  {t("settings.tools.new")}
                </Button>
              ) : (
                <ConsoleOutlineBadge>{t("settings.governance.readOnly")}</ConsoleOutlineBadge>
              )
            }
            description={t("settings.tools.description")}
            title={t("settings.tools.title")}
          />
          <div className="grid gap-4 px-6 pt-2 pb-0 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-4">
              <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
                {t("settings.tools.governance.nativeTools")}
              </div>
              <div className="mt-3 text-2xl font-semibold text-slate-950">{toolGovernanceSummary.native_tools}</div>
              <div className="mt-2 text-sm text-slate-500">
                {t("settings.tools.governance.runtimeReady", {
                  count: String(
                    toolGovernanceSummary.transport_breakdown.find((item) => item.transport_type === "native")?.runtime_ready_tools ?? 0
                  )
                })}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-4">
              <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
                {t("settings.tools.governance.httpTools")}
              </div>
              <div className="mt-3 text-2xl font-semibold text-slate-950">{toolGovernanceSummary.http_tools}</div>
              <div className="mt-2 text-sm text-slate-500">
                {t("settings.tools.governance.httpMissingEndpoints", {
                  count: String(toolGovernanceSummary.http_tools_missing_endpoint_tools)
                })}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-4">
              <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
                {t("settings.tools.governance.mcpReservedTools")}
              </div>
              <div className="mt-3 text-2xl font-semibold text-slate-950">{toolGovernanceSummary.mcp_reserved_tools}</div>
              <div className="mt-2 text-sm text-slate-500">
                {t("settings.tools.governance.connectorConfigured", {
                  count: String(toolGovernanceSummary.mcp_connector_configured_tools)
                })}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-4">
              <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
                {t("settings.tools.governance.approvalRequired")}
              </div>
              <div className="mt-3 text-2xl font-semibold text-slate-950">{toolGovernanceSummary.approval_required_tools}</div>
              <div className="mt-2 text-sm text-slate-500">
                {t("settings.tools.governance.runtimeReady", {
                  count: String(toolGovernanceSummary.runtime_ready_tools)
                })}
              </div>
            </div>
          </div>
          <div className="grid gap-6 p-6 xl:grid-cols-[240px_minmax(0,1fr)]">
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Button
                  className="rounded-xl"
                  onClick={() => setToolRegistrationListFilter("all")}
                  size="sm"
                  type="button"
                  variant={toolRegistrationListFilter === "all" ? "default" : "outline"}
                >
                  {t("settings.tools.filters.all")}
                </Button>
                <Button
                  className="rounded-xl"
                  onClick={() => setToolRegistrationListFilter("approval_required")}
                  size="sm"
                  type="button"
                  variant={toolRegistrationListFilter === "approval_required" ? "default" : "outline"}
                >
                  {t("settings.tools.filters.approvalRequired")}
                </Button>
                <Button
                  className="rounded-xl"
                  onClick={() => setToolRegistrationListFilter("disabled")}
                  size="sm"
                  type="button"
                  variant={toolRegistrationListFilter === "disabled" ? "default" : "outline"}
                >
                  {t("settings.tools.filters.disabled")}
                </Button>
                <Button
                  className="rounded-xl"
                  onClick={() => setToolRegistrationListFilter("missing_endpoint")}
                  size="sm"
                  type="button"
                  variant={toolRegistrationListFilter === "missing_endpoint" ? "default" : "outline"}
                >
                  {t("settings.tools.filters.missingEndpoint")}
                </Button>
                <Button
                  className="rounded-xl"
                  onClick={() => setToolRegistrationListFilter("mcp_reserved_bound")}
                  size="sm"
                  type="button"
                  variant={toolRegistrationListFilter === "mcp_reserved_bound" ? "default" : "outline"}
                >
                  {t("settings.tools.filters.boundMcp")}
                </Button>
                <Button
                  className="rounded-xl"
                  onClick={() => setToolRegistrationListFilter("mcp_integration_pending")}
                  size="sm"
                  type="button"
                  variant={toolRegistrationListFilter === "mcp_integration_pending" ? "default" : "outline"}
                >
                  {t("settings.tools.filters.integrationPending")}
                </Button>
                <Button
                  className="rounded-xl"
                  onClick={() => setToolRegistrationListFilter("mcp_connector_configured")}
                  size="sm"
                  type="button"
                  variant={toolRegistrationListFilter === "mcp_connector_configured" ? "default" : "outline"}
                >
                  {t("settings.tools.filters.connectorConfigured")}
                </Button>
              </div>
              {visibleToolRegistrations.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-6 text-sm text-slate-500">
                  {toolRegistrations.length === 0 ? t("settings.tools.empty") : t("settings.tools.filters.empty")}
                </div>
              ) : (
                visibleToolRegistrations.map((item) => (
                  <button
                    className={cn(
                      "w-full rounded-[18px] border px-4 py-4 text-left transition",
                      selectedToolRegistrationId === item.id
                        ? "border-blue-200 bg-blue-50/70"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    )}
                    key={item.id}
                    onClick={() => setSelectedToolRegistrationId(item.id)}
                    type="button"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-950">{item.name || t("settings.governance.unsaved")}</div>
                      <div className="mt-1 truncate text-xs text-slate-400">{item.slug}</div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <ConsoleOutlineBadge>{t(`settings.tools.transports.${item.transport_type}`)}</ConsoleOutlineBadge>
                      <ConsoleOutlineBadge>{t(`settings.tools.surfaces.${item.surface_area}`)}</ConsoleOutlineBadge>
                      <ConsoleOutlineBadge>{t("settings.governance.boundAgents", { count: String(item.bound_agent_count) })}</ConsoleOutlineBadge>
                      {item.requires_admin_approval ? (
                        <ConsoleOutlineBadge className="border-amber-200 bg-amber-50 text-amber-800">
                          {t("settings.tools.filters.approvalRequired")}
                        </ConsoleOutlineBadge>
                      ) : null}
                      {item.transport_type === "mcp_reserved" && item.is_enabled && !item.requires_admin_approval ? (
                        <ConsoleOutlineBadge className="border-indigo-200 bg-indigo-50 text-indigo-700">
                          {t("settings.tools.filters.integrationPending")}
                        </ConsoleOutlineBadge>
                      ) : null}
                      {item.transport_type === "mcp_reserved" && item.connector_reference ? (
                        <ConsoleOutlineBadge className="border-cyan-200 bg-cyan-50 text-cyan-700">
                          {t("settings.tools.filters.connectorConfigured")}
                        </ConsoleOutlineBadge>
                      ) : null}
                      {!item.is_enabled ? (
                        <ConsoleOutlineBadge className="border-slate-200 bg-slate-50 text-slate-700">
                          {t("settings.tools.filters.disabled")}
                        </ConsoleOutlineBadge>
                      ) : null}
                    </div>
                  </button>
                ))
              )}
            </div>

            {selectedToolRegistration ? (
              <div className="space-y-4">
                {selectedToolRuntimePacket ? (
                  <ConsoleActionPacketCard
                    detail={selectedToolRuntimePacket.detail}
                    metricLabel={t("settings.governance.followUpMetric")}
                    metricValue={selectedToolRuntimePacket.metricValue}
                    primaryActionHref={selectedToolRuntimePacket.primaryActionHref}
                    primaryActionLabel={selectedToolRuntimePacket.primaryActionLabel}
                    secondaryActions={selectedToolRuntimePacket.secondaryActions}
                    status={selectedToolRuntimePacket.status}
                    statusLabel={selectedToolRuntimePacket.statusLabel}
                    title={selectedToolRuntimePacket.title}
                  />
                ) : null}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">{t("settings.tools.name")}</div>
                    <Input
                      disabled={!canManage}
                      onChange={(event) => updateSelectedToolRegistration((draft) => ({ ...draft, name: event.target.value }))}
                      value={selectedToolRegistration.name}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">{t("settings.tools.slug")}</div>
                    <Input
                      disabled={!canManage}
                      onChange={(event) => updateSelectedToolRegistration((draft) => ({ ...draft, slug: slugifyValue(event.target.value) }))}
                      value={selectedToolRegistration.slug}
                    />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">{t("settings.tools.transport")}</div>
                    <Select
                      disabled={!canManage}
                      onValueChange={(value) =>
                        updateSelectedToolRegistration((draft) => ({ ...draft, transport_type: value as ToolTransportType }))
                      }
                      value={selectedToolRegistration.transport_type}
                    >
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder={t("settings.tools.transport")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="native">{t("settings.tools.transports.native")}</SelectItem>
                        <SelectItem value="http">{t("settings.tools.transports.http")}</SelectItem>
                        <SelectItem value="mcp_reserved">{t("settings.tools.transports.mcp_reserved")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">{t("settings.tools.surface")}</div>
                    <Select
                      disabled={!canManage}
                      onValueChange={(value) =>
                        updateSelectedToolRegistration((draft) => ({ ...draft, surface_area: value as ToolSurfaceArea }))
                      }
                      value={selectedToolRegistration.surface_area}
                    >
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder={t("settings.tools.surface")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="chat">{t("settings.tools.surfaces.chat")}</SelectItem>
                        <SelectItem value="documents">{t("settings.tools.surfaces.documents")}</SelectItem>
                        <SelectItem value="operations">{t("settings.tools.surfaces.operations")}</SelectItem>
                        <SelectItem value="admin">{t("settings.tools.surfaces.admin")}</SelectItem>
                        <SelectItem value="agents">{t("settings.tools.surfaces.agents")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">{t("settings.tools.endpointUrl")}</div>
                  <Input
                    disabled={!canManage}
                    onChange={(event) => updateSelectedToolRegistration((draft) => ({ ...draft, endpoint_url: event.target.value }))}
                    value={selectedToolRegistration.endpoint_url}
                  />
                </div>
                {selectedToolRegistration.transport_type === "mcp_reserved" ? (
                  <div className="space-y-2">
                    <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
                      {t("settings.tools.connectorReference")}
                    </div>
                    <Select
                      disabled={!canManage}
                      onValueChange={(value) =>
                        updateSelectedToolRegistration((draft) => ({
                          ...draft,
                          connector_reference: value === "__none" ? "" : value
                        }))
                      }
                      value={selectedToolRegistration.connector_reference || "__none"}
                    >
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder={t("settings.tools.connectorReferencePlaceholder")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">{t("settings.tools.noConnectorReference")}</SelectItem>
                        {mcpConnectors.map((item) => (
                          <SelectItem key={item.id} value={item.slug}>
                            {item.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="text-xs text-slate-500">{t("settings.tools.connectorReferenceHint")}</div>
                  </div>
                ) : null}
                {selectedToolRegistration.transport_type === "mcp_reserved" && selectedToolLinkedConnector ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-950">{t("settings.tools.linkedConnectorTitle")}</div>
                        <div className="mt-2 truncate text-sm text-slate-700">{selectedToolLinkedConnector.name}</div>
                        <div className="mt-1 truncate text-xs text-slate-400">{selectedToolLinkedConnector.slug}</div>
                      </div>
                      <Button
                        className="bg-white"
                        onClick={() => handleOpenLinkedConnector(selectedToolLinkedConnector.id)}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        {t("settings.tools.openLinkedConnector")}
                      </Button>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <ConsoleOutlineBadge>
                        {t("settings.mcpConnectors.governance.referenced", {
                          count: String(selectedToolLinkedConnector.referenced_tool_count)
                        })}
                      </ConsoleOutlineBadge>
                      <ConsoleOutlineBadge>
                        {t("settings.mcpConnectors.governance.integrationReady", {
                          count: String(selectedToolLinkedConnector.integration_ready_tool_count)
                        })}
                      </ConsoleOutlineBadge>
                    </div>
                  </div>
                ) : null}
                <div className="space-y-2">
                  <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">{t("settings.tools.capabilities")}</div>
                  <Input
                    disabled={!canManage}
                    onChange={(event) =>
                      updateSelectedToolRegistration((draft) => ({
                        ...draft,
                        capabilities: event.target.value
                          .split(",")
                          .map((item) => item.trim())
                          .filter(Boolean)
                      }))
                    }
                    value={selectedToolRegistration.capabilities.join(", ")}
                  />
                </div>
                <div className="space-y-2">
                  <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">{t("settings.tools.descriptionField")}</div>
                  <Textarea
                    className="min-h-[96px] resize-y bg-white"
                    disabled={!canManage}
                    onChange={(event) => updateSelectedToolRegistration((draft) => ({ ...draft, description: event.target.value }))}
                    value={selectedToolRegistration.description}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Button
                    className="justify-start rounded-xl"
                    disabled={!canManage}
                    onClick={() =>
                      updateSelectedToolRegistration((draft) => ({ ...draft, is_enabled: !draft.is_enabled }))
                    }
                    type="button"
                    variant={selectedToolRegistration.is_enabled ? "default" : "outline"}
                  >
                    <Wrench className="h-4 w-4" />
                    {selectedToolRegistration.is_enabled ? t("settings.governance.enabled") : t("settings.governance.disabled")}
                  </Button>
                  <Button
                    className="justify-start rounded-xl"
                    disabled={!canManage}
                    onClick={() =>
                      updateSelectedToolRegistration((draft) => ({
                        ...draft,
                        requires_admin_approval: !draft.requires_admin_approval
                      }))
                    }
                    type="button"
                    variant={selectedToolRegistration.requires_admin_approval ? "default" : "outline"}
                  >
                    <Blocks className="h-4 w-4" />
                    {t("settings.tools.adminApproval")}
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge className="border-slate-200 bg-white text-slate-700" variant="outline">
                    {t("settings.governance.boundAgents", { count: String(selectedToolRegistration.bound_agent_count) })}
                  </Badge>
                  {selectedToolRegistration.bound_agent_count > 0 ? (
                    <Badge className="border-amber-200 bg-amber-50 text-amber-800" variant="outline">
                      {t("settings.governance.deleteBlockedBadge")}
                    </Badge>
                  ) : null}
                </div>
                {toolRuntimeFollowUp.activeAgentCount > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    <Button asChild className="bg-white" size="sm" type="button" variant="outline">
                      <Link
                        href={buildAgentsHref({
                          status: "active",
                          toolRegistrationId: selectedToolRegistration.id
                        })}
                      >
                        {t("settings.tools.openBoundAgents")}
                      </Link>
                    </Button>
                    {toolRuntimeFollowUp.attentionAgentCount > 0 ? (
                      <Button asChild className="bg-white" size="sm" type="button" variant="outline">
                        <Link
                          href={buildAgentsHref({
                            status: "active",
                            readiness: "attention",
                            issue: "tool_registration_disabled",
                            toolRegistrationId: selectedToolRegistration.id
                          })}
                        >
                          {t("settings.tools.openImpactedAgents")}
                        </Link>
                      </Button>
                    ) : null}
                    {toolRuntimeFollowUp.approvalAgentCount > 0 ? (
                      <Button asChild className="bg-white" size="sm" type="button" variant="outline">
                        <Link
                          href={buildAgentsHref({
                            status: "active",
                            issue: "tool_approval_required",
                            toolRegistrationId: selectedToolRegistration.id
                          })}
                        >
                          {t("settings.tools.openApprovalAgents")}
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                ) : null}
                <div className="flex flex-wrap items-center gap-3">
                  {canManage ? (
                    <>
                      <Button disabled={isMutatingTool} onClick={() => void handleSaveToolRegistration()} type="button">
                        <Save className="h-4 w-4" />
                        {t("settings.governance.save")}
                      </Button>
                      <Button
                        disabled={isMutatingTool || (selectedToolRegistration.bound_agent_count > 0 && !selectedToolRegistration.id.startsWith("new-tool-"))}
                        onClick={() => void handleDeleteToolRegistration()}
                        type="button"
                        variant="outline"
                      >
                        <Trash2 className="h-4 w-4" />
                        {t("settings.governance.delete")}
                      </Button>
                    </>
                  ) : null}
                  <Button
                    className="bg-white"
                    disabled={isPreviewingTool || selectedToolRegistration.id.startsWith("new-tool-") || !selectedToolPreviewTenantId}
                    onClick={() => void handlePreviewToolRegistration()}
                    type="button"
                    variant="outline"
                  >
                    <Play className="h-4 w-4" />
                    {isPreviewingTool ? t("settings.tools.previewing") : t("settings.tools.preview")}
                  </Button>
                  <div className="text-xs text-slate-400">
                    {selectedToolRegistration.requires_admin_approval
                      ? t("settings.tools.adminApprovalHint")
                      : t("settings.tools.directUseHint")}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-950">{t("settings.tools.governanceActions.title")}</div>
                      <div className="mt-1 text-sm text-slate-500">{t("settings.tools.governanceActions.description")}</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        className="bg-white"
                        disabled={isMutatingTool || selectedToolRegistration.id.startsWith("new-tool-")}
                        onClick={() => void handleApplyToolGovernanceAction(selectedToolRegistration.is_enabled ? "disable_tool" : "enable_tool")}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        {selectedToolRegistration.is_enabled
                          ? t("settings.tools.governanceActions.disable")
                          : t("settings.tools.governanceActions.enable")}
                      </Button>
                      <Button
                        className="bg-white"
                        disabled={isMutatingTool || selectedToolRegistration.id.startsWith("new-tool-")}
                        onClick={() =>
                          void handleApplyToolGovernanceAction(
                            selectedToolRegistration.requires_admin_approval ? "allow_direct_use" : "require_admin_approval"
                          )
                        }
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        {selectedToolRegistration.requires_admin_approval
                          ? t("settings.tools.governanceActions.allowDirectUse")
                          : t("settings.tools.governanceActions.requireApproval")}
                      </Button>
                      <Button
                        className="border-rose-200 bg-white text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                        disabled={isMutatingTool || selectedToolRegistration.id.startsWith("new-tool-")}
                        onClick={() => void handleApplyToolGovernanceAction("quarantine_tool")}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        {t("settings.tools.governanceActions.quarantine")}
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-950">{t("settings.tools.previewTitle")}</div>
                      <div className="mt-1 text-sm text-slate-500">
                        {selectedToolPreviewTenantId
                          ? t("settings.tools.previewTenantReady")
                          : t("settings.tools.previewScopeMissing")}
                      </div>
                    </div>
                    {toolPreviewResult ? (
                      <Badge className={cn("border", getToolInvocationStatusClass(toolPreviewResult.invocation_status))} variant="outline">
                        {t(`settings.tools.previewStatuses.${toolPreviewResult.invocation_status}`)}
                      </Badge>
                    ) : null}
                  </div>
                  {toolPreviewResult ? (
                    <div className="mt-4 space-y-3">
                      <div className="text-sm leading-6 text-slate-600">{toolPreviewResult.summary}</div>
                      {toolPreviewResult.error_message ? (
                        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-3 text-sm text-rose-700">
                          {toolPreviewResult.error_message}
                        </div>
                      ) : null}
                      <div className="flex flex-wrap gap-2">
                        <ConsoleOutlineBadge>{t(`settings.tools.previewStatuses.${toolPreviewResult.invocation_status}`)}</ConsoleOutlineBadge>
                        <ConsoleOutlineBadge>{t(`settings.tools.transports.${selectedToolRegistration.transport_type}`)}</ConsoleOutlineBadge>
                        {typeof toolPreviewResult.request_metadata?.attempt_count === "number" ? (
                          <ConsoleOutlineBadge>
                            {t("settings.tools.previewAttempts", {
                              count: String(toolPreviewResult.request_metadata.attempt_count)
                            })}
                          </ConsoleOutlineBadge>
                        ) : null}
                        {typeof toolPreviewResult.response_metadata?.status_code === "number" ? (
                          <ConsoleOutlineBadge>
                            {t("settings.tools.previewHttpStatus", {
                              status: String(toolPreviewResult.response_metadata.status_code)
                            })}
                          </ConsoleOutlineBadge>
                        ) : null}
                        {typeof toolPreviewResult.request_metadata?.timeout_seconds === "number" ? (
                          <ConsoleOutlineBadge>
                            {t("settings.tools.previewTimeout", {
                              seconds: String(toolPreviewResult.request_metadata.timeout_seconds)
                            })}
                          </ConsoleOutlineBadge>
                        ) : null}
                      </div>
                      <div className="grid gap-3 xl:grid-cols-2">
                        <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                            {t("settings.tools.previewRequestMeta")}
                          </div>
                          <pre className="mt-2 overflow-x-auto text-xs leading-6 text-slate-600">
                            {JSON.stringify(toolPreviewResult.request_metadata, null, 2)}
                          </pre>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                            {t("settings.tools.previewResponseMeta")}
                          </div>
                          <pre className="mt-2 overflow-x-auto text-xs leading-6 text-slate-600">
                            {JSON.stringify(toolPreviewResult.response_metadata, null, 2)}
                          </pre>
                        </div>
                      </div>
                      <pre className="overflow-x-auto rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs leading-6 text-slate-600">
                        {JSON.stringify(toolPreviewResult.capability_results, null, 2)}
                      </pre>
                    </div>
                  ) : (
                    <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-white px-3 py-4 text-sm text-slate-500">
                      {t("settings.tools.previewEmpty")}
                    </div>
                  )}
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-950">{t("settings.tools.auditTitle")}</div>
                      <div className="mt-1 text-sm text-slate-500">
                        {selectedToolPreviewTenantId
                          ? t("settings.tools.auditTenantReady")
                          : t("settings.tools.auditScopeMissing")}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        className="rounded-full bg-white"
                        onClick={() => setToolRuntimeAuditFilter("all")}
                        size="sm"
                        type="button"
                        variant={toolRuntimeAuditFilter === "all" ? "default" : "outline"}
                      >
                        {t("settings.tools.auditFilters.all")}
                      </Button>
                      <Button
                        className="rounded-full bg-white"
                        onClick={() => setToolRuntimeAuditFilter("failed")}
                        size="sm"
                        type="button"
                        variant={toolRuntimeAuditFilter === "failed" ? "default" : "outline"}
                      >
                        {t("settings.tools.auditFilters.failed")}
                      </Button>
                      <Button
                        className="rounded-full bg-white"
                        onClick={() => setToolRuntimeAuditFilter("blocked")}
                        size="sm"
                        type="button"
                        variant={toolRuntimeAuditFilter === "blocked" ? "default" : "outline"}
                      >
                        {t("settings.tools.auditFilters.blocked")}
                      </Button>
                      <Button
                        className="rounded-full bg-white"
                        onClick={() => setToolRuntimeAuditFilter("reserved")}
                        size="sm"
                        type="button"
                        variant={toolRuntimeAuditFilter === "reserved" ? "default" : "outline"}
                      >
                        {t("settings.tools.auditFilters.reserved")}
                      </Button>
                      <Button
                        className="rounded-full bg-white"
                        onClick={() => setToolRuntimeAuditFilter("unavailable")}
                        size="sm"
                        type="button"
                        variant={toolRuntimeAuditFilter === "unavailable" ? "default" : "outline"}
                      >
                        {t("settings.tools.auditFilters.unavailable")}
                      </Button>
                    </div>
                  </div>
                  {toolRuntimeAudit.items.length > 0 ? (
                    <>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {toolRuntimeAudit.summary.approval_required_traces > 0 ? (
                          <ConsoleOutlineBadge className={cn("border", getToolAuditIssueClass("approval_required"))}>
                            {t("settings.tools.auditActions.openApprovalAgents")}
                          </ConsoleOutlineBadge>
                        ) : null}
                        {toolRuntimeAudit.summary.disabled_traces > 0 ? (
                          <ConsoleOutlineBadge className={cn("border", getToolAuditIssueClass("tool_disabled"))}>
                            {t("settings.tools.auditActions.openImpactedAgents")}
                          </ConsoleOutlineBadge>
                        ) : null}
                        {toolRuntimeAudit.summary.mcp_reserved_traces > 0 ? (
                          <ConsoleOutlineBadge className={cn("border", getToolAuditIssueClass("mcp_reserved"))}>
                            {t("settings.tools.auditActions.reviewReservedTransport")}
                          </ConsoleOutlineBadge>
                        ) : null}
                        {toolRuntimeAudit.summary.mcp_integration_pending_traces > 0 ? (
                          <ConsoleOutlineBadge
                            className={cn("border", getToolAuditIssueClass("mcp_integration_pending"))}
                          >
                            {t("settings.tools.auditActions.reviewIntegrationPending")}
                          </ConsoleOutlineBadge>
                        ) : null}
                        {(toolRuntimeAudit.summary.endpoint_failure_traces > 0 ||
                          toolRuntimeAudit.summary.runtime_failure_traces > 0) ? (
                          <ConsoleOutlineBadge className={cn("border", getToolAuditIssueClass("endpoint_failure"))}>
                            {t("settings.tools.auditActions.reviewToolRuntime")}
                          </ConsoleOutlineBadge>
                        ) : null}
                      </div>
                      <ToolRuntimeSummaryCard
                        maxTraces={6}
                        renderTraceActions={renderToolAuditTraceActions}
                        summary={{
                          total_bound_tools: toolRuntimeAudit.summary.total_traces,
                          completed_tools: toolRuntimeAudit.summary.completed_traces,
                          blocked_tools: toolRuntimeAudit.summary.blocked_traces,
                          failed_tools: toolRuntimeAudit.summary.failed_traces,
                          reserved_tools: toolRuntimeAudit.summary.reserved_traces,
                          unavailable_tools: toolRuntimeAudit.summary.unavailable_traces,
                          skipped_tools: toolRuntimeAudit.summary.skipped_traces,
                          traces: toolRuntimeAudit.items
                        }}
                        title={t("settings.tools.auditTraceTitle")}
                      />
                      {selectedToolRegistration &&
                      (toolAuditActionCounts.approval > 0 ||
                        toolAuditActionCounts.disabled > 0 ||
                        toolAuditActionCounts.reserved > 0 ||
                        toolAuditActionCounts.integrationPending > 0 ||
                        toolAuditActionCounts.failed > 0) ? (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {toolAuditActionCounts.approval > 0 ? (
                            <Button asChild className="bg-white" size="sm" type="button" variant="outline">
                              <Link
                                href={buildAgentsHref({
                                  status: "active",
                                  issue: "tool_approval_required",
                                  toolRegistrationId: selectedToolRegistration.id
                                })}
                              >
                                {t("settings.tools.openApprovalAgents")}
                              </Link>
                            </Button>
                          ) : null}
                          {toolAuditActionCounts.disabled > 0 ? (
                            <Button asChild className="bg-white" size="sm" type="button" variant="outline">
                              <Link
                                href={buildAgentsHref({
                                  status: "active",
                                  readiness: "attention",
                                  issue: "tool_registration_disabled",
                                  toolRegistrationId: selectedToolRegistration.id
                                })}
                              >
                                {t("settings.tools.openImpactedAgents")}
                              </Link>
                            </Button>
                          ) : null}
                          {(toolAuditActionCounts.reserved > 0 ||
                            toolAuditActionCounts.integrationPending > 0 ||
                            toolAuditActionCounts.failed > 0) ? (
                            <Button asChild className="bg-white" size="sm" type="button" variant="outline">
                              <Link href={selectedToolGovernanceSettingsHref}>
                                {t("settings.tools.auditActions.openToolSettings")}
                              </Link>
                            </Button>
                          ) : null}
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-white px-3 py-4 text-sm text-slate-500">
                      {t("settings.tools.auditEmpty")}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-6 text-sm text-slate-500">
                {t("settings.tools.empty")}
              </div>
            )}
          </div>
        </ConsoleSurface>
        </div>

        <div ref={retrievalSectionRef}>
        <ConsoleSurface>
          <ConsoleSurfaceHeader
            action={
              canManage ? (
                <Button className="rounded-xl" onClick={handleCreateRetrievalProfile} type="button" variant="outline">
                  <Plus className="h-4 w-4" />
                  {t("settings.retrievalProfiles.new")}
                </Button>
              ) : (
                <ConsoleOutlineBadge>{t("settings.governance.readOnly")}</ConsoleOutlineBadge>
              )
            }
            description={t("settings.retrievalProfiles.description")}
            title={t("settings.retrievalProfiles.title")}
          />
          <div className="grid gap-6 p-6 xl:grid-cols-[240px_minmax(0,1fr)]">
            <div className="space-y-3">
              {retrievalProfiles.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-6 text-sm text-slate-500">
                  {t("settings.retrievalProfiles.empty")}
                </div>
              ) : (
                retrievalProfiles.map((item) => (
                  <button
                    className={cn(
                      "w-full rounded-[18px] border px-4 py-4 text-left transition",
                      selectedRetrievalProfileId === item.id
                        ? "border-blue-200 bg-blue-50/70"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    )}
                    key={item.id}
                    onClick={() => setSelectedRetrievalProfileId(item.id)}
                    type="button"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-950">{item.name || t("settings.governance.unsaved")}</div>
                        <div className="mt-1 truncate text-xs text-slate-400">{item.slug}</div>
                      </div>
                      <Badge className={cn("border", item.is_enabled ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-700")} variant="outline">
                        {item.is_enabled ? t("settings.governance.enabled") : t("settings.governance.disabled")}
                      </Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <ConsoleOutlineBadge>{t(`settings.retrievalProfiles.modes.${item.retrieval_mode}`)}</ConsoleOutlineBadge>
                      {item.is_default ? <ConsoleOutlineBadge className="border-blue-200 bg-blue-50 text-blue-700">{t("settings.retrievalProfiles.default")}</ConsoleOutlineBadge> : null}
                      <ConsoleOutlineBadge>{t("settings.governance.boundKnowledgeBases", { count: String(item.bound_knowledge_base_count) })}</ConsoleOutlineBadge>
                    </div>
                  </button>
                ))
              )}
            </div>

            {selectedRetrievalProfile ? (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">{t("settings.retrievalProfiles.name")}</div>
                    <Input
                      disabled={!canManage}
                      onChange={(event) => updateSelectedRetrievalProfile((draft) => ({ ...draft, name: event.target.value }))}
                      value={selectedRetrievalProfile.name}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">{t("settings.retrievalProfiles.slug")}</div>
                    <Input
                      disabled={!canManage}
                      onChange={(event) => updateSelectedRetrievalProfile((draft) => ({ ...draft, slug: slugifyValue(event.target.value) }))}
                      value={selectedRetrievalProfile.slug}
                    />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">{t("settings.retrievalProfiles.mode")}</div>
                    <Select
                      disabled={!canManage}
                      onValueChange={(value) => updateSelectedRetrievalProfile((draft) => ({ ...draft, retrieval_mode: value as RetrievalMode }))}
                      value={selectedRetrievalProfile.retrieval_mode}
                    >
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder={t("settings.retrievalProfiles.mode")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hybrid">{t("settings.retrievalProfiles.modes.hybrid")}</SelectItem>
                        <SelectItem value="vector">{t("settings.retrievalProfiles.modes.vector")}</SelectItem>
                        <SelectItem value="lexical">{t("settings.retrievalProfiles.modes.lexical")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">{t("settings.retrievalProfiles.topK")}</div>
                    <Input
                      disabled={!canManage}
                      min={1}
                      max={20}
                      onChange={(event) =>
                        updateSelectedRetrievalProfile((draft) => ({
                          ...draft,
                          top_k: Math.min(20, Math.max(1, Number.parseInt(event.target.value || "1", 10) || 1))
                        }))
                      }
                      type="number"
                      value={selectedRetrievalProfile.top_k}
                    />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">{t("settings.retrievalProfiles.vectorWeight")}</div>
                    <Input
                      disabled={!canManage}
                      max={1}
                      min={0}
                      onChange={(event) =>
                        updateSelectedRetrievalProfile((draft) => ({
                          ...draft,
                          vector_weight: Number.parseFloat(event.target.value || "0") || 0
                        }))
                      }
                      step="0.05"
                      type="number"
                      value={selectedRetrievalProfile.vector_weight}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">{t("settings.retrievalProfiles.lexicalWeight")}</div>
                    <Input
                      disabled={!canManage}
                      max={1}
                      min={0}
                      onChange={(event) =>
                        updateSelectedRetrievalProfile((draft) => ({
                          ...draft,
                          lexical_weight: Number.parseFloat(event.target.value || "0") || 0
                        }))
                      }
                      step="0.05"
                      type="number"
                      value={selectedRetrievalProfile.lexical_weight}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">{t("settings.retrievalProfiles.hybridOverlapBonus")}</div>
                    <Input
                      disabled={!canManage}
                      max={1}
                      min={0}
                      onChange={(event) =>
                        updateSelectedRetrievalProfile((draft) => ({
                          ...draft,
                          hybrid_overlap_bonus: Number.parseFloat(event.target.value || "0") || 0
                        }))
                      }
                      step="0.01"
                      type="number"
                      value={selectedRetrievalProfile.hybrid_overlap_bonus}
                    />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Button
                    className="justify-start rounded-xl"
                    disabled={!canManage}
                    onClick={() => updateSelectedRetrievalProfile((draft) => ({ ...draft, is_enabled: !draft.is_enabled }))}
                    type="button"
                    variant={selectedRetrievalProfile.is_enabled ? "default" : "outline"}
                  >
                    <ShieldCheck className="h-4 w-4" />
                    {selectedRetrievalProfile.is_enabled ? t("settings.governance.enabled") : t("settings.governance.disabled")}
                  </Button>
                  <Button
                    className="justify-start rounded-xl"
                    disabled={!canManage}
                    onClick={() =>
                      setRetrievalProfiles((currentValue) =>
                        currentValue.map((item) =>
                          item.id === selectedRetrievalProfile.id ? { ...item, is_default: !item.is_default } : { ...item, is_default: false }
                        )
                      )
                    }
                    type="button"
                    variant={selectedRetrievalProfile.is_default ? "default" : "outline"}
                  >
                    <KeyRound className="h-4 w-4" />
                    {t("settings.retrievalProfiles.default")}
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge className="border-slate-200 bg-white text-slate-700" variant="outline">
                    {t("settings.governance.boundKnowledgeBases", { count: String(selectedRetrievalProfile.bound_knowledge_base_count) })}
                  </Badge>
                  {selectedRetrievalProfile.bound_knowledge_base_count > 0 ? (
                    <Badge className="border-amber-200 bg-amber-50 text-amber-800" variant="outline">
                      {t("settings.governance.deleteBlockedBadge")}
                    </Badge>
                  ) : null}
                </div>
                {selectedRetrievalProfile.bound_knowledge_base_count > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    <Button asChild className="bg-white" size="sm" type="button" variant="outline">
                      <Link
                        href={buildAdminHref({
                          section: "directory",
                          retrievalProfileFilter: selectedRetrievalProfile.id
                        })}
                      >
                        {t("settings.retrievalProfiles.openBoundKnowledgeBases")}
                      </Link>
                    </Button>
                    {retrievalRuntimeFollowUp.activeAgentCount > 0 ? (
                      <Button asChild className="bg-white" size="sm" type="button" variant="outline">
                        <Link
                          href={buildAgentsHref({
                            status: "active",
                            retrievalProfileId: selectedRetrievalProfile.id
                          })}
                        >
                          {t("settings.retrievalProfiles.openBoundAgents")}
                        </Link>
                      </Button>
                    ) : null}
                    {retrievalRuntimeFollowUp.attentionAgentCount > 0 ? (
                      <Button asChild className="bg-white" size="sm" type="button" variant="outline">
                        <Link
                          href={buildAgentsHref({
                            status: "active",
                            readiness: "attention",
                            issue: "retrieval_profile_disabled",
                            retrievalProfileId: selectedRetrievalProfile.id
                          })}
                        >
                          {t("settings.retrievalProfiles.openImpactedAgents")}
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                ) : null}
                <div className="space-y-2">
                  <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">{t("settings.retrievalProfiles.notes")}</div>
                  <Textarea
                    className="min-h-[96px] resize-y bg-white"
                    disabled={!canManage}
                    onChange={(event) => updateSelectedRetrievalProfile((draft) => ({ ...draft, notes: event.target.value }))}
                    value={selectedRetrievalProfile.notes}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {canManage ? (
                    <>
                      <Button disabled={isMutatingRetrievalProfile} onClick={() => void handleSaveRetrievalProfile()} type="button">
                        <Save className="h-4 w-4" />
                        {t("settings.governance.save")}
                      </Button>
                      <Button
                        disabled={
                          isMutatingRetrievalProfile ||
                          (selectedRetrievalProfile.bound_knowledge_base_count > 0 &&
                            !selectedRetrievalProfile.id.startsWith("new-retrieval-profile-"))
                        }
                        onClick={() => void handleDeleteRetrievalProfile()}
                        type="button"
                        variant="outline"
                      >
                        <Trash2 className="h-4 w-4" />
                        {t("settings.governance.delete")}
                      </Button>
                    </>
                  ) : null}
                  {!selectedRetrievalProfile.id.startsWith("new-retrieval-profile-") ? (
                    <div className="text-xs text-slate-400">{t("settings.governance.ready")}</div>
                  ) : (
                    <div className="text-xs text-slate-400">{t("settings.governance.unsaved")}</div>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-6 text-sm text-slate-500">
                {t("settings.retrievalProfiles.empty")}
              </div>
            )}
          </div>
        </ConsoleSurface>
        </div>
      </div>
    </div>
  );
}
