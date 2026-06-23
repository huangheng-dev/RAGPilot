# RagPilot API Outline

## Purpose

This document lists the current API surface at the resource level and shows how the RagPilot backend is organized from an HTTP perspective.

## API Base

```text
/api/v1
```

## Meta Endpoints

### Health

- `GET /health`

Purpose:

- service health verification
- local development smoke checks

## Identity and Tenancy Endpoints

### Users

- `POST /users/bootstrap`
- `GET /users/bootstrap/status`
- `POST /users/login`
- `GET /users/login-assessment?email=...`
- `POST /users/activate-invitations`
- `GET /users`
- `POST /users`
- `GET /users/me`
- `POST /users/me/sign-out`
- `GET /users/me/permissions`
- `GET /users/me/access-events`
- `GET /users/audit-events`
- `GET /users/{user_id}`
- `PATCH /users/{user_id}`
- `POST /users/{user_id}/memberships`
- `PATCH /users/{user_id}/memberships/{membership_id}`
- `DELETE /users/{user_id}/memberships/{membership_id}`
- `POST /users/{user_id}/memberships/{membership_id}/invitation`
- `POST /users/{user_id}/memberships/{membership_id}/revoke-invitation`

Purpose:

- bootstrap the first local super administrator
- assess login state before sign-in
- issue backend-managed bearer sessions on successful sign-in and invitation activation
- activate invited memberships
- manage persisted directory users and tenant memberships
- expose the current authenticated directory user
- expose the current user's backend permission snapshot through `/users/me/permissions`
- review self-scoped and administrator-scoped access events

The current permission snapshot is the first backend-owned RBAC contract for web protected routes and key action controls. It keeps the current local session flow working while moving page access, workspace context resource management, member-directory governance, and action gating toward server-defined capabilities. Core write routes for documents, chat, workflow retry, agents, admin resources, runtime governance, member management, and audit review now use named capability checks so API enforcement can converge with frontend action gating. The `/users/me/permissions` snapshot now prefers database-backed `roles`, `permissions`, and `role_permissions` grants, then falls back to the centralized code policy when the database policy is unavailable or unseeded for the current role. The current protected route families now use the same database-policy-first checks, with self-service member access preserved through explicit self-or-capability evaluation.

Current authentication transport characteristics:

- `POST /users/login` and `POST /users/activate-invitations` now return `{ user, session }` envelopes
- `session.session_token` is the current backend-issued bearer token for the web console
- protected `users/me` reads now prefer `Authorization: Bearer <session_token>`
- protected sign-out now uses `POST /users/me/sign-out` and revokes the current backend session before the browser-local session is cleared
- legacy `X-RagPilot-Role` and `X-RagPilot-Actor-Id` headers remain as transitional compatibility support while all protected routes finish converging on server-managed sessions

### Tenants

- `GET /tenants`
- `POST /tenants`
- `PATCH /tenants/{tenant_id}`

Purpose:

- list tenant contexts
- create tenant contexts
- update tenant metadata

## Workspace Endpoints

### Workspaces

- `GET /workspaces?tenant_id=...`
- `GET /workspaces?tenant_id=...&is_archived=true|false`
- `POST /workspaces`
- `PATCH /workspaces/{workspace_id}?tenant_id=...`
- `POST /workspaces/{workspace_id}/lifecycle?tenant_id=...`

Purpose:

- list workspaces within a tenant
- filter workspaces by lifecycle state
- create workspaces
- update workspace metadata
- archive or unarchive a workspace

## Knowledge Base Endpoints

### Knowledge Bases

- `GET /knowledge-bases?workspace_id=...`
- `GET /knowledge-bases?workspace_id=...&publication_status=draft|published`
- `POST /knowledge-bases`
- `PATCH /knowledge-bases/{knowledge_base_id}?workspace_id=...`
- `POST /knowledge-bases/{knowledge_base_id}/publication?workspace_id=...`

Purpose:

