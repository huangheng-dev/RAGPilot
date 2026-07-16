# Contributing to RAGPilot

Thank you for contributing to RAGPilot. Contributions should close a concrete product, security, reliability, quality, or maintainability need without weakening tenant isolation or runtime governance.

## Before Starting

For material changes, review:

- [Project Snapshot](./docs/product/project-snapshot.md) for current behavior;
- [Project Blueprint](./docs/product/project-blueprint.md) for durable boundaries;
- [Roadmap](./docs/planning/roadmap.md) for active evolution priorities;
- [System Overview](./docs/architecture/system-overview.md) for runtime ownership;
- [Naming Conventions](./docs/architecture/naming-conventions.md) for repository naming.

Use an issue or design discussion before implementing a change that adds a framework, public API family, persistent aggregate, deployment dependency, or first-level product surface.

## Engineering Principles

1. Keep code, API paths, persistence names, and commit messages in clear professional English.
2. Put business and authorization policy in backend application/domain boundaries, not route handlers or browser-only state.
3. Add durable state, lifecycle behavior, diagnostics, and tests where the feature requires them.
4. Preserve tenant, Workspace, Knowledge Base, Document, Chunk, credential, and Tool scope.
5. Prefer explicit domain names over generic `common`, `utils`, `data`, or `handler` modules.
6. Avoid speculative dashboards, detached demos, placeholder architecture, and framework adoption without a closed product path.
7. Keep user-facing surfaces focused; advanced controls belong beside the resource or operation they govern.

## Change Requirements

When applicable, a change must include:

- API contracts and backend authorization;
- persistence and an Alembic migration;
- Worker or Temporal lifecycle behavior;
- Web controls for user/operator actions;
- structured diagnostics, audit, or trace propagation;
- focused tests and regression coverage;
- updates to the owning documentation rather than a competing status document.

Do not edit the Project Snapshot to describe planned behavior. Do not add a route to the API Outline or a table to the Platform Data Model before it exists in code.

## Local Validation

Start the supported local environment with:

```bash
npm install
npm run stable:mode:up
```

Run checks proportional to the affected area:

| Area | Minimum command |
| --- | --- |
| Web | `npm run web:check` |
| API or migrations | `npm run api:test` |
| Document Worker | `npm run worker:test` |
| MCP server | `npm run mcp:build` and `npm run mcp:test` |
| Public Markdown | `npm run release:docs-audit` and `npm run release:links-audit` |
| Cross-service or release behavior | `npm run release:preflight` |

The complete local procedure and troubleshooting guidance are in the [Local Development Runbook](./docs/runbooks/local-development.md).

## Pull Request Requirements

A pull request should explain:

- the concrete problem and affected users or operators;
- the chosen boundary and important trade-offs;
- security, tenancy, migration, compatibility, and rollback impact;
- validation performed and any intentionally deferred follow-up;
- documentation changed with the implementation.

Before requesting review, verify that:

- the diff does not include local Secrets, private data, generated output, or unrelated formatting churn;
- API, Web, Worker, and deployment behavior agree where applicable;
- schema changes upgrade cleanly from the previous Alembic head;
- optional integrations fail explicitly without weakening the default path;
- public claims remain narrower than or equal to verified implementation behavior;
- relevant automated checks pass.

## Technology Policy

New frameworks and runtimes require a concrete role across the necessary parts of the product chain:

1. user or operator entry;
2. backend contract and authorization;
3. runtime or persisted state;
4. governance and operational visibility;
5. failure behavior and fallback;
6. automated validation.

A dependency declaration or isolated adapter is not sufficient evidence for promotion into the default architecture.
