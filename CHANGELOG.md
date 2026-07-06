# Changelog

All notable changes to RAGPilot will be documented in this file.

The format follows a Keep a Changelog style with SemVer-style release tags.

## [Unreleased]

### Added

- production delivery baseline with Kubernetes manifests, a production environment template, and a dedicated delivery audit

### Changed

- web container delivery now runs a production Next.js server instead of a development server
- local API test execution now falls back cleanly between the project virtual environment and the active Python runtime
- release preflight now includes a production delivery audit alongside docs, links, candidate-set, and secret checks

## [0.1.0] - 2026-06-25

### Added

- grounded chat with citations and persisted conversation history
- governed document ingestion, workflow retry, cancellation, and lineage visibility
- runtime governance for model endpoints, tool registrations, retrieval profiles, and MCP connector boundaries
- agent runtime handoff across `Home`, `Chat`, `Documents`, `Agents`, `Admin`, `Operations`, and `Settings`
- English-first repository conventions with Simplified Chinese operator support

### Established

- root-level public documentation for product, contribution, security, and release history
- release validation scripts for documentation audit, link audit, candidate audit, and secret scanning
- a public repository baseline aligned to the core knowledge, retrieval, workflow, agent, and governance architecture
