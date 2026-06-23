# Phase 5 Release Checklist

Status: `in progress`

Purpose:

- turn RagPilot from a local-only active build into a GitHub-ready open-source repository
- close the first public release hygiene gaps without pretending the platform is feature-complete
- keep release preparation aligned with the real codebase and roadmap

## Acceptance Scope

Phase 5 should close when RagPilot satisfies all of the following:

1. repository hygiene is safe for a first public push
2. contribution and release expectations are documented
3. basic CI validates the main web and API surfaces
4. public documentation accurately describes current implementation reality
5. unfinished areas remain clearly marked as in-progress rather than overstated

## Completed

- [x] local runtime output and Codex-specific folders are ignored
- [x] future private documentation folders are now ignored by default
- [x] environment-file ignoring is widened beyond only `.env` and `.env.local`
- [x] a public `CONTRIBUTING.md` now defines naming, product-chain, and documentation rules
- [x] a minimal GitHub Actions CI workflow now validates web build and API tests
- [x] Phase 5 now has an explicit release-close checklist instead of living only as a roadmap note
- [x] a first public release runbook now defines the exact initial publish sequence
- [x] a baseline `SECURITY.md` now sets a public disclosure posture without pretending mature support guarantees
- [x] GitHub issue and pull-request templates now steer future contributions back toward the main RagPilot chain
- [x] a first tagged-release checklist now exists for the first stable public baseline
- [x] the local RagPilot working tree is now initialized as a Git repository on `main`

## Remaining Before Phase 5 Close

- [ ] choose and add the public `LICENSE`
- [ ] create the first tracked baseline commit
- [ ] perform a final secret scan immediately before the first public push
- [ ] confirm the public repository description and initial README framing
- [ ] create the first public tag after the initial push target is fixed and CI is green

## Explicitly Out of Scope

These should not block Phase 5 close by themselves:

- full production authentication closure
- mature MCP management
- final agent-business workflow depth
- full deployment automation across every runtime target
- promoting pilot LlamaIndex or LangGraph paths into the default implementation

## Exit Condition

The repository is clean, documented, CI-backed, and honestly framed for public open-source delivery.
