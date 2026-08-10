# Security and Regulated-Environment Posture

DORA Dashboard is built for regulated estates — finance, insurance, healthcare, public
sector — where SaaS delivery-analytics tools are prohibited. The design goal is a defensible,
auditable, self-hosted portal with no third-party data egress.

## No third-party data egress

All ingestion, computation and storage happen inside your own cluster or Azure subscription.
The portal only ever *reads* from GitLab and Jira using a least-privilege token; it never
sends source or work-item data to any external service. The only outbound traffic beyond the
source systems is whatever *you* configure — for example an email server or a Teams/Slack
webhook for the delivery digest.

## Air-gap friendliness

- Fonts (Montserrat, Geist Mono) and assets are self-hosted via `next/font` — no runtime CDN
  dependency.
- The data layer (Drizzle ORM + postgres.js) is pure TypeScript with no downloaded native
  engine binaries, so it runs cleanly in restricted and air-gapped environments (this is the
  reason Drizzle was chosen over Prisma).
- The container image can be mirrored into a private registry (ACR or an internal GHCR
  mirror) for offline installs.

## Authentication and authorization

- **Auth.js (NextAuth v5)** with the Drizzle adapter: local username/password (bcrypt,
  cost 12), **Azure Entra ID SSO** (OIDC), and optional **GitHub OAuth**.
- Sessions use secure, `HttpOnly` / `Secure` cookies.
- **Default-deny middleware**: every route requires an authenticated session.
- **RBAC** — Admin / Lead / Viewer, enforced server-side on every privileged action. Only
  Admins can change settings, manage users, or trigger syncs. Metrics are team/org level
  only — the product deliberately does not rank individuals.

## Encrypted secrets at rest

- Integration tokens (GitLab/Jira) and SSO client secrets are encrypted with **AES-256-GCM**
  (via `APP_ENCRYPTION_KEY`, a 32-byte base64 key) before they touch the database, and are
  never returned to the browser.
- Platform secrets (`DATABASE_URL`, `AUTH_SECRET`, `APP_ENCRYPTION_KEY`) live outside the
  image — in **Azure Key Vault** (read at runtime via **Managed Identity**), Kubernetes
  Secrets (enable etcd/KMS encryption at rest), or Docker secrets. They are generated and
  preserved across upgrades by the Helm chart / Azure templates, never baked into the image.

## Network isolation

- **Azure**: PostgreSQL Flexible Server with **public access disabled**, reached over VNet
  integration + a **Private Endpoint** — no internet exposure.
- **Kubernetes**: a NetworkPolicy (`networkPolicy.enabled=true`) restricts database access to
  the app's own pods.
- **Identity, not credentials**: a user-assigned Managed Identity handles container-registry
  pull, Key Vault access, and optionally Entra authentication to PostgreSQL — no stored infra
  passwords.

## Transport and web-security headers

- HTTPS-only with **managed TLS** (Azure Container Apps / App Service auto-renewed certs, or
  cert-manager + Let's Encrypt on Kubernetes), TLS 1.3, HSTS.
- The app sets a strict **Content-Security-Policy** (`default-src 'self'`,
  `object-src 'none'`, `frame-ancestors 'none'`, `frame-src 'none'`, `base-uri 'self'`,
  `form-action 'self'`, `upgrade-insecure-requests`), `X-Frame-Options: DENY`,
  `X-Content-Type-Options: nosniff`, and a locked-down Permissions-Policy.
- **CSRF** is handled by Next.js Server Actions (same-origin enforcement), so no additional
  tokens are required.
- Known follow-up: `script-src` retains `'unsafe-inline'` (a Next.js hydration constraint); a
  nonce-based strict CSP is a planned improvement. The posture has been OWASP ZAP-reviewed.

## Container hardening

- Multi-stage, minimal base image; non-root user; dropped Linux capabilities; RuntimeDefault
  seccomp profile.
- No build-time secrets in the image.

## Supply chain — scanning and SBOM

- **Trivy** scans the image in CI before publish; Azure deployments can additionally use
  **Microsoft Defender for Containers** for image/runtime scanning.
- Image signing and **SBOM** generation are part of the pipeline for provenance.
- Images are pinned to immutable git-SHA tags (or digests) in production.

## Audit and monitoring

- Every privileged action — sign-in, user/role change, integration save, sync,
  metric-definition change — is written to an **append-only audit log** (`audit_log`).
- Metric definitions carry **lineage**: each DORA card's detail view shows the exact
  definition behind the number (window, environment allowlist, ref pattern, failure statuses,
  band thresholds), making every figure defensible in an audit.
- Container logs and metrics stream to **Azure Monitor / Log Analytics** (or your cluster's
  logging stack).

## Least-privilege integration credentials

- The GitLab token needs only `read_api` (or the equivalent fine-grained group read) — the
  app only ever reads from sources.
- The Jira service account is ideally read-only (Browse Projects, View Sprints/Boards, read
  issues + changelog).

See [Configuration](configuration.md) for how to provision these credentials and
[Architecture](architecture.md) for the trust boundaries.
