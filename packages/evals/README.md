# Evaluations

This package contains version-controlled evaluation datasets and benchmark notes used to validate retrieval, grounded answers, agent execution, and workflow behavior.

`retrieval/core-contract-v1.json` is the deterministic metric/fixture contract dataset. Version `1.2.0` checks evaluation schema, metrics, forbidden-result handling, groundedness, citation, latency and cost policy without requiring infrastructure. Its representative cases include tenant and Knowledge Base isolation, deleted and stale versions, adversarial cross-scope content, Chinese OCR evidence and long-context controls. Run it with:

```powershell
python -m ragpilot_api.commands.retrieval_contract_gate packages/evals/retrieval/core-contract-v1.json
```

`retrieval/database-contract-v1.json` version `1.2.0` is the release-blocking integration dataset. Its command inserts an isolated multilingual and adversarial corpus inside a rolled-back transaction and exercises the real PostgreSQL/pgvector vector search, PostgreSQL lexical search, fusion, tenant/Knowledge Base and ACL filters, deleted-document exclusion, latest-completed-version selection, OCR metadata and long-context retrieval:

```powershell
python -m ragpilot_api.commands.retrieval_database_gate packages/evals/retrieval/database-contract-v1.json
```

The database gate requires an up-to-date PostgreSQL schema. `npm run api:test` starts the local dependencies, migrates the test database and runs all deterministic, database, retrieval-framework and Agent-runtime gates before pytest. Environment-specific evaluation of a persistent seeded knowledge base remains available through `ragpilot_api.commands.retrieval_evaluate`.

The same database corpus also blocks framework regressions. The comparison gate runs Native and LlamaIndex against identical authorized candidates, requires both engines to pass the shared quality and isolation policy, rejects metric regression, limits p95 adapter overhead and verifies that every candidate execution contains LlamaIndex adapter evidence:

```powershell
python -m ragpilot_api.commands.retrieval_framework_gate packages/evals/retrieval/database-contract-v1.json
```

`agents/runtime-contract-v1.json` is the release-blocking Native-versus-LangGraph runtime contract. It covers all governed document-intake branches, workflow-recovery risk levels, trace completeness, validation evidence, native fallback compatibility and steady-state p95 overhead using the actual installed LangGraph runtime:

```powershell
python -m ragpilot_api.commands.agent_runtime_framework_gate packages/evals/agents/runtime-contract-v1.json
```

`staging/capacity-contract-v1.json` is the versioned environment-capacity contract. It measures error rate, throughput and p50/p95/p99/max latency for liveness, database readiness and authenticated retrieval. The command never writes request credentials, headers, bodies or response bodies to its report. A missing authenticated staging input fails promotion instead of silently qualifying a partial run:

```powershell
$env:RAGPILOT_CAPACITY_API_KEY = "<staging-api-key>"
$env:RAGPILOT_CAPACITY_TENANT_ID = "<tenant-id>"
$env:RAGPILOT_CAPACITY_KNOWLEDGE_BASE_ID = "<knowledge-base-id>"
uv run --project apps/api --locked python -m ragpilot_api.commands.staging_capacity_gate packages/evals/staging/capacity-contract-v1.json --base-url https://staging.example.com --output output/capacity/staging.json
```

Thresholds in this repository are a promotion baseline, not a substitute for environment-specific SLO and load-shape decisions.
