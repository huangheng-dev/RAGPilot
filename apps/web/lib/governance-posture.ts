import { resolveKnowledgeBaseScopeSelection } from "@/lib/agent-runtime";

export type GovernanceAgentRecord = {
  status: "draft" | "active" | "paused";
  mode?: "grounded_chat" | "document_intake" | "workflow_recovery";
  knowledgeBaseScope?: string | null;
  modelEndpointId?: string | null;
  toolRegistrationIds?: string[];
};

export type GovernanceModelRecord = {
  id: string;
  is_enabled: boolean;
  bound_agent_count: number;
};

export type GovernanceToolRecord = {
  id: string;
  is_enabled: boolean;
  requires_admin_approval: boolean;
  bound_agent_count: number;
};

export type GovernanceRetrievalProfileRecord = {
  id: string;
  is_enabled: boolean;
  is_default?: boolean;
};

export type GovernanceWorkspaceRecord = {
  id: string;
  slug: string;
};

export type GovernanceKnowledgeBaseRecord = {
  id: string;
  workspace_id: string;
  slug: string;
  retrieval_profile_id?: string | null;
};

export type GovernancePostureSummary = {
  totalAgents: number;
  activeAgents: number;
  draftAgents: number;
  pausedAgents: number;
  attentionAgents: number;
  activeAgentsWithoutScope: number;
  agentsMissingModel: number;
  agentsUsingDisabledModel: number;
  agentsMissingRetrievalProfile: number;
  agentsUsingDisabledRetrievalProfile: number;
  agentsMissingToolRegistration: number;
  agentsUsingDisabledToolRegistration: number;
  modelEndpoints: number;
  enabledModels: number;
  disabledBoundModels: number;
  unboundEnabledModels: number;
  toolRegistrations: number;
  enabledTools: number;
  approvalGatedTools: number;
  disabledBoundTools: number;
  unboundEnabledTools: number;
};

