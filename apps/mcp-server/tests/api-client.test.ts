import assert from "node:assert/strict";
import test from "node:test";

import { RagpilotApiClient, RagpilotApiError } from "../src/api-client.js";

const ids = {
  tenant: "11111111-1111-4111-8111-111111111111",
  knowledgeBase: "22222222-2222-4222-8222-222222222222",
};

test("retrieval forwards the governed API key and exact tenant scope", async () => {
  let request: { url: string; init?: RequestInit } | undefined;
  const client = new RagpilotApiClient({
    baseUrl: "http://localhost:8000/api/v1/",
    apiKey: "rpk_test_secret",
    fetchImpl: async (input, init) => {
      request = { url: String(input), init };
      return new Response(JSON.stringify({ results: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  });

  await client.retrieve({ tenantId: ids.tenant, knowledgeBaseId: ids.knowledgeBase, query: "hello", topK: 4 });

  assert.equal(request?.url, "http://localhost:8000/api/v1/retrieve");
  assert.equal(new Headers(request?.init?.headers).get("X-API-Key"), "rpk_test_secret");
  assert.deepEqual(JSON.parse(String(request?.init?.body)), {
    tenant_id: ids.tenant,
    knowledge_base_id: ids.knowledgeBase,
    query_text: "hello",
    top_k: 4,
  });
});

test("API details are surfaced without leaking the configured credential", async () => {
  const client = new RagpilotApiClient({
    baseUrl: "http://localhost:8000/api/v1",
    apiKey: "rpk_must_not_leak",
    fetchImpl: async () => new Response(JSON.stringify({ detail: "Knowledge base access denied." }), { status: 403 }),
  });

  await assert.rejects(
    client.getDocument({ documentId: ids.tenant, knowledgeBaseId: ids.knowledgeBase }),
    (error: unknown) => {
      assert.ok(error instanceof RagpilotApiError);
      assert.equal(error.status, 403);
      assert.match(error.message, /Knowledge base access denied/);
      assert.doesNotMatch(error.message, /must_not_leak/);
      return true;
    },
  );
});

test("unsupported API base URL protocols are rejected", () => {
  assert.throws(
    () => new RagpilotApiClient({ baseUrl: "file:///tmp/ragpilot", apiKey: "rpk_test_secret" }),
    /must use http or https/,
  );
});
