# RAGPilot API Outline

## Purpose

This document is the current route inventory and contract summary for the FastAPI service. The canonical prefix is `/api/v1`. Query parameters and response schemas remain defined by the route contracts and OpenAPI output; this file records stable resource boundaries and operator intent.

## Authentication and Scope

Protected routes accept backend-issued User sessions and, where the requested scope permits, tenant-scoped platform API keys.

- interactive sessions use `Authorization: Bearer <session_token>`
- platform keys use `X-API-Key` or `Authorization: Bearer rpk_...`
- API-key management itself requires an interactive session
- capability checks are database-policy-first with a stable code-policy fallback
- tenant, Workspace, Knowledge Base, Document, Agent, and runtime resources are authorized through their persisted ownership chain
- legacy actor headers are transitional compatibility only and are disabled by production defaults

## System

- `GET /` (service root outside the `/api/v1` prefix)
- `GET /health`
- `GET /health/live`
- `GET /health/ready`

The service root exposes basic identity. Health reports configured and effective runtime engines, optional-pilot readiness, search-projection diagnostics, and separate liveness/readiness probes for deployment orchestration.

## Identity and Tenancy

### Tenants

- `POST /tenants`
- `GET /tenants`
- `PATCH /tenants/{tenant_id}`

### Users, memberships, and sessions

- `POST /users`
- `POST /users/bootstrap`
- `GET /users/bootstrap/status`
- `GET /users/auth-mode`
- `POST /users/login`
- `GET /users/login-assessment`
- `POST /users/activate-invitations`
- `POST /users/me/sign-out`
- `GET /users`
- `GET /users/audit-events`
- `GET /users/access-governance-summary`
- `GET /users/me`
- `GET /users/me/permissions`
- `GET /users/me/access-events`
- `GET /users/me/access-summary`
- `POST /users/me/change-password`
- `GET /users/me/sessions`
- `GET /users/me/session-security`
- `DELETE /users/me/sessions/{session_id}`
- `POST /users/me/sessions/revoke-others`
- `GET /users/{user_id}`
- `GET /users/{user_id}/access-summary`
- `GET /users/{user_id}/access-events`
- `GET /users/{user_id}/sessions`
- `GET /users/{user_id}/session-security`
- `DELETE /users/{user_id}/sessions/{session_id}`
- `POST /users/{user_id}/sessions/revoke-all`
- `PATCH /users/{user_id}`
- `POST /users/{user_id}/reset-password`
- `POST /users/{user_id}/memberships`
- `PATCH /users/{user_id}/memberships/{membership_id}`
- `DELETE /users/{user_id}/memberships/{membership_id}`
- `POST /users/{user_id}/memberships/{membership_id}/invitation`
- `POST /users/{user_id}/memberships/{membership_id}/revoke-invitation`

Bootstrap creates only the first local administrator. Later Users enter through governed creation or invitation. Password, invitation, session, and membership mutations persist access events.

### Platform API keys

- `POST /api-keys`
- `GET /api-keys`
- `POST /api-keys/{api_key_id}/revoke`

Platform API Key authentication verifies the stored hash on every request. Persisted `last_used_at` telemetry is coalesced to at most one write per key per API process every 60 seconds, preventing a shared automation key from serializing concurrent reads on one audit row.

The secret is displayed once; only its hash and non-sensitive prefix are stored. Keys bind tenant, role, scopes, expiry, revocation, last-use state, and lifecycle audit events.

## Workspace and Knowledge

### Workspaces

- `POST /workspaces`
- `GET /workspaces`
- `PATCH /workspaces/{workspace_id}`
- `POST /workspaces/{workspace_id}/lifecycle`

### Knowledge Bases

- `POST /knowledge-bases`
- `GET /knowledge-bases`
- `PATCH /knowledge-bases/{knowledge_base_id}`
- `POST /knowledge-bases/{knowledge_base_id}/publication`

### Data Sources

- `POST /data-sources`
- `GET /data-sources`
- `POST /data-sources/{data_source_id}/sync`
- `GET /data-sources/{data_source_id}/sync-runs`

