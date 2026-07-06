# Security Policy

## Supported Baseline

Please treat the latest mainline repository state as the supported baseline for security reporting.

## Reporting a Vulnerability

Do not open a public issue for suspected:

- secrets exposure
- authentication or authorization bypass
- privilege escalation
- tenant isolation failure
- workflow runtime abuse
- model or tool runtime credential leakage

Instead, prepare a private report that includes:

1. the affected area
2. reproduction steps
3. impact
4. suggested mitigation, if available

If GitHub private vulnerability reporting is enabled for the repository, use that channel first. Otherwise, contact the repository owners through a private channel instead of the public issue tracker.

## Sensitive Areas

Higher-sensitivity areas include:

- authentication and session handling
- tenant and membership authorization
- document ingestion and stored asset access
- model endpoint configuration
- tool runtime execution
- MCP-facing integration boundaries

## Disclosure Guidance

Please avoid publishing exploit details, proof-of-concept secrets, or live credentials in issues, discussions, pull requests, screenshots, or logs.
