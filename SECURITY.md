# Security Policy

DORA Dashboard targets **highly regulated environments**. Security issues are
treated with priority.

## Reporting a vulnerability

**Do not open a public issue for security vulnerabilities.**

Report privately via a [GitHub security advisory](https://github.com/synechron/DORA/security/advisories/new).
Include a description, reproduction steps, affected version/commit, and impact.
You can expect an acknowledgement within a few business days.

Please **never** include real credentials, tokens, or production/client data in a
report — use redacted or synthetic examples.

## Supported versions

The latest `main` and the most recent released container image are supported.
Older images should be upgraded rather than patched in place.

## Security posture

- **No third-party data egress** — all processing is self-hosted / in-cluster.
- **Secrets** are provided via environment variables or a secret store (Kubernetes
  Secrets / Docker secrets), never baked into the image. Integration tokens are
  encrypted at rest (AES-256-GCM).
- **Least-privilege** integration credentials (scoped GitLab/Jira tokens).
- **Authentication** via Azure Entra ID (OIDC) and GitHub OAuth; role-based access
  control (Admin / Lead / Viewer); access and configuration changes are audit-logged.
- **Supply chain**: images are scanned (Trivy) and an SBOM is produced in CI.

## Handling of delivery data

The dashboard ingests delivery metadata from GitLab and Jira. Treat all ingested
data as confidential. When sharing logs, screenshots, or reports outside the
deployment, ensure client-identifying data is redacted.
