# DORA Dashboard

Self-hosted delivery-intelligence portal for highly regulated environments.

DORA Dashboard unifies **DORA-4** metrics and Synechron's **extended delivery and
quality metrics** from **GitLab** and **Jira** into a single, auditable, self-hosted
portal — behind **Azure Entra ID SSO** and **GitHub OAuth**, with **no third-party data
egress**.

## Why it exists

Regulated enterprises — finance, insurance, healthcare, public sector — cannot use
multi-tenant SaaS delivery-analytics tools, and today compile delivery metrics by hand
across GitLab and Jira. That work is error-prone, impossible to audit, and leaves
leadership unable to trust the numbers. DORA Dashboard provides a defensible,
self-hosted source of truth: it ingests directly from your source systems, computes
DORA-4 and extended metrics with documented formulas, and presents them behind
enterprise SSO — everything staying inside your own cluster or subscription.

## Who it is for

- **Engineering and delivery leadership** — Heads of Engineering, Delivery Managers, and
  Agile leads who own KPIs, report upward to executives and auditors, and need a trusted
  source of truth for delivery performance.
- **Delivery / Agile leads** — Scrum Masters and RTEs who need early-warning signals on
  ageing and blocked work, velocity, and predictability across several squads.
- **Platform / DevOps engineers** — operators who must deploy the portal into a
  locked-down Kubernetes, Azure PaaS, or Docker estate with SSO, least-privilege tokens,
  and an audit trail.

## The problem it solves

- **Fragmented, unauditable metrics.** DORA and flow signals live in GitLab and Jira and
  get stitched together in spreadsheets. The portal ingests both automatically and
  computes metrics with documented, defensible formulas.
- **SaaS analytics banned in regulated estates.** Most delivery-analytics products are
  multi-tenant SaaS requiring data egress. The portal is fully self-hosted and
  air-gap-friendly, with no third-party data egress.
- **No leading indicators for flow health.** By the time a sprint misses, the causes are
  already baked in. The portal tracks Work Item Age, Blocked Time, Delivery
  Predictability, and Test Automation Coverage as leading indicators.

## Key features

- **DORA-4 metrics** — Deployment Frequency, Lead Time for Changes, Change Failure Rate,
  and Mean Time to Restore, computed from GitLab deployments and CI/CD.
- **Extended flow, velocity and quality metrics** — Cycle Time, Work Item Age, Blocked
  Time, Delivery Predictability, Average Velocity, Feature Cycle Time, PR Cycle Time,
  Investment Allocation, Defect Escape Rate, Defect Root Cause, and Test Automation
  Coverage.
- **Team-level only** — every metric is computed at team / group level; the product
  deliberately does not rank individual developers.
- **Configurable metric definitions** — production environments, ref/branch patterns,
  failure statuses, rolling window, and benchmark bands are all admin-configurable and
  audited, with a lineage view behind every number.
- **Enterprise auth and RBAC** — Auth.js with Azure Entra ID OIDC SSO, optional GitHub
  OAuth, and local login; Admin / Lead / Viewer roles enforced server-side.
- **Reports and digests** — branded PDF and CSV export, and a scheduled email or
  Teams/Slack delivery digest.
- **Self-hosted deployment** — hardened Docker image, docker-compose, a Helm chart for
  Kubernetes, and Bicep/Terraform for Azure Container Apps and App Service.

## Documentation map

| Page | What it covers |
| --- | --- |
| [Architecture](architecture.md) | System design, components, and the GitLab/Jira → Postgres → metrics → dashboard data flow. |
| [Metrics](metrics.md) | The full metric catalog — DORA-4 and extended metrics, sources, and formulas. |
| [Deployment](deployment.md) | Self-hosted deployment: docker-compose, the hardened Dockerfile, the Helm chart, and AWS EKS. |
| [Azure](azure.md) | Azure Container Apps / App Service via Bicep and Terraform, with managed TLS, Key Vault, and Private Endpoints. |
| [Configuration](configuration.md) | Environment variables, connecting GitLab and Jira, SSO setup, and RBAC. |
| [Security](security.md) | Regulated-environment posture: egress, secrets, hardening, scanning, and audit. |
| [Development](development.md) | Local setup, scripts, migrations, seeding, CI, and testing. |

## Tech stack at a glance

- **Next.js 16** (App Router, RSC + API routes), **TypeScript 5.9**
- **PostgreSQL 16** + **Drizzle ORM** + postgres.js
- **Auth.js (NextAuth v5)** — Azure Entra ID OIDC + GitHub OAuth, RBAC
- **shadcn/ui** (`radix-mira`) + **Radix UI** + **Tailwind v4** (OKLCH tokens) +
  **next-themes**
- **GitLab REST API v4** (primary DORA source) + **Jira REST** integrations
- **Docker** (hardened image), **docker-compose**, **Helm**, and Azure **Bicep/Terraform**
