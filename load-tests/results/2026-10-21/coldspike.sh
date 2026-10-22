#!/bin/bash
# Usage: coldspike.sh <label> [rate]. Waits until cart/order/catalog are back at
# their HPA minimum (idle), then sends a sudden checkout spike for 60s.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/../.."   # load-tests/
OUT_DIR="${OUT_DIR:-${TMPDIR:-/tmp}}"
for i in $(seq 1 60); do
  s=$(for h in cart-hpa order-hpa catalog-hpa; do kubectl get hpa $h -n shopsphere -o jsonpath='{.status.currentReplicas}/{.spec.minReplicas} '; done)
  idle=1; for pair in $s; do [ "${pair%/*}" != "${pair#*/}" ] && idle=0; done
  [ $idle = 1 ] && break; sleep 10
done
echo "start replicas (current/min): $s"
k6 run -q -e BASE_URL=http://localhost:8080 -e RATE=${2:-120} -e DURATION=60s scenarios/checkout-flow.js > "$OUT_DIR/cold_$1.log" 2>&1
echo "end replicas: $(for h in cart-hpa order-hpa catalog-hpa; do kubectl get hpa $h -n shopsphere -o jsonpath='{.metadata.name}={.status.currentReplicas} '; done)"
echo "$1: $(grep -E 'checkout_success\.\.' "$OUT_DIR/cold_$1.log" | awk '{print $2, $3, $4, $5}') | order $(grep -E 'order_create_latency' "$OUT_DIR/cold_$1.log" | grep -oE 'p\(95\)=[0-9.]+[a-z]+') | $(grep -E '^\s+iterations' "$OUT_DIR/cold_$1.log" | awk '{print $3}') checkouts done"
