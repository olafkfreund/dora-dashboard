# Product Roadmap

> Last Updated: 2026-07-06
> Version: 1.0.0
> Status: Planning

Effort scale: XS=1 day · S=2-3 days · M=1 week · L=2 weeks · XL=3+ weeks

## Phase 1: Foundation & Auth (MVP shell)

**Goal:** A running, self-hosted Next.js portal with the reference theme and working enterprise auth.
**Success Criteria:** A user can sign in via Azure Entra ID or GitHub OAuth, land on a themed authenticated dashboard shell, and the app runs via `docker compose up`.

### Must-Have Features

- [ ] Bootstrap Turborepo (apps/web + packages/ui) reusing reference theme/tokens - `M`
- [ ] Port shadcn/ui design system + Tailwind v4 tokens (drop `output: export`, enable SSR/API) - `S`
- [ ] PostgreSQL + Prisma schema (users, roles, orgs/teams, sessions, audit_log) - `M`
- [ ] Auth.js (NextAuth v5): Azure Entra ID OIDC SSO + GitHub OAuth - `L`
- [ ] RBAC (Admin/Lead/Viewer) + protected routes + audit logging of sign-in/config - `M`
- [ ] docker-compose (app + Postgres + reverse proxy) and hardened multi-stage Dockerfile - `M`

### Should-Have Features

- [ ] App shell: sidebar nav, theme toggle, user menu - `S`
- [ ] GitHub Actions CI: lint, typecheck, test, build, image scan (Trivy), push to GHCR - `M`

### Dependencies

- GitHub OAuth app + Azure Entra ID app registration (client IDs/secrets)

## Phase 2: Data Ingestion (GitHub + Jira)

**Goal:** Reliably ingest and store raw delivery data from GitHub and Jira.
**Success Criteria:** Scheduled jobs pull PRs/deployments/workflow runs from GitHub and issues/sprints/transitions from Jira into Postgres with incremental sync and backfill.

### Must-Have Features

- [ ] GitHub integration (Octokit): PRs, commits, deployments, workflow runs - `L`
- [ ] Jira integration: issues, sprints, story points, status changelogs - `L`
- [ ] Ingestion scheduler/worker with incremental sync + historical backfill - `L`
- [ ] Raw-event data model + idempotent upserts + sync state tracking - `M`
- [ ] Integration config UI (connect org/project, map teams, scoped credentials) - `M`

### Should-Have Features

- [ ] Rate-limit handling, retries, and sync health/status surface - `M`
- [ ] Data lineage metadata for auditability - `S`

### Dependencies

- Phase 1 auth + DB; GitHub App / Jira scoped tokens

## Phase 3: Metrics Engine & Core Dashboard

**Goal:** Compute and visualize DORA-4 plus the extended Synechron metrics.
**Success Criteria:** Dashboard shows DORA-4 and extended metrics with trends, filterable by team and date range, with documented formulas.

### Must-Have Features

- [ ] DORA-4 engine: Deployment Frequency, Lead Time for Changes, Change Failure Rate, MTTR - `L`
- [ ] Flow metrics: Cycle Time, Lead Time, Work Item Age, Blocked Time - `L`
- [ ] Velocity & Predictability: Average Velocity (3-5 sprints), Delivery Predictability - `M`
- [ ] Dashboard UI: metric cards, trend charts (Recharts), team/date filters - `L`
- [ ] Documented metric formulas + data-lineage view - `M`

### Should-Have Features

- [ ] Metric snapshotting (nightly precompute) for fast queries - `M`
- [ ] Drill-down from a metric to underlying GitHub/Jira items - `M`

### Dependencies

- Phase 2 ingested data

## Phase 4: Quality Metrics & Insights

**Goal:** Add quality/leading-indicator metrics and actionable insights.
**Success Criteria:** Defect Escape Rate, Defect Root Cause, and Test Automation Coverage are tracked with thresholds and early-warning signals.

### Must-Have Features

- [ ] Defect Escape Rate (pre- vs post-release defects) - `M`
- [ ] Defect Root Cause categorization/reporting - `M`
- [ ] Test Automation Coverage ingestion + metric - `M`
- [ ] Thresholds & early-warning indicators for ageing/blocked work - `M`

### Should-Have Features

- [ ] Configurable targets/benchmarks per team - `S`
- [ ] Scheduled email/Teams digest of metric trends - `M`

### Dependencies

- Phase 3 metrics engine

## Phase 5: Enterprise Hardening & Scale

**Goal:** Production-grade deployment for regulated environments.
**Success Criteria:** Helm chart deploys to Kubernetes with SSO, audit exports, and passes a security review.

### Must-Have Features

- [ ] Helm chart (values for SSO, DB, ingress, secrets) - `L`
- [ ] Security hardening: CSP, headers, container non-root, image scanning gates - `M`
- [ ] Audit log export + admin audit UI - `M`
- [ ] Multi-org / multi-team scaling + performance tuning - `L`

### Should-Have Features

- [ ] Air-gapped install guide + offline asset bundling - `M`
- [ ] SBOM generation + provenance/attestation in CI - `M`
- [ ] Data retention & purge policies - `S`

### Dependencies

- Phases 1-4 complete
