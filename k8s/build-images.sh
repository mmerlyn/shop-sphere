#!/usr/bin/env bash
# Build all 8 service images and load them into the kind cluster.
set -euo pipefail
cd "$(dirname "$0")/.."

CLUSTER=shopsphere
declare -a SERVICES=(
  "api-gateway"
  "user-service"
  "product-service"
  "cart-service"
  "order-service"
  "notification-service"
  "review-service"
  "inventory-service"
)

for svc in "${SERVICES[@]}"; do
  img="shopsphere/${svc}:local"
  echo "=========================================="
  echo ">> building ${img}"
  echo "=========================================="
  docker build -t "${img}" "services/${svc}"
  echo ">> loading ${img} into kind/${CLUSTER}"
  kind load docker-image "${img}" --name "${CLUSTER}"
done

echo "ALL IMAGES BUILT AND LOADED"
