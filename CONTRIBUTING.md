# Contributing to DORA Dashboard

Thanks for contributing. This guide keeps changes consistent and audit-ready.

## Ground rules

- **No client data, ever.** Never commit client/org names, real Jira hosts, real
  issue keys, real per-PI figures, credentials, or production data — in code, docs,
  tests, fixtures, or commit messages. Use the neutral placeholders already in the
  repo (`example-org/platform`, project key `DEMO`, `example.atlassian.net`,
  field IDs `cf10001`–`cf10005`).
- **Team-level metrics only.** The product deliberately does not measure or rank
  individual developers (see `.agent-os/product/decisions.md`, DEC-003). Do not add
  per-individual metrics.
- **Secrets** come from env/secret stores, never from code or the image.

## Getting started

Prerequisites: Node.js 22, PostgreSQL 16 (or Docker).

```bash
npm install
cp .env.example .env            # fill in DATABASE_URL, AUTH_SECRET, APP_ENCRYPTION_KEY, ...
node scripts/migrate.mjs        # apply Drizzle migrations
node scripts/seed.mjs           # bootstrap an admin user
npm run dev                     # http://localhost:8191
```

See [TechDocs → Development](techdocs/development.md) for detail.

## Development workflow

1. Branch from `main` using a conventional prefix: `feat/…`, `fix/…`, `chore/…`, `docs/…`.
2. Make focused changes with clear commits ([Conventional Commits](https://www.conventionalcommits.org/) encouraged).
3. Before pushing, ensure all of these are clean:
   ```bash
   npm run lint
   npm run typecheck
   npm run test
   npm run build
   ```
4. DB schema change? Generate and commit a migration: `npm run db:generate`.
5. Metric formula change? Update `docs/metrics.md` and `techdocs/metrics.md` — formulas are audit artefacts.
6. Open a PR using the template; CI (lint, typecheck, migrate, build, helm lint) must pass.

## Code style

- TypeScript, ESLint (flat config) and Prettier (`semi: false`, double quotes,
  2-space, printWidth 80). `npm run lint` must report **zero** problems.
- Prefer the smallest correct change. Reuse existing helpers before adding new ones.

## Reporting security issues

See [SECURITY.md](SECURITY.md) — report privately, never as a public issue.