- list knowledge bases within a workspace
- filter knowledge bases by publication state
- create knowledge bases
- update knowledge base metadata
- move a knowledge base between `draft` and `published`

## Document Endpoints

### Document Management

- `GET /documents?knowledge_base_id=...`
- `GET /documents/metrics?knowledge_base_id=...`
- `GET /documents/{document_id}?knowledge_base_id=...`
- `GET /documents/{document_id}/activity?knowledge_base_id=...`
- `POST /documents/upload`
- `POST /documents/{document_id}/reindex?knowledge_base_id=...`
- `POST /documents/{document_id}/restore?knowledge_base_id=...`
- `DELETE /documents/{document_id}?knowledge_base_id=...`

Purpose:

- list document records
- retrieve document summary counts for operator dashboards
- inspect a document and its latest chunk state
- inspect document lifecycle and workflow activity history
- upload and start ingestion
- reindex a document through a new version path
- restore a soft-deleted document back into active retrieval scope
- soft delete a document

Supported list query controls:

- `query`
- `lifecycle`
- `status`
- `sort`
- `limit`
- `offset`

Document list responses expose paging metadata through response headers:

- `X-Total-Count`
- `X-Limit`
- `X-Offset`
- `X-Result-Count`

Document detail and activity inspection can explicitly include deleted records through `include_deleted=true`.

The current web console uses the single-document reindex, restore, and delete endpoints to orchestrate batch document lifecycle operations client-side.

Document list, metrics, detail, and activity reads now all require the same document-access capability family used by the protected web document surfaces.

## Retrieval Endpoints

### Retrieval

- `POST /retrieve`
- `POST /retrieve/compare`
- `POST /retrieve/evaluations`
- `GET /retrieve/evaluations?tenant_id=...&workspace_id=...`
- `GET /retrieve/evaluations/summary?tenant_id=...&workspace_id=...`

Purpose:

- run retrieval against a selected knowledge base
- return hybrid retrieval context for grounded answering
- compare retrieval output between a baseline engine and a candidate engine
- persist scoped retrieval evaluation records
- review recent retrieval evaluation history for the current workspace scope
- summarize repeated retrieval-review pressure into tuning candidates for the current workspace scope

Current retrieval response characteristics:

- `retrieval_mode` now resolves from the effective retrieval profile and can return `hybrid`, `vector`, or `lexical`
- retrieval responses now also expose `retrieval_profile_id`, `retrieval_profile_name`, `retrieval_profile_source`, and `effective_top_k`
- retrieval responses now also expose `rerank_applied`, `rerank_strategy`, and `rerank_window`
- each result includes `retrieval_method` such as `vector`, `lexical`, or `hybrid`
- each result can also include `rerank_score` and `rerank_rank` when native rerank is active
- lexical and vector candidates are deduplicated and fused before final ranking
- fused candidates now also pass through a native rerank window before the final top-k is returned

Current retrieval comparison characteristics:

- `POST /retrieve/compare` compares `baseline_engine` and `candidate_engine` on the same scoped question
- the response returns per-engine diagnostics, including `retrieval_method_breakdown`, `top_result_chunk_id`, `top_result_document_title`, and rerank metadata
- the response summary returns shared versus engine-only chunk identifiers plus `top_result_matches`

Current retrieval evaluation characteristics:

- `POST /retrieve/evaluations` records inspect or compare runs as durable scoped evaluation history
- evaluation records keep the query text, mode, validation status, engine identities, result counts, recommendation text, and payload snapshot
- `GET /retrieve/evaluations` returns recent scoped history for workspace-level retrieval review
- `GET /retrieve/evaluations/summary` groups recent scoped evaluations into repeated-query candidates and status totals for retrieval tuning follow-up
- grouped tuning candidates now also include the latest source-document hints extracted from evaluation payloads, so operators can jump directly back into document review before rerunning retrieval or chat
- grouped tuning candidates now also expose retrieval-profile identity when it is present in the recorded payload, so the web console can deep-link from diagnostics into focused retrieval governance

