# Contributing to RAGPilot

Thanks for contributing to RAGPilot.

RAGPilot is an open-source AI knowledge operations platform. Contributions should strengthen real product behavior across chat, documents, workflows, governance, and runtime control surfaces.

## Contribution Principles

1. Keep implementation English-first
2. Prefer explicit domain naming over vague utility naming
3. Land changes through real APIs, persistence, workflows, and UI surfaces
4. Avoid detached demos, speculative dashboards, or placeholder architecture that does not support a real product loop
5. Keep visible product behavior lean, clear, and operationally useful

## Naming Standards

- tables: snake_case plural nouns
- fields: explicit snake_case
- Python methods: verb-based snake_case
- Python files: explicit domain-based names
- frontend components: PascalCase
- route folders: kebab-case

## Before You Open a PR

Please make sure the change:

1. improves a real RAGPilot workflow
2. follows the repository naming standards
3. does not introduce unrelated UI churn
4. keeps runtime, governance, and user-facing behavior consistent
5. passes the relevant build or test commands for the touched area

## Local Development

Useful entry points:

- `README.md`
- `.env.example`
- `npm run stable:mode:up`
- `npm run web:build`
- `npm run release:docs-audit`
- `npm run release:links-audit`

## Pull Request Checklist

Before merge, verify:

- the change is scoped to a concrete product problem
- API and frontend behavior still align
- new runtime or governance behavior is visible where operators need it
- documentation in the repository root still matches externally visible project behavior

## Technology Policy

Do not introduce new frameworks or runtimes unless they close a concrete RAGPilot loop across:

1. product entry
2. API contract
3. runtime or persistence state
4. governance visibility
5. validation or operational follow-up

## Collaboration Style

RAGPilot favors:

- production-oriented implementation
- explicit product boundaries
- durable workflows over temporary shortcuts
- minimal, focused visible surfaces over feature sprawl