Data Sources own stable identity, connection/synchronization state, cursor, last error/success, synchronization lease, and synchronization-run history. `GET /data-sources` accepts repeatable `source_type` filters and embeds the latest synchronization run so operator clients do not need one follow-up request per source. `POST /data-sources/{data_source_id}/sync` takes tenant scope through the required `tenant_id` query parameter. Durable synchronization is limited to Web and connector sources; uploaded file identities remain governed through the Documents lifecycle. The current built-in sync adapter is versioned as `public_web_v1` and handles one public page; the contract does not claim full-site crawling.

### Retrieval Access Control

- `POST /access-control/groups`
- `GET /access-control/groups`
- `PUT /access-control/groups/{group_id}/members/{user_id}`
- `DELETE /access-control/groups/{group_id}/members/{user_id}`
- `GET /access-control/documents/{document_id}`
- `PUT /access-control/documents/{document_id}`
- `GET /access-control/chunks/{chunk_id}`
- `PUT /access-control/chunks/{chunk_id}`

Access-control mutations require the administrative capability and emit runtime-governance audit events. Retrieval resolves the authenticated principal server-side and never accepts a client-provided ACL bypass flag.

## Documents and Ingestion

- `POST /documents`
- `GET /documents`
- `GET /documents/metrics`
- `GET /documents/{document_id}`
- `GET /documents/{document_id}/activity`
- `POST /documents/{document_id}/reindex`
- `DELETE /documents/{document_id}`
- `POST /documents/{document_id}/restore`
- `POST /documents/{document_id}/permanent-delete`
- `POST /documents/upload`
- `POST /documents/import-webpage`

File and single-page URL intake use the same workflow-backed ingestion chain. Soft deletion is reversible; permanent deletion is a distinct governed action.

## Retrieval and Evaluation

### Retrieval Profiles

- `POST /retrieval-profiles`
- `GET /retrieval-profiles`
- `PATCH /retrieval-profiles/{retrieval_profile_id}`
- `POST /retrieval-profiles/{retrieval_profile_id}/governance-action`
- `DELETE /retrieval-profiles/{retrieval_profile_id}`

Retrieval Profile create/update contracts persist the retrieval mode, fusion policy, selected `native` or `llamaindex_pilot` processor, processor-policy version, and bounded LlamaIndex similarity/reorder settings. An unavailable optional processor may be saved only on a disabled policy; enabling it requires the matching deployment profile. Responses include dependency readiness so installed capability can be distinguished from deployment drift.

### Retrieval execution and review

- `POST /retrieve`
- `POST /retrieve/compare`
- `POST /retrieve/evaluations`
- `GET /retrieve/evaluations`
- `GET /retrieve/evaluations/summary`
- `PATCH /retrieve/evaluations/{retrieval_evaluation_id}/follow-up`
- `PATCH /retrieve/evaluations/follow-up/query`

Retrieval remains tenant- and Knowledge-Base-scoped. Responses expose effective engine/profile identity, ranking diagnostics, fallback posture, and comparison recommendation where applicable.

## Chat

- `POST /chat/conversations`
- `POST /chat/messages`
- `POST /chat/messages/stream`
- `GET /chat/conversations`
- `GET /chat/conversations/metrics`
- `PATCH /chat/conversations/{conversation_id}`
- `DELETE /chat/conversations/{conversation_id}`
- `GET /chat/messages`
- `POST /chat/messages/{message_id}/feedback`
- `GET /chat/feedback/summary`

The streaming contract emits `start`, `delta`, `complete`, and `error` Server-Sent Events. Ollama and OpenAI-compatible runtimes forward provider-native deltas; deterministic or streaming-incompatible runtimes use an explicit completion-chunk fallback. Client disconnects cancel the in-flight generation task. Final assistant Messages and Citations are persisted through the same service path as non-streaming Chat.

## Workflows

- `GET /workflow-runs`
- `GET /workflow-runs/metrics`
- `GET /workflow-runs/{workflow_run_id}`
- `GET /workflow-runs/{workflow_run_id}/steps`
- `GET /workflow-runs/{workflow_run_id}/events`
- `POST /workflow-runs/{workflow_run_id}/retry`
- `POST /workflow-runs/{workflow_run_id}/cancel`
- `PATCH /workflow-runs/{workflow_run_id}/notes`