## Chat Endpoints

### Conversations

- `GET /chat/conversations?tenant_id=...&workspace_id=...`
- `GET /chat/conversations?tenant_id=...&workspace_id=...&query=...`
- `GET /chat/conversations?tenant_id=...&workspace_id=...&limit=...`
- `GET /chat/conversations/metrics?tenant_id=...&workspace_id=...`
- `POST /chat/conversations`
- `PATCH /chat/conversations/{conversation_id}?tenant_id=...`
- `DELETE /chat/conversations/{conversation_id}?tenant_id=...`

Purpose:

- list conversation history
- search conversation history by title
- limit conversation list size for overview and workspace surfaces
- retrieve persisted conversation and message summary counts
- create explicit conversation records
- rename persisted conversation records
- delete persisted conversation records together with stored messages and citations

Conversation list responses are ordered by recent activity so the workspace surfaces can prioritize active threads instead of only newest-created records.

Conversation list, conversation metrics, and message-history reads now require chat-access capability checks instead of remaining publicly readable during the transition to backend-managed sessions.

Conversation list query controls currently include:

- `query`
- `limit`

Conversation list responses now also include:

- `message_count`
- `latest_activity_at`

### Messages

- `GET /chat/messages?tenant_id=...&conversation_id=...`
- `POST /chat/messages`
- `POST /chat/messages/{message_id}/feedback?tenant_id=...`
- `GET /chat/feedback/summary?tenant_id=...&workspace_id=...`

Purpose:

- list stored messages
- create a grounded question/answer round-trip
- persist operator answer feedback on assistant messages
- summarize recent answer-feedback pressure inside a workspace scope

When a new message creates an implicit conversation thread, the API now generates a cleaner default title from the first user prompt so workspace history is easier to scan.

Current grounded-message feedback characteristics:

- feedback is stored per assistant message and per submitting user
- the current answer-quality values are `helpful`, `partially_helpful`, and `not_helpful`
- the current citation-quality values are `grounded`, `partial`, and `broken`
- message history responses now include `feedback_entries` so the web chat surface can render persisted answer review state inline

## Model Governance Endpoints

### Model Endpoints and Runtime Preview

- `GET /model-endpoints`
- `GET /model-endpoints?provider_type=deterministic|openai_compatible|ollama|ollama_reserved|vllm|vllm_reserved`
- `GET /model-endpoints?is_enabled=true|false`
- `GET /model-endpoints?runtime_state=disabled_bound|managed_reserved|missing_base_url|missing_credential_hint|runtime_ready`
- `GET /model-endpoints/governance-summary`
- `POST /model-endpoints`
- `PATCH /model-endpoints/{model_endpoint_id}`
- `DELETE /model-endpoints/{model_endpoint_id}`
- `POST /model-endpoints/{model_endpoint_id}/preview`

Purpose:

- govern provider-facing model endpoints
- review configuration posture across deterministic, Ollama, vLLM, and OpenAI-compatible runtime paths
- expose a backend-owned model governance summary for settings and future admin/runtime surfaces
- preview one governed model endpoint through the built runtime adapter contract

Current model-governance characteristics:

- `GET /model-endpoints/governance-summary` returns backend-owned counts for enabled, bound, default, disabled-bound, runtime-ready, missing-base-url, and credential-mode posture
- the same summary also returns provider and credential breakdowns so model governance can stop depending on page-local counting logic
- `GET /model-endpoints` now also supports backend-owned runtime-state queues for disabled bound, managed reserved, missing-base-url, missing-credential-hint, and runtime-ready endpoint review
- chat and agent execution now also persist runtime-binding fallback metadata, including configured-model reference and fallback reason, when execution resolves through a default model endpoint or service-settings fallback
- preview calls currently distinguish `completed`, `blocked`, and `failed` outcomes through one shared model-runtime contract

## Tool Governance Endpoints

### Tool Registrations and Runtime Preview

