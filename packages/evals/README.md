# Evaluations

This package contains version-controlled evaluation datasets and benchmark notes used to validate retrieval, grounded answers, agent execution, and workflow behavior.

`retrieval/core-contract-v1.json` is the deterministic metric/fixture contract dataset. Version `1.1.0` checks evaluation schema, metrics, forbidden-result handling, groundedness, citation, latency and cost policy without requiring infrastructure. Run it with:

```powershell
python -m ragpilot_api.commands.retrieval_contract_gate packages/evals/retrieval/core-contract-v1.json
```

`retrieval/database-contract-v1.json` is the release-blocking integration dataset. Its command inserts an isolated corpus inside a rolled-back transaction and exercises the real PostgreSQL/pgvector vector search, PostgreSQL lexical search, fusion, tenant/Knowledge Base filters, deleted-document exclusion and latest-completed-version selection:

```powershell
python -m ragpilot_api.commands.retrieval_database_gate packages/evals/retrieval/database-contract-v1.json
```

The database gate requires an up-to-date PostgreSQL schema. `npm run api:test` starts the local dependencies, migrates the test database and runs both gates before pytest. Environment-specific evaluation of a persistent seeded knowledge base remains available through `ragpilot_api.commands.retrieval_evaluate`.
