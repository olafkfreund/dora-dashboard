# Deployment

The portal deploys to the **`aws-dashboard-cluster`** EKS cluster (AWS `Synechron`
profile, `eu-west-2`) via a Helm chart, behind **ingress-nginx** with a **Let's Encrypt**
TLS certificate issued by **cert-manager** (`letsencrypt-prod` ClusterIssuer).

- **URL:** https://dora.52.56.112.109.nip.io  (dedicated host; leaves any existing app on `52.56.112.109.nip.io` untouched)
- **One-shot install:** `deploy/install-aws.sh [image-tag]`
- **Namespace:** `aws-dashboard`
- **Image:** `ghcr.io/olafkfreund/dora-dashboard`

## Prerequisites (in-cluster — already present)

- `ingress-nginx` (IngressClass `nginx`)
- `cert-manager` with a `letsencrypt-prod` ClusterIssuer
- A default StorageClass (for the bundled PostgreSQL PVC)

## CI/CD

- **`.github/workflows/ci.yml`** — on push/PR: install, lint, typecheck, run migrations
  against a throwaway Postgres, `next build`, and `helm lint`/`template`.
- **`.github/workflows/deploy.yml`** — on push to `main` (or manual dispatch):
  1. Build the Docker image and push to GHCR (`:<sha>` and `:latest`), Trivy scan.
  2. Assume an AWS role via **OIDC**, update kubeconfig, and `helm upgrade --install`.

### Required GitHub configuration

| Secret | Purpose |
| --- | --- |
| `AWS_ROLE_ARN` | IAM role the deploy job assumes via GitHub OIDC. Must have EKS access and be mapped in the cluster's access entries / `aws-auth`. |

`GITHUB_TOKEN` (automatic) is used to push to GHCR. Ensure the package
`ghcr.io/olafkfreund/dora-dashboard` is **public** or add an `imagePullSecret`.

To set up OIDC once:
- Add the GitHub OIDC provider (`token.actions.githubusercontent.com`) to the AWS account.
- Create an IAM role trusting `repo:olafkfreund/dora-dashboard:*` with EKS permissions,
  and grant it cluster access (EKS access entry with `AmazonEKSClusterAdminPolicy` or an
  RBAC binding).

## Manual deploy (from a machine with the Synechron profile)

```bash
export AWS_PROFILE=Synechron AWS_REGION=eu-west-2
aws eks update-kubeconfig --name aws-dashboard-cluster

# build + push image (or let CI do it)
docker build -t ghcr.io/olafkfreund/dora-dashboard:manual .
docker push ghcr.io/olafkfreund/dora-dashboard:manual

helm upgrade --install dora-dashboard charts/dora-dashboard \
  --namespace aws-dashboard --create-namespace \
  -f charts/dora-dashboard/values-aws.yaml \
  --set image.tag=manual --wait --timeout 10m
```

## GitOps with FluxCD (recommended for the live cluster)

Instead of running `helm upgrade` by hand, the live install can be reconciled by
**FluxCD** from git. The desired state lives in `clusters/aws-dashboard/` (a
`GitRepository` + a `HelmRelease` rendering this chart with `values.yaml` +
`values-aws.yaml`). The `HelmRelease` **adopts the existing release in place**
(`releaseName: dora-dashboard`, `storageNamespace: dora`), and secrets are preserved via
the chart's `lookup` (the RDS `DATABASE_URL` never enters git) — so cut-over loses nothing.

```bash
export AWS_PROFILE=Synechron
aws eks update-kubeconfig --name aws-dashboard-cluster --region eu-west-2
export GITHUB_TOKEN=<pat-with-repo-scope>
flux bootstrap github \
  --owner=olafkfreund --repository=dora-dashboard --branch=main \
  --path=clusters/aws-dashboard \
  --components=source-controller,helm-controller,kustomize-controller --personal
```

Releasing a new build becomes a commit that bumps `image.tag` in `values-aws.yaml`; roll
back with `git revert`. **Capacity note:** Flux needs ~2 controller pods — add a second
node before bootstrapping on a pod-cap-constrained cluster. Full bootstrap / adoption /
day-2 / rollback runbook: [`clusters/aws-dashboard/README.md`](clusters/aws-dashboard/README.md).

## Getting the bootstrap admin password

```bash
kubectl get secret dora-dashboard -n aws-dashboard \
  -o jsonpath='{.data.BOOTSTRAP_ADMIN_PASSWORD}' | base64 -d ; echo
```

Change it after first sign-in.

## Production database

The chart bundles PostgreSQL (`postgres.enabled=true`) for a self-contained install.
For production, use managed **RDS**: set `postgres.enabled=false` and
`secrets.databaseUrl` to the RDS connection string (no `?schema=` suffix).