export function summarizeGovernancePosture(args: {
  agents: GovernanceAgentRecord[];
  modelEndpoints: GovernanceModelRecord[];
  toolRegistrations: GovernanceToolRecord[];
  retrievalProfiles?: GovernanceRetrievalProfileRecord[];
  knowledgeBases?: GovernanceKnowledgeBaseRecord[];
  workspaces?: GovernanceWorkspaceRecord[];
}): GovernancePostureSummary {
  const {
    agents,
    modelEndpoints,
    toolRegistrations,
    retrievalProfiles = [],
    knowledgeBases = [],
    workspaces = []
  } = args;
  const modelEndpointById = new Map(modelEndpoints.map((item) => [item.id, item] as const));
  const toolRegistrationById = new Map(toolRegistrations.map((item) => [item.id, item] as const));
  const retrievalProfileById = new Map(retrievalProfiles.map((item) => [item.id, item] as const));
  const knowledgeBaseById = new Map(knowledgeBases.map((item) => [item.id, item] as const));
  const activeAgents = agents.filter((agent) => agent.status === "active");
  const defaultRetrievalProfile =
    retrievalProfiles.find((item) => item.is_enabled && item.is_default) ??
    retrievalProfiles.find((item) => item.is_enabled) ??
    null;

  let attentionAgents = 0;
  let activeAgentsWithoutScope = 0;
  let agentsMissingModel = 0;
  let agentsUsingDisabledModel = 0;
  let agentsMissingRetrievalProfile = 0;
  let agentsUsingDisabledRetrievalProfile = 0;
  let agentsMissingToolRegistration = 0;
  let agentsUsingDisabledToolRegistration = 0;

  for (const agent of activeAgents) {
    let hasAttention = false;
    const normalizedScope = agent.knowledgeBaseScope?.trim() ?? "";
    const requiresKnowledgeScope = agent.mode === "grounded_chat" || agent.mode === "document_intake" || agent.mode === undefined;

    if (requiresKnowledgeScope && normalizedScope.length === 0) {
      activeAgentsWithoutScope += 1;
      hasAttention = true;
    }

    if (requiresKnowledgeScope && normalizedScope.length > 0 && knowledgeBases.length > 0 && workspaces.length > 0) {
      const scopeSelection = resolveKnowledgeBaseScopeSelection(normalizedScope, workspaces, knowledgeBases);
      if (scopeSelection.workspaceId && scopeSelection.knowledgeBaseId) {
        const knowledgeBase = knowledgeBaseById.get(scopeSelection.knowledgeBaseId) ?? null;
        const assignedRetrievalProfileId = knowledgeBase?.retrieval_profile_id?.trim() ?? "";
        if (assignedRetrievalProfileId.length > 0) {
          const retrievalProfile = retrievalProfileById.get(assignedRetrievalProfileId);
          if (!retrievalProfile) {
            agentsMissingRetrievalProfile += 1;
            hasAttention = true;
          } else if (!retrievalProfile.is_enabled) {
            agentsUsingDisabledRetrievalProfile += 1;
            hasAttention = true;
          }
        } else if (!defaultRetrievalProfile) {
          agentsMissingRetrievalProfile += 1;
          hasAttention = true;
        }
      }
    }

    const normalizedModelEndpointId = agent.modelEndpointId?.trim() ?? "";
    if (normalizedModelEndpointId.length > 0) {
      const modelEndpoint = modelEndpointById.get(normalizedModelEndpointId);
      if (!modelEndpoint) {
        agentsMissingModel += 1;
        hasAttention = true;
      } else if (!modelEndpoint.is_enabled) {
        agentsUsingDisabledModel += 1;
        hasAttention = true;
      }
    }

    const normalizedToolRegistrationIds = Array.from(
      new Set((agent.toolRegistrationIds ?? []).map((item) => item.trim()).filter(Boolean))
    );
    if (normalizedToolRegistrationIds.length > 0) {
      const missingToolRegistration = normalizedToolRegistrationIds.some(
        (toolRegistrationId) => !toolRegistrationById.has(toolRegistrationId)
      );
      const disabledToolRegistration = normalizedToolRegistrationIds.some((toolRegistrationId) => {
        const toolRegistration = toolRegistrationById.get(toolRegistrationId);
        return toolRegistration ? !toolRegistration.is_enabled : false;
      });

      if (missingToolRegistration) {
        agentsMissingToolRegistration += 1;
        hasAttention = true;
      }

      if (disabledToolRegistration) {
        agentsUsingDisabledToolRegistration += 1;
        hasAttention = true;
      }
    }

    if (hasAttention) {
      attentionAgents += 1;
    }
  }

  return {
    totalAgents: agents.length,
    activeAgents: activeAgents.length,
    draftAgents: agents.filter((agent) => agent.status === "draft").length,
    pausedAgents: agents.filter((agent) => agent.status === "paused").length,
    attentionAgents,
    activeAgentsWithoutScope,
    agentsMissingModel,
    agentsUsingDisabledModel,
    agentsMissingRetrievalProfile,
    agentsUsingDisabledRetrievalProfile,
    agentsMissingToolRegistration,
    agentsUsingDisabledToolRegistration,
    modelEndpoints: modelEndpoints.length,
    enabledModels: modelEndpoints.filter((item) => item.is_enabled).length,
    disabledBoundModels: modelEndpoints.filter((item) => !item.is_enabled && item.bound_agent_count > 0).length,
    unboundEnabledModels: modelEndpoints.filter((item) => item.is_enabled && item.bound_agent_count === 0).length,
    toolRegistrations: toolRegistrations.length,
    enabledTools: toolRegistrations.filter((item) => item.is_enabled).length,
    approvalGatedTools: toolRegistrations.filter((item) => item.requires_admin_approval).length,
    disabledBoundTools: toolRegistrations.filter((item) => !item.is_enabled && item.bound_agent_count > 0).length,
    unboundEnabledTools: toolRegistrations.filter((item) => item.is_enabled && item.bound_agent_count === 0).length
  };
}
