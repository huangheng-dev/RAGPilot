# Local Development Runbook

## Prerequisites

- Docker Desktop
- Node.js 20+
- Python 3.10+ for native service development

## Local Ports

RagPilot currently uses these default local ports:

- Web: `3001`
- API: `18000`
- Temporal UI: `8081`
- Temporal gRPC: `7234`
- PostgreSQL: `5433`
- Redis: `6380`
- Elasticsearch: `9201`
- MinIO API: `9002`
- MinIO Console: `9003`

These ports were intentionally chosen to avoid conflicts with other local projects.

## Recommended Flow

1. Copy `.env.example` to `.env`.
2. Start the platform infrastructure:

```bash
npm run compose:up
```

The Compose project name is fixed as `ragpilot`, which keeps container names and volumes separate from other local projects.

3. Open the local web application:

- Home: `http://127.0.0.1:3001`
- Chat: `http://127.0.0.1:3001/chat`
- Documents: `http://127.0.0.1:3001/documents`
- Operations: `http://127.0.0.1:3001/operations`
- Agents: `http://127.0.0.1:3001/agents`
- Settings: `http://127.0.0.1:3001/settings`
- Admin: `http://127.0.0.1:3001/admin`
- Legacy workspace compatibility entry: `http://127.0.0.1:3001/workspace`

Current local access behavior:

- `Home`, `Chat`, `Documents`, `Operations`, `Agents`, `Settings`, and `Admin` redirect to `/login` when no local mock session exists
- the login page returns the operator to the originally requested protected route after sign-in
- the `Home` page now persists tenant, workspace, and knowledge-base scope in the URL
- the `Home` page now shows live recent document activity, workflow queue snapshots, and active-agent summaries for the current scope
- the `Home` page now also surfaces the active runtime posture from API health so the current default chat model, retrieval engine, and agent runtime engine stay visible in the visible core
- ready documents and completed workflow runs shown in `Home` now hand off directly into grounded chat validation when the main chain is already ready
- agent-driven handoff into `Chat`, `Documents`, `Operations`, and the shared workspace surfaces now preserves `agent_id` in the URL
- `Admin` currently allows local `super_admin` and `reviewer` roles, while `operator` stays in workspace-facing surfaces
- the top navigation supports English and Simplified Chinese switching
- the top navigation supports light and dark appearance switching
- the avatar dropdown currently exposes `Operations`, `Admin`, `Settings`, and sign-out
- the `Settings` page currently controls the local session profile, language, appearance, and platform entry links
- the runtime posture shown in `Home`, `Admin`, and `Settings` now reflects the effective default chat runtime after model-endpoint resolution instead of only echoing raw API settings
- the `Agents` page now reads tenant-scoped persisted agent definitions from the API instead of browser-local draft storage
- the `Agents` page now supports API-backed search, status filtering, and structured knowledge-base scope selection tied to live workspace resources
- the `Agents` page now supports mode filtering and scoped runtime handoff into `Chat`, `Documents`, `Operations`, and `Admin`
- the `Agents` page now preserves tenant, status, search, and selected-agent state in the URL for governance deep links
- recent execution review in `Agents` and `Operations` now also exposes the resolved runtime model binding so governed endpoint usage versus service-default runtime stays visible
- grounded chat assistant messages now also expose runtime binding metadata so a governed `Ollama` or `vLLM` endpoint can be distinguished from service-default fallback directly inside the chat surface
- grounded chat assistant messages now also expose the resolved retrieval engine from persisted answer history, so `native` versus `llamaindex_pilot` stays visible on the real chat surface
- grounded execution review in `Agents` now also exposes the resolved retrieval engine alongside retrieval profile and mode for live execution evidence
- grounded execution review in `Agents` and `Operations` now also exposes configured runtime engine, actual executed runtime engine, and explicit native fallback posture for bounded LangGraph execution
- the `Operations` page now acts as a dedicated tenant-level workflow supervision plane with queue cards, retry handling, and selected-run detail independent from the shared workspace route
- the `Operations` page now shows active workflow-recovery agents and can deep-link into filtered agent recovery scope
- the `Operations` page now preserves tenant, queue filters, search, retry mode, and selected workflow run in the URL for shareable execution deep links
- the `Admin` page now includes agent governance inventory and can deep-link directly into filtered `Agents` and `Operations` states
- the `Admin` page now includes a persisted member directory backed by `/api/v1/users`
- the `Admin` page can now create members, edit persisted member profiles, bind them to the selected tenant scope, filter by membership and account status, and activate or suspend tenant memberships
- the `Admin` page can now remove a selected tenant membership directly from the member directory
- local `reviewer` sessions now stay read-only in the admin console, while local `super_admin` sessions retain governance write actions
- local `reviewer` sessions now stay read-only in `Agents` and cannot trigger workflow retries in `Operations`
- local session role switching is now constrained in `Settings`; use `/login` when you need to change the mock session role
- selected write APIs now also honor mock-session actor headers (`X-RagPilot-Role`, `X-RagPilot-Actor-Id`) for member governance, agent mutation, and workflow retry protection
- admin member creation through `POST /api/v1/users` now also requires a `super_admin` actor header on the API side
- tenant creation, workspace lifecycle changes, and knowledge-base publication writes now also require a `super_admin` actor header on the API side
- document upload, reindex, and delete writes now also require an `operator` or `super_admin` actor header on the API side
- chat conversation create, message send, conversation rename, and conversation delete writes now also require an `operator` or `super_admin` actor header on the API side
- the `/login` page now reuses or provisions a persisted user-directory record by email through the dedicated `/api/v1/users/bootstrap` flow before creating the local browser session
- the `/login` page now reads `/api/v1/users/bootstrap/status` so the very first persisted directory user can be clearly presented as the initial `super_admin`
- once the first persisted directory user exists, `/api/v1/users/bootstrap` no longer acts as open sign-up; later members must be created or invited from `Admin`
- the `/login` page now resolves sign-in through `/api/v1/users/login` so directory eligibility checks and successful sign-in timestamps are enforced on the API side
- inactive directory users are now blocked from creating a new local session through `/login`
- directory users with persisted tenant memberships but no active membership are now also blocked from creating or restoring a local session
- invited directory users can now activate tenant memberships from `/login` with their email address plus an invitation code issued by `Admin`
- invited tenant memberships now carry an expiration window, and expired invitation codes must be reissued from `Admin` before activation can succeed
- member governance now tracks invitation issue counts, the last invitation issuer, and the last successful directory sign-in
- admin can now revoke invited membership credentials without deleting the member record
- admin now also reads persisted member access events so recent sign-in, invitation issue, invitation activation, and invitation revocation activity is visible from the governance surface
- the admin access-event panel now supports event-type filtering for faster governance review
- admin-triggered invitation issuance, invitation revocation, and membership status changes now attach a persisted governance note to the access-event stream
- the `Settings` page now updates the linked persisted user-directory record when the local session already has a bound member id
- the avatar dropdown and `Settings` page now expose the current session's persisted tenant memberships
- member changes applied to the currently signed-in directory user are now synced back into the local browser session
- saved browser sessions now rehydrate against the persisted user directory on startup and are cleared when the linked member record is removed, inactive, or left without any active tenant membership
- the `Admin` page can now issue or regenerate invitation credentials for invited tenant memberships without directly forcing them active

4. Confirm the API is healthy:

- `http://127.0.0.1:18000/api/v1/health`

5. If you changed identity, membership invitation, or RBAC policy schema, run the latest migration before opening `/login`:

```powershell
cd apps/api
$env:POSTGRES_HOST='localhost'
$env:POSTGRES_PORT='5433'
alembic upgrade head
```

## Iteration Rhythm

Use this working rhythm during active implementation:

1. When a new technology is introduced, advance one technology at a time until that runtime or framework reaches a visible closure in product, governance, and validation.
2. Within that single-technology round, advance `3-5` meaningful tasks in one delivery batch when feasible.
3. Prefer local validation such as type checks, tests, and targeted health checks while the stack is already running.
4. Do not restart services after every small change.
5. Restart the affected services only after major changes, especially when runtime wiring, dependencies, environment loading, or cross-page behavior may have changed.
6. After a major change and restart, run a focused verification pass before continuing the next batch.

Execution constraint:

- do not advance technology in isolation from the main product chain
- tie each technology round back to a real flow such as sign-in, scope resolution, document intake, retrieval validation, grounded chat, workflow recovery, admin governance, or agent execution review
- do not count a technology as done when it only appears in a health endpoint, optional dependency, or compare utility
- finish each technology round through product usage, persistence, governance visibility, UI visibility, and focused verification