Workflow mutation is explicit and auditable. Retry creates lineage; cancel and operator notes become durable workflow events.

## Agents

- `POST /agents`
- `GET /agents`
- `GET /agents/metrics`
- `GET /agents/runtime-governance`
- `POST /agents/runs`
- `GET /agents/runs`
- `GET /agents/runs/metrics`
- `POST /agents/executions`
- `GET /agents/executions`
- `POST /agents/executions/actions/{execution_id}/cancel`
- `POST /agents/executions/actions/{execution_id}/retry`
- `POST /agents/executions/actions/{execution_id}/replay`
- `GET /agents/executions/{execution_id}/approvals`
- `POST /agents/executions/approvals/{approval_request_id}/decision`
- `GET /agents/executions/metrics`
- `GET /agents/executions/evaluation`
- `PATCH /agents/{agent_definition_id}`
- `DELETE /agents/{agent_definition_id}`

Agent definitions persist a versioned `native` or `langgraph_pilot` runtime policy. Agent Runs record operator handoff; Agent Executions own durable task state. Each queued execution snapshots its definition and effective runtime version, allowed Tool registrations, deployment-capped tool/runtime/output budgets, optional JSON Schema output contract, and replay fingerprint. Approval decisions and replay lineage are persisted and tenant-scoped. Temporal owns durable retries, timers, waiting, and cancellation; optional LangGraph lanes remain bounded inside that durable boundary. Activation is rejected when the selected dependency is absent, while runtime-governance responses expose existing deployment drift instead of deferring it to execution.

## Runtime Governance

### Cross-resource governance

- `GET /runtime-governance/events`
- `GET /runtime-governance/overview`
- `GET /runtime-governance/worklist`

### Model Endpoints

- `POST /model-endpoints`
- `GET /model-endpoints`
- `GET /model-endpoints/governance-summary`
- `POST /model-endpoints/{model_endpoint_id}/preview`
- `GET /model-endpoints/{model_endpoint_id}/health-history`
- `POST /model-endpoints/{model_endpoint_id}/credentials/rotate`
- `PATCH /model-endpoints/{model_endpoint_id}`
- `POST /model-endpoints/{model_endpoint_id}/governance-action`
- `DELETE /model-endpoints/{model_endpoint_id}`

### MCP Connectors

- `POST /mcp-connectors`
- `GET /mcp-connectors`
- `GET /mcp-connectors/governance-summary`
- `POST /mcp-connectors/{mcp_connector_id}/preview`
- `GET /mcp-connectors/{mcp_connector_id}/health-history`
- `POST /mcp-connectors/{mcp_connector_id}/credentials/rotate`
- `PATCH /mcp-connectors/{mcp_connector_id}`
- `POST /mcp-connectors/{mcp_connector_id}/governance-action`
- `GET /mcp-connectors/{mcp_connector_id}/compatibility`
- `DELETE /mcp-connectors/{mcp_connector_id}`
- `GET /mcp-connectors/{mcp_connector_id}/tools`

### Tool Registrations

- `POST /tool-registrations`
- `GET /tool-registrations`
- `GET /tool-registrations/governance-summary`
- `GET /tool-registrations/runtime-audit`
- `GET /tool-registrations/mcp-boundary-worklist`
- `POST /tool-registrations/{tool_registration_id}/preview`
- `PATCH /tool-registrations/{tool_registration_id}`
- `POST /tool-registrations/{tool_registration_id}/governance-action`
- `DELETE /tool-registrations/{tool_registration_id}`

Model and MCP credentials use encrypted storage and explicit rotation. Preview, compatibility, health, approval, and policy actions persist bounded governance evidence. Redis-backed cross-instance concurrency and request-rate limits apply to model and MCP runtime lanes.

## Maintenance Rule

When a route is added, removed, or renamed:

1. update the FastAPI contract and tests;
2. update this inventory in the same change;
3. keep query/filter detail in generated OpenAPI rather than duplicating every optional parameter here;
4. never document a planned route as implemented.
