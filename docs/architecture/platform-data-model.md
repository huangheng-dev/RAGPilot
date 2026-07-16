# RAGPilot Platform Data Model

## Purpose

This document records the database model implemented by the current SQLAlchemy ORM and Alembic migration chain. It is a current-state contract, not a list of speculative tables.

Schema rules:

- tables use plural `snake_case` names
- primary and foreign identifiers use PostgreSQL UUID values
- tenant-owned records carry an explicit `tenant_id` or inherit scope through a verified parent aggregate
- mutable business records use explicit lifecycle/status columns rather than ambiguous flags
- credentials store encrypted payloads or one-way hashes; plaintext secrets are never persisted

## Current Tables

### Identity and tenancy

- `tenants`
- `users`
- `user_sessions`
- `tenant_memberships`
- `roles`
- `permissions`
- `role_permissions`
- `user_access_events`
- `api_keys`
- `api_key_events`
- `access_groups`
- `access_group_memberships`

Users can belong to multiple tenants through `tenant_memberships`; `users` does not own a single `tenant_id`. Access Groups provide tenant-owned retrieval principals without replacing RBAC. Interactive sessions and platform API keys are separate authentication transports. API-key secrets are displayed once and only their hashes are stored.

### Workspaces, knowledge, and ingestion

- `workspaces`
- `knowledge_bases`
- `data_sources`
- `data_source_sync_runs`
- `data_source_items`
- `documents`
- `document_access_grants`
- `document_versions`
- `document_assets`
- `document_chunks`
- `document_chunk_access_grants`
- `document_chunk_embeddings`
- `search_projection_outbox_events`

`documents.data_source_id` and `data_source_items` bind external item identity and version tokens to durable Documents. Data Sources retain synchronization cursor, lease, status, last-success/error posture, and run history. Document and Chunk access grants bind either a User or Access Group and are enforced in retrieval SQL. PostgreSQL remains the business source of truth; Elasticsearch records are rebuildable projections driven through the Outbox lifecycle.

### Chat and citations

- `conversations`
- `messages`
- `message_feedback_entries`
- `message_citations`

Assistant Messages retain model/runtime metadata, usage, retrieval evidence, Prompt version identity, and snapshot hash. Citations bind an answer to concrete document/chunk evidence. Feedback is persisted per assistant Message and submitting User.

### Agents and tools

- `agent_definitions`
- `agent_runs`
- `agent_executions`
- `agent_approval_requests`
- `tool_registrations`
- `mcp_connectors`

Agent definitions own governed scope, model/Tool bindings, and the versioned `runtime_engine` / `runtime_version` policy. Runs record operator-facing launches; Executions own durable task state, result payloads, Prompt bindings, immutable execution-policy and Agent-definition snapshots (including the effective runtime policy), optional JSON Schema output contracts, retry/replay lineage, and replay fingerprints. Approval Requests persist human-wait decisions independently from transient API requests.

### Model, retrieval, Prompt, and runtime governance

- `model_endpoints`
- `retrieval_profiles`
- `retrieval_evaluations`
- `prompt_templates`
- `prompt_versions`
- `runtime_credentials`
- `runtime_governance_events`

Model and MCP credentials are stored through the encrypted runtime-credential boundary. Retrieval Profiles persist `engine_name`, `engine_version`, and the bounded LlamaIndex similarity/reorder policy in addition to fusion and Top-K settings. Runtime-governance events retain bounded health, rotation, preview, approval, and policy evidence. Prompt versions bind to Messages, Agent Runs, and Agent Executions through immutable identifiers and content hashes.

### Workflows and operations

- `workflow_runs`
- `workflow_run_events`
- `workflow_steps`

Workflow Runs own durable lifecycle state and subject identity. Steps retain execution detail, while Events provide ordered operator-readable history including retries, cancellation, notes, and lineage.

## Important Relationships

```text
Tenant
  -> Workspace
    -> KnowledgeBase
      -> DataSource
        -> DataSourceSyncRun
        -> DataSourceItem
      -> Document
        -> DocumentAccessGrant
        -> DocumentVersion
          -> DocumentAsset
          -> DocumentChunk
            -> DocumentChunkAccessGrant
            -> DocumentChunkEmbedding
      -> Conversation
        -> Message
          -> MessageCitation
          -> MessageFeedbackEntry

AgentDefinition
  -> AgentRun
  -> AgentExecution
    -> AgentApprovalRequest

PromptTemplate
  -> PromptVersion
    -> Message / AgentRun / AgentExecution

WorkflowRun
  -> WorkflowStep
  -> WorkflowRunEvent
```

Tenant access must be verified through the resource chain before reading or mutating a child record. A child UUID alone is never sufficient authorization.

## Status and Lifecycle Columns

Use domain-specific names such as:

- `membership_status`
- `ingestion_status`
- `indexing_status`
- `sync_status`
- `workflow_status`
- `execution_status`
- `approval_status`
- `publication_status`
- `connection_status`

Soft-deletable business resources use `deleted_at`. Authentication and credential resources use explicit `expires_at`, `revoked_at`, or rotation events rather than overloading soft deletion.

## Schema Evolution Rule

Every schema change must include:

1. an Alembic migration with a safe forward path;
2. explicit nullability, default, backfill, and downgrade policy;
3. tenant-boundary and foreign-key behavior;
4. repository and service contracts;
5. automated model, migration, and route/service tests where applicable;
6. an update to this document in the same change.

Candidate tables belong in the Roadmap or Blueprint until implemented. They must not be listed here as current tables.
