# Security Policy

## Supported Baseline

Until a stable-version support matrix is published, security fixes target the latest state of the repository's default branch. Historical commits, abandoned branches, and private deployment forks are not maintained as separate security baselines.

Reports against an older revision are still useful when the issue is reproducible on the supported baseline. Deployment-specific misconfiguration may require remediation by the deployment owner rather than a source-code change.

## Reporting a Vulnerability

Do not open a public issue, discussion, or pull request for a suspected vulnerability.

Use GitHub private vulnerability reporting when it is enabled for this repository. If that channel is unavailable, contact a repository maintainer through a private channel and wait for confirmation before sending credentials, private documents, or exploit material.

Include:

1. affected component and revision;
2. prerequisites and reproduction steps;
3. expected and observed behavior;
4. security impact and affected scope;
5. suggested mitigation, if available.

Remove or replace live Secrets, access tokens, personal information, and private document content from the report whenever they are not required to reproduce the issue.

## Security-Relevant Areas

Higher-sensitivity areas include:

- authentication, session, invitation, password, and API-key handling;
- tenant membership, role capabilities, Workspace/Knowledge Base scope, and Document/Chunk authorization;
- document upload, parsing, OCR, object storage, and outbound URL handling;
- retrieval candidate isolation and Elasticsearch reauthorization;
- model, Tool, MCP, connector, and runtime credential boundaries;
- Agent Tool policy, execution budgets, approval, replay, and sandbox snapshots;
- workflow cancellation, retry, and cross-service trace or log redaction;
- deployment templates, Secret integration, and release automation.

## Coordinated Disclosure

Allow maintainers reasonable time to reproduce, assess, fix, and release a remediation before public disclosure. Do not publish exploit details, proof-of-concept Secrets, live credentials, private data, or unredacted logs while a report is being coordinated.

This policy describes the reporting process and supported source baseline; it does not promise a fixed response or remediation time.

## Dependency Advisory Decisions

Dependency findings are evaluated against the installed tree and RAGPilot's reachable runtime behavior. High and critical production findings remain release blockers. A lower-severity finding may be accepted temporarily only when the repository records the exact advisory, affected path, exposure analysis, compensating controls, owner, review date, and expiry date.

RAGPilot does not apply an automated “fix” that downgrades a framework across major versions or manually rewrites a lockfile. The current Next.js release pins an internal PostCSS version affected by `GHSA-qx2v-qp2m-jg93`, while the latest Next.js release available during review pins the same version. RAGPilot does not accept user-authored CSS or invoke PostCSS in an HTTP request path; trusted source is processed during the image build. The direct PostCSS toolchain is patched. This moderate upstream finding is accepted temporarily through 2026-10-16, owned by repository security maintainers, and must be reviewed by 2026-08-16 or immediately when Next.js publishes a compatible patched dependency.
