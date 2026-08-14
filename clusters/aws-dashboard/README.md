# FluxCD GitOps — aws-dashboard-cluster

GitOps delivery for the DORA dashboard on the EKS cluster `aws-dashboard-cluster`
(eu-west-2, namespace `dora`). Flux replaces the manual
`helm upgrade --install ... --set image.tag=<sha>` flow: the desired state lives
in this directory, and Flux reconciles the cluster to it.

## What's here

| File | Kind | Purpose |
| --- | --- | --- |
| `gitrepository.yaml` | `GitRepository` | Source: this repo, `main` branch (public — no auth). Scoped to `charts/dora-dashboard/`. |
| `helmrelease.yaml` | `HelmRelease` | Renders `charts/dora-dashboard` with `values.yaml` + `values-aws.yaml`, **adopting** the existing `dora-dashboard` release in `dora`. |
| `kustomization.yaml` | kustomize index | Ties the two together for the bootstrap Flux `Kustomization`. |

The `dora` namespace is **intentionally not managed here** — it pre-exists and is
owned outside Flux, so Flux can never prune it.

## Design decisions (why it's safe)

- **Adopt, don't recreate.** `releaseName: dora-dashboard` + `storageNamespace: dora`
  match the live Helm release, so helm-controller runs an *upgrade* against the
  existing release, not a fresh install.
- **Secrets are preserved, not migrated (yet).** `secrets.databaseUrl` is left empty
  (chart default). The chart's `templates/secret.yaml` uses `lookup` to carry forward
  the live in-cluster Secret — `DATABASE_URL` (RDS), `AUTH_SECRET`,
  `APP_ENCRYPTION_KEY`, `DIGEST_SECRET`, bootstrap admin — on every upgrade. **No
  secret ever enters git.** Migrating these to External Secrets Operator or SOPS is a
  documented follow-up below, not a prerequisite.
- **Image tag is the one git-tracked knob.** Pinned in `values-aws.yaml`
  (`image.tag: "6157572"`, quoted — a bare numeric tag coerces to a float and breaks
  the image ref). Releasing a new build = bump that line in a commit. Optional
  image-automation (below) makes this hands-free.

## Current state (LIVE)

Flux is installed and reconciling the release as of 2026-08-14:

- **Flux v2.6.4** (pinned — the cluster is Kubernetes **v1.31**, and Flux ≥2.9 requires
  k8s ≥1.33; 2.6.x supports 1.30–1.33). Components: `source-controller` + `helm-controller`.
- Installed with `flux install` + `kubectl apply` of `gitrepository.yaml` +
  `helmrelease.yaml` (see "Live install (no PAT)" below) — **not** `flux bootstrap`, because
  the available token lacks push to this repo. Git is still the source of truth for the
  chart + values; the controllers themselves are just not yet self-managed from git.
- The existing release was **adopted in place** — Helm revision advanced 64 → **65**, the
  running pod was **not restarted**, and the RDS `DATABASE_URL` was preserved. Nothing lost.

Two gotchas that were fixed during rollout (both now correct in-repo):

- `image.tag` must be **quoted** in `values-aws.yaml` — a bare numeric tag renders as a float.
- `valuesFiles` are resolved **relative to the repo root**, not the chart path, and the
  chart's own `values.yaml` is **not** auto-included — hence the full
  `charts/dora-dashboard/values.yaml` + `charts/dora-dashboard/values-aws.yaml` paths.

## Prerequisite: cluster capacity

`aws-dashboard-cluster` is currently a **single node, pod capacity 11, 10 pods in
use** — one free slot. Flux's controllers need ~2 pods minimum (source +
helm-controller), so **Flux cannot be installed until there is capacity**. Do **not**
force it onto the full node — that risks evicting the live portal pod.

Provide capacity first, by either:
- **Add a second node** to the managed node group (recommended — the `values-aws.yaml`
  zero-downtime rollout comments already assume a 2nd node), or
- Move to a larger instance type with a higher ENI/pod cap.

