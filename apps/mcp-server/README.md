# RAGPilot MCP Server

This package is the governed outbound MCP server boundary for RAGPilot. It runs over `stdio`, delegates authorization to the main API, and never bypasses API-key scopes, tenant membership, knowledge-base access, or backend audit policy.

## Exposed Tools

- `ragpilot_knowledge_search` performs governed hybrid retrieval in one tenant and knowledge base.
- `ragpilot_document_get` reads document metadata, versions, and indexed chunks.
- `ragpilot_workflow_get` reads workflow status and recovery diagnostics.

All current tools are read-only. Arbitrary remote calls and mutation tools are intentionally excluded.

## Configuration

Create a tenant-scoped platform API key with only the capabilities required by the enabled tools: `access_chat` for knowledge search, `access_documents` for document inspection, and `access_operations` for workflow inspection. Then set:

```text
MCP_RAGPILOT_API_BASE_URL=http://localhost:8000/api/v1
MCP_RAGPILOT_API_KEY=rpk_...
MCP_RAGPILOT_REQUEST_TIMEOUT_MS=15000
```

The key remains in the server process environment and is never returned in tool output. The default API URL targets local stable mode.

## Run and Verify

```powershell
npm run mcp:build
npm run mcp:test
npm run mcp:dev
```

An MCP host should spawn `npm run mcp:dev` or the built `dist/index.js` process and communicate over standard input/output. Remote Streamable HTTP serving is not currently exposed by this package.
