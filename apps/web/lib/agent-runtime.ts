import type { SupportedLanguage } from "@/lib/i18n/messages";

export type AgentRuntimeMode = "grounded_chat" | "document_intake" | "workflow_recovery";

export type AgentRuntimePromptSource = {
  mode: AgentRuntimeMode;
  objective?: string | null;
};

export type ScopeWorkspaceRecord = {
  id: string;
  slug: string;
};

export type ScopeKnowledgeBaseRecord = {
  id: string;
  workspace_id: string;
  slug: string;
};

export function buildAgentLaunchPrompts(options: {
  agent: AgentRuntimePromptSource;
  scopeLabel: string | null;
  language: SupportedLanguage;
}) {
  const { agent, scopeLabel, language } = options;
  const scopeSuffix = scopeLabel ? ` (${scopeLabel})` : "";
  const objective = (agent.objective ?? "").trim();

  if (agent.mode === "document_intake") {
    return language === "zh-CN"
      ? [
          `请先总结当前知识范围${scopeSuffix}里的文档接入健康度，并指出最需要优先处理的异常。`,
          `请基于当前智能体目标，给我一个文档接入检查清单${objective ? `：${objective}` : "。"} `,
          "如果我要继续推进索引质量，请告诉我下一步应该先检查哪些文档版本、解析器和失败信号。"
        ]
      : [
          `Summarize the current document-ingestion health for this knowledge scope${scopeSuffix} and identify the highest-priority exceptions.`,
          `Build a document-intake checklist for this agent${objective ? `: ${objective}` : "."}`,
          "If I want to improve indexing quality next, tell me which document versions, parsers, and failure signals to inspect first."
        ];
  }

  if (agent.mode === "workflow_recovery") {
    return language === "zh-CN"
      ? [
          "请梳理当前租户范围内最值得优先处理的失败工作流，并给出恢复顺序。",
          `请根据这个智能体的恢复职责${objective ? `：${objective}` : ""}，给我一份重试前检查单。`,
          "如果我要处理失败重试链路，请告诉我先看哪些运行、哪些错误、哪些父子重试关系。"
        ]
      : [
          "Rank the failed workflows in the current tenant scope by recovery priority and explain the best handling order.",
          `Create a pre-retry recovery checklist for this agent${objective ? `: ${objective}` : "."}`,
          "If I want to work the retry lineage next, tell me which runs, errors, and parent-child retries I should inspect first."
        ];
  }

  return language === "zh-CN"
    ? [
        `请围绕当前知识范围${scopeSuffix}回答一个最适合当前智能体的首轮问题。`,
        `请根据这个智能体的业务目标${objective ? `：${objective}` : ""}，给出一个正式、可执行的回答框架。`,
        "如果当前证据不足，请明确指出缺口，并告诉我应该回到文档页还是工作流页继续处理。"
      ]
    : [
        `Ask the best first grounded question for this agent and knowledge scope${scopeSuffix}.`,
        `Build a formal answer structure around this agent's business objective${objective ? `: ${objective}` : "."}`,
        "If the evidence is insufficient, state the gap clearly and tell me whether I should return to documents or workflows next."
      ];
}

export function resolveKnowledgeBaseScopeSelection(
  knowledgeBaseScope: string | null | undefined,
  workspaces: ScopeWorkspaceRecord[],
  knowledgeBases: ScopeKnowledgeBaseRecord[]
) {
  const normalizedScope = (knowledgeBaseScope ?? "").trim();
  const [workspaceSlug, knowledgeBaseSlug] = normalizedScope.split("/");
  if (!workspaceSlug || !knowledgeBaseSlug) {
    return {
      workspaceId: "",
      knowledgeBaseId: ""
    };
  }

  const workspace = workspaces.find((item) => item.slug === workspaceSlug) ?? null;
  if (!workspace) {
    return {
      workspaceId: "",
      knowledgeBaseId: ""
    };
  }

  const knowledgeBase =
    knowledgeBases.find(
      (item) => item.workspace_id === workspace.id && item.slug === knowledgeBaseSlug
    ) ?? null;

  return {
    workspaceId: workspace.id,
    knowledgeBaseId: knowledgeBase?.id ?? ""
  };
}
