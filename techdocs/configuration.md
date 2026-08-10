# Configuration and Integrations

Everything an operator needs to bring the portal fully online — environment variables,
connecting GitLab and Jira, single sign-on, and role-based access. All integration secrets
are entered in **Settings**, encrypted at rest (AES-256-GCM), and never shown again.

## Environment variables

Platform configuration is 12-factor: everything is an environment variable. Copy
`.env.example` to `.env` for local development, or set these as container/Helm/Azure
secrets in production.

| Variable | Required | Purpose |
| --- | --- | --- |
| `PORT` | dev | App port for local dev (default `8191`; the container image serves on `3000`). |
| `NEXTAUTH_URL` | prod | Public base URL of the app (e.g. `https://dora.yourcompany.com`). |
| `AUTH_SECRET` | yes | Signs Auth.js sessions. Generate: `openssl rand -base64 32`. |
| `AUTH_TRUST_HOST` | prod | Set `true` behind a reverse proxy / managed ingress. |
| `DATABASE_URL` | yes | PostgreSQL connection string. No `?schema=` suffix (Prisma-only; breaks postgres.js). |
| `APP_ENCRYPTION_KEY` | yes | 32-byte base64 key for AES-256-GCM encryption of integration tokens. Generate: `openssl rand -base64 32`. |
| `BOOTSTRAP_ADMIN_EMAIL` | yes | First admin account, seeded by `scripts/seed.mjs` (default `admin@dora.local`). |
| `BOOTSTRAP_ADMIN_PASSWORD` | yes | First admin password (change after first sign-in). |
| `AUTH_ENTRA_TENANT_ID` | SSO | Azure Entra ID directory (tenant) ID — enables the Entra provider when set. |
| `AUTH_ENTRA_CLIENT_ID` | SSO | Entra application (client) ID. |
| `AUTH_ENTRA_CLIENT_SECRET` | SSO | Entra client secret. |
| `AUTH_GITHUB_CLIENT_ID` | OAuth | GitHub OAuth app client ID. |
| `AUTH_GITHUB_CLIENT_SECRET` | OAuth | GitHub OAuth app client secret. |
| `JIRA_BASE_URL` | optional | Fallback Jira base URL (integrations are normally configured in-app). |
| `SYNC_TOKEN` | optional | Shared bearer token so a scheduler can call `POST /api/sync/gitlab` non-interactively. |
| `DIGEST_SECRET` | optional | Shared secret the digest CronJob presents when calling `/api/digest/run`. |
| `FEATURE_GITHUB` | optional | Show the GitHub integration + GitHub OAuth sign-in (hidden by default). |

Generate the two core secrets with:

```bash
AUTH_SECRET=$(openssl rand -base64 32)
APP_ENCRYPTION_KEY=$(openssl rand -base64 32)
```

`AUTH_SECRET` and `APP_ENCRYPTION_KEY` are generated on first install by the Helm chart /
Azure templates and **preserved across upgrades**, so sessions and encrypted tokens survive
rollouts.

## Connecting GitLab (primary DORA source)

GitLab is the primary DORA-4 source. After signing in as admin, go to
**Settings → GitLab** and set:

- **Base URL** — `https://gitlab.com` or your self-managed URL.
- **Group or project path** — e.g. `my-group` or `my-group/my-project` (no host prefix).
- **Production environment name** — the GitLab environment that counts as production
  (default `production`).
- **Access token** — a PAT with `read_api`, or a fine-grained token with group read:
  Deployment, Pipeline, Environment, Merge Request, Project (and Job / Job-Artifact for
  coverage).

The token is sent to GitLab as the `PRIVATE-TOKEN` header. Click **Save → Test connection**
(validates access to the configured group), then **Sync now**. DORA-4 metrics go live on
the dashboard.

Fine-grained tokens often lack *User: Read*, so a generic `/user` check would 403 — the app
validates access to your configured *group* instead, which is what ingestion actually
needs. This unlocks Deployment Frequency, Change Failure Rate, Lead Time, MTTR, PR Cycle
Time, and Test Automation Coverage (the last only needs your CI pipelines to publish a
coverage value — no new credentials).

## Connecting Jira (flow, velocity and quality)

Jira drives seven metrics. Under **Settings → Jira** set:

| Item | Value / scope |
| --- | --- |
| Base URL | `https://your-org.atlassian.net` (or your Data Center URL) |
| Service-account email | a read-only account is ideal |
| API token | Atlassian API token for that account |
| Scopes / permissions | Browse Projects, View Sprints/Boards, read issues + changelog |
| Project/board → team mapping | which Jira projects/boards belong to which team |
| Defect labels (for quality) | tag bugs: a `post-release`/`production` label (escaped) and a `requirements`/`design` label (upstream root cause) |

Click **Save → Test connection → Sync now**. This unlocks Cycle Time, Work Item Age,
Blocked Time, Average Velocity, Delivery Predictability, Defect Escape Rate, and Defect Root
Cause. Story-Points and Sprint custom fields are auto-detected by name.

## Single sign-on

Configure under **Settings → Single sign-on**. Add the redirect URI in the provider's app
registration. Local username/password works out of the box via the bootstrap admin.

| Provider | What to provide | Redirect URI |
| --- | --- | --- |
| **Azure Entra ID** (SSO) | Application (client) ID, Directory (tenant) ID, client secret | `https://<host>/api/auth/callback/microsoft-entra-id` |
| **GitHub OAuth** (behind `FEATURE_GITHUB`) | Client ID, client secret | `https://<host>/api/auth/callback/github` |

SSO client secrets are encrypted with AES-256-GCM before storage and never returned to the
browser. Entra ID and GitHub OAuth can be provided either as environment variables (see
above) or entered in-app; entering them in Settings enables the provider dynamically.

## RBAC (Admin / Lead / Viewer)

Authorization is **default-deny**: every route requires an authenticated session, and
privileged actions require the **Admin** role, enforced server-side.

| Role | Dashboard | Settings / Integrations | Users | Sync |
| --- | --- | --- | --- | --- |
| **Admin** | read | configure | manage | trigger |
| **Lead** | read | — | — | — |
| **Viewer** | read | — | — | — |

Admins manage accounts and roles under **Settings → Users**. Every privileged action
(sign-in, user/role change, integration save, sync, metric-definition change) is written to
an append-only audit log.

## Two decisions that shape a couple of metrics

| Metric | Decision |
| --- | --- |
| **Lead Time** | Keep GitOps (deploy-commit ≈ 0 for infra repos) or measure from the feature MR's first commit (more meaningful for feature-branch workflows). |
| **MTTR** | Keep the deploy-recovery proxy (failed → next success) or record incidents in GitLab and switch to incident open→close. |

## At a glance

| To light up… | Provide |
| --- | --- |
| DORA-4 (4 metrics) | GitLab token + group + prod env |
| Flow + Velocity + Quality (7 metrics) | Jira URL + email + API token (+ defect labels) |
| Test Automation Coverage (1 metric) | GitLab pipelines that publish coverage |
| Enterprise sign-in | Entra ID (and/or GitHub OAuth) app registration |

See the [Metrics catalog](metrics.md) for what each metric measures, and
[Security](security.md) for how credentials are protected.
