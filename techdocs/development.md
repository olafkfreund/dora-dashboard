# Local Development

How to run the DORA Dashboard on your machine, apply migrations, seed data, and run the
checks that CI runs.

## Prerequisites

- **Node.js** 20+ (22 LTS recommended; the repo declares `engines.node >= 20`).
- **PostgreSQL 16** — a local instance, a Docker container, or the bundled compose service.
- **npm** (the project uses ESM and standard npm scripts).

## Install and configure

```bash
git clone https://github.com/olafkfreund/dora-dashboard.git
cd dora-dashboard
npm install

# environment
cp .env.example .env
# then set at minimum:
#   DATABASE_URL, AUTH_SECRET, APP_ENCRYPTION_KEY,
#   BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_PASSWORD
```

Generate the two required secrets:

```bash
echo "AUTH_SECRET=$(openssl rand -base64 32)"
echo "APP_ENCRYPTION_KEY=$(openssl rand -base64 32)"
```

See [Configuration](configuration.md) for the full environment reference. The dev server
runs on port **8191** by default (`PORT` in `.env`).

## npm scripts

| Script | Command | Purpose |
| --- | --- | --- |
| `npm run dev` | `next dev -p 8191` | Start the dev server (hot reload). |
| `npm run build` | `next build` | Production build. |
| `npm run start` | `next start -p 8191` | Serve the production build. |
| `npm run lint` | `eslint .` | Lint. |
| `npm run typecheck` | `tsc --noEmit` | Type-check. |
| `npm test` | `vitest run` | Run the unit tests. |
| `npm run db:generate` | `drizzle-kit generate` | Generate a migration from schema changes. |
| `npm run db:migrate` | `drizzle-kit migrate` | Apply migrations via drizzle-kit. |
| `npm run db:studio` | `drizzle-kit studio` | Browse the database in Drizzle Studio. |
| `npm run seed` | `node scripts/seed.mjs` | Seed the bootstrap admin. |

## Database migrations

Migrations are committed SQL under `db/migrations/`. Two ways to apply them:

- **Development / schema authoring** — `npm run db:generate` writes a new SQL migration from
  the Drizzle schema in `db/schema.ts`; `npm run db:migrate` applies it.
- **Containers / CI** — `node scripts/migrate.mjs` applies `db/migrations/*.sql` in order,
  tracked in a `_migrations` table and wrapped in a transaction. It is **idempotent** and
  waits for the database to accept connections (the bundled Postgres may still be starting),
  which is why it runs as the Helm migrate init-container on every pod start.

```bash
node scripts/migrate.mjs
```

## Seeding

- **Bootstrap admin** — `node scripts/seed.mjs` is **create-only**: if the admin
  (`BOOTSTRAP_ADMIN_EMAIL`) already exists it is left untouched, so an in-app
  password/role/status change is never reverted. Safe to run on every start. To
  intentionally rotate the password, use `node scripts/rotate-admin.mjs [newPassword]`.
- **Mock demo data** — `node scripts/seed-demo.mjs` wipes ingested delivery data and
  replaces it with **deterministic mock data** (a seeded PRNG, so every run is identical) so
  the portal shows realistic DORA / flow / quality metrics **without** connecting to any real
  GitLab or Jira. Useful for regulated demos, sales, and offline evaluation. It touches only
  ingested tables and derived snapshots — never users, roles, audit log, integration
  credentials, SSO, teams, or metric config. Use `--wipe` to clear ingested data without
  re-seeding.

```bash
node scripts/seed-demo.mjs          # wipe + seed mock data
node scripts/seed-demo.mjs --wipe   # wipe only
```

## Testing

Unit tests use **Vitest** and live next to the code they cover in `lib/metrics/` (e.g.
`dora-compute.test.ts`, `flow-compute.test.ts`, `pr-cycle-compute.test.ts`,
`quality-compute.test.ts`, `allocation-compute.test.ts`, `config.test.ts`,
`dora-tier.test.ts`) — the metric formulas are the most important thing to verify.

```bash
npm test
```

## CI/CD

- **`ci.yml`** — on push/PR: install, lint, typecheck, run migrations against a throwaway
  Postgres, `next build`, and `helm lint` / `helm template`.
- **`deploy.yml`** — on push to `main` (or manual dispatch): build the Docker image, push to
  GHCR with a Trivy scan, assume an AWS role via OIDC, and `helm upgrade` into EKS.
- **`security.yml`** — additional security scanning in CI.

Run the same gates locally before pushing:

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

## Project layout

- `app/` — Next.js App Router: `api/` (route handlers incl. sync + digest), `actions/`
  (Server Actions), `settings/`, `users/`, `login/`, `audit/`, `help/`, plus `layout.tsx`
  and `globals.css`.
- `lib/metrics/` — the pure-TypeScript metrics engine (DORA, flow, PR cycle, quality,
  allocation, snapshotting, tiers, config) with co-located Vitest tests.
- `lib/gitlab.ts` — GitLab REST client (sends the `PRIVATE-TOKEN` header).
- `db/` — `schema.ts` (Drizzle table definitions), `index.ts` (the postgres.js client), and
  `migrations/`.
- `scripts/` — `migrate.mjs`, `seed.mjs`, `seed-demo.mjs`, `rotate-admin.mjs`,
  `load-env.mjs`.
- `charts/dora-dashboard/` — the Helm chart. `deploy/azure/` — Bicep + Terraform.

See [Deployment](deployment.md) and [Azure](azure.md) to ship a build, and
[Architecture](architecture.md) for how the pieces fit together.
