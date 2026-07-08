# DORA Dashboard

> Self-hosted delivery-intelligence portal for highly regulated environments.

DORA Dashboard unifies **DORA-4** metrics and Synechron's **extended delivery/quality
metrics** from **GitHub** and **Jira** into a single, auditable, self-hosted portal —
behind **Azure Entra ID SSO** and **GitHub OAuth**, with **no third-party data egress**.

## Why

Regulated enterprises (finance, insurance, healthcare, public sector) cannot use
multi-tenant SaaS delivery-analytics tools, and today compile delivery metrics by hand
across GitHub and Jira. DORA Dashboard provides a defensible, self-hosted source of truth.

## Metrics

**DORA-4:** Deployment Frequency · Lead Time for Changes · Change Failure Rate · MTTR

**Extended (Synechron proposed metrics):** Lead Time · Cycle Time · Work Item Age ·
Delivery Predictability · Blocked Time · Average Velocity · Test Automation Coverage ·
Defect Escape Rate · Defect Root Cause

## Tech Stack

- **Next.js 16** (App Router, SSR + API routes), **TypeScript 5.9**
- **shadcn/ui** (`radix-mira`) + **Radix UI** + **Tailwind v4** (OKLCH tokens) + **next-themes**
- **PostgreSQL 16** + **Prisma**
- **Auth.js (NextAuth v5)** — Azure Entra ID OIDC + GitHub OAuth, RBAC
- **Octokit** (GitHub) + **Jira REST** integrations
- **Turborepo** + npm workspaces
- **Docker** (hardened image), **docker-compose**, and **Helm** chart for Kubernetes

See [`.agent-os/product/`](.agent-os/product/) for mission, tech stack, roadmap, and
decision log.

## Status

 Planning / early development. See the [roadmap](.agent-os/product/roadmap.md) and the
project's GitHub epic + issues for tracked work.

## Deployment (planned)

- **Local / small:** `docker compose up` (app + PostgreSQL + reverse proxy)
- **Enterprise:** Helm chart into Kubernetes
- Air-gap-friendly: self-hosted fonts/assets, no runtime CDN dependency

## License

TBD