- `GET /tool-registrations`
- `GET /tool-registrations?transport_type=native|http|mcp_reserved`
- `GET /tool-registrations?surface_area=chat|documents|operations|admin|agents`
- `GET /tool-registrations?requires_admin_approval=true|false`
- `GET /tool-registrations?runtime_state=approval_required|disabled|missing_endpoint|mcp_reserved|mcp_reserved_bound|mcp_integration_pending|mcp_connector_configured|runtime_ready`
- `GET /tool-registrations/governance-summary`
- `GET /tool-registrations/runtime-audit?tenant_id=...`
- `GET /tool-registrations/runtime-audit?tenant_id=...&tool_registration_id=...`
- `GET /tool-registrations/runtime-audit?tenant_id=...&invocation_status=completed|blocked|reserved|unavailable|failed|skipped`
- `GET /tool-registrations/mcp-boundary-worklist?tenant_id=...`
- `POST /tool-registrations`
- `PATCH /tool-registrations/{tool_registration_id}`
- `DELETE /tool-registrations/{tool_registration_id}`
- `POST /tool-registrations/{tool_registration_id}/preview`
- `POST /tool-registrations/{tool_registration_id}/governance-action`

Purpose:

- govern callable tool registrations
- review tool transport posture across native, HTTP, and reserved MCP boundaries
- expose a backend-owned tool governance summary for settings and future admin/runtime surfaces
- preview one governed tool against tenant or scoped runtime context
- apply direct governance actions to one tool registration without replaying the full edit form
- review a tenant-scoped reserved MCP boundary queue with binding and recent reserved-trace posture

Current tool-governance characteristics:

- `GET /tool-registrations/governance-summary` returns backend-owned counts for enabled, bound, approval-required, runtime-ready, HTTP-missing-endpoint, and MCP-reserved tool posture
- the same summary also returns transport and surface breakdowns so tool governance can stop depending on page-local counting logic
- `GET /tool-registrations/runtime-audit` now flattens persisted tool-runtime traces from recent agent execution history into a backend-owned audit queue, classifies each trace into governance issues such as approval-required, disabled-tool, reserved-MCP, and endpoint-failure posture, and returns aggregate issue counts so settings-side governance can route directly into the right remediation queue without re-deriving trace lists in the browser
- the same audit queue now also preserves explicit governance issues from persisted traces, including `mcp_integration_pending`, so a governance-cleared reserved MCP tool can surface “connector still missing” instead of collapsing back into the generic reserved bucket
- `GET /tool-registrations/mcp-boundary-worklist` now aggregates reserved tool registrations, bound-agent counts, and recent reserved traces for one tenant scope, so MCP-boundary review can move through one owned queue instead of depending on transport filters and manual trace reconstruction
- `GET /tool-registrations/mcp-boundary-worklist` now also returns explicit boundary states, aggregate state counts, and available state-transition actions so reserved MCP review can behave like a governed queue instead of a read-only trace board
- tool preview responses and persisted execution traces now also carry the same `governance_issue` classification, so `Agents`, `Operations`, and `Admin` can open the same remediation actions as `Settings` when tool runtime problems appear during live execution review
- `POST /tool-registrations/{tool_registration_id}/governance-action` now applies direct actions such as enable, disable, require-approval, allow-direct-use, and quarantine, and returns the updated registration envelope for settings-side runtime control
- the same governance-action endpoint now also accepts `review_mcp_boundary`, `ready_mcp_integration`, and `quarantine_mcp_boundary` for reserved MCP tool registrations, and rejects those actions for non-reserved tools with a conflict response
- reserved MCP tool preview now returns `reserved` while the boundary is still under review, but returns `unavailable` plus `mcp_integration_pending` once the boundary is cleared and the runtime connector is still absent
- tool registrations now also persist an optional `connector_reference` for `mcp_reserved` tools, so governance can record the future MCP connector identifier before a real runtime bridge is attached
- `ready_mcp_integration` now requires that connector reference, and `mcp_connector_configured` is now a first-class governance filter for reserved MCP tools that are already wired for future runtime attachment
- preview calls still distinguish `completed`, `blocked`, `reserved`, `unavailable`, `failed`, and `skipped` outcomes through one shared tool-runtime contract