This keeps development fast while still protecting the current end-to-end operator path.

## Isolated Frontend Work

```bash
npm install
npm run web:serve
```

Optional web environment:

- set `NEXT_PUBLIC_GIT_REPOSITORY_URL` only when the top navigation should expose a real repository link

Use `npm run web:dev` only when you specifically need hot-reload debugging. The current Windows and Next.js 15 local stack is more reliable through the stable production-style serve path above.

## Isolated Backend Work

```bash
cd apps/api
python -m venv .venv
.venv\Scripts\activate
pip install -e .
uvicorn ragpilot_api.main:app --reload --port 18000
```

## Database Migrations

Run API database migrations from the host machine:

```powershell
cd apps/api
$env:POSTGRES_HOST='localhost'
$env:POSTGRES_PORT='5433'
alembic upgrade head
```

If the API virtual environment already exists, this can also be run from the repository root:

```bash
npm run api:migrate
```

## Worker Development

```bash
cd apps/worker
python -m venv .venv
.venv\Scripts\activate
pip install -e .
python -m ragpilot_worker.main
```

Worker defaults to a deterministic local embedding provider that keeps the ingestion path testable without external model credentials.

To switch the worker to an OpenAI-compatible embeddings endpoint, set environment variables before starting it:

```powershell
$env:EMBEDDING_PROVIDER='openai_compatible'
$env:EMBEDDING_MODEL='text-embedding-3-small'
$env:EMBEDDING_API_BASE_URL='https://your-endpoint.example.com/v1'
$env:EMBEDDING_API_KEY='replace-me'
python -m ragpilot_worker.main
```

The current database schema stores vectors as `vector(1536)`, so the configured embedding model must also return 1536-dimensional vectors.

## Chat Model Provider

The API defaults to a deterministic grounded chat provider for local development.

The retrieval stack now also exposes an explicit engine selector:

```powershell
$env:RETRIEVAL_ENGINE='native'
```

Current accepted values:

- `native`
- `llamaindex_pilot`
- `llamaindex_reserved`

`llamaindex_pilot` is the current minimal optional adapter path. `llamaindex_reserved` remains as a temporary compatibility alias. Keep `native` as the normal default until we complete grounded question comparison and quality validation for the pilot path. The API health payload now also reports the active `retrieval_engine`, `agent_runtime_engine`, `chat_model_provider`, and `chat_model_name`, plus whether the optional `LlamaIndex` and `LangGraph` pilot dependencies are actually loadable in the current API environment.

The agent-execution stack now also exposes an explicit runtime selector:

```powershell
$env:AGENT_RUNTIME_ENGINE='native'
```

Current accepted values:

- `native`
- `langgraph_pilot`
- `langgraph_reserved`

`langgraph_pilot` is the current bounded optional adapter path for graph-based agent orchestration. It is currently scoped to the `workflow_recovery` lane and falls back to the native runtime for other agent modes. `langgraph_reserved` remains as a temporary compatibility alias. Keep `native` as the normal default until the pilot proves it adds product value without weakening RagPilot auditability.

Current runtime-identity behavior:

- API health normalizes `langgraph_reserved` back to `langgraph_pilot`
- grounded execution payloads persist both the configured runtime engine and the actual executed runtime engine
- when `langgraph_pilot` falls back to native outside `workflow_recovery`, the execution record now keeps an explicit fallback reason instead of presenting the run as if LangGraph executed it

When the first `LlamaIndex` retrieval pilot is ready, install the optional backend dependency from `apps/api`:

```powershell
pip install -e ".[retrieval-llamaindex]"
```

To enable the same pilot inside Docker Compose, set:

```powershell
$env:RAGPILOT_API_OPTIONAL_EXTRAS='retrieval-llamaindex'
$env:RETRIEVAL_ENGINE='llamaindex_pilot'
docker compose -f infra/docker/compose.yaml up -d --build api
```

When the first `LangGraph` agent-runtime pilot is needed, install the optional backend dependency from `apps/api`:

```powershell
pip install -e ".[agent-langgraph]"
```

To switch chat generation to an OpenAI-compatible endpoint:

```powershell
$env:CHAT_MODEL_PROVIDER='openai_compatible'
$env:CHAT_MODEL_NAME='gpt-4o-mini'
$env:CHAT_MODEL_API_BASE_URL='https://your-endpoint.example.com/v1'
$env:CHAT_MODEL_API_KEY='replace-me'
```

