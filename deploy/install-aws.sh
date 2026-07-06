#!/usr/bin/env bash
# Safe install/upgrade of DORA Dashboard into aws-dashboard-cluster.
# - Only touches the `aws-dashboard` namespace.
# - Creates a GHCR imagePullSecret (image is private).
# - Deploys on a dedicated host; does NOT modify the existing portal-* resources.
#
# Usage: deploy/install-aws.sh [IMAGE_TAG]   (default: latest)
set -euo pipefail

IMAGE_TAG="${1:-latest}"
export AWS_PROFILE="${AWS_PROFILE:-Synechron}"
export AWS_REGION="${AWS_REGION:-eu-west-2}"
CLUSTER=aws-dashboard-cluster
NAMESPACE=aws-dashboard
RELEASE=dora-dashboard
CHART_DIR="$(cd "$(dirname "$0")/.." && pwd)/charts/dora-dashboard"

echo "==> Verifying AWS session (profile: $AWS_PROFILE)"
aws sts get-caller-identity >/dev/null

echo "==> Updating kubeconfig for $CLUSTER"
aws eks update-kubeconfig --name "$CLUSTER" --region "$AWS_REGION" >/dev/null

echo "==> Ensuring namespace $NAMESPACE"
kubectl get ns "$NAMESPACE" >/dev/null 2>&1 || kubectl create ns "$NAMESPACE"

echo "==> Creating/updating GHCR imagePullSecret 'ghcr-pull'"
GH_USER="${GH_USER:-olafkfreund}"
GH_TOKEN="$(gh auth token)"
kubectl create secret docker-registry ghcr-pull \
  --namespace "$NAMESPACE" \
  --docker-server=ghcr.io \
  --docker-username="$GH_USER" \
  --docker-password="$GH_TOKEN" \
  --dry-run=client -o yaml | kubectl apply -f -

echo "==> helm upgrade --install $RELEASE (tag: $IMAGE_TAG)"
helm upgrade --install "$RELEASE" "$CHART_DIR" \
  --namespace "$NAMESPACE" \
  -f "$CHART_DIR/values-aws.yaml" \
  --set image.tag="$IMAGE_TAG" \
  --wait --timeout 10m

echo "==> Rollout status"
kubectl rollout status deploy/"$RELEASE" -n "$NAMESPACE" --timeout=5m

echo "==> Certificate status"
kubectl get certificate -n "$NAMESPACE" 2>/dev/null || true

echo "==> Existing resources left untouched:"
kubectl get deploy,ingress -n "$NAMESPACE" | grep -E "portal-|NAME" || true

echo
echo "Done. URL: https://dora.52.56.112.109.nip.io"
echo "Admin password:"
echo "  kubectl get secret $RELEASE -n $NAMESPACE -o jsonpath='{.data.BOOTSTRAP_ADMIN_PASSWORD}' | base64 -d; echo"
