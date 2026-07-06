# RAGPilot API

This service acts as the API gateway and business boundary for RAGPilot.

## API Scope

The API supports:

- health checks
- shared runtime configuration
- database migration foundation
- tenant APIs
- workspace APIs
- knowledge base APIs
- document APIs
- retrieval API
- chat APIs
- workflow APIs
- agent definition APIs
- user and directory session APIs
- model endpoint governance APIs
- tool registration governance APIs
- runtime governance and audit worklist APIs

## Resource APIs

- `GET /api/v1/health`
- `GET /api/v1/tenants`
- `POST /api/v1/tenants`
- `PATCH /api/v1/tenants/{tenant_id}`
- `GET /api/v1/workspaces?tenant_id={tenant_id}`
- `GET /api/v1/workspaces?tenant_id={tenant_id}&is_archived={true|false}`
- `POST /api/v1/workspaces`
- `PATCH /api/v1/workspaces/{workspace_id}?tenant_id={tenant_id}`
- `POST /api/v1/workspaces/{workspace_id}/lifecycle?tenant_id={tenant_id}`
- `GET /api/v1/knowledge-bases?workspace_id={workspace_id}`
- `GET /api/v1/knowledge-bases?workspace_id={workspace_id}&publication_status={draft|published}`
- `POST /api/v1/knowledge-bases`
- `PATCH /api/v1/knowledge-bases/{knowledge_base_id}?workspace_id={workspace_id}`
- `POST /api/v1/knowledge-bases/{knowledge_base_id}/publication?workspace_id={workspace_id}`
- `GET /api/v1/documents?knowledge_base_id={knowledge_base_id}`
- `GET /api/v1/documents/metrics?knowledge_base_id={knowledge_base_id}`
- `GET /api/v1/documents/{document_id}?knowledge_base_id={knowledge_base_id}`
- `POST /api/v1/documents/upload`
- `POST /api/v1/documents/import-webpage`
- `POST /api/v1/documents/{document_id}/reindex?knowledge_base_id={knowledge_base_id}`
- `DELETE /api/v1/documents/{document_id}?knowledge_base_id={knowledge_base_id}`
- `POST /api/v1/retrieve`
- `POST /api/v1/retrieve/compare`
- `GET /api/v1/chat/conversations?tenant_id={tenant_id}&workspace_id={workspace_id}`
- `GET /api/v1/chat/conversations?tenant_id={tenant_id}&workspace_id={workspace_id}&query={title_fragment}`
- `GET /api/v1/chat/conversations?tenant_id={tenant_id}&workspace_id={workspace_id}&limit={count}`
- `GET /api/v1/chat/conversations/metrics?tenant_id={tenant_id}&workspace_id={workspace_id}`
- `POST /api/v1/chat/conversations`
- `PATCH /api/v1/chat/conversations/{conversation_id}?tenant_id={tenant_id}`
- `DELETE /api/v1/chat/conversations/{conversation_id}?tenant_id={tenant_id}`
- `GET /api/v1/chat/messages?tenant_id={tenant_id}&conversation_id={conversation_id}`
- `POST /api/v1/chat/messages`
- `GET /api/v1/workflow-runs?tenant_id={tenant_id}`
- `GET /api/v1/workflow-runs/metrics?tenant_id={tenant_id}`
- `GET /api/v1/workflow-runs/{workflow_run_id}?tenant_id={tenant_id}`
- `POST /api/v1/workflow-runs/{workflow_run_id}/retry?tenant_id={tenant_id}`
- `GET /api/v1/agents?tenant_id={tenant_id}`
- `POST /api/v1/agents`
- `PATCH /api/v1/agents/{agent_definition_id}?tenant_id={tenant_id}`
- `DELETE /api/v1/agents/{agent_definition_id}?tenant_id={tenant_id}`
- `GET /api/v1/model-endpoints`
- `POST /api/v1/model-endpoints`
- `PATCH /api/v1/model-endpoints/{model_endpoint_id}`
- `DELETE /api/v1/model-endpoints/{model_endpoint_id}`
- `GET /api/v1/tool-registrations`
- `POST /api/v1/tool-registrations`
- `PATCH /api/v1/tool-registrations/{tool_registration_id}`
- `DELETE /api/v1/tool-registrations/{tool_registration_id}`

## API Behaviors

Document list supports:

- search
- status filtering
- sorting
- pagination

Workflow list supports:

- search
- status filtering
- workflow type filtering
- retry-mode filtering for original runs versus retry runs
- sorting
- pagination

Workflow metrics expose:

- `queued_runs`
- `running_runs`
- `retry_runs`

Chat conversation APIs expose a summary metrics endpoint so the web console can render tenant-level and workspace-level conversation activity without scraping conversation lists client-side.

Conversation deletion is handled through the chat API and removes the persisted conversation together with its stored messages and citations inside the tenant scope.

Conversation listing supports title search, limit controls, and recent-activity ordering so operator surfaces can keep active threads at the top.

Conversation list payloads include:

- `message_count`
- `latest_activity_at`

Implicit chat-created conversations receive default titles derived from the first user prompt, which keeps workspace history easier to scan.

Both list endpoints expose browser-readable paging headers:

- `X-Total-Count`
- `X-Limit`
- `X-Offset`
- `X-Result-Count`

The web console uses the single-document reindex and delete endpoints to drive batch document operations client-side.

Uploaded documents create a database workflow run and attempt to start a Temporal `document_ingestion` workflow path.

Single-page web imports reuse that same ingestion path through `POST /api/v1/documents/import-webpage`, preserving the fetched source URL on the managed document record instead of treating the page as a separate ingestion subsystem.

The retrieval API supports structured engine comparison through `POST /api/v1/retrieve/compare`, which compares a baseline engine such as `native` against a candidate such as `llamaindex_pilot` and returns overlap diagnostics, per-engine method breakdowns, and top-result agreement.

The health API also reports runtime readiness for `llamaindex_pilot` and `langgraph_pilot`, together with the effective chat-model binding resolved from governed runtime configuration.

The authentication-mode API exposes a final-boundary contract for local versus provider-managed sign-in, including invitation-activation availability, initial-bootstrap eligibility, provider protocol, and optional provider post-sign-out routing.

Model-endpoint governance APIs persist:

- provider type
- provider base URL
- model name
- credential delivery posture
- chat and embedding capability flags
- default-route designation

Tool-registration governance APIs persist:

- transport type
- surface ownership
- callable endpoint reference
- free-form capability tags
- admin-approval requirement
- enabled posture

Agent-definition APIs persist:

- execution mode and activation state
- scoped knowledge-base boundary
- page-surface tool bindings
- governed model-endpoint binding
- governed tool-registration bindings

## Database Migrations

Alembic migrations live in `migrations/`.

Run migrations from `apps/api`:

```bash
alembic upgrade head
```

When running Alembic from the host machine against the Docker Compose database, override the database host and port:

```powershell
$env:POSTGRES_HOST='localhost'
$env:POSTGRES_PORT='5433'
alembic upgrade head
```

## Naming Direction

The API uses English-first, domain-oriented naming:

- package root: `ragpilot_api`
- route modules: `*_routes.py`
- DTO contracts: `*_contracts.py`
- application services: `*_service.py`
- shared runtime configuration: `shared/settings.py`

## Service Boundary

The API owns:

- local directory and password-local sign-in
- provider-managed authentication contracts for `OIDC` and `SAML`
- tenant, workspace, knowledge-base, document, chat, workflow, and agent resource contracts
- runtime governance for model endpoints, retrieval profiles, tool registrations, and MCP-compatible connectors
- audit-ready session, access, and runtime review surfaces