To switch chat generation to a local `Ollama` runtime:

```powershell
$env:CHAT_MODEL_PROVIDER='ollama'
$env:CHAT_MODEL_NAME='llama3.1'
$env:CHAT_MODEL_API_BASE_URL='http://127.0.0.1:11434'
$env:CHAT_MODEL_API_KEY=''
```

`Ollama` uses its native `/api/chat` interface inside RagPilot, so the configured base URL may be either `http://127.0.0.1:11434` or `http://127.0.0.1:11434/v1`.

To switch chat generation to a `vLLM` runtime:

```powershell
$env:CHAT_MODEL_PROVIDER='vllm'
$env:CHAT_MODEL_NAME='meta-llama/Llama-3.1-8B-Instruct'
$env:CHAT_MODEL_API_BASE_URL='http://127.0.0.1:8001/v1'
$env:CHAT_MODEL_API_KEY=''
```

`vLLM` is treated as an OpenAI-compatible provider inside RagPilot, so the configured base URL should point at the server root that exposes `/v1/chat/completions`.

If a persisted model endpoint is marked as the default endpoint in `Settings`, grounded chat without an agent-specific runtime binding will use that governed endpoint before falling back to raw `CHAT_MODEL_*` settings.

## Minimal Operator Smoke Check

Use this flow to verify the current platform path:

1. Open `Chat`.
2. If redirected, create a local mock session through `/login`.
3. Ensure a tenant, workspace, and knowledge base exist.
4. Confirm the current conversation scope is visible and workspace context loads.
5. Upload a Markdown or text document from the workspace controls.
6. Wait for the ingestion workflow to appear.
7. Open the `Documents` view and confirm document state is visible.
8. Ask a grounded question in `Chat`.
9. Open `Operations` and inspect the related run.
10. Use batch or single-document reindex from `Documents` if needed.

The legacy `Workspace` route can still be used for compatibility deep links, but the primary operator path is now `Chat`, `Documents`, and `Operations`.

Current retrieval diagnostics behavior:

- `Home` and `Workspace` can run a single live retrieval check through `POST /api/v1/retrieve`
- the single retrieval response now also returns `engine_name`, and both `Home` and `Workspace` surface that active retrieval engine in the diagnostics status area
- retrieval responses now also expose native rerank metadata, including whether rerank ran, which strategy was used, and the candidate-window size
- `Home` and `Workspace` can also compare `native` versus `llamaindex_pilot` retrieval output through `POST /api/v1/retrieve/compare`
- the comparison response now includes a recommendation state and explanation so engine review can stay governed instead of relying on raw chunk diffs alone
- grounded chat history now also persists rerank metadata inside retrieval diagnostics so citation review can see the post-merge ranking posture that produced the answer
- use the comparison path before switching the active retrieval engine away from `native`

Current retry semantics:

- failed document ingestion runs can be retried from `Operations`
- retries against deleted source documents return a conflict instead of silently attempting a rebuild
- deterministic ingestion failures are marked non-retryable in Temporal so they do not loop through repeated activity attempts

## Minimal Retrieval Smoke Check

Once API and worker are running and a document has completed ingestion, vector retrieval is available through:

```http
POST /api/v1/retrieve
```

Example request body:

```json
{
  "tenant_id": "replace-with-tenant-id",
  "knowledge_base_id": "replace-with-knowledge-base-id",
  "query_text": "Which system handles durable ingestion workflows?",
  "top_k": 3
}
```

## Minimal Chat Smoke Check

Once retrieval is working, a grounded chat round-trip is available through:

```http
POST /api/v1/chat/messages
```

Example request body:

```json
{
  "tenant_id": "replace-with-tenant-id",
  "workspace_id": "replace-with-workspace-id",
  "knowledge_base_id": "replace-with-knowledge-base-id",
  "question": "Which system handles durable ingestion workflows?",
  "top_k": 3
}
```

Conversation history can be read back through:

```http
GET /api/v1/chat/conversations?tenant_id=...&workspace_id=...
GET /api/v1/chat/messages?tenant_id=...&conversation_id=...
```

## Notes

- `Python 3.10+` is recommended even if Docker is the main runtime.
- The current stack already supports a real local operator workflow.
- Start with document ingestion and grounded chat before expanding into advanced agent flows.
