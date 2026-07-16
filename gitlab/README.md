# GitLab CI/CD for DORA Dashboard

GitLab CI/CD port of the GitHub Actions workflows in `.github/workflows/`
(`ci.yml`, `deploy.yml`, `security.yml`). Same behaviour: test → build+sign →
security scan → deploy to EKS via Helm.

## Setup

`.gitlab-ci.yml` lives in this `gitlab/` folder, not the repo root. Choose one:

- **Point GitLab at it** (recommended, keeps the folder tidy):
  Settings → CI/CD → General pipelines → **CI/CD configuration file** →
  `gitlab/.gitlab-ci.yml`
- **or** copy it to the repo root: `cp gitlab/.gitlab-ci.yml .gitlab-ci.yml`

## Pipeline

| Stage      | Job          | What it does                                              | Gates? |
|------------|--------------|-----------------------------------------------------------|--------|
| `test`     | `build-test` | npm install, lint, typecheck, **test**, migrate, build (Postgres service) | yes |
| `test`     | `helm-lint`  | `helm lint` + `helm template` of the chart                | yes    |
| `security` | `trivy-fs`   | Filesystem/dependency vuln scan → Container Scanning report | no (report-only) |
| `security` | `npm-audit`  | `npm audit --audit-level=high`                            | no (`allow_failure`) |
| `security` | `zap-baseline` | OWASP ZAP passive scan against the running app          | no (`allow_failure`) |
| `build`    | `build-image`| Build + push image, Trivy scan, cosign sign, SBOM + attest | main only |
| `deploy`   | `deploy`     | `helm upgrade --install` to EKS + rollout status          | main only |

`build` and `deploy` run only on `main` (or a manual web-triggered pipeline),
matching the GitHub `push: [main]` + `workflow_dispatch` triggers.

## Required CI/CD variables

Set under **Settings → CI/CD → Variables**. Mark secrets *Masked* and
*Protected* (protected = available only on protected branches like `main`).

### Container registry (build-image)
Uses the project's **GitLab Container Registry** via built-in `$CI_REGISTRY_*`
variables — no config needed. Image is pushed to `$CI_REGISTRY_IMAGE`.
To push elsewhere, override `IMAGE`, `CI_REGISTRY`, `CI_REGISTRY_USER`,
`CI_REGISTRY_PASSWORD`.

### AWS / EKS deploy (deploy) — OIDC, no static keys
| Variable       | Description                                                        |
|----------------|--------------------------------------------------------------------|
| `AWS_ROLE_ARN` | IAM role the pipeline assumes via OIDC (`sts:AssumeRoleWithWebIdentity`) |
| `AWS_REGION`   | default `eu-west-2` (overridable)                                  |
| `EKS_CLUSTER`  | default `aws-dashboard-cluster`                                    |
| `NAMESPACE`    | default `dora`                                                     |
| `RELEASE`      | default `dora-dashboard`                                           |

The IAM role's trust policy must federate GitLab's OIDC provider
(`https://<your-gitlab-host>`, aud `sts.amazonaws.com`) and be scoped to this
project. See GitLab docs: *Connect to cloud services → AWS*.

> **Static-key fallback** (if OIDC isn't available): remove the `id_tokens`
> block and `assume-role-with-web-identity` lines from the `deploy` job and set
> `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` as protected variables instead.

### cosign signing (build-image)
Keyless via Sigstore OIDC — the `id_tokens: SIGSTORE_ID_TOKEN` block handles it,
no variables needed. For **air-gapped** installs (no public Fulcio/Rekor), switch
to key-based signing: generate a keypair, set `COSIGN_PRIVATE_KEY` +
`COSIGN_PASSWORD` variables, and replace `cosign sign --yes "$DIGEST"` with
`cosign sign --key env://COSIGN_PRIVATE_KEY "$DIGEST"`.

## Runner requirements

- A runner with the **Docker executor** and **`docker:dind`** enabled
  (privileged mode) for `build-image` and `zap-baseline`.
- Outbound access to pull base images (`node:22`, `postgres`, `aquasec/trivy`,
  `alpine/helm`, `alpine/k8s`, `docker`, `ghcr.io/zaproxy/zaproxy`) — mirror
  these into an internal registry for air-gapped estates.
- The `deploy` runner needs network reach to the EKS control plane.

## Notes / differences from GitHub Actions

- Added an `npm test` step to `build-test` (vitest is present; the GitHub CI did
  not run it).
- GHCR → GitLab Container Registry; GitHub Actions cache → GitLab `cache:`.
- `trivy-fs` also emits a GitLab **Container Scanning** report so findings show
  in the MR security widget. It's report-only (`--exit-code 0`); set to `1` to gate.
- Security scans and ZAP are `allow_failure`/report-only, matching the source.
