# RAGPilot Worker

This service is the durable background execution engine for RAGPilot workflows.

It runs Temporal-backed processing for ingestion, reindex, document state advancement, and chunk-level embedding work.

## Worker Responsibilities

The worker:

- receives `document_ingestion` workflow executions from the API
- updates `workflow_runs` and `workflow_steps`
- advances `documents.ingestion_status` and `documents.indexing_status`
- reads uploaded document assets from MinIO
- normalizes plain text, Markdown, HTML, CSV, JSON, PDF, DOCX, and XLSX content, with governed OCR for scanned PDFs and standalone images
- creates `document_chunks`
- generates embeddings for each chunk
- writes `document_chunk_embeddings`
- supports document reindex through the same durable ingestion path
- publishes committed chunk changes through the search-projection Outbox
- runs version-safe Elasticsearch projection, scoped backfill, and atomic alias rebuild workflows
- executes lease-owned Data Source synchronization through a versioned connector SPI
- provides the built-in `public_web_v1` adapter with conditional ETag/Last-Modified/hash cursors, redirect and DNS destination validation, and response-size limits
- materializes changed source items as immutable document versions, skips unchanged items, and projects authoritative deletions

## Embedding Providers

Supported embedding providers:

- `deterministic` for local development and smoke testing
- `openai_compatible` for providers that expose `/embeddings`

## Execution Boundary

The worker focuses on durable processing and state transition work that should not run in the request-response path, including:

- document ingestion lifecycle execution
- parsing and normalization
- chunk creation and embedding writes
- PostgreSQL-to-Elasticsearch projection and reconciliation
- workflow step progression and retry-safe status updates
- incremental Data Source discovery and child-ingestion orchestration

The built-in Web adapter imports one public page per Data Source. It is not a crawler. Additional connector adapters must preserve the same cursor, lease, idempotency, network-safety, and authoritative-snapshot contracts.