### MCP Connectors

- `GET /mcp-connectors`
- `GET /mcp-connectors?connector_type=streamable_http|sse|managed_reserved`
- `GET /mcp-connectors?runtime_state=disabled|missing_base_url|missing_credential_hint|managed_reserved|referenced|runtime_ready`
- `GET /mcp-connectors/governance-summary`
- `POST /mcp-connectors`
- `PATCH /mcp-connectors/{mcp_connector_id}`
- `DELETE /mcp-connectors/{mcp_connector_id}`
- `POST /mcp-connectors/{mcp_connector_id}/preview`

Purpose:

- govern MCP connector assets before full runtime bridge attachment exists
- persist remote MCP endpoint posture, auth posture, and managed-reserved placeholders
- aggregate which reserved tool registrations already resolve through one connector
- preview connector reachability before MCP tools move into integration-ready posture

Current MCP-connector characteristics:

- MCP connectors are now a first-class governance asset instead of living only as free-text references inside reserved tool registrations
- connector governance summary now returns enabled, referenced, integration-ready, runtime-ready, missing-base-url, missing-credential-hint, and managed-reserved posture
- connector list responses now also expose `referenced_tool_count` and `integration_ready_tool_count`, so Settings can review how many reserved tools already depend on one connector asset
- connector preview currently verifies configuration posture and remote reachability, so pre-integration MCP review can move beyond registry bookkeeping before a full runtime bridge exists
- `ready_mcp_integration` for reserved tools now resolves `connector_reference` against this registry, so MCP-boundary closure depends on a real managed connector asset instead of only a non-empty string

## Agent Endpoints

### Agent Definitions and Runtime Governance

- `GET /agents?tenant_id=...`
- `GET /agents?tenant_id=...&status=draft|active|paused`
- `GET /agents?tenant_id=...&mode=grounded_chat|document_intake|workflow_recovery`
- `GET /agents?tenant_id=...&query=...`
- `GET /agents/metrics?tenant_id=...`
- `GET /agents/runtime-governance?tenant_id=...`
- `GET /agents/runtime-governance?tenant_id=...&status=draft|active|paused`
- `GET /agents/runtime-governance?tenant_id=...&mode=grounded_chat|document_intake|workflow_recovery`
- `GET /agents/runtime-governance?tenant_id=...&readiness=ready|attention`
- `GET /agents/runtime-governance?tenant_id=...&issue=model_missing|model_disabled|retrieval_profile_missing|retrieval_profile_disabled|scope_missing|scope_invalid|tools_missing|tool_registration_disabled|tool_approval_required`
- `GET /agents/runtime-governance?tenant_id=...&model_endpoint_id=...&tool_registration_id=...&retrieval_profile_id=...`
- `POST /agents`
- `PATCH /agents/{agent_definition_id}?tenant_id=...`
- `DELETE /agents/{agent_definition_id}?tenant_id=...`

Purpose:

- list tenant-scoped agent definitions
- summarize definition counts for operator and governance surfaces
- expose a backend-owned runtime-governance posture for model, retrieval, scope, and tool readiness
- create, update, and delete persisted agent definitions

Current runtime-governance response characteristics:

- `GET /agents/runtime-governance` returns `summary` plus per-agent `items`
- each item now includes shared readiness issues, blocking issues, resolved scope, resolved model endpoint, resolved retrieval profile, and bound-tool posture
- `Agents`, `Admin`, and `Settings` now consume this shared contract instead of recomputing runtime readiness independently in the browser
- the same contract now also supports readiness, issue, and concrete runtime-object filters so governance follow-up can reuse one backend-owned affected-definition slice

### Agent Runs and Executions

