export type RagpilotApiClientOptions = {
  baseUrl: string;
  apiKey: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
};

export class RagpilotApiError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
  ) {
    super(message);
    this.name = "RagpilotApiError";
  }
}

export class RagpilotApiClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: RagpilotApiClientOptions) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl);
    this.apiKey = options.apiKey.trim();
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.fetchImpl = options.fetchImpl ?? fetch;

    if (!this.apiKey) {
      throw new Error("MCP_RAGPILOT_API_KEY is required.");
    }
    if (!Number.isSafeInteger(this.timeoutMs) || this.timeoutMs < 100 || this.timeoutMs > 120_000) {
      throw new Error("MCP_RAGPILOT_REQUEST_TIMEOUT_MS must be between 100 and 120000.");
    }
  }

  retrieve(input: {
    tenantId: string;
    knowledgeBaseId: string;
    query: string;
    topK: number;
  }): Promise<unknown> {
    return this.request("/retrieve", {
      method: "POST",
      body: JSON.stringify({
        tenant_id: input.tenantId,
        knowledge_base_id: input.knowledgeBaseId,
        query_text: input.query,
        top_k: input.topK,
      }),
    });
  }

  getDocument(input: { documentId: string; knowledgeBaseId: string }): Promise<unknown> {
    const query = new URLSearchParams({ knowledge_base_id: input.knowledgeBaseId });
    return this.request(`/documents/${encodeURIComponent(input.documentId)}?${query}`);
  }

  getWorkflow(input: { workflowRunId: string; tenantId: string }): Promise<unknown> {
    const query = new URLSearchParams({ tenant_id: input.tenantId });
    return this.request(`/workflow-runs/${encodeURIComponent(input.workflowRunId)}?${query}`);
  }

  private async request(path: string, init: RequestInit = {}): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        ...init,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-API-Key": this.apiKey,
          ...init.headers,
        },
        signal: controller.signal,
      });
      const responseText = await response.text();
      const payload = parseResponseBody(responseText);

      if (!response.ok) {
        throw new RagpilotApiError(readApiError(payload, response.status), response.status);
      }
      return payload;
    } catch (error) {
      if (error instanceof RagpilotApiError) {
        throw error;
      }
      if (error instanceof Error && error.name === "AbortError") {
        throw new RagpilotApiError(`RAGPilot API request timed out after ${this.timeoutMs}ms.`, null);
      }
      throw new RagpilotApiError("RAGPilot API request failed.", null);
    } finally {
      clearTimeout(timeout);
    }
  }
}

function normalizeBaseUrl(value: string): string {
  const normalized = value.trim().replace(/\/+$/, "");
  const url = new URL(normalized);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("MCP_RAGPILOT_API_BASE_URL must use http or https.");
  }
  return normalized;
}

function parseResponseBody(responseText: string): unknown {
  if (!responseText) {
    return null;
  }
  try {
    return JSON.parse(responseText);
  } catch {
    return responseText;
  }
}

function readApiError(payload: unknown, status: number): string {
  if (payload && typeof payload === "object" && "detail" in payload) {
    const detail = (payload as { detail?: unknown }).detail;
    if (typeof detail === "string" && detail.trim()) {
      return `RAGPilot API rejected the request (${status}): ${detail}`;
    }
  }
  return `RAGPilot API rejected the request (${status}).`;
}
