# Security Policy

## Supported State

RagPilot is currently in active development.

Security fixes may land quickly, but the project does not yet guarantee long-term support windows for older snapshots.

For now, treat the latest mainline state as the supported baseline.

## Reporting a Vulnerability

Do not open a public issue for suspected secrets exposure, authentication bypass, privilege escalation, or infrastructure-sensitive vulnerabilities.

Instead:

1. prepare a private report with reproduction steps
2. include the affected area such as `auth`, `rbac`, `document ingestion`, `tool runtime`, or `model runtime`
3. include impact and any temporary mitigation

Until a dedicated private security contact is published, repository owners should handle reports through a private channel outside the public issue tracker.

## Scope Notes

Current higher-sensitivity areas include:

- authentication and session handling
- tenant and membership authorization
- model-endpoint credentials
- tool runtime and future MCP boundaries
- document ingestion and stored asset access

As RagPilot matures, this file should be updated with the final disclosure contact and support policy.