- `POST /agents/runs`
- `GET /agents/runs?tenant_id=...`
- `GET /agents/runs?tenant_id=...&agent_definition_id=...`
- `GET /agents/runs/metrics?tenant_id=...`
- `GET /agents/runs/metrics?tenant_id=...&agent_definition_id=...`
- `POST /agents/executions`
- `GET /agents/executions?tenant_id=...`
- `GET /agents/executions?tenant_id=...&agent_definition_id=...`
- `GET /agents/executions/metrics?tenant_id=...`
- `GET /agents/executions/metrics?tenant_id=...&agent_definition_id=...`

Purpose:

- persist launch-time handoff records into built surfaces
- execute bounded agent definitions
- inspect execution counts and recent execution history for a tenant or one definition

Current run and execution characteristics:

- run history currently records handoff into built surfaces such as `Home`, `Chat`, `Documents`, `Operations`, and `Admin`
- execution history now carries runtime summaries, grounded evidence previews, retrieval metadata, and bound tool traces where available
- execution payloads now also carry structured `recommended_action_specs` beside legacy summary text, so the web console can render governed follow-up actions from one backend contract across `Agents`, `Operations`, and `Admin`
- `recommended_action_specs` can now resolve either operator-lane continuation or governance repair targets such as `Settings` model, tool, and retrieval-profile review when runtime fallback, tool-governance issues, or evidence gaps are present

## Workflow Endpoints

### Workflow Runs

- `GET /workflow-runs?tenant_id=...`
- `GET /workflow-runs/metrics?tenant_id=...`
- `GET /workflow-runs/{workflow_run_id}?tenant_id=...`
- `POST /workflow-runs/{workflow_run_id}/retry?tenant_id=...`

Purpose:

- list workflow executions
- retrieve workflow summary counts for operator dashboards
- inspect workflow detail and step detail
- retry eligible failed workflow runs

Supported list query controls:

- `query`
- `status`
- `workflow_type`
- `subject_id`
- `sort`
- `limit`
- `offset`

The current web console uses `subject_id` to load document-scoped workflow history, retry lineage, and activity panels without depending on the global workflow timeline page state.

Workflow responses now also expose a subject label when the run is attached to a known document, which lets operator surfaces show document titles instead of only UUID references.

Workflow responses now also expose document-derived workspace and knowledge base identifiers when the run is attached to a known document, which lets overview and governance surfaces deep-link into the correct workspace context.

Workflow responses now also expose structured recovery guidance fields such as `recovery_stage`, `recommended_next_view`, `recommended_primary_action`, and `follow_up_reason`, so `Workspace` and `Operations` can consume the same retry and follow-up contract.

Document list responses now also expose the latest version summary for each document, including version number, parser name, chunk count, token totals, and latest version status.

Document list responses now also expose the latest workflow run summary for each document, which lets operator tables show the most recent ingestion status without opening a detail panel first.

Workflow list responses expose paging metadata through response headers:

- `X-Total-Count`
- `X-Limit`
- `X-Offset`
- `X-Result-Count`

Workflow list, metrics, and detail reads now require operations-access capability checks instead of remaining open during the transition to backend-managed sessions.

## Current API Characteristics

The current API is:

- resource-oriented
- tenant-aware
- English-first
- explicit about workflow-driven operations
- designed for operator and admin workflows

The current API is not yet complete in:

- authentication
- RBAC
- user administration
- audit and usage endpoints
- model governance endpoints
- MCP management endpoints

The current API now also includes an early persisted agent-run history layer:

- `POST /agents/runs`
- `GET /agents/runs?tenant_id=...`
- `GET /agents/runs?tenant_id=...&agent_definition_id=...`
- `GET /agents/runs/metrics?tenant_id=...`
- `GET /agents/runs/metrics?tenant_id=...&agent_definition_id=...`

This layer currently records launch-time handoff into built surfaces such as `Chat`, `Documents`, `Operations`, and `Admin`.

## Near-Term API Expansion

Likely next additions:

- auth and membership endpoints
- admin oversight endpoints
- model governance resources
- evaluation resources
