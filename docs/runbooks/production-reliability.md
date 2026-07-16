# Production Reliability Runbook

## Production decisions

- authentication mode: `password_local`, backed by Argon2 password hashes, persisted bearer sessions, membership activation/suspension checks, database RBAC capability policy, lockout, revocation, and session governance
- secret delivery: External Secrets refreshes `ragpilot-secrets` hourly from `ragpilot/production`; application runtime credentials remain AES-GCM encrypted with versioned rotation
- ownership: `platform-oncall` owns API, capacity, backup and restore; `workflow-oncall` owns Temporal workers; `ai-runtime-oncall` owns model, retrieval and MCP dependencies

## SLOs

| Signal | Objective | Alert |
| --- | --- | --- |
| API availability | 99.9% monthly | 5xx ratio above 5% for 10 minutes |
| Interactive latency | p95 below 2 seconds, excluding long model generation | p95 above 2 seconds for 10 minutes |
| Projection freshness | below 5 minutes | lag above 300 seconds for 10 minutes |
| Workflow reliability | fewer than 10 retries per 15 minutes | sustained retry alert |
| Restore readiness | successful drill every 30 days | missed drill is a release blocker |

## API errors

Inspect traces by request ID, then split application failures from PostgreSQL, Redis, Temporal, Elasticsearch and model dependencies. Disable an unhealthy governed endpoint before widening fallback.

## Latency

Check HPA CPU/memory, database pool pressure, model policy admission and dependency latency. Scale before raising concurrency limits.

## Capacity

API scales between 2 and 10 replicas at 70% CPU or 75% memory. Preserve at least one API replica during voluntary disruptions. Treat 768 MiB resident memory as the investigation threshold against the 1 GiB limit.

Run the versioned capacity contract against the target staging release before promotion. Supply a dedicated least-privilege API key and non-sensitive seeded tenant/Knowledge Base; do not reuse an operator or production credential:

```powershell
$env:RAGPILOT_CAPACITY_API_KEY = "<staging-api-key>"
$env:RAGPILOT_CAPACITY_TENANT_ID = "<tenant-id>"
$env:RAGPILOT_CAPACITY_KNOWLEDGE_BASE_ID = "<knowledge-base-id>"
uv run --project apps/api --locked python -m ragpilot_api.commands.staging_capacity_gate packages/evals/staging/capacity-contract-v1.json --base-url https://staging.example.com --output output/capacity/staging.json
```

Promotion passes only when all three scenarios complete within the versioned error, throughput and p95 thresholds. Reports contain aggregate timings, status counts and transport-error classes; they exclude headers, credentials, request bodies and response bodies. Archive the report with the release evidence. Recalibrate thresholds from measured environment SLOs rather than weakening them to make a failing release pass.

## Worker retries

Inspect Temporal retry history and classify transient dependency errors separately from deterministic parser failures. Do not retry non-idempotent MCP tool calls automatically.

## Model runtime

Use resource health history and operator actions. Credential failures require rotation; dependency and timeout failures may use governed fallback; capability or protocol failures require configuration change.

## Backup and restore

Run `infra/scripts/backup-production.ps1`. The script resolves the active Compose containers instead of assuming generated container names, creates a PostgreSQL custom-format dump without piping binary data through the host shell, archives MinIO data, snapshots the production ConfigMap and writes a SHA-256 manifest. Store the generated directory outside the cluster.

Run `infra/scripts/restore-drill.ps1 -BackupDirectory <path>` monthly and before a major release. Before restoration, the drill verifies every manifest entry. It restores PostgreSQL into a uniquely named database and requires its table count and Alembic version to match the source database exactly. It also extracts the MinIO archive into an isolated Docker volume. Temporary database, dump and volume resources are removed even when validation fails.

## Reliability exercise

Run `infra/scripts/reliability-drill.ps1` only in the staging/local production-like Compose stack. The default guard rejects non-local health URLs. It applies concurrent health load, pauses Elasticsearch and Redis independently, requires the Elasticsearch health projection to transition from reachable to degraded and back, verifies the Redis PING interruption and recovery, and restores both dependencies in `finally` blocks. Health dependency probing is capped at five seconds independently of the longer retrieval request timeout.

## OCR lifecycle

PDF ingestion first uses structure-preserving page extraction. A scanned PDF with no embedded text falls back to Tesseract (`chi_sim+eng`), writes page-labelled text, and records `pdf_ocr_parser`. PNG, JPEG, WebP, TIFF, and BMP assets use the same governed OCR runtime, enforce a 40-million-pixel safety limit, and record `image_ocr_parser`. Both paths continue through the normal chunk, embedding, Outbox, rebuild, and tenant-isolation chain.

## Latest local production-like qualification evidence — 2026-07-16

These results qualify the maintained local stack and automation. They are not a substitute for environment-owned staging and production evidence.

- backup: PostgreSQL custom-format dump, 4.7 MB MinIO archive, ConfigMap snapshot and SHA-256 manifest produced without fixed container names
- restore: every manifest hash verified; the isolated database restored with 46 public tables at Alembic `202607160001`; the isolated MinIO volume restored 31 files from the final qualification backup; all temporary resources were removed
- reliability: 20 concurrent health requests succeeded; Elasticsearch degradation and recovery were visible in the API health contract; Redis interruption and recovery were confirmed by PING
- framework qualification: the versioned 10-case database corpus passed for Native and LlamaIndex with no recall regression; the versioned 7-case agent corpus passed all LangGraph branch, validation, trace and fallback gates
- control-plane capacity: local liveness completed 200 requests at concurrency 20 with zero errors and p95 122.8 ms; database readiness completed 100 requests at concurrency 20 with zero errors and p95 436.1 ms

The authenticated retrieval capacity scenario was not executed locally because it requires environment-owned staging identity and seeded knowledge. Therefore the local evidence above does not qualify a staging promotion. Record the full capacity report, Kubernetes render results, image signature verification, external secret delivery, production identity checks, live OCR language availability, off-cluster backup replication and alert delivery separately for each deployed environment.
