# Technical Stack

> Last Updated: 2026-07-06
> Version: 1.0.0

## Architecture Summary

A self-hosted Next.js (App Router) portal that ingests from GitHub and Jira, computes
DORA-4 and extended delivery metrics, persists them in PostgreSQL, and serves an
authenticated dashboard behind Azure Entra ID SSO and GitHub OAuth. Delivered as a
hardened Docker image with docker-compose and a Helm chart. UI theme/branding is reused
from the `shadcn-radix-nextjs` reference monorepo (shadcn/ui + Radix + Tailwind v4).

## Core Technologies

### Application Framework
- **Framework:** Next.js (App Router, RSC, API routes / route handlers)
- **Version:** 16.1.x
- **Language:** TypeScript 5.9.x
- **Runtime:** Node.js 20+ (dev on 24)
- **Note:** Reference app sets `output: "export"`; this product removes it to enable server-side auth, API routes, and background ingestion.

### Database
- **Primary:** PostgreSQL 16+
- **ORM:** Prisma
- **Purpose:** Persist ingested GitHub/Jira raw events, computed metric snapshots, org/team config, users, roles, and audit logs.

### Frontend / UI System
- **Component Library:** shadcn/ui (`radix-mira` style, `baseColor: neutral`, CSS variables)
- **Primitives:** `radix-ui` unified package (1.4.x)
- **CSS Framework:** Tailwind CSS v4 (CSS-first config, no `tailwind.config.js`; OKLCH tokens via `@theme inline`)
- **Theming:** next-themes (class-based dark mode, `attribute="class"`, system default)
- **Design system source:** reuse `packages/ui` (globals.css tokens, `cn` helper, components) from the reference monorepo
- **Utilities:** class-variance-authority, clsx, tailwind-merge, tw-animate-css
- **Charts:** Recharts (chart token palette `--chart-1..5` already defined in the theme)

### Authentication & Identity
- **Library:** Auth.js (NextAuth v5) with OIDC + OAuth providers
- **SSO:** Azure Entra ID (Microsoft Entra) via OIDC
- **OAuth:** GitHub OAuth app
- **Authorization:** Role-based access control (Admin / Lead / Viewer) persisted in Postgres
- **Sessions:** Secure, httpOnly cookies; database session strategy for auditability

### Data Integrations
- **GitHub:** Octokit REST/GraphQL — PRs, commits, deployments, workflow runs; ingestion via GitHub App or fine-grained PAT
- **Jira:** Jira Cloud/Data Center REST API — issues, sprints, story points, status transitions, changelogs
- **Scheduling:** Scheduled ingestion jobs (cron-style worker) with incremental sync + backfill

### Import Strategy
- **Strategy:** Node.js modules (ESM)
- **Package Manager:** npm (workspaces)
- **Monorepo:** Turborepo (2.8.x) — `apps/*` + `packages/*`

## Assets & Media

### Fonts
- **Provider:** Google Fonts, self-hosted via `next/font`
- **Sans:** Montserrat (`--font-sans`)
- **Mono:** Geist Mono (`--font-mono`)

### Icons
- **Library:** Hugeicons (`@hugeicons/react`), matching the reference design system

## Tooling & Quality

- **Lint:** ESLint 9 (flat config, shared `@workspace/eslint-config`)
- **Format:** Prettier 3 (`prettier-plugin-tailwindcss`; `semi:false`, double quotes, 2-space, printWidth 80)
- **Type Check:** `tsc --noEmit` via Turbo `typecheck`
- **Testing:** Vitest (unit — metric formulas), Playwright (e2e — auth + dashboard). Reference repo ships no tests; this product adds them.
- **CI/CD:** GitHub Actions — lint, typecheck, test, build, container image scan (Trivy), publish image to GHCR

## Infrastructure & Deployment

### Application Hosting
- **Primary:** Self-hosted via Docker
- **Local / small:** docker-compose (app + PostgreSQL + reverse proxy)
- **Enterprise:** Helm chart for Kubernetes
- **Image:** Multi-stage hardened Dockerfile, non-root user, distroless/minimal base, no build-time secrets

### Database Hosting
- **Provider:** Self-hosted PostgreSQL (compose service or managed in-cluster / customer-managed)
- **Backups:** Operator-managed (documented in runbook)

### Asset Storage
- **Provider:** Served by the app / container (no external CDN required for air-gapped installs)

### Deployment Solution
- **CI:** GitHub Actions building and scanning the image
- **CD:** Helm/Kustomize into Kubernetes, or `docker compose up` for smaller footprints
- **Config:** 12-factor env vars; secrets via Kubernetes Secrets / Docker secrets (no secrets in image)

### Code Repository
- **URL:** https://github.com/olafkfreund/dora-dashboard (public)

## Regulated-Environment Considerations
- No third-party SaaS data egress; all processing in-cluster
- Air-gap-friendly (self-hosted fonts, no runtime CDN dependency)
- Audit logging of access and configuration changes
- Documented metric formulas and data lineage for auditability
- Least-privilege integration credentials (GitHub App scopes, Jira scoped tokens)
