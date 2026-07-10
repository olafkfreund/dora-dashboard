# Self-Hosted Deployment

Deploy the DORA Dashboard into your own estate. The same hardened container image runs via
**docker-compose** for local evaluation, and via the bundled **Helm chart** for Kubernetes
(tested on AWS EKS). For Azure PaaS (Container Apps / App Service) see [Azure](azure.md).

The container listens on port **3000**. Two secrets are always required: `AUTH_SECRET`
(signs sessions) and `APP_ENCRYPTION_KEY` (32-byte base64 key that encrypts integration
tokens at rest with AES-256-GCM). Generate both with `openssl rand -base64 32`. See
[Configuration](configuration.md) for the full environment reference.

## Quick evaluation with Docker

```bash
docker build -t dora-dashboard:local .
docker run -p 3000:3000 \
  -e DATABASE_URL=postgresql://dora:dora@host:5432/dora \
  -e AUTH_SECRET="$(openssl rand -base64 32)" \
  -e APP_ENCRYPTION_KEY="$(openssl rand -base64 32)" \
  dora-dashboard:local
```

### The hardened image

The Dockerfile is multi-stage and hardened for regulated environments:

- Non-root user with dropped Linux capabilities and a RuntimeDefault seccomp profile.
- Minimal base, no build-time secrets baked into the image.
- Schema migrations run on start (idempotent), so a fresh database is brought up to date
  automatically.

## docker-compose (app + Postgres + reverse proxy)

For a self-contained local stack, compose runs the app alongside a PostgreSQL 16 container
and a reverse proxy terminating TLS. Provide the two secrets and a `DATABASE_URL` pointing
at the bundled Postgres service; migrations and the bootstrap admin seed run on first
start. The bootstrap admin email and password come from `BOOTSTRAP_ADMIN_EMAIL` /
`BOOTSTRAP_ADMIN_PASSWORD` — change the password after first sign-in.

## Install with Helm (Kubernetes)

The chart lives at `charts/dora-dashboard`, with a ready-made overlay for EKS at
`values-aws.yaml`.

### Prerequisites

- A Kubernetes cluster (tested on **AWS EKS**) and `kubectl` + `helm` v3/v4.
- **ingress-nginx** (an `IngressClass` named `nginx`).
- **cert-manager** with a `ClusterIssuer` (e.g. `letsencrypt-prod`) for TLS.
- Either a working block-storage `StorageClass` (for the bundled PostgreSQL PVC) or a
  managed database such as RDS.
- A container registry the cluster can pull from (the image ships on GHCR).

### Deploy

```bash
helm upgrade --install dora-dashboard charts/dora-dashboard \
  --namespace dora --create-namespace \
  -f charts/dora-dashboard/values-aws.yaml \
  --set image.tag=<git-sha> \
  --wait --timeout 10m
```

Or use the one-shot helper (creates the GHCR pull secret, deploys, verifies):

```bash
AWS_PROFILE=your-profile deploy/install-aws.sh <image-tag>
```

After install, read the generated bootstrap admin password:

```bash
kubectl get secret dora-dashboard -n dora \
  -o jsonpath='{.data.BOOTSTRAP_ADMIN_PASSWORD}' | base64 -d ; echo
```

### Chart values reference

Everything is configurable via `values.yaml` (override with `-f` or `--set`). Most-used
values:

| Value | Default | Purpose |
| --- | --- | --- |
| `image.repository` / `image.tag` | ghcr.io/olafkfreund/dora-dashboard | Container image. Pin `tag` to an immutable git SHA. |
| `replicaCount` | 1 | App replicas. |
| `ingress.host` | `<ELB-IP>.nip.io` | Public hostname served over TLS. |
| `ingress.className` | `nginx` | Ingress controller class. |
| `ingress.clusterIssuer` | `letsencrypt-prod` | cert-manager issuer for the TLS cert. |
| `secrets.create` | `true` | Generate and preserve AUTH_SECRET / APP_ENCRYPTION_KEY / DB password. |
| `secrets.existingSecret` | "" | Use an externally-managed Secret instead. |
| `secrets.databaseUrl` | "" | External DB (RDS) URL; used when `postgres.enabled=false`. |
| `postgres.enabled` | `true` | Bundle an in-cluster PostgreSQL (disable to use RDS). |
| `postgres.persistence.enabled` | `true` | Use a PVC (needs a StorageClass) vs ephemeral `emptyDir`. |
| `postgres.storageClass` / `storage` | "" / 5Gi | PVC storage class and size. |
| `migrate.initContainer` | `true` | Run schema migrations + bootstrap seed on every pod start (idempotent). |
| `autoscaling.enabled` | `false` | HPA (needs metrics-server). |
| `networkPolicy.enabled` | `true` | Restrict DB access to the app's own pods. |
| `updateStrategy.maxSurge` / `maxUnavailable` | 1 / 0 | Rollout strategy (set `maxSurge: 0` on capacity-constrained nodes). |
| `bootstrap.adminEmail` | `admin@dora.local` | First admin; password is generated once. |

The chart also ships templates for a **snapshot CronJob** (captures `metric_snapshot`
history) and an optional **digest CronJob** (`digest.enabled` + `digest.schedule`), plus a
NetworkPolicy, HPA, and a migrate Job/init-container.

### TLS and ingress

