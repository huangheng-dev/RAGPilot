import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { RagpilotApiClient } from "./api-client.js";
import { createRagpilotMcpServer } from "./server.js";

const client = new RagpilotApiClient({
  baseUrl: process.env.MCP_RAGPILOT_API_BASE_URL ?? "http://localhost:8000/api/v1",
  apiKey: process.env.MCP_RAGPILOT_API_KEY ?? "",
  timeoutMs: Number(process.env.MCP_RAGPILOT_REQUEST_TIMEOUT_MS ?? "15000"),
});
const server = createRagpilotMcpServer(client);

process.on("SIGINT", async () => {
  await server.close();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await server.close();
  process.exit(0);
});

await server.connect(new StdioServerTransport());