## Bootstrap (one-time, after capacity exists)

```sh
export AWS_PROFILE=Synechron
aws eks update-kubeconfig --name aws-dashboard-cluster --region eu-west-2

# Minimal controller set (fits smaller clusters). GITHUB_TOKEN needs repo scope
# to commit the flux-system manifests back to this repo.
export GITHUB_TOKEN=<pat-with-repo-scope>
flux bootstrap github \
  --owner=olafkfreund \
  --repository=dora-dashboard \
  --branch=main \
  --path=clusters/aws-dashboard \
  --components=source-controller,helm-controller,kustomize-controller \
  --personal
```

`flux bootstrap` installs the controllers, commits `clusters/aws-dashboard/flux-system/`,
and creates a Flux `Kustomization` that reconciles this directory — which applies the
`GitRepository` and `HelmRelease` here.

### Live install (no PAT) — what's actually deployed

When a push-capable token isn't available, install the controllers and apply the two
resources directly. Git remains the source of truth for the chart + values.

```sh
# k8s 1.31 → pin Flux <2.9 (use the 2.6.4 CLI so it installs matching controllers)
flux install --components=source-controller,helm-controller

kubectl apply -f clusters/aws-dashboard/gitrepository.yaml \
              -f clusters/aws-dashboard/helmrelease.yaml
```

### Adoption check

helm-controller upgrades the existing release in place. Confirm the revision advances
and the pod is undisturbed:

```sh
flux -n flux-system get helmrelease dora-dashboard
helm history dora-dashboard -n dora            # revision increments, status deployed
kubectl -n dora get pods                       # same pod, no restart
curl -sI https://dora.52.56.112.109.nip.io | head -1   # HTTP 200
```

If adoption ever refuses (`release exists`), it means Helm storage metadata differs;
re-run with the release intact — helm-controller keys off Helm storage, so a matching
`releaseName`/`storageNamespace` (as set here) adopts cleanly.

## Day-2 operations

| Task | How |
| --- | --- |
| Release a new image | Commit a new `image.tag` in `charts/dora-dashboard/values-aws.yaml`; Flux rolls it out. |
| Force a sync now | `flux reconcile helmrelease dora-dashboard -n flux-system --with-source` |
| Pause deploys | `flux suspend helmrelease dora-dashboard -n flux-system` / `resume` |
| Roll back | `git revert` the tag commit — Flux reconciles to the previous state. |
| Watch status | `flux get all -A` |

## Rollback to manual Helm (escape hatch)

Flux only ever runs `helm upgrade` on the same release, so the manual flow still works:

```sh
flux suspend helmrelease dora-dashboard -n flux-system   # stop Flux fighting you
helm upgrade dora-dashboard charts/dora-dashboard -n dora \
  -f charts/dora-dashboard/values-aws.yaml \
  --set image.tag=<sha> --wait
```

A pre-adoption backup of the live Secret + Helm values/manifest was taken during
setup (kept off git). Re-apply the Secret from that backup if it is ever lost.

## Follow-ups (not required to run)

1. **Secrets → External Secrets Operator + AWS Secrets Manager** (best fit for
   regulated + RDS). Store `DATABASE_URL` et al. in Secrets Manager; ESO syncs them to
   the `dora-dashboard` Secret via an IRSA role; set `secrets.create=false`. Removes the
   `lookup`-preserve dependency and makes the Secret reproducible/auditable.
   Alternative: SOPS + AWS KMS (Flux-native `decryption.provider: sops`, no extra operator).
2. **Image automation** — add `image-reflector-controller` + `image-automation-controller`
   and an `ImagePolicy` so CI-pushed builds auto-open a tag-bump commit. Pair with a
   cosign `ImagePolicy` verification (images are already keyless-signed in CI).
3. **Retire `deploy.yml`'s deploy job** — with Flux owning delivery, CI keeps only
   build + sign + SBOM; drop the AWS-OIDC/helm step.
4. **notification-controller → Teams/Slack** on reconcile success/failure.
