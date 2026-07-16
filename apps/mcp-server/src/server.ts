import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { RagpilotApiClient, RagpilotApiError } from "./api-client.js";

const uuidSchema = z.string().uuid();

export function createRagpilotMcpServer(client: RagpilotApiClient): McpServer {
  const server = new McpServer({ name: "ragpilot", version: "0.1.0" });

  server.registerTool(
    "ragpilot_knowledge_search",
    {
      title: "Search RAGPilot knowledge",
      description: "Run tenant-scoped governed retrieval against a RAGPilot knowledge base.",
      inputSchema: {
        tenantId: uuidSchema.describe("Tenant UUID authorized by the configured API key."),
        knowledgeBaseId: uuidSchema.describe("Knowledge base UUID within the tenant."),
        query: z.string().min(1).max(8_000).describe("Natural-language retrieval query."),
        topK: z.number().int().min(1).max(20).default(5).describe("Maximum number of chunks to return."),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ tenantId, knowledgeBaseId, query, topK }) =>
      callApi(() => client.retrieve({ tenantId, knowledgeBaseId, query, topK })),
  );

  server.registerTool(
    "ragpilot_document_get",
    {
      title: "Inspect a RAGPilot document",
      description: "Read governed document metadata, recent versions, and indexed chunks.",
      inputSchema: {
        documentId: uuidSchema.describe("Document UUID."),
        knowledgeBaseId: uuidSchema.describe("Knowledge base UUID containing the document."),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ documentId, knowledgeBaseId }) =>
      callApi(() => client.getDocument({ documentId, knowledgeBaseId })),
  );

  server.registerTool(
    "ragpilot_workflow_get",
    {
      title: "Inspect a RAGPilot workflow",
      description: "Read the tenant-scoped status and recovery diagnostics for one workflow run.",
      inputSchema: {
        workflowRunId: uuidSchema.describe("Workflow run UUID."),
        tenantId: uuidSchema.describe("Tenant UUID authorized by the configured API key."),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ workflowRunId, tenantId }) =>
      callApi(() => client.getWorkflow({ workflowRunId, tenantId })),
  );

  return server;
}

async function callApi(operation: () => Promise<unknown>) {
  try {
    const result = await operation();
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      structuredContent: { result },
    };
  } catch (error) {
    const message = error instanceof RagpilotApiError ? error.message : "RAGPilot tool execution failed.";
    return { isError: true, content: [{ type: "text" as const, text: message }] };
  }
}
