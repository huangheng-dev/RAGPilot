import assert from "node:assert/strict";
import test from "node:test";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

import { RagpilotApiClient } from "../src/api-client.js";
import { createRagpilotMcpServer } from "../src/server.js";

test("MCP protocol advertises and executes only the governed read-only tools", async () => {
  const apiClient = new RagpilotApiClient({
    baseUrl: "http://localhost:8000/api/v1",
    apiKey: "rpk_test_secret",
    fetchImpl: async () => new Response(JSON.stringify({ results: [{ content: "governed result" }] }), { status: 200 }),
  });
  const server = createRagpilotMcpServer(apiClient);
  const client = new Client({ name: "ragpilot-test", version: "0.1.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await server.connect(serverTransport);
  await client.connect(clientTransport);
  try {
    const tools = await client.listTools();
    assert.deepEqual(
      tools.tools.map((tool) => tool.name).sort(),
      ["ragpilot_document_get", "ragpilot_knowledge_search", "ragpilot_workflow_get"],
    );
    assert.ok(tools.tools.every((tool) => tool.annotations?.readOnlyHint === true));

    const result = await client.callTool({
      name: "ragpilot_knowledge_search",
      arguments: {
        tenantId: "11111111-1111-4111-8111-111111111111",
        knowledgeBaseId: "22222222-2222-4222-8222-222222222222",
        query: "What is RAGPilot?",
        topK: 3,
      },
    });
    assert.equal(result.isError, undefined);
    assert.match(JSON.stringify(result.content), /governed result/);
  } finally {
    await client.close();
    await server.close();
  }
});
