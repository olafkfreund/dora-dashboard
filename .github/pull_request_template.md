<!-- Keep PRs focused and reviewable. Delete sections that don't apply. -->

## What & why

<!-- What does this change do, and why is it needed? Link the issue. -->

Closes #

## Changes

-

## How was this tested?

<!-- Commands run, environments, manual steps. -->

- [ ] `npm run lint` clean
- [ ] `npm run typecheck` clean
- [ ] `npm run test` passing
- [ ] `npm run build` succeeds

## Checklist

- [ ] No client-identifying data (org names, real Jira hosts, real issue keys, real figures) added anywhere — code, docs, tests, fixtures, commit messages.
- [ ] No secrets/tokens committed; secrets read from env/secret stores only.
- [ ] Docs / TechDocs updated if behaviour or configuration changed.
- [ ] Metric formula changes are documented in `docs/metrics.md` / `techdocs/metrics.md` for auditability.
- [ ] DB schema changes include a committed Drizzle migration.