Set `ingress.host` to your hostname and `ingress.clusterIssuer` to your cert-manager
issuer. The chart annotates the Ingress with `cert-manager.io/cluster-issuer`, so a Let's
Encrypt certificate is issued automatically:

```bash
kubectl get certificate -n dora
```

With ingress-nginx you can use `<ELB-IP>.nip.io` (or `dora.<ELB-IP>.nip.io`) as the host
with no DNS setup — the wildcard service resolves the embedded IP.

### Secrets and security

- `AUTH_SECRET` and `APP_ENCRYPTION_KEY` are generated on first install and **preserved
  across upgrades** (via `lookup`), so sessions and encrypted tokens survive rollouts.
- Integration tokens are encrypted with AES-256-GCM before storage and never returned to
  the UI.
- Enable etcd/KMS encryption on your cluster so Kubernetes Secrets are encrypted at rest.
- The pod runs non-root with dropped capabilities and a RuntimeDefault seccomp profile.
- Security headers (CSP, HSTS, X-Frame-Options DENY, nosniff, Permissions-Policy) are set
  by the app.

### Database and persistence

For production, use a managed database:

```bash
helm upgrade --install dora-dashboard charts/dora-dashboard -n dora \
  --set postgres.enabled=false \
  --set secrets.databaseUrl="postgresql://user:pass@your-rds:5432/dora"
```

Use the connection string with no `?schema=` suffix (that is Prisma-only and breaks
postgres.js). To keep the in-cluster PostgreSQL but make it durable, install the EBS CSI
driver (or your cloud's block storage) and set `postgres.persistence.enabled=true` with a
valid `storageClass`. With persistence off, the bundled DB is ephemeral (fine for demos;
the migrate init-container re-seeds schema + admin on restart).

### Upgrade and rollback

```bash
# upgrade to a new immutable image
helm upgrade dora-dashboard charts/dora-dashboard -n dora \
  -f charts/dora-dashboard/values-aws.yaml --set image.tag=<new-sha> --wait

# roll back if needed
helm rollback dora-dashboard -n dora
```

Schema migrations run automatically (idempotent) via the migrate init-container on each
new pod.

## AWS EKS notes

The portal has been deployed to EKS behind ingress-nginx with a Let's Encrypt TLS
certificate issued by cert-manager (`letsencrypt-prod` ClusterIssuer), using the
`values-aws.yaml` overlay. The in-cluster PostgreSQL PVC needs a default StorageClass; for
production, prefer managed **RDS** (`postgres.enabled=false` + `secrets.databaseUrl`).

Manual deploy from a machine with cluster access:

```bash
export AWS_PROFILE=your-profile AWS_REGION=<region>
aws eks update-kubeconfig --name <your-eks-cluster>

# build + push image (or let CI do it)
docker build -t ghcr.io/olafkfreund/dora-dashboard:manual .
docker push ghcr.io/olafkfreund/dora-dashboard:manual

helm upgrade --install dora-dashboard charts/dora-dashboard \
  --namespace dora --create-namespace \
  -f charts/dora-dashboard/values-aws.yaml \
  --set image.tag=manual --wait --timeout 10m
```

### Scheduled sync

For automatic ingestion, call the protected endpoint from a CronJob or scheduler:

```bash
curl -X POST https://<host>/api/sync/gitlab \
  -H "Authorization: Bearer $SYNC_TOKEN"
```

Set a shared `SYNC_TOKEN` env on the app for non-interactive callers (an admin session
also works). The `/api/sync` path is exempt from the auth middleware so the `SYNC_TOKEN`
path works.

## CI/CD (GitHub Actions)

- **`ci.yml`** — on push/PR: install, lint, typecheck, run migrations against a throwaway
  Postgres, `next build`, and `helm lint`/`template`.
- **`deploy.yml`** — on push to `main` (or manual dispatch): build the Docker image and
  push to GHCR (`:<sha>` and `:latest`) with a Trivy scan, assume an AWS role via **OIDC**,
  update kubeconfig, and `helm upgrade --install` into EKS.

Set the `AWS_ROLE_ARN` repo secret (an IAM role the deploy job assumes via GitHub OIDC,
with EKS access). `GITHUB_TOKEN` pushes to GHCR — ensure the package
`ghcr.io/olafkfreund/dora-dashboard` is public or add an `imagePullSecret`.

## Troubleshooting

| Symptom | Likely cause and fix |
| --- | --- |
| Pod `ImagePullBackOff` | Private image — ensure the `ghcr-pull` secret exists (the installer creates it) or make the package public. |
| PVC `Pending` | No block-storage provisioner — set `postgres.persistence.enabled=false` or install the EBS CSI driver. |
| Migrate Job won't schedule | Node at pod cap — the migrate *init-container* handles it (Job is opt-in via `migrate.enabled`). |
| "Test connection" shows 403 | Token scope — use `read_api`, or for fine-grained tokens ensure group read; set the group/project path (no `gitlab.com/` prefix). |
| Sync returns 504 | Large group — raise the ingress proxy timeout (`nginx.ingress.kubernetes.io/proxy-read-timeout`); the sync still completes server-side. |
| Certificate not `Ready` | Check the cert-manager `ClusterIssuer` and that the host resolves to the ingress. |

See [Architecture](architecture.md) for the deployment shape and [Security](security.md)
for the hardening posture.
