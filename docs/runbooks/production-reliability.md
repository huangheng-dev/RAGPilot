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

For the local Compose stack, use the loopback-only wrapper below. It creates a 30-minute, `access_chat`-only temporary API Key in the local database, keeps the secret in process memory, bypasses ambient HTTP proxy variables for loopback traffic, and revokes the key in a `finally` block even when qualification fails. The actor ID is recorded for audit attribution and must identify the local operator running the drill:

```powershell
$env:POSTGRES_HOST = "localhost"
uv run --project apps/api --locked python -m ragpilot_api.commands.local_staging_capacity_gate packages/evals/staging/capacity-contract-v1.json --base-url http://localhost:8000 --tenant-id <tenant-id> --knowledge-base-id <knowledge-base-id> --actor-user-id <operator-user-id> --output output/capacity/local.json
```

Run capacity qualification only on an otherwise idle target with representative replica and dependency resources. Record host saturation or competing workloads as invalid environment evidence and rerun; do not weaken the versioned thresholds to turn a resource-contended run green. Warmup transport failures are emitted as sanitized failed-scenario evidence instead of aborting the report.

Qualify the locally configured real model against non-sensitive seeded knowledge separately from the capacity corpus. The loopback-only command creates an expiry-bounded API Key with only the two Chat scopes, verifies non-empty generated content, the expected model identity and at least one Citation, emits only aggregate evidence, deletes the test conversation, and revokes the key:

```powershell
$env:POSTGRES_HOST = "localhost"
uv run --project apps/api --locked python -m ragpilot_api.commands.local_real_model_gate --base-url http://localhost:8000 --tenant-id <tenant-id> --workspace-id <workspace-id> --knowledge-base-id <knowledge-base-id> --actor-user-id <operator-user-id> --question "<non-sensitive grounded question>" --expected-model <model-name>
```

The same contract is available as the manually dispatched `Staging Capacity` GitHub Actions workflow. Protect a GitHub environment named `staging`, require the appropriate reviewers, configure `RAGPILOT_CAPACITY_BASE_URL`, `RAGPILOT_CAPACITY_TENANT_ID`, and `RAGPILOT_CAPACITY_KNOWLEDGE_BASE_ID` as environment variables, and configure `RAGPILOT_CAPACITY_API_KEY` as an environment secret. The workflow archives only the sanitized aggregate report for 30 days. A missing input or failed scenario blocks the job.

## Worker retries

Inspect Temporal retry history and classify transient dependency errors separately from deterministic parser failures. Do not retry non-idempotent MCP tool calls automatically.

## Model runtime

Use resource health history and operator actions. Credential failures require rotation; dependency and timeout failures may use governed fallback; capability or protocol failures require configuration change.

## Backup and restore

Run `infra/scripts/backup-production.ps1`. The script resolves the active Compose containers instead of assuming generated container names, creates a PostgreSQL custom-format dump without piping binary data through the host shell, archives MinIO data, snapshots the production ConfigMap and writes a SHA-256 manifest. Store the generated directory outside the cluster.

Run `infra/scripts/restore-drill.ps1 -BackupDirectory <path>` monthly and before a major release. Before restoration, the drill verifies every manifest entry. It restores PostgreSQL into a uniquely named database and requires its table count and Alembic version to match the source database exactly. It also extracts the MinIO archive into an isolated Docker volume. Temporary database, dump and volume resources are removed even when validation fails.

## Reliability exercise

Run `infra/scripts/reliability-drill.ps1` only in the staging/local production-like Compose stack. The default guard rejects non-local health URLs. It applies concurrent health load, pauses Elasticsearch and Redis independently, requires the Elasticsearch health projection to transition from reachable to degraded and back, verifies Redis interruption from the API container network path and recovery with `PING`, and restores both dependencies in `finally` blocks. Health dependency probing is capped at five seconds independently of the longer retrieval request timeout.

## OCR lifecycle

PDF ingestion first uses structure-preserving page extraction. A scanned PDF with no embedded text falls back to Tesseract (`chi_sim+eng`), writes page-labelled text, and records `pdf_ocr_parser`. PNG, JPEG, WebP, TIFF, and BMP assets use the same governed OCR runtime, enforce a 40-million-pixel safety limit, and record `image_ocr_parser`. Both paths continue through the normal chunk, embedding, Outbox, rebuild, and tenant-isolation chain.

## Latest local production-like qualification evidence — 2026-07-17

These results qualify the maintained local stack and automation. They are not a substitute for environment-owned staging and production evidence.

- backup: PostgreSQL custom-format dump, 4.7 MB MinIO archive, ConfigMap snapshot and SHA-256 manifest produced without fixed container names
- restore: every manifest hash verified; the isolated database restored with 46 public tables at Alembic `202607160001`; the isolated MinIO volume restored 60 files from the final qualification backup; all temporary resources were removed
- reliability: 20 concurrent health requests succeeded; Elasticsearch degradation and recovery were visible in the API health contract; Redis interruption and recovery were confirmed by PING
- framework qualification: the versioned 10-case database corpus passed for Native and LlamaIndex with no recall regression; the versioned 7-case agent corpus passed all LangGraph branch, validation, trace and fallback gates
- control-plane capacity: local liveness completed 200 requests at concurrency 20 with zero errors, 158.09 requests/second, and p95 336.0 ms; database readiness completed 100 requests at concurrency 20 with zero errors, 104.38 requests/second, and p95 518.6 ms
- authenticated retrieval capacity: an ephemeral, `access_chat`-only Platform API Key completed 50 requests at concurrency 10 with zero errors, 27.11 requests/second, and p95 544.4 ms; the key was revoked immediately after the run
- real-model qualification: the governed Ollama `qwen3.5:latest` endpoint completed a grounded Chat request in 88.8 seconds with three retrieved results and three Citations; the test conversation was deleted and the two-scope temporary API Key was revoked
- container delivery: the digest-pinned full-capability API, OCR Worker, and production Web Dockerfiles all completed local `linux/amd64` builds from committed dependency locks; multi-architecture publication, registry attestation, and signature verification remain release-workflow evidence

This local evidence qualifies the maintained single-instance Compose path, not a staging promotion. The protected staging workflow must still run against the actual release, environment-owned identity, seeded knowledge, managed dependencies, and target replica count. Record the staging capacity report, Kubernetes render results, image signature verification, external secret delivery, production identity checks, live OCR language availability, off-cluster backup replication and alert delivery separately for each deployed environment.
